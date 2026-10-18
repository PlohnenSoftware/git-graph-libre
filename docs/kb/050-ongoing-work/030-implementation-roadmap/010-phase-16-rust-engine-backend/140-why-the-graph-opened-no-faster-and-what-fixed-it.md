---
summary: >-
  Record: simple-git adds ~50 ms to empty-output commands (`runGitRaw` move
  still open); `composeEngineRepoInfo` CLI fills moved into the engine;
  `log::authors` all-refs bug fixed; `loadRepoInfo` 7.2x faster.
---

# Why the graph opened no faster, and what fixed it (`2026-09-23`)

The benchmark's first run showed `loadRepoInfo` and the view load at `1.0x` —
the engine serving the read and taking exactly as long as the CLI. Two
independent causes, and both are worth knowing because neither is where anyone
would look first.

**1. simple-git adds ~50 ms to any git command that produces empty stdout.**

Established by measurement, not inference. Same binary, same arguments, same
repository — the spawn was traced to confirm it is byte-identical — and the
only variable is whether anything came back:

| call | output | time |
| --- | --- | ---: |
| `git remote -v`, no remotes configured | empty | `52.2 ms` |
| `git remote -v`, one remote configured | non-empty | `1.7 ms` |
| `git config --get-regexp ^remote.`, matches | non-empty | `1.6 ms` |
| `git config --get-regexp ^nosuch.`, no match | empty | `52.1 ms` |
| the same empty call through `execFile` | empty | `1.5 ms` |

Repeated identical calls show no warm-up effect, so it is not a queue or a
scheduling quantum. **`runGitRaw` is `git.raw(options.args)`**, so every CLI
read in the extension is exposed, and empty output is routine: no tags, no
stashes, no remotes, a filtered log that matches nothing. A fresh repository
plausibly pays this twice on every graph open.

This is unfixed. `runGitRaw` has no `binary` in its options — it relies on
simple-git's configured one — so replacing `git.raw` with a direct spawn means
threading `config.gitPath()` through its call sites. `runGitWithInput` already
spawns directly and shows the shape. **Do not make the `binary` optional when
doing it**: a two-path runner leaves the slow path wherever nobody threaded it,
and the obsolete-surfaces rule in this file says to remove the bridge rather
than keep it.

**2. The engine path was spawning `git` three times anyway.**

`composeEngineRepoInfo` filled head, remotes and authors from the CLI —
`git branch --show-current` plus `git rev-parse --verify HEAD`,
`git remote -v`, and `git log --format=%an --all` — even with an addon
present. The engine exports `currentBranchName`, `loadRefs`, `loadConfig` and
`authors`, and the loader's `EngineAddon` interface declared only
`configList`, so nothing above could reach them. Slice 16.7 wired the
user-config read and stopped.

They are wired now, each falling back to its own CLI fill rather than rolling
the whole read back — the engine's `authors` legitimately errors on an unborn
branch, where the CLI fill returns the empty-with-error shape the view already
handles, and a whole-read rollback would take the CLI path for every empty
repository. The parity table caught that: the `unborn branch` fixture failed
on the first attempt.

**Result, same fixture, engine serving every row:**

| operation | before | after | |
| --- | ---: | ---: | ---: |
| view load | `71.7 ms` | **`18.7 ms`** | `3.6x` |
| loadRepoInfo | `59.0 ms` | **`8.2 ms`** | `7.2x` |

**An engine bug found on the way, and fixed in the engine.** `log::authors`
walked from `head_id()` — one tip — while `git log --format=%an --all` walks
every ref, so any contributor whose work was only on a branch that is not
checked out was missing from the author filter. On this repository it returned
19 of 20 authors; the missing one had commits reachable only from
`refs/remotes/origin/commit_blink`. It now walks `all_tips(repo, true, true)`
plus the stash, mirroring what `stats.rs` already did and what `--all`
actually covers. `collects_authors_from_every_ref_not_just_head` pins it, and
a mutation back to head-only fails it.

**`loadCommits` was still slower than the CLI** — `0.9x` at a 300-commit page,
`0.7x` at 1000 — and was untouched by any of the above. That is the next
subsection.
