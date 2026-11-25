/**
 * Ink Race (REQUIREMENTS §13e, milestone 36): 2–4 players on the same
 * network race through one Fair Copy passage. Each player types with Fair
 * Copy's rules plus `mustFix` (mistakes must be fixed), so the first to
 * finish wins. The host keeps this state and sends standings to everyone.
 *
 * Times are each racer's own: from the race's start on their clock to their
 * last key, so a small clock offset can't change who won.
 */
import { GAME_CONFIG } from './config';
import { accentMethod, howToType } from './accents';
import type { Language } from './languages';
import type { KeyboardLayout, Platform } from '../content/layouts/types';

export interface RacerResult {
  ms: number;
  netWpm: number;
  /** 0..1. */
  accuracy: number;
  errors: number;
}

export interface Racer {
  id: string;
  /** Characters typed right from the start (Fair Copy's `correctPrefix`). */
  at: number;
  result: RacerResult | null;
  left: boolean;
}

export interface Race {
  passageId: string;
  lang: Language;
  /** The passage's length in characters: the finish line. */
  length: number;
  /** When the countdown ends and typing starts, on the host's clock. */
  startAt: number;
  racers: Racer[];
}

export function createRace(passageId: string, lang: Language, length: number, startAt: number, ids: readonly string[]): Race {
  return { passageId, lang, length, startAt, racers: ids.map((id) => ({ id, at: 0, result: null, left: false })) };
}

const update = (race: Race, id: string, change: (r: Racer) => Racer): Race => ({
  ...race,
  racers: race.racers.map((r) => (r.id === id && !r.left && !r.result ? change(r) : r)),
});

export function applyProgress(race: Race, id: string, at: number): Race {
  return update(race, id, (r) => ({ ...r, at: Math.max(0, Math.min(race.length, Math.round(at))) }));
}

export function applyFinish(race: Race, id: string, result: RacerResult): Race {
  return update(race, id, (r) => ({ ...r, at: race.length, result }));
}

export function markLeft(race: Race, id: string): Race {
  return { ...race, racers: race.racers.map((r) => (r.id === id && !r.result ? { ...r, left: true } : r)) };
}

/** Finishers by time, then those still racing by progress, then those who left. */
export function standings(race: Race): Racer[] {
  const rank = (r: Racer) => (r.result ? 0 : r.left ? 2 : 1);
  return [...race.racers].sort(
    (a, b) => rank(a) - rank(b) || (a.result && b.result ? a.result.ms - b.result.ms : 0) || b.at - a.at || a.id.localeCompare(b.id),
  );
}

/** Everyone has finished or left, or the race has run its time. */
export function isOver(race: Race, now: number): boolean {
  return race.racers.every((r) => r.result || r.left) || now - race.startAt >= GAME_CONFIG.race.maxMs;
}

/**
 * Whether this player races with forgiving matching: some character in the
 * passage isn't on their own keyboard layout. Typing it the computer's way
 * (Mac Option keys, Windows' US-International setting) isn't asked for
 * mid-race, where there's no key help, so they'd be stuck on it.
 */
export function needsForgiving(text: string, layout: KeyboardLayout, platform: Platform): boolean {
  const computerMethod = accentMethod(layout, platform) !== 'layout';
  return [...new Set(text)].some((c) => {
    if (/^[\x20-\x7e\n]$/.test(c)) return false;
    return computerMethod || howToType(c, layout, platform) === null;
  });
}
