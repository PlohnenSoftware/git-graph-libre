---
summary: >-
  F4-06: Commit detail popover (full linkified message, author/committer,
  avatar) and cross-surface actions from any blame hunk: Show Commit in Graph,
  Open Diff in GGL Diff (with `vscode.diff` fallback), Ignore Commit for this
  session, Copy Hash / Copy Message, and Open File at Line.
---

# F4-06 — Commit popover, Show in Graph, GGL Diff and Open File at Line

Status: done — awaiting integration

Needs: F4-05

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`070-history/240-blame-view.md`); "Blame view"
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

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 17:41
- **Branch and commits:** `blame/F4-06` —
  `3421b22e G docs(kb): claim the Blame commit popover slice (F4-06)`;
  `b7f739fd G feat(blame): add the commit popover message types (F4-06)`;
  `8101cfe3 G feat(blame): read full commit details for the popover (F4-06)`;
  `2499ad73 G style(blame): format the popover read to the strict width (F4-06)`;
  `d7932bf7 G feat(blame): wire the popover and cross actions in the panel (F4-06)`;
  `5eb1d270 G feat(blame): thread the popover deps through both tab routes (F4-06)`;
  `64e6cce3 G feat(blame): add the commit popover and hunk context menu (F4-06)`;
  `c15ced41 G feat(blame): style and localize the commit popover (F4-06)`;
  `e85af365 G test(blame): cover the commit popover and cross actions (F4-06)`;
  `61ed4538 G fix(blame): keep the popover forced-colors rules in the heat block (F4-06)`;
  plus this report commit. All show `G`.
- **Files changed:** 24 files, +2027/−25 at `61ed4538` (`git diff --stat 841edf13..HEAD`):
  `src/blameTabTypes.ts` +139/−3, `src/extension/blameTab/blameData.ts` +47,
  `src/extension/blameTab/blameTabPanel.ts` +254/−2, `src/webview/blameTab/popover.ts` +493 (new),
  `src/webview/blameTab/view.ts` +121/−6, `src/webview/blameTab/main.ts` +19,
  `media/blame-tab/blame-tab.css` +180, five `l10n/bundle.l10n*.json` +11/−1 each,
  `src/extension/commandManager.ts` +15/−1, `src/extension/messageHandler.ts` +10/−1,
  `src/avatarManager.ts` +16, `src/extension/blameTab/blameTabHtml.ts` +7/−3,
  tests +691/−3 over seven files, this slice file.
- **Tests added or changed:** new `tests/webview/blameTab/popover.test.ts` (10 tests: open/load,
  linkified fill with issue links, avatar, stale and error replies, Escape and outside-click
  dismissal with focus return, toggle, every cross action with hunk facts, boundary/ignored
  gating, differing committer rows, uncommitted variant, context menu);
  `view.test.ts` +4 (header opens popover and fills on reply, line-number click, right-click
  menu, popover closes on file change); `main.test.ts` +1 (all five new host messages plus the
  reply fill, Ignore reusing F4-05's `ignoreCommit`); `blameTabPanel.test.ts` +6 (popover reply
  with avatar and issue linking and no second `tab.blame` event, graph reveal with zero-OID and
  option-shaped refusals, GGL Diff request shape incl. the empty left side and outside-path
  refusal, `vscode.diff` fallback through `encodeDiffDocUri`, working file vs pinned revision at
  the exact 0-based line, copy hash and message); `blameData.test.ts` +2 (real-Git
  `loadCommitPopover`: subject, full message, parents incl. the true root's `[]`; zero OID,
  option-shaped and unknown hashes refused); `blameTabCss.test.ts` +1; fixtures labels extended.
  Webview 1,314 → 1,338 passed; backend unchanged at 1,592 passed (60 skipped in the worktree).
