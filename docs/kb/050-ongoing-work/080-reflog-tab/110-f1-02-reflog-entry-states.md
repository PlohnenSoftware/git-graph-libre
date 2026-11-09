---
summary: >-
  F1-02: Tells for each reflog entry on a page whether its commit is reachable
  from a ref, only in the reflog, or no longer exists, so the view can mark
  recoverable rows and disable impossible actions.
---

# F1-02 — Reflog entry states

Status: ready

Needs: F1-01

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

## Touch

`src/backend/queries/reflog.ts`; `src/backend/types/queries.types.ts`;
`tests/backend/queries/reflog.test.ts`; the slice file's Status and Report.

## Task and acceptance

- For the entries of one page, compute one of three states: `reachable`
  (reachable from a branch, tag or remote-tracking ref), `reflogOnly`
  (the commit exists but only reflogs reach it) and `missing` (the object no
  longer exists). Use `git cat-file --batch-check` on stdin for existence and
  one bounded Git call for reachability (for example `git rev-list` with the
  page's hashes and `--not --branches --tags --remotes`; verify the semantics
  and record them). Keep the cost bounded to one page and measure it on this
  repository's history.
- Tests with real-Git fixtures: a hard reset leaves a `reflogOnly` commit;
  deleting a branch likewise; a commit whose reflog entries expired and whose
  objects were pruned in the fixture is `missing`; ordinary commits are
  `reachable`.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
