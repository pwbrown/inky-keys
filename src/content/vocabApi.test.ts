import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../core/config';
import { Blocklist } from './blocklist';
import { VocabError, articleText, cleanTopic, fetchTopicWords, topicUrl, wordsFromArticle, type Dictionary } from './vocabApi';

const blocklist = new Blocklist(['darn']);

/** Tier 0 is everyday English; higher tiers are rarer. */
const dictionary: Dictionary = new Map([
  ['the', 0],
  ['and', 0],
  ['water', 0],
  ['is', 0],
  ['ocean', 1],
  ['sea', 1],
  ['reef', 2],
  ['reefs', 2],
  ['tide', 2],
  ['coral', 2],
  ['salinity', 3],
  ['pelagic', 4],
  ['john', 2],
  ['mid', 2],
  ['darn', 2],
  ['mi', 2],
]);

const ARTICLE = [
  'The ocean is water. The sea and the ocean meet the reef, and reefs grow coral.',
  'Coral reefs line the shore at high tide and low tide.',
  'Salinity varies, as shown by John Smith, and John wrote a mid-ocean survey of 40 mi. Darn.',
  'Pelagic fish swim far out.',
].join(' ');

/** Enough distinct rare words to pass the minimum. */
const bigDictionary: Dictionary = new Map(Array.from({ length: 40 }, (_, i) => [`word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, 4]));
const BIG_ARTICLE = `${[...bigDictionary.keys()].join(' ')} `.repeat(30);

const pageResponse = (extract: string, extra: object = {}) => ({ query: { pages: [{ title: 'Ocean', extract, ...extra }] } });

const fakeFetch = (body: unknown, status = 200) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
};

describe('vocabulary download', () => {
  it('accepts plain topics and rejects odd ones', () => {
    expect(cleanTopic('  Deep   Sea ')).toBe('deep sea');
    expect(cleanTopic("rock 'n' roll")).toBe("rock 'n' roll");
    expect(cleanTopic('a')).toBeNull();
    expect(cleanTopic('<script>')).toBeNull();
    expect(cleanTopic('x'.repeat(41))).toBeNull();
  });

  it('ranks words that stand out in the article, dropping prefixes and everyday words', () => {
    const words = wordsFromArticle(ARTICLE, 'ocean', dictionary, blocklist);
    expect(words[0]).toBe('ocean');
    expect(words).toEqual(expect.arrayContaining(['reef', 'coral', 'tide', 'salinity', 'pelagic']));
    // Everyday (tier 0), a hyphen prefix, too short, blocked, a plural of a kept word, new words seen once.
    for (const dropped of ['the', 'water', 'mid', 'mi', 'darn', 'reefs', 'smith', 'survey']) expect(words).not.toContain(dropped);
    // A commoner word seen once doesn't count; a rare one does.
    expect(wordsFromArticle('sea pelagic', 'fish', dictionary, blocklist)).toEqual(['pelagic']);
  });

  it('puts names and words the pack doesn’t have first', () => {
    const text = [
      'The ocean saga follows Luke Skywalker, a farm boy on Tatooine.',
      'Then Skywalker meets the Jedi and learns the ways of the Jedi from Kenobi.',
      'On Tatooine, Luke builds a lightsaber. A lightsaber glows; the sea is calm.',
      'Kenobi trains Luke. The NASA ISBN NASA ISBN came out in January, and in January again.',
      'Zażółć zażółć appears twice, and Zorgon zorgon is blocked.',
    ].join(' ');
    const words = wordsFromArticle(text, 'saga', dictionary, new Blocklist(['zorgon']));
    expect(words.slice(0, 1)).toEqual(['saga']);
    // Names (capitalised) first, then other new words, then pack words.
    expect(words.slice(1, 6).sort()).toEqual(['jedi', 'kenobi', 'luke', 'skywalker', 'tatooine']);
    expect(words).toContain('lightsaber');
    expect(words.indexOf('lightsaber')).toBeGreaterThan(words.indexOf('luke'));
    // Seen once, all capitals, a month, letters the words language doesn't have, blocked.
    for (const dropped of ['farm', 'boy', 'nasa', 'isbn', 'january', 'zażółć', 'zorgon']) expect(words).not.toContain(dropped);
  });

  it('takes a word made from a pack word for that pack word’s tier, not as new', () => {
    // "tides" folds into "tide"; "reefing" comes from "reef" (tier 2) and needs two sightings like any tier-2 word.
    const words = wordsFromArticle('Tides and tide. The reefing went on.', 'x', dictionary, blocklist);
    expect(words).toContain('tide');
    expect(words).not.toContain('tides');
    expect(words).not.toContain('reefing');
  });

  it('keeps at most the configured number of words', () => {
    const letters = (i: number) => [i % 26, Math.floor(i / 26) % 26].map((n) => String.fromCharCode(97 + n)).join('');
    const many: Dictionary = new Map(Array.from({ length: 400 }, (_, i) => [`word${letters(i)}`, 4]));
    const text = [...many.keys()].join(' ');
    expect(wordsFromArticle(text, 'x', many, blocklist)).toHaveLength(GAME_CONFIG.vocab.maxWords);
  });

  it('reads the article and refuses disambiguation pages and stubs', () => {
    expect(articleText(pageResponse(BIG_ARTICLE))).toBe(BIG_ARTICLE);
    expect(articleText(pageResponse(BIG_ARTICLE, { pageprops: { disambiguation: '' } }))).toBeNull();
    expect(articleText(pageResponse('Too short.'))).toBeNull();
    expect(articleText({ batchcomplete: true })).toBeNull();
    expect(articleText(null)).toBeNull();
  });

  it('asks Wikipedia for the topic only, with nothing identifying', async () => {
    const { impl, calls } = fakeFetch(pageResponse(BIG_ARTICLE));
    const result = await fetchTopicWords('Ocean', bigDictionary, blocklist, impl);
    expect(result.topic).toBe('ocean');
    expect(result.words).toHaveLength(40);
    const url = new URL(calls[0]?.url ?? '');
    expect(calls[0]?.url).toBe(topicUrl('ocean'));
    expect(url.origin).toBe('https://en.wikipedia.org');
    expect(url.searchParams.get('gsrsearch')).toBe('ocean');
    expect(url.searchParams.get('origin')).toBe('*');
    expect(calls[0]?.init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('reports failures with a reason', async () => {
    const reason = async (p: Promise<unknown>) => p.then(() => 'ok', (e: VocabError) => e.reason);
    const get = (body: unknown, status?: number) => fetchTopicWords('ocean', bigDictionary, blocklist, fakeFetch(body, status).impl);
    expect(await reason(fetchTopicWords('?', bigDictionary, blocklist, fakeFetch({}).impl))).toBe('invalid-topic');
    expect(await reason(get({}, 500))).toBe('failed');
    expect(await reason(get({ batchcomplete: true }))).toBe('empty');
    expect(await reason(get(pageResponse('The sea and the water. '.repeat(100))))).toBe('empty');
    const offline = (async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    expect(await reason(fetchTopicWords('ocean', bigDictionary, blocklist, offline))).toBe('offline');
  });
});

describe('French topic words', () => {
  it('asks French Wikipedia and keeps accented words', () => {
    expect(new URL(topicUrl('océan', 'fr')).host).toBe('fr.wikipedia.org');
    expect(new URL(topicUrl('océano', 'es')).host).toBe('es.wikipedia.org');
    expect(new URL(topicUrl('ocean')).host).toBe('en.wikipedia.org');
    const dictionary = new Map([
      ['baleine', 2],
      ['marée', 2],
      ['océan', 1],
    ]);
    const text = 'La baleine nage. La marée monte et la marée descend. La baleine chante dans l’océan, et la baleine plonge. La marée revient.';
    const words = wordsFromArticle(text, 'océan', dictionary, new Blocklist([]), 'fr');
    expect(words).toEqual(expect.arrayContaining(['océan', 'baleine', 'marée']));
    // French letters are fine in new words; Polish ones aren't on a French keyboard.
    expect(wordsFromArticle('Le Nautilus de Némo. Némo et le Nautilus. Łódź, Łódź.', 'x', dictionary, new Blocklist([]), 'fr')).toEqual(['nautilus', 'némo']);
  });
});
