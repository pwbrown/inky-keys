/**
 * Builds a bundled word pack and blocklist from their sources:
 *
 *   npm run words:build            (English)
 *   npm run words:build -- fr <path to Lexique383.tsv>
 *
 * English
 * - Words: SCOWL size levels 10–50 (common to all English spellings), via the
 *   `wordlist-english` package. The level is kept as a frequency tier.
 * - Blocklist: LDNOOBW English list, via the `naughty-words` package.
 *
 * French
 * - Words: Lexique 3.83 (CC BY-SA 4.0, lexique.org), download Lexique383.zip
 *   and pass its .tsv. Word forms are ranked by frequency (film subtitles and
 *   books, averaged) and split into tiers by rank. Only letters a French
 *   keyboard types directly or with one dead key are kept: words with œ, æ
 *   or ÿ are left out (REQUIREMENTS §13d).
 * - Blocklist: LDNOOBW French list, via `naughty-words`.
 *
 * Writes src/content/<lang>/words.json and blocklist.json, and prints every
 * word the blocklist removed so false positives can be reviewed and added to
 * the language's ALLOW list below. The blocklist also includes the
 * family-friendly filter terms from src/content/contentFilter.ts.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Blocklist, INFLECTIONS } from '../src/content/blocklist.ts';
import { FILTER_TERMS, FILTER_TERMS_FR } from '../src/content/contentFilter.ts';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lang = process.argv[2] ?? 'en';
if (lang !== 'en' && lang !== 'fr') throw new Error(`Unknown language "${lang}" (use en or fr)`);
const outDir = join(root, `src/content/${lang}`);

/** SCOWL size levels, most common first. Index in this list = tier. */
const LEVELS = [10, 20, 35, 40, 50] as const;
const MIN_LENGTH = 2;
const MAX_LENGTH = 12;

/**
 * Real, harmless words the blocklist rules catch by mistake (reviewed by hand
 * from this script's output). Words that are technically fine but read as
 * offensive on screen stay blocked.
 */
const ALLOW: string[] = [
  'amusement', 'amusements', 'basement', 'basements', 'basemen', 'subbasement', 'subbasements',
  'casement', 'casements', 'appeasement', 'appeasements', 'chastisement', 'debasement',
  'debasements', 'abasement', 'advisement', 'disbursement', 'endorsement', 'endorsements',
  'butter', 'butters', 'butted', 'butting', 'buttes', 'socialism', 'socialist', 'socialists',
  'socialistic', 'specialist', 'specialists', 'brimming', 'trimming', 'trimmings', 'shrimping',
  'draping', 'scraping', 'cocoons', 'tycoons', 'spiced', 'spices', 'spicier', 'spiciest',
  'spicing', 'spicy', 'thumping', 'therapist', 'therapists', 'thorny', 'twinkle', 'twinkled',
  'twinkles', 'twinkling', 'twinklings', 'peacocks', 'gamecocks', 'haycocks', 'woodcocks',
  'weathercocks', 'shuttlecocks', 'stopcocks', 'pantyhose', 'horsemen', 'sclerotic', 'escort',
  'escorted', 'escorting', 'escorts', 'pussycat', 'pussycats', 'pussyfoot', 'pussyfooted',
  'pussyfooting', 'pussyfoots', 'snatch', 'snatched', 'snatches', 'snatching', 'snowballing',
  'monger', 'mongers', 'scat', 'scats', 'fingering', 'fingerings', 'domination', 'swinger',
  'swingers', 'debugger', 'debuggers', 'heroine', 'heroines', 'prickle', 'prickled', 'prickles',
  'pricklier', 'prickliest', 'prickling', 'prickly', 'pricked', 'pricking', 'pinprick', 'pinpricks',
  'scrappy', 'crapes', 'retardant', 'retardants',
  // Harmless words containing a term from contentFilter.ts.
  'abreast', 'breastplate', 'breastplates', 'breastbone', 'breastbones', 'breaststroke',
  'breastwork', 'breastworks', 'redbreast', 'redbreasts', 'condominium', 'condominiums',
  'crotchet', 'crotchets', 'crotchety', 'oxymoron', 'squawk', 'squawked', 'squawking', 'squawks',
  'burnoose', 'burnooses', 'congenital', 'congenitally', 'deuterium', 'neutering', 'scrapped',
  'scrapping', 'scrappier', 'scrappiest', 'psychology', 'psychologies', 'psychologist',
  'psychologists', 'angiosperm', 'angiosperms', 'gymnosperm', 'gymnosperms', 'spotty',
  'spottier', 'spottiest', 'spottiness',
];

