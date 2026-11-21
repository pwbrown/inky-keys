/**
 * Where target payloads come from. Combines the word pool and the fallback
 * generator for the player's key set (REQUIREMENTS §6).
 */
import { Blocklist } from './blocklist';
import { generateString } from './generator';
import { GAME_CONFIG, type TargetKind } from '../core/config';
import { buildWordPool, pickWord, type PressCost, type RankedWord, type WordEntry } from './wordPool';
import { isAccented, plainLetter } from '../core/accents';

/**
 * Below this many typeable words, real words get repetitive, so generated
 * strings are mixed in. With none at all, only generated strings are used.
 */
export const MIN_WORD_POOL = 25;

/** Chance a word starts with a capital, when both cases of its first letter are selected. */
const CAPITALIZE_CHANCE = 0.3;
/** Chance a word gets trailing punctuation, when any is selected. */
const PUNCTUATION_CHANCE = 0.2;
/** Punctuation that reads naturally at the end of a word. */
const TRAILING_PUNCTUATION = [',', '.', ';', ':', '!', '?'];

/**
 * Which keys a drip page draws from: letters (either case) and space, or
 * digits and symbols. They get separate pages so the two never mix.
 */
export type CharPool = 'all' | 'letters' | 'symbols';

/** The pool a single key belongs to. */
export function poolOf(ch: string): Exclude<CharPool, 'all'> {
  return ch === ' ' || /^\p{L}$/u.test(ch) ? 'letters' : 'symbols';
}

export interface ContentSource {
  readonly keys: readonly string[];
  /** Number of real words typeable with the keys. */
  readonly wordCount: number;
  /** Number of downloaded topic words typeable with the keys. */
  readonly topicWordCount: number;
  /** A single character for a Drip (T2), from `pool` (all keys if the pool has none). */
  nextChar(random: () => number, pool?: CharPool): string;
  /** How many distinct keys fall in `pool`. */
  poolSize(pool: CharPool): number;
  /** A word, or a generated string, for a Scrawler (T1). */
  nextWord(difficulty: number, random: () => number): string;
  /** Several words separated by spaces, for a Run-on (T3). Needs the space key. */
  nextPhrase(difficulty: number, random: () => number): string;
  /** Whether these keys can make a target type (Run-ons need the space key). */
  supports(kind: TargetKind): boolean;
  /** Key presses `text` takes beyond one per character (accents: ^ then e). */
  extraPresses(text: string): number;
}

export interface ContentOptions {
  keys: readonly string[];
  /** Lowercase dictionary words. */
  words?: readonly WordEntry[];
  blocklist?: Blocklist;
  /**
   * Set for the bundled pack, which was already filtered at build time.
   * Leave unset for imported or fetched words so they get checked.
   */
  trustedWords?: boolean;
  /**
   * Relative chance of each key appearing as a drip (default 1). Used to
   * show weak keys more often.
   */
  keyWeights?: Readonly<Record<string, number>>;
  /**
   * Downloaded topic words (lowercase). When enough fit the keys, they're
   * favoured over the general word list. Always checked against the blocklist.
   */
  topicWords?: readonly string[];
  /**
   * Holiday words in season (content/en/holidays.ts), drawn `seasonShare` of
   * the time when enough fit the keys. Checked against the blocklist too.
   */
  seasonWords?: readonly string[];
  seasonShare?: number;
  /** Extra key presses each character takes on the player's keyboard (core/accents.ts), for word difficulty and pacing. */
  pressCost?: PressCost;
  /**
   * Forgiving accents: a word may use an accented letter when its plain
   * letter is selected (e for é), since e will count for é.
   */
  forgiving?: boolean;
  /** Above 1, words with an accent are picked more often (the "Letters + accents" preset). */
  accentBias?: number;
}

/** Share of words drawn from topic lists, when enough topic words fit the keys. */
const TOPIC_SHARE = 0.6;
const MIN_TOPIC_POOL = 5;

/**
 * Lowercase letters a word may use: a letter counts if either case of it is
 * selected (uppercase-only letters are typed as capitals).
 */
export function wordLetters(keys: Iterable<string>): Set<string> {
  const letters = new Set<string>();
  for (const key of keys) {
    if (/^\p{L}$/u.test(key)) letters.add(key.toLowerCase());
  }
  return letters;
}

/** How many dictionary words the keys can make. Cheap enough to run on every click. */
export function countTypeableWords(words: readonly WordEntry[], keys: Iterable<string>): number {
  const letters = wordLetters(keys);
  if (letters.size === 0) return 0;
  let count = 0;
  outer: for (const { word } of words) {
    for (const ch of word) if (!letters.has(ch)) continue outer;
    count++;
  }
  return count;
}

/**
 * Fit a lowercase word to the selected keys: letters only selected as
 * capitals become capitals, and sometimes the first letter is capitalized.
 */
export function styleWord(word: string, keys: ReadonlySet<string>, random: () => number): string {
  let out = '';
  // A letter only selected as a capital becomes one. An accented capital that
  // isn't a key (É on Windows AZERTY) never appears: the word keeps its é.
  for (const ch of word) out += keys.has(ch) || !keys.has(ch.toUpperCase()) ? ch : ch.toUpperCase();

  const first = [...out][0];
  if (first && keys.has(first.toLowerCase()) && keys.has(first.toUpperCase()) && random() < CAPITALIZE_CHANCE) {
    out = first.toUpperCase() + out.slice(first.length);
  }
  return out;
}

/** Letters a word may use with Forgiving accents: each selected letter also stands for its accented forms. */
function forgivingLetters(letters: Set<string>, words: readonly WordEntry[]): Set<string> {
  const out = new Set(letters);
  for (const { word } of words) for (const ch of word) if (!out.has(ch) && isAccented(ch) && letters.has(plainLetter(ch))) out.add(ch);
  return out;
}

