---
summary: >-
  F4-05: GitHub-style "View blame prior to this change" parent-blame rewind
  with Back/Forward/Latest navigation stack across renames, header blame
  option toggles (`-w`, `-M`, `-C`, `.git-blame-ignore-revs` + per-session
  `--ignore-rev` chips), and in-tab Find / Author filter.
---

# F4-05 — Parent-blame rewind stack, options, ignore-revs and find

Status: waiting

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

Not started.
