import { describe, expect, it } from 'vitest';
import { addPlayer, createLobby, isFull, removePlayer, setRtt } from './lobby';
import { PROTOCOL_VERSION, clockSample, readGuestMessage, readHostMessage, writeMessage } from './protocol';

describe('protocol', () => {
  it('round-trips every message', () => {
    const lobby = createLobby({ name: 'Ada', badge: 'teal' });
    const hello = { t: 'hello', protocol: PROTOCOL_VERSION, app: '2.32.0', name: 'Sam', badge: 'gold' } as const;
    expect(readGuestMessage(writeMessage(hello))).toEqual(hello);
    expect(readGuestMessage(writeMessage({ t: 'pong', n: 3, sentAt: 10, guestAt: 99 }))).toEqual({ t: 'pong', n: 3, sentAt: 10, guestAt: 99 });
    expect(readHostMessage(writeMessage({ t: 'welcome', you: 'p1', lobby }))).toEqual({ t: 'welcome', you: 'p1', lobby });
    expect(readHostMessage(writeMessage({ t: 'refuse', reason: 'full', app: '2.32.0' }))).toEqual({ t: 'refuse', reason: 'full', app: '2.32.0' });
    expect(readHostMessage(writeMessage({ t: 'leave' }))).toEqual({ t: 'leave' });
  });

  it('turns away anything that is not a message', () => {
    for (const bad of ['', 'nope', '[]', 'null', '{"t":"hello"}', '{"t":"ping","n":"1","sentAt":0}', '{"t":"shout"}', 42, 'x'.repeat(20_000)]) {
      expect(readGuestMessage(bad)).toBeNull();
      expect(readHostMessage(bad)).toBeNull();
    }
  });

  it('rejects a lobby with odd players', () => {
    const msg = (players: unknown) => JSON.stringify({ t: 'lobby', lobby: { players } });
    expect(readHostMessage(msg([]))).toBeNull();
    expect(readHostMessage(msg([{ id: 'HOST!', name: 'A', badge: 'ink', host: true, rttMs: null }]))).toBeNull();
    expect(readHostMessage(msg([{ id: 'host', name: 'A', badge: '<b>', host: true, rttMs: null }]))).toBeNull();
    expect(readHostMessage(msg([{ id: 'host', name: 'A', badge: 'ink', host: true, rttMs: null }]))).not.toBeNull();
  });

  it('reads a hello from a newer version, so the host can say why it refuses', () => {
    const hello = readGuestMessage(JSON.stringify({ t: 'hello', protocol: PROTOCOL_VERSION + 1, future: true }));
    expect(hello).toEqual({ t: 'hello', protocol: PROTOCOL_VERSION + 1, app: '?', name: '', badge: 'ink' });
  });

  it('works out round trips and clock offsets', () => {
    expect(clockSample(1000, 1040, 5020)).toEqual({ rttMs: 40, offsetMs: 4000 });
    expect(clockSample(1000, 990, 1000).rttMs).toBe(0);
  });
});

describe('lobby', () => {
  it('adds players with new ids and names', () => {
    let lobby = createLobby({ name: 'Sam', badge: 'ink' });
    const a = addPlayer(lobby, { name: 'sam', badge: 'gold' });
    lobby = a.lobby;
    const b = addPlayer(lobby, { name: 'Sam', badge: 'moss' });
    lobby = b.lobby;
    expect([a.id, b.id]).toEqual(['p1', 'p2']);
    expect(lobby.players.map((p) => p.name)).toEqual(['Sam', 'sam 2', 'Sam 3']);
  });

  it('fills at four, reuses free ids, and never removes the host', () => {
    let lobby = createLobby({ name: 'H', badge: 'ink' });
    for (const name of ['A', 'B', 'C']) lobby = addPlayer(lobby, { name, badge: 'ink' }).lobby;
    expect(isFull(lobby)).toBe(true);
    lobby = removePlayer(lobby, 'p2');
    lobby = removePlayer(lobby, 'host');
    expect(lobby.players.map((p) => p.id)).toEqual(['host', 'p1', 'p3']);
    expect(addPlayer(lobby, { name: 'D', badge: 'ink' }).id).toBe('p2');
  });

  it('records round trips', () => {
    const lobby = addPlayer(createLobby({ name: 'H', badge: 'ink' }), { name: 'A', badge: 'ink' }).lobby;
    expect(setRtt(lobby, 'p1', 12.6).players[1]!.rttMs).toBe(13);
  });
});
