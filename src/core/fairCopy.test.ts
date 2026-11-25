import { describe, expect, it } from 'vitest';
import {
  PASSAGES,
  PASSAGE_BREAK,
  PassageDeck,
  backspace,
  chainPassages,
  correctPrefix,
  createFairCopy,
  drawPassages,
  elapsedMs,
  fairCopyResult,
  isFinished,
  marks,
  mistakesLeft,
  remainingMs,
  tick,
  typeKey,
} from './fairCopy';

type Test = ReturnType<typeof createFairCopy>;

/** Type `keys` one every `stepMs` from `from` ("\b" is Backspace). Returns the time of the last key. */
const type = (test: Test, keys: string, from = 0, stepMs = 200) => {
  let now = from;
  for (const ch of keys) {
    if (ch === '\b') backspace(test, now);
    else typeKey(test, ch, now);
    now += stepMs;
  }
  return now - stepMs;
};

describe('Fair Copy', () => {
  it('starts the clock on the first key and stops it on the last character', () => {
    const test = createFairCopy('ink pot');
    expect(elapsedMs(test, 5000)).toBe(0);
    expect(typeKey(test, 'i', 1000)).toEqual(['started', 'correct']);
    const end = type(test, 'nk pot', 1200);
    expect(isFinished(test)).toBe(true);
    expect(elapsedMs(test, end + 10_000)).toBe(end - 1000);
  });

  it('lets mistakes stand: each key lands on the next letter', () => {
    const test = createFairCopy('ink pot');
    type(test, 'inx pot');
    expect(marks(test)).toEqual([true, true, false, true, true, true, true]);
    expect(test.errors).toBe(1);
    expect(test.missedKeys).toEqual({ k: 1 });
    // The last character ends it, mistakes and all.
    expect(isFinished(test)).toBe(true);
    expect(mistakesLeft(test)).toBe(1);
  });

  it('lets Backspace fix a mistake, which still counts against accuracy', () => {
    const test = createFairCopy('ink pot');
    type(test, 'inx');
    expect(backspace(test, 1000)).toEqual(['fixed']);
    type(test, 'k pot', 1200);
    expect(mistakesLeft(test)).toBe(0);
    expect(fairCopyResult(test, 0).accuracy).toBeCloseTo(7 / 8);
  });

  it('charges a word of net speed for each mistake left in', () => {
    // 10 characters in 6 seconds is 20 WPM gross; one mistake left costs 5 characters: 10 WPM net.
    const test = createFairCopy('aaaa bbbbb');
    type(test, 'aaaa bbbbx', 0, 6000 / 9);
    const result = fairCopyResult(test, 99_999);
    expect(result.ms).toBeCloseTo(6000);
    expect(result.netWpm).toBeCloseTo(10);
    expect(result.penaltyWpm).toBeCloseTo(10);
    expect(result.rawWpm).toBeCloseTo(20);
    expect(result.mistakesLeft).toBe(1);
  });

  it('ends a timed test when its time is up, not before', () => {
    const test = createFairCopy(chainPassages(PASSAGES).text, 30_000);
    expect(remainingMs(test, 0)).toBe(30_000);
    typeKey(test, 'I', 1000);
    expect(tick(test, 30_999)).toEqual([]);
    expect(remainingMs(test, 21_000)).toBe(10_000);
    expect(tick(test, 31_000)).toEqual(['finished']);
    expect(elapsedMs(test, 99_999)).toBe(30_000);
    // Keys after the bell don't count.
    expect(typeKey(test, 't', 31_500)).toEqual(['ignored']);
    expect(test.buffer).toBe('I');
  });

  it('reports the slowest keys by their average time', () => {
    const test = createFairCopy('aaa bbb');
    typeKey(test, 'a', 0);
    typeKey(test, 'a', 300);
    typeKey(test, 'a', 600);
    typeKey(test, ' ', 800);
    typeKey(test, 'b', 1600);
    typeKey(test, 'b', 2400);
    typeKey(test, 'b', 3200);
    expect(fairCopyResult(test, 0).slowestKeys.map((k) => k.key)).toEqual(['b', 'a']);
  });

  it('strings passages together for a timed test, with Enter between them', () => {
    const { text, spans } = chainPassages([PASSAGES[1]!, PASSAGES[2]!]);
    expect(spans.map((s) => s.passage)).toEqual([PASSAGES[1], PASSAGES[2]]);
    expect(text).toBe(PASSAGES[1]!.text + PASSAGE_BREAK + PASSAGES[2]!.text);
    expect(spans[1]!.start).toBe(PASSAGES[1]!.text.length + 1);

    // Enter is a key like any other: it goes on to the next passage, and anything else there is a mistake.
    const test = createFairCopy('ab' + PASSAGE_BREAK + 'c');
    expect(typeKey(test, 'a', 0)).toEqual(['started', 'correct']);
    typeKey(test, 'b', 100);
    expect(typeKey(test, ' ', 200)).toEqual(['error']);
    backspace(test, 300);
    expect(typeKey(test, PASSAGE_BREAK, 400)).toEqual(['correct']);
  });

  it('deals every passage before any comes round again, never one twice in a row', () => {
    let seed = 1;
    const deck = new PassageDeck(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
    const dealt = Array.from({ length: PASSAGES.length * 6 }, () => deck.next());
    for (let round = 0; round < 6; round++) {
      const ids = dealt.slice(round * PASSAGES.length, (round + 1) * PASSAGES.length).map((p) => p.id);
      expect(new Set(ids).size).toBe(PASSAGES.length);
    }
    for (let i = 1; i < dealt.length; i++) expect(dealt[i]).not.toBe(dealt[i - 1]);
  });

  it('draws enough passages to outlast a timed test', () => {
    const deck = new PassageDeck(() => 0.5);
    const passages = drawPassages(deck, 1500, PASSAGES[0]);
    expect(passages[0]).toBe(PASSAGES[0]);
    expect(chainPassages(passages).text.length).toBeGreaterThanOrEqual(1500);
    expect(new Set(passages).size).toBe(passages.length);
  });

  it('has passages made only of plain, typeable characters, each with its own id', () => {
    // English: plain ASCII. French and Spanish: plain ASCII plus what their accent chapters teach (no accented capitals).
    const allowed = { en: /^[\x20-\x7e]+$/, fr: /^[\x20-\x7eàâçéèêëîïôùûü]+$/, es: /^[\x20-\x7eáéíóúüñ¿¡]+$/ };
    for (const passage of PASSAGES) {
      expect(passage.text, passage.id).toMatch(allowed[passage.lang]);
      expect(passage.text, passage.id).toBe(passage.text.normalize('NFC'));
    }
    expect(new Set(PASSAGES.map((p) => p.id)).size).toBe(PASSAGES.length);
  });

  it('has French passages with plain punctuation: no guillemets, no non-breaking spaces, straight quotes', () => {
    const french = PASSAGES.filter((p) => p.lang === 'fr');
    expect(french.length).toBeGreaterThanOrEqual(20);
    for (const p of french) expect(p.text, p.id).not.toMatch(/[«»\u00a0\u202f’]/);
  });

  it('has Spanish passages that keep ¿ ¡, in modern spelling, with plain punctuation', () => {
    const spanish = PASSAGES.filter((p) => p.lang === 'es');
    expect(spanish.length).toBeGreaterThanOrEqual(20);
    expect(spanish.some((p) => p.text.includes('¿'))).toBe(true);
    expect(spanish.some((p) => p.text.includes('¡'))).toBe(true);
    for (const p of spanish) {
      expect(p.text, p.id).not.toMatch(/[«»—–’“”…]/);
      // Old spellings: "á" as a word, "fué", "dió"...
      expect(p.text, p.id).not.toMatch(/(^|[^\p{L}])(á|é|ó|fué|fuí|dió|vió)(?![\p{L}])/u);
    }
  });
});

describe('Ink Race rules (mustFix, forgiving)', () => {
  const type = (test: ReturnType<typeof createFairCopy>, keys: string) => {
    let now = 1000;
    const events: string[] = [];
    for (const k of keys) events.push(...(k === '\b' ? backspace(test, (now += 100)) : typeKey(test, k, (now += 100))));
    return events;
  };

  it('lets a few wrong keys land, then blocks until Backspace', () => {
    const test = createFairCopy('abcdefghij', null, { mustFix: true });
    type(test, 'abX');
    expect(correctPrefix(test)).toBe(2);
    // X plus four more: maxWrong (5) keys after the first mistake's position.
    type(test, 'defg');
    expect(test.buffer).toBe('abXdefg');
    expect(type(test, 'h')).toEqual(['blocked']);
    expect(test.buffer).toBe('abXdefg');
    type(test, '\b\b\b\b\bc');
    expect(test.buffer).toBe('abc');
    expect(correctPrefix(test)).toBe(3);
  });

  it('only finishes once every character is right', () => {
    const test = createFairCopy('cat', null, { mustFix: true });
    expect(type(test, 'caX')).not.toContain('finished');
    expect(isFinished(test)).toBe(false);
    expect(type(test, 'z')).toEqual(['blocked']);
    expect(type(test, '\bt')).toContain('finished');
    expect(fairCopyResult(test, 2000).mistakesLeft).toBe(0);
  });

  it('counts a plain letter for an accented one when forgiving', () => {
    const strict = createFairCopy('café', null, { mustFix: true });
    type(strict, 'cafe');
    expect(isFinished(strict)).toBe(false);
    const kind = createFairCopy('café', null, { mustFix: true, forgiving: true });
    expect(type(kind, 'cafe')).toContain('finished');
    expect(kind.buffer).toBe('café');
    expect(kind.errors).toBe(0);
  });

  it('leaves Fair Copy as it was by default', () => {
    const test = createFairCopy('cat');
    expect(type(test, 'caX')).toContain('finished');
    expect(test.mustFix).toBe(false);
  });
});
