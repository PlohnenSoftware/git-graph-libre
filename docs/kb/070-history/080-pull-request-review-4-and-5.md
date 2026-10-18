---
summary: >-
  Record: review of the Copilot PRs #4 (merge on a remote branch) and #5
  (no-fast-forward dialog defaults, inert settings fixed). Passing gates is
  not a review; merging both needed a typecheck fix.
---

# Pull request review — #4 and #5 (`2026-09-05`)

Two open pull requests, both authored by the Copilot coding agent against
issues filed by `yyjdelete`, both branched off `main` at `ffae055` and neither
behind it. Reviewed by running the project gates against each branch's
checkout tree in the maintainer-requested order — **tests first, then strict
Biome, then the `ZAM` gate** — and fixing what the review found on the pull
request branches themselves.

**The gates are not a review.** Both branches passed strict Biome and the
`ZAM` gate on the first run, and PR #5 was still broken: the gate cannot see a
setting that nothing reads. Read the feature, not just the result.

**PR #4 — Merge on the remote branch context menu (`copilot/feature-allow-to-merge-remote-branch`).**
Correct as written, and it lands on existing machinery cleanly:
`normalizeContextMenuActionsVisibility()` iterates the *defaults* object, so
adding `remoteBranch.merge` there seeds persisted settings with no migration;
the manifest declares each visibility group as
`additionalProperties: {type: boolean}`, so no per-key manifest entry is
needed; `GGL.ContextMenuActionsVisibility` is `import * as GGL from "@/types"`,
so `src/types.ts` is the only type to touch; and `mergeBranch` passes its
target straight to `git merge`, which accepts a remote-tracking ref. What was
missing was coverage and a changelog entry, added in `40c962f` and `80e38ed`:

- **`isContextMenuActionVisible()` returns `!== false`, so an unknown action
  key reads as visible.** A menu item wired to a mistyped or absent key
  therefore still appears under the defaults, and a positive rendering
  assertion cannot tell the two apart. The new
  `tests/webview/remoteBranchContextMenu.test.ts` switches the key off and
  asserts the item disappears while its neighbours stay — the remote-branch
  group had no visibility coverage at all, unlike branch, commit and tag.
  Confirmed by mutation: pointing the item at `"mergeTypo"` fails two of its
  three cases.
- The context menu sends the **rendered ref name**, so `mergeBranch` receives
  `origin/<branch>`, a shape no test covered. `mergeBranch.test.ts` gained a
  real-git case that clones a repository and merges `origin/feature`.
- Deliberately **not** done: `buildRemoteBranchContextMenu()` hand-rolls its
  visibility ternaries where `visibleContextMenuItem()` exists, but so does
  `buildTagContextMenu()`; converting one of the two would trade a consistent
  local style for an inconsistent one. Convert both in a cleanup slice or
  neither. Also left alone: the remote menu still has no **Rebase**, which the
  local branch menu offers and `git rebase origin/main` supports — worth
  considering, but issue #2 asked only for merge.

**PR #5 — configurable no-fast-forward dialog defaults (`copilot/git-graph-libre-3-default-value-fast-forward`).**
Shipped half the eight-hop setting plumbing and the settings were **inert**:
`package.json`, the five `package.nls*.json` and the two `src/config.ts`
accessors were there, and nothing anywhere read the accessors. Both dialogs
still hardcoded `value: true` / `value: false`, so both settings appeared in
VS Code's settings UI *and* in the extension's own manifest-derived settings
hub, and changing either did nothing. The branch also **failed
`pnpm run typecheck`**, i.e. `pnpm run package` at its first step: the config
mock in `tests/webview/webviewHtml.test.ts` is typed against the whole `config`
shape and was missing the two accessors. Note `pnpm run test` passed anyway —
vitest does not typecheck, so the vitest suites are not a substitute for the
typecheck step when a shared type changes.

Completed in `638b28a` and `a56da12` along the route
`repository.fetchTagsByDefault` already takes: `GitGraphViewState`,
`webviewHtml.ts`, the webview `Config` interface, the constructor literal, and
a case per key in `applyBooleanExtensionSetting()` so a change made while the
graph is open applies to the next dialog instead of only after a reload. Plus
the README configuration table and a changelog entry. Three points worth
keeping:

