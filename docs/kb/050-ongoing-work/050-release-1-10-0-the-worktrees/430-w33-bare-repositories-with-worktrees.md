---
summary: >-
  W33 · wave E · needs W32, Y17 · TypeScript + webview · ~120 lines (option
  a): the bare-clone-plus-worktrees layout that agent tools use. Show the
  bare repository as its worktrees' group header, so its linked worktrees
  belong together. Opening the bare repository's own graph, with no working
  tree, no uncommitted row and no checkout, is option (b), decision Y17.
---

# W33 — Bare repositories with worktrees

Status: integrated `48f3ee3` (`2026-11-06`)
Needs: W32
Decisions: Y17 ((a) a group header only; (b) also a read-only graph of the
bare repository)
Kind: TypeScript and webview · Size budget: ~120 changed lines outside tests
for (a)
Source: Git worktree behavior, verified (the bare case); the probe's tests
already classify bare shapes (`tests/backend/utils/repositoryProbe.test.ts`)

## Facts

- `git worktree list --porcelain` lists a bare main repository first, as
  `worktree <path>` and `bare` with no HEAD.
- `git rev-parse --show-toplevel` fails in it, so discovery never opens it as
  a repository today.
- Every linked worktree's `--git-common-dir` is the bare repository.

## Steps for (a)

1. W32's grouping uses the bare common dir as the group's header, named after
   its folder. It is not selectable.
2. The worktree list (W30) shows the bare main record as "the repository
   (bare)", with no actions except Create Worktree….
3. Tests: grouping and list rows for a bare clone with two linked worktrees.

Option (b), if chosen, needs its own slice: every read and action would have
to work with no work tree, the uncommitted row and staging hidden, and
checkout and reset refused.

## Touch

`src/webview/settingsWidget.ts`, `src/webview/worktreeList.ts` (W30), `tests/**`

## Acceptance

A bare-clone layout reads as one repository with its worktrees.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-06 15:27. Branch `wt-1.10.0/W33`, base `f374166`.
- **Branch and commits:** `wt-1.10.0/W33`
  - `bd97c61 G docs(worktrees): claim W33 bare repositories with worktrees`
  - `6e95d6b G feat(worktrees): carry bare common dirs in the repo layout (W33)` (`src/types.ts`, flagged)
  - `ba37dba G feat(worktrees): mark bare repositories among the repo layout groups (W33)`
  - `fac7d34 G feat(worktrees): give a bare repository's worktrees a header row (W33)` (`src/webview/repoOptions.ts`, flagged)
  - `dc5438d G feat(worktrees): render a dropdown header as an unselectable label (W33)` (`src/webview/dropdown.ts`, `media/dropdown.css`, flagged)
  - `a73a2aa G feat(worktrees): translate the bare repository header label (W33)` (five bundles, `src/extension/webviewL10n.ts`, `src/webview/main.ts`, flagged)
  - `5db034b G fix(worktrees): use the transparent token for the dropdown header hover (W33)`
  - this report commit
- **Files changed:** 16 files, +220 / −11 (`git diff --stat f374166..HEAD`): `src/extension/repoLayout.ts` (+19/−1), `src/webview/repoOptions.ts` (+41/−5), `src/types.ts` (+6), `src/webview/dropdown.ts` (+11), `media/dropdown.css` (+9), `src/webview/main.ts` (+2/−1), `src/extension/webviewL10n.ts` (+1), `l10n/bundle.l10n*.json` (5 × +1), and tests: `tests/backend/extension/repoLayout.test.ts` (+32), `tests/webview/repoOptions.test.ts` (+61/−2), `tests/webview/dropdown.test.ts` (+32/−1).
- **Tests added or changed:**
  - backend `repoLayout.test.ts`: new "lists the bare common dir of a bare repository's linked worktrees", "names the bare group of a listed outside entry, and no group for a normal .git", and a `describe("isBareCommonDir")` block; the first `buildRepoLayout` test now also asserts `bareGroups` is empty. Real Git, the file's own bare fixture, `GIT_CONFIG_GLOBAL` to a temp file.
  - webview `repoOptions.test.ts`: the old bare test is renamed and kept for a group the host does not name as bare (flat, as before); new: header above siblings with `middle`/`last` tree branches and the header flagged; header with an outside worktree beneath it; no header when the group's main worktree is listed.
  - webview `dropdown.test.ts`: a header renders as `dropdownOptionHeader` with no `data-id`; a click on it changes nothing and leaves the menu open.
  - Counts: I did not measure the counts at base `f374166`, so there is no before number. The +7 backend and +4 webview tests are the new ones above.
