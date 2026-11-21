/**
 * Bridges the running game and the save: per-key stats, records, and
 * saving/resuming a notebook. Pure functions, so they're easy to test.
 */
import { APPRENTICE_CHAPTERS, starKey, type GameMode } from '../core/campaign';
import { GAME_CONFIG, type BossKind, type Difficulty } from '../core/config';
import type { Stats } from '../core/stats';
import {
  beginPage,
  createPage,
  isLastPageOfChapter,
  markPageStart,
  resetWorld,
  useApprenticeKeys,
  type PageState,
  type World,
} from '../core/world';
import { newStickers, type StickerFacts } from '../core/stickers';
import { levelForInk } from '../core/rewards';
import type { Language } from '../core/languages';
import { fairCopyKey, type DailyProgress, type DailyResult, type FairCopyBest, type KeyStat, type SaveData, type SavedNotebook } from './schema';

/** Add a page's (or notebook's) per-key hits and misses to the saved totals. */
export function mergeKeyStats(save: SaveData, stats: Pick<Stats, 'hitKeys' | 'missedKeys'>): void {
  const stat = (ch: string): KeyStat => (save.keyStats[ch] ??= { hits: 0, misses: 0 });
  for (const [ch, n] of Object.entries(stats.hitKeys)) stat(ch).hits += n;
  for (const [ch, n] of Object.entries(stats.missedKeys)) stat(ch).misses += n;
}

/** Update best score and furthest chapter. Returns true for a new best score. */
export function recordResult(save: SaveData, difficulty: Difficulty, score: number, chapter: number): boolean {
  const { bestScore, furthestChapter } = save.records;
  furthestChapter[difficulty] = Math.max(furthestChapter[difficulty] ?? 0, chapter);
  if (score > (bestScore[difficulty] ?? 0)) {
    bestScore[difficulty] = score;
    return true;
  }
  return false;
}

/** The page after this one: the next page, or the first page of the next chapter. */
export function nextPagePosition(page: PageState): { chapter: number; page: number } {
  return isLastPageOfChapter(page) ? { chapter: page.chapter + 1, page: 0 } : { chapter: page.chapter, page: page.index + 1 };
}

/**
 * Snapshot a notebook so it can be continued from the start of a page.
 * `at` defaults to the current page; pass the next page once one is cleared.
 */
export function snapshotNotebook(
  world: World,
  at: { chapter: number; page: number } = { chapter: world.page.chapter, page: world.page.index },
  now = new Date(),
  /** Ink and stats to record; defaults to the current ones. */
  from: { ink: number; stats: World['stats'] } = { ink: world.ink, stats: world.stats },
): SavedNotebook {
  const s = from.stats;
  return {
    mode: world.mode,
    difficulty: world.difficulty,
    chapter: at.chapter,
    page: at.page,
    ink: from.ink,
    score: s.score,
    correct: s.correct,
    errors: s.errors,
    destroyed: s.destroyed,
    bestCombo: s.bestCombo,
    playMs: s.playMs,
    charges: world.charges,
    eraser: world.eraser,
    shield: world.shield,
    savedAt: now.toISOString(),
  };
}

/** Resume a saved notebook at the start of its page. */
export function continueNotebook(world: World, saved: SavedNotebook): void {
  resetWorld(world, saved.difficulty);
  world.mode = saved.mode;
  if (saved.mode === 'apprentice') useApprenticeKeys(world, saved.chapter);
  world.page = createPage(saved.difficulty, saved.chapter, saved.page, world.content, saved.mode);
  world.ink = Math.min(world.maxInk, Math.max(1, saved.ink));
  Object.assign(world.stats, {
    score: saved.score,
    correct: saved.correct,
    errors: saved.errors,
    destroyed: saved.destroyed,
    bestCombo: saved.bestCombo,
    playMs: saved.playMs,
  });
  world.charges = Math.min(GAME_CONFIG.abilities.maxCharges, saved.charges);
  world.eraser = saved.eraser && world.abilities.includes('eraser');
  world.shield = saved.shield && world.abilities.includes('blottingPaper');
  markPageStart(world);
  // Mid-chapter, "Retry chapter" goes back to this resume point.
  if (saved.page > 0) world.chapterStart = structuredClone(world.pageStart);
  beginPage(world);
}

/**
 * How much more often to show each key as a drip: keys you miss more come up
 * more (REQUIREMENTS §6, "weight toward most-missed keys"). A key you've
 * never missed has weight 1; a key you miss half the time gets about 3.
 */
export function keyWeights(keyStats: Readonly<Record<string, KeyStat>>, keys: readonly string[]): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const key of keys) {
    const stat = keyStats[key];
    // The +5 keeps a couple of early misses from swinging things wildly.
    const missRate = stat ? stat.misses / (stat.hits + stat.misses + 5) : 0;
    weights[key] = 1 + 4 * missRate;
  }
  return weights;
}

/**
 * Record a cleared Apprentice page: keep the best stars for it, and open the
 * next chapter once a chapter's last page is cleared.
 */
