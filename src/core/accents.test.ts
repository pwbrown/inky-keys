import { describe, expect, it } from 'vitest';
import { COLEMAK, DVORAK, ES_ISO, FR_AZERTY, US_QWERTY, forPlatform } from '../content/layouts';
import type { KeyboardLayout, Platform } from '../content/layouts/types';
import { ACCENT_CHAPTERS, accentMethod, accentedLetters, extraPresses, howToType, isAccented, plainLetter, type KeyStep } from './accents';

/** Steps as short text: "Shift+Digit6* KeyE" (* = dead key). */
const show = (steps: KeyStep[] | null) =>
  steps
    ?.map((s) => [s.option && 'Option', s.altGr && 'AltGr', s.shift && 'Shift', s.code].filter(Boolean).join('+') + (s.dead ? '*' : ''))
    .join(' ') ?? null;

const on = (layout: KeyboardLayout, platform: Platform) => (char: string) => show(howToType(char, forPlatform(layout, platform), platform));

describe('howToType', () => {
  it('uses AZERTY’s own keys and dead keys, on a PC and a Mac', () => {
    for (const platform of ['pc', 'mac'] as const) {
      const fr = on(FR_AZERTY, platform);
      expect(fr('é')).toBe('Digit2');
      expect(fr('è')).toBe('Digit7');
      expect(fr('ç')).toBe('Digit9');
      expect(fr('à')).toBe('Digit0');
      expect(fr('ù')).toBe('Quote');
      expect(fr('ê')).toBe('BracketLeft* KeyE');
      expect(fr('Ê')).toBe('BracketLeft* Shift+KeyE');
      expect(fr('ï')).toBe('Shift+BracketLeft* KeyI');
      expect(fr('ü')).toBe('Shift+BracketLeft* KeyU');
    }
  });

  it('can’t give É on Windows AZERTY (it has no key there)', () => {
    expect(on(FR_AZERTY, 'pc')('É')).toBeNull();
  });

  it('uses the Spanish keyboard’s keys and its ´ dead key', () => {
    const es = on(ES_ISO, 'pc');
    expect(es('ñ')).toBe('Semicolon');
    expect(es('á')).toBe('Quote* KeyA');
    expect(es('ü')).toBe('Shift+Quote* KeyU');
    expect(es('ê')).toBe('Shift+BracketLeft* KeyE');
    expect(es('ç')).toBe('Backslash');
    expect(es('¿')).toBe('Shift+Equal');
  });

  it('uses Option keys on a Mac with a US keyboard', () => {
    const mac = on(US_QWERTY, 'mac');
    expect(mac('é')).toBe('Option+KeyE* KeyE');
    expect(mac('É')).toBe('Option+KeyE* Shift+KeyE');
    expect(mac('è')).toBe('Option+Backquote* KeyE');
    expect(mac('ê')).toBe('Option+KeyI* KeyE');
    expect(mac('ï')).toBe('Option+KeyU* KeyI');
    expect(mac('ñ')).toBe('Option+KeyN* KeyN');
    expect(mac('ç')).toBe('Option+KeyC');
    expect(mac('¡')).toBe('Option+Digit1');
    expect(mac('¿')).toBe('Option+Shift+Slash');
  });

  it('uses US-International on Windows or a Chromebook with a US keyboard', () => {
    const pc = on(US_QWERTY, 'pc');
    expect(pc('é')).toBe('Quote* KeyE');
    expect(pc('É')).toBe('Quote* Shift+KeyE');
    expect(pc('è')).toBe('Backquote* KeyE');
    expect(pc('ê')).toBe('Shift+Digit6* KeyE');
    expect(pc('ë')).toBe('Shift+Quote* KeyE');
    expect(pc('ñ')).toBe('AltGr+KeyN');
    expect(pc('ç')).toBe('AltGr+Comma');
    expect(pc('Ç')).toBe('AltGr+Shift+Comma');
    expect(pc('¡')).toBe('AltGr+Digit1');
    expect(pc('¿')).toBe('AltGr+Slash');
  });

  it('follows the letters on Dvorak and Colemak', () => {
    expect(on(DVORAK, 'mac')('é')).toBe('Option+KeyD* KeyD');
    expect(on(COLEMAK, 'pc')('ê')).toBe('Shift+Digit6* KeyK');
  });

  it('has steps for every French accent on every layout and computer we give tips for', () => {
    for (const layout of [FR_AZERTY, ES_ISO, US_QWERTY]) {
      for (const platform of ['pc', 'mac'] as const) {
        const missing = accentedLetters('fr').filter((ch) => !howToType(ch, forPlatform(layout, platform), platform));
        expect(missing, `${layout.id} ${platform}`).toEqual([]);
      }
    }
  });

  it('labels each step with what’s printed on its key', () => {
    expect(howToType('ê', FR_AZERTY, 'pc')).toEqual([
      { code: 'BracketLeft', key: '^', top: '¨', dead: true, makes: '^' },
      { code: 'KeyE', key: 'e', makes: 'ê' },
    ]);
  });

  it('says what each step gives', () => {
    const makes = (steps: KeyStep[] | null) => steps?.map((s) => s.makes).join(' ');
    expect(makes(howToType('ï', FR_AZERTY, 'pc'))).toBe('¨ ï');
    expect(makes(howToType('é', US_QWERTY, 'mac'))).toBe('´ é');
    expect(makes(howToType('ê', US_QWERTY, 'pc'))).toBe('^ ê');
    expect(makes(howToType('ç', US_QWERTY, 'pc'))).toBe('ç');
    expect(makes(howToType('é', FR_AZERTY, 'pc'))).toBe('é');
  });

  it('plain letters and symbols are just their key', () => {
    expect(on(US_QWERTY, 'pc')('e')).toBe('KeyE');
    expect(on(FR_AZERTY, 'pc')('1')).toBe('Shift+Digit1');
  });
});

describe('accent helpers', () => {
  it('names the method', () => {
    expect(accentMethod(FR_AZERTY, 'pc')).toBe('layout');
    expect(accentMethod(US_QWERTY, 'mac')).toBe('macOption');
    expect(accentMethod(US_QWERTY, 'pc')).toBe('usInternational');
  });

  it('counts the extra key presses an accent takes', () => {
    expect(extraPresses('é', FR_AZERTY, 'pc')).toBe(0);
    expect(extraPresses('ê', FR_AZERTY, 'pc')).toBe(1);
    expect(extraPresses('ï', FR_AZERTY, 'pc')).toBe(2);
    expect(extraPresses('é', US_QWERTY, 'mac')).toBe(2);
    expect(extraPresses('é', US_QWERTY, 'pc')).toBe(1);
    expect(extraPresses('e', US_QWERTY, 'pc')).toBe(0);
    expect(extraPresses('É', FR_AZERTY, 'pc')).toBe(0);
  });

  it('strips accents for Forgiving accents', () => {
    expect(plainLetter('é')).toBe('e');
    expect(plainLetter('Ç')).toBe('C');
    expect(plainLetter('ï')).toBe('i');
    expect(isAccented('ù')).toBe(true);
    expect(isAccented('u')).toBe(false);
    expect(isAccented('ñ')).toBe(true);
  });

  it('teaches the French accents in five chapters, each letter once', () => {
    expect(ACCENT_CHAPTERS.fr.map((c) => c.join(''))).toEqual(['é', 'èàù', 'ç', 'âêîôû', 'ëïü']);
    expect(new Set(accentedLetters('fr')).size).toBe(13);
    expect(accentedLetters('en')).toEqual([]);
  });
});
