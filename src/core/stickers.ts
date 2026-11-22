/**
 * Stickers: achievements, kept in the notebook's sticker book. Each one has
 * a rule over plain facts about what just happened (a page cleared, the
 * Daily Page finished) and where the player stands (level, the Apprentice
 * course). Pure, so the rules are easy to test; main.ts gathers the facts
 * and saves what's earned. Thresholds are in GAME_CONFIG.stickers.
 */
import { APPRENTICE_CHAPTERS, chapterStars, type GameMode } from './campaign';
import { BOSS_KINDS, GAME_CONFIG, type BossKind, type Difficulty } from './config';
import { PASSAGES } from './fairCopy';
import { LANGUAGES } from './languages';
import type { Grade } from './grade';
import type { SeasonId } from './seasons';
import { wpm, type Stats } from './stats';

/** Which shelf of the sticker book a sticker sits on, and its color. */
export type StickerGroup = 'pages' | 'speed' | 'bosses' | 'course' | 'daily' | 'fairCopy' | 'seasons' | 'secret';

/** A page just cleared. */
export interface PageFacts {
  mode: GameMode;
  difficulty: Difficulty;
  grade: Grade;
  /** The page's own stats. */
  stats: Stats;
  /** The whole notebook's score so far. */
  notebookScore: number;
  /** The boss on this page, if it had one. */
  boss: BossKind | null;
  layoutId: string;
  /** When it was cleared (for the secret late-night sticker). */
  at: Date;
  /** The holiday season it was cleared in (core/seasons.ts: activeSeason(at)), for the holiday stickers. */
  season: SeasonId | null;
}

/** The Daily Page just finished, with its result recorded. */
export interface DailyFacts {
  grades: readonly Grade[];
  pages: number;
  finished: boolean;
  streak: number;
}

/** A Fair Copy test just finished (core/fairCopy.ts). */
export interface FairCopyFacts {
  /** A timed test's length, or null for one passage. */
  seconds: number | null;
  netWpm: number;
  /** Characters on the page at the end. */
  typed: number;
  /** Wrong keys, fixed or not. */
  errors: number;
  mistakesLeft: number;
}

/** Everything the rules look at. `page`, `daily` and `fairCopy` are only set right after those happen. */
export interface StickerFacts {
  level: number;
  apprentice: { unlocked: number; stars: Readonly<Record<string, number>>; completed: boolean };
  /** Boss kinds beaten so far (including on this page). */
  bossesBeaten: readonly BossKind[];
  /** Fair Copy passages copied out to the end so far (including just now). */
  passagesCopied: readonly string[];
  page?: PageFacts;
  daily?: DailyFacts;
  fairCopy?: FairCopyFacts;
}

export interface Sticker {
  id: string;
  group: StickerGroup;
  /** The picture on the sticker. */
  emoji: string;
  /** Not described in the book until earned. */
  secret?: boolean;
  earned(facts: StickerFacts): boolean;
}

const S = GAME_CONFIG.stickers;
const isA = (grade: Grade) => grade === 'A+' || grade === 'A';
const pageWpm = (p: PageFacts | undefined) => (p && p.stats.correct >= S.minKeys ? wpm(p.stats) : 0);
/** Net speed of a Fair Copy with enough typed to count. */
const copyWpm = (c: FairCopyFacts | undefined) => (c && c.typed >= S.minKeys ? c.netWpm : 0);

