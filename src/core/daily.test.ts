import { describe, expect, it } from 'vitest';
import { createContentSource } from '../content/contentSource';
import { US_QWERTY } from '../content/layouts';
import { GAME_CONFIG } from './config';
import { DAILY_PAGES, dailyId, dailyKeys, dailyPages, dailySeed, streakWeek } from './daily';
import { canRestart, confirm, finishedNotebook, restartPage, startDaily, typeChar } from './input';
import { hashSeed } from './rng';
import { createStats, earnPoints } from './stats';
import { createWorld, spawnBottle, spawnTarget, type World } from './world';

const LETTERS = [...'abcdefghijklmnopqrstuvwxyz'];

describe('dailyId', () => {
  const { year, month, day } = GAME_CONFIG.daily.epoch;

  it('counts days from the first Daily Page, by local date', () => {
    expect(dailyId(new Date(year, month - 1, day, 0, 1))).toBe(1);
    expect(dailyId(new Date(year, month - 1, day, 23, 59))).toBe(1);
    expect(dailyId(new Date(year, month - 1, day + 1, 0, 0))).toBe(2);
    expect(dailyId(new Date(year, month - 1, day + 365, 12, 0))).toBe(366);
  });
});

describe('dailySeed and dailyKeys', () => {
  it('is the same for everyone on a layout, and differs by day and layout', () => {
    expect(dailySeed(5, 'us-qwerty')).toBe(dailySeed(5, 'us-qwerty'));
    expect(dailySeed(5, 'us-qwerty')).not.toBe(dailySeed(6, 'us-qwerty'));
    expect(dailySeed(5, 'us-qwerty')).not.toBe(dailySeed(5, 'other'));
  });

  it('uses every key the Apprentice course teaches', () => {
    const keys = dailyKeys(US_QWERTY);
    for (const letter of LETTERS) expect(keys).toContain(letter);
  });
});

