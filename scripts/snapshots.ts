/**
 * Takes a standard set of screenshots of the game for the progression
 * gallery in docs/progression/ (see its README).
 *
 *   npm run snapshots -- m15        # writes docs/progression/m15/*.png
 *   npm run snapshots -- latest     # refreshes the "latest" column
 *   npm run snapshots -- m26 holidays   # only the holiday shots (M26)
 *   npm run snapshots -- public social  # the link-preview card and install screenshot, into public/
 *
 * It starts the Vite dev server (which exposes `window.inkling`, see
 * src/main.ts), opens headless Chrome, and drives the game over the Chrome
 * DevTools Protocol: menus by clicking buttons by their text, and gameplay
 * with a little auto-typer that reads the targets from the world. One shot is
 * staged: "lineup" replaces the targets with one of every kind and variant so
 * creature looks can be compared between versions.
 *
 * Needs Google Chrome or Chromium (set CHROME_PATH if it isn't found) and
 * Node 22+ (for the built-in WebSocket). Nothing here touches the network
 * beyond localhost.
 *
 * When a milestone adds a new screen, add a step to TOUR below so later
 * milestones keep capturing it.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const folder = process.argv[2];
if (!folder || !/^[\w-]+$/.test(folder)) {
  console.error('Usage: npm run snapshots -- <folder>   (for example m15 or latest)');
  process.exit(1);
}
const mode = process.argv[3];
const outDir = mode === 'social' ? join(root, 'public') : join(root, 'docs/progression', folder);
const WIDTH = 1280;
const HEIGHT = 800;

type Step =
  | { shot: string }
  | { wait: number }
  | { key: string }
  | { click: string }
  | { eval: string }
  | { play: number; maxX?: number }
  /** Reload the game with this query string (e.g. `?season=christmas`; dev server only). */
  | { open: string }
  /** Change the window size. */
  | { viewport: [number, number] }
  /** Act as a phone (touch only, M29) or go back to a desktop with a mouse. */
  | { phone: boolean };

/** Scroll every scrolled box back to the top, so long dialogs show their start. */
const SCROLL_TOP = `document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; })`;

/** Swap the targets for one of each kind and variant, barely moving. */
const LINEUP = `(() => {
  const w = window.inkling.world;
  const base = w.targets[0];
  if (!base) return 'no targets yet';
  const make = (o) => ({ ...base, typed: 0, buffer: undefined, cursor: undefined, lives: 1, maxLives: undefined,
    ghost: false, boss: false, speed: 4, ...o, y: 120 + o.lane * 48, prevX: o.x, id: w.nextId++ });
  const items = [
    { kind: 'drip', text: 'f', x: 520, lane: 0 },
    { kind: 'blotling', text: 'quill', x: 760, lane: 2 },
    { kind: 'blotling', text: 'ink', x: 1000, lane: 4, lives: 2, maxLives: 2 },
    { kind: 'blotling', text: 'pen', x: 640, lane: 6, lives: 3, maxLives: 3 },
    { kind: 'runon', text: 'ink pot', buffer: '', cursor: 0, x: 860, lane: 8 },
  ];
  w.page.spawned += items.length - w.targets.length;
  w.targets = items.map(make);
  w.lockedId = null;
  return 'ok';
})()`;

/**
 * The lineup again with capitals beside their lowercase twins (M30: capitals
 * get a bar underneath), one word part typed.
 */
const CAPITALS = `(() => {
  const w = window.inkling.world;
  const base = w.targets[0];
  if (!base) return 'no targets yet';
  const make = (o) => ({ ...base, typed: 0, buffer: undefined, cursor: undefined, lives: 1, maxLives: undefined,
    ghost: false, boss: false, speed: 4, ...o, y: 120 + o.lane * 48, prevX: o.x, id: w.nextId++ });
  const items = [
    { kind: 'drip', text: 'C', x: 520, lane: 0 },
    { kind: 'drip', text: 'c', x: 640, lane: 0 },
    { kind: 'drip', text: 'S', x: 760, lane: 0 },
    { kind: 'drip', text: 's', x: 880, lane: 0 },
    { kind: 'blotling', text: 'Oxford', x: 760, lane: 2 },
    { kind: 'blotling', text: 'WoW', x: 1000, lane: 4, lives: 2, maxLives: 2 },
    { kind: 'blotling', text: 'Vivid', typed: 2, x: 640, lane: 6 },
    { kind: 'runon', text: 'Pick up Kim', buffer: '', cursor: 0, x: 860, lane: 8 },
  ];
  w.page.spawned += items.length - w.targets.length;
  w.targets = items.map(make);
  w.lockedId = null;
  return 'ok';
})()`;

