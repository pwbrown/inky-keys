import { describe, expect, it } from 'vitest';
import { buildWordPool, entriesFromTiers, pickWord, typeableWith, wordDifficulty } from './wordPool';

const entries = entriesFromTiers(['as ask flask', 'dad glass', 'flasks zebra']);

describe('word pool', () => {
  it('expands tiers into entries', () => {
    expect(entries).toHaveLength(7);
    expect(entries[0]).toEqual({ word: 'as', tier: 0 });
    expect(entries.at(-1)).toEqual({ word: 'zebra', tier: 2 });
  });

  it('checks words against a key set', () => {
    expect(typeableWith('flask', new Set('flask'))).toBe(true);
    expect(typeableWith('flask', new Set('flas'))).toBe(false);
  });

  it('keeps only typeable words, easiest first', () => {
    const pool = buildWordPool(entries, 'asdfghjkl');
    expect(pool.map((w) => w.word)).toEqual(['as', 'ask', 'dad', 'flask', 'glass', 'flasks']);
    expect(pool.every((w, i) => i === 0 || w.difficulty >= pool[i - 1]!.difficulty)).toBe(true);
  });

  it('returns null for an empty pool', () => {
    expect(pickWord([], 0.5, () => 0)).toBeNull();
  });

  it('picks easy words at low difficulty and hard ones at high difficulty', () => {
    const many = entriesFromTiers([
      Array.from({ length: 100 }, (_, i) => 'a'.repeat(2 + (i % 9)) + String.fromCharCode(97 + (i % 26))).join(' '),
    ]);
    const pool = buildWordPool(many, 'abcdefghijklmnopqrstuvwxyz');
    const easy = pickWord(pool, 0, () => 0.5)!;
    const hard = pickWord(pool, 1, () => 0.5)!;
    expect(easy.length).toBeLessThan(hard.length);
  });
});

describe('word difficulty in key presses', () => {
  it('ranks a word with a two-press accent as harder than the same length without', () => {
    const cost = (ch: string) => (ch === 'ê' ? 1 : 0);
    expect(wordDifficulty({ word: 'fête', tier: 0 }, 0, cost)).toBeGreaterThan(wordDifficulty({ word: 'fete', tier: 0 }, 0, cost));
    expect(wordDifficulty({ word: 'été', tier: 0 }, 0)).toBe(wordDifficulty({ word: 'ete', tier: 0 }, 0));
  });
});
