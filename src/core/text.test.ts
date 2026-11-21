import { describe, expect, it } from 'vitest';
import { charAt, charCount, splitAt } from './text';

describe('text by code point', () => {
  it('indexes accented letters as one character', () => {
    expect(charAt('été', 1)).toBe('t');
    expect(charCount('fenêtre')).toBe(7);
  });
  it('indexes astral characters as one character', () => {
    expect(charAt('a😀b', 2)).toBe('b');
    expect(charCount('a😀b')).toBe(3);
    expect(splitAt('a😀b', 2)).toEqual(['a😀', 'b']);
  });
});
