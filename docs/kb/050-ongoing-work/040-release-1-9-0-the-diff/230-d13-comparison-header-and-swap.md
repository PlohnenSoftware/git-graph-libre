---
summary: >-
  D13 · wave B · needs D10 · webview · ≤200 lines: make a comparison look
  like one. The details show "Comparing <base> → <compare>", with ref names
  where known, a Swap button, and the same labels in the diff tab titles.
  Today a comparison opens commit details with nothing saying what it
  compares.
---

# D13 — Comparison header and swap

Status: done — awaiting integration
Needs: D10
Decisions: —
Kind: webview, plus l10n and CSS · Size budget: ≤ 200 changed lines outside tests
Source: [issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26); Phase 8 acceptance, "Selecting two commits shows a comparison view"

## Goal

Anyone looking at a comparison can see which two points it compares, and
turn it around.

## Read first

- [The agent protocol](010-agent-protocol.md), and D10's report
- `src/webview/commitDetailsView.ts`: `renderCommitDetailsRowHtml`,
  `renderCommitDetailsSummary`
- `src/webview/main.ts`: `expandedCommit.comparison`, `showCommitDetails`,
  `handleCommitComparisonResponse`, `viewGitFileDiff`
- `src/extension/messageHandler.ts`: `formatRevisionDiffTitle`
- The CSS rules in the KB's Webview UI Styling Guide (OKLCH, theme tokens
  first)

## Steps

1. Extend the comparison state to `{ baseRef, compareRef, baseLabel?,
   compareLabel? }`. The labels are what the user picked (a branch or tag
   name, or `HEAD`); a raw hash shows as its abbreviation through the
   existing `displayHash`.
2. When `expandedCommit.comparison` is set, render a header line above the
   summary: `l10n.comparing` with `{0} → {1}`, and a Swap button (an icon
   with `title=l10n.swapComparison`) that calls `loadCommitComparison` with
   the refs exchanged.
3. Pass the labels to `viewDiff`'s title. `formatRevisionDiffTitle` may
   receive labels instead of refs; keep its fallback to abbreviated hashes.
4. Add the strings to all five bundles. The CSS goes into the existing
   commit-details stylesheet, OKLCH only.

## Touch

`src/webview/commitDetailsView.ts`, `src/webview/main.ts`,
`src/webview/global.d.ts`, `src/extension/messageHandler.ts` (title only),
`src/extension/webviewL10n.ts`, `l10n/bundle.l10n*.json`, the commit-details
CSS file under `media/`, `tests/webview/commitDetailsView.test.ts`,
`tests/webview/messageHandler.test.ts`

## Tests

- The header renders only for comparisons, with labels or abbreviated
  hashes.
- Swap sends `commitComparison` with base and compare exchanged.
- Diff titles carry the labels.

## Acceptance

Gates pass, and the header is visible in light and dark themes. Use the
headless render in the KB's Webview UI Styling Guide, and attach the
screenshot paths to the report.

## Report

- **Agent / date:** Muse Code (general-purpose) sub-agent D13, reassigned
  2026-10-19 10:35 Europe/Warsaw from the previous D13 agent (inactive since
  02:28), inherited uncommitted work preserved and finished; report
  2026-10-19 10:45. Model note: general-purpose on the inherited runtime
  model — no Haiku/Sonnet/Opus selector exists in this runtime; the
  integrator records the constraint.
- **Branch and commits:** `diff-1.9.0/d13` — `a96a19b G feat(compare):
  comparison header and swap (D13)`, plus the signed report commit carrying
  this section. No push.
- **Files changed:** `src/webview/commitDetailsView.ts` +41/−4,
  `src/webview/main.ts` +49/−9, `src/webview/global.d.ts` +13/−1,
  `src/extension/messageHandler.ts` +12/−1 (title only),
  `src/extension/webviewL10n.ts` +2, `media/commit-details.css` +48, each of
  the five `l10n/bundle.l10n*.json` +2, `tests/webview/commitDetailsView.test.ts`
  +324/−5, `tests/webview/messageHandler.test.ts` +28; 13 files, 527/−20 total,
  190 changed lines outside tests (budget ≤200), all within *Touch*.
- **Tests added or changed:** `commitDetailsView.test.ts` 9 → 19 cases
  (header only for comparisons with labels/abbreviated hashes, escaping and
  one-pass placeholder substitution, no first-parent claim for compared
  merges, branch/tag/commit-vs-HEAD and two-selected headers through the
  real menus, Swap sending `commitComparison` with refs and labels
  exchanged, file diff carrying the labels, plain details without a
  header); `messageHandler.test.ts` diff-title case extended (picked-ref
  label kept whole, hash fallback, `^`/`^3` suffixes). Webview total
  644 → 654.
- **Gates:** strict Biome clean (12 touched code/locale/test files, one
  import-order fix applied); `pnpm run typecheck` green; webview 654/654,
  backend 856 passed / 887 total with 31 missing-addon skips in this
  worktree (no backend files changed; the `messageHandler` suite ran in
  the webview project, 37/37); `pnpm run l10n:check` 100% all locales;
  `pnpm run kb:check` green; `git diff --check` clean. Rust arm n/a.
  Sonar: integrator.
- **Acceptance:** header met — renders only for comparisons, above the
  summary, with picked ref names or `displayHash` abbreviations, in all
  five locales; Swap met — icon button (`title`/`aria-label` =
  `swapComparison`) reloads the comparison exchanged; diff titles met —
  `viewDiff` carries the picked ref and `formatRevisionDiffTitle` keeps
  ref labels whole with the abbreviated-hash fallback. Headless
  QtWebEngine/Xvfb render with the real `media/*.css`, inspected in both
  themes: `/tmp/ggl-d13-visual/dark.png`, `/tmp/ggl-d13-visual/light.png`
  (harness `preview-dark.html`/`preview-light.html`/`shot.py` beside them).
- **Deviations from the slice:** three interpretation choices, all kept
  inside *Touch*. (1) Step 3 read as written: `formatRevisionDiffTitle`
  receives labels *instead of* refs — a label is the picked ref name, so
  `viewGitFileDiff` sends `baseLabel ?? baseRef` (the `HEAD` side already
  travelled as a ref name, and `RequestViewDiff` in `src/types.ts` is
  outside *Touch*, so no separate label fields were added); the title
  then treats only hex hashes (with optional `^`/`~` suffix) as
  abbreviable. Note a picked branch name therefore resolves at
  file-click time like `HEAD` does, not pinned to its hash. (2) The Swap
  icon is the already-generated `sync` octicon imported directly in
  `commitDetailsView.ts`; generating octicons' `arrow-switch` would need
  `scripts/generate-octicons.js`, `src/octicons.ts` and
  `src/webview/utils/icons.ts`, none in *Touch* (D04b generates
  `arrow-switch` later, so a one-line glyph swap is possible then).
  (3) D06's first-parent note: the inherited work already suppresses it
  whenever a comparison is shown (the comparison case, inside this
  slice's surface and pinned by tests); the stash case is untouched.
- **Open questions / follow-ups:** the first-parent note still shows for
  stashes (outside D13's scope; needs a marker threaded through, as D06's
  report records). Integrator: the full gate with the built engine addon
  (31 worktree skips to clear), coverage and Sonar; judge deviation (1)
  — if pinned-hash file diffs with separate typed label fields are
  preferred, that is a small follow-up needing `src/types.ts` in *Touch*.
