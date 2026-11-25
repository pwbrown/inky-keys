import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { ModemListener, modulate } from './modem';

const RATE = 48000;
const payload = Uint8Array.from({ length: 99 }, (_, i) => (i * 37 + 11) & 255);

/** Plays `signal` into a listener in 128-sample chunks (an AudioWorklet's block), with leading audio. */
function listen(signal: Float32Array, rate = RATE): Uint8Array[] {
  const listener = new ModemListener(rate);
  const frames: Uint8Array[] = [];
  for (let at = 0; at < signal.length; at += 128) frames.push(...listener.push(signal.subarray(at, at + 128)));
  return frames;
}

function withRoom(clean: Float32Array, { noise, lead, hum = 0, gain = 1, seed = 1 }: { noise: number; lead: number; hum?: number; gain?: number; seed?: number }): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(lead + clean.length + 4800);
  for (let n = 0; n < out.length; n++) {
    const signal = n >= lead && n < lead + clean.length ? clean[n - lead]! * gain : 0;
    // White noise, plus a wandering tone through the bands (a whistle, a voice's harmonic).
    const wander = hum * Math.sin(2 * Math.PI * (2000 + 800 * Math.sin(n / 20000)) * (n / RATE));
    out[n] = signal + noise * (rand() * 2 - 1) + wander;
  }
  return out;
}

describe('sound modem', () => {
  it('hears a code played cleanly', () => {
    const frames = listen(withRoom(modulate(payload, RATE), { noise: 0, lead: 1234 }));
    expect(frames).toHaveLength(1);
    expect([...frames[0]!]).toEqual([...payload]);
  });

  it('takes about five seconds for a handshake code', () => {
    const seconds = modulate(payload, RATE).length / RATE;
    expect(seconds).toBeGreaterThan(3);
    expect(seconds).toBeLessThan(5);
  });

  it('hears it quietly, through noise and a wandering tone', () => {
    for (const seed of [1, 2, 3]) {
      const room = withRoom(modulate(payload, RATE), { noise: 0.25, hum: 0.05, gain: 0.3, lead: 7000 + seed * 333, seed });
      const frames = listen(room);
      expect(frames.map((f) => [...f])).toContainEqual([...payload]);
    }
  });

  it('hears a code made at another sample rate', () => {
    const frames = listen(modulate(payload, 44100), 44100);
    expect([...frames[0]!]).toEqual([...payload]);
  });

  it('hears nothing in plain noise', () => {
    const frames = listen(withRoom(new Float32Array(RATE * 3), { noise: 0.5, hum: 0.3, lead: 0 }));
    expect(frames).toEqual([]);
  });

  it('hears a repeat after a copy is drowned out', () => {
    const one = modulate(payload, RATE);
    const both = new Float32Array(one.length * 2 + RATE);
    both.set(one, 0);
    both.set(one, one.length + RATE / 2);
    const rand = mulberry32(9);
    // A loud bang over the middle of the first copy.
    for (let n = 50_000; n < 60_000; n++) both[n] = both[n]! + (rand() * 2 - 1) * 3;
    const frames = listen(both);
    expect(frames.map((f) => [...f])).toContainEqual([...payload]);
  });
});
