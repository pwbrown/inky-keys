# Inky Keys: Requirements

> Name: **Inky Keys**. Theme and art direction are in [DESIGN.md](DESIGN.md).
> Status: Draft v0.1 (2026-11-12)

This doc is the source of truth for what the game must do. It is organized so the game can be built one milestone at a time (§13).

---

## 1. Vision

This is an arcade typing game inspired by *Typer Shark*. The player sits on the **left** side of the screen, and targets carrying text drift in from the **right**. Typing a target's text destroys it. A target that reaches the player does damage.

**What makes it different:** the player chooses exactly which keys they want to practice, by individual key or by whole region. Every piece of content the game makes uses only those keys, so the game grows with the player as they learn.

### Guiding principles
- **Adaptive by design.** All content respects the player's key selection.
- **Offline-first.** It runs fully in the browser with no server.
- **Private.** No data ever leaves the device.
- **Hackable.** Built on plain web tech that is easy to edit and tune.

---

## 2. Core Gameplay

| Element | Requirement |
|---|---|
| **Player** | A character or object fixed on the left edge. It has health or lives (decided in design). |
| **Targets** | They spawn off-screen on the right, move left, and each carries a text payload. |
| **Targeting** | Typing the first character locks onto the closest target that starts with it. Later keystrokes go to the locked target until it is destroyed. Esc releases the lock (optional). |
| **Mistakes** | A wrong key counts as an error. It lowers accuracy, resets the score multiplier and costs points. It also costs a little ink (health), except on Relaxed and in the first Apprentice chapters, after which the cost ramps in; a mistake never takes the last of the ink. Tuned in `GAME_CONFIG.mistakes`. |
| **Recovery** | A long run of correct keys restores a little ink, and when the well is low an ink bottle may cross the page: type it to refill. Both get stingier in later chapters (`GAME_CONFIG.recovery`). |
| **Collision** | A target that reaches the player deals damage and is removed. |
| **Structure** | Campaign → Levels → Waves. **Each wave contains a single target type.** |
| **Summaries** | A short summary screen appears between waves and levels, showing WPM, accuracy, score and the most-missed keys. |

---

## 3. Target Types

| ID | Name | Payload | Skill trained | Phase |
|---|---|---|---|---|
| **T1** | Word target | A word, or a string of allowed keys when no words fit | Typing sequences | MVP |
| **T2** | Character target | One character (letter, digit or symbol) | Single-key recall, reaction time | MVP |
| **T3** | Phrase target | Several words or a sentence. Errors stay in the buffer and **must be fixed with Backspace** | Accuracy and correction | Post-MVP |
| **T4** | Correction target | A misspelled word shown in an editable field. Fix it with **arrow keys plus Backspace/Delete** | Cursor navigation and editing | Post-MVP | *(Removed in milestone 17.)*

### Input models
- **Match mode (T1, T2):** each keystroke is checked against the next expected character.
- **Buffer mode (T3, T4):** the target keeps a text buffer with a cursor. It is complete when the buffer equals the target text.

The input layer must let both models plug in behind a common interface.

---

## 4. Difficulty Model

### Tunable parameters
- Target speed
- Spawn interval
- Maximum targets on screen at once
- Payload complexity: length, use of rare keys, shift/symbol density
- Wave length (number of targets)

### Scaling factors
1. **Campaign difficulty.** Chosen before a new campaign starts (e.g. *Relaxed / Normal / Hard / Expert*). It sets the base values.
2. **Level progression.** Difficulty rises slightly from one level to the next.
3. **Wave progression.** Difficulty rises slightly from one wave to the next inside a level.

```
param = clamp(
  base[difficulty][param]
    × (1 + levelStep × levelIndex)
    × (1 + waveStep  × waveIndex),
  min, max)
```

- All constants live in **one config file**, so tuning needs no code changes.
- *Later (optional):* nudge difficulty up or down based on recent accuracy.

---

## 5. Key Selection (Core Differentiator)

