/**
 * Centered in-game card: the graded page / chapter complete, and game over.
 * The main menu and pause menu are DOM screens (src/ui/menu.ts).
 */
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Difficulty } from '../core/config';
import { APPRENTICE_CHAPTERS, newKeysFor, starsForGrade } from '../core/campaign';
import { pageGrade, teacherNote, type Grade } from '../core/grade';
import { findKey, layoutById } from '../content/layouts';
import type { KeyboardLayout, LayoutId } from '../content/layouts/types';
import { accuracy, topMissedKeys, wpm, type Stats } from '../core/stats';
import { WORLD_HEIGHT, WORLD_WIDTH, isLastPageOfChapter, type World } from '../core/world';
import { formatNumber, t, type MessageKey } from '../i18n';
import { handsArt, type HandsArt, type HandsOptions } from './handsArt';
import { COLORS, DISPLAY_FONT, DISPLAY_PADDING, TEXT_FONT, keyLabel } from './theme';
import { outBack, outCubic } from './tween';

const CARD_WIDTH = 620;
/** Drawn width of the hands-on-keyboard picture on a chapter's first card. */
const HANDS_WIDTH = 500;
/** How much ink is in the wash the hands are painted with. */
const HAND_WASH = 0.13;

/** The hands-on-keyboard picture for `keys`, in the current theme's colors. */
export function themedHandsArt(layout: KeyboardLayout, keys: readonly string[], options?: HandsOptions): HandsArt {
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  /** `a` with `amount` of `b` mixed in, channel by channel. */
  const mix = (a: number, b: number, amount: number) =>
    [16, 8, 0].reduce((out, shift) => {
      const ca = (a >> shift) & 0xff;
      const cb = (b >> shift) & 0xff;
      return out | (Math.round(ca + (cb - ca) * amount) << shift);
    }, 0);
  return handsArt(layout, keys, {
    ink: hex(COLORS.ink),
    paper: hex(COLORS.paper),
    hand: hex(mix(COLORS.paper, COLORS.ink, HAND_WASH)),
    highlight: hex(COLORS.highlighter),
    margin: hex(COLORS.margin),
    rim: hex(COLORS.inkFaded),
  }, options);
}
const PAD = 32;
export type OverlayLinkId = 'retry' | 'mainMenu';

export interface OverlayLink {
  id: OverlayLinkId;
  label: string;
}

export interface OverlayContent {
  title: string;
  /** Red-pen grade for a finished page (DESIGN §6). */
  grade?: Grade;
  /** Stars earned on an Apprentice page, out of three. */
  stars?: number;
  /** A sentence or two of prose under the title (often empty). */
  lines: string[];
  /** The numbers, each in its own labelled box (Score, WPM, …). */
  tiles?: StatTile[];
  /** Short news under the boxes: new best, level up, a sticker. */
  chips?: string[];
  /** Keys drawn circled in red, the teacher's way of flagging them. */
  circled?: string[];
  /** Label before the circled keys (default "Keys to watch:"). */
  circledLabel?: string;
  /** Teacher's note in the margin. */
  note?: string;
  /** Keys to show on the hands-on-keyboard picture (an Apprentice chapter's new keys), and the layout they're on. */
  hands?: { layout: LayoutId; keys: string[] };
  /** Clickable links above the prompt (e.g. "Main menu"). */
  links?: OverlayLink[];
  prompt: string;
}

/** One labelled number on the card. */
export interface StatTile {
  label: string;
  value: string;
}

/** App state the overlay shows that isn't part of the game world (it comes from the save). */
export interface OverlayContext {
  /** Extra lines for a screen, e.g. best score or "New best score!". */
  extraLines(world: World): string[];
}

/** Click handlers and lookups the overlay needs from the app. */
export interface OverlayActions extends OverlayContext {
  onConfirm(): void;
  onLink(id: OverlayLinkId): void;
}

const NO_CONTEXT: OverlayContext = {
  extraLines: () => [],
};

/**
 * The numbers for a run of play, as boxes: always score, speed and accuracy;
 * then combo and highlighter points, the best run, wrong keys and creatures
 * that reached the margin, when there are any.
 */
