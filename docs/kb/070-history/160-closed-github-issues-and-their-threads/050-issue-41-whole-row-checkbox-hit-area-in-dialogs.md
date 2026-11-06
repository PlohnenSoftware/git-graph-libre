---
summary: >-
  Closed `2026-11-06` by `31417ec`: W06 (`af7ff04`) and W06F (`0c1437e`)
  made it so in every popup. `rbalet`, `2026-10-28`: clicking
  anywhere on a dialog checkbox's row should toggle it. Verified: the checkbox
  `<label>` is
  `display: inline-flex` (`media/dialogs.css:198`), so only the box and its
  text react, even where the wrapping span is already full width.
  Recommended: agree; one CSS rule, a CSS regression test and a headless
  render.
---

# Issue #41: whole-row checkbox hit area in dialogs

**Closed on `2026-11-06`.** [Issue #41](https://github.com/PlohnenSoftware/git-graph-libre/issues/41),
"feat(modal/ux): wide selection", opened `2026-10-28` by `rbalet`, label
`enhancement`. No roadmap phase; it is webview polish under the Webview UI
Styling Guide. **Decision (`2026-11-04`): to tackle.** When it was decided,
the details below were not chosen and there was no maintainer reply on
GitHub. It was planned as W06 in Release 1.10.0 — "The Worktrees", with the
scope as decision Y13. Closed by `31417ec`, the integrator's gated record of
W06 and W06F, when the maintainer pushed `main` on `2026-11-06`.

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

Answered as decision Y13 of release 1.10.0, then re-answered by the
maintainer on `2026-11-05`:

- Modal dialogs only, or every checkbox in the webview? **Every popup.**
  W06 shipped the dialog rows; W06F moved them and the Settings popup's
  boolean rows onto one shared `.checkRow` pattern (see the Webview UI
  Styling Guide). Context-menu items and dropdown options already toggled
  from their whole row. The toolbar's "Show Remote Branches" is not a
  popup and stays as it was.
- A hover tint on the row, or only the wider hit area? **Only the wider
  hit area**; the row takes `cursor: pointer` and no hover rule.

Implemented in release 1.10.0 (W06 `af7ff04`, W06F `0c1437e`). The gated
record `31417ec` carries `Closes PlohnenSoftware/git-graph-libre#41`, so
the issue closes when `main` is fast-forwarded at the release.
