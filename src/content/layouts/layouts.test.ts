import { describe, expect, it } from 'vitest';
import { APPRENTICE_CHAPTERS, SPACE_CHAPTER } from '../../core/campaign';
import { COLEMAK, DVORAK, ES_ISO, FR_AZERTY, LAYOUTS, LAYOUT_IDS, US_QWERTY, deadKeyMark, findKey, findKeyLevel, forPlatform, isLayoutId, layoutById, suggestedLayout } from './index';
import { KEY_LEVELS } from './types';
import type { LayoutKey } from './types';

const LETTERS = [...'abcdefghijklmnopqrstuvwxyz'];
const keysOf = (rows: LayoutKey[][]) => rows.flat();
const codesOf = (rows: LayoutKey[][]) => rows.map((row) => row.map((k) => k.code));

describe('layouts', () => {
  it('are listed by unique id and found by id, falling back to US QWERTY', () => {
    expect(LAYOUT_IDS).toEqual(['us-qwerty', 'dvorak', 'colemak', 'fr-azerty', 'es-iso']);
    expect(layoutById('dvorak')).toBe(DVORAK);
    expect(layoutById('nope')).toBe(US_QWERTY);
    expect(isLayoutId('colemak')).toBe(true);
    expect(isLayoutId('azerty')).toBe(false);
  });

  it('keep US QWERTY exactly as it was before layouts were built from data', () => {
    const plain = (k: LayoutKey) => [k.code, k.base, k.shift, k.hand, k.finger, k.width].join('|');
    // A few keys from the old hand-written table.
    expect(plain(findKey(US_QWERTY, 'f')!)).toBe('KeyF|f|F|left|index|');
    expect(plain(findKey(US_QWERTY, ';')!)).toBe('Semicolon|;|:|right|pinky|');
    expect(plain(findKey(US_QWERTY, '`')!)).toBe('Backquote|`|~|left|pinky|');
    expect(plain(findKey(US_QWERTY, '6')!)).toBe('Digit6|6|^|right|index|');
    expect(plain(findKey(US_QWERTY, ',')!)).toBe('Comma|,|<|right|middle|');
    expect(plain(findKey(US_QWERTY, ' ')!)).toBe('Space| ||both|thumb|6');
    expect(US_QWERTY.rows.map((row) => row.map((k) => k.base).join(''))).toEqual([
      '`1234567890-=',
      'qwertyuiop[]\\',
      "asdfghjkl;'",
      'zxcvbnm,./',
      ' ',
    ]);
  });

  for (const layout of LAYOUTS) {
    describe(layout.id, () => {
      const twin = layout.physical === 'iso' ? FR_AZERTY : US_QWERTY;
      it(`uses the same physical keys and fingering as ${twin.id}`, () => {
        expect(codesOf(layout.rows)).toEqual(codesOf(twin.rows));
        const fingering = (rows: LayoutKey[][]) => keysOf(rows).map((k) => `${k.hand}-${k.finger}`);
        expect(fingering(layout.rows)).toEqual(fingering(twin.rows));
      });

      it('types every letter on exactly one key, with its capital on Shift', () => {
        for (const letter of LETTERS) {
          const keys = keysOf(layout.rows).filter((k) => k.base === letter);
          expect(keys, letter).toHaveLength(1);
          expect(keys[0]?.shift).toBe(letter.toUpperCase());
        }
      });

      it('never types the same character on two keys (dead keys aside)', () => {
        const chars = keysOf(layout.rows).flatMap((k) => KEY_LEVELS.filter((level) => k[level] && !k.dead?.includes(level)).map((level) => k[level]!));
        expect(new Set(chars).size).toBe(chars.length);
      });

      it('can compose with every dead key it has', () => {
        for (const key of keysOf(layout.rows)) {
          for (const level of key.dead ?? []) {
            const mark = key[level]!;
            expect(layout.compose[mark], mark).toBeDefined();
            expect(layout.compose[mark]?.[' ']).toBe(mark);
          }
        }
      });

      it('has one home key per finger, on the home row', () => {
        const home = keysOf(layout.rows).filter((k) => k.home);
        expect(home).toHaveLength(8);
        expect(new Set(home.map((k) => `${k.hand}-${k.finger}`)).size).toBe(8);
        for (const key of home) expect(layout.rows[2]).toContain(key);
      });
    });

    describe(`${layout.id} Apprentice course`, () => {
      const lessons = layout.lessons;
      const taught = lessons.flat();
      const homeKeys = keysOf(layout.rows).filter((k) => k.home);

      it(`has ${APPRENTICE_CHAPTERS} chapters, one new key each after the first`, () => {
        expect(lessons).toHaveLength(APPRENTICE_CHAPTERS);
        expect(lessons[0]).toHaveLength(2);
        for (const keys of lessons.slice(1)) expect(keys).toHaveLength(1);
      });

      it('starts with the two home keys under the index fingers', () => {
        const index = homeKeys.filter((k) => k.finger === 'index').map((k) => k.base);
        expect([...lessons[0]!].sort()).toEqual(index.sort());
      });

      it('teaches the rest of the home row next, then space', () => {
        const homeRow = layout.rows[2]!.slice(0, 10).map((k) => k.base);
        expect([...lessons.slice(0, SPACE_CHAPTER).flat()].sort()).toEqual([...homeRow].sort());
        expect(lessons[SPACE_CHAPTER]).toEqual([' ']);
      });

      it('teaches every letter, each key once, and only keys on the layout', () => {
        expect(new Set(taught).size).toBe(taught.length);
        for (const letter of LETTERS) expect(taught).toContain(letter);
        for (const key of taught) expect(findKey(layout, key), key).toBeDefined();
      });
    });
  }

  it('put Dvorak and Colemak letters under the right fingers', () => {
    expect(findKey(DVORAK, 'e')).toMatchObject({ code: 'KeyD', hand: 'left', finger: 'middle', home: true });
    expect(findKey(DVORAK, 'h')).toMatchObject({ code: 'KeyJ', hand: 'right', finger: 'index', home: true });
    expect(findKey(DVORAK, '-')).toMatchObject({ code: 'Quote', base: '-', shift: '_' });
    expect(findKey(DVORAK, ';')).toMatchObject({ code: 'KeyZ', hand: 'left', finger: 'pinky' });
    expect(findKey(COLEMAK, 't')).toMatchObject({ code: 'KeyF', hand: 'left', finger: 'index', home: true });
    expect(findKey(COLEMAK, 'o')).toMatchObject({ code: 'Semicolon', hand: 'right', finger: 'pinky', home: true });
    expect(findKey(COLEMAK, ';')).toMatchObject({ code: 'KeyP', hand: 'right', finger: 'pinky' });
  });

  it('put AZERTY and Spanish keys where those keyboards have them', () => {
    expect(findKey(FR_AZERTY, 'a')).toMatchObject({ code: 'KeyQ', finger: 'pinky' });
    expect(findKey(FR_AZERTY, 'q')).toMatchObject({ code: 'KeyA', finger: 'pinky', home: true });
    expect(findKey(FR_AZERTY, 'm')).toMatchObject({ code: 'Semicolon', finger: 'pinky', home: true });
    expect(findKey(FR_AZERTY, 'é')).toMatchObject({ code: 'Digit2', shift: '2' });
    expect(findKey(FR_AZERTY, '<')).toMatchObject({ code: 'IntlBackslash', hand: 'left', finger: 'pinky' });
    expect(findKeyLevel(FR_AZERTY, '@')).toMatchObject({ key: { code: 'Digit0' }, level: 'altGr' });
    expect(findKeyLevel(FR_AZERTY, '^')).toMatchObject({ key: { code: 'Digit9' }, level: 'altGr' });
    expect(findKey(ES_ISO, 'ñ')).toMatchObject({ code: 'Semicolon', shift: 'Ñ', home: true });
    expect(findKey(ES_ISO, '¿')).toMatchObject({ code: 'Equal', base: '¡' });
    expect(ES_ISO.compose['´']?.a).toBe('á');
    expect(ES_ISO.compose['¨']?.U).toBe('Ü');
    expect(FR_AZERTY.compose['^']?.e).toBe('ê');
  });

  it('name the accent a dead key holds', () => {
    expect(deadKeyMark(FR_AZERTY, 'BracketLeft', false, false)).toBe('^');
    expect(deadKeyMark(FR_AZERTY, 'BracketLeft', true, false)).toBe('¨');
    expect(deadKeyMark(FR_AZERTY, 'Digit2', false, true)).toBe('~');
    expect(deadKeyMark(ES_ISO, 'Quote', false, false)).toBe('´');
    expect(deadKeyMark(ES_ISO, 'KeyA', false, false)).toBeNull();
    // US QWERTY has none: on a Mac's US layout, Option+e is a dead key the game just waits out.
    expect(deadKeyMark(US_QWERTY, 'KeyE', false, true)).toBeNull();
  });

  it('give the Mac variant its own keys and no AltGr level', () => {
    const mac = forPlatform(FR_AZERTY, 'mac');
    expect(findKey(mac, '@')).toMatchObject({ code: 'Backquote', shift: '#' });
    expect(findKey(mac, '§')).toMatchObject({ code: 'Digit6', shift: '6' });
    expect(mac.rows.flat().some((k) => k.altGr || k.dead?.includes('altGr'))).toBe(false);
    expect(deadKeyMark(mac, 'BracketLeft', false, false)).toBe('^');
    expect(forPlatform(US_QWERTY, 'pc')).toBe(US_QWERTY);
  });

  it('start each course on its own home keys', () => {
    expect(US_QWERTY.lessons[0]).toEqual(['f', 'j']);
    expect(DVORAK.lessons[0]).toEqual(['u', 'h']);
    expect(COLEMAK.lessons[0]).toEqual(['t', 'n']);
    expect(FR_AZERTY.lessons[0]).toEqual(['f', 'j']);
    expect(ES_ISO.lessons.flat()).toContain('ñ');
  });
});

describe('suggestedLayout', () => {
  it('suggests the language’s usual layout from another language’s', () => {
    expect(suggestedLayout('fr', 'us-qwerty')).toBe('fr-azerty');
    expect(suggestedLayout('es', 'fr-azerty')).toBe('es-iso');
    expect(suggestedLayout('en', 'es-iso')).toBe('us-qwerty');
  });
  it('says nothing when already there, or on Dvorak or Colemak', () => {
    expect(suggestedLayout('fr', 'fr-azerty')).toBeNull();
    expect(suggestedLayout('fr', 'dvorak')).toBeNull();
    expect(suggestedLayout('es', 'colemak')).toBeNull();
  });
});
