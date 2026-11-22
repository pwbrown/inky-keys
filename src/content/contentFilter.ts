/**
 * The word filter (REQUIREMENTS §6). Every player gets the family-friendly
 * filter: swearing, slurs and explicit words are blocked, and so are the
 * words grouped below, which aren't swearing but don't suit young children.
 *
 * Self-contained (no imports) so the Node build script can use it too.
 * Inflections are matched automatically; terms of 5+ letters also match
 * longer words containing them (see blocklist.ts).
 */

export type ContentGroup = 'identity' | 'toilet' | 'insults' | 'body' | 'substances' | 'violence' | 'mature';

/** Terms in each group (reviewed by hand against the word pack, 2026-11). */
export const GROUP_TERMS: Record<ContentGroup, readonly string[]> = {
  // Not offensive, but best explained by a grown-up rather than met as a typing target.
  identity: ['gay', 'gayer', 'gayest', 'gayness', 'lesbian', 'lesbianism'],
  toilet: [
    'poop', 'nincompoop', 'fart', 'pee', 'weeing', 'burp', 'belch', 'puke', 'vomit', 'snot', 'snotty',
    'snottier', 'snottiest', 'flatulence', 'flatulent', 'potty', 'tush', 'fanny', 'bum', 'turd',
  ],
  insults: [
    'jackass', 'damnation', 'damnable', 'damnably', 'damnedest', 'hellhole', 'crapped', 'crapping',
    'crappier', 'crappiest', 'bloody', 'freaking', 'idiot', 'idiotic', 'moron', 'imbecile', 'imbecilic',
    'imbecility', 'stupid',
  ],
  // Bodies, health and reproduction.
  body: [
    'sperm', 'sexist', 'sexism', 'nonsexist', 'unisex', 'sexless', 'sexton', 'sextet', 'sextant',
    'sexagenarian', 'genital', 'genitalia', 'pubic', 'puberty', 'testicle', 'scrotum', 'scrota', 'ovary',
    'ovaries', 'ovarian', 'ovulate', 'ovulation', 'uterus', 'uteri', 'uterine', 'womb', 'breast', 'bosom',
    'teat', 'lactate', 'lactation', 'menstrual', 'menstruate', 'menstruation', 'tampon', 'condom',
    'pregnant', 'pregnancy', 'pregnancies', 'abortion', 'abortionist', 'fetus', 'placenta', 'miscarriage',
    'stillbirth', 'afterbirth', 'virgin', 'virginity', 'virginal', 'crotch', 'groin', 'buttock', 'rectum',
    'rectal', 'bowel', 'excrement', 'enema', 'laxative', 'constipate', 'constipation', 'circumcise',
    'circumcision', 'syphilis', 'syphilitic', 'herpes', 'venereal',
  ],
  substances: [
    'opium', 'opiate', 'morphine', 'methadone', 'amphetamine', 'marijuana', 'cannabis', 'hashish',
    'narcotic', 'stoned', 'junkie', 'overdose', 'booze', 'boozer', 'drunk', 'drunken', 'drunkard',
    'drunkenly', 'drunkenness', 'liquor', 'whiskys', 'vodka', 'tequila', 'hangover', 'tipsy', 'beer',
    'wine', 'winery', 'wineries', 'wineglass', 'alcohol', 'alcoholic', 'alcoholism', 'cigar', 'cigarette',
    'cigarillo', 'tobacco', 'tobacconist', 'nicotine',
  ],
  // Graphic violence and death.
  violence: [
    'murder', 'murderer', 'murderous', 'murderess', 'murderously', 'homicide', 'homicidal', 'slaughter',
    'slaughterer', 'massacre', 'genocide', 'assassin', 'assassinate', 'strangle', 'strangler',
    'stranglehold', 'behead', 'decapitate', 'decapitation', 'dismember', 'mutilate', 'mutilation',
    'torture', 'torturer', 'maim', 'corpse', 'cadaver', 'cadaverous', 'suicidal', 'lynch', 'lynching',
    'gallows', 'noose', 'kidnap', 'kidnapper', 'kidnapping', 'terrorism', 'terrorist', 'holocaust',
    'executioner', 'electrocute', 'guillotine', 'bloodbath', 'gunshot', 'gunman', 'gunmen', 'gunpoint',
    'shootings', 'castrate', 'castration',
  ],
  // Grown-up themes: sex and relationships, without being explicit.
  mature: [
    'cybersex', 'oversexed', 'sexily', 'sexiness', 'sexpot', 'sexting', 'clitoral', 'phallus', 'phalli',
    'phallic', 'erection', 'erectile', 'ejaculate', 'copulate', 'copulation', 'coitus', 'fornicate',
    'fornication', 'adultery', 'adulterer', 'adulteress', 'adulterous', 'adulteries', 'lust', 'lustful',
    'lustily', 'lustiness', 'lewd', 'smutty', 'smuttier', 'smuttiest', 'raunchy', 'raunchiness',
    'raunchier', 'raunchiest', 'bawdy', 'bawdily', 'bawdiness', 'bawdier', 'bawdiest', 'brothel',
    'prostitute', 'prostitution', 'courtesan', 'concubine', 'seduce', 'seduction', 'seductive', 'seducer',
    'lecher', 'lecherous', 'lechery', 'pervert', 'perversion', 'kinkier', 'kinkiest', 'fetish', 'orgies',
    'orgiastic', 'nudist', 'nudism', 'stripper', 'striptease', 'lingerie', 'brassiere', 'transvestite',
    'transvestism', 'infidelity', 'infidelities', 'spank', 'spanking', 'sadist', 'sadistic', 'masochist',
    'masochism', 'masochistic', 'bimbo', 'floozy', 'trollop', 'wench', 'gigolo', 'molest', 'molestation',
    'molester',
  ],
};

