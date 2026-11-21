import { describe, expect, it } from 'vitest';
import { Blocklist } from './blocklist';
import { MIN_WORD_POOL, countTypeableWords, createContentSource, styleWord, wordLetters } from './contentSource';
import { entriesFromTiers } from './wordPool';
import { mulberry32 } from '../core/rng';

const counter = () => {
  let i = 0;
  return () => ((i++ * 0.37) % 1);
};

describe('content source', () => {
  it('serves drip characters from the keys only', () => {
    const content = createContentSource({ keys: ['a', 's', 'a'] });
    expect(content.keys).toEqual(['a', 's']);
    const random = counter();
    for (let i = 0; i < 50; i++) expect(['a', 's']).toContain(content.nextChar(random));
  });

  it('shows heavier-weighted keys more often as drips', () => {
    const content = createContentSource({ keys: ['a', 's'], keyWeights: { s: 3 } });
    let i = 0;
    const random = () => (i++ % 100) / 100;
    const counts = { a: 0, s: 0 };
    for (let n = 0; n < 100; n++) counts[content.nextChar(random) as 'a' | 's']++;
    expect(counts.a).toBe(25);
    expect(counts.s).toBe(75);
  });

  it('uses real words when enough are typeable', () => {
    const words = Array.from({ length: MIN_WORD_POOL }, (_, i) => 'ab'.repeat(1 + (i % 4)) + 'a'.repeat(i));
    const content = createContentSource({ keys: ['a', 'b'], words: entriesFromTiers([words.join(' ')]) });
    expect(content.wordCount).toBe(MIN_WORD_POOL);
    const random = counter();
    for (let i = 0; i < 30; i++) expect(words).toContain(content.nextWord(0.5, random));
  });

  it('falls back to generated strings when no words fit', () => {
    const content = createContentSource({ keys: ['7', '8', '9'], words: entriesFromTiers(['cat dog']) });
    expect(content.wordCount).toBe(0);
    const word = content.nextWord(0.5, counter());
    expect(word).toMatch(/^[789]+$/);
  });

  it('drops blocked words from the pool', () => {
    const content = createContentSource({
      keys: [...'darnheck'],
      words: entriesFromTiers(['darn heck den']),
      blocklist: new Blocklist(['darn', 'heck']),
    });
    expect(content.wordCount).toBe(1);
  });
});

describe('capitals and punctuation', () => {
  it('treats a letter as usable when either case is selected', () => {
    expect([...wordLetters(['a', 'B', '1', ';'])].sort()).toEqual(['a', 'b']);
  });

  it('counts words for any mix of cases', () => {
    const words = entriesFromTiers(['cab bad dab ace']);
    expect(countTypeableWords(words, ['a', 'b', 'c', 'd'])).toBe(3);
    expect(countTypeableWords(words, ['A', 'B', 'C', 'D'])).toBe(3);
    expect(countTypeableWords(words, ['1'])).toBe(0);
  });

  it('types letters only selected as capitals in capitals', () => {
    expect(styleWord('cab', new Set(['C', 'A', 'B']), () => 0.99)).toBe('CAB');
    expect(styleWord('cab', new Set(['c', 'A', 'b']), () => 0.99)).toBe('cAb');
  });

  it('sometimes capitalizes the first letter when both cases are selected', () => {
    const keys = new Set(['c', 'C', 'a', 'b']);
    expect(styleWord('cab', keys, () => 0)).toBe('Cab');
    expect(styleWord('cab', keys, () => 0.99)).toBe('cab');
  });

  it('adds trailing punctuation only from selected keys', () => {
    const words = Array.from({ length: MIN_WORD_POOL }, (_, i) => 'ab'.repeat(1 + (i % 4)) + 'a'.repeat(i));
    const content = createContentSource({ keys: ['a', 'b', ',', '!'], words: entriesFromTiers([words.join(' ')]) });
    let i = 0;
    const random = () => [0.5, 0.1, 0.0, 0.5, 0.6][i++ % 5]!;
    const results = Array.from({ length: 40 }, () => content.nextWord(0.5, random));
    const endings = new Set(results.map((w) => w.at(-1)));
    for (const end of endings) expect(['a', 'b', ',', '!']).toContain(end);
    expect(results.some((w) => /[,!]$/.test(w))).toBe(true);
  });
});

describe('phrases', () => {
  const words = entriesFromTiers([
    Array.from({ length: 40 }, (_, i) => ['flask', 'glass', 'salad', 'dash', 'hall'][i % 5] + 'a'.repeat(Math.floor(i / 5))).join(' '),
  ]);
  const random = (() => {
    let i = 0;
    return () => ((i++ * 0.618) % 1);
  })();

  it('only offers Run-ons when space is selected', () => {
    expect(createContentSource({ keys: [...'asdf'] }).supports('runon')).toBe(false);
    expect(createContentSource({ keys: [...'asdf '] }).supports('runon')).toBe(true);
  });

  it('builds short phrases: two words, three only when hard', () => {
    const content = createContentSource({ keys: [...'asdfghjkl '], words });
    expect(content.nextPhrase(0, random).split(' ')).toHaveLength(2);
    expect(content.nextPhrase(0.69, random).split(' ')).toHaveLength(2);
    const hard = content.nextPhrase(1, random);
    expect(hard.split(' ')).toHaveLength(3);
    expect(hard).toMatch(/^[asdfghjkl ]+$/);
  });

  it('keeps phrase words short', () => {
    const content = createContentSource({ keys: [...'asdfghjkl '], words });
    for (let i = 0; i < 30; i++) {
      for (const word of content.nextPhrase(1, random).split(' ')) expect([...word].length).toBeLessThanOrEqual(6);
    }
  });
});

