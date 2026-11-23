---
summary: >-
  W06 · wave A · ready · CSS · ~20 lines: issue #41. A dialog checkbox reacts
  only on its box and text, because its `<label>` is `display: inline-flex`
  (`media/dialogs.css:198`). Make the label span its row, keep locked
  checkboxes locked, and prove it with a CSS regression test and a headless
  render in both themes. Scope (modal dialogs only) is decision Y13.
---

# W06 — Whole-row checkboxes in dialogs

Status: integrated `af7ff04` (`2026-11-05`)
Needs: —
Decisions: Y13 (scope)
Kind: CSS · Size budget: ~20 changed lines outside tests
Source: issue #41; Issue #41: whole-row checkbox hit area in dialogs, under
Open GitHub issues

## Goal

Clicking anywhere on a checkbox's row in a dialog toggles it, as the reporter
asked ("A checkbox label can take up to 100% width of the container").

## Facts (checked `2026-11-04`, `c47207e`)

- `renderDialogCheckboxInput()` (`src/webview/main.ts:7317`) renders
  `<span class="dialogFormCheckbox"><label><input …/>text</label></span>`
  in a row that spans both form columns.
- `media/dialogs.css:198`–`:204` makes that label `display: inline-flex`. In
  single-input dialogs the span is already `inline-block` and `width: 100%`
  (`:208`–`:211`), so the dead area is the rest of the row, right of the
  text.
- Locked checkboxes refuse the toggle in the input's own click handler
  (`bindLockedDialogInputs()`, `main.ts:7240`). A label click is delivered to
  the input, so a wider label stays locked.

## Steps

1. Make the label block-level and full width (for example `display: flex`,
   keeping `align-items`, `gap`, `white-space` and `line-height`), with
   `cursor: pointer`. Keep locked rows' own cursor and hint, and recheck the
   lock hint's tooltip position.
2. Optional, if the maintainer wants it under Y13: a subtle hover tint from VS
   Code tokens, with OKLCH fallbacks (Webview UI Styling Guide).
3. Add a CSS regression test beside the existing ones. Render light and dark
   headlessly (Verifying webview visuals without a browser) and attach the
   images to the report.
4. `CHANGELOG.md`, `[Unreleased]`: credit `@rbalet`.

## Touch

`media/dialogs.css`, the webview CSS test file, `CHANGELOG.md`

## Acceptance

- A click right of the text toggles the box in single- and multi-input
  dialogs.
- A locked checkbox still refuses, and its hint still shows.
- No layout shift in grouped rows (the remote checkboxes' ruled group).

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:00
- **Branch and commits:** `wt-1.10.0/W06`
  - `6cd016c` G docs(dialogs): claim W06 whole-row checkboxes (W06)
  - `803b42c` G fix(dialogs): make the whole checkbox row the hit area (W06)
  - `c6deb83` G test(dialogs): pin the whole-row checkbox hit area (W06)
  - `6f18db9` G docs(changelog): note the whole-row dialog checkbox fix (W06)
  - this report commit: see `git log -1` on the branch
- **Files changed:** `media/dialogs.css` (+13 −2 lines: the new wrapper and label declarations, their comments, and the `.locked` rule's `display: inline-block` replaced by `cursor: help`); `tests/webview/dialogStyles.test.ts` (+30); `CHANGELOG.md` (+9); this slice file (claim, report, status).
- **Tests added or changed:** new test "makes a whole checkbox row the hit area, keeping locked rows locked" in `tests/webview/dialogStyles.test.ts`. Before: 24 tests in that file; after: 25 (all pass). No existing test changed.
- **Gates:** biome strict (`--config-path biome.strict.jsonc --error-on-warnings`) on `tests/webview/dialogStyles.test.ts`: pass (the test file was reformatted with `biome format` for the new assertions; no ignores added); typecheck: pass (`tsc` for src, src/webview, tests); test backend 1144/1204 passed (60 skipped by existing `skipIf` conditions for absent local tools and builds: ssh-keygen, the wasm and differential builds, and the VSIX read-back; none touched by this slice), webview 792/792 passed; l10n n/a (no user-visible text); kb:check pass (slice file is under `docs/kb`); Rust arm n/a (no `engine/**` change); Sonar: integrator.
- **Headless render (step 3):** done with PyQt6 QtWebEngine under `xvfb-run` on the real `media/*.css`, dark and light (Dark Modern and Light Modern token values injected). Images, outside the repo, not committed:
  - `/tmp/claude-1000/w06-renders/before-single-dark.png`, `/tmp/claude-1000/w06-renders/after-single-dark.png`
  - `/tmp/claude-1000/w06-renders/before-multi-dark.png`, `/tmp/claude-1000/w06-renders/after-multi-dark.png`
  - `/tmp/claude-1000/w06-renders/before-multi-light.png`, `/tmp/claude-1000/w06-renders/after-multi-light.png`
  - `/tmp/claude-1000/w06-renders/after-single-light.png`
  - `/tmp/claude-1000/w06-renders/after-multi-dark-hint.png` (lock hint forced visible; its position is unchanged from before)
  - Measurements (`*.json` beside each image): before and after row heights match (single 24px; multi 20/28/28/28/36/28px). A point right of the text now hits the label (before: the span or the cell). The locked row's label still carries `cursor: help`, and a click on it still reaches the input's refusing handler. The harness is in the scratchpad, not the repo.
- **Acceptance:**
  - A click right of the text toggles the box, single- and multi-input dialogs: met for hit-testing (the far-right point hits the label, which toggles its input), verified in the render, not by a real mouse click.
  - A locked checkbox still refuses, and its hint still shows: met by code (the input's click handler is unchanged, and the hint markup and rules are unchanged); the hint visibility was rendered forced-visible.
  - No layout shift in grouped rows: met; the first attempt (a block-level label) shrank each remote row by 4px, and the final rule keeps the inline-level box, so heights match the baseline.
- **Deviations from the slice:**
  - Step 2 (hover tint) skipped, per the integrator's scope decision (Y13 recommended default: modal dialogs, no tint).
  - The slice's proposed "display: flex" for the label was not used: `display: flex` changed the grouped row heights. The wrapper and label stay inline-level with `width: 100%`.
  - The locked rule's `display: inline-block` was replaced with `cursor: help`: the new wrapper rule already sets `inline-block` for every checkbox row, and the locked row needs the help cursor across the whole row.
- **Open questions / follow-ups:**
  - Decision Y13 still reads `open` in `020-maintainer-decisions.md`; the integrator's instruction was followed. The integrator should record the answer.
  - Settings popup checkboxes and the toolbar's Show Remote Branches checkbox are unchanged (out of scope under Y13 option (a)).
  - The lock hint's tail sits at 14px from the row's left edge, which is not under the `?` glyph (it was already so before this change). Not changed here.
  - The issue #41 subsection in the KB was not updated (outside the Touch list); the integrator may want to move it to History.
