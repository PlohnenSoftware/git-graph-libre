---
summary: >-
  D40 · wave D · ready · CSS and notices · ≤150 lines plus the vendored CSS:
  copy the rules of VS Code's diff editor stylesheet that the GGL Diff tab
  uses into `media/diff-tab/vscode-diff.css`, re-rooted under `.ggl-diff`,
  with Microsoft's MIT notice, so the tab colors lines and characters
  exactly as the diff editor does.
---

# D40 — Vendor the diff editor's stylesheet

Status: ready
Needs: —
Decisions: Phase 17 D4 (answered: G4, option (c))
Kind: CSS and notices · Size budget: ≤ 150 changed lines, not counting the vendored CSS
Source: Phase 17, "No way to route a computed diff into the editor", sections "A GGL Diff tab, measured" and "Taking only the diff editor's drawing code"

## Goal

The GGL Diff tab (D40–D48) is a small view of our own that borrows VS
Code's diff editor look. This slice brings in that look: the stylesheet
rules for inserted and deleted lines and characters, gutter signs, filler
rows and collapsed unchanged regions. They're all colored through VS Code's
own theme variables.

## Read first

- [The agent protocol](010-agent-protocol.md)
- The Phase 17 record named under *Source*
- Webview UI Styling Guide, under Reference, especially its external-asset
  exception for color formats and its CSS regression tests
- `NOTICE.md` ("Incorporated MIT-licensed material") and `LICENSE.mit`

## Facts (checked `2026-10-19`)

- Source file: `microsoft/vscode`
  `src/vs/editor/browser/widget/diffEditor/style.css` at
  `1356222d342e6a7b2dd5603107bcdb60a6d0653b`. MIT, "Copyright (c)
  Microsoft Corporation". Fetch it with
  `gh api "repos/microsoft/vscode/contents/src/vs/editor/browser/widget/diffEditor/style.css?ref=<sha>" --jq .content | base64 -d`.
- Its colors come from `--vscode-diffEditor-*` variables
  (`insertedLineBackground`, `removedLineBackground`,
  `insertedTextBackground`, `removedTextBackground`, `diagonalFill`,
  `unchangedRegionShadow`, `border`), which VS Code also sets inside
  webviews.
- The diff editor's decoration class names are `line-insert`,
  `line-delete`, `char-insert`, `char-delete`, `gutter-insert`,
  `gutter-delete`, `insert-sign` and `delete-sign`
  (`registrations.contribution.ts`, same directory and commit). Filler
  rows use `diagonal-fill`; collapsed regions use `diff-hidden-lines`.
- The file also styles Monaco-only structure the tab doesn't have
  (`.monaco-editor`/`.monaco-diff-editor` roots, scrollbars,
  `.diffOverview`, codicons, moved-code action bars). A few of those rules
  use `rgba()` or hex literals.
- `.vscodeignore` already ships everything under `media/`.

## Steps

1. Create `media/diff-tab/vscode-diff.css` holding only the rules for the
   classes in *Facts*. Change each selector's root from `.monaco-editor` or
   `.monaco-diff-editor` to `.ggl-diff`, and keep the declarations
   verbatim.
2. Drop the codicon rules. The webview doesn't load codicons; D42 draws
   the signs as `+` and `−` text inside `insert-sign` and `delete-sign`.
3. Keep a literal color only when a rule you copied needs it, and say in
   the header why (the styling guide's external-asset exception). Don't
   convert it to OKLCH, because the file must stay comparable with its
   source.
4. Start the file with a header comment giving:
   - the source path and the commit;
   - `Copyright (c) Microsoft Corporation. Licensed under the MIT License
     (see LICENSE.mit).`;
   - "Trimmed to the rules the GGL Diff tab uses and re-rooted under
     `.ggl-diff`; changes are AGPL-3.0-or-later."
5. Notices:
   - **`LICENSE.mit`:** add a section for Microsoft Corporation with the
     copyright line and the MIT permission text verbatim. If one already
     exists (D20 adds one for the Phase 17 port), add this file to it
     instead of writing a second.
   - **`NOTICE.md`:** a subsection under "Incorporated MIT-licensed
     material", "VS Code's diff editor styles
     (`media/diff-tab/vscode-diff.css`)". It names the source path and
     commit, and says the file was trimmed and re-rooted.
6. Add a CSS regression test in the style of the existing ones.

## Touch

`media/diff-tab/vscode-diff.css` (new), `LICENSE.mit`, `NOTICE.md`,
`tests/webview/diffTabCss.test.ts` (new)

## Tests

`diffTabCss.test.ts` reads the CSS file and asserts:
- every class named in *Facts* has a rule under `.ggl-diff`;
- no selector contains `.monaco-` or `codicon`;
- every color is a `var(--vscode-…)` reference, except the literals the
  header lists;
- the header names the source commit and the MIT license.

## Acceptance

- Gates pass, and the new test fails before the CSS file exists.
- `pnpm exec vsce ls` lists `media/diff-tab/vscode-diff.css`,
  `LICENSE.mit` and `NOTICE.md`. Paste those lines into the report.

## Report

_(not started)_
