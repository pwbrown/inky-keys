/** Heads-up display: ink well (health), score, combo and page progress (DESIGN §6). */
import { Container, Graphics, Text } from 'pixi.js';
import { APPRENTICE_CHAPTERS, newKeysFor } from '../core/campaign';
import { ACTIVE_ABILITIES, abilityCost, isActive, type AbilityId } from '../core/abilities';
import { GAME_CONFIG } from '../core/config';
import { multiplier } from '../core/input';
import { WORLD_HEIGHT, WORLD_WIDTH, type World } from '../core/world';
import { formatNumber, t, type MessageKey } from '../i18n';
import { COLORS, TEXT_FONT, keyLabel } from './theme';
import { Punch, approach } from './tween';

const BAR_X = 70;
const BAR_Y = 21;
const BAR_WIDTH = 180;
const BAR_HEIGHT = 14;
/** How long lost ink lingers as a pale "ghost" on the bar before draining away. */
const GHOST_HOLD_MS = 350;

export class Hud {
  readonly root = new Container();
  private readonly inkFill = new Graphics();
  private readonly score: Text;
  /** A friend's score to beat, from a challenge link. */
  private readonly target: Text;
  private readonly combo: Text;
  /** The multiplier just lost, falling away. */
  private readonly comboLost: Text;
  /** Progress toward the next multiplier step. */
  private readonly comboBar = new Graphics();
  private readonly page: Text;
  /** Ink as drawn: follows the real value quickly. */
  private shownInk = -1;
  /** Trails behind after a loss, so the player sees how much went. */
  private ghostInk = -1;
  private ghostHoldMs = 0;
  private lastInk = -1;
  private shownScore = 0;
  private lastScore = 0;
  private lastMult = 1;
  private lostMs = 0;
  private readonly scorePunch = new Punch(180);
  private readonly comboPunch = new Punch(260);
  private readonly inkPunch = new Punch(300);
  /** Ability charges, drawn as ink drops beside the ink bar. */
  private readonly chargeDrops = new Graphics();
  private lastCharges = -1;
  /** One label per unlocked ability: its key and name, dim until it can be used. */
  private readonly abilityLayer = new Container();
  private readonly timers = new Graphics();
  private slots: { id: AbilityId; text: Text; pulse: Punch }[] = [];
  private slotsKey = '';

  constructor() {
    const label = new Text({ text: t('hud.ink'), style: { fontFamily: TEXT_FONT, fontSize: 16, fontWeight: '600', fill: COLORS.ink } });
    label.position.set(24, 18);

    const frame = new Graphics()
      .roundRect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT, BAR_HEIGHT / 2)
      .stroke({ width: 2, color: COLORS.ink });

