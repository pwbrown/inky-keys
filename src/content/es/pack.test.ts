import { describe, expect, it } from 'vitest';
import { MIN_WORD_POOL, createContentSource } from '../contentSource';
import { layoutById } from '../layouts';
import { loadPack } from '../packs';
import wordsJson from './words.json';
import { HOLIDAY_WORDS } from './holidays';

describe('bundled Spanish pack', async () => {
  const pack = await loadPack('es');
  const family = pack.words;
  const words = new Set(family.map((e) => e.word));

  it('has 40k+ words', () => {
    expect(family.length).toBeGreaterThan(40_000);
  });

  it('contains only lowercase Spanish letters, 2–12 of them, in NFC', () => {
    const bad = family.filter((e) => !/^[a-záéíóúüñ]{2,12}$/u.test(e.word) || e.word !== e.word.normalize('NFC'));
    expect(bad.map((e) => e.word)).toEqual([]);
  });

  it('keeps accented letters, ñ and ü', () => {
    for (const word of ['niño', 'año', 'mañana', 'canción', 'está', 'qué', 'café', 'pingüino', 'música', 'árbol']) {
      expect(words.has(word), word).toBe(true);
    }
  });

  it('leaves out names and English words from the subtitles', () => {
    for (const word of ['john', 'maría', 'madrid', 'carlos', 'okay', 'the', 'you']) expect(words.has(word), word).toBe(false);
  });

  it('contains nothing the blocklist would block', () => {
    expect(family.filter((e) => pack.blocklist.blocksWord(e.word)).map((e) => e.word)).toEqual([]);
  });

  it('never has swearing, slurs or grown-up words, keeping harmless look-alikes', () => {
    for (const word of ['mierda', 'puta', 'joder', 'coño', 'sexo', 'droga', 'cerveza', 'asesino', 'cigarro', 'idiota']) {
      expect(words.has(word), word).toBe(false);
    }
    for (const word of ['artículos', 'músculos', 'piso', 'diamante', 'mensaje', 'disputas', 'diseños', 'cacao', 'año', 'cono']) {
      expect(words.has(word), word).toBe(true);
    }
  });

  it('has no duplicate words', () => {
    expect(words.size).toBe(family.length);
  });

  it('records its source and its share-alike license', () => {
    expect(wordsJson.source).toMatch(/FrequencyWords/);
    expect(wordsJson.license).toMatch(/CC-BY-SA-4\.0/);
  });

  it('has enough words for the first Spanish ISO chapters with vowels to skip the random-string fallback', () => {
    const es = layoutById('es-iso');
    const homeRow = es.lessons.slice(0, 14).flat();
    const content = createContentSource({ keys: [...homeRow, ' '], words: family, blocklist: pack.blocklist });
    expect(content.wordCount).toBeGreaterThanOrEqual(MIN_WORD_POOL);
  });
});

describe('Spanish holiday words', async () => {
  const pack = await loadPack('es');
  const words = new Set(pack.words.map((e) => e.word));
  it('are all in the family-friendly pack, with no repeats, and only for December', () => {
    expect(Object.keys(HOLIDAY_WORDS)).toEqual(['christmas']);
    for (const list of Object.values(HOLIDAY_WORDS)) {
      expect(list.filter((w) => !words.has(w))).toEqual([]);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
