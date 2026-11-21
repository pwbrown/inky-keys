/**
 * Scrawler (DESIGN §5): a wobbly ink blot carrying a word, with eyes peeking
 * over its top edge and little legs scurrying underneath.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_CONFIG } from '../../core/config';
import type { SeasonId } from '../../core/seasons';
import type { Target } from '../../core/world';
import { splitAt } from '../../core/text';
import { HOLIDAY, accessoryFor, drawHeadAccessory, drawTurkeyTail } from '../holidayArt';
import { COLORS } from '../theme';
import {
  MoodTracker,
  applyGhost,
  bodyColor,
  drawCrown,
  drawFace,
  drawHem,
  drawHorns,
  drawSpikes,
  variantOf,
  drawPips,
  drawCapTicks,
  labelStyle,
  letterCenter,
  measure,
  wave,
  WORD_LETTER_SPACING,
  type CreatureView,
  type FrameContext,
} from './common';

export function createBlotling(target: Target, scale: number, season: SeasonId | null = null): CreatureView {
  const height = 46 * scale;
  const padX = 20 * scale;
  const fontSize = 26 * scale;
  const typedStyle = new TextStyle(labelStyle(COLORS.inkFaded, fontSize, WORD_LETTER_SPACING));
  const restStyle = new TextStyle(labelStyle(COLORS.label, fontSize, WORD_LETTER_SPACING));

  const root = new Container();
  const highlight = new Graphics();
  const legs = new Graphics();
  const body = new Graphics();
  const face = new Graphics();
  const pips = new Graphics();
  /** Boss trimmings: the Shuffler's arrows, the Bookworm's neck and glasses, Squid tentacles, the Quill's race line. */
  const extras = new Graphics();
  /** Holiday trimmings: a tail behind the body, a hat or sprig on top. */
  const behind = new Graphics();
  const trim = new Graphics();
  /** Bars under capital letters, so they can't be mistaken for lowercase. */
  const caps = new Graphics();
  const leafColor = HOLIDAY.leaves[Math.abs(target.id) % HOLIDAY.leaves.length]!;
  const typedLabel = new Text({ text: '', style: typedStyle });
  const restLabel = new Text({ text: target.text, style: restStyle });
  for (const label of [typedLabel, restLabel]) label.anchor.set(0, 0.5);
  root.addChild(highlight, behind, legs, body, extras, typedLabel, restLabel, caps, face, trim, pips);
  highlight.visible = false;

  const mood = new MoodTracker();
  const phase = Math.random() * Math.PI * 2;
  let width = 0;
  let shownText = '';
  let shownTyped = -1;

  /** What makes each boss look like itself (see bosses.ts for what they do). */
  const drawBossExtras = (t: Target, ctx: FrameContext, color: number, eyeX: number, eyeY: number, eyeR: number) => {
    switch (t.bossKind) {
      case 'shuffler': {
        // Two curved arrows chasing each other over its back.
        const cx = width - 14 * scale;
        const cy = -height / 2 - 18 * scale;
        const r = 12 * scale;
        const spin = ctx.reducedMotion ? 0 : ctx.timeMs * 0.002;
        for (const start of [spin, spin + Math.PI]) {
          extras
            .moveTo(cx + Math.cos(start) * r, cy + Math.sin(start) * r)
            .arc(cx, cy, r, start, start + Math.PI * 0.7)
            .stroke({ width: 3.5 * scale, color: COLORS.margin, cap: 'round' });
          const tip = start + Math.PI * 0.7;
          const tx = cx + Math.cos(tip) * r;
          const ty = cy + Math.sin(tip) * r;
          extras.circle(tx, ty, 3.5 * scale).fill(COLORS.margin);
        }
        break;
      }
      case 'bookworm':
        if (t.head) {
          // Reading glasses (it is a bookworm), drawn over the eyes in red pen.
          for (const side of [-1, 1]) face.circle(eyeX + side * eyeR * 1.25, eyeY, eyeR * 1.2).stroke({ width: 2 * scale, color: COLORS.margin });
          face.moveTo(eyeX - eyeR * 0.05, eyeY - eyeR * 0.2).lineTo(eyeX + eyeR * 0.05, eyeY - eyeR * 0.2).stroke({ width: 2 * scale, color: COLORS.margin });
        } else {
          // A neck joining it to the segment in front.
          const neck = GAME_CONFIG.entry.gapPx + 8;
          extras.roundRect(-neck, -height * 0.22, neck + 8, height * 0.44, height * 0.22).fill(color);
        }
        // Stripes, like a caterpillar.
        for (let x = width * 0.25; x < width - 6 * scale; x += 22 * scale) {
          body.roundRect(x, -height / 2 + 6 * scale, 5 * scale, height - 12 * scale, 2.5 * scale).fill({ color: COLORS.inkLight, alpha: 0.5 });
        }
        break;
      case 'squid':
        if (t.partOf === undefined) {
          // Tentacles curling out underneath.
          for (let i = 0; i < 4; i++) {
            const x = width * (0.2 + i * 0.2);
            const sway = ctx.reducedMotion ? 0 : Math.sin(ctx.timeMs * 0.004 + i) * 5 * scale;
            extras
              .moveTo(x, height / 2 - 4 * scale)
              .quadraticCurveTo(x + sway, height / 2 + 14 * scale, x + 10 * scale + sway, height / 2 + 20 * scale)
              .stroke({ width: 6 * scale, color, cap: 'round' });
          }
        } else {
          // A tentacle: a curl at the back and suckers along the bottom.
          const sway = ctx.reducedMotion ? 0 : Math.sin(ctx.timeMs * 0.005 + (t.partIndex ?? 0)) * 6 * scale;
          // About to squirt: the curl swells and it's ringed in red pen, with a "!" over it.
          const pulse = ctx.warning ? (ctx.reducedMotion ? 1 : 0.5 + 0.5 * Math.sin(ctx.timeMs * 0.03)) : 0;
          const curl = 9 * scale * (1 + 0.6 * pulse);
          extras
            .moveTo(width - 4 * scale, 0)
            .bezierCurveTo(width + 22 * scale, -6 * scale + sway, width + 26 * scale, 18 * scale, width + 10 * scale, 14 * scale)
            .stroke({ width: curl, color, cap: 'round' });
          if (ctx.warning) {
            extras
              .roundRect(-6 * scale, -height / 2 - 6 * scale, width + 12 * scale, height + 12 * scale, height / 2 + 6 * scale)
              .stroke({ width: (2 + 2 * pulse) * scale, color: COLORS.margin });
            const bx = width - 6 * scale;
            const by = -height / 2 - 14 * scale;
            extras
              .moveTo(bx, by - 12 * scale)
              .lineTo(bx, by - 2 * scale)
              .stroke({ width: 4 * scale, color: COLORS.margin, cap: 'round' })
              .circle(bx, by + 4 * scale, 2.4 * scale)
              .fill(COLORS.margin);
          }
          for (let x = 14 * scale; x < width - 8 * scale; x += 16 * scale) {
            extras.circle(x, height / 2 - 2 * scale, 3.5 * scale).fill(COLORS.inkLight);
          }
        }
        break;
      case 'quill': {
        // The rival's progress: a red-pen line under the letters it has written, led by a quill.
        const written = Math.min([...shownText].length, t.rival ?? 0);
        const whole = Math.floor(written);
        const left = padX;
        const at = (n: number) => left + (n > 0 ? measure([...shownText].slice(0, n).join(''), restStyle) : 0);
        const end = at(whole) + (at(Math.min(whole + 1, [...shownText].length)) - at(whole)) * (written - whole);
        const lineY = height / 2 + 9 * scale;
        if (end > left) extras.moveTo(left, lineY).lineTo(end, lineY).stroke({ width: 4 * scale, color: COLORS.margin, cap: 'round' });
        // The quill itself: a feather leaning back from its nib.
        const fx = end;
        const fy = lineY;
        extras
          .moveTo(fx, fy)
          .bezierCurveTo(fx + 10 * scale, fy - 18 * scale, fx + 26 * scale, fy - 34 * scale, fx + 34 * scale, fy - 44 * scale)
          .bezierCurveTo(fx + 18 * scale, fy - 34 * scale, fx + 6 * scale, fy - 20 * scale, fx, fy)
          .fill(COLORS.paper)
          .stroke({ width: 2 * scale, color: COLORS.margin });
        extras.moveTo(fx, fy).lineTo(fx + 30 * scale, fy - 40 * scale).stroke({ width: 1.5 * scale, color: COLORS.margin });
        break;
      }
    }
  };

  const view: CreatureView = {
    root,
    highlight,
    width: 0,
    height,
    letterX: (index) => letterCenter(shownText, index, padX, restStyle),
    update(t: Target, ctx: FrameContext) {
      const { mood: m, blink } = mood.update(t, ctx);

      if (t.text !== shownText || t.typed !== shownTyped) {
        if (t.text !== shownText) {
          shownText = t.text;
          width = measure(t.text, restStyle) + padX * 2;
          view.width = width;
          highlight
            .clear()
            .roundRect(-8, -height / 2 - 14, width + 16, height + 22, (height + 22) / 2)
            .fill({ color: COLORS.highlighter, alpha: 0.8 });
        }
        shownTyped = t.typed;
        const [typed, rest] = splitAt(t.text, t.typed);
        typedLabel.text = typed;
        restLabel.text = rest;
        typedLabel.x = padX;
        restLabel.x = padX + (typed ? measure(typed, typedStyle) : 0);
        caps.clear();
        drawCapTicks(caps, typed, typedLabel.x, typedStyle, COLORS.inkFaded);
        drawCapTicks(caps, rest, restLabel.x, restStyle, COLORS.label);
        pips.clear();
        drawPips(pips, width - 8 * scale * t.lives, -height / 2 - 10 * scale, t.lives, scale);
      }

      // Wobbly body: a rounded blob with bumps that rise and fall. Crimson
      // ones bristle with spikes; violet ones are lumpier, with a wavy hem.
      const color = bodyColor(t.lives);
      const variant = variantOf(t.lives);
      body.clear().roundRect(0, -height / 2, width, height, height / 2).fill(color);
      const bumps = Math.max(2, Math.round(width / (36 * scale)));
      if (variant === 'crimson') {
        const lift = 2 * scale * wave(ctx, 0.008, phase);
        drawSpikes(body, height * 0.35, width - height * 0.35, -height / 2 + 2 * scale, bumps * 2, 9 * scale + lift, -1, color);
        drawSpikes(body, height * 0.45, width - height * 0.45, height / 2 - 2 * scale, bumps + 1, 6 * scale, 1, color);
      } else {
        const lumpy = variant === 'violet' ? 1.3 : 1;
        for (let i = 0; i < bumps; i++) {
          const bx = ((i + 0.5) / bumps) * width;
          const lift = 2 * scale * lumpy * wave(ctx, 0.005, phase + i * 1.7);
          body.circle(bx, -height / 2 + 4 * scale + lift, height * 0.24 * lumpy).fill(color);
          if (i % 2 === 0 && variant === 'plain') body.circle(bx + 9 * scale, height / 2 - 4 * scale - lift, height * 0.18).fill(color);
        }
      }
      if (variant === 'violet') drawHem(body, height * 0.3, width - height * 0.3, height / 2 - 2 * scale, 7 * scale, color, wave(ctx, 0.006, phase));
      // A drip hanging off the back.
      body.circle(width + -2 * scale, height * 0.15, 5 * scale).fill(color);

      // Legs scurry: alternate pairs lift in turn. (Violet ones glide on their hem.)
      legs.clear();
      if (variant !== 'violet') {
        const legCount = Math.max(3, Math.round(width / (28 * scale)));
        for (let i = 0; i < legCount; i++) {
          const lx = ((i + 0.5) / legCount) * width;
          const step = ctx.defeated ? 0 : 3 * scale * wave(ctx, 0.016, i * Math.PI);
          legs.ellipse(lx + step, height / 2 + 3 * scale - Math.abs(step) * 0.6, 4.5 * scale, 3.2 * scale).fill(COLORS.inkLight);
        }
      }

      // Eyes peek over the front (left) of the body, toward where it's heading.
      face.clear();
      extras.clear();
      const eyeR = 7 * scale;
      const eyeX = padX + eyeR * (variant === 'violet' ? 1.6 : 0.6);
      const eyeY = -height / 2 - 3 * scale;
      // Bookworm segments behind the head and Squid tentacles have no face of their own.
      const faceless = (t.bossKind === 'bookworm' && !t.head) || (t.bossKind === 'squid' && t.partOf !== undefined);
      if (!faceless) {
        // Horns and crown grow out of the body, behind the eyes.
        if (variant === 'crimson') drawHorns(body, eyeX, eyeY + eyeR * 0.4, eyeR * 2.3, eyeR * 2.4, color);
        if (variant === 'violet') drawCrown(body, eyeX, eyeY - eyeR * 0.4, eyeR * 4.2, color);
        drawFace(face, eyeX, eyeY, eyeR, m, blink, ctx.lookX, ctx.lookY, color, null, variant === 'violet' ? 3 : 2);
      }
      behind.clear();
      trim.clear();
      const accessory = faceless || (t.bossKind === 'bookworm' && !t.head) ? null : accessoryFor(season, t, variant);
      if (accessory) {
        // Bosses wear theirs bigger. Hats sit on the eyes; a crown gets its sprig on top.
        const size = eyeR * 2 * (t.boss ? 1.5 : 1);
        if (accessory === 'turkeyTail') drawTurkeyTail(behind, width - 6 * scale, -height * 0.1, height * (t.boss ? 1.15 : 0.95));
        else {
          const top = variant === 'violet' ? eyeY - eyeR * 2.8 : variant === 'crimson' ? eyeY - eyeR * 0.9 : eyeY - eyeR * 0.75;
          drawHeadAccessory(trim, accessory, eyeX, top, size, leafColor);
        }
      }
      drawBossExtras(t, ctx, color, eyeX, eyeY, eyeR);
      highlight.visible = ctx.locked;
      caps.visible = !applyGhost(t, root, [typedLabel, restLabel], ctx.timeMs, ctx.reducedMotion);
      restLabel.alpha = ctx.guarded ? 0.45 : 1;
    },
  };
  view.update(target, { timeMs: 0, dtMs: 0, locked: false, lookX: -500, lookY: 0, reducedMotion: true });
  return view;
}