- **Gates:**
  - Strict Biome with `--error-on-warnings`, one file at a time, on all 9 touched source and test files: exit 0 on each. The installed Biome CLI (2.6.3) prints an informational schema-version notice against `biome.strict.jsonc` (2.5.13) on every run; it does not fail the check.
  - `pnpm run typecheck`: clean (exit 0).
  - `pnpm run test`: backend 1366 passed, 60 skipped, of 1426 (109 files); webview 975 of 975 (76 files); exit 0, no "Unhandled Errors". The 60 backend skips are existing environment-gated suites (engine parity, VSIX, and similar), which this slice does not touch. W32 recorded backend 1370 of 1370 in its own environment; I did not reconcile that.
  - One failure on the first full run: the new dropdown hover rule used the `transparent` keyword, which the OKLCH check in `tests/webview/tableStyles.test.ts` rejects. Fixed in `5db034b` with `--ngg-transparent`; the full run after that is green.
  - `pnpm run l10n:check`: exit 0, 100% for nl, pl, zh-cn and zh-tw (bundles and package.nls).
  - `pnpm run kb:check`: exit 0 (this report and the status line are the only KB edits).
  - Sonar: integrator.
- **Acceptance:** met. A bare clone with two linked worktrees reads as one group: a non-selectable header `<folder> · bare repository` with its worktrees indented beneath (repoOptions test). Selecting the header changes nothing (dropdown test), so no graph of the bare repository opens (Y17 (a)). Bare is decided from the file system: the common dir is not named `.git` and `resolveGitDirs` answers the directory for itself.
- **Step 2 of the slice (W30 bare main row):** already in place from W30 (`src/webview/worktreeList.ts`: the `bare` badge, the "bare repository, no working tree" note, and no Switch for a bare entry). No change made.
- **Deviations from the slice:**
  - The Touch list names `settingsWidget.ts`, `worktreeList.ts` and `tests/**`. The grouping being changed lives in `src/webview/repoOptions.ts` (W32), and the header needs `src/types.ts`, `src/extension/repoLayout.ts`, `src/webview/dropdown.ts`, `media/dropdown.css`, `src/extension/webviewL10n.ts`, `src/webview/main.ts` and the five bundles. Each file outside the list sits in its own commit (flagged above). The dispatch allowed this.
  - Bare is decided from the file system, not `core.bare`. A separate-git-dir main worktree still reads as its repository, so no header appears there.
  - The new `RepoLayout.bareGroups` field is optional in the type, so older layouts still mean "no bare groups".
  - Intermediate commits are not all typecheck-clean: `fac7d34` adds `bareRepository` to `RepoOptionLabels` before `main.ts` passes it (fixed in `a73a2aa`). The head of the branch typechecks.
- **Open questions / follow-ups:**
  - The filter matches each row's own label. Typing a filter that does not match the header hides it while its matching worktrees stay visible, without their group label. A header-aware filter would be a small follow-up; I did not add one.
  - The Polish, Dutch and Chinese strings for "bare repository" (`puste repozytorium`, `kale repository`, `裸仓库`, `裸倉庫`) are mine and should get a native glance. They follow the words those bundles already use for bare.
  - No `CHANGELOG.md` entry: it is outside the Touch list.

