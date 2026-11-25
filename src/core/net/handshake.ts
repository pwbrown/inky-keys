/**
 * Handshake codes for playing together (REQUIREMENTS §13e).
 *
 * Two browsers on the same network connect with WebRTC and no servers, so the
 * players carry the handshake between devices themselves: the host's offer,
 * then the joiner's answer. A browser's session description runs to 600–1,500
 * characters; almost all of it is the same every time. This keeps only what
 * changes (the DTLS fingerprint, ICE username and password, setup role, and
 * the local addresses) in about 60–100 bytes (90–135 characters), and rebuilds a description the
 * other browser accepts.
 *
 * Code layout (bytes):
 *   0      format version
 *   1      flags: bit 0 kind (0 offer, 1 answer), bits 1–2 setup role
 *   …      ICE ufrag, ICE pwd: a length byte, then 6 bits per character
 *   …      fingerprint: hash byte, then the digest
 *   …      candidate count, then each: address type, address, port (2)
 *   last 2 CRC-16 of everything before
 *
 * Only UDP host candidates are kept: with no ICE servers there are no others
 * worth having, and TCP candidates (Firefox) add length for nothing on a LAN.
 */
import { GAME_CONFIG } from '../config';
import { base64UrlToBytes, bytesToBase64Url } from '../base64url';
import { crc16 } from './crc';

export const HANDSHAKE_VERSION = 1;

export type HandshakeKind = 'offer' | 'answer';
export type SetupRole = 'actpass' | 'active' | 'passive';
export type HashName = 'sha-256' | 'sha-384' | 'sha-512';

export interface Candidate {
  /** A `.local` mDNS name (a UUID), an IPv4 or an IPv6 address. */
  address: string;
  port: number;
}

export interface Handshake {
  kind: HandshakeKind;
  setup: SetupRole;
  ufrag: string;
  pwd: string;
  hash: HashName;
  /** The certificate digest. */
  fingerprint: Uint8Array;
  candidates: Candidate[];
}

export type HandshakeProblem = 'damaged' | 'version' | 'empty';

export class HandshakeError extends Error {
  constructor(readonly problem: HandshakeProblem) {
    super(`Handshake code: ${problem}`);
  }
}

const SETUPS: readonly SetupRole[] = ['actpass', 'active', 'passive'];
const HASHES: readonly HashName[] = ['sha-256', 'sha-384', 'sha-512'];
const HASH_BYTES: Record<HashName, number> = { 'sha-256': 32, 'sha-384': 48, 'sha-512': 64 };
/** ICE characters (RFC 8445 ice-char): exactly 64, so 6 bits each. */
const ICE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const AddressType = { Mdns: 0, Ipv4: 1, Ipv6: 2 } as const;
type AddressType = (typeof AddressType)[keyof typeof AddressType];

const UUID = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Reads what a handshake code needs from a browser's session description. Throws if something's missing. */
export function parseSdp(sdp: string, kind: HandshakeKind): Handshake {
  const lines = sdp.split(/\r?\n/);
  const value = (prefix: string) => lines.find((l) => l.startsWith(prefix))?.slice(prefix.length).trim();
  const ufrag = value('a=ice-ufrag:');
  const pwd = value('a=ice-pwd:');
  const fp = value('a=fingerprint:');
  const setup = value('a=setup:') as SetupRole | undefined;
  if (!ufrag || !pwd || !fp || !setup || !SETUPS.includes(setup)) throw new Error('Session description is missing ICE or DTLS details');
  const [hashName = '', hex] = fp.split(/\s+/);
  const hash = hashName.toLowerCase() as HashName;
  if (!HASHES.includes(hash) || !hex) throw new Error(`Unsupported fingerprint: ${fp}`);
  const fingerprint = Uint8Array.from(hex.split(':'), (h) => parseInt(h, 16));
  if (fingerprint.length !== HASH_BYTES[hash]) throw new Error('Fingerprint has the wrong length');

  const candidates: Candidate[] = [];
  for (const line of lines) {
    if (!line.startsWith('a=candidate:')) continue;
    // a=candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> …
    const [, component, transport = '', , address = '', port, , type] = line.slice('a=candidate:'.length).split(' ');
    if (component !== '1' || transport.toLowerCase() !== 'udp' || type !== 'host') continue;
    if (addressType(address) === null) continue;
    if (candidates.some((c) => c.address === address && c.port === Number(port))) continue;
    candidates.push({ address, port: Number(port) });
  }
  return { kind, setup, ufrag, pwd, hash, fingerprint, candidates: candidates.slice(0, GAME_CONFIG.net.maxCandidates) };
}

