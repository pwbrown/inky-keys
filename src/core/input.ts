/**
 * Turns player intent (characters typed, confirm, pause) into game state
 * changes. Pure: the DOM listener lives in src/input/keyboard.ts.
 *
 * Two input models (REQUIREMENTS §3):
 * - Match mode, for Drips and Scrawlers: each key must be the next character.
 * - Buffer mode, for Run-ons: keys edit a buffer, so mistakes stay until
 *   fixed with Backspace.
 */
import { abilityCost, chargeKeys, eraserKeys, type ActiveAbility } from './abilities';
import { APPRENTICE_CHAPTERS } from './campaign';
import { DIFFICULTIES, GAME_CONFIG, mistakeInk, streakKeys, type Difficulty } from './config';
import { applyEdit, correctPrefix, isTextEdit, type EditAction } from './editing';
import { canStart, onBossPartDone } from './bosses';
import { applyBriefings } from './mechanics';
import { createStats, earnPoints, type Stats } from './stats';
import { charAt, charCount } from './text';
import { isAccented, plainLetter } from './accents';
import {
  REVEALED_X,
  WORLD_WIDTH,
  beginPage,
  createPage,
  isBufferKind,
  isLastPageOfChapter,
  isRevealed,
  markPageStart,
  nextLife,
  pageFor,
  restoreInk,
  splitBoss,
  resetWorld,
  setPhase,
  type StartSnapshot,
  type Target,
  type World,
  useApprenticeKeys,
} from './world';

/** Current score multiplier for a combo length. */
export function multiplier(combo: number): number {
  const { step, maxMultiplier } = GAME_CONFIG.combo;
  return Math.min(maxMultiplier, 1 + Math.floor(combo / step));
}

/** Targets that have entered the visible page and can be typed at. */
function visibleTargets(world: World): Target[] {
  return world.targets.filter((t) => t.x < WORLD_WIDTH);
}

/** The visible target closest to the margin, i.e. the most urgent one. */
function mostUrgent(targets: Target[]): Target | undefined {
  let best: Target | undefined;
  for (const t of targets) if (!best || t.x < best.x) best = t;
  return best;
}

function bothStats(world: World, fn: (s: Stats) => void): void {
  fn(world.stats);
  fn(world.pageStats);
}

function registerError(world: World, key: string, target: Target | undefined, expectedChar?: string | null): void {
  // Just after the Eraser rubbed a slip out, the next few wrong keys (typed
  // before the player noticed) are ignored: no cost, nothing counted.
  if (world.eraserGraceMs > 0) return;
  // Which character the player *should* have typed: given by the caller, or
  // the locked target's next character, or the most urgent target's.
  const intended = target ?? mostUrgent(visibleTargets(world));
  const expected = expectedChar === undefined ? (intended ? charAt(intended.text, intended.typed) : undefined) : (expectedChar ?? undefined);
  // A miss on an accented letter: that creature shows the keys for it.
  if (intended && expected !== undefined && isAccented(expected)) world.accentHint = { targetId: intended.id, char: expected, key };

  // An armed Eraser rubs the slip out: no cost, and the run carries on. The
  // key is still noted, so practice keeps focusing on it.
  if (world.eraser) {
    world.eraser = false;
    world.eraserRun = 0;
    world.eraserGraceMs = GAME_CONFIG.abilities.eraser.graceMs;
    if (expected !== undefined) bothStats(world, (s) => (s.missedKeys[expected] = (s.missedKeys[expected] ?? 0) + 1));
    world.events.push({ type: 'eraserUsed', key, targetId: target?.id ?? null });
    return;
  }

  const run = world.stats.combo;
  if (run >= GAME_CONFIG.combo.step) world.events.push({ type: 'comboBroken', was: run });
  // What it costs (GAME_CONFIG.mistakes): points, and later on a little ink.
  const m = GAME_CONFIG.mistakes;
  const pointsLost = Math.min(world.stats.score, m.points);
  const inkCost = mistakeInk(world.difficulty, world.page.chapter, world.mode === 'apprentice' || world.mode === 'accents');
  const inkLost = Math.max(0, Math.min(inkCost, world.ink - m.minInk));
  world.ink -= inkLost;
  world.cleanRun = 0;
  world.chargeRun = 0;
  world.eraserRun = 0;
  bothStats(world, (s) => {
    s.errors++;
    s.combo = 0;
    const lost = Math.min(s.score, m.points);
    s.score -= lost;
    s.penalty += lost;
    if (expected !== undefined) s.missedKeys[expected] = (s.missedKeys[expected] ?? 0) + 1;
  });
  world.events.push({ type: 'error', key, targetId: target?.id ?? null, pointsLost, inkLost });
}

