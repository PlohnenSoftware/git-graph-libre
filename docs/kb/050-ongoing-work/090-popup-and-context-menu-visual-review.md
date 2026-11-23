---
summary: >-
  Maintainer request (`2026-11-12`): look at every popup and context menu,
  the worktree ones first, and at checking out a remote branch whose local
  branch exists, and fix what looks bad. The context menus are fixed
  (`50d9cb5f`) and Move Worktree has its folder selector (`ccc1aaee`). Open,
  to fix: V1 doubled ellipsis in the worktree running-action texts, V2 the
  Worktrees popup's rows, V3 the Create Worktree dialog, V4 the "worktree
  created" select, V5 Delete Branch for a held branch, V6 dialogs without
  inputs and their lists, V7 the remote checkout name prompt, V8 error text
  under its icon, V9 a bare "Yes" on Remove Worktree, V10 checkbox labels of
  two lines, V11 Create Worktree on a held branch. One question for the
  maintainer (VQ1, icon buttons in the Worktrees popup).
---

# Popup and context-menu visual review (`2026-11-12`)

Status: done. Context menus and V1–V11 are done (V1–V10 in P1, V11 in P1b under the maintainer's answer (b) of `2026-11-23`).

Maintainer request, `2026-11-12`: "please look on popups and context
menus(especially connected with worktrees) and make them look good if u find
smething looking bad also look on chwckout existing branch rermote". After
the review the maintainer asked for the remaining defects to be written
here as what needs fixing.

## How it was looked at

Every surface was rendered headlessly and read as an image, as Verifying
webview visuals without a browser (Reference) requires; that section now
holds the recipe this review used. In short: the real webview bundle, the
real toolbar and strings and the real `media/*.css`, with the theme
variables read from the maintainer's own editor (VS Code Insiders 1.146,
Dark Modern, English) and from Light Modern, and a fixture repository with
a worktree in every state (main and current, plain, locked with a reason,
detached, missing folder). About 90 screenshots: 14 context menus, the
worktree dialogs, the Worktrees popup at two widths, the remote checkout
dialogs, and 35 general dialogs and popups. The harness was scratch and is
not in the repository.

## Done

- **Context menus** (`50d9cb5f`): the header lines up with the items it
  heads, menus with a check slot keep one text column, the column menu uses
  checked items, a hidden action leaves no divider, Prune Stale Worktrees is
  a group of its own, and a remote branch whose local branch is held groups
  Open Worktree as the local branch's menu does. The rules are in the
  Webview UI Styling Guide (Reference).
- **Move Worktree** (`ccc1aaee`): the new folder is picked with the shared
  folder field, recorded under W23 (release 1.10.0).

## Looked at and found in order

- The "Local branch already exists" choice dialog itself (W24), in dark and
  light, with the pointer over a row.
- The general dialogs: add tag, create branch, checkout, cherry-pick,
  revert, drop, merge, rebase, reset, edit message, compare, push, pull,
  fetch, delete and push tag, tag details, the stash dialogs.
- The Settings popup's Repository tab, the repository and branch dropdowns,
  the status popup.

## To fix

Each entry says what shows, where it comes from, and the fix proposed. Line
numbers are from `ccc1aaee`. A suggested order is at the end.

### V1 — Doubled ellipsis while a worktree action runs — done (P1)

- **Shows:** "Creating worktree ... ..." in the running-action dialog, and
  six dots in the status strip. The same for checking, removing and pruning.
- **Cause:** `status.checkingWorktree`, `status.removingWorktree`,
  `status.pruningWorktrees` and `status.creatingWorktree` end in ` ...` in
  all five l10n bundles. Every other `status.*` string has no dots, because
  `showActionRunningDialog()` (`src/webview/main.ts:9136`) adds them.
- **Fix:** drop the trailing ` ...` in all five bundles. In English also use
  the title case of the other status strings ("Creating Worktree", as
  "Creating Branch"): One name and one shape for a shared concept
  (Reference). A test that no `status.*` string of any bundle ends in dots
  or an ellipsis keeps it from coming back.

### V2 — The Worktrees popup's rows — done (P1)

- **Shows:** a linked worktree's row carries up to seven buttons of equal
  weight (Open in New Window, Open Here, Switch Graph, Copy Path, Lock,
  Move, Remove). At the popup's 720px they wrap onto two lines under the
  text, in every row, so the list reads as a wall of buttons. The main
  worktree's row has one button, which fits beside the text and is centered
  against it, so the rows have two shapes. The path starts under the folder
  icon while the name and the branch start after it. A detached HEAD line
  carries the branch icon.
