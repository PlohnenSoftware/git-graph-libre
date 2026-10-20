---
summary: >-
  D64 · ready · webview + l10n · ~30 lines: the settings popup holds a
  Repository tab and an Extension tab, but its title, its toolbar button and
  its accessible name all say "Repository Settings". Call it "Settings"
  everywhere, in all five languages. Maintainer request, `2026-10-20`.
---

# D64 — Name the popup "Settings"

Status: done — awaiting integration
Needs: —
Decisions: — (maintainer, `2026-10-20`: "rename Repository settings to just
settings … because there are extension settings too")
Kind: webview + l10n · Size budget: ~30 changed lines outside tests
Source: the maintainer

## Goal

The gear button's tooltip, the popup's heading and its `aria-label` read
"Settings" (Dutch "Instellingen", Polish "Ustawienia", Simplified Chinese
"设置", Traditional Chinese "設定"), since the popup holds extension settings
as well as repository ones.

## Read first

- [The agent protocol](010-agent-protocol.md)
- The l10n key `ui.repositorySettings` in `l10n/bundle.l10n*.json` (five
  bundles) and its one accessor, `repositorySettings`, in
  `src/extension/webviewL10n.ts` (about line 32)
- Its three uses: `src/extension/webviewToolbar.ts` (the `settingsBtn`, about
  line 60), `src/extension/webviewHtml.ts` (the `settingsWidget` `aria-label`,
  about line 126) and `src/webview/main.ts` (the popup `title`, about line
  1909); and `tests/webview/setup.ts` (about line 36), which copies the body
  markup

## Steps

1. Rename the key to `ui.settings` and the accessor to `settings`, with the
   values above, in all five bundles.
2. Update the three uses and `tests/webview/setup.ts`.
3. Leave the `config.repository.*` descriptions ("Repository settings can
   override this per repository") as they are: they mean the Repository tab.

## Touch

`l10n/bundle.l10n*.json`, `src/extension/webviewL10n.ts`,
`src/extension/webviewToolbar.ts`, `src/extension/webviewHtml.ts`,
`src/webview/main.ts` (the one `title:` line), `tests/webview/setup.ts`, and
any test asserting the old string

## Acceptance

- No `repositorySettings` or `ui.repositorySettings` left in `src/`,
  `tests/` or `l10n/`; the button, heading and dialog name say "Settings".
- `l10n:check` 100%, strict Biome on touched `.ts` and `.json` files,
  typecheck, `pnpm run test` counts, `Sonar: integrator`.

## Report

- **Agent / date:** Claude Haiku 5.5 (slice agent), 2026-10-20 18:35
- **Branch and commits:** `diff-1.9.0/d64` — `c4bcf22 G docs(release): claim slice D64 (Settings title)`; `c3bd709 G refactor(settings): call the popup Settings (D64)`; the commit that carries this report, `G`, follows them.
- **Files changed:** `l10n/bundle.l10n.json` +1/−1; `l10n/bundle.l10n.nl.json` +1/−1; `l10n/bundle.l10n.pl.json` +1/−1; `l10n/bundle.l10n.zh-cn.json` +1/−1; `l10n/bundle.l10n.zh-tw.json` +1/−1; `src/extension/webviewL10n.ts` +1/−1; `src/extension/webviewToolbar.ts` +1/−1; `src/extension/webviewHtml.ts` +1/−1; `src/webview/main.ts` +1/−1; `tests/webview/setup.ts` +1/−1; `tests/webview/rendering.test.ts` +1/−3 (the assertion on the old label, collapsed to one line); status line and this report in the slice file. Code commit total: 11 insertions, 13 deletions.
- **Tests added or changed:** `tests/webview/rendering.test.ts`, "renders the graph controls as an accessible toolbar": expected aria-label `Repository Settings` changed to `Settings`. No test added. Before: webview 780 passed, 1 failed (781 total), failing on that assertion. After: webview 781 passed (781); backend unchanged at 1109 passed, 60 skipped (1169).
- **Gates:** biome pass (`--config-path biome.strict.jsonc --error-on-warnings` on all 10 touched `.ts`/`.json` files plus `rendering.test.ts`); typecheck pass (`tsc` for src, webview and tests); test backend 1109/1169 (60 skipped), webview 781/781; l10n 100% in all five languages; kb:check pass; Rust arm n/a (no `engine/**` change); Sonar: integrator
- **Acceptance:** met. `grep -rn repositorySettings src tests l10n` returns nothing. The gear button's aria-label is asserted as "Settings" by the webview rendering test. The popup title is `title: l10n.settings` in `src/webview/main.ts`, and the `settingsWidget` aria-label uses `l10nStrings.settings`; both are verified by code reading, not by a rendered-popup test. The `config.repository.*` descriptions in `package.nls*.json` are unchanged.
- **Deviations from the slice:** the `tests/webview/rendering.test.ts` edit was not named in the Touch list, but the slice's "any test asserting the old string" clause covers it. No other deviation.
- **Open questions / follow-ups:** none. The Dutch, Polish and Chinese values are the ones given in the slice; they were not independently reviewed by a native speaker.
