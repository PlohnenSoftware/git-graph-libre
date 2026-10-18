---
summary: >-
  Done (`2026-09-23`): a probe showed warm gix handles see external writes, so
  no cache bust is needed — corrected `2026-10-16`: config stays cached;
  `removeRepo` and `deactivate` close handles; lifecycle test.
---

# Slice 16.8 — Handle lifetime and post-write freshness

**The correctness risk that is easiest to miss, and it deserves its own
slice.** The engine keeps a repository open for the session. This project
writes through the CLI, so after every write the engine's view must be proven
fresh, and after a repository leaves the workspace its handle must be dropped.

1. Establish empirically — against real repositories, recorded here — whether
   a warm handle sees a commit, a ref update, a stash push and a checkout made
   by an external `git` process, and how quickly. Do not infer this from gix's
   documentation.
2. If it does not, the fix is a cache-bust at the existing chokepoint: every
   action already triggers a refresh, and `RepoFileWatcher` already fires.
   Upstream's answer was a watcher plus a 5-second poll; prefer dropping the
   handle on write, which this project can do precisely because writes are
   funnelled through `registerAction()`.
3. Call `close_repository` when a repository is removed, and
   `close_all_repositories` on deactivate. `open_repository_count()` exists for
   the test that proves handles do not accumulate across repository switches.

Implementation record (`2026-09-23`, three subslice commits, all signed):

- Empirical probe first (`/tmp/probe168.mjs`, preserved for review):
  a warmed handle was opened, then an external commit, branch and tag
  creation, a stash push and a checkout were made by a separate `git`
  process. The immediate re-read showed all of them — commits 1→3, head
  `main`→`side`, one stash, the new tag — with no change after a further
  6s settle wait, and a second external wave was seen too. gix re-reads
  refs and objects fresh on every call; the handle caches only immutable
  data. So no write-time cache bust exists in this slice: there is
  nothing to bust.
  **Correction (`2026-10-16`): the handle does cache one mutable thing —
  configuration.** The probe above covered commits, refs, stashes and
  checkouts, never config. A probe during the upstream review showed that
  after `git remote add` or `git remote set-url`, `loadRepoInfo`'s
  remotes, `remoteUrl` and `loadConfig` all stay stale until
  `closeRepository`. See "Upstream engine review, first pass".
- 16.8a the seam gains `closeRepository`, `closeAllRepositories` and
  `openRepositoryCount`, with best-effort wrappers that never throw, so
  removal and deactivation succeed whether or not the engine cooperates.
- 16.8b `removeRepo` — the single funnel for every repository removal —
  drops the engine handle in exactly one place, and a new `deactivate`
  export closes all handles. A real-addon lifecycle test proves handles
  do not accumulate across reads, drop on close, and reopen lazily.
- Gate: numbers in the 16.8c commit.
