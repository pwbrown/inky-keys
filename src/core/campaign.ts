/**
 * The Apprentice campaign (DESIGN §4): the notebook is a typing course. Each
 * chapter teaches one or two new keys, learned like runes, on top of every
 * key from earlier chapters. Finishing the last chapter completes the
 * notebook. Practice mode keeps the free key choice and endless chapters.
 */
import type { KeyboardLayout } from '../content/layouts/types';
import { US_QWERTY } from '../content/layouts/us-qwerty';
import type { Grade } from './grade';
import { GAME_CONFIG, type BossKind, type PageParams, type TargetKind } from './config';

/**
 * The Daily Page is one short seeded notebook, the same for everyone that day (core/daily.ts).
 * An accent chapter (core/accents.ts) is one short notebook teaching a few accented letters.
 */
export type GameMode = 'apprentice' | 'practice' | 'daily' | 'accents';

export interface Lesson {
  /** Keys introduced in this chapter. */
  newKeys: string[];
}

/**
 * A layout's lessons (its `lessons` data). A beginner starts with the two
 * home keys under the index fingers (F and J on QWERTY, the keys with
 * bumps), then learns one key per chapter: the rest of the home row, space,
 * then the other letters in roughly the order typing courses teach them.
 */
export function lessonsFor(layout: KeyboardLayout): Lesson[] {
  return layout.lessons.map((keys) => ({ newKeys: [...keys] }));
}

/** Every layout has this many chapters (checked by tests). */
export const APPRENTICE_CHAPTERS = US_QWERTY.lessons.length;

/** Every key learned by the end of `chapter` (0-based), in teaching order. */
export function apprenticeKeys(layout: KeyboardLayout, chapter: number): string[] {
  return layout.lessons.slice(0, Math.min(chapter, layout.lessons.length - 1) + 1).flatMap((keys) => [...keys]);
}

/** The keys a chapter introduces. */
export function newKeysFor(layout: KeyboardLayout, chapter: number): string[] {
  return [...(layout.lessons[Math.min(chapter, layout.lessons.length - 1)] ?? [])];
}

/** First chapter (0-based) where space is known, so phrases are possible (the same on every layout). */
const SPACE_CHAPTER = US_QWERTY.lessons.findIndex((keys) => keys.includes(' '));

/**
 * Pages in an Apprentice chapter. Every chapter opens with drips, where the
 * new key comes up often, and ends with Scrawlers, from chapter 1 on. With
 * too few keys for real words, Scrawlers carry short made-up strings of the
 * keys learned so far ("fjf"), see generator.ts. Pages are only ever drips
 * or Scrawlers: Run-ons (once space is learned) are sprinkled
 * into Scrawler pages instead (GAME_CONFIG.sprinkles).
 */
export function apprenticePlan(chapter: number): TargetKind[] {
  // Every layout teaches the same number of keys per chapter.
  const keys = apprenticeKeys(US_QWERTY, chapter).length;
  if (keys <= 8) return ['drip', 'drip', 'blotling'];
  if (chapter < SPACE_CHAPTER + 6) return ['drip', 'blotling', 'drip', 'blotling'];
  // With plenty of keys, words are the main wave: one drip page to warm up
  // on the new key, then Scrawlers. (Five pages, as before, so stars line up.)
  return ['drip', 'blotling', 'blotling', 'blotling', 'blotling'];
}

/** Chapter (0-based) where space is learned. */
export { SPACE_CHAPTER };

/**
 * Hard and Expert ease in over the first Apprentice chapters: page settings
 * start partway between Normal and the chosen difficulty and reach it by
 * `profileEaseChapters`. `normal` is the same page at Normal difficulty.
 */
export function easeDifficulty(params: PageParams, normal: PageParams, chapter: number): PageParams {
  const a = GAME_CONFIG.apprentice;
  const weight = Math.min(1, a.profileEaseFloor + (1 - a.profileEaseFloor) * (chapter / a.profileEaseChapters));
  if (weight >= 1) return params;
  const mix = (n: number, d: number) => n + (d - n) * weight;
  return {
    ...params,
    speed: mix(normal.speed, params.speed),
    spawnIntervalMs: mix(normal.spawnIntervalMs, params.spawnIntervalMs),
    maxOnScreen: Math.round(mix(normal.maxOnScreen, params.maxOnScreen)),
    complexity: mix(normal.complexity, params.complexity),
    inkLoss: Math.round(mix(normal.inkLoss, params.inkLoss)),
  };
}

/**
 * Apprentice chapters are many and small, so difficulty climbs much more
 * slowly than in Practice: speed, spawn rate, word length and tougher
 * variants follow this "effective" chapter rather than the real one.
 */
export function effectiveChapter(chapter: number): number {
  return Math.floor(chapter * GAME_CONFIG.apprentice.pace);
}

/**
 * Extra-gentle settings for a beginner's first chapters: slower, sparser,
 * shorter pages, easing off over the first `easeChapters` chapters.
 */
export function easeForBeginners(params: PageParams, chapter: number): PageParams {
  const a = GAME_CONFIG.apprentice;
  const ease = Math.max(0, 1 - chapter / a.easeChapters);
  if (ease === 0) return params;
  return {
    ...params,
    speed: params.speed * (1 - a.easeSpeed * ease),
    spawnIntervalMs: params.spawnIntervalMs * (1 + a.easeInterval * ease),
    maxOnScreen: Math.max(1, params.maxOnScreen - Math.round(a.easeOnScreen * ease)),
    size: Math.max(6, Math.round(params.size * (1 - a.easeSize * ease))),
  };
}

/**
 * The boss on a chapter's last page (0-based chapter), or null before
 * bosses start. They take turns, one per chapter (GAME_CONFIG.boss.order).
 */
export function bossFor(mode: GameMode, chapter: number, turn = 0): BossKind | null {
  const b = GAME_CONFIG.boss;
  // Accent chapters are short lessons: no boss.
  if (mode === 'accents') return null;
  const from = mode === 'apprentice' ? b.fromApprenticeChapter : b.fromChapter;
  if (chapter < from) return null;
  return b.order[(chapter - from + turn) % b.order.length]!;
}

/** How much more often a chapter's new keys appear than the others. */
export const NEW_KEY_WEIGHT = 3;

/** Stars for a page grade: A+ or A earn 3, B or C earn 2, anything else 1. */
export function starsForGrade(grade: Grade): 1 | 2 | 3 {
  return grade === 'A+' || grade === 'A' ? 3 : grade === 'B' || grade === 'C' ? 2 : 1;
}

/** Key used to store a page's best stars. */
export function starKey(chapter: number, page: number): string {
  return `${chapter}-${page}`;
}

/** Stars earned in a chapter and the most possible. */
export function chapterStars(stars: Readonly<Record<string, number>>, chapter: number): { earned: number; max: number } {
  const pages = apprenticePlan(chapter).length;
  let earned = 0;
  for (let page = 0; page < pages; page++) earned += stars[starKey(chapter, page)] ?? 0;
  return { earned, max: pages * 3 };
}

/** Stars earned across the whole notebook and the most possible. */
export function totalStars(stars: Readonly<Record<string, number>>): { earned: number; max: number } {
  let earned = 0;
  let max = 0;
  for (let c = 0; c < APPRENTICE_CHAPTERS; c++) {
    const s = chapterStars(stars, c);
    earned += s.earned;
    max += s.max;
  }
  return { earned, max };
}

/** Stars as text, e.g. ★★☆ for 2 of 3. */
export function starText(earned: number, max = 3): string {
  return '★'.repeat(earned) + '☆'.repeat(Math.max(0, max - earned));
}
