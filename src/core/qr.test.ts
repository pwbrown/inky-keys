import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { encodeQr, qrSvg, type QrCode, type QrLevel } from './qr';

/** Renders a code to RGBA pixels, `scale` per module, with the quiet zone, and reads it back. */
function read(code: QrCode, scale = 4): string | null {
  const full = (code.size + 8) * scale;
  const pixels = new Uint8ClampedArray(full * full * 4).fill(255);
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) {
      if (!code.modules[y]![x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + 4) * scale + dy) * full + (x + 4) * scale + dx) * 4;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(pixels, full, full, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

const LINK = 'https://inkykeys.com/#join=AQ' + 'Zx9_-aB3'.repeat(16) + 'xyz';

describe('encodeQr', () => {
  it('reads back a Play together link', () => {
    const code = encodeQr(LINK);
    expect(code.size).toBe(code.version * 4 + 17);
    expect(read(code)).toBe(LINK);
  });

  it('picks the smallest version that fits', () => {
    expect(encodeQr('a').version).toBe(1);
    expect(encodeQr('x'.repeat(14), 'M').version).toBe(1);
    expect(encodeQr('x'.repeat(15), 'M').version).toBe(2);
    expect(encodeQr(LINK, 'M').version).toBeLessThanOrEqual(10);
  });

  it.each(['L', 'M', 'Q', 'H'] as QrLevel[])('reads back every length up to version 15 at level %s', (level) => {
    for (let length = 1; length <= 300; length += 7) {
      const text = Array.from({ length }, (_, i) => 'Az0-_#/:.é'[i % 10]).join('');
      const code = encodeQr(text, level);
      if (code.version > 15) break;
      expect(read(code), `length ${length}, version ${code.version}`).toBe(text);
    }
  });

  it('rejects text too long for any version', () => {
    expect(() => encodeQr('x'.repeat(3000), 'H')).toThrow(RangeError);
  });

  it('draws an SVG with a quiet zone and an escaped label', () => {
    const svg = qrSvg(encodeQr('hi'), 'A "code" & more');
    expect(svg).toContain('viewBox="0 0 29 29"');
    expect(svg).toContain('aria-label="A &#34;code&#34; &#38; more"');
  });
});
