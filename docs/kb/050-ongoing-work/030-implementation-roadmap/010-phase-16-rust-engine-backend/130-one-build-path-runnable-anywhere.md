---
summary: >-
  Decision: cross-compile every platform from one machine with
  `engine/scripts/build-all.mjs` (CI `native-build.yml`, local
  `engine:build:all`); zig pinned `0.14.1`, `--cross-compile`, macOS ad-hoc
  signing, untested cross-builds.
---

# One build path, runnable anywhere (`2026-09-23`)

**Maintainer decision: cross-compile every platform from one machine, and use
the same path in CI and locally.** The reasoning is not cost — the six-runner
matrix was free — but permanence: a release must not depend on a CI provider
still existing, still offering these runners, or still offering them free. A
build path that only works inside GitHub is not a build path.

`engine/scripts/build-all.mjs` is that path. `.github/workflows/native-build.yml`
runs it on one `ubuntu-latest` and uploads one artifact; `pnpm run
engine:build:all` runs the identical script locally, and `pnpm run build:all`
adds the extension on top, so a maintainer can produce the release VSIX with
no CI at all.

Measured on this machine (Linux, x64): **all six platforms in 58 seconds**,
and a rebuild produced **bit-identical binaries** — verified by sha256 across
two full runs. (**Corrected `2026-10-17`:** true for the Linux builds, but
the macOS and Windows ones change on every relink — a random Mach-O UUID,
PE link timestamps — so the second run was most likely served from cargo's
cache; see "Experiment: one Linux binary for both C libraries".) The
universal VSIX built from them is **15.59 MB** (42 files;
darwin-arm64 `7.6`, darwin-x64 `7.5`, win32-x64 `6.1`, linux-x64 `5.9`,
win32-arm64 `5.7`, linux-arm64 `5.4` MB).

**zig is pinned to `0.14.1`, and that pin is load-bearing.** The distribution's
zig `0.16.0` fails *both* macOS targets: rustc passes
`-Wl,-exported_symbols_list` for a cdylib, and 0.16's Mach-O driver reads the
*following* flag as the list's path, so the link dies with `unable to read
exported symbols list '-dead_strip': FileNotFound`. `0.14.1` links both
cleanly. The pin is delivered through the `ziglang` wheel into a throwaway
virtualenv under `engine/target/toolchain/`, because that is the one mechanism
that installs the same zig on every operating system without a package manager
having an opinion. **Do not "simplify" this to the system zig** — that is the
configuration that was already broken once.

**Every target is built with `--cross-compile`, including the host's own.**
`build-addon.mjs` previously refused that combination; it now allows it,
because the alternative is that the host binary is linked by the system linker
while the other five are linked by zig, and a laptop and a CI runner ship
different bytes for the same platform. One linker for all six is what makes
the two paths comparable.

**Apple Silicon code signing — answered, not assumed.** arm64 macOS refuses to
load unsigned Mach-O, and whether zig's linker ad-hoc signs was the one thing
that could have made cross-building macOS useless. It does: `darwin-arm64`
carries an `LC_CODE_SIGNATURE` load command with a 61,808-byte blob whose magic
is `0xfade0cc0` (`CSMAGIC_EMBEDDED_SIGNATURE`). `darwin-x64` carries none, and
that is correct rather than a gap — Intel macOS does not require one. So zig
signs exactly where the platform demands it.

**What this gives up, and it is real.** Native runners could at least run
`engine:smoke` on the binary they had just built. Nothing cross-built is ever
loaded before it ships, and the failure mode is silent by construction: the
loader's contract is that an unloadable binary returns `null` and falls back
to the `git` CLI, so a broken platform would look like a slow one. Only
`linux-x64-gnu` is smoke-tested locally, by `build:all`. If that matters more
later, the shape to add is a small verification matrix of native runners that
download the artifact and run nothing but the smoke test. (**Added
`2026-10-17`** — see "Verifying the packaged VSIX on every platform".)