/** Credit a correct keystroke. */
function registerHit(world: World, key: string): void {
  bothStats(world, (s) => {
    s.correct++;
    s.hitKeys[key] = (s.hitKeys[key] ?? 0) + 1;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    earnPoints(s, GAME_CONFIG.points.perChar, multiplier(s.combo), pointsFactor(world));
  });
  // A clean run of keys wins a little ink back.
  world.cleanRun++;
  if (world.cleanRun >= streakKeys(world.page.chapter)) {
    world.cleanRun = 0;
    restoreInk(world, GAME_CONFIG.recovery.streak.ink, 'streak');
  }
  const mult = multiplier(world.stats.combo);
  if (mult > multiplier(world.stats.combo - 1)) world.events.push({ type: 'comboStep', multiplier: mult });
  // A long clean run earns an ability charge; the run needed grows with the chapter.
  const { abilities, page } = world;
  if (abilities.some((id) => id === 'blotter' || id === 'paperweight' || id === 'highlighter')) {
    world.chargeRun++;
    if (world.chargeRun >= chargeKeys(page.chapter, world.difficulty)) {
      world.chargeRun = 0;
      if (world.charges < GAME_CONFIG.abilities.maxCharges) {
        world.charges++;
        world.events.push({ type: 'charged', charges: world.charges });
      }
    }
  }
  // …and re-arms the Eraser.
  if (abilities.includes('eraser') && !world.eraser) {
    world.eraserRun++;
    if (world.eraserRun >= eraserKeys(page.chapter)) {
      world.eraserRun = 0;
      world.eraser = true;
      world.events.push({ type: 'passiveReady', id: 'eraser' });
    }
  }
}

/** Points are doubled while the Highlighter is on. */
function pointsFactor(world: World): number {
  return world.highlightMs > 0 ? GAME_CONFIG.abilities.highlighter.pointsFactor : 1;
}

/**
 * Fire an active ability, if it's unlocked and there are charges to pay for
 * it. Returns whether it fired.
 * - Blotter: blot every creature on the page except the Spill (and ink
 *   bottles), for a share of their points.
 * - Paperweight: everything crawls for a few seconds.
 * - Highlighter: ghost text shows and points are doubled for a few seconds.
 */
export function useAbility(world: World, id: ActiveAbility): boolean {
  if (world.phase !== 'playing' || !world.abilities.includes(id)) return false;
  const cost = abilityCost(id, world.difficulty);
  if (world.charges < cost) return false;
  const config = GAME_CONFIG.abilities;

  if (id === 'paperweight') {
    if (world.slowMs > 0) return false;
    world.slowMs = config.paperweight.durationMs;
  } else if (id === 'highlighter') {
    if (world.highlightMs > 0) return false;
    world.highlightMs = config.highlighter.durationMs;
    for (const target of world.targets) if (target.ghost) target.revealX = REVEALED_X;
  } else {
    const victims = visibleTargets(world).filter((t) => !t.boss && !t.bottle);
    if (victims.length === 0) return false;
    world.charges -= cost;
    world.events.push({ type: 'ability', id });
    const { perChar, perTarget } = GAME_CONFIG.points;
    for (const target of victims) {
      const points = Math.round((perTarget + perChar * [...target.text].length) * config.blotter.pointsShare);
      bothStats(world, (s) => {
        earnPoints(s, points);
        s.destroyed++;
      });
      world.events.push({ type: 'destroyed', target, points, blotted: true });
    }
    world.targets = world.targets.filter((t) => !victims.includes(t));
    if (!world.targets.some((t) => t.id === world.lockedId)) world.lockedId = null;
    return true;
  }
  world.charges -= cost;
  world.events.push({ type: 'ability', id });
  return true;
}

/** Enter while playing: the Blotter. */
export function useBlotter(world: World): boolean {
  return useAbility(world, 'blotter');
}

/**
 * A target's text was completed: award the completion bonus, then either
 * remove it or, for crimson/violet creatures with lives left, give it its
 * next payload and keep the lock so the player types straight on.
 */
