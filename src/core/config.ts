/**
 * Tunable gameplay numbers. All in one place so balancing never means hunting
 * through logic (REQUIREMENTS §4).
 *
 * Difficulty model:
 *
 *   value = base[kind] × difficulty multiplier
 *             × (1 + chapterStep × chapter) × (1 + pageStep × page)
 *   then clamped to that kind's limits.
 *
 * - Campaign difficulty is chosen when starting a notebook.
 * - Chapters (levels) and pages (waves) each nudge things up a little.
 */

/**
 * Keys a brand-new player starts with in Free Write: all letters, capitals
 * and space (the "All letters" preset, `lettersCapitals` in keySelection.ts),
 * since M29. A player who does really well is offered numbers and symbols
 * too (core/nudges.ts). Beginners who want the home row start the Apprentice
 * course instead.
 */
import type { Grade } from './grade';

export const DEFAULT_KEYS: readonly string[] = [...'abcdefghijklmnopqrstuvwxyz', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ' '];

/**
 * Target types (REQUIREMENTS §3): drips (one character), Scrawlers (a word)
 * and Run-ons (a phrase, fixed with Backspace). Misprints were removed in
 * milestone 17.
 */
export type TargetKind = 'drip' | 'blotling' | 'runon';

export const TARGET_KINDS: readonly TargetKind[] = ['drip', 'blotling', 'runon'];

/**
 * A page in a chapter plan: a target type, or `symbols`, a drip page of only
 * digits and symbols (kept apart from letters; see GAME_CONFIG.symbolPages).
 */
export type PageKind = TargetKind | 'symbols';

/**
 * Bosses, one on the last page of a chapter (GAME_CONFIG.boss):
 * - spill: a big slow word with three lives that splits into Inkmites.
 * - shuffler: its untyped letters reshuffle every few seconds.
 * - bookworm: a chain of short-word segments, typed head first.
 * - squid: a body word guarded by tentacle words that squirt ink.
 * - quill: a rival pen racing you to write the same word.
 */
export type BossKind = 'spill' | 'shuffler' | 'bookworm' | 'squid' | 'quill';
export const BOSS_KINDS: readonly BossKind[] = ['spill', 'bookworm', 'shuffler', 'squid', 'quill'];

/** Which keys a drip page draws from (see CharPool in contentSource.ts). */
export type PagePool = 'all' | 'letters' | 'symbols';

export type Difficulty = 'relaxed' | 'normal' | 'hard' | 'expert';

/** In menu order. */
export const DIFFICULTIES: readonly Difficulty[] = ['relaxed', 'normal', 'hard', 'expert'];

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export interface DifficultyProfile {
  /** Multiplies target speed. */
  speed: number;
  /** Multiplies time between spawns (above 1 means slower spawning). */
  spawnInterval: number;
  /** Added to the most targets allowed on screen. */
  maxOnScreen: number;
  /** Added to word complexity (0..1 scale). */
  complexity: number;
  /** Multiplies ink lost per margin hit. */
  inkLoss: number;
  /** Multiplies the chance of tougher variants (crimson, violet, ghost). */
  variants: number;
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  relaxed: { speed: 0.75, spawnInterval: 1.3, maxOnScreen: -1, complexity: -0.1, inkLoss: 0.5, variants: 0.5 },
  normal: { speed: 1, spawnInterval: 1, maxOnScreen: 0, complexity: 0, inkLoss: 1, variants: 1 },
  hard: { speed: 1.2, spawnInterval: 0.85, maxOnScreen: 1, complexity: 0.1, inkLoss: 1.2, variants: 1.25 },
  expert: { speed: 1.35, spawnInterval: 0.75, maxOnScreen: 1, complexity: 0.2, inkLoss: 1.4, variants: 1.5 },
};

interface KindSettings {
  /** Targets per page. */
  size: number;
  /** Time between spawns, in ms. */
  spawnIntervalMs: number;
  /** Most targets on screen at once. */
  maxOnScreen: number;
  /** Speed in logical px per second. */
  speed: number;
  /** Ink lost when one reaches the margin. */
  inkLoss: number;
}

interface KindLimits {
  maxSize: number;
  minSpawnIntervalMs: number;
  maxOnScreen: number;
  maxSpeed: number;
}

