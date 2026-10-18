---
summary: >-
  D40 · wave D · ready · CSS and notices · ≤150 lines plus the vendored CSS:
  copy the rules of VS Code's diff editor stylesheet that the GGL Diff tab
  uses into `media/diff-tab/vscode-diff.css`, re-rooted under `.ggl-diff`,
  with Microsoft's MIT notice, so the tab colors lines and characters
  exactly as the diff editor does.
---

# D40 — Vendor the diff editor's stylesheet

Status: done — awaiting integration
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

- **Agent / date:** Muse Code sub-agent D40, 2026-10-19 01:43 (claimed 2026-10-19 01:35)
- **Branch and commits:** `diff-1.9.0/d40` — `8d30406 G feat(diff-tab): vendor the diff editor stylesheet (D40)`, plus the signed docs commit carrying this report (its own hash cannot be listed inside itself; verify with `git log --format='%h %G? %s' d094e80..HEAD`)
- **Files changed:** `media/diff-tab/vscode-diff.css` (new, +173/−0; the vendored CSS, outside the size budget), `LICENSE.mit` (+27/−0), `NOTICE.md` (+12/−0), `tests/webview/diffTabCss.test.ts` (new, +75/−0), this slice file (status and report). Counts from `git diff --numstat HEAD~1..HEAD`; 114 insertions outside the vendored CSS, inside the ≤150 budget. Source copied: `microsoft/vscode` `src/vs/editor/browser/widget/diffEditor/style.css` at `1356222d342e6a7b2dd5603107bcdb60a6d0653b`, fetched with the `gh api` command in *Facts*; its header reads "Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License" and the repository `LICENSE.txt` at the same commit is the MIT License, "Copyright (c) 2015 - present Microsoft Corporation" — both lines and the permission text are preserved verbatim in the new Microsoft Corporation section of `LICENSE.mit` (checked byte-for-byte against the fetched files). Kept 28 rules: every *Facts* class, re-rooted to `.ggl-diff` with declarations verbatim (checked: all 28 declaration blocks match upstream exactly). Dropped: the two icon-font rules (Step 2), editor-only structure (scrollbars, overview, moved-code, inline view zones), and the `diff-hidden-lines-disclosure`/`-compact`/`-widget` variants the tab does not render; in mixed selector lists only the *Facts*-class alternatives were kept. Only literal colors are `transparent` and `#0000`, listed in the header per Step 3.
- **Tests added or changed:** new `tests/webview/diffTabCss.test.ts` (4 tests: header provenance; every *Facts* class ruled under `.ggl-diff`; every selector rooted at `.ggl-diff` with no editor or icon roots; colors only via `var(--vscode-…)` except the header-listed literals). Webview 591 → 595 tests; backend unchanged at 873.
- **Gates:** biome pass (strict, `--error-on-warnings`, `tests/webview/diffTabCss.test.ts`, the only touched file Biome covers); typecheck pass; test backend 873/873 (80 files), webview 595/595 (55 files) via `pnpm run test` — the first run reported 30 backend skips because this worktree had no built engine addon, so `pnpm run engine:build` + `engine:smoke` (1.0.25) were run and the backend project rerun at 873/873 (the binary is ignored and uncommitted); l10n n/a (no user-visible text changed); kb:check pass; Rust arm n/a (no `engine/**` change); Sonar: integrator
- **Acceptance:** Gates pass and the new test fails before the CSS exists — met: with no `media/diff-tab/vscode-diff.css` the suite failed `ENOENT … media/diff-tab/vscode-diff.css` (0 tests run), and passes 4/4 after. `pnpm exec vsce ls` lists the three files — met with the project's packaging flag, because plain `vsce ls` fails in this pnpm tree inside its `npm list` step; `pnpm exec vsce ls --no-dependencies` lists:
  ```
  LICENSE.mit
  NOTICE.md
  media/diff-tab/vscode-diff.css
  ```
- **Deviations from the slice:** none. No Microsoft section existed in `LICENSE.mit` yet, so this slice created it (D20 can extend it, as its file anticipates). High-contrast selectors were re-rooted mechanically to `.ggl-diff.hc-black`/`.hc-light` with declarations verbatim; they stay inert unless D42 sets those classes.
- **Open questions / follow-ups:** none. D42 decides how much of the collapsed-region sub-structure (`.top`, `.bottom`, `.center`, `.first`) its rows use; the rules are vendored ready for it.