function statTiles(stats: Stats, opts: { leaks?: boolean } = {}): StatTile[] {
  const tile = (key: string, value: string): StatTile => ({ label: t(`overlay.tile.${key}` as MessageKey), value });
  const tiles = [
    tile('score', formatNumber(stats.score)),
    tile('wpm', formatNumber(Math.round(wpm(stats)))),
    tile('accuracy', `${formatNumber(Math.round(accuracy(stats) * 100))}%`),
  ];
  if (stats.comboPoints > 0) tiles.push(tile('combo', `+${formatNumber(Math.round(stats.comboPoints))}`));
  if (stats.bonusPoints > 0) tiles.push(tile('bonus', `+${formatNumber(Math.round(stats.bonusPoints))}`));
  if (stats.bestCombo >= 10) tiles.push(tile('bestRun', formatNumber(stats.bestCombo)));
  if (stats.errors > 0) tiles.push(tile('mistakes', `${formatNumber(stats.errors)} · −${formatNumber(Math.round(stats.penalty))}`));
  if (opts.leaks && stats.leaks > 0) tiles.push(tile('leaks', formatNumber(stats.leaks)));
  return tiles;
}

export function difficultyLabel(difficulty: Difficulty): string {
  return t(`difficulty.${difficulty}` as MessageKey);
}

/** What the card shows for the current phase, or null while playing. */
/** The home keys under the index fingers, which carry the bumps on a real keyboard. */
function bumpKeys(layout: KeyboardLayout): { left: string; right: string } {
  const bump = (hand: 'left' | 'right') =>
    keyLabel(layout.rows.flat().find((k) => k.home && k.hand === hand && k.finger === 'index')?.base ?? '');
  return { left: bump('left'), right: bump('right') };
}

export function overlayContent(world: World, context: OverlayContext = NO_CONTEXT): OverlayContent | null {
  const chapter = world.page.chapter + 1;
  const page = world.page.index + 1;
  const extra = context.extraLines(world);

  switch (world.phase) {
    case 'pageCleared': {
      const stats = world.pageStats;
      const grade = pageGrade(stats, world.page.params.size);
      const note = teacherNote(stats, grade);
      const lastPage = isLastPageOfChapter(world.page);
      const chips: string[] = [];
      if (lastPage && world.inkRefilled > 0) chips.push(t('overlay.chapterCleared.refill', { ink: world.inkRefilled }));
      if (world.shieldEarned) chips.push(t('overlay.shieldEarned'));
      chips.push(...extra);
      const daily = world.mode === 'daily' && world.daily;
      return {
        title: daily
          ? t('overlay.daily.pageTitle', { id: daily.id, page, pages: world.page.pageCount })
          : lastPage
            ? t('overlay.chapterCleared.title', { chapter })
            : t('overlay.pageCleared.title', { page }),
        grade,
        ...(world.mode === 'apprentice' ? { stars: starsForGrade(grade) } : {}),
        lines: [],
        tiles: statTiles(stats, { leaks: true }),
        chips,
        circled: topMissedKeys(stats),
        note: t(`note.${note.kind}` as MessageKey, { key: note.key ? keyLabel(note.key) : '' }),
        links: [{ id: 'mainMenu', label: t('overlay.gameOver.mainMenu') }],
        prompt:
          daily && lastPage
            ? t('overlay.daily.finishPrompt')
            : lastPage
              ? t('overlay.chapterCleared.prompt', { next: chapter + 1 })
              : t('overlay.pageCleared.prompt'),
      };
    }
    case 'gameOver':
      if (world.mode === 'daily' && world.daily) {
        return {
          title: t('overlay.gameOver.title'),
          lines: [t('overlay.daily.reached', { id: world.daily.id, page, pages: world.page.pageCount })],
          tiles: statTiles(world.stats),
          chips: extra,
          circled: topMissedKeys(world.stats),
          links: [
            { id: 'retry', label: t('overlay.daily.retry') },
            { id: 'mainMenu', label: t('overlay.gameOver.mainMenu') },
          ],
          prompt: t('overlay.daily.retryPrompt'),
        };
      }
      return {
        title: t('overlay.gameOver.title'),
        lines: [t('overlay.gameOver.reached', { difficulty: difficultyLabel(world.difficulty), chapter, page })],
        tiles: statTiles(world.stats),
        chips: extra,
        circled: topMissedKeys(world.stats),
        links: [
          { id: 'retry', label: t('overlay.gameOver.retry') },
          { id: 'mainMenu', label: t('overlay.gameOver.mainMenu') },
        ],
        prompt: t('overlay.gameOver.prompt'),
      };
    case 'intro': {
      const keys = newKeysFor(world.layout, world.page.chapter);
      const fingers = keys.map((key) => {
        const k = findKey(world.layout, key);
        if (!k) return keyLabel(key);
        return k.finger === 'thumb'
          ? t('overlay.intro.thumb', { key: keyLabel(key) })
          : t('overlay.intro.finger', {
              key: keyLabel(key),
              hand: t(`hand.${k.hand}` as MessageKey),
              finger: t(`finger.${k.finger}` as MessageKey),
            });
      });
      return {
        title: t('overlay.intro.title', { chapter, total: APPRENTICE_CHAPTERS }),
        lines: [
          fingers.join('   ·   '),
          world.page.chapter === 0 ? t('overlay.intro.first', bumpKeys(world.layout)) : t('overlay.intro.body'),
        ],
        circled: keys,
        circledLabel: t('overlay.intro.newKeys'),
        hands: { layout: world.layout.id, keys },
        prompt: t('overlay.intro.prompt'),
      };
    }
    case 'notebookComplete':
      if (world.mode === 'daily' && world.daily) {
        return {
          title: t('overlay.daily.doneTitle', { id: world.daily.id }),
          lines: [],
          tiles: statTiles(world.stats),
          chips: extra,
          prompt: t('overlay.daily.donePrompt'),
        };
      }
      if (world.mode === 'accents') {
        return {
          title: t('overlay.accents.title', { chapter: world.page.chapter + 1 }),
          lines: [t('overlay.accents.body')],
          tiles: statTiles(world.stats).slice(0, 3),
          chips: extra,
          prompt: t('overlay.accents.prompt'),
        };
      }
      return {
        title: t('overlay.complete.title'),
        lines: [t('overlay.complete.body')],
        tiles: statTiles(world.stats).slice(0, 3),
        chips: extra,
        prompt: t('overlay.complete.prompt'),
      };
    // (The briefing is a DOM dialog, ui/briefingDialog.ts, so screen readers can read it.)
    case 'ready':
    case 'paused':
    case 'playing':
    case 'briefing':
      return null;
  }
}

