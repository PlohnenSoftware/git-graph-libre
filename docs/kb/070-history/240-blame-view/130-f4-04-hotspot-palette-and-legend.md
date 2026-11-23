---
summary: >-
  F4-04: Perceptual 10-step OKLCH hotspot palette (`--ngg-blame-heat-0`..`9`),
  GitHub-style vertical hunk heat rail, subtle `color-mix(in oklab, ...)`
  band tint, header Older-to-Newer legend with mode selector, same-commit
  hover highlight, CSS guard test, and dark/light headless renders.
---

# F4-04 — Hotspot OKLCH palette, heat rail, legend and hover highlight

Status: done — awaiting integration

Needs: F4-03 (and maintainer confirmation of BQ2)

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`070-history/240-blame-view.md`) for `BQ2`; "Blame view"
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

- **Agent / date:** Claude Haiku 5.5 (`claude-haiku-5-5`), 2026-11-23 12:48
- **Branch and commits:** `blame/F4-04` —
  - `61100c35` G docs(blame): claim slice F4-04
  - `8de2232c` G feat(blame): OKLCH heat ramp, heat rail, band wash and legend styles (F4-04)
  - `7c0a5c8b` G feat(blame): hotspot mode switch, heat legend and same-commit hover (F4-04)
  - `68e24744` G test(blame): cover hotspot heat, mode switch, same-commit hover and heat CSS (F4-04)
  - `e2e3c042` G fix(blame): read the mode selector's fallback text from the editor foreground (F4-04)
  - this report's status commit (see `git log`), signed.
- **Files changed** (against `9ba29a9c`, 17 files, +814 / −26; the slice file has +1/−1 for the claim, and the report is added in the status commit):
  - `media/tokens.css` +28
  - `media/blame-tab/blame-tab.css` +109 / −5 (heat rail, band wash, same-commit overlay, legend, selector, forced-colors and reduced-motion rules)
  - `src/blameTabTypes.ts` +16 (eight heat label fields)
  - `src/extension/blameTab/blameTabPanel.ts` +9 / −1 (label wiring in `readLabels` only; no other change to the file)
  - `src/webview/blameTab/rowModel.ts` +59 / −5 (`normalizeHotspotMode`, `scoreHunks`, `applyHotspotMode`; `applyData` re-scores with the saved mode)
  - `src/webview/blameTab/view.ts` +102 / −3 (heat legend, mode selector, same-commit highlight, hunks as tab stops)
  - `src/webview/blameTab/main.ts` +32 / −4 (saved `hotspotMode` beside `gutterWidthByRepo`; `persist()`)
  - `l10n/bundle.l10n{,.nl,.pl,.zh-cn,.zh-tw}.json` +9 / −1 each (eight keys appended at the end; the old last key gains its comma)
  - `tests/webview/blameTab/fixtures.ts` +9 / −1 (label fixture); `tests/webview/blameTab/main.test.ts` +4 / −1 (saved state now carries `hotspotMode`); new `tests/webview/blameTab/hotspot.test.ts` (+290) and `tests/webview/blameTab/hotspotCss.test.ts` (+110)
- **Tests added or changed:** 22 new tests, in `hotspot.test.ts` (heat steps 0..9, legend and ten swatches, selector order and selection, mode change callback, Off, calendar and churn scoring, uncommitted in every mode, same-commit hover and focus across non-adjacent hunks, webview reload restores the saved mode, unknown saved mode falls back to Age) and `hotspotCss.test.ts` (token presence in dark and light, OKLCH-only values, lightness ramp, `color-mix(in oklab, …)`, every `data-heat` and swatch rule, forced-colors system colors, reduced-motion transition, no raw literals). Changed: one assertion in `main.test.ts` (saved state now includes `hotspotMode: "age"`). Count: the two new files run 22 tests. The blame webview set (9 files, with `blameTabPanel.test.ts`) runs 71 passing at HEAD; the full webview suite is 1217 passing, against 1195 at F4-03's integration.
- **Gates** (all run in this worktree, focused unless noted):
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the 14 touched `.ts` and `.json` files: clean. Biome 2.6.8 reports `Checked 0 files` for the two `.css` files, so Biome does not check CSS in this configuration; the CSS guard tests cover it. Biome also prints a pre-existing notice that `biome.strict.jsonc`'s schema is 2.5.13 and the CLI is 2.6.8; the config is unchanged.
  - `pnpm run typecheck`: exit 0.
  - `npx vitest run --project webview tests/webview/blameTab tests/webview/blameTabPanel.test.ts`: 9 files, 71 passed.
  - `pnpm run l10n:check`: exit 0; nl, pl, zh-cn, zh-tw at 100% in both columns.
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - `pnpm run test` (full, once at the end): backend 1578 passed, 60 skipped (the expected worktree skips), 118 files; webview 1217 passed, 94 files; exit 0. Log: `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-04/full-test.log`.
  - `node esbuild.js --production`: built `out/blameTab.min.js` for the renders (not committed; `out/` is ignored).
  - Sonar: integrator.
