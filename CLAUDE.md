# Inky Keys: working conventions

Inky Keys is an offline-first, open-source browser typing game (TypeScript + Vite + PixiJS). Start with `docs/REQUIREMENTS.md` (what to build, milestones) and `docs/DESIGN.md` (look and feel).

## Git workflow

- Work on a branch, never directly on `main`. Name it `feat/<short-name>` for features (e.g. `feat/m7-polish`), `fix/<short-name>` for fixes, `chore/<short-name>` for housekeeping.
- Merge into `main` with a fast-forward merge (`git merge --ff-only <branch>`).
- **Once a branch is merged, delete it locally** (`git branch -d <branch>`). Use `-d`, not `-D`, so git refuses to delete anything unmerged.
- Commit only when asked.
- Releases: see `docs/RELEASING.md`. Anything a player will notice gets a release entry in `src/core/releases.ts` (short player-facing notes; everything else is "bug fixes") and a version bump in `package.json`. Tag with `npm run release:tag` on `main` after merging; push tags only when asked.
- When committing, also run `npm run transcript` and include the updated `docs/transcripts/` so the build history stays public. Scan the export for private details (emails, tokens, codes, personal paths) before committing. Commit messages: a short summary line, then bullet points of what changed.

## Before calling work done

- `npm run check` (typecheck, lint, tests) and `npm run build` must pass.
- For anything visible, run the game (`npm run dev`) and check it in a browser.
- Service workers only run in production builds (`npm run build && npm run preview`).
- At the end of a milestone, run `npm run snapshots -- m<N>` (and `-- latest`) and add it to `docs/progression/README.md`, calling out what's new or changed next to earlier versions. That file's last section has the steps.

## Code conventions

- Game rules live in `src/core/` and stay free of DOM and PixiJS so they can be unit tested. Rendering (`src/render/`) reads state and never changes it.
- Menus and settings screens are plain DOM in `src/ui/`, for accessibility.
- All tuning numbers go in `src/core/config.ts`.
- Every user-facing string goes through `t()` with an entry in `src/i18n/en.ts`. The exception is the website's plain pages in `site/<locale>/` (and the `<noscript>` text in `index.html`), which are static HTML outside the app; translate them by copying the folder.
- No network requests, analytics or third-party scripts (see `PRIVACY.md`). The single exception is the player-triggered word download in `src/content/vocabApi.ts`: the Wikipedia of each words language (`en.wikipedia.org`, `fr.wikipedia.org`, `es.wikipedia.org`) are the only origins allowed by the CSP's `connect-src`. Every bundled third-party asset needs a redistributable license and an entry in `CREDITS.md`.
- Keep the save format versioned: changing `SaveData` means bumping `SAVE_VERSION` and adding a migration in `src/storage/schema.ts`.