/** Scrolls Settings to the keyboard layout choice, if there is one. */
const SHOW_LAYOUT = `(() => {
  const legend = [...document.querySelectorAll('.settings legend')].find((l) => /layout/i.test(l.textContent));
  if (legend) legend.scrollIntoView({ block: 'center' });
  return 'ok';
})()`;

/** Scrolls How to play to its bosses, if it has a section for them (M19). */
const SHOW_BOSSES = `(() => {
  const heading = [...document.querySelectorAll('.how-section h3')].find((h) => /boss/i.test(h.textContent));
  if (heading) heading.scrollIntoView({ block: 'start' });
  return 'ok';
})()`;

/**
 * A sample Daily Page history for the shot (M20): a three-day streak that
 * includes today, so the streak strip, page grades and share text all show.
 * Only in memory, for the picture; nothing is saved.
 */
const SAMPLE_DAILY = `(() => {
  const store = window.inkling && window.inkling.store;
  if (!store || !store.data.daily) return 'no daily';
  const now = new Date();
  const today = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 10, 17)) / 86400000) + 1;
  const result = (score, grades) => ({ score, grades, wpm: 38, accuracy: 96, finished: true });
  store.data.daily = {
    lastId: today,
    streak: 3,
    bestStreak: 5,
    best: 6120,
    results: {
      [today - 2]: result(4410, ['A', 'B', 'A']),
      [today - 1]: result(5230, ['A+', 'A', 'B']),
      [today]: result(4820, ['A+', 'B', 'C']),
    },
  };
  return 'ok';
})()`;

/**
 * Some sample stickers for the sticker book shot (M21), a couple marked new.
 * Only in memory, for the picture; nothing is saved.
 */
const SAMPLE_STICKERS = `(() => {
  const store = window.inkling && window.inkling.store;
  if (!store || !store.data.stickers) return 'no stickers';
  const at = new Date().toISOString();
  const ids = ['firstPage', 'goldStar', 'onARoll', 'quickPen', 'firstBoss', 'scribe', 'dailyFirst', 'onFire', 'midnightOil'];
  store.data.stickers = { earned: Object.fromEntries(ids.map((id) => [id, at])), unseen: ['onFire', 'midnightOil'], bossesBeaten: ['spill'] };
  return 'ok';
})()`;

/**
 * Open a sample challenge link (M22): the same as a friend's link would,
 * through the address's #c=… part. The game reads it and shows the challenge.
 */
const SAMPLE_CHALLENGE = `(() => {
  const now = new Date();
  const today = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 10, 17)) / 86400000) + 1;
  const json = JSON.stringify({ v: 1, d: today, l: 'us-qwerty', s: 5230, g: 'A+,A,B', n: 'Pip' });
  location.hash = 'c=' + btoa(json).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/=+$/, '');
  return 'ok';
})()`;

/**
 * Open a sample transfer link (M23), made by the game's own code from a copy
 * of this save with a little progress, as if "Pip" sent it from another device.
 */
const SAMPLE_TRANSFER = `(async () => {
  const { encodeTransfer } = await import('/src/storage/transfer.ts');
  const save = structuredClone(window.inkling.store.data);
  save.profile.ink = 5200;
  save.apprentice.unlocked = 9;
  location.hash = await encodeTransfer(save, { name: 'Pip', badge: 'teal' });
  return 'ok';
})()`;

/** The next character the auto-typer should press, or '' to wait. */
const NEXT_KEY = (maxX: number) => `(() => {
  const w = window.inkling && window.inkling.world;
  if (!w || !w.targets) return '';
  const live = w.targets.filter((t) => t.typed < t.text.length && t.buffer === undefined && t.x < ${maxX});
  if (!live.length) return '';
  const t = live.find((t) => t.typed > 0) || live.sort((a, b) => a.x - b.x)[0];
  return t.text[t.typed];
})()`;

