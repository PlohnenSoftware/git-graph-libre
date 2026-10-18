---
summary: >-
  Complete (`2026-07-03`): settings popup with Repository and Extension tabs,
  editors built from the manifest, hue-preserving OKLCH `graphColors` editor
  (`oklchColor.ts`), export/import of extension settings only.
---

# Phase 13: Settings Hub — Tabbed Widget, Color Editor, Settings Export

**Status: complete.** Set by the maintainer on `2026-07-03` and implemented
as the second maintainer-priority slice after Phase 12.

Goal: turn the repository-settings popup into a two-tab settings hub. Tab 1
(default, "Repository") keeps the current repo-scoped settings. Tab 2
("Extension") lists every `neo-git-graph.*` extension setting with rich,
previewed editors — most importantly the graph colors, which VS Code's
default settings UI shows as a raw JSON array with no preview — plus a graph
color editor that preserves each color's hue while editing
saturation/lightness for the whole palette, and export/import of the
extension's settings only (shareable with friends without touching the rest
of the IDE).

Implementation plan (precise, for the implementing agent):

1. Tab shell in `src/webview/settingsWidget.ts`:
   - Refactor `renderSettingsWidget()` into `renderRepositoryTab(model)` (the
     existing content) and `renderExtensionTab(model)`, under a header with a
     `role="tablist"` of two `role="tab"` buttons (`aria-selected`,
     `aria-controls`, arrow-key navigation, Home/End) and `role="tabpanel"`
     containers. Repository tab is the default; the open tab is webview state
     (`settingsWidgetTab` in `WebViewState`) so it survives reloads.
   - Reuse `.settingsSection`/`.settingsRow` styles; add tab styles to
     `media/main.css` using `--vscode-panelTitle-*` /
     `--vscode-tab-*` tokens with `--ngg-*` OKLCH fallbacks per the styling
     guide.
2. Extension-settings model (extension host side):
   - New module `src/extension/extensionSettings.ts`: build the settings list
     from the extension's own `package.json` `contributes.configuration`
     (id, type, default, enum, markdown/plain description via the existing
     nls machinery) so newly contributed settings appear automatically; pair
     each with its current effective value and scope from
     `vscode.workspace.getConfiguration("neo-git-graph")` `inspect()`.
   - New typed messages in `src/types.ts` +
     `src/extension/messageHandler.ts` routes:
     `loadExtensionSettings` (response: the list above),
     `updateExtensionSetting { key, value, global: true }` (apply via
     `config.update(key, value, vscode.ConfigurationTarget.Global)`,
     respond with the refreshed value or a typed error),
     `exportExtensionSettings`, `importExtensionSettings` (below).
   - Follow the existing request/response patterns (request ids where a
     stale response could race, typed `error` fields, `registerAction()`
     wrapping for actions).
3. Extension tab editors (webview side):
   - Render each setting generically by type: checkbox for booleans, bounded
     number input for numbers (reuse the same clamps as `src/config.ts`),
     dropdown for enums, text input for strings, and a read-only JSON row
     with an Edit dialog for objects (`contextMenuActionsVisibility`,
     `customBranchGlobPatterns`).
   - `graphColors` gets a rich editor instead of JSON: a swatch grid preview
     of all palette entries (reuse `--git-graph-color{i}` custom properties
     so swatches match the graph exactly), per-swatch tooltip with the color
     string, and a small live preview strip of colored graph lines/dots so
     the palette is "nicely previewed".
   - Palette-wide color editor: two sliders — lightness and chroma
     (saturation) — that rewrite every palette entry to
     `oklch(<L>% <C> <hue_i>)` while PRESERVING each entry's hue. This
     matches the documented palette rule (uniform L/C, hue-only variation).
     Implement the color math in a new dependency-free module
     `src/webview/utils/oklchColor.ts`:
     `parseOklch(value)`, `formatOklch({l, c, h})`, and
     `hexToOklch(value)`/`rgbToOklch(value)` (sRGB → linear → OKLab → LCh,
     standard published matrices; unit-test against known reference pairs).
     Non-OKLCH user values are shown as swatches and converted to OKLCH only
     when the user touches the palette sliders (state the conversion in the
     UI). No new runtime dependencies.
   - Per-swatch hue editing is optional scope; if added, a hue slider per
     swatch that keeps the shared L/C.
4. Export/import of extension settings only:
   - New module `src/extension/extensionSettingsFile.ts` modeled on the
     existing `src/extension/repoConfigFile.ts` (same save/open dialog
     patterns): export writes a JSON file (suggest default name
     `neo-git-graph.settings.json`) of shape
     `{ "kind": "neo-git-graph.extension-settings", "version": 1,
     "settings": { "<key>": <value>, ... } }` containing ONLY
     explicitly-set `neo-git-graph.*` values (from `inspect()`
     global/workspace values, not defaults) so importing cannot touch any
     other IDE configuration.
   - Import validates the `kind`/`version` envelope, whitelists keys against
     the manifest-derived list (unknown keys are reported and skipped),
     shows a confirmation dialog listing the changes, then applies each via
     `ConfigurationTarget.Global`. Malformed files produce a typed error
     dialog, never a silent partial apply.
   - Buttons live in the Extension tab next to a short explanatory line;
     l10n strings for all four languages (`en`, `pl`, `zh-cn`, `zh-tw`).
