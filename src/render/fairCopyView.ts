/**
 * Fair Copy (M31): the text is written on the notebook lines of the game's
 * own page (the player's paper, the season's decor). Untyped text is pale,
 * typed text is in ink, and mistakes are in margin red with what was actually
 * typed above them. The scribe sits in the margin by the line being copied,
 * cheers long runs and winces at slips.
 *
 * A passage fits on the page; a timed test's longer text scrolls, keeping the
 * caret on the second line. Between passages an Enter mark (↵) waits, with a
 * "Press Enter" note while the caret is on its line. Reads the test; never changes it.
 */
import { CanvasTextMetrics, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_CONFIG } from '../core/config';
import { PASSAGE_BREAK, fairCopyResult, marks, remainingMs, type FairCopy, type FairCopyEvent, type FairCopyResult, type PassageSpan } from '../core/fairCopy';
import { pageGrade } from '../core/grade';
import type { Cosmetics } from '../core/rewards';
import type { SeasonId } from '../core/seasons';
import { FIRST_LINE_Y, LINE_SPACING, MARGIN_X, WORLD_HEIGHT, WORLD_WIDTH, laneCount } from '../core/world';
import { formatNumber, t, tCount, type MessageKey } from '../i18n';
import { Effects } from './effects';
import { drawPage, splatterColor } from './renderer';
import { SeasonDecor } from './seasonDecor';
import { Scribe } from './scribe';
import { COLORS, DISPLAY_FONT, DISPLAY_PADDING, TEXT_FONT, glyph, keyLabel } from './theme';
import { outCubic } from './tween';

/** Clicks on the result card. */
export interface FairCopyActions {
  onNext(): void;
  onAgain(): void;
  onMenu(): void;
}

/** How a finished test compares with the player's best of its kind (net WPM). */
export interface FairCopyRecord {
  previous: number | null;
  isNew: boolean;
}

/** What the view needs to know about a test before it starts. */
export interface FairCopySetup {
  /** Where each passage starts in the test's text. */
  spans: readonly PassageSpan[];
  /** A timed test's length, or null for one passage. */
  seconds: number | null;
  /** Dressed like the game's page. */
  cosmetics: Cosmetics;
  season: SeasonId | null;
}

const FONT_SIZE = 26;
const LEFT = MARGIN_X + GAME_CONFIG.manuscript.insetLeft;
const RIGHT = WORLD_WIDTH - GAME_CONFIG.manuscript.insetRight;
/** Text on every ruled line. */
const TEXT_LINES = laneCount();
/** While scrolling, the caret stays on this row, so the line before it stays in view. */
const CARET_ROW = 1;
const baselineOf = (row: number) => FIRST_LINE_Y + row * LINE_SPACING;
const CARD_WIDTH = 620;
const PAD = 32;
/** The countdown turns red for the last few seconds. */
const COUNTDOWN_WARN_MS = 5000;

const textStyle = (fill: number) => new TextStyle({ fontFamily: TEXT_FONT, fontSize: FONT_SIZE, fill });
const MEASURE = textStyle(0);
/** How a character is drawn: the passage break as an Enter mark, a space after the last word. */
const shown = (c: string) => (c === PASSAGE_BREAK ? ' \u21b5' : c);
const measure = (s: string) => CanvasTextMetrics.measureText([...s].map(shown).join(''), MEASURE).width;
/** Room kept after a passage's Enter mark for its "Press Enter" note. */
const BREAK_NOTE_ROOM = 190;

interface Line {
  /** Index of the first character in the text. */
  start: number;
  chars: string[];
  x: number;
}

