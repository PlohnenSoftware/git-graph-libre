---
summary: >-
  F1-04: Colors each reflog action and groups sub-actions by intent (edit,
  combine, integrate, flow, abort) with this project's own OKLCH palette,
  readable in light, dark and high-contrast themes.
---

# F1-04 — Colored actions and sub-actions

Status: ready

Needs: F1-03

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

`src/webview/reflogTab/*`; `media/reflog-tab/*`; shared style tokens if a new
`--ngg-*` token is needed; `src/extension/webviewL10n.ts` or the reflog
strings module; `l10n/bundle.l10n*.json`; tests; the slice file's Status and
Report.

## Task and acceptance

- Each kind from `classifyReflogMessage` gets a colored marker; sub-actions
  get a tag grouped by intent; unknown values get a neutral tag. Show a
  localized label and keep Git's raw text in the tooltip.
- Own palette in OKLCH tokens with VS Code theme tokens first; do not reuse
  Git Graph+'s colors, class names or grouping CSS.
- Tests: the kind-to-class mapping table; no raw color literals; tokens
  defined for both themes. Headless render in both themes.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