/** Every sticker, in the order the book shows them. */
export const STICKERS: readonly Sticker[] = [
  // Pages
  { id: 'firstPage', group: 'pages', emoji: '📄', earned: (f) => f.page !== undefined },
  { id: 'goldStar', group: 'pages', emoji: '⭐', earned: (f) => f.page?.grade === 'A+' },
  { id: 'onARoll', group: 'pages', emoji: '🎳', earned: (f) => (f.page?.stats.bestCombo ?? 0) >= S.combo[0]! },
  { id: 'inkRiver', group: 'pages', emoji: '🌊', earned: (f) => (f.page?.stats.bestCombo ?? 0) >= S.combo[1]! },
  { id: 'unstoppable', group: 'pages', emoji: '🚂', earned: (f) => (f.page?.stats.bestCombo ?? 0) >= S.combo[2]! },
  { id: 'fiveFigures', group: 'pages', emoji: '💯', earned: (f) => (f.page?.notebookScore ?? 0) >= S.bigScore },
  {
    id: 'cleanMargin',
    group: 'pages',
    emoji: '🛡️',
    earned: (f) => !!f.page && (f.page.difficulty === 'hard' || f.page.difficulty === 'expert') && f.page.stats.leaks === 0,
  },
  // Speed
  { id: 'quickPen', group: 'speed', emoji: '✏️', earned: (f) => pageWpm(f.page) >= S.wpm[0]! },
  { id: 'speedScribe', group: 'speed', emoji: '🏃', earned: (f) => pageWpm(f.page) >= S.wpm[1]! },
  { id: 'lightningNib', group: 'speed', emoji: '⚡', earned: (f) => pageWpm(f.page) >= S.wpm[2]! },
  // Bosses
  { id: 'firstBoss', group: 'bosses', emoji: '🐙', earned: (f) => f.bossesBeaten.length > 0 },
  {
    id: 'spotless',
    group: 'bosses',
    emoji: '🧽',
    earned: (f) => !!f.page?.boss && f.page.stats.errors === 0 && f.page.stats.leaks === 0,
  },
  { id: 'bossCollector', group: 'bosses', emoji: '🏆', earned: (f) => BOSS_KINDS.every((k) => f.bossesBeaten.includes(k)) },
  // The Apprentice course and ranks
  {
    id: 'starPupil',
    group: 'course',
    emoji: '🌟',
    earned: (f) =>
      Array.from({ length: Math.min(f.apprentice.unlocked, APPRENTICE_CHAPTERS) }, (_, ch) => chapterStars(f.apprentice.stars, ch)).some(
        (c) => c.max > 0 && c.earned === c.max,
      ),
  },
  { id: 'halfway', group: 'course', emoji: '🧭', earned: (f) => f.apprentice.unlocked > S.halfwayChapter || f.apprentice.completed },
  { id: 'graduate', group: 'course', emoji: '🎓', earned: (f) => f.apprentice.completed },
  { id: 'scribe', group: 'course', emoji: '🖋️', earned: (f) => f.level >= S.levels[0]! },
  { id: 'calligrapher', group: 'course', emoji: '📜', earned: (f) => f.level >= S.levels[1]! },
  { id: 'master', group: 'course', emoji: '👑', earned: (f) => f.level >= S.levels[2]! },
  // The Daily Page
  { id: 'dailyFirst', group: 'daily', emoji: '📅', earned: (f) => f.daily !== undefined },
  {
    id: 'perfectDay',
    group: 'daily',
    emoji: '🌈',
    earned: (f) => !!f.daily && f.daily.finished && f.daily.grades.length === f.daily.pages && f.daily.grades.every(isA),
  },
  { id: 'onFire', group: 'daily', emoji: '🔥', earned: (f) => (f.daily?.streak ?? 0) >= S.streak[0]! },
  { id: 'weekOfInk', group: 'daily', emoji: '🗓️', earned: (f) => (f.daily?.streak ?? 0) >= S.streak[1]! },
  { id: 'inkHabit', group: 'daily', emoji: '💎', earned: (f) => (f.daily?.streak ?? 0) >= S.streak[2]! },
  // Fair Copy, the typing-speed test (M31)
  { id: 'firstCopy', group: 'fairCopy', emoji: '📝', earned: (f) => f.fairCopy !== undefined },
  { id: 'neatAsPrint', group: 'fairCopy', emoji: '✒️', earned: (f) => f.fairCopy?.seconds === null && f.fairCopy.errors === 0 },
  { id: 'copyist', group: 'fairCopy', emoji: '🖊️', earned: (f) => copyWpm(f.fairCopy) >= S.fairCopyWpm[0]! },
  { id: 'swiftQuill', group: 'fairCopy', emoji: '🕊️', earned: (f) => copyWpm(f.fairCopy) >= S.fairCopyWpm[1]! },
  { id: 'printingPress', group: 'fairCopy', emoji: '🗞️', earned: (f) => copyWpm(f.fairCopy) >= S.fairCopyWpm[2]! },
  // Every passage in any one language.
  {
    id: 'bookworm',
    group: 'fairCopy',
    emoji: '📚',
    earned: (f) =>
      LANGUAGES.some((lang) => {
        const passages = PASSAGES.filter((p) => p.lang === lang);
        return passages.length > 0 && passages.every((p) => f.passagesCopied.includes(p.id));
      }),
  },
  {
    id: 'beatTheBell',
    group: 'fairCopy',
    emoji: '⏰',
    earned: (f) => f.fairCopy?.seconds === S.bellSeconds && f.fairCopy.mistakesLeft === 0 && f.fairCopy.typed >= S.minKeys,
  },
  // Holidays (M26): a page finished in season; each unlocks keepsakes for the Desk (rewards.ts).
  { id: 'harvestHelper', group: 'seasons', emoji: '🦃', earned: (f) => f.page?.season === 'thanksgiving' },
  { id: 'snowScribe', group: 'seasons', emoji: '⛄', earned: (f) => f.page?.season === 'christmas' },
  // Secrets
  {
    id: 'midnightOil',
    group: 'secret',
    emoji: '🌙',
    secret: true,
    earned: (f) => !!f.page && f.page.at.getHours() < S.lateHour,
  },
  { id: 'globetrotter', group: 'secret', emoji: '🗺️', secret: true, earned: (f) => !!f.page && f.page.layoutId !== 'us-qwerty' },
];

export const STICKER_IDS: readonly string[] = STICKERS.map((s) => s.id);

export function isStickerId(value: unknown): value is string {
  return typeof value === 'string' && STICKER_IDS.includes(value);
}

/** Stickers these facts earn that the player doesn't have yet, in book order. */
export function newStickers(facts: StickerFacts, owned: Readonly<Record<string, unknown>>): Sticker[] {
  return STICKERS.filter((s) => owned[s.id] === undefined && s.earned(facts));
}
