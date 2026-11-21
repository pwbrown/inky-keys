import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { apprenticePlan, starKey } from './campaign';
import { BOSS_KINDS, GAME_CONFIG } from './config';
import type { Grade } from './grade';
import { PASSAGES } from './fairCopy';
import { createStats, type Stats } from './stats';
import { STICKERS, newStickers, type FairCopyFacts, type PageFacts, type StickerFacts } from './stickers';

const S = GAME_CONFIG.stickers;

function facts(extra: Partial<StickerFacts> = {}): StickerFacts {
  return { level: 1, apprentice: { unlocked: 1, stars: {}, completed: false }, bossesBeaten: [], passagesCopied: [], ...extra };
}

function page(stats: Partial<Stats> = {}, extra: Partial<PageFacts> = {}): PageFacts {
  return {
    mode: 'practice',
    difficulty: 'normal',
    grade: 'B',
    stats: { ...createStats(), correct: 20, ...stats },
    notebookScore: 100,
    boss: null,
    layoutId: 'us-qwerty',
    at: new Date(2026, 9, 14, 15, 0),
    season: null,
    ...extra,
  };
}

const earned = (f: StickerFacts) => newStickers(f, {}).map((s) => s.id);

describe('stickers', () => {
  it('each have a unique id, a name and how to earn it', () => {
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
    const strings = en as Record<string, string>;
    for (const s of STICKERS) {
      expect(strings[`sticker.${s.id}.name`], s.id).toBeTruthy();
      expect(strings[`sticker.${s.id}.how`], s.id).toBeTruthy();
    }
  });

  it('gives nothing before anything happens', () => {
    expect(earned(facts())).toEqual([]);
  });

  it('rewards a first page, an A+ and long runs', () => {
    expect(earned(facts({ page: page() }))).toEqual(['firstPage']);
    expect(earned(facts({ page: page({}, { grade: 'A+' }) }))).toContain('goldStar');
    const run = earned(facts({ page: page({ bestCombo: S.combo[1]! }) }));
    expect(run).toEqual(expect.arrayContaining(['onARoll', 'inkRiver']));
    expect(run).not.toContain('unstoppable');
  });

  it('only counts speed on a page with enough keys', () => {
    const fast = { correct: S.minKeys, playMs: 60_000 * (S.minKeys / 5 / 55) };
    expect(earned(facts({ page: page(fast) }))).toEqual(expect.arrayContaining(['quickPen', 'speedScribe']));
    expect(earned(facts({ page: page({ ...fast, correct: S.minKeys - 1 }) }))).not.toContain('quickPen');
  });

  it('wants a clean margin on Hard or Expert only', () => {
    expect(earned(facts({ page: page({ leaks: 0 }, { difficulty: 'hard' }) }))).toContain('cleanMargin');
    expect(earned(facts({ page: page({ leaks: 0 }, { difficulty: 'normal' }) }))).not.toContain('cleanMargin');
    expect(earned(facts({ page: page({ leaks: 1 }, { difficulty: 'expert' }) }))).not.toContain('cleanMargin');
  });

  it('tracks bosses: the first, a spotless one and all five', () => {
    const boss = facts({ bossesBeaten: ['spill'], page: page({ errors: 0, leaks: 0 }, { boss: 'spill' }) });
    expect(earned(boss)).toEqual(expect.arrayContaining(['firstBoss', 'spotless']));
    expect(earned(boss)).not.toContain('bossCollector');
    expect(earned(facts({ bossesBeaten: [...BOSS_KINDS] }))).toContain('bossCollector');
    expect(earned(facts({ bossesBeaten: ['quill'], page: page({ errors: 1 }, { boss: 'quill' }) }))).not.toContain('spotless');
  });

  it('follows the Apprentice course and level', () => {
    const stars: Record<string, number> = {};
    for (let p = 0; p < apprenticePlan(0).length; p++) stars[starKey(0, p)] = 3;
    expect(earned(facts({ apprentice: { unlocked: 2, stars, completed: false } }))).toEqual(['starPupil']);
    expect(earned(facts({ apprentice: { unlocked: S.halfwayChapter + 1, stars: {}, completed: false } }))).toEqual(['halfway']);
    expect(earned(facts({ apprentice: { unlocked: 27, stars: {}, completed: true } }))).toEqual(['halfway', 'graduate']);
    expect(earned(facts({ level: S.levels[1]! }))).toEqual(['scribe', 'calligrapher']);
  });

  it('rewards the Daily Page, a perfect day and streaks', () => {
    const daily = (grades: Grade[], streak = 1) => facts({ daily: { grades, pages: 3, finished: true, streak } });
    expect(earned(daily(['A', 'B', 'A']))).toEqual(['dailyFirst']);
    expect(earned(daily(['A+', 'A', 'A']))).toEqual(['dailyFirst', 'perfectDay']);
    expect(earned(daily(['A', 'A']))).not.toContain('perfectDay');
    expect(earned(daily(['A'], S.streak[1]!))).toEqual(expect.arrayContaining(['onFire', 'weekOfInk']));
  });

  it('hides a couple of secrets', () => {
    expect(earned(facts({ page: page({}, { at: new Date(2026, 10, 17, 1, 30) }) }))).toContain('midnightOil');
    expect(earned(facts({ page: page({}, { layoutId: 'dvorak' }) }))).toContain('globetrotter');
    expect(STICKERS.filter((s) => s.secret).map((s) => s.id)).toEqual(['midnightOil', 'globetrotter']);
  });

  it('gives the holiday stickers for a page finished in season', () => {
    expect(earned(facts({ page: page({}, { season: 'thanksgiving' }) }))).toContain('harvestHelper');
    expect(earned(facts({ page: page({}, { season: 'christmas' }) }))).toContain('snowScribe');
    const summer = earned(facts({ page: page({}, { season: null }) }));
    expect(summer).not.toContain('harvestHelper');
    expect(summer).not.toContain('snowScribe');
    expect(earned(facts())).not.toContain('snowScribe');
  });

  it('fills the Fair Copy shelf: a first test, a clean passage, speed and the bell', () => {
    const copy = (extra: Partial<FairCopyFacts> = {}): FairCopyFacts => ({ seconds: null, netWpm: 35, typed: 300, errors: 2, mistakesLeft: 1, ...extra });
    expect(earned(facts({ fairCopy: copy() }))).toEqual(['firstCopy']);
    expect(earned(facts({ fairCopy: copy({ errors: 0, mistakesLeft: 0 }) }))).toContain('neatAsPrint');
    // A clean timed test isn't a whole passage.
    expect(earned(facts({ fairCopy: copy({ seconds: 30, errors: 0, mistakesLeft: 0 }) }))).not.toContain('neatAsPrint');
    const [slow, mid, fast] = S.fairCopyWpm;
    expect(earned(facts({ fairCopy: copy({ netWpm: mid! }) }))).toEqual(expect.arrayContaining(['copyist', 'swiftQuill']));
    expect(earned(facts({ fairCopy: copy({ netWpm: fast! }) }))).toContain('printingPress');
    // Too little typed to count for speed.
    expect(earned(facts({ fairCopy: copy({ netWpm: slow!, typed: S.minKeys - 1 }) }))).not.toContain('copyist');
    expect(earned(facts({ fairCopy: copy({ seconds: S.bellSeconds, mistakesLeft: 0 }) }))).toContain('beatTheBell');
    expect(earned(facts({ fairCopy: copy({ seconds: S.bellSeconds, mistakesLeft: 1 }) }))).not.toContain('beatTheBell');
    expect(earned(facts({ fairCopy: copy({ seconds: 30, mistakesLeft: 0 }) }))).not.toContain('beatTheBell');
  });

  it('gives Bookworm once every Fair Copy passage in any one language is copied out', () => {
    const ids = (lang: string) => PASSAGES.filter((p) => p.lang === lang).map((p) => p.id);
    expect(earned(facts({ passagesCopied: [...ids('en').slice(1), ...ids('fr').slice(1)] }))).not.toContain('bookworm');
    expect(earned(facts({ passagesCopied: ids('en') }))).toContain('bookworm');
    expect(earned(facts({ passagesCopied: ids('fr') }))).toContain('bookworm');
  });

  it('never gives a sticker twice', () => {
    expect(newStickers(facts({ page: page({}, { grade: 'A+' }) }), { firstPage: 'x' }).map((s) => s.id)).toEqual(['goldStar']);
  });
});