export function recordApprenticePage(save: SaveData, chapter: number, page: number, stars: 1 | 2 | 3, lastPage: boolean): void {
  const key = starKey(chapter, page);
  save.apprentice.stars[key] = Math.max(save.apprentice.stars[key] ?? 0, stars);
  if (lastPage) {
    save.apprentice.unlocked = Math.min(APPRENTICE_CHAPTERS, Math.max(save.apprentice.unlocked, chapter + 2));
    if (chapter >= APPRENTICE_CHAPTERS - 1) save.apprentice.completed = true;
  }
}

/** The key a page's best score is kept under (Records.pageBest). */
export function pageBestKey(mode: GameMode, difficulty: Difficulty, chapter: number, page: number): string {
  return `${mode}:${difficulty}:${starKey(chapter, page)}`;
}

/** Keep a page's best score. Returns the best before this one (0 if none) and whether this beat it. */
export function recordPageBest(save: SaveData, key: string, score: number): { previous: number; isNew: boolean } {
  const previous = save.records.pageBest[key] ?? 0;
  const isNew = score > previous;
  if (isNew) save.records.pageBest[key] = score;
  return { previous, isNew };
}

/** An Apprentice chapter's best score: its pages' best scores added up, or null before any page is cleared. */
export function chapterBest(save: Readonly<SaveData>, difficulty: Difficulty, chapter: number, pages: number): number | null {
  let total = 0;
  let any = false;
  for (let page = 0; page < pages; page++) {
    const best = save.records.pageBest[pageBestKey('apprentice', difficulty, chapter, page)];
    if (best !== undefined) {
      total += best;
      any = true;
    }
  }
  return any ? total : null;
}

/** The streak as it stands on Daily Page `today`: kept if the last one played was today or yesterday. */
export function currentStreak(daily: Readonly<DailyProgress>, today: number): number {
  return daily.lastId !== null && today - daily.lastId <= 1 ? daily.streak : 0;
}

/**
 * Record the day's Daily Page result. Only the first result for a day
 * counts: returns false (and changes nothing) if `id` already has one.
 */
export function recordDaily(save: SaveData, id: number, result: DailyResult): boolean {
  const daily = save.daily;
  if (daily.results[id] !== undefined) return false;
  daily.streak = daily.lastId === id - 1 ? daily.streak + 1 : daily.lastId === id ? daily.streak : 1;
  daily.lastId = Math.max(daily.lastId ?? 0, id);
  daily.bestStreak = Math.max(daily.bestStreak, daily.streak);
  daily.best = Math.max(daily.best, result.score);
  daily.results[id] = result;
  const ids = Object.keys(daily.results).map(Number).sort((a, b) => b - a);
  for (const old of ids.slice(GAME_CONFIG.daily.keepResults)) delete daily.results[old];
  return true;
}

/**
 * Count a finished Fair Copy test and keep it if it's the best of its kind
 * (net speed). Returns the best before it, if any, and whether this beat it.
 */
export function recordFairCopy(
  save: SaveData,
  seconds: number | null,
  result: { netWpm: number; accuracy: number },
  now = new Date(),
  /** The passage copied out to the end, for a whole-passage test. */
  passageId: string | null = null,
  /** The words language of the test: bests are kept per language. */
  lang: Language = 'en',
): { previous: FairCopyBest | null; isNew: boolean } {
  if (passageId !== null && !save.fairCopy.copied.includes(passageId)) save.fairCopy.copied.push(passageId);
  const key = fairCopyKey(seconds, lang);
  const previous = save.fairCopy.best[key] ?? null;
  save.fairCopy.tests++;
  const isNew = result.netWpm > 0 && (previous === null || result.netWpm > previous.wpm);
  if (isNew) save.fairCopy.best[key] = { wpm: result.netWpm, accuracy: result.accuracy, at: now.toISOString() };
  return { previous, isNew };
}

/** What the sticker rules need from the save, plus what just happened. */
export function stickerFacts(save: Readonly<SaveData>, extra: Pick<StickerFacts, 'page' | 'daily' | 'fairCopy'> = {}): StickerFacts {
  return {
    level: levelForInk(save.profile.ink),
    apprentice: save.apprentice,
    bossesBeaten: save.stickers.bossesBeaten,
    passagesCopied: save.fairCopy.copied,
    ...extra,
  };
}

/** Give any stickers the facts earn. Returns their ids, newest marked unseen. */
export function awardStickers(save: SaveData, facts: StickerFacts, now = new Date()): string[] {
  const fresh = newStickers(facts, save.stickers.earned).map((s) => s.id);
  for (const id of fresh) save.stickers.earned[id] = now.toISOString();
  save.stickers.unseen = [...new Set([...save.stickers.unseen, ...fresh])];
  return fresh;
}

/** Remember a boss kind as beaten. */
export function recordBossBeaten(save: SaveData, boss: BossKind): void {
  if (!save.stickers.bossesBeaten.includes(boss)) save.stickers.bossesBeaten.push(boss);
}
