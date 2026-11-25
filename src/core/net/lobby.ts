/**
 * Who's in a game of Play together (REQUIREMENTS §13e). The host keeps the
 * lobby and sends a copy to every guest when it changes; guests only show it.
 */
import { GAME_CONFIG } from '../config';

export interface LobbyPlayer {
  /** Short and local to this game: `host`, `p1`, `p2`… */
  id: string;
  name: string;
  /** Ink-drop color (storage/profiles.ts `Badge`). */
  badge: string;
  host: boolean;
  /** The last round trip to the host, or null before the first. Always null for the host. */
  rttMs: number | null;
}

export interface Lobby {
  players: LobbyPlayer[];
}

export const HOST_ID = 'host';

export function createLobby(host: { name: string; badge: string }): Lobby {
  return { players: [{ id: HOST_ID, name: host.name, badge: host.badge, host: true, rttMs: null }] };
}

export const isFull = (lobby: Lobby): boolean => lobby.players.length >= GAME_CONFIG.net.maxPlayers;

/** A name nobody else in the lobby has: "Sam", then "Sam 2". */
function freeName(name: string, taken: readonly string[]): string {
  const lower = new Set(taken.map((n) => n.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) if (!lower.has(`${name} ${n}`.toLowerCase())) return `${name} ${n}`;
}

/** Adds a guest under a new id. `name` must already be cleaned and checked by the word filter. */
export function addPlayer(lobby: Lobby, guest: { name: string; badge: string }): { lobby: Lobby; id: string } {
  let n = 1;
  while (lobby.players.some((p) => p.id === `p${n}`)) n++;
  const id = `p${n}`;
  const name = freeName(guest.name, lobby.players.map((p) => p.name));
  return { lobby: { players: [...lobby.players, { id, name, badge: guest.badge, host: false, rttMs: null }] }, id };
}

export function removePlayer(lobby: Lobby, id: string): Lobby {
  return { players: lobby.players.filter((p) => p.id !== id || p.host) };
}

export function setRtt(lobby: Lobby, id: string, rttMs: number): Lobby {
  return { players: lobby.players.map((p) => (p.id === id ? { ...p, rttMs: Math.round(rttMs) } : p)) };
}
