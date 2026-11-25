# How Inky Keys grew

> The game was called **Inkling**, and its word creatures **Blotlings**, until 2026-11-15. The screenshots and notes below keep the names each version used.

Screenshots of Inky Keys at the end of every milestone, from the first moving blob to today. Each one comes from a real build of that milestone's commit, played in headless Chrome by `npm run snapshots` (see [Keeping this up to date](#keeping-this-up-to-date)).

The first half puts **the same screen side by side** across versions, so you can see what changed. The second half goes **milestone by milestone**, saying what each one added.

A note on the pictures: an auto-typer plays the pages, so the grades are all A+. The **lineup** shots are staged. They swap the creatures on screen for one of each kind (a drip, a Blotling, a crimson, a violet, a Run-on and a Misprint), so creature looks can be compared even in versions where those creatures only show up chapters later.

## Side by side

### Creatures on the page

| M1 | M2 | M3 |
|---|---|---|
| <img src="m01/play.png" width="280" alt="M1: one placeholder blob labelled 'page'"> | <img src="m02/play.png" width="280" alt="M2: single-letter ink drips"> | <img src="m03/play.png" width="280" alt="M3: Blotlings carrying words"> |
| One placeholder blob with a word. No typing yet. | **Drips:** letters to type, plus the ink bar and score. | **Blotlings:** real words built from your keys. |

| M8 | M11 | M14 and later |
|---|---|---|
| <img src="m08/lineup.png" width="280" alt="M8 lineup: flat navy shapes, Run-on and Misprint as text"> | <img src="m11/lineup.png" width="280" alt="M11 lineup: creatures with faces, crimson and violet colors, centipede Run-on, stamp Misprint"> | <img src="m14/lineup.png" width="280" alt="M14 lineup: spiky horned crimson, crowned violet"> |
| Run-ons and Misprints arrive, but every target is still a flat shape. | **Faces and bodies:** eyes, legs, a centipede Run-on, a stamp Misprint. Crimson and violet variants. | **Distinct variants:** crimson gets spikes and horns, violet a crown, a third eye and a wavy hem. |

### Font

| M9 | M10 |
|---|---|
| <img src="m09/menu.png" width="420" alt="M9 menu in the system font"> | <img src="m10/menu.png" width="420" alt="M10 menu in Atkinson Hyperlegible"> |
| System font. | **Atkinson Hyperlegible** everywhere, so `l I 1 \|` and `0 O` look different. |

### First screen

| M2 | M4 | M5 | M8 |
|---|---|---|---|
| <img src="m02/start.png" width="210" alt="M2 start card"> | <img src="m04/start.png" width="210" alt="M4 New notebook with difficulty"> | <img src="m05/start.png" width="210" alt="M5 New notebook showing the keys"> | <img src="m08/start.png" width="210" alt="M8 New notebook with four shortcuts"> |
| "Press Enter to start". | **Difficulty** picker. | Shows **your keys**, with Change keys (K). | Shortcuts pile up: keys, word lists, saves, settings. |

| M9 | M12 | M13 | M14 | Latest |
|---|---|---|---|---|
| <img src="m09/menu.png" width="170" alt="M9 main menu"> | <img src="m12/menu.png" width="170" alt="M12 menu with Apprentice and Practice"> | <img src="m13/menu.png" width="170" alt="M13 menu with Desk and rank"> | <img src="m14/menu.png" width="170" alt="M14 menu with player badge and About"> | <img src="latest/menu.png" width="170" alt="Latest menu"> |
| A real **main menu** with a logo replaces the card. | **Apprentice** and **Practice** replace New notebook and Choose keys. | **Desk** button, and your rank and ink along the bottom. | **Player** badge and **About**. The course is now 27 chapters long. | **Free Write** (formerly Practice) comes first, with a **Daily Page** (M20) and a **Sticker book** (M21). Since M24, a **tile grid** with an icon on each tile. |

### Type Case (choosing keys)

| M5 | M7 | M10 | Latest |
|---|---|---|---|
| <img src="m05/type-case.png" width="210" alt="M5 Type Case, wooden keyboard"> | <img src="m07/type-case.png" width="210" alt="M7 Type Case with mastery bars"> | <img src="m10/type-case.png" width="210" alt="M10 Type Case in the new font"> | <img src="latest/type-case.png" width="210" alt="Latest Type Case styled as a typewriter"> |
| Wooden keyboard with two-part keys, presets and groups. | **Mastery bars** under each key that fill as you practice. | New font. | **Typewriter:** black enamel, gold pinstripe, round chrome keys. A **My Apprentice keys** preset. |

### End of a page

| M2 | M7 | M12 | M13 | M15 | M17 | M20 | M24 | M25 |
|---|---|---|---|---|---|---|---|---|
| <img src="m02/page-done.png" width="140" alt="M2 page complete card"> | <img src="m07/page-done.png" width="140" alt="M7 graded page with A+"> | <img src="m12/page-done.png" width="140" alt="M12 page with stars"> | <img src="m13/page-done.png" width="140" alt="M13 page with ink and level up"> | <img src="m15/page-done.png" width="140" alt="M15 page with handwritten title, drawn stars and best run"> | <img src="m17/page-done.png" width="140" alt="M17 page card with a Main menu (M) link"> | <img src="m20/page-done.png" width="140" alt="M20 page card with a points line: 490 for keys + 175 combo"> | <img src="m24/page-done.png" width="140" alt="M24 page card with score, WPM, accuracy, combo and best run in boxes"> | <img src="m25/page-done.png" width="140" alt="M25 page card over a page filled with faint cursive"> |
| Score, WPM and accuracy. | A **red-pen grade** and a teacher's note. | **Stars** (1 to 3). | **Ink** earned, level-ups and unlocks. | **Handwritten** title and grade, stars that fill in one by one, wrong keys and the best run. | A **Main menu (M)** link, so you can stop without starting the next page. | A **points** line: what came from the keys, the combo and the Highlighter. | The numbers in **boxes**, news as yellow pills. | The page behind is **filled with writing** by the scribe. |

