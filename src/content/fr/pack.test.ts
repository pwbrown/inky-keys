import { describe, expect, it } from 'vitest';
import { MIN_WORD_POOL, createContentSource } from '../contentSource';
import { layoutById } from '../layouts';
import { loadPack } from '../packs';
import wordsJson from './words.json';
import { HOLIDAY_WORDS } from './holidays';

describe('bundled French pack', async () => {
  const pack = await loadPack('fr');
  const family = pack.words;
  const words = new Set(family.map((e) => e.word));

  it('has 50k+ words', () => {
    expect(family.length).toBeGreaterThan(50_000);
  });

  it('contains only lowercase French letters, 2–12 of them, in NFC', () => {
    const bad = family.filter((e) => !/^[a-zàâçéèêëîïôùûü]{2,12}$/u.test(e.word) || e.word !== e.word.normalize('NFC'));
    expect(bad.map((e) => e.word)).toEqual([]);
  });

  it('leaves out œ, æ and ÿ, and Lexique’s "oe" spellings of œ words', () => {
    for (const word of ['soeur', 'coeur', 'oeuf', 'oeil', 'boeuf', 'noeud']) expect(words.has(word), word).toBe(false);
    for (const word of ['poème', 'noël', 'moelle', 'coefficient']) expect(words.has(word), word).toBe(true);
  });

  it('keeps accented letters', () => {
    for (const word of ['école', 'été', 'fenêtre', 'garçon', 'où', 'là', 'île', 'maïs', 'goût']) expect(words.has(word), word).toBe(true);
  });

  it('contains nothing the blocklist would block', () => {
    expect(family.filter((e) => pack.blocklist.blocksWord(e.word)).map((e) => e.word)).toEqual([]);
  });

  it('never has swearing, slurs or grown-up words, keeping harmless look-alikes', () => {
    for (const word of ['merde', 'putain', 'connard', 'salope', 'sexe', 'drogue', 'alcool', 'meurtre', 'nique', 'cigarette']) {
      expect(words.has(word), word).toBe(false);
    }
    for (const word of ['professeur', 'répéter', 'électrique', 'livres', 'salopette', 'pissenlit', 'rhume', 'violent', 'connecter']) {
      expect(words.has(word), word).toBe(true);
    }
  });

  it('has no duplicate words', () => {
    expect(words.size).toBe(family.length);
  });

  it('records its source and its share-alike license', () => {
    expect(wordsJson.source).toMatch(/Lexique 3\.83/);
    expect(wordsJson.license).toMatch(/CC-BY-SA-4\.0/);
  });

  it('has enough words for the first AZERTY chapters with vowels to skip the random-string fallback', () => {
    const azerty = layoutById('fr-azerty');
    const homeRow = azerty.lessons.slice(0, 14).flat();
    const content = createContentSource({ keys: [...homeRow, ' '], words: family, blocklist: pack.blocklist });
    expect(content.wordCount).toBeGreaterThanOrEqual(MIN_WORD_POOL);
  });
});

describe('French holiday words', async () => {
  const pack = await loadPack('fr');
  const words = new Set(pack.words.map((e) => e.word));
  it('are all in the family-friendly pack, with no repeats, and only for December', () => {
    expect(Object.keys(HOLIDAY_WORDS)).toEqual(['christmas']);
    for (const list of Object.values(HOLIDAY_WORDS)) {
      expect(list.filter((w) => !words.has(w))).toEqual([]);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
