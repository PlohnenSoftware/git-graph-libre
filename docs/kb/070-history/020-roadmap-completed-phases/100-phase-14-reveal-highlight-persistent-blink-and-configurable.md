---
summary: >-
  Complete (`2026-07-03`): the reveal highlight blinks until hover or click
  (`startRevealHighlight`), with reduced-motion handling; new setting
  `revealHighlightColor`, default `oklch(90% 0.25 150 / 0.42)`.
---

# Phase 14: Reveal Highlight — Persistent Blink and Configurable Color

**Status: complete (`2026-07-03`).** Persistent reveal highlighting,
the reveal color setting contribution, and the Phase 13 Extension tab swatch
editor are implemented and verified. A follow-up tuning on `2026-07-03`
aligned find/reveal highlight hue and softened the reveal pulse.

Goal: when Locate HEAD (or any reveal: find navigation, full-history search
result, pending-focus reveal) scrolls to a commit, the row must keep blinking
until the user hovers or clicks it — with smooth scrolling, the current
fixed-length blink can finish before the row is even on screen, so the user
lands on an unhighlighted row. The initial highlight color came from commit
`65056b30ffb70a4f8f51be26e997239535f210b3`; a later maintainer tuning keeps
that green hue while matching the focused find highlight's lightness/chroma
for consistency. The color must be customizable both in the VS Code settings
UI (extension section) and in the settings popup's Extension tab (Phase 13).

Previous state (verified before implementation on `2026-07-03`):

- `blinkHeadRow(hash)` in `src/webview/utils/dom.ts` adds the `blinking`
  class and removes it after a 700ms timeout, matching
  `animation: headPulse 320ms ease-in-out 2` in `media/main.css`.
- `revealCommit()` in `src/webview/main.ts` scrolls with
  `behavior: "smooth"`, so long scrolls outlive the 700ms blink — the bug.
- Current color: `--ngg-success-pulse: oklch(74% 0.12 152 / 0.5)`, keyframes
  transparent → pulse → transparent.
