/**
 * Sound pairing (REQUIREMENTS §13e): a handshake code played through one
 * laptop's speaker and heard by another's microphone, so players in the same
 * room don't need to copy anything between devices.
 *
 * A simple multi-tone FSK modem, kept free of the Web Audio API so it can be
 * tested on made-up audio. Each symbol carries one byte as two tones playing
 * together: the high nibble picks one of 16 tones in the lower band, the low
 * nibble one of 16 in the upper band. A frame is a preamble (a pattern of
 * tones speech doesn't make), a length byte, then the bytes. There's no error
 * correction: the handshake code has its own CRC, and the sender plays the
 * code several times, so the listener keeps the first copy that checks out.
 *
 * Tunings are in `GAME_CONFIG.net.sound`.
 */
import { GAME_CONFIG } from '../config';

export interface ModemSettings {
  symbolMs: number;
  bandHz: readonly [number, number] | readonly number[];
  toneSpacingHz: number;
  amplitude: number;
  minDominance: number;
}

const DEFAULTS: ModemSettings = GAME_CONFIG.net.sound;

/** The preamble, as (lower band tone, upper band tone) pairs. */
const PREAMBLE: readonly (readonly [number, number])[] = [
  [0, 15],
  [15, 0],
  [0, 15],
  [15, 0],
  [5, 10],
];

const MAX_FRAME_BYTES = 255;

/** A tone's frequency: band 0 or 1, tone 0–15. */
function toneHz(s: ModemSettings, band: number, tone: number): number {
  return s.bandHz[band]! + tone * s.toneSpacingHz;
}

/** Samples for one frame carrying `bytes` (at most 255). */
export function modulate(bytes: Uint8Array, sampleRate: number, settings: ModemSettings = DEFAULTS): Float32Array {
  if (bytes.length > MAX_FRAME_BYTES) throw new Error('Too long for one frame');
  const symbols: [number, number][] = [...PREAMBLE.map(([a, b]) => [a, b] as [number, number])];
  for (const byte of [bytes.length, ...bytes]) symbols.push([byte >> 4, byte & 15]);
  const perSymbol = Math.round((settings.symbolMs / 1000) * sampleRate);
  // A short fade at each end of a symbol keeps the speaker from clicking.
  const fade = Math.round(0.004 * sampleRate);
  const out = new Float32Array(perSymbol * symbols.length);
  symbols.forEach(([low, high], i) => {
    const f1 = toneHz(settings, 0, low);
    const f2 = toneHz(settings, 1, high);
    for (let n = 0; n < perSymbol; n++) {
      const t = (i * perSymbol + n) / sampleRate;
      const ramp = Math.min(1, n / fade, (perSymbol - 1 - n) / fade);
      out[i * perSymbol + n] = settings.amplitude * ramp * (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t));
    }
  });
  return out;
}

