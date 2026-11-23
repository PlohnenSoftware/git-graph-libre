---
summary: >-
  F4-05: GitHub-style "View blame prior to this change" parent-blame rewind
  with Back/Forward/Latest navigation stack across renames, header blame
  option toggles (`-w`, `-M`, `-C`, `.git-blame-ignore-revs` + per-session
  `--ignore-rev` chips), and in-tab Find / Author filter.
---

# F4-05 — Parent-blame rewind stack, options, ignore-revs and find

Status: done — awaiting integration

Needs: F4-04 (and maintainer confirmation of BQ5)

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`) for `BQ5`; "Blame view"
(`060-future-work/040-git-graph-plus-features-research-and-plan/040-blame-view.md`),
sections 1.3 and 2.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy third-party code. Tests ship with behavior, using
real-Git fixtures in temporary directories only. Strict Biome on touched
files, no `var`, American English, OKLCH colors through `--ngg-*` tokens with
VS Code theme tokens first, octicons only through `scripts/generate-octicons.js`
(`pnpm run icons:generate`) — never paste raw SVG paths — every user-visible
string in all five l10n bundles (`l10n:check` at 100%), no new telemetry. Do
not bump versions or edit `CHANGELOG.md`, `README.md`, or `NOTICE.md`; the
integrator does. Report Sonar: integrator.

## Touch

`src/blameTabTypes.ts` (navigation stack state, blame options payload,
ignore-revs state, webview messages for `rewind`, `navigate`, `setOptions`,
`ignoreCommit`, `clearIgnoredCommit`); `src/extension/blameTab/{blameData,blameTabPanel}.ts`
(auto-detect `.git-blame-ignore-revs` at repo root, honor options & session
`ignoreRevs`, maintain Back/Forward/Latest navigation stack with target line);
`src/webview/blameTab/{main,rowModel,view}.ts` (per-hunk "View blame prior to
this change" button, header Back/Forward/Latest controls, `-w`/`-M`/`-C`/
ignore-revs toggles, removable session `--ignore-rev` chips, client-side
Find/Author filter with match counter & next/prev jump + Escape handling);
`media/blame-tab/blame-tab.css`; `scripts/generate-octicons.js` and
`src/octicons.ts` (only if an icon such as `arrow-left` / `arrow-right` /
`versions` is needed; run `pnpm run icons:generate`); `l10n/bundle.l10n*.json`
(all five bundles); tests under `tests/webview/blameTab/` and
`tests/webview/blameTabPanel.test.ts`; this slice file's Status and Report.

## Task and acceptance

- **Parent-blame rewind ("View blame prior to this change"):**
  - Every committed hunk that has `previous: { hash, path }` renders a
    compact accessible icon button in its gutter header ("View blame prior to
    this change" with tooltip naming `abbrevCommit(previous.hash)` and
    `previous.path` when renamed).
  - Hunks with `boundary === true` or `previous === null` omit or disable the
    button with a clear tooltip ("Initial commit for this file").
  - Clicking rewind pushes the current `{ rev, filePath, targetLine }` onto
    the panel's navigation history stack (clearing any forward entries) and
    loads `{ rev: previous.hash, filePath: previous.path, targetLine: hunk.origStartLine }`.
  - Header displays **Back**, **Forward**, and **Latest** (jump straight back
    to the starting working tree / `HEAD`) controls whenever history depth > 0
    or a historical revision is pinned, plus a rename notice when `filePath`
    changed from the initial path.
- **Git blame option toggles:**
  - Header controls for:
    - **Ignore whitespace** (`-w`).
    - **Detect moves/copies** (`-M`, `-C` — either two toggles or a 3-state
      selector `Off` / `Moves (-M)` / `Copies (-C)`).
    - **Ignore revs file**: auto-detects `.git-blame-ignore-revs` at the
      repository root on open; when present, enables it by default (`BQ5`) and
      shows a toggleable chip ("Ignoring `.git-blame-ignore-revs`") so the user
      can turn it off/on in one click. Never passes `--ignore-revs-file` when
      the file does not exist.
    - **Session ignored commits:** supports adding a commit hash via
      `--ignore-rev <sha>` (consumed by `F4-06`'s popover action and testable
      now via message/button) with removable chips in the header and a "Clear
      all" affordance.
  - Toggling any option reloads the **current** `{ rev, filePath }` in place
    with a fresh `requestId` and preserves the user's visible scroll line.
- **In-tab Find & Author filter:**
  - Compact find/filter bar (`Ctrl+F` / `Cmd+F` inside the webview or header
    search button) matching source line text, author name, commit summary, or
    commit hash (case-insensitive substring), showing `N / M` match count,
    Next/Previous jump (Enter / Shift+Enter), and Escape to clear/close.
- **Tests & visual check:**
  - Real-Git `blameData` tests: rewind across a rename (`orig.txt` <-
    `renamed.txt`), Back/Forward/Latest stack behavior, `.git-blame-ignore-revs`
    auto-detect and toggle off, `-w` whitespace toggle, session `--ignore-rev`.
  - Webview tests: rewind button presence vs absence on boundary hunks,
    header nav button enable/disable states, option toggle messages, find/filter
    highlighting & keyboard navigation, Escape behavior.
  - Headless dark/light render showing a rewound historical revision with
    Back/Latest controls and an active `.git-blame-ignore-revs` chip.

Run focused checks (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched files, `pnpm run typecheck`, `node esbuild.js --production`,
`npx vitest run --project webview tests/webview/blameTab/ tests/webview/blameTabPanel.test.ts`,
`pnpm run l10n:check`, and `node ./docs/kb/housekeeping.mjs --check`) and
record each command and result. Claim and changes are separate signed commits;
never push.

## Report

- **Agent / date:** Gemini 4 Argon (agy) started the slice and committed the claim, octicons, and host/l10n layer before hitting a provider quota cutoff; Gemini 4 Neon (agy) continued, refined, tested, rendered, and finished it, 2026-11-23 13:23
- **Branch and commits:** `blame/F4-05`
  - `ceb729e8 G docs(blame): claim F4-05 (F4-05)`
  - `7a8afbfd G feat(blame): generate arrow-left, arrow-right and versions octicons (F4-05)`
  - `8a13f258 G feat(blame): add rewind stack, option toggles, ignore-revs and l10n to host (F4-05)`
  - `32a7c351 G feat(blame): add rewind UI, option toggles, ignore-revs chips and find bar (F4-05)`
  - `4e49d7fa G test(blame): cover rewind stack, options, ignore-revs and find (F4-05)`
  - plus this report/status commit
- **Files changed:** (22 files, `+2510 / -155` before this report commit)
  - `scripts/generate-octicons.js` (+3)
  - `src/octicons.ts` (+15)
  - `src/blameTabTypes.ts` (+167 / -7)
  - `src/extension/blameTab/blameData.ts` (+243 / -2)
  - `src/extension/blameTab/blameTabPanel.ts` (+77 / -43)
  - `src/webview/blameTab/main.ts` (+23)
  - `src/webview/blameTab/rowModel.ts` (+207 / -16)
  - `src/webview/blameTab/view.ts` (+623 / -72)
  - `media/blame-tab/blame-tab.css` (+207 / -6)
  - `l10n/bundle.l10n.json`, `l10n/bundle.l10n.nl.json`, `l10n/bundle.l10n.pl.json`, `l10n/bundle.l10n.zh-cn.json`, `l10n/bundle.l10n.zh-tw.json` (+24 / -1 each; 23 new keys appended at the end)
  - `tests/webview/blameTab/fixtures.ts` (+24 / -1)
  - `tests/webview/blameTab/blameData.test.ts` (+248 / -1)
  - `tests/webview/blameTab/blameTabCss.test.ts` (+11)
  - `tests/webview/blameTab/main.test.ts` (+37 / -1)
  - `tests/webview/blameTab/rowModel.test.ts` (+94 / -2)
  - `tests/webview/blameTab/view.test.ts` (+266 / -4)
  - `tests/webview/blameTabPanel.test.ts` (+138)
  - `docs/kb/050-ongoing-work/110-blame-view/140-f4-05-parent-rewind-options-and-find.md` (Status and Report)
- **Tests added or changed:** 17 new tests across `tests/webview/blameTab/{blameData,blameTabCss,main,rowModel,view}.test.ts` and `tests/webview/blameTabPanel.test.ts` (focused blameTab suite: 79 -> 96 passed across 9 files; full webview suite: 1,232 -> 1,249 passed across 94 files).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 20 touched `.ts`/`.js`/`.json` files: passed (0 errors, 0 warnings)
  - `pnpm run typecheck`: passed (`src`, `src/webview`, `tests`)
  - `node esbuild.js --production`: passed
  - `pnpm run l10n:check`: passed (`bundle.l10n.*` 913 keys at 100.0% across `nl`, `pl`, `zh-cn`, `zh-tw`; `package.nls.*` 134 keys at 100.0%)
  - `node ./docs/kb/housekeeping.mjs --check`: passed
  - `npx vitest run --project webview tests/webview/blameTab/ tests/webview/blameTabPanel.test.ts`: 9 files, 96 passed
  - `pnpm run test`: backend 118 files, 1,579 passed | 60 skipped (1,639, expected worktree skips); webview 94 files, 1,249 passed
  - Headless renders (`xvfb-run` + PyQt6 `QtWebEngineView` using real `media/tokens.css`, `media/blame-tab/blame-tab.css`, and `out/blameTab.min.js`), visually inspected:
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-05/blame-rewound-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-05/blame-rewound-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-05/blame-find-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-05/blame-find-light.png`
  - Sonar: integrator
