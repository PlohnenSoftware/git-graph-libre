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

Status: claimed by Muse Code subagent on 2026-11-09 04:00

Needs: F1-04, F1-09

Model: Claude Haiku (cheapest first; escalate one step on failure)

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

Not started.
