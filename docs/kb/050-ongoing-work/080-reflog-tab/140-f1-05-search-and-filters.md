---
summary: >-
  F1-05: Search text, an action filter, a ref picker (HEAD, local branches,
  the stash) and an "only in the reflog" toggle, searching the whole reflog up
  to a cap rather than only the loaded page.
---

# F1-05 — Search, filters and ref picker

Status: ready

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

Not started.