### Starting a chapter

| M12 | Latest |
|---|---|
| <img src="m12/chapter-intro.png" width="420" alt="M12 chapter card listing 8 home-row keys"> | <img src="latest/chapter-intro.png" width="420" alt="Latest chapter card with hands on a keyboard"> |
| Chapter 1 of 10 teaches the whole home row at once, finger by finger. | Chapter 1 of 27 teaches just `f` and `j`, with a **hands guide**: the finger shaded, the key circled in red pen. |

### Settings and pause

| M7 settings | Latest settings | M9 pause | Latest pause |
|---|---|---|---|
| <img src="m07/settings.png" width="210" alt="M7 settings"> | <img src="latest/settings.png" width="210" alt="Latest settings"> | <img src="m09/pause.png" width="210" alt="M9 pause menu"> | <img src="latest/pause.png" width="210" alt="Latest pause menu"> |
| Text size, colors, motion, sound. | The same options in the new font. | Resume, Restart page, Settings, Quit. | Adds **Free Write with these keys** (F; added in M14 as Practice these keys). |

## Milestone by milestone

### M1: Scaffold

<img src="m01/play.png" width="420" alt="M1: one blob crossing a notebook page">

The notebook page, the red margin, the Nib, and one placeholder creature drifting across. Underneath: Vite, TypeScript, PixiJS and a fixed-timestep game loop.

### M2: Core loop

<img src="m02/play.png" width="420" alt="M2 gameplay with letter drips">

**New:** typing. Letter drips stream in, the Nib locks onto the nearest match, misses drain the **ink** bar, and a combo multiplier builds your score. A start card and a "Page complete" card frame each page.

### M3: Word pages

<img src="m03/play.png" width="420" alt="M3 Blotlings with words">

**New:** Blotlings, word-carrying creatures. Words come from a bundled 56,000-word list, filtered to only the keys you're practicing, with a profanity guard. Pages alternate drips and Blotlings.

### M4: Chapters and difficulty

<img src="m04/start.png" width="420" alt="M4 New notebook card with four difficulties">

**New:** Relaxed, Normal, Hard and Expert, and a notebook made of chapters of pages, each a little harder. The footer shows chapter and page.

### M5: Type Case

<img src="m05/type-case.png" width="420" alt="M5 Type Case keyboard">

**New:** pick exactly which keys to practice on a full keyboard. Click the top or bottom half of a key for its Shift or plain character. Presets (Home row, All letters, Code symbols…) and groups (left hand, top row…).

### M6: Saves and offline play

<img src="m06/saves.png" width="420" alt="M6 Save data dialog">

**New:** progress saved in the browser, with backups you can export and import. Works offline as an installable app. First deploy to GitHub Pages.

### M7: Grades, mastery, settings and sound

<img src="m07/page-done.png" width="420" alt="M7 graded page">

**New:** a red-pen grade on every page, mastery bars on the Type Case, a Settings dialog (text size, high contrast and night themes, motion, volume) and sound effects.

### M8: Run-ons, Misprints and word lists

<img src="m08/lineup.png" width="420" alt="M8 lineup with Run-on and Misprint">

**New:** Run-ons (phrases where mistakes stay until you Backspace them) and Misprints (typos you fix with the arrow keys). Tab switches targets. A Word lists dialog can download words about a topic you choose.

<img src="m08/word-lists.png" width="420" alt="M8 Word lists dialog">

### M9: Menus

<img src="m09/menu.png" width="420" alt="M9 main menu">

**Changed:** the start card becomes a **main menu** with a logo. **New:** a difficulty step before a new notebook, a pause menu (Resume, Restart page, Settings, Quit to menu) and How to play.

| New notebook | Pause |
|---|---|
| <img src="m09/new-notebook.png" width="320" alt="M9 new notebook difficulty step"> | <img src="m09/pause.png" width="320" alt="M9 pause menu"> |

### M10: Readability

<img src="m10/menu.png" width="420" alt="M10 menu in Atkinson Hyperlegible">

**Changed:** every bit of text switches to the bundled Atkinson Hyperlegible fonts. Run-ons get shorter and arrive later.

### M11: Creatures

<img src="m11/lineup.png" width="420" alt="M11 creature lineup">

**Changed:** targets become creatures. Drips bob, Blotlings scurry on legs, Run-ons are centipedes, Misprints hop like stamps. Their eyes follow the Nib and they look worried near the margin. **New:** crimson (two words) and violet (three words) variants, and invisible-ink ghosts.

### M12: Apprentice campaign

| Contents | Chapter card |
|---|---|
| <img src="m12/contents.png" width="320" alt="M12 Contents page"> | <img src="m12/chapter-intro.png" width="320" alt="M12 chapter intro"> |

**New:** **Apprentice**, a 10-chapter course that teaches keys in order, with a card per chapter showing which finger types each new key. Pages earn 1–3 stars, and the Contents page shows them. **Practice** is the endless mode with your own keys.

### M13: Rewards

| Desk | Page with ink |
|---|---|
| <img src="m13/desk.png" width="320" alt="M13 Desk with pens, inks and paper"> | <img src="m13/page-done.png" width="320" alt="M13 page complete with ink and level up"> |

**New:** **ink** (experience) from every page, levels and ranks from Scribbler to Master Inkling, and a **Desk** to equip unlocked pens, splatter inks and paper. The Blotter power and the Spill boss arrive too. A playtest round after this rebuilt Apprentice for beginners (27 chapters, starting with `f` and `j`) and added ink shots from the Nib.

### M14: Players and creature looks

| Who's writing? | Desk |
|---|---|
| <img src="m14/players.png" width="320" alt="M14 player picker"> | <img src="m14/desk.png" width="320" alt="M14 Desk with picture tiles"> |