/** Both holiday stickers earned (M26), so their keepsakes are open on the Desk. In memory only. */
const HOLIDAY_STICKERS = `(() => {
  const store = window.inkling && window.inkling.store;
  if (!store || !store.data.stickers) return 'no stickers';
  const now = new Date().toISOString();
  Object.assign(store.data.stickers.earned, { harvestHelper: now, snowScribe: now });
  return 'ok';
})()`;

/** Scrolls the Desk to its paper and hat choices. */
const SHOW_HATS = `(() => {
  const legend = [...document.querySelectorAll('legend')].find((l) => /^Paper$/.test(l.textContent.trim()));
  if (legend) legend.scrollIntoView({ block: 'start' });
  return 'ok';
})()`;

/** Scrolls the sticker book to the Holidays shelf. */
const SHOW_HOLIDAY_SHELF = `(() => {
  const heading = [...document.querySelectorAll('h3, legend, h2')].find((h) => /Holidays/.test(h.textContent));
  if (heading) heading.scrollIntoView({ block: 'center' });
  return 'ok';
})()`;

/**
 * French (M33): French menus and words on AZERTY, with the letter course
 * finished and the first three accent chapters done, so the Contents page's
 * Accents part is open. Saved, so it survives the reload that changes the menu language.
 */
const FRENCH = `(() => {
  const store = window.inkling && window.inkling.store;
  if (!store || !('wordsLanguage' in store.data)) return 'no languages';
  store.update((save) => {
    save.wordsLanguage = 'fr';
    save.layout = 'fr-azerty';
    save.apprentice.unlocked = 27;
    save.apprentice.completed = true;
    save.apprentice.accentStars = { fr: [9, 8, 9] };
  });
  const settings = JSON.parse(localStorage.getItem('inkling.settings') || '{}');
  localStorage.setItem('inkling.settings', JSON.stringify({ ...settings, menuLanguage: 'fr' }));
  return store.flush().then(() => 'ok');
})()`;

/**
 * Spanish (M34): Spanish menus and words on the Spanish (Spain) keyboard, with
 * the letter course finished and the first four accent chapters done, so the
 * ¿ ¡ chapter is open.
 */
const SPANISH = `(() => {
  const store = window.inkling && window.inkling.store;
  if (!store || !('wordsLanguage' in store.data)) return 'no languages';
  store.update((save) => {
    save.wordsLanguage = 'es';
    save.layout = 'es-iso';
    save.apprentice.unlocked = 27;
    save.apprentice.completed = true;
    save.apprentice.accentStars = { es: [9, 9, 8, 9] };
  });
  const settings = JSON.parse(localStorage.getItem('inkling.settings') || '{}');
  localStorage.setItem('inkling.settings', JSON.stringify({ ...settings, menuLanguage: 'es' }));
  return store.flush().then(() => 'ok');
})()`;

/** Back to English menus and words on US QWERTY, for the rest of the tour. */
const ENGLISH = `(() => {
  const store = window.inkling && window.inkling.store;
  if (!store || !('wordsLanguage' in store.data)) return 'no languages';
  store.update((save) => {
    save.wordsLanguage = 'en';
    save.layout = 'us-qwerty';
    save.apprentice.unlocked = 1;
    save.apprentice.completed = false;
    save.apprentice.accentStars = {};
  });
  const settings = JSON.parse(localStorage.getItem('inkling.settings') || '{}');
  localStorage.setItem('inkling.settings', JSON.stringify({ ...settings, menuLanguage: 'en' }));
  return store.flush().then(() => 'ok');
})()`;

/** Scrolls the Contents page to its Accents part (M33). */
const SHOW_ACCENTS = `(() => {
  document.querySelector('.menu-accents')?.scrollIntoView({ block: 'center' });
  return 'ok';
})()`;

/** The free-play mode's button: "Free Write" since M17, "Practice" before. */
const FREE_WRITE = 'Free Write|Practice';

/**
 * Holiday looks (M26) on any day: the same menu and creature lineup dressed
 * for each season. The rest of the tour runs with `?season=none`, so its
 * shots compare with earlier milestones whatever the date.
 */
