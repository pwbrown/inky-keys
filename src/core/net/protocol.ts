/**
 * Messages between devices playing together (REQUIREMENTS §13e), sent as
 * JSON over one WebRTC data channel. The host runs the game: guests talk only
 * to the host, and the host tells everyone what changed.
 *
 * Everything that arrives is checked here before the game sees it, the way
 * challenge and transfer links are: another device could be running a
 * different version, or not be the game at all.
 */
import type { Lobby, LobbyPlayer } from './lobby';
import type { Racer, RacerResult } from '../race';
import { LANGUAGES, type Language } from '../languages';
import { isPassageId } from '../fairCopy';

/** Bump when a message changes shape. Devices on different protocols can't play together. */
export const PROTOCOL_VERSION = 2;

/** Why a host turned a player away. */
export type RefuseReason = 'version' | 'full';

export type GuestMessage =
  | { t: 'hello'; protocol: number; app: string; name: string; badge: string }
  | { t: 'pong'; n: number; sentAt: number; guestAt: number }
  | { t: 'progress'; at: number }
  | { t: 'finish'; result: RacerResult }
  | { t: 'leaveRace' }
  | { t: 'leave' };

export type HostMessage =
  | { t: 'welcome'; you: string; lobby: Lobby }
  | { t: 'lobby'; lobby: Lobby }
  | { t: 'ping'; n: number; sentAt: number }
  | { t: 'refuse'; reason: RefuseReason; app: string }
  /** A race starts: `startAt` is on the receiving guest's clock. */
  | { t: 'race'; passageId: string; lang: Language; startAt: number; ids: string[] }
  | { t: 'standings'; racers: Racer[]; over: boolean }
  | { t: 'toLobby' }
  | { t: 'leave' };

/** The longest message accepted; a lobby of four is well under 1 KB. */
const MAX_MESSAGE_LENGTH = 16_000;

type Fields = Record<string, unknown>;

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isBadge = (v: unknown): v is string => typeof v === 'string' && /^[a-z]{1,12}$/.test(v);
const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]{1,12}$/.test(v);

function parse(data: unknown): Fields | null {
  if (typeof data !== 'string' || data.length > MAX_MESSAGE_LENGTH) return null;
  try {
    const value: unknown = JSON.parse(data);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null;
  } catch {
    return null;
  }
}

function readResult(v: unknown): RacerResult | null {
  if (v === null || typeof v !== 'object') return null;
  const { ms, netWpm, accuracy, errors } = v as Fields;
  if (!isNumber(ms) || !isNumber(netWpm) || !isNumber(accuracy) || !isNumber(errors)) return null;
  if (ms < 0 || netWpm < 0 || accuracy < 0 || accuracy > 1 || errors < 0) return null;
  return { ms, netWpm, accuracy, errors };
}

function readRacers(v: unknown): Racer[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 8) return null;
  const out: Racer[] = [];
  for (const r of v as unknown[]) {
    if (r === null || typeof r !== 'object') return null;
    const { id, at, result, left } = r as Fields;
    if (!isId(id) || !isNumber(at) || typeof left !== 'boolean') return null;
    const read = result === null ? null : readResult(result);
    if (result !== null && !read) return null;
    out.push({ id, at, result: read, left });
  }
  return out;
}

function readLobby(v: unknown): Lobby | null {
  if (v === null || typeof v !== 'object') return null;
  const players = (v as Fields).players;
  if (!Array.isArray(players) || players.length === 0 || players.length > 8) return null;
  const out: LobbyPlayer[] = [];
  for (const p of players as unknown[]) {
    if (p === null || typeof p !== 'object') return null;
    const { id, name, badge, host, rttMs } = p as Fields;
    if (!isId(id) || !isText(name, 40) || !isBadge(badge) || typeof host !== 'boolean') return null;
    if (rttMs !== null && !isNumber(rttMs)) return null;
    out.push({ id, name, badge, host, rttMs });
  }
  return { players: out };
}

/** A guest's message as the host reads it, or null if it isn't one. */
export function readGuestMessage(data: unknown): GuestMessage | null {
  const m = parse(data);
  if (!m) return null;
  switch (m.t) {
    case 'hello':
      // Read the protocol first, so a newer guest is told why rather than ignored.
      if (!isNumber(m.protocol)) return null;
      return {
        t: 'hello',
        protocol: m.protocol,
        app: isText(m.app, 20) ? m.app : '?',
        name: isText(m.name, 40) ? m.name : '',
        badge: isBadge(m.badge) ? m.badge : 'ink',
      };
    case 'pong':
      return isNumber(m.n) && isNumber(m.sentAt) && isNumber(m.guestAt) ? { t: 'pong', n: m.n, sentAt: m.sentAt, guestAt: m.guestAt } : null;
    case 'progress':
      return isNumber(m.at) && m.at >= 0 ? { t: 'progress', at: m.at } : null;
    case 'finish': {
      const result = readResult(m.result);
      return result ? { t: 'finish', result } : null;
    }
    case 'leaveRace':
      return { t: 'leaveRace' };
    case 'leave':
      return { t: 'leave' };
    default:
      return null;
  }
}

/** The host's message as a guest reads it, or null if it isn't one. */
export function readHostMessage(data: unknown): HostMessage | null {
  const m = parse(data);
  if (!m) return null;
  switch (m.t) {
    case 'welcome': {
      const lobby = readLobby(m.lobby);
      return lobby && isId(m.you) ? { t: 'welcome', you: m.you, lobby } : null;
    }
    case 'lobby': {
      const lobby = readLobby(m.lobby);
      return lobby ? { t: 'lobby', lobby } : null;
    }
    case 'ping':
      return isNumber(m.n) && isNumber(m.sentAt) ? { t: 'ping', n: m.n, sentAt: m.sentAt } : null;
    case 'refuse':
      return m.reason === 'version' || m.reason === 'full' ? { t: 'refuse', reason: m.reason, app: isText(m.app, 20) ? m.app : '?' } : null;
    case 'race': {
      const ids = Array.isArray(m.ids) && m.ids.length > 0 && m.ids.length <= 8 && m.ids.every(isId) ? (m.ids as string[]) : null;
      const lang = LANGUAGES.find((l) => l === m.lang);
      return ids && lang && isPassageId(m.passageId) && isNumber(m.startAt) ? { t: 'race', passageId: m.passageId, lang, startAt: m.startAt, ids } : null;
    }
    case 'standings': {
      const racers = readRacers(m.racers);
      return racers && typeof m.over === 'boolean' ? { t: 'standings', racers, over: m.over } : null;
    }
    case 'toLobby':
      return { t: 'toLobby' };
    case 'leave':
      return { t: 'leave' };
    default:
      return null;
  }
}

export const writeMessage = (message: GuestMessage | HostMessage): string => JSON.stringify(message);

/**
 * A round trip timed on the host's clock, and how far the guest's clock is
 * ahead of it (assuming the trip took as long each way). Countdowns use the
 * offset so everyone starts together (milestone 36).
 */
export function clockSample(sentAt: number, receivedAt: number, guestAt: number): { rttMs: number; offsetMs: number } {
  const rttMs = Math.max(0, receivedAt - sentAt);
  return { rttMs, offsetMs: guestAt - (sentAt + rttMs / 2) };
}
