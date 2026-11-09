---
summary: >-
  F1-06: Recovers from a reflog entry: create branch here (first), create tag
  here, check out detached, copy hash, show in graph, and reset the current
  branch through the existing reset dialog (mixed by default, hard behind its
  second confirmation).
---

# F1-06 — Recovery actions that cannot lose data

Status: waiting

Needs: F1-08

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

`src/extension/reflogTab/*`; `src/webview/reflogTab/*`; reuse of the
existing actions in `src/backend/actions/*` without changing their behavior;
the existing dialogs; `src/extension/webviewPanel.ts` (or the graph's message
path) only for "Show in Graph"; the reflog strings module;
`l10n/bundle.l10n*.json`; tests; the slice file's Status and Report.

## Task and acceptance

- Actions per entry: "Create Branch Here…" (first, never moves HEAD),
  "Create Tag Here…", "Check Out (Detached)" with today's dirty-tree handling,
  "Copy Hash", "Show in Graph" (reveals the commit when the graph has it,
  otherwise offers to turn on `includeReflog` for the repository with a
  visible note, never silently) and "Reset Current Branch to Here…" through
  the existing reset dialog: mixed by default, hard only behind the existing
  second confirmation that names what is lost.
- A `missing` entry disables every action and says why.
- Only Git commands the product already runs: `git branch`, `git tag`,
  `git checkout --detach`, and the existing reset modes.
- Tests with real Git: make a commit unreachable with a hard reset and
  recover it through each action; a dirty working tree on checkout; the
  missing case; assertions that no action moves any ref except the intended
  one.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
