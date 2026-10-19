---
summary: >-
  D04b · needs D04a · at most 180 changed lines outside tests, including
  generated icons: render T in tree/list with arrow-switch and localized
  text, and verify existing M-style file-action routing.
---

# D04b — Type-change presentation and actions

Status: ready
Needs: D04a
Decisions: X2 (b); split, icon and action policy approved 2026-10-19
Kind: webview, icons, localization · Size budget: ≤180 changed lines outside tests, including generated icons

## Read first

Agent protocol, D04 umbrella, D04a report; Webview UI Styling Guide and
headless verification record; shared file-row helper in commitDetailsView.ts,
file actions in main.ts/messageHandler.ts, icon generator/catalog and real CSS.

## Steps

1. Render T, dedicated arrow-switch Octicon and localized Type changed
   text in the shared tree/list helper for commits, comparisons and
   stashes. Preserve counts and binary presentation.
2. Add arrow-switch alphabetically to the generator catalog, regenerate
   src/octicons.ts with MIT attribution, add a shared svgIcons entry and
   theme-token styling with OKLCH fallbacks.
3. Verify existing M-style actions: both historical sides, explicit refs,
   ordinary two-revision titles; preserve binary gating, copy paths,
   revision view, working-tree comparison, Open and reset confirmation.
4. Localize in all five bundles/webviewL10n and inspect dark/light
   QtWebEngine previews using actual CSS.

Synthetic gitlink content and object-kind-specific Open hiding are outside
this approved scope; stop if required. No new dependency.

## Touch

`scripts/generate-octicons.js`, `src/octicons.ts` (generated only),
`src/webview/utils/icons.ts`, `src/webview/commitDetailsView.ts`,
`media/commit-details.css`, `src/webview/main.ts` (T actions only if needed),
`src/extension/messageHandler.ts` (T titles/actions only if needed),
`src/extension/webviewL10n.ts`, `l10n/bundle.l10n*.json`, matching webview/icon/action tests.

## Tests and acceptance

- Tree/list T class/data attribute, SVG, visible status, description,
  counts, binary indication, escaping; unchanged A/M/D/R rows.
- viewDiff sends T and correct refs/paths; revision/comparison/copy/Open/reset
  follow the approved policy; binary gating remains.
- Icon generation/catalog coverage; dark/light screenshots inspected and
  paths reported. Protocol gates, 100% l10n, integrator coverage/Sonar OK
  at integration. D04 completes only after both sub-slices integrate.

## Report

_(not started)_
