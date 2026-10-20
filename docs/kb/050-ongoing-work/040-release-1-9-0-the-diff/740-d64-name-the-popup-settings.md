---
summary: >-
  D64 · ready · webview + l10n · ~30 lines: the settings popup holds a
  Repository tab and an Extension tab, but its title, its toolbar button and
  its accessible name all say "Repository Settings". Call it "Settings"
  everywhere, in all five languages. Maintainer request, `2026-10-20`.
---

# D64 — Name the popup "Settings"

Status: ready
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

_(not started)_
