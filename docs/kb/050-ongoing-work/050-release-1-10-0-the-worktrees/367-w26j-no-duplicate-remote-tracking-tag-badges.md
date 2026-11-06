---
summary: >-
  W26J · wave A · ready · Rust + TypeScript · ~80 lines: a maintainer-reported
  bug (`2026-11-06`). With a fetch refspec `+refs/tags/*:refs/remotes/<remote>/tags/*`,
  the engine shows `refs/remotes/<remote>/tags/<tag>` as an extra tag badge
  `<remote>/<tag>` beside the local tag `<tag>`, while the CLI path shows
  nothing. Decision: hide only the duplicates, and make both backends agree.
---

# W26J — No duplicate remote-tracking tag badges

Status: integrated `eedb048` (`2026-11-06`)
Needs: —
Decisions: the maintainer, `2026-11-06`: "Hide duplicates only". Drop the
`<remote>/<tag>` badge when the local tag `<tag>` is the same object. Keep
it when the remote's tag differs or has no local tag. The CLI path matches
the engine.
Kind: Rust (the Rust arm applies) and TypeScript · Size budget: ~80
changed lines outside tests
Source: the maintainer's report, with a screenshot and log
(`/home/zam/Desktop/Electronic_Instrumentation_manuals`): a commit showed
`Script | dev` and a second tag badge `dev/Script`

## Facts (checked `2026-11-06`)

- The reporting repository has `remote.dev.fetch
  +refs/tags/*:refs/remotes/dev/tags/*`, and the same for `origin`. So
  `refs/remotes/dev/tags/Script` and `refs/tags/Script` both point at the
  annotated tag object `db3c2f5`, which peels to `4b71232`.
  `git log --decorate` shows both names too.
- **Engine.** `engine/native/core/src/refs.rs:189`–`:202`, unchanged since
  the engine's import (`e1175be`), turns `refs/remotes/<remote>/tags/<tag>`
  into a `GitTagRef` named `<remote>/<tag>`. It peels it (`:206` and after),
  so it decorates the commit as a second tag badge.
- **CLI.** `toGitRef()` in `src/backend/queries/loadCommits.ts:110`–`:131`
  maps the same ref to a `remote` named `<remote>/tags/<tag>` with
  `objectHash`, unpeeled. That hash is the tag object, so it decorates no
  row. The two backends diverge, and the engine path shows the duplicate.
- The `for-each-ref` format already has `%(objectname)`, `%(*objectname)`
  and `%(objecttype)` for every ref (`:98`–`:105`).

## Steps

1. **Engine.** Keep turning `refs/remotes/<remote>/tags/<tag>` into tag
   `<remote>/<tag>`, but skip it when `refs/tags/<tag>` exists and points at
   the same object id: the unpeeled tag object, or the commit for a
   lightweight tag. Compare raw ids before peeling, so it costs nothing
   extra.
2. **CLI.** Map `refs/remotes/<remote>/tags/<tag>` like the engine: a tag
   named `<remote>/<tag>`, with `hash: peeledHash || objectHash` and
   `signed` as for local tags. Skip it under the same duplicate rule, which
   needs every local tag's object id from the same scan. Keep the existing
   hidden-remote rule for these refs.
3. **Engine version.** Bump `1.0.30` → `1.0.31` (`engine/Cargo.toml`,
   `engine/package.json` and `EXPECTED_ENGINE_VERSION`), since the parity
   test relies on the new engine behavior.
4. **Tests.** A fixture with the refspec and two remotes, on both backends,
   asserting parity:
   - the same annotated tag gives one badge;
   - a lightweight tag that is the same gives one badge;
   - a remote tag with a different object for the same name gives both
     badges;
   - a remote-only tag gives a `<remote>/<tag>` badge;
   - a hidden remote gives no badge.

   Engine unit tests in `engine/native/core/tests/`.

## Touch

`engine/native/core/src/refs.rs`, `engine/native/core/tests/**`,
`engine/Cargo.toml`, `engine/package.json`, `engine/Cargo.lock`,
`src/backend/engine/addon.ts` (the version constant),
`src/backend/queries/loadCommits.ts`, `tests/**`

## Acceptance

- In the reporting layout, the commit shows `Script` (with `| dev` from the
  tag-remote setting), and no `dev/Script` badge, on both backends.
- A differing or remote-only tag still shows.
- The parity tests pass, and the Rust arm passes.

## Report

Branch `wt-1.10.0/W26J`. Sonar: integrator.

- Engine (`refs.rs`): local tags' unpeeled ids are collected in the scan;
  a `refs/remotes/<remote>/tags/<tag>` ref is dropped when local `<tag>` has
  the same id. New helper `remote_tag_name` keeps `read_remote_refs` simple.
- CLI (`loadCommits.ts`): the ref maps to tag `<remote>/<tag>` (peeled hash,
  `signed` as local tags, hidden remotes respected), dropped under the same
  rule. When the tag scan is off (tags neither shown nor selected) neither
  backend shows a remote-tracking tag, since the engine's graph drops all tags
  then and the local ids are unknown to the CLI.
- Engine 1.0.30 to 1.0.31 in `Cargo.toml`, `Cargo.lock`, `package.json`,
  `EXPECTED_ENGINE_VERSION`.
- Tests: three Rust unit tests; `toGitRef` unit tests; parity file
  `tests/backend/engine/remoteTagParity.test.ts` (two local bare remotes, the
  tags refspec, `GIT_CONFIG_GLOBAL` on an empty file). It fails on the old
  code. Results on both backends, identical: same annotated one badge, same
  lightweight one badge, moved tag both badges, remote-only `<remote>/<tag>`,
  hidden remote none.
- Gates: engine fmt, clippy, check, test (all pass, 0 failed), engine:build,
  smoke 1.0.31; typecheck clean; `pnpm run test` 107 files / 1395 tests and
  76 files / 948 tests, no unhandled errors; Biome strict clean on touched
  files.

