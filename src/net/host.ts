/**
 * The host's side of Play together (REQUIREMENTS §13e): keeps the lobby,
 * makes one invite at a time, checks every player with pings (round trip and
 * clock offset), and tells everyone when something changes.
 */
import { GAME_CONFIG } from '../core/config';
import { HOST_ID, addPlayer, createLobby, isFull, removePlayer, setRtt, type Lobby } from '../core/net/lobby';
import { PROTOCOL_VERSION, clockSample, readGuestMessage, writeMessage, type HostMessage } from '../core/net/protocol';
import { applyFinish, applyProgress, createRace, isOver, markLeft, type Race, type RacerResult } from '../core/race';
import type { Language } from '../core/languages';
import { PeerError, createInvite, type Invite, type Peer } from './peer';

export interface Me {
  name: string;
  badge: string;
}

export interface HostOptions {
  me: Me;
  app: string;
  /** A name fit to show for what a guest sent (cleaned and through the word filter), or a stand-in like "Player 2". */
  nameFor(sent: string, seat: number): string;
}

/** A clock shared in meaning across devices: ms since the epoch, at performance.now()'s precision. */
export const clockNow = (): number => performance.timeOrigin + performance.now();

/** A guest whose hello hasn't come before this, after connecting, is dropped. */
const HELLO_WAIT_MS = 5000;

interface Seat {
  peer: Peer;
  lastHeard: number;
  offsetMs: number;
}