export const GAME_CONFIG = {
  /** Size of the ink reservoir (the player's health). */
  maxInk: 100,
  /** A newly taught creature's guided first try moves at this share of its usual speed. */
  guideSpeedFactor: 0.6,
  /** Below this share of the ink well, the game warns that ink is running low. */
  lowInk: 0.3,
  /** Ink refilled when a chapter is completed, as a fraction of maxInk. */
  chapterInkRefill: 0.3,

  points: {
    /** Per correct character, before the combo multiplier. */
    perChar: 10,
    /** Bonus for finishing a target, before the combo multiplier. */
    perTarget: 25,
  },
  combo: {
    /** Correct keys in a row needed to raise the multiplier by 1. */
    step: 10,
    maxMultiplier: 4,
  },

  /** Page 1 of chapter 1 on Normal, per target type. */
  base: {
    drip: { size: 20, spawnIntervalMs: 1300, maxOnScreen: 6, speed: 85, inkLoss: 10 },
    blotling: { size: 12, spawnIntervalMs: 2600, maxOnScreen: 4, speed: 55, inkLoss: 20 },
    runon: { size: 4, spawnIntervalMs: 7500, maxOnScreen: 2, speed: 28, inkLoss: 25 },
  } satisfies Record<TargetKind, KindSettings>,

  /** Hard limits so late chapters stay humanly possible. */
  limits: {
    drip: { maxSize: 36, minSpawnIntervalMs: 420, maxOnScreen: 10, maxSpeed: 240 },
    blotling: { maxSize: 22, minSpawnIntervalMs: 1000, maxOnScreen: 7, maxSpeed: 150 },
    runon: { maxSize: 7, minSpawnIntervalMs: 4500, maxOnScreen: 3, maxSpeed: 55 },
  } satisfies Record<TargetKind, KindLimits>,

  progression: {
    /** Growth per chapter (level) for speed and spawn rate. */
    chapterStep: 0.12,
    /** Growth per page (wave) within a chapter. */
    pageStep: 0.04,
    /** Extra targets per page, per chapter (as a fraction of the base size). */
    sizeStep: 0.1,
    /** One more target allowed on screen every this many chapters. */
    chaptersPerExtraOnScreen: 2,
    /** Word complexity (0..1): start, per chapter, per page. */
    complexityStart: 0.15,
    complexityPerChapter: 0.12,
    complexityPerPage: 0.03,
  },

  /**
   * Free Write pages in each chapter. Scrawlers (words) are the main wave,
   * with one page of letter drips; `symbols` pages only appear when the
   * keys include enough digits or symbols (`symbolPages`). Later on, Run-ons
   * are sprinkled into Scrawler pages (`sprinkles`). Chapters past the end
   * of this list reuse the last entry.
   */
  chapters: [
    ['drip', 'blotling', 'symbols', 'blotling'],
    ['blotling', 'drip', 'blotling', 'symbols', 'blotling'],
    ['blotling', 'blotling', 'drip', 'blotling', 'symbols', 'blotling'],
    ['blotling', 'drip', 'blotling', 'blotling', 'symbols', 'blotling', 'blotling'],
  ] as PageKind[][],

  /**
   * Digits and symbols get drip pages of their own in Free Write, so they
   * never mix with letters. With fewer than `minKeys` of them selected (say,
   * just the home row's ;), they stay mixed in instead.
   */
  symbolPages: { minKeys: 3 },

  /**
   * Occasional Run-ons on Scrawler pages, for variety without
   * whole pages of them. Chance per spawn: `start` from chapter `fromChapter`
   * (Practice) or `fromApprenticeChapter` (Apprentice, both 0-based), plus
   * `perChapter` after that (Apprentice chapters count `apprentice.pace` each),
   * capped at `max`.
   */
  sprinkles: {
    pageKinds: ['blotling'] as TargetKind[],
    runon: { fromChapter: 3, fromApprenticeChapter: 10, start: 0.1, perChapter: 0.03, max: 0.2 },
    /** Most sprinkled targets on one page, and on screen at once. */
    maxPerPage: 3,
    maxOnScreen: 1,
  },

  /**
   * Drip and Scrawler pages never have more targets on screen than the player
   * has keys (minus `keysMinus`), so the first keystroke always says which
   * one you mean. Matters most with a beginner's two or three keys.
   */
  targetsPerKeys: { keysMinus: 1, min: 2 },

  /** Run-on phrases: how many words, growing with complexity. */
  phraseWords: {
    min: 2,
    max: 3,
    /** Word complexity at which phrases get their third word. */
    longAt: 0.7,
    /** Longest word allowed in a phrase. */
    maxWordLength: 6,
  },

  /** When a key counts as practiced or mastered (DESIGN §4). */
  mastery: {
    /** Correct presses before a key is "practicing" rather than "unfamiliar". */
    practicingHits: 10,
    /** Correct presses needed for "mastered"… */
    masteredHits: 50,
    /** …at this accuracy or better. */
    masteredAccuracy: 0.94,
    /** Suggest new keys once this share of the selected keys is mastered. */
    suggestWhenMastered: 0.75,
    /** How many new keys to suggest at a time. */
    suggestCount: 2,
  },

  /** Page grades by accuracy, best first. Each leak lowers it (see grade.ts). */
  grades: [
    { grade: 'A', minAccuracy: 0.95 },
    { grade: 'B', minAccuracy: 0.9 },
    { grade: 'C', minAccuracy: 0.8 },
    { grade: 'D', minAccuracy: 0.7 },
    { grade: 'F', minAccuracy: 0 },
  ],

  /**
   * Tougher variants (Typer Shark style, in ink colors): crimson creatures
   * need 2 completions in a row, violet ones 3, and ghosts (invisible ink)
   * hide their text until `revealAt` of the way across the page.
   * Chances are per spawn: `start` from chapter `fromChapter` (0-based),
   * plus `perChapter` after that, capped at `max`, then scaled by difficulty.
   */
  variants: {
    kinds: ['drip', 'blotling'] as TargetKind[],
    crimson: { fromChapter: 1, start: 0.1, perChapter: 0.04, max: 0.3 },
    violet: { fromChapter: 4, start: 0.05, perChapter: 0.03, max: 0.18 },
    /**
     * Word complexity is multiplied by this for creatures that start with
     * 2 or 3 lives: they need several words, so each one is shorter.
     */
    complexityScale: { 2: 0.6, 3: 0.4 } as Record<number, number>,
    ghost: { fromChapter: 2, start: 0.08, perChapter: 0.03, max: 0.25 },
    /**
     * Ghost text appears once the creature crosses a point this far from the
     * left edge (fraction of page width), picked at random per ghost: from a
     * quarter to half of the way in from the right edge, where they enter.
     */
    revealAt: { min: 0.5, max: 0.75 },
  },

  /**
   * What a wrong key costs. Points always; ink only once the player has found
   * their feet (never on Relaxed, and not in the first Apprentice chapters,
   * after which it ramps in). A mistake never takes the last of the ink: only
   * a creature reaching the margin can end a run.
   */
  mistakes: {
    points: 15,
    ink: { relaxed: 0, normal: 1, hard: 2, expert: 3 } as Record<Difficulty, number>,
    /** First Apprentice chapter (0-based) where mistakes cost ink. */
    fromApprenticeChapter: 4,
    /** Apprentice chapters over which the ink cost grows to its full amount. */
    rampChapters: 6,
    minInk: 1,
  },

  /**
   * Winning ink back mid-page. A clean run of keys trickles ink in, and when
   * the well is low an ink bottle may cross the page: type its word to drink
   * it. Both get stingier as chapters go by.
   */
  recovery: {
    streak: { keys: 30, keysPerChapter: 1, maxKeys: 60, ink: 3 },
    bottle: {
      /** Only appears while the ink well is below this share. */
      belowInk: 0.6,
      /** Not before this share of the page has spawned. */
      afterSpawned: 0.25,
      /** Chance per ordinary spawn, falling each chapter down to `minChance`. */
      chance: 0.45,
      chancePerChapter: 0.015,
      minChance: 0.12,
      ink: 20,
      /** How much faster than the page's creatures it moves, growing each chapter. */
      speedFactor: 1.1,
      speedPerChapter: 0.02,
      maxSpeedFactor: 1.6,
    },
  },

  /**
   * Abilities. A clean run of keys earns a charge (an ink drop in the HUD);
   * the run needed grows with the chapter, so charges get harder to earn.
   * Active abilities spend charges; passive ones are held and used up
   * automatically. Each unlocks at an Apprentice chapter (0-based, further
   * apart each time) or at a player level, whichever comes first.
   */
  abilities: {
    maxCharges: 3,
    chargeKeys: { base: 25, perChapter: 1, max: 50 },
    /** Harder difficulties need longer runs per charge (the run above times this). */
    chargeKeysFactor: { relaxed: 1, normal: 1.15, hard: 1.35, expert: 1.6 } satisfies Record<Difficulty, number>,
    /**
     * Enter: blot every creature on the page (except a boss) for a share of
     * their points. Costs more charges on Hard and Expert, so it stays rare.
     */
    blotter: {
      cost: { relaxed: 2, normal: 2, hard: 3, expert: 3 } satisfies Record<Difficulty, number>,
      pointsShare: 0.5,
      fromChapter: 1,
      fromLevel: 2,
    },
    /**
     * Passive: forgives the next wrong key. Re-arms after a clean run that
     * grows with the chapter. For `graceMs` after it's used, more wrong keys
     * are quietly ignored: fast typists often hit a few before they notice.
     */
    eraser: { keys: 40, keysPerChapter: 1, maxKeys: 70, fromChapter: 3, fromLevel: 3, graceMs: 1000 },
    /** Pins the page down: every creature crawls for a few seconds. */
    paperweight: { cost: 1, durationMs: 5000, speedFactor: 0.35, fromChapter: 6, fromLevel: 5 },
    /** Shows ghost text and doubles points for a few seconds. */
    highlighter: { cost: 1, durationMs: 6000, pointsFactor: 2, fromChapter: 10, fromLevel: 8 },
    /** Passive: soaks up the next creature to reach the margin. Earned by a page with no leaks. */
    blottingPaper: { fromChapter: 15, fromLevel: 12 },
  },

  /**
   * The Spill: a boss on the last page of every Apprentice chapter. A big,
   * slow Scrawler with three lives and longer words, which splits into small
   * Inkmites (little Scrawlers) when finally blotted.
   */
  boss: {
    /** The Spill (lives, speed and complexity are shared by the one-word bosses). */
    lives: 3,
    speedFactor: 0.6,
    complexityBonus: 0.3,
    inkLossFactor: 2,
    splits: 3,
    splitSpeedFactor: 1.4,
    /** First chapter (0-based) whose last page has a boss: Apprentice, and Free Write. */
    fromApprenticeChapter: 2,
    fromChapter: 1,
    /** Longest word (letters) a Bookworm segment or Squid tentacle should carry, when one can be found. */
    partWordMax: 5,
    /** Drawing size: the main body, a Bookworm segment, a Squid tentacle. */
    scale: { main: 1.5, segment: 1.15, part: 1 },
    /** Bosses take turns in this order, one per chapter, starting with the first. */
    order: BOSS_KINDS,
    /** Untyped letters reshuffle this often. */
    shuffler: { shuffleMs: 2600 },
    /** Segments grow with the chapter; the rest speed up by `speedStep` each time the head pops. */
    bookworm: { segmentsMin: 4, segmentsMax: 6, speedFactor: 0.75, speedStep: 0.12 },
    /**
     * Tentacles guard the body. One left alone for `squirtMs` squirts ink
     * that hides a lane's words for `smudgeMs`, after `warnMs` of warning. They sit in lanes
     * `laneOffsets` from the body (first that fit), and hold
     * `tentacleDx` × the body's width + `tentacleDxStep` × n px right of its
     * left edge, so their arms reach back and out from the body.
     */
    squid: {
      tentacles: 3,
      lives: 2,
      speedFactor: 0.5,
      squirtMs: 6500,
      smudgeMs: 2800,
      /** A tentacle swells and flashes red pen this long before it squirts. */
      warnMs: 1200,
      laneOffsets: [-3, 3, -4, 4, -2, 2, -5, 5],
      tentacleDx: 0.6,
      tentacleDxStep: 40,
    },
    /**
     * The rival writes `cps` letters a second (scaled with the page's speed)
     * after `startDelayMs`; if it finishes first it splashes you for `inkLoss`.
     */
    quill: { cps: 1.5, startDelayMs: 1500, inkLoss: 12 },
  },

  /**
   * Apprentice pacing. `pace` scales chapters into the difficulty curve
   * (0.25 = four Apprentice chapters per step). The first `easeChapters`
   * chapters are gentler still, easing off gradually.
   */
  apprentice: {
    pace: 0.25,
    easeChapters: 8,
    /** At chapter 1: 35% slower, 50% longer between spawns, 3 fewer on screen, 30% shorter pages. */
    easeSpeed: 0.35,
    easeInterval: 0.5,
    easeOnScreen: 3,
    easeSize: 0.3,
    /**
     * Hard and Expert ease in too: over the first `profileEaseChapters`
     * chapters, page settings blend from Normal toward the chosen difficulty,
     * starting `profileEaseFloor` of the way there.
     */
    profileEaseChapters: 10,
    profileEaseFloor: 0.35,
  },

  /**
   * Ink (XP) and levels (rewards.ts). Level n needs levelStep × (n−1) × n ink
   * in total: about 2 pages for level 2, 10 for level 4, 50 for level 8 and
   * 200 for level 15, so unlocks take a while to earn.
   */
  rewards: {
    levelStep: 100,
    /** Ink per point of page score. */
    inkPerScore: 0.1,
    inkPerStar: 15,
    notebookBonus: 500,
  },

  /**
   * Sticker thresholds (core/stickers.ts). Speed stickers need at least
   * `minKeys` correct keys on the page, so a tiny page can't win them.
   */
  stickers: {
    combo: [50, 100, 200],
    wpm: [30, 50, 70],
    minKeys: 60,
    /** Net speed for the Fair Copy stickers: higher than the pages', as a test is all typing. */
    fairCopyWpm: [40, 60, 80],
    /** Beat the Bell: a timed test this long with no mistakes left in. */
    bellSeconds: 60,
    bigScore: 10_000,
    streak: [3, 7, 30],
    /** Levels for the rank stickers: Scribe, Calligrapher, Master. */
    levels: [5, 12, 23],
    halfwayChapter: 14,
    /** A page finished from midnight up to this hour (local time) earns the secret Midnight Oil. */
    lateHour: 4,
  },

  /**
   * The Daily Page (core/daily.ts): one short seeded notebook a day, the same
   * for every player on the same layout, always on Normal. Its pages are
   * tuned like Practice chapter `chapter` (0-based) and the last one brings
   * a boss, a different one each day. Daily #1 was `epoch` (local date).
   */
  daily: {
    epoch: { year: 2026, month: 11, day: 17 },
    chapter: 3,
    plan: ['drip', 'blotling', 'blotling'] as PageKind[],
    /** Results kept for the record (the best score and streaks are kept regardless). */
    keepResults: 60,
    /** A words language's Daily Page includes the accents of its first accent chapters (French: not ë ï ü). */
    accentChapters: 4,
  },

  /**
   * Holiday looks (core/seasons.ts), by the player's local date. Thanksgiving
   * runs from `thanksgiving.daysBefore` days before the fourth Thursday of
   * November through the Sunday after; Christmas through December.
   */
  /**
   * Accented letters (core/accents.ts, REQUIREMENTS §13d): they cost extra key
   * presses on most keyboards (ê is ^ then e), so they count for more.
   */
  accents: {
    /** Each extra key press counts like this many more letters when ranking a word's difficulty. */
    pressWeight: 1,
    /** Each extra key press in a creature's text gives it this much longer to cross the page, in seconds. */
    slowdownSecPerPress: 0.6,
    /** With the "Letters + accents" preset, how much more often words with an accent are picked. */
    practiceWeight: 3,
    /** In the ¿ ¡ chapter, the chance a word comes as a question or exclamation (otherwise 0.2). */
    markChapterPunctuation: 0.6,
    /** An accent chapter's pages (the Contents page's "Accents" part). */
    plan: ['drip', 'blotling', 'blotling'] as TargetKind[],
    /** Accent chapters are paced like this Apprentice chapter (a gentle one: the letters are new). */
    paceChapter: 6,
    /** In an accent chapter, how much more often its new letters come up as drips. */
    newLetterWeight: 8,
    /** In an accent chapter, how strongly words lean towards ones with an accent. */
    chapterWordBias: 6,
  },
  seasons: {
    thanksgiving: { daysBefore: 14, daysAfter: 3 },
    christmas: { from: { month: 12, day: 1 }, to: { month: 12, day: 31 } },
    /** Share of Scrawler words taken from the season's words, when enough fit the player's keys. */
    wordShare: 0.2,
    /** Page decor (render/seasonDecor.ts): kept to the edges and faint, so it never competes with text. */
    decor: {
      alpha: 0.55,
      /** Falling leaves or snowflakes on screen at once (none with reduced motion). */
      fallingLeaves: 5,
      snowflakes: 26,
      /** Falling speed, px/s, and sideways sway, px. */
      fallSpeed: [18, 42],
      sway: 14,
      /** Falling bits stay this faint, below the decor. */
      fallingAlpha: 0.35,
    },
  },

  /**
   * "Ready for more?" (core/nudges.ts): after a Free Write chapter where every
   * page got one of `grades`, offer the Everything keys and/or the next
   * difficulty. Never before chapter `fromChapter` (1-based), and after an
   * answer, not again for `waitChapters` chapters.
   */
  nudges: {
    fromChapter: 5,
    grades: ['A+', 'A'] as Grade[],
    waitChapters: 3,
  },

  /** Each target's speed varies randomly by up to ±this fraction. */
  speedJitter: 0.15,
  /** Empty space to keep behind the last target in a lane before spawning another. */
  laneGapPx: 100,
  /**
   * New targets rush in from the right until their whole word is on the page,
   * then settle to their own speed, so a long word never makes you wait.
   */
  entry: {
    /** Top speed while entering, px/s. */
    speed: 900,
    /** Slows down near the stopping point: speed is at most this × the distance left, per second. */
    brakePerSec: 6,
    /** Entering ends when the right edge is this far inside the page. */
    marginPx: 24,
    /** Never closer than this behind the target ahead in the same lane. */
    gapPx: 40,
  },
  menu: {
    /**
     * Shortcut letters are ignored this long after a menu screen opens, so
     * typing carried over from play (e.g. after an accidental pause) can't
     * restart or quit by mistake.
     */
    shortcutDelayMs: 400,
  },
  /**
   * The bar under capital letters on creatures (src/render/creatures/common.ts),
   * so c/C, s/S, o/O and friends can't be mixed up. Sizes are shares of the font size
   * or of the letter's width.
   */
  capitalTick: {
    /** How far below the text's middle the bar sits, in font sizes. */
    offset: 0.5,
    /** Bar thickness, in font sizes. */
    thickness: 0.09,
    /** Bar length as a share of the letter's width. */
    widthShare: 0.55,
    minWidthPx: 6,
  },
  /** Fair Copy, the typing-speed test (src/core/fairCopy.ts). */
  fairCopy: {
    /** Each mistake left in costs this many characters of net speed (5 = one word, the usual net-WPM rule). */
    errorPenaltyChars: 5,
    /** Lengths of the timed tests, in seconds. */
    timedSeconds: [30, 60],
    /** A key needs this many timed presses to count among the slowest keys. */
    slowKeyMinPresses: 2,
    slowKeysShown: 3,
    /** The scribe cheers every this many correct keys in a row. */
    streakCheer: 30,
    /** The passage's text size, in page pixels. */
    fontSize: 26,
    /** Letters sit this far above their ruled line, so the rule runs under them; only descenders (g, y) dip through it. */
    baselineLift: 4,
  },
  /** Playing together over the local network (src/core/net/, src/net/; REQUIREMENTS §13e). */
  net: {
    /** Players in one game, the host included. */
    maxPlayers: 4,
    /** Local addresses kept in a handshake code. Each costs about 25 characters; two covers IPv4 and IPv6. */
    maxCandidates: 2,
    /** Give up gathering local addresses after this long (some browsers wait for interfaces that never answer). */
    gatherTimeoutMs: 3000,
    /** A connection that hasn't opened this long after both codes are in is reported as unreachable. */
    connectTimeoutMs: 15000,
    /** A joiner waits this long for the host to enter their code. */
    answerWaitMs: 10 * 60 * 1000,
    /** The host checks each player this often (and lines up clocks for countdowns). */
    pingIntervalMs: 2000,
    /** A player not heard from for this long has left. */
    silentTimeoutMs: 8000,
    /** Sound pairing (src/core/net/modem.ts): each symbol is one byte as two tones, one per band. */
    sound: {
      symbolMs: 40,
      /** The two bands' lowest tones; each band has 16 tones `toneSpacingHz` apart. Laptop speakers and mics do well here. */
      bandHz: [1800, 2800],
      toneSpacingHz: 50,
      /** Each tone's loudness, 0..1 (two play at once). */
      amplitude: 0.35,
      /** A code is played this many times, with a pause between, so a listener can catch any copy. */
      repeats: 3,
      gapMs: 600,
      /** A symbol counts as heard when its loudest tone holds at least this share of its band's energy. */
      minDominance: 0.35,
    },
  },
  /** The faint manuscript the scribe writes as a page goes on (src/render/manuscript.ts). */
  manuscript: {
    /** How strong the scribbles are, 0..1. Faint, so they never compete with targets. */
    alpha: 0.13,
    strokeWidth: 1.6,
    /** Left and right edges of the writing, in page pixels from the margin and the right edge. */
    insetLeft: 28,
    insetRight: 48,
    /** The first line starts this much further in, like a paragraph. */
    indent: 44,
    /** Letter widths and heights (x-height, ascenders, descenders). */
    letterWidth: [5, 9],
    xHeight: 8,
    ascender: 19,
    descender: 9,
    /** Chance a letter is tall or hangs below the line. */
    ascenderChance: 0.16,
    descenderChance: 0.1,
    /** Chance a short letter is a small loop (like "e") rather than a hump (like "n"). */
    loopChance: 0.35,
    /** How far a hump leans back at its peak, as a share of its width (under 1 stays open). */
    humpCurl: [0.2, 0.6],
    /** How wide a loop is, as a share of its height (tall letters and descenders always loop). */
    loopWidth: [0.2, 0.3],
    /** Forward lean of the handwriting: sideways shift per pixel of height. */
    slant: 0.28,
    /** Points per letter: more is smoother. */
    letterSteps: 18,
    /** Letters per word, and the gap between words. */
    wordLetters: [2, 9],
    wordGap: [11, 17],
    /** The last line ends somewhere in this share of the width. */
    lastLine: [0.35, 0.7],
    /** Revealed share eases toward progress at this rate per second. */
    revealRate: 1.6,
    /** The heading writes itself in over this long at the start of a page. */
    headingMs: 1200,
    headingAlpha: 0.55,
    /** Blots where a creature got through: darker than the writing, so the damage shows. */
    blotAlpha: 0.38,
    blotRadius: [7, 11],
    /** With nothing written on that line yet, a blot lands this far in from the start. */
    blotNoWriting: 120,
    /** On a boss page, this share of the writing waits for the boss. */
    bossShare: 0.12,
    /** The scribe winces this long when a creature gets through, and cheers this long at the end of a page. */
    winceMs: 900,
    cheerMs: 1400,
    /** The scribe looks up when a creature is this close to the margin (creatures look worried here too). */
    glanceDistance: 240,
  },
  /** Word lists downloaded from a topic's Wikipedia article (src/content/vocabApi.ts). */
  vocab: {
    /** Most words kept from one article. */
    maxWords: 300,
    /** Fewer usable words than this and the download counts as empty. */
    minWords: 20,
    /**
     * How much an appearance counts, by word-pack tier (0 = most common).
     * Tier 0 ("the", "and", "water") is too everyday to say anything about a topic.
     */
    tierWeights: [0, 1, 2.5, 4, 4],
    /** Words of the commoner tiers must appear at least this often to count as related. */
    minCount: 2,
    /** From this tier on, a single appearance is enough (rare words are telling). */
    rareTier: 3,
    /** A word capitalised at least this share of the time is taken for a name. */
    nameShare: 0.6,
    /** How much an appearance of a name counts: above every tier, so "skywalker" and "tatooine" come first. */
    nameWeight: 6,
    /** How much an appearance of another word the pack doesn't have counts ("lightsaber"): like the rarest tier. */
    newWeight: 4,
    /** Names and new words must appear at least this often (one mention is often a passing reference). */
    newMinCount: 2,
  },
};