/** French words the rules catch by mistake (reviewed by hand from this script's output). */
const ALLOW_FR: string[] = [
  'agitant', 'artisanale', 'artisanales', 'asymétrique', 'asymétriques', 'baisemain', 'banale',
  'banalement', 'banales', 'banderille', 'banderilles', 'banderole', 'banderoles', 'baragouine',
  'bastringue', 'bordelais', 'bordelaise', 'bourrelet', 'bourrelets', 'bourrelier', 'braconner',
  'buriné', 'canebière', 'caparaçonné', 'caparaçonnés', 'cartouchière', 'chatterton', 'chatteries',
  'concentrique', 'condamne', 'condamnent', 'condamner', 'condamnera', 'condamneront', 'condamnez',
  'condamné', 'condamnée', 'condamnées', 'condamnés', 'confesse', 'confessent', 'confesser',
  'confesseur', 'confesseurs', 'confessez', 'confessé', 'confessée', 'confessés', 'congénital',
  'congénitale', 'connecte', 'connecter', 'connections', 'connecté', 'connectée', 'connectés',
  'connexion', 'connexions', 'connétable', 'connétables', 'cornichon', 'cornichons', 'croupissent',
  'cuivres', 'cuivrés', 'cyclope', 'cône', 'cônes', 'desseins', 'droguerie', 'droguet',
  'déconnecter', 'déconnecté', 'déguerpissez', 'délivrés', 'désarçonner', 'désarçonné',
  'désarçonnés', 'détrôner', 'détrôné', 'encastrer', 'encyclopédie', 'enlèvement', 'enlèvements',
  'entraînée', 'entraînées', 'excentrique', 'excentriques', 'façonne', 'façonner', 'façonné',
  'façonnée', 'façonnées', 'façonnés', 'fichier', 'fichiers', 'figurine', 'figurines', 'follement',
  'follet', 'follets', 'garçonnet', 'garçonnets', 'gastrique', 'gastriques', 'gerbe', 'gerbes',
  'géométrique', 'géométriques', 'géorgien', 'glapissement', 'givrés', 'infamante', 'ingurgitant',
  'insoupçonné', 'insoupçonnée', 'insoupçonnés', 'jambières', 'kilométrique', 'livres',
  'livresque', 'livrés', 'maçonnerie', 'maçonné', 'maçonnées', 'maîtrisons', 'métrique',
  'métronome', 'nitrique', 'papeterie', 'papeteries', 'pédale', 'pédales', 'pédaler',
  'pédiatrique', 'pissenlit', 'pissenlits', 'pouffer', 'pouffent', 'pouffèrent', 'professeur',
  'professeurs', 'rembourré', 'rembourrée', 'rembourrées', 'rembourrés', 'retapisse', 'retapisser',
  'retapissé', 'rhume', 'rhumes', 'rouspéter', 'récépissé', 'réjouir', 'réjouira', 'réjouirait',
  'réjouiront', 'répéter', 'répétera', 'répéterai', 'répéterais', 'répéterait', 'répéteras',
  'répétèrent', 'salopette', 'salopettes', 'sauvagine', 'sauvagines', 'seine', 'soupçonne',
  'soupçonnent', 'soupçonner', 'soupçonnera', 'soupçonnes', 'soupçonneuse', 'soupçonneux',
  'soupçonnez', 'soupçonné', 'soupçonnée', 'soupçonnés', 'symétrique', 'symétriques', 'tambourine',
  'tambouriner', 'tanche', 'tapisse', 'tapissent', 'tapisser', 'tapisserie', 'tapisseries',
  'tapissé', 'tapissée', 'tapissées', 'tapissés', 'tempêter', 'tourbières', 'tronçonneuse',
  'verroterie', 'verroteries', 'violent', 'violons', 'vivres', 'ébranler', 'ébranlèrent',
  'égocentrique', 'électrique', 'électriques', 'étanche', 'étancher', 'étanches', 'étanchéité',
  'étriqué', 'étriquée', 'étriquées', 'étriqués',
];

/** French: a–z plus the accented letters a French keyboard types (REQUIREMENTS §13d). */
const FRENCH_WORD = /^[a-zàâçéèêëîïôùûü]+$/u;
/** Where French writes œ (or æ) but Lexique writes oe/ae: oeu (cœur, sœur, œuvre), oe- at the start (œil, œsophage), fœtus, cæcum. */
const OE_LIGATURE = /oeu|^oe|foet|coel|caec|taen/;
/** Rank cut-offs for the French tiers (most frequent first), sized like the English ones. */
const FRENCH_TIER_ENDS = [4000, 10000, 25000, 40000, 60000];

