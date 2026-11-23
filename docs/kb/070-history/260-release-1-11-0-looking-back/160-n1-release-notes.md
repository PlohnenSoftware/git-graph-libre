---
summary: >-
  N1: bring CHANGELOG.md `[Unreleased]` and README.md up to date with what
  reached `main` since the notes were last written: Blame F4-05 and F4-06,
  the GGL tab icon (Q1), the zh-tw term (L2), and the popup fixes P1
  (V1–V10) where they are missing.
---

# N1 — Release notes for 1.11.0 "Looking Back"

Status: done — awaiting integration

Needs: F4-05, F4-06, Q1, L2, P1 (all integrated)

Agent: Claude Haiku

Read first: `AGENTS.md`; the documentation rules
(`020-rules/030-documentation-and-verification-rules.md`, the changelog and
README parts); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`); the reports of
F4-05 and F4-06 (`110-blame-view/140-…` and `150-…`), Q1, L2 and P1 (this
section's directory); the existing `[Unreleased]` entries in `CHANGELOG.md`
(their voice, length and bold lead-ins are the model).

## Touch

`CHANGELOG.md` (`[Unreleased]` only; never the version heading or date);
`README.md` (the feature bullets only); this file's Status and Report.

## Task and acceptance

- **Blame, F4-05:** extend the Blame view entry (or add one beside it) with
  what F4-05 shipped: rewinding to the blame before a change with
  Back/Forward/Latest, the `-w`, `-M` and `-C` toggles, the
  `.git-blame-ignore-revs` file applied automatically with a toggle, a
  per-session list of ignored commits, and find in the tab.
- **Blame, F4-06:** the commit popover (full message with issue links,
  author and committer, avatar) and its actions: Show Commit in Graph, Open
  in GGL Diff, Open File at Line, View blame prior to this change, Ignore
  Commit (This Session), Copy Commit Hash and Copy Commit Message.
- **Q1:** the Diff, Reflog and Blame tabs show the Git Graph Libre icon,
  following `tabIconColorTheme` (Changed or Fixed, as the rules say).
- **L2:** zh-tw uses one word for "repository" (存放庫) throughout.
- **P1 (V1–V10):** check each fix in P1's report against the existing
  entries; add only the user-visible ones that are missing (for example the
  Worktrees popup's icon buttons, Remove Worktree confirming with Remove).
- **README:** the Blame view bullet mentions rewinding, the options and the
  commit popover in one or two short clauses; nothing else changes.
- Every statement must be true of the code on `main`; check behavior in the
  code or the slice reports, never guess. American English, no marketing
  words, the existing voice. No version bump, no date, no new heading.

Checks: `node ./docs/kb/housekeeping.mjs --check`; strict Biome is not
needed for Markdown. Claim and changes are separate signed commits; never
push.

## Report

- **Agent / date:** Claude Haiku 5.5 (claude-haiku-5-5), 2026-11-23 17:54
- **Branch and commits:** `rel-1.11.0/N1` (base `ad8cd22b`)
  - `d95a45f0 G docs(kb): claim slice N1 (release notes for 1.11.0)`
  - `3f814c4a G docs(changelog): Blame rewind, options, find and commit popover (N1)`
  - `30b040d2 G docs(changelog): Q1 tab icon, L2 zh-tw term, P1 popup fixes (N1)`
  - `dc46aab6 G docs(readme): Blame rewind, options and popover in the features (N1)`
  - plus the signed commit carrying this report and the final status
- **Files changed:** `CHANGELOG.md` +52/−1 (`[Unreleased]` only; no version heading, date or version bump); `README.md` +4/−1 (the Blame view bullet only); this slice file (Status and Report).
- **Entries added (CHANGELOG `[Unreleased]`):**
  - Added: "Rewinding and options in the Blame view" (F4-05) and "A commit popover in the Blame view" (F4-06).
  - Changed: "The Worktrees popup's rows use icon buttons" (P1 V2, VQ1), "Create Worktree's dialogs are clearer" (P1 V3, V4), "The Diff, Reflog and Blame tabs have the Git Graph Libre icon" (Q1), "Traditional Chinese says 存放庫 for "repository" everywhere" (L2).
  - Changed, appended to the existing Delete Branch sentence: "Its removal checkbox must be ticked before the branch can be deleted." (P1 V5).
  - Fixed: "Worktree dialogs and their text" (P1 V1, V6, V8, V9, V10) and "The remote checkout prompt" (P1 V7).
- **Tests added or changed:** none (documentation only). Full suite before and after: unchanged code, so no change in counts.
- **Gates:**
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - `pnpm run test`: backend 120 files, 1594 passed | 60 skipped (1654; the skips are the linked-worktree skips); webview 95 files, 1341 passed. Exit 0.
  - Strict Biome: not run; no `.ts`, `.mjs` or `.json` file changed (the task notes say it is not needed for Markdown).
  - `pnpm run typecheck`, `pnpm run l10n:check`: not run; no TypeScript or user-visible string changed.
  - Renders: not needed; no visual change.
  - Sonar: integrator.
- **Acceptance:**
  - Blame F4-05 entry (rewind with Back/Forward/Latest, `-w`/`-M`/`-C`, ignore-revs file with toggle, per-session ignore chips, find in the tab): met; each label checked against `l10n/bundle.l10n.json` (`blame.rewind`, `blame.navBack`, `blame.optionIgnoreWhitespace`, `blame.ignoreRevsFileOff`, `blame.clearIgnoredCommits`, `blame.findToggle`) and the behavior against `src/webview/blameTab/view.ts`, `rowModel.ts` and `src/extension/blameTab/blameData.ts` (`defaultBlameOptions` sets `useIgnoreRevsFile: true`).
  - Blame F4-06 entry (popover and its actions, avatar only when cached): met; labels from `blame.showCommitInGraph`, `action.openInGglDiff`, `blame.ignoreCommitSession`, `action.copyCommitHash`, `blame.copyCommitMessage`, `blame.openFileAtLine`; avatar read from cache only in `src/webview/blameTab/popover.ts`.
  - Q1: met; `tabIconPaths` in `src/extension/tabIcon.ts`, set at creation as the graph tab does, so the entry says "tabs opened afterwards".
  - L2: met; no `儲存庫` in `l10n/bundle.l10n.zh-tw.json` or `package.nls.zh-tw.json`.
  - P1 (V1–V10): met for each user-visible item, per the P1 report and checked in code (`status.*` values, `showFormDialog` with `l10n.worktreeRemove` in `confirmRemoveWorktree`, `showChoiceDialog` in `finishCreateWorktree`, `existingBranchMessage`). V5's shorter dialog was already in the Fixed list; only the required removal checkbox was added to that sentence. V11 and Q2 are not described, as instructed.
  - README: met; the Blame view bullet has one added sentence covering the rewind, the options and ignore-revs file, Find in the tab, and the popover.
- **Deviations from the slice:** none in content. Two points for the integrator (see below).
- **Open questions / follow-ups:**
  - The Telemetry bullet under Changed ("Usage telemetry counts tab opens and Copy Path") names only the Reflog and GGL Diff tabs. Slice T1b (`tab.blame`, integrated at `7ed42e61`) also reports the Blame tab. It was outside this slice's list, so I did not edit it; the integrator may want "and the Blame tab" there. The README Telemetry section already names the Blame tab.
  - The Changed and Fixed entries for P1 and Q1 are my choice of section (Keep a Changelog); the slice said "Changed or Fixed, as the rules say", but I found no changelog section rule in `docs/kb/020-rules/030-documentation-and-verification-rules.md`, which the slice names as holding "the changelog and README parts". Those parts are not in that file on this branch, so I followed the existing `[Unreleased]` pattern.
  - The zh-TW term is 存放庫 (L2). The Blame popover and rewind strings are the agents' own translations (per the F4-05 and F4-06 reports); a native review would help. Nothing in the changelog text depends on that.

