---
summary: >-
  F1-01: A bounded, typed CLI read of one ref's reflog entries and a pure
  classifier for reflog messages. Backend only; no visible change. Verifies
  the research's [verify] facts against real Git.
---

# F1-01 — Reflog read query

Status: claimed by Claude Sonnet on 2026-11-09 01:30

Needs: none

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

`src/backend/queries/reflog.ts` (new); `src/backend/types/queries.types.ts`;
`tests/backend/queries/reflog.test.ts` (new); the slice file's Status and Report.

## Task and acceptance

- One read-only query lists a ref's reflog entries newest first, bounded by
  a limit and an offset (for paging), each with the commit hash, the selector
  index (`HEAD@{N}`), the reflog entry's own time (not the commit's), the
  identity that made the entry, and the raw message. Use `git log -g -z` with
  an explicit `--format` and parse NUL-separated records; verify the exact
  placeholders (`%gd`, `%gs`, `%gn`, `%ge`, and how to get the entry time) and
  that `--skip` works with `-g`, and record what you verified in the Report.
- Validate the ref before it reaches Git: refuse anything starting with `-`,
  pass `--end-of-options` where Git supports it, and resolve the ref first.
- Tell "no reflog for this ref" (for example `core.logAllRefUpdates=false`,
  a bare repository) from "an empty reflog" and from a real error; a failed
  read is an error, never an empty list.
- A pure `classifyReflogMessage` returns `{ kind, sub, raw }` with an open set
  of kinds (commit, checkout, reset, rebase, merge, pull, fetch, cherry-pick,
  revert, branch, stash, clone, other). It tolerates `rebase -i (pick)` and
  `rebase (pick)`, unknown text from other tools, and never throws.
- Tests: the classifier against a table of subjects captured from real Git in
  fixtures (never typed from memory); real-Git fixtures for plain commits,
  amend, rebase pick, squash and abort, fast-forward and no-ff merges,
  checkout, reset, cherry-pick, revert, detached HEAD, a linked worktree (HEAD
  reflog per worktree, branch reflog shared), `core.logAllRefUpdates=false`, a
  bare repository, an expired entry (`git reflog expire` in the fixture), a run
  with `LANG`/`LC_ALL` set to a non-English locale (do subjects stay
  English?), paging across a page boundary, and a ref starting with `-`
  refused.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
