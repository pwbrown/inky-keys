/** Spanish words language (milestone 34): accents, ¿ ¡, presets and the Daily Page. */
import { describe, expect, it } from 'vitest';
import { createContentSource, MIN_WORD_POOL } from '../content/contentSource';
import { COLEMAK, DVORAK, ES_ISO, FR_AZERTY, US_QWERTY, forPlatform } from '../content/layouts';
import { entriesFromTiers } from '../content/wordPool';
import { ACCENT_CHAPTERS, accentedLetters, extraPresses, howToType, needsKeySteps, pressCostFor, type KeyStep } from './accents';
import { dailyKeys, dailySeed } from './daily';
import { builtInPresets, LETTERS_ACCENTS } from './keySelection';

const show = (steps: KeyStep[] | null) =>
  steps
    ?.map((s) => [s.option && 'Option', s.altGr && 'AltGr', s.shift && 'Shift', s.code].filter(Boolean).join('+') + (s.dead ? '*' : ''))
    .join(' ') ?? null;

describe('Spanish accent chapters', () => {
  it('teach ñ, then á é, í ó ú, ü, and last ¿ ¡', () => {
    expect(ACCENT_CHAPTERS.es).toEqual([['ñ'], ['á', 'é'], ['í', 'ó', 'ú'], ['ü'], ['¿', '¡']]);
    expect(needsKeySteps('¿')).toBe(true);
    expect(needsKeySteps('ñ')).toBe(true);
    expect(needsKeySteps('?')).toBe(false);
  });

  it('can all be typed on the Spanish and US-style layouts, on a PC and a Mac', () => {
    for (const layout of [ES_ISO, US_QWERTY, DVORAK, COLEMAK]) {
      for (const platform of ['pc', 'mac'] as const) {
        for (const ch of accentedLetters('es')) {
          expect(howToType(ch, forPlatform(layout, platform), platform), `${ch} on ${layout.id} ${platform}`).not.toBeNull();
        }
      }
    }
  });

  it('has no á í ó ú on AZERTY (left out of its Daily Page and chapters there)', () => {
    expect(howToType('á', FR_AZERTY, 'pc')).toBeNull();
    expect(howToType('é', FR_AZERTY, 'pc')).not.toBeNull();
  });

  it('types ¿ and ¡ with the keys right of 0 on the Spanish keyboard', () => {
    for (const platform of ['pc', 'mac'] as const) {
      const es = (ch: string) => show(howToType(ch, forPlatform(ES_ISO, platform), platform));
      expect(es('¡')).toBe('Equal');
      expect(es('¿')).toBe('Shift+Equal');
      expect(es('é')).toBe('Quote* KeyE');
    }
  });

  it('types ¿ ¡ on a US keyboard with Option on a Mac and AltGr on US-International', () => {
    const mac = (ch: string) => show(howToType(ch, forPlatform(US_QWERTY, 'mac'), 'mac'));
    const pc = (ch: string) => show(howToType(ch, US_QWERTY, 'pc'));
    expect(mac('¡')).toBe('Option+Digit1');
    expect(mac('¿')).toBe('Option+Shift+Slash');
    expect(pc('¡')).toBe('AltGr+Digit1');
    expect(pc('¿')).toBe('AltGr+Slash');
    expect(pc('ñ')).toBe('AltGr+KeyN');
    expect(mac('ñ')).toBe('Option+KeyN* KeyN');
  });

  it('counts the extra presses ¿ and ñ take on a US Mac, and none for ñ on the Spanish keyboard', () => {
    const mac = forPlatform(US_QWERTY, 'mac');
    expect(extraPresses('¿', mac, 'mac')).toBe(2);
    expect(pressCostFor(mac, 'mac')('¿')).toBe(2);
    expect(extraPresses('ñ', mac, 'mac')).toBe(2);
    expect(extraPresses('ñ', ES_ISO, 'pc')).toBe(0);
    expect(extraPresses('¿', ES_ISO, 'pc')).toBe(1);
  });
});

describe('¿ and ¡ in words', () => {
  const words = entriesFromTiers([Array.from({ length: MIN_WORD_POOL }, (_, i) => 'ab'.repeat(1 + (i % 4)) + 'a'.repeat(i)).join(' ')]);
  const results = (keys: string[]) => {
    const content = createContentSource({ keys, words, punctuationChance: 1 });
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 60 }, () => content.nextWord(0.5, random));
  };

  it('open a question or exclamation when selected', () => {
    const out = results(['a', 'b', '?', '!', '¿', '¡']);
    for (const w of out) expect(w).toMatch(/^(¿[ab]+\?|¡[ab]+!)$/);
    expect(out.some((w) => w.startsWith('¿'))).toBe(true);
    expect(out.some((w) => w.startsWith('¡'))).toBe(true);
  });

  it('leave English-style punctuation alone when not selected', () => {
    for (const w of results(['a', 'b', '?', '!'])) expect(w).toMatch(/^[ab]+[?!]$/);
  });
});

describe('Spanish presets', () => {
  const presets = builtInPresets(US_QWERTY, accentedLetters('es'));
  it('put ¿ ¡ with the punctuation, and only letters in Letters + accents', () => {
    const punct = presets.find((p) => p.id === 'lettersPunctuation')!.chars;
    expect(punct).toEqual(expect.arrayContaining(['?', '!', '¿', '¡']));
    const accents = presets.find((p) => p.id === LETTERS_ACCENTS)!.chars;
    expect(accents).toEqual(expect.arrayContaining(['ñ', 'á', 'é', 'í', 'ó', 'ú', 'ü']));
    expect(accents).not.toContain('¿');
  });
});

describe('Spanish Daily Page', () => {
  it('includes ñ and every Spanish accent but not ¿ ¡, with its own seed', () => {
    const keys = dailyKeys(ES_ISO, 'es');
    expect(keys).toEqual(expect.arrayContaining(['ñ', 'á', 'é', 'í', 'ó', 'ú', 'ü']));
    expect(keys).not.toContain('¿');
    expect(dailySeed(5, 'es-iso', 'es')).not.toBe(dailySeed(5, 'es-iso'));
    expect(dailySeed(5, 'es-iso', 'es')).not.toBe(dailySeed(5, 'es-iso', 'fr'));
  });
});
