/**
 * Word pool: the bundled word list filtered down to words the player can
 * type with their selected keys, ranked from easy to hard (REQUIREMENTS §6).
 */
import { GAME_CONFIG } from '../core/config';

export interface WordEntry {
  word: string;
  /** Frequency tier from the source list. 0 = most common. */
  tier: number;
}

export interface RankedWord extends WordEntry {
  /** 0 (easiest) to 1 (hardest). */
  difficulty: number;
}

/** Letters that are rarer and usually harder to reach. */
const RARE = new Set(['q', 'x', 'z', 'j', 'k', 'v', 'w', 'y', 'b', 'p']);

/** Expand a word pack's space-separated tiers into entries. */
export function entriesFromTiers(tiers: readonly string[]): WordEntry[] {
  return tiers.flatMap((line, tier) => (line ? line.split(' ').map((word) => ({ word, tier })) : []));
}

/** True if every character of `word` is in `keys`. */
export function typeableWith(word: string, keys: ReadonlySet<string>): boolean {
  for (const ch of word) if (!keys.has(ch)) return false;
  return true;
}

/** Extra key presses a character takes beyond one (core/accents.ts `extraPresses`), weighted. */
export type PressCost = (ch: string) => number;
const noExtraPresses: PressCost = () => 0;

/**
 * Difficulty from length, rarity of the word, and rare letters. Weights are
 * deliberately simple; tune them here.
 */
export function wordDifficulty(entry: WordEntry, maxTier: number, pressCost: PressCost = noExtraPresses): number {
  // Length in key presses: an accent that takes two presses (^ then e) counts as more.
  const letters = [...entry.word];
  const presses = letters.reduce((sum, ch) => sum + 1 + pressCost(ch) * GAME_CONFIG.accents.pressWeight, 0);
  const length = Math.min(1, Math.max(0, (presses - 2) / 8));
  const tier = maxTier > 0 ? entry.tier / maxTier : 0;
  let rare = 0;
  for (const ch of letters) if (RARE.has(ch)) rare++;
  const rareShare = rare / letters.length;
  return 0.55 * length + 0.3 * tier + 0.15 * rareShare;
}

/** Words typeable with `keys`, sorted easiest first. */
export function buildWordPool(entries: readonly WordEntry[], keys: Iterable<string>, pressCost?: PressCost): RankedWord[] {
  const keySet = new Set(keys);
  const maxTier = entries.reduce((max, e) => Math.max(max, e.tier), 0);
  return entries
    .filter((e) => typeableWith(e.word, keySet))
    .map((e) => ({ ...e, difficulty: wordDifficulty(e, maxTier, pressCost) }))
    .sort((a, b) => a.difficulty - b.difficulty || a.word.localeCompare(b.word));
}

/**
 * Pick a word near the requested difficulty (0..1). Picks from a window
 * around that point in the ranked pool, so easy pages get easy words but
 * there's still variety.
 */
export function pickWord(pool: readonly RankedWord[], difficulty: number, random: () => number): string | null {
  if (pool.length === 0) return null;
  const d = Math.min(1, Math.max(0, difficulty));
  const window = Math.max(1, Math.min(pool.length, Math.max(12, Math.round(pool.length * 0.25))));
  const center = Math.round(d * (pool.length - 1));
  const start = Math.min(Math.max(0, center - Math.floor(window / 2)), pool.length - window);
  return pool[start + Math.floor(random() * window)]?.word ?? null;
}
