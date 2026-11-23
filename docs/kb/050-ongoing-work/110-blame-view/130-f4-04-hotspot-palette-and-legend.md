---
summary: >-
  F4-04: Perceptual 10-step OKLCH hotspot palette (`--ngg-blame-heat-0`..`9`),
  GitHub-style vertical hunk heat rail, subtle `color-mix(in oklab, ...)`
  band tint, header Older-to-Newer legend with mode selector, same-commit
  hover highlight, CSS guard test, and dark/light headless renders.
---

# F4-04 — Hotspot OKLCH palette, heat rail, legend and hover highlight

Status: ready

Needs: F4-03 (and maintainer confirmation of BQ2)

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`) for `BQ2`; "Blame view"
(`060-future-work/040-git-graph-plus-features-research-and-plan/040-blame-view.md`),
section 1.2; the Webview UI Styling Guide (Reference).

Rules for every slice: implement from this project's own patterns; never copy
third-party CSS or color literals. Tests ship with behavior. Strict Biome on
touched files, no `var`, American English, OKLCH colors through `--ngg-*`
tokens with VS Code theme tokens first, `color-mix(in oklab, ...)` for tints
(never `srgb` or `oklch` interpolation), every user-visible string in all five
l10n bundles (`l10n:check` at 100%), no new telemetry. Do not bump versions or
edit `CHANGELOG.md`, `README.md`, or `NOTICE.md`; the integrator does. Report
Sonar: integrator.

## Touch

`media/tokens.css` (add `--ngg-blame-heat-0` through `--ngg-blame-heat-9`
in `:root` dark defaults and `body.vscode-light` overrides);
`media/blame-tab/blame-tab.css` (heat rail, subtle hunk background tint,
uncommitted neutral rail, legend swatches, same-commit hover highlight,
`@media (forced-colors: active)` and `@media (prefers-reduced-motion: reduce)`
rules); `src/blameTabTypes.ts` (heat mode label keys);
`src/extension/blameTab/blameTabPanel.ts` (label wiring);
`src/webview/blameTab/{main,rowModel,view}.ts` (header legend `Older` ↔ `Newer`,
heat mode switch `Age` / `Calendar` / `Churn` / `Off` per `BQ2`, saved mode in
webview state, same-commit hover/focus highlighting across all hunks sharing
`data-commit`); `l10n/bundle.l10n*.json` (all five bundles); tests in
`tests/webview/blameTab/`; this slice file's Status and Report.

## Task and acceptance

- **Perceptual OKLCH heat ramp (`media/tokens.css`):**
  - Define 10 stepped tokens `--ngg-blame-heat-0` (oldest/coldest) through
    `--ngg-blame-heat-9` (newest/hottest) in OKLCH:
    - Smooth perceptual progression from muted cool/neutral-slate at `0`
      through soft amber to vibrant warm orange/amber at `9` (inspired by
      GitHub's blame heat strip while staying visually distinct from VS Code's
      error red).
    - Separate `body.vscode-light` values tuned so every step remains crisp
      and legible on a white editor background without washing out source text.
    - Uncommitted hunks (`data-heat="uncommitted"`) use `--ngg-uncommitted`
      (neutral dashed or solid muted bar, never a hot color).
- **Hunk heat rail & tint (`media/blame-tab/blame-tab.css`):**
  - Continuous 4px vertical heat rail on the gutter edge of each hunk
    colored by `var(--ngg-blame-heat-N)`.
  - Subtle hunk gutter wash using
    `color-mix(in oklab, var(--ngg-blame-heat-N) <pct>%, var(--ngg-transparent))`
    so code contrast stays high (WCAG AA readability on source text).
  - `@media (forced-colors: active)` replaces color-only cues with visible
    `CanvasText`/`Highlight` borders and text labels; `@media (prefers-reduced-motion: reduce)`
    disables hover transitions.
- **Header legend & mode selector:**
  - Compact legend in the sticky header showing localized `Older`, the 10 heat
    swatches (using the exact `--ngg-blame-heat-0`..`9` tokens), and `Newer`.
  - Accessible mode switcher (`Age` default, `Calendar`, `Churn`, `Off` — or
    narrowed per `BQ2`) that recomputes `data-heat` client-side via
    `src/blameHotspot.ts` without re-running `git blame`, and persists the
    chosen mode in webview state.
- **Same-commit highlight:**
  - Hovering or keyboard-focusing any hunk marks all hunks in the file with
    the same `data-commit` hash (`is-same-commit`), giving immediate visual
    grouping across non-adjacent lines from one commit.
- **Tests & headless visual renders:**
  - Unit tests: heat attribute mapping (`0`..`9`, `uncommitted`, `none` when
    `Off`), mode toggle recomputation without host round-trip, same-commit
    hover highlight across multiple non-adjacent hunks, legend renders 10
    swatches.
  - CSS regression test: zero raw hex/RGB/HSL/named color literals in
    `media/tokens.css` (new rules) and `media/blame-tab/blame-tab.css`;
    verifies `color-mix(in oklab, ...)` and `@media (forced-colors: active)`.
  - Headless QtWebEngine renders in both dark and light themes showing a file
    with commits spanning all 10 heat buckets + an uncommitted hunk +
    same-commit highlight; record paths and observations in Report.

Run focused checks (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched files, `pnpm run typecheck`, `node esbuild.js --production`,
`npx vitest run --project webview tests/webview/blameTab/ tests/webview/blameTabPanel.test.ts`,
`pnpm run l10n:check`, and `node ./docs/kb/housekeeping.mjs --check`) and
record each command and result. Claim and changes are separate signed commits;
never push.

## Report

Not started.