const HOLIDAY_TOUR: Step[] = [
  ...(['thanksgiving', 'christmas'] as const).flatMap((season): Step[] => [
    { open: `?season=${season}` },
    { shot: `menu-${season}` },
    { click: FREE_WRITE }, { click: 'Start writing' }, { wait: 800 }, { key: 'Enter' },
    { wait: 4000 }, { eval: LINEUP }, { wait: 700 }, { shot: `lineup-${season}` },
    { key: 'Escape' }, { click: 'Quit to menu' },
  ]),
  // The holiday keepsakes on the Desk and the Holidays shelf, with both stickers earned.
  { eval: HOLIDAY_STICKERS }, { click: 'Desk' }, { eval: SHOW_HATS }, { wait: 300 }, { shot: 'desk-holidays' }, { key: 'Escape' },
  { click: 'Sticker book' }, { eval: SHOW_HOLIDAY_SHELF }, { wait: 300 }, { shot: 'stickers-holidays' }, { key: 'Escape' },
];

/** Shows the splash screen from index.html again (M28): it's gone by the time the game is ready. */
const SHOW_SPLASH = `(async () => {
  const html = await (await fetch('/index.html', { cache: 'no-store' })).text();
  const found = html.match(/<div id="splash"[\\s\\S]*?<\\/svg>\\s*<\\/div>/);
  if (!found) return 'no splash';
  const box = document.createElement('div');
  box.innerHTML = found[0];
  box.firstElementChild.style.zIndex = '10000';
  document.body.append(box.firstElementChild);
  return 'ok';
})()`;

/** Ink Race demo (M36): type the start of the passage, leaving a mistake to fix. */
const RACE_TYPE_SOME = `(() => { const r = window.race; if (!r) return 'no race'; r.play("You don't know about me without you have raed", 160); return 'ok'; })()`;
/** Ink Race demo: type the whole passage, so the card comes up. */
const RACE_FINISH = `(() => { const r = window.race; if (!r) return 'no race'; r.play(r.test().text, 40); return 'ok'; })()`;

