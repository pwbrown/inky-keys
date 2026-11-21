/**
 * Main menu, new-notebook step, How to play, and the pause menu: plain DOM,
 * like the other dialogs, so they work with the keyboard and screen readers.
 * Shown over the (dimmed) page whenever the game isn't being played.
 */
import './dialog.css';
import './menu.css';
import './stickers.css';
import { DIFFICULTIES, GAME_CONFIG, type Difficulty } from '../core/config';
import { DAILY_PAGES, type PageMark, type StreakDay } from '../core/daily';
import type { Grade } from '../core/grade';
import type { MechanicId } from '../core/mechanics';
import { UNLOCKS, isUnlocked, type CosmeticSlot, type Cosmetics, type Unlock } from '../core/rewards';
import { getLocale, t, type MessageKey } from '../i18n';
import { BADGES, MAX_NAME_LENGTH, type Badge } from '../storage/profiles';
import { iconSvg, type IconId } from './icons';
import { artElement, badgeSvg, cosmeticSvg, dayDropSvg, streakDropSvg } from './art';
import { stickerArt } from './stickerToast';
import { h } from './dom';

export type MenuScreen =
  | 'title'
  | 'contents'
  | 'newNotebook'
  | 'howToPlay'
  | 'pause'
  | 'desk'
  | 'players'
  | 'playerEdit'
  | 'about'
  | 'daily'
  | 'fairCopy'
  | 'stickers'
  | 'challenge'
  | 'transfer';

/** Inky Keys' source code and issue forms. */
export const REPO_URL = 'https://github.com/pwbrown/inky-keys';
export const ISSUES_URL = `${REPO_URL}/issues/new/choose`;

export interface PlayerEntry {
  id: string;
  name: string;
  badge: Badge;
  /** e.g. "Scribe · Level 5 · Apprentice chapter 4". */
  detail: string;
  active: boolean;
}

export interface ChapterEntry {
  /** 0-based. */
  chapter: number;
  /** e.g. "R U". */
  newKeys: string;
  stars: { earned: number; max: number };
  locked: boolean;
  /** e.g. "best 1,240" at the selected difficulty, or null before any page is cleared. */
  best: string | null;
}

/** One chapter of the Contents page's "Accents" part. */
export interface AccentChapterEntry {
  /** 0-based. */
  chapter: number;
  /** e.g. "â ê î ô û". */
  letters: string;
  stars: { earned: number; max: number };
  locked: boolean;
}

/** One sticker in the book. */
export interface StickerEntry {
  id: string;
  emoji: string;
  group: string;
  name: string;
  how: string;
  /** e.g. "Earned 17 Nov 2026", or null if not earned yet. */
  earnedOn: string | null;
  /** Earned since the book was last opened. */
  isNew: boolean;
}

export interface StickerShelf {
  /** e.g. "Bosses". */
  title: string;
  stickers: StickerEntry[];
}

/** A challenge from a link, before it's taken on. */
export interface ChallengeView {
  id: number;
  name: string | null;
  /** Formatted. */
  score: string;
  pages: { page: number; grade: Grade | null; mark: PageMark }[];
  /** It's today's Daily Page and not played yet, so it counts. */
  counts: boolean;
  /** How many days ago that Daily Page was (0 for today, negative if ahead). */
  daysAgo: number;
  /** The layout it was played on, if not the player's. */
  otherLayout: string | null;
  /** The words language it was played in, when it isn't the player's (its own name), else null. */
  otherWords: string | null;
  myWords: string;
  myLayout: string;
}

/** A save from a transfer link, before the player decides what to do with it. */
export type TransferView =
  | { error: string }
  | {
      name: string;
      badge: Badge;
      /** e.g. "Scribe · Level 5 · Apprentice chapter 4". */
      detail: string;
      stickers: number;
      /** There's room for another player on this device. */
      canAdd: boolean;
      /** The player whose save "Replace" would overwrite. */
      currentName: string;
    };

/** The Daily Page screen. */
export interface DailyView {
  /** Today's Daily Page number. */
  id: number;
  /** e.g. "Not played yet" or "Score 4,820 · 62 WPM · 97%". */
  status: string;
  /** Days in a row, as of today. */
  streak: number;
  /** This week, Monday to Sunday, with the days played. */
  week: StreakDay[];
  /** Each page's grade and colour, once today's is played. */
  pages: { page: number; grade: Grade | null; mark: PageMark }[] | null;
  /** e.g. "Streak: 3 days · best 5 · best score 6,120". */
  record: string;
  /** Text to copy and share, once today's is played. */
  shareText: string | null;
  played: boolean;
}

export interface MenuHooks {
  /** Saved notebook to continue, if any. */
  continueDetail(): string | null;
  /** e.g. "Home row · 10 keys". */
  keysSummary(): string;
  /** A picture of the creature for a mechanic, as an image URL (shared with the briefing cards). */
  portrait(id: MechanicId): string | null;
  /** The player's keys on a keyboard with hands, as an image URL, or null. */
  handsPicture(): string | null;
  /** e.g. "Chapter 3 of 10 · ★ 14 of 102". */
  apprenticeDetail(): string;
  /** Every Apprentice chapter, for the Contents page. */
  chapters(): ChapterEntry[];
  onStartApprentice(chapter: number): void;
  /** The accent chapters of the player's words language (none for English), for the Contents page's second part. */
  accentChapters(): AccentChapterEntry[];
  onStartAccents(chapter: number): void;
  /** Open the accent help card. */
  onAccentHelp(): void;
  /** e.g. "Scribe · Level 5 · 120 of 600 ink to the next level". */
  rankLine(): string;
  /** Ink progress through the current level, 0..1. */
  levelFraction(): number;
  level(): number;
  /** Ids of the stickers the player has (the holiday keepsakes come with them). */
  stickers(): readonly string[];
  cosmetics(): Cosmetics;
  onEquip(slot: CosmeticSlot, item: string): void;
  /** e.g. "Best on Normal: 1,200 · reached chapter 3", or null. */
  bestLine(difficulty: Difficulty): string | null;
  /** Stats line for the page in progress, shown when paused. */
  pauseSummary(): string;
  selectedDifficulty(): Difficulty;
  onSelectDifficulty(difficulty: Difficulty): void;
  onContinue(): void;
  onStart(): void;
  onKeys(): void;
  onWordLists(): void;
  onSettings(): void;
  onSaveData(): void;
  onResume(): void;
  onRestart(): void;
  onQuit(): void;
  /** Paused in an Apprentice chapter, so "Practice these keys" is offered. */
  canPracticeChapterKeys(): boolean;
  /** Leave the Apprentice chapter and practice its keys at the same difficulty. */
  onPracticeChapterKeys(): void;
  /** The chapter whose keys "Use my Apprentice keys" picks (1-based). */
  apprenticeKeysChapter(): number;
  onUseApprenticeKeys(): void;
  players(): PlayerEntry[];
  activePlayer(): { name: string; badge: Badge };
  canAddPlayer(): boolean;
  onChoosePlayer(id: string): void;
  /** Add (`id` null) or edit a player. Resolves false if the name is unusable. */
  onSavePlayer(id: string | null, name: string, badge: Badge): Promise<boolean>;
  onDeletePlayer(id: string): void;
  /** e.g. "2.6.0". */
  appVersion(): string;
  /** Open the release notes. */
  onWhatsNew(): void;
  daily(): DailyView;
  /** e.g. "#3 · not played yet" for the title screen. */
  dailyDetail(): string;
  onPlayDaily(): void;
  /** Start Fair Copy: one passage (null) or a timed test of that many seconds. */
  onFairCopy(seconds: number | null): void;
  /** e.g. "Best: 64 WPM" for that kind of test, or null before the first. */
  fairCopyBest(seconds: number | null): string | null;
  /** Whether challenge links are signed with the player's name. */
  dailySigned(): boolean;
  /** The name a signed link would carry, or null if the player's name has none to show. */
  signName(): string | null;
  onSignDaily(on: boolean): void;
  /** A challenge from a link waiting to be taken on, or null. */
  challenge(): ChallengeView | null;
  onTakeChallenge(): void;
  onDismissChallenge(): void;
  /** A save from a transfer link waiting for a choice, or null. */
  transfer(): TransferView | null;
  onTransferAdd(): void;
  onTransferReplace(): void;
  onDismissTransfer(): void;
  /** Copy the share text. Resolves false if the clipboard isn't available. */
  onCopyDaily(): Promise<boolean>;
  /** e.g. "7 of 26 stickers · 2 new!". */
  stickerDetail(): string;
  stickerBook(): { shelves: StickerShelf[]; earned: number; total: number };
  /** The book was opened: its new stickers have been seen. */
  onStickersSeen(): void;
  /** Off on the day's counted Daily Page, which gets one go. */
  canRestart(): boolean;
}