- **Where:** `renderRow()` and `worktreeRowActions()` in
  `src/webview/worktreeList.ts`; `.worktreeRow`, `.worktreeInfo`,
  `.worktreeActions`, `.worktreeAction` and `.worktreePath` in
  `media/settings.css`.
- **Fix proposed:** one row shape for every worktree. The path indented to
  the text column. Two tiers of actions: the ones that go to the worktree
  (Open in New Window, Open Here, Switch Graph; Repair and Remove Stale
  Entry for a missing folder) stay text buttons on one line under the
  text; the upkeep ones (Copy Path, Lock or Unlock, Move, Remove) become
  compact icon buttons at the row's top right, each with its label as
  `title` and `aria-label`, like the toolbar's buttons. The `git-commit`
  octicon for a detached HEAD.
- **Keep:** every action reachable from the keyboard (W30's acceptance), so
  real `<button>` elements and no pointer-only overflow menu; the
  `data-worktree-action` attributes the popup's click handler and tests
  use; the changes badges (W51).
- **VQ1, for the maintainer:** are icon-only buttons acceptable for the
  upkeep actions, Remove included? If not, the alternative is the same two
  tiers with the upkeep actions as quiet text buttons, which wraps again in
  the longer languages.

### V3 — The Create Worktree dialog — done (P1)

- **The folder is cut off.** The default path,
  `<repo>.worktrees/<branch>`, is longer than the field at the dialog's
  440px cap, so the field shows its start and hides the folder being
  created. The Move Worktree dialog has the same field since `ccc1aaee`.
  Fix: a wider cap for a dialog that holds a folder field
  (`.dialogFormFolder`), the field scrolled to its end when it is filled,
  and the full value as its `title`.
- **The select is narrower than the fields.** `#dialog table.dialogForm.single
  select` is full width, but a select in a form of several rows keeps its
  own width, so "Check out" ends well before the fields above and below
  it. Add Tag's "Type" and the push dialogs' "Push mode" show the same
  ragged edge. Fix: full width in every dialog form (`media/dialogs.css`).
- **"Lock reason" shows while the lock is unticked.** `dependsOn` only
  follows a `select` (`isDialogInputVisible()`). Fix: let a row depend on a
  checkbox, and show the reason only while "Lock the worktree" is ticked,
  as "New branch" already follows the select.

### V4 — "The worktree was created. What next?" is a select — done (P1)

- **Shows:** a `<select>` of four actions and a "Done" button
  (`finishCreateWorktree()`, `src/webview/main.ts:4709`).
- **Why it is a defect:** the Webview UI Styling Guide (Reference) says a
  short list of mutually exclusive actions uses one-click buttons, never a
  select and a generic submit. The rule was written after this dialog.
- **Fix:** `showChoiceDialog()`, with the choice made last time (decision
  Y8, kept in `worktreeFinish` by W22F) as the primary button. To settle
  while doing it: whether "do nothing" stays a choice beside the dialog's
  Cancel.

### V5 — Delete Branch when another worktree holds the branch — done (P1)

- **Shows:** the explanation ("Branch … is checked out in worktree …. To
  delete it, remove that worktree too.") and the question, both in the
  title at title size, separated by `<br><br>`. And the Delete Branch
  button does nothing while "Also remove the worktree" is unticked: the
  dialog closes and nothing is sent.
- **Where:** `showDeleteBranchDialog()` (`:5338`), `worktreeHoldsBranchMessage()`
  (`:5413`), `submitDeleteBranch()` (`:5387`).
- **Fix:** the question as the title and the explanation as a `note` row,
  the shape Rename Branch already uses for its worktree remark. Keep the
  action blocked, drawn like a required field left empty, until the box is
  ticked (a `required` checkbox).
- **Keep:** the wording rules of `2026-11-08` (a sentence names the
  worktree by its folder; the full path stays in the option that removes
  it). A value-less row shifts the input indexes, so read the values by
  type, never by position (Webview UI Styling Guide).

### V6 — Dialogs without inputs, and the lists in them — done (P1)

- **Extra gap.** `showFormDialog(message, [], …)` still renders an empty
  `table.dialogForm` after the title, so `.dialogTitle:not(:last-child)`
  adds its 14px and the buttons sit 30px below the text. A confirmation
  has 16px. Seen in Open Worktree, the prune preview, unlock-before-move
  and the forced removal. Fix: `renderDialogForm()` (`:8916`) writes no
  table when there are no inputs.
- **Bare lists.** The prune preview (`showPruneWorktreesDialog()`, `:5689`)
  and the forced removal's file list (`loadWorktreeChanges()`, `:5470`) put
  a `<ul>` and a `<p>` inside the title: default bullets and margins at
  title size. A long list also scrolls the whole dialog, buttons included,
  against "A header never scrolls away with its content". Fix: one list
  block for dialogs, at body size, with its own height cap and scroll, and
  the "more files" line as a quiet note under it.

### V7 — The remote checkout name prompt — done (P1)

- **The title misleads.** `dialog.createBranch.title` is "Enter the name of
  the branch {0}", so the prompt reads "Enter the name of the branch
  origin/feat/admin-gui", as if it wanted that name. It is also the title
  of Create Branch on a commit. The zh-cn and zh-tw bundles already say
  "new branch name for {0}". Fix: English, nl and pl in that sense, for
  example "Enter a name for the new branch from {0}" ("from" is what Create
  Worktree uses).
- **No reason for a refused name.** A name that is taken, or has invalid
  characters, turns the field red and dims the button; the reason is only
  the button's `title` (`bindTakenBranchNameValidation()`, `:6814`;
  `bindFormDialogInputs()`, `:9068`). Fix: the same message in a line under
  the field (`error.branchNameTaken` and `error.invalidCharacters` exist).
  It applies to every dialog with a ref name field.
- **A path in a chip.** For a branch another worktree holds,
  `existingBranchMessage()` (`:464`) puts the worktree's full path in a
  `<code>` chip, which wraps over two lines. Fix: the folder name with the
  path in its `title`, as the `2026-11-08` rule says.

### V8 — Error text wraps under its icon — done (P1)

`showErrorDialog()` (`:9124`) puts the icon inline in the title, so a
message of two lines continues under the icon (seen with "Branch main is
checked out in worktree …. Switch that worktree to another branch first.").
Fix: the icon in its own column. The message has to be wrapped in one
element first: a title that is a flex container would otherwise turn every
`<b>` or `<span>` of the message into a column of its own.

### V9 — Remove Worktree confirms with "Yes" — done (P1)

`confirmRemoveWorktree()` (`:5530`) uses `showConfirmationDialog()`, whose
button is "Yes". Every other worktree dialog names its action (Lock
Worktree, Move Worktree, Prune, Delete Worktree and Files). Fix: the
existing "Remove" label (`worktreeRemove`), through a form dialog without
inputs once V6 has removed that dialog's extra gap.

### V10 — A checkbox label of two lines — done (P1)

With a long path, "Also remove the worktree at …" wraps, and the box is
centered against the two lines (`.dialogFormCheckbox > .checkRow` has
`align-items: center`). Fix: `flex-start`; the box and a line are both 16px
tall, so a label of one line does not move.

### V11 — Create Worktree on a branch another worktree holds — done (P1b)

In that branch's menu, "Create Worktree…" opens the Open Worktree dialog
(`showCreateWorktreeDialog()`, `:4623`), which the menu's own "Open
Worktree…" already offers two rows above. Either leave the item out of
that menu, or let it open Create Worktree with the two modes that still
work there (a new branch from it, a detached HEAD). This is behavior
rather than appearance, so it needs the maintainer's word.

## Seen and left

- A full path in a dialog title is bold italic and breaks mid-path. It
  stays: the `2026-11-08` rule keeps the full path where the worktree is
  the subject.
- The locked checkbox's hint bubble covers the field above it while the
  pointer is on the row (Create Branch from Stash).
- The Worktrees popup's "main" badge sits beside a branch that is often
  also named `main`.

## Suggested order

V1, V6, V8, V9 and V10 are small and independent. Then V3 and V7, then V4
and V5, and V2 last, after VQ1 is answered. V9 needs V6. Each fix ships
with its test (the CSS regression tests in
`tests/webview/dialogStyles.test.ts` and `tests/webview/tableStyles.test.ts`,
and the dialog's own test file), is rendered in dark and light before it is
called done, and changes all five l10n bundles when it changes a string.
