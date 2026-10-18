---
summary: >-
  Done: `verify-vsix.yml`, called by `publish.yml` between `package` and
  `release`, loads the engine out of the packaged VSIX on ten legs (Linux
  x64/arm64 on current glibc, glibc 2.28 and musl; macOS and Windows
  x64/arm64) with `engine/scripts/verify-vsix.mjs`: six binaries present,
  exports, version against `Cargo.toml` and `EXPECTED_ENGINE_VERSION`, a real
  read; the 2.28 legs caught a host-linked `GLIBC_2.39` build; manual runs are
  dry runs; free on the public repository.
---

# Verifying the packaged VSIX on every platform (`2026-10-17`)

**Done at the maintainer's request: no release publishes until the engine has
been loaded out of the packaged VSIX on every platform it ships for.** This
closes the gap "One build path, runnable anywhere" recorded: every binary is
cross-built on one Linux runner and none was loaded before release, while the
loader's contract (refuse quietly, fall back to the CLI) makes a broken
platform look like a slow one.

- **Where:** `.github/workflows/verify-vsix.yml`, a reusable workflow that
  `publish.yml` calls as `verify` after `package`; `release` needs both. A
  manual run of `publish.yml` (`workflow_dispatch`) is now a dry run —
  native build, package, verify — and `release` runs only on a tag push.
- **What a leg checks** (`engine/scripts/verify-vsix.mjs`, plain Node, no
  dependencies): the VSIX holds exactly the six `engine/native/<dir>/
  git-graph.node` entries and nothing else there (a `.vscodeignore`
  regression once shipped Rust sources); this platform's binary, extracted
  with a built-in zip reader (CRC and size checked), `require()`s; it exports
  everything `isEngineAddon` requires; `engineVersion()` equals both
  `engine/Cargo.toml` and `EXPECTED_ENGINE_VERSION`, since a mismatch is a
  silent `versionMismatch`; and it does real work — `repoRoot` and
  `loadCommitFile` on a one-commit repository written byte by byte
  (zlib-compressed loose objects), so no git is needed in the container.
  `--libc gnu|musl` and `--glibc <version>` make a Linux leg refuse to run
  anywhere but where it says it runs, so a misconfigured matrix or a
  drifting image cannot quietly test a newer C library.
- **The matrix, ten legs:** Linux x64/arm64 on the runner's own glibc
  (`ubuntu-24.04`, `ubuntu-24.04-arm`, 2.39); the same two runners on glibc
  **2.28** (`node:18-buster-slim`, Debian 10) and on musl
  (`node:22-alpine`), both via `docker run` on the native architecture, so
  nothing is emulated; macOS x64/arm64 (`macos-15-intel`, `macos-15`);
  Windows x64/arm64 (`windows-2025`, `windows-11-arm`). Images are pinned,
  not `-latest`, so a leg cannot change meaning under us. Node 22 natively,
  the line VS Code's Electron runs (Node 18 on Debian 10, the newest that
  image carries); `fail-fast: false` so every platform reports.
- **Why the glibc 2.28 legs (maintainer request, `2026-10-17`):** a
  runner's current glibc proves nothing about older ones, and the earlier
  experiment showed a Linux binary can load on 2.36 and fail on 2.28 and
  2.31. 2.28 is the floor the zig build targets and VS Code's own minimum,
  and glibc is backward compatible, so one leg per architecture at 2.28
  covers every later version; a 2.31 leg would add nothing. **Proven the
  same day:** the `linux-x64` binary on disk had been rebuilt with the
  host-only `engine:build:release` (system linker, not zig) and required
  `GLIBC_2.39`; packaged, it passed on this host and in Alpine and failed in
  Debian 10 with `libm.so.6: version 'GLIBC_2.29' not found` — a broken
  release no other leg would have shown. Rebuilt through `engine:build:all`
  (both Linux binaries then require nothing above `GLIBC_2.28`), the same
  check passes. Hence the standing rule this leg enforces: **package a
  release only from `build-all.mjs` binaries**, never from a host
  `engine:build`.
- **Minutes:** the repository is public, and GitHub's runner reference
  (docs.github.com, "GitHub-hosted runners", read `2026-10-17`) states that
  standard runners are "free and unlimited on public repositories"; all six
  labels above are on its standard list, arm64 and Intel macOS included, for
  public and private repositories alike. The same list also offers newer
  images (`ubuntu-26.04`, `macos-26`, `macos-26-intel`); the older ones are
  kept deliberately, an older OS being the stricter test of whether a binary
  loads. The legs are short
  regardless: a sparse checkout of the three files the script reads, one
  artifact download, one Node process; `timeout-minutes: 10` caps a hung leg.
  Locally the check takes ~30 ms after extraction.
- **Why the musl legs use `docker run`, not `container:`**: in a job
  container every JavaScript action (checkout, artifact download) would run
  inside Alpine on the runner's own Node build too, which turns a load test
  of our binary into a test of the runner's; running only the check inside
  Alpine keeps the actions on the host and the question narrow.
- **Kept in step by tests** (`tests/backend/engine/verifyVsix.test.ts`): the
  script mirrors the loader's directory table and required exports, because
  it must run on a bare Node — the test asserts both are equal to
  `addon.ts`'s; the zip reader against stored, deflated and corrupted
  entries; and the fixture repository against `git fsck --strict` and the
  real local engine.
- **Verified locally before any CI run:** a universal VSIX packaged from the
  six `engine:build:all` binaries (`43` files, `12.91 MB`) passed on this
  host (glibc 2.44, Node 26, `35 ms`), in `node:18-buster-slim` (glibc 2.28,
  Node 18, `35 ms`) and in `node:22-alpine` (musl, Node 22, `30 ms`), the
  containers through podman; a deliberately wrong `--libc` or `--glibc` fails
  with a `::error::` annotation. The arm64 legs could not run here (no qemu
  binfmt); both arm64 Linux binaries' highest required symbol version is
  `GLIBC_2.28` by `readelf`, and CI runs them natively. Both
  workflows lint clean with actionlint `1.7.12` (`1.7.7` predates the
  `macos-15-intel` and `windows-11-arm` labels); the only remaining notes are
  shellcheck `SC2012` infos on `publish.yml`'s existing `ls` lines.
- **Not covered:** anything older than glibc 2.28, which VS Code itself does not run on. The first remote run (`2026-10-17`, Actions run `39053275791`) passed eight legs; both Windows legs loaded and read with the engine, then went red on cleanup — `EPERM` unlinking the still-loaded `git-graph.node`, because Windows locks a loaded DLL until the process exits and a Node addon cannot be unloaded.
  Cleanup is therefore best-effort and never fails a passed check: `cleanupWorkDirectory` removes only the fixture repository on `win32`, leaves the binary in the temporary directory for the OS, and swallows any other removal failure; `verifyVsix.test.ts` pins both branches. The fix is local and unit-proven only.
  A fresh manual dry-run dispatch before the next tag remains the remote proof for Windows — re-running the failed run would only reuse the old commit.
