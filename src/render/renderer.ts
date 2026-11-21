/**
 * PixiJS renderer for the play field (REQUIREMENTS §7). Reads game state and
 * events and draws them; it never changes game state.
 *
 * The creatures are drawn procedurally in src/render/creatures/ in the
 * Inkwell style (DESIGN §5, §7).
 */
// PixiJS's browser setup, bundled with the game (M29). PixiJS would
// otherwise fetch it on its own during start-up, after the fonts, adding a
// round trip before the menu can show.
import { charAt } from '../core/text';
import 'pixi.js/browser';
import { Application, Container, Graphics, Text } from 'pixi.js';
import {
  FIRST_LINE_Y,
  LINE_SPACING,
  MARGIN_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  laneCount,
  laneY,
  renderX,
  sizeScale,
  type GameEvent,
  type GamePhase,
  type Target,
  type World,
} from '../core/world';
import { Effects } from './effects';
import { Manuscript } from './manuscript';
import { hashSeed } from '../core/rng';
import { APPRENTICE_CHAPTERS } from '../core/campaign';
import { Scribe } from './scribe';
import { Hud } from './hud';
import { Overlay, type OverlayActions } from './overlay';
import { DEFAULT_COSMETICS, type Cosmetics } from '../core/rewards';
import { t, type MessageKey } from '../i18n';
import type { MechanicId } from '../core/mechanics';
import { intercept, type Point } from './aim';
import { GAME_CONFIG } from '../core/config';
import { aboutToSquirt, canStart, squidGuards } from '../core/bosses';
import { createCreature, type CreatureView } from './creatures';
import { SeasonDecor } from './seasonDecor';
import { HOLIDAY, drawLeaf, drawPilgrimHat, drawSantaHat, drawSnowflake } from './holidayArt';
import type { SeasonId } from '../core/seasons';
import { bodyColor, drawFace, type Mood } from './creatures/common';
import { InkShots, SHOT_SPEED } from './shots';
import { COLORS, DISPLAY_FONT, DISPLAY_PADDING, TEXT_FONT, glyph, prefersReducedMotion } from './theme';
import { Punch, approach, mix, outCubic } from './tween';

const NIB_LENGTH = 56;
/** Tutorial notes stay below the HUD row. */
const CALLOUT_MIN_Y = 64;
const NIB_HOME = { x: MARGIN_X - 90, y: WORLD_HEIGHT / 2 };
/** The lowest lane's line; the scribe sits on the line below it. */
const LAST_LANE_Y = laneY(laneCount() - 1);
/** The manuscript is written on every lane's line. */
const MANUSCRIPT_BASELINES = Array.from({ length: laneCount() }, (_, lane) => laneY(lane));

export interface Renderer {
  app: Application;
  /** Draw the current state. `frameMs` is real time since the last frame. */
  sync(world: World, alpha: number, frameMs: number): void;
  /**
   * Redraw everything, e.g. after the theme, text size or motion setting changes.
   * `keepCard` is for a cosmetic change (pen, ink, paper): the page card, the
   * manuscript and the scribe carry on as they were instead of starting over.
   */
  rebuild(options?: { keepCard?: boolean }): void;
  /** A picture of the creature a tutorial is about, as an image URL, or null if it has none. */
  portrait(id: MechanicId): string | null;
  destroy(): void;
}

/** Display options the renderer reads from the player's settings and profile. */
export interface DisplayOptions {
  /** Size multiplier for targets and their text (REQUIREMENTS §10). */
  textScale: number;
  reducedMotion: boolean;
  /** 'gentle' softens screen shake and turns off the damage flash. */
  screenEffects?: 'full' | 'gentle';
  /** Equipped cosmetics (unlocked by leveling up). */
  cosmetics?: Cosmetics;
  /** The faint manuscript and its scribe (default on). Off keeps only the page heading. */
  pageWriting?: boolean;
  /** The holiday season to dress up for (core/seasons.ts), or none. */
  season?: SeasonId | null;
  /**
   * How to type an accented letter on the player's keyboard, as a short note
   * ("ê: ^ → E"), shown on a creature after a miss on it. `key` is what was pressed.
   */
  accentNote?: (char: string, key: string) => string | null;
}

const GOLD = 0xc9a227;
/** Rings that point at the HUD (ink gained or lost, a power ready) stay up a moment, then fade. */
const HIGHLIGHT_RING_MS = 900;
const HIGHLIGHT_RING_HOLD = 0.45;

/** Splatter colors for the unlockable ink choices. */
export function splatterColor(choice: Cosmetics['splatter']): number {
  switch (choice) {
    case 'crimson':
      return COLORS.inkCrimson;
    case 'violet':
      return COLORS.inkViolet;
    case 'teal':
      return mix(COLORS.ink, 0x16a3a3, 0.75);
    case 'gold':
      return GOLD;
    default:
      return COLORS.ink;
  }
}

export function drawPage(style: Cosmetics['paper']): Graphics {
  const page = new Graphics();
  // Parchment warms the paper; strongest on the classic theme, a hint elsewhere.
  // The holiday papers (M26) tint it warm or cool and print a faint border.
  const tint = PAPER_TINTS[style];
  const paper = tint ? mix(COLORS.paper, tint.color, tint.amount) : COLORS.paper;
  page.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(paper);

  if (style === 'graph') {
    // Graph paper: a fine grid, with the writing lines a little stronger.
    for (let x = 0; x < WORLD_WIDTH; x += LINE_SPACING / 2) page.moveTo(x, 0).lineTo(x, WORLD_HEIGHT);
    for (let y = FIRST_LINE_Y - LINE_SPACING; y < WORLD_HEIGHT; y += LINE_SPACING / 2) page.moveTo(0, y).lineTo(WORLD_WIDTH, y);
    page.stroke({ width: 1, color: COLORS.rule, alpha: 0.5 });
  }
  for (let y = FIRST_LINE_Y - LINE_SPACING; y < WORLD_HEIGHT - LINE_SPACING / 2; y += LINE_SPACING) {
    page.moveTo(0, y).lineTo(WORLD_WIDTH, y);
  }
  const rule = style === 'harvest' ? mix(COLORS.rule, 0xc08a52, 0.55) : style === 'winter' ? mix(COLORS.rule, 0x7fa8d1, 0.45) : COLORS.rule;
  page.stroke({ width: 1.5, color: rule });

  if (style === 'harvest' || style === 'winter') {
    // A faint printed border along the bottom edge, below the footer's text.
    const border = new Graphics();
    for (let x = MARGIN_X + 40, i = 0; x < WORLD_WIDTH - 20; x += 64, i++) {
      if (style === 'harvest') drawLeaf(border, x, WORLD_HEIGHT - 9, 9, HOLIDAY.leaves[i % HOLIDAY.leaves.length]!, i % 2 ? 0.5 : -0.5);
      else drawSnowflake(border, x, WORLD_HEIGHT - 10, 6);
    }
    border.alpha = 0.4;
    page.addChild(border);
  }

  page.moveTo(MARGIN_X, 0).lineTo(MARGIN_X, WORLD_HEIGHT).stroke({ width: 2.5, color: COLORS.margin });
  return page;
}