export class HostGame {
  lobby: Lobby;
  private seats = new Map<string, Seat>();
  private listeners: ((lobby: Lobby) => void)[] = [];
  private pinger: ReturnType<typeof setInterval>;
  private pingN = 0;
  private openInvite: Invite | null = null;
  /** The race being run, or null in the lobby. */
  race: Race | null = null;
  private raceListeners: ((race: Race, over: boolean) => void)[] = [];
  private standingsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: HostOptions) {
    this.lobby = createLobby(options.me);
    this.pinger = setInterval(() => this.ping(), GAME_CONFIG.net.pingIntervalMs);
  }

  onChange(listener: (lobby: Lobby) => void): void {
    this.listeners.push(listener);
  }

  get full(): boolean {
    return isFull(this.lobby);
  }

  /** How far a player's clock is ahead of the host's (for countdowns). */
  offsetFor(id: string): number {
    return this.seats.get(id)?.offsetMs ?? 0;
  }

  /** A fresh invite code (cancelling any unused one). */
  async invite(): Promise<string> {
    this.openInvite?.cancel();
    this.openInvite = await createInvite();
    return this.openInvite.code;
  }

  /**
   * Finishes the open invite with the code a joiner sent back, and seats them
   * once they say hello. Throws HandshakeError or PeerError.
   */
  async admit(answer: string): Promise<void> {
    const invite = this.openInvite;
    if (!invite) throw new PeerError('closed');
    const peer = await invite.accept(answer);
    this.openInvite = null;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        peer.close();
        reject(new PeerError('unreachable'));
      }, HELLO_WAIT_MS);
      let seated = false;
      peer.onMessage((data) => {
        const message = readGuestMessage(data);
        if (!message) return;
        if (!seated && message.t === 'hello') {
          seated = true;
          clearTimeout(timer);
          if (message.protocol !== PROTOCOL_VERSION || this.full) {
            peer.send(writeMessage({ t: 'refuse', reason: this.full ? 'full' : 'version', app: this.options.app }));
            setTimeout(() => peer.close(), 500);
            resolve();
            return;
          }
          const { lobby, id } = addPlayer(this.lobby, {
            name: this.options.nameFor(message.name, this.lobby.players.length + 1),
            badge: message.badge,
          });
          this.seats.set(id, { peer, lastHeard: performance.now(), offsetMs: 0 });
          peer.onClose(() => this.drop(id));
          this.lobby = lobby;
          peer.send(writeMessage({ t: 'welcome', you: id, lobby }));
          this.changed();
          resolve();
          return;
        }
        this.hear(peer, message);
      });
    });
  }

  private hear(peer: Peer, message: ReturnType<typeof readGuestMessage>): void {
    const id = [...this.seats].find(([, s]) => s.peer === peer)?.[0];
    if (!id || !message) return;
    const seat = this.seats.get(id)!;
    seat.lastHeard = performance.now();
    if (message.t === 'pong') {
      const { rttMs, offsetMs } = clockSample(message.sentAt, clockNow(), message.guestAt);
      seat.offsetMs = offsetMs;
      this.lobby = setRtt(this.lobby, id, rttMs);
      this.changed();
    } else if (message.t === 'leave') {
      seat.peer.close();
    } else if (message.t === 'progress' && this.race) {
      this.race = applyProgress(this.race, id, message.at);
    } else if (message.t === 'finish' && this.race) {
      this.race = applyFinish(this.race, id, message.result);
      this.raceChanged();
    } else if (message.t === 'leaveRace' && this.race) {
      this.race = markLeft(this.race, id);
      this.raceChanged();
    }
  }

  // ---- Ink Race ----------------------------------------------------------

  /** Called with the race whenever a racer finishes or leaves, and as standings go out. */
  onRace(listener: (race: Race, over: boolean) => void): void {
    this.raceListeners.push(listener);
  }

  /** Drops race listeners (before a new race session registers its own). */
  clearRaceListeners(): void {
    this.raceListeners = [];
  }

  /**
   * Starts a race for everyone in the lobby. Each guest is told the start on
   * their own clock (the host's start plus their measured offset).
   */
  startRace(passageId: string, lang: Language, length: number): Race {
    const { leadMs, countdownMs, progressIntervalMs } = GAME_CONFIG.race;
    const startAt = clockNow() + leadMs + countdownMs;
    this.race = createRace(passageId, lang, length, startAt, this.lobby.players.map((p) => p.id));
    const ids = this.race.racers.map((r) => r.id);
    for (const seat of this.seats.values()) seat.peer.send(writeMessage({ t: 'race', passageId, lang, startAt: startAt + seat.offsetMs, ids }));
    this.stopStandings();
    this.standingsTimer = setInterval(() => this.raceChanged(), progressIntervalMs);
    return this.race;
  }

  /** The host's own typing. */
  hostProgress(at: number): void {
    if (this.race) this.race = applyProgress(this.race, HOST_ID, at);
  }

  hostFinish(result: RacerResult): void {
    if (!this.race) return;
    this.race = applyFinish(this.race, HOST_ID, result);
    this.raceChanged();
  }

  /** Everyone back to the lobby (the race is dropped). */
  toLobby(): void {
    this.stopStandings();
    this.race = null;
    this.broadcast({ t: 'toLobby' });
  }

  private raceChanged(): void {
    const race = this.race;
    if (!race) return;
    const over = isOver(race, clockNow());
    this.broadcast({ t: 'standings', racers: race.racers, over });
    if (over) this.stopStandings();
    for (const l of this.raceListeners) l(race, over);
  }

  private stopStandings(): void {
    if (this.standingsTimer !== null) clearInterval(this.standingsTimer);
    this.standingsTimer = null;
  }

  private ping(): void {
    const now = performance.now();
    const ping = writeMessage({ t: 'ping', n: ++this.pingN, sentAt: clockNow() });
    for (const seat of [...this.seats.values()]) {
      if (now - seat.lastHeard > GAME_CONFIG.net.silentTimeoutMs) seat.peer.close();
      else seat.peer.send(ping);
    }
  }

  private drop(id: string): void {
    if (!this.seats.delete(id)) return;
    this.lobby = removePlayer(this.lobby, id);
    if (this.race) {
      this.race = markLeft(this.race, id);
      this.raceChanged();
    }
    this.changed();
  }

  private changed(): void {
    this.broadcast({ t: 'lobby', lobby: this.lobby });
    for (const l of this.listeners) l(this.lobby);
  }

  broadcast(message: HostMessage): void {
    const data = writeMessage(message);
    for (const seat of this.seats.values()) seat.peer.send(data);
  }

  /** Ends the game for everyone. */
  close(): void {
    clearInterval(this.pinger);
    this.stopStandings();
    this.raceListeners = [];
    this.openInvite?.cancel();
    this.broadcast({ t: 'leave' });
    for (const seat of [...this.seats.values()]) seat.peer.close();
    this.seats.clear();
    this.listeners = [];
  }
}

