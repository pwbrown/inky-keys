/**
 * Every Inky Keys release, newest first, and the rules for which notes a
 * player sees. See docs/RELEASING.md for how versions are chosen.
 *
 * Notes describe only what changes the game for a player. Everything else
 * (fixes, tuning, code, docs) is summed up by `fixes: true` as one
 * "Bug fixes and small improvements" line.
 *
 * Kept free of DOM and runtime imports so scripts/tag-release.ts can read it
 * with plain Node.
 */
import type { MessageKey } from '../i18n/en';

export interface Release {
  /** Semantic version, without a leading "v" (the git tag is `v<version>`). */
  version: string;
  /** Release day, YYYY-MM-DD. */
  date: string;
  /** One short line each, for players. Empty for a fixes-only release. */
  notes: readonly MessageKey[];
  /** Also show "Bug fixes and small improvements". */
  fixes?: boolean;
}

export const RELEASES: readonly Release[] = [
  {
    version: '2.34.0',
    date: '2026-11-27',
    notes: ['release.2.34.0.qr'],
  },
  {
    version: '2.33.0',
    date: '2026-11-24',
    notes: ['release.2.33.0.race'],
    fixes: true,
  },
  {
    version: '2.32.0',
    date: '2026-11-24',
    notes: ['release.2.32.0.together'],
  },
  {
    version: '2.31.1',
    date: '2026-11-24',
    notes: [],
    fixes: true,
  },
  {
    version: '2.31.0',
    date: '2026-11-24',
    notes: ['release.2.31.0.settings', 'release.2.31.0.language', 'release.2.31.0.catchUp', 'release.2.31.0.topicWords'],
    fixes: true,
  },
  {
    version: '2.30.0',
    date: '2026-11-21',
    notes: ['release.2.30.0.spanish', 'release.2.30.0.accents', 'release.2.30.0.marks'],
    fixes: true,
  },
  {
    version: '2.29.0',
    date: '2026-11-21',
    notes: ['release.2.29.0.french', 'release.2.29.0.accents', 'release.2.29.0.help', 'release.2.29.0.forgiving'],
    fixes: true,
  },
  {
    version: '2.28.0',
    date: '2026-11-20',
    notes: ['release.2.28.0.layouts', 'release.2.28.0.keys', 'release.2.28.0.powers'],
    fixes: true,
  },
  {
    version: '2.27.0',
    date: '2026-11-20',
    notes: ['release.2.27.0.passages', 'release.2.27.0.enter', 'release.2.27.0.page'],
  },
  {
    version: '2.26.2',
    date: '2026-11-20',
    notes: ['release.2.26.2.howTo'],
  },
  {
    version: '2.26.1',
    date: '2026-11-20',
    notes: ['release.2.26.1.howTo'],
  },
  {
    version: '2.26.0',
    date: '2026-11-20',
    notes: ['release.2.26.0.bookworm'],
  },
  {
    version: '2.25.0',
    date: '2026-11-20',
    notes: ['release.2.25.0.fairCopyBests'],
  },
  {
    version: '2.24.0',
    date: '2026-11-20',
    notes: ['release.2.24.0.fairCopyStickers'],
  },
  {
    version: '2.23.0',
    date: '2026-11-20',
    notes: ['release.2.23.0.fairCopy'],
  },
  {
    version: '2.22.0',
    date: '2026-11-19',
    notes: ['release.2.22.0.capitals', 'release.2.22.0.steady'],
  },
  {
    version: '2.21.2',
    date: '2026-11-19',
    notes: ['release.2.21.2.nightEyes'],
  },
  {
    version: '2.21.1',
    date: '2026-11-19',
    notes: [],
    fixes: true,
  },
  {
    version: '2.21.0',
    date: '2026-11-19',
    notes: ['release.2.21.0.nudgeSetting'],
  },
  {
    version: '2.20.0',
    date: '2026-11-19',
    notes: ['release.2.20.0.letters', 'release.2.20.0.more', 'release.2.20.0.keyboard'],
  },
  {
    version: '2.19.1',
    date: '2026-11-19',
    notes: ['release.2.19.1.sooner'],
    fixes: true,
  },
  {
    version: '2.19.0',
    date: '2026-11-19',
    notes: ['release.2.19.0.faster'],
  },
  {
    version: '2.18.0',
    date: '2026-11-19',
    notes: ['release.2.18.0.pages'],
    fixes: true,
  },
  {
    version: '2.17.0',
    date: '2026-11-19',
    notes: ['release.2.17.0.holidays', 'release.2.17.0.words', 'release.2.17.0.keepsakes'],
  },
  {
    version: '2.16.1',
    date: '2026-11-18',
    notes: [],
    fixes: true,
  },
  {
    version: '2.16.0',
    date: '2026-11-18',
    notes: ['release.2.16.0.scribe', 'release.2.16.0.blots'],
  },
  {
    version: '2.15.0',
    date: '2026-11-18',
    notes: ['release.2.15.0.wikipedia'],
  },
  {
    version: '2.14.0',
    date: '2026-11-17',
    notes: ['release.2.14.0.menu', 'release.2.14.0.squid', 'release.2.14.0.keys', 'release.2.14.0.cards'],
    fixes: true,
  },
  {
    version: '2.13.0',
    date: '2026-11-17',
    notes: ['release.2.13.0.transfer'],
  },
  {
    version: '2.12.0',
    date: '2026-11-17',
    notes: ['release.2.12.0.challenges', 'release.2.12.0.picture'],
  },
  {
    version: '2.11.0',
    date: '2026-11-17',
    notes: ['release.2.11.0.stickers'],
  },
  {
    version: '2.10.0',
    date: '2026-11-17',
    notes: ['release.2.10.0.daily', 'release.2.10.0.points'],
  },
  {
    version: '2.9.0',
    date: '2026-11-16',
    notes: ['release.2.9.0.bosses', 'release.2.9.0.earlier'],
    fixes: true,
  },
  {
    version: '2.8.0',
    date: '2026-11-16',
    notes: ['release.2.8.0.zoom', 'release.2.8.0.words', 'release.2.8.0.symbols', 'release.2.8.0.powers'],
  },
  {
    version: '2.7.0',
    date: '2026-11-16',
    notes: ['release.2.7.0.freeWrite', 'release.2.7.0.misprints', 'release.2.7.0.menu', 'release.2.7.0.howTo'],
    fixes: true,
  },
  {
    version: '2.6.0',
    date: '2026-11-16',
    notes: ['release.2.6.0.name', 'release.2.6.0.icon', 'release.2.6.0.notes'],
    fixes: true,
  },
  {
    version: '2.5.0',
    date: '2026-11-14',
    notes: ['release.2.5.0.layouts'],
  },
  {
    version: '2.4.0',
    date: '2026-11-14',
    notes: ['release.2.4.0.feel', 'release.2.4.0.mistakes', 'release.2.4.0.powers', 'release.2.4.0.tips'],
  },
  {
    version: '2.3.0',
    date: '2026-11-13',
    notes: ['release.2.3.0.filter', 'release.2.3.0.words', 'release.2.3.0.hands', 'release.2.3.0.typewriter'],
    fixes: true,
  },
  { version: '2.2.1', date: '2026-11-13', notes: ['release.2.2.1.gentler'], fixes: true },
  {
    version: '2.2.0',
    date: '2026-11-13',
    notes: ['release.2.2.0.players', 'release.2.2.0.mixed', 'release.2.2.0.looks', 'release.2.2.0.desk'],
  },
  { version: '2.1.1', date: '2026-11-12', notes: ['release.2.1.1.gentler'], fixes: true },
  {
    version: '2.1.0',
    date: '2026-11-12',
    notes: ['release.2.1.0.ink', 'release.2.1.0.desk', 'release.2.1.0.spill'],
  },
  {
    version: '2.0.0',
    date: '2026-11-12',
    notes: ['release.2.0.0.apprentice', 'release.2.0.0.stars', 'release.2.0.0.practice'],
  },
  {
    version: '1.4.0',
    date: '2026-11-12',
    notes: ['release.1.4.0.alive', 'release.1.4.0.variants'],
  },
  {
    version: '1.3.0',
    date: '2026-11-12',
    notes: ['release.1.3.0.font', 'release.1.3.0.runons'],
  },
  {
    version: '1.2.0',
    date: '2026-11-12',
    notes: ['release.1.2.0.menu', 'release.1.2.0.pause'],
  },
  {
    version: '1.1.0',
    date: '2026-11-12',
    notes: ['release.1.1.0.runons', 'release.1.1.0.misprints', 'release.1.1.0.words'],
  },
  {
    version: '1.0.0',
    date: '2026-11-12',
    notes: ['release.1.0.0.grades', 'release.1.0.0.settings'],
  },
  { version: '0.6.0', date: '2026-11-12', notes: ['release.0.6.0.saves'] },
  { version: '0.5.0', date: '2026-11-12', notes: ['release.0.5.0.typeCase'] },
  { version: '0.4.0', date: '2026-11-12', notes: ['release.0.4.0.chapters'] },
  { version: '0.3.0', date: '2026-11-12', notes: ['release.0.3.0.words'] },
  { version: '0.2.0', date: '2026-11-12', notes: ['release.0.2.0.drips'] },
  { version: '0.1.0', date: '2026-11-12', notes: ['release.0.1.0.first'] },
];