/** Wrap each passage by words to the page's width, starting each on a new, indented line. */
function wrap(text: string, spans: readonly PassageSpan[]): Line[] {
  const all = [...text];
  const lines: Line[] = [];
  spans.forEach((span, i) => {
    const end = spans[i + 1]?.start ?? all.length;
    const tokens = all.slice(span.start, end).join('').match(/\S+\s*/g) ?? [];
    let current = '';
    let start = span.start;
    let x = LEFT + GAME_CONFIG.manuscript.indent;
    for (const token of tokens) {
      if (current !== '' && x + measure(current + token.trimEnd()) > RIGHT) {
        lines.push({ start, chars: [...current], x });
        start += [...current].length;
        current = '';
        x = LEFT;
      }
      current += token;
    }
    if (current !== '') lines.push({ start, chars: [...current], x });
    // Before a break, leave room on the line for the "Press Enter" note: carry the last word over if need be.
    const last = lines.at(-1);
    if (i < spans.length - 1 && last && last.x + measure(last.chars.join('')) + BREAK_NOTE_ROOM > RIGHT) {
      const words = last.chars.join('').match(/\S+\s*/g) ?? [];
      if (words.length > 1) {
        const carried = [...words.at(-1)!];
        last.chars = last.chars.slice(0, last.chars.length - carried.length);
        lines.push({ start: last.start + last.chars.length, chars: carried, x: LEFT });
      }
    }
  });
  return lines;
}

/** "0:41" */
export function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One line of text, drawn as runs of typed, wrong and untyped letters. */
class LineView {
  readonly root = new Container();
  private shown = '';

  constructor(
    readonly line: Line,
    private readonly ascent: number,
  ) {}

  /** Put the line on visible row `row` (or hide it). */
  place(row: number | null): void {
    this.root.visible = row !== null;
    if (row !== null) this.root.y = baselineOf(row);
  }

  update(typed: readonly string[], ok: readonly boolean[]): void {
    const { start, chars, x } = this.line;
    // 'r' right, 'w' wrong, '.' not yet typed.
    const states = chars.map((_, i) => (start + i >= ok.length ? '.' : ok[start + i] ? 'r' : 'w'));
    const key = states.join('') + typed.slice(start, start + chars.length).join('');
    if (key === this.shown) return;
    this.shown = key;
    for (const child of this.root.removeChildren()) child.destroy();

    const squiggle = new Graphics();
    this.root.addChild(squiggle);
    let i = 0;
    while (i < chars.length) {
      const state = states[i]!;
      let j = i;
      while (j < chars.length && states[j] === state) j++;
      const run = chars.slice(i, j).map(shown).join('');
      const runX = x + measure(chars.slice(0, i).join(''));
      const fill = state === 'r' ? COLORS.ink : state === 'w' ? COLORS.margin : COLORS.inkFaded;
      const text = new Text({ text: run, style: textStyle(fill) });
      // A touch lower than the font's ascent says, so letters sit on the rule.
      text.position.set(runX, -this.ascent + 3);
      this.root.addChild(text);
      if (state === 'w') {
        // Not by colour alone: a wavy underline, and the letters actually typed above.
        const x1 = runX + Math.max(measure(chars.slice(i, j).join('')), 8);
        squiggle.moveTo(runX, 6);
        for (let px = runX; px <= x1; px += 4) squiggle.lineTo(px, 6 + (Math.round((px - runX) / 4) % 2 ? 3 : 0));
        const above = new Text({
          text: typed
            .slice(start + i, start + j)
            .map((c) => glyph(c))
            .join(''),
          style: { fontFamily: TEXT_FONT, fontSize: 15, fontWeight: '700', fill: COLORS.margin },
        });
        above.anchor.set(0, 1);
        above.position.set(runX, -this.ascent + 2);
        this.root.addChild(above);
      }
      i = j;
    }
    squiggle.stroke({ width: 2, color: COLORS.margin });
  }

  /** Where the caret sits before text character `index` on this line. */
  caretX(index: number): number {
    return this.line.x + measure(this.line.chars.slice(0, index - this.line.start).join(''));
  }
}

export class FairCopyView {
  readonly root = new Container();
  private readonly lines: LineView[] = [];
  private readonly caret = new Graphics();
  private readonly scribe: Scribe;
  private readonly effects: Effects;
  private readonly source: Text;
  private readonly heading: Text;
  private readonly hudLeft: Text;
  private readonly hudRight: Text;
  private readonly footer: Text;
  /** "Press Enter", by the passage break the caret is heading for. */
  private readonly breakNote = new Container();
  private readonly decor: SeasonDecor;
  private timeMs = 0;
  private readonly result = new Container();
  private readonly ascent: number;
  private firstLine = 0;
  private caretBlinkMs = 0;
  private lastLength = -1;
  private scribeY = 0;
  private hudMs = 0;
  private resultMs = -1;
  private card: Container | null = null;
  private stamp: Text | null = null;
  private sourceSpan: PassageSpan | null = null;
  private record: FairCopyRecord | null = null;

