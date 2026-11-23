---
summary: >-
  W41 · wave B · needs W01 · Rust + TypeScript · ~200 lines: the deferred
  slice from the Git trust handoff. Open every repository with
  `bail_if_untrusted(true)`, and give the refusal its own `Untrusted` error
  kind, so the engine can never serve a repository Git rejects. Today
  TypeScript's `isVerified` is the only gate, and gix silently drops untrusted
  config. It matters more once worktrees, with their mixed owners, are
  listed and opened.
---

# W41 — Engine opens refuse untrusted repositories

Status: integrated `a81b51a` (`2026-11-05`)
Needs: W01
Decisions: Y12 (in this release or later)
Kind: Rust and TypeScript, the Rust arm applies · Size budget: ~200 changed
lines outside tests
Source: Active handoff: Git trust, repository recovery, and diagnostics
("Not taken, recorded for a later engine slice"); Engine changes for
worktrees (Trust)

## Facts

- The engine has no trust code. `gix::discover` runs with default options
  and `bail_if_untrusted` false, so an untrusted repository opens with
  reduced trust: untrusted config sections are filtered out, an allocation
  limit applies, and the object store gets 32 slots.
- gix can be stricter than Git, because it also counts the common dir's
  owner. A linked worktree Git accepts can therefore silently lose its
  remotes and identity in the engine.
- The handoff's reason for deferring: every gix open error maps to
  `NotARepository` today. With Git missing, an untrusted repository would
  then read as absent on the startup screen, so the refusal needs its own
  error kind, and every platform binary has to be rebuilt (W01 rebuilds them
  anyway).

## Steps

1. Open with `bail_if_untrusted(true)`. Map gix's trust refusal to a new
   `Untrusted` error, carried across napi with its own prefix.
2. TypeScript: an `Untrusted:` answer reroutes the read to the CLI (Git
   decides), logged with cause `untrusted`. It never turns into a
   not-a-repository screen.
3. Tests: `GIT_TEST_ASSUME_DIFFERENT_OWNER` fixtures (the trust tests'
   method) for a repository, a linked worktree and a submodule. The engine
   refuses, the CLI answers per Git, and the startup screen shows trust,
   not absence.
4. Bump the engine version.

## Touch

`engine/native/core/src/{repository,error}.rs`, `engine/native/node/src/lib.rs`,
`engine/native/core/tests/**`, `engine/Cargo.toml`, `engine/package.json`,
`src/backend/engine/{addon,index}.ts`, `tests/backend/**`

## Acceptance

No engine read ever answers for a repository Git refuses. The CLI's answer is
unchanged.

## Report

- **Agent / date:** Muse Code powered by muse-wonder-full-1.0, 2026-11-05 19:12.
  Continuation: Claude Sonnet 5.5 claimed the slice and drafted the Rust core, then was
  stopped by a rate limit; its uncommitted diff was reviewed, kept and completed (see
  Deviations for the two changes made to the draft).
- **Branch and commits:** `wt-1.10.0/W41` —
  `67493ac G docs(engine): claim W41 (W41)`;
  `cc0856f G fix(engine): refuse untrusted repositories at open (W41)`;
  `4003f01 G fix(engine): route a trust refusal to the CLI (W41)`;
  `cee980f G fix(engine): bump the engine to 1.0.29 for the trust refusal (W41)`;
  plus this report commit. Every commit `f1dcbb6..HEAD` shows `G`.
- **Files changed:** `engine/native/core/src/error.rs` (+6), `repository.rs` (+49/−6 in
  effect), `engine/native/node/src/lib.rs` (+1), new `engine/native/core/tests/untrusted.rs`
  (+153); `src/backend/engine/index.ts` (28 lines changed), `src/backend/engine/addon.ts`
  (+5/−1); version `1.0.29` in `engine/Cargo.toml`, `engine/package.json`,
  `engine/Cargo.lock` (the three workspace packages) and `EXPECTED_ENGINE_VERSION`;
  tests `tests/backend/engine/reader.test.ts` (318 lines changed, mostly the formatter's
  reindentation of the five extended `it.each` blocks; `git diff -w` shows only the added
  cases), `tests/backend/engine/worktrees.test.ts` (+5),
  `tests/backend/utils/repositoryProbe.test.ts` (+22); this slice file.
