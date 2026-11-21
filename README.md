# Inky Keys

> [!NOTE]
> **This project is almost entirely AI-generated ("vibe coded").** Unlike my other repositories, which I wrote by hand, nearly all of Inky Keys' code and documentation was written by an AI coding assistant (Claude) from my direction, with me setting the goals, reviewing and steering. I built it this way to quickly create a typing-practice game for my kids, something that would otherwise have taken me months on my own. Please read the code with that in mind. The full conversations are in [docs/transcripts](docs/transcripts/README.md), so you can see how it was built.

A browser-based, offline-first typing game inspired by *Typer Shark*. Ink-blot creatures crawl across a notebook page carrying words, characters, digits or symbols, and you type them before they reach the margin. What makes it different is that **you choose exactly which keys to practice**, and the game builds all of its content from only those keys, so it grows with you as you learn.

**▶ Play it free at [inkykeys.com](https://inkykeys.com/)**, in any modern browser on a computer with a keyboard. Parents and teachers: see [what it teaches and why it's safe](https://inkykeys.com/parents-and-teachers/).

No servers and no analytics. Everything stays on your device (see [PRIVACY.md](PRIVACY.md)), and the game works offline after the first visit.

- Requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- Design: [docs/DESIGN.md](docs/DESIGN.md)
- How it grew, in screenshots from every milestone: [docs/progression](docs/progression/README.md)

## How to play

Inky Keys is made for a physical keyboard. On a phone or tablet with no mouse or trackpad, it says so once (**Made for a keyboard**), but you can still play.

Type the character on each ink drip before it reaches the red margin. Each drip that gets through drains your ink well, and the game ends when it runs dry. Correct keys in a row build a score multiplier, up to ×4.

| Key | Action |
|---|---|
| Characters | Hit the matching target closest to the margin |
| Backspace | Erase mistakes in a Run-on |
| Tab | Switch to the next target (nearest the margin first) |
| Esc | Pause: **Resume**, **Restart page**, **Settings** or **Quit to menu** (the game also pauses when the window loses focus) |
| Enter | While playing: fire the **Blotter** (when charged). On a card: begin, turn the page, or retry the chapter after running out of ink |
| R / M | After running out of ink: **Retry chapter** or go to the **Main menu** |

The **main menu** has buttons for everything: **Continue** (C), **Free Write** (F, then pick a difficulty with 1–4 and change keys), **Apprentice** (A), **Fair Copy** (O), **Word lists** (W), **Desk** (D), **Settings** (S), **Manage saves** (B), **How to play** (H), **About** (I, with links to the source code and a form for ideas and bug reports) and **Switch player** (U). Use the arrow keys or Tab and Enter, or the mouse.

A notebook is a series of **chapters**, each made of a few **pages**. Each page is all **drips** (single characters) or all **Scrawlers** (words). In Free Write, Scrawlers are the main wave, with one letter-drip page per chapter; if your keys include at least three digits or symbols, those get a drip page of their own, so they never mix with letters. New creatures rush in from the right until their whole word is on the page, then slow to their own pace. From chapter 4, Scrawler pages now and then slip in a **Run-on** (at most one on screen and three per page). Pages speed up slightly within a chapter, each chapter is a bit harder than the last, and finishing a chapter tops up your ink. Pick Relaxed, Normal, Hard or Expert when you start a notebook. Drip and Scrawler pages never show more targets at once than you have keys to tell them apart. All of these numbers live in `src/core/config.ts`. 

### Choosing keys

The **Type Case** shows a keyboard where every key has two halves: its plain character below and its Shift character on top. Click a half, or press that key on your real keyboard, to add or remove it. You can also start from a preset (Home row, All letters, Numbers, Code symbols…), toggle whole groups (digits, top row, left hand…), or save your own presets. New players start on all letters, capitals and space (the **All letters** preset).

The game builds everything from your keys: drips use them directly, and word pages use real words that only need those letters. Selected capitals and punctuation show up in words too. If too few words fit, made-up strings are mixed in, and the Type Case warns you when that will happen.

### Free Write, Apprentice and Fair Copy

- **Apprentice** is a typing course for beginners, 27 chapters long.
  - Chapter 1 teaches just `f` and `j`, the keys with bumps. Each later chapter adds **one** key: the rest of the home row (`d k s l a ; g h`), then space, then `e i r u t y o w n m c v b x p q z`.
  - **Pacing:** difficulty climbs a quarter as fast as in Free Write. The first 8 chapters are extra gentle, with slower, sparser creatures and shorter pages, easing off as you go.
  - **What appears when:** every chapter, even the first (just `f` and `j`), has a Scrawler page. Until there are enough keys for real words, Scrawlers carry short made-up strings of the keys learned so far, like `fjf`. Once space is learned, an occasional phrase (Run-on) joins the word pages. From six chapters after space, each chapter is one drip page for the new key and then four Scrawler pages. Crimson creatures arrive from chapter 5, ghosts from chapter 9, violet ones from chapter 17, and a boss on the last page of each chapter from chapter 3. On Hard and Expert, the first 10 chapters start nearer Normal and ease up to full strength.
  - **Introductions:** every chapter opens with a card showing its new key and which finger types it. The new key comes up three times as often as the others.
  - **Stars and progress:** each page earns 1–3 stars from its grade. Clearing a chapter opens the next one on the **Contents** page, where you can replay any open chapter. Finishing the last chapter completes the notebook.
- **Free Write** (formerly Practice) is the main mode. It uses exactly the keys you choose in the Type Case, with endless chapters. New players start with all letters, capitals and space.
- **Ready for more?** From chapter 5 of Free Write, a chapter where every page gets an A or A+ brings a card offering **Add numbers and symbols** (if you're not on Everything) and/or the next difficulty. Either change starts on the next page, and the notebook keeps going. **Not now** waits three chapters; **Don't suggest this again** stops it for that player, and **Ready for more?** in Settings turns it back on. The numbers are in `GAME_CONFIG.nudges`.
- **Fair Copy** (O on the main menu) is a typing-speed test with no creatures. Copy out a public-domain passage from a classic book, or type for 30 or 60 seconds (Enter at the ↵ mark goes on to the next passage). Passages are dealt shuffled, every one before any repeats. The clock starts on your first key, and the result card shows WPM, raw WPM, accuracy, mistakes left in (each costs speed; Backspace fixes them), your best run and slowest keys. Bests are kept per player for each passage and each timed test, and Fair Copy has its own sticker shelf. The passages live in `src/core/fairCopy.ts` and the numbers in `GAME_CONFIG.fairCopy`.
- **From Apprentice to Free Write:** pause a chapter and pick **Free Write with these keys** (F) to keep practicing that chapter's keys at the same difficulty. The Free Write screen and the Type Case also offer **My Apprentice keys**, which always matches the furthest chapter you've reached.

### Players

Several people can share one browser. Each player has their own notebook, stars, ink, desk and key stats; display and sound settings are shared. Press **U** on the main menu (or click **Writing as…**) to switch, add, rename or delete players. With more than one player, the game asks **Who's writing?** when it opens.

Every player gets the same family-friendly word filter: swear words, slurs and words that don't suit young children are always left out. The word groups live in `src/content/contentFilter.ts`.

### Ink, ranks and your desk

- **Ink:** every page you finish earns ink (XP): a tenth of its score, plus 15 per star. Completing the Apprentice notebook adds 500. Each level needs more ink than the last, and new things unlock only every few levels (the gold nib at level 14), so they're worth working toward.
- **Ranks:** ink raises your level, and you rise from Scribbler through Doodler, Scribe, Penman, Calligrapher and Illuminator to Master of Keys.
- **Unlocks:** levels unlock things for your **Desk** (D on the main menu): pens (fountain nib, quill, brush, gold nib), splatter ink colors and paper (ruled, graph, parchment). When you unlock something, a card shows a picture of it with a **Use it now** button, and the Desk shows a picture of every item.
- **Holiday keepsakes:** finishing a page around Thanksgiving earns the **Harvest Helper** sticker, and one in December earns **Snow Scribe**. Each brings a hat for your pen (pilgrim or Santa) and a paper (Harvest or Winter) to keep all year.

### Holidays

Around Thanksgiving (from two weeks before through the Sunday after) and through December, the game dresses up: autumn leaves or holly and snow in the page's corners, hats, turkey tails and antlers on the creatures and the scribe, and holiday words (*pie*, *harvest*, *sleigh*, *cocoa*…) on some word pages when your keys can type them. The Daily Page keeps its usual words so it stays the same for everyone. Turn it off with **Holiday looks** in Settings.

### Powers and bosses

- **Charges:** a run of correct keys in a row earns a charge (up to 3), shown as drops by the ink bar. The run starts at 25 keys and grows with the chapter, and harder difficulties need longer runs (×1.15 on Normal, ×1.35 on Hard, ×1.6 on Expert).
- **The Blotter:** press **Enter** while playing to spend 2 charges (3 on Hard and Expert) and blot every creature on the page for half points.
- **The Eraser** forgives a wrong key, and for a second afterwards any more slips are quietly ignored, since fast typists often hit one or two before they notice.
- **Bosses:** the last page of each chapter starts with a boss, from chapter 2 in Free Write and chapter 3 in the Apprentice course. They take turns, one per chapter, and the Blotter can't touch any of them.
  - **The Spill:** a big, slow word that needs three words in a row. It costs double ink if it reaches the margin and splits into three small Inkmites when blotted.
  - **The Bookworm:** a chain of short-word segments in one line, wearing reading glasses. Only the head can be typed; each segment you pop makes the rest a little faster.
  - **The Shuffler:** a big word whose untyped letters swap places every few seconds. Three words to beat.
  - **The Inkwell Squid:** a body word guarded by three tentacle words in nearby lines, which must be typed first. A tentacle left alone squirts ink that hides a line of words for a few seconds.
  - **The Rival Quill:** a pen that races you to write the same word, shown by a red line under the letters. Finish first to win the round; if it finishes first, it splashes you with ink and starts a new word. Three rounds to beat.

### Ink shots

Every correct key flicks a drop of ink from your pen at the letter you typed. The pen aims ahead of the moving creature so the drop meets the letter, and a creature you finish stays on the page until the last drop lands, already showing it's beaten (x x eyes and a squash) so you know the word is done even with the sound off. A wrong key still fires, but the drop misses and splats on the page. The locked creature is always drawn in front of any it overlaps.

### Target types

- **Drips:** a single character.
- **Scrawlers:** a word.
- **Run-ons** (sprinkled in from chapter 4): a phrase. Mistakes stay, struck through in red, until you erase them with Backspace. They need the space key, so without it they don't appear.
- **Tougher ink:** some drips and Scrawlers come in **crimson**, which need two words (or characters), or **violet**, which need three. Their words are shorter to make up for it, and each has its own look: crimson ones are spiky with horns, violet ones are lumpy with a crown and a third eye. Dots above them show how many are left. You can switch to other creatures between words, and they never repeat a word back to back. **Ghosts** in invisible ink hide their text until they're a quarter to half of the way in from the right edge. In Practice crimson starts in chapter 2, ghosts in 3 and violet in 5; in Apprentice they start later.

### Word lists

Press **W** to download words about a topic (e.g. *ocean*). Inky Keys fetches the topic's [Wikipedia](https://en.wikipedia.org/) article (from [French Wikipedia](https://fr.wikipedia.org/) for French words), sending only your topic, and picks the words that stand out in it. It keeps the clean single words, saves them on your device, and favours the ones your keys can type on word pages. Lists can be switched off or deleted. This is the only feature that uses the network, and only when you ask.

### After each page

Each page is graded in red pen (A+ to F) from your accuracy, dropping a letter if ink reached the margin. The page also circles the keys you missed most, adds a teacher's note, and lists any keys you newly mastered.

### Mastery

In the Type Case, a bar under each key fills as you practice it, and mastered keys get a gold edge. A key is mastered after 50 correct presses at 94% accuracy or better. Once most of your keys are mastered, the Type Case suggests the next two to learn, in the order typing courses usually teach them.

### Settings

- **Text size:** Normal, Large or Larger. The larger sizes use every other line on the page.
- **Colors:** Classic paper, High contrast or Night.
- **Motion:** match your system, reduced, or full.
- **Holiday looks:** on or off (see **Holidays**).
- **Sound effects:** volume and mute. The sounds are synthesized in the browser, so there are no audio files.

Settings are stored in your browser's localStorage.

### Saving

Your keys, presets, difficulty, best scores, per-key typing stats and notebook progress are saved in your browser (IndexedDB). Progress is saved at the start of each page, so **C** resumes from the page you reached. Drips show the keys you miss most a little more often.

## Development

Requires Node 20+ (CI uses Node 24).

```bash
npm install
npm run dev        # start the dev server
npm run check      # typecheck + lint + tests
npm run build      # production build into dist/
npm run words:build  # regenerate the bundled word pack and blocklist
npm run preview    # serve the production build locally
```

To serve the game from a sub-path, set the base path when building, e.g. `INKY_KEYS_BASE=/inky-keys/ npm run build`.

### Deploying

The game is published to **https://inkykeys.com/** by `.github/workflows/deploy.yml`, which builds and deploys to GitHub Pages on every push to `main`. You can also run it by hand from **Actions → Deploy → Run workflow**. One-time setup: **Settings → Pages → Source: GitHub Actions**, and **Custom domain: inkykeys.com** with **Enforce HTTPS**. The domain is registered with Cloudflare, whose DNS (set to DNS only, not proxied) points it at GitHub Pages. Besides the game, the build has a few plain pages for people and search engines: **How to play** (`/how-to-play/`), **For parents and teachers** (`/parents-and-teachers/`), **Privacy** (`/privacy/`, made from `PRIVACY.md`), a 404 page and `sitemap.xml`. Their text lives in `site/en/`, and `scripts/site-pages.ts` wraps it in one layout for the dev server and the build. `index.html` carries the title, description, link-preview tags and structured data; the preview picture `public/social-card.png` and the install screenshot come from `npm run snapshots -- public social`. The build is a static site, so any static host works too: serve the `dist/` folder from `npm run build` over HTTPS, with `INKY_KEYS_BASE` set to the path it's served from.

The service worker is only registered in production builds. Use `npm run build && npm run preview` to try offline mode locally.

`npm run icons` (or `python3 scripts/make-icons.py`) redraws the app icons.

`npm run transcript` exports this project's Claude Code sessions to [docs/transcripts](docs/transcripts/README.md) as Markdown. It removes email addresses, one-time codes and the home folder path, but read the result before committing it.

### Search engines

Once per site, outside the code: verify **inkykeys.com** in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters) with a **Domain** property, which asks for a DNS TXT record (add it in Cloudflare's DNS, DNS only). Then submit `https://inkykeys.com/sitemap.xml` in both. No verification file or meta tag is needed in the repo, and nothing is added to the game.

### Checking page speed

[Lighthouse](https://developer.chrome.com/docs/lighthouse) measures the built site the way search engines do (a slow phone on a slow connection). Build and preview, then run it in another terminal:

```bash
npm run build && npm run preview
```

```bash
npx lighthouse http://localhost:4173/ --view
```

As of 2.19.0 the game page scores about 96 for performance and 100 for accessibility, best practices and SEO, and the web pages score 100 for all four. What keeps it fast: `index.html` paints a splash screen from its own inline styles before any script runs, and the game's small stylesheet is inlined into the page (`vite.config.ts`), so nothing blocks that first paint. Font preloads were tried and made it slower, because on a slow connection they compete with the script the menu needs.

Since 2.19.1 the menu also doesn't wait for the word pack: its download starts once the menu is showing, and anything that needs words (starting a page, the Type Case's word count, Word lists, a challenge name) waits for it through `withWords` in `src/main.ts`. PixiJS's browser setup is bundled with the game (`import 'pixi.js/browser'` in `src/render/renderer.ts`) instead of being fetched during start-up. On a throttled slow phone connection (`npx lighthouse … --throttling-method=devtools`), the `inky-keys:menu-ready` timing went from about 5.35 s to 4.3 s.

### Project layout

| Path | What lives there |
|---|---|
| `src/core/` | Pure game logic (loop, world, typing/targeting, stats, tuning config). No DOM or Pixi, so it's unit tested with Vitest. |
| `src/content/` | Word pool, fallback string generator, profanity guard, and per-locale content packs (`en/`). |
| `scripts/` | Build-time tools: the word pack, the app icons and the transcript export. |
| `docs/transcripts/` | The Claude Code conversations that built the game. |
| `src/storage/` | Save format and migrations, IndexedDB storage, and progress tracking. |
| `site/` | The website's plain pages (text in `site/en/`, styles in `site/site.css`), built by `scripts/site-pages.ts`. |
| `src/ui/` | DOM screens: the main and pause menus, How to play, and the Type Case, Word lists, Manage saves and Settings dialogs. |
| `src/audio/` | Synthesized sound effects (Web Audio API). |
| `src/input/` | DOM keyboard listener that turns key presses into game actions. |
| `src/i18n/` | UI strings and the `t()` lookup (English only for now). |
| `src/render/` | PixiJS rendering: page, targets, Nib, effects, HUD and overlays. Reads game state, never changes it. |
| `src/main.ts` | Wires the fixed-timestep loop to the renderer. |

## License

Code is [MIT](LICENSE). Bundled third-party content (word list, blocklist) and its licenses are listed in [CREDITS.md](CREDITS.md).
