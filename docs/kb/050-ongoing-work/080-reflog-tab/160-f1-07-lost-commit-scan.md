---
summary: >-
  F1-07: An opt-in "Scan for Lost Commits…" in the Reflog tab that finds
  commits no ref and no reflog reaches, with Git's read-only fsck, lists them,
  and offers Create Branch Here.
---

# F1-07 — Lost-commit scan (opt-in)

Status: claimed by Gemini 4 Neon (agy) on 2026-11-23 12:47

Needs: F1-06

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

New `src/backend/queries/lostCommits.ts`; `src/backend/queries/loadCommits.ts`
only to export and reuse its unreachable-commit parser; `src/extension/reflogTab/*`;
`src/webview/reflogTab/*`; `media/reflog-tab/*`; the reflog strings module;
`l10n/bundle.l10n*.json`; tests; the slice file's Status and Report.

## Task and acceptance

- Runs `git fsck --unreachable --no-reflogs --no-progress --connectivity-only`
  (the same scan the graph setting uses), then reads each commit's subject
  and date. Never `--lost-found`, and never a garbage collection or prune.
- Shows progress, can be cancelled, and has a timeout; says plainly that
  these commits disappear when Git collects garbage.
- Offers "Create Branch Here…" (F1-06's action) for each result.
- Tests: a fixture with a dropped stash and an abandoned commit; cancel and
  timeout; an empty result.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