function addressType(address: string): AddressType | null {
  if (UUID.test(address)) return AddressType.Mdns;
  if (IPV4.test(address) && address.split('.').every((n) => Number(n) <= 255)) return AddressType.Ipv4;
  if (address.includes(':') && expandIpv6(address) !== null) return AddressType.Ipv6;
  return null;
}

/** An IPv6 address as 8 groups, or null. Zone ids (`%en0`) aren't kept. */
function expandIpv6(address: string): number[] | null {
  if (!/^[0-9a-f:]+$/i.test(address)) return null;
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':').map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : NaN)));
  const head = parse(halves[0] ?? '');
  const tail = halves.length === 2 ? parse(halves[1] ?? '') : [];
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...head, ...Array<number>(missing).fill(0), ...tail];
  return groups.some(Number.isNaN) ? null : groups;
}

/** Builds a session description the browser accepts from a decoded code. */
export function buildSdp(h: Handshake): string {
  const hex = [...h.fingerprint].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const lines = [
    'v=0',
    'o=- 1 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    ...h.candidates.map((c, i) => `a=candidate:${i + 1} 1 udp ${2113937151 - i} ${c.address} ${c.port} typ host`),
    'a=end-of-candidates',
    `a=ice-ufrag:${h.ufrag}`,
    `a=ice-pwd:${h.pwd}`,
    `a=fingerprint:${h.hash} ${hex}`,
    `a=setup:${h.setup}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ];
  return lines.join('\r\n') + '\r\n';
}

class Writer {
  private bytes: number[] = [];
  byte(b: number) {
    this.bytes.push(b & 0xff);
  }
  all(bs: Iterable<number>) {
    for (const b of bs) this.byte(b);
  }
  iceString(s: string) {
    if (s.length > 255) throw new Error('ICE string too long');
    this.byte(s.length);
    let acc = 0;
    let bits = 0;
    for (const ch of s) {
      const v = ICE_CHARS.indexOf(ch);
      if (v < 0) throw new Error(`Not an ICE character: ${ch}`);
      acc = (acc << 6) | v;
      bits += 6;
      while (bits >= 8) {
        bits -= 8;
        this.byte(acc >> bits);
      }
      acc &= (1 << bits) - 1;
    }
    if (bits > 0) this.byte(acc << (8 - bits));
  }
  done(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

class Reader {
  private at = 0;
  constructor(private readonly bytes: Uint8Array) {}
  byte(): number {
    if (this.at >= this.bytes.length) throw new HandshakeError('damaged');
    return this.bytes[this.at++]!;
  }
  take(n: number): Uint8Array {
    if (this.at + n > this.bytes.length) throw new HandshakeError('damaged');
    const out = this.bytes.slice(this.at, this.at + n);
    this.at += n;
    return out;
  }
  iceString(): string {
    const length = this.byte();
    const raw = this.take(Math.ceil((length * 6) / 8));
    let out = '';
    let acc = 0;
    let bits = 0;
    for (const b of raw) {
      acc = (acc << 8) | b;
      bits += 8;
      while (bits >= 6 && out.length < length) {
        bits -= 6;
        out += ICE_CHARS[(acc >> bits) & 63];
      }
      acc &= (1 << bits) - 1;
    }
    return out;
  }
  get finished() {
    return this.at === this.bytes.length;
  }
}

export function handshakeToBytes(h: Handshake): Uint8Array {
  const w = new Writer();
  w.byte(HANDSHAKE_VERSION);
  w.byte((h.kind === 'answer' ? 1 : 0) | (SETUPS.indexOf(h.setup) << 1));
  w.iceString(h.ufrag);
  w.iceString(h.pwd);
  w.byte(HASHES.indexOf(h.hash));
  w.all(h.fingerprint);
  w.byte(h.candidates.length);
  for (const c of h.candidates) {
    const type = addressType(c.address);
    w.byte(type ?? 0);
    if (type === AddressType.Mdns) {
      w.all(c.address.slice(0, 36).replace(/-/g, '').match(/../g)!.map((hx) => parseInt(hx, 16)));
    } else if (type === AddressType.Ipv4) {
      w.all(c.address.split('.').map(Number));
    } else if (type === AddressType.Ipv6) {
      for (const g of expandIpv6(c.address)!) w.all([g >> 8, g & 0xff]);
    } else {
      throw new Error(`Unsupported address: ${c.address}`);
    }
    w.all([c.port >> 8, c.port & 0xff]);
  }
  const body = w.done();
  const crc = crc16(body);
  return Uint8Array.from([...body, crc >> 8, crc & 0xff]);
}

export function handshakeFromBytes(bytes: Uint8Array): Handshake {
  if (bytes.length < 4) throw new HandshakeError(bytes.length === 0 ? 'empty' : 'damaged');
  const body = bytes.subarray(0, bytes.length - 2);
  const crc = (bytes[bytes.length - 2]! << 8) | bytes[bytes.length - 1]!;
  if (crc16(body) !== crc) {
    // A newer format may lay the code out differently; a damaged first byte is far more likely to be anything else.
    const first = body[0]!;
    throw new HandshakeError(first > HANDSHAKE_VERSION && first < 16 ? 'version' : 'damaged');
  }
  const r = new Reader(body);
  if (r.byte() !== HANDSHAKE_VERSION) throw new HandshakeError('version');
  const flags = r.byte();
  const setup = SETUPS[(flags >> 1) & 3];
  const ufrag = r.iceString();
  const pwd = r.iceString();
  const hash = HASHES[r.byte()];
  if (!setup || !hash || ufrag.length < 4 || pwd.length < 22) throw new HandshakeError('damaged');
  const fingerprint = r.take(HASH_BYTES[hash]);
  const count = r.byte();
  const candidates: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    const type = r.byte();
    let address: string;
    if (type === AddressType.Mdns) {
      const hex = [...r.take(16)].map((b) => b.toString(16).padStart(2, '0')).join('');
      address = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}.local`;
    } else if (type === AddressType.Ipv4) {
      address = [...r.take(4)].join('.');
    } else if (type === AddressType.Ipv6) {
      const b = r.take(16);
      address = Array.from({ length: 8 }, (_, g) => ((b[2 * g]! << 8) | b[2 * g + 1]!).toString(16)).join(':');
    } else {
      throw new HandshakeError('damaged');
    }
    const port = r.take(2);
    candidates.push({ address, port: (port[0]! << 8) | port[1]! });
  }
  if (!r.finished || candidates.length === 0) throw new HandshakeError('damaged');
  return { kind: flags & 1 ? 'answer' : 'offer', setup, ufrag, pwd, hash, fingerprint, candidates };
}

/** The code players paste or send as a link: base64url. */
export function encodeHandshake(h: Handshake): string {
  return bytesToBase64Url(handshakeToBytes(h));
}

/** Reads a pasted code or a whole link (anything after `#join=` or `#answer=`). Throws HandshakeError. */
export function decodeHandshake(text: string): Handshake {
  const code = text.trim().replace(/^.*#(join|answer)=/, '').replace(/\s+/g, '');
  if (code === '') throw new HandshakeError('empty');
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(code);
  } catch {
    throw new HandshakeError('damaged');
  }
  return handshakeFromBytes(bytes);
}