- The setup screen shows an **interactive on-screen keyboard**, starting with the US QWERTY layout.
- The player can toggle **individual keys** or whole **regions**:
  - Lowercase letters, uppercase letters
  - Home row, top row, bottom row
  - Left hand, right hand
  - Digits
  - Unshifted symbols, shifted symbols
  - Space
- Built-in **presets** (e.g. "Home row", "Left hand", "Numbers only"), plus **custom presets** the player can name and save.
- The selection is stored per profile and per campaign.
- The selection is **by character** (`KeyboardEvent.key`), so `a`/`A` and `1`/`!` are separate choices. Shifted characters show their physical key with a Shift indicator.
- **Validation:** the game warns when a selection is too small for some target types. For example, if no real words are possible, T1 falls back to generated strings (§6).

---

## 6. Content Generation

### Word pool
- Ships with a bundled, **profanity-filtered English word list** of about 50k+ words, each tagged with length and frequency.
- At runtime the list is filtered to words made **only** of the selected characters.
- **Complexity ranking:** candidate words are scored by length, word frequency and per-key difficulty, so harder waves draw harder words.

### Fallback generator
- If the number of matching words falls below a configurable threshold, T1 builds pseudo-random strings from the selected keys.
- When vowels are available, generation favors pronounceable patterns (consonant-vowel mixes).

### Explicit-content guard
- **Every** string is checked against a blocklist before use, whether generated, bundled, imported or fetched.
- The check covers **substrings** and common **leetspeak/symbol substitutions** (e.g. `@`→`a`, `1`→`i`, `$`→`s`).
- A string that fails is thrown away and replaced.

### Per target type
- **T2:** characters are sampled from the selected keys, with **extra weight on the player's most-missed keys** (from local stats).
- **T3 (post-MVP):** phrases come from a bundled phrase/sentence list filtered the same way, or are built from matching words.
- **T4 (post-MVP):** misspellings are made by applying swap, drop, duplicate or replace operations to matching words. *(Misprints were removed in milestone 17.)*

### Optional vocabulary fetch (post-MVP)
- The **player** starts it from settings, and only while online.
- The request asks only for words. It sends no identifiers, cookies or player data.
- Fetched words go through the same filters and are cached locally.
- The game **never depends** on this feature.

---

## 7. Platform & Tech

| Area | Choice |
|---|---|
| Language / build | **TypeScript + Vite** |
| Play-field rendering | **PixiJS** (WebGL, with Canvas fallback) |
| Menus, settings, keyboard picker | Plain DOM/HTML/CSS |
| Offline | **PWA**: a service worker precaches every asset (code, word lists, fonts, art, audio) |
| i18n | Translation layer (`t()`), per-locale message files and content packs, data-driven keyboard layouts (§11) |
| Testing | **Vitest** for game logic and content generation |
| Target devices | Desktop browsers with a physical keyboard. Mobile is out of scope. |

### Architecture notes
- **Fixed-timestep** game loop.
- Game logic (state, spawning, input matching, difficulty, content generation) is **separate from rendering**, so it can be unit tested without a canvas.
- Runtime makes no CDN calls. Everything is bundled.

---

## 8. Persistence

- **All state stays on the device.**
  - **IndexedDB** holds profiles, campaign progress, key presets, imported or cached words, and per-key stats.
  - **localStorage** holds small UI settings (volume, font size and so on).
- The save schema is **versioned**, with forward migrations.
- **Export and import** a save as a JSON file, for backups and moving between machines.

---

## 9. Privacy (Hard Requirement)

- **No** analytics, telemetry, crash reporting, ads, tracking pixels or third-party scripts.
- **No** network requests except the optional vocabulary fetch the player starts (§6).
- Per-key accuracy stats exist only for in-game adaptation and display, and **never leave the device**.
- A strict **Content Security Policy** is enforced.
- When hosted, the host's own access logs are disclosed in a privacy note (§12).

---

## 10. Accessibility & Comfort

- Pause at any time.
- Adjustable font size.
- Colorblind-safe palette.
- Reduced-motion mode.
- Volume controls and a mute toggle.

---

## 11. Internationalization (Future-Ready)

English is the only language at launch, but the game is built so new languages can be added later without refactoring.