- **`dialog.merge.noFastForward` drives two dialogs, not one.**
  `showMergeBranchDialog()` and `showMergeCommitDialog()` render the same
  checkbox from the same `dialogMergeNoFastForward` key; a setting that covered
  only the branch dialog would leave the commit dialog contradicting it.
- **Both defaults reproduce the values the dialogs hardcoded** (`true` for
  merge, `false` for pull), so this is a pure capability addition with no
  behavior change — unlike the `muteMergeCommits` default flip of `2026-08-25`.
- **`tests/webview/telemetryConsentScreen.test.ts` builds its config mock with
  `as unknown as Config`**, which hides a missing accessor from `tsc` and then
  fails at runtime with `config.<name> is not a function`. Adding a `config`
  accessor means updating both that mock and the properly-typed one in
  `webviewHtml.test.ts`; only the second is caught by typecheck.

New coverage in `tests/webview/mergeDialogDefaults.test.ts` drives all three
dialogs in both directions through the real webview bundle, asserts the
submitted `createNewCommit` payload, and exercises the settings-hub live-update
route. Confirmed by mutation: restoring the hardcoded values fails four of its
seven cases. The view-state pass-through assertion in `webviewHtml.test.ts`
mocks both accessors to the **inverse** of their manifest defaults, so it
cannot pass by coincidence.

**Merging both breaks typecheck, whichever goes second.** PR #5 adds two
required fields to `GitGraphViewState`, and PR #4 adds a new test file with its
own view-state literal that cannot carry them (an object literal typed as
`GitGraphViewState` rejects unknown properties, so the fields cannot be
pre-added on PR #4's branch either). Verified on a local trial merge of both
onto `main`: one trivial `CHANGELOG.md` conflict — both bullets are wanted —
and then `tests/webview/remoteBranchContextMenu.test.ts(12,7): error TS2739 …
missing … mergeNoFastForward, pullBranchNoFastForward`. The follow-up is two
lines in that one file (`mergeNoFastForward: true,
pullBranchNoFastForward: false,`). With it applied the merged tree is green on
everything, including the `ZAM` gate. This is the standing cost of a required
field on a widely-fixtured view state; the durable fix is a shared test
view-state factory instead of a dozen literals, which is its own slice.

Verification (`2026-09-05`), all four trees:

| Tree | typecheck | `test` | strict Biome | Sonar task | `ZAM` | `new_coverage` |
| --- | --- | --- | --- | --- | --- | --- |
| PR #4 as pushed | pass | 421 / 413 | clean | `9e025961` | `OK` | `91.3` |
| PR #4 + fixes | pass | 422 / 416 | clean | `ccafdc4c` | `OK` | `92.8` |
| PR #5 as pushed | **FAIL** | 421 / 413 | clean | `3fbc9d0b` | `OK` | `89.6` |
| PR #5 + fixes | pass | 427 / 420 | clean | `1a74acc4` | `OK` | `93.3` |
| both merged + follow-up | pass | 428 / 423 | clean | `812d3749` | `OK` | `93.7` |

`new_violations` `0`, `new_duplicated_lines_density` `0.0`, and all four
project-wide conditions `0` on every one of the five analyses;
`sonar.projectVersion` was left at `1.4.2`, so all five measured against the
same `Previous Version` `1.4.1` window and no baseline moved. `l10n:check`
stayed at `100%` for all five languages (`61` package keys after PR #5).
`pnpm run package` and `pnpm run test:ext` (`53` + `1`) passed on both fixed
trees.

Two things left for the maintainer:

- **The two-line follow-up after the second merge**, above.
- **`tests/extension/workspaceWatcher.test.ts` flaked once** in three
  `test:ext` runs on the PR #5 tree and was green on the other two. Its
  `setTimeout(r, 10)` waits are still there, one sibling at `500` — the same
  flake recorded under BUG-5 on `2026-08-25`, still unfixed and still
  unrelated to whatever slice happens to hit it.
