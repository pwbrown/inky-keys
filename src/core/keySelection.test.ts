import { describe, expect, it } from 'vitest';
import { COLEMAK, DVORAK, ES_ISO, FR_AZERTY, LAYOUTS, US_QWERTY, forPlatform } from '../content/layouts';
import { DEFAULT_KEYS } from './config';
import {
  LETTERS_ACCENTS,
  REGIONS,
  apprenticePreset,
  builtInPresets,
  homeRowLesson,
  layoutChars,
  matchingPreset,
  orderedSelection,
  regionChars,
  regionsFor,
  regionState,
  remapSelection,
  strippedAccents,
  toggleRegion,
} from './keySelection';

const layout = US_QWERTY;
const region = (id: Parameters<typeof regionChars>[1]) => regionChars(layout, id);

describe('ANSI layouts', () => {
  for (const each of LAYOUTS.filter((l) => l.physical === 'ansi')) {
    it(`${each.id} produces all 95 printable ASCII characters exactly once`, () => {
      const chars = [...layoutChars(each)];
      expect(chars).toHaveLength(95);
      for (let code = 32; code <= 126; code++) expect(chars).toContain(String.fromCharCode(code));
    });
  }
});

describe('ISO layouts', () => {
  it('keep AZERTY digits out of the capitals, and its accent keys out of the letters', () => {
    expect(regionChars(FR_AZERTY, 'uppercase')).toHaveLength(26);
    expect(regionChars(FR_AZERTY, 'lowercase').join('')).toBe('azertyuiopqsdfghjklmwxcvbn');
    expect(regionChars(FR_AZERTY, 'digits').join('')).toBe('1234567890');
    expect(regionChars(FR_AZERTY, 'accents').join('')).toBe('éèçà^ù¨');
    expect(regionChars(FR_AZERTY, 'symbols')).toEqual(expect.arrayContaining(['²', 'µ', '<', '>', '§']));
  });

  it('put Spanish accent keys in Accents and º ª in Symbols', () => {
    expect(regionChars(ES_ISO, 'accents').join('')).toBe('`´^¨');
    expect(regionChars(ES_ISO, 'symbols')).toEqual(expect.arrayContaining(['º', 'ª']));
  });

  for (const [name, each] of [...LAYOUTS.map((l) => [l.id, l] as const), ['fr-azerty (Mac)', forPlatform(FR_AZERTY, 'mac')] as const]) {
    it(`${name} puts every key in one group, and Everything has them all`, () => {
      const all = regionsFor(each).flatMap((id) => regionChars(each, id));
      expect(new Set(all).size).toBe(all.length);
      expect(new Set(all)).toEqual(layoutChars(each));
      const everything = builtInPresets(each).find((p) => p.id === 'everything')!.chars;
      expect(new Set(everything)).toEqual(layoutChars(each));
    });
  }

  it('count ñ and ç as Spanish letters, and leave dead keys out', () => {
    expect(regionChars(ES_ISO, 'lowercase')).toEqual(expect.arrayContaining(['ñ', 'ç']));
    expect(regionChars(ES_ISO, 'uppercase')).toEqual(expect.arrayContaining(['Ñ', 'Ç']));
    expect(regionChars(ES_ISO, 'symbols')).toEqual(expect.arrayContaining(['¡', '¿', '<', '>']));
  });

  it('build number-row symbol presets from the layout', () => {
    const numberSymbols = (l: typeof US_QWERTY) => builtInPresets(l).find((p) => p.id === 'numberSymbols')!.chars;
    expect(numberSymbols(US_QWERTY).join('')).toBe('!@#$%^&*() ');
    expect(numberSymbols(FR_AZERTY).join('')).toBe('&"\'(-_ ');
    expect(numberSymbols(ES_ISO).join('')).toBe('!"·$%&/()= ');
  });
});

describe('regions', () => {
  it('splits characters by type', () => {
    expect(region('lowercase')).toHaveLength(26);
    expect(region('uppercase')).toHaveLength(26);
    expect(region('digits').join('')).toBe('1234567890');
    expect(region('symbols').join('')).toBe("`-=[]\\;',./~!@#$%^&*()_+{}|:\"<>?");
    expect(region('space')).toEqual([' ']);
  });

  it('cover every character the layout can type, once', () => {
    const all = REGIONS.flatMap((id) => region(id));
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(layoutChars(layout).size);
  });

  it('never returns an empty region, and US QWERTY has no accents group', () => {
    expect(regionsFor(layout)).toEqual(REGIONS.filter((id) => id !== 'accents'));
    for (const id of regionsFor(layout)) expect(region(id).length).toBeGreaterThan(0);
  });
});

describe('toggleRegion and regionState', () => {
  const digits = region('digits');

  it('adds the whole region when some or none of it is selected', () => {
    const some = new Set(['1', 'a']);
    expect(regionState(some, digits)).toBe('some');
    const next = toggleRegion(some, digits);
    expect(regionState(next, digits)).toBe('all');
    expect(next.has('a')).toBe(true);
  });

  it('removes the whole region when all of it is selected', () => {
    const next = toggleRegion(new Set([...digits, 'a']), digits);
    expect(regionState(next, digits)).toBe('none');
    expect([...next]).toEqual(['a']);
  });
});

