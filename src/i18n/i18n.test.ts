import { afterEach, describe, expect, it } from 'vitest';
import { en, type MessageKey } from './en';
import { fr } from './fr';
import { es } from './es';
import { getLocale, setLocale, t, tCount } from './index';

const keysOf = (messages: object) => Object.keys(messages) as MessageKey[];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  afterEach(() => setLocale('en'));

  it('French has every key except release notes, and nothing extra', () => {
    const missing = keysOf(en).filter((k) => !k.startsWith('release.') && !(k in fr));
    expect(missing).toEqual([]);
    expect(keysOf(fr).filter((k) => !(k in en))).toEqual([]);
  });

  it('French keeps every placeholder of the English text', () => {
    const wrong = keysOf(fr).filter((k) => placeholders(fr[k] ?? '').join() !== placeholders(en[k]).join());
    expect(wrong).toEqual([]);
  });

  it('French shortcut letters differ on each screen', () => {
    const k = (name: string) => fr[`menu.key.${name}` as MessageKey];
    const title = ['continue', 'freeWrite', 'daily', 'apprentice', 'fairCopy', 'desk', 'stickers', 'wordLists', 'howToPlay', 'settings', 'saveData', 'about'].map(k);
    const pause = ['restart', 'practice', 'pauseSettings', 'quit'].map(k);
    expect(new Set(title).size).toBe(title.length);
    expect(new Set(pause).size).toBe(pause.length);
  });

  it('picks the menu language from a browser tag, falling back to English', () => {
    setLocale('fr-CA');
    expect(getLocale()).toBe('fr');
    expect(t('menu.settings')).toBe('Réglages');
    setLocale('de');
    expect(getLocale()).toBe('en');
  });

  it('falls back to English for a release note that isn’t translated', () => {
    setLocale('fr');
    expect(t('release.2.28.0.powers')).toBe(en['release.2.28.0.powers']);
  });

  it('chooses plural forms by language: French counts 0 as one', () => {
    expect(tCount('stickers.toast', 1)).toBe('New sticker!');
    expect(tCount('stickers.toast', 0)).toBe('0 new stickers!');
    setLocale('fr');
    expect(tCount('stickers.toast', 0)).toMatch(/^Nouvel autocollant/);
    expect(tCount('fairCopy.card.penalty', 2, { lost: 3 })).toBe('−3 MPM pour 2 erreurs laissées');
  });

  it('Spanish has every key except release notes, and nothing extra', () => {
    const missing = keysOf(en).filter((k) => !k.startsWith('release.') && !(k in es));
    expect(missing).toEqual([]);
    expect(keysOf(es).filter((k) => !(k in en))).toEqual([]);
  });

  it('Spanish keeps every placeholder of the English text', () => {
    const wrong = keysOf(es).filter((k) => placeholders(es[k] ?? '').join() !== placeholders(en[k]).join());
    expect(wrong).toEqual([]);
  });

  it('Spanish shortcut letters differ on each screen', () => {
    const k = (name: string) => es[`menu.key.${name}` as MessageKey];
    const title = ['continue', 'freeWrite', 'daily', 'apprentice', 'fairCopy', 'desk', 'stickers', 'wordLists', 'howToPlay', 'settings', 'saveData', 'about'].map(k);
    const pause = ['restart', 'practice', 'pauseSettings', 'quit'].map(k);
    expect(new Set(title).size).toBe(title.length);
    expect(new Set(pause).size).toBe(pause.length);
  });

  it('picks Spanish from a browser tag', () => {
    setLocale('es-MX');
    expect(getLocale()).toBe('es');
    expect(t('menu.settings')).toBe('Ajustes');
  });

  it('chooses plural forms in Spanish: 0 counts as other', () => {
    setLocale('es');
    expect(tCount('stickers.toast', 1)).toBe('¡Pegatina nueva!');
    expect(tCount('stickers.toast', 0)).toBe('¡0 pegatinas nuevas!');
    expect(tCount('fairCopy.card.penalty', 2, { lost: 3 })).toBe('−3 PPM por 2 errores sin corregir');
  });
});