/**
 * Slurs, crude words and sensitive topics the LDNOOBW list misses.
 */
export const ALWAYS_BLOCKED: readonly string[] = [
  'retard', 'chink', 'dyke', 'gook', 'gyp', 'gypped', 'damn', 'crap', 'crappy', 'piss', 'bugger', 'prick',
  'slag', 'hussy', 'harlot', 'strumpet', 'pimp', 'sodomite', 'shag', 'suicide', 'cocaine', 'heroin',
  'goddamn', 'sluttish', 'queer', 'queerly', 'queerness', 'cripple', 'midget', 'psycho', 'gringo',
  'redskin', 'squaw', 'gypsy', 'satanic', 'satanism', 'satanically',
];

/** Every term the filter blocks on top of the LDNOOBW list. */
export const FILTER_TERMS: readonly string[] = [...ALWAYS_BLOCKED, ...Object.values(GROUP_TERMS).flat()];

/**
 * French terms for the family-friendly filter, on top of LDNOOBW's French list,
 * grouped like GROUP_TERMS (drafted by Claude; reviewed with the French word pack).
 * Accents don't matter: the check folds them away.
 */
export const FILTER_TERMS_FR: readonly string[] = [
  // identity
  'homo', 'homos', 'lesbienne', 'lesbiennes',
  // toilet
  'pet', 'prout', 'crotte', 'crottes', 'vomi', 'vomir', 'morve', 'morveux', 'roter', 'fesse', 'fesses',
  'popo', 'zizi', 'kaka', 'pisse', 'urine', 'uriner',
  // insults
  'idiot', 'idiote', 'imbecile', 'cretin', 'cretine', 'debile', 'abruti', 'abrutie', 'stupide', 'pignouf', 'nullard', 'tare', 'taree', 'mongol', 'gogol', 'triso', 'damne',
  // body
  'penis', 'vagin', 'sein', 'seins', 'testicule', 'scrotum', 'uterus', 'ovaire', 'ovaires', 'ovulation',
  'grossesse', 'avortement', 'avorter', 'foetus', 'placenta', 'preservatif', 'menstruation', 'menstruel',
  'puberte', 'pubien', 'pubienne', 'genital', 'genitale', 'genitaux', 'rectum', 'anus', 'anal', 'anale',
  'sperme', 'erection', 'circoncision', 'syphilis', 'venerien', 'nibar', 'nichon', 'nichons', 'tetons',
  'virginite', 'entrejambe', 'laxatif', 'lavement', 'sexe', 'sexes', 'sexuel', 'sexuelle', 'sexuels',
  'sexuelles', 'sexualite', 'sexiste', 'sexisme',
  // substances
  'drogue', 'drogues', 'drogue', 'droguer', 'cocaine', 'heroinomane', 'opium', 'morphine', 'cannabis',
  'haschich', 'marijuana', 'shoote', 'defonce', 'alcool', 'alcools', 'alcoolique',
  'alcoolisme', 'ivre', 'ivres', 'ivresse', 'ivrogne', 'saoul', 'saoule',
  'biere', 'bieres', 'vin', 'vins', 'vodka', 'whisky', 'rhum', 'cognac', 'tequila', 'pastis', 'absinthe',
  'cigarette', 'cigarettes', 'cigare', 'cigares', 'tabac', 'nicotine', 'clope', 'clopes',
  // violence
  'meurtre', 'meurtres', 'meurtrier', 'meurtriere', 'assassin', 'assassinat', 'assassiner', 'homicide',
  'massacre', 'massacrer', 'genocide', 'egorger', 'etrangler', 'decapiter', 'decapite', 'mutiler',
  'torture', 'torturer', 'tortionnaire', 'cadavre', 'cadavres', 'suicide', 'suicider', 'suicidaire',
  'pendaison', 'kidnapper', 'kidnapping', 'enlevement', 'terroriste', 'terrorisme', 'holocauste',
  'bourreau', 'guillotine', 'carnage', 'tuerie', 'fusillade', 'viol', 'violer', 'violeur', 'castrer',
  'castration', 'satanique', 'satanisme',
  // mature
  'erotique', 'erotisme', 'sexy', 'porno', 'pornographie', 'pornographique', 'coit', 'copuler',
  'fornication', 'forniquer', 'adultere', 'adulteres', 'luxure', 'lubrique', 'obscene', 'bordel',
  'prostituee', 'prostitue', 'prostitution', 'proxenete', 'courtisane', 'concubine', 'seduire',
  'seducteur', 'seductrice', 'seduction', 'pervers', 'perverse', 'perversion', 'fetichiste', 'orgie',
  'orgies', 'nudiste', 'nudisme', 'strip', 'striptease', 'lingerie', 'string', 'strings',
  'fessee', 'sadique', 'sadisme', 'masochiste', 'masochisme', 'gigolo', 'pedophile', 'pedophilie',
  'catin', 'trainee', 'gourgandine', 'baisable', 'pucelle', 'puceau', 'amante', 'cocu', 'cocue',
  // slurs and crude words LDNOOBW's French list misses
  'negre', 'negresse', 'bougnoule', 'youpin', 'bicot', 'chintok', 'romanichel', 'manouche', 'gitan',
  'gitane', 'tantouze', 'tarlouze', 'fiotte', 'goudou', 'debile', 'gogole', 'batard',
  'batarde', 'emmerde', 'chiant', 'chiante', 'chieur', 'pisseux', 'enfoire', 'salopard', 'saloperie',
  'garce', 'couillon', 'couillonne', 'pouffe', 'grognasse', 'putassier', 'bourrin', 'baise',
  'nique', 'niquer', 'zob', 'couille', 'fion', 'bamboula', 'boche', 'rital', 'chinetoque', 'came', 'camé',
  'dealer', 'dealers', 'beuh', 'shit', 'teub', 'tafiole',
];

