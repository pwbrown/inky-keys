// Lets PixiJS run under our strict CSP (no 'unsafe-eval'). REQUIREMENTS §9.
import 'pixi.js/unsafe-eval';
import './style.css';
import { countTypeableWords, createContentSource, MIN_WORD_POOL } from './content/contentSource';
import { Blocklist } from './content/blocklist';
import { loadPack, type ContentPack } from './content/packs';
import { LANGUAGE_NAMES, type Language } from './core/languages';
import { ACCENT_CHAPTERS, accentedLetters, accentMethod, howToType, INVERTED_MARKS, needsKeySteps, plainLetter, pressCostFor } from './core/accents';
import { stepText } from './ui/keySteps';
import { openAccentHelp } from './ui/accentHelp';
import { openAccentIntro } from './ui/accentIntro';
import type { Dictionary } from './content/vocabApi';
import { deadKeyMark, isLayoutId, layoutById, setLayoutPlatform } from './content/layouts';
import type { LayoutId } from './content/layouts/types';
import {
  autoPause,
  confirm,
  cycleLock,
  editKey,
  quitToMenu,
  restartPage,
  retryChapter,
  selectDifficulty,
  canRestart,
  startAccents,
  startApprentice,
  startDaily,
  startPractice,
  useAbility,
  useBlotter,
  togglePause,
  pressDeadKey,
  typeChar,
  type EditKey,
} from './core/input';
import { LETTERS_ACCENTS, apprenticePreset, builtInPresets, matchingPreset, remapSelection, type Preset } from './core/keySelection';
import { unlockedAbilities, type ActiveAbility } from './core/abilities';
import { GAME_CONFIG } from './core/config';
import { FixedStepLoop } from './core/loop';
import { improvedKeys } from './core/mastery';
import { accuracy, wpm } from './core/stats';
import { APPRENTICE_CHAPTERS, NEW_KEY_WEIGHT, lessonsFor, apprenticeKeys, apprenticePlan, chapterStars, starsForGrade, totalStars } from './core/campaign';
import { pageGrade, type Grade } from './core/grade';
import { DAILY_PAGES, MARK_SQUARES, dailyId, dailyKeys, dailyPages, dailySeed, streakWeek } from './core/daily';
import { cleanChallengeName, decodeChallenge, encodeChallenge, type Challenge } from './core/challenge';
import { createWorld, isLastPageOfChapter, setContent, stepWorld, switchKeys, type GamePhase } from './core/world';
import { formatNumber, getLocale, setLocale, t, type MessageKey } from './i18n';
import { NOTEBOOK_BONUS, inkForPage, levelForInk, levelProgress, newUnlocks, rankForLevel, stickerUnlocks } from './core/rewards';
import { SaveFormatError, defaultSave, fairCopyKey, migrate, type SaveData } from './storage/schema';
import { MAX_TRANSFER_LENGTH, canTransfer, decodeTransfer, encodeTransfer, hasTransfer, type Transfer } from './storage/transfer';
import { PlayerStore, cleanName, saveKeyFor, uniqueName, type Player } from './storage/profiles';
import { bindKeyboard, setKeyboardPlatform, setTypingFieldLabel, type SpecialKey } from './input/keyboard';
import { PASSAGES, PassageDeck, type Passage } from './core/fairCopy';
import { FairCopySession, fairCopyMode } from './fairCopySession';
import { loadFonts } from './fonts';
import { registerOffline } from './pwa';
import { difficultyLabel, themedHandsArt, type OverlayLinkId } from './render/overlay';
import { Menu } from './ui/menu';
import { Sfx, type Sound } from './audio/sfx';
import { createRenderer } from './render/renderer';
import { keyLabel, prefersReducedMotion, setTheme } from './render/theme';
import { TEXT_SCALE, loadSettings, reducedMotion, saveSettings, type Settings } from './settings';
import {
  chapterBest,
  continueNotebook,
  currentStreak,
  keyWeights,
  pageBestKey,
  awardStickers,
  recordBossBeaten,
  recordDaily,
  recordPageBest,
  stickerFacts,
  mergeKeyStats,
  nextPagePosition,
  recordApprenticePage,
  recordResult,
  recordFairCopy,
  snapshotNotebook,
} from './storage/progress';
import { openBackend, SaveStore } from './storage/store';
import { openSaveData } from './ui/saveData';
import { openSettings } from './ui/settingsDialog';
import { openTypeCase, presetName } from './ui/typeCase';
import { openBriefingDialog } from './ui/briefingDialog';
import { openUnlockDialog, type UnlockedItem } from './ui/unlockDialog';
import { openWordLists } from './ui/wordLists';
import { openWhatsNewDialog } from './ui/whatsNewDialog';
import { showStickerToast } from './ui/stickerToast';
import { hideWordsNote, showWordsNote } from './ui/wordsNote';
import { openChoiceDialog, type Choice } from './ui/choiceDialog';
import { afterChapter, answered, harderThan, nudgesFor, type NudgeKind } from './core/nudges';
import { markKeyboardNoticeSeen, needsKeyboardNotice } from './ui/mobileNotice';
import { STICKERS, type StickerFacts, type StickerGroup } from './core/stickers';
import { RELEASES, compareVersions, releasesToAnnounce, MAX_NEW_RELEASES_SHOWN, type Release } from './core/releases';
import { APP_VERSION, loadSeenVersion, saveSeenVersion } from './version';
import { activeSeason, isSeasonId, type SeasonId } from './core/seasons';

