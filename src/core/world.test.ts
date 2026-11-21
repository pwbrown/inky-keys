import { describe, expect, it } from 'vitest';
import { createContentSource } from '../content/contentSource';
import { GAME_CONFIG } from './config';
import {
  MARGIN_X,
  accentPaced,
  SPAWN_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createPage,
  createWorld,
  estimateWidth,
  laneCount,
  laneY,
  renderX,
  setContent,
  switchKeys,
  spawnTarget,
  stepWorld,
  type World,
} from './world';

/** Deterministic stand-in for Math.random. */
const fixedRandom = (value: number) => () => value;

function playingWorld(random = fixedRandom(0.5)): World {
  const world = createWorld({ random, keys: ['a', 'b', 'c'] });
  world.phase = 'playing';
  return world;
}

describe('world', () => {
  it('starts on the ready screen with a full ink well and no targets', () => {
    const world = createWorld();
    expect(world.phase).toBe('ready');
    expect(world.ink).toBe(GAME_CONFIG.maxInk);
    expect(world.targets).toHaveLength(0);
  });

  it('does not simulate unless playing', () => {
    const world = createWorld();
    stepWorld(world, 1000);
    expect(world.targets).toHaveLength(0);
    expect(world.stats.playMs).toBe(0);
  });

  it('places every lane inside the page', () => {
    for (let lane = 0; lane < laneCount(); lane++) {
      expect(laneY(lane)).toBeGreaterThan(0);
      expect(laneY(lane)).toBeLessThan(WORLD_HEIGHT);
    }
  });

  it('spawns a drip from the key set on the first step', () => {
    const world = playingWorld();
    stepWorld(world, 16);
    expect(world.targets).toHaveLength(1);
    const [drip] = world.targets;
    expect(drip?.kind).toBe('drip');
    expect(['a', 'b', 'c']).toContain(drip?.text);
    expect(world.page.spawned).toBe(1);
  });

  it('waits the spawn interval between targets', () => {
    const world = playingWorld();
    stepWorld(world, 16);
    const interval = world.page.params.spawnIntervalMs;
    stepWorld(world, interval - 32);
    expect(world.targets).toHaveLength(1);
    stepWorld(world, 32);
    expect(world.targets).toHaveLength(2);
  });

  it('never spawns two targets on top of each other in one lane', () => {
    const world = playingWorld();
    for (let i = 0; i < laneCount(); i++) expect(spawnTarget(world)).not.toBeNull();
    expect(new Set(world.targets.map((t) => t.lane)).size).toBe(laneCount());
    // Every lane is busy now.
    expect(spawnTarget(world)).toBeNull();
  });

  it('moves targets left at their speed and interpolates between steps', () => {
    const world = playingWorld();
    const target = spawnTarget(world, { speed: 100, entering: false })!;
    world.page.spawned = world.page.params.size; // stop the spawner
    stepWorld(world, 500);
    expect(target.x).toBeCloseTo(SPAWN_X - 50);
    expect(target.prevX).toBeCloseTo(SPAWN_X);
    expect(renderX(target, 0.5)).toBeCloseTo(SPAWN_X - 25);
  });

  it('rushes a new target in until its whole word is on the page, then slows to its own speed', () => {
    const world = playingWorld();
    world.page.spawned = world.page.params.size; // stop the spawner
    const target = spawnTarget(world, { kind: 'blotling', text: 'inkwells', speed: 50 })!;
    expect(target.entering).toBe(true);
    const fullyIn = WORLD_WIDTH - GAME_CONFIG.entry.marginPx - estimateWidth(target, world.targetScale);
    // Under a second, where its own speed would take over 5 seconds.
    let ms = 0;
    while (target.entering && ms < 3000) {
      stepWorld(world, 16);
      ms += 16;
    }
    expect(target.entering).toBe(false);
    expect(ms).toBeLessThan(1000);
    expect(target.x).toBeLessThanOrEqual(fullyIn + 1);
    expect(target.x).toBeGreaterThan(fullyIn - 20);
    const before = target.x;
    stepWorld(world, 100);
    expect(before - target.x).toBeCloseTo(5);
  });

  it('never rushes into the target ahead in its lane', () => {
    const world = playingWorld();
    world.page.spawned = world.page.params.size;
    const ahead = spawnTarget(world, { kind: 'blotling', text: 'ink', x: 1150, prevX: 1150, lane: 0, speed: 20 })!;
    const behind = spawnTarget(world, { kind: 'blotling', text: 'penholders', lane: 0, speed: 20 })!;
    for (let i = 0; i < 60; i++) {
      stepWorld(world, 16);
      expect(behind.x).toBeGreaterThanOrEqual(ahead.x + estimateWidth(ahead, world.targetScale) + GAME_CONFIG.entry.gapPx - 0.01);
    }
  });

  it('uses every other line when laneStep is 2', () => {
    expect(laneCount(2)).toBe(Math.floor(laneCount() / 2));
    expect(laneY(1, 2)).toBe(laneY(2));
    const world = playingWorld();
    world.laneStep = 2;
    const target = spawnTarget(world)!;
    expect((target.y - laneY(0)) % (2 * (laneY(1) - laneY(0)))).toBe(0);
  });

  it('counts targets that reach the margin', () => {
    const world = playingWorld();
    spawnTarget(world, { x: MARGIN_X + 1, speed: 1000 });
    stepWorld(world, 16);
    expect(world.stats.leaks).toBe(1);
    expect(world.pageStats.leaks).toBe(1);
  });

  it('drains ink, breaks the combo and drops the lock when a target reaches the margin', () => {
    const world = playingWorld();
    const target = spawnTarget(world, { x: MARGIN_X + 1, speed: 1000 })!;
    world.lockedId = target.id;
    world.stats.combo = 7;

    stepWorld(world, 16);

    expect(world.ink).toBe(GAME_CONFIG.maxInk - world.page.params.inkLoss);
    expect(world.stats.combo).toBe(0);
    expect(world.lockedId).toBeNull();
    expect(world.targets).not.toContain(target);
    expect(world.events).toContainEqual(expect.objectContaining({ type: 'marginHit' }));
  });

  it('ends the game when the ink runs out', () => {
    const world = playingWorld();
    world.ink = 5;
    spawnTarget(world, { x: MARGIN_X + 1, speed: 1000 });
    stepWorld(world, 16);
    expect(world.ink).toBe(0);
    expect(world.phase).toBe('gameOver');
  });

  it('clears the page once every target has been spawned and dealt with', () => {
    const world = playingWorld();
    world.ink = 50;
    world.page.spawned = world.page.params.size;
    stepWorld(world, 16);
    expect(world.phase).toBe('pageCleared');
    // Not the end of a chapter, so no refill.
    expect(world.ink).toBe(50);
  });

  it('refills some ink at the end of a chapter, up to the maximum', () => {
    const world = playingWorld();
    world.page = createPage(world.difficulty, 0, world.page.pageCount - 1);
    world.page.spawned = world.page.params.size;
    world.ink = 50;
    stepWorld(world, 16);
    const refill = Math.round(GAME_CONFIG.maxInk * GAME_CONFIG.chapterInkRefill);
    expect(world.ink).toBe(50 + refill);
    expect(world.inkRefilled).toBe(refill);

    const full = playingWorld();
    full.page = createPage(full.difficulty, 0, full.page.pageCount - 1);
    full.page.spawned = full.page.params.size;
    full.ink = full.maxInk - 5;
    stepWorld(full, 16);
    expect(full.ink).toBe(full.maxInk);
    expect(full.inkRefilled).toBe(5);
  });

  it('uses the difficulty for page settings', () => {
    const relaxed = createWorld({ difficulty: 'relaxed' });
    const expert = createWorld({ difficulty: 'expert' });
    expect(expert.page.params.speed).toBeGreaterThan(relaxed.page.params.speed);
  });

  it('never lets a target overtake the one ahead of it in its lane', () => {
    const world = playingWorld();
    const leader = spawnTarget(world, { lane: 3, speed: 50 })!;
    leader.x = 600;
    const follower = spawnTarget(world, { lane: 3 })!;
    expect(follower.speed).toBeLessThanOrEqual(leader.speed);
  });

  it('prefers a first character no other target on the page starts with', () => {
    let i = 0;
    const world = createWorld({ random: () => [0, 0, 0.5, 0.9][i++ % 4]!, keys: ['a', 'b'] });
    world.phase = 'playing';
    spawnTarget(world, { text: 'a', lane: 0, x: 600 });
    const next = spawnTarget(world)!;
    expect(next.text).toBe('b');
  });

  it('only changes keys on the new-notebook screen', () => {
    const world = createWorld({ keys: ['a'] });
    setContent(world, createContentSource({ keys: ['1', '2'] }));
    expect(world.keys).toEqual(['1', '2']);

    world.phase = 'playing';
    setContent(world, createContentSource({ keys: ['x'] }));
    expect(world.keys).toEqual(['1', '2']);
  });

  it('switches keys between pages, never mid-page', () => {
    const world = createWorld({ keys: ['a'] });
    world.phase = 'playing';
    switchKeys(world, createContentSource({ keys: ['x'] }));
    expect(world.keys).toEqual(['a']);
    world.phase = 'pageCleared';
    switchKeys(world, createContentSource({ keys: ['x', 'y'] }));
    expect(world.keys).toEqual(['x', 'y']);
  });

  it('counts play time on both the notebook and the page', () => {
    const world = playingWorld();
    stepWorld(world, 100);
    expect(world.stats.playMs).toBe(100);
    expect(world.pageStats.playMs).toBe(100);
  });
});