/** Paper tints: what each paper mixes into the theme's paper color, and how much. */
const PAPER_TINTS: Partial<Record<Cosmetics['paper'], { color: number; amount: number }>> = {
  parchment: { color: 0xe3c98f, amount: 0.45 },
  harvest: { color: 0xf0c890, amount: 0.35 },
  winter: { color: 0xdde9f5, amount: 0.6 },
};

/** Where a holiday hat sits on each pen, and how it tilts along the pen's edge. */
const NIB_HAT: Record<Cosmetics['nib'], { x: number; y: number; rotation: number; size: number }> = {
  classic: { x: 14, y: -16.5, rotation: 0.37, size: 1 },
  gold: { x: 14, y: -16.5, rotation: 0.37, size: 1 },
  quill: { x: -14, y: -17, rotation: 0.2, size: 0.9 },
  brush: { x: 24, y: -8, rotation: 0.1, size: 0.75 },
};

/** The Nib's hat (a holiday keepsake from the Desk), or nothing. */
function drawNibHat(style: Cosmetics['nib'], hat: Cosmetics['hat']): Graphics {
  const g = new Graphics();
  const at = NIB_HAT[style];
  if (hat === 'santa') drawSantaHat(g, 0, 0, 20 * at.size);
  else if (hat === 'pilgrim') drawPilgrimHat(g, 0, 0, 26 * at.size);
  g.position.set(at.x, at.y);
  g.rotation = at.rotation;
  return g;
}

/** The Nib, the player: a pen that points at what you're typing, in the equipped style. */
function drawNib(style: Cosmetics['nib']): Graphics {
  const g = new Graphics();
  switch (style) {
    case 'quill': {
      // A feather quill: a long vane behind a fine tip.
      g.poly([-46, -4, -30, -20, 6, -12, NIB_LENGTH, 0, 6, 8, -30, 10, -46, 2]).fill(COLORS.inkLight);
      for (let x = -38; x < 4; x += 7) g.moveTo(x, -1).lineTo(x + 8, -13 + (x + 38) * 0.05).stroke({ width: 1, color: COLORS.paper, alpha: 0.6 });
      g.moveTo(-50, 1).lineTo(NIB_LENGTH, 0).stroke({ width: 2, color: COLORS.ink });
      break;
    }
    case 'brush': {
      // A calligraphy brush: wooden handle, ferrule, and an inky tuft.
      g.roundRect(-44, -5, 40, 10, 4).fill(0x8a5a33);
      g.rect(-6, -7, 12, 14).fill(COLORS.pencil);
      g.moveTo(6, -9).quadraticCurveTo(36, -8, NIB_LENGTH, 0).quadraticCurveTo(36, 8, 6, 9).fill(COLORS.ink);
      break;
    }
    default: {
      const color = style === 'gold' ? GOLD : COLORS.ink;
      g.poly([0, -22, NIB_LENGTH, 0, 0, 22, 10, 0])
        .fill(color)
        .moveTo(34, 0)
        .lineTo(NIB_LENGTH - 6, 0)
        .stroke({ width: 2, color: COLORS.paper });
      if (style === 'gold') g.poly([4, -14, 30, -6, 4, -6]).fill({ color: 0xfff1b8, alpha: 0.6 });
    }
  }
  return g;
}

/** A stand-in creature to draw for each tutorial that is about one. */
function portraitTarget(id: MechanicId): Target | null {
  const base: Target = { id: -1, kind: 'blotling', text: 'ink', typed: 0, lives: 1, ghost: false, x: 0, y: 0, lane: 0, prevX: 0, speed: 0 };
  switch (id) {
    case 'basics':
      return { ...base, kind: 'drip', text: 'f' };
    case 'space':
      return { ...base, kind: 'drip', text: ' ' };
    case 'blotling':
      return base;
    case 'crimson':
      return { ...base, lives: 2, maxLives: 2 };
    case 'violet':
      return { ...base, lives: 3, maxLives: 3 };
    case 'ghost':
      return { ...base, ghost: true, x: WORLD_WIDTH };
    case 'spill':
      return { ...base, text: 'spill', lives: 3, maxLives: 3, boss: true, bossKind: 'spill' };
    case 'shuffler':
      return { ...base, text: 'lsfhuef', lives: 3, maxLives: 3, boss: true, bossKind: 'shuffler' };
    case 'bookworm':
      return { ...base, text: 'book', boss: true, bossKind: 'bookworm', head: true };
    case 'squid':
      return { ...base, text: 'squid', lives: 2, maxLives: 2, boss: true, bossKind: 'squid' };
    case 'quill':
      return { ...base, text: 'quill', lives: 3, maxLives: 3, boss: true, bossKind: 'quill', rival: 2.5 };
    case 'runon':
      return { ...base, kind: 'runon', text: 'ink dries', buffer: 'ink d', cursor: 5, typed: 5 };
    case 'recovery':
      return { ...base, text: 'ink', bottle: true };
    default:
      return null;
  }
}

/**
 * `actions` handles clicks on the overlay (difficulty picker, prompts). They
 * are intents for main.ts to apply; the renderer itself never changes state.
 */