### UI text
- No hard-coded user-facing strings. All UI text goes through a translation function (e.g. `t('menu.start')`) backed by per-locale message files (`src/i18n/en.json`).
- Use ICU-style messages for plurals and interpolation. Format numbers and dates with `Intl`.
- The locale is chosen in settings and saved locally. It defaults to the browser language when supported and falls back to English.
- Layouts must allow for longer translated strings, and right-to-left support should not be ruled out (use CSS logical properties).

### Content (typing material)
- Word lists, phrase lists and blocklists are **per-locale content packs** (e.g. `content/en/words.json`, `content/en/blocklist.json`), not one global list.
- Content generation (§6) treats characters as Unicode grapheme clusters, not bytes or UTF-16 units, so accented and non-Latin characters work.
- The explicit-content guard runs against the active locale's blocklist (and its substitution rules).

### Keyboard layouts
- Keyboard layouts are **data**, not code: each layout is a definition file describing rows, keys and the characters each key produces (plain, Shift, and later AltGr/dead keys).
- US QWERTY shipped first; Dvorak and Colemak followed in M16. Other layouts (AZERTY, QWERTZ, UK, …) can be added as new layout files. Each layout also carries its Apprentice key order (the same number of chapters on every layout).
- The layout is chosen per player and kept in their save, since the Apprentice course and key choices depend on it.
- Locale and keyboard layout are **independent** settings (e.g. English words on a Dvorak layout).

### MVP scope
- Only English and US QWERTY ship. The MVP still builds the structure: the `t()` layer, locale-keyed content folders and a layout definition format.

---

## 12. Licensing & Distribution

Inky Keys is **open source** and will be **publicly hosted** as a static web app.

### Licenses
| What | License | Notes |
|---|---|---|
| Source code | **MIT** (default; GPL-3.0 is the alternative if forks must stay open) | `LICENSE` at the repo root |
| Original art & audio | **CC-BY-4.0** (proposed) | Licensed separately from the code |
| Word & phrase lists | Must allow redistribution | e.g. ENABLE (public domain) or SCOWL-derived lists (permissive) |
| Profanity blocklist | Must allow redistribution | Or write and maintain our own |
| Fonts | SIL OFL or similar | e.g. Atkinson Hyperlegible |
| Third-party sounds/art | CC0 or CC-BY only | |

- Every third-party asset is listed with its source and license in **`CREDITS.md`**.
- No asset is added to the repo without a confirmed redistributable license.

### Hosting
- A static host with free HTTPS: **GitHub Pages** (default), Cloudflare Pages or Netlify.
- HTTPS is required for the service worker and PWA install.
- Vite's `base` setting must match the deploy path (e.g. `/inky-keys/` on GitHub Pages).
- The host must not inject analytics or third-party scripts.
- The same build must also work fully offline after first load, and locally through `vite preview`.
- **Search and link previews (milestone 27):** the game page has a descriptive title and description, a canonical URL, Open Graph and X card tags with a 1200×630 picture, and `VideoGame` structured data (JSON-LD). Plain HTML pages (How to play, For parents and teachers, Privacy) give search engines real text to read; `robots.txt` and `sitemap.xml` point at them. None of this adds scripts or third-party requests. Lighthouse SEO, accessibility and best practices stay at 100, and performance at 90 or more (milestone 28).

### Privacy on a hosted site
- The game collects nothing (§9). However, the **host keeps standard server access logs** (e.g. IP addresses), which are outside the game's control.
- Publish a short **privacy note** in the README and on the site that explains this, along with what the optional word fetch sends (§6).
- The CSP `connect-src` allows only the game's own origin, plus the one vocabulary API if that feature is enabled.

