/**
 * Ink Race (M36): the passage on the page (FairCopyView, in race mode), a
 * track strip above it with every racer's ink drop heading for the finish
 * flag, a 3-2-1 countdown, and the race card once everyone's done. Reads the
 * race; never changes it.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { GAME_CONFIG } from '../core/config';
import { type FairCopy, type FairCopyEvent, type PassageSpan } from '../core/fairCopy';
import { standings, type Racer } from '../core/race';
import type { Cosmetics } from '../core/rewards';
import type { SeasonId } from '../core/seasons';
import { MARGIN_X, WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';
import { formatNumber, t, type MessageKey } from '../i18n';
import { FairCopyView, formatClock } from './fairCopyView';
import { COLORS, DISPLAY_FONT, DISPLAY_PADDING, TEXT_FONT } from './theme';
import { outCubic } from './tween';

export interface RaceLane {
  id: string;
  name: string;
  /** Ink-drop color (storage/profiles.ts Badge). */
  badge: string;
  you: boolean;
}

export interface RaceViewActions {
  /** Host only: a new race with the next passage. */
  onAgain?(): void;
  /** Host: everyone back to the lobby. Guest: leave for the lobby. */
  onLobby(): void;
}

/** Ink-drop colors, as in the menus (ui/art.ts). */
function badgeColor(badge: string): number {
  switch (badge) {
    case 'crimson':
      return COLORS.inkCrimson;
    case 'violet':
      return COLORS.inkViolet;
    case 'teal':
      return 0x1f7f86;
    case 'gold':
      return 0xc9a227;
    case 'moss':
      return 0x4f7a3a;
    default:
      return COLORS.ink;
  }
}

const LEFT = MARGIN_X + GAME_CONFIG.manuscript.insetLeft;
const RIGHT = WORLD_WIDTH - GAME_CONFIG.manuscript.insetRight;
const TRACK = GAME_CONFIG.race.track;
const LINE_START = LEFT + TRACK.nameWidth;
const LINE_END = RIGHT - 70;
const CARD_WIDTH = 560;
const PAD = 30;

class Lane {
  readonly root = new Container();
  private readonly dot = new Graphics();
  private readonly place: Text;
  private readonly name: Text;
  private shown = 0;

  constructor(
    readonly lane: RaceLane,
    y: number,
  ) {
    this.name = new Text({
      text: lane.you ? t('race.you', { name: lane.name }) : lane.name,
      style: { fontFamily: TEXT_FONT, fontSize: 17, fontWeight: lane.you ? '700' : '600', fill: COLORS.ink },
    });
    this.name.anchor.set(0, 0.5);
    if (this.name.width > TRACK.nameWidth - 12) this.name.scale.set((TRACK.nameWidth - 12) / this.name.width);
    const line = new Graphics()
      .moveTo(LINE_START, 0)
      .lineTo(LINE_END, 0)
      .stroke({ width: 2, color: COLORS.inkFaded, cap: 'round' });
    this.place = new Text({ text: '', style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 24, fontWeight: '700', fill: COLORS.margin } });
    this.place.anchor.set(0, 0.5);
    this.place.x = LINE_END + 30;
    this.name.x = LEFT;
    this.root.addChild(line, this.name, this.dot, this.place);
    this.root.y = y;
  }

  update(racer: Racer | undefined, length: number, place: number | null, frameMs: number, reducedMotion: boolean): void {
    const target = racer ? (length === 0 ? 0 : racer.at / length) : 0;
    const k = reducedMotion ? 1 : Math.min(1, frameMs / 120);
    this.shown += (target - this.shown) * k;
    const x = LINE_START + (LINE_END - LINE_START) * this.shown;
    const r = TRACK.dotRadius;
    const color = badgeColor(this.lane.badge);
    // An ink drop: a point leaning back along the line, a round body ahead.
    this.dot.clear().moveTo(x - r * 2.2, 0).lineTo(x - r * 0.4, -r * 0.85).lineTo(x - r * 0.4, r * 0.85).closePath().fill(color).circle(x, 0, r).fill(color);
    if (this.lane.you) this.dot.circle(x, 0, r + 3).stroke({ width: 2, color: COLORS.margin });
    this.root.alpha = racer?.left ? 0.4 : 1;
    this.place.text = racer?.left ? t('race.left') : place !== null ? t(`race.place${Math.min(place, 4)}` as MessageKey) : '';
  }
}