export class Overlay {
  readonly root = new Container();
  private readonly card = new Graphics();
  private readonly title: Text;
  private readonly body: Text;
  private readonly prompt: Text;
  private readonly linksLayer = new Container();
  private readonly gradeText: Text;
  private readonly circledLayer = new Container();
  private readonly tilesLayer = new Container();
  private readonly chipsLayer = new Container();
  /** Three stars under the title; the earned ones fill in one by one. */
  private readonly starsLayer = new Container();
  private starsEarned = 0;
  private readonly note: Text;
  /** The hands-on-keyboard picture, drawn from SVG once it has loaded. */
  private readonly hands = new Sprite();
  private handsTexture: Texture | null = null;
  /** Which picture is wanted, so a late-loading old one is dropped. */
  private handsKey = '';
  /** Rebuild only when what's shown changes. */
  private shownKey: string | null = null;
  /** The card and everything on it, so it can pop in as one. */
  private readonly panel = new Container();
  /** Time since the card appeared, for its entrance and the grade stamp. */
  private appearMs = 0;

  constructor(
    private readonly actions: OverlayActions,
    private readonly reducedMotion = true,
  ) {
    // The backdrop swallows clicks so they don't reach anything underneath.
    const backdrop = new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: COLORS.desk, alpha: 0.35 });
    backdrop.eventMode = 'static';
    this.title = new Text({ text: '', style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 50, fontWeight: '700', fill: COLORS.ink } });
    this.body = new Text({
      text: '',
      style: {
        fontFamily: TEXT_FONT,
        fontSize: 19,
        fill: COLORS.inkLight,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: CARD_WIDTH - PAD * 2,
        lineHeight: 28,
      },
    });
    this.prompt = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 18, fontWeight: '700', fill: COLORS.margin } });
    this.prompt.eventMode = 'static';
    this.prompt.cursor = 'pointer';
    this.prompt.on('pointertap', () => this.actions.onConfirm());
    for (const node of [this.title, this.body, this.prompt]) node.anchor.set(0.5, 0);
    // The red-pen grade, scrawled at an angle in the card's corner.
    this.gradeText = new Text({
      text: '',
      style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 80, fontWeight: '700', fill: COLORS.margin },
    });
    this.gradeText.anchor.set(0.5);
    this.gradeText.rotation = -0.18;
    this.note = new Text({
      text: '',
      style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 28, fontWeight: '700', fill: COLORS.margin },
    });
    this.note.anchor.set(0.5, 0);
    this.panel.pivot.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.panel.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.root.addChild(backdrop, this.panel);
    this.panel.addChild(
      this.card,
      this.title,
      this.gradeText,
      this.starsLayer,
      this.body,
      this.tilesLayer,
      this.chipsLayer,
      this.circledLayer,
      this.hands,
      this.note,
      this.linksLayer,
      this.prompt,
    );
    this.root.visible = false;
  }

  update(world: World, dtMs = 0): void {
    const was = this.root.visible;
    this.refresh(world);
    if (!this.root.visible) return;
    this.appearMs = was ? this.appearMs + dtMs : 0;
    if (this.reducedMotion) {
      this.panel.scale.set(1);
      this.panel.alpha = 1;
      this.gradeText.scale.set(1);
      this.gradeText.alpha = 1;
      this.animateStars(Infinity);
      return;
    }
    // The card pops onto the page, then the red-pen grade is stamped on it.
    this.panel.scale.set(0.9 + 0.1 * outBack(Math.min(1, this.appearMs / 260)));
    this.panel.alpha = Math.min(1, this.appearMs / 140);
    const stamp = Math.min(1, Math.max(0, (this.appearMs - 320) / 200));
    this.gradeText.scale.set(1 + (1 - outCubic(stamp)) * 1.8);
    this.gradeText.alpha = stamp > 0 ? 1 : 0;
    this.animateStars(this.appearMs);
  }

  /** Earned stars fill in after the grade is stamped, each with a little bounce. */
  private animateStars(sinceMs: number): void {
    this.starsLayer.children.forEach((child, i) => {
      const fill = child.children[1];
      if (!fill) return;
      const t = i < this.starsEarned ? Math.min(1, Math.max(0, (sinceMs - 560 - i * 200) / 260)) : 0;
      fill.visible = t > 0;
      fill.scale.set(outBack(t));
    });
  }

  /** Lay out the row of stars. Returns the height used. */
  private layoutStars(earned: number | undefined): number {
    for (const child of this.starsLayer.removeChildren()) child.destroy({ children: true });
    this.starsEarned = earned ?? 0;
    if (earned === undefined) return 0;
    const points = (r: number) => {
      const out: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        out.push(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      return out;
    };
    for (let i = 0; i < 3; i++) {
      const star = new Container();
      star.addChild(
        new Graphics().poly(points(17)).stroke({ width: 2, color: COLORS.inkFaded, join: 'round' }),
        new Graphics().poly(points(17)).fill(COLORS.highlighter).stroke({ width: 2, color: COLORS.ink, join: 'round' }),
      );
      star.position.set((i - 1) * 46, 20);
      this.starsLayer.addChild(star);
    }
    this.animateStars(this.reducedMotion ? Infinity : 0);
    return 44;
  }

  private refresh(world: World): void {
    if (world.phase === 'playing' || world.phase === 'ready' || world.phase === 'paused' || world.phase === 'briefing') {
      this.root.visible = false;
      this.shownKey = null;
      return;
    }
    // Menus are cheap to describe, so compare the content itself.
    const content = overlayContent(world, this.actions);
    const key = JSON.stringify(content);
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.root.visible = content !== null;
    if (!content) return;

    this.title.text = content.title;
    this.body.text = content.lines.join('\n');
    this.body.visible = content.lines.length > 0;
    const bodyHeight = this.body.visible ? this.body.height + 12 : 0;
    const tilesHeight = this.layoutTiles(content.tiles ?? []);
    const chipsHeight = this.layoutChips(content.chips ?? []);
    this.prompt.text = content.prompt;

    const linksHeight = this.layoutLinks(content.links ?? []);
    const circledHeight = this.layoutCircled(content.circled ?? [], content.circledLabel ?? t('overlay.circled'));
    this.note.text = content.note ?? '';
    this.note.visible = Boolean(content.note);
    const noteHeight = content.note ? this.note.height + 12 : 0;
    const handsHeight = this.layoutHands(layoutById(content.hands?.layout ?? world.layout.id), content.hands?.keys ?? []);
    this.gradeText.text = content.grade ?? '';
    this.gradeText.visible = Boolean(content.grade);
    const starsHeight = this.layoutStars(content.stars);
    const height =
      PAD +
      this.title.height +
      14 +
      starsHeight +
      bodyHeight +
      tilesHeight +
      chipsHeight +
      4 +
      circledHeight +
      handsHeight +
      noteHeight +
      linksHeight +
      16 +
      this.prompt.height +
      PAD;
    const left = (WORLD_WIDTH - CARD_WIDTH) / 2;
    const top = (WORLD_HEIGHT - height) / 2;
    const cx = WORLD_WIDTH / 2;

    this.card
      .clear()
      .roundRect(left + 6, top + 8, CARD_WIDTH, height, 14)
      .fill({ color: COLORS.desk, alpha: 0.25 })
      .roundRect(left, top, CARD_WIDTH, height, 14)
      .fill(COLORS.paper)
      .stroke({ width: 2, color: COLORS.ink });

    this.title.position.set(cx, top + PAD);
    this.starsLayer.position.set(cx, this.title.y + this.title.height + 6);
    this.body.position.set(cx, this.title.y + this.title.height + 14 + starsHeight);

    this.gradeText.position.set(left + CARD_WIDTH - 62, top + 52);
    this.tilesLayer.position.set(cx, this.body.y + bodyHeight);
    this.chipsLayer.position.set(cx, this.tilesLayer.y + tilesHeight);
    this.circledLayer.position.set(cx, this.chipsLayer.y + chipsHeight);
    this.hands.position.set(cx, this.circledLayer.y + circledHeight);
    this.note.position.set(cx, this.hands.y + handsHeight);

    const linksTop = this.circledLayer.y + 4 + circledHeight + handsHeight + noteHeight;
    this.linksLayer.position.set(cx, linksTop);
    this.prompt.position.set(cx, linksTop + linksHeight);
  }

  /**
   * The hands-on-keyboard picture for `keys`. Its size is known straight
   * away; the image itself appears once the SVG has decoded. Returns the
   * height used.
   */
  private layoutHands(layout: KeyboardLayout, keys: string[]): number {
    if (keys.length === 0) {
      this.hands.visible = false;
      this.handsKey = '';
      return 0;
    }
    const art = themedHandsArt(layout, keys);
    const width = HANDS_WIDTH;
    const height = Math.round((art.height / art.width) * width);
    this.hands.anchor.set(0.5, 0);
    this.hands.visible = true;
    if (this.handsKey === art.svg) {
      this.hands.setSize(width, height);
      return height + 10;
    }
    this.handsKey = art.svg;
    this.hands.texture = Texture.EMPTY;
    this.hands.setSize(width, height);
    // Decode at twice the drawn size so it stays sharp on high-density screens.
    const img = new Image(width * 2, height * 2);
    const scaled = art.svg.replace(`width="${art.width}" height="${art.height}"`, `width="${width * 2}" height="${height * 2}"`);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scaled)}`;
    img
      .decode()
      .then(() => {
        if (this.handsKey !== art.svg) return;
        this.handsTexture?.destroy(true);
        this.handsTexture = Texture.from(img);
        this.hands.texture = this.handsTexture;
        this.hands.setSize(width, height);
      })
      .catch(() => {
        // The picture is a helper; the card still says which finger to use.
      });
    return height + 10;
  }

  /**
   * The numbers as a grid of boxes, three to a row (a short last row is
   * centred): a small label over a big value. Returns the height used.
   */
  private layoutTiles(tiles: StatTile[]): number {
    for (const child of this.tilesLayer.removeChildren()) child.destroy({ children: true });
    if (tiles.length === 0) return 0;
    const perRow = 3;
    const gap = 10;
    const w = (CARD_WIDTH - PAD * 2 - gap * (perRow - 1)) / perRow;
    const h = 66;
    tiles.forEach((tile, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, tiles.length - row * perRow);
      const col = i % perRow;
      const x = -(inRow * w + (inRow - 1) * gap) / 2 + col * (w + gap);
      const box = new Container();
      box.position.set(x, row * (h + gap));
      const label = new Text({
        text: tile.label.toUpperCase(),
        style: { fontFamily: TEXT_FONT, fontSize: 12, fontWeight: '700', letterSpacing: 1, fill: COLORS.inkLight },
      });
      label.anchor.set(0.5, 0);
      label.position.set(w / 2, 9);
      const value = new Text({ text: tile.value, style: { fontFamily: TEXT_FONT, fontSize: 26, fontWeight: '700', fill: COLORS.ink } });
      value.anchor.set(0.5, 0);
      value.position.set(w / 2, 26);
      if (value.width > w - 12) value.scale.set((w - 12) / value.width);
      box.addChild(new Graphics().roundRect(0, 0, w, h, 10).stroke({ width: 2, color: COLORS.ink }), label, value);
      this.tilesLayer.addChild(box);
    });
    const rows = Math.ceil(tiles.length / perRow);
    return rows * h + (rows - 1) * gap + 12;
  }

  /** Short news as highlighter pills, wrapped and centred. Returns the height used. */
  private layoutChips(chips: string[]): number {
    for (const child of this.chipsLayer.removeChildren()) child.destroy({ children: true });
    if (chips.length === 0) return 0;
    const gap = 8;
    const h = 30;
    const maxWidth = CARD_WIDTH - PAD * 2;
    const pills = chips.map((chip) => {
      const pill = new Container();
      const text = new Text({ text: chip, style: { fontFamily: TEXT_FONT, fontSize: 15, fontWeight: '600', fill: COLORS.ink } });
      if (text.width > maxWidth - 24) text.scale.set((maxWidth - 24) / text.width);
      text.anchor.set(0.5);
      const w = text.width + 24;
      text.position.set(w / 2, h / 2);
      pill.addChild(new Graphics().roundRect(0, 0, w, h, h / 2).fill(COLORS.highlighter), text);
      return { pill, w };
    });
    const rows: { pill: Container; w: number }[][] = [[]];
    let rowWidth = 0;
    for (const p of pills) {
      const row = rows[rows.length - 1]!;
      if (row.length > 0 && rowWidth + gap + p.w > maxWidth) {
        rows.push([p]);
        rowWidth = p.w;
      } else {
        row.push(p);
        rowWidth += (row.length > 1 ? gap : 0) + p.w;
      }
    }
    rows.forEach((row, r) => {
      const total = row.reduce((sum, p) => sum + p.w, 0) + gap * (row.length - 1);
      let x = -total / 2;
      for (const p of row) {
        p.pill.position.set(x, r * (h + gap));
        x += p.w + gap;
        this.chipsLayer.addChild(p.pill);
      }
    });
    return rows.length * (h + gap) + 4;
  }

  /** "Keys to watch:" with each key circled in red pen. Returns the height used. */
  private layoutCircled(keys: string[], labelText: string): number {
    for (const child of this.circledLayer.removeChildren()) child.destroy({ children: true });
    if (keys.length === 0) return 0;

    const label = new Text({ text: labelText, style: { fontFamily: TEXT_FONT, fontSize: 17, fill: COLORS.inkLight } });
    label.anchor.set(0, 0.5);
    const items: Container[] = [label];
    for (const key of keys) {
      const item = new Container();
      const glyphText = new Text({
        text: keyLabel(key),
        style: { fontFamily: TEXT_FONT, fontSize: 22, fontWeight: '700', fill: COLORS.ink },
      });
      glyphText.anchor.set(0.5);
      const rx = Math.max(18, glyphText.width / 2 + 12);
      // A clean red circle, like a teacher's pen mark.
      const ring = new Graphics().ellipse(0, 0, rx, 18).stroke({ width: 2.5, color: COLORS.margin });
      item.addChild(ring, glyphText);
      items.push(item);
    }

    const gap = 22;
    const widths = items.map((item, i) => (i === 0 ? item.width : item.width));
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (items.length - 1);
    let x = -total / 2;
    items.forEach((item, i) => {
      // Labels are anchored at their left edge, circles at their center.
      item.position.set(i === 0 ? x : x + widths[i]! / 2, 22);
      x += widths[i]! + gap;
      this.circledLayer.addChild(item);
    });
    return 52;
  }

  /**
   * Lay links out centered on x = 0: in a row if they fit the card, else
   * stacked. Returns the height they need.
   */
  private layoutLinks(links: OverlayLink[]): number {
    for (const child of this.linksLayer.removeChildren()) child.destroy();
    const texts = links.map((link) => {
      const text = new Text({
        text: link.label,
        style: { fontFamily: TEXT_FONT, fontSize: 17, fontWeight: '600', fill: COLORS.inkLight, fontStyle: 'italic' },
      });
      text.eventMode = 'static';
      text.cursor = 'pointer';
      text.on('pointertap', () => this.actions.onLink(link.id));
      this.linksLayer.addChild(text);
      return text;
    });
    if (texts.length === 0) return 0;

    const gap = 30;
    const rowWidth = texts.reduce((sum, text) => sum + text.width, 0) + gap * (texts.length - 1);
    if (rowWidth <= CARD_WIDTH - PAD * 2) {
      let x = -rowWidth / 2;
      for (const text of texts) {
        text.position.set(x, 0);
        x += text.width + gap;
      }
      return (texts[0]?.height ?? 0) + 14;
    }
    let y = 0;
    for (const text of texts) {
      text.position.set(-text.width / 2, y);
      y += text.height + 6;
    }
    return y + 8;
  }

}