### Project & community
- `README.md` (pitch, how to play, how to run locally, privacy note), `LICENSE`, `CREDITS.md`, `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.
- **CI (GitHub Actions):** typecheck, lint and test on every PR. Deploy to the host on every push to `main`.
- **Good first contributions:** translations, keyboard layout files and word/phrase content packs (§11). These need contribution guidelines covering format, licensing and the blocklist check.

### Naming
- Local folder: `~/projects/inky-keys` (named after the repo; it was `~/projects/inkling` until 2026-11-16).
- Public identifier: **Inky Keys**, at inkykeys.com (see DESIGN.md §9).
- Do a trademark search before any commercial use.

---

## 13. Milestones

| # | Milestone | Scope |
|---|---|---|
| 1 | **Scaffold** | Vite + TS + PixiJS, fixed-timestep loop, one target moving across the screen, `LICENSE`, CI (typecheck/lint/test) |
| 2 | **Core loop (T2)** | Character targets, targeting, collision/damage, scoring |
| 3 | **T1 + word pool** | Bundled list, key filtering, fallback generator, explicit-content guard |
| 4 | **Progression** | Config-driven waves/levels/difficulty, campaign difficulty select |
| 5 | **Key-selection UI** | Interactive keyboard, regions, presets |
| 6 | **Persistence + PWA + deploy** | IndexedDB saves, export/import, offline service worker, auto-deploy to the static host, privacy note |
| 7 | **Polish** | Summary screens, per-key stats, accessibility settings, i18n string audit |
| 8 | **Post-MVP** | T3 phrases (Backspace), T4 corrections (arrows), optional vocabulary fetch, additional locales and keyboard layouts |

---

## 13b. Round 2 milestones (after playtesting)

| # | Milestone | Scope |
|---|---|---|
| 9 | **Menus** | Main menu with logo, pause menu (resume, restart page, settings, quit), retry chapter, How to play |
| 10 | **Readability** | Bundled Atkinson Hyperlegible fonts; shorter, later Run-ons |
| 11 | **Creatures** | Animated creatures with faces and moods; crimson/violet/ghost variants |
| 12 | **Campaign** | Apprentice course (10 chapters of new keys), stars, Contents page, notebook finish; Practice mode |
| 13 | **Rewards** | Ink (XP), levels and ranks, cosmetic unlocks on the Desk, the Blotter power, the Spill boss |
| 14 | **Players and looks** | Several players per browser, picture tiles on the Desk, distinct crimson/violet shapes; later a per-player word filter (replaced in milestone 24 by one family-friendly filter for everyone), the hands guide and the typewriter Type Case |
| 15 | **Character and teaching** | Game feel (Nib face, screen shake, damage flash, animated HUD, more sounds); mistakes cost points and ink; ink recovery; five powers unlocked over the course; briefings and guided first tries for every new mechanic (save version 7) |
| 16 | **Keyboard layouts** | Dvorak and Colemak beside US QWERTY, chosen per player (save version 8); the Apprentice course, Type Case, hands guide, finger hints and presets follow the layout |

## 13c. Round 3 milestones (Free Write first)

| # | Milestone | Scope |
|---|---|---|
| 17 | **First impressions** | Practice renamed Free Write and listed first; Misprints removed; new players start on letters, capitals and space; Main menu link on the page-cleared card; ink-bar rings fade properly; a spacebar briefing; How to play with pictures |
| 18 | **Waves and pacing** | Targets zoom in until fully on the page; Scrawlers are the main wave; numbers and symbols get their own pages; a 1-second grace after the Eraser; Blotter charges harder to earn on higher difficulties |
| 19 | **Bosses** | Four new bosses (Shuffler, Bookworm, Inkwell Squid, Rival Quill) beside the Spill, rotating at the end of each chapter, earlier in the Apprentice course and in Free Write |
| 20 | **Score that matters** | The Daily Page: a seeded three-page notebook, the same for everyone on a layout each day, on Normal with a boss that changes daily; only the first go counts; streaks; copy a short text result to share (no network). Graded pages break the score down (keys, combo, highlighter) and compare with the best score for that page; Apprentice chapters show their best (save version 9) |
| 21 | **Stickers** | A sticker book (K on the menu) of 26 achievements on six shelves: pages, speed, bosses, the Apprentice course and ranks, the Daily Page, and two secrets. Earned when they happen, with a toast and a line on the card; progress made earlier counts. Thresholds in `GAME_CONFIG.stickers` (save version 10) |
| 22 | **Challenges** | Copied Daily results end with a challenge link (`#c=…`: the day, layout, score, page grades and, only if ticked, the player's name). Opening one offers the same seeded notebook with a "To beat" target on the HUD and the result on the card; today's counts toward the streak if not yet played. (A share picture was added here and removed in milestone 24.) |
| 23 | **Transfer links** | Manage saves can copy a link holding the player's name, badge and save (compressed with the browser's `CompressionStream`, after `#t=`, without downloaded word lists). Opening it offers to add the player or, after a second confirmation, replace the current one. The save is checked as an imported file is; damaged links, newer versions and oversized saves get clear messages, and the backup file stays for anything too big for a link |
| 26 | **Holidays** | Thanksgiving (two weeks before through the Sunday after) and December looks by the player's local date: page decor, hats and trimmings on creatures, the scribe and the logo, and holiday words on some Scrawler pages (never the Daily Page). Two holiday stickers bring Desk keepsakes to keep: a Nib hat slot (pilgrim, Santa) and Harvest and Winter papers (save version 12). A **Holiday looks** setting turns the seasonal dressing off |
| 27 | **SEO** | Title, description, canonical URL, link-preview tags and a social card picture, `VideoGame` JSON-LD and a `<noscript>` summary on the game page. Static pages for How to play, For parents and teachers and Privacy (from `PRIVACY.md`), a 404 page, `robots.txt` and `sitemap.xml`, all precached for offline. Richer install manifest (categories, screenshot). About links to the pages. Lighthouse 100 for SEO, accessibility and best practices |
| 28 | **Fast start** | A splash screen painted from `index.html` alone (logo on the desk, removed once the menu is ready) and the game's stylesheet inlined, so nothing blocks the first paint. Lighthouse mobile performance went from 74 to about 96 (first paint 3.9 → 2.0 s, largest paint 4.5 → 2.4 s, no layout shift). Font preloads and a separate PixiJS chunk were tried and dropped: both made the first download slower. 2.19.1: the word pack downloads after the menu is showing (word-dependent actions wait for it) and PixiJS's browser setup is bundled, so the menu is ready about 1 s sooner on a slow phone connection (5.35 → 4.3 s) |
| 29 | **Keyboards and nudges** | A one-time "Made for a keyboard" card on touch-only devices (play anyway; remembered per browser). New players start on All letters (letters, capitals, space). "Ready for more?": in Free Write from chapter 5, a chapter with every page at A or A+ offers the Everything keys and/or the next difficulty, from the next page, in the same notebook; Not now waits three chapters, and it can be turned off per player (save version 13). A "Getting the words ready…" note if something waits on the word pack |
| 30 | **Readable hits** | Playtest feedback: a short bar under every capital letter on creatures (Drips, Scrawlers, bottles, Run-ons), tuned in `GAME_CONFIG.capitalTick`; creatures no longer squash on each correct letter or shake when they lose a life, only when they're beaten |