    this.score = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 20, fontWeight: '700', fill: COLORS.ink } });
    this.score.anchor.set(1, 0);
    this.score.position.set(WORLD_WIDTH - 24, 14);

    this.target = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 18, fontWeight: '700', fill: COLORS.margin } });
    this.target.anchor.set(0.5, 0);
    // Below the ability labels along the top, in the clear middle of the page.
    this.target.position.set(WORLD_WIDTH / 2, 42);

    const comboStyle = { fontFamily: TEXT_FONT, fontSize: 18, fontWeight: '700' as const, fill: COLORS.margin };
    this.combo = new Text({ text: '', style: comboStyle });
    this.combo.anchor.set(1, 0.5);
    this.combo.position.set(WORLD_WIDTH - 24, 52);
    this.comboLost = new Text({ text: '', style: { ...comboStyle, fill: COLORS.inkFaded } });
    this.comboLost.anchor.set(1, 0.5);
    this.comboLost.visible = false;

    this.page = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 15, fill: COLORS.inkLight } });
    this.page.anchor.set(0.5, 1);
    this.page.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT - 12);

    this.root.addChild(label, this.inkFill, frame, this.chargeDrops, this.abilityLayer, this.timers, this.score, this.target, this.comboBar, this.comboLost, this.combo, this.page);
  }

  /** Where charge drop `index` is drawn, for effects that land on it. */
  chargePoint(index: number): { x: number; y: number } {
    return { x: BAR_X + BAR_WIDTH + 20 + Math.max(0, index) * 18, y: 27 };
  }

  /** The middle of the filled part of the ink bar, for effects that fly into it. */
  inkPoint(): { x: number; y: number } {
    return { x: BAR_X + BAR_WIDTH * Math.max(0.1, this.shownInk), y: BAR_Y + BAR_HEIGHT / 2 };
  }

  update(world: World, dtMs = 0, reducedMotion = true): void {
    this.updateAbilities(world, dtMs, reducedMotion);

    this.updateInk(world, dtMs, reducedMotion);
    this.updateScore(world, dtMs, reducedMotion);
    this.updateCombo(world, dtMs, reducedMotion);
    this.updateTarget(world);

    const { spawned, params, chapter, index, pageCount } = world.page;
    const progress = {
      chapter: chapter + 1,
      page: index + 1,
      pages: pageCount,
      // Inkmites (from a split Spill) aren't counted in `spawned`, so don't let them take this below zero.
      done: Math.max(0, spawned - world.targets.filter((target) => !target.bottle).length),
      total: params.size,
    };
    // In the Apprentice campaign, say what this chapter is teaching.
    setText(
      this.page,
      world.mode === 'apprentice'
        ? t('hud.apprentice', {
            ...progress,
            chapters: APPRENTICE_CHAPTERS,
            keys: newKeysFor(world.layout, chapter).map(keyLabel).join(' '),
          })
        : world.mode === 'accents'
          ? t('hud.apprentice', { ...progress, keys: world.accentLetters.join(' ') })
          : world.mode === 'daily' && world.daily
            ? t('hud.daily', { ...progress, id: world.daily.id })
            : t('hud.page', progress),
    );
  }

  /** Where an ability's label is, for effects that point at it. */
  abilityPoint(id: AbilityId): { x: number; y: number } {
    const slot = this.slots.find((s) => s.id === id);
    return slot ? { x: slot.text.x + slot.text.width / 2, y: slot.text.y } : this.chargePoint(0);
  }

  /** Make an ability's label throb, to draw the eye to it (tutorials, and when it becomes ready). */
  pulse(id: AbilityId): void {
    this.slots.find((s) => s.id === id)?.pulse.hit();
  }

  /** Charge drops, then a label per unlocked ability with a bar while its effect lasts. */
  private updateAbilities(world: World, dtMs: number, reducedMotion: boolean): void {
    const max = GAME_CONFIG.abilities.maxCharges;
    const anyActive = world.abilities.some(isActive);
    if (world.charges !== this.lastCharges || this.slotsKey !== world.abilities.join()) {
      this.lastCharges = world.charges;
      const g = this.chargeDrops.clear();
      for (let i = 0; anyActive && i < max; i++) {
        const { x } = this.chargePoint(i);
        const filled = i < world.charges;
        g.circle(x, 31, 6).poly([x - 5, 28, x, 18, x + 5, 28]);
        if (filled) g.fill(COLORS.ink);
        else g.stroke({ width: 1.5, color: COLORS.inkFaded });
      }
    }

    if (this.slotsKey !== world.abilities.join()) {
      this.slotsKey = world.abilities.join();
      for (const child of this.abilityLayer.removeChildren()) child.destroy();
      // Active abilities first, in key order, then the passive ones.
      const order: AbilityId[] = [...ACTIVE_ABILITIES.filter((id) => world.abilities.includes(id)), ...world.abilities.filter((id) => !isActive(id))];
      let x = this.chargePoint(max - 1).x + 22;
      this.slots = order.map((id) => {
        const name = t(`ability.${id}` as MessageKey);
        const text = new Text({
          text: isActive(id) ? t('hud.ability', { key: t(`ability.${id}.key` as MessageKey), name }) : name,
          style: { fontFamily: TEXT_FONT, fontSize: 14, fontWeight: '700', fill: COLORS.ink },
        });
        text.anchor.set(0, 0.5);
        text.position.set(x, 28);
        x += text.width + 18;
        this.abilityLayer.addChild(text);
        return { id, text, pulse: new Punch(700) };
      });
    }

    const g = this.timers.clear();
    for (const slot of this.slots) {
      const { id, text } = slot;
      const ready = isActive(id) ? world.charges >= abilityCost(id, world.difficulty) : id === 'eraser' ? world.eraser : world.shield;
      text.alpha = ready ? 1 : 0.35;
      const k = reducedMotion ? 0 : slot.pulse.update(dtMs);
      text.scale.set(1 + 0.18 * k * Math.abs(Math.sin(k * 9)));
      // A bar under the label runs down while a timed ability lasts.
      const left =
        id === 'paperweight'
          ? world.slowMs / GAME_CONFIG.abilities.paperweight.durationMs
          : id === 'highlighter'
            ? world.highlightMs / GAME_CONFIG.abilities.highlighter.durationMs
            : 0;
      if (left > 0) g.roundRect(text.x, 39, text.width * left, 4, 2).fill(COLORS.margin);
      else if (ready && !isActive(id)) g.roundRect(text.x, 39, text.width, 2, 1).fill(COLORS.ink);
    }
  }

  /** The ink bar: lost ink lingers pale for a moment, then drains; gained ink glows. */
  private updateInk(world: World, dtMs: number, reducedMotion: boolean): void {
    const ratio = world.ink / world.maxInk;
    const animate = !reducedMotion && dtMs > 0 && this.shownInk >= 0;
    if (world.ink !== this.lastInk) {
      if (animate && world.ink < this.lastInk) this.ghostHoldMs = GHOST_HOLD_MS;
      if (animate && world.ink > this.lastInk) this.inkPunch.hit();
      this.lastInk = world.ink;
    }
    const before = this.shownInk;
    const beforeGhost = this.ghostInk;
    if (animate) {
      this.shownInk = settle(approach(this.shownInk, ratio, 18, dtMs), ratio);
      this.ghostHoldMs = Math.max(0, this.ghostHoldMs - dtMs);
      const goal = Math.max(this.shownInk, ratio);
      this.ghostInk = this.ghostHoldMs > 0 ? Math.max(this.ghostInk, goal) : settle(approach(this.ghostInk, goal, 5, dtMs), goal);
      if (this.ghostInk < this.shownInk) this.ghostInk = this.shownInk;
    } else {
      this.shownInk = ratio;
      this.ghostInk = ratio;
    }
    const glow = animate ? this.inkPunch.update(dtMs) : 0;
    if (this.shownInk === before && this.ghostInk === beforeGhost && glow === 0 && this.lastGlow === 0) return;
    this.lastGlow = glow;

    const g = this.inkFill.clear();
    const bar = (share: number, color: number, alpha = 1) => {
      if (share <= 0) return;
      g.roundRect(BAR_X, BAR_Y, Math.max(BAR_HEIGHT, BAR_WIDTH * share), BAR_HEIGHT, BAR_HEIGHT / 2).fill({ color, alpha });
    };
    if (this.ghostInk > this.shownInk + 0.002) bar(this.ghostInk, COLORS.margin, 0.45);
    bar(this.shownInk, ratio < GAME_CONFIG.lowInk ? COLORS.margin : COLORS.ink);
    if (glow > 0) {
      g.roundRect(BAR_X - 3, BAR_Y - 3, BAR_WIDTH + 6, BAR_HEIGHT + 6, BAR_HEIGHT / 2 + 3).stroke({ width: 3, color: COLORS.highlighter, alpha: glow });
    }
  }
  private lastGlow = 0;

  /** "To beat: 4,820 (Pip)" at the top while playing a challenge, then a tick once it's beaten. */
  private updateTarget(world: World): void {
    const c = world.challenge;
    if (!c) {
      setText(this.target, '');
      return;
    }
    const beaten = world.stats.score > c.score;
    const score = formatNumber(c.score);
    const text = beaten
      ? c.name
        ? t('hud.challengeBeatenBy', { name: c.name, score })
        : t('hud.challengeBeaten', { score })
      : c.name
        ? t('hud.challengeBy', { name: c.name, score })
        : t('hud.challenge', { score });
    setText(this.target, text);
    this.target.style.fill = beaten ? COLORS.ink : COLORS.margin;
  }

  /** The score counts up to its new value and gives a little kick as it grows. */
  private updateScore(world: World, dtMs: number, reducedMotion: boolean): void {
    const score = world.stats.score;
    if (reducedMotion || dtMs <= 0 || Math.abs(score - this.shownScore) > 5000) {
      this.shownScore = score;
    } else {
      if (score > this.lastScore) this.scorePunch.hit();
      this.shownScore = settle(approach(this.shownScore, score, 14, dtMs), score, 0.6);
    }
    this.lastScore = score;
    setText(this.score, t('hud.score', { score: formatNumber(Math.round(this.shownScore)) }));
    const k = reducedMotion ? 0 : this.scorePunch.update(dtMs);
    this.score.scale.set(1 + 0.12 * k);
  }

  /** The multiplier kicks when it steps up, and falls off the page when the run is broken. */
  private updateCombo(world: World, dtMs: number, reducedMotion: boolean): void {
    const combo = world.stats.combo;
    const mult = multiplier(combo);
    if (mult > this.lastMult) this.comboPunch.hit();
    if (mult < this.lastMult && !reducedMotion && dtMs > 0) {
      this.comboLost.text = t('hud.multiplier', { multiplier: this.lastMult });
      this.comboLost.visible = true;
      this.lostMs = 600;
    }
    this.lastMult = mult;
    setText(this.combo, mult > 1 ? t('hud.multiplier', { multiplier: mult }) : '');
    const k = reducedMotion ? 0 : this.comboPunch.update(dtMs);
    this.combo.scale.set(1 + 0.5 * k);
    this.combo.rotation = -0.2 * k;

    if (this.lostMs > 0) {
      this.lostMs = Math.max(0, this.lostMs - dtMs);
      const f = 1 - this.lostMs / 600;
      this.comboLost.position.set(WORLD_WIDTH - 24 - f * 10, 52 + f * f * 70);
      this.comboLost.rotation = f * 0.6;
      this.comboLost.alpha = 1 - f;
      this.comboLost.visible = this.lostMs > 0;
    }

    // A thin line fills toward the next step, so the player can see a run building.
    const { step, maxMultiplier } = GAME_CONFIG.combo;
    const share = mult >= maxMultiplier ? 1 : (combo % step) / step;
    if (share !== this.lastShare) {
      this.lastShare = share;
      const g = this.comboBar.clear();
      if (combo > 0) {
        const w = 64;
        const x = WORLD_WIDTH - 24 - w;
        g.roundRect(x, 66, w, 4, 2).fill({ color: COLORS.inkFaded, alpha: 0.35 });
        if (share > 0) g.roundRect(x, 66, Math.max(4, w * share), 4, 2).fill(COLORS.margin);
      }
    }
  }
  private lastShare = -1;
}

/** Snap to the goal once close enough, so the HUD stops redrawing. */
function settle(value: number, goal: number, within = 0.002): number {
  return Math.abs(value - goal) < within ? goal : value;
}

/** Only touch Text when it changed: re-rendering text is relatively costly. */
function setText(node: Text, value: string): void {
  if (node.text !== value) node.text = value;
}