const MAIN_TOUR: Step[] = [
  // The one-time "Made for a keyboard" notice on a phone (M29), then back to a desktop.
  { phone: true }, { open: '?season=none' }, { shot: 'keyboard-notice' }, { click: 'Play anyway' }, { phone: false },
  { open: '?season=none' },
  { eval: SHOW_SPLASH }, { wait: 300 }, { shot: 'splash' }, { eval: `document.getElementById('splash')?.remove()` },
  { shot: 'menu' },
  // About, with links to the website's pages (M27).
  { click: 'About' }, { shot: 'about' }, { key: 'Escape' },
  { click: 'Desk' }, { eval: SCROLL_TOP }, { shot: 'desk' }, { key: 'Escape' },
  { click: 'Switch player' }, { shot: 'players' }, { key: 'Escape' },
  { click: 'Settings' }, { shot: 'settings' }, { key: 'Escape' },
  { click: 'Word lists' }, { shot: 'word-lists' }, { key: 'Escape' },
  // Another keyboard layout (M16): the Type Case and the first chapter card follow it.
  { click: 'Settings' }, { click: 'Dvorak' }, { eval: SHOW_LAYOUT }, { shot: 'settings-layout' }, { key: 'Escape' },
  { click: FREE_WRITE }, { click: 'Change keys' }, { shot: 'type-case-dvorak' }, { key: 'Escape' }, { key: 'Escape' },
  { click: 'Apprentice' }, { click: 'Chapter 1' }, { shot: 'chapter-intro-dvorak' }, { key: 'Escape' }, { key: 'Escape' },
  // ISO keyboards (M32): AZERTY, with digits on Shift and the extra key left of W, and Spanish with ñ.
  { click: 'Settings' }, { click: 'French AZERTY' }, { key: 'Escape' },
  { click: FREE_WRITE }, { click: 'Change keys' }, { shot: 'type-case-azerty' }, { key: 'Escape' }, { key: 'Escape' },
  { click: 'Settings' }, { click: 'Spanish (Spain)' }, { key: 'Escape' },
  { click: FREE_WRITE }, { click: 'Change keys' }, { shot: 'type-case-spanish' }, { key: 'Escape' }, { key: 'Escape' },
  { click: 'Settings' }, { click: 'US QWERTY' }, { key: 'Escape' },
  // French (M33): French menus and words on AZERTY, the Contents page's Accents part,
  // an accent chapter's opening card, the accent help card and the Type Case's Accents strip.
  { eval: FRENCH }, { open: '?season=none' }, { shot: 'menu-fr' },
  { click: 'Apprenti' }, { eval: SHOW_ACCENTS }, { wait: 300 }, { shot: 'contents-accents' },
  { click: 'â ê î ô û' }, { wait: 2600 }, { shot: 'accent-intro' }, { key: 'Escape' },
  { click: 'Comment taper les accents' }, { wait: 400 }, { shot: 'accent-help' }, { key: 'Escape' }, { key: 'Escape' },
  { click: 'Écriture libre' }, { click: 'Changer les touches' }, { shot: 'type-case-accents' }, { key: 'Escape' }, { key: 'Escape' },
  // Spanish (M34): Spanish menus, the Accents part with its ¿ ¡ chapter, and that chapter's opening card.
  { eval: SPANISH }, { open: '?season=none' }, { shot: 'menu-es' },
  { click: 'Aprendiz' }, { eval: SHOW_ACCENTS }, { wait: 300 }, { shot: 'contents-accents-es' },
  { click: '¿ ¡' }, { wait: 2600 }, { shot: 'accent-intro-es' }, { key: 'Escape' },
  { click: 'Cómo escribir acentos' }, { wait: 400 }, { shot: 'accent-help-es' }, { key: 'Escape' }, { key: 'Escape' },
  { eval: ENGLISH }, { open: '?season=none' },
  { click: 'How to play' }, { eval: SCROLL_TOP }, { shot: 'how-to-play' },
  { eval: SHOW_BOSSES }, { wait: 300 }, { shot: 'how-to-play-bosses' }, { key: 'Escape' },
  // Play together (M35) and Ink Race (M36): the dialog, then a race against two bots (`?race=demo`):
  // the countdown, partway with a mistake to fix, and the race card.
  { click: 'Play together' }, { shot: 'play-together' }, { key: 'Escape' },
  { open: '?season=none&race=demo&passage=twain-huck&bots=40,30' }, { wait: 1200 }, { shot: 'race-countdown' },
  { wait: 2600 }, { eval: RACE_TYPE_SOME }, { wait: 6000 }, { shot: 'race' },
  { open: '?season=none&race=demo&passage=twain-huck&bots=2000,1500' }, { wait: 4200 }, { eval: RACE_FINISH }, { wait: 1500 }, { shot: 'race-card' },
  { open: '?season=none' },
  // The Daily Page (M20), with a sample streak.
  { eval: SAMPLE_DAILY }, { click: 'Daily Page' }, { eval: SCROLL_TOP }, { shot: 'daily' }, { key: 'Escape' },
  // The sticker book (M21), with some sample stickers.
  { eval: SAMPLE_STICKERS }, { click: 'Sticker book' }, { eval: SCROLL_TOP }, { shot: 'stickers' }, { key: 'Escape' },
  // A challenge link from a friend (M22).
  { eval: SAMPLE_CHALLENGE }, { wait: 500 }, { shot: 'challenge' }, { click: 'Not now' },
  // Moving to another device (M23): the transfer row in Saves ("Manage saves" before M24), then opening a link.
  { click: 'Manage saves|Saves' }, { shot: 'save-data' }, { key: 'Escape' },
  { eval: SAMPLE_TRANSFER }, { wait: 800 }, { shot: 'transfer' }, { click: 'Not now' },
  { click: FREE_WRITE }, { shot: 'practice' },
  { click: 'Change keys' }, { shot: 'type-case' }, { key: 'Escape' },
  // A fresh player gets the "New on this page" briefing before their first page.
  { click: 'Start writing' }, { wait: 800 }, { shot: 'briefing' }, { key: 'Enter' },
  { wait: 4000 }, { eval: LINEUP }, { wait: 700 }, { shot: 'lineup' },
  { eval: CAPITALS }, { wait: 700 }, { shot: 'capitals' },
  { key: 'Escape' }, { click: 'Quit to menu' },
  { click: 'Apprentice' }, { shot: 'contents' },
  { click: 'Chapter 1' }, { shot: 'chapter-intro' }, { key: 'Enter' },
  { play: 8000, maxX: 700 }, { shot: 'play' },
  { key: 'Escape' }, { shot: 'pause' }, { key: 'Escape' },
  // Let the grade stamp and the stars fill in before the shot.
  { play: 60000, maxX: 1000 }, { wait: 1500 }, { shot: 'page-done' },
];

