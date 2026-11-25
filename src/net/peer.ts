/**
 * One WebRTC connection to another device on the local network
 * (REQUIREMENTS §13e).
 *
 * Privacy: `iceServers` is always empty. With no STUN or TURN server the
 * browser only offers this device's own addresses (as `.local` mDNS names
 * unless the page has camera or microphone permission), so nothing goes to
 * the internet. The CSP's `connect-src` doesn't cover WebRTC, which is why
 * this guarantee lives here: never add ICE servers.
 *
 * Codes are made after address gathering finishes (no trickle ICE), since
 * players carry one code each way.
 */
import { GAME_CONFIG } from '../core/config';
import { buildSdp, decodeHandshake, encodeHandshake, parseSdp, type HandshakeKind } from '../core/net/handshake';

/** Why a connection couldn't be made or was lost. */
export type PeerProblem = 'unreachable' | 'closed' | 'unsupported' | 'wrongKind';

export class PeerError extends Error {
  constructor(readonly problem: PeerProblem) {
    super(`Peer: ${problem}`);
  }
}

const CONFIG: RTCConfiguration = { iceServers: [] };

export const peersSupported = (): boolean => typeof RTCPeerConnection === 'function';

/** An open connection with one ordered, reliable data channel. */
export class Peer {
  private messageHandlers: ((data: string) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private closed = false;

  constructor(
    private readonly pc: RTCPeerConnection,
    private readonly channel: RTCDataChannel,
  ) {
    channel.addEventListener('message', (e: MessageEvent) => {
      if (typeof e.data === 'string') for (const h of this.messageHandlers) h(e.data);
    });
    channel.addEventListener('close', () => this.close());
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.close();
    });
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    if (this.closed) handler();
    else this.closeHandlers.push(handler);
  }

  send(data: string): void {
    if (this.channel.readyState === 'open') this.channel.send(data);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.channel.close();
    this.pc.close();
    for (const h of this.closeHandlers) h();
  }
}

function newConnection(): { pc: RTCPeerConnection; channel: RTCDataChannel } {
  if (!peersSupported()) throw new PeerError('unsupported');
  const pc = new RTCPeerConnection(CONFIG);
  // Negotiated with a fixed id, so the description needs no extra round trip.
  const channel = pc.createDataChannel('inky', { negotiated: true, id: 0, ordered: true });
  return { pc, channel };
}

/** Waits for address gathering to finish, or the timeout (whatever's gathered by then is used). */
function gathered(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    const timer = setTimeout(done, GAME_CONFIG.net.gatherTimeoutMs);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

function codeFor(pc: RTCPeerConnection, kind: HandshakeKind): string {
  const sdp = pc.localDescription?.sdp;
  if (!sdp) throw new PeerError('unreachable');
  const handshake = parseSdp(sdp, kind);
  // No local address at all: WebRTC is blocked or the device is offline.
  if (handshake.candidates.length === 0) throw new PeerError('unreachable');
  return encodeHandshake(handshake);
}

/** Resolves once the data channel opens; rejects as unreachable on failure or timeout. */
function opened(pc: RTCPeerConnection, channel: RTCDataChannel, timeoutMs: number): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const fail = () => {
      clearTimeout(timer);
      pc.close();
      reject(new PeerError('unreachable'));
    };
    const timer = setTimeout(fail, timeoutMs);
    if (channel.readyState === 'open') {
      clearTimeout(timer);
      return resolve(new Peer(pc, channel));
    }
    channel.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(new Peer(pc, channel));
    });
    pc.addEventListener('connectionstatechange', () => pc.connectionState === 'failed' && fail());
  });
}

/** The host's side: an offer code to send, and a way to finish with the answer code that comes back. */
export interface Invite {
  code: string;
  /** Throws HandshakeError (bad code) or PeerError. */
  accept(answer: string): Promise<Peer>;
  cancel(): void;
}

export async function createInvite(): Promise<Invite> {
  const { pc, channel } = newConnection();
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const code = codeFor(pc, 'offer');
  return {
    code,
    accept: async (answerText) => {
      const answer = decodeHandshake(answerText);
      if (answer.kind !== 'answer') throw new PeerError('wrongKind');
      await pc.setRemoteDescription({ type: 'answer', sdp: buildSdp(answer) });
      return opened(pc, channel, GAME_CONFIG.net.connectTimeoutMs);
    },
    cancel: () => pc.close(),
  };
}

/** The joiner's side: reads the host's code, makes the answer code to send back, then waits to connect. */
export async function answerInvite(offerText: string): Promise<{ code: string; connected: Promise<Peer>; cancel(): void }> {
  const offer = decodeHandshake(offerText);
  if (offer.kind !== 'offer') throw new PeerError('wrongKind');
  const { pc, channel } = newConnection();
  await pc.setRemoteDescription({ type: 'offer', sdp: buildSdp(offer) });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  const code = codeFor(pc, 'answer');
  // The joiner waits while their code travels back to the host, so their wait is longer.
  const connected = opened(pc, channel, GAME_CONFIG.net.answerWaitMs);
  // The UI may never await this (the player gives up first); don't report that as unhandled.
  connected.catch(() => {});
  return { code, connected, cancel: () => pc.close() };
}