export function createContentSource({
  keys,
  words = [],
  blocklist = new Blocklist([]),
  trustedWords = false,
  keyWeights = {},
  topicWords = [],
  seasonWords = [],
  seasonShare = 0,
  pressCost,
  forgiving = false,
  accentBias = 1,
}: ContentOptions): ContentSource {
  if (keys.length === 0) throw new Error('A content source needs at least one key');
  const unique = [...new Set(keys)];
  const keySet = new Set(unique);
  const punctuation = TRAILING_PUNCTUATION.filter((p) => keySet.has(p));
  const weights = unique.map((k) => Math.max(0, keyWeights[k] ?? 1));

  const topicEntries = [...new Set(topicWords)].map((word) => ({ word, tier: 0 }));
  const seasonEntries = [...new Set(seasonWords)].map((word) => ({ word, tier: 0 }));
  const plainLetters = wordLetters(unique);
  const letters = forgiving ? forgivingLetters(plainLetters, [...words, ...topicEntries, ...seasonEntries]) : plainLetters;

  let pool: RankedWord[] = buildWordPool(words, letters, pressCost);
  if (!trustedWords) pool = pool.filter((w) => !blocklist.blocksWord(w.word));
  // Words with an accent, for the "Letters + accents" preset.
  const accentPool = accentBias > 1 ? pool.filter((w) => [...w.word].some(isAccented)) : [];
  const accentShare = pool.length > 0 ? Math.min(0.6, (accentBias * accentPool.length) / pool.length) : 0;

  const topicPool = buildWordPool(topicEntries, letters, pressCost).filter((w) => !blocklist.blocksWord(w.word));
  const seasonPool = buildWordPool(seasonEntries, letters, pressCost).filter((w) => !blocklist.blocksWord(w.word));
  // Without enough season words, no random draw is spent on them, so seeded content stays the same.
  const useSeasonPool = seasonShare > 0 && seasonPool.length >= MIN_TOPIC_POOL;

  /**
   * A word fitted to the keys, without trailing punctuation. With
   * `capitalize` false, a capital only appears where the keys require one.
   */
  const baseWord = (difficulty: number, random: () => number, capitalize = true): string => {
    if (useSeasonPool && random() < seasonShare) {
      const word = pickWord(seasonPool, difficulty, random);
      if (word) return styleWord(word, keySet, capitalize ? random : () => 1);
    }
    const useTopic = topicPool.length >= MIN_TOPIC_POOL && random() < TOPIC_SHARE;
    const useWords = pool.length >= MIN_WORD_POOL || (pool.length > 0 && random() < 0.5);
    // Without an accent bias no random draw is spent here, so seeded content stays the same.
    const useAccent = !useTopic && useWords && accentPool.length >= MIN_TOPIC_POOL && random() < accentShare;
    const word = useTopic
      ? pickWord(topicPool, difficulty, random)
      : useAccent
        ? pickWord(accentPool, difficulty, random)
        : useWords
          ? pickWord(pool, difficulty, random)
          : null;
    if (!word) return generateString(unique, difficulty, random, blocklist);
    return styleWord(word, keySet, capitalize ? random : () => 1);
  };

  const withPunctuation = (text: string, chance: number, random: () => number) =>
    punctuation.length > 0 && random() < chance ? text + punctuation[Math.floor(random() * punctuation.length)] : text;

  return {
    keys: unique,
    wordCount: pool.length,
    topicWordCount: topicPool.length,
    supports(kind) {
      return kind !== 'runon' || keySet.has(' ');
    },
    extraPresses(text) {
      if (!pressCost) return 0;
      let n = 0;
      for (const ch of text) n += pressCost(ch);
      return n;
    },
    nextPhrase(difficulty, random) {
      const { min, max, longAt, maxWordLength } = GAME_CONFIG.phraseWords;
      const count = difficulty >= longAt ? max : min;
      // Short, easy words: the challenge is keeping a run going, not hard words.
      const shortWord = () => {
        let word = baseWord(difficulty * 0.4, random, false);
        for (let i = 0; i < 8 && [...word].length > maxWordLength; i++) word = baseWord(difficulty * 0.4, random, false);
        return word;
      };
      const phrase = Array.from({ length: count }, shortWord).join(' ');
      // Like a sentence: sometimes start with a capital, if both cases are selected.
      const first = phrase[0]!;
      const capitalized =
        keySet.has(first.toUpperCase()) && keySet.has(first) && random() < 0.5 ? first.toUpperCase() + phrase.slice(1) : phrase;
      return withPunctuation(capitalized, 0.6, random);
    },
    poolSize(pool) {
      return pool === 'all' ? unique.length : unique.filter((k) => poolOf(k) === pool).length;
    },
    nextChar(random, pool = 'all') {
      let indices = unique.map((_, i) => i);
      if (pool !== 'all') {
        const inPool = indices.filter((i) => poolOf(unique[i]!) === pool);
        if (inPool.length > 0) indices = inPool;
      }
      const total = indices.reduce((sum, i) => sum + weights[i]!, 0);
      if (total <= 0) return unique[indices[Math.floor(random() * indices.length)]!]!;
      let roll = random() * total;
      for (const i of indices) {
        roll -= weights[i]!;
        if (roll < 0) return unique[i]!;
      }
      return unique[indices[indices.length - 1]!]!;
    },
    nextWord(difficulty, random) {
      return withPunctuation(baseWord(difficulty, random), PUNCTUATION_CHANCE, random);
    },
  };
}