describe('topic words', () => {
  it('favours downloaded topic words that fit the keys', () => {
    const words = entriesFromTiers([Array.from({ length: 30 }, (_, i) => 'sad' + 'a'.repeat(i)).join(' ')]);
    const content = createContentSource({
      keys: [...'asdfghjkl'],
      words,
      topicWords: ['flask', 'glass', 'flags', 'shall', 'halls', 'ocean'],
    });
    expect(content.topicWordCount).toBe(5);
    let i = 0;
    const random = () => [0.1, 0.5, 0.5][i++ % 3]!;
    const picked = Array.from({ length: 20 }, () => content.nextWord(0.5, random).replace(/[,.;:!?]$/, ''));
    expect(picked.some((w) => ['flask', 'glass', 'flags', 'shall', 'halls'].includes(w))).toBe(true);
  });

  it('checks topic words against the blocklist', () => {
    const content = createContentSource({
      keys: [...'darnheck'],
      topicWords: ['darn', 'heck', 'den', 'dank', 'hen', 'need', 'deck'],
      blocklist: new Blocklist(['darn']),
    });
    expect(content.topicWordCount).toBe(6);
  });
});

describe('holiday words', () => {
  const words = ['flask', 'glass', 'flags', 'shall', 'halls'].map((word) => ({ word, tier: 1 }));
  const keys = [...'flagsh'];
  it('mix in at their share when enough fit the keys', () => {
    const content = createContentSource({ keys, words, seasonWords: ['gash', 'lass', 'gals', 'flag', 'hags', 'snowman'], seasonShare: 1 });
    const random = mulberry32(3);
    for (let i = 0; i < 30; i++) expect(['gash', 'lass', 'gals', 'flag', 'hags']).toContain(content.nextWord(0.5, random).toLowerCase());
  });

  it('spend no random draws when too few fit, so seeded words are unchanged', () => {
    const plain = createContentSource({ keys, words });
    const seasonal = createContentSource({ keys, words, seasonWords: ['gash', 'snowman'], seasonShare: 1 });
    const a = mulberry32(9);
    const b = mulberry32(9);
    for (let i = 0; i < 20; i++) expect(seasonal.nextWord(0.5, b)).toBe(plain.nextWord(0.5, a));
  });
});


describe('accents in content', () => {
  const french = entriesFromTiers(['été fête tête les des ses mes tes fée thé dé et le se te de']);
  const keys = ['e', 't', 'l', 's', 'd', 'm', 'h', 'f'];

  it('only offers accented words once the accented letters are selected', () => {
    const plain = createContentSource({ keys, words: french });
    const random = mulberry32(1);
    for (let i = 0; i < 40; i++) expect(plain.nextWord(0.5, random)).not.toMatch(/[éê]/);
    const withAccents = createContentSource({ keys: [...keys, 'é', 'ê'], words: french });
    expect(withAccents.wordCount).toBe(french.length);
  });

  it('with Forgiving accents, a plain letter lets its accented words in', () => {
    const forgiving = createContentSource({ keys, words: french, forgiving: true });
    expect(forgiving.wordCount).toBe(french.length);
  });

  it('never makes an accented capital the keys can’t type', () => {
    expect(styleWord('été', new Set(['é', 't', 'E', 'e']), () => 0)).toBe('été');
    expect(styleWord('été', new Set(['t', 'É']), () => 1)).toBe('ÉtÉ');
  });

  it('counts extra key presses with the player’s press cost', () => {
    const cost = (ch: string) => (ch === 'ê' ? 1 : 0);
    const content = createContentSource({ keys: [...keys, 'ê'], words: french, pressCost: cost });
    expect(content.extraPresses('fête')).toBe(1);
    expect(content.extraPresses('tête tête')).toBe(2);
    expect(createContentSource({ keys, words: french }).extraPresses('fête')).toBe(0);
  });

  it('leans towards accented words with an accent bias', () => {
    const made = [...'tdlsm'].flatMap((a) => [...'tdlsm'].flatMap((b) => ['e', 'é'].map((v) => a + v + b)));
    const many = entriesFromTiers([made.join(' ')]);
    const k = ['t', 'e', 'd', 'l', 's', 'm', 'é', 'ê'];
    const count = (bias: number) => {
      const c = createContentSource({ keys: k, words: many, accentBias: bias });
      const r = mulberry32(3);
      let n = 0;
      for (let i = 0; i < 300; i++) if (/[éê]/.test(c.nextWord(0.5, r))) n++;
      return n;
    };
    expect(count(3)).toBeGreaterThan(count(1));
  });
});
