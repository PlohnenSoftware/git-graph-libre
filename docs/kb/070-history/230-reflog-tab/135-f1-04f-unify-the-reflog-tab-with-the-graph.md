---
summary: >-
  F1-04F: Unifies the Reflog tab with the graph wherever the two show the
  same concept — commit hashes through `abbrevCommit` at the
  `shortHashLength` setting instead of a fixed seven characters, the
  graph's own words and date shapes, and table columns the user can
  widen and narrow by dragging, as in the graph — per the maintainer's
  remarks of `2026-11-09` (One name and one shape for a shared concept,
  Reference).
---

# F1-04F — Unify the Reflog tab with the graph

Status: integrated `29594fde`

Needs: F1-04, F1-09

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`070-history/230-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
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

Maintainer remark, `2026-11-09`, that opened this slice: the Reflog tab
shows the commit hash called and sized differently from the graph tab.
Unify the looks; tackle similar inconsistencies too. Something novel may
be inspired by an external source, but anything the project already has
in-house is the source of truth. The standing form is One name and one
shape for a shared concept (Reference, Webview UI Styling Guide).

Second maintainer remark, `2026-11-09`, after seeing the colored tab
("it looks good"): the reflog table should behave like the graph table,
its columns free to widen or narrow. That is the same remark in
behavior form — the graph's resize interaction is the in-house truth —
so it is part of this slice, not a new one.

## Touch

`src/webview/reflogTab/*`; `src/extension/reflogTab/*` (plumbing the
settings in); `src/reflogTabTypes.ts` (the message/config shape);
`src/extension/webviewL10n.ts` or the reflog strings module;
`l10n/bundle.l10n*.json`; `media/reflog-tab/*` (the column
resize rules); tests; the slice file's Status and Report. The graph's
own files are the reference, not a touch target: if the graph's side looks
wrong, stop and report instead of editing it. Another agent works F1-09F
beside you on the assembly sites: do not touch
`src/extension/messageHandler.ts`, `src/extension/commandManager.ts` or
`src/extension.ts`.

## Task and acceptance

Audit the tab concept by concept against the graph (the in-house source
of truth named first; the tab's current form second), align each one that
has a counterpart, and record in the Report any that is genuinely novel
and stays its own:

- **Commit hash** — graph: `abbrevCommit(hash, config.shortHashLength())`
  (`src/backend/utils/string.ts`; setting `shortHashLength`, default 8,
  accessor in `src/config.ts`, webview boot config in `webviewHtml.ts`).
  Tab today: its own `shortHash()` at a fixed 7 in
  `src/webview/reflogTab/rowModel.ts`, and its own column key
  `reflog.column.hash`. Use the same helper at the same setting (plumb it
  through the panel like the graph's boot config, live on settings
  changes the way the graph follows them), and the graph's own word for
  the column. The full hash stays on hover.
- **Date and time** — graph: the `ui.date` header and the `dateFormat`
  setting, formatted through `src/webview/utils/date.ts`. Tab today:
  header "Time", always `formatRelativeDate` (already the shared helper),
  and its own `Intl.DateTimeFormat` hover in `rowModel.ts`. Give the
  column the graph's name and the setting's shape, hover included.
- **Load more** — graph: `ui.loadMore` ("Load More Commits"). Tab today:
  its own `reflog.loadMore` ("Load More"). One wording pattern for
  paging, in all five languages.
- **Resizable columns** — graph: dragging a header edge widens or
  narrows a column (`resizeCol` handles, `resizeTableColumn` with its
  clamp, minimum 40px, in `src/webview/main.ts`; CSS in
  `media/table.css`; behavior pinned by
  `tests/webview/tableColumnResize.test.ts`), and the widths persist
  per repository (`columnWidths` in the repo view state). Tab today:
  fixed layout, no resizing. Mirror the graph's interaction — same
  drag affordance, same clamp and minimum, widths kept across reloads
  the way this tab's own state is kept (the retained panel's pattern;
  per-repository like the graph's if the tab's state allows it without
  new plumbing, else say why). Every column resizes, including the
  message column's neighbours, and resizing never loses rows or the
  loaded pages.
- **Anything else duplicated** the audit finds: mono/hash cell styling,
  badge geometry beside the graph's ref badges, empty/error wording
  shapes. Align to the in-house form or record why it is novel.

Tests: the row model shortens hashes to the configured length (a changed
`shortHashLength` changes the tab and the graph alike); the column and
button labels resolve to the shared keys; the date cell follows
`dateFormat`; a drag widens and narrows a column and stops at the
graph's minimum, and the widths survive a reload. Headless renders in
both themes beside a graph render of the same repository, so the two
surfaces can be compared at a glance — one of them with a column
dragged wider than its default.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Muse Code subagent (muse-wonder-full-1.0), 2026-11-09 04:14
- **Branch and commits:** `reflog/F1-04F` —
  `f0543165 G docs(kb): claim slice F1-04F (F1-04F)`;
  `41611b2a G feat(reflog): graph hash length, date shape and words in the tab (F1-04F)`;
  `9adbaee9 G feat(reflog): resizable table columns, kept per repository (F1-04F)`;
  `e02f31fb G fix(reflog): header-cell widths and clipped cells, as the graph (F1-04F)`;
  plus this report commit.
- **Files changed:** 20 files, +722/−102 at `e02f31fb` (`git diff --stat de98ef51..HEAD`):
  `src/reflogTabTypes.ts` (+31), `src/extension/reflogTab/reflogTabPanel.ts` (+50),
  `src/webview/reflogTab/columnResize.ts` (new, +53), `main.ts` (+50), `rowModel.ts` (+91),
  `view.ts` (+110), `media/reflog-tab/reflog-tab.css` (+25), the five `l10n/bundle.l10n*.json`
  (4 lines each), seven test files, and this slice file. Nothing outside Touch; the assembly
  sites (`messageHandler.ts`, `commandManager.ts`, `extension.ts`) untouched.
- **Tests added or changed:** new `tests/webview/reflogTab/columnResize.test.ts` (6 tests);
  rowModel +2 (dateFormat shapes incl. hover, display carried per message), view +5
  (configured hash length with clamp, handles on every edge, drag widen/narrow/clamp/rows
  kept, first-drag freeze, stray move ignored), main +1 (per-repo widths across a reload),
  panel +1 (live reload on `shortHashLength` change, value read fresh) plus label/display
  assertions, CSS +1 (resize handles and fixed layout). The reflog webview files went from
  48 tests (7 files) to 64 (8 files, panel file included).
- **Gates:** `npx vitest run --project webview tests/webview/reflogTab/ tests/webview/reflogTabPanel.test.ts`
  — 8 files, 64 passed; `pnpm run typecheck` — clean; `npx biome check --config-path
  biome.strict.jsonc --error-on-warnings` on all 18 touched .ts/.json/.css files — clean
  (after one `--write` formatting pass, folded into `9adbaee9`); `pnpm run l10n:check` —
  100% all five languages; `node docs/kb/housekeeping.mjs --check` — exit 0. Sonar: integrator.
- **Acceptance:**
  - Commit hash — met. `abbrevCommit(row.hash, state.display.shortHashLength)` in the view;
    the tab's fixed-7 `shortHash()` is deleted. `ReflogDisplay` rides on both host messages,
    read per load through `config.shortHashLength()`/`config.dateFormat()` and the same bundle
    keys (`time.dateformat`, `time.needFormatMonth`, `month.*`) the graph's boot config reads.
    The panel also listens for the two settings and reloads live (loaded pages kept, as a
    watcher refresh keeps them) — at least as live as the graph, which follows them only via
    the settings-hub echo or the next open. Full hash stays on hover (`code.title`).
  - Date and time — met. The column is `ui.date`; `entryDate()` mirrors the graph's
    `getCommitDate` exactly (bundle pattern, bundle month names, `pad2` clock,
    `formatRelativeDate` for Relative, date-and-time always on hover), all through
    `src/webview/utils/date.ts`. The tab's private `Intl.DateTimeFormat` hover is deleted.
  - Load more — met as one wording *pattern*: `reflog.loadMore` is now "Load More Entries"
    beside `ui.loadMore`'s "Load More Commits" (the tab loads entries, not commits), in all
    five bundles (own translations: nl "Meer vermeldingen laden", pl "Załaduj więcej wpisów",
    zh-cn "加载更多条目", zh-tw "載入更多項目"). The graph's own words `ui.commit`/`ui.date`
    replace the tab's column keys; `reflog.column.hash`/`reflog.column.time` are deleted from
    all five bundles.
  - Resizable columns — met. `resizeCol` left/right handles on every header edge, the graph's
    pair-trade drag with its 40px minimum (`columnResize.ts`), fixed layout once dragged,
    first drag freezing the natural layout (rendered width minus the 16px side padding, the
    graph's own move). Widths are content widths on the header cells, exactly as the graph
    sets them — the first render pass tried colgroup widths, which squeezed the Commit
    column until hashes bled into Date; `e02f31fb` fixes that and clips cell overflow like
    the graph's cells. Every column resizes from either of its edges (the graph's boundary
    model). Dragging only restyles the table, so rows and loaded pages are never rebuilt
    (pinned by test). Widths persist per repository in the webview's saved state
    (`getState`/`setState`, validated by `normalizeColumnWidths`) — the tab has no
    host-side per-repo view state of its own, and reaching the graph's `saveRepoState`
    store would need the assembly sites this slice may not touch; saved webview state is
    the retained panel's own pattern and survives document reloads/restores of the panel.
    The graph's two special resize cases (lanes column, flexible description column with
    its 64px rendered floor) have no reflog counterpart, so the generic pair rule is the
    whole rule here.
  - Headless renders — met. PyQt6 QtWebEngine under `xvfb-run`, real CSS, the real
    `reflogTab.min.js` bundle fed this worktree's real HEAD reflog, beside the real graph
    webview's DOM (booted in jsdom on this branch's real commits via a scratch test,
    deleted after) with the graph's real stylesheets. Read by eye in both themes: identical
    8-character hashes (`9adbaee9`), identical date shapes (`9 Nov 2026 04:09`), Commit/Date
    words on both surfaces; the wide render is a real dispatched drag widening the Commit
    column. Images and harness scripts: `/tmp/ggl-f104f-renders/` (`reflog-dark.png`,
    `reflog-light.png`, `reflog-dark-wide.png`, `graph-dark.png`, `graph-light.png`,
    `side-by-side-dark.png`, `side-by-side-light.png`, `make-pages.py`, `shot.py`).
    Note the renders' state badges were assigned by position in the harness, not read from
    Git; the graph render's rows are this branch's commits at `9adbaee9`.
- **Audit, concept by concept** (aligned vs kept novel):
  - Aligned: hash length/helper/word, date word/shape/hover, paging wording pattern,
    column-resize interaction/clamp/minimum, header-cell tone (`descriptionForeground`,
    18px line height), cell overflow clipping, Load-more button already on the button tokens.
  - Kept novel, with reasons: the loading/empty/error wording (reflog-specific facts — the
    empty text explains `core.logAllRefUpdates` and expiry; the graph's generic words would
    say less); the state badges' pill geometry (they are VS Code-badge status pills, not ref
    badges — F1-04's approved look; the sub-action tags share the family); the mono `<code>`
    hash cell (the graph's commit cell is plain text, but a hash-only column reads as code;
    font already the editor's mono token); wrapping message cells instead of the graph's
    nowrap ellipsis (reflog messages are the row's substance and have no details view to
    open); the tab's own scrollbar rules (its bundle loads no graph CSS); Index/Action/
    Sub-action/Message/State columns and the kind dots (no graph counterpart).
- **Deviations from the slice:** the settings plumbing rides on the existing per-load
  messages (the labels pattern) rather than being rendered into the HTML like the graph's
  boot config — same accessors, same freshness contract, and it is what makes the live
  reload possible without touching `extension.ts`'s whitelist. Width persistence uses
  saved webview state instead of the graph's host-side repo state, for the reason above.
- **Open questions / follow-ups:** none blocking. The four `reflog.loadMore` translations
  are the agent's own, as F1-03's were; a native review would help. If the integrator later
  wires a host-side per-repo store for this tab, the saved-webview-state widths could move
  there, but nothing needs it today.