function destroyTarget(world: World, target: Target, scoreBefore: number): void {
  bothStats(world, (s) => {
    earnPoints(s, GAME_CONFIG.points.perTarget, multiplier(s.combo), pointsFactor(world));
  });
  if (target.lives > 1) {
    nextLife(world, target);
    // Let go between words, so the player can switch to another creature
    // (typing this one's next first letter picks it up again).
    world.lockedId = null;
    world.events.push({ type: 'hit', target, points: world.stats.score - scoreBefore });
    return;
  }
  world.targets = world.targets.filter((t) => t !== target);
  world.lockedId = null;
  bothStats(world, (s) => {
    s.destroyed++;
  });
  if (target.boss) onBossPartDone(world, target, () => splitBoss(world, target));
  if (target.bottle) restoreInk(world, GAME_CONFIG.recovery.bottle.ink, 'bottle', target);
  // Points from the finishing keystroke plus the completion bonus.
  world.events.push({ type: 'destroyed', target, points: world.stats.score - scoreBefore });
}

function lock(world: World, target: Target): void {
  if (world.lockedId === target.id) return;
  world.lockedId = target.id;
  world.events.push({ type: 'locked', targetId: target.id });
}

/**
 * The character a key stands for, given what's expected next: with
 * Forgiving accents on, a plain letter counts for its accented one (e for é).
 */
function forgiven(world: World, key: string, expected: string | undefined): string {
  return world.forgivingAccents && expected !== undefined && expected !== key && plainLetter(expected) === key ? expected : key;
}

/** The character a Run-on expects next, if everything typed so far is right. */
function bufferExpects(target: Target): string | undefined {
  const before = target.buffer ?? '';
  const prefix = correctPrefix(before, target.text);
  return prefix === [...before].length ? charAt(target.text, prefix) : undefined;
}

/** Can this keystroke start on a target that isn't locked yet? */
function startsWith(world: World, target: Target, key: string): boolean {
  // Ghost text can't be typed before it shows, and some boss parts must wait their turn.
  if (!isRevealed(target) || !canStart(world, target)) return false;
  const first = charAt(target.text, target.kind === 'runon' ? 0 : target.typed);
  if (target.kind === 'runon') return target.buffer === '' && forgiven(world, key, first) === first;
  return forgiven(world, key, first) === first;
}

/**
 * Apply an edit to a Run-on and score it: typing the next character is
 * correct; anything else is a mistake that stays in the buffer until
 * Backspace removes it.
 */
function editBuffer(world: World, target: Target, action: EditAction): void {
  const scoreBefore = world.stats.score;
  const before = target.buffer ?? '';
  // Run-ons are typed left to right: the cursor stays at the end.
  if (target.kind === 'runon' && !isTextEdit(action)) return;
  if (target.kind === 'runon' && action.type === 'delete') return;

  // During the Eraser's grace a wrong letter isn't even written into the Run-on.
  if (world.eraserGraceMs > 0 && action.type === 'insert') {
    const prefix = correctPrefix(before, target.text);
    if (prefix !== [...before].length || [...target.text][prefix] !== action.char) return;
  }
  const next = applyEdit({ buffer: before, cursor: target.cursor ?? [...before].length }, action);
  target.buffer = next.buffer;
  target.cursor = next.cursor;
  target.typed = correctPrefix(next.buffer, target.text);

  if (!isTextEdit(action) || next.buffer === before) {
    world.events.push({ type: 'progress', targetId: target.id, shot: false });
    return;
  }

  const char = action.type === 'insert' ? action.char : null;
  const prefix = correctPrefix(before, target.text);
  const expected = [...target.text][prefix] ?? null;
  // Backspacing over a mistake is the right move; erasing correct text isn't scored.
  const correct = action.type === 'insert' ? prefix === [...before].length && char === expected : prefix < [...before].length;

  if (correct) {
    if (char) registerHit(world, char);
    else
      bothStats(world, (s) => {
        earnPoints(s, GAME_CONFIG.points.perChar, multiplier(s.combo), pointsFactor(world));
      });
  } else if (action.type === 'insert') {
    registerError(world, char ?? action.type, target, expected);
  }

  if (next.buffer === target.text) destroyTarget(world, target, scoreBefore);
  else world.events.push({ type: 'progress', targetId: target.id, shot: correct && char !== null });
}

/** The target an edit key (Backspace…) applies to: the locked Run-on, if any. */
function editTarget(world: World): Target | undefined {
  const locked = world.targets.find((t) => t.id === world.lockedId);
  return locked && isBufferKind(locked.kind) ? locked : undefined;
}

/**
 * A dead key was pressed: its accent waits for the next key (which the
 * browser combines it with). Nothing is typed yet, so it's never a mistake.
 */
export function pressDeadKey(world: World, mark: string | null): void {
  world.pendingAccent = world.phase === 'playing' ? mark : null;
}