5. Keep the existing repo-settings flows untouched (they stay on Tab 1), and
   keep `package.json` setting descriptions localized via `package.nls*`.

Acceptance:

- The settings popup opens on the Repository tab and behaves as before; the
  Extension tab lists every contributed `neo-git-graph.*` setting with its
  current value and scope, editable in place, persisted globally, and
  reflected in the graph after the existing config-change refresh path.
- Graph colors render as live swatches; moving the lightness/chroma sliders
  updates all colors while each keeps its hue; values persist as OKLCH
  strings; the graph re-renders with the new palette.
- Export produces a file containing only `neo-git-graph.*` settings; import
  on a clean profile reproduces the exported configuration and changes
  nothing else; malformed input is rejected with a clear error.
- Full l10n coverage (`pnpm run l10n:check` passes); keyboard/tab a11y works
  (tablist arrows, focus states, Escape still closes).

Test plan (same slice):

- Unit tests for `oklchColor` conversions (reference values, roundtrips,
  clamping) and for the manifest-derived settings list (every contributed
  key appears; types mapped correctly).
- Webview tests: tab switching + state restore; generic editors dispatch
  `updateExtensionSetting`; palette slider rewrites preserve hue; swatch
  count matches `graphColors`.
- Extension tests: export payload contains only explicitly-set
  `neo-git-graph.*` keys; import whitelists/validates and applies via the
  configuration API; messageHandler routes with typed errors.
- CSS regression: tab styles and swatch styles in
  `tests/webview/tableStyles.test.ts`/`dialogStyles.test.ts` per the
  styling-guide token rules.

Implementation record:

- `2026-07-03`: Implemented Phase 13. The settings popup is now a two-tab hub:
  Repository remains the default tab and keeps the existing repo-scoped flows,
  while Extension lists manifest-derived `neo-git-graph.*` settings. The active
  tab is persisted in webview state as `settingsWidgetTab`, and the tablist uses
  `role="tablist"` / `role="tab"` / `role="tabpanel"` with arrow-key plus
  Home/End navigation.
- Added `src/extension/extensionSettings.ts` to read the extension manifest,
  resolve `package.nls*` setting descriptions, inspect current VS Code
  configuration scopes, validate/clamp imported values, and apply global
  updates. Added `src/extension/extensionSettingsFile.ts` for extension-only
  export/import using the envelope
  `{ kind: "neo-git-graph.extension-settings", version: 1, settings: ... }`.
  Imports whitelist manifest keys, skip unknown/invalid keys, confirm accepted
  changes, and apply via `ConfigurationTarget.Global`.
- Added typed webview/extension messages for loading, updating, exporting, and
  importing extension settings. The webview renders boolean, number, enum,
  string, and JSON editors generically, with a dedicated `graphColors` editor
  showing swatches, preview colors, and hue-preserving lightness/chroma sliders.
  New `src/webview/utils/oklchColor.ts` handles OKLCH parsing/formatting plus
  HEX/RGB-to-OKLCH conversion for user palettes.
- Added English, Polish, Simplified Chinese, and Traditional Chinese l10n keys
  for the tab labels, extension settings UI, import/export dialogs, statuses,
  and error surfaces. Added CSS coverage for settings tabs and color swatches.
- Focused verification:
  - `pnpm run typecheck`
  - `pnpm exec vitest run --project webview
    tests/webview/extensionSettings.test.ts
    tests/webview/settingsWidget.test.ts tests/webview/messageHandler.test.ts
    tests/webview/rendering.test.ts tests/webview/utils/oklchColor.test.ts`
    (`80` tests)
  - `pnpm exec biome check --config-path biome.strict.jsonc
    --error-on-warnings ...` over Phase 13 touched files (`21` files; clean,
    CSS files are not counted by the current strict Biome config)
  - `pnpm run lint`
  - `pnpm run test` (`37` backend files / `187` tests, `28` webview files /
    `225` tests)
  - `pnpm run l10n:check`
  - `pnpm run package`
  - `pnpm run test:coverage` (`65` files / `416` tests)
  - SonarQube initially failed the local gate (`72.0%` new coverage and `5`
    new violations), then after targeted fixes reached `0` new violations, and
    finally passed with task `3879c38f-2547-47ca-92bb-ef5edce77fc5`,
    analysis `bd301361-1721-4f8b-872d-f3d7545e6a57`: quality gate `OK`,
    new coverage `90.0%`, new duplicated-lines density `0.0`, and new
    violations `0`.