  constructor(
    text: string,
    private readonly setup: FairCopySetup,
    private readonly reducedMotion: boolean,
    private readonly actions: FairCopyActions,
  ) {
    this.ascent = CanvasTextMetrics.measureText('Hg', MEASURE).fontProperties.ascent;
    this.root.addChild(drawPage(setup.cosmetics.paper));
    this.decor = new SeasonDecor(setup.season, reducedMotion);
    this.root.addChild(this.decor.root);

    this.heading = new Text({
      text: setup.seconds === null ? t('fairCopy.heading') : t('fairCopy.headingTimed', { seconds: setup.seconds }),
      style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 34, fontWeight: '700', fill: COLORS.ink },
    });
    this.heading.anchor.set(0, 1);
    this.heading.position.set(LEFT, FIRST_LINE_Y - LINE_SPACING + 6);
    this.heading.alpha = 0.75;
    this.source = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 16, fontStyle: 'italic', fill: COLORS.pencil } });
    this.source.anchor.set(0, 1);
    this.source.position.set(this.heading.x + this.heading.width + 8, this.heading.y - 6);
    this.root.addChild(this.heading, this.source);

    const textLayer = new Container();
    const wrapped = wrap(text, setup.spans);
    if (setup.seconds === null && wrapped.length > TEXT_LINES) console.warn(`Fair Copy: the passage needs ${wrapped.length} lines; the page has ${TEXT_LINES}.`);
    for (const line of wrapped) {
      const view = new LineView(line, this.ascent);
      this.lines.push(view);
      textLayer.addChild(view.root);
    }

    // Sized like the game's HUD (render/hud.ts).
    this.hudLeft = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 16, fontWeight: '600', fill: COLORS.ink } });
    this.hudLeft.position.set(24, 16);
    this.hudRight = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 20, fontWeight: '700', fill: COLORS.ink } });
    this.hudRight.anchor.set(1, 0);
    this.hudRight.position.set(WORLD_WIDTH - 24, 14);
    this.footer = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 15, fill: COLORS.inkLight } });
    this.footer.anchor.set(0.5, 1);
    this.footer.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT - 8);

    // The note by a passage break, in the red pen of the game's tutorial notes.
    const noteText = new Text({ text: t('fairCopy.pressEnter'), style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 28, fontWeight: '700', fill: COLORS.margin } });
    noteText.anchor.set(0, 0.5);
    noteText.position.set(34, 0);
    const noteArrow = new Graphics()
      .moveTo(28, 2)
      .quadraticCurveTo(16, -6, 4, 0)
      .moveTo(12, -6)
      .lineTo(4, 0)
      .lineTo(12, 5)
      .stroke({ width: 3, color: COLORS.margin, cap: 'round', join: 'round' });
    this.breakNote.addChild(noteArrow, noteText);
    this.breakNote.visible = false;

    this.scribe = new Scribe(0, 0);
    this.scribe.start('', true);
    this.scribe.setSeason(setup.season);
    this.effects = new Effects(reducedMotion, splatterColor(setup.cosmetics.splatter));
    this.root.addChild(textLayer, this.caret, this.breakNote, this.scribe.root, this.effects.stainLayer, this.effects.particleLayer, this.hudLeft, this.hudRight, this.footer, this.result);
    this.scroll(0);
    this.scribeY = this.scribeSpot(0)[1];
  }

  /** How the finished test compares with the player's best, for the card. Call before the card is built (on finishing). */
  setRecord(record: FairCopyRecord | null): void {
    this.record = record;
  }

  /** React to what just happened: the scribe's moods (and later, sounds). */
  react(test: FairCopy, events: FairCopyEvent[]): void {
    const [cx, cy] = this.caretSpot(test);
    for (const event of events) {
      // A long run gets a quiet cheer from the scribe; nothing on the text itself, so it never looks like a mistake.
      if (event === 'correct' && test.streak > 0 && test.streak % GAME_CONFIG.fairCopy.streakCheer === 0) this.scribe.cheer();
      if (event === 'correct') this.scribe.write();
      if (event === 'error') {
        this.scribe.wince();
        this.effects.splatter(cx - 6, cy - 10, 4, COLORS.margin);
      }
      if (event === 'finished') this.scribe.cheer();
    }
    this.caretBlinkMs = 0;
  }

  sync(test: FairCopy, now: number, frameMs: number): void {
    const typed = [...test.buffer];
    const ok = marks(test);
    const index = Math.min(typed.length, [...test.text].length);
    this.scroll(index);
    for (const line of this.lines) if (line.root.visible) line.update(typed, ok);

    // The caret: solid while typing, blinking when idle, hidden once done.
    this.caretBlinkMs += frameMs;
    const finished = test.finishedAt !== null;
    const [cx, cy] = this.caretSpot(test);
    this.caret.clear();
    const blinkOn = this.reducedMotion || this.caretBlinkMs < 500 || Math.floor(this.caretBlinkMs / 530) % 2 === 0;
    if (!finished && blinkOn) this.caret.rect(cx - 1, cy - this.ascent - 2, 2.5, this.ascent + 8).fill(COLORS.ink);

    // The scribe keeps pace down the margin, beside the line being copied.
    const [sx, sy] = this.scribeSpot(index);
    const k = this.reducedMotion ? 1 : Math.min(1, frameMs / 90);
    this.scribeY += (sy - this.scribeY) * k;
    this.scribe.root.position.set(sx, this.scribeY);
    this.scribe.update(frameMs, this.reducedMotion, ok.at(-1) === false);
    this.effects.update(frameMs);
    this.decor.update(frameMs);
    this.timeMs += frameMs;
    this.syncBreakNote(test, index);

    // Which passage the caret is in, by its author.
    const span = [...this.setup.spans].reverse().find((s) => s.start <= index) ?? null;
    if (span !== this.sourceSpan && span) {
      this.sourceSpan = span;
      this.source.text = t('fairCopy.source', { title: span.passage.title, author: span.passage.author });
    }

    // HUD. Live numbers settle every half second so they don't flicker; the countdown ticks every frame.
    this.hudMs += frameMs;
    if (this.hudMs > 500 || typed.length !== this.lastLength || finished || this.setup.seconds !== null) {
      if (this.hudMs > 500 || typed.length !== this.lastLength) this.hudMs = 0;
      this.lastLength = typed.length;
      this.syncHud(test, now);
    }

    if (finished) this.showResult(fairCopyResult(test, now), frameMs);
  }

  /** Keep the caret's line on the page: a passage never moves, a timed test scrolls. */
  private scroll(index: number): void {
    const caretLine = this.lineIndexOf(index);
    const max = Math.max(0, this.lines.length - TEXT_LINES);
    this.firstLine = this.setup.seconds === null ? 0 : Math.min(max, Math.max(0, caretLine - CARET_ROW));
    this.lines.forEach((line, i) => {
      const row = i - this.firstLine;
      line.place(row >= 0 && row < TEXT_LINES ? row : null);
    });
  }

  private syncHud(test: FairCopy, now: number): void {
    const live = fairCopyResult(test, now);
    const started = test.startedAt !== null;
    // Too few keys make a silly number, so the live speed waits a moment.
    const speed = started && live.ms > 2000 ? formatNumber(Math.round(live.netWpm)) : '–';
    const left = remainingMs(test, now);
    if (left === null) {
      this.hudRight.text = t('fairCopy.hud', { wpm: speed, time: formatClock(live.ms) });
      this.hudRight.style.fill = COLORS.ink;
    } else {
      // Round up, so it reads 0:30 at the start and 0:00 only at the bell.
      this.hudRight.text = t('fairCopy.hudTimed', { wpm: speed, time: formatClock(Math.ceil(left / 1000) * 1000) });
      this.hudRight.style.fill = started && left <= COUNTDOWN_WARN_MS ? COLORS.margin : COLORS.ink;
    }
    this.hudLeft.text = started
      ? t('fairCopy.hudLeft', { accuracy: formatNumber(Math.round(live.accuracy * 100)), streak: formatNumber(test.streak) })
      : '';
    const seconds = this.setup.seconds;
    this.footer.text = test.finishedAt !== null ? '' : started ? t('fairCopy.footer') : seconds === null ? t('fairCopy.hint') : t('fairCopy.hintTimed', { seconds });
  }

  /** Baseline position of the caret. */
  private caretSpot(test: FairCopy): [number, number] {
    const index = Math.min([...test.buffer].length, [...test.text].length);
    const i = this.lineIndexOf(index);
    return [this.lines[i]?.caretX(index) ?? LEFT, baselineOf(i - this.firstLine)];
  }

  private lineIndexOf(index: number): number {
    const i = this.lines.findIndex((l) => index < l.line.start + l.line.chars.length);
    return i === -1 ? this.lines.length - 1 : i;
  }

  /** Where the scribe stands for the caret before `index`: in the margin, on the caret's line, quill towards the text. */
  private scribeSpot(index: number): [number, number] {
    const i = this.lineIndexOf(index);
    return [MARGIN_X - 44, baselineOf(i - this.firstLine) + 4];
  }

  /** "Press Enter" by the break at the end of the caret's line, if there is one there. */
  private syncBreakNote(test: FairCopy, index: number): void {
    const line = this.lines[this.lineIndexOf(index)];
    const end = line ? line.line.start + line.line.chars.length - 1 : -1;
    const show = test.finishedAt === null && line !== undefined && line.line.chars.at(-1) === PASSAGE_BREAK && index <= end;
    this.breakNote.visible = show;
    if (!show) return;
    const bob = this.reducedMotion ? 0 : Math.sin(this.timeMs / 260) * 3;
    this.breakNote.position.set(line.caretX(end + 1) + 6 + bob, line.root.y - this.ascent / 2 + 2);
  }

  private showResult(result: FairCopyResult, frameMs: number): void {
    if (this.resultMs < 0) {
      this.resultMs = 0;
      this.buildCard(result);
    }
    this.resultMs += frameMs;
    if (this.card && this.stamp) {
      const pop = this.reducedMotion ? 1 : outCubic(Math.min(1, this.resultMs / 260));
      this.card.scale.set(0.9 + 0.1 * pop);
      this.card.alpha = pop;
      const stamp = this.reducedMotion ? 1 : Math.min(1, Math.max(0, (this.resultMs - 320) / 200));
      this.stamp.scale.set(1 + (1 - outCubic(stamp)) * 1.8);
      this.stamp.alpha = stamp > 0 ? 1 : 0;
    }
  }

  /** A graded card, like the page-cleared card. */
  private buildCard(r: FairCopyResult): void {
    const backdrop = new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: COLORS.desk, alpha: 0.35 });
    const card = new Container();
    const cx = WORLD_WIDTH / 2;
    const parts: Container[] = [];
    let y = PAD;
    const centred = (node: Text, gap: number) => {
      node.anchor.set(0.5, 0);
      node.position.set(cx, y);
      y += node.height + gap;
      parts.push(node);
    };

    const timed = this.setup.seconds;
    centred(
      new Text({
        text: timed === null ? t('fairCopy.card.title') : t('fairCopy.card.timeUp'),
        style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 50, fontWeight: '700', fill: COLORS.ink },
      }),
      2,
    );
    const passage = this.setup.spans[0]?.passage;
    centred(
      new Text({
        text:
          timed !== null
            ? t('fairCopy.card.timedSource', { seconds: timed, chars: formatNumber(r.typed) })
            : passage
              ? t('fairCopy.source', { title: passage.title, author: passage.author })
              : '',
        style: { fontFamily: TEXT_FONT, fontSize: 17, fontStyle: 'italic', fill: COLORS.inkLight },
      }),
      14,
    );

    // The headline number, big, and what mistakes left in cost.
    centred(
      new Text({
        text: t('fairCopy.card.speed', { wpm: formatNumber(Math.round(r.netWpm)) }),
        style: { fontFamily: TEXT_FONT, fontSize: 44, fontWeight: '700', fill: COLORS.ink },
      }),
      r.mistakesLeft > 0 ? 0 : 14,
    );
    if (r.mistakesLeft > 0) {
      centred(
        new Text({
          text: tCount('fairCopy.card.penalty', r.mistakesLeft, {
            lost: formatNumber(Math.round(r.penaltyWpm)),
            count: formatNumber(r.mistakesLeft),
          }),
          style: { fontFamily: TEXT_FONT, fontSize: 16, fontWeight: '700', fill: COLORS.margin },
        }),
        14,
      );
    }

    // A new best gets a highlighter pill, like news on the game's cards; otherwise the best to beat, quietly.
    const record = this.record;
    if (record?.isNew) {
      const label = new Text({
        text:
          record.previous === null
            ? t('fairCopy.card.firstBest')
            : t('fairCopy.card.newBest', { previous: formatNumber(Math.round(record.previous)) }),
        style: { fontFamily: TEXT_FONT, fontSize: 15, fontWeight: '600', fill: COLORS.ink },
      });
      label.anchor.set(0.5);
      const pw = label.width + 24;
      const ph = 30;
      const pill = new Container();
      pill.addChild(new Graphics().roundRect(-pw / 2, 0, pw, ph, ph / 2).fill(COLORS.highlighter), label);
      label.position.set(0, ph / 2);
      pill.position.set(cx, y);
      parts.push(pill);
      y += ph + 14;
    } else if (record?.previous != null) {
      centred(
        new Text({
          text: t('fairCopy.card.best', { wpm: formatNumber(Math.round(record.previous)) }),
          style: { fontFamily: TEXT_FONT, fontSize: 16, fill: COLORS.inkLight },
        }),
        14,
      );
    }

    const tile = (key: string, value: string) => ({ label: t(`fairCopy.tile.${key}` as MessageKey), value });
    const tiles = [
      tile('raw', formatNumber(Math.round(r.rawWpm))),
      tile('accuracy', `${formatNumber(Math.round(r.accuracy * 100))}%`),
      tile('time', formatClock(r.ms)),
      tile('left', formatNumber(r.mistakesLeft)),
      tile('bestRun', formatNumber(r.bestStreak)),
    ];
    const gap = 10;
    const w = (CARD_WIDTH - PAD * 2 - gap * (tiles.length - 1)) / tiles.length;
    const h = 62;
    tiles.forEach((tl, i) => {
      const box = new Container();
      box.position.set(cx - (CARD_WIDTH - PAD * 2) / 2 + i * (w + gap), y);
      const label = new Text({ text: tl.label.toUpperCase(), style: { fontFamily: TEXT_FONT, fontSize: 11, fontWeight: '700', letterSpacing: 1, fill: COLORS.inkLight } });
      label.anchor.set(0.5, 0);
      label.position.set(w / 2, 9);
      if (label.width > w - 8) label.scale.set((w - 8) / label.width);
      const value = new Text({ text: tl.value, style: { fontFamily: TEXT_FONT, fontSize: 24, fontWeight: '700', fill: COLORS.ink } });
      value.anchor.set(0.5, 0);
      value.position.set(w / 2, 26);
      box.addChild(new Graphics().roundRect(0, 0, w, h, 10).stroke({ width: 2, color: COLORS.ink }), label, value);
      parts.push(box);
    });
    y += h + 18;

    if (r.slowestKeys.length > 0) {
      const row = new Container();
      const label = new Text({ text: t('fairCopy.slowestKeys'), style: { fontFamily: TEXT_FONT, fontSize: 17, fill: COLORS.inkLight } });
      label.anchor.set(0, 0.5);
      const items: Container[] = [label];
      for (const { key, averageMs } of r.slowestKeys) {
        const item = new Container();
        const glyphText = new Text({ text: keyLabel(key), style: { fontFamily: TEXT_FONT, fontSize: 22, fontWeight: '700', fill: COLORS.ink } });
        glyphText.anchor.set(0.5);
        const rx = Math.max(18, glyphText.width / 2 + 12);
        const ms = new Text({ text: t('fairCopy.keyMs', { ms: formatNumber(Math.round(averageMs)) }), style: { fontFamily: TEXT_FONT, fontSize: 12, fill: COLORS.pencil } });
        ms.anchor.set(0.5, 0);
        ms.y = 20;
        item.addChild(new Graphics().ellipse(0, 0, rx, 18).stroke({ width: 2.5, color: COLORS.margin }), glyphText, ms);
        items.push(item);
      }
      const spacing = 22;
      const widths = items.map((item) => item.width);
      let x = -(widths.reduce((s, v) => s + v, 0) + spacing * (items.length - 1)) / 2;
      items.forEach((item, i) => {
        item.position.set(i === 0 ? x : x + widths[i]! / 2, 20);
        x += widths[i]! + spacing;
        row.addChild(item);
      });
      row.position.set(cx, y);
      parts.push(row);
      y += 62;
    }

    // Accuracy alone grades it: mistakes left in already cost speed.
    const grade = pageGrade({ correct: r.correct, errors: r.errors, leaks: 0 }, 0);
    const [slowest] = r.slowestKeys;
    const note =
      grade === 'A+' && r.mistakesLeft === 0 ? t('fairCopy.note.neat') : r.mistakesLeft > 2 ? t('fairCopy.note.leftIn') : slowest ? t('fairCopy.note.slowKey', { key: keyLabel(slowest.key) }) : t('fairCopy.note.good');
    centred(new Text({ text: note, style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 28, fontWeight: '700', fill: COLORS.margin } }), 10);
    // Enter goes on; the links below say so and can be clicked, like the game's cards.
    const prompt = new Text({ text: t('fairCopy.result.prompt'), style: { fontFamily: TEXT_FONT, fontSize: 18, fontWeight: '700', fill: COLORS.margin } });
    prompt.eventMode = 'static';
    prompt.cursor = 'pointer';
    prompt.on('pointertap', () => this.actions.onNext());
    centred(prompt, 10);
    const links = [
      { label: t('fairCopy.link.again'), act: () => this.actions.onAgain() },
      { label: t('fairCopy.link.menu'), act: () => this.actions.onMenu() },
    ].map(({ label, act }) => {
      const link = new Text({ text: label, style: { fontFamily: TEXT_FONT, fontSize: 17, fontWeight: '600', fontStyle: 'italic', fill: COLORS.inkLight } });
      link.eventMode = 'static';
      link.cursor = 'pointer';
      link.on('pointertap', act);
      return link;
    });
    const linkGap = 30;
    let lx = cx - (links.reduce((sum, l) => sum + l.width, 0) + linkGap * (links.length - 1)) / 2;
    for (const link of links) {
      link.position.set(lx, y);
      lx += link.width + linkGap;
      parts.push(link);
    }
    y += (links[0]?.height ?? 0) + PAD;

    const top = (WORLD_HEIGHT - y) / 2;
    const left = (WORLD_WIDTH - CARD_WIDTH) / 2;
    const bg = new Graphics()
      .roundRect(left + 6, 8, CARD_WIDTH, y, 14)
      .fill({ color: COLORS.desk, alpha: 0.25 })
      .roundRect(left, 0, CARD_WIDTH, y, 14)
      .fill(COLORS.paper)
      .stroke({ width: 2, color: COLORS.ink });
    card.addChild(bg, ...parts);
    const stamp = new Text({ text: grade, style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 80, fontWeight: '700', fill: COLORS.margin } });
    stamp.anchor.set(0.5);
    stamp.rotation = -0.18;
    stamp.position.set(left + CARD_WIDTH - 62, 52);
    card.addChild(stamp);
    // Scale about the card's centre for the pop-in.
    card.pivot.set(cx, y / 2);
    card.position.set(cx, top + y / 2);
    this.card = card;
    this.stamp = stamp;
    this.result.addChild(backdrop, card);
  }
}