/** Page types for chapter `chapter` (0-based). */
export function chapterPlan(chapter: number): readonly PageKind[] {
  const chapters = GAME_CONFIG.chapters;
  return chapters[Math.min(chapter, chapters.length - 1)] ?? ['drip'];
}

export interface PageParams {
  kind: TargetKind;
  /** Drip pages: which keys the drips carry. */
  pool: PagePool;
  size: number;
  spawnIntervalMs: number;
  maxOnScreen: number;
  speed: number;
  /** Word difficulty, 0 (easiest) to 1 (hardest). */
  complexity: number;
  inkLoss: number;
  /** Chance per spawn of each tougher variant. */
  variants: VariantChances;
  /** Chance per spawn of a sprinkled Run-on (see GAME_CONFIG.sprinkles). */
  sprinkles: SprinkleChances;
}

export interface SprinkleChances {
  runon: number;
}

type SprinkleSettings = { fromChapter: number; fromApprenticeChapter: number; start: number; perChapter: number; max: number };

/**
 * Chance of a sprinkled Run-on on a page of type `kind`.
 * `apprentice`: count from the Apprentice start chapters, at Apprentice pace.
 */
export function sprinkleChances(
  kind: TargetKind,
  chapter: number,
  apprentice = false,
  canUse: (kind: TargetKind) => boolean = () => true,
): SprinkleChances {
  const s = GAME_CONFIG.sprinkles;
  if (!s.pageKinds.includes(kind)) return { runon: 0 };
  const chance = (c: SprinkleSettings, sprinkled: TargetKind) => {
    const from = apprentice ? c.fromApprenticeChapter : c.fromChapter;
    if (chapter < from || !canUse(sprinkled)) return 0;
    const steps = (chapter - from) * (apprentice ? GAME_CONFIG.apprentice.pace : 1);
    return Math.min(c.max, c.start + c.perChapter * steps);
  };
  return { runon: chance(s.runon, 'runon') };
}