function readJson<T>(modulePath: string): T {
  return JSON.parse(readFileSync(require.resolve(modulePath), 'utf8')) as T;
}

const rawTerms = readJson<string[]>(`naughty-words/${lang}.json`);
const terms = [...rawTerms.filter((t) => !t.includes(' ')), ...(lang === 'fr' ? FILTER_TERMS_FR : FILTER_TERMS)];
const allow = lang === 'fr' ? ALLOW_FR : ALLOW;
const blocklist = new Blocklist(terms, allow, INFLECTIONS[lang]);

const seen = new Set<string>();
const tiers: string[][] = [];
const removed: string[] = [];
const length = (word: string) => [...word].length;

function keep(word: string, tier: number): void {
  if (length(word) < MIN_LENGTH || length(word) > MAX_LENGTH || seen.has(word)) return;
  seen.add(word);
  tiers[tier] ??= [];
  if (blocklist.blocksWord(word)) removed.push(word);
  else tiers[tier].push(word);
}

let source: string;
let license: string;
if (lang === 'en') {
  LEVELS.forEach((level, tier) => {
    tiers[tier] = [];
    for (const word of readJson<string[]>(`wordlist-english/english-words-${level}.json`)) {
      if (/^[a-z]+$/.test(word)) keep(word, tier);
    }
  });
  source = 'SCOWL size levels 10, 20, 35, 40, 50 (english-words-*) via wordlist-english 1.2.1';
  license = 'SCOWL license, see licenses/SCOWL.txt';
} else {
  const path = process.argv[3];
  if (!path) throw new Error('Pass the path to Lexique383.tsv (from lexique.org) after "fr"');
  const [header, ...rows] = readFileSync(path, 'utf8').split('\n');
  const col = (name: string) => {
    const i = header!.split('\t').indexOf(name);
    if (i < 0) throw new Error(`Lexique column ${name} missing`);
    return i;
  };
  const [ORTHO, FILMS, BOOKS] = [col('ortho'), col('freqfilms2'), col('freqlivres')];
  // Each spelling appears once per lemma and part of speech, with the same form frequencies.
  const frequency = new Map<string, number>();
  for (const row of rows) {
    const cells = row.split('\t');
    const word = cells[ORTHO]?.normalize('NFC');
    if (!word || !FRENCH_WORD.test(word)) continue;
    // Lexique spells œ as "oe" (soeur, coeur, oeuf): those are œ words, so they're left out too.
    if (OE_LIGATURE.test(word)) continue;
    const f = (Number(cells[FILMS]) + Number(cells[BOOKS])) / 2;
    if (f > 0) frequency.set(word, Math.max(frequency.get(word) ?? 0, f));
  }
  const ranked = [...frequency].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([word]) => word);
  FRENCH_TIER_ENDS.forEach((end, tier) => {
    tiers[tier] = [];
    const from = tier === 0 ? 0 : FRENCH_TIER_ENDS[tier - 1]!;
    for (const word of ranked.slice(from, end)) keep(word, tier);
  });
  source = 'Lexique 3.83 (lexique.org): form frequencies freqfilms2 and freqlivres, ranked into tiers';
  license = 'CC-BY-SA-4.0, see licenses/Lexique-CC-BY-SA-4.0.txt (this file only; the code is MIT)';
}

const wordsPack = {
  locale: lang,
  source,
  license,
  // Space-separated per tier to keep the bundle small.
  tiers: tiers.map((words) => words.sort().join(' ')),
};

const blocklistPack = {
  locale: lang,
  source: `List of Dirty, Naughty, Obscene, and Otherwise Bad Words (LDNOOBW) via naughty-words 1.2.0, plus terms in src/content/contentFilter.ts`,
  license: 'CC-BY-4.0',
  terms: [...new Set(terms.map((t) => t.toLowerCase()))].sort(),
  allow,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'words.json'), JSON.stringify(wordsPack) + '\n');
writeFileSync(join(outDir, 'blocklist.json'), JSON.stringify(blocklistPack, null, 1) + '\n');

console.log(`words: ${tiers.reduce((sum, t) => sum + t.length, 0)}`);
console.log(`blocklist: ${blocklist.size} terms; removed ${removed.length} words:`);
console.log(removed.join(' '));
