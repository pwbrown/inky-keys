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

/** Bump when a message changes shape. Devices on different protocols can't play together. */
export const PROTOCOL_VERSION = 1;

/** Why a host turned a player away. */
export type RefuseReason = 'version' | 'full';

export type GuestMessage =
  | { t: 'hello'; protocol: number; app: string; name: string; badge: string }
  | { t: 'pong'; n: number; sentAt: number; guestAt: number }
  | { t: 'leave' };

export type HostMessage =
  | { t: 'welcome'; you: string; lobby: Lobby }
  | { t: 'lobby'; lobby: Lobby }
  | { t: 'ping'; n: number; sentAt: number }
  | { t: 'refuse'; reason: RefuseReason; app: string }
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