export interface VariantChances {
  /** Needs 2 completions in a row. */
  crimson: number;
  /** Needs 3 completions in a row. */
  violet: number;
  /** Text hidden until partway across (independent of the other two). */
  ghost: number;
}

/** Variant chances for a target type, chapter and difficulty. */
export function variantChances(kind: TargetKind, chapter: number, difficulty: Difficulty): VariantChances {
  const v = GAME_CONFIG.variants;
  if (!v.kinds.includes(kind)) return { crimson: 0, violet: 0, ghost: 0 };
  const scale = DIFFICULTY_PROFILES[difficulty].variants;
  const chance = (c: { fromChapter: number; start: number; perChapter: number; max: number }) =>
    chapter < c.fromChapter ? 0 : Math.min(c.max, c.start + c.perChapter * (chapter - c.fromChapter)) * scale;
  return { crimson: chance(v.crimson), violet: chance(v.violet), ghost: chance(v.ghost) };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Settings for page `page` of chapter `chapter` (both 0-based). `canUse`
 * says whether the player's keys can produce a target type (e.g. Run-ons
 * need the space key); unusable pages become Scrawler pages.
 */
export function pageParams(
  difficulty: Difficulty,
  chapter: number,
  page: number,
  canUse: (kind: TargetKind) => boolean = () => true,
  /** Page types for this chapter (the Apprentice campaign has its own). */
  plan: readonly PageKind[] = chapterPlan(chapter),
): PageParams {
  const entry = plan[page % plan.length] ?? 'drip';
  const planned: TargetKind = entry === 'symbols' ? 'drip' : entry;
  const kind = canUse(planned) ? planned : 'blotling';
  const pool: PagePool = kind !== 'drip' ? 'all' : entry === 'symbols' ? 'symbols' : 'letters';
  const base = GAME_CONFIG.base[kind];
  const limits = GAME_CONFIG.limits[kind];
  const profile = DIFFICULTY_PROFILES[difficulty];
  const p = GAME_CONFIG.progression;

  const growth = (1 + p.chapterStep * chapter) * (1 + p.pageStep * page);

  return {
    kind,
    pool,
    size: Math.round(clamp(base.size * (1 + p.sizeStep * chapter), 1, limits.maxSize)),
    spawnIntervalMs: clamp((base.spawnIntervalMs * profile.spawnInterval) / growth, limits.minSpawnIntervalMs, Infinity),
    maxOnScreen: clamp(
      base.maxOnScreen + profile.maxOnScreen + Math.floor(chapter / p.chaptersPerExtraOnScreen),
      1,
      limits.maxOnScreen,
    ),
    speed: clamp(base.speed * profile.speed * growth, 1, limits.maxSpeed),
    complexity: clamp(
      p.complexityStart + profile.complexity + p.complexityPerChapter * chapter + p.complexityPerPage * page,
      0,
      1,
    ),
    inkLoss: Math.round(base.inkLoss * profile.inkLoss),
    variants: variantChances(kind, chapter, difficulty),
    sprinkles: sprinkleChances(kind, chapter, false, canUse),
  };
}

/** Ink a wrong key costs on this page (GAME_CONFIG.mistakes). `chapter` is 0-based. */
export function mistakeInk(difficulty: Difficulty, chapter: number, apprentice: boolean): number {
  const m = GAME_CONFIG.mistakes;
  const full = m.ink[difficulty];
  if (!apprentice || full === 0) return full;
  if (chapter < m.fromApprenticeChapter) return 0;
  const ramp = Math.min(1, (chapter - m.fromApprenticeChapter + 1) / m.rampChapters);
  return Math.ceil(full * ramp);
}

/** Correct keys in a row needed to win a little ink back, growing with the chapter. */
export function streakKeys(chapter: number): number {
  const s = GAME_CONFIG.recovery.streak;
  return Math.min(s.maxKeys, s.keys + s.keysPerChapter * chapter);
}

/** Chance that an ordinary spawn also sends an ink bottle, and how fast it moves. */
export function bottleParams(chapter: number): { chance: number; speedFactor: number } {
  const b = GAME_CONFIG.recovery.bottle;
  return {
    chance: Math.max(b.minChance, b.chance - b.chancePerChapter * chapter),
    speedFactor: Math.min(b.maxSpeedFactor, b.speedFactor + b.speedPerChapter * chapter),
  };
}