- **Acceptance:**
  - Parent-blame rewind button on committed hunks with `previous`, disabled with "Initial commit for this file" tooltip on boundary / `previous === null` hunks, omitted on uncommitted hunks: met (`src/webview/blameTab/view.ts`, `tests/webview/blameTab/view.test.ts`).
  - Back/Forward/Latest navigation stack pushing `{ rev, filePath, targetLine }` across renames, clearing forward entries on rewind, updating panel title, and showing header rename notice without emitting duplicate `tab.blame` telemetry: met (`src/extension/blameTab/{blameData,blameTabPanel}.ts`, `tests/webview/blameTab/blameData.test.ts`, `tests/webview/blameTabPanel.test.ts`).
  - Header toggles for `-w`, `-M`, `-C`, auto-detected `.git-blame-ignore-revs` toggle chip (enabled by default per `BQ5`, never passing `--ignore-revs-file` when absent), and removable per-session `--ignore-rev` chips with "Clear all", reloading in place with fresh `requestId` and preserving visible scroll position: met (`blameData.ts`, `blameTabPanel.ts`, `view.ts`, real-Git tests in `blameData.test.ts`, `view.test.ts`, `blameTabPanel.test.ts`).
  - In-tab Find & Author filter bar (`Ctrl+F` / `Cmd+F` and header search toggle) matching source text, author, summary, and commit hash (case-insensitive substring) with `N / M` counter, Enter / Shift+Enter and Next/Prev jump, and Escape to clear/close: met (`rowModel.ts`, `view.ts`, `rowModel.test.ts`, `view.test.ts`).
  - Headless dark/light renders of a rewound historical revision with Back/Latest controls, rename notice, active `.git-blame-ignore-revs` chip, session `--ignore-rev` chip, and open Find bar: met (PNGs listed above).
- **Deviations from the slice:** none. All 22 changed files are inside the Touch list.
- **Open questions / follow-ups:**
  - The 23 new `blame.*` strings in `nl`, `pl`, `zh-cn`, and `zh-tw` were translated by the agent; a native-speaker review would help.
  - `F4-06` can wire its commit popover "Ignore Commit (This Session)" action directly to the existing `ignoreCommit` webview message (`BlameIgnoreCommitMessage`) already handled by `blameTabPanel.ts` and `main.ts`.
