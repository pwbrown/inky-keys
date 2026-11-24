/**
 * Optional topic vocabulary (REQUIREMENTS §6): downloads the Wikipedia article
 * for a topic and keeps the words that say most about it: names, places and
 * words the word pack doesn't have first, then pack words unusually frequent in it. Only ever
 * runs when the player asks, and sends nothing but the topic: no cookies, no
 * referrer, no identifiers.
 */
import { GAME_CONFIG } from '../core/config';
import type { Blocklist } from './blocklist';
import type { Language } from '../core/languages';
import { accentedLetters } from '../core/accents';

/**
 * The Wikipedia for each words language: the only origins the game ever
 * contacts, and only when the player asks (CSP connect-src, PRIVACY.md).
 */
export const VOCAB_API_ORIGINS: Readonly<Record<Language, string>> = {
  en: 'https://en.wikipedia.org',
  fr: 'https://fr.wikipedia.org',
  es: 'https://es.wikipedia.org',
};

/** English Wikipedia, as before. */
export const VOCAB_API_ORIGIN = VOCAB_API_ORIGINS.en;

/** Wikimedia asks browser clients to name themselves with this header (no personal details). */
const API_USER_AGENT = 'InkyKeys/2 (https://github.com/pwbrown/inky-keys)';

/** Articles shorter than this are stubs or disambiguation pages. */
const MIN_ARTICLE_CHARS = 1500;

/** Word -> word-pack tier (0 = most common). */
export type Dictionary = ReadonlyMap<string, number>;

export class VocabError extends Error {
  constructor(
    message: string,
    readonly reason: 'invalid-topic' | 'offline' | 'failed' | 'empty',
  ) {
    super(message);
    this.name = 'VocabError';
  }
}

