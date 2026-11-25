import { describe, expect, it } from 'vitest';
import { HandshakeError, buildSdp, decodeHandshake, encodeHandshake, handshakeFromBytes, handshakeToBytes, parseSdp } from './handshake';

/** Captured from Chrome 14x with `iceServers: []` (data channel only). */
const CHROME_OFFER = [
  'v=0',
  'o=- 2312765005187243006 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:3183327686 1 udp 2113937151 2cc3ef61-919a-4279-b627-231164b31ca6.local 51851 typ host generation 0 network-cost 999',
  'a=candidate:841589055 1 udp 2113939711 a666cd84-a6f2-4255-873d-7b5cc6105e81.local 52102 typ host generation 0 network-cost 999',
  'a=ice-ufrag:KZtg',
  'a=ice-pwd:xeNUqAU7pkd9/ioy3tktz7OH',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 25:71:FF:6F:D8:F6:A2:B9:83:F1:BC:89:68:17:AD:A6:53:EF:AD:20:02:0A:17:49:BA:76:E3:17:EF:39:1E:00',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

/** Firefox's shape: fingerprint at session level, uppercase UDP, TCP candidates, 8-hex ufrag. */
const FIREFOX_ANSWER = [
  'v=0',
  'o=mozilla...THIS_IS_SDPARTA-132.0 5843198207365512 0 IN IP4 0.0.0.0',
  's=-',
  't=0 0',
  'a=fingerprint:sha-256 0A:1B:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9:0A:1B:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9',
  'a=group:BUNDLE 0',
  'a=ice-options:trickle',
  'a=msid-semantic:WMS *',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:0 1 UDP 2122252543 3f2a1b4c-1234-4abc-9def-0123456789ab.local 54321 typ host',
  'a=candidate:1 1 TCP 2105524479 3f2a1b4c-1234-4abc-9def-0123456789ab.local 9 typ host tcptype active',
  'a=sendrecv',
  'a=end-of-candidates',
  'a=ice-pwd:0123456789abcdef0123456789abcdef',
  'a=ice-ufrag:89abcdef',
  'a=mid:0',
  'a=setup:active',
  'a=sctp-port:5000',
  'a=max-message-size:1073741823',
  '',
].join('\r\n');

/** Safari's shape, after microphone permission: raw local addresses instead of mDNS names. */
const SAFARI_OFFER_RAW_IPS = [
  'v=0',
  'o=- 7031542981 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:1 1 udp 2113937151 192.168.1.23 61000 typ host generation 0 network-cost 999',
  'a=candidate:2 1 udp 2113939711 fe80::1c2b:3aff:fe4d:5e6f 61001 typ host generation 0 network-cost 999',
  'a=candidate:3 1 udp 1677729535 81.2.69.160 61000 typ srflx raddr 192.168.1.23 rport 61000',
  'a=ice-ufrag:Ab+/',
  'a=ice-pwd:Zz09+/Zz09+/Zz09+/Zz09+/',
  'a=fingerprint:sha-256 FF:EE:DD:CC:BB:AA:99:88:77:66:55:44:33:22:11:00:FF:EE:DD:CC:BB:AA:99:88:77:66:55:44:33:22:11:00',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  '',
].join('\r\n');

describe('handshake codes', () => {
  it('keeps what a Chrome offer needs, in a short code', () => {
    const h = parseSdp(CHROME_OFFER, 'offer');
    expect(h).toMatchObject({ kind: 'offer', setup: 'actpass', ufrag: 'KZtg', pwd: 'xeNUqAU7pkd9/ioy3tktz7OH', hash: 'sha-256' });
    expect(h.candidates).toEqual([
      { address: '2cc3ef61-919a-4279-b627-231164b31ca6.local', port: 51851 },
      { address: 'a666cd84-a6f2-4255-873d-7b5cc6105e81.local', port: 52102 },
    ]);
    const code = encodeHandshake(h);
    expect(code.length).toBeLessThanOrEqual(140);
    expect(decodeHandshake(code)).toEqual(h);
  });

  it('reads Firefox: session-level fingerprint, UDP only', () => {
    const h = parseSdp(FIREFOX_ANSWER, 'answer');
    expect(h.setup).toBe('active');
    expect(h.ufrag).toBe('89abcdef');
    expect(h.candidates).toEqual([{ address: '3f2a1b4c-1234-4abc-9def-0123456789ab.local', port: 54321 }]);
    expect(decodeHandshake(encodeHandshake(h))).toEqual(h);
  });

  it('keeps raw IPv4 and IPv6 host addresses and drops server-reflexive ones', () => {
    const h = parseSdp(SAFARI_OFFER_RAW_IPS, 'offer');
    expect(h.candidates.map((c) => c.address)).toEqual(['192.168.1.23', 'fe80::1c2b:3aff:fe4d:5e6f']);
    const back = decodeHandshake(encodeHandshake(h));
    expect(back.candidates).toEqual([
      { address: '192.168.1.23', port: 61000 },
      { address: 'fe80:0:0:0:1c2b:3aff:fe4d:5e6f', port: 61001 },
    ]);
    expect(back.ufrag).toBe('Ab+/');
  });

  it('rebuilds a description with the same ICE and DTLS details', () => {
    const h = parseSdp(CHROME_OFFER, 'offer');
    const rebuilt = parseSdp(buildSdp(h), 'offer');
    expect(rebuilt).toEqual(h);
    expect(buildSdp(h)).toContain('a=mid:0\r\n');
  });

  it('reads a code out of a whole link, with stray spaces', () => {
    const code = encodeHandshake(parseSdp(CHROME_OFFER, 'offer'));
    const link = `https://inkykeys.com/#join=${code.slice(0, 40)}\n ${code.slice(40)}`;
    expect(decodeHandshake(link).ufrag).toBe('KZtg');
  });

  it('says a damaged, cut-short or empty code is damaged', () => {
    const code = encodeHandshake(parseSdp(CHROME_OFFER, 'offer'));
    const problem = (text: string) => {
      try {
        decodeHandshake(text);
        return 'ok';
      } catch (e) {
        return e instanceof HandshakeError ? e.problem : 'other';
      }
    };
    expect(problem(code.slice(0, -5))).toBe('damaged');
    expect(problem(code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11))).toBe('damaged');
    expect(problem('hello there!')).toBe('damaged');
    expect(problem('   ')).toBe('empty');
  });

  it('spots a code from a newer version', () => {
    const bytes = handshakeToBytes(parseSdp(CHROME_OFFER, 'offer'));
    bytes[0] = 9;
    expect(() => handshakeFromBytes(bytes)).toThrow(expect.objectContaining({ problem: 'version' }));
  });
});