- **Tests added or changed:** Rust: new `untrusted.rs`, 7 tests (owned opens; untrusted
  repository refused, from the root and a subdirectory; exact and wildcard
  `safe.directory` entries rescue it, an unrelated one does not; untrusted linked
  worktree — path with a space and a non-ASCII character — and submodule refused; a
  missing repository stays `NotARepository`). TypeScript: 8 cases — `Untrusted:` in the
  decline tables of `isEngineFallbackError`, remoteUrl, loadRepoInfo, loadCommits and
  commitDetails in `reader.test.ts` (79 → 85 tests; each asserts equality with the direct
  CLI read), one new test asserting the route line
  `backend=cli reason=engineDeclined kind=Untrusted cause=untrusted` with declined (not
  failed) flags, one worktree-list trust case (`worktrees.test.ts` 24 → 25), and one
  probe test (`repositoryProbe.test.ts` 23 → 24) covering repository, linked worktree and
  submodule. Before-counts are from this branch's diff, the only changes to those files.
- **Gates:** Rust arm on the final tree: `engine:fmt`, `engine:lint`, `engine:check` pass;
  `engine:test` 228 passed (core 149 including the 7 new, diff 74, node 4, 1 doc-test),
  0 failed. `engine:build` then `engine:smoke`: "reports engineVersion() 1.0.29".
  TypeScript: strict Biome (`biome.strict.jsonc --error-on-warnings`) clean on the five
  touched `.ts` files; `pnpm run typecheck` clean; focused suites 134/134
  (reader 85, worktrees 25, repositoryProbe 24); full `pnpm run test` on the built
  1.0.29 engine: backend 1330/1330, webview 851/851, nothing skipped; `kb:check` clean
  (rerun after this report). l10n n/a (no user-visible text). Sonar: integrator.
- **Acceptance:** met. Step 1: both engine opens (`Repo::discover` through a trust map,
  `Repo::open` through open options — the only two opens in the engine; no sibling is
  ever opened) bail if untrusted; gix's permission-denied trust refusal maps to the new
  `Untrusted` kind, carried over napi as `Untrusted: …`. Step 2: `Untrusted:` joins the
  decline prefixes, so every reader read and the worktree list reroute to the CLI,
  logged with `cause=untrusted`; it cannot become a not-a-repository screen — the probe
  treats only `NotARepository:` as absence, so with Git missing an untrusted repository
  stays unknown presence (`gitUnavailable`), and with Git present the existing
  `GIT_TEST_ASSUME_DIFFERENT_OWNER` probe tests report `untrusted` for a repository, a
  linked worktree and a submodule, which the startup screen already turns into the
  trust prompt. TypeScript's `isVerified` gate is unchanged and stays first; the engine
  refusal is the second gate, and it also covers the case Git accepts but gix's stricter
  ownership check refuses — the CLI then answers, as the decline tests assert case by
  case. Step 3: covered as described under Tests, with the method change under
  Deviations. Step 4: bumped to 1.0.29 in all four places. The CLI's answer is
  unchanged: no CLI query was touched, and every new decline case compares against the
  direct CLI read.
- **Deviations from the slice:** (1) The slice's test method cannot make the *engine*
  refuse: gix derives trust from real file ownership and has no
  `GIT_TEST_ASSUME_DIFFERENT_OWNER` handling (checked in the pinned gitoxide sources),
  and a real mismatch needs another user's files. The Rust tests therefore assert
  reduced trust through `Repo::discover_assuming_reduced_trust`, a seam that replaces
  only the ownership derivation; gix's real `safe.directory` check then runs against a
  temporary `GIT_CONFIG_GLOBAL`, never the user's own. The draft's seam accepted any
  trust level (assuming full would have been a bypass); it now asserts reduced only,
  and a misplaced `ConfigStamp` doc comment in the draft was restored. The env-var
  fixtures are used on the TypeScript/Git side, where they work. (2) `engine/Cargo.lock`
  is touched (three workspace version lines) although Touch names `engine/Cargo.toml`:
  cargo rewrites it with the version, as W40's bump commit records; leaving it would
  ship a stale lock. No other file outside Touch was changed. (3) Size: 433 insertions
  including tests and the formatter reindentation against the ~200 guide — reported,
  not gamed.
- **Open questions / follow-ups:** (a) The refusal happens at open/reopen, like the
  config-stamp model: removing a `safe.directory` entry from a loaded config file
  reopens and refuses, but a pure ownership change with no config change is not
  rechecked on a warm handle within the session — `isVerified` and
  `forgetVerification` remain the session gate, as before. (b) A theoretical
  `config_list` trust refusal mid-composition would be labelled
  `configFill:engineFailed` in `src/backend/engine/repoInfo.ts` (still rerouting the
  whole read to the CLI, so the answer is right; unreachable in practice because
  `load_repo_info` opens first). That file is outside this slice's Touch; the label
  could move to the decline list in a follow-up. (c) The integration branch advanced to
  `ebc3c33` (W06F) after dispatch; `git diff f1dcbb6..the-worktrees` touches none of
  this slice's files. Not rebased, per protocol.