### Daily Page and sharing (milestone 20)
- **Same for everyone:** the Daily Page's seed comes from its number (days since the first one, by the player's local date) and the keyboard layout. Each spawn, extra life and boss word draws from its own seeded stream, so how a player plays (bottles, misses) never changes what comes next. Its words come from the bundled list (family-friendly filter, like everywhere else), with every key the Apprentice course teaches and no weak-key weighting or downloaded words.
- **One go:** the first finish of the day counts, including running out of ink or leaving part way; restarting a page is off on that go. Later goes are practice.
- **Sharing:** the result is plain text copied to the clipboard; nothing is sent anywhere. Scores aren't verified, so there are no public leaderboards.
- **Challenge links (milestone 22):** everything after `#` stays in the browser. Links are checked field by field when opened, names are cut to letters, numbers and spaces and dropped if the word filter objects, and a name is only included when the player ticks the box.
- **Transfer links (milestone 23):** a save moves between devices in a link's #fragment, which the host never sees. There's no merging: the receiving device adds the player alongside its own, or replaces one player's save after asking twice.

## 13d. Round 4 milestones (languages)

Milestone 31 was Fair Copy (2.23.0–2.27.0). French and Spanish come in three milestones: the keyboard groundwork ships first, on its own (a French child can learn English words on AZERTY), then French builds the language system and accent teaching, then Spanish adds a second language on top. The guidance follows David Bailly's *Typing games: how and why?* (the "Bringing the game to a larger audience" section): let players choose the menu language and the typing language separately, count accents by key presses, keep accents rather than letting `e` stand for `é` (except as an accessibility option), and never tie a mechanic to a key position that moves on other keyboards.