export async function createRenderer(
  host: HTMLElement,
  actions: OverlayActions,
  display: () => DisplayOptions = () => ({ textScale: 1, reducedMotion: prefersReducedMotion() }),
): Promise<Renderer> {
  const app = new Application();
  await app.init({
    // The desk shows around the page when the window's aspect ratio differs.
    background: COLORS.desk,
    antialias: true,
    resizeTo: host,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  app.canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(app.canvas);

  // Everything is drawn in logical world units, then scaled to fit the window.
  const stage = new Container();
  app.stage.addChild(stage);
  const views = new Map<number, CreatureView>();
  /** Per-creature reactions the renderer adds on top of each creature's own drawing. */
  const reactions = new Map<number, { punch: Punch; tauntMs: number }>();
  let timeMs = 0;

  // The scene is rebuilt from scratch when display settings change.
  let reducedMotion = false;
  let gentle = false;
  let textScale = 1;
  let effects!: Effects;
  let shots!: InkShots;
  /**
   * Creatures already finished in the game, still on screen until the final
   * drop of ink lands. They show they're beaten straight away (x x eyes and a
   * quick squash), so it's clear the word is done even with the sound off.
   */
  let dying: { view: CreatureView; target: Target; x: number; y: number; speed: number; sinceMs: number }[] = [];
  /** Everything on the page. It jolts as one when ink is lost (screen shake). */
  let scene!: Container;
  /** Red-pen glow around the page edge: flashes on damage, pulses when ink is low. */
  let vignette!: Graphics;
  /** Washes over the page while the Paperweight (grey) or Highlighter (yellow) lasts. */
  let slowWash!: Graphics;
  let glowWash!: Graphics;
  let guide!: Graphics;
  let targetLayer!: Container;
  /** Squid ink squirted over a lane, drawn on top of the creatures in it. */
  let smudgeLayer!: Graphics;
  /** Squid arms, behind the creatures, and its bubble and lock, in front of its body. */
  let squidArms!: Graphics;
  let squidBubble!: Graphics;
  let nib!: Container;
  let nibFace!: Graphics;
  let nibStyle: Cosmetics['nib'] = DEFAULT_COSMETICS.nib;
  /** A dead key's accent waiting for its letter, beside the Nib. */
  let accentMark!: Text;
  let hud!: Hud;
  /** The faint writing that fills the page as targets are cleared, and the scribe writing it. */
  let manuscript!: Manuscript;
  let scribe!: Scribe;
  /** Which page the manuscript is for, how many of its creatures are gone, and whether its boss is beaten. */
  let manuscriptPage = '';
  let manuscriptCleared = 0;
  let manuscriptBossDone = false;
  let overlay!: Overlay;
  /** A handwritten note pointing at a creature on its guided first try. */
  let callout!: Container;
  let calloutText!: Text;
  let calloutArrow!: Graphics;
  let calloutId: string | null = null;
  let season: SeasonId | null = null;
  let decor!: SeasonDecor;

  const build = (keepCard = false) => {
    const options = display();
    ({ reducedMotion, textScale } = options);
    gentle = options.screenEffects === 'gentle';
    const cosmetics = options.cosmetics ?? DEFAULT_COSMETICS;
    season = options.season ?? null;
    decor = new SeasonDecor(season, reducedMotion);
    // Pull out what should survive before the rest is destroyed.
    const kept = keepCard && overlay ? { overlay, manuscript, scribe } : null;
    if (kept) {
      kept.overlay.root.removeFromParent();
      kept.manuscript.root.removeFromParent();
      kept.scribe.root.removeFromParent();
    }
    for (const child of stage.removeChildren()) child.destroy({ children: true });
    views.clear();
    reactions.clear();
    dying = [];
    app.renderer.background.color = COLORS.desk;

    effects = new Effects(reducedMotion, splatterColor(cosmetics.splatter));
    shots = new InkShots(reducedMotion, splatterColor(cosmetics.splatter));
    guide = new Graphics();
    targetLayer = new Container();
    // The locked creature is drawn on top of any it overlaps.
    targetLayer.sortableChildren = true;
    squidArms = new Graphics();
    squidArms.zIndex = -2;
    squidBubble = new Graphics();
    squidBubble.zIndex = 2;
    targetLayer.addChild(squidArms, squidBubble);
    smudgeLayer = new Graphics();
    nibStyle = cosmetics.nib;
    nib = new Container();
    nibFace = new Graphics();
    nib.addChild(drawNib(nibStyle), nibFace, drawNibHat(nibStyle, cosmetics.hat ?? 'none'));
    nib.position.set(NIB_HOME.x, NIB_HOME.y);
    accentMark = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 40, fontWeight: '700', fill: COLORS.ink } });
    accentMark.anchor.set(0.5);
    accentMark.visible = false;
    hud = new Hud();
    if (kept) {
      ({ overlay, manuscript, scribe } = kept);
    } else {
      manuscript = new Manuscript();
      scribe = new Scribe(MARGIN_X + 30, LAST_LANE_Y + LINE_SPACING - 4);
      manuscriptPage = '';
      manuscript.root.visible = options.pageWriting ?? true;
      scribe.showFigure(options.pageWriting ?? true);
      overlay = new Overlay(actions, reducedMotion);
    }
    scribe.setSeason(season);
    scene = new Container();
    const wash = (color: number) => {
      const g = new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(color);
      g.alpha = 0;
      return g;
    };
    callout = new Container();
    calloutText = new Text({ text: '', style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 32, fontWeight: '700', fill: COLORS.margin } });
    calloutText.anchor.set(0.5, 1);
    calloutArrow = new Graphics();
    callout.addChild(calloutArrow, calloutText);
    callout.visible = false;
    calloutId = null;
    slowWash = wash(COLORS.inkFaded);
    glowWash = wash(COLORS.highlighter);
    scene.addChild(drawPage(cosmetics.paper), decor.root, manuscript.root, scribe.root, glowWash, slowWash, effects.stainLayer, guide, targetLayer, smudgeLayer, nib, accentMark, shots.layer, effects.particleLayer, callout);
    vignette = new Graphics();
    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const inset = i * 9 + 4.5;
      vignette
        .rect(inset, inset, WORLD_WIDTH - inset * 2, WORLD_HEIGHT - inset * 2)
        .stroke({ width: 9, color: COLORS.margin, alpha: 0.55 * (1 - i / bands) ** 2 });
    }
    vignette.alpha = 0;
    stage.addChild(scene, vignette, hud.root, overlay.root);

    // Clip anything outside the page (targets spawn off the right edge).
    const mask = new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0xffffff);
    stage.addChild(mask);
    stage.mask = mask;
  };
  build();

  const fit = () => {
    const { width, height } = app.screen;
    const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
    stage.scale.set(scale);
    stage.position.set((width - WORLD_WIDTH * scale) / 2, (height - WORLD_HEIGHT * scale) / 2);
  };
  fit();
  app.renderer.on('resize', fit);

  /** Screen shake: how long is left, how long it began with, and how far it moves. */
  const shake = { ms: 0, total: 1, power: 0 };
  const startShake = (ms: number, power: number) => {
    if (reducedMotion) return;
    const p = gentle ? power * 0.35 : power;
    if (shake.ms > 0 && shake.power * (shake.ms / shake.total) > p) return;
    shake.ms = ms;
    shake.total = ms;
    shake.power = p;
  };
  /** Damage flash strength, 1..0. */
  let flash = 0;
  let wobbleMs = 0;
  /** The Nib kicks back a little each time it fires. */
  let kickMs = 0;
  /** The Nib's resting height, before its idle bob. */
  let nibY = NIB_HOME.y;
  /** The Nib's feelings: a wince after a mistake, alarm when ink is lost, a grin on a combo. */
  const nibMood = { winceMs: 0, alarmMs: 0, cheerMs: 0, nextBlinkMs: 2000, blinkMs: 0 };
  let lastPhase: GamePhase | null = null;
  /** The red-pen underline under the locked creature draws in from the left when the lock moves. */
  const underline = { id: -1, share: 0 };

  const reactionFor = (id: number) => {
    let r = reactions.get(id);
    if (!r) {
      r = { punch: new Punch(140), tauntMs: 0 };
      reactions.set(id, r);
    }
    return r;
  };

  const center = (target: Target, view: CreatureView | undefined) => ({
    x: target.x + (view ? view.width / 2 : 0),
    y: target.y - LINE_SPACING / 2,
  });

  /** Where the Nib's tip is now. */
  const nibTip = (): Point => ({
    x: nib.x + Math.cos(nib.rotation) * NIB_LENGTH,
    y: nib.y + Math.sin(nib.rotation) * NIB_LENGTH,
  });

  /**
   * Flick a drop of ink from the Nib at a creature's letter, leading it so
   * the ink meets the letter where it will be (see aim.ts). `missBy` sends it
   * that far above or below instead.
   */
  const shoot = (
    from: { x: number; y: number; speed: number },
    view: CreatureView,
    letter: number,
    onLand: (at: Point) => void,
    missBy = 0,
  ): void => {
    const point = { x: from.x + view.letterX(letter), y: from.y - LINE_SPACING / 2 + missBy };
    const aim = intercept(nibTip(), point, -from.speed, 0, SHOT_SPEED);
    kickMs = reducedMotion ? 0 : 90;
    shots.fire(nibTip(), aim, aim.t, onLand);
  };

  /** A wrong key still fires, but the ink misses and splats on the page. */
  const missShot = (world: World, targetId: number | null): void => {
    const visible = world.targets.filter((t) => t.x < WORLD_WIDTH);
    const target =
      world.targets.find((t) => t.id === targetId) ??
      visible.reduce<Target | undefined>((best, t) => (!best || t.x < best.x ? t : best), undefined);
    const view = target && views.get(target.id);
    const splat = (at: Point) => {
      effects.smudge(at.x, at.y);
      effects.splatter(at.x, at.y, 5, COLORS.margin);
    };
    if (target && view) {
      const side = Math.random() < 0.5 ? -1 : 1;
      shoot(target, view, target.typed, splat, side * (30 + Math.random() * 16));
      // The creature it was meant for grins, and the letter that was wanted gets a red cross.
      reactionFor(target.id).tauntMs = 450;
      effects.cross(target.x + view.letterX(target.typed), target.y - LINE_SPACING / 2 - view.height / 2 - 14);
      return;
    }
    // Nothing to aim at: the ink flies out across the page.
    const to = { x: nib.x + 300 + Math.random() * 400, y: nib.y + (Math.random() - 0.5) * 160 };
    const tip = nibTip();
    kickMs = reducedMotion ? 0 : 90;
    shots.fire(tip, to, Math.hypot(to.x - tip.x, to.y - tip.y) / SHOT_SPEED, splat);
  };

  const handleEvent = (world: World, event: GameEvent) => {
    switch (event.type) {
      case 'progress': {
        // Each correct key flicks ink at the letter just typed.
        if (!event.shot) break;
        const target = world.targets.find((t) => t.id === event.targetId);
        const view = target && views.get(target.id);
        if (target && view) {
          const char = glyph([...target.text][target.typed - 1] ?? '');
          shoot(target, view, target.typed - 1, (at) => {
            effects.splatter(at.x, at.y, 3);
            effects.letterPop(at.x, at.y, char, 26 * textScale * sizeScale(target));
          });
        }
        break;
      }
      case 'destroyed': {
        if (event.target.bossKind === 'squid' && event.target.partOf !== undefined) shatterBubble(world, event.target);
        const view = views.get(event.target.id);
        const finish = (at: { x: number; y: number }) => {
          if (event.target.kind === 'drip') effects.flick(at.x, at.y);
          else if (event.target.kind === 'blotling' && !event.target.bottle) effects.blotUp(at.x, at.y, view?.width ?? 80);
          effects.splatter(at.x, at.y, event.target.kind === 'drip' ? 8 : 12);
          effects.ring(at.x, at.y);
          effects.popup(at.x, at.y - 30, `+${event.points}`, { size: 22 });
        };
        if (event.blotted || !view || reducedMotion) {
          finish(center(event.target, view));
          break;
        }
        // Keep the creature crawling until the final drop of ink reaches it,
        // already marked as beaten.
        views.delete(event.target.id);
        reactions.delete(event.target.id);
        view.root.zIndex = -1;
        const ghost = { view, target: event.target, x: event.target.x, y: event.target.y, speed: event.target.speed, sinceMs: 0 };
        dying.push(ghost);
        shoot(ghost, view, -1, () => {
          finish({ x: ghost.x + view.width / 2, y: ghost.y - LINE_SPACING / 2 });
          view.root.destroy({ children: true });
          dying = dying.filter((d) => d !== ghost);
        });
        break;
      }
      case 'hit': {
        // A crimson or violet creature lost a life: the ink lands on its last letter, then it carries on.
        const view = views.get(event.target.id);
        const splash = () => {
          const at = center(event.target, views.get(event.target.id));
          effects.splatter(at.x, at.y, 8);
          effects.ring(at.x, at.y);
          effects.popup(at.x, at.y - 30, `+${event.points}`);
        };
        if (view && !reducedMotion) shoot(event.target, view, -1, splash);
        else splash();
        break;
      }
      case 'boss':
        effects.banner(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, t(`banner.boss.${event.target.bossKind ?? 'spill'}` as MessageKey));
        startShake(420, 6);
        nibMood.alarmMs = 900;
        break;
      case 'bossDefeated': {
        const at = center(event.target, views.get(event.target.id));
        effects.splatter(at.x, at.y, 18);
        effects.ring(at.x, at.y, COLORS.ink, 60, 420);
        nibMood.cheerMs = 900;
        startShake(220, 4);
        break;
      }
      case 'bossShuffled': {
        // The letters jumble with a little shudder.
        const reaction = reactionFor(event.target.id);
        reaction.tauntMs = Math.max(reaction.tauntMs, 260);
        reaction.punch.hit();
        break;
      }
      case 'squirt': {
        const at = center(event.target, views.get(event.target.id));
        effects.splatter(at.x, at.y, 12);
        effects.ring(at.x, at.y, COLORS.ink, 36, 360);
        startShake(140, 3);
        break;
      }
      case 'quillWins': {
        const at = center(event.target, views.get(event.target.id));
        effects.splatter(at.x, at.y, 14);
        effects.banner(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, t('banner.quillWins'), COLORS.margin);
        if (event.inkLost > 0) {
          const well = hud.inkPoint();
          effects.ring(well.x, well.y, COLORS.margin, 16, HIGHLIGHT_RING_MS, HIGHLIGHT_RING_HOLD);
          effects.popup(well.x + 40, well.y + 30, `−${event.inkLost}`, { color: COLORS.margin, size: 20 });
        }
        if (!reducedMotion) wobbleMs = 220;
        startShake(200, 5);
        break;
      }
      case 'split': {
        const at = center(event.target, views.get(event.target.id));
        effects.splatter(at.x, at.y, 22);
        effects.ring(at.x, at.y, COLORS.ink, 70, 460);
        startShake(260, 5);
        break;
      }
      case 'ability':
        nibMood.cheerMs = 700;
        hud.pulse(event.id);
        if (event.id === 'blotter') {
          effects.blotterWave(WORLD_WIDTH, WORLD_HEIGHT);
          effects.banner(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, t('banner.blotter'), COLORS.ink);
          startShake(300, 7);
        } else if (event.id === 'paperweight') {
          // It lands with a thud that ripples out across the page.
          effects.banner(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, t('banner.paperweight'), COLORS.ink);
          for (let i = 0; i < 3; i++) effects.ring(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, COLORS.inkFaded, 160 + i * 150, 500 + i * 160);
          startShake(260, 9);
        } else {
          effects.sweep(WORLD_WIDTH, WORLD_HEIGHT, COLORS.highlighter);
          effects.banner(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, t('banner.highlighter'), COLORS.ink);
        }
        break;
      case 'abilityEnded':
        break;
      case 'charged': {
        const at = hud.chargePoint(event.charges - 1);
        effects.ring(at.x, at.y, COLORS.ink, 18);
        effects.popup(at.x, at.y + 34, '+1');
        break;
      }
      case 'passiveReady': {
        const at = hud.abilityPoint(event.id);
        hud.pulse(event.id);
        effects.ring(at.x, at.y, COLORS.highlighter, 26, HIGHLIGHT_RING_MS, HIGHLIGHT_RING_HOLD);
        break;
      }
      case 'eraserUsed': {
        // The slip is rubbed out before it counts.
        const target = world.targets.find((t) => t.id === event.targetId);
        const view = target && views.get(target.id);
        const at = target && view ? { x: target.x + view.letterX(target.typed), y: target.y - LINE_SPACING / 2 } : { x: nib.x + 90, y: nib.y };
        effects.crumbs(at.x, at.y);
        effects.popup(at.x, at.y - 40, t('popup.erased'), { size: 20 });
        hud.pulse('eraser');
        break;
      }
      case 'shieldUsed': {
        const y = event.target.y - LINE_SPACING / 2;
        effects.sheet(MARGIN_X + 30, y);
        effects.popup(MARGIN_X + 90, y - 50, t('popup.soaked'), { size: 20 });
        hud.pulse('blottingPaper');
        break;
      }
      case 'marginHit':
        effects.marginStain(MARGIN_X, event.target.y - LINE_SPACING / 2);
        effects.popup(MARGIN_X + 50, event.target.y - LINE_SPACING / 2 - 26, `−${event.inkLost}`, { color: COLORS.margin, size: 24 });
        startShake(340, 10);
        if (!gentle) flash = 1;
        nibMood.alarmMs = 700;
        break;
      case 'error': {
        // Typed characters fire a miss; other mistakes (in a Misprint) just smudge.
        if ([...event.key].length === 1) {
          missShot(world, event.targetId);
        } else {
          const target = world.targets.find((t) => t.id === event.targetId);
          const at = target ? center(target, views.get(target.id)) : { x: nib.x + 30, y: nib.y };
          effects.smudge(at.x, at.y);
          if (target) reactionFor(target.id).tauntMs = 450;
        }
        if (event.pointsLost > 0) effects.popup(nib.x + 70, nib.y - 34, `−${event.pointsLost}`, { color: COLORS.margin, size: 20 });
        if (event.inkLost > 0) {
          // Ink spilt by the slip: a red tick on the well.
          const well = hud.inkPoint();
          effects.ring(well.x, well.y, COLORS.margin, 16, HIGHLIGHT_RING_MS, HIGHLIGHT_RING_HOLD);
        }
        if (!reducedMotion) wobbleMs = 220;
        startShake(150, event.inkLost > 0 ? 5 : 3.5);
        nibMood.winceMs = 420;
        break;
      }
      case 'comboStep':
        effects.popup(nib.x + 30, nib.y - 46, `×${event.multiplier}`, { color: COLORS.margin, size: 26 });
        nibMood.cheerMs = 500;
        break;
      case 'comboBroken':
        break;
      case 'inkRestored': {
        // Fresh ink flies from where it was won into the well.
        const from = event.target ? center(event.target, views.get(event.target.id)) : nibTip();
        const well = hud.inkPoint();
        const drops = event.source === 'bottle' ? 6 : 3;
        for (let i = 0; i < drops; i++) {
          effects.flyTo(from.x + (Math.random() - 0.5) * 30, from.y + (Math.random() - 0.5) * 30, well.x, well.y, COLORS.ink, i === 0 ? () => effects.ring(well.x, well.y, COLORS.highlighter, 20, HIGHLIGHT_RING_MS, HIGHLIGHT_RING_HOLD) : undefined, 420 + i * 70);
        }
        effects.popup(from.x, from.y - 44, t('popup.ink', { ink: event.amount }), { size: 20 });
        nibMood.cheerMs = 600;
        break;
      }
      case 'bottleMissed':
      case 'guide':
        break;
      case 'phase':
        // A fresh page (or notebook) starts clean.
        if (event.phase === 'playing' && lastPhase !== 'paused') {
          effects.clearStains();
        }
        if (event.phase === 'gameOver') {
          // The well runs dry: ink bursts along the margin.
          for (let i = 0; i < 9; i++) effects.splatter(MARGIN_X + Math.random() * 60, 60 + Math.random() * (WORLD_HEIGHT - 120), 10);
          startShake(520, 12);
          if (!gentle) flash = 1;
        }
        lastPhase = event.phase;
        break;
      case 'reset':
        // A restarted or abandoned page starts clean.
        effects.clearStains();
        for (const d of dying) d.view.root.destroy({ children: true });
        dying = [];
        break;
      case 'locked':
        break;
    }
  };

  /** A beaten creature squashes once and fades a little. */
  const showDefeat = (view: CreatureView, sinceMs: number) => {
    if (!reducedMotion) {
      const squash = 1 - 0.18 * Math.sin(Math.min(1, sinceMs / 160) * Math.PI);
      view.root.scale.set(2 - squash, squash);
    }
    view.root.alpha = Math.max(0.6, 1 - sinceMs / 400);
  };

  /** Where the Nib's eyes sit for each pen style, and how big they are. */
  const NIB_FACE: Record<Cosmetics['nib'], { x: number; y: number; r: number }> = {
    classic: { x: 19, y: -1, r: 4.6 },
    gold: { x: 19, y: -1, r: 4.6 },
    quill: { x: -14, y: -3, r: 4 },
    brush: { x: 26, y: 0, r: 3.4 },
  };

  const drawNibFace = (locked: boolean, frameMs: number) => {
    const m = nibMood;
    m.winceMs = Math.max(0, m.winceMs - frameMs);
    m.alarmMs = Math.max(0, m.alarmMs - frameMs);
    m.cheerMs = Math.max(0, m.cheerMs - frameMs);
    m.blinkMs = Math.max(0, m.blinkMs - frameMs);
    m.nextBlinkMs -= frameMs;
    if (m.nextBlinkMs <= 0) {
      m.blinkMs = 130;
      m.nextBlinkMs = 2200 + Math.random() * 3200;
    }
    const mood: Mood = m.winceMs > 0 ? 'hurt' : m.alarmMs > 0 ? 'scared' : m.cheerMs > 0 ? 'happy' : locked ? 'angry' : 'calm';
    const f = NIB_FACE[nibStyle];
    nibFace.clear();
    // Eyes look ahead, along the pen.
    drawFace(nibFace, f.x, f.y, f.r, mood, m.blinkMs > 0, f.x + 100, f.y, COLORS.ink);
  };

  /**
   * Squid ink over a lane: a stream shoots from the tentacle, then a splat
   * lands, thickest where it hit and trailing off along the line (still dark
   * enough to hide the words), with drips running down. It fades away at the end.
   */
  /**
   * Fill the manuscript as the page goes on; start it afresh on a new or
   * restarted page. Progress counts the page's creatures as they go (cleared,
   * or through the margin), so boss parts and Inkmites don't throw it off.
   * On a boss page the last share waits for the boss, and a finished page
   * always finishes the writing.
   */
  const syncManuscript = (world: World, frameMs: number) => {
    const { params, chapter, index, hasBoss } = world.page;
    const key = `${world.mode}:${world.daily?.id ?? ''}:${chapter}:${index}`;
    if (key !== manuscriptPage || (world.page.spawned === 0 && manuscriptCleared > 0)) {
      manuscriptPage = key;
      manuscriptCleared = 0;
      manuscriptBossDone = false;
      manuscript.reset(hashSeed(key), MANUSCRIPT_BASELINES);
      const heading = { chapter: chapter + 1, chapters: APPRENTICE_CHAPTERS, page: index + 1 };
      const headingKey = world.mode === 'apprentice' ? 'manuscript.headingApprentice' : world.mode === 'accents' ? 'manuscript.headingAccents' : 'manuscript.heading';
      scribe.start(t(headingKey, heading), reducedMotion);
    }
    const bossShare = hasBoss ? GAME_CONFIG.manuscript.bossShare : 0;
    const share = params.size > 0 ? Math.min(1, manuscriptCleared / params.size) : 0;
    const fraction = world.phase === 'pageCleared' ? 1 : share * (1 - bossShare) + (manuscriptBossDone ? bossShare : 0);
    const playing = world.phase === 'playing';
    const danger = world.targets.some((target) => !target.bottle && target.x < MARGIN_X + GAME_CONFIG.manuscript.glanceDistance);
    manuscript.update(fraction, world.phase === 'paused' ? 0 : frameMs, reducedMotion);
    scribe.update(world.phase === 'paused' ? 0 : frameMs, reducedMotion, playing && danger);
    decor.update(world.phase === 'paused' ? 0 : frameMs);
  };

  /** A creature of the page is gone (not a bottle or part of a boss). */
  const manuscriptCounts = (target: Target) => !target.bottle && !target.boss;

  /** The manuscript and scribe react: writing grows as creatures go, and blots where one got through. */
  const manuscriptEvent = (event: GameEvent) => {
    switch (event.type) {
      case 'destroyed':
      case 'shieldUsed':
        if (manuscriptCounts(event.target)) {
          manuscriptCleared++;
          scribe.write();
        }
        break;
      case 'marginHit':
        if (manuscriptCounts(event.target)) manuscriptCleared++;
        manuscript.blot(event.target.y);
        scribe.wince();
        break;
      case 'bossDefeated':
      case 'split':
        // The Spill splits when beaten; the other bosses are defeated.
        manuscriptBossDone = true;
        scribe.write();
        break;
      case 'reset':
        // A restarted or abandoned page starts its writing over.
        manuscriptPage = '';
        break;
      case 'phase':
        if (event.phase === 'pageCleared') scribe.cheer();
        break;
    }
  };

  const drawSmudges = (world: World) => {
    smudgeLayer.clear();
    const full = GAME_CONFIG.boss.squid.smudgeMs;
    const flyMs = 180;
    for (const smudge of world.smudges) {
      const age = full - smudge.ms;
      const cy = laneY(smudge.lane, world.laneStep) - LINE_SPACING / 2;
      const fromY = smudge.fromY - LINE_SPACING / 2;
      if (age < flyMs && !reducedMotion) {
        // The squirt in flight: a thick stroke from the tentacle toward where it lands.
        const u = outCubic(age / flyMs);
        const tipX = smudge.fromX + (smudge.x - smudge.fromX) * u;
        const tipY = fromY + (cy - fromY) * u;
        smudgeLayer.moveTo(smudge.fromX, fromY).lineTo(tipX, tipY).stroke({ width: 10, color: COLORS.ink, cap: 'round' });
        smudgeLayer.circle(tipX, tipY, 9).fill(COLORS.ink);
        continue;
      }
      // Grows out from where it hit, then holds, then fades.
      const grow = reducedMotion ? 1 : Math.min(1, (age - flyMs) / 220);
      const fade = Math.min(1, smudge.ms / 500);
      // One smear with ragged edges: fattest where it hit, tapering to a
      // round end each way, but always tall enough to cover the words.
      const left = Math.max(MARGIN_X + 10, smudge.x - (smudge.x - MARGIN_X) * grow);
      const right = Math.min(WORLD_WIDTH + 20, smudge.x + (WORLD_WIDTH + 20 - smudge.x) * grow);
      const half = (x: number) => {
        const near = 1 - Math.min(1, Math.abs(x - smudge.x) / 240);
        const ragged = Math.sin(x * 0.09 + smudge.lane * 2) * 2.5 + Math.sin(x * 0.23 + smudge.lane) * 1.8;
        return 21 + near * 14 + ragged;
      };
      const top: number[] = [];
      const bottom: number[] = [];
      for (let x = left; x <= right; x += 12) {
        top.push(x, cy - half(x));
        bottom.push(x, cy + half(x + 37));
      }
      const outline = [...top];
      for (let i = bottom.length - 2; i >= 0; i -= 2) outline.push(bottom[i]!, bottom[i + 1]!);
      if (outline.length >= 6) {
        smudgeLayer.poly(outline);
        smudgeLayer.circle(left, cy, half(left)).circle(right, cy, half(right));
        // A splash where it hit.
        smudgeLayer.circle(smudge.x, cy, 36 * grow);
      }
      smudgeLayer.fill({ color: COLORS.ink, alpha: 0.92 * fade });
      // Drips running down from the thick middle, and a few flecks.
      for (let i = -2; i <= 2; i++) {
        const x = smudge.x + i * 26 + Math.sin(i * 3.1 + smudge.lane) * 8;
        const len = (14 + ((i * 7 + smudge.lane * 5) % 4 + 4) * 4) * grow;
        smudgeLayer.roundRect(x - 3.5, cy + 10, 7, len + 12, 3.5).circle(x, cy + 22 + len, 6);
      }
      for (let i = 0; i < 6; i++) {
        const a = i * 1.9 + smudge.lane;
        smudgeLayer.circle(smudge.x + Math.cos(a) * 70 * grow, cy + Math.sin(a) * 40 * grow, 3 + (i % 3) * 1.5);
      }
      smudgeLayer.fill({ color: COLORS.ink, alpha: 0.92 * fade });
    }
  };

  /** The Squid's bubble round its body: an ellipse a little bigger than the body. */
  const bubbleOf = (view: CreatureView) => ({
    cx: view.root.x + view.width / 2,
    cy: view.root.y,
    rx: view.width / 2 + 16 * textScale,
    ry: view.height / 2 + 20 * textScale,
  });
  /** Where on the bubble the piece for tentacle `index` of `total` sits (its middle angle). */
  const bubbleAngle = (index: number, total: number) => -Math.PI / 2 + ((index + 0.5) / total) * Math.PI * 2;

  /**
   * The Inkwell Squid's guard: an arm from its body to each tentacle, and an
   * ink bubble round the body with one piece per tentacle. Beaten tentacles
   * take their piece with them; a padlock sits on top while any are left.
   */
  const drawSquids = (world: World) => {
    squidArms.clear();
    squidBubble.clear();
    for (const body of world.targets) {
      if (body.bossKind !== 'squid' || body.partOf !== undefined) continue;
      const bodyView = views.get(body.id);
      if (!bodyView) continue;
      const bubble = bubbleOf(bodyView);
      const k = textScale;

      for (const tentacle of world.targets) {
        if (tentacle.partOf !== body.id) continue;
        const view = views.get(tentacle.id);
        if (!view) continue;
        // From the bubble's rim, on the tentacle's side, to the tentacle's front.
        const x1 = view.root.x + 8 * k;
        const y1 = view.root.y;
        const toward = Math.atan2((y1 - bubble.cy) / bubble.ry, (x1 - bubble.cx) / bubble.rx);
        const x0 = bubble.cx + Math.cos(toward) * bubble.rx * 0.9;
        const y0 = bubble.cy + Math.sin(toward) * bubble.ry * 0.9;
        const sway = reducedMotion ? 0 : Math.sin(timeMs * 0.004 + (tentacle.partIndex ?? 0) * 1.7) * 8 * k;
        const qx = x0 + (x1 - x0) * 0.15 + sway;
        const qy = y1;
        const color = bodyColor(tentacle.lives);
        const steps = 14;
        let px = x0;
        let py = y0;
        for (let i = 1; i <= steps; i++) {
          const u = i / steps;
          const nx = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * qx + u * u * x1;
          const ny = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * qy + u * u * y1;
          // Thick at the body, tapering toward the tentacle.
          squidArms.moveTo(px, py).lineTo(nx, ny).stroke({ width: (16 - 9 * u) * k, color, cap: 'round' });
          px = nx;
          py = ny;
        }
        // Suckers along the arm.
        for (const u of [0.35, 0.55, 0.75]) {
          const sx = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * qx + u * u * x1;
          const sy = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * qy + u * u * y1;
          squidArms.circle(sx, sy, 2.6 * k).fill(COLORS.inkLight);
        }
      }

      const { left, total } = squidGuards(world, body);
      if (left.size === 0 || total === 0) continue;
      const { cx, cy, rx, ry } = bubble;
      // A faint wash over the body: it's behind glass for now.
      squidBubble.ellipse(cx, cy, rx, ry).fill({ color: COLORS.paper, alpha: 0.35 });
      const gap = 0.32;
      const span = (Math.PI * 2) / total - gap;
      for (let i = 0; i < total; i++) {
        if (!left.has(i)) continue;
        const mid = bubbleAngle(i, total);
        const from = mid - span / 2;
        const steps = 16;
        squidBubble.moveTo(cx + Math.cos(from) * rx, cy + Math.sin(from) * ry);
        for (let j = 1; j <= steps; j++) {
          const a = from + (span * j) / steps;
          squidBubble.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
        }
        squidBubble.stroke({ width: 4.5 * k, color: COLORS.ink, cap: 'round' });
      }
      // A shine, so it reads as a bubble.
      squidBubble
        .moveTo(cx - rx * 0.62, cy - ry * 0.45)
        .quadraticCurveTo(cx - rx * 0.45, cy - ry * 0.78, cx - rx * 0.15, cy - ry * 0.82)
        .stroke({ width: 3 * k, color: COLORS.paper, alpha: 0.9, cap: 'round' });
      // A padlock on top: it can't be typed yet.
      // On the front (left) of the bubble, clear of the arms.
      const lx = cx - rx - 2 * k;
      const ly = cy - ry * 0.55;
      const w = 16 * k;
      const h = 12 * k;
      squidBubble
        .moveTo(lx - w * 0.3, ly - h / 2)
        .arc(lx, ly - h / 2, w * 0.3, Math.PI, 0)
        .stroke({ width: 3 * k, color: COLORS.ink })
        .roundRect(lx - w / 2, ly - h / 2, w, h, 3 * k)
        .fill(COLORS.ink)
        .circle(lx, ly, 2 * k)
        .fill(COLORS.paper);
    }
  };

  /** A tentacle was beaten: its piece of the bubble shatters, and the last one pops the whole bubble. */
  const shatterBubble = (world: World, tentacle: Target) => {
    const body = world.targets.find((t) => t.id === tentacle.partOf);
    const view = body && views.get(body.id);
    if (!body || !view) return;
    const { cx, cy, rx, ry } = bubbleOf(view);
    const { left, total } = squidGuards(world, body);
    const a = bubbleAngle(tentacle.partIndex ?? 0, Math.max(1, total));
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    effects.splatter(x, y, 6, COLORS.inkLight);
    effects.ring(x, y, COLORS.inkLight, 18, 260);
    if (left.size === 0) {
      effects.ring(cx, cy, COLORS.margin, rx, 420);
      effects.popup(cx, cy - ry - 20, t('boss.squidOpen'), { color: COLORS.margin, size: 24 });
    }
  };

  return {
    app,
    sync(world, alpha, frameMs) {
      for (const event of world.events) {
        manuscriptEvent(event);
        handleEvent(world, event);
      }
      world.events.length = 0;
      drawSmudges(world);

      // The accent a dead key is holding, until its letter comes.
      accentMark.visible = world.pendingAccent !== null;
      if (world.pendingAccent !== null) {
        if (accentMark.text !== world.pendingAccent) accentMark.text = world.pendingAccent;
        accentMark.position.set(nib.x + 46, nib.y - 44);
      }

      // Creatures. Animation time only runs while playing, so they freeze when paused.
      const playing = world.phase === 'playing';
      if (playing) timeMs += frameMs;
      const live = new Set<number>();
      let locked: { x: number; y: number } | null = null;
      let lockedView: CreatureView | null = null;
      // Line boil (DESIGN §7): drawings jitter a hair a few times a second, like hand-drawn animation.
      const boilFrame = Math.floor(timeMs / 120);
      for (const target of world.targets) {
        live.add(target.id);
        let view = views.get(target.id);
        if (!view) {
          view = createCreature(target, textScale, season);
          views.set(target.id, view);
          targetLayer.addChild(view.root);
        }
        const x = renderX(target, alpha);
        let y = target.y - LINE_SPACING / 2;
        const isLocked = target.id === world.lockedId;
        const reaction = reactions.get(target.id);
        let taunting = false;
        if (reaction) {
          if (playing) reaction.tauntMs = Math.max(0, reaction.tauntMs - frameMs);
          taunting = reaction.tauntMs > 0;
          if (!reducedMotion) {
            // A squash when ink lands, and a mocking hop after a mistake.
            const k = playing ? reaction.punch.update(frameMs) : 0;
            view.root.scale.set(1 + 0.05 * k, 1 - 0.1 * k);
            if (taunting) y -= Math.abs(Math.sin(reaction.tauntMs / 70)) * 6;
          }
        }
        if (!reducedMotion) {
          const n = Math.sin((target.id * 97 + boilFrame) * 12.9898) * 43758.5453;
          const r = n - Math.floor(n);
          view.root.rotation = (r - 0.5) * 0.025;
          y += (r - 0.5) * 1.2;
        }
        view.root.position.set(x, y);
        view.root.zIndex = isLocked ? 1 : 0;
        view.update(target, {
          timeMs,
          dtMs: frameMs,
          locked: isLocked,
          lookX: nib.x - x,
          lookY: nib.y - y,
          reducedMotion,
          taunting,
          guarded: target.bossKind === 'squid' && target.partOf === undefined && !canStart(world, target),
          warning: aboutToSquirt(world, target),
        });
        if (isLocked) {
          locked = { x, y };
          lockedView = view;
        }
      }
      drawSquids(world);
      for (const [id, view] of views) {
        if (!live.has(id)) {
          view.root.destroy({ children: true });
          views.delete(id);
          reactions.delete(id);
        }
      }

      // The Nib glides toward the locked target's line and points at it.
      const goalY = locked ? Math.min(Math.max(locked.y, FIRST_LINE_Y), WORLD_HEIGHT - LINE_SPACING) : NIB_HOME.y;
      nibY = approach(nibY, goalY, 10, frameMs);
      // With nothing to aim at it bobs gently, like a pen being twiddled.
      const idle = reducedMotion || locked ? 0 : Math.sin(timeMs / 520) * 4;
      nib.y = nibY + idle;
      const goalAngle = locked ? Math.atan2(locked.y - nib.y, locked.x - nib.x) : reducedMotion ? 0 : Math.sin(timeMs / 900) * 0.06;
      nib.rotation = approach(nib.rotation, Math.max(-0.7, Math.min(0.7, goalAngle)), 14, frameMs);

      wobbleMs = Math.max(0, wobbleMs - frameMs);
      kickMs = Math.max(0, kickMs - frameMs);
      nib.x = NIB_HOME.x - (kickMs > 0 ? Math.cos(nib.rotation) * 7 * (kickMs / 90) : 0);
      if (wobbleMs > 0) nib.rotation += Math.sin(wobbleMs / 15) * 0.16 * (wobbleMs / 220);
      drawNibFace(locked !== null, frameMs);

      // Screen shake: the whole page jolts, settling quickly.
      shake.ms = Math.max(0, shake.ms - frameMs);
      if (shake.ms > 0) {
        const k = shake.power * (shake.ms / shake.total) ** 2;
        scene.position.set(Math.sin(shake.ms / 13) * k, Math.cos(shake.ms / 17) * k * 0.7);
      } else {
        scene.position.set(0, 0);
      }

      // Red-pen edge: flashes when ink is lost and throbs while the well is nearly dry.
      flash = Math.max(0, flash - frameMs / 450);
      const low = playing && world.ink / world.maxInk < GAME_CONFIG.lowInk;
      const throb = low ? (reducedMotion || gentle ? 0.3 : 0.3 + 0.2 * Math.sin(timeMs / 280)) : 0;
      vignette.alpha = Math.max(flash, throb);

      slowWash.alpha = approach(slowWash.alpha, playing && world.slowMs > 0 ? 0.22 : 0, 8, frameMs);
      glowWash.alpha = approach(glowWash.alpha, playing && world.highlightMs > 0 ? 0.28 : 0, 8, frameMs);

      // A note in red pen follows the creature being taught, with an arrow down to it.
      // After a miss on an accented letter, the same note shows that creature how to type it.
      const hint = world.accentHint;
      const hinted = playing && !world.guide && hint ? world.targets.find((g) => g.id === hint.targetId) : undefined;
      const hintNote = hinted && hint && charAt(hinted.text, hinted.typed) === hint.char ? display().accentNote?.(hint.char, hint.key) : null;
      const guided = playing && world.guide ? world.targets.find((g) => g.id === world.guide?.targetId) : hintNote ? hinted : undefined;
      const guidedView = guided && views.get(guided.id);
      callout.visible = Boolean(guided && guidedView);
      const noteId = world.guide ? world.guide.id : hintNote ? `accent:${hintNote}` : null;
      if (guided && guidedView && noteId) {
        if (calloutId !== noteId) {
          calloutId = noteId;
          calloutText.text = world.guide ? t(`tutorial.${world.guide.id}.hint` as MessageKey) : (hintNote ?? '');
        }
        // The note sits above the creature (kept on the page), with a short pen stroke
        // down to it. The arrow ends clear of eyes, horns and crowns, and its head
        // follows the stroke, so it points straight at the creature from wherever the note is.
        const bob = reducedMotion ? 0 : Math.sin(timeMs / 260) * 3;
        const half = calloutText.width / 2 + 12;
        const targetX = Math.min(WORLD_WIDTH - 24, guidedView.root.x + guidedView.width / 2);
        // Above the creature, unless that would crowd the HUD: then below, pointing up.
        const above = guidedView.root.y - guidedView.height / 2 - 64 - calloutText.height > CALLOUT_MIN_Y;
        const tipY = above ? guidedView.root.y - guidedView.height / 2 - 24 : guidedView.root.y + guidedView.height / 2 + 14;
        const cx = Math.min(WORLD_WIDTH - half, Math.max(MARGIN_X + half, targetX));
        const noteEdge = (above ? tipY - 40 : tipY + 40) + bob;
        calloutText.anchor.set(0.5, above ? 1 : 0);
        calloutText.position.set(cx, noteEdge);
        // Start at the note's edge, as close to the creature as the note allows.
        const startX = Math.min(cx + half - 24, Math.max(cx - half + 24, targetX));
        const startY = noteEdge + (above ? 6 : -4);
        // A slight bow, like a quick hand-drawn line.
        const ctrlX = (startX + targetX) / 2 + 8;
        const ctrlY = (startY + tipY) / 2;
        const angle = Math.atan2(tipY - ctrlY, targetX - ctrlX);
        const head = 9;
        calloutArrow
          .clear()
          .moveTo(startX, startY)
          .quadraticCurveTo(ctrlX, ctrlY, targetX, tipY)
          .moveTo(targetX + Math.cos(angle + 2.6) * head, tipY + Math.sin(angle + 2.6) * head)
          .lineTo(targetX, tipY)
          .lineTo(targetX + Math.cos(angle - 2.6) * head, tipY + Math.sin(angle - 2.6) * head)
          .stroke({ width: 3, color: COLORS.margin, cap: 'round', join: 'round' });
      }

      // Thin pencil guide line from the nib tip to the locked target, and a red-pen underline.
      guide.clear();
      const lockedId = world.lockedId ?? -1;
      if (underline.id !== lockedId) {
        underline.id = lockedId;
        underline.share = reducedMotion ? 1 : 0;
      }
      underline.share = reducedMotion ? 1 : approach(underline.share, 1, 16, frameMs);
      if (locked && lockedView) {
        const ux = locked.x - 4;
        const uy = locked.y + lockedView.height / 2 + 10;
        const w = (lockedView.width + 8) * underline.share;
        guide
          .moveTo(ux, uy)
          .quadraticCurveTo(ux + w / 2, uy + 4, ux + w, uy - 1)
          .stroke({ width: 3, color: COLORS.margin, cap: 'round', alpha: 0.85 });
      }
      if (locked) {
        const tipX = nib.x + Math.cos(nib.rotation) * NIB_LENGTH;
        const tipY = nib.y + Math.sin(nib.rotation) * NIB_LENGTH;
        guide.moveTo(tipX, tipY).lineTo(locked.x, locked.y).stroke({ width: 1.5, color: COLORS.pencil, alpha: 0.35 });
      }

      // Finished creatures keep crawling until their last drop of ink lands.
      if (playing) {
        for (const d of dying) {
          d.x -= (d.speed * frameMs) / 1000;
          d.sinceMs += frameMs;
          d.view.root.position.set(d.x, d.y - LINE_SPACING / 2);
          const y = d.y - LINE_SPACING / 2;
          d.view.highlight.visible = false;
          d.view.update(d.target, { timeMs, dtMs: frameMs, locked: false, lookX: nib.x - d.x, lookY: nib.y - y, reducedMotion, defeated: true });
          showDefeat(d.view, d.sinceMs);
        }
      }
      shots.update(frameMs);
      effects.update(frameMs);
      syncManuscript(world, frameMs);
      hud.update(world, frameMs, reducedMotion);
      overlay.update(world, frameMs);
    },
    rebuild(options) {
      build(options?.keepCard ?? false);
    },
    portrait(id) {
      const target = portraitTarget(id);
      if (!target) return null;
      try {
        const view = createCreature(target, 1.3);
        view.update(target, { timeMs: 0, dtMs: 0, locked: false, lookX: -500, lookY: 0, reducedMotion: true });
        const canvas = app.renderer.extract.canvas({ target: view.root, resolution: 2, antialias: true }) as HTMLCanvasElement;
        const url = canvas.toDataURL('image/png');
        view.root.destroy({ children: true });
        return url;
      } catch {
        // The picture is a helper; the card still explains the creature in words.
        return null;
      }
    },
    destroy() {
      app.destroy(true, { children: true });
    },
  };
}