/** Energy at one frequency over a window (Goertzel), with a Hann window applied. */
function goertzel(samples: Float32Array, start: number, length: number, hz: number, sampleRate: number, hann: Float32Array): number {
  const coeff = 2 * Math.cos((2 * Math.PI * hz) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (let n = 0; n < length; n++) {
    const s0 = samples[start + n]! * hann[n]! + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

interface Heard {
  /** The loudest tone in each band. */
  tones: [number, number];
  /** How clearly: the weaker band's share of energy in its loudest tone. */
  dominance: number;
}

/**
 * Listens to audio as it arrives (any chunk size) and returns each frame it
 * hears. Keeps only a few seconds of audio.
 */
export class ModemListener {
  private readonly s: ModemSettings;
  private readonly perSymbol: number;
  private readonly windowLength: number;
  private readonly windowOffset: number;
  private readonly hop: number;
  private readonly hann: Float32Array;
  private buffer: Float32Array;
  private filled = 0;
  /** The next window start to scan for a preamble, within the buffer. */
  private scanAt = 0;
  /** A preamble heard, and the frame length after it, while the rest of the frame arrives. */
  private locked: { start: number; length: number } | null = null;

  constructor(
    private readonly sampleRate: number,
    settings: ModemSettings = DEFAULTS,
  ) {
    this.s = settings;
    this.perSymbol = Math.round((settings.symbolMs / 1000) * sampleRate);
    // Listen to the middle 80% of a symbol, away from its fades and any echo of the one before.
    this.windowLength = Math.round(this.perSymbol * 0.8);
    this.windowOffset = Math.round(this.perSymbol * 0.1);
    this.hop = Math.max(1, Math.round(this.perSymbol / 8));
    this.hann = Float32Array.from({ length: this.windowLength }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (this.windowLength - 1)));
    this.buffer = new Float32Array(this.perSymbol * (PREAMBLE.length + 1 + MAX_FRAME_BYTES) + sampleRate);
  }

  /** Feed audio; returns the frames completed by it (usually none). */
  push(chunk: Float32Array): Uint8Array[] {
    const frames: Uint8Array[] = [];
    let at = 0;
    while (at < chunk.length) {
      const room = this.buffer.length - this.filled;
      if (room === 0) this.drop(this.perSymbol * 4);
      const take = Math.min(chunk.length - at, this.buffer.length - this.filled);
      this.buffer.set(chunk.subarray(at, at + take), this.filled);
      this.filled += take;
      at += take;
      frames.push(...this.scan());
    }
    return frames;
  }

  /** Forget the oldest `count` samples. */
  private drop(count: number): void {
    const n = Math.min(count, this.filled);
    this.buffer.copyWithin(0, n, this.filled);
    this.filled -= n;
    this.scanAt = Math.max(0, this.scanAt - n);
    if (this.locked) this.locked = this.locked.start >= n ? { ...this.locked, start: this.locked.start - n } : null;
  }

  private hear(symbolStart: number): Heard {
    const start = symbolStart + this.windowOffset;
    const tones: [number, number] = [0, 0];
    let dominance = 1;
    for (let band = 0; band < 2; band++) {
      let best = 0;
      let bestEnergy = -1;
      let total = 0;
      for (let tone = 0; tone < 16; tone++) {
        const e = goertzel(this.buffer, start, this.windowLength, toneHz(this.s, band, tone), this.sampleRate, this.hann);
        total += e;
        if (e > bestEnergy) {
          bestEnergy = e;
          best = tone;
        }
      }
      tones[band] = best;
      dominance = Math.min(dominance, total > 0 ? bestEnergy / total : 0);
    }
    return { tones, dominance };
  }

  private matchesPreamble(start: number): number {
    let worst = 1;
    for (let i = 0; i < PREAMBLE.length; i++) {
      const heard = this.hear(start + i * this.perSymbol);
      const [a, b] = PREAMBLE[i]!;
      if (heard.tones[0] !== a || heard.tones[1] !== b || heard.dominance < this.s.minDominance) return 0;
      worst = Math.min(worst, heard.dominance);
    }
    return worst;
  }

  private scan(): Uint8Array[] {
    const frames: Uint8Array[] = [];
    const preambleSamples = PREAMBLE.length * this.perSymbol;
    for (;;) {
      if (this.locked === null) {
        // Look for a preamble, a hop at a time.
        if (this.scanAt + preambleSamples + 8 * this.hop + this.perSymbol > this.filled) break;
        const score = this.matchesPreamble(this.scanAt);
        if (score === 0) {
          this.scanAt += this.hop;
          continue;
        }
        // The next few hops may match too: line up on the clearest.
        let best = this.scanAt;
        let bestScore = score;
        for (let k = 1; k < 8; k++) {
          const sc = this.matchesPreamble(this.scanAt + k * this.hop);
          if (sc > bestScore) {
            bestScore = sc;
            best = this.scanAt + k * this.hop;
          }
        }
        const length = this.readByte(best + preambleSamples);
        if (length === null || length === 0) {
          this.scanAt += this.hop;
          continue;
        }
        this.locked = { start: best, length };
      }
      // Locked on a preamble: wait for the whole frame, then read it.
      const dataStart = this.locked.start + preambleSamples + this.perSymbol;
      const end = dataStart + this.locked.length * this.perSymbol;
      if (end > this.filled) break;
      const bytes = new Uint8Array(this.locked.length);
      let ok = true;
      for (let i = 0; i < bytes.length && ok; i++) {
        const byte = this.readByte(dataStart + i * this.perSymbol);
        if (byte === null) ok = false;
        else bytes[i] = byte;
      }
      const preambleAt = this.locked.start;
      this.locked = null;
      if (ok) {
        frames.push(bytes);
        this.scanAt = end;
      } else {
        this.scanAt = preambleAt + this.hop;
      }
    }
    // Let older audio go, keeping enough to finish a preamble.
    if (this.locked === null && this.scanAt > this.perSymbol * 8) this.drop(this.scanAt - this.perSymbol);
    return frames;
  }

  private readByte(symbolStart: number): number | null {
    const heard = this.hear(symbolStart);
    if (heard.dominance < this.s.minDominance / 2) return null;
    return (heard.tones[0] << 4) | heard.tones[1];
  }
}
