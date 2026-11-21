import { describe, expect, it } from 'vitest';
import { Blocklist, INFLECTIONS, normalizeForCheck } from './blocklist';

// Mild stand-in terms keep this file readable; the real list is in content/en.
const list = new Blocklist(['darn', 'heck', 'blast', 'xx', 'g-rr', '🖕'], ['blastoff']);

describe('normalizeForCheck', () => {
  it('lowercases, maps look-alikes and drops separators', () => {
    expect(normalizeForCheck('D4R.N')).toBe('darn');
    expect(normalizeForCheck('h3(k')).toBe('heck');
    expect(normalizeForCheck('b_l@$7')).toBe('blast');
  });
});

describe('Blocklist', () => {
  it('drops terms too short to check safely', () => {
    // 'xx' is too short and the emoji has no letters; 'g-rr' becomes 'grr'.
    expect(list.size).toBe(4);
  });

  it('blocks real words that are a term or an inflection of one', () => {
    for (const word of ['darn', 'darned', 'darning', 'darns', 'heck', 'hecks']) expect(list.blocksWord(word)).toBe(true);
  });

  it('blocks long terms anywhere inside a word', () => {
    expect(list.blocksWord('sandblaster')).toBe(true);
  });

  it('does not block short terms inside unrelated words', () => {
    expect(list.blocksWord('darnel')).toBe(false); // "darn" + "el" is not an inflection
    expect(list.blocksWord('checker')).toBe(false);
  });

  it('honours the allowlist', () => {
    expect(list.blocksWord('blastoff')).toBe(false);
    expect(list.blocksWord('BLASTOFF')).toBe(false);
  });

  it('blocks terms anywhere in made-up strings, including look-alikes', () => {
    expect(list.blocksString('qdarnq')).toBe(true);
    expect(list.blocksString('zh3ckz')).toBe(true);
    expect(list.blocksString('d.a.r.n')).toBe(true);
    expect(list.blocksString('dran')).toBe(false);
  });

  it('folds accents, so accented spellings of a term are caught', () => {
    expect(normalizeForCheck('Pùte')).toBe('pute');
    const fr = new Blocklist(['pute', 'merde'], [], INFLECTIONS.fr);
    expect(fr.blocksWord('pùte')).toBe(true);
    expect(fr.blocksWord('putes')).toBe(true);
    expect(fr.blocksWord('mèrde')).toBe(true);
    expect(fr.blocksString('zzmérdezz')).toBe(true);
  });

  it('uses the endings of the list’s language', () => {
    const fr = new Blocklist(['zut'], [], INFLECTIONS.fr);
    expect(fr.blocksWord('zutée')).toBe(true);
    expect(fr.blocksWord('zuting')).toBe(false);
  });
});
