---
summary: >-
  Done (`2026-09-22`): `loadRepoInfo` served by the engine
  (`src/backend/engine/repoInfo.ts`), with CLI fills and ordering through the
  CLI sorters; parity table, probe findings; `loadBranches` untouched.
---

# Slice 16.4 — `loadRepoInfo`

Branches, tags, remotes, stashes and HEAD — one engine call (`load_repo_info`)
against several CLI invocations, and the first slice where mapping matters.

1. Map `GitRepoInfo` onto this project's shape. Watch the ordering contracts:
   the repository dropdown and the branch dropdown both depend on the order
   they receive names in, and `read_refs` orders by its own scan.
2. `showRemoteBranches`, `showRemoteHeads`, `hideRemotes` and the stash toggle
   all have engine equivalents — thread them rather than post-filtering.
3. Parity cases: no remotes, several remotes, detached HEAD, an unborn branch,
   a repository with no commits, annotated and lightweight tags, hidden
   remotes, stashes on and off.

Acceptance: the graph opens identically on both backends for every case above;
parity test green; no change to `loadBranches`.

Implementation record (`2026-09-22`, four subslice commits, all signed):

- 16.4b `src/backend/engine/repoInfo.ts`: options builder (only
  `showStashes` threaded; the ref options take engine defaults),
  strict payload guard, stash mapping through the CLI's own
  `parseStashIndex`, composition from engine head/tags/stashes plus the
  CLI fills (headCommit, authors, remotes with push URLs, config —
  exported for the seam). Tags go through the CLI's own sorter, so every
  locale matches by construction.
- 16.4c reader `loadRepoInfo` with the 16.3 routing shape, the
  `loadRepoInfo` route reading the preference live, and the loader
  refusing binaries without the new export. Nine routing cases with a
  counted CLI module.
- 16.4d parity table: plain, featured (±stashes), detached, unborn —
  auto, git-cli, and direct CLI agree byte for byte with the served flag
  pinning the engine.
- Probe findings (throwaway scripts, `/tmp`): engine tags arrive in CLI
  order even adversarially; stashes arrive newest-first with
  `refs/`-prefixed selectors; `hideRemotes` and the remote toggles leave
  the consumed fields invariant (they only reshape the dropped branches);
  detached gives `head: null`; unborn answers with a name; non-repos
  throw `NotARepository:`. A global `tag.gpgsign=true` on dev machines
  hangs plain `git tag` — the test helpers already neutralise it.
- `loadBranches` untouched: filtering still travels on its own message.
- Gate: numbers in the 16.4e commit.
