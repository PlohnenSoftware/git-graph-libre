---
summary: >-
  W06 · wave A · ready · CSS · ~20 lines: issue #41. A dialog checkbox reacts
  only on its box and text, because its `<label>` is `display: inline-flex`
  (`media/dialogs.css:198`). Make the label span its row, keep locked
  checkboxes locked, and prove it with a CSS regression test and a headless
  render in both themes. Scope (modal dialogs only) is decision Y13.
---

# W06 — Whole-row checkboxes in dialogs

Status: ready (scope: modal dialogs, unless decision Y13 says otherwise)
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

Not started.
