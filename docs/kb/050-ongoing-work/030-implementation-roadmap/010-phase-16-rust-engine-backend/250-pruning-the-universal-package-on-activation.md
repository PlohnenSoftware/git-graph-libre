---
summary: >-
  The universal VSIX stays (platform VSIXs declined again with numbers on the
  table); `prune.ts` deletes foreign-platform binaries on Production
  activation under test-pinned rails (six directories since `2026-10-17`);
  signature verification is install-time, so no reinstall; musl-only Linux
  measured impossible with the zig dynamic build.
---

# Pruning the universal package on activation (`2026-10-16`)

**Updated (`2026-10-17`):** six platform directories now, not eight, and a
Linux host keeps its one directory — the gnu/musl pair is gone (see the
experiment record below). The rails are unchanged.

The universal VSIX (the 16.9 maintainer decision) installs eight engine
binaries, about 50 MB on disk, of which a host can load at most two. The
extension now deletes the others on activation
(`src/backend/engine/prune.ts`, wired Production-only in `activate()`).
The docs questions were checked first: VS Code has no post-install script
concept for extensions — the earliest extension code runs at activation —
and the Marketplace signature is verified when an extension is installed,
on the package, so removing unused files afterward triggers no
re-verification or reinstall; an update arrives as a fresh version
directory and the prune simply runs again. The sanctioned alternative,
platform-specific VSIXs (targets include `alpine-x64`/`alpine-arm64`, an
untargeted package is the fallback), was put to the maintainer with the
numbers and declined again in favor of the single file plus this prune.

Rails, each test-pinned: only the eight shipped directory names are
eligible; the loader's own candidate list is the keep set (Linux keeps
both libc builds of its architecture — the fallback is deliberate);
nothing is deleted unless a kept directory actually holds the binary;
all failures are swallowed. Production-only matters: a development host
runs from this repository, where the same path holds the developer's own
built binaries. A shared or portable extensions directory used from
another OS loses that side's binary and degrades to the CLI until the
next update — accepted and recorded here.

**Shipping musl-only for Linux does not work, measured.** The zig-built
musl binary is dynamically linked against `libc.so` (the musl soname);
on a glibc host that name resolves to glibc's text linker script and
`require()` fails with `/usr/lib/libc.so: invalid ELF header`, while the
gnu build loads (`engineVersion()` `1.0.25`). A fully static musl rebuild
could in principle dlopen under glibc, but two libcs in one process
(static TLS budget under Electron, musl's allocator in the engine's
parallel walks) would need its own parity and benchmark evidence to save
roughly one binary per Linux install; not pursued. The other route — one
binary that binds whichever C library the process already has — is
measured in the next record.
