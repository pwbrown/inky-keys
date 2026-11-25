# Inky Keys: Design

> Direction: **Inkwell** (hand-drawn notebook look) + **Spellbook-style learning** (keys are learned like runes and mastered over time).
> Name: **Inky Keys** (chosen 2026-11-15, previously Inkling). See [§9 Name](#9-name).
> Status: Draft v0.1 (2026-11-12). Companion to [REQUIREMENTS.md](REQUIREMENTS.md).

---

## 1. Pillars

1. **The world is a page.** Everything lives in a hand-drawn notebook, because text *is* the world.
2. **Learning letters is the progression.** Keys are learned, practiced and mastered like a calligrapher's alphabet.
3. **Cozy, with a pulse.** It's charming and low-stakes in tone, but the waves still build real tension.
4. **Legibility first.** Decoration never gets in the way of reading the text you have to type.

---

## 2. Setting & Player

- **The page:** a ruled notebook page on cream paper. The red **margin line** on the left is the line you defend.
- **The manuscript (what you defend):** a little ink-drop **scribe** with a quill sits on the free line below the last lane and fills the page with faint, illegible cursive as you clear it. The writing grows with each creature cleared, not with time, so the last stroke lands with the last one (on a boss page the last bit waits for the boss). A creature that reaches the margin drops an ink blot on the writing on its line, and the scribe winces. It also looks up when one gets close, and cheers when the page is done. At the start of a page it writes the heading ("Chapter 3 · Page 2"). The writing is scribbles, never words, so it can't compete with text you read; it's very faint (`GAME_CONFIG.manuscript`) and can be switched off in Settings (**Page writing**), which keeps the heading.
- **The player, "the Nib":** a small fountain-pen nib character that sits in the left margin. It leans toward the target it's locked onto.
- **Health, the ink reservoir:** an ink gauge shown as a small inkwell in the corner. Every blot that reaches the margin drains ink, and the game is over when the well runs dry. *(This settles the "health vs lives" question in REQUIREMENTS §13 unless we change it.)*

---

## 3. Campaign Structure

| Requirements term | In-world name | Notes |
|---|---|---|
| Campaign | **Notebook** | **Apprentice** (a 10-chapter course that teaches keys, with stars and a finish) or **Free Write** (your own keys, endless; the main mode, formerly Practice) |
| Level | **Chapter** | Shown as a notebook tab. Finishing one refills 30% of the ink well. |
| Wave | **Page** | Single target type per page |
| Summary screen | **Graded page** | See §6 |
| Bosses | **The Spill**, **Bookworm**, **Shuffler**, **Inkwell Squid**, **Rival Quill** | One opens the last page of each chapter, taking turns (the Spill from milestone 13, the rest from milestone 19) |

---

## 4. The Type Case (Key Selection + Rune-style Learning)

This is where the Spellbook mechanic comes in. The key-selection screen is a **letterpress type case**: a wooden drawer with a slot for each character. Each key is a metal **sort**. The keyboard itself is drawn as an **old typewriter**: black enamel body with a gold pinstripe, round glass-topped keys in chrome rims that press down when picked.
- **Hands guide:** when the Apprentice meets new keys (a chapter's first card, or a suggestion in the Type Case), a picture shows two hands resting on the home row, painted in a pale ink wash. The hands never move: the finger for each new key is shaded in highlighter, the key is shaded and circled in red pen, and a dashed red-pen arrow runs from that fingertip to the key when it is off the home row.

- **Picking keys:** you click sorts to add them to your case, or click a drawer section to toggle a whole region (letters, digits, symbols, home row and so on). It also has presets and custom presets.
- **Mastery:** each sort fills with ink as you get better at it, based on that key's local accuracy and speed stats.
  - **Unfamiliar:** an empty outline
  - **Practicing:** partly inked
  - **Mastered:** fully inked, with a gold-leaf edge
- **Two ways to play:**
  - **Free Case:** pick any keys you want (the full flexibility from the requirements).
  - **Apprentice path:** start with a small set, such as the home row. When the game sees you've mastered your current keys, it *suggests* the next sorts to learn ("Ready to learn **E** and **I**?"). This is the rune-learning progression.
- **Weak-key focus:** T2 drips and word choice lean toward keys you haven't mastered (REQUIREMENTS §6).

---

## 5. Targets

| Type | Name | Look | Behavior / interaction |
|---|---|---|---|
| **T1** word | **Scrawlers** | Wobbly ink-blot creatures with little legs, the word written on their belly | When you lock on, the Nib draws a thin guide line to it. Each correct letter is "re-inked" in crisp calligraphy, and finishing the word blots it up into a splatter. |
| **T2** char | **Drips** | Small fast droplets, one glyph each | They come in swarms. Each pops with a tiny ink flick. |
| **T3** phrase | **Run-ons** | A centipede where each segment is one word | Typos *smear* the segment, and Backspace acts as an **eraser** to clean it. Clearing a segment detaches it. |
| ~~T4 correction~~ | ~~Misprints~~ | Removed in milestone 17: too out of place beside the other creatures. A new kind may take this slot later. | |

*Code names:* Scrawlers were called Blotlings until 2026-11-15 (the name belongs to Disney's *Epic Mickey* enemies). The code still uses `blotling` for the target kind, because saves and the progression snapshots of older milestones depend on it. When the Spill splits, its small Scrawlers are called **Inkmites**.

**Personality:** every creature has a face. Eyes follow the Nib, and they blink. A creature looks worried near the margin, wide-eyed when you lock onto it, and happy for a moment with each correct key. Drips bob and squash, Scrawlers wobble and scurry on little legs, Run-ons ripple like centipedes, and Misprints hop like stamps. Reduced motion stops the movement but keeps the faces.

**Hits:** a correct letter flicks ink at it (a splatter and the letter popping off), but the creature itself doesn't flinch, since a jolt on every key read like a mistake on long words. It squashes only when it's beaten. A crimson or violet creature that loses a life shows a hurt face without shaking (milestone 30).

**Capitals:** a short bar sits under every capital letter on a creature, in the label's own color, so c/C, s/S, o/O, w/W and the like can't be mixed up, even on a lone Drip. Digits and symbols get no mark. Bold and tinted capitals were tried and dropped: bold was too close to the labels' semibold, and a tint shows the difference by color alone (`GAME_CONFIG.capitalTick`).

**Tougher ink** (Typer Shark style): crimson creatures need two completions in a row and violet ones three, with dots showing what's left. Ghosts in invisible ink are faint and blurred until they're a quarter to half of the way in from the right edge (a random point per ghost). Chances grow by chapter and difficulty (`GAME_CONFIG.variants`).

**Errors:** a wrong key leaves a small smudge on the page. A messy page is a gentle, visible record of your accuracy. You'll also see it on the graded page.

---

## 6. UI & Screens

- **Title:** a closed notebook. Opening it shows the table of contents (Continue, New Notebook, Type Case, Settings).
- **Menus:** notebook tabs along the edge, with settings as **sticky notes**.
- **HUD:** the inkwell (health) in the top-left, the score written in pencil in the top-right, and the page number and progress as a footer. The chapter is in the scribe's heading on the page.
- **Graded page (summary):** a red-pen grade, WPM and accuracy written in the margin, the most-missed keys circled, and teacher-style notes ("Watch your **R**!"). It also shows which sorts gained mastery on this page.
- **Pause:** a bookmark ribbon drops down.
- **Ink Race (M36):** the Fair Copy page with the passage two ruled lines lower. Above it is a **track strip**, one lane per racer: their name, a faint line, and their ink drop (in their badge color, ringed in red for you) sliding toward a red finish flag. Places are written in red pen by the flag as racers finish. A big red-pen **3, 2, 1, Go!** counts down over the page. The **race card** lists places in red pen, each racer's ink drop and name, and their speed, accuracy and time; the host's card offers Race again and Back to the lobby.

---

## 7. Art Direction

- **Palette:**
  - Cream paper, blue-black ink, a red pen for the margin and grading, and a yellow highlighter for the locked target.
  - A **night mode** with dark paper and pale ink is a natural extra theme.
- **Line style:** hand-drawn strokes with a subtle **line boil** (a 2–3 frame jitter) for a sketchbook feel. Reduced-motion mode turns it off.
- **Colorblind safety:** errors are never shown by red alone. They also get a strikethrough or smudge shape, and the lock uses a highlight plus an underline.
- **Fonts:** all bundled and offline, with OFL or similar licenses.
  - **Target text:** a highly legible font such as *Atkinson Hyperlegible* or a clear monospace. It is never a handwriting font.
  - **Headings and UI flavor:** a handwriting or brush display font.
  - **Calligraphy re-ink effect:** an animated stroke drawn *over* the legible text, never in place of it.
- **Holidays (milestone 26):** around Thanksgiving and through December (`GAME_CONFIG.seasons`), the page tucks leaves or holly into its bottom-right corner and lets a few leaves or snowflakes drift behind the creatures, faint and kept to the edges. Creatures wear pilgrim or Santa hats, turkey tails, antlers or a sprig (crimson ones keep their horns, violet ones their crown), and so do the scribe and the menu logo. Hat colors are fixed, not themed, so a Santa hat stays red on Night. The holiday stickers bring keepsakes for the Desk: a hat for the Nib and a Harvest or Winter paper. **Holiday looks** in Settings turns the seasonal dressing off; keepsakes stay.
- **Art pipeline:** the hand-drawn look is forgiving. You can start with simple SVG blobs and noise displacement in PixiJS filters, then swap in drawn art later.

---

## 8. Audio

- **Keystrokes:** a soft pen scratch, with the pitch varied slightly.
- **Feedback:**
  - Completing a target makes an ink "plip" or squelch.
  - An error makes a dull pencil tap.
  - Losing ink makes a glug.
- **Ambience:** room tone and paper rustles, with light piano or pizzicato music that layers in more instruments as a page goes on.
- **Controls:** separate volume for music and effects, plus mute (REQUIREMENTS §10).

---

## 9. Name

**Inky Keys** (chosen 2026-11-15): the ink-and-notebook world plus the keyboard, so the name says "typing game" at a glance. It's short, friendly, and easy for young players to read. The domain is **inkykeys.com**.

**Availability notes (2026-11-15):**
- No game, app or typing tool called *Inky Keys* turned up. The nearest names are a tattoo artist (*Inky Key*), the ELECFOX *INKY 75* mechanical keyboard and *inkkeys*, a DIY e-ink keypad.
- No *INKY KEYS* or *INKYKEYS* mark in the USPTO or the WIPO Global Brand Database. Live marks for plain *INKY* exist in class 9 (Kaseya email security, Kraken's crypto wallet, the *Inky Trivia* app) for unrelated goods. This was a quick knockout search, not legal clearance.

**Earlier name: Inkling** (2026-11-12 to 2026-11-15). It was dropped because it collided with Thinking Machines Lab's *Inkling* AI model (July 2026) and Nintendo's *Splatoon* Inklings. Some internal identifiers still say `inkling`: the IndexedDB database, the `app` marker in exported saves, the settings key in local storage and the `window.inkling` debug hook. Renaming them would cut players off from their saves and settings, or break the snapshots of older milestones.

Other names checked during the rename:

| Name | Result |
|---|---|
| **The Typist's Apprentice** | Clear, .com free. The runner-up. |
| **Letterclack**, **Clatterpage** | Clear, .com free |
| **Mind the Margin** | Clear for games; the phrase is used in finance |
| **Inkstroke**, **Typewright** | Taken by ink-themed games and typing tools |
| **Ten Inky Fingers** | Too close to *Inky Fingers*, a 2026 Steam game |
| **Carriage Return** | Small existing games; the .com is taken |
| **Blotlings** (for the enemies) | Disney's *Epic Mickey* enemies, so they became Scrawlers |

Names considered for the first version:

| Name | Notes |
|---|---|
| **Blotter** | Short, easy to type, says exactly what you do |
| **Nib** | Very short and memorable. Also the player's name. |
| **Marginalia** | Literary and distinctive, but long to type |
| **Type Case** | Ties straight to the key-selection hook |
| **Inkwell** | The obvious choice, and probably the most likely to already be taken |

---

## 10. Open Design Questions

- [x] Final name: **Inky Keys** (renamed from Inkling on 2026-11-15).
- [x] Should the Apprentice path be the default for new players? No: Free Write (formerly Practice) comes first on the menu since milestone 17, starting on all letters, capitals and space; the Apprentice course sits just below it.
- [ ] Does the page get messier from errors permanently within a chapter, or reset every page?
- [x] Is the Spill boss part of the MVP or post-MVP? Added in milestone 13.
- [x] Ship night mode in the MVP? Yes, in milestone 7, alongside a high-contrast theme.
