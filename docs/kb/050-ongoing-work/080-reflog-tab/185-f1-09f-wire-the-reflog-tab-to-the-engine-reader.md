---
summary: >-
  F1-09F: Wires the Reflog tab's two assembly sites to F1-09's
  engine-first reader (live `backend` setting and repository
  verification), so the tab actually serves reflog reads from the engine
  instead of staying on the CLI. The W10F shape; no visible change.
---

# F1-09F — Wire the Reflog tab to the engine reader

Status: ready

Needs: F1-09

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

Opened at F1-09's integration (`2026-11-09`): F1-09 built the engine-first
reader `readReflog` and taught `createReflogSource` to forward optional
`backend` and `isVerified`, but the only sites that hold the live values
are outside F1-09's Touch list, so the tab still reads every page on the
CLI. This is the W10 → W10F shape from release 1.10.0. F1-09's Report
(Deviations) names the two sites and the exact deps; start there.

## Touch

`src/extension/messageHandler.ts` (the default `openReflog` assembly);
`src/extension/commandManager.ts` (its `openReflog`, which holds no
verification dep today); `src/extension.ts` only if the dep must be
threaded from there (an `openReflogTab` assembly like `openScmDiffTab`'s
is the in-house shape); `src/extension/reflogTab/reflogData.ts` only if
its deps shape must change; tests for the touched files; the slice file's
Status and Report. Another agent works F1-04F beside you on the reflog
webview, panel and bundles: do not touch `src/webview/reflogTab/*`,
`src/extension/reflogTab/reflogTabPanel.ts`, `src/reflogTabTypes.ts`,
`media/reflog-tab/*` or the l10n bundles.

## Task and acceptance

- Both assembly sites pass the live values into `createReflogSource`:
  the `backend` setting read per call (messageHandler's live `config`,
  as the graph reader does) and `isVerified` from the repository search
  (`repoSearch.isVerified(repo)` in F1-09's words — verify the live
  names in code). A repository Git has not accepted is never served by
  the engine, exactly as the other reads guarantee.
- Behavior is invisible: with `backend: "git-cli"`, an unverified
  repository, or a binary without the optional export, every page is
  the CLI's, byte for byte as before F1-09; with the engine allowed and
  verified, the parity suites of F1-09 already prove identical results.
- Tests pin the routing at the assembly level: the engine route is
  offered the read when the setting allows and the repository is
  verified; it is not offered when the setting is `git-cli` or the
  repository is unverified (the F1-09 reader's own declines are already
  pinned; do not re-prove them).
- No new telemetry: F1-09 found the worktree-listing precedent (no
  flag touched). If wiring changes that, stop and report.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