/** The GitHub mark, for the About page's link to the source. */
const GITHUB_SVG = `<svg class="art art-github" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

/** The Inky Keys wordmark: an ink drop beside the name, drawn in SVG. */
const LOGO_SVG = `
<svg class="menu-logo" viewBox="0 0 390 96" role="img" aria-label="Inky Keys">
  <path class="logo-drop" d="M44 6 L26 48 A21 21 0 1 0 62 48 Z"/>
  <circle class="logo-eye" cx="38" cy="62" r="4.2"/><circle class="logo-eye" cx="52" cy="62" r="4.2"/>
  <circle class="logo-shine" cx="34" cy="50" r="3"/>
  <path class="logo-smile" d="M39 72 q6 5 12 0"/>
  <g class="logo-hat logo-hat-christmas">
    <path class="hat-red" d="M32 24 Q36 0 50 -2 Q62 -3 66 10 Q57 7 56 24 Z"/>
    <rect class="hat-trim" x="29" y="20" width="30" height="8" rx="4"/>
    <circle class="hat-trim" cx="66" cy="11" r="5"/>
  </g>
  <g class="logo-hat logo-hat-thanksgiving">
    <ellipse class="hat-pilgrim" cx="44" cy="23" rx="19" ry="3.6"/>
    <path class="hat-pilgrim" d="M33 23 L35 -2 L53 -2 L55 23 Z"/>
    <rect class="hat-band" x="33.6" y="13" width="20.8" height="6"/>
    <rect class="hat-buckle" x="40.5" y="12" width="7" height="8"/>
  </g>
  <text class="logo-word" x="80" y="70">Inky Keys</text>
  <path class="logo-underline" d="M84 82 C160 74 270 90 366 78"/>