export class RaceView {
  readonly root = new Container();
  private readonly page: FairCopyView;
  private readonly lanes: Lane[];
  private readonly countdown: Text;
  private readonly waiting: Text;
  private readonly result = new Container();
  private card: Container | null = null;
  private cardMs = 0;

  constructor(
    text: string,
    spans: readonly PassageSpan[],
    private readonly laneInfo: readonly RaceLane[],
    setup: { cosmetics: Cosmetics; season: SeasonId | null },
    private readonly reducedMotion: boolean,
    private readonly isHost: boolean,
    private readonly actions: RaceViewActions,
  ) {
    const noop = () => {};
    this.page = new FairCopyView(text, { spans, seconds: null, cosmetics: setup.cosmetics, season: setup.season, race: true }, reducedMotion, {
      onNext: noop,
      onAgain: noop,
      onMenu: noop,
    });
    const track = new Container();
    const flagX = LINE_END + 12;
    const top = TRACK.top;
    const flag = new Graphics()
      .moveTo(flagX, top - 12)
      .lineTo(flagX, top + TRACK.laneHeight * (laneInfo.length - 1) + 12)
      .stroke({ width: 2.5, color: COLORS.ink })
      .rect(flagX, top - 12, 14, 10)
      .fill(COLORS.margin);
    this.lanes = laneInfo.map((lane, i) => new Lane(lane, top + i * TRACK.laneHeight));
    track.addChild(flag, ...this.lanes.map((l) => l.root));

    this.countdown = new Text({ text: '', style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 140, fontWeight: '700', fill: COLORS.margin } });
    this.countdown.anchor.set(0.5);
    this.countdown.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 40);
    this.waiting = new Text({ text: '', style: { fontFamily: TEXT_FONT, fontSize: 16, fill: COLORS.inkLight } });
    this.waiting.anchor.set(0.5, 1);
    this.waiting.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT - 8);
    this.root.addChild(this.page.root, track, this.countdown, this.waiting, this.result);
  }

  react(test: FairCopy, events: FairCopyEvent[]): void {
    this.page.react(test, events);
  }

  /**
   * @param now performance.now(), for the page.
   * @param untilStart ms until "Go" (negative once started).
   */
  sync(test: FairCopy, now: number, untilStart: number, frameMs: number, racers: readonly Racer[], length: number, over: boolean): void {
    this.page.sync(test, now, frameMs);
    const order = standings({ passageId: '', lang: 'en', length, startAt: 0, racers: [...racers] }).filter((r) => r.result);
    for (const lane of this.lanes) {
      const racer = racers.find((r) => r.id === lane.lane.id);
      const place = racer?.result ? order.indexOf(racer) + 1 : null;
      lane.update(racer, length, place, frameMs, this.reducedMotion);
    }

    // 3, 2, 1, then "Go!" for a moment.
    if (untilStart > 0) {
      this.countdown.text = String(Math.ceil(untilStart / 1000));
      this.countdown.alpha = 1;
      this.countdown.scale.set(this.reducedMotion ? 1 : 1 + 0.25 * ((untilStart % 1000) / 1000));
    } else if (untilStart > -700) {
      this.countdown.text = t('race.go');
      this.countdown.alpha = this.reducedMotion ? 1 : 1 + untilStart / 700;
      this.countdown.scale.set(1);
    } else {
      this.countdown.text = '';
    }

    const done = test.finishedAt !== null;
    this.waiting.text = untilStart > 0 ? t('race.getReady') : done && !over ? t('race.waitingForOthers') : over ? '' : t('race.footer');

    if (over) {
      if (!this.card) this.buildCard(racers, length);
      this.cardMs += frameMs;
      const pop = this.reducedMotion ? 1 : outCubic(Math.min(1, this.cardMs / 260));
      this.card!.alpha = pop;
      this.card!.scale.set(0.92 + 0.08 * pop);
    }
  }

  private buildCard(racers: readonly Racer[], length: number): void {
    const backdrop = new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: COLORS.desk, alpha: 0.35 });
    const card = new Container();
    const cx = WORLD_WIDTH / 2;
    const left = (WORLD_WIDTH - CARD_WIDTH) / 2;
    const parts: Container[] = [];
    let y = PAD;
    const title = new Text({ text: t('race.card.title'), style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 50, fontWeight: '700', fill: COLORS.ink } });
    title.anchor.set(0.5, 0);
    title.position.set(cx, y);
    parts.push(title);
    y += title.height + 12;

    const ranked = standings({ passageId: '', lang: 'en', length, startAt: 0, racers: [...racers] });
    ranked.forEach((racer, i) => {
      const lane = this.laneInfo.find((l) => l.id === racer.id);
      if (!lane) return;
      const row = new Container();
      const h = 44;
      const place = new Text({
        text: racer.result ? t(`race.place${Math.min(i + 1, 4)}` as MessageKey) : '–',
        style: { fontFamily: DISPLAY_FONT, padding: DISPLAY_PADDING, fontSize: 30, fontWeight: '700', fill: i === 0 && racer.result ? COLORS.margin : COLORS.ink },
      });
      place.anchor.set(0, 0.5);
      place.position.set(left + PAD, h / 2);
      const dot = new Graphics().circle(left + PAD + 70, h / 2, 9).fill(badgeColor(lane.badge));
      const name = new Text({
        text: lane.you ? t('race.you', { name: lane.name }) : lane.name,
        style: { fontFamily: TEXT_FONT, fontSize: 19, fontWeight: lane.you ? '700' : '600', fill: COLORS.ink },
      });
      name.anchor.set(0, 0.5);
      name.position.set(left + PAD + 88, h / 2);
      const r = racer.result;
      const stats = new Text({
        text: r
          ? t('race.card.stats', { wpm: formatNumber(Math.round(r.netWpm)), accuracy: formatNumber(Math.round(r.accuracy * 100)), time: formatClock(r.ms) })
          : racer.left
            ? t('race.left')
            : t('race.card.unfinished', { percent: formatNumber(Math.round((racer.at / Math.max(1, length)) * 100)) }),
        style: { fontFamily: TEXT_FONT, fontSize: 16, fill: COLORS.inkLight },
      });
      stats.anchor.set(1, 0.5);
      stats.position.set(left + CARD_WIDTH - PAD, h / 2);
      const rule = new Graphics().moveTo(left + PAD, h).lineTo(left + CARD_WIDTH - PAD, h).stroke({ width: 1, color: COLORS.rule });
      row.addChild(rule, place, dot, name, stats);
      row.y = y;
      parts.push(row);
      y += h;
    });
    y += 18;

    const links = (this.isHost
      ? [
          { label: t('race.card.again'), act: () => this.actions.onAgain?.() },
          { label: t('race.card.lobby'), act: () => this.actions.onLobby() },
        ]
      : [{ label: t('race.card.leave'), act: () => this.actions.onLobby() }]
    ).map(({ label, act }, i) => {
      const link = new Text({
        text: label,
        style: { fontFamily: TEXT_FONT, fontSize: 18, fontWeight: '700', fontStyle: i === 0 && this.isHost ? 'normal' : 'italic', fill: i === 0 && this.isHost ? COLORS.margin : COLORS.inkLight },
      });
      link.eventMode = 'static';
      link.cursor = 'pointer';
      link.on('pointertap', act);
      return link;
    });
    const gap = 30;
    let lx = cx - (links.reduce((sum, l) => sum + l.width, 0) + gap * (links.length - 1)) / 2;
    for (const link of links) {
      link.position.set(lx, y);
      lx += link.width + gap;
      parts.push(link);
    }
    y += (links[0]?.height ?? 0) + 8;
    if (!this.isHost) {
      const note = new Text({ text: t('race.card.waitingForHost'), style: { fontFamily: TEXT_FONT, fontSize: 15, fill: COLORS.pencil } });
      note.anchor.set(0.5, 0);
      note.position.set(cx, y);
      parts.push(note);
      y += note.height + 4;
    }
    y += PAD - 8;

    const bg = new Graphics()
      .roundRect(left + 6, 8, CARD_WIDTH, y, 14)
      .fill({ color: COLORS.desk, alpha: 0.25 })
      .roundRect(left, 0, CARD_WIDTH, y, 14)
      .fill(COLORS.paper)
      .stroke({ width: 2, color: COLORS.ink });
    card.addChild(bg, ...parts);
    card.pivot.set(cx, y / 2);
    card.position.set(cx, (WORLD_HEIGHT - y) / 2 + y / 2);
    this.card = card;
    this.result.addChild(backdrop, card);
  }
}
