---
summary: >-
  F4-06: Commit detail popover (full linkified message, author/committer,
  avatar) and cross-surface actions from any blame hunk: Show Commit in Graph,
  Open Diff in GGL Diff (with `vscode.diff` fallback), Ignore Commit for this
  session, Copy Hash / Copy Message, and Open File at Line.
---

# F4-06 — Commit popover, Show in Graph, GGL Diff and Open File at Line

Status: waiting

Needs: F4-05

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`); "Blame view"
(`060-future-work/040-git-graph-plus-features-research-and-plan/040-blame-view.md`),
section 1.4; the Webview UI Styling Guide (Reference), especially popup
overflow (`overflow-wrap: anywhere`), sticky headers, and focus rules.

Rules for every slice: implement from this project's own patterns; never copy
third-party code. Tests ship with behavior, using real-Git fixtures in
temporary directories only. Strict Biome on touched files, no `var`, American
English, OKLCH colors through `--ngg-*` tokens with VS Code theme tokens
first, every user-visible string in all five l10n bundles (`l10n:check` at
100%), no new telemetry events or declarations. Do not bump versions or edit
`CHANGELOG.md`, `README.md`, or `NOTICE.md`; the integrator does. Report
Sonar: integrator.

## Touch

`src/blameTabTypes.ts` (commit details request/response, cross-action
messages: `loadCommitPopover`, `showCommitInGraph`, `openCommitFileDiff`,
`openFileAtLine`, `copyText`); `src/extension/blameTab/{blameData,blameTabPanel}.ts`
(load full commit message/body via existing `loadCommitDetails` query, wire
injected callbacks for graph reveal, diff tab open, clipboard, and VS Code
editor open-at-line); `src/extension.ts`, `src/extension/webviewPanel.ts`,
`src/extension/commandManager.ts`, and `src/extension/messageHandler.ts`
(thread `revealCommitInGraph(repo, hash)` and `openDiffTab` cleanly into the
Blame tab deps without duplicating assembly); `src/types.ts` and
`src/webview/main.ts` (if a host->graph message is needed to reveal a commit
when the graph opens or is already open — check `webviewPanel.ts` first);
`src/webview/blameTab/{main,view,popover}.ts` (new cohesive `popover.ts`,
reusing `src/webview/utils/linkify.ts` with `issueLinking` config);
`media/blame-tab/blame-tab.css`; `l10n/bundle.l10n*.json` (all five bundles);
tests under `tests/webview/blameTab/`, `tests/webview/blameTabPanel.test.ts`,
and relevant extension/panel tests; this slice file's Status and Report.

## Task and acceptance

- **Commit detail popover (`popover.ts`):**
  - Clicking a hunk's commit header (or pressing Enter/Space on it) opens an
    accessible popover (`role="dialog"`, `overflow-wrap: anywhere`, Escape
    dismisses and restores focus, click outside dismisses) anchored cleanly
    within the viewport.
  - Displays: commit subject + full body fetched on demand from existing
    `loadCommitDetails` (linkified via `linkifyText` + repo `issueLinking`),
    full hash, author & committer (collapsed when identical, matching
    `commitDetailsView.ts`), formatted date + full local date, and avatar when
    cached by `AvatarManager`.
  - Uncommitted hunks show a lightweight explanation ("Uncommitted local
    changes") with "Open File at Line" and (when `previous` exists) "View
    Blame at HEAD".
- **Cross-surface actions (in the popover and on hunk right-click):**
  - **Show Commit in Graph:** focuses/opens Git Graph Libre on the tab's
    repository and reveals that commit via `revealCommit(hash)`. If the commit
    is not yet loaded in the graph (for example older than the initial commit
    page), tells the user clearly rather than failing silently.
  - **Open Diff in GGL Diff:** opens the file's diff for that commit against
    its `previous` commit/path (or empty left side on file creation) in the
    existing GGL Diff tab when `diffTabAvailable` is true, falling back to
    VS Code's built-in `vscode.diff` (through `DiffDocProvider`) when the
    engine diff tab is unavailable.
  - **View Blame Prior to This Change:** triggers `F4-05`'s rewind action when
    `previous` exists.
  - **Ignore Commit (This Session):** appends the commit's hash to `F4-05`'s
    session `ignoreRevs` list and reloads.
  - **Copy Commit Hash** and **Copy Commit Message:** copies via extension
    host clipboard helper (`src/extension/utils/clipboard.ts`).
  - **Open File at Line:** clicking any line number (or the header/popover
    button) opens the working file in VS Code scrolled to that 1-based line
    (or opens the historical revision via `DiffDocProvider` when viewing an
    older revision whose path/content differs, clearly labeled).
- **Tests & visual check:**
  - Webview tests: popover open/load/render/linkify/Escape/focus-return,
    each action posts the expected host message, uncommitted popover variant.
  - Panel/extension tests: `showCommitInGraph` reveals existing graph or opens
    it for the repo; `openCommitFileDiff` routes to `openDiffTab` when
    available and falls back cleanly when unavailable; `openFileAtLine` opens
    at the exact 0-based VS Code line (`line - 1`).
  - Headless dark/light render with the commit popover open over a multi-hunk
    blame view (verifying readability, wrapping of long commit hashes/subjects,
    and no horizontal overflow).

Run focused checks (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched files, `pnpm run typecheck`, `node esbuild.js --production`,
relevant backend and webview `vitest` suites, `pnpm run l10n:check`, and
`node ./docs/kb/housekeeping.mjs --check`) and record each command and result.
Claim and changes are separate signed commits; never push.

## Report

Not started.
