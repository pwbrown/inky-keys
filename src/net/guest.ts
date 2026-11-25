/**
 * A joiner's side of Play together (REQUIREMENTS §13e): says hello, shows the
 * host's lobby, answers pings, and notices when the host goes quiet.
 */
import { GAME_CONFIG } from '../core/config';
import type { Lobby } from '../core/net/lobby';
import { PROTOCOL_VERSION, readHostMessage, writeMessage } from '../core/net/protocol';
import type { Me } from './host';
import type { Peer } from './peer';

/** Why a guest's game ended. */
export type GuestEnd = 'hostLeft' | 'lost' | 'version' | 'full';

export class GuestGame {
  lobby: Lobby | null = null;
  you: string | null = null;
  private changeListeners: ((lobby: Lobby) => void)[] = [];
  private endListeners: ((why: GuestEnd) => void)[] = [];
  private lastHeard = performance.now();
  private watchdog: ReturnType<typeof setInterval>;
  private ended = false;
  /** Set when the host refused us, so the close that follows reports why. */
  private refused: GuestEnd | null = null;

  constructor(
    private readonly peer: Peer,
    me: Me,
    app: string,
  ) {
    peer.onMessage((data) => this.hear(data));
    peer.onClose(() => this.end(this.refused ?? 'lost'));
    peer.send(writeMessage({ t: 'hello', protocol: PROTOCOL_VERSION, app, name: me.name, badge: me.badge }));
    this.watchdog = setInterval(() => {
      if (performance.now() - this.lastHeard > GAME_CONFIG.net.silentTimeoutMs) this.end('lost');
    }, 1000);
  }

  onChange(listener: (lobby: Lobby) => void): void {
    this.changeListeners.push(listener);
  }

  onEnd(listener: (why: GuestEnd) => void): void {
    this.endListeners.push(listener);
  }

  private hear(data: string): void {
    const message = readHostMessage(data);
    if (!message) return;
    this.lastHeard = performance.now();
    switch (message.t) {
      case 'welcome':
        this.you = message.you;
        this.setLobby(message.lobby);
        break;
      case 'lobby':
        if (this.you) this.setLobby(message.lobby);
        break;
      case 'ping':
        this.peer.send(writeMessage({ t: 'pong', n: message.n, sentAt: message.sentAt, guestAt: performance.now() + performance.timeOrigin }));
        break;
      case 'refuse':
        this.refused = message.reason;
        break;
      case 'leave':
        this.end('hostLeft');
        break;
    }
  }

  private setLobby(lobby: Lobby): void {
    this.lobby = lobby;
    for (const l of this.changeListeners) l(lobby);
  }

  private end(why: GuestEnd): void {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.watchdog);
    this.peer.close();
    for (const l of this.endListeners) l(why);
  }

  leave(): void {
    if (this.ended) return;
    this.peer.send(writeMessage({ t: 'leave' }));
    this.ended = true;
    clearInterval(this.watchdog);
    // Give the goodbye a moment to go out before the channel closes.
    setTimeout(() => this.peer.close(), 200);
    this.endListeners = [];
  }
}
