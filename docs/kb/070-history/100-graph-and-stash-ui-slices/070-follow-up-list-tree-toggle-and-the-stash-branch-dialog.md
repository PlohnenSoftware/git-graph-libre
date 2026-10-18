---
summary: >-
  The `uncommittedChanges.fileViewMode` tree/list setting, separate from
  `commitDetails.fileViewMode`; a new `GitGraphViewState` field broke thirteen
  fixtures (shared factory still needed); the `git stash branch` dialog.
---

# Follow-up — list/tree toggle, and the stash-branch dialog

**`uncommittedChanges.fileViewMode`** (`"tree"` | `"list"`, default `"tree"`)
switches the staging panel between the folder tree and the flat list it had
before. It is a **separate setting from `commitDetails.fileViewMode`**
deliberately: the two views are read in different situations, and one is a
staging surface where a folder row is draggable while the other is not. The
toggle is a checked item on the uncommitted-changes context menu, which is
where this project already puts view options, and it writes the global setting
through `updateExtensionSetting` rather than holding view state — so the
choice survives a reload and appears in the settings hub for free. Flat mode
skips grouping entirely rather than flattening a built tree, so a flat list has
no folder rows to drag.

**Adding a required field to `GitGraphViewState` cost thirteen test fixtures**,
which is the standing tax the `2026-09-05` PR-review note predicted. Two of
them are worth knowing about because `tsc` cannot see them:
`tests/webview/telemetryConsentScreen.test.ts` builds its config mock with
`as unknown as Config` and failed at *runtime* with four broken tests after
typecheck was already green, and `tests/backend/config.test.ts` has no plain
literal to patch. The durable fix is still a shared view-state factory.

**`git stash branch` has no opt-out, and the dialog now says so.** Verified
against git `2.55.0` in a scratch repository: `git stash branch <name>` moved
`HEAD` from `main` to the new branch and dropped the stash. The maintainer
reported the missing "Check out" checkbox as a bug against the other
create-branch dialogs; it is not an omission, because a cleared checkbox could
not be honored without abandoning `git stash branch` altogether. The dialog
gained a `note` input — the same affordance BUG-3 added for lightweight tags —
stating that git checks the branch out and drops the stash. A rendering test
pins both the absence of a checkbox and the presence of the note, so a future
"fix" cannot quietly add a control that does nothing.
