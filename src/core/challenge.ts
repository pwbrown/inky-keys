/**
 * Challenge links: a Daily Page result packed into the part of a URL after
 * `#`, which browsers never send to the server. Opening one lets a friend
 * play the same seeded notebook and try to beat the score. Nothing is
 * checked against a server, so a challenge is a friendly dare, not a record.
 *
 * Links come from anywhere, so decoding checks every field.
 */
import { base64UrlToText, textToBase64Url } from './base64url';
import type { Grade } from './grade';
import { isLanguage, type Language } from './languages';

export interface Challenge {
  /** The Daily Page number. */
  daily: number;
  /** The keyboard layout it was played on (its words depend on it). */
  layout: string;
  score: number;
  /** Grade of each page cleared. */
  grades: Grade[];
  /** Who sent it, if they chose to sign it. */
  name: string | null;
  /** The words language it was played in. Links without one (older ones) mean English. */
  words: Language;
}

/** The fragment key: `#c=…`. */
export const CHALLENGE_PARAM = 'c';
const VERSION = 1;
const GRADES: readonly Grade[] = ['A+', 'A', 'B', 'C', 'D', 'F'];
const MAX_SCORE = 10_000_000;
/** The longest name shown, as for player names (storage/profiles.ts). */
const MAX_NAME_LENGTH = 20;

/** A name fit to show: letters, numbers and single spaces, trimmed to the usual length. */
export function cleanChallengeName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const cleaned = [...name.replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, MAX_NAME_LENGTH).join('');
  return cleaned === '' ? null : cleaned;
}

/** The fragment for a challenge, e.g. "c=eyJ2Ijox…" (no leading #). */
export function encodeChallenge(c: Challenge): string {
  // English links stay exactly as they were; other words languages add `w`.
  const payload = {
    v: VERSION,
    d: c.daily,
    l: c.layout,
    s: c.score,
    g: c.grades.join(','),
    ...(c.name ? { n: c.name } : {}),
    ...(c.words !== 'en' ? { w: c.words } : {}),
  };
  return `${CHALLENGE_PARAM}=${textToBase64Url(JSON.stringify(payload))}`;
}

/** Read a challenge from a URL fragment (with or without the #), or null if there isn't a valid one. */
export function decodeChallenge(hash: string, isLayout: (id: string) => boolean): Challenge | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const code = params.get(CHALLENGE_PARAM);
  if (!code || code.length > 600 || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  let data: unknown;
  try {
    data = JSON.parse(base64UrlToText(code));
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const v = data as Record<string, unknown>;
  if (v.v !== VERSION) return null;
  const whole = (x: unknown, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= max;
  if (!whole(v.d, 100_000) || v.d < 1 || !whole(v.s, MAX_SCORE)) return null;
  if (typeof v.l !== 'string' || !isLayout(v.l)) return null;
  const grades = typeof v.g === 'string' && v.g !== '' ? v.g.split(',') : [];
  if (grades.length > 10 || !grades.every((g) => GRADES.includes(g as Grade))) return null;
  if (v.w !== undefined && !isLanguage(v.w)) return null;
  return { daily: v.d, layout: v.l, score: v.s, grades: grades as Grade[], name: cleanChallengeName(v.n), words: isLanguage(v.w) ? v.w : 'en' };
}
