---
summary: >-
  D65 · integrated · webview + l10n + data · ~250 lines: a third tab in the
  Settings popup, "Contributors", crediting everyone who contributed, by
  era (Git Graph Libre, the neo-git-graph fork, the original Git Graph, the
  Rust engine), from the project's own rosters, then an "AI agents" section
  naming the AI agents that co-authored commits. Maintainer request,
  `2026-10-20`.
---

# D65 — A Contributors tab

Status: integrated b9683e5
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

- **Agent / date:** Claude Sonnet 5.5, 2026-10-20
- **Branch and commits:** `diff-1.9.0/d65` — `4951ced G docs(release): claim D65 (D65)`; `bbf12e1 G feat(settings): add the contributors data module (D65)`; `8a1dda9 G feat(scripts): add contributors:agents to list co-author identities (D65)`; `651dd4d G feat(settings): add a Contributors tab to the Settings popup (D65)`; the report commit follows these
- **Files changed:** `src/webview/contributors.ts` +64 (new), `scripts/list-coauthor-agents.mjs` +31 (new), `package.json` +1, `src/types.ts` +1/−1, `src/webview/settingsWidget.ts` +66, `src/webview/main.ts` +10/−1, `src/extension/webviewL10n.ts` +8, `l10n/bundle.l10n*.json` +8 each (five), `media/settings.css` +25, `tests/webview/contributors.test.ts` +50 (new), `tests/webview/settingsWidget.test.ts` +35, `tests/webview/settingsWidgetActions.test.ts` +26, `tests/webview/rendering.test.ts` +3/−2. About 361 added lines in all, 215 outside tests.
- **Tests added or changed:** `contributors.test.ts` (6 cases: rosters found, every NOTICE.md and LICENSE.mit person credited, nobody credited that no roster names, no `@` or email-shaped string, no dependabot); `settingsWidget.test.ts` (+2: tab role and aria wiring, eras and agents listed); `settingsWidgetActions.test.ts` (+1: arrow keys, End and wrap-around reach and leave the tab). Changed `rendering.test.ts`: its End-key expectation now lands on the Contributors tab, which is the new last tab (the check itself is unchanged in strength). Webview 781 → 790 passed; backend 1109 passed, 60 skipped, unchanged.
- **Gates:** biome clean (strict, `--error-on-warnings`, every touched .ts/.json/.mjs file); typecheck clean; test backend 1109/1169 (60 skipped), webview 790/790; l10n 100% in all four translations; kb:check clean; Rust arm n/a; Sonar: integrator
- **Acceptance:** Tab renders in dark and light themes: met, renders at `/tmp/claude-1000/-home-zam-Desktop-prog--GGL-git-graph-libre/b4d56831-757a-4187-a220-37dfb594841e/scratchpad/d65/contributors-dark.png` and `.../contributors-light.png` (PyQt6 QtWebEngine under `xvfb-run`, real `media/*.css`, Dark Modern and Light Modern token values). Strict Biome, typecheck, test counts, l10n 100%, kb:check: met, above. `pnpm run contributors:agents` output: `151 Claude Sonnet 5.5`, `137 Muse Code`, `84 Claude Opus 5.5`, `80 Claude Opus 5 (1M context)`, `26 Claude Haiku 5.5`, `18 Codex`, `16 Muse Code powered by Meta Muse Spark`, `5 ZCode`, `4 neophack`, `3 Kilo`, `3 Muse Code D21 (muse-wonder-full-1.0)`, `3 Muse Spark`, `2 Claude Sonnet 5`, `2 Muse Code D42F (muse-wonder-full-1.0)`, `2 zamkorus`, `1 Copilot`.
- **Deviations from the slice:** none. `Kilo` is listed without a maker because the slice names none and the trailers give only a `z.ai` address.
- **Open questions / follow-ups:** Git author `Thomas KT Chan` (4 commits on 2026-10-15: revert/pull/cherry-pick `--no-commit` dialog option, multi-select quick toggling, Enter to confirm dialogs, scrolling a tall context menu) is in no roster in `NOTICE.md` or `LICENSE.mit`, so the tab does not credit them; the maintainer should decide on a roster entry. `Arezimt Legion` (git author name) is credited as "Arezimt (Arezim)" per the roster. `Copilot` and `copilot-swe-agent[bot]` are shown as "GitHub Copilot". `neophack` and `zamkorus` trailers are people (the roster has both). The Contributors tab is not wired to load anything on open, unlike the Extension tab.