/** Handle one typed character. */
export function typeChar(world: World, key: string): void {
  world.pendingAccent = null;
  if (world.phase === 'ready') {
    // Number keys pick a difficulty on the new-notebook screen.
    const choice = DIFFICULTIES[Number(key) - 1];
    if (choice) selectDifficulty(world, choice);
    return;
  }
  if (world.phase !== 'playing') return;
  const scoreBefore = world.stats.score;

  let target = world.targets.find((t) => t.id === world.lockedId);

  if (!target) {
    // Lock onto the closest visible target this key can start…
    target = mostUrgent(visibleTargets(world).filter((t) => startsWith(world, t, key)));
    if (!target) {
      registerError(world, key, undefined);
      return;
    }
    lock(world, target);
  }

  if (isBufferKind(target.kind)) {
    editBuffer(world, target, { type: 'insert', char: forgiven(world, key, bufferExpects(target)) });
    return;
  }

  key = forgiven(world, key, charAt(target.text, target.typed));
  if (charAt(target.text, target.typed) !== key) {
    registerError(world, key, target);
    return;
  }

  target.typed++;
  registerHit(world, key);

  if (target.typed < charCount(target.text)) {
    world.events.push({ type: 'progress', targetId: target.id, shot: true });
    return;
  }
  destroyTarget(world, target, scoreBefore);
}

export type EditKey = 'backspace' | 'delete' | 'left' | 'right' | 'home' | 'end';

/** Backspace, Delete, arrows, Home and End while playing (buffer mode). */
export function editKey(world: World, key: EditKey): void {
  if (world.phase !== 'playing') return;
  const target = editTarget(world);
  if (!target) return;
  lock(world, target);
  editBuffer(world, target, { type: key });
}

/**
 * Tab: move the lock to the next target on the page, nearest the margin
 * first, wrapping around. Lets you leave a target you locked by mistake.
 */
export function cycleLock(world: World): void {
  if (world.phase !== 'playing') return;
  const order = visibleTargets(world)
    .filter((t) => isRevealed(t) && canStart(world, t))
    .sort((a, b) => a.x - b.x);
  if (order.length === 0) return;
  const i = order.findIndex((t) => t.id === world.lockedId);
  lock(world, order[(i + 1) % order.length]!);
}

/** Highlight a difficulty on the new-notebook screen. */
export function selectDifficulty(world: World, difficulty: Difficulty): void {
  if (world.phase === 'ready') world.selectedDifficulty = difficulty;
}

/** Arrow keys on the new-notebook screen: move the highlight, wrapping around. */
export function moveSelection(world: World, delta: number): void {
  if (world.phase !== 'ready') return;
  const i = DIFFICULTIES.indexOf(world.selectedDifficulty);
  const n = DIFFICULTIES.length;
  world.selectedDifficulty = DIFFICULTIES[(((i + delta) % n) + n) % n] ?? world.selectedDifficulty;
}

/** Move on from a cleared page: the next page, or the next chapter's first page. */
function turnPage(world: World): void {
  const { chapter, index } = world.page;
  const newChapter = isLastPageOfChapter(world.page);
  // A new Apprentice chapter brings its new keys.
  if (newChapter && world.mode === 'apprentice') useApprenticeKeys(world, chapter + 1);
  world.page = newChapter ? pageFor(world, chapter + 1, 0) : pageFor(world, chapter, index + 1);
  world.pageStats = createStats();
  world.inkRefilled = 0;
  world.shieldEarned = false;
}

/** True when the page just cleared was the last page of the last Apprentice chapter. */
export function finishedNotebook(world: World): boolean {
  if (world.mode === 'daily' || world.mode === 'accents') return isLastPageOfChapter(world.page);
  return (
    world.mode === 'apprentice' && isLastPageOfChapter(world.page) && world.page.chapter >= APPRENTICE_CHAPTERS - 1
  );
}

/**
 * Start (or replay) an Apprentice chapter: its keys, its first page, and the
 * card introducing its new keys.
 */
export function startApprentice(world: World, chapter: number, difficulty: Difficulty = world.selectedDifficulty): void {
  resetWorld(world, difficulty);
  world.mode = 'apprentice';
  const ch = Math.max(0, Math.min(chapter, APPRENTICE_CHAPTERS - 1));
  useApprenticeKeys(world, ch);
  world.page = createPage(difficulty, ch, 0, world.content, 'apprentice');
  markPageStart(world);
  setPhase(world, 'intro');
}

/**
 * Start an accent chapter (the Contents page's "Accents" part): a short
 * notebook of GAME_CONFIG.accents.plan pages. Its card has already been
 * shown (ui/accentIntro.ts), and its content (every letter of the course
 * plus the accents learned so far) must already be set.
 */