</svg>`;

/** Shortcut for the player button on the title screen. */
const PLAYER_KEY = 'u';

export class Menu {
  private readonly root: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private current: MenuScreen | null = null;
  /** When the current screen opened (performance.now()), for the shortcut delay. */
  private shownAt = 0;
  /** The player being added (id null) or edited on the playerEdit screen. */
  private editing: {
    id: string | null;
    name: string;
    badge: Badge;
    confirmDelete: boolean;
    error: string | null;
  } | null = null;

  constructor(
    host: HTMLElement,
    private readonly hooks: MenuHooks,
  ) {
    this.panel = h('div', { className: 'tc-panel menu-panel' });
    this.root = h('div', { className: 'dialog menu', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'menu-title' }, [
      this.panel,
    ]);
    this.root.hidden = true;
    // On the document, so shortcuts still work when focus has dropped to the
    // page body; keys meant for a dialog opened over the menu are left alone.
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const inMenu = target instanceof Node && this.root.contains(target);
      const onPage = target === document.body || target === document.documentElement;
      const otherDialog = document.querySelector('.dialog:not(.menu):not([hidden])') !== null;
      if (inMenu || (onPage && !otherDialog)) this.onKeyDown(event);
    });
    host.append(this.root);
  }

  get screen(): MenuScreen | null {
    return this.current;
  }

  get visible(): boolean {
    return this.current !== null;
  }

  show(screen: MenuScreen): void {
    this.current = screen;
    this.shownAt = performance.now();
    this.root.hidden = false;
    this.root.dataset.screen = screen;
    this.render();
  }

  hide(): void {
    this.current = null;
    this.root.hidden = true;
    // Don't leave focus on a hidden button, or its key handler would keep
    // receiving the player's typing.
    if (this.root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }

  /** Redraw the current screen (e.g. after keys or saves changed). */
  refresh(): void {
    if (this.current) this.render(false);
  }

  private render(focus = true): void {
    const focused = this.panel.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.id : undefined;
    // Redrawing the same screen keeps its scroll position, so choices don't jump.
    const scrollTop = focus ? 0 : this.panel.scrollTop;
    switch (this.current) {
      case 'title':
        this.panel.replaceChildren(...this.title());
        break;
      case 'newNotebook':
        this.panel.replaceChildren(...this.newNotebook());
        break;
      case 'contents':
        this.panel.replaceChildren(...this.contents());
        break;
      case 'desk':
        this.panel.replaceChildren(...this.desk());
        break;
      case 'howToPlay':
        this.panel.replaceChildren(...this.howToPlay());
        break;
      case 'pause':
        this.panel.replaceChildren(...this.pause());
        break;
      case 'players':
        this.panel.replaceChildren(...this.players());
        break;
      case 'playerEdit':
        this.panel.replaceChildren(...this.playerEdit());
        break;
      case 'about':
        this.panel.replaceChildren(...this.about());
        break;
      case 'daily':
        this.panel.replaceChildren(...this.daily());
        break;
      case 'fairCopy':
        this.panel.replaceChildren(...this.fairCopy());
        break;
      case 'stickers':
        this.panel.replaceChildren(...this.stickers());
        break;
      case 'challenge':
        this.panel.replaceChildren(...this.challengeScreen());
        break;
      case 'transfer':
        this.panel.replaceChildren(...this.transferScreen());
        break;
      default:
        return;
    }
    this.panel.scrollTop = scrollTop;
    const restore = focused ? this.panel.querySelector<HTMLElement>(`[data-id="${focused}"]`) : null;
    if (restore) restore.focus({ preventScroll: true });
    else if (focus) (this.panel.querySelector<HTMLElement>('[data-autofocus]') ?? this.buttons()[0])?.focus();
  }

  /** A big menu button with an optional detail line and shortcut hint. */
  private button(
    id: string,
    label: string,
    onClick: () => void,
    opts: { detail?: string | null; key?: string; primary?: boolean; autofocus?: boolean } = {},
  ) {
    return h(
      'button',
      {
        type: 'button',
        className: `menu-btn${opts.primary ? ' menu-primary' : ''}`,
        'data-id': id,
        'data-key': opts.key,
        'data-autofocus': opts.autofocus ? true : undefined,
        onClick,
      },
      [
        h('span', { className: 'menu-label' }, [label]),
        opts.detail ? h('span', { className: 'menu-detail' }, [opts.detail]) : null,
        opts.key ? h('kbd', { className: 'menu-key', 'aria-hidden': 'true' }, [opts.key.toUpperCase()]) : null,
      ],
    );
  }

  /**
   * A main-menu tile: an icon, a label, an optional short status line and
   * the shortcut key in the corner. `size` sets how much of the row it takes.
   */
  private tile(
    id: string,
    size: 'full' | 'half' | 'third' | 'small',
    label: string,
    onClick: () => void,
    opts: { icon?: IconId; detail?: string | null; key: string; primary?: boolean },
  ) {
    const icon = h('span', { className: 'menu-tile-icon' });
    icon.innerHTML = iconSvg(opts.icon ?? (id as IconId));
    return h(
      'button',
      {
        type: 'button',
        className: `menu-tile menu-tile-${size}${opts.primary ? ' menu-primary' : ''}`,
        'data-id': id,
        'data-key': opts.key,
        'data-autofocus': opts.primary ? true : undefined,
        onClick,
      },
      [
        icon,
        h('span', { className: 'menu-tile-text' }, [
          h('span', { className: 'menu-label' }, [label]),
          opts.detail ? h('span', { className: 'menu-detail' }, [opts.detail]) : null,
        ]),
        h('kbd', { className: 'menu-key', 'aria-hidden': 'true' }, [opts.key.toUpperCase()]),
      ],
    );
  }

  private title(): HTMLElement[] {
    const logo = h('div', { className: 'menu-logo-wrap' });
    logo.innerHTML = LOGO_SVG;
    const cont = this.hooks.continueDetail();
    const best = this.hooks.bestLine(this.hooks.selectedDifficulty());
    const player = this.hooks.activePlayer();
    return [
      h('header', { className: 'menu-header' }, [
        logo,
        h('h1', { id: 'menu-title', className: 'visually-hidden' }, ['Inky Keys']),
        h('p', { className: 'menu-tagline' }, [t('menu.tagline')]),
      ]),
      h(
        'button',
        { type: 'button', className: 'menu-player', 'data-id': 'player', 'data-key': PLAYER_KEY, onClick: () => this.show('players') },
        [
          artElement(badgeSvg(player.badge), 'menu-player-badge'),
          h('span', { className: 'menu-player-name' }, [t('menu.player', { name: player.name })]),
          h('span', { className: 'menu-player-switch' }, [t('menu.switchPlayer'), ' ', h('kbd', { 'aria-hidden': 'true' }, [PLAYER_KEY.toUpperCase()])]),
        ],
      ),
      h('nav', { className: 'menu-tiles', 'aria-label': t('menu.nav') }, [
        cont ? this.tile('continue', 'full', t('menu.continue'), () => this.hooks.onContinue(), { detail: cont, key: t('menu.key.continue'), primary: true }) : null,
        this.tile('practice', 'half', t('menu.practice'), () => this.show('newNotebook'), {
          icon: 'freeWrite',
          detail: this.hooks.keysSummary(),
          key: t('menu.key.freeWrite'),
          primary: !cont,
        }),
        this.tile('daily', 'half', t('menu.daily'), () => this.show('daily'), { detail: this.hooks.dailyDetail(), key: t('menu.key.daily') }),
        this.tile('apprentice', 'half', t('menu.apprentice'), () => this.show('contents'), {
          detail: this.hooks.apprenticeDetail(),
          key: t('menu.key.apprentice'),
        }),
        this.tile('fairCopy', 'half', t('menu.fairCopy'), () => this.show('fairCopy'), { detail: t('menu.fairCopyDetail'), key: t('menu.key.fairCopy') }),
        this.tile('desk', 'half', t('menu.desk'), () => this.show('desk'), { key: t('menu.key.desk') }),
        this.tile('stickers', 'half', t('menu.stickers'), () => this.show('stickers'), { detail: this.hooks.stickerDetail(), key: t('menu.key.stickers') }),
        this.tile('words', 'third', t('menu.wordLists'), () => this.hooks.onWordLists(), { key: t('menu.key.wordLists') }),
        this.tile('how', 'third', t('menu.howToPlay'), () => this.show('howToPlay'), { key: t('menu.key.howToPlay') }),
        this.tile('settings', 'third', t('menu.settings'), () => this.hooks.onSettings(), { key: t('menu.key.settings') }),
        this.tile('saves', 'small', t('menu.saveData'), () => this.hooks.onSaveData(), { key: t('menu.key.saveData') }),
        this.tile('about', 'small', t('menu.about'), () => this.show('about'), { key: t('menu.key.about') }),
      ]),
      h('p', { className: 'menu-best' }, [this.hooks.rankLine(), best ? h('br') : null, best]),
    ];
  }

  /** The Desk: rank, level progress, and cosmetics to equip. */
  private desk(): HTMLElement[] {
    const level = this.hooks.level();
    const equipped = this.hooks.cosmetics();
    const stickers = this.hooks.stickers();
    const bar = h('div', { className: 'desk-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 });
    const pct = Math.round(this.hooks.levelFraction() * 100);
    bar.setAttribute('aria-valuenow', String(pct));
    bar.style.setProperty('--fill', `${pct}%`);

    const group = (slot: CosmeticSlot) =>
      h('fieldset', { className: 'st-group' }, [
        h('legend', {}, [t(`desk.${slot}` as MessageKey)]),
        h(
          'div',
          { className: 'desk-options', role: 'radiogroup', 'aria-label': t(`desk.${slot}` as MessageKey) },
          Object.entries(UNLOCKS[slot] as Record<string, Unlock>).map(([item, at]) => {
            // Something already in use stays usable, even if levels were rebalanced since.
            const open = isUnlocked(slot, item as never, level, stickers) || equipped[slot] === item;
            const locked = typeof at === 'number' ? t('desk.locked', { level: at }) : t(`desk.locked.${at.sticker}` as MessageKey);
            return h(
              'button',
              {
                type: 'button',
                role: 'radio',
                className: 'menu-btn desk-option',
                'aria-checked': String(equipped[slot] === item),
                'data-id': `${slot}-${item}`,
                'data-slot': slot,
                'data-item': item,
                disabled: !open,
                onClick: () => {
                  this.hooks.onEquip(slot, item);
                  this.render(false);
                },
              },
              [
                artElement(cosmeticSvg(slot, item), 'desk-art'),
                h('span', { className: 'menu-label' }, [t(`${slot}.${item}` as MessageKey)]),
                open ? null : h('span', { className: 'menu-detail' }, [locked]),
              ],
            );
          }),
        ),
      ]);

    return [
      h('h2', { id: 'menu-title' }, [t('desk.title')]),
      h('p', { className: 'tc-intro' }, [t('desk.intro')]),
      h('p', { className: 'menu-keys-line' }, [this.hooks.rankLine()]),
      bar,
      group('nib'),
      group('splatter'),
      group('paper'),
      group('hat'),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-primary', 'data-id': 'back', 'data-autofocus': true, onClick: () => this.show('title') }, [
          t('menu.back'),
        ]),
      ]),
    ];
  }

  /** Difficulty choice, shared by the Contents and Practice screens. */
  private difficultyPicker(compact: boolean): HTMLElement {
    const selected = this.hooks.selectedDifficulty();
    return h(
      'div',
      { className: `menu-difficulties${compact ? ' menu-difficulties-compact' : ''}`, role: 'radiogroup', 'aria-label': t('newNotebook.intro') },
      DIFFICULTIES.map((d, i) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(d === selected),
            className: 'menu-btn menu-difficulty',
            'data-id': `difficulty-${d}`,
            'data-key': String(i + 1),
            onClick: () => {
              this.hooks.onSelectDifficulty(d);
              this.render(false);
            },
          },
          [
            h('span', { className: 'menu-label' }, [t(`difficulty.${d}` as MessageKey)]),
            compact ? null : h('span', { className: 'menu-detail' }, [t(`difficulty.${d}.description` as MessageKey)]),
            h('kbd', { className: 'menu-key', 'aria-hidden': 'true' }, [String(i + 1)]),
          ],
        ),
      ),
    );
  }

  /** The Apprentice notebook's table of contents: pick a chapter to play. */
  private contents(): HTMLElement[] {
    const chapters = this.hooks.chapters();
    const nextOpen = [...chapters].reverse().find((c) => !c.locked);
    return [
      h('h2', { id: 'menu-title' }, [t('contents.title')]),
      h('p', { className: 'tc-intro' }, [t('contents.intro')]),
      this.difficultyPicker(true),
      h(
        'ol',
        { className: 'menu-chapters' },
        chapters.map((c) =>
          h('li', {}, [
            h(
              'button',
              {
                type: 'button',
                className: 'menu-btn menu-chapter',
                'data-id': `chapter-${c.chapter}`,
                'data-autofocus': c === nextOpen ? true : undefined,
                disabled: c.locked,
                'aria-label': c.locked
                  ? t('contents.lockedLabel', { chapter: c.chapter + 1 })
                  : t('contents.chapterLabel', { chapter: c.chapter + 1, keys: c.newKeys, earned: c.stars.earned, max: c.stars.max }),
                onClick: () => this.hooks.onStartApprentice(c.chapter),
              },
              [
                h('span', { className: 'menu-label' }, [t('contents.chapter', { chapter: c.chapter + 1 })]),
                h('span', { className: 'menu-detail' }, [
                  c.locked ? t('contents.locked') : t('contents.keys', { keys: c.newKeys }),
                  !c.locked && c.best ? ` · ${c.best}` : '',
                ]),
                h('span', { className: 'menu-stars', 'aria-hidden': 'true' }, [
                  c.locked ? '🔒' : `★ ${c.stars.earned}/${c.stars.max}`,
                ]),
              ],
            ),
          ]),
        ),
      ),
      ...[this.accentsPart()].filter((part): part is HTMLElement => part !== null),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'back', onClick: () => this.show('title') }, [t('menu.back')]),
      ]),
    ];
  }

  /** The Contents page's second part: accent chapters, for a words language that has accents. */
  private accentsPart(): HTMLElement | null {
    const chapters = this.hooks.accentChapters();
    if (chapters.length === 0) return null;
    return h('section', { className: 'menu-accents', 'aria-labelledby': 'menu-accents-title' }, [
      h('h3', { id: 'menu-accents-title', className: 'menu-part-title' }, [t('contents.accentsTitle')]),
      h('p', { className: 'tc-intro' }, [
        chapters[0]!.locked ? t('contents.accentsLocked') : t('contents.accentsIntro'),
        ' ',
        h('button', { type: 'button', className: 'menu-link', 'data-id': 'accent-help', onClick: () => this.hooks.onAccentHelp() }, [
          t('contents.accentsHelp'),
        ]),
      ]),
      h(
        'ol',
        { className: 'menu-chapters menu-accent-chapters' },
        chapters.map((c) =>
          h('li', {}, [
            h(
              'button',
              {
                type: 'button',
                className: 'menu-btn menu-chapter',
                'data-id': `accents-${c.chapter}`,
                disabled: c.locked,
                'aria-label': c.locked
                  ? t('contents.accentLockedLabel', { chapter: c.chapter + 1 })
                  : t('contents.accentChapterLabel', { chapter: c.chapter + 1, letters: c.letters, earned: c.stars.earned, max: c.stars.max }),
                onClick: () => this.hooks.onStartAccents(c.chapter),
              },
              [
                h('span', { className: 'menu-label menu-accent-letters' }, [c.letters]),
                h('span', { className: 'menu-detail' }, [c.locked ? t('contents.locked') : t('contents.accentChapter', { chapter: c.chapter + 1 })]),
                h('span', { className: 'menu-stars', 'aria-hidden': 'true' }, [c.locked ? '🔒' : `★ ${c.stars.earned}/${c.stars.max}`]),
              ],
            ),
          ]),
        ),
      ),
    ]);
  }

  private newNotebook(): HTMLElement[] {
    return [
      h('h2', { id: 'menu-title' }, [t('newNotebook.title')]),
      h('p', { className: 'tc-intro' }, [t('newNotebook.intro')]),
      this.difficultyPicker(false),
      h('p', { className: 'menu-keys-line' }, [
        t('newNotebook.keys', { keys: this.hooks.keysSummary() }),
        ' ',
        h('button', { type: 'button', className: 'menu-link', 'data-id': 'change-keys', onClick: () => this.hooks.onKeys() }, [
          t('newNotebook.changeKeys'),
        ]),
      ]),
      h('p', { className: 'menu-keys-line' }, [
        h(
          'button',
          {
            type: 'button',
            className: 'menu-link',
            'data-id': 'apprentice-keys',
            onClick: () => {
              this.hooks.onUseApprenticeKeys();
              this.render(false);
            },
          },
          [t('newNotebook.useApprentice', { chapter: this.hooks.apprenticeKeysChapter() })],
        ),
      ]),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'back', onClick: () => this.show('title') }, [t('menu.back')]),
        h('button', { type: 'button', className: 'tc-primary', 'data-id': 'start', 'data-autofocus': true, onClick: () => this.hooks.onStart() }, [
          t('newNotebook.start'),
        ]),
      ]),
    ];
  }

  private howToPlay(): HTMLElement[] {
    const section = (title: MessageKey, ...body: (HTMLElement | string | null)[]) =>
      h('section', { className: 'how-section' }, [h('h3', {}, [t(title)]), ...body]);
    const p = (key: MessageKey) => h('p', {}, [t(key)]);
    // Pictures are drawn by the game renderer; if one can't be, the words still stand.
    const picture = (id: MechanicId) => {
      const src = this.hooks.portrait(id);
      return src ? h('img', { className: 'how-art', src, alt: '' }) : h('span', { className: 'how-art how-art-none', 'aria-hidden': 'true' }, ['✎']);
    };
    const creature = (id: MechanicId, text: MessageKey) => h('li', { className: 'how-creature' }, [picture(id), h('p', {}, [t(text)])]);
    const variant = (id: MechanicId) =>
      h('figure', { className: 'how-variant' }, [picture(id), h('figcaption', {}, [t(`tutorial.${id}.title` as MessageKey)])]);
    const control = (keys: string[], action: MessageKey) =>
      h('div', { className: 'how-control' }, [
        h('dt', {}, keys.map((k) => h('kbd', {}, [k]))),
        h('dd', {}, [t(action)]),
      ]);
    const hands = this.hooks.handsPicture();
    const iconTile = (icon: IconId, text: string, detail?: string) => {
      const art = h('span', { className: 'how-tile-icon' });
      art.innerHTML = iconSvg(icon);
      return h('li', { className: 'how-tile' }, [art, h('span', {}, [text]), detail ? h('span', { className: 'how-tile-detail' }, [detail]) : null]);
    };
    return [
      h('h2', { id: 'menu-title' }, [t('how.title')]),
      section(
        'how.goalTitle',
        p('how.goal'),
        h('ol', { className: 'how-tiles' }, [
          iconTile('freeWrite', t('how.step.type'), t('how.step.typeDetail')),
          iconTile('margin', t('how.step.margin'), t('how.step.marginDetail')),
          iconTile('pageDone', t('how.step.page'), t('how.step.pageDetail')),
        ]),
      ),
      section(
        'how.modesTitle',
        h('ul', { className: 'how-tiles how-tiles-2' }, [
          iconTile('freeWrite', t('menu.practice'), t('how.mode.freeWrite')),
          iconTile('apprentice', t('menu.apprentice'), t('how.mode.apprentice')),
          iconTile('daily', t('menu.daily'), t('how.mode.daily')),
          iconTile('fairCopy', t('menu.fairCopy'), t('how.mode.fairCopy')),
        ]),
      ),
      section(
        'how.creaturesTitle',
        h('ul', { className: 'how-creatures' }, [
          creature('basics', 'how.drip'),
          creature('blotling', 'how.blotling'),
          creature('runon', 'how.runon'),
          creature('recovery', 'how.bottle'),
        ]),
      ),
      section('how.variantsTitle', h('div', { className: 'how-variants' }, [variant('crimson'), variant('violet'), variant('ghost')]), p('how.variants')),
      section(
        'how.bossTitle',
        p('how.boss'),
        h(
          'ul',
          { className: 'how-creatures' },
          (['spill', 'bookworm', 'shuffler', 'squid', 'quill'] as const).map((id) => creature(id, `how.boss.${id}`)),
        ),
      ),
      section(
        'how.powersTitle',
        p('how.powers'),
        h('dl', { className: 'how-controls' }, [
          control(['↑'], 'how.power.paperweight'),
          control(['↓'], 'how.power.highlighter'),
          control([t('keycap.enter')], 'how.power.blotter'),
          control([], 'how.power.eraser'),
          control([], 'how.power.paper'),
        ]),
      ),
      section('how.keysTitle', hands ? h('img', { className: 'how-hands', src: hands, alt: t('how.handsAlt') }) : null, p('how.keys')),
      section(
        'how.controlsTitle',
        h('dl', { className: 'how-controls' }, [
          control([t('how.control.typeKey')], 'how.control.type'),
          control([t('keycap.tab')], 'how.control.tab'),
          control([t('keycap.backspace')], 'how.control.backspace'),
          control([t('keycap.esc')], 'how.control.esc'),
          control(['R', 'M'], 'how.control.card'),
        ]),
      ),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-primary', 'data-id': 'back', onClick: () => this.show('title') }, [t('menu.back')]),
      ]),
    ];
  }

  private pause(): HTMLElement[] {
    return [
      h('h2', { id: 'menu-title' }, [t('pause.title')]),
      h('p', { className: 'tc-intro' }, [this.hooks.pauseSummary()]),
      h('nav', { className: 'menu-list' }, [
        this.button('resume', t('pause.resume'), () => this.hooks.onResume(), { key: t('keycap.esc'), primary: true }),
        this.hooks.canRestart() ? this.button('restart', t('pause.restart'), () => this.hooks.onRestart(), { key: t('menu.key.restart') }) : null,
        this.hooks.canPracticeChapterKeys()
          ? this.button('practice', t('pause.practice'), () => this.hooks.onPracticeChapterKeys(), { detail: t('pause.practiceDetail'), key: t('menu.key.practice') })
          : null,
        this.button('settings', t('menu.settings'), () => this.hooks.onSettings(), { key: t('menu.key.pauseSettings') }),
        this.button('quit', t('pause.quit'), () => this.hooks.onQuit(), { key: t('menu.key.quit') }),
      ]),
      h('p', { className: 'menu-best' }, [t('pause.note')]),
    ];
  }

  /** "Sign my challenge link as Pip": off unless ticked, so a name is only shared on purpose. */
  private signToggle(): HTMLElement {
    const name = this.hooks.signName();
    const box = h('input', { type: 'checkbox', 'data-id': 'sign' });
    box.checked = this.hooks.dailySigned();
    box.disabled = name === null;
    box.addEventListener('change', () => {
      this.hooks.onSignDaily(box.checked);
      this.render(false);
    });
    return h('label', { className: 'daily-sign' }, [box, name ? t('daily.sign', { name }) : t('daily.signNoName')]);
  }

  /** A challenge from a link: who, what score, and whether it counts. */
  private challengeScreen(): HTMLElement[] {
    const c = this.hooks.challenge();
    if (!c) {
      queueMicrotask(() => this.show('title'));
      return [];
    }
    const args = { id: c.id, name: c.name ?? '', score: c.score };
    const when = c.counts
      ? t('challenge.counts')
      : c.daysAgo === 0
        ? t('challenge.played')
        : c.daysAgo < 0
          ? t('challenge.future')
          : c.daysAgo === 1
            ? t('challenge.yesterday')
            : t('challenge.past', { days: c.daysAgo });
    const dismiss = () => {
      this.hooks.onDismissChallenge();
      this.show('title');
    };
    return [
      h('h2', { id: 'menu-title' }, [t('challenge.title')]),
      h('p', { className: 'tc-intro' }, [c.name ? t('challenge.from', args) : t('challenge.fromAnon', args)]),
      c.pages.length > 0 ? this.pageTiles(c.pages) : null,
      h('p', { className: 'tc-intro' }, [when]),
      c.otherLayout ? h('p', { className: 'tc-intro' }, [t('challenge.otherLayout', { theirs: c.otherLayout, mine: c.myLayout })]) : null,
      c.otherWords ? h('p', { className: 'tc-intro' }, [t('challenge.otherWords', { theirs: c.otherWords, mine: c.myWords })]) : null,
      h('nav', { className: 'menu-list' }, [
        this.button('take', t('challenge.take'), () => this.hooks.onTakeChallenge(), {
          detail: t('challenge.takeDetail', { pages: DAILY_PAGES }),
          key: t('menu.key.takeChallenge'),
          primary: true,
        }),
      ]),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'back', onClick: dismiss }, [t('challenge.notNow')]),
      ]),
    ].filter((el): el is HTMLElement => el !== null);
  }

  /** Replace is a second step, so a save isn't overwritten by one slip. */
  private confirmingReplace = false;

  /** A save from a transfer link: whose it is, and add it as a player or put it in place of this one. */
  private transferScreen(): HTMLElement[] {
    const v = this.hooks.transfer();
    if (!v) {
      queueMicrotask(() => this.show('title'));
      return [];
    }
    const dismiss = () => {
      this.confirmingReplace = false;
      this.hooks.onDismissTransfer();
      this.show('title');
    };
    const back = (label: string) =>
      h('div', { className: 'tc-actions' }, [h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'back', onClick: dismiss }, [label])]);
    if ('error' in v) {
      return [h('h2', { id: 'menu-title' }, [t('transfer.title')]), h('p', { className: 'tc-intro' }, [v.error]), back(t('menu.back'))];
    }
    if (this.confirmingReplace) {
      return [
        h('h2', { id: 'menu-title' }, [t('transfer.replaceTitle')]),
        h('p', { className: 'tc-warning' }, [t('transfer.replaceWarning', { current: v.currentName, name: v.name })]),
        h('nav', { className: 'menu-list' }, [
          this.button('replace-yes', t('transfer.replaceConfirm', { current: v.currentName }), () => {
            this.confirmingReplace = false;
            this.hooks.onTransferReplace();
          }),
          this.button(
            'replace-no',
            t('transfer.replaceCancel'),
            () => {
              this.confirmingReplace = false;
              this.render();
            },
            { primary: true, autofocus: true },
          ),
        ]),
      ];
    }
    const add = this.button('transfer-add', t('transfer.add'), () => this.hooks.onTransferAdd(), {
      detail: v.canAdd ? t('transfer.addDetail') : t('transfer.addFull'),
      primary: v.canAdd,
      autofocus: v.canAdd,
    });
    add.disabled = !v.canAdd;
    return [
      h('h2', { id: 'menu-title' }, [t('transfer.title')]),
      h('p', { className: 'tc-intro' }, [t('transfer.intro')]),
      h('div', { className: 'menu-player transfer-player' }, [
        artElement(badgeSvg(v.badge), 'menu-player-badge'),
        h('span', { className: 'transfer-player-text' }, [
          h('strong', {}, [v.name]),
          h('span', { className: 'menu-detail' }, [v.detail]),
          h('span', { className: 'menu-detail' }, [t('menu.stickersDetail', { earned: v.stickers, total: this.hooks.stickerBook().total })]),
        ]),
      ]),
      h('nav', { className: 'menu-list' }, [
        add,
        this.button(
          'transfer-replace',
          t('transfer.replace', { current: v.currentName }),
          () => {
            this.confirmingReplace = true;
            this.render();
          },
          { detail: t('transfer.replaceDetail') },
        ),
      ]),
      back(t('transfer.notNow')),
    ];
  }

  /** One tile per page, coloured by its grade, with the page number and grade on it. */
  private pageTiles(pages: { page: number; grade: Grade | null; mark: PageMark }[]): HTMLElement {
    return h(
      'ol',
      { className: 'daily-pages' },
      pages.map((p) =>
        h(
          'li',
          {
            className: `daily-page daily-${p.mark}`,
            'aria-label': p.grade ? t('daily.pageGrade', { page: p.page, grade: p.grade }) : t('daily.pageNotReached', { page: p.page }),
          },
          [
            h('span', { className: 'daily-page-label', 'aria-hidden': 'true' }, [t('daily.pageLabel', { page: p.page })]),
            h('span', { className: 'daily-page-grade', 'aria-hidden': 'true' }, [p.grade ?? t('daily.notReached')]),
          ],
        ),
      ),
    );
  }

  /** The sticker book: every sticker by shelf, earned or not. Opening it marks new ones seen. */
  private stickers(): HTMLElement[] {
    const book = this.hooks.stickerBook();
    this.hooks.onStickersSeen();
    return [
      // Focus starts on the heading, so the book opens at the top rather than scrolled to Back.
      h('h2', { id: 'menu-title', tabindex: -1, 'data-autofocus': true }, [t('stickers.title')]),
      h('p', { className: 'tc-intro' }, [t('stickers.intro')]),
      h('p', { className: 'stickers-count' }, [t('stickers.count', { earned: book.earned, total: book.total })]),
      ...book.shelves.map((shelf) =>
        h('section', { className: 'stickers-shelf' }, [
          h('h3', {}, [shelf.title]),
          h(
            'ul',
            { className: 'stickers-grid' },
            shelf.stickers.map((s) =>
              // Earned: the name and when (how is on hover). Not yet: the name and how to earn it.
              h('li', { className: `sticker${s.earnedOn ? '' : ' sticker-locked'}${s.isNew ? ' sticker-new' : ''}`, title: s.earnedOn ? s.how : undefined }, [
                stickerArt(s.emoji, s.group),
                h('span', { className: 'sticker-text' }, [
                  h('span', { className: 'sticker-name' }, [
                    s.name,
                    s.isNew ? h('span', { className: 'sticker-badge' }, [t('stickers.new')]) : null,
                  ]),
                  s.earnedOn ? h('span', { className: 'sticker-when' }, [s.earnedOn]) : h('span', { className: 'sticker-how' }, [s.how]),
                ]),
              ]),
            ),
          ),
        ]),
      ),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-primary', 'data-id': 'back', onClick: () => this.show('title') }, [t('menu.back')]),
      ]),
    ];
  }

  /** Today's Daily Page: play it, or see and copy the result. */
  /** A Fair Copy choice's detail line, with the best so far when there is one. */
  private fairCopyDetail(detail: string, seconds: number | null): string {
    const best = this.hooks.fairCopyBest(seconds);
    return best ? `${detail} · ${best}` : detail;
  }

  /** Fair Copy: pick one passage or a timed test. */
  private fairCopy(): HTMLElement[] {
    return [
      h('h2', { id: 'menu-title' }, [t('fairCopyMenu.title')]),
      h('p', { className: 'tc-intro' }, [t('fairCopyMenu.intro')]),
      h('nav', { className: 'menu-list' }, [
        this.button('fair-passage', t('fairCopyMenu.passage'), () => this.hooks.onFairCopy(null), {
          detail: this.fairCopyDetail(t('fairCopyMenu.passageDetail'), null),
          key: t('menu.key.fairCopyPassage'),
          primary: true,
          autofocus: true,
        }),
        ...(GAME_CONFIG.fairCopy.timedSeconds as readonly number[]).map((seconds) =>
          this.button(`fair-${seconds}`, t('fairCopyMenu.timed', { seconds }), () => this.hooks.onFairCopy(seconds), {
            detail: this.fairCopyDetail(t('fairCopyMenu.timedDetail'), seconds),
            key: String(seconds).charAt(0),
          }),
        ),
      ]),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'back', onClick: () => this.show('title') }, [t('menu.back')]),
      ]),
    ];
  }

  private daily(): HTMLElement[] {
    const d = this.hooks.daily();
    const copied = h('span', { className: 'daily-copied', role: 'status', 'aria-live': 'polite' });
    const shareText = d.shareText;
    const share = shareText
      ? h('textarea', { className: 'daily-share', readonly: true, rows: shareText.split('\n').length, 'aria-label': t('daily.shareLabel'), 'data-id': 'share-text' })
      : null;
    if (share && shareText) {
      share.value = shareText;
      // Grow to fit the text once it's on screen, wrapped link and all.
      requestAnimationFrame(() => {
        share.style.height = 'auto';
        share.style.height = `${share.scrollHeight + 2}px`;
      });
    }
    const copy = async () => {
      const ok = await this.hooks.onCopyDaily();
      if (!ok && share) share.select();
      copied.textContent = ok ? t('daily.copied') : t('daily.copyManually');
    };
    const parts: (HTMLElement | null)[] = [
      h('h2', { id: 'menu-title' }, [t('daily.title', { id: d.id })]),
      h('p', { className: 'tc-intro' }, [t('daily.intro')]),
      this.streakStrip(d.streak, d.week),
      d.pages ? this.pageTiles(d.pages) : null,
      h('p', { className: 'daily-status' }, [d.status]),
      share,
      share ? this.signToggle() : null,
      h('nav', { className: 'menu-list' }, [
        d.played
          ? this.button('copy', t('daily.copy'), () => void copy(), { key: t('menu.key.copyDaily'), primary: true, autofocus: true })
          : null,
        this.button('play-daily', d.played ? t('daily.playAgain') : t('daily.play'), () => this.hooks.onPlayDaily(), {
          detail: d.played ? t('daily.playAgainDetail') : t('daily.playDetail', { pages: DAILY_PAGES }),
          key: t('menu.key.playDaily'),
          primary: !d.played,
          autofocus: !d.played,
        }),
      ]),
      copied,
      h('p', { className: 'menu-best' }, [d.record]),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'back', onClick: () => this.show('title') }, [t('menu.back')]),
      ]),
    ];
    return parts.filter((el): el is HTMLElement => el !== null);
  }

  /** The streak: an ink drop on fire with the number, and this week's days, filled in where played. */
  private streakStrip(streak: number, week: StreakDay[]): HTMLElement {
    const day = new Intl.DateTimeFormat(getLocale(), { weekday: 'narrow' });
    const dayName = new Intl.DateTimeFormat(getLocale(), { weekday: 'long' });
    return h('section', { className: `daily-streak${streak > 0 ? ' daily-streak-lit' : ''}`, 'aria-label': t('daily.streakLabel', { streak }) }, [
      h('div', { className: 'daily-streak-head', 'aria-hidden': 'true' }, [
        artElement(streakDropSvg(streak > 0), 'daily-streak-drop'),
        h('span', { className: 'daily-streak-number' }, [
          h('span', { className: 'daily-streak-count' }, [String(streak)]),
          h('span', { className: 'daily-streak-unit' }, [t('daily.streakUnit')]),
        ]),
      ]),
      h(
        'ol',
        { className: 'daily-week' },
        week.map((w) => {
          const name = dayName.format(w.date);
          const label = w.played
            ? t('daily.dayPlayed', { day: name })
            : w.today
              ? t('daily.dayToday', { day: name })
              : w.future
                ? t('daily.dayLater', { day: name })
                : t('daily.dayMissed', { day: name });
          const state = w.played ? 'played' : w.today ? 'today' : w.future ? 'later' : 'missed';
          return h('li', { className: `daily-day daily-day-${state}`, 'aria-label': label }, [
            h('span', { className: 'daily-day-box', 'aria-hidden': 'true' }, [w.played ? artElement(dayDropSvg(), 'daily-day-drop') : null]),
            h('span', { className: 'daily-day-name', 'aria-hidden': 'true' }, [day.format(w.date)]),
          ]);
        }),
      ),
    ]);
  }

  /** Pick who's playing, or add and edit players. */
  private players(): HTMLElement[] {
    const players = this.hooks.players();
    return [
      h('h2', { id: 'menu-title' }, [t('players.title')]),
      h('p', { className: 'tc-intro' }, [t('players.intro')]),
      h(
        'ul',
        { className: 'menu-players' },
        players.map((p) =>
          h('li', { className: 'menu-player-row' }, [
            h(
              'button',
              {
                type: 'button',
                className: 'menu-btn menu-player-pick',
                'aria-current': p.active ? 'true' : undefined,
                'data-id': `player-${p.id}`,
                'data-autofocus': p.active ? true : undefined,
                'aria-label': t('players.choose', { name: p.name }),
                onClick: () => this.hooks.onChoosePlayer(p.id),
              },
              [
                artElement(badgeSvg(p.badge), 'menu-player-badge'),
                h('span', { className: 'menu-label' }, [p.name]),
                h('span', { className: 'menu-detail' }, [p.detail]),
              ],
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'tc-secondary menu-player-edit',
                'data-id': `edit-${p.id}`,
                'aria-label': t('players.editLabel', { name: p.name }),
                onClick: () => this.editPlayer(p),
              },
              [t('players.edit')],
            ),
          ]),
        ),
      ),
      h('div', { className: 'tc-actions' }, [
        this.hooks.canAddPlayer()
          ? h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'add-player', onClick: () => this.editPlayer(null) }, [t('players.add')])
          : h('p', { className: 'menu-keys-line' }, [t('players.full')]),
        h('button', { type: 'button', className: 'tc-primary', 'data-id': 'back', onClick: () => this.show('title') }, [t('menu.back')]),
      ]),
    ];
  }

  private editPlayer(player: PlayerEntry | null): void {
    const used = new Set(this.hooks.players().map((p) => p.badge));
    const base = { confirmDelete: false, error: null };
    this.editing = player
      ? { ...base, id: player.id, name: player.name, badge: player.badge }
      : { ...base, id: null, name: '', badge: BADGES.find((b) => !used.has(b)) ?? 'ink' };
    this.show('playerEdit');
  }

  private playerEdit(): HTMLElement[] {
    const e = this.editing;
    if (!e) return this.players();
    const name = h('input', {
      type: 'text',
      id: 'player-name',
      className: 'menu-input',
      maxlength: MAX_NAME_LENGTH,
      autocomplete: 'off',
      spellcheck: 'false',
      value: e.name,
      'data-id': 'player-name',
      'data-autofocus': true,
      onInput: (event) => {
        e.name = (event.target as HTMLInputElement).value;
      },
    });
    const save = async () => {
      const ok = await this.hooks.onSavePlayer(e.id, e.name, e.badge);
      if (ok) {
        this.editing = null;
        this.show('players');
      } else {
        e.error = t('players.nameNeeded');
        this.render(false);
        this.panel.querySelector<HTMLInputElement>('#player-name')?.focus();
      }
    };
    const canDelete = e.id !== null && this.hooks.players().length > 1;
    const player = this.hooks.players().find((p) => p.id === e.id);
    return [
      h('h2', { id: 'menu-title' }, [t(e.id ? 'players.editTitle' : 'players.newTitle')]),
      h(
        'form',
        {
          className: 'menu-player-form',
          onSubmit: (event) => {
            event.preventDefault();
            void save();
          },
        },
        [
          h('label', { className: 'menu-field', for: 'player-name' }, [t('players.name')]),
          name,
          e.error ? h('p', { className: 'tc-warning', role: 'alert' }, [e.error]) : null,
          h('fieldset', { className: 'st-group' }, [
            h('legend', {}, [t('players.badge')]),
            h(
              'div',
              { className: 'menu-badges', role: 'radiogroup', 'aria-label': t('players.badge') },
              BADGES.map((badge) =>
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'radio',
                    className: 'menu-badge',
                    'aria-checked': String(badge === e.badge),
                    'aria-label': t(`badge.${badge}` as MessageKey),
                    'data-id': `badge-${badge}`,
                    onClick: () => {
                      e.badge = badge;
                      this.render(false);
                    },
                  },
                  [artElement(badgeSvg(badge), 'menu-player-badge')],
                ),
              ),
            ),
          ]),
          canDelete && e.confirmDelete
            ? h('div', { className: 'menu-confirm', role: 'alert' }, [
                h('p', {}, [t('players.deleteConfirm', { name: player?.name ?? e.name })]),
                h('div', { className: 'tc-actions' }, [
                  h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'delete-no', onClick: () => {
                    e.confirmDelete = false;
                    this.render(false);
                  } }, [t('players.cancel')]),
                  h('button', { type: 'button', className: 'tc-secondary sd-danger', 'data-id': 'delete-yes', onClick: () => {
                    if (e.id) this.hooks.onDeletePlayer(e.id);
                    this.editing = null;
                    this.show('players');
                  } }, [t('players.deleteYes')]),
                ]),
              ])
            : null,
          h('div', { className: 'tc-actions' }, [
            canDelete && !e.confirmDelete
              ? h('button', { type: 'button', className: 'tc-secondary sd-danger', 'data-id': 'delete', onClick: () => {
                  e.confirmDelete = true;
                  this.render(false);
                  this.panel.querySelector<HTMLElement>('[data-id="delete-no"]')?.focus();
                } }, [t('players.delete')])
              : null,
            h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'cancel', onClick: () => {
              this.editing = null;
              this.show('players');
            } }, [t('players.cancel')]),
            h('button', { type: 'submit', className: 'tc-primary', 'data-id': 'save' }, [t('players.save')]),
          ]),
        ],
      ),
    ];
  }

  /** What Inky Keys is, why it exists, and where its code lives. */
  private about(): HTMLElement[] {
    const link = (id: string, href: string, label: string, icon: string) => {
      const art = h('span', { className: 'menu-tile-icon' });
      art.innerHTML = icon;
      return h('a', { className: 'menu-tile menu-tile-third', href, target: '_blank', rel: 'noopener noreferrer', 'data-id': id }, [
        art,
        h('span', { className: 'menu-tile-text' }, [
          h('span', { className: 'menu-label' }, [label, h('span', { className: 'visually-hidden' }, [' ', t('about.newTab')])]),
        ]),
      ]);
    };
    const news = this.tile('whats-new', 'third', t('about.whatsNew'), () => this.hooks.onWhatsNew(), { icon: 'stickers', key: t('menu.key.whatsNew') });
    return [
      h('h2', { id: 'menu-title' }, [t('about.title')]),
      h('p', { className: 'menu-version' }, [t('about.version', { version: this.hooks.appVersion() })]),
      h('p', { className: 'tc-intro' }, [t('about.what')]),
      h('nav', { className: 'menu-tiles' }, [
        news,
        link('source', REPO_URL, t('about.source'), GITHUB_SVG),
        link('suggest', ISSUES_URL, t('about.suggest'), iconSvg('words')),
      ]),
      h('p', { className: 'menu-best' }, [t('about.why')]),
      // The website's plain pages (scripts/site-pages.ts), in a new tab so the game stays open.
      h(
        'p',
        { className: 'menu-best about-pages' },
        (['how-to-play', 'parents-and-teachers', 'privacy'] as const).flatMap((slug, i) => [
          i > 0 ? ' · ' : '',
          h('a', { href: `${import.meta.env.BASE_URL}${slug}/`, target: '_blank', rel: 'noopener', 'data-id': `page-${slug}` }, [
            t(`about.page.${slug}` as MessageKey),
            h('span', { className: 'visually-hidden' }, [' ', t('about.newTab')]),
          ]),
        ]),
      ),
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-primary', 'data-id': 'back', 'data-autofocus': true, onClick: () => this.show('title') }, [
          t('menu.back'),
        ]),
      ]),
    ];
  }

  /** Everything focusable on the screen, in order. */
  private buttons(): HTMLElement[] {
    return [...this.panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input')];
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.current || event.ctrlKey || event.metaKey || event.altKey) return;
    const buttons = this.buttons();
    const index = buttons.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.current === 'pause') this.hooks.onResume();
      else if (this.current === 'playerEdit') {
        this.editing = null;
        this.show('players');
      } else if (this.current !== 'title') this.show('title');
      return;
    }
    // Typing a name: leave the keys to the text box (Enter submits the form).
    // Checkboxes only need Space, so shortcuts still work from them.
    if (event.target instanceof HTMLInputElement && event.target.type !== 'checkbox') return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + step + buttons.length) % buttons.length]?.focus();
      return;
    }
    if (event.key === 'Tab') {
      // Keep focus inside the menu.
      const last = buttons.length - 1;
      if (!event.shiftKey && index === last) {
        event.preventDefault();
        buttons[0]?.focus();
      } else if (event.shiftKey && index <= 0) {
        event.preventDefault();
        buttons[last]?.focus();
      }
      return;
    }
    if (event.key === 'Enter' && this.current === 'newNotebook' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      this.hooks.onStart();
      return;
    }
    // Shortcut letters (and 1–4 for difficulty).
    if ([...event.key].length === 1 && !event.repeat && performance.now() - this.shownAt >= GAME_CONFIG.menu.shortcutDelayMs) {
      // Number keys by position too, so 1–4 work without Shift on AZERTY.
      const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1];
      const find = (key: string) => this.panel.querySelector<HTMLButtonElement>(`[data-key="${CSS.escape(key)}"]`);
      const match = find(event.key.toLowerCase()) ?? (digit ? find(digit) : null);
      if (match) {
        event.preventDefault();
        match.click();
      }
    }
  }
}