/**
 * The link-preview card (1200×630, for og:image) and the install screenshot
 * (manifest `screenshots`), written to public/ (M27). The card lays the logo
 * and a line about the game over the creature lineup.
 */
const SOCIAL_CARD = `(() => {
  const card = document.createElement('div');
  card.style.cssText = 'position:fixed;left:190px;top:366px;width:470px;padding:16px 30px 18px;background:#f7f1e3;border:3px solid #1f2a44;border-radius:18px;box-shadow:0 14px 40px rgba(0,0,0,0.35);z-index:99;font-family:"Atkinson Hyperlegible Next",sans-serif;color:#1f2a44';
  // The menu's logo (src/ui/menu.ts), drawn here because the menu is hidden during play.
  card.insertAdjacentHTML('beforeend', '<svg viewBox="0 -4 390 100" width="330" style="display:block;overflow:visible">' +
    '<path d="M44 6 L26 48 A21 21 0 1 0 62 48 Z" fill="#1f2a44"/>' +
    '<circle cx="38" cy="62" r="4.2" fill="#f7f1e3"/><circle cx="52" cy="62" r="4.2" fill="#f7f1e3"/>' +
    '<circle cx="34" cy="50" r="3" fill="#f7f1e3"/><path d="M39 72 q6 5 12 0" fill="none" stroke="#f7f1e3" stroke-width="2.4" stroke-linecap="round"/>' +
    '<text x="80" y="70" fill="#1f2a44" font-family="Georgia, serif" font-style="italic" font-size="66">Inky Keys</text>' +
    '<path d="M84 82 C160 74 270 90 366 78" fill="none" stroke="#d64545" stroke-width="3" stroke-linecap="round"/></svg>');
  const line = document.createElement('p');
  line.textContent = 'A free typing game where you choose the keys.';
  line.style.cssText = 'margin:10px 0 0;font-size:28px;font-weight:700;line-height:1.25';
  const more = document.createElement('p');
  more.textContent = 'No ads, no accounts. Works offline.';
  more.style.cssText = 'margin:12px 0 0;font-size:22px;color:#46506b';
  card.append(line, more);
  document.body.append(card);
  return 'ok';
})()`;

const SOCIAL_TOUR: Step[] = [
  { open: '?season=none' },
  { click: FREE_WRITE }, { click: 'Start writing' }, { wait: 800 }, { key: 'Enter' },
  { wait: 4000 }, { eval: LINEUP }, { wait: 700 }, { shot: 'screenshots/play-wide' },
  { viewport: [1200, 630] }, { wait: 600 }, { eval: SOCIAL_CARD }, { wait: 400 }, { shot: 'social-card' },
];

/** The website's plain pages (M27): a path, not a query, so `open` doesn't wait for the game. */
const SITE_TOUR: Step[] = [
  { open: 'parents-and-teachers/' }, { shot: 'site-parents' }, { open: 'how-to-play/' }, { shot: 'site-how-to-play' },
  // French pages (M33), with the accent help page.
  { open: 'fr/accents/' }, { shot: 'site-fr-accents' },
  // Spanish pages (M34), with the accent help page.
  { open: 'es/accents/' }, { shot: 'site-es-accents' },
];

const TOUR: Step[] =
  mode === 'holidays' ? HOLIDAY_TOUR : mode === 'social' ? SOCIAL_TOUR : [...MAIN_TOUR, ...HOLIDAY_TOUR, ...SITE_TOUR];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function findChrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error('Chrome not found: set CHROME_PATH');
  return found;
}

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5199/';

const profile = mkdtempSync(join(tmpdir(), 'inkling-snapshots-'));
const debugPort = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(findChrome(), [
  '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  `--window-size=${WIDTH},${HEIGHT}`, '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });

