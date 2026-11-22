import { describe, expect, it } from 'vitest';
import { cleanChallengeName, decodeChallenge, encodeChallenge, type Challenge } from './challenge';

const isLayout = (id: string) => ['us-qwerty', 'dvorak', 'colemak'].includes(id);
const sample: Challenge = { daily: 12, layout: 'us-qwerty', score: 4820, grades: ['A+', 'B', 'C'], name: 'Pip', words: 'en' };

/** Base64url of some JSON, as a link would carry it. */
const raw = (json: unknown) =>
  `c=${btoa(JSON.stringify(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

describe('challenge links', () => {
  it('round-trip, with or without a name', () => {
    expect(decodeChallenge(`#${encodeChallenge(sample)}`, isLayout)).toEqual(sample);
    expect(decodeChallenge(encodeChallenge({ ...sample, name: null }), isLayout)).toEqual({ ...sample, name: null });
    expect(decodeChallenge(encodeChallenge({ ...sample, grades: [] }), isLayout)).toEqual({ ...sample, grades: [] });
  });

  it('keep names in any language', () => {
    const named = { ...sample, name: 'Zoë 日本' };
    expect(decodeChallenge(encodeChallenge(named), isLayout)?.name).toBe('Zoë 日本');
  });

  it('only use URL-safe characters', () => {
    expect(encodeChallenge(sample)).toMatch(/^c=[A-Za-z0-9_-]+$/);
  });

  it('ignore anything that isn’t a valid challenge', () => {
    for (const hash of ['', '#', '#c=', '#c=!!!', '#x=abc', '#c=bm90IGpzb24']) expect(decodeChallenge(hash, isLayout)).toBeNull();
    const ok = { v: 1, d: 3, l: 'us-qwerty', s: 100, g: 'A' };
    expect(decodeChallenge(raw(ok), isLayout)).not.toBeNull();
    for (const bad of [
      { ...ok, v: 2 },
      { ...ok, d: 0 },
      { ...ok, d: 1.5 },
      { ...ok, s: -1 },
      { ...ok, s: '100' },
      { ...ok, l: 'azerty' },
      { ...ok, g: 'A,Z' },
      null,
    ]) {
      expect(decodeChallenge(raw(bad), isLayout)).toBeNull();
    }
  });

  it('strip names down to letters, numbers and spaces', () => {
    expect(cleanChallengeName('  <b>Pip</b>  the   great!! ')).toBe('bPipb the great');
    expect(cleanChallengeName('https://example.com')).toBe('httpsexamplecom');
    expect(cleanChallengeName('!!!')).toBeNull();
    expect(cleanChallengeName(42)).toBeNull();
    expect([...cleanChallengeName('x'.repeat(50))!].length).toBe(20);
  });

  it('carries a words language other than English, and older links mean English', () => {
    const fr: Challenge = { ...sample, words: 'fr' };
    expect(decodeChallenge(encodeChallenge(fr), isLayout)).toEqual(fr);
    const es: Challenge = { ...sample, words: 'es' };
    expect(decodeChallenge(encodeChallenge(es), isLayout)).toEqual(es);
    // English links are exactly as before: no `w`.
    expect(JSON.parse(atob(encodeChallenge(sample).slice(2).replace(/-/g, '+').replace(/_/g, '/')))).not.toHaveProperty('w');
    expect(decodeChallenge(raw({ v: 1, d: 12, l: 'us-qwerty', s: 10, g: '' }), isLayout)?.words).toBe('en');
    expect(decodeChallenge(raw({ v: 1, d: 12, l: 'us-qwerty', s: 10, g: '', w: 'xx' }), isLayout)).toBeNull();
  });
});