| # | Milestone | Scope |
|---|---|---|
| 32 | **Keys beyond A–Z** | Typed characters come from a hidden text field (`beforeinput`/composition), so dead keys, AltGr and Mac Option keys work; `keydown` keeps Enter, Backspace, arrows, Escape and shortcuts. A dead key is never a miss and shows the waiting accent beside the nib. Typed text is NFC-normalized, so every French and Spanish letter is a single character. The layout format gains AltGr levels, dead keys, a compose table and ISO keys (`IntlBackslash`); **AZERTY (France)** and **Spanish (Spain) ISO** layouts, each with a 27-chapter Apprentice course (AZERTY teaches the comma where QWERTY teaches the semicolon; Spanish teaches ñ there). A Mac variant of AZERTY moves a few symbols; on a Mac the AltGr level is left out. The 1/2/3 power keys and the 1–4 difficulty picker read `event.code`, so they work without Shift. A device setting picks Mac or Windows/Chromebook key help (detected locally). English words only |
| 33 | **Français** | A device-wide **Menu language** and a per-player **Words language** (save version 16). French UI strings (`src/i18n/fr.ts`, typed so missing keys fail), plurals through `Intl.PluralRules`, translatable menu shortcut letters. Content packs per language (`src/content/packs.ts`); a French word list (CC BY-SA), blocklist with accent folding, December words, Fair Copy passages, French Wikipedia for downloaded words. **Accent teaching**: a second "Accents" part of the Contents page (é · è à ù · ç · â ê î ô û · ë ï ü), just-in-time briefings and key-sequence tags, an accent help card and page, a "Letters + accents" preset, an Accents strip in the Type Case, and a **Forgiving accents** option. The Daily Page, challenge links and Fair Copy bests follow the words language. Pages in `site/fr/`. A native speaker reviews before release |
| 34 | **Español** | Spanish UI strings and content pack (á é í ó ú ü ñ), Navidad words, Spanish Wikipedia, Fair Copy passages with `¿ ¡`, Spanish accent chapters (ñ · á é · í ó ú · ü · ¿ ¡), pages in `site/es/`. A native speaker reviews before release |

### Typing accents (milestones 32–34)
- **How each accent is typed** comes from `howToType(char, layout, platform)` in `src/core/accents.ts`, a list of key steps the hands guide, briefings and help card all draw from:
  - **AZERTY:** `é è ç à ù` are their own keys; `^` and `¨` are dead keys (`^` then `e` = `ê`).
  - **Spanish ISO:** `ñ` is its own key; `´` is a dead key (`´` then `a` = `á`), Shift+`´` gives `¨`; `¡` and `¿` are right of 0.
  - **US keyboard on a Mac:** Option+e then a letter (acute), Option+\` (grave), Option+i (circumflex), Option+u (diaeresis), Option+n then n (`ñ`), Option+c (`ç`), Option+1 (`¡`), Option+Shift+/ (`¿`).
  - **US keyboard on Windows or a Chromebook:** the US-International layout (`'` then a letter, `` ` ``, Shift+6, Shift+', AltGr+n, AltGr+, …). The help card explains how to turn it on, and a hint suggests it when an accent is tried and no dead key arrives.
- **Taught, then required.** A word is only offered if every letter, accents included, is in the selected keys, so early chapters naturally avoid accents. Accented letters come in their own chapters, each opening with a numbered, animated key sequence (still steps with reduced motion). The first meeting with an untaught accent anywhere else gets a short briefing and a slowed guided try; a miss on an accented letter shows its key steps on that creature.
- **Forgiving accents** (per player, off by default) lets `e` count for `é`; the word still shows its accent. Daily results note when it was on.
- **Key presses count.** Word difficulty and creature pacing add the extra presses an accent needs on the player's setup (`GAME_CONFIG.accents`). Words with `œ`, `æ` or `ÿ` are left out, and an accented capital is never asked for where it can't be typed (e.g. `É` on Windows AZERTY).

