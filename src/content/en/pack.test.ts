import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYS } from '../../core/config';
import { MIN_WORD_POOL, createContentSource } from '../contentSource';
import { loadPack } from '../packs';
import wordsJson from './words.json';
import { HOLIDAY_WORDS } from './holidays';

describe('bundled English pack', async () => {
  const pack = await loadPack('en');
  const family = pack.words;
  const words = new Set(family.map((e) => e.word));

  it('has 50k+ words (REQUIREMENTS §6)', () => {
    expect(family.length).toBeGreaterThan(50_000);
  });

  it('contains only lowercase a–z words of 2–12 letters', () => {
    expect(family.every((e) => /^[a-z]{2,12}$/.test(e.word))).toBe(true);
  });

  it('contains nothing the blocklist would block', () => {
    expect(family.filter((e) => pack.blocklist.blocksWord(e.word)).map((e) => e.word)).toEqual([]);
  });

  it('leaves out words that are not kid-friendly, keeping harmless look-alikes', () => {
    for (const word of ['jackass', 'sperms', 'pregnant', 'erection', 'seduce', 'drunk', 'murder', 'cigarette', 'stupid', 'gay', 'lesbian', 'poop', 'farting']) {
      expect(words.has(word), word).toBe(false);
    }
    for (const word of ['butter', 'grape', 'wombat', 'abreast', 'scrapped', 'psychology', 'condominium', 'squawk', 'lustrous', 'spotty', 'farther', 'speed', 'nosegay']) {
      expect(words.has(word), word).toBe(true);
    }
  });

  it('never has swearing or slurs', () => {
    for (const word of ['damn', 'bastard', 'midget', 'gypsy', 'sexy', 'penis']) expect(words.has(word), word).toBe(false);
  });

  it('has no duplicate words', () => {
    expect(words.size).toBe(family.length);
  });

  it('records its source and license', () => {
    expect(wordsJson.source).toMatch(/SCOWL/);
    expect(wordsJson.license).toMatch(/licenses\/SCOWL\.txt/);
  });

  it('has enough home-row words to skip the random-string fallback', () => {
    const content = createContentSource({ keys: DEFAULT_KEYS, words: family, blocklist: pack.blocklist });
    expect(content.wordCount).toBeGreaterThanOrEqual(MIN_WORD_POOL);
  });
});

describe('holiday words', async () => {
  const pack = await loadPack('en');
  const words = new Set(pack.words.map((e) => e.word));
  it('are all in the family-friendly pack, with no repeats', () => {
    for (const list of Object.values(HOLIDAY_WORDS)) {
      expect(list.filter((w) => !words.has(w))).toEqual([]);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