**New:** several players can share one browser, each with their own save. The Desk shows pictures of each pen and ink. Crimson and violet creatures get their own shapes (see the lineup above), and beaten creatures show x x eyes.

### After M14

| Chapter card | Type Case |
|---|---|
| <img src="m15/chapter-intro.png" width="320" alt="Chapter card with hands (shown as of M15)"> | <img src="m15/type-case.png" width="320" alt="Type Case typewriter (shown as of M15)"> |

**New:** a per-player word filter (Family friendly, Older kids, Grown-ups), Blotlings from chapter 1 using made-up strings like `fjf`, the **hands guide** on chapter cards, and the **typewriter** Type Case. "Save data" became "Manage saves".

### M15: Character, consequences, powers and tips

| New on this page | A page in play |
|---|---|
| <img src="m15/briefing.png" width="320" alt="M15 briefing card explaining drips and mistakes"> | <img src="m15/play.png" width="320" alt="M15 page with the Nib's face"> |

**New:**
- **Character:** the Nib has a face that blinks, winces, gasps and grins. Creatures pop and squash as ink lands, grin when you mistype, and jitter slightly like hand-drawn animation. Drips flick and Blotlings soak into the page when beaten. The locked creature gets a red-pen underline.
- **Feedback:** the page shakes and its edge flashes red when ink is lost, and throbs when ink is low. The score counts up, the multiplier kicks and falls away when a run breaks, and there are 11 new sounds.
- **Consequences and recovery:** wrong keys cost points and, further on, a little ink. Ink comes back from clean runs and from a rare ink bottle.
- **Powers:** charges earned by clean runs, harder to earn in later chapters. The Paperweight (↑), Highlighter (↓) and Blotter (Enter) spend them; the Eraser and Blotting paper work by themselves. They unlock over the Apprentice course or by level.
- **Tips:** a "New on this page" card before anything new, then a guided first try with a handwritten note. Tips can be turned off or reset in Settings.

**Changed:** headings, grades and notes use the handwritten Caveat font. A "Screen effects: Gentle" setting softens shake and turns off the red flash.

### M16: Keyboard layouts

| Settings | Chapter 1 on Dvorak | Type Case on Dvorak |
|---|---|---|
| <img src="m16/settings-layout.png" width="260" alt="Settings with a Keyboard layout choice: US QWERTY, Dvorak, Colemak"> | <img src="m16/chapter-intro-dvorak.png" width="260" alt="Dvorak chapter card teaching u and h, hands resting on a o e u and h t n s"> | <img src="m16/type-case-dvorak.png" width="260" alt="Type Case typewriter with Dvorak keys and the Dvorak home row selected"> |

**New:**
- **Dvorak and Colemak** alongside US QWERTY. Each player picks a layout in Settings, and it's kept in their save (save version 8). Players from before M16 start on US QWERTY.
- The **Apprentice course follows the layout**. It starts on the index-finger home keys (F J, U H or T N), then the rest of the home row, then space and the other letters. Every layout has the same 27 chapters, so stars and progress stay put when a player switches.
- The Type Case keyboard, hands guide, finger hints, presets ("Home row", "Home row + E I / R L / U L") and "ready to learn" suggestions all use the player's layout. Switching layout carries a preset selection to the same preset on the new layout.

**Changed:** layouts are now built from one table of physical keys and fingering, with each layout giving only its characters (`src/content/layouts/`). On QWERTY, "ready to learn" now suggests keys in the Apprentice course's order, so E and I come after the home row rather than R and U.

### M17: First impressions

| Menu | How to play | Spacebar briefing |
|---|---|---|
| <img src="m17/menu.png" width="260" alt="Main menu with Free Write first, on Letters + capitals + space, 53 keys"> | <img src="m17/how-to-play.png" width="260" alt="How to play with a picture beside each creature"> | <img src="m17/briefing.png" width="260" alt="Briefing cards for drips and the spacebar, with a drip showing the space mark"> |

**New:**
- **Free Write** (formerly Practice) is first on the menu (F), and a new player starts on **Letters + capitals + space**, a new preset.
- A **spacebar briefing** the first time a page can show the ␣ mark, with a guided first space drip.
- **How to play** has pictures: each creature, the tougher inks, the Spill and the ink bottle, the player's keys on the hands guide, and key caps for the controls.
- The page-complete card has a **Main menu (M)** link.

**Changed:** **Misprints are gone** (the stamp creature, its briefing and the arrow-key editing), so the lineup ends with the Run-on. The yellow rings that marked ink coming back now hold for a moment and fade; before, they could get stuck on the ink bar until the screen was rebuilt.

### M18: Waves and pacing

No new screens this time: everything changed is in motion and in which pages come up, so there are no new shots.

