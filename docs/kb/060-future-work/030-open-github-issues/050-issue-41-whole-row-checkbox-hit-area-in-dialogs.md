---
summary: >-
  Open, `rbalet` `2026-10-28`, no reply yet: clicking anywhere on a dialog
  checkbox's row should toggle it. Verified: the checkbox `<label>` is
  `display: inline-flex` (`media/dialogs.css:198`), so only the box and its
  text react, even where the wrapping span is already full width.
  Recommended: agree; one CSS rule, a CSS regression test and a headless
  render.
---

# Issue #41: whole-row checkbox hit area in dialogs

**Open.** [Issue #41](https://github.com/PlohnenSoftware/git-graph-libre/issues/41),
"feat(modal/ux): wide selection", opened `2026-10-28` by `rbalet`, label
`enhancement`. No roadmap phase; it is webview polish under the Webview UI
Styling Guide. **Decision: pending.** There is no maintainer reply yet.

## The request

"To be faster, we should be able to click on the entire row to select a
checkbox." It would reduce "the need to be precise on selection, and is just
a good UX". The proposed solution: "A checkbox label can take up to 100%
width of the container." The screenshot shows the Delete Branch dialog ("Are
you sure you want to delete the branch *codex/fallow-verified-cleanup*?",
☑ Force Delete), with a line drawn across the full width of the Force Delete
row.

## The thread

No comments yet.

## Checked facts (`c47207e`, `2026-11-04`)

- `renderDialogCheckboxInput()` (`src/webview/main.ts:7317`) renders
  `<span class="dialogFormCheckbox"><label><input type="checkbox"/>text</label></span>`
  in a row that spans both form columns (`renderDialogInputRow()`, `:7292`).
- `media/dialogs.css:198`–`:204` sets that label to
  `display: inline-flex`, so its box is the box plus the text. In
  single-input dialogs such as Delete Branch, the wrapping span is already
  `display: inline-block; width: 100%` (`:208`–`:211`). The dead area is the
  rest of that row, to the right of the text.
- Locked checkboxes refuse a toggle in the input's own click handler
  (`bindLockedDialogInputs()`, `main.ts:7240`). A click on the label is
  delivered to the input, so a wider label keeps them locked.

## Proposals and assessment

| Proposal | By | Assessment |
| --- | --- | --- |
| Let the label take the full width of its container | `rbalet` | Agreed, and cheap. Make the label block-level and full width (for example `display: flex`, keeping `align-items` and `gap`), with `cursor: pointer` and optionally a subtle hover tint from VS Code tokens or OKLCH fallbacks. A larger target is also an accessibility gain (WCAG 2.2's target-size criterion). |

Caveats: rows with a destructive option (Force Delete, a force push mode) get
a wider area for an accidental click. That is acceptable, because the
dialog's own action button still has to be pressed. The lock hint's tooltip
position should be rechecked once the label is full width.

Scope: the issue says "modal", so modal dialogs only. The toolbar's Show
Remote Branches checkbox and the Settings popup's checkboxes could follow for
consistency if the maintainer wants that.

Verification, per the Webview UI Styling Guide: a CSS regression test for the
rule, and a headless render (Verifying webview visuals without a browser).

## Open questions for the maintainer

- Modal dialogs only, or every checkbox in the webview?
- A hover tint on the row, or only the wider hit area?