let pageSocketUrl = '';
for (let i = 0; i < 50 && !pageSocketUrl; i++) {
  try {
    const targets = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
    pageSocketUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? '';
  } catch {
    await sleep(200);
  }
}
if (!pageSocketUrl) throw new Error('Could not connect to Chrome');

const socket = new WebSocket(pageSocketUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve));
let nextId = 0;
const pending = new Map<number, (result: Record<string, unknown>) => void>();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown> };
  if (message.id !== undefined) pending.get(message.id)?.(message.result ?? {});
});
function send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression: string): Promise<unknown> {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return (reply.result as { value?: unknown } | undefined)?.value;
}

const SPECIAL_KEYS: Record<string, number> = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8 };
async function press(key: string): Promise<void> {
  const special = key in SPECIAL_KEYS;
  const code = special ? key : key === ' ' ? 'Space' : `Key${key.toUpperCase()}`;
  const base = { key, code, windowsVirtualKeyCode: SPECIAL_KEYS[key] ?? key.toUpperCase().charCodeAt(0) };
  const text = key === 'Enter' ? { text: '\r' } : special ? {} : { text: key };
  await send('Input.dispatchKeyEvent', { type: special ? 'rawKeyDown' : 'keyDown', ...base, ...text });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

/**
 * Clicks the first visible, enabled button (else list item or label) whose
 * text contains `label`. `label` may list alternatives as "A|B" (first match
 * wins), for buttons renamed between milestones.
 */
async function click(label: string): Promise<void> {
  const ok = await evaluate(`(() => {
    const options = ${JSON.stringify(label.toLowerCase().split('|'))};
    const find = (sel, q) => [...document.querySelectorAll(sel)].find((e) =>
      e.offsetParent !== null && !e.disabled && e.textContent.trim().toLowerCase().includes(q));
    for (const q of options) {
      const el = find('button, a, [role=button]', q) || find('li, label', q);
      if (el) {
        el.click();
        return true;
      }
    }
    return false;
  })()`);
  if (!ok) console.warn(`  (no "${label}" button on screen; skipped)`);
}

try {
  mkdirSync(outDir, { recursive: true });
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  const open = async (query: string) => {
    await send('Page.navigate', { url: url + query });
    await sleep(500);
    // A website page has no game to wait for.
    if (query === '' || query.startsWith('?')) {
      for (let i = 0; i < 100 && !(await evaluate('Boolean(window.inkling)')); i++) await sleep(200);
    }
    await sleep(1000);
  };
  if (!('open' in TOUR[0]!)) await open('');

  for (const step of TOUR) {
    if ('open' in step) {
      await open(step.open);
    } else if ('phone' in step) {
      if (step.phone) {
        await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
        await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      } else {
        await send('Emulation.setTouchEmulationEnabled', { enabled: false });
        await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
      }
    } else if ('viewport' in step) {
      await send('Emulation.setDeviceMetricsOverride', { width: step.viewport[0], height: step.viewport[1], deviceScaleFactor: 1, mobile: false });
    } else if ('shot' in step) {
      const { data } = (await send('Page.captureScreenshot', { format: 'png' })) as { data: string };
      mkdirSync(dirname(join(outDir, `${step.shot}.png`)), { recursive: true });
      writeFileSync(join(outDir, `${step.shot}.png`), Buffer.from(data, 'base64'));
      console.log(`  ${folder}/${step.shot}.png`);
    } else if ('wait' in step) {
      await sleep(step.wait);
    } else if ('key' in step) {
      await press(step.key);
      await sleep(400);
    } else if ('click' in step) {
      await click(step.click);
      await sleep(900);
    } else if ('eval' in step) {
      await evaluate(step.eval);
    } else {
      const end = Date.now() + step.play;
      const nextKey = NEXT_KEY(step.maxX ?? 700);
      while (Date.now() < end) {
        if (await evaluate("window.inkling.world.phase !== 'playing'")) break;
        const key = await evaluate(nextKey);
        if (typeof key === 'string' && key) await press(key);
        await sleep(typeof key === 'string' && key ? 80 : 150);
      }
      await sleep(800);
    }
  }
} finally {
  socket.close();
  chrome.kill();
  await server.close();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
