/**
 * Ink Race (M36), on the game's own canvas, like Fair Copy: while a race is
 * open it owns the keyboard (main.ts suspends the game's handler).
 *
 * The player types with Fair Copy's rules plus `mustFix`. Keys before "Go"
 * are ignored. Progress goes out every `GAME_CONFIG.race.progressIntervalMs`;
 * the finish goes out once. Standings come back from the host (or, for the
 * host, from its own HostGame) through `setStandings`.
 */
import type { Application } from 'pixi.js';
import { Container } from 'pixi.js';
import { GAME_CONFIG } from './core/config';
import { backspace, correctPrefix, createFairCopy, fairCopyResult, isFinished, typeKey, type FairCopy, type FairCopyEvent, type Passage } from './core/fairCopy';
import type { Racer, RacerResult } from './core/race';
import { standings } from './core/race';
import type { Cosmetics } from './core/rewards';
import type { SeasonId } from './core/seasons';
import { WORLD_HEIGHT, WORLD_WIDTH } from './core/world';
import { formatNumber, t } from './i18n';
import { bindKeyboard } from './input/keyboard';
import { clockNow } from './net/host';
import { RaceView, type RaceLane } from './render/raceView';
import { formatClock } from './render/fairCopyView';

export interface RaceSessionOptions {
  passage: Passage;
  lanes: RaceLane[];
  /** This player's id in the race. */
  you: string;
  /** "Go", on this device's clock (clockNow). */
  startAt: number;
  /** Accents not on this player's keyboard can be typed plainly (core/race.ts needsForgiving). */
  forgiving: boolean;
  isHost: boolean;
  reducedMotion: boolean;
  cosmetics: Cosmetics;
  season: SeasonId | null;
  sendProgress(at: number): void;
  sendFinish(result: RacerResult): void;
  /** Host: a new race. */
  onAgain?(): void;
  /** Esc, or the card's lobby link: host takes everyone to the lobby; a guest leaves for it. */
  onLobby(): void;
  announce(text: string): void;
  onEvents?(events: readonly FairCopyEvent[]): void;
}

export class RaceSession {
  private readonly root = new Container();
  private readonly test: FairCopy;
  private readonly view: RaceView;
  private readonly unbind: () => void;
  private racers: Racer[];
  private over = false;
  private sentAt = 0;
  private lastSent = -1;
  private wentGo = false;
  private overAt = 0;
  private readonly length: number;
  private readonly fit = () => {
    const { width, height } = this.app.screen;
    const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
    this.root.scale.set(scale);
    this.root.position.set((width - WORLD_WIDTH * scale) / 2, (height - WORLD_HEIGHT * scale) / 2);
  };

  constructor(
    private readonly app: Application,
    private readonly options: RaceSessionOptions,
  ) {
    const text = options.passage.text;
    this.length = [...text].length;
    this.test = createFairCopy(text, null, { mustFix: true, forgiving: options.forgiving });
    this.racers = options.lanes.map((l) => ({ id: l.id, at: 0, result: null, left: false }));
    this.view = new RaceView(
      text,
      [{ start: 0, passage: options.passage }],
      options.lanes,
      { cosmetics: options.cosmetics, season: options.season },
      options.reducedMotion,
      options.isHost,
      { onAgain: options.onAgain, onLobby: options.onLobby },
    );
    this.root.addChild(this.view.root);
    app.stage.addChild(this.root);
    this.fit();
    app.renderer.on('resize', this.fit);

    let ready = false;
    setTimeout(() => (ready = true), 0);
    this.unbind = bindKeyboard(
      window,
      {
        onChar: (char) => {
          if (!this.started() || isFinished(this.test)) return;
          this.react(typeKey(this.test, char, performance.now()));
        },
        onConfirm: () => {
          // Passages have no line breaks, so Enter only acts on the race card.
          if (this.over && this.cardReady()) options.onAgain?.();
        },
        onPause: () => options.onLobby(),
        onSpecial: (key) => {
          if (key === 'Backspace' && this.started() && !isFinished(this.test)) this.react(backspace(this.test, performance.now()));
          return true;
        },
      },
      () => !ready,
    );
  }

  /** The latest standings, from the host. */
  setStandings(racers: readonly Racer[], over: boolean): void {
    // Our own progress is shown from our own typing, which is newer.
    this.racers = racers.map((r) => (r.id === this.options.you && !r.result ? { ...r, at: correctPrefix(this.test) } : r));
    if (over && !this.over) {
      this.over = true;
      this.overAt = performance.now();
      const winner = standings({ passageId: '', lang: 'en', length: this.length, startAt: 0, racers: [...this.racers] }).find((r) => r.result);
      const name = this.options.lanes.find((l) => l.id === winner?.id)?.name;
      if (name) this.options.announce(t('race.announceOver', { winner: name }));
    }
  }

  update(frameMs: number): void {
    const now = performance.now();
    const untilStart = this.options.startAt - clockNow();
    if (untilStart <= 0 && !this.wentGo) {
      this.wentGo = true;
      this.options.announce(t('race.announceGo'));
    }
    // Progress out, at most every interval and only when it changed.
    const at = correctPrefix(this.test);
    if (this.started() && !isFinished(this.test) && at !== this.lastSent && now - this.sentAt >= GAME_CONFIG.race.progressIntervalMs) {
      this.sentAt = now;
      this.lastSent = at;
      this.options.sendProgress(at);
    }
    const mine = this.racers.map((r) => (r.id === this.options.you && !r.result ? { ...r, at } : r));
    this.view.sync(this.test, now, untilStart, frameMs, mine, this.length, this.over);
  }

  destroy(): void {
    this.unbind();
    this.app.renderer.off('resize', this.fit);
    this.root.destroy({ children: true });
  }

  /** Dev helpers (main.ts exposes them in development): type as if at `msPerKey`. */
  devHelpers() {
    return {
      play: (keys: string, msPerKey = 200) => {
        let now = performance.now() - keys.length * msPerKey;
        for (const ch of keys) this.react(ch === '\b' ? backspace(this.test, (now += msPerKey)) : typeKey(this.test, ch, (now += msPerKey)));
      },
      test: () => this.test,
    };
  }

  private started(): boolean {
    return clockNow() >= this.options.startAt;
  }

  private cardReady(): boolean {
    return performance.now() - this.overAt >= GAME_CONFIG.menu.shortcutDelayMs;
  }

  private react(events: FairCopyEvent[]): void {
    if (events.length === 0) return;
    this.view.react(this.test, events);
    this.options.onEvents?.(events);
    if (events.includes('finished')) {
      // Timed from "Go", on this device's clock, so a clock offset can't change who won.
      const ms = Math.max(1, clockNow() - this.options.startAt);
      const r = fairCopyResult(this.test, performance.now());
      const netWpm = (this.length / 5) / (ms / 60000);
      const result: RacerResult = { ms, netWpm, accuracy: r.accuracy, errors: r.errors };
      this.options.sendFinish(result);
      this.options.announce(t('race.announceFinish', { time: formatClock(ms), wpm: formatNumber(Math.round(netWpm)) }));
    }
  }
}
