---
summary: >-
  Done (`2026-09-23`): `native-build.yml` builds the triples; the maintainer
  chose one universal VSIX (`15.06 MB`) over the seven-VSIX plan;
  `.vscodeignore` whitelist; local packaging can ship a debug binary.
---

# Slice 16.9 — Per-platform packaging

Only now, and only if the earlier slices have paid off.

1. Build the six triples in CI on native runners, following
   `engine/docs/DEPENDENCIES.md`.
2. Publish per-platform VSIXs (`vsce package --target win32-x64`,
   `linux-x64`, `darwin-arm64`, …) **plus a universal CLI-only VSIX** as the
   fallback for every platform not built — musl/Alpine above all, where the
   gnu binaries will not load.
3. The release workflow's shape is load-bearing and must survive: the token
   checks exist because the `secrets` context is not available to a
   step-level `if`, and both publishes take `--packagePath` against the same
   artifact with `--skip-duplicate`. A matrix must not quietly break either.
4. Size: today's VSIX is `263 KB` from one job. Record the new per-platform
   size here when it is known.

Implementation record (`2026-09-23`, three subslice commits, all signed):

- 16.9a `native-build.yml` (called by `publish.yml` on tags with
  `scope: full`, runnable by hand): matrix over the triples, each on
  the runner where its linker already exists — Windows x64, Linux x64
  and Linux arm64 and macOS arm64 natively; Windows arm64 through
  cargo-xwin and macOS x64 through zig, both installed on first use by
  the build script, which also owns the triple-to-directory mapping.
  One `native-<dir>` artifact per binary.
- 16.9b `publish.yml` packages seven VSIXs (six `--target` platform
  builds each staging exactly one binary directory, plus a binary-free
  universal CLI-only build guarded by an assert-no-binary step), then
  releases all seven and publishes each against its own path with
  `--skip-duplicate` on both registries. The token-check shape
  survives: outputs plus step-level `if`s, untouched.
- `.vscodeignore` whitelists only `engine/native/*/*.node` — the first
  revision opened the whole native tree and shipped Rust sources, caught
  by unzipping a local build. Inclusion proven with vsce 4.0.0's own
  minimatch pipeline (its semantics, not gitignore's).
- Sizes, measured locally with vsce 4.0.0: universal `272.52 KB`
  (36 files, no binary — the CLI-only fallback); linux-x64 **`2.73 MB`**
  (37 files, a `5.9 MB` release binary inside). The other five platform
  sizes are pending the first tag run; musl/Alpine is covered by the
  universal VSIX, whose gnu-binary absence is the point.

  **Maintainer decision (`2026-09-23`): one universal VSIX, not seven.** The
  per-platform matrix was replaced by a single package carrying every
  platform's binary, which `vsce` is given no `--target` for, so one artifact
  installs everywhere. Measured at **`15.06 MB`** (42 files, six binaries) —
  about 5.5× a single-platform VSIX rather than 6×, since they compress well
  together. It needs no code: `platformDirectoryFor()` already picks the
  directory from `process.platform`/`process.arch` at load time, and
  `.vscodeignore` whitelists `engine/native/*/*.node` across every directory.
  The cost is accepted knowingly — each install carries five binaries it
  cannot load — and it buys one file to download instead of seven, which is
  what the maintainer asked for and what `vscode-git-graph-rs` did by default
  (their `package-platforms.mjs` is the per-platform alternative, not the
  norm). `publish.yml` is correspondingly one package job rather than a
  seven-way matrix, and asserts it staged exactly six binaries, because a
  missing one would package silently and leave that platform on the CLI with
  nothing to say why.

  **An earlier revision of this line recorded linux-x64 at `37.63 MB`
  with "the 195 MB binary inside", and that number was measured against
  a *debug* build.** `engine:build` defaults to debug, and
  `vsce package` runs `vscode:prepublish`, which builds only the
  TypeScript half and never rebuilds the addon — so it silently packages
  whatever `.node` happens to be sitting in `engine/native/`. A debug
  binary is `195 MB` against the release build's `5.9 MB`, i.e. a
  fourteenfold difference in the packaged VSIX. CI is unaffected
  (`native-build.yml` passes `--release`), so no published artifact was
  ever wrong; the hazard is local packaging, and
  `pnpm run build` is what removes it.
- Gate: `vsce package` green for both shapes locally (which also runs
  `vscode:prepublish`), both workflows YAML-parsed; the six-remote CI
  matrix itself is proven on the first tag push, not here.