**New:**
- **Zoom-in:** new creatures rush in from the right (up to 900 px/s), braking smoothly until their whole word is on the page, then crawl at their own pace. They never get closer than a small gap to the creature ahead in their lane.
- **Numbers and symbols get their own drip pages** in Free Write when the keys include at least three of them; letter drips never mix with them. With just one or two (like the home row's `;`), they stay mixed in as before.
- **Eraser grace:** for a second after the Eraser forgives a slip, further wrong keys are quietly ignored.

**Changed:**
- **Scrawlers are the main wave.** Free Write chapters are now mostly word pages with one letter-drip page (plus the symbols page, when there is one), and every chapter ends on words. Later Apprentice chapters are one drip page for the new key, then four word pages.
- **Charges are harder to earn on harder difficulties** (runs ×1.15 on Normal, ×1.35 on Hard, ×1.6 on Expert), and the **Blotter costs 3 charges on Hard and Expert** (still 2 on Relaxed and Normal).

### M19: Bosses

<img src="m19/how-to-play-bosses.png" width="420" alt="How to play's Bosses section: the Spill, the Bookworm with red-pen glasses, the Shuffler with chasing arrows, the crimson Inkwell Squid and the Rival Quill with its red race line">

**New:** four bosses beside the Spill, taking turns on the last page of each chapter:
- **The Bookworm:** short-word segments in one line, joined by necks, wearing reading glasses. Only the head can be typed; the rest speed up as it shrinks.
- **The Shuffler:** red arrows chase round its back, and its untyped letters swap places every few seconds.
- **The Inkwell Squid:** a crimson body guarded by three curling tentacle words. Tentacles left alone squirt a band of ink that hides a line of words for a few seconds.
- **The Rival Quill:** a red race line and a quill run along under its word; if the quill gets to the end first, it splashes you with ink and starts a new word.

**Changed:** bosses arrive much sooner: from chapter 3 in the Apprentice course (was 7) and from chapter 2 in Free Write (which had none). Boss parts are sized and spaced in the core, so drawing and spacing agree. Also fixed: a key set of a single letter could freeze the game on a word page.

### M20: Score that matters

<img src="m20/daily.png" width="420" alt="The Daily Page screen: a flaming ink drop with a 3 day streak, this week's boxes with Monday and Tuesday filled, page tiles A+, B and C, and the result text to copy">

(The streak in this shot is sample data, filled in by the snapshot script.)

**New:**
- **The Daily Page** (T on the menu): a three-page notebook that's the same for everyone on a keyboard layout each day, always on Normal, ending with a boss that changes daily. Only the first go counts; later goes are practice, and Restart page is off on the counted one.
- **Streaks:** an ink drop that turns into a flame while a streak is going (and sleeps when it's broken), with this week's days filled in where you played.
- **Copy result:** a short text with the score, each page's grade and colour, and the streak, for pasting anywhere. Nothing is sent over the network.
- **Best score per page:** the graded page says "New best for this page!" or how far short you were, and Apprentice chapters show their best in Contents.

**Changed:** graded pages break the score down into points for keys, the combo and the Highlighter. Seeded pages draw each creature from its own stream, so how you play never changes what comes next (save version 9).

### M21: Stickers

<img src="m21/stickers.png" width="420" alt="The sticker book: round stickers in shelves, earned ones in color with the date, the rest as faded dashed outlines with how to earn them">

(The stickers in this shot are sample data, filled in by the snapshot script.)

**New:** a **sticker book** (K on the menu) with 26 stickers on six shelves:
- **Pages:** first page, an A+, runs of 50, 100 and 200 keys, 10,000 points in a notebook, a clean margin on Hard or Expert.
- **Speed:** 30, 50 and 70 words a minute on a page (with at least 60 keys typed).
- **Bosses:** the first boss, a spotless boss page, and all five kinds.
- **Apprentice and ranks:** every star in a chapter, halfway, graduating, and levels 5, 12 and 23.
- **Daily Page:** the first one, a perfect day, and 3, 7 and 30 days in a row.
- **Secrets:** two hidden ones, shown as "?" until earned.

Stickers arrive the moment they're earned, with a toast in the corner that doesn't stop play and a line on the page card. New ones are marked until the book is opened. Progress from before stickers existed (level, the Apprentice course) earns its stickers on the next visit (save version 10).

### M22: Challenges

| Challenge link | Daily Page |
|---|---|
| <img src="m22/challenge.png" width="420" alt="A challenge screen: Pip scored 5,230 on Daily Page #1, with Pip's page grades and a Take the challenge button"> | <img src="m22/daily.png" width="420" alt="The Daily Page screen with the result text ending in a challenge link, a Sign my challenge link checkbox and a Share picture button"> |
| Opening a friend's link. (Sample data from the snapshot script.) | The copied result now ends with a link, and there's a **Share picture** button. |

**New:**
- **Challenge links:** the copied Daily result ends with "Beat my score:" and a link. The part after `#` carries the day, layout, score and page grades (and the player's name only if they tick **Sign my challenge link**), and browsers never send it to the server. Opening one offers the same seeded notebook, with a **To beat** target at the top of the page that ticks once it's passed, and the result on the last card. Today's Daily Page still counts toward the streak if it hasn't been played.
- **Share picture:** the result drawn as a 1200 × 630 notebook page (score, WPM, accuracy, page tiles, the streak flame), sent to the system share sheet, the clipboard, or a saved file.

**Changed:** links are checked field by field; names are cut to letters, numbers and spaces and dropped if the word filter objects. PRIVACY.md says what links and pictures contain.

### M23: Transfer links

| Manage saves | Opening a transfer link |
|---|---|
| <img src="m23/save-data.png" width="420" alt="Manage saves with a new Copy transfer link row and a warning to only send the link to yourself"> | <img src="m23/transfer.png" width="420" alt="A player from another device: Pip's badge, level and stickers, with Add as a new player and Replace buttons"> |
| A **Copy transfer link** row, with a warning to send it only to yourself. | Opening one. (Sample data from the snapshot script.) |

**New:** **transfer links** move a player to another device with no server. **Copy transfer link** in Manage saves compresses the player's name, badge and save (without downloaded word lists) into the part of a link after `#t=`, which browsers never send to the host. Opening it on the other device offers **Add as a new player** (numbered if the name is taken) or **Replace** the current player's progress, after a second confirmation. The save is checked just like an imported backup file; damaged links, saves from a newer version, and saves too big for a link each get a clear message.

### M24: Tidy-up

| Main menu | Page complete |
|---|---|
| <img src="m24/menu.png" width="420" alt="The main menu as a tile grid: Free Write and Daily Page, a wide Apprentice tile, Desk and Sticker book, then smaller Word lists, How to play, Settings, Saves and About tiles, each with a line icon and its shortcut key"> | <img src="m24/page-done.png" width="420" alt="A page card with Score, WPM, Accuracy, Combo and Best run in labelled boxes and a yellow +112 ink pill"> |
| A **tile grid** with hand-drawn icons and short status lines. | The numbers in **boxes** instead of lines of text. |

**Changed:**
- **Main menu:** a tile grid (Continue, then Free Write and Daily Page, Apprentice, Desk and Sticker book, then smaller tiles), each with a line icon in ink and red pen.
- **Page cards:** Page Complete, Game Over and Notebook Complete show Score, WPM, Accuracy and (when there are any) combo, highlighter, best run, wrong keys and leaks as boxes; news (new best, stickers, ink) as pills.
- **Inkwell Squid:** its tentacles stay attached by arms, and its body sits in a locked ink bubble that breaks a piece per tentacle and pops when the last goes. Tentacles flash red pen before they squirt, and the squirt is a stream and a smear, not a row of blots.
- **Type Case:** ten presets (Apprentice, Home row, Home + top row, All lowercase, All letters, Sentences, Numbers, Number-row symbols, All symbols, Everything) and five groups. Every preset but Apprentice includes Space, and new players start on Everything.
- **Less text:** How to play uses icon tiles and a powers grid, its keyboard picture drops the hands and red circles, and About, Settings, Saves, Word lists and the Daily Page say less.
- **Word filter:** one family-friendly filter for everyone; the per-player choice is gone (save version 11).
- **Removed:** the Daily share picture (copying the text and challenge link stays).
- **Fixed:** Enter on the main menu opens Continue or Free Write, not the player list; menu letters ignore typing carried over from play; shortcuts work after ticking the name box.

### M25: The manuscript and Wikipedia words (2.15.0–2.16.0)

| Playing | Page complete |
|---|---|
| <img src="m25/play.png" width="420" alt="A page with two Drips; below the last lane a small ink-drop scribe holds a quill beside the handwritten heading 'Chapter 1 of 27 · Page 1', and the footer reads 'Learning f j · Page 1 of 3 · 0/14'"> | <img src="m25/page-done.png" width="420" alt="The page complete card over a page whose lines are filled with faint, illegible cursive"> |
| The **scribe** writes the chapter heading on the page; the footer drops the chapter. | By the end of the page, the scribe has **filled every line** with faint cursive. |

| Word lists |
|---|
| <img src="m25/word-lists.png" width="420" alt="The Word lists dialog saying Inky Keys reads the Wikipedia article for a topic, and that only the topic is sent, to en.wikipedia.org"> |
| Words now come from the topic's **Wikipedia** article. |

**New:**
- **The manuscript:** a little ink-drop scribe sits below the last lane and fills the page with faint, illegible cursive as you clear it. The writing grows with each creature, not with time, so it finishes with the last one; on boss pages the last bit waits for the boss.
- **Blots and reactions:** a creature that reaches the margin blots the writing on its line. The scribe looks up when one gets close, winces when one gets through, and cheers when the page is done.
- **Page writing** setting (on/off). Off keeps the heading.
- The snapshot tour now includes the **Word lists** dialog.

**Changed:**
- **Word lists:** downloaded from the topic's Wikipedia article and ranked on the device, instead of Datamuse (which needs an API key from February 2027). The CSP allows only `en.wikipedia.org`.
- **Footer:** shows the page and progress; the chapter moved to the scribe's heading. It no longer goes below zero while a split Spill's Inkmites are on screen.

### M26: Holidays (2.17.0)

| Thanksgiving | Christmas |
|---|---|
| <img src="m26/lineup-thanksgiving.png" width="420" alt="The creature lineup in Thanksgiving dress: a drip with a leaf, Scrawlers with turkey tails, a violet Scrawler with a leaf on its crown, a Run-on in a pilgrim hat, a pilgrim-hatted scribe, and autumn leaves piled in the bottom-right corner"> | <img src="m26/lineup-christmas.png" width="420" alt="The creature lineup in Christmas dress: Santa hats on the drip, Scrawlers and Run-on, holly on the violet's crown, faint snowflakes drifting down and holly in the bottom-right corner"> |
| Leaves in the corner, **turkey tails** and **pilgrim hats**. | Holly, light snow and **Santa hats**. |

| Menu | Desk keepsakes |
|---|---|
| <img src="m26/menu-christmas.png" width="420" alt="The main menu with a Santa hat on the logo's ink drop"> | <img src="m26/desk-holidays.png" width="420" alt="The Desk's paper choices with Harvest and Winter papers, and a new Hat row: No hat, Pilgrim hat and Santa hat on the fountain nib"> |
| The logo wears the season's hat too. | **Harvest** and **Winter** paper, and a **Hat** row for the pen. |

**New:**
- **Holiday looks** around Thanksgiving (two weeks before through the Sunday after) and through December, by the local date: leaves or holly and snow at the page's edges, hats, turkey tails, antlers and sprigs on the creatures, the scribe and the logo. A **Holiday looks** setting turns it off.
- **Holiday words** on some Scrawler pages in season, when your keys can type them (never on the Daily Page).
- A **Holidays** shelf in the sticker book: **Harvest Helper** and **Snow Scribe**, each bringing keepsakes for the Desk: a pilgrim or Santa hat for the pen and Harvest or Winter paper (save version 12).
- The snapshot tour shoots both seasons whatever the date (`?season=` on the dev server); the rest of the tour runs with no season, so it still compares with earlier milestones.

### M27: SEO (2.18.0)

| Link preview | For parents and teachers |
|---|---|
| <img src="m27/social-card.png" width="420" alt="The link-preview card: the Inky Keys logo and 'A free typing game where you choose the keys. No ads, no accounts. Works offline.' on a card over a page of creatures"> | <img src="m27/site-parents.png" width="420" alt="The For parents and teachers web page: a ruled notebook page on a dark desk with a red margin, handwritten headings and a list of what the game teaches"> |
| The **preview picture** shown when someone shares a link. | One of the new **web pages**, here in dark mode. |

| About |
|---|
| <img src="m27/about.png" width="420" alt="The About screen with links to the How to play guide, For parents and teachers, and Privacy"> |
| About links to the pages. |

**New:**
- **Web pages:** How to play, For parents and teachers, Privacy (made from `PRIVACY.md`) and a 404 page, styled as a notebook page with the game's fonts, light and dark. They work offline too.
- **Search and sharing:** a descriptive title and description, canonical URL, link-preview tags with a social card picture, `VideoGame` structured data, a `<noscript>` summary, `robots.txt` and `sitemap.xml`. Lighthouse scores 100 for SEO, accessibility and best practices on every page.
- **Install card:** the manifest gains categories and a screenshot.
- The snapshot tour now includes About and two web pages; `npm run snapshots -- public social` retakes the preview picture and install screenshot.

### M28: Fast start (2.19.0)

| Splash |
|---|
| <img src="m28/splash.png" width="420" alt="The splash screen: the Inky Keys logo, a cream ink drop and the name underlined in red, on the dark desk"> |
| Shown straight from `index.html` while the game gets ready. |

**New:**
- A **splash screen**: the logo on the desk, painted before any script runs and faded out once the menu is ready.

**Changed:**
- The game's stylesheet is inlined into the page, so nothing holds up the first paint. Lighthouse mobile performance went from 74 to about 96: first paint 3.9 → 2.0 s, largest paint 4.5 → 2.4 s, no layout shift.
- Tried and dropped: preloading the fonts and giving PixiJS its own chunk. Both made the first download slower on a slow connection.
- The snapshot tour now starts with the splash.
- **2.19.1:** the menu comes up about a second sooner on slow connections: the word pack downloads once the menu is showing, and PixiJS's browser setup comes with the main script. The holiday stickers now follow the same season as the looks, so the tour's `?season=none` keeps them (and their unlock card) out of the page-done shot.

### M29: Keyboards and nudges (2.20.0)

| Ready for more? | On a phone |
|---|---|
| <img src="m29/ready-for-more.png" width="420" alt="The Ready for more? card over a finished page: every page of chapter 1 got an A or better, with buttons Add numbers and symbols, Try Hard and Not now, and a link Don't suggest this again"> | <img src="m29/keyboard-notice.png" width="200" alt="On a phone-sized screen, a card titled Made for a keyboard explains the game is for a physical keyboard, with a Play anyway button"> |
| After a chapter of top grades (from chapter 5; staged here at chapter 1). | Once per browser on touch-only screens. |

| Free Write |
|---|
| <img src="m29/practice.png" width="420" alt="The Free Write screen showing Practicing: All letters, 53 keys"> |
| New players start on **All letters**. |

**New:**
- **Ready for more?** In Free Write from chapter 5, a chapter where every page gets an A or A+ offers **Add numbers and symbols** and/or the next difficulty, from the next page in the same notebook. **Not now** waits three chapters; **Don't suggest this again** turns it off for that player (save version 13).
- **Made for a keyboard:** a one-time note on phones and tablets with no mouse or trackpad. It never stops anyone playing.
- **Getting the words ready…:** a small note if something has to wait for the word pack (only on slow connections).
- The snapshot tour now starts with the phone notice. The suggestion card needs a whole chapter of play, so its shot came from a headless run with the chapter threshold lowered to 1.

**Changed:**
- New players start Free Write on **All letters** (letters, capitals and space) instead of Everything.

### M30: Readable hits (2.22.0)

| Capitals |
|---|
| <img src="m30/capitals.png" width="420" alt="Creatures on the page: Drips C, c, S and s, and Scrawlers Oxford, WoW and Vivid, and a Run-on reading Pick up Kim, with a short bar under every capital letter, including the already-typed V of Vivid in faded ink"> |
| A short bar under every capital, so C and c can't be mixed up. |

**New:**
- **Capital marks:** every capital letter on a creature (Drips, Scrawlers, bottles and Run-ons) has a short bar underneath, in the label's own color, so look-alike pairs like c/C, s/S, o/O and w/W are easy to tell apart. Digits and symbols get none. Bold and tinted capitals were tried and dropped.
- The snapshot tour has a `capitals` shot: the lineup again with capitals beside their lowercase twins.

**Changed (from playtest feedback):**
- Creatures no longer squash on each correct letter, which on long words made it look like a wrong key. They squash only when they're beaten, and a crimson or violet creature that loses a life shows a hurt face without shaking.

### M32: Keys beyond A–Z (2.28.0)

| French AZERTY | Spanish (Spain) |
|---|---|
| <img src="m32/type-case-azerty.png" width="420" alt="The Type Case on French AZERTY: digits on the Shift half of the number row above & é \" ' ( and the others, A Z E R T Y on the top row, Q S D F G H J K L M ù on the home row, and an extra < > key left of W on the bottom row"> | <img src="m32/type-case-spanish.png" width="420" alt="The Type Case on Spanish (Spain): º and ¡ ¿ on the number row, ñ and ç on the home row, the dead accent keys ` ^ and ´ ¨, and an extra < > key left of Z"> |
| Digits on Shift, é è ç à on the number row, an extra key left of W. | ñ on the home row, ¡ ¿ right of 0, dead accent keys. |

**New:**
- **ISO keyboards:** French AZERTY and Spanish (Spain) layouts, with the extra key left of Z/W. Each has a 27-chapter Apprentice course: AZERTY teaches the comma where QWERTY teaches the semicolon, and Spanish teaches ñ there. The Mac variant of AZERTY moves a few symbols (@ # § ! - =).
- **Dead keys and AltGr:** typed characters now come through a hidden typing field, so a dead key followed by a letter (`^` then `e` = `ê`), AltGr (Ctrl+Alt on Windows) and Mac Option characters all arrive. A dead key is never a mistake, and its accent waits beside the Nib until the letter comes.
- **Computer setting:** Mac or Windows/Chromebook, detected the first time. It picks the layout variant and decides whether Alt types characters (Mac) or is left for shortcuts (PC).
- The snapshot tour has `type-case-azerty` and `type-case-spanish` shots.

**Changed:**
- The 1, 2 and 3 power keys and the 1–4 difficulty keys go by the physical key, so they work without Shift on AZERTY. A number key that types one of the keys in play (like é on AZERTY's 2, if selected) types it instead.
- Key groups are built from the layout, and every key is in exactly one: Capitals only takes real letter keys (not AZERTY's digits), Digits finds digits on Shift, a new **Accents** group (on layouts that have them) holds AZERTY's é è ç à ù and the dead accent keys (^ ¨, and Spanish ´ ¨ ` ^), and Symbols takes the rest (µ, º, ª, ²). Everything selects every key; Number-row symbols follow the layout.

### M33: Français (2.29.0)

| Accents in the Contents | An accent chapter's card |
|---|---|
| <img src="m33/contents-accents.png" width="420" alt="The Apprentice Contents page in French: below the 27 chapters, a dashed line and an Accents part with five chapters, é, è à ù, ç, â ê î ô û (open, no stars yet) and ë ï ü (locked), and a How to type accents link"> | <img src="m33/accent-intro.png" width="420" alt="The card opening Accents 4 in French: â equals step 1, the ^ key (it waits for the letter), then step 2, the A key, and below, ê î ô û each shown as ^ then the letter, with a Start button"> |
| A second part of the Contents page: five accent chapters, each opened by the one before. | Numbered keycaps that press themselves in turn (still with reduced motion). |

| The accent help card | The Type Case's Accents strip |
|---|---|
| <img src="m33/accent-help.png" width="420" alt="The accent help card in French on AZERTY: every French accented letter with its keys, é è ç à ù on their own keys, the circumflex letters as ^ then the letter, ë ï ü as Shift plus ^ then the letter"> | <img src="m33/type-case-accents.png" width="420" alt="The Type Case in French on AZERTY, with a Letters + accents preset, and under the keyboard a strip of the accented letters typed with two keys: â ê î ô û ë ï ü, and a How to type accents link"> |
| Every accent, with the keys for the player's keyboard and computer. | Accents with no key of their own can be picked too. |

**New:**
- **Two languages:** a **Menu language** for the device (from the browser the first time) and a **Words language** for each player (save version 16). French menus (`src/i18n/fr.ts`, drafted for a native speaker to review), plurals through `Intl.PluralRules`, and translated shortcut letters and keycap names.
- **French words:** 56,651 words from Lexique 3.83 (CC BY-SA 4.0), with LDNOOBW's French list and a family-friendly French filter; the blocklist now folds accents. Words with œ, æ or ÿ are left out. French December words.
- **Accent teaching:** five accent chapters (é · è à ù · ç · â ê î ô û · ë ï ü), each a three-page notebook with its letters weighted up and accented words leaning in; a just-in-time card the first time untaught accents come up in Free Write, the Daily Page or Fair Copy; after a miss on an accented letter, that creature shows its keys in red pen; the accent help card and the `/fr/accents/` page; a **Letters + accents** preset; and **Forgiving accents** (off by default), which lets e count for é.
- **Key presses count:** word difficulty and creature pacing add the extra presses an accent takes on the player's keyboard (`howToType`, for AZERTY, Spanish ISO, and US keyboards on a Mac or with US-International).
- **Modes follow the words language:** the Daily Page (its own seed for French, with the common accents; English seeds unchanged), challenge links (an optional `w`), Fair Copy (20 French public-domain passages, checked against their Wikisource editions; bests per language; Bookworm for every passage in any one language) and word lists (from `fr.wikipedia.org`).
- **French web pages** under `/fr/` (How to play, For parents and teachers, Privacy, Accents), linked with `hreflang` and listed in the sitemap.
- The snapshot tour has `menu-fr`, `contents-accents`, `accent-intro`, `accent-help`, `type-case-accents` and `site-fr-accents` shots.

**Before release:** a native speaker reviews `fr.ts` and the French pages; Windows AltGr and US-International need a Windows tester.

### M34: Español (2.30.0)

| Spanish menus | Accents in the Contents, in Spanish |
|---|---|
| <img src="m34/menu-es.png" width="420" alt="The title menu in Spanish: Escritura libre, Página del día, Aprendiz, Copia en limpio, Escritorio, Pegatinas, Listas de palabras, Cómo jugar, Ajustes, Datos guardados and Acerca de, each with its Spanish shortcut letter"> | <img src="m34/contents-accents-es.png" width="420" alt="The Apprentice Contents page in Spanish: below the 27 chapters, an Acentos part with five chapters, ñ, á é, í ó ú, ü (with stars) and ¿ ¡ (open, no stars yet), and a Cómo escribir acentos link"> |
| Menus in Spanish, with tú and Spanish shortcut letters and keycaps. | Five Spanish accent chapters; the last teaches the opening marks ¿ ¡. |

| The ¿ ¡ chapter's card | The accent help card on the Spanish keyboard |
|---|---|
| <img src="m34/accent-intro-es.png" width="420" alt="The card opening Acentos 5: ¿ equals Mayús plus the key right of 0, and ¡ is that key alone, with an Empezar button"> | <img src="m34/accent-help-es.png" width="420" alt="The accent help card in Spanish on the Spanish (Spain) keyboard: ñ on its own key, the vowels with tildes as the ´ key then the letter, ü with Mayús and ´ then u, and ¿ ¡ right of 0"> |
| The same numbered keycaps as the French accents, now for punctuation too. | Every Spanish accent and mark, with the keys for the player's keyboard. |

<img src="m34/site-es-accents.png" width="420" alt="The Spanish web page Escribir acentos: a table of ñ, á é í ó ú, ü, ¿ and ¡ with their keys on the Spanish keyboard, then on a US keyboard on a Mac and on Windows or a Chromebook">

**New:**
- **Spanish menus** (`src/i18n/es.ts`, drafted for a native speaker to review on a shared review page), addressing players with *tú*; `es` follows the language system M33 built.
- **Spanish words:** 42,775 words ranked by FrequencyWords' OpenSubtitles 2018 counts (CC BY-SA 4.0), kept only where the RLA-ES Hunspell dictionary accepts them in lowercase (dropping names, English and typos; the dictionary is a build-time filter, not bundled), with a short hand-checked list of diminutives it misses. LDNOOBW's Spanish list plus a Spanish family-friendly filter and allow list. Navidad words; downloaded words from `es.wikipedia.org`.
- **Accent chapters ñ · á é · í ó ú · ü · ¿ ¡.** With ¿ or ¡ selected, questions and exclamations open with them (¿qué? ¡hola!); the ¿ ¡ chapter leans on them. The Letters + punctuation preset gets ¿ ¡; Letters + accents stays letters. A miss on ¿ or ¡ shows its keys, like an accent.
- **The Spanish Daily Page** includes ñ and every accent, not ¿ ¡; accents a keyboard can't type (á on AZERTY) are left out of the Daily Page and accent chapters there.
- **Fair Copy:** 21 Spanish public-domain passages (Cervantes, Calderón, Galdós, Bécquer, Darío, Martí, Clarín, Quiroga, Machado, Pombo, Samaniego), keeping ¿ ¡, copied from es.wikisource.org and checked word for word; only modern-spelling stretches are used.
- **Spanish web pages** under `/es/` (How to play, For parents and teachers, Privacy, Accents); the accents page is now made for any language, and every page links both other languages.
- The snapshot tour has `menu-es`, `contents-accents-es`, `accent-intro-es`, `accent-help-es` and `site-es-accents` shots.

**Before release:** a native speaker reviews `es.ts` and the Spanish pages (the game may ship first); a Latin American layout is a later layout file.

### M35–M36: Play together and Ink Race (2.32.0–2.33.0, beta)

| Play together | The countdown |
|---|---|
| <img src="m36/play-together.png" width="420" alt="The Play together dialog with a Beta badge: a note that it is new and still being tested, Host a game (invite up to 3 players) and Join a game (use the code from the host), and a line that the computers talk directly over the network and nothing goes to the internet"> | <img src="m36/race-countdown.png" width="420" alt="An Ink Race about to start: three lanes above the passage (Player 1 marked as you, Ada and Sam) with ink drops at the start and a red flag at the finish, the passage two ruled lines down in pale ink, a big red-pen 1 over the page and Get ready at the bottom"> |
| Host or join a game on the same Wi-Fi, with a Beta badge here and on the menu tile. | Every device counts down to the same moment. |

| Mid-race, a mistake to fix | The race card |
|---|---|
| <img src="m36/race.png" width="420" alt="Mid-race: the player's ink drop, ringed in red, is ahead of Ada and Sam; in the passage, raed is typed for read, with the wrong letters in red, a wavy underline and ae written above; the footer says Fix mistakes with Backspace to keep going, Esc leaves the race"> | <img src="m36/race-card.png" width="420" alt="The Race results card over the page: 1st Ada, 2nd Sam, 3rd Player 1 (you), each with an ink drop, WPM, accuracy and time, then Race again (Enter) and Back to the lobby (Esc); places are written in red pen by the finish flag"> |
| Progress stops at a mistake until it's fixed, so the first to finish wins. | Places, speed, accuracy and time; the host can race again. |

**New:**
- **Play together (M35, 2.32.0):** devices on the same network connect directly with WebRTC and no servers (no STUN or TURN, so nothing goes to the internet). Players swap a handshake code each way, cut down from the browser's 600–1,500 characters to about 130: as a link, pasted, or played as sound through a small FSK modem. A lobby of up to 4 with names, ink drops and ping.
- **Ink Race (M36, 2.33.0):** the host starts a race with a passage from their words language. Fair Copy's rules plus **mistakes must be fixed** (5 keys land in red, then Backspace), with a **track strip** of every racer's ink drop, a 3-2-1 countdown and a race card. Accents that aren't on a player's own keyboard can be typed plainly. Nothing is saved during the beta.
- `?race=demo` races bots; the snapshot tour has `play-together`, `race-countdown`, `race` and `race-card` shots.

**Changed:** the menu's bottom row has three small tiles (Play together, Saves, About).

## Keeping this up to date

At the end of each milestone, run:

```bash
npm run snapshots -- m36
```

That writes a standard set of shots to `docs/progression/m36/` (keyboard-notice, splash, menu, about, desk, players, settings, settings-layout, type-case-dvorak, chapter-intro-dvorak, type-case-azerty, type-case-spanish, menu-fr, contents-accents, accent-intro, accent-help, type-case-accents, menu-es, contents-accents-es, accent-intro-es, accent-help-es, how-to-play, how-to-play-bosses, play-together, race-countdown, race, race-card, daily, stickers, challenge, practice, type-case, briefing, lineup, capitals, pause, contents, chapter-intro, play, page-done, and the holiday shots menu-thanksgiving, lineup-thanksgiving, menu-christmas, lineup-christmas, desk-holidays and stickers-holidays, then the web pages site-parents, site-how-to-play, site-fr-accents and site-es-accents). `npm run snapshots -- m36 holidays` takes only the holiday shots. Then:

1. Run `npm run snapshots -- latest` too, so the "Latest" column matches.
2. Add a section under **Milestone by milestone** with one or two shots and what's **New** or **Changed**.
3. If the milestone visibly changes a screen in **Side by side**, add a column there. If it adds a new screen, add a step to `TOUR` in `scripts/snapshots.ts` so later milestones capture it as well.
4. Commit only the shots the page uses, to keep the repo small.

The script runs the Vite dev server and headless Chrome (set `CHROME_PATH` if Chrome isn't found) and needs Node 22 or later.