/**
 * The same groups for Spanish words (accents are folded before matching, so
 * these are written without them). Added to LDNOOBW's short Spanish list.
 */
export const FILTER_TERMS_ES: readonly string[] = [
  // identity
  'gay', 'gays', 'lesbiana', 'lesbianas', 'homosexual', 'homosexuales',
  // toilet
  'pedo', 'caca', 'cacas', 'popo', 'mear', 'meado', 'meada', 'meon', 'vomito', 'vomitar',
  'vomitona', 'moco', 'mocos', 'mocoso', 'eructo', 'eructar', 'trasero', 'nalga', 'nalgas', 'pompis',
  'orina', 'orinar', 'excremento', 'mierdoso', 'cagar', 'cagada', 'cagado', 'cagon', 'zurullo', 'pipi',
  // insults
  'idiota', 'idiotas', 'imbecil', 'imbeciles', 'estupido', 'estupida', 'estupidos', 'estupidas',
  'estupidez', 'cretino', 'cretina', 'tarado', 'tarada', 'subnormal', 'mongolo', 'retrasado',
  'retrasada', 'maldito', 'maldita', 'malditos', 'malditas', 'condenado', 'condenada', 'gilipollas',
  'capullo', 'capulla', 'pringado', 'imbecilidad',
  'baboso', 'babosa', 'pendejo', 'pendeja', 'cabron', 'cabrona', 'carajo', 'joder',
  'jodido', 'jodida', 'joderse', 'hostia', 'hostias', 'coñazo', 'puñetero', 'puñetera', 'mamon', 'mamona',
  'huevon', 'huevona', 'boludo', 'boluda', 'pelotudo', 'pelotuda', 'chingar', 'chingada', 'chingado',
  'pinche', 'verga', 'culero', 'culera', 'pajero', 'pajera', 'zorra', 'zorras', 'perra', 'perras',
  // body
  'pene', 'penes', 'vagina', 'vaginas', 'teta', 'tetas', 'tetilla', 'pezon', 'pezones', 
  'testiculo', 'testiculos', 'escroto', 'utero', 'ovario', 'ovarios', 'ovulacion', 'embarazo',
  'embarazada', 'embarazadas', 'aborto', 'abortar', 'feto', 'fetos', 'placenta', 'condon', 'condones',
  'preservativo', 'menstruacion', 'menstrual', 'pubertad', 'pubis', 'genital', 'genitales',
  'anal', 'esperma', 'semen', 'ereccion', 'circuncision', 'sifilis', 'venereo',
  'virgen', 'virginidad', 'entrepierna', 'laxante', 'enema', 'sexo', 'sexos', 'sexual', 'sexuales',
  'sexualidad', 'sexista', 'sexismo', 'culo', 'coño', 'polla', 'cojon', 'cojones',
  'pito', 'chocho', 'concha', 'chucha', 'pija', 'paja', 'pajas',
  // substances
  'droga', 'drogas', 'drogar', 'drogado', 'drogada', 'drogadicto', 'cocaina', 'heroina', 'opio',
  'morfina', 'cannabis', 'hachis', 'marihuana', 'porro', 'porros', 'canuto', 'narcotico', 'narco',
  'narcos', 'alcohol', 'alcoholico', 'alcoholica', 'alcoholismo', 'borracho', 'borracha', 'borrachos',
  'borrachera', 'ebrio', 'ebria', 'embriaguez', 'resaca', 'cerveza', 'cervezas', 'vinos',
  'vodka', 'whisky', 'ron', 'tequila', 'ginebra', 'licor', 'licores', 'champan', 'cigarro', 'cigarros',
  'cigarrillo', 'cigarrillos', 'tabaco', 'nicotina', 'fumar', 'fumador', 'fumadora',
  // violence
  'asesinato', 'asesinatos', 'asesino', 'asesina', 'asesinos', 'asesinar', 'homicidio', 'homicida',
  'masacre', 'genocidio', 'degollar', 'estrangular', 'decapitar', 'decapitado', 'mutilar', 'mutilado',
  'tortura', 'torturar', 'torturado', 'cadaver', 'cadaveres', 'suicidio', 'suicida', 'suicidarse',
  'ahorcar', 'ahorcado', 'secuestro', 'secuestrar', 'secuestrador', 'terrorista', 'terrorismo',
  'holocausto', 'verdugo', 'guillotina', 'matanza', 'carniceria', 'tiroteo', 'violacion', 'violar',
  'violador', 'castrar', 'castracion', 'satanico', 'satanismo', 
  // mature
  'erotico', 'erotica', 'erotismo', 'sexy', 'porno', 'pornografia', 'pornografico', 'coito', 'copular',
  'fornicar', 'fornicacion', 'adulterio', 'adultera', 'adultero', 'lujuria', 'lujurioso', 'obsceno',
  'obscena', 'burdel', 'prostituta', 'prostituto', 'prostitucion', 'proxeneta', 'puta', 'puto',
  'ramera', 'furcia', 'golfa', 'cortesana', 'concubina', 'amante', 'amantes', 'seducir', 'seductor',
  'seductora', 'seduccion', 'pervertido', 'pervertida', 'perversion', 'fetichista', 'orgia', 'orgias',
  'nudista', 'nudismo', 'striptease', 'lenceria', 'tanga', 'sadico', 'sadismo', 'masoquista',
  'masoquismo', 'pedofilo', 'pedofilia', 'cachondo', 'cachonda', 'follar', 'follando', 'calentona',
  'besuquear', 'desnudo', 'desnuda', 'desnudos', 'desnudas', 'cornudo',
  // slurs
  'negrata', 'sudaca', 'moro', 'gitano', 'gitana', 'marica', 'maricon', 'maricona', 'bollera',
  'tortillera', 'travelo', 'panchito', 'mamada', 'bastardo', 'bastarda',
  'hijoputa', 'malparido', 'mierda', 'mongol', 'sodomita', 'destripador',
];
