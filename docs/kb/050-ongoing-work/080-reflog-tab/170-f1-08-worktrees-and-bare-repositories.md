---
summary: >-
  F1-08: Makes the Reflog tab correct for linked worktrees (whose HEAD reflogs
  are separate), bare repositories and repository changes: the header names
  the worktree, the picker lists the other worktrees' HEADs, and the panel
  follows or closes with its repository.
---

# F1-08 — Worktrees and bare repositories

Status: waiting

Needs: F1-05

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

`src/backend/queries/reflog.ts`; `src/extension/reflogTab/*`;
`src/webview/reflogTab/*`; reuse of `src/extension/worktreeDiscovery.ts` and
the worktree list query; the repository manager hooks the panel needs
(`src/extension/repoManager.ts`); the reflog strings module;
`l10n/bundle.l10n*.json`; tests; the slice file's Status and Report.

## Task and acceptance

- The header says whose HEAD is shown; the ref picker adds the other
  worktrees' HEADs (read in that worktree), marking locked or prunable ones.
- A bare repository shows branch reflogs with a note that Git keeps no HEAD
  reflog there by default.
- When the repository is removed or switched, the panel follows or closes;
  any engine handle the reflog read opened is closed (Phase 16 rule 5).
- Tests: a main and a linked worktree with different HEAD reflogs; a locked
  and a stale worktree; a bare repository; repository removal.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