- **Gates:** strict Biome (`biome.strict.jsonc --error-on-warnings`) clean on every touched
  `.ts`/`.json`; `pnpm run typecheck` clean; `npx vitest run --project webview` on the six blame
  suites 99 passed; full `pnpm run test` backend 119 files / 1,592 passed, 60 skipped (expected
  in a linked worktree), webview 95 files / 1,338 passed; `pnpm run l10n:check` complete at 100%
  for nl, pl, zh-cn and zh-tw (the nine new `blame.*` values are my own translations, appended at
  the end of each bundle; a native review would help); `node esbuild.js --production` built
  `out/blameTab.min.js`; `node ./docs/kb/housekeeping.mjs --check` clean; signatures verified
  with `git log --format='%h %G? %s' 841edf13..HEAD`, all `G`. Sonar: integrator. Headless
  renders (PyQt6 QtWebEngine + `xvfb-run`, `QT_QPA_PLATFORM=xcb`, the real bundle and CSS, the
  popover open over a three-hunk blame with a 64-char hash and an unbreakable subject):
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-06/blame-popover-dark.png` and
  `blame-popover-light.png` (harness `render.py` beside them). Both read cleanly: subject and
  hash wrap inside the popover, no horizontal overflow, links linkified.
- **Acceptance:**
  - Commit detail popover in its own `popover.ts`: met. Clicking the hunk's commit header
    (a real button, so Enter/Space work) opens a `role="dialog"` popover on `body` with
    `overflow-wrap: anywhere`; Escape and outside clicks dismiss and restore focus; placement
    is clamped to the viewport and flips above the anchor. It shows the linkified subject and
    full body (fetched on demand through `fetchCommitInfo`, the CLI half of the existing
    commit-details read, linkified with `linkifyText` plus the repo's `issueLinking`), the full
    hash, author/committer with `commitDetailsView.ts`'s collapse rule, the formatted date with
    the full local date beside it when they differ, and the cached avatar when one exists.
  - Uncommitted popover: met. The house word (`blame.uncommitted`, "Uncommitted changes" —
    the slice's "Uncommitted local changes" follows the one-name rule) heads a one-line
    explanation with Open File at Line and, when `previous` exists, View Blame at HEAD
    (F4-08's existing `blameHead` message).
  - Show Commit in Graph: met. Reuses F1-06's `showCommitInGraph` route (open graph, else
    open it and retry); the graph already reloads to reveal and shows
    `error.unableToShowSearchResult` ("Unable to show selected commit") when the commit is
    not in the loaded page, so no graph-side change was needed. `src/types.ts`,
    `src/webview/main.ts`, `src/extension.ts` and `src/extension/webviewPanel.ts` are
    untouched, as the slice's "check webviewPanel first" allowed.
  - Open Diff in GGL Diff: met. A `DiffTabRequest` (file at the commit against its `previous`
    commit/path, empty left side on creation) goes to the injected opener when
    `diffTabAvailable`, else `vscode.diff` over `DiffDocProvider` URIs with the commit
    details view's title shape. Paths are refused unless they resolve inside the repository.
  - View Blame Prior to This Change / Ignore Commit (This Session): met through F4-05's
    existing `rewind` and `ignoreCommit` messages; no second message or list.
  - Copy Commit Hash / Copy Commit Message: met through `copyToClipboard`
    (`src/extension/utils/clipboard.ts`); the message is read host-side, so the context menu
    can copy it without opening the popover first.
  - Open File at Line: met. Line numbers are buttons; working-tree blames open the file on
    disk, a pinned revision opens its `DiffDocProvider` document, both at `line - 1`.
  - Cross actions on hunk right-click: met. One action list feeds the popover buttons and a
    `role="menu"` context menu in `popover.ts`.
  - Tests and visual check: met (above). Forced-colors rules for the popover and menu are in
    the CSS and covered by the CSS guard, but no forced-colors render was made.
  - No telemetry: met. The panel tests pin `tab.blame` at exactly one event across a popover
    read; no events or declarations were added.
- **Deviations from the slice:** two minimal glue edits outside the Touch list, both needed
  by the avatar acceptance item: `src/avatarManager.ts` gains a read-only
  `cachedAvatarImage(email)` (never queues a fetch; the routes gate it on `fetchAvatars`), and
  `src/extension/blameTab/blameTabHtml.ts` adds `img-src data:` to the CSP so the cached
  avatar's data URI can render. Wording follows the house names where they exist
  (`action.openInGglDiff`, `action.copyCommitHash`, `blame.uncommitted`, the `detail.*` words)
  instead of the slice's phrasings, per "One name and one shape for a shared concept".
  `view.ts` grew only by the delegation wiring (+121/−6); all popover and menu logic lives in
  `popover.ts`, whose largest function (`createBlamePopover`) is a flat set of small closures.
- **Open questions / follow-ups:** S2b still owns the pre-existing `blameTab/view.ts`
  complexity. The avatar shows only what `AvatarManager` has already cached (the popover never
  triggers a fetch), matching the slice's "when cached" wording. A forced-colors render of the
  popover was not made; the release-end render set in the overview can add it.
