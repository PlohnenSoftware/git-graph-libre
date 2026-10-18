---
summary: >-
  BUG-2, fixed `2026-08-25`: `fetchTags` (`--tags`, `--prune-tags` implies
  `--prune`), a toolbar `pushAllTags` button, force/no-verify in the tag push
  dialog; a branch-versus-tag capability table.
---

# BUG-2 — The tag remote surface is a stub beside the branch remote surface

**Status: fixed (`2026-08-25`). Priority: high. Area: backend actions + webview. Depends on BUG-1.**

This is the maintainer's "tag pushing/pulling system is quite crude" in concrete
terms. Compare what exists today:

| Capability | Branches | Tags |
| --- | --- | --- |
| Choose the remote | yes, multi-select checkboxes | no, hardcoded `origin` |
| Push through `runGitRaw` (recorded) | yes | no |
| Force / `--force-with-lease` | yes (`pushModeArg`) | no |
| Bypass hooks (`--no-verify`) | yes | no |
| Delete on selected remotes | yes | yes (Phase 15) |
| Fetch/pull the ref from a remote | yes (`fetchIntoLocalBranch`, `pullBranch`) | **nothing** |

There is no tag-fetch surface at all. `fetchRemotes()`
(`src/backend/actions/remote.ts:213`) builds `fetch --all` / `fetch <remote>`
with optional `--prune`/`--prune-tags`, so tags arrive only as a side effect of
git's default tag-following, and there is no way to ask for
`git fetch <remote> --tags` explicitly, no way to refresh a single tag, and no
way to see which remotes carry a given tag. The Phase 15 note in
`src/backend/actions/tagRemote.ts:12-19` already records why that last one is
hard (`refs/tags` has no per-remote tracking refs) — that constraint is real and
the fix must work with it, not against it.

Fix (one slice, after BUG-1 lands):

- Add a `fetchTags` action: `git fetch <remote> --tags`, optionally
  `--prune-tags` (which already has a git-version guard in
  `assertPruneTagsSupported`, `src/backend/actions/remote.ts:46`), exposed from
  the tag context menu and from the existing fetch dialog.
- Add "Push all tags" (`git push <remote> --tags`) as a repository-level action
  next to fetch, not in the per-tag menu.
- Give the tag push dialog the force/no-verify checkboxes the branch dialog has,
  reusing `GitPushBranchMode` rather than inventing a second mode enum.
- Localize every new label across `en`/`pl`/`zh-cn`/`zh-tw` and keep
  `pnpm run l10n:check` at 100%.

Implementation record (`2026-08-25`):

- `fetchTags` (src/backend/actions/remote.ts): per selected remote runs a
  recorded `git fetch <remote> [--prune --prune-tags] --tags` (label
  `remote.fetchTags`) on `runGitRaw`, with `assertPruneTagsSupported` guarding
  the prune flags. `--prune` is deliberately implied with `--prune-tags` —
  empirically, `--prune-tags` without `--prune` silently does not prune.
  Surfaces: a "Fetch Tags…" tag-context-menu item (visibility key
  `tag.fetchTags`, defaulted true; `normalizeContextMenuActionsVisibility`
  seeds persisted settings so no migration is needed) opening a dialog with
  all remotes preselected (fetch is read-only and `refs/tags` has no
  per-remote tracking refs — the Phase 15 constraint) plus a "Prune deleted
  tags" checkbox; and a "Fetch all tags" checkbox in the toolbar fetch dialog
  that sends `fetchTags` for all remotes after `fetchRemotes`.
- `pushAllTags` (src/backend/actions/tag.ts): per selected remote runs a
  recorded `git push <mode-arg] [--no-verify] <remote> --tags` (label
  `tag.pushAllTags`), sharing `pushModeArg` and `GitPushBranchMode`. It is a
  repository-level toolbar button (upload octicon, beside fetch, hidden
  without remotes), not a per-tag menu item.
- The push-tag dialog now always shows the options form (remote checkboxes +
  force-mode select + bypass-hooks checkbox, branch dialog's markup and
  branch-neutral keys reused). Judgment call recorded: BUG-1's interim
  single-remote plain confirmation was removed in this slice — the
  force/no-verify options must be choosable with one remote too, and the
  branch dialog always shows the form. Shared helpers
  (`remoteCheckboxInputs`/`pushOptionInputs`/`parsePushDialogValues`) keep the
  three push dialogs duplication-free.
- Verified: independent verifier demonstrated the tag-following gap (a tag on
  an unreachable commit does not arrive with plain `git fetch` but does with
  `--tags`), both prune directions (with and without `--prune`), two-remote
  `--tags` fan-out with `--no-verify --force-with-lease` args, and
  branch/tag-name collision safety under `git push --tags`. Command-log
  record lines asserted against real bare remotes. l10n: 12 new keys × 4
  languages, `l10n:check` 100% (525 bundle keys).
- Full gate green before commit: strict Biome on 22 touched files, typecheck,
  lint, `test` (backend 47/343, webview 34/312), `l10n:check` 100%,
  `package`, fresh coverage (81 files / 655 tests, 92.1% lines). The first
  scan (task `ccbaaac5-6ad7-4602-afc0-7c5684cec76d`) was `OK` at
  `new_violations` `2` — both findings turned out to date from the BUG-3
  slice's code (`typescript:S6582` optional-chain in
  `isDialogInputVisible`, `typescript:S5906` generic assertion in the
  empty-message test), so per the touched-files rule they were fixed in this
  slice's files and the full gate re-ran: `sonar:scan` task
  `bb2f67ae-66db-4098-a8a5-93c84182cb01`, analysis
  `d2325221-3a85-4799-888c-64a992a563ef`: `ZAM` gate **`OK`** —
  `new_coverage` `92.1%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `0`, reliability and security `0`. The graphify map was
  refreshed from the final tree (`graphify update .` + `graphify tree`).
