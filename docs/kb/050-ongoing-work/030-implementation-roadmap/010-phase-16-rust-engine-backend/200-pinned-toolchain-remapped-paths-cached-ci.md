---
summary: >-
  Rules: `rust-toolchain.toml` stays at the repo root; `--remap-path-prefix`
  makes builds identical across machines; CI caches cargo-xwin, zig
  (`engine/.toolchain/`) and `engine/target`.
---

# Pinned toolchain, remapped paths, cached CI (`2026-09-23`)

**The first CI run of the build matrix proved it works and proved the earlier
reproducibility claim too narrow.** All eight binaries built on
`ubuntu-latest` in `9m19s`, and every one differed from the local build —
`linux-x64-gnu` `6,164,416` bytes on the runner against `5,9xx,xxx` here.
Bit-identical *across rebuilds on one machine* had been established; identical
*across machines* had not, and the difference was the compiler version and the
absolute paths rustc bakes in.

Both are now closed:

- **`rust-toolchain.toml` at the repository root** pins the channel, the
  profile, `clippy`/`rustfmt` and all eight targets. **Root, not `engine/`,
  and that is load-bearing**: rustup resolves an override by walking up from
  the *current directory*, and the two ways cargo is invoked here start in
  different places — `build-addon.mjs` runs it with `engine/` as the cwd,
  while `engine:check`/`test`/`lint`/`fmt` run from the repository root with
  `--manifest-path`. Only a root file is found by both, so only a root file
  pins the build and the gate to one compiler. Verified: `rustc --version`
  reports the pin from both directories.
- **`--remap-path-prefix`**, added to `RUSTFLAGS` by `build-all.mjs`, replaces
  the checkout path and the cargo registry path with `/engine` and
  `/cargo/registry`. Without it `/home/zam/…` versus `/home/runner/work/…`
  ends up inside the artifact and no two machines can agree. The cost is that
  panics and backtraces name `/engine/...`; use a plain `engine:build` for
  anything to be debugged.

`rust-version` in `engine/Cargo.toml` is a different thing and stays: that is
the minimum the source supports, the toml is what it is built with. **Raising
the channel is a deliberate act** — do it alone, rebuild all eight, and expect
every hash to change.

**CI caches three things, because the run populates three unrelated ones.**
Measured locally: `~/.cache/cargo-xwin` is `1.2 GB` (the MSVC CRT and SDK that
cargo-xwin downloads for the Windows targets), the pinned zig is `350 MB`, and
`engine/target` reaches `1.8 GB` across eight targets. The first run pays for
all of it; nothing after should.

The zig install moved from `engine/target/toolchain/` to `engine/.toolchain/`
to make that possible: `Swatinem/rust-cache` owns `target/` and prunes it, and
a 350 MB download that only changes when the pin does has no business being
evicted by that.

**What the first run actually caught** is the argument for having run it:
`native-build.yml` had `corepack enable` but no `pnpm install`, so
`@napi-rs/cli` was missing and the build died in 28 seconds. It passed locally
only because `node_modules` was already on disk — exactly the class of defect
a first CI run exists to find, and one no amount of local testing would have
surfaced.