describe('streakWeek', () => {
  it('shows Monday to Sunday of this week, with the days played', () => {
    // Wednesday 2 December 2026.
    const wednesday = new Date(2026, 11, 2, 9, 0);
    const today = dailyId(wednesday);
    const week = streakWeek(wednesday, new Set([today - 2, today]));
    expect(week.map((d) => d.date.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week.map((d) => d.played)).toEqual([true, false, true, false, false, false, false]);
    expect(week.map((d) => d.today)).toEqual([false, false, true, false, false, false, false]);
    expect(week.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
    expect(week.map((d) => d.id)).toEqual([today - 2, today - 1, today, today + 1, today + 2, today + 3, today + 4]);
  });

  it('puts Sunday at the end of its week', () => {
    const sunday = new Date(2026, 11, 6, 20, 0);
    const week = streakWeek(sunday, new Set());
    expect(week[6]!.today).toBe(true);
    expect(week[0]!.date.getDate()).toBe(30);
  });
});

describe('dailyPages', () => {
  it('lists every page in order with its grade and colour', () => {
    expect(dailyPages(['A+', 'B'], 3)).toEqual([
      { page: 1, grade: 'A+', mark: 'good' },
      { page: 2, grade: 'B', mark: 'fair' },
      { page: 3, grade: null, mark: 'notReached' },
    ]);
    expect(dailyPages(['D', 'F'], 2).map((p) => p.mark)).toEqual(['poor', 'failed']);
    expect(dailyPages([])).toHaveLength(DAILY_PAGES);
  });
});

/** A world on a seeded page, with nothing on it yet. */
function seededWorld(seed: number, random: () => number = Math.random): World {
  const world = createWorld({ random, content: createContentSource({ keys: LETTERS }) });
  world.seed = seed;
  world.phase = 'playing';
  return world;
}

/** Spawn `count` ordinary targets one at a time, clearing the page after each; `between` runs before each. */
function spawnSequence(world: World, count: number, between: (i: number) => void = () => {}) {
  const seen: { text: string; lane: number; speed: number }[] = [];
  for (let i = 0; i < count; i++) {
    between(i);
    world.targets = [];
    const target = spawnTarget(world)!;
    world.page.spawned++;
    seen.push({ text: target.text, lane: target.lane, speed: target.speed });
    world.targets = [];
  }
  return seen;
}

describe('seeded pages', () => {
  it('bring the same creatures in the same order, however the page is played', () => {
    const calm = spawnSequence(seededWorld(1234), 8);
    // A different event stream, an ink bottle along the way and other ids don't change what comes.
    const busy = seededWorld(1234, () => 0.99);
    busy.nextId = 500;
    const messy = spawnSequence(busy, 8, (i) => {
      if (i === 3) spawnBottle(busy);
    });
    expect(messy).toEqual(calm);
  });

  it('differ from seed to seed', () => {
    expect(spawnSequence(seededWorld(1), 8)).not.toEqual(spawnSequence(seededWorld(2), 8));
  });
});

describe('startDaily', () => {
  const daily = () => {
    const world = createWorld({ content: createContentSource({ keys: LETTERS }) });
    startDaily(world, 7, 99, true);
    return world;
  };

  it('starts the Daily Page on Normal, seeded', () => {
    const world = daily();
    expect(world.mode).toBe('daily');
    expect(world.difficulty).toBe('normal');
    expect(world.seed).toBe(99);
    expect(world.daily).toEqual({ id: 7, counted: true });
    expect(world.page.chapter).toBe(GAME_CONFIG.daily.chapter);
    expect(world.page.pageCount).toBe(DAILY_PAGES);
  });

  it('ends after its last page', () => {
    const world = daily();
    expect(finishedNotebook(world)).toBe(false);
    world.phase = 'pageCleared';
    while (!finishedNotebook(world)) {
      confirm(world);
      world.phase = 'pageCleared';
    }
    expect(world.page.index).toBe(DAILY_PAGES - 1);
    confirm(world);
    expect(world.phase).toBe('notebookComplete');
  });

  it('can’t restart a page on the counted go', () => {
    const world = daily();
    world.phase = 'paused';
    expect(canRestart(world)).toBe(false);
    restartPage(world);
    expect(world.phase).toBe('paused');
    world.daily!.counted = false;
    expect(canRestart(world)).toBe(true);
  });

  it('carries a friend’s score to beat, until another notebook starts', () => {
    const world = createWorld({ content: createContentSource({ keys: LETTERS }) });
    startDaily(world, 3, 42, false, { score: 4820, name: 'Pip' });
    expect(world.challenge).toEqual({ score: 4820, name: 'Pip' });
    expect(world.daily).toEqual({ id: 3, counted: false });
    world.phase = 'ready';
    confirm(world);
    expect(world.challenge).toBeNull();
  });

  it('clears the seed when another notebook starts', () => {
    const world = daily();
    world.phase = 'ready';
    confirm(world);
    expect(world.mode).toBe('practice');
    expect(world.seed).toBeNull();
    expect(world.daily).toBeNull();
  });
});

describe('score breakdown', () => {
  it('adds up to the score', () => {
    const stats = createStats();
    earnPoints(stats, 10, 3, 2);
    earnPoints(stats, 5);
    expect(stats).toMatchObject({ score: 65, basePoints: 15, comboPoints: 20, bonusPoints: 30 });
  });

  it('matches the score after typing, mistakes included', () => {
    const world = createWorld({ random: () => 0.5, content: createContentSource({ keys: LETTERS }) });
    world.phase = 'playing';
    spawnTarget(world, { text: 'abcdefghijklmnopqrstuvwxyz', x: 600, kind: 'blotling' });
    for (const key of 'abcdefghijklmnopqrstzuvwxyz') typeChar(world, key);
    const s = world.stats;
    expect(s.errors).toBe(1);
    expect(s.comboPoints).toBeGreaterThan(0);
    expect(s.basePoints + s.comboPoints + s.bonusPoints - s.penalty).toBe(s.score);
  });
});

describe('Daily Page in another words language', () => {
  it('keeps English seeds exactly as before', () => {
    expect(dailySeed(5, 'us-qwerty', 'en')).toBe(hashSeed('daily:5:us-qwerty'));
    expect(dailySeed(5, 'us-qwerty')).toBe(dailySeed(5, 'us-qwerty', 'en'));
  });

  it('gives French its own seed and the common accents', () => {
    expect(dailySeed(5, 'fr-azerty', 'fr')).not.toBe(dailySeed(5, 'fr-azerty'));
    const keys = dailyKeys(US_QWERTY, 'fr');
    expect(keys).toEqual(expect.arrayContaining(['é', 'è', 'à', 'ù', 'ç', 'â', 'ê', 'î', 'ô', 'û']));
    expect(keys).not.toContain('ë');
    expect(dailyKeys(US_QWERTY, 'en')).toEqual(dailyKeys(US_QWERTY));
  });
});
