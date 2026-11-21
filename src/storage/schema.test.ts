import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYS } from '../core/config';
import { SAVE_VERSION, SaveFormatError, defaultSave, fromExport, migrate, toExport } from './schema';

describe('save schema', () => {
  it('starts new players on the home row and Normal', () => {
    const save = defaultSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.keys).toEqual([...DEFAULT_KEYS]);
    expect(save.difficulty).toBe('normal');
    expect(save.notebook).toBeNull();
  });

  it('round-trips a valid save unchanged', () => {
    const save = defaultSave();
    save.keys = ['a', 'B', '!', ' '];
    save.keyStats = { a: { hits: 10, misses: 2 } };
    save.customPresets = [{ id: 'p1', name: 'Mine', chars: ['a', 'b'] }];
    save.records.bestScore.hard = 1200;
    expect(migrate(structuredClone(save))).toEqual(save);
  });

  it('upgrades version 1 saves, adding empty word lists', () => {
    const save = migrate({ version: 1, keys: ['q'], difficulty: 'hard' });
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.vocab).toEqual([]);
    expect(save.keys).toEqual(['q']);
    expect(save.difficulty).toBe('hard');
  });

  it('upgrades version 2 saves: Apprentice progress starts fresh, old notebooks are Practice', () => {
    const save = migrate({ version: 2, notebook: { difficulty: 'hard', chapter: 1, page: 2, ink: 50 } });
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.apprentice).toEqual({ unlocked: 1, stars: {}, completed: false, accentStars: {} });
    expect(save.notebook?.mode).toBe('practice');
  });

  it('keeps valid Apprentice progress and drops bad entries', () => {
    const save = migrate({ version: 5, apprentice: { unlocked: 99, stars: { '0-1': 3, '2-0': 7, bad: 2 }, completed: true } });
    expect(save.apprentice).toEqual({ unlocked: 27, stars: { '0-1': 3 }, completed: true, accentStars: {} });
  });

  it('upgrades version 3 saves with no ink and default cosmetics', () => {
    const save = migrate({ version: 3, keys: ['q'] });
    expect(save.profile).toEqual({ ink: 0, cosmetics: { nib: 'classic', splatter: 'ink', paper: 'ruled', hat: 'none' } });
  });

  it('keeps known cosmetics and replaces unknown ones', () => {
    const save = migrate({ version: 4, profile: { ink: 420, cosmetics: { nib: 'quill', splatter: 'rainbow', paper: 'graph' } } });
    expect(save.profile).toEqual({ ink: 420, cosmetics: { nib: 'quill', splatter: 'ink', paper: 'graph', hat: 'none' } });
  });

  it('upgrades version 4 saves with a fresh Apprentice course, keeping Practice', () => {
    const appr = migrate({
      version: 4,
      apprentice: { unlocked: 5, stars: { '0-0': 3 }, completed: false },
      notebook: { mode: 'apprentice', difficulty: 'normal', chapter: 3, page: 1, ink: 50 },
      profile: { ink: 300, cosmetics: { nib: 'quill' } },
    });
    expect(appr.apprentice).toEqual({ unlocked: 1, stars: {}, completed: false, accentStars: {} });
    expect(appr.notebook).toBeNull();
    expect(appr.profile.ink).toBe(300);

    const prac = migrate({ version: 4, notebook: { mode: 'practice', difficulty: 'hard', chapter: 2, page: 0, ink: 70 } });
    expect(prac.notebook?.chapter).toBe(2);
  });

  it('drops the old per-player word filter level from version 6–10 saves', () => {
    expect('contentLevel' in migrate({ version: 5, keys: ['a'] })).toBe(false);
    expect('contentLevel' in migrate({ version: 10, contentLevel: 'grownUps', keys: ['a'] })).toBe(false);
  });

  it('gives version 11 saves no hat, keeping their other cosmetics', () => {
    const save = migrate({ version: 11, profile: { ink: 50, cosmetics: { nib: 'quill', splatter: 'teal', paper: 'graph' } } });
    expect(save.profile.cosmetics).toEqual({ nib: 'quill', splatter: 'teal', paper: 'graph', hat: 'none' });
    const kept = migrate({ version: 12, profile: { ink: 50, cosmetics: { nib: 'quill', splatter: 'teal', paper: 'winter', hat: 'santa' } } });
    expect(kept.profile.cosmetics).toEqual({ nib: 'quill', splatter: 'teal', paper: 'winter', hat: 'santa' });
    expect(migrate({ version: 12, profile: { cosmetics: { hat: 'crown' } } }).profile.cosmetics.hat).toBe('none');
  });

  it('upgrades version 6 saves with tips on, crediting mechanics the player has already met', () => {
    const fresh = migrate({ version: 6, keys: ['a'] });
    expect(fresh.tutorials).toEqual({ enabled: true, seen: [] });

    // Seven chapters opened means six finished: everything up to crimson (chapter 5), not yet the Spill.
    const veteran = migrate({ version: 6, apprentice: { unlocked: 7, stars: {}, completed: false } });
    expect(veteran.tutorials.seen.sort()).toEqual(['basics', 'blotling', 'blotter', 'combo', 'crimson']);
    expect(veteran.tutorials.seen).not.toContain('mistakes');

    const done = migrate({ version: 6, apprentice: { unlocked: 27, stars: {}, completed: true } });
    expect(done.tutorials.seen).toEqual(expect.arrayContaining(['spill', 'ghost', 'runon', 'violet']));
    // Misprints were removed in milestone 17, so their id is dropped.
    expect(done.tutorials.seen).not.toContain('misprint');
    expect(done.tutorials.seen).not.toContain('eraser');
  });

  it('gives version 6 notebooks no ability charges, and keeps valid ones later', () => {
    const old = migrate({ version: 6, notebook: { mode: 'practice', difficulty: 'normal', chapter: 1, page: 0, ink: 60 } });
    expect(old.notebook).toMatchObject({ charges: 0, eraser: false, shield: false });
    const now = migrate({ version: 7, notebook: { mode: 'practice', difficulty: 'normal', chapter: 1, page: 0, ink: 60, charges: 2, eraser: true, shield: 'yes' } });
    expect(now.notebook).toMatchObject({ charges: 2, eraser: true, shield: false });
  });

  it('puts players from before version 8 on US QWERTY, and keeps a chosen layout', () => {
    expect(migrate({ version: 7 }).layout).toBe('us-qwerty');
    expect(migrate({ version: 1 }).layout).toBe('us-qwerty');
    expect(migrate({ ...defaultSave(), layout: 'dvorak' }).layout).toBe('dvorak');
    expect(migrate({ ...defaultSave(), layout: 'azerty' }).layout).toBe('us-qwerty');
    expect(defaultSave().layout).toBe('us-qwerty');
  });

  it('gives version 8 saves page bests and Daily records, keeping their other records', () => {
    const save = migrate({ version: 8, records: { bestScore: { normal: 1200 }, furthestChapter: { normal: 3 } } });
    expect(save.records).toEqual({ bestScore: { normal: 1200 }, furthestChapter: { normal: 3 }, pageBest: {} });
    expect(save.daily).toEqual({ lastId: null, streak: 0, bestStreak: 0, best: 0, results: {} });
  });

  it('checks page bests and Daily results', () => {
    const save = migrate({
      ...defaultSave(),
      records: { bestScore: {}, furthestChapter: {}, pageBest: { 'practice:hard:2-0': 900, 'bogus': 5, 'daily:normal:0-0': 3, 'apprentice:normal:1-1': -4 } },
      daily: {
        lastId: 4,
        streak: 2,
        bestStreak: 'lots',
        best: 800,
        results: { 4: { score: 800, grades: ['A', 'Z', 'F'], wpm: 50, accuracy: 140, finished: true }, x: { score: 1 } },
      },
    });
    expect(save.records.pageBest).toEqual({ 'practice:hard:2-0': 900 });
    expect(save.daily).toEqual({
      lastId: 4,
      streak: 2,
      bestStreak: 0,
      best: 800,
      results: { 4: { score: 800, grades: ['A', 'F'], wpm: 50, accuracy: 100, finished: true } },
    });
  });

  it('gives version 9 saves an empty sticker book, and checks a saved one', () => {
    expect(migrate({ version: 9 }).stickers).toEqual({ earned: {}, unseen: [], bossesBeaten: [] });
    const save = migrate({
      ...defaultSave(),
      stickers: {
        earned: { goldStar: '2026-11-18T10:00:00.000Z', madeUp: 'x', firstPage: 5 },
        unseen: ['goldStar', 'firstPage', 'madeUp'],
        bossesBeaten: ['squid', 'dragon', 'squid'],
      },
    });
    expect(save.stickers).toEqual({ earned: { goldStar: '2026-11-18T10:00:00.000Z' }, unseen: ['goldStar'], bossesBeaten: ['squid'] });
  });

  it('gives version 13 saves no Fair Copy results, and checks saved ones', () => {
    expect(migrate({ version: 13 }).fairCopy).toEqual({ tests: 0, best: {}, copied: [] });
    const good = { wpm: 61.5, accuracy: 0.97, at: '2026-11-20T10:00:00.000Z' };
    const save = migrate({
      ...defaultSave(),
      fairCopy: {
        tests: 4.7,
        best: { passage: good, '60': good, '45': good, '30': { ...good, wpm: -3 }, sprint: good },
      },
    });
    expect(save.fairCopy).toEqual({ tests: 4, best: { passage: good, '60': good }, copied: [] });
    expect(migrate({ ...defaultSave(), fairCopy: { tests: 2, best: { passage: { ...good, accuracy: 2 } } } }).fairCopy.best).toEqual({});
  });

  it('gives version 14 saves no copied passages, keeping their bests, and checks saved ones', () => {
    const best = { passage: { wpm: 50, accuracy: 1, at: '2026-11-20T10:00:00.000Z' } };
    expect(migrate({ ...defaultSave(), version: 14, fairCopy: { tests: 3, best } }).fairCopy).toEqual({ tests: 3, best, copied: [] });
    const save = migrate({ ...defaultSave(), fairCopy: { tests: 1, best: {}, copied: ['twain-huck', 'made-up', 'twain-huck', 7] } });
    expect(save.fairCopy.copied).toEqual(['twain-huck']);
  });

  it('gives version 15 saves English words, strict accents and no accent stars', () => {
    const old = { ...defaultSave(), version: 15, apprentice: { unlocked: 4, stars: { '0-0': 3 }, completed: false } } as Record<string, unknown>;
    delete old.wordsLanguage;
    delete old.accents;
    const save = migrate(old);
    expect(save.wordsLanguage).toBe('en');
    expect(save.accents).toEqual({ forgiving: false, seen: [] });
    expect(save.apprentice).toEqual({ unlocked: 4, stars: { '0-0': 3 }, completed: false, accentStars: {} });
  });

  it('checks the words language, accent options and accent stars', () => {
    const save = migrate({
      ...defaultSave(),
      wordsLanguage: 'klingon',
      accents: { forgiving: true, seen: ['é', 'é', 'xx', 3] },
      apprentice: { unlocked: 1, stars: {}, completed: false, accentStars: { fr: [3, 99, -1], xx: [1] } },
    });
    expect(save.wordsLanguage).toBe('en');
    expect(save.accents).toEqual({ forgiving: true, seen: ['é'] });
    expect(save.apprentice.accentStars).toEqual({ fr: [3, 9, 0] });
    expect(migrate({ ...defaultSave(), wordsLanguage: 'fr' }).wordsLanguage).toBe('fr');
  });

  it('drops unknown tutorial ids and keeps the tips choice', () => {
    const save = migrate({ version: 7, tutorials: { enabled: false, seen: ['basics', 'nonsense', 'basics', 4] } });
    expect(save.tutorials).toEqual({ enabled: false, seen: ['basics'] });
  });

  it('keeps valid word lists and drops bad ones', () => {
    const save = migrate({
      version: 2,
      vocab: [
        { id: 'a', topic: 'ocean', words: ['sea', 'Bad', 'reef', 'sea', 7], enabled: false, fetchedAt: '2026-01-01' },
        { id: 'b', topic: 'empty', words: [] },
        'junk',
      ],
    });
    expect(save.vocab).toEqual([{ id: 'a', lang: 'en', topic: 'ocean', words: ['sea', 'reef'], enabled: false, fetchedAt: '2026-01-01' }]);
  });

  it('cleans up bad fields instead of trusting them', () => {
    const save = migrate({
      version: 2,
      keys: ['a', 'ab', 7, 'a', 'b'],
      difficulty: 'impossible',
      keyStats: { a: { hits: -3, misses: 2.7 }, toolong: { hits: 1, misses: 1 }, b: 'nope' },
      customPresets: [{ id: 'x', name: 'Empty', chars: [] }, { id: 'y', name: 'Ok', chars: ['z'] }, 'junk'],
      records: { bestScore: { normal: 'lots', hard: 50 } },
      notebook: { difficulty: 'hard', chapter: 2, page: 1, ink: 60 },
    });
    expect(save.keys).toEqual(['a', 'b']);
    expect(save.difficulty).toBe('normal');
    expect(save.keyStats).toEqual({ a: { hits: 0, misses: 2 } });
    expect(save.customPresets).toEqual([{ id: 'y', name: 'Ok', chars: ['z'] }]);
    expect(save.records.bestScore).toEqual({ normal: 0, hard: 50 });
    expect(save.notebook).toMatchObject({ difficulty: 'hard', chapter: 2, page: 1, ink: 60, score: 0 });
  });

  it('falls back to default keys if none are usable', () => {
    expect(migrate({ version: 2, keys: [] }).keys).toEqual([...DEFAULT_KEYS]);
  });

  it('rejects things that are not saves', () => {
    for (const raw of [null, 'save', [], {}, { version: 0 }, { version: 'one' }]) {
      expect(() => migrate(raw)).toThrow(SaveFormatError);
    }
  });

  it('refuses saves from a newer version of the game', () => {
    try {
      migrate({ version: SAVE_VERSION + 1 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SaveFormatError);
      expect((error as SaveFormatError).reason).toBe('newer');
    }
  });
});

describe('export files', () => {
  it('round-trips through export and import', () => {
    const save = defaultSave();
    save.keys = ['q', 'w'];
    const text = JSON.stringify(toExport(save, new Date('2026-01-02T03:04:05Z')));
    expect(JSON.parse(text).exportedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(fromExport(text)).toEqual(save);
  });

  it('rejects other JSON and non-JSON', () => {
    expect(() => fromExport('not json')).toThrow(SaveFormatError);
    expect(() => fromExport('{"app":"other","save":{}}')).toThrow(SaveFormatError);
    expect(() => fromExport(JSON.stringify({ version: 1 }))).toThrow(SaveFormatError);
  });
});
