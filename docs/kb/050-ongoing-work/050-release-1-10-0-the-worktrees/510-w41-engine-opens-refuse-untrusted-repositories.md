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

Status: claimed by Claude Sonnet 5.5 on 2026-11-05 12:00
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

Not started.