- **Acceptance:**
  - `--ngg-blame-heat-0`..`9`, OKLCH only, dark defaults in `:root`, light overrides under `body.vscode-light`, coldest slate to hottest amber, hottest kept off error red (hue 55 at step 9): met; guard-tested and visible in the renders.
  - Heat rail 4px on each hunk's gutter edge, `color-mix(in oklab, var(--blame-heat) 14%, var(--ngg-transparent))` wash, `--ngg-uncommitted` neutral rail for uncommitted hunks: met (renders).
  - Header legend Older, ten swatches on the heat tokens, Newer; mode selector Age (default), Calendar, Churn, Off; saved in webview state; re-scored client-side with `src/blameHotspot.ts` with no `git blame` re-run: met (tests and renders).
  - Same-commit hover and keyboard focus marks every hunk with the same `data-commit` (`is-same-commit`): met (tests; render shows both hunks of commit 4 marked).
  - `@media (forced-colors: active)` and `@media (prefers-reduced-motion: reduce)` rules: met as CSS rules and guard tests; not rendered (see Deviations).
  - Strings in all five bundles, appended at the end: met (agent translations).
  - Headless renders, dark and light, PNGs listed below: met for dark and light; forced colors not rendered.
- **Deviations from the slice:**
  1. Forced colors: the slice asks for "visible CanvasText/Highlight borders and text labels". I drew system-color rails, a `Highlight` outline for the same-commit hunks, and bordered legend swatches. I did not add per-hunk text labels, so under forced colors the heat level is not readable beyond the rail's presence and the legend. A maintainer decision if per-hunk text is wanted.
  2. Forced colors and reduced motion were not rendered: the QtWebEngine harness cannot emulate either. Both are covered only by the CSS guard tests.
  3. The webview re-scores every hunk on each data message and mode change (`scoreHunks`), so the host's age heat from F4-03 is overwritten with the saved mode. The host path (`src/extension/blameTab/blameData.ts`) is unchanged.
  4. The legend and selector appear only when lines are on screen (not in the empty, binary, too-large, untracked, unborn or error states). Off hides the Older/Newer scale and swatches but keeps the selector.
  5. Each hunk is a tab stop (`tabindex="0"`). The slice's "keyboard-focusing" needs a focus target, and the hunk is the unit the highlight marks.
  6. Commit `8de2232c` has a `Refs:` line pointing at this slice's KB file. This slice has no GitHub issue, so the line is a pointer, not an issue reference. Commit `7c0a5c8b`'s body reports "71 passed" before the test files of `68e24744` existed; the figure is 71 at HEAD, and this report is the accurate record.
- **Open questions / follow-ups:**
  - Native review of the nl, pl, zh-cn and zh-tw strings would help (maintainer, as the overview's translation answer asks).
  - Forced-colors per-hunk text labels (deviation 1): a decision for the maintainer.
  - No telemetry added; `blameTabPanel.ts` was touched only in `readLabels`, so the parallel T1b wiring should merge cleanly.

**Renders** (`/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-04/`, harness `render.py` in the same folder, each opened and checked):
- `blame-dark-spectrum.png`: dark, Age, ten commits plus an uncommitted hunk, hover on commit 4 marks both of its hunks. The rail walks from slate to amber, the legend has ten swatches, the uncommitted rail is neutral.
- `blame-light-spectrum.png`: the same file on a white editor, Age, same hover. Rails stay visible; the mode selector reads as text after the fallback fix in `e2e3c042`.
- `blame-dark-churn.png`: dark, saved mode Churn. The commit that owns two hunks lifts to the hot end.
- `blame-light-off.png`: light, saved mode Off. Neutral rails only, no scale, selector shows Off.

Status: done — awaiting integration
