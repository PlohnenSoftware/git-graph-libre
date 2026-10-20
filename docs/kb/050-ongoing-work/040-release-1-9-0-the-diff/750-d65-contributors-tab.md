---
summary: >-
  D65 · ready · webview + l10n + data · ~250 lines: a third tab in the
  Settings popup, "Contributors", crediting everyone who contributed, by
  era (Git Graph Libre, the neo-git-graph fork, the original Git Graph, the
  Rust engine), from the project's own rosters, then an "AI agents" section
  naming the AI agents that co-authored commits. Maintainer request,
  `2026-10-20`.
---

# D65 — A Contributors tab

Status: ready
Needs: — (D64 runs in parallel; whichever is integrated second is rebased)
Decisions: the maintainer, `2026-10-20`: "add tab with contribution notice
listing all ppl who contributed also include agents sections mentioning AI
agents who also contributed". The orchestrator chose the data sources and
layout below.
Kind: webview + l10n + a data module · Size budget: ~250 changed lines outside tests
Source: the maintainer

## Goal

In the Settings popup, beside Repository and Extension, a **Contributors**
tab: a one-line thanks, the people who contributed grouped by era, and an
**AI agents** section naming the AI coding agents that co-authored this
project's commits.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `NOTICE.md` ("Contributors to the AGPL-licensed work") and `LICENSE.mit`
  (its per-era rosters, including the Rust engine's): these curated rosters
  are the source of truth for **people**. They already resolve identities
  (for example "Krzysztof Zabłocki (Zamkorus, PlohnenSoftware)" and
  "Arezimt (Arezim)"). Don't merge or split identities yourself; if git
  history shows a person missing from every roster, list that in the report
  as an open question instead of adding them.
- `.mailmap`, and the `Co-Authored-By` trailers in `git log` (the source for
  **agents**)
- `src/webview/settingsWidget.ts` (`renderSettingsWidget`, the two tabs),
  `src/types.ts` (`SettingsWidgetTab`), `src/webview/main.ts` (the popup's
  `labels`, about line 1909, and the generic arrow-key tab switch, about line
  2104), `media/settings.css`
- The Webview UI Styling Guide and its headless-render record under Reference

## Facts (checked `2026-10-20`)

- People, from the rosters: the AGPL era (Krzysztof Zabłocki (Zamkorus,
  PlohnenSoftware), Kristjan ESPERANTO, Arezimt (Arezim)); the
  neo-git-graph MIT fork (Asis Pattisahusiwa (asispts), Krzysztof Zabłocki
  (zamkorus), Mr.Lee, and the rest of that roster); the original Git Graph
  MIT era (Michael Hutchison (mhutchie), Larry Lu, Shoshin Nikita, Walter
  Meier, Viktor Fonic); the Rust engine (`vscode-git-graph-rs` `native/`:
  penghongxia and the rest of that roster). Take every name from the
  rosters themselves; this list only orients you.
- Agents, from the trailers, grouped by product with the models or
  variants seen:
  - Claude (Anthropic): Opus 5, Opus 5.5, Sonnet 5, Sonnet 5.5, Haiku 5.5
  - Codex (OpenAI)
  - Muse Code (Meta), powered by Muse Spark
  - GitHub Copilot, including its coding agent (`copilot-swe-agent[bot]`
    authored commits on `2026-09-04`)
  - ZCode, and Kilo (both with `z.ai` addresses)

  The `neophack` and `zamkorus` trailers are people, not agents.
  `dependabot[bot]` is automation, not an AI agent; leave it out, as the
  rosters do.

## Steps

1. A data module, for example `src/webview/contributors.ts`, exporting a
   typed constant: eras, each with a heading key and its people, as display
   names exactly as the rosters write them; and agents, each with a name,
   its maker and the variants seen. **No email addresses**, anywhere.
2. A script, `scripts/list-coauthor-agents.mjs`, registered as
   `pnpm run contributors:agents`, that prints the distinct `Co-Authored-By`
   identities from `git log`, names only, so the maintainer can see new
   agents later. It is not part of the test suite, since CI clones may be
   shallow.
3. `SettingsWidgetTab` gains `"contributors"`, and the popup a third tab and
   panel with the existing tab markup and keyboard pattern. The panel shows
   the thanks line, one titled list per era, then "AI agents" with a short
   localized note that these agents co-authored commits under the direction
   of the people above. Make no legal claim. Theme tokens first, with OKLCH
   fallbacks.
4. Localize the tab label, the thanks line, the era headings, the "AI
   agents" heading and its note, in all five bundles. Names stay as
   written.

## Touch

`src/webview/contributors.ts` (new), `scripts/list-coauthor-agents.mjs`
(new), `package.json` (the one script), `src/types.ts`
(`SettingsWidgetTab`), `src/webview/settingsWidget.ts`, `src/webview/main.ts`
(the popup's labels and tab plumbing only), `src/extension/webviewL10n.ts`,
`l10n/bundle.l10n*.json`, `media/settings.css`, their tests

## Tests

- Every person in the `NOTICE.md` and `LICENSE.mit` rosters appears in the
  data module. The test parses the indented roster lines, so a roster
  addition without a tab entry fails.
- The data module contains no `@` and no email-shaped string.
- Rendering: the third tab exists with its `role`, `aria-*` and panel; arrow
  keys reach it; the panel lists the eras and the agents section.

## Acceptance

- The tab renders in a dark and a light theme: headless renders per the
  styling guide's method, with paths in the report.
- Strict Biome on touched files, typecheck, `pnpm run test` counts,
  `l10n:check` 100%, `kb:check`, `Sonar: integrator`.

## Report

_(not started)_
