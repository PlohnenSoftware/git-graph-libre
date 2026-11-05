---
summary: >-
  D04b · needs D04a · at most 180 changed lines outside tests, including
  generated icons: render T in tree/list with arrow-switch and localized
  text, and verify existing M-style file-action routing.
---

# D04b — Type-change presentation and actions

Status: integrated 587347c
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

- **Agent / date:** Muse Code (general-purpose) sub-agent D04b, claimed
  2026-10-19 10:49 Europe/Warsaw; report 2026-10-19 10:53. Model note:
  general-purpose on the inherited runtime model — no Haiku/Sonnet/Opus
  selector exists in this runtime; the integrator records the constraint.
- **Branch and commits:** `diff-1.9.0/d04b` —
  `45f7396 G docs(release): claim D04b type-change presentation slice (D04b)`;
  `bc3ea8e G feat(details): badge type changes with arrow-switch (D04b)`;
  plus the signed report commit carrying this section. No push.
- **Files changed:** `scripts/generate-octicons.js` +1, `src/octicons.ts`
  +6/−1 (generated only, MIT header kept), `src/webview/utils/icons.ts` +1,
  `src/webview/commitDetailsView.ts` +16, `media/commit-details.css` +22,
  `src/extension/webviewL10n.ts` +1, each of the five `l10n/bundle.l10n*.json`
  +1, tests +247. 53 insertions and 1 deletion outside tests (54 changed
  lines, generated icons included; budget ≤180), all within *Touch*.
  `src/webview/main.ts` and `src/extension/messageHandler.ts` needed no
  change — see Deviations.
- **Tests added or changed:** `commitDetailsView.test.ts` +3 cases (T badge
  in tree and list: class/`data-type`, arrow-switch SVG, visible T, localized
  text, counts, escaped path, M row unbadged; binary T keeps the binary title
  and no diff affordance; comparison T sends `viewDiff` with type T and both
  comparison refs), `rendering.test.ts` +2 cases (plain-details T through the
  real menus: file click, revision view, working-tree comparison, Open, copy
  path, reset behind its confirmation dialog; binary T click/menu gating),
  `octicons.test.ts` +1 case (arrow-switch generated and exposed as
  `svgIcons.typeChange`), `messageHandler.test.ts` title case extended
  (T keeps the ordinary two-revision title). Webview total 655 → 661.
- **Gates:** strict Biome clean (14 touched code/locale/test files);
  `pnpm run typecheck` green; webview 661/661 (full webview project);
  backend not run — no backend files changed and the message-handler suite
  runs in the webview project (37/37); `pnpm run l10n:check` 100% all
  locales; `pnpm run kb:check` green. Rust arm n/a. Sonar: integrator.
- **Acceptance:** tree/list T presentation met — shared helper renders the
  T class and `data-type`, the arrow-switch SVG, the visible T status and
  the localized "Type changed" description (also the badge `title`), with
  counts and binary indication preserved and paths escaped; A/M/D/R rows
  unchanged (pinned by tests and visible in the renders). Actions met —
  `viewDiff` sends T with correct refs and paths on both historical sides,
  revision view, working-tree comparison, copy paths, Open and reset
  confirmation follow the existing modified-file routing, binary gating
  remains, and diff titles stay ordinary two-revision titles. Icon
  generation and catalog coverage met (`pnpm run icons:generate`, 24 icons).
  Headless QtWebEngine/Xvfb renders with the real `media/*.css` and markup
  generated from the real helper, inspected in both themes:
  `/tmp/ggl-d04b-visual/dark.png`, `/tmp/ggl-d04b-visual/light.png`
  (harness beside them). l10n 100% in all five bundles (nl/pl/zh-cn/zh-tw
  translated, not copied English).
- **Deviations from the slice:** none in scope. Step 3's verification found
  the existing routing already correct for T in every named action, so the
  two "only if needed" *Touch* files (`src/webview/main.ts`,
  `src/extension/messageHandler.ts`) are untouched and the behavior is
  pinned by the new tests instead. The T row color reuses VS Code's
  renamed-resource git-decoration token with the `--ngg-accent` fallback;
  the badge text uses the description token, matching the guide's
  theme-token-first rule.
- **Open questions / follow-ups:** D13's Swap button still uses the `sync`
  glyph; `arrow-switch` now exists in the catalog, but swapping D13's glyph
  is outside this slice's written scope, so it is left for the integrator
  or a follow-up (one line in `commitDetailsView.ts`). Another agent (D12)
  touches `src/webview/main.ts` in its own worktree; this slice does not,
  so no overlap is expected there. D04 completes only after this integrates
  beside D04a (`88f3715`).
