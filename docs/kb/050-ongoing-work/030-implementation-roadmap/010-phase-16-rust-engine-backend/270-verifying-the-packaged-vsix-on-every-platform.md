---
summary: >-
  Done: `verify-vsix.yml`, called by `publish.yml` between `package` and
  `release`, loads the engine out of the packaged VSIX on ten legs (Linux
  x64/arm64 on current glibc, glibc 2.28 and musl; macOS and Windows
  x64/arm64) with `engine/scripts/verify-vsix.mjs`: six binaries present,
  exports, version against `Cargo.toml` and `EXPECTED_ENGINE_VERSION`, a real
  read; the 2.28 legs caught a host-linked `GLIBC_2.39` build; manual runs are
  dry runs; free on the public repository. Since `2026-10-20` (D66) a tolerant
  release gate lets up to two legs that never got a runner publish after one
  retry each, while any leg that ran and failed blocks; manual runs take
  `tag`, `publish`, `skip_legs` and `max_not_run`.
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

## The release gate that tolerates runner shortages (`2026-10-20`, D66)

**Why.** The `v1.9.0` release run `39461675485` stalled: GitHub had no macOS
arm64 runner, twice ("The job was not acquired by Runner of type hosted even
after multiple attempts"), and `release` needed every leg, so nothing was
published over a platform the VSIX was never tested on for lack of a machine.
Such a leg is `completed`, `cancelled`, `runner_id` 0, no steps.

- **Outcomes of a leg:** passed; **failed** (it ran, a non-zero `runner_id` or
  any step, and did not succeed, a `timeout-minutes` overrun included, which
  fails the release at once); **not run** (runner 0 and no steps whatever the
  conclusion, or still queued 30 minutes after creation,
  `VERIFY_QUEUE_TIMEOUT_MINUTES` as a repository variable); **skipped**
  (named in `skip_legs`, never scheduled).
- **Retry:** the gate dispatches `verify-vsix.yml` once per not-run leg
  (`workflow_dispatch` works with `GITHUB_TOKEN`) with `legs` of that one leg,
  `artifact_run_id` (this run, so the retry downloads the same VSIX with
  `run-id` and `github-token`) and a `retry_token` in `run-name`, which is how
  the gate finds the run. The retry's outcome replaces the leg's, same rules.
- **Decision:** any failed leg fails the gate; more than `max_not_run`
  (default 2) not-run legs after retries fail it with a "Re-run failed jobs"
  message; otherwise it passes. A job summary lists every leg, outcome, retry
  and links.
- **Where:** `.github/verify-vsix-legs.json` (the one leg list), `plan` job
  (applies `skip_legs`, an unknown name fails), `verify` (the matrix,
  `fromJSON(inputs.legs)`), `verify-gate` (needs `plan` and `package`, not
  `verify`; `actions: write`, 90-minute timeout), `release` (needs
  `[package, verify-gate]`). The logic is `scripts/release-verify-gate.mjs`
  (pure `evaluateGate`, tested in `tests/backend/releaseVerifyGate.test.ts`).
- **Manual runs** (Actions, "Run workflow", or `gh workflow run`):
  - dry run: `gh workflow run publish.yml --ref main` (builds `main`, verifies,
    publishes nothing); add `-f tag=v1.9.0` to build that tag instead;
  - publish an existing tag: `gh workflow run publish.yml --ref main -f
    tag=v1.9.0 -f publish=true`; the tag must equal `v` plus `package.json`'s
    version at that tag, and `--skip-duplicate` still makes a repeat harmless;
  - `-f skip_legs="macOS arm64,Windows arm64"` leaves named legs out;
    `-f max_not_run=1` tightens the tolerance.
- **A tag push uses the workflow files at the tagged commit.** A fix to these
  workflows therefore reaches a tag that already exists only through a manual
  run from `main` with `tag` set. For that reason `plan` and `verify-gate` run
  the script and leg list from the run's own commit (older tags lack them),
  while `native`, `package`, `verify` and `release` check out `tag`.
  `native-build.yml` gained an optional `ref` input for it.
- **Known limits:** a leg queued past the timeout is only counted, not
  cancelled, so it may still run later; the run can show red (`verify`) while
  the gate and the release are green; a not-run leg is a platform not tested
  for that release, which the summary states.
