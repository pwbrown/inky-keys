/**
 * The Daily Page: one short seeded notebook a day, the same for every player
 * on the same keyboard layout, so scores can be compared with friends
 * without any server. Only the first finish of the day counts; the result
 * can be copied as a short text to share (ui/dailyShare.ts).
 */
import type { KeyboardLayout } from '../content/layouts/types';
import { APPRENTICE_CHAPTERS, apprenticeKeys } from './campaign';
import { GAME_CONFIG } from './config';
import type { Grade } from './grade';
import { hashSeed } from './rng';
import { ACCENT_CHAPTERS } from './accents';
import type { Language } from './languages';

const DAY_MS = 86_400_000;

/** The Daily Page number for a moment, by the player's local calendar date. Daily #1 was GAME_CONFIG.daily.epoch. */
export function dailyId(now: Date): number {
  const { year, month, day } = GAME_CONFIG.daily.epoch;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - Date.UTC(year, month - 1, day)) / DAY_MS) + 1;
}

/**
 * The seed for a Daily Page: the same for everyone on the same layout and
 * words language. English seeds are as they always were.
 */
export function dailySeed(id: number, layoutId: string, lang: Language = 'en'): number {
  return hashSeed(lang === 'en' ? `daily:${id}:${layoutId}` : `daily:${id}:${layoutId}:${lang}`);
}

/**
 * The Daily Page uses every key the Apprentice course teaches on the layout,
 * plus the words language's common accents (the first four accent chapters:
 * not ë ï ü).
 */
export function dailyKeys(layout: KeyboardLayout, lang: Language = 'en'): string[] {
  const common = ACCENT_CHAPTERS[lang].slice(0, GAME_CONFIG.daily.accentChapters).flat();
  return [...apprenticeKeys(layout, APPRENTICE_CHAPTERS - 1), ...common];
}

/** How many pages a Daily Page has. */
export const DAILY_PAGES = GAME_CONFIG.daily.plan.length;

/** One day of the streak strip: the current week, Monday first. */
export interface StreakDay {
  /** The Daily Page number for that day. */
  id: number;
  date: Date;
  played: boolean;
  today: boolean;
  /** Later this week: not playable yet. */
  future: boolean;
}

/**
 * The week `now` falls in, Monday to Sunday, marking the days a Daily Page
 * was played (`playedIds`). No calendar needed: a row of seven boxes.
 */
export function streakWeek(now: Date, playedIds: ReadonlySet<number>): StreakDay[] {
  const todayId = dailyId(now);
  const fromMonday = (now.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const id = todayId - fromMonday + i;
    return {
      id,
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - fromMonday + i),
      played: playedIds.has(id),
      today: id === todayId,
      future: id > todayId,
    };
  });
}

/** How a page went, as a colour: good (A+ or A), fair (B), poor (C or D), failed (F), or not reached. */
export type PageMark = 'good' | 'fair' | 'poor' | 'failed' | 'notReached';

/** Each page of a Daily Page with its grade and colour, in order; pages not reached have no grade. */
export function dailyPages(grades: readonly Grade[], pages = DAILY_PAGES): { page: number; grade: Grade | null; mark: PageMark }[] {
  return Array.from({ length: pages }, (_, i) => {
    const grade = grades[i] ?? null;
    return { page: i + 1, grade, mark: markFor(grade) };
  });
}

function markFor(grade: Grade | null): PageMark {
  if (grade === null) return 'notReached';
  if (grade === 'A+' || grade === 'A') return 'good';
  if (grade === 'B') return 'fair';
  if (grade === 'C' || grade === 'D') return 'poor';
  return 'failed';
}

/** The coloured square for a page in the share text. */
export const MARK_SQUARES: Record<PageMark, string> = { good: '🟩', fair: '🟨', poor: '🟧', failed: '🟥', notReached: '⬜' };

