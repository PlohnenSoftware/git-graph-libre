---
summary: >-
  F2-09 (optional, later): conflict prediction in the existing plain "Rebase
  onto" dialog, and a drag of a local branch label onto another to rebase it,
  behind a confirmation. Waits for F2-07, F2-08 and decision IQ8, which
  recommends deferring it.
---

# F2-09 — Plain-rebase prediction and drag-to-rebase (optional, later)

Status: waiting

Needs: F2-07, F2-08; decision IQ8 (drag-to-rebase now or later) confirmed by the maintainer, research recommends later

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 1.1 (Drag-to-rebase, Conflict prediction), 2 (Drag-to-rebase),
4 (F2-09) and 5 (IQ8) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/webview/` (a new drag handler module and a drop-menu module; `refLabels` as the label source)
- `src/backend/actions/rebase.ts`: reuse, only as the sequence needs
- `src/extension/messageHandler.ts`: register the message only
- `src/webview/main.ts`: `showRebaseDialog` hook-in only
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json`
- tests: `tests/backend/actions/dragRebase.test.ts` (real Git), `tests/webview/dragRebaseMenu.test.ts`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Plain-rebase prediction.** The existing "Rebase current branch onto..."
dialog gets the same status line as F2-08, reusing its module.

**Drag-to-rebase.** Dragging a local branch label onto another opens a small
menu "Rebase <a> onto <b>". The source is checked out first, with the dirty-tree
choice from F2-07. It refuses when the source is checked out in another
worktree. The menu confirmation is kept: a drag must never rewrite history with
one gesture.

**Git commands.** `git checkout <source>`, then `git rebase <target>`, through
the existing actions. Prediction comes from F2-08.

**Tests.** Real Git for the sequence (the checkout, the rebase, the refusal in
another worktree). Webview tests for the drop menu.

**Localization.** About eight strings.

**Scope note.** This slice is optional. Start it only after the maintainer
confirms IQ8.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

Not started.
