/**
 * Text measured in characters (code points), not UTF-16 units. Target text
 * is NFC-normalized, so every French and Spanish letter is one character;
 * these helpers keep that true for anything outside the Basic Multilingual Plane too.
 */

/** The character at code-point index `i`, or undefined past the end. */
export function charAt(text: string, i: number): string | undefined {
  // Fast path: plain BMP text indexes the same either way.
  if (!/[\uD800-\uDFFF]/.test(text)) return text[i];
  return [...text][i];
}

/** How many characters (code points) are in `text`. */
export function charCount(text: string): number {
  return /[\uD800-\uDFFF]/.test(text) ? [...text].length : text.length;
}

/** The first `n` characters of `text`, and the rest. */
export function splitAt(text: string, n: number): [string, string] {
  const chars = [...text];
  return [chars.slice(0, n).join(''), chars.slice(n).join('')];
}