async function main(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app element missing');

  // Comfort settings (REQUIREMENTS §10) and the menu language, applied before anything is drawn.
  let settings: Settings = loadSettings();
  const applyMenuLanguage = () => {
    setLocale(settings.menuLanguage);
    document.documentElement.lang = getLocale();
    setTypingFieldLabel(t('a11y.typingField'));
  };
  applyMenuLanguage();
  registerOffline();

  /** The active player's keyboard layout (it lives in their save). */
  const layout = () => layoutById(store.data.layout);
  /** The words language's accented letters this player can type on their keyboard (core/accents.ts). */
  const typeableAccents = () => accentedLetters(store.data.wordsLanguage).filter((ch) => howToType(ch, layout(), settings.keyboardKind));
  const presets = () => builtInPresets(layout(), typeableAccents());
  /** False only for an accent (or ¿ ¡) this keyboard has no way to type. */
  const canType = (ch: string) => !needsKeySteps(ch) || howToType(ch, layout(), settings.keyboardKind) !== null;
  const backend = await openBackend();
  // Each player on this browser has their own save (storage/profiles.ts).
  const players = await PlayerStore.open(backend, t('players.defaultName'));
  const store = await SaveStore.open(backend, 250, saveKeyFor(players.active.id));

  // Mac or PC keys: what Alt means, and which variant of the layout to show.
  const applyKeyboardKind = () => {
    setKeyboardPlatform(settings.keyboardKind);
    setLayoutPlatform(settings.keyboardKind);
  };
  applyKeyboardKind();
  const sfx = new Sfx();
  /**
   * The holiday season by today's date (core/seasons.ts). In development,
   * `?season=thanksgiving|christmas|none` shows either look on any day.
   */
  const calendarSeason = ((): SeasonId | null => {
    if (import.meta.env.DEV) {
      const asked = new URLSearchParams(location.search).get('season');
      if (asked === 'none') return null;
      if (isSeasonId(asked)) return asked;
    }
    return activeSeason(new Date());
  })();
  /** The season the game dresses up for: none when Holiday looks is off. */
  const season = (): SeasonId | null => {
    if (settings.holidayLooks !== 'on') return null;
    // Thanksgiving is an American holiday: its looks follow an English menu (REQUIREMENTS §13d).
    if (calendarSeason === 'thanksgiving' && settings.menuLanguage !== 'en') return null;
    return calendarSeason;
  };
  const applyColors = () => {
    setTheme(settings.theme);
    document.documentElement.dataset.theme = settings.theme;
    const dressed = season();
    if (dressed) document.documentElement.dataset.season = dressed;
    else delete document.documentElement.dataset.season;
    // Menus and dialogs follow the in-game motion setting, not only the OS one.
    document.documentElement.dataset.motion = reducedMotion(settings, prefersReducedMotion()) ? 'reduced' : 'full';
    sfx.setVolume(settings.volume, settings.muted);
  };
  applyColors();

  const customPresets = (): Preset[] => store.data.customPresets.map((p) => ({ ...p, builtIn: false }));
  /** A dialog (Type Case, Save data…) is open and owns the keyboard. */
  let dialogOpen = false;
  /** Set when the last notebook ended with a new best score, for the game-over card. */
  let newBest = false;
  /** Keys that became mastered on the page just finished, for the graded page. */
  let newlyMastered: string[] = [];
  /** How the page just finished compares with its best score, for the graded page. */
  let pageBest: { previous: number; isNew: boolean; score: number } | null = null;
  /** Grades of the Daily Page's pages so far. */
  let dailyGrades: Grade[] = [];
  /** The Daily Page result just recorded, for its last card. */
  let dailyOutcome: { newBest: boolean; best: number; streak: number } | null = null;
  /** Stickers earned at the end of the page or notebook just finished, for its card. */
  let recentStickers: string[] = [];
  /** Ink earned on the page just finished, and any level-up, for the graded page. */
  let reward: { ink: number; levelUp: number | null; unlocked: string[]; items: UnlockedItem[] } = { ink: 0, levelUp: null, unlocked: [], items: [] };
  /** Grades of the Free Write chapter being played, and a suggestion waiting to show (M29). */
  let chapterGrades: { chapter: number; grades: Grade[] } = { chapter: -1, grades: [] };
  let pendingNudge: { chapter: number; offers: NudgeKind[] } | null = null;
  /** Every key of the Everything preset on the player's layout. */
  const everythingKeys = (): string[] => [...(presets().find((p) => p.id === 'everything')?.chars ?? [])];

  /** The chapter the player has reached in Apprentice (1-based). */
  const apprenticeChapter = () => Math.max(1, Math.min(store.data.apprentice.unlocked, APPRENTICE_CHAPTERS));
  /** Always matches the player's Apprentice progress. */
  const myApprenticePreset = () => apprenticePreset(layout(), apprenticeChapter(), t('preset.apprentice', { chapter: apprenticeChapter() }));

  const describeKeys = (keys: readonly string[]) => {
    const preset = matchingPreset([myApprenticePreset(), ...presets(), ...customPresets()], keys);
    return preset ? presetName(preset) : t('preset.custom');
  };

  // The overlay's handlers only run once the game exists, after the word pack loads.
  const actions: { onLink: (id: OverlayLinkId) => void; start: () => void } = { onLink: () => {}, start: () => {} };

  /**
   * The word pack (~160 kB) loads in the background (M29). Its download
   * starts once the menu is showing, so on a slow connection it doesn't
   * compete with the fonts the menu needs, or earlier if something needs
   * words first. Anything that needs words waits through `withWords`.
   */
  let pack: ContentPack | null = null;
  let packLoading: Promise<ContentPack> | null = null;
  /** Word -> tier, for picking a downloaded article's words (built on first use, per words language). */
  let vocabDictionary: Dictionary | null = null;
  /** The words language of the pack loaded or loading; the player's can change in Settings. */
  let packLanguage: Language | null = null;
  const packReady = (): Promise<ContentPack> => {
    const lang = store.data.wordsLanguage;
    if (packLanguage !== lang || !packLoading) {
      packLanguage = lang;
      pack = null;
      packLoading = loadPack(lang).then((loaded) => {
        if (packLanguage === lang) pack = loaded;
        return loaded;
      });
    }
    return packLoading;
  };
  /**
   * Run `action` now if the words are in, or as soon as they arrive. Only
   * the first request made while waiting runs, so pressing Enter twice can't
   * start a page and then skip its first card.
   */
  let waitingForWords = false;
  const withWords =
    <A extends unknown[]>(action: (...args: A) => void) =>
    (...args: A): void => {
      if (pack) {
        action(...args);
        return;
      }
      if (waitingForWords) return;
      waitingForWords = true;
      // Only on a slow connection: a quiet note so a click doesn't seem ignored.
      const note = window.setTimeout(() => showWordsNote(document.body), 250);
      void packReady().then(() => {
        waitingForWords = false;
        window.clearTimeout(note);
        hideWordsNote();
        action(...args);
        syncMenu();
      });
    };
  /** Until the pack arrives: no words (content made now is replaced before any page starts). */
  const noWords: ContentPack = { locale: 'en', words: [], blocklist: new Blocklist([]), holidays: {} };
  const words = (): ContentPack => pack ?? noWords;

  /**
   * How to type an accented letter, as the note on a creature after a miss
   * ("ê : ^ → E"). On Windows with a US keyboard, a plain accent key or
   * letter arriving instead suggests US-International is off.
   */
  const accentNote = (char: string, key: string): string | null => {
    const steps = howToType(char, layout(), settings.keyboardKind);
    if (!steps) return null;
    const note = t('accent.note', { char, steps: steps.map(stepText).join(' → ') });
    const noDeadKey = accentMethod(layout(), settings.keyboardKind) === 'usInternational' && (steps[0]?.makes === key || ["'", '`', '^', '"', '~'].includes(key) || key === plainLetter(char));
    return noDeadKey ? `${note}\n${t('accent.usIntlOff')}` : note;
  };

  // Fonts first: canvas text is rasterised once, in whatever font is ready.
  await loadFonts();

  const [renderer] = await Promise.all([
    createRenderer(host, {
      onConfirm: () => actions.start(),
      onLink: (id) => actions.onLink(id),
      extraLines: (w) => [...cardLines(w), ...stickerLines(w)],
    }, () => ({
      textScale: TEXT_SCALE[settings.textSize],
      reducedMotion: reducedMotion(settings, prefersReducedMotion()),
      screenEffects: settings.screenEffects,
      pageWriting: settings.pageWriting === 'on',
      accentNote,
      cosmetics: store.data.profile.cosmetics,
      season: season(),
    })),
  ]);

  /** A card's lines from the save and this session (records, ink, level-ups) for the phase. */
  function cardLines(w: { phase: GamePhase; mode: string; difficulty: typeof game.difficulty }): string[] {
        if (w.phase === 'pageCleared') {
          const lines = [];
          if (pageBest && pageBest.previous > 0) {
            lines.push(
              pageBest.isNew
                ? t('overlay.pageBest.new', { previous: formatNumber(pageBest.previous) })
                : t('overlay.pageBest.short', {
                    gap: formatNumber(pageBest.previous - pageBest.score),
                    best: formatNumber(pageBest.previous),
                  }),
            );
          }
          if (newlyMastered.length > 0) lines.push(t('overlay.newlyMastered', { keys: newlyMastered.map(keyLabel).join('  ') }));
          if (reward.ink > 0) lines.push(t('overlay.inkEarned', { ink: reward.ink }));
          if (reward.levelUp) {
            lines.push(t('overlay.levelUp', { level: reward.levelUp, rank: t(`rank.${rankForLevel(reward.levelUp)}` as MessageKey) }));
          }
          if (reward.unlocked.length > 0) lines.push(t('overlay.unlocked', { items: reward.unlocked.join(', ') }));
          return lines;
        }
        if (w.mode === 'daily' && (w.phase === 'gameOver' || w.phase === 'notebookComplete')) {
          if (game.challenge) return challengeLines(game.challenge, game.stats.score);
          if (!dailyOutcome) return [t('overlay.daily.practice')];
          const lines = [
            dailyOutcome.newBest ? t('overlay.daily.newBest') : t('overlay.daily.best', { score: formatNumber(dailyOutcome.best) }),
          ];
          if (dailyOutcome.streak > 1) lines.push(t('overlay.daily.streak', { streak: dailyOutcome.streak }));
          return lines;
        }
        if (w.phase === 'gameOver') {
          return newBest ? [t('overlay.gameOver.newBest', { difficulty: difficultyLabel(w.difficulty) })] : [];
        }
        if (w.phase === 'notebookComplete' && w.mode === 'accents') {
          const lines = [t('overlay.accents.stars', { earned: accentRunStars.reduce((a, b) => a + b, 0), max: 3 * GAME_CONFIG.accents.plan.length })];
          if (reward.ink > 0) lines.push(t('overlay.inkEarned', { ink: reward.ink }));
          return lines;
        }
        if (w.phase === 'notebookComplete') {
          const { earned, max } = totalStars(store.data.apprentice.stars);
          const lines = [t('overlay.complete.stars', { earned, max }), t('overlay.inkEarned', { ink: reward.ink })];
          if (reward.levelUp) {
            lines.push(t('overlay.levelUp', { level: reward.levelUp, rank: t(`rank.${rankForLevel(reward.levelUp)}` as MessageKey) }));
          }
          if (reward.unlocked.length > 0) lines.push(t('overlay.unlocked', { items: reward.unlocked.join(', ') }));
          return lines;
        }
        return [];
  }

  /** How a challenge went: beaten, and by how much, or how far short. Then the day's record, if it counted. */
  function challengeLines(challenge: { score: number; name: string | null }, score: number): string[] {
    const args = { name: challenge.name ?? '', score: formatNumber(challenge.score), gap: formatNumber(Math.abs(score - challenge.score)) };
    const won = score > challenge.score;
    const line = challenge.name
      ? t(won ? 'overlay.challenge.wonBy' : 'overlay.challenge.shortOf', args)
      : t(won ? 'overlay.challenge.won' : 'overlay.challenge.short', args);
    const lines = [line];
    if (dailyOutcome?.newBest) lines.push(t('overlay.daily.newBest'));
    if (dailyOutcome && dailyOutcome.streak > 1) lines.push(t('overlay.daily.streak', { streak: dailyOutcome.streak }));
    return lines;
  }

  /** "New sticker: Gold Star!" on the card that ends a page or notebook. */
  function stickerLines(w: { phase: GamePhase }): string[] {
    if (recentStickers.length === 0) return [];
    if (w.phase !== 'pageCleared' && w.phase !== 'notebookComplete' && w.phase !== 'gameOver') return [];
    return [t('overlay.newSticker', { names: recentStickers.map(stickerName).join(', ') })];
  }

  function stickerName(id: string): string {
    return t(`sticker.${id}.name` as MessageKey);
  }

  /**
   * Content for a key set, weighted toward the player's weak keys and, in the
   * Apprentice campaign, toward the chapter's new (`focus`) keys.
   */
  const contentFor = (keys: readonly string[], focus: readonly string[] = []) => {
    const weights = keyWeights(store.data.keyStats, keys);
    for (const key of focus) weights[key] = (weights[key] ?? 1) * NEW_KEY_WEIGHT;
    // The family-friendly word filter (content/contentFilter.ts) decides which words appear.
    const { blocklist } = words();
    return createContentSource({
      keys,
      words: words().words,
      blocklist,
      trustedWords: true,
      keyWeights: weights,
      pressCost: pressCostFor(layout(), settings.keyboardKind),
      forgiving: store.data.accents.forgiving,
      // "Letters + accents": words lean towards ones with an accent.
      accentBias: matchingPreset(presets(), keys)?.id === LETTERS_ACCENTS ? GAME_CONFIG.accents.practiceWeight : 1,
      // Downloaded words are checked again, in case the filter changed since they were fetched.
      topicWords: store.data.vocab
        .filter((list) => list.enabled && list.lang === store.data.wordsLanguage)
        .flatMap((list) => list.words)
        .filter((word) => !blocklist.blocksWord(word)),
      // Holiday words in season (never on the Daily Page, which is the same for everyone).
      seasonWords: (() => {
        const dressed = season();
        return dressed ? (words().holidays[dressed] ?? []) : [];
      })(),
      seasonShare: GAME_CONFIG.seasons.wordShare,
    });
  };

  /**
   * The Daily Page's content: the same for everyone on a layout, so the
   * no downloaded words and no weak-key weighting.
   */
  const dailyContent = () =>
    createContentSource({
      // Accents the keyboard can't type (á on AZERTY) are left out.
      keys: dailyKeys(layout(), store.data.wordsLanguage).filter(canType),
      words: words().words,
      blocklist: words().blocklist,
      trustedWords: true,
      pressCost: pressCostFor(layout(), settings.keyboardKind),
    });

  const game = createWorld({
    content: contentFor(store.data.keys),
    difficulty: store.data.difficulty,
    makeContent: contentFor,
    layout: layout(),
  });
  /**
   * Abilities this player has earned: by Apprentice chapter reached (including
   * the one being played) or by level.
   */
  const refreshAbilities = () => {
    const reached = Math.max(store.data.apprentice.unlocked - 1, game.mode === 'apprentice' && game.phase !== 'ready' ? game.page.chapter : 0);
    game.abilities = unlockedAbilities(reached, levelForInk(store.data.profile.ink));
  };
  refreshAbilities();
  /** Whether this player wants tips, and which they've already had. */
  const refreshTips = () => {
    game.tips = store.data.tutorials.enabled;
    game.seenMechanics = store.data.tutorials.seen;
  };
  refreshTips();

  // Screen readers can't see the canvas, so in-game hints are also announced here.
  const announcer = document.createElement('div');
  announcer.className = 'visually-hidden';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  document.body.append(announcer);
  /** Large text uses every other line so targets don't overlap. */
  const applyLayout = () => {
    game.targetScale = TEXT_SCALE[settings.textSize];
    game.laneStep = game.targetScale > 1 ? 2 : 1;
  };
  applyLayout();
  game.forgivingAccents = store.data.accents.forgiving;
  const loop = new FixedStepLoop((stepMs) => stepWorld(game, stepMs));

  /** Re-read keys and difficulty from the save (after an import or erase). */
  const applySave = () => {
    game.layout = layout();
    game.forgivingAccents = store.data.accents.forgiving;
    setContent(game, contentFor(store.data.keys));
    // Another player (or an imported save) may type in another language: fetch its words.
    if (packLanguage !== null && packLanguage !== store.data.wordsLanguage) {
      vocabDictionary = null;
      void packReady().then(() => setContent(game, contentFor(store.data.keys)));
    }
    game.selectedDifficulty = store.data.difficulty;
    refreshAbilities();
    refreshTips();
    // An imported save may already have earned stickers.
    giveStickers({}, false);
    menu.refresh();
  };

  /**
   * The first time accented letters come up outside the accent chapters
   * (Free Write, the Daily Page, Fair Copy), show how to type the ones not
   * yet taught, then go on. Skipped with Forgiving accents or tips off.
   */
  const briefAccents = (chars: Iterable<string>, then: () => void) => {
    const seen = new Set(store.data.accents.seen);
    const fresh = [...new Set(chars)].filter((ch) => needsKeySteps(ch) && !seen.has(ch) && howToType(ch, layout(), settings.keyboardKind));
    if (fresh.length === 0 || store.data.accents.forgiving || !store.data.tutorials.enabled || dialogOpen) {
      then();
      return;
    }
    // Teaching order, so the card reads like the accent chapters.
    const order = ACCENT_CHAPTERS[store.data.wordsLanguage].flat();
    fresh.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    dialogOpen = true;
    openAccentIntro(document.body, {
      title: t('accents.newTitle'),
      intro: t('accents.newIntro'),
      startLabel: t('accents.play'),
      letters: fresh.map((char) => ({ char, steps: howToType(char, layout(), settings.keyboardKind) })),
      onHelp: () => openAccentHelpDialog(),
      onClose: (start) => {
        dialogOpen = false;
        store.update((save) => {
          save.accents.seen = [...new Set([...save.accents.seen, ...fresh])];
        });
        if (start) then();
      },
    });
  };

  /** Enter on an in-game card (next page, or retry after game over), or Start on the menu. */
  actions.start = withWords(() => {
    if (dialogOpen) return;
    if (game.phase === 'notebookComplete') {
      goToMenu();
      return;
    }
    // Enter while playing fires the Blotter, if charged.
    if (game.phase === 'playing') {
      useBlotter(game);
      return;
    }
    if (game.phase === 'ready') {
      // A Practice notebook uses the player's own keys, with fresh weak-key weights.
      briefAccents(store.data.keys, () => {
        setContent(game, contentFor(store.data.keys));
        startPractice(game);
        loop.reset();
      });
      return;
    } else {
      confirm(game);
    }
    loop.reset();
  });

  /** Stars of each page of the accent chapter being played. */
  let accentRunStars: number[] = [];

  /**
   * An accent chapter's content: every letter of the course and the accents
   * taught up to and including this chapter, its new letters coming up most.
   */
  const accentContent = (chapter: number) => {
    const chapters = ACCENT_CHAPTERS[store.data.wordsLanguage];
    const fresh = chapters[chapter] ?? [];
    const taught = chapters.slice(0, chapter + 1).flat().filter(canType);
    // ¿ ¡ come with the ? ! that close them.
    const closing = taught.flatMap((ch) => INVERTED_MARKS[ch] ?? []);
    const keys = [...new Set([...apprenticeKeys(layout(), APPRENTICE_CHAPTERS - 1), ...taught, ...closing])];
    const weights = keyWeights(store.data.keyStats, keys);
    for (const key of fresh) weights[key] = (weights[key] ?? 1) * GAME_CONFIG.accents.newLetterWeight;
    return createContentSource({
      keys,
      words: words().words,
      blocklist: words().blocklist,
      trustedWords: true,
      keyWeights: weights,
      pressCost: pressCostFor(layout(), settings.keyboardKind),
      accentBias: GAME_CONFIG.accents.chapterWordBias,
      ...(fresh.some((ch) => ch in INVERTED_MARKS) ? { punctuationChance: GAME_CONFIG.accents.markChapterPunctuation } : {}),
    });
  };

  const startAccentChapter = withWords((chapter: number) => {
    if (dialogOpen || game.phase !== 'ready') return;
    const letters = ACCENT_CHAPTERS[store.data.wordsLanguage][chapter] ?? [];
    store.update((save) => {
      save.accents.seen = [...new Set([...save.accents.seen, ...letters])];
    });
    accentRunStars = [];
    setContent(game, accentContent(chapter));
    startAccents(game, chapter, letters);
    loop.reset();
  });

  const startChapter = withWords((chapter: number) => {
    if (dialogOpen || game.phase !== 'ready') return;
    startApprentice(game, chapter);
    loop.reset();
  });

  /**
   * Today's Daily Page, or the one a challenge link is for. Only the first
   * go at today's counts; a challenge for another day is just for fun.
   */
  const playDaily = withWords((challenge: Challenge | null = null) => {
    if (dialogOpen || game.phase !== 'ready') return;
    const content = dailyContent();
    briefAccents(content.keys, () => {
      const today = dailyId(new Date());
      const id = challenge?.daily ?? today;
      const counted = id === today && store.data.daily.results[id] === undefined;
      setContent(game, content);
      startDaily(
        game,
        id,
        dailySeed(id, challenge?.layout ?? store.data.layout, store.data.wordsLanguage),
        counted,
        challenge ? { score: challenge.score, name: challenge.name } : null,
      );
      dailyGrades = [];
      dailyOutcome = null;
      loop.reset();
    });
  });

  /** Record the Daily Page's result, if this was the day's counted go. */
  const finishDaily = (finished: boolean) => {
    const daily = game.daily;
    if (!daily?.counted) {
      // A practice round after the day's go: nothing to record.
      dailyOutcome = null;
      return;
    }
    daily.counted = false;
    store.update((save) => {
      const previousBest = save.daily.best;
      const recorded = recordDaily(save, daily.id, {
        score: game.stats.score,
        grades: [...dailyGrades],
        wpm: Math.round(wpm(game.stats)),
        accuracy: Math.round(accuracy(game.stats) * 100),
        finished,
        ...(game.forgivingAccents ? { forgiving: true as const } : {}),
      });
      dailyOutcome = recorded
        ? { newBest: game.stats.score > previousBest && game.stats.score > 0, best: save.daily.best, streak: save.daily.streak }
        : null;
    });
    if (dailyOutcome) {
      giveStickers({ daily: { grades: dailyGrades, pages: DAILY_PAGES, finished, streak: store.data.daily.streak } });
    }
  };

  /** The text to copy for today's result, or null before it's played. */
  const dailyShareText = (): string | null => {
    const id = dailyId(new Date());
    const result = store.data.daily.results[id];
    if (!result) return null;
    const streak = currentStreak(store.data.daily, id);
    return t('daily.share', {
      id,
      score: formatNumber(result.score),
      wpm: result.wpm,
      accuracy: result.accuracy,
      pages: dailyPages(result.grades)
        .map((p) => t('daily.sharePage', { page: p.page, square: MARK_SQUARES[p.mark], grade: p.grade ?? t('daily.notReached') }))
        .join(' · '),
      streak: (streak > 1 ? t('daily.shareStreak', { streak }) : '') + (result.forgiving ? t('daily.shareForgiving') : ''),
      url: challengeLink({
        daily: id,
        layout: store.data.layout,
        score: result.score,
        grades: result.grades,
        name: signDaily ? cleanChallengeName(players.active.name) : null,
        words: store.data.wordsLanguage,
      }),
    });
  };

  /** The link a friend opens to take on a result: this page's address, with the challenge after the #. */
  const challengeLink = (challenge: Challenge) => `${location.origin}${location.pathname}#${encodeChallenge(challenge)}`;

  /** Sign challenge links with the player's name (off unless they tick it; only for this visit). */
  let signDaily = false;

  /** A challenge from a link, waiting for the player to take it on. */
  let pendingChallenge: Challenge | null = null;

  /**
   * Read a challenge from the address (#c=…), then clear it from the address
   * bar so a reload doesn't bring it back. A name that the word filter
   * wouldn't allow is dropped.
   */
  const readChallenge = () => {
    if (!new URLSearchParams(location.hash.replace(/^#/, '')).has('c')) return;
    const challenge = decodeChallenge(location.hash, isLayoutId);
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    if (!challenge) return;
    // The name check needs the word filter, which comes with the word pack.
    void packReady().then(({ blocklist }) => {
      if (challenge.name && blocklist.blocksString(challenge.name)) challenge.name = null;
      pendingChallenge = challenge;
      if (game.phase === 'ready' && !dialogOpen) menu.show('challenge');
    });
  };

  /** A save from a transfer link (or why it couldn't be read), waiting for the player to choose. */
  let pendingTransfer: Transfer | { error: string } | null = null;

  /** Read a transfer link (#t=…), clear it from the address bar, and ask what to do with it. */
  const readTransfer = async () => {
    const hash = location.hash;
    if (!hasTransfer(hash)) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    try {
      pendingTransfer = await decodeTransfer(hash);
    } catch (error) {
      pendingTransfer = {
        error: error instanceof SaveFormatError && error.reason === 'newer' ? t('transfer.newer') : t('transfer.damaged'),
      };
    }
    if (game.phase === 'ready' && !dialogOpen) menu.show('transfer');
  };

  /** Links someone opened: a challenge or a transfer. */
  const readLinks = () => {
    readChallenge();
    void readTransfer();
  };

  /** The link that moves the active player to another device. */
  const transferLink = async (): Promise<string | 'tooLong'> => {
    const fragment = await encodeTransfer(store.data, { name: players.active.name, badge: players.active.badge });
    const link = `${location.origin}${location.pathname}#${fragment}`;
    return link.length > MAX_TRANSFER_LENGTH ? 'tooLong' : link;
  };

  /** Keep a transferred save as a new player on this device, and switch to them. */
  const addTransferredPlayer = async () => {
    const pending = pendingTransfer;
    if (!pending || 'error' in pending || dialogOpen || game.phase !== 'ready') return;
    const name = uniqueName(
      pending.player.name || t('players.defaultName'),
      players.list.players.map((p) => p.name),
    );
    const player = await players.add(name, pending.player.badge);
    if (!player) return;
    await backend.save(pending.save, saveKeyFor(player.id));
    pendingTransfer = null;
    await switchPlayer(player.id);
  };

  /** Put a transferred save in place of the active player's. */
  const replaceWithTransfer = async () => {
    const pending = pendingTransfer;
    if (!pending || 'error' in pending || dialogOpen || game.phase !== 'ready') return;
    await store.replace(pending.save);
    pendingTransfer = null;
    applySave();
    renderer.rebuild();
    menu.show('title');
  };

  const continueSaved = withWords(() => {
    const saved = store.data.notebook;
    if (dialogOpen || game.phase !== 'ready' || !saved) return;
    setContent(game, contentFor(store.data.keys));
    continueNotebook(game, saved);
    loop.reset();
  });

  const openKeys = withWords(() => {
    if (dialogOpen || game.phase !== 'ready') return;
    dialogOpen = true;
    openTypeCase(document.body, {
      layout: layout(),
      builtInPresets: [myApprenticePreset(), ...presets()],
      customPresets: customPresets(),
      initial: store.data.keys,
      keyStats: store.data.keyStats,
      countWords: (keys) => countTypeableWords(words().words, keys),
      minWords: MIN_WORD_POOL,
      accents: typeableAccents(),
      onAccentHelp: () => openAccentHelpDialog(),
      onDone: (keys) => {
        dialogOpen = false;
        setContent(game, contentFor(keys));
        store.update((save) => {
          save.keys = [...keys];
        });
        menu.refresh();
      },
      onCancel: () => {
        dialogOpen = false;
      },
      onSavePreset: (name, keys) => {
        const preset = { id: `custom-${Date.now()}`, name, chars: [...keys] };
        store.update((save) => {
          save.customPresets.push(preset);
        });
        return { ...preset, builtIn: false };
      },
      onDeletePreset: (id) => {
        store.update((save) => {
          save.customPresets = save.customPresets.filter((p) => p.id !== id);
        });
      },
    });
  });

  const openSaves = () => {
    if (dialogOpen || game.phase !== 'ready') return;
    dialogOpen = true;
    openSaveData(document.body, {
      store,
      onImported: applySave,
      onErased: applySave,
      ...(canTransfer() ? { transferLink } : {}),
      onClose: () => {
        dialogOpen = false;
        menu.refresh();
      },
    });
  };

  /**
   * Switch the player's keyboard layout. A preset selection (the home row,
   * their Apprentice keys…) follows to the same preset on the new layout.
   */
  const setLayout = (id: LayoutId) => {
    if (id === store.data.layout) return;
    const from = layout();
    const to = layoutById(id);
    store.update((save) => {
      save.keys = remapSelection(from, to, save.keys, save.apprentice.unlocked, typeableAccents());
      save.layout = id;
    });
    applySave();
  };

  /** Switch the player's words language; the new words start on the next page. */
  const setWordsLanguage = (lang: Language) => {
    if (lang === store.data.wordsLanguage) return;
    store.update((save) => {
      save.wordsLanguage = lang;
    });
    applySave();
  };

  /** The accent help card, for the player's words language, layout and computer. */
  const openAccentHelpDialog = () => {
    const wasOpen = dialogOpen;
    dialogOpen = true;
    openAccentHelp(document.body, {
      lang: store.data.wordsLanguage,
      layout: layout(),
      platform: settings.keyboardKind,
      onClose: () => {
        dialogOpen = wasOpen;
      },
    });
  };

  /** The card that opens an accent chapter; Enter starts it, Esc goes back to Contents. */
  const openAccentChapterIntro = (chapter: number) => {
    if (dialogOpen) return;
    const letters = ACCENT_CHAPTERS[store.data.wordsLanguage][chapter] ?? [];
    dialogOpen = true;
    openAccentIntro(document.body, {
      title: t('contents.accentChapter', { chapter: chapter + 1 }),
      intro: t('accents.chapterIntro'),
      startLabel: t('accents.start'),
      letters: letters.map((char) => ({ char, steps: howToType(char, layout(), settings.keyboardKind) })),
      onHelp: () => openAccentHelpDialog(),
      onClose: (start) => {
        dialogOpen = false;
        if (start) startAccentChapter(chapter);
      },
    });
  };

  const openSettingsDialog = () => {
    if (dialogOpen || (game.phase !== 'ready' && game.phase !== 'paused')) return;
    dialogOpen = true;
    openSettings(document.body, {
      settings,
      onChange: (next) => {
        const redraw = next.theme !== settings.theme || next.textSize !== settings.textSize || next.motion !== settings.motion || next.screenEffects !== settings.screenEffects || next.pageWriting !== settings.pageWriting || next.holidayLooks !== settings.holidayLooks;
        const kindChanged = next.keyboardKind !== settings.keyboardKind;
        const languageChanged = next.menuLanguage !== settings.menuLanguage;
        settings = next;
        saveSettings(settings);
        if (kindChanged) applyKeyboardKind();
        if (languageChanged) {
          applyMenuLanguage();
          menu.refresh();
          renderer.rebuild();
        }
        applyColors();
        applyLayout();
        if (redraw) renderer.rebuild();
      },
      onTestSound: () => {
        sfx.unlock();
        sfx.play('page');
      },
      nudges: {
        enabled: !store.data.nudges.off,
        onToggle: (enabled) => {
          store.update((save) => {
            // Turning them back on lets the next great chapter ask straight away.
            save.nudges = { off: !enabled, wait: 0 };
          });
        },
      },
      tips: {
        enabled: store.data.tutorials.enabled,
        onToggle: (enabled) => {
          store.update((save) => {
            save.tutorials.enabled = enabled;
          });
          refreshTips();
        },
        onReset: () => {
          store.update((save) => {
            save.tutorials = { enabled: true, seen: [] };
          });
          refreshTips();
        },
      },
      // Switching layout mid-page would change the keys under the player.
      layout: game.phase === 'ready' ? { current: store.data.layout, onPick: (id) => setLayout(id) } : undefined,
      wordsLanguage: game.phase === 'ready' ? { current: store.data.wordsLanguage, onPick: (lang) => setWordsLanguage(lang) } : undefined,
      reopen: () => openSettingsDialog(),
      forgiving:
        accentedLetters(store.data.wordsLanguage).length > 0
          ? {
              enabled: store.data.accents.forgiving,
              onToggle: (enabled) => {
                store.update((save) => {
                  save.accents.forgiving = enabled;
                });
                game.forgivingAccents = enabled;
                if (game.phase === 'ready') setContent(game, contentFor(store.data.keys));
              },
            }
          : undefined,
      onClose: () => {
        dialogOpen = false;
      },
    });
  };

  const openVocab = withWords(() => {
    if (dialogOpen || game.phase !== 'ready') return;
    vocabDictionary ??= new Map(words().words.map((entry) => [entry.word, entry.tier]));
    dialogOpen = true;
    /** Rebuild content so word pages pick up list changes. */
    const refresh = () => setContent(game, contentFor(store.data.keys));
    openWordLists(document.body, {
      lists: store.data.vocab,
      lang: store.data.wordsLanguage,
      dictionary: vocabDictionary,
      blocklist: words().blocklist,
      countFitting: (words) =>
        countTypeableWords(
          words.map((word) => ({ word, tier: 0 })),
          store.data.keys,
        ),
      onAdd: (list) => {
        store.update((save) => {
          save.vocab.push(list);
        });
        refresh();
      },
      onToggle: (id, enabled) => {
        store.update((save) => {
          const list = save.vocab.find((l) => l.id === id);
          if (list) list.enabled = enabled;
        });
        refresh();
      },
      onDelete: (id) => {
        store.update((save) => {
          save.vocab = save.vocab.filter((l) => l.id !== id);
        });
        refresh();
      },
      onClose: () => {
        dialogOpen = false;
      },
    });
  });

  /** Use a key set for Practice and remember it. */
  const useKeys = (keys: readonly string[]) => {
    setContent(game, contentFor(keys));
    store.update((save) => {
      save.keys = [...keys];
    });
  };

  /** Pause menu in an Apprentice chapter: leave it and practice its keys at the same difficulty. */
  const practiceChapterKeys = () => {
    if (game.phase !== 'paused' || game.mode !== 'apprentice') return;
    const keys = apprenticeKeys(game.layout, game.page.chapter);
    const difficulty = game.difficulty;
    quitToMenu(game);
    useKeys(keys);
    store.update((save) => {
      save.difficulty = difficulty;
    });
    game.selectedDifficulty = difficulty;
    startPractice(game, difficulty);
    loop.reset();
  };

  /** "Level 5 · Apprentice chapter 4"-style summaries of each player, read from their saves. */
  const playerDetails = new Map<string, string>();
  const describePlayer = (save: Readonly<SaveData>) => {
    const level = levelForInk(save.profile.ink);
    return t('players.detail', {
      rank: t(`rank.${rankForLevel(level)}` as MessageKey),
      level,
      chapter: Math.max(1, Math.min(save.apprentice.unlocked, APPRENTICE_CHAPTERS)),
    });
  };
  const refreshPlayerDetails = async () => {
    for (const p of players.list.players) {
      if (p.id === players.active.id) continue;
      try {
        const raw = await backend.load(saveKeyFor(p.id));
        const save = raw === undefined ? defaultSave() : migrate(raw);
        playerDetails.set(p.id, describePlayer(save));
      } catch {
        playerDetails.delete(p.id);
      }
    }
    menu.refresh();
  };

  /** Switch to another player: their save, keys, difficulty and desk. */
  const switchPlayer = async (id: string) => {
    if (dialogOpen || game.phase !== 'ready') return;
    if (id !== players.active.id) {
      await store.switchTo(saveKeyFor(id));
      await players.setActive(id);
      reward = { ink: 0, levelUp: null, unlocked: [], items: [] };
      applySave();
      renderer.rebuild();
      void refreshPlayerDetails();
    }
    menu.show('title');
  };

  /** Release notes: after an update, or from the About page. */
  const openWhatsNew = (releases: readonly Release[], earlier: readonly Release[], afterUpdate: boolean) => {
    if (dialogOpen || (game.phase !== 'ready' && game.phase !== 'paused')) return;
    dialogOpen = true;
    openWhatsNewDialog(document.body, {
      releases,
      earlier,
      afterUpdate,
      onClose: () => {
        dialogOpen = false;
      },
    });
  };

  const savePlayer = async (id: string | null, name: string, badge: Player['badge']) => {
    if (!cleanName(name)) return false;
    if (id === null) {
      if (!(await players.add(name, badge))) return false;
    } else {
      await players.edit(id, name, badge);
    }
    void refreshPlayerDetails();
    return true;
  };

  const deletePlayer = async (id: string) => {
    if (dialogOpen || game.phase !== 'ready') return;
    if (id === players.active.id) {
      // Move to someone else first, so the deleted save isn't written again.
      const next = players.list.players.find((p) => p.id !== id);
      if (!next) return;
      await store.switchTo(saveKeyFor(next.id));
      await players.setActive(next.id);
      applySave();
      renderer.rebuild();
    }
    await players.remove(id);
    playerDetails.delete(id);
    menu.refresh();
  };

  const goToMenu = () => {
    const wasDaily = game.mode === 'daily';
    const wasAccents = game.mode === 'accents';
    // Leaving the day's Daily Page part way still uses up its one go.
    if (wasDaily) finishDaily(false);
    quitToMenu(game);
    loop.reset();
    void store.flush();
    if (wasDaily && game.challenge === null) menu.show('daily');
    // After an accent chapter, back to the Contents page, where the next one may have opened.
    if (wasAccents) menu.show('contents');
    game.challenge = null;
  };

  // Game-over card links.
  actions.onLink = (id) =>
    after(() => {
      if (id === 'retry') {
        retryChapter(game);
        loop.reset();
      } else {
        goToMenu();
      }
    });

  /** Fair Copy, the typing-speed test, while it's open (it owns the keyboard then). */
  let fairCopy: FairCopySession | null = null;
  /** Deals Fair Copy's passages, shuffled: every one before any comes round again. */
  /** A deck of passages per words language, so each deals every passage before repeating. */
  const passageDecks = new Map<Language, PassageDeck>();
  const passageDeck = () => {
    const lang = store.data.wordsLanguage;
    let deck = passageDecks.get(lang);
    if (!deck) passageDecks.set(lang, (deck = new PassageDeck(Math.random, PASSAGES.filter((p) => p.lang === lang))));
    return deck;
  };
  const startFairCopy = (seconds: number | null, first?: Passage) => {
    fairCopy?.destroy();
    fairCopy = new FairCopySession(renderer.app, {
      mode: seconds,
      deck: passageDeck(),
      first,
      reducedMotion: reducedMotion(settings, prefersReducedMotion()),
      cosmetics: store.data.profile.cosmetics,
      season: season(),
      onExit: () => {
        fairCopy?.destroy();
        fairCopy = null;
        menu.show('fairCopy');
      },
      announce: (text) => (announcer.textContent = text),
      onFinished: (r, mode, passageId) => {
        let record: { previous: number | null; isNew: boolean } = { previous: null, isNew: false };
        store.update((save) => {
          const { previous, isNew } = recordFairCopy(save, mode, r, new Date(), passageId, save.wordsLanguage);
          record = { previous: previous?.wpm ?? null, isNew };
        });
        giveStickers({ fairCopy: { seconds: mode, netWpm: r.netWpm, typed: r.typed, errors: r.errors, mistakesLeft: r.mistakesLeft } });
        return record;
      },
      onEvents: (events) => {
        if (events.includes('finished')) sfx.play('page');
        else if (events.includes('error')) sfx.play('error');
        else if (events.includes('correct')) sfx.play('key');
      },
    });
    menu.hide();
    if (import.meta.env.DEV) (window as unknown as { fairCopy: unknown }).fairCopy = fairCopy.devHelpers();
  };

  const menu = new Menu(document.body, {
    continueDetail: () => {
      const saved = store.data.notebook;
      return saved
        ? t('menu.continueDetail', { difficulty: difficultyLabel(saved.difficulty), chapter: saved.chapter + 1, page: saved.page + 1 })
        : null;
    },
    keysSummary: () => `${describeKeys(store.data.keys)} · ${t('menu.keyCount', { count: store.data.keys.length })}`,
    portrait: (id) => renderer.portrait(id),
    handsPicture: () => {
      const keys = store.data.keys;
      if (keys.length === 0) return null;
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(themedHandsArt(layout(), keys, { redPen: false, hands: false }).svg)}`;
    },
    apprenticeDetail: () => {
      const { earned, max } = totalStars(store.data.apprentice.stars);
      return store.data.apprentice.completed
        ? t('menu.apprenticeDone', { earned, max })
        : t('menu.apprenticeDetail', { chapter: store.data.apprentice.unlocked, total: APPRENTICE_CHAPTERS, earned, max });
    },
    chapters: () =>
      lessonsFor(layout()).map((lesson, chapter) => ({
        chapter,
        newKeys: lesson.newKeys.map(keyLabel).join(' '),
        stars: chapterStars(store.data.apprentice.stars, chapter),
        locked: chapter >= store.data.apprentice.unlocked,
        best: (() => {
          const best = chapterBest(store.data, game.selectedDifficulty, chapter, apprenticePlan(chapter).length);
          return best === null ? null : t('contents.best', { score: formatNumber(best) });
        })(),
      })),
    onStartApprentice: (chapter) => after(() => startChapter(chapter)),
    accentChapters: () => {
      const lang = store.data.wordsLanguage;
      const stars = store.data.apprentice.accentStars[lang] ?? [];
      // They open once every letter is learned (in development, `?accents=open` opens them).
      const open = store.data.apprentice.completed || (import.meta.env.DEV && new URLSearchParams(location.search).get('accents') === 'open');
      return ACCENT_CHAPTERS[lang].map((letters, chapter) => ({
        chapter,
        letters: letters.join(' '),
        stars: { earned: stars[chapter] ?? 0, max: 3 * GAME_CONFIG.accents.plan.length },
        locked: !open || (chapter > 0 && !(stars[chapter - 1] ?? 0)),
      }));
    },
    onStartAccents: (chapter) => openAccentChapterIntro(chapter),
    onAccentHelp: () => openAccentHelpDialog(),
    rankLine: () => {
      const { level, into, needed } = levelProgress(store.data.profile.ink);
      return t('menu.rank', { rank: t(`rank.${rankForLevel(level)}` as MessageKey), level, into, needed });
    },
    levelFraction: () => {
      const { into, needed } = levelProgress(store.data.profile.ink);
      return needed > 0 ? into / needed : 1;
    },
    level: () => levelForInk(store.data.profile.ink),
    stickers: () => Object.keys(store.data.stickers.earned),
    cosmetics: () => store.data.profile.cosmetics,
    onEquip: (slot, item) => equip(slot, item),
    bestLine: (d) => {
      const best = store.data.records.bestScore[d];
      return best
        ? t('menu.best', { difficulty: difficultyLabel(d), score: formatNumber(best), chapter: store.data.records.furthestChapter[d] ?? 1 })
        : null;
    },
    pauseSummary: () =>
      t('overlay.stats', {
        score: formatNumber(game.pageStats.score),
        wpm: formatNumber(Math.round(wpm(game.pageStats))),
        accuracy: formatNumber(Math.round(accuracy(game.pageStats) * 100)),
      }),
    selectedDifficulty: () => game.selectedDifficulty,
    onSelectDifficulty: (d) => selectDifficulty(game, d),
    onContinue: () => after(continueSaved),
    onStart: () => after(actions.start),
    onKeys: () => openKeys(),
    onWordLists: () => openVocab(),
    onSettings: () => openSettingsDialog(),
    onSaveData: () => openSaves(),
    onResume: () =>
      after(() => {
        if (game.phase === 'paused') togglePause(game);
        loop.reset();
      }),
    onRestart: () =>
      after(() => {
        restartPage(game);
        loop.reset();
      }),
    onQuit: () => after(goToMenu),
    canPracticeChapterKeys: () => game.phase === 'paused' && game.mode === 'apprentice',
    onPracticeChapterKeys: () => after(practiceChapterKeys),
    apprenticeKeysChapter: apprenticeChapter,
    onUseApprenticeKeys: () => useKeys(myApprenticePreset().chars),
    players: () =>
      players.list.players.map((p) => ({
        ...p,
        active: p.id === players.active.id,
        detail: p.id === players.active.id ? describePlayer(store.data) : (playerDetails.get(p.id) ?? ''),
      })),
    activePlayer: () => players.active,
    canAddPlayer: () => players.canAdd,
    onChoosePlayer: (id) => void switchPlayer(id),
    onSavePlayer: savePlayer,
    onDeletePlayer: (id) => void deletePlayer(id),
    appVersion: () => APP_VERSION,
    daily: () => {
      const id = dailyId(new Date());
      const d = store.data.daily;
      const result = d.results[id];
      const streak = currentStreak(d, id);
      return {
        id,
        played: result !== undefined,
        status: !result
          ? t('daily.notPlayed')
          : result.finished
            ? t('daily.result', { score: formatNumber(result.score), wpm: result.wpm, accuracy: result.accuracy })
            : t('daily.resultOut', { score: formatNumber(result.score), page: result.grades.length + 1, pages: DAILY_PAGES }),
        streak,
        week: streakWeek(new Date(), new Set(Object.keys(d.results).map(Number))),
        pages: result ? dailyPages(result.grades) : null,
        record:
          d.lastId === null
            ? t('daily.recordNone')
            : t('daily.record', { bestStreak: d.bestStreak, best: formatNumber(d.best) }),
        shareText: dailyShareText(),
      };
    },
    dailyDetail: () => {
      const id = dailyId(new Date());
      const result = store.data.daily.results[id];
      return result ? t('menu.dailyDone', { id, score: formatNumber(result.score) }) : t('menu.dailyNew', { id });
    },
    onPlayDaily: () => after(() => playDaily()),
    // The passages' accented letters get their briefing first, if they haven't been taught.
    onFairCopy: (seconds) =>
      briefAccents(
        PASSAGES.filter((p) => p.lang === store.data.wordsLanguage).flatMap((p) => [...p.text]),
        () => startFairCopy(seconds),
      ),
    fairCopyBest: (seconds) => {
      const best = store.data.fairCopy.best[fairCopyKey(seconds, store.data.wordsLanguage)];
      return best ? t('fairCopyMenu.best', { wpm: formatNumber(Math.round(best.wpm)) }) : null;
    },
    dailySigned: () => signDaily,
    signName: () => cleanChallengeName(players.active.name),
    onSignDaily: (on) => {
      signDaily = on;
    },
    challenge: () => {
      const c = pendingChallenge;
      if (!c) return null;
      const today = dailyId(new Date());
      return {
        id: c.daily,
        name: c.name,
        score: formatNumber(c.score),
        pages: dailyPages(c.grades),
        counts: c.daily === today && store.data.daily.results[today] === undefined,
        daysAgo: today - c.daily,
        otherLayout: c.layout === store.data.layout ? null : t(`layout.${c.layout}` as MessageKey),
        otherWords: c.words === store.data.wordsLanguage ? null : LANGUAGE_NAMES[c.words],
        myWords: LANGUAGE_NAMES[store.data.wordsLanguage],
        myLayout: t(`layout.${store.data.layout}` as MessageKey),
      };
    },
    onTakeChallenge: () =>
      after(() => {
        const c = pendingChallenge;
        pendingChallenge = null;
        if (c) playDaily(c);
      }),
    onDismissChallenge: () => {
      pendingChallenge = null;
    },
    transfer: () => {
      const pending = pendingTransfer;
      if (!pending) return null;
      if ('error' in pending) return { error: pending.error };
      const { save, player } = pending;
      return {
        name: player.name || t('players.defaultName'),
        badge: player.badge,
        detail: describePlayer(save),
        stickers: Object.keys(save.stickers.earned).length,
        canAdd: players.canAdd,
        currentName: players.active.name,
      };
    },
    onTransferAdd: () => void addTransferredPlayer(),
    onTransferReplace: () => void replaceWithTransfer(),
    onDismissTransfer: () => {
      pendingTransfer = null;
    },
    onCopyDaily: async () => {
      const text = dailyShareText();
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    },
    canRestart: () => canRestart(game),
    stickerDetail: () => {
      const { earned, unseen } = store.data.stickers;
      const args = { earned: Object.keys(earned).length, total: STICKERS.length, count: unseen.length };
      return unseen.length > 0 ? t('menu.stickersNew', args) : t('menu.stickersDetail', args);
    },
    stickerBook: () => {
      const { earned, unseen } = store.data.stickers;
      const date = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' });
      const groups: StickerGroup[] = ['pages', 'speed', 'bosses', 'course', 'daily', 'fairCopy', 'seasons', 'secret'];
      return {
        earned: Object.keys(earned).length,
        total: STICKERS.length,
        shelves: groups.map((group) => ({
          title: t(`stickers.group.${group}` as MessageKey),
          stickers: STICKERS.filter((s) => s.group === group).map((s) => {
            const at = earned[s.id];
            const hidden = s.secret && !at;
            return {
              id: s.id,
              emoji: hidden ? '?' : s.emoji,
              group: s.group,
              name: hidden ? t('stickers.secretName') : stickerName(s.id),
              how: hidden ? t('stickers.secretHow') : t(`sticker.${s.id}.how` as MessageKey),
              earnedOn: at ? t('stickers.earnedOn', { date: date.format(new Date(at)) }) : null,
              isNew: unseen.includes(s.id),
            };
          }),
        })),
      };
    },
    onStickersSeen: () => {
      if (store.data.stickers.unseen.length === 0) return;
      store.update((save) => {
        save.stickers.unseen = [];
      });
    },
    onWhatsNew: () => {
      const released = RELEASES.filter((r) => compareVersions(r.version, APP_VERSION) <= 0);
      openWhatsNew(released.slice(0, 1), released.slice(1), false);
    },
  });
  // With more than one player, ask who's writing first.
  if (players.list.players.length > 1) menu.show('players');
  void refreshPlayerDetails();

  /** Run an action, then update the menu right away rather than on the next frame. */
  function after(action: () => void): void {
    action();
    syncMenu();
  }

  /** Show the right menu for the current phase (the main menu when idle, the pause menu when paused). */
  function syncMenu(): void {
    // Fair Copy has the screen; it shows the menu itself when the player leaves.
    if (fairCopy) {
      if (menu.visible) menu.hide();
      return;
    }
    if (game.phase === 'ready') {
      if (!menu.visible || menu.screen === 'pause') menu.show('title');
    } else if (game.phase === 'paused') {
      if (menu.screen !== 'pause') menu.show('pause');
    } else if (menu.visible) {
      menu.hide();
    }
  }

  /** Add ink to the profile; report the ink, any new level, and new unlocks by name. */
  const earnInk = (save: SaveData, ink: number) => {
    const before = levelForInk(save.profile.ink);
    save.profile.ink += ink;
    const after = levelForInk(save.profile.ink);
    const items = newUnlocks(before, after);
    return {
      ink,
      levelUp: after > before ? after : null,
      unlocked: items.map(({ slot, item }) => t(`${slot}.${item}` as MessageKey)),
      items,
    };
  };

  /**
   * Give whatever stickers the save (plus what just happened) has earned.
   * New ones go on the card and, with `toast`, pop up in the corner.
   */
  const giveStickers = (extra: Pick<StickerFacts, 'page' | 'daily' | 'fairCopy'> = {}, toast = true) => {
    let fresh: string[] = [];
    store.update((save) => {
      fresh = awardStickers(save, stickerFacts(save, extra));
    });
    if (fresh.length === 0) return;
    recentStickers = [...recentStickers, ...fresh];
    // Holiday stickers bring keepsakes for the Desk: they go on the unlock card with any level-up.
    const keepsakes = stickerUnlocks(fresh);
    if (keepsakes.length > 0) {
      reward = {
        ...reward,
        unlocked: [...reward.unlocked, ...keepsakes.map(({ slot, item }) => t(`${slot}.${item}` as MessageKey))],
        items: [...reward.items, ...keepsakes],
      };
    }
    if (toast) {
      showStickerToast(
        document.body,
        fresh.map((id) => {
          const sticker = STICKERS.find((s) => s.id === id)!;
          return { emoji: sticker.emoji, group: sticker.group, name: stickerName(id) };
        }),
      );
    }
    menu.refresh();
  };

  /** Show what was just unlocked, with pictures and a button to use each one now. */
  const showUnlocks = () => {
    if (reward.items.length === 0 || dialogOpen) return;
    const levelUp = reward.levelUp;
    dialogOpen = true;
    openUnlockDialog(document.body, {
      levelUp: levelUp ? { level: levelUp, rank: t(`rank.${rankForLevel(levelUp)}` as MessageKey) } : null,
      items: reward.items,
      isEquipped: ({ slot, item }) => store.data.profile.cosmetics[slot] === item,
      onEquip: ({ slot, item }) => equip(slot, item),
      onClose: () => {
        dialogOpen = false;
        showNudge();
      },
    });
  };

  /**
   * "Ready for more?" after a Free Write chapter of top grades (core/nudges.ts):
   * the Everything keys and/or the next difficulty, from the next page on.
   * Waits for any unlock card to close first.
   */
  const showNudge = () => {
    const nudge = pendingNudge;
    if (!nudge || dialogOpen || game.phase !== 'pageCleared') return;
    pendingNudge = null;
    const harder = harderThan(game.difficulty);
    const answer = (never = false) =>
      store.update((save) => {
        save.nudges = answered(save.nudges, never);
      });
    const choices: Choice[] = [];
    if (nudge.offers.includes('everything')) {
      choices.push({
        id: 'nudge-everything',
        label: t('nudge.everything'),
        primary: true,
        onPick: () => {
          const keys = everythingKeys();
          switchKeys(game, contentFor(keys));
          store.update((save) => {
            save.keys = [...keys];
            save.nudges = answered(save.nudges);
          });
          menu.refresh();
        },
      });
    }
    if (nudge.offers.includes('harder') && harder) {
      choices.push({
        id: 'nudge-harder',
        label: t('nudge.harder', { difficulty: difficultyLabel(harder) }),
        primary: choices.length === 0,
        onPick: () => {
          game.difficulty = harder;
          game.selectedDifficulty = harder;
          store.update((save) => {
            save.difficulty = harder;
            // The notebook carries on at the new difficulty, even if it's quit from this card.
            save.notebook = snapshotNotebook(game, nextPagePosition(game.page));
            save.nudges = answered(save.nudges);
          });
          menu.refresh();
        },
      });
    }
    choices.push({ id: 'nudge-later', label: t('nudge.later'), onPick: () => answer() });
    dialogOpen = true;
    openChoiceDialog(document.body, {
      emoji: '🚀',
      title: t('nudge.title'),
      lines: [t('nudge.body', { chapter: nudge.chapter }), t(nudge.offers.length > 1 ? 'nudge.bothHelp' : nudge.offers[0] === 'everything' ? 'nudge.everythingHelp' : 'nudge.harderHelp')],
      choices,
      footer: { id: 'nudge-never', label: t('nudge.never'), onPick: () => answer(true) },
      escapeId: 'nudge-later',
      onClose: () => {
        dialogOpen = false;
      },
    });
  };

  const equip = (slot: UnlockedItem['slot'], item: string) => {
    store.update((save) => {
      (save.profile.cosmetics as unknown as Record<string, string>)[slot] = item;
    });
    // The page card behind the unlock card stays as it is (no replayed stars or fade-in).
    renderer.rebuild({ keepCard: true });
  };

  /** Explain what's new on the page about to start; closing the card starts the page. */
  const showBriefing = () => {
    if (dialogOpen) {
      // Something else has the screen (it shouldn't): don't leave the game stuck on a hidden card.
      confirm(game);
      return;
    }
    dialogOpen = true;
    openBriefingDialog(document.body, {
      mechanics: game.briefing,
      portrait: (id) => renderer.portrait(id),
      onClose: (showTips) => {
        dialogOpen = false;
        confirm(game);
        store.update((save) => {
          save.tutorials.seen = [...game.seenMechanics];
          if (!showTips) save.tutorials.enabled = false;
        });
        refreshTips();
        loop.reset();
        syncMenu();
      },
    });
  };

  /** Stickers for the page just cleared (and any boss on it). */
  const awardPageStickers = () => {
    const boss = game.page.hasBoss ? game.page.bossKind : null;
    if (boss) store.update((save) => recordBossBeaten(save, boss));
    giveStickers({
      page: {
        mode: game.mode,
        difficulty: game.difficulty,
        grade: pageGrade(game.pageStats, game.page.params.size),
        stats: game.pageStats,
        notebookScore: game.stats.score,
        boss,
        layoutId: store.data.layout,
        at: new Date(),
        // By the calendar, whatever the Holiday looks setting (and `?season=` in development).
        season: calendarSeason,
      },
    });
  };

  /** Phase before the latest change, to tell starting a page from resuming one. */
  let lastPhase: GamePhase = game.phase;

  /** Save progress when the game moves between screens (REQUIREMENTS §8). */
  const onPhase = (phase: GamePhase) => {
    switch (phase) {
      case 'briefing':
        if (lastPhase === 'ready') newBest = false;
        showBriefing();
        break;
      case 'playing':
        // A page is starting (not just resuming from pause): save the notebook
        // here, so Continue and Quit to menu always come back to this page.
        if (lastPhase !== 'paused') recentStickers = [];
        // A suggestion that never got its moment doesn't carry over to a later page.
        if (lastPhase !== 'paused') pendingNudge = null;
        if (lastPhase !== 'paused' && game.mode !== 'daily' && game.mode !== 'accents') {
          if (lastPhase === 'ready') newBest = false;
          store.update((save) => {
            save.difficulty = game.difficulty;
            save.notebook = snapshotNotebook(
              game,
              { chapter: game.page.chapter, page: game.pageStart.pageIndex },
              new Date(),
              game.pageStart,
            );
          });
        }
        break;
      case 'pageCleared':
        store.update((save) => {
          const before = structuredClone(save.keyStats);
          mergeKeyStats(save, game.pageStats);
          newlyMastered = improvedKeys(before, save.keyStats);
          pageBest = null;
          if (game.mode === 'daily') {
            // The Daily Page keeps its own records (finishDaily), not the notebook's.
            dailyGrades.push(pageGrade(game.pageStats, game.page.params.size));
            reward = earnInk(save, inkForPage(game.pageStats.score));
            return;
          }
          if (game.mode === 'accents') {
            // Accent chapters keep their stars per words language (recorded when the chapter ends).
            const earned = starsForGrade(pageGrade(game.pageStats, game.page.params.size));
            accentRunStars[game.page.index] = earned;
            reward = earnInk(save, inkForPage(game.pageStats.score, earned));
            return;
          }
          const score = game.pageStats.score;
          const key = pageBestKey(game.mode, game.difficulty, game.page.chapter, game.page.index);
          pageBest = { ...recordPageBest(save, key, score), score };
          let stars = 0;
          if (game.mode === 'apprentice') {
            const earned = starsForGrade(pageGrade(game.pageStats, game.page.params.size));
            stars = earned;
            recordApprenticePage(save, game.page.chapter, game.page.index, earned, isLastPageOfChapter(game.page));
          }
          // "Ready for more?": every Free Write page's grade, for the check when its chapter ends.
          if (game.mode === 'practice') {
            const grade = pageGrade(game.pageStats, game.page.params.size);
            if (game.page.index === 0 || chapterGrades.chapter !== game.page.chapter) chapterGrades = { chapter: game.page.chapter, grades: [] };
            chapterGrades.grades.push(grade);
            if (isLastPageOfChapter(game.page)) {
              save.nudges = afterChapter(save.nudges);
              const offers = nudgesFor(
                {
                  mode: game.mode,
                  chapter: game.page.chapter,
                  grades: chapterGrades.grades,
                  pages: game.page.pageCount,
                  difficulty: game.difficulty,
                  keys: save.keys,
                  everything: everythingKeys(),
                },
                save.nudges,
              );
              pendingNudge = offers.length > 0 ? { chapter: game.page.chapter + 1, offers } : null;
            }
          }
          // Ink (XP): level-ups and unlocks show on the graded page.
          reward = earnInk(save, inkForPage(game.pageStats.score, stars));
          recordResult(save, game.difficulty, game.stats.score, game.page.chapter + 1);
          save.notebook = snapshotNotebook(game, nextPagePosition(game.page));
        });
        awardPageStickers();
        showUnlocks();
        showNudge();
        break;
      case 'notebookComplete':
        if (game.mode === 'daily') {
          finishDaily(true);
          break;
        }
        if (game.mode === 'accents') {
          store.update((save) => {
            const lang = save.wordsLanguage;
            const stars = [...(save.apprentice.accentStars[lang] ?? [])];
            const total = accentRunStars.reduce((a, b) => a + b, 0);
            stars[game.page.chapter] = Math.max(stars[game.page.chapter] ?? 0, total);
            for (let i = 0; i < stars.length; i++) stars[i] ??= 0;
            save.apprentice.accentStars[lang] = stars;
            reward = earnInk(save, 0);
          });
          break;
        }
        store.update((save) => {
          save.notebook = null;
          reward = earnInk(save, NOTEBOOK_BONUS);
        });
        giveStickers();
        showUnlocks();
        break;
      case 'gameOver':
        if (game.mode === 'daily' || game.mode === 'accents') {
          store.update((save) => mergeKeyStats(save, game.pageStats));
          if (game.mode === 'daily') finishDaily(false);
          break;
        }
        store.update((save) => {
          mergeKeyStats(save, game.pageStats);
          newBest = recordResult(save, game.difficulty, game.stats.score, game.page.chapter + 1);
          save.notebook = null;
        });
        break;
      default:
        break;
    }
    lastPhase = phase;
    // A new chapter or level may have just unlocked an ability.
    refreshAbilities();
  };

  /** 1, 2 and 3 by physical key, so they work without Shift on AZERTY (where the digits are on Shift). */
  const ABILITY_KEYS: Partial<Record<string, ActiveAbility>> = {
    Digit1: 'paperweight',
    Digit2: 'highlighter',
    Digit3: 'blotter',
    Numpad1: 'paperweight',
    Numpad2: 'highlighter',
    Numpad3: 'blotter',
  };
  /** The digit on a number key (Digit4 or Numpad4 → '4'), whatever the layout types there. */
  const digitOf = (code: string | undefined): string | null => /^(?:Digit|Numpad)(\d)$/.exec(code ?? '')?.[1] ?? null;

  const EDIT_KEYS: Partial<Record<SpecialKey, EditKey>> = {
    Backspace: 'backspace',
    Delete: 'delete',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Home: 'home',
    End: 'end',
  };

  /** While playing, these keys edit Run-ons, and Tab switches target. */
  const handleSpecial = (key: SpecialKey): boolean => {
    if (game.phase !== 'playing') return false;
    if (key === 'Tab') {
      cycleLock(game);
      return true;
    }
    // Up and Down fire abilities: they're never typed, whatever keys are in play.
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      useAbility(game, key === 'ArrowUp' ? 'paperweight' : 'highlighter');
      return true;
    }
    const edit = EDIT_KEYS[key];
    if (edit) editKey(game, edit);
    // Swallow the rest too, so arrows never scroll the page mid-game.
    return true;
  };

  bindKeyboard(
    window,
    {
      onChar: (char, code) => {
        // Number keys pick a difficulty on the new-notebook screen, with or without Shift.
        const digit = digitOf(code);
        if (game.phase === 'ready' && digit) {
          typeChar(game, digit);
          return;
        }
        // Shortcuts on the game-over card: R retries the chapter, M goes to the menu.
        if (game.phase === 'gameOver') {
          const lower = char.toLowerCase();
          if (lower === 'r' || lower === 'm') actions.onLink(lower === 'r' ? 'retry' : 'mainMenu');
          return;
        }
        // On the page-cleared card, M goes to the menu (the next page is already saved).
        if (game.phase === 'pageCleared') {
          if (char.toLowerCase() === 'm') actions.onLink('mainMenu');
          return;
        }
        // 1, 2 and 3 also fire abilities, unless what that key types is one of the keys in play
        // (practicing numbers, or é on AZERTY's 2).
        const shortcut = code ? ABILITY_KEYS[code] : undefined;
        if (shortcut && game.phase === 'playing' && !game.keys.includes(char)) {
          useAbility(game, shortcut);
          return;
        }
        typeChar(game, char);
      },
      onConfirm: () => after(actions.start),
      onSpecial: (key) => handleSpecial(key),
      onDeadKey: (press) => pressDeadKey(game, deadKeyMark(layout(), press.code, press.shift, press.altGr)),
      onPause: () =>
        after(() => {
          // On a chapter's new-keys card, Esc backs out to the menu instead.
          if (game.phase === 'intro') goToMenu();
          else togglePause(game);
          loop.reset();
        }),
    },
    // Menus and dialogs handle their own keys.
    () => dialogOpen || menu.visible || fairCopy !== null,
  );

  // Pause when the player looks away (REQUIREMENTS §10), and make sure the save is written.
  window.addEventListener('blur', () => after(() => autoPause(game)));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      autoPause(game);
      void store.flush();
    }
    loop.reset();
  });
  window.addEventListener('pagehide', () => void store.flush());

  // Audio may only start after a user gesture.
  window.addEventListener('keydown', () => sfx.unlock());
  window.addEventListener('pointerdown', () => sfx.unlock());

  const soundFor: Partial<Record<string, Sound>> = {
    locked: 'key',
    progress: 'key',
    destroyed: 'pop',
    hit: 'pop',
    error: 'error',
    marginHit: 'leak',
    inkRestored: 'recover',
    comboStep: 'comboUp',
    comboBroken: 'comboBreak',
    charged: 'charge',
    passiveReady: 'charge',
    eraserUsed: 'recover',
    shieldUsed: 'pop',
    boss: 'boss',
    split: 'split',
  };
  const phaseSound: Partial<Record<GamePhase, Sound>> = { pageCleared: 'page', gameOver: 'gameOver', notebookComplete: 'complete' };

  // Progress made before stickers existed (or in another version) earns its stickers now, quietly.
  giveStickers({}, false);

  // Opened from a challenge link (or one pasted into the address bar while here).
  readLinks();
  window.addEventListener('hashchange', readLinks);

  renderer.app.ticker.add((ticker) => {
    const alpha = loop.advance(ticker.deltaMS);
    // Look at events before the renderer consumes them: saving and sound.
    for (const event of game.events) {
      if (event.type === 'phase') {
        onPhase(event.phase);
        const chime = phaseSound[event.phase];
        if (chime) sfx.play(chime);
      }
      // A heartbeat the moment the ink well drops into the danger zone.
      if (event.type === 'marginHit' || event.type === 'error') {
        const low = game.maxInk * GAME_CONFIG.lowInk;
        const lost = 'inkLost' in event ? (event.inkLost ?? 0) : 0;
        if (game.ink > 0 && game.ink < low && game.ink + lost >= low) sfx.play('lowInk');
      }
      if (event.type === 'guide') announcer.textContent = t(`tutorial.${event.id}.hint` as MessageKey);
      const sound = soundFor[event.type];
      // The pen scratch and combo chime rise in pitch with the run.
      if (sound) sfx.play(sound, event.type === 'comboStep' ? event.multiplier : game.stats.combo);
      if (event.type === 'ability') sfx.play(event.id === 'blotter' ? 'blotter' : 'ability');
    }
    renderer.sync(game, alpha, ticker.deltaMS);
    fairCopy?.update(ticker.deltaMS);
    syncMenu();
  });
  syncMenu();
  hideSplash();
  // Now the words. Every way into a page makes its content afresh (through
  // `withWords`); this just keeps the idle world's content real too.
  void packReady().then(() => {
    if (game.phase === 'ready') setContent(game, contentFor(store.data.keys));
  });

  // After an update, say what's new, once. Only remember the version if it
  // stuck, or blocked storage would show the notes on every visit.
  const announceRelease = () => {
    const returning = store.data.profile.ink > 0 || players.list.players.length > 1;
    const fresh = releasesToAnnounce(loadSeenVersion(), APP_VERSION, returning);
    if (saveSeenVersion(APP_VERSION) && fresh.length > 0) {
      openWhatsNew(fresh.slice(0, MAX_NEW_RELEASES_SHOWN), fresh.slice(MAX_NEW_RELEASES_SHOWN), true);
    }
  };
  // On a phone or tablet with no keyboard, say once that the game is made for one (it still plays).
  if (needsKeyboardNotice() && !dialogOpen) {
    dialogOpen = true;
    openChoiceDialog(document.body, {
      emoji: '⌨️',
      title: t('keyboardNotice.title'),
      lines: [t('keyboardNotice.body'), t('keyboardNotice.tip')],
      choices: [{ id: 'play-anyway', label: t('keyboardNotice.ok'), primary: true, onPick: () => {} }],
      onClose: () => {
        dialogOpen = false;
        markKeyboardNoticeSeen();
        announceRelease();
      },
    });
  } else {
    announceRelease();
  }

  if (import.meta.env.DEV) {
    // Handy for poking at state from the console during development. Still
    // called `inkling` (the first name) because the snapshots script reads it
    // from builds of older milestones.
    // `?fairCopy=passage|30|60` opens Fair Copy straight away, for screenshots: `&passage=` picks the
    // first passage by its index or id (otherwise it's shuffled).
    const params = new URLSearchParams(location.search);
    const fairCopyLink = fairCopyMode(params.get('fairCopy'));
    const passageParam = params.get('passage');
    const firstPassage = passageParam === null ? undefined : (PASSAGES.find((p) => p.id === passageParam) ?? PASSAGES[Number(passageParam)]);
    if (fairCopyLink !== undefined) startFairCopy(fairCopyLink, firstPassage);
    (window as unknown as { inkling: unknown }).inkling = { world: game, loop, renderer, get pack() { return pack; }, store, menu, openKeys, openSaves, openSettings: openSettingsDialog, openVocab };
  }
}

/** Fade out the first screen from index.html once the game is ready (M28). */
function hideSplash(): void {
  // Lets Lighthouse (and the browser's performance tools) show when the game became usable.
  performance.mark('inky-keys:menu-ready');
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('gone');
  setTimeout(() => splash.remove(), 300);
}

main().catch((error: unknown) => {
  console.error(error);
});
