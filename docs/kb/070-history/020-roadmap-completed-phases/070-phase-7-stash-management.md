---
summary: >-
  Complete: stash loading behind a per-repo toggle, the apply/pop/drop/branch
  actions (`6750480`), the stash list panel and graph stash rows; original
  plan and acceptance criteria.
---

# Phase 7: Stash Management

**Status: complete** — stash data loading (behind the per-repo toggle), the apply/pop/drop/branch/stash-uncommitted action suite (`6750480`), the stash list panel above the table, and graph stash rows beside their base commits are all done.

Goal: display stashes and provide safe apply, pop, and drop actions.

Implementation plan:

- Add `GitStash` type with `index`, `ref`, `message`, and optional author/date.
- Add stash data through the Phase 0.5 Git runner or `loadRepoInfo` path, using a
  NUL or record-separated parser robust enough for stash messages.
- Add backend actions `applyStash`, `popStash`, and `dropStash`.
- Require confirmation before `dropStash` and probably before `popStash`.
- On success, refresh stashes and commits; on failure, keep UI state unchanged
  and surface the git error message.
- Add a first UI slice as a compact stash section near the toolbar or footer,
  then later consider graph placement.

Acceptance:

- Empty stash list renders cleanly.
- Apply/pop/drop target the selected `stash@{n}`.
- Drop requires confirmation.
- Conflict/failure messages are visible and do not mutate the displayed stash
  list optimistically.
