---
summary: >-
  Record: the `attachRemoteHeadLabels`/`attachSignedTagNames` `for-each-ref`
  fills deleted; the engine reports tag `signed` and symbolic `origin/HEAD`;
  `loadCommits` spawns nothing. Benchmark only `engine:build:release`, never
  debug.
---

# The two ref fills, removed from the engine rather than optimised (`2026-09-23`)

`loadCommits` was the one read where the engine *lost*: `12.9 ms` against the
CLI's `10.8 ms` on a real 1,036-commit repository. The engine call itself was
`7.1 ms` — comfortably ahead. The loss was entirely in what ran afterwards.

Two CLI fills (16.5d3/d5) ran `for-each-ref` on the engine path, sequentially,
to put back two facts the engine's types did not carry:

| fill | spawn | the missing field |
| --- | --- | --- |
| `attachRemoteHeadLabels` | `for-each-ref refs/remotes` | symbolic `origin/HEAD` |
| `attachSignedTagNames` | `for-each-ref refs/tags` | tag signature presence |

This is the same defect as the `repoInfo` one above, one layer down: ask the
engine, then spawn `git` anyway. The fix is the same shape — teach the engine
the field and delete the fill, rather than make the spawn cheaper.

**`GitTagRef.signed` and `GitCommitTag.signed`.** `refs.rs` reads the tag
object's signature while it is peeling the tag it would peel regardless, and
records the flag on *both* records of an annotated tag — the signature belongs
to the tag, not to either hash, and the graph attaches the peeled one. A
`find_header` call settles the object kind first, so a lightweight tag costs a
header lookup rather than a commit read.

The semantics were verified against git rather than assumed. `for-each-ref`'s
`%(contents:signature)` is non-empty **only** for an annotated tag object that
was signed — a lightweight tag over a *signed commit* reports nothing:

| tag | object type | `%(contents:signature)` |
| --- | --- | ---: |
| annotated, signed | `tag` | `1` |
| annotated, unsigned | `tag` | `0` |
| lightweight, on a signed commit | `commit` | `0` |
| lightweight, on an unsigned commit | `commit` | `0` |

That third row is the one worth pinning: the commit was genuinely signed
(`%G?` = `G`) and the tag still reports unsigned. The engine matches by
construction — it reads the tag object, and a lightweight tag has none.

**Symbolic remote HEADs, resolved instead of dropped.** `direct_target`
returns `None` for a symbolic ref, so `refs/remotes/origin/HEAD` — what every
`git clone` writes — never reached the graph. `for-each-ref %(objectname)`
reports the object such a ref resolves to, so `read_remote_refs` now does the
same. Only a remote's handful of `/HEAD` refs are ever symbolic, so this costs
one lookup each and nothing in the common case.

**Verification.** A clone carrying all four tag shapes *and* a symbolic
`origin/HEAD` was read through `createRepoReader` on both backends, and the ref
labels compared:

```
engine served the read: true
  ccaf060 remote origin/HEAD
  ccaf060 tag    annotated-signed   signed=true
  ccaf060 tag    light-on-signed    signed=false
IDENTICAL: true
```

Spawn counts on that repository, through `recordGitCommand`:

| backend | git spawns |
| --- | ---: |
| `git-cli` | 3 (`refs`, `head`, `log`) |
| `auto` (engine) | **0** (was 2) |

| operation | CLI | engine before | engine after | |
| --- | ---: | ---: | ---: | ---: |
| `loadCommits` (300) | `11.5 ms` | `12.9 ms` | **`7.7 ms`** | `1.5x` |
| `loadCommits` (1000) | `17.1 ms` | `19.3 ms` | **`13.6 ms`** | `1.3x` |
| view load | `68.7 ms` | — | **`15.7 ms`** | `4.4x` |

`reports_tag_signature_presence_the_way_for_each_ref_does` and
`resolves_a_symbolic_remote_head_rather_than_dropping_it` pin both changes;
each was mutation-checked and kills only its own test. The signed-tag fixture
writes the tag object by hand through `git hash-object -t tag -w`, so it needs
no keyring and stays deterministic on CI — the engine reports signature
*presence*, so a fabricated block exercises the identical path.

`attachRemoteHeadLabels`, `attachSignedTagNames`, their parsers, their
appliers and their tests are deleted. Nothing in the engine's `loadCommits`
path spawns a process any more.

**A measurement trap worth recording.** The first benchmark after this change
showed the engine *five times slower*, because `pnpm run engine:build` builds
the **debug** profile (186 MB, unoptimised) while the benchmark numbers above
are all release (5.9 MB). Always `pnpm run engine:build:release` before
benchmarking; a debug addon is not a slow engine, it is a different one.