/** The most notes the update card shows at once; older new releases go under "Earlier updates". */
export const MAX_NEW_RELEASES_SHOWN = 3;

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function isVersion(value: unknown): value is string {
  return typeof value === 'string' && SEMVER.test(value);
}

/** Negative if a < b, 0 if equal, positive if a > b. Invalid versions sort lowest. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => SEMVER.exec(v)?.slice(1).map(Number) ?? [-1, -1, -1];
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function findRelease(version: string, releases: readonly Release[] = RELEASES): Release | undefined {
  return releases.find((r) => r.version === version);
}

/**
 * Releases to announce when the game starts, newest first.
 *
 * - `lastSeen` is the version this browser last ran, or null if it never
 *   recorded one (a new player, or someone who last played before the game
 *   kept track).
 * - `returning` says whether there's sign of earlier play. A returning
 *   player with no `lastSeen` gets just the current release's notes; a brand
 *   new player gets nothing, since every feature is new to them.
 */
export function releasesToAnnounce(
  lastSeen: string | null,
  current: string,
  returning: boolean,
  releases: readonly Release[] = RELEASES,
): Release[] {
  if (lastSeen === null || !isVersion(lastSeen)) {
    const latest = findRelease(current, releases);
    return returning && latest ? [latest] : [];
  }
  return releases.filter((r) => compareVersions(r.version, lastSeen) > 0 && compareVersions(r.version, current) <= 0);
}
