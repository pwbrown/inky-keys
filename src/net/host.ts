/**
 * The host's side of Play together (REQUIREMENTS §13e): keeps the lobby,
 * makes one invite at a time, checks every player with pings (round trip and
 * clock offset), and tells everyone when something changes.
 */
import { GAME_CONFIG } from '../core/config';
import { addPlayer, createLobby, isFull, removePlayer, setRtt, type Lobby } from '../core/net/lobby';
import { PROTOCOL_VERSION, clockSample, readGuestMessage, writeMessage, type HostMessage } from '../core/net/protocol';
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
      const { rttMs, offsetMs } = clockSample(message.sentAt, performance.now() + performance.timeOrigin, message.guestAt);
      seat.offsetMs = offsetMs;
      this.lobby = setRtt(this.lobby, id, rttMs);
      this.changed();
    } else if (message.t === 'leave') {
      seat.peer.close();
    }
  }

  private ping(): void {
    const now = performance.now();
    const ping = writeMessage({ t: 'ping', n: ++this.pingN, sentAt: now + performance.timeOrigin });
    for (const seat of [...this.seats.values()]) {
      if (now - seat.lastHeard > GAME_CONFIG.net.silentTimeoutMs) seat.peer.close();
      else seat.peer.send(ping);
    }
  }

  private drop(id: string): void {
    if (!this.seats.delete(id)) return;
    this.lobby = removePlayer(this.lobby, id);
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
    this.openInvite?.cancel();
    this.broadcast({ t: 'leave' });
    for (const seat of [...this.seats.values()]) seat.peer.close();
    this.seats.clear();
    this.listeners = [];
  }
}

