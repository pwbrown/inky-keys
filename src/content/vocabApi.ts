/**
 * Optional topic vocabulary (REQUIREMENTS §6): downloads the Wikipedia article
 * for a topic and keeps the words that are unusually frequent in it. Only ever
 * runs when the player asks, and sends nothing but the topic: no cookies, no
 * referrer, no identifiers.
 */
import { GAME_CONFIG } from '../core/config';
import type { Blocklist } from './blocklist';
import type { Language } from '../core/languages';

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
 * The words that say most about an article: in the word pack, not blocked,
 * and frequent in the article for how rare they are in everyday English.
 * A plural folds into its singular when both appear. Best first.
 */
export function wordsFromArticle(text: string, topic: string, dictionary: Dictionary, blocklist: Blocklist): string[] {
  const { maxWords, tierWeights, minCount, rareTier } = GAME_CONFIG.vocab;
  const counts = new Map<string, number>();
  const capitalised = new Map<string, number>();
  // Letters only (accented ones too); a word followed by a hyphen is a prefix ("non-", "mid-") and skipped.
  text = text.normalize('NFC');
  for (const match of text.matchAll(/\p{L}+(?![\p{L}-])/gu)) {
    const word = match[0].toLowerCase();
    const length = [...word].length;
    if (length < 3 || length > 14 || !dictionary.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
    // Capitals that start a sentence or a line say nothing about names.
    const before = text.slice(0, match.index).trimEnd().at(-1);
    const sentenceStart = before === undefined || '.!?:\n'.includes(before);
    if (match[0][0] !== word[0] && !sentenceStart) capitalised.set(word, (capitalised.get(word) ?? 0) + 1);
  }
  // Mostly capitalised means a name ("John", "Oxford", "Japan"), even if it's also a word.
  for (const [word, count] of capitalised) {
    if (count >= (counts.get(word) ?? 0) * GAME_CONFIG.vocab.nameShare) counts.delete(word);
  }
  for (const [word, count] of counts) {
    const singular = word.endsWith('s') ? word.slice(0, -1) : '';
    if (singular && counts.has(singular)) {
      counts.set(singular, (counts.get(singular) ?? 0) + count);
      counts.delete(word);
    }
  }

  const topicWords = new Set(topic.split(/[ '-]/).flatMap((w) => [w, w.replace(/s$/, '')]));
  const scored: { word: string; score: number }[] = [];
  for (const [word, count] of counts) {
    const tier = dictionary.get(word) ?? 0;
    if (blocklist.blocksWord(word)) continue;
    if (topicWords.has(word)) {
      scored.push({ word, score: Infinity });
      continue;
    }
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
  const words = text ? wordsFromArticle(text, clean, dictionary, blocklist) : [];
  if (words.length < GAME_CONFIG.vocab.minWords) throw new VocabError('No usable words', 'empty');
  return { topic: clean, words };
}