describe('drip pools', () => {
  const page = (keys: string[], index: number) => createPage('normal', 0, index, createContentSource({ keys }));

  it('gives digits and symbols their own drip page, apart from letters', () => {
    const keys = [...'abcdefghij', ...'1234567890', '!', '?'];
    const pages = Array.from({ length: page(keys, 0).pageCount }, (_, i) => page(keys, i).params);
    expect(pages.filter((p) => p.kind === 'drip').map((p) => p.pool).sort()).toEqual(['letters', 'symbols']);
    const content = createContentSource({ keys });
    for (let i = 0; i < 200; i++) {
      expect(content.nextChar(Math.random, 'letters')).toMatch(/^[a-j]$/);
      expect(content.nextChar(Math.random, 'symbols')).toMatch(/^[0-9!?]$/);
    }
  });

  it('drops the symbol page and mixes a stray symbol in when there are only one or two', () => {
    const keys = [...'asdfghjkl;'];
    const first = page(keys, 0);
    expect(first.pageCount).toBe(GAME_CONFIG.chapters[0]!.filter((k) => k !== 'symbols').length);
    for (let i = 0; i < first.pageCount; i++) expect(page(keys, i).params.pool).toBe('all');
  });
});


describe('accent pacing', () => {
  it('gives a creature longer to cross for each extra key press', () => {
    expect(accentPaced(100, 0)).toBe(100);
    const slower = accentPaced(100, 2);
    expect(slower).toBeLessThan(100);
    const distance = SPAWN_X - MARGIN_X;
    expect(distance / slower - distance / 100).toBeCloseTo(2 * GAME_CONFIG.accents.slowdownSecPerPress);
  });
});