- Required color, taken verbatim from commit
  `65056b30ffb70a4f8f51be26e997239535f210b3` (`media/main.css`,
  `@keyframes headPulse` in this repository's history):
  - 0%: `oklch(87.44% 0.2383 150 / 0.1)`
  - 50% (peak): `oklch(87.44% 0.2383 150 / 0.5)`
  - 100%: transparent

Implementation plan (precise, for the implementing agent):

1. Persistent blink in `src/webview/utils/dom.ts`:
   - Replace `blinkHeadRow` with `startRevealHighlight(row: HTMLElement)`
     (rename per the obsolete-surfaces rule; update the `revealCommit()`
     call site): add the `blinking` class with NO timeout, switch the CSS
     animation to `infinite` iterations, and attach one-shot dismissal
     listeners — `mouseenter`, `click`, and `contextmenu` on the row — that
     remove the class and each other. Export a `clearRevealHighlight()` used
     when a new reveal starts so at most one row is highlighted at a time.
   - Table re-renders rebuild rows via `innerHTML`, which naturally drops
     the class; that is acceptable (a refresh is a user-visible state change)
     — document it in the function comment. The pending-focus reveal path
     re-applies the highlight after its reload.
   - Add `@media (prefers-reduced-motion: reduce)` handling: a steady
     highlight (the peak color, no animation) with the same dismissal.
2. Color swap in `media/main.css`:
   - Replace `--ngg-success-pulse` with `--ngg-reveal-highlight`; the original
     Phase 14 default used the peak from commit `65056b3`, then the
     maintainer follow-up tuned the current default to
     `oklch(90% 0.25 150 / 0.42)` so the locate highlight shares the focused
     find highlight's lightness/chroma and green hue.
   - Update `tests/webview/tableStyles.test.ts` ("uses the fixed green HEAD
     blink color") to the new variable, stops, and `infinite` iteration.
3. Contributed setting (satisfies "VS Code settings, extension section"):
   - `package.json`: `neo-git-graph.revealHighlightColor`, type string,
     current default `"oklch(90% 0.25 150 / 0.42)"`, localized description in
     `package.nls.json` + `pl`/`zh-cn`/`zh-tw` variants (run
     `pnpm run l10n:check`).
   - `src/config.ts`: accessor validating like `graphColors` (accept OKLCH,
     HEX, or RGB strings; fall back to the default on invalid input).
   - Pipe to the webview: add to `GitGraphViewState` (`src/types.ts`), and in
     `src/extension/webviewHtml.ts` emit
     `--ngg-reveal-highlight:<value>;` in `styleVars` so the CSS picks the
     user value up with the OKLCH default as fallback; the existing
     config-change refresh path re-renders with the new color.
   - Add the setting to the README configuration table.
4. Popup Extension tab (depends on Phase 13): the manifest-driven settings
   list picks the new key up automatically; require the color-type preview
   there — a live swatch next to the value using the same swatch styles as
   the `graphColors` editor, editable with the Phase 13 OKLCH affordances.
   If Phase 14 ships first, note in the slice record that the popup surface
   arrives with Phase 13.

Acceptance:

- Locate HEAD from a distant scroll position: the row is still blinking when
  the smooth scroll lands; it keeps blinking indefinitely until hovered or
  clicked, then stops immediately. Same for find/search reveals.
- The current default highlight uses the locate hue `150` with the focused
  find highlight's lightness/chroma (`90% 0.25`) and a gentler alpha/pulse.
- Changing `neo-git-graph.revealHighlightColor` in the VS Code settings UI
  changes the highlight; after Phase 13, the same edit works from the popup
  Extension tab with a live swatch preview.
- With reduced motion enabled, the row shows a steady highlight instead of
  pulsing, dismissed the same way.

Test plan (same slice):

- `dom.ts` util tests: class persists with no timer, `mouseenter`/`click`/
  `contextmenu` each dismiss and detach the other listeners, a second reveal
  clears the first row's highlight.
- Update the Ctrl+H test in `tests/webview/keyboardNavigation.test.ts`: the
  row still has `blinking` after the old 700ms horizon (no fake-timer
  advance needed once the timeout is gone), and hovering removes it.
- `tableStyles.test.ts`: new variable name, exact color stops, `infinite`
  iteration, reduced-motion rule.
- Config/manifest tests: accessor fallback on invalid values
  (`tests/backend/config.test.ts`), contributed key + nls entries
  (`tests/backend/manifest.test.ts`), viewState pass-through
  (`tests/webview/webviewHtml.test.ts` styleVars assertion).

Implementation record (`2026-07-03`):

- Replaced the timeout-based `blinkHeadRow(hash)` with
  `startRevealHighlight(row)` and `clearRevealHighlight()` in
  `src/webview/utils/dom.ts`. Reveals now keep the `blinking` class until
  `mouseenter`, `click`, or `contextmenu` on the row; starting another reveal
  clears the previous row first.
- Updated `revealCommit()` in `src/webview/main.ts` to pass the located row
  directly to the persistent highlight helper.
- Replaced `--ngg-success-pulse` with configurable
  `--ngg-reveal-highlight`. The original default used
  `oklch(87.44% 0.2383 150 / 0.5)`; the current default is
  `oklch(90% 0.25 150 / 0.42)` so locate and focused find highlights share
  lightness/chroma and hue. The keyframes now use a gentler 1100ms pulse with
  a 20% color-mix start before fading back to transparent; reduced-motion
  users get a steady highlight with the same dismissal behavior.
- Tuned search highlights to keep their existing lightness/chroma/alpha while
  using the locate highlight hue: rest matches are
  `oklch(80% 0.2 150 / 0.28)` and focused matches are
  `oklch(90% 0.25 150 / 0.42)`.
- Added `neo-git-graph.revealHighlightColor` to `package.json`,
  `package.nls*.json`, `src/config.ts`, `GitGraphViewState`,
  `src/extension/webviewHtml.ts`, and the README configuration table. The
  setting accepts OKLCH, HEX, or RGB values and falls back to the required
  OKLCH default on invalid raw values.
- Extended the Phase 13 Extension tab so `revealHighlightColor` renders as a
  text input with a live swatch. Manifest string patterns are now sanitized
  during extension-settings update/import flows.
- Added focused coverage for DOM helper persistence/dismissal, Ctrl+H reveal,
  pending-focus reveal, full-history search reveal, CSS variable/keyframes,
  config fallback, manifest contribution, webview style variable pass-through,
  settings widget rendering, and extension-settings import validation.
- Verification:
  - `pnpm run typecheck` passed.
  - Focused Vitest slice passed: `9` files / `108` tests.
  - Scoped strict Biome over touched files passed.
  - `pnpm run lint` passed (`174` files).
  - `pnpm run test` passed: backend `37` files / `189` tests; webview `29`
    files / `234` tests.
  - `pnpm run l10n:check` passed with `100%` package and bundle coverage for
    `pl`, `zh-cn`, and `zh-tw`.
  - `pnpm run package` passed.
  - `pnpm run test:coverage` passed: `66` files / `423` tests.
  - Local SonarQube scan passed quality gate. Task
    `c58de075-bf55-48a3-bba7-8a7b1f09f4f8`, analysis
    `d11117a1-ef5f-4ec8-ab07-1e4612c955b9`; new coverage `90.5%`,
    duplicated lines `0.0%`, new violations `0`.
  - Follow-up highlight color tuning (`2026-07-03`) passed:
    `pnpm run typecheck`, focused Vitest slice (`7` files / `97` tests),
    `pnpm run lint`, `pnpm run test` (backend `37` files / `189` tests;
    webview `29` files / `234` tests), `pnpm run l10n:check`, and
    `pnpm run package`.
