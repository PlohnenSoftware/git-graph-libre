---
summary: >-
  D65H · ready · webview + l10n · ~40 lines: in the Contributors tab, say
  under each era's heading which license its code came in under, so it is
  clear that the original Git Graph (up to commit 4af8583), the
  neo-git-graph fork and the Rust engine are the MIT-licensed parts, and
  Git Graph Libre's own work is AGPL-3.0-or-later. Maintainer request,
  `2026-10-20`.
---

# D65H — The license of each contributor era

Status: ready
Needs: D65G
Decisions: — (maintainer, `2026-10-20`: "when it comes to git graph mention
it was MIT licensed part so it is clear everywhere")
Kind: webview + l10n · Size budget: ~40 changed lines outside tests
Source: the maintainer

## Goal

Each era in the Contributors tab shows its license beneath its name, in the
small secondary style the tab already uses for agent details
(`settingsContributorMeta`):

| Era | License line (English) |
| --- | --- |
| Git Graph Libre | AGPL-3.0-or-later |
| neo-git-graph fork | MIT-licensed |
| Original Git Graph | MIT-licensed, up to commit 4af8583 |
| Rust Git engine | MIT-licensed |

And one closing line after the eras, before "AI agents": "The MIT-licensed
code keeps its original notices in LICENSE.mit." These are statements
`NOTICE.md` and `LICENSE.mit` already make; add no other legal wording.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `src/webview/settingsWidget.ts`: `eraHeading`, the era rendering, and
  `renderAgentItem`'s `settingsContributorMeta` span
- `src/webview/contributors.ts`: `ContributorEraId`
- `src/extension/webviewL10n.ts` and the `settings.contributors*` keys in
  `l10n/bundle.l10n*.json`
- `NOTICE.md` and `LICENSE.mit`: the facts the lines restate
- The Webview UI Styling Guide and its headless-render record under Reference

## Steps

1. Five new l10n keys, `settings.contributorsEra{Libre,Fork,Original,Engine}License`
   and `settings.contributorsMitNote`, in all five bundles. "AGPL-3.0-or-later",
   "MIT" and "LICENSE.mit" are identifiers and stay as written in every
   language, as does the commit `4af8583`.
2. Render each era's license line beneath its heading, and the note after
   the last era, with escaped text and the existing meta style. Change no
   people, no agents and no other text.

## Touch

`src/webview/settingsWidget.ts`, `src/extension/webviewL10n.ts`,
`src/webview/main.ts` (the popup `labels` object only),
`l10n/bundle.l10n*.json`, `media/settings.css` (only if the meta style needs
a block variant), their tests

## Tests

- Each era renders its license line, and the note renders once, before
  "AI agents".

## Acceptance

- Headless renders of the tab, dark and light, with paths in the report.
- Strict Biome on touched files, typecheck, `pnpm run test` counts,
  `l10n:check` 100%, `kb:check`, `Sonar: integrator`.

## Report

_(not started)_
