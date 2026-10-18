---
summary: >-
  Superseded `2026-10-17` by one Linux binary per architecture. Recorded
  decision: ship eight platforms, adding `linux-x64-musl`/`linux-arm64-musl`,
  with `isMuslRuntime()` and ordered `platformDirectoriesFor()`; `linux-armhf`
  deliberately excluded; Windows still needs cargo-xwin.
---

# Alpine and the C library (`2026-09-23`)

**Superseded (`2026-10-17`): one Linux binary per architecture.** The musl
builds are gone. The glibc build is made loadable by musl when it is built
and ships as `linux-x64`/`linux-arm64`; `isMuslRuntime()` and the ordered
two-directory fallback are removed, and six platforms ship. See "Experiment:
one Linux binary for both C libraries" for the measurements. What follows is
the eight-platform decision as it stood.

**Eight platforms ship, not six.** `linux-x64-musl` and `linux-arm64-musl`
were added after establishing that the previous framing was wrong in a way
worth not repeating.

**The old claim, in three places, was that musl "has no prebuilt target" and
so "falls back to the CLI by construction".** That describes a mechanism that
never ran. `process.platform` is `"linux"` on Alpine exactly as on Debian, so
`platformDirectoryFor("linux", "x64")` returned `"linux-x64-gnu"` — a real
directory, with a real file in it. The load then failed at `require()`,
because a gnu binary needs `libc.so.6` and musl provides `libc.so`; the
`catch { continue }` swallowed it and the caller reached the CLI. The right
answer by the wrong route, documented as the wrong route, with no test over
the branch that actually ran.

**musl was never unbuildable.** zig ships musl libc, so both triples build
through the same cargo-zigbuild path as everything else — verified here in the
same run as the other six, and the binaries link `libc.so` rather than
`libc.so.6`, which is the whole difference.

What the loader does now:

- `isMuslRuntime()` reads `process.report.getReport().header.glibcVersionRuntime`,
  which is present on glibc and absent on musl. That is the check
  `detect-libc` makes and the only one available without spawning anything. An
  unreadable report is treated as glibc, the overwhelmingly commoner case.
- `platformDirectoriesFor()` returns an **ordered list**, not one directory:
  the detected C library first, the other as a fallback. A misdetection then
  costs one failed `require()` instead of silently dropping the platform to
  the CLI — the `catch` becomes a deliberate safety net rather than the
  primary mechanism.

Measured: all eight platforms in **75 seconds** on this machine, universal
VSIX **20.44 MB** (44 files) against **15.59 MB** for six — `+4.85 MB`, well
under the `+11 MB` the uncompressed binary sizes suggest.

**The remaining gap is deliberate and is one target: `linux-armhf`, 32-bit
ARM.** `vsce`'s own target list is the ceiling here — `win32-x64`,
`win32-arm64`, `linux-x64`, `linux-arm64`, `linux-armhf`, `alpine-x64`,
`alpine-arm64`, `darwin-x64`, `darwin-arm64`, and `web` — so there is no
PowerPC or RISC-V question to answer: VS Code does not run there. Eight of the
nine desktop targets carry an engine; armhf is a shrinking Raspberry Pi
niche (64-bit has been the Pi OS default since 2022), it is the one triple
whose zig route is untested here, and it runs on the CLI like any other
engine-less install.

**Why Windows still needs cargo-xwin, and zig cannot replace it.** `zig cc`
links Windows through the **MinGW** ABI (`*-pc-windows-gnu`), which is what a
standalone `.exe` wants. A `.node` is a DLL loaded into an MSVC-built
Electron, so it wants `*-pc-windows-msvc`, whose CRT and SDK import libraries
Microsoft does not redistribute in a form zig can bundle. napi-rs refuses the
combination outright: *"`cargo-xwin` only handles MSVC targets and the build
would fail at link time … `napi-build` additionally needs `libnode.dll` via
the `LIBNODE_PATH` environment variable"*. That `libnode.dll` requirement is
the real blocker and is specific to addons — do not re-propose dropping
cargo-xwin on the strength of a project that builds executables.
