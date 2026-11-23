---
summary: >-
  F1-05: Search text, an action filter, a ref picker (HEAD, local branches,
  the stash) and an "only in the reflog" toggle, searching the whole reflog up
  to a cap rather than only the loaded page.
---

# F1-05 — Search, filters and ref picker

Status: done — awaiting integration

Needs: F1-04, F1-09

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`050-ongoing-work/080-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
for this slice's detailed design and the facts it marks [verify]; the Webview
UI Styling Guide (Reference) when the slice touches the webview; the Phase 16
invariants and non-goals when it touches the engine.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy Git Graph+ code (read it only if the slice says so,
and then describe rather than copy). Tests ship with behavior, using real-Git
fixtures in temporary directories only. Strict Biome on touched files, no
`var`, American English, OKLCH colors through `--ngg-*` tokens with VS Code
theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: if a
telemetry chokepoint would count something new or a declaration must change,
stop and report. Do not bump versions or edit CHANGELOG, README or notices;
the integrator does. Report Sonar: integrator.

## Touch

`src/backend/queries/reflog.ts` (and the engine-backed reader from F1-09
if the search goes through it); `src/extension/reflogTab/*`;
`src/webview/reflogTab/*`; `media/reflog-tab/*`; the reflog strings module;
`l10n/bundle.l10n*.json`; tests; the slice file's Status and Report.

## Task and acceptance

- The ref picker changes the query: HEAD, local branches and `refs/stash`
  (other worktrees' HEADs come in F1-08; no remote-tracking reflogs).
- Text search and the action filter cover the whole reflog up to a cap of
  5,000 entries (a constant), with a visible note when the cap was reached.
  Pass user text to Git only as an option value (for example
  `--grep-reflog=<text>` with `-F` and `-i`, after verifying they combine
  with `-g` and `-n`), never as an option of its own.
- An "Only in the reflog" toggle uses the F1-02 state.
- Tests: grep across more than one page, special characters in the search,
  the stash reflog, the toggle, a ref name that looks like an option.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 02:28
- **Branch and commits:** `reflog/F1-05` —
  `1352c4e4 G docs(reflog): claim slice F1-05 (F1-05)`;
  `773abb63 G feat(reflog): add message grep and ref listing to the reflog read (F1-05)`;
  `73b4433c G feat(reflog): carry the search query and picker refs across the tab boundary (F1-05)`;
  `3d882623 G feat(reflog): search and filter the whole reflog up to the cap in the data source (F1-05)`;
  `bf8a1850 G test(reflog): pin the panel query wiring (F1-05)`;
  `ed3af16c G feat(reflog): add the search, filter and ref picker controls (F1-05)`;
  plus this report commit.
- **Files changed:** 24 files, +1415/−120 at `ed3af16c` (`git diff --stat b6b23d20..HEAD`):
  `src/backend/queries/reflog.ts`, `src/backend/engine/reflog.ts` (the F1-09 reader Touch
  names for a search that goes through it), `src/extension/reflogTab/reflogData.ts` and
  `reflogTabPanel.ts`, `src/reflogTabTypes.ts` (the reflog strings/types module, as in F1-04),
  `src/webview/reflogTab/{main,rowModel,view}.ts`, `media/reflog-tab/reflog-tab.css`, the five
  `l10n/bundle.l10n*.json` (5 new keys each, inserted inside the reflog block immediately
  before `reflog.action.commit`, never at the end), nine test files, and this slice file.
  Nothing outside Touch: `package.json`, `src/types.ts`, `src/extension/messageHandler.ts`
  and `src/webview/main.ts` are untouched.
- **Tests added or changed:** 28 new cases. Backend: `reflog.test.ts` +7 (grep finds the
  oldest match beyond a first page, fixed/dash-led search text as one `--grep-reflog=` value
  on both paired reads, paging over matches, no-match state, the stash reflog, a refused NUL,
  the picker listing, its parser) and `reflogParity.test.ts` +1 routing case (a grep goes to
  the CLI, reason `grep`). Extension/webview: `reflogData.test.ts` +8 real-Git cases,
  `reflogTabPanel.test.ts` +3 plus label/echo assertions, `view.test.ts` +5, `rowModel.test.ts`
  +2 (including query normalization), `main.test.ts` +1 (debounce), `reflogTabCss.test.ts` +1,
  and the shared fixtures. After: the two backend reflog files run 110 tests, the eight
  webview reflog files 84.
- **Gates:** strict Biome (`biome.strict.jsonc --error-on-warnings`) on all 22 touched
  .ts/.json files — clean (the schema-version notice is the pre-existing one);
  `pnpm run typecheck` — clean; focused runs as above; `pnpm run test` — backend 113 files,
  1498 passed and 60 skipped, webview 85 files, 1116 passed; `pnpm run l10n:check` — 100%
  in all five languages (the five new strings are this agent's own translations);
  `node ./docs/kb/housekeeping.mjs --check` — exit 0. No `engine/**` change, so no Rust
  arm and no addon rebuild. Sonar: integrator.
- **Acceptance:**
  - Ref picker changes the query — met. `loadReflogRefs` lists `HEAD`, every local branch's
    full ref in Git's order, and `refs/stash` only when it exists (no remote-tracking refs,
    RQ8); the panel refreshes the list on each fresh load and passes the picked full ref to
    the read. The webview shows a branch by its short name and the stash as the stash word
    plus `(refs/stash)`, the full ref on hover. A query from over the boundary is normalized
    before use — only `HEAD`, `refs/stash` or a `refs/heads/…` name survives, so an
    option-like ref (`-n1`, `--output=/tmp/x`, a remote or tag ref) falls back to `HEAD`
    in the panel and is refused again by the backend read; both are pinned by tests.
  - Whole-reflog search and filters up to the 5,000 cap, with a visible note — met.
    `REFLOG_SEARCH_CAP` (a constant, no setting) bounds a filtered read's fetched entries:
    the data source fetches in bounded chunks (Git's own matches for a search text, plain
    entries otherwise), applies the action and state filters, cuts the asked page out of
    the matches, and sets `searchCapped` when the fetch stopped at the cap with more
    behind it; the tab then shows "The search limit of 5,000 entries was reached…" above
    the table (and beside a no-match word). Verified against Git 2.56 in a scratch repo
    before building: `--grep-reflog` with `--fixed-strings` and `--regexp-ignore-case`
    combines with `-g`, `-z`, `--max-count` and `--skip`, matches literal special and
    dash-led text, and `--max-count`/`--skip` count matches, which is what fixes the cap
    reading above. The user text reaches Git only as the `--grep-reflog=` value; the
    engine reader declines a grep to the CLI.
  - "Only in the reflog" toggle on the F1-02 state — met. It keeps exactly the candidates
    whose state is `reflogOnly` (their badges come from the same read); without it, states
    are read only for the shown slice, so badges stay cheap.
  - Action filter — met as a single-action select over the localized kind words plus
    "All actions" (the query type carries a kind list, so more can be added later without
    a boundary change). The search box searches reflog messages (its placeholder says
    so), debounced by 250 ms, Escape clears it, and focus, pending text and cursor
    survive the view's whole-document renders. A filter matching nothing in a reflog
    that has entries reads "No matching entries.", distinct from the empty/no-reflog
    wording; a watcher or settings refresh re-answers the same query, and retargeting
    the panel to another repository resets it.
  - Headless renders — met. PyQt6 QtWebEngine under `xvfb-run` (`QT_QPA_PLATFORM=xcb`),
    the real `reflogTab.min.js` bundle (fresh `node esbuild.js`), the real
    `media/tokens.css` and `media/reflog-tab/reflog-tab.css`, and labels generated from
    `l10n/bundle.l10n.json`, in both themes, read by eye: the filter row, kinds and
    badges read correctly dark and light, the checked toggle ticks, the cap note and
    the no-match word sit where they should. Images and harness in
    `/tmp/ggl-renders-f1-05/` (`reflog-dark.png`, `reflog-light.png`,
    `reflog-filtered-dark.png`, `reflog-filtered-light.png`, `reflog-nomatch-dark.png`,
    `make-pages.py`, `shot.py`). Honestly noted: the `--vscode-*` values are injected by
    the harness (not read from a live editor), and the rendered rows and states are
    harness fixtures, not a Git read.
- **Deviations from the slice:** the cap reading in the bullet above (fetched entries,
  which for a text search are Git's matches, since that is what `--max-count` bounds);
  the note's wording is kept true for both cases. The toggle's checkbox box is styled
  inside `media/reflog-tab/reflog-tab.css` mirroring the shared neutral box, because
  `media/checkbox.css` is outside this slice's Touch and its box selectors do not reach
  this tab. Nothing else.
- **Open questions / follow-ups:** none blocking. The new translations are the agent's
  own; a native review would help. F1-08 extends this picker with the other worktrees'
  HEADs per RQ8. A multi-kind action filter could later use the query's kind list as it
  stands.
