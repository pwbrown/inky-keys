/**
 * Explicit-content guard (REQUIREMENTS §6). Every string that can appear on
 * screen passes through here: bundled words, generated strings, and later
 * imported or fetched words.
 *
 * Self-contained (no imports) so the Node build script can use it too.
 */

/** Look-alike substitutions, so "@$$" and "5h1t" get caught. */
const LEET: Record<string, string> = {
  '4': 'a', '@': 'a', '^': 'a',
  '8': 'b',
  '(': 'c', '<': 'c',
  '3': 'e', '€': 'e',
  '6': 'g', '9': 'g',
  '#': 'h',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o',
  '5': 's', '$': 's',
  '7': 't', '+': 't',
  '2': 'z',
};

/**
 * Lowercase, undo look-alike substitutions, and drop everything that isn't a
 * letter, so separators like "f.u.c.k" and "f_u_c_k" collapse too.
 */
export function normalizeForCheck(text: string): string {
  let out = '';
  // Accents are folded away (é → e) so accented spellings can't slip past.
  const folded = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  for (const ch of folded) {
    const mapped = LEET[ch] ?? ch;
    if (/\p{L}/u.test(mapped)) out += mapped;
  }
  return out;
}

/** Endings that turn a blocked term into another form of the same word, per language (accents folded). */
export const INFLECTIONS: Record<string, readonly string[]> = {
  en: ['', 's', 'es', 'ed', 'd', 'er', 'ers', 'ing', 'y', 'ty', 'ier', 'iest', 'ies', 'ish', 'head', 'heads', 'hole', 'holes'],
  fr: ['', 's', 'x', 'e', 'es', 'ee', 'ees', 'er', 'eur', 'eurs', 'euse', 'euses', 'ant', 'ent', 'ez', 'ons', 'ais', 'ait', 'aient', 'ie', 'ies'],
  es: ['', 's', 'es', 'a', 'as', 'o', 'os', 'ar', 'ado', 'ada', 'ados', 'adas', 'ando', 'ito', 'ita', 'itos', 'itas', 'on', 'ona', 'ones', 'ero', 'era', 'eros', 'eras'],
};

/** Long terms are distinctive enough to block anywhere inside a real word. */
const CONTAINS_MIN_LENGTH = 5;

export class Blocklist {
  private readonly terms: string[];
  private readonly forms: Set<string>;
  private readonly allowed: Set<string>;

  /**
   * @param terms Blocked words, in any case. Terms shorter than 3 letters
   *   (after normalizing) are dropped: they would reject too many strings.
   * @param allow Real words wrongly caught by the rules ("Scunthorpe problem").
   * @param endings Inflections for the language (INFLECTIONS); English by default.
   */
  constructor(terms: Iterable<string>, allow: Iterable<string> = [], endings: readonly string[] = INFLECTIONS.en!) {
    const clean = new Set<string>();
    for (const term of terms) {
      if (/\d/.test(term)) continue;
      const normalized = normalizeForCheck(term);
      if (normalized.length >= 3) clean.add(normalized);
    }
    this.terms = [...clean].sort();
    this.forms = new Set(this.terms.flatMap((t) => endings.map((suffix) => t + suffix)));
    this.allowed = new Set([...allow].map((w) => w.toLowerCase()));
  }

  get size(): number {
    return this.terms.length;
  }

  /**
   * Check a real dictionary word. Blocks exact matches and their inflections,
   * plus long terms anywhere inside the word. Short terms are *not* matched
   * inside longer words, so "class", "assess" and "title" survive.
   */
  blocksWord(word: string): boolean {
    const lower = word.toLowerCase();
    if (this.allowed.has(lower)) return false;
    const normalized = normalizeForCheck(word);
    if (this.forms.has(normalized)) return true;
    return this.terms.some((t) => t.length >= CONTAINS_MIN_LENGTH && normalized.includes(t));
  }

  /**
   * Check a made-up string (random fallback strings). Much stricter: any
   * blocked term anywhere, after normalizing, rejects it. A rejected random
   * string costs nothing; we just make another one.
   */
  blocksString(text: string): boolean {
    const normalized = normalizeForCheck(text);
    if (normalized.length < 3) return false;
    return this.terms.some((t) => normalized.includes(t));
  }
}
