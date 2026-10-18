---
summary: >-
  Done (`2026-09-22`): `@napi-rs/cli` devDependency, `engine:build` (host
  triple, debug), `engine:smoke` version check, `engine/package.json` napi
  config; the other triples deferred.
---

# Slice 16.2 — Build the addon locally for one target

1. Add `@napi-rs/cli` as a devDependency (upstream pins `^3.8.6`; the crates
   are `napi` 3 with the `napi4` feature).
2. Add `engine:build` producing `engine/native/<triple>/git-graph.node` for
   the host triple only. `engine/.gitignore` already ignores `native/*/`, so
   the artifact is untracked by construction — confirm, do not assume.
3. Add a smoke test, run by the Rust arm rather than vitest, that `require()`s
   the built addon and asserts `engineVersion()` equals the workspace version
   in `engine/Cargo.toml`.

Acceptance: `pnpm run engine:build` produces a loadable `.node` on
`x86_64-unknown-linux-gnu`; `git status` is clean afterwards; nothing in
`src/` references it.

Implementation record (`2026-09-22`, three subslice commits, all signed):

- 16.2a `@napi-rs/cli` as a root devDependency (resolved `3.10.4` against
  the `^3.8.6` pin). The CLI ships in the workspace root's `node_modules`,
  so `build-addon.mjs` now resolves it there first, keeping an
  engine-local `node_modules` as the fallback for standalone checkouts.
- 16.2b `engine:build` (host triple, debug — the script's documented local
  default) and `engine:smoke` (`engine/scripts/smoke-addon.mjs`), which
  `require()`s the built addon and asserts `engineVersion()` equals the
  `[workspace.package]` version in `engine/Cargo.toml`, refusing a stale
  binary. The smoke runs by hand, not under vitest, which never builds it.
- Two wiring findings, both fixed in 16.2b: napi's CLI requires an
  `engine/package.json` for its config lookup (the filtered import dropped
  it with the TS layer — first build failed `package.json not found`), so a
  private manifest now carries name/version plus `napi.binaryName` and the
  single-key `engine/napi.conf.json` is removed as superseded; its
  `version` must track the Cargo workspace version (drift only affects the
  staging filename, which the build discards, but keep them together).
- Verified on `x86_64-unknown-linux-gnu`: debug build placed
  `engine/native/linux-x64-gnu/git-graph.node` (186.2 MB — debug symbols;
  release size is recorded in 16.9), smoke reports `engineVersion()`
  `1.0.24`, `git status` shows no artifacts (`native/*/` stays ignored),
  `pnpm install --frozen-lockfile` still passes (the engine manifest is not
  a workspace package), `pnpm run package` green, manifest tests 16/16.
- Nothing in `src/` references the addon.

**Do not attempt the other five triples in this slice.** Their link
environments are the expensive part (`docs/DEPENDENCIES.md` in `engine/` is
the map: MSVC plus the Windows SDK, a separate ARM64 CRT, `cargo-xwin`,
`cargo-zigbuild` with zig, Xcode) and none of it is needed until 16.8.