### Languages (milestones 33–34)
- **Two settings.** Menu language is per device (defaults to the browser language, falls back to English). Words language is per player, saved like the layout. Menu language, words language and layout are all independent.
- **Content packs** follow `src/content/en/` and load lazily. Word lists need word frequencies and a redistributable license; CC BY-SA is accepted for the word data (code stays MIT), credited in `CREDITS.md`. Blocklists come from LDNOOBW, and the check folds accents so accented spellings can't slip past.
- **Fair Copy passages** are public-domain texts in the original language, with accents and plain punctuation (straight quotes, no guillemets, no non-breaking spaces before `; : ! ?`). Spanish passages keep `¿ ¡`. Bests are per language; Bookworm counts every passage in any one language.
- **The Daily Page** seed adds the words language for languages other than English (English seeds don't change). French and Spanish Daily Pages include the common accents. Challenge links carry the language in an optional field; older links mean English.
- **Holidays:** Thanksgiving looks and words stay English-only; December is in every language.
- **Downloaded words** use the Wikipedia for the words language. Each new origin is added to the CSP's `connect-src`, `PRIVACY.md` and `CLAUDE.md`; the request still sends only the topic.
- **Translations** are drafted by Claude and reviewed by a native speaker before each language is released. Menus are checked at phone width, since French and Spanish run about a quarter longer than English. The bundled fonts are checked for `ç`, `ñ`, `¿`, `¡`, `€` and accented capitals.
- **Pages** are copied to `site/fr/` and `site/es/` (with Privacy and an accent help page), linked with `hreflang` and listed in `sitemap.xml`.

## 14. Open Questions / TODO

- [x] **Theme, art direction and audio.** See [DESIGN.md](DESIGN.md) (Inkwell direction). Name: **Inky Keys**.
- [ ] Health or lives? (DESIGN.md proposes an ink-reservoir health meter.) Does game-over restart the level or the campaign?
- [x] Which additional locales to add first? French (milestone 33, with AZERTY) and then Spanish (milestone 34, with Spanish ISO), after the keyboard groundwork in milestone 32. See §13d.
- [x] French word list: Lexique 3.83 (CC BY-SA 4.0, film and book frequencies), milestone 33. See CREDITS.md.
- [ ] Spanish word list: which source has word frequencies and a redistributable license? CC BY-SA is acceptable. Candidates: a Hunspell dictionary plus a subtitle frequency list. Check the license before anything is added.
- [ ] Text input: does a hidden text field (`beforeinput`/composition) behave the same in Chrome, Safari and Firefox on macOS and Windows? Spike at the start of milestone 32. Windows (AltGr, US-International) needs a Windows machine or a tester.
- [ ] Who reviews the French and Spanish translations? Milestone 33's French (`src/i18n/fr.ts`, `site/fr/`, the US-International setup steps; the Fair Copy passages were checked against Wikisource) waits for a native speaker before its release tag.
- [ ] Spanish layout: Spain ISO first, or Latin American (more common in the Americas)? Canadian French (CSA) and Swiss layouts can come later as new layout files.
- [ ] Later layouts: QWERTZ and UK.
- [x] Word-list source: SCOWL levels 10–50 (via `wordlist-english`) plus the LDNOOBW blocklist. See CREDITS.md.
- [x] Vocabulary API: Wikipedia (`en.wikipedia.org/w/api.php`, search + plain-text extract). No key, CORS via `origin=*`, sends only the topic; words are picked on the device. Replaced Datamuse in 2.15.0, which needs an API key from February 2027. See PRIVACY.md.
- [ ] Confirm the code license (MIT vs GPL-3.0) and the art/audio license.
- [ ] Pick the public repo/site name (§12). Host: GitHub Pages via `.github/workflows/deploy.yml` (any static host works).
- [x] An endless or practice mode alongside the campaign? Yes: Free Write (formerly Practice), listed first since milestone 17.
