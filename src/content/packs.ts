/**
 * Content packs, one per words language (REQUIREMENTS §11, §13d). Each loads
 * lazily, so a player only downloads the words they type.
 */
import type { Language } from '../core/languages';
import type { SeasonId } from '../core/seasons';
import { Blocklist, INFLECTIONS } from './blocklist';
import { entriesFromTiers, type WordEntry } from './wordPool';

export interface ContentPack {
  locale: Language;
  /** Every word the family-friendly filter allows. */
  words: WordEntry[];
  /** What the filter blocks: for made-up strings and downloaded words. */
  blocklist: Blocklist;
  /** Holiday words by season; a season a language doesn't keep has none. */
  holidays: Readonly<Partial<Record<SeasonId, readonly string[]>>>;
}

interface WordsJson {
  tiers: string[];
}
interface BlocklistJson {
  terms: string[];
  allow: string[];
}

function build(locale: Language, words: WordsJson, blocked: BlocklistJson, holidays: ContentPack['holidays']): ContentPack {
  return {
    locale,
    words: entriesFromTiers(words.tiers),
    blocklist: new Blocklist(blocked.terms, blocked.allow, INFLECTIONS[locale]),
    holidays,
  };
}

/** Load the words for a language. Each language's files are their own chunks. */
export async function loadPack(lang: Language): Promise<ContentPack> {
  if (lang === 'fr') {
    const [words, blocked, holidays] = await Promise.all([import('./fr/words.json'), import('./fr/blocklist.json'), import('./fr/holidays')]);
    return build('fr', words.default, blocked.default, holidays.HOLIDAY_WORDS);
  }
  const [words, blocked, holidays] = await Promise.all([import('./en/words.json'), import('./en/blocklist.json'), import('./en/holidays')]);
  return build('en', words.default, blocked.default, holidays.HOLIDAY_WORDS);
}
