import { describe, expect, it } from 'vitest';
import { bytesToBase64Url } from '../core/base64url';
import { SaveFormatError, defaultSave } from './schema';
import { decodeTransfer, encodeTransfer, hasTransfer } from './transfer';

describe('transfer links', () => {
  it('carry a save and its player there and back, without word lists', async () => {
    const save = defaultSave();
    save.profile.ink = 4200;
    save.apprentice.unlocked = 9;
    save.keyStats.f = { hits: 120, misses: 4 };
    save.vocab = [{ id: 'x', lang: 'en', topic: 'space', words: ['comet', 'orbit'], enabled: true, fetchedAt: '2026-11-17T00:00:00.000Z' }];
    const fragment = await encodeTransfer(save, { name: 'Pip', badge: 'teal' });
    expect(fragment).toMatch(/^t=[A-Za-z0-9_-]+$/);
    expect(hasTransfer(`#${fragment}`)).toBe(true);
    const back = await decodeTransfer(`#${fragment}`);
    expect(back.player).toEqual({ name: 'Pip', badge: 'teal' });
    expect(back.save).toEqual({ ...save, vocab: [] });
  });

  it('stays short for a typical save', async () => {
    const save = defaultSave();
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') save.keyStats[ch] = { hits: 300, misses: 12 };
    expect((await encodeTransfer(save, { name: 'Pip', badge: 'ink' })).length).toBeLessThan(2000);
  });

  it('falls back to a plain badge and cleans the name', async () => {
    const back = await decodeTransfer(await encodeTransfer(defaultSave(), { name: '  Pip   Two ', badge: 'nope' as never }));
    expect(back.player).toEqual({ name: 'Pip Two', badge: 'ink' });
  });

  it('refuses links that are damaged or aren’t transfers', async () => {
    for (const hash of ['#t=', '#t=***', '#t=AAAA', '#x=1']) await expect(decodeTransfer(hash)).rejects.toBeInstanceOf(SaveFormatError);
    const notTransfer = new Uint8Array(await new Response(
      new Blob([JSON.stringify({ app: 'other' })]).stream().pipeThrough(new CompressionStream('deflate-raw')),
    ).arrayBuffer());
    await expect(decodeTransfer(`#t=${bytesToBase64Url(notTransfer)}`)).rejects.toBeInstanceOf(SaveFormatError);
  });

  it('says when a save is from a newer version of the game', async () => {
    const newer = { ...defaultSave(), version: 999 };
    const fragment = await encodeTransfer(newer as never, { name: 'Pip', badge: 'ink' });
    await expect(decodeTransfer(fragment)).rejects.toMatchObject({ reason: 'newer' });
  });
});
