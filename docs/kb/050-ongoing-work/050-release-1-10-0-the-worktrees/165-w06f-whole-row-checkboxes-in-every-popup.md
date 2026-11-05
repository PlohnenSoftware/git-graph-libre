---
summary: >-
  W06F · wave A · ready · CSS + webview · ~120 lines: Y13 re-answered by the
  maintainer (`2026-11-05`). Clicking anywhere on a checkbox's row toggles it
  in every popup, not only modal dialogs, through one shared row pattern
  that every popup uses: the dialogs, the Settings popup's boolean editors
  (bare inputs today) and any other popup checkbox row. W06's dialog rule
  moves onto that shared pattern.
---

# W06F — Whole-row checkboxes in every popup

Status: claimed by Claude Haiku 5.5 on 2026-11-05 18:31
Needs: W06 (integrated `af7ff04`)
Decisions: Y13, re-answered `2026-11-05`: every popup, implemented once at
the shared popup level
Kind: CSS and webview · Size budget: ~120 changed lines outside tests
Source: issue #41; the maintainer, `2026-11-05`: "please make sure its
implemented generally in all popups (ideally in popup class level) not only
in popup mentioned as example"

## Goal

The whole row of any checkbox in any popup is its click target. It is
built once, as a shared row pattern (a class with its CSS, and native
`<label>` semantics), that every popup's checkbox row uses. It is not a
per-popup patch.

## Facts (checked `2026-11-05`, `the-worktrees` at `864b6c0`)

- **Dialogs.** Every dialog checkbox comes from `renderDialogCheckboxInput()`
  (`src/webview/main.ts`), as `<span class="dialogFormCheckbox"><label><input
  type="checkbox">text</label></span>`.
  - W06 (`media/dialogs.css:201`–`:212`) made the label full width only
    for rows spanning both columns: `td[colspan="2"]`, under
    `#dialog table.dialogForm`.
  - Locked checkboxes refuse in `bindLockedDialogInputs()`, and grouped
    remote rows use `.dialogFormCheckbox.grouped`.
- **The Settings popup's Extension tab.** A boolean setting is a bare
  `<input class="settingsExtensionInput" type="checkbox">`
  (`renderBooleanEditor()`, `src/webview/settingsWidget.ts:467`–`:470`),
  with no `<label>`. Only the box reacts, not the setting's name or the
  rest of its row.
  - Check the Repository tab's per-repository view toggles the same way.
- **Other checkbox rows.** The toolbar's Show Remote Branches checkbox
  (`#showRemoteBranchesCheckbox`, `.toolbarCheckbox` in `media/toolbar.css`)
  is not in a popup. The context menu's checkbox items
  (`#contextMenu li.contextMenuItemCheckbox`) and the multi-select
  dropdown's options are whole-row list items already. Check each, and
  list in the report every popup checkbox row you found and what you did
  with it.
- **Checkbox styles.** `media/checkbox.css` styles dialog checkboxes and
  `#showRemoteBranchesCheckbox` by selector, not by a shared class.

## Steps

1. Define one shared checkbox-row pattern, a class name of your choosing
   (for example `checkRow`), in `media/checkbox.css` or `media/base.css`.
   - The row is a `<label>`, or contains one, spanning the full row width,
     with `cursor: pointer`.
   - A locked row keeps its own cursor and hint, and still refuses.
   - A disabled input gets no pointer.
   - Use theme tokens or OKLCH fallbacks for any color. No hover tint,
     since Y13 asked for none.
2. Dialogs: have `renderDialogCheckboxInput()` emit the shared pattern, and
   replace W06's `td[colspan="2"]` special case with it. Keep every
   behavior W06 pinned, its regression test still passing or updated to
   the shared class: locked rows, grouped remote rows with no layout
   shift, and single-input dialogs.
3. The Settings popup: render each boolean setting's row as the shared
   pattern, its name and description inside the label, so a click
   anywhere on the row toggles it. The change event and the settings
   echo must still fire exactly once per toggle. Do the same for the
   Repository tab's toggles, if they are checkboxes.
4. Any other popup checkbox row found in step 0 uses the same pattern.
5. Tests:
   - a CSS regression test for the shared class;
   - DOM tests that a click on the row text toggles the box: in a
     dialog, and on a Settings boolean, where it fires one change;
   - a locked or disabled row does not toggle.

   Render the dialog and Settings popup headlessly, light and dark
   (Verifying webview visuals without a browser). Don't install
   packages; images go to `/tmp/claude-1000/w06f-renders/`.
6. `CHANGELOG.md`: widen W06's `[Unreleased]` entry from "In the dialogs"
   to every popup, crediting `@rbalet` (#41). Keep it one entry.

## Touch

`media/checkbox.css`, `media/dialogs.css`, `media/settings.css`,
`media/base.css` (only if the class lives there), `src/webview/main.ts`
(`renderDialogCheckboxInput` and the Repository tab's toggles only),
`src/webview/settingsWidget.ts` (`renderBooleanEditor` and its row), tests,
`CHANGELOG.md`

## Acceptance

- In every popup that has checkboxes, a click anywhere on a checkbox's row
  toggles it once.
- Locked and disabled rows refuse.
- There is one shared class, and no per-popup copies of the rule.
- No layout shift in grouped rows.
- The Settings echo fires once per toggle.

## Report

Not started.