export function startAccents(world: World, chapter: number, letters: readonly string[], difficulty: Difficulty = world.selectedDifficulty): void {
  resetWorld(world, difficulty);
  world.mode = 'accents';
  world.accentLetters = [...letters];
  world.page = createPage(difficulty, chapter, 0, world.content, 'accents');
  markPageStart(world);
  beginPage(world);
}

/** Start an endless Practice notebook with the player's own keys. */
export function startPractice(world: World, difficulty: Difficulty = world.selectedDifficulty): void {
  resetWorld(world, difficulty);
  world.mode = 'practice';
  markPageStart(world);
  beginPage(world);
}

/**
 * Start the Daily Page (core/daily.ts): always on Normal, its pages drawn
 * from `seed`. The content (its keys and words) must already be set.
 * `counted` is false for a replay after the day's result is in.
 */
export function startDaily(
  world: World,
  id: number,
  seed: number,
  counted: boolean,
  /** A friend's score to beat, when playing from a challenge link. */
  challenge: World['challenge'] = null,
): void {
  resetWorld(world, 'normal');
  world.mode = 'daily';
  world.seed = seed;
  world.daily = { id, counted };
  world.challenge = challenge;
  world.page = pageFor(world, GAME_CONFIG.daily.chapter, 0);
  markPageStart(world);
  beginPage(world);
}

/** Enter: start a notebook, turn the page, or go back to the new-notebook screen. */
export function confirm(world: World): void {
  switch (world.phase) {
    case 'ready':
      startPractice(world);
      break;
    case 'intro':
      beginPage(world);
      break;
    case 'briefing':
      // The card has been read: set up the guided try and start the page.
      applyBriefings(world, world.briefing);
      world.seenMechanics = [...new Set([...world.seenMechanics, ...world.briefing])];
      world.briefing = [];
      setPhase(world, 'playing');
      break;
    case 'pageCleared':
      if (finishedNotebook(world)) {
        setPhase(world, 'notebookComplete');
        break;
      }
      turnPage(world);
      markPageStart(world);
      // Each Apprentice chapter opens with its new-keys card.
      if (world.mode === 'apprentice' && world.page.index === 0) setPhase(world, 'intro');
      else beginPage(world);
      break;
    case 'gameOver':
      retryChapter(world);
      break;
    default:
      break;
  }
}

/** Put the page back to how it began: same page, ink and score as at its start. */
function restoreTo(world: World, snapshot: StartSnapshot): void {
  world.page = pageFor(world, world.page.chapter, snapshot.pageIndex);
  world.targets = [];
  world.lockedId = null;
  world.ink = Math.max(1, snapshot.ink);
  world.cleanRun = 0;
  world.charges = snapshot.charges;
  world.eraser = snapshot.eraser;
  world.shield = snapshot.shield;
  world.chargeRun = 0;
  world.eraserRun = 0;
  world.slowMs = 0;
  world.highlightMs = 0;
  world.inkRefilled = 0;
  world.stats = structuredClone(snapshot.stats);
  world.pageStats = createStats();
  world.guide = null;
  world.events.push({ type: 'reset' });
  markPageStart(world);
  setPhase(world, 'playing');
}

/** Whether the page can be started over: not on the day's counted Daily Page. */
export function canRestart(world: World): boolean {
  return !world.daily?.counted;
}

/** Pause menu: start the current page over. */
export function restartPage(world: World): void {
  if (world.phase !== 'paused' && world.phase !== 'playing') return;
  // The day's counted Daily Page gets one go.
  if (!canRestart(world)) return;
  restoreTo(world, world.pageStart);
}

/**
 * Game over: try the chapter again from its first page (or from where this
 * session resumed it), with the ink and score you had then, rather than
 * starting a whole new notebook.
 */
export function retryChapter(world: World): void {
  if (world.phase !== 'gameOver' && world.phase !== 'paused') return;
  restoreTo(world, world.chapterStart);
}

/**
 * Leave the notebook for the main menu. Progress is saved at the start of
 * each page, so Continue picks up from there.
 */
export function quitToMenu(world: World): void {
  world.targets = [];
  world.lockedId = null;
  world.selectedDifficulty = world.difficulty;
  world.events.push({ type: 'reset' });
  setPhase(world, 'ready');
}

/** Esc: pause or resume. Only the playing phase can be paused. */
export function togglePause(world: World): void {
  if (world.phase === 'playing') {
    world.resumePhase = 'playing';
    setPhase(world, 'paused');
  } else if (world.phase === 'paused') {
    setPhase(world, world.resumePhase);
  }
}

/** Pause if playing, e.g. when the window loses focus. */
export function autoPause(world: World): void {
  if (world.phase === 'playing') togglePause(world);
}