describe('presets', () => {
  const presets = builtInPresets(layout);

  it('have unique ids and only characters the layout can type', () => {
    const all = layoutChars(layout);
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
    for (const preset of presets) {
      expect(preset.chars.length).toBeGreaterThan(0);
      for (const ch of preset.chars) expect(all.has(ch)).toBe(true);
    }
  });

  it('start new players on the All letters preset (M29)', () => {
    expect(matchingPreset(presets, DEFAULT_KEYS)?.id).toBe('lettersCapitals');
  });

  it('all include space', () => {
    for (const each of LAYOUTS) for (const p of builtInPresets(each)) expect(p.chars, `${each.id} ${p.id}`).toContain(' ');
  });

  it('match only exact selections', () => {
    expect(matchingPreset(presets, [...region('lowercase'), ' ', '1'])).toBeUndefined();
    expect(matchingPreset(presets, [' ', ...region('digits')].reverse())?.id).toBe('numbers');
  });

  it('follow the layout: its home row', () => {
    expect(homeRowLesson(US_QWERTY).join('')).toBe('asdfghjkl;');
    expect(homeRowLesson(DVORAK).join('')).toBe('aoeuidhtns');
    expect(homeRowLesson(COLEMAK).join('')).toBe('arstdhneio');
    const home = (l: typeof layout) => builtInPresets(l).find((p) => p.id === 'homeRow')!;
    expect(home(DVORAK).chars).toEqual([...'aoeuidhtns ']);
  });

  it('have no two built-ins with the same keys on any layout', () => {
    for (const each of LAYOUTS) {
      const sets = builtInPresets(each).map((p) => [...p.chars].sort().join(''));
      expect(new Set(sets).size, each.id).toBe(sets.length);
    }
  });
});

describe('remapSelection', () => {
  it('carries a preset over to the same preset on the new layout', () => {
    expect(remapSelection(US_QWERTY, DVORAK, [...homeRowLesson(US_QWERTY), ' '], 1).sort()).toEqual([...'aoeuidhtns '].sort());
    expect(remapSelection(US_QWERTY, DVORAK, DEFAULT_KEYS, 1).sort()).toEqual([...DEFAULT_KEYS].sort());
    const qwertyApprentice = apprenticePreset(US_QWERTY, 3, '').chars;
    expect(qwertyApprentice).toEqual([...'fjdk']);
    expect(remapSelection(US_QWERTY, COLEMAK, qwertyApprentice, 3).sort()).toEqual([...'tnse'].sort());
    const allLetters = [...region('lowercase'), ' '];
    expect(remapSelection(US_QWERTY, DVORAK, allLetters, 1).sort()).toEqual([...allLetters].sort());
  });

  it('keeps a custom selection as it is', () => {
    expect(remapSelection(US_QWERTY, DVORAK, ['q', 'z', '7'], 1)).toEqual(['q', 'z', '7']);
  });
});

describe('orderedSelection', () => {
  it('orders by keyboard position, plain characters before shifted ones', () => {
    expect(orderedSelection(layout, ['A', 'l', '!', 'a', '1'])).toEqual(['1', 'a', 'l', '!', 'A']);
  });

  it('keeps characters the layout does not have, at the end', () => {
    expect(orderedSelection(layout, ['é', 'a'])).toEqual(['a', 'é']);
  });
});

describe('accents of the words language', () => {
  const fr = ['é', 'è', 'à', 'ù', 'ç', 'â', 'ê', 'î', 'ô', 'û', 'ë', 'ï', 'ü'];

  it('join the Accents group, even without a key of their own', () => {
    expect(regionsFor(US_QWERTY)).not.toContain('accents');
    expect(regionChars(US_QWERTY, 'accents', fr)).toEqual(fr);
    expect(regionChars(FR_AZERTY, 'accents', fr)).toEqual(expect.arrayContaining(fr));
  });

  it('the strip holds the ones with no key of their own', () => {
    expect(strippedAccents(US_QWERTY, fr)).toEqual(fr);
    expect(strippedAccents(FR_AZERTY, fr)).toEqual(['â', 'ê', 'î', 'ô', 'û', 'ë', 'ï', 'ü']);
  });

  it('adds a "Letters + accents" preset only when there are accents', () => {
    expect(builtInPresets(US_QWERTY).some((p) => p.id === LETTERS_ACCENTS)).toBe(false);
    const preset = builtInPresets(US_QWERTY, fr).find((p) => p.id === LETTERS_ACCENTS);
    expect(preset?.chars).toEqual(expect.arrayContaining(['a', 'z', ' ', 'é', 'ü']));
    expect(preset?.chars).not.toContain('A');
  });
});