/** Letters, spaces, hyphens and apostrophes only; 2–40 characters. */
export function cleanTopic(topic: string): string | null {
  const clean = topic.trim().replace(/\s+/g, ' ').toLowerCase();
  return /^[\p{L}][\p{L} '-]{1,39}$/u.test(clean) ? clean : null;
}

/** Search for the topic and return the best article's plain text in one request. */
export function topicUrl(topic: string, lang: Language = 'en'): string {
  const url = new URL('/w/api.php', VOCAB_API_ORIGINS[lang]);
  const params: Record<string, string> = {
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    redirects: '1',
    generator: 'search',
    gsrsearch: topic,
    gsrlimit: '1',
    prop: 'extracts|pageprops',
    ppprop: 'disambiguation',
    explaintext: '1',
    exsectionformat: 'plain',
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/** The article text from an API response, or null for no page, a disambiguation page or a stub. */
export function articleText(raw: unknown): string | null {
  const pages = (raw as { query?: { pages?: unknown } } | null)?.query?.pages;
  if (!Array.isArray(pages)) return null;
  const page = pages[0] as { extract?: unknown; pageprops?: { disambiguation?: unknown } } | undefined;
  if (!page || page.pageprops?.disambiguation !== undefined) return null;
  return typeof page.extract === 'string' && page.extract.length >= MIN_ARTICLE_CHARS ? page.extract : null;
}

/**
 * Words an article uses that say nothing about its topic: reference
 * boilerplate, months and days (capitalised in English, so they'd pass for names).
 */
const wordSet = (words: string) => new Set(words.split(' '));
const SKIP_WORDS: Readonly<Record<Language, ReadonlySet<string>>> = {
  en: wordSet(
    'isbn issn doi retrieved archived cited citation ibid wikipedia et al pp vol eds edn ' +
      'january february march april may june july august september october november december ' +
      'monday tuesday wednesday thursday friday saturday sunday',
  ),
  fr: wordSet(
    // English titles are common in French and Spanish articles.
    'the and of isbn issn doi consulté archivé archive wikipédia et al vol éd ' +
      'janvier février mars avril mai juin juillet août septembre octobre novembre décembre ' +
      'lundi mardi mercredi jeudi vendredi samedi dimanche',
  ),
  es: wordSet(
    'the and of isbn issn doi consultado archivado wikipedia et al vol ed ' +
      'enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre ' +
      'lunes martes miércoles jueves viernes sábado domingo',
  ),
};

/** Endings to try taking off a word the pack doesn't have, to find the pack word it comes from. */
const ENDINGS: Readonly<Record<Language, readonly string[]>> = {
  en: ['s', 'es', 'ed', 'd', 'ing', 'er', 'ers', 'est', 'ly', "'s"],
  fr: ['s', 'x', 'e', 'es', 'ent', 'aient', 'ait'],
  es: ['s', 'es', 'a', 'as', 'os', 'ando', 'ado', 'ada', 'aron'],
};

/** The pack word a word comes from ("starring" → "star"), if any. */
function packBase(word: string, lang: Language, dictionary: Dictionary): string | null {
  for (const ending of ENDINGS[lang]) {
    if (!word.endsWith(ending) || word.length - ending.length < 3) continue;
    const stem = word.slice(0, -ending.length);
    if (dictionary.has(stem)) return stem;
    // "starring" → "starr" → "star"; "making" → "mak" → "make".
    if (stem.at(-1) === stem.at(-2) && dictionary.has(stem.slice(0, -1))) return stem.slice(0, -1);
    if (dictionary.has(`${stem}e`)) return `${stem}e`;
  }
  return null;
}

/**
 * The words that say most about an article, best first:
 * - new words (not in the word pack) and names, such as "skywalker" or
 *   "tatooine", when they're used often enough and spelled with the words
 *   language's own letters, so they can be typed;
 * - then pack words that are frequent in the article for how rare they are.
 * Words are kept in lower case (the game adds capitals when Shift keys are
 * picked). Blocked words never get in. A plural folds into its singular when both appear.
 */
export function wordsFromArticle(text: string, topic: string, dictionary: Dictionary, blocklist: Blocklist, lang: Language = 'en'): string[] {
  const { maxWords, tierWeights, minCount, rareTier, nameShare, nameWeight, newWeight, newMinCount } = GAME_CONFIG.vocab;
  const skip = SKIP_WORDS[lang];
  const letters = new Set([...'abcdefghijklmnopqrstuvwxyz', ...accentedLetters(lang).map((c) => c.toLowerCase())]);
  const typeable = (word: string) => [...word].every((c) => letters.has(c));

  const counts = new Map<string, number>();
  const capitalised = new Map<string, number>();
  // Letters only (accented ones too); a word followed by a hyphen is a prefix ("non-", "mid-") and skipped.
  text = text.normalize('NFC');
  for (const match of text.matchAll(/\p{L}+(?![\p{L}-])/gu)) {
    const word = match[0].toLowerCase();
    const length = [...word].length;
    if (length < 3 || length > 14 || skip.has(word)) continue;
    if (!dictionary.has(word) && !typeable(word)) continue;
    // ALL CAPS ("NASA", "BBC") is an abbreviation, not a word to type.
    if (match[0] === match[0].toUpperCase()) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
    // Capitals that start a sentence or a line say nothing about names.
    const before = text.slice(0, match.index).trimEnd().at(-1);
    const sentenceStart = before === undefined || '.!?:\n'.includes(before);
    if (match[0][0] !== word[0] && !sentenceStart) capitalised.set(word, (capitalised.get(word) ?? 0) + 1);
  }
  for (const [word, count] of counts) {
    const singular = word.endsWith('s') ? word.slice(0, -1) : '';
    if (singular && counts.has(singular)) {
      counts.set(singular, (counts.get(singular) ?? 0) + count);
      capitalised.set(singular, (capitalised.get(singular) ?? 0) + (capitalised.get(word) ?? 0));
      counts.delete(word);
    }
  }

  const topicWords = new Set(topic.split(/[ '-]/).flatMap((w) => [w, w.replace(/s$/, '')]));
  const scored: { word: string; score: number }[] = [];
  for (const [word, count] of counts) {
    if (blocklist.blocksWord(word)) continue;
    if (topicWords.has(word)) {
      scored.push({ word, score: Infinity });
      continue;
    }
    // Mostly capitalised means a name ("Skywalker", "Empire"), even if it's also a word.
    const isName = (capitalised.get(word) ?? 0) >= count * nameShare;
    const base = dictionary.has(word) ? word : packBase(word, lang, dictionary);
    if (isName || base === null) {
      if (count >= newMinCount) scored.push({ word, score: (isName ? nameWeight : newWeight) * Math.log2(1 + count) });
      continue;
    }
    const tier = dictionary.get(base) ?? 0;
    const weight = tierWeights[Math.min(tier, tierWeights.length - 1)] ?? 0;
    if (weight === 0 || (count < minCount && tier < rareTier)) continue;
    scored.push({ word, score: weight * Math.log2(1 + count) });
  }
  scored.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  return scored.slice(0, maxWords).map((s) => s.word);
}

/** Download a topic's article and pick its words. Throws VocabError on failure. */
export async function fetchTopicWords(
  topic: string,
  dictionary: Dictionary,
  blocklist: Blocklist,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  /** The words language: which Wikipedia to ask. */
  lang: Language = 'en',
): Promise<{ topic: string; words: string[] }> {
  const clean = cleanTopic(topic);
  if (!clean) throw new VocabError('Invalid topic', 'invalid-topic');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new VocabError('Offline', 'offline');

  let response: Response;
  try {
    response = await fetchImpl(topicUrl(clean, lang), {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      headers: { 'Api-User-Agent': API_USER_AGENT },
    });
  } catch {
    throw new VocabError('Network error', 'offline');
  }
  if (!response.ok) throw new VocabError(`HTTP ${response.status}`, 'failed');

  const text = articleText(await response.json().catch(() => null));
  const words = text ? wordsFromArticle(text, clean, dictionary, blocklist, lang) : [];
  if (words.length < GAME_CONFIG.vocab.minWords) throw new VocabError('No usable words', 'empty');
  return { topic: clean, words };
}
