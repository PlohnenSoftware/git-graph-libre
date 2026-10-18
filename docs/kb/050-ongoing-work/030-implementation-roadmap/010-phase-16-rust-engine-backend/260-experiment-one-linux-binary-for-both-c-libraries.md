---
summary: >-
  Done: the musl route fails (glibc floor 2.33; x86_64 binds glibc's oldest
  ABI, `realpath` silently empties `submodules`); the gnu route works — a Rust
  `gnu_get_libc_version` (`RTLD_NEXT`) plus dropping only the `ld-linux`
  `DT_NEEDED` (`elf.mjs`, asserted by `build-addon.mjs`) loads on glibc ≥ 2.28
  and musl with identical parity; the gnu/musl pair is removed,
  `linux-x64`/`linux-arm64` ship. Also: engine memory is allocator retention,
  macOS/Windows relinks are not reproducible, macOS embeds the checkout path.
---

# Experiment: one Linux binary for both C libraries (`2026-10-16`)

**Status: done. The musl route (`2026-10-16`) is not viable — verdict
below. The gnu route (`2026-10-17`, at the end of this record) found a
single Linux binary that works on both C libraries; it is wired into the
build on `feat/engine-linux-libc-neutral`, and the gnu/musl pair is
removed — one Linux binary per architecture ships.**
The maintainer asked whether one Linux binary could replace the
`linux-<arch>-gnu`/`linux-<arch>-musl` pair by using whichever C library is
already loaded in the host process, and asked for it to be built anyway and
compared for stability. It works, and is as fast and as stable as either
build — but it raises the glibc floor from 2.28 to 2.33 on both
architectures, and on x86_64 it silently runs a few calls against glibc's
pre-2003 ABI, one of which (`realpath`) is already measurably wrong. Both
costs are invisible to the project's own test suite. The saving is one
binary per architecture — about 5–6 MB on disk after the activation prune,
and roughly 2.4 MB of VSIX per architecture (adding the two musl builds cost
`+4.85 MB`, see "Alpine and the C library"). The conclusion is at the end of
this record.

**Why the obvious versions cannot work (reasoning, kept for the next
person who asks).** An addon is a library `dlopen`ed into a process that
already has a C library, so it has to use that one; it cannot bring its own.
A *dynamically* linked musl build in a musl Node shares Node's musl exactly
as a gnu build shares glibc — that is why the pair works. A *statically*
linked musl inside the `.node` would put two C libraries in one process (two
allocators, two thread implementations, musl reading glibc's thread
pointer) and was not built. The variant tested here is the third shape: the
musl build with its C-library dependency removed, so every libc import
resolves by name against whatever the host loaded.

**How it was built and run.** Engine `1.0.25` at `8abfb17`.
`x86_64-unknown-linux-gnu` and `x86_64-unknown-linux-musl` built exactly as
`build-all.mjs` does (pinned zig `0.14.1`, `--cross-compile`, release,
remapped paths) but into session scratch, then `patchelf --remove-needed
libc.so` on a copy of the musl binary — the *universal* variant. Nothing was
written under `engine/native/`; the project test suite saw the variant
through `bwrap --ro-bind` over `engine/native/linux-x64-gnu`. All three
binaries are `BIND_NOW`, so an unresolvable symbol fails at `require()` —
where the loader's fallback catches it — never mid-read. Two practical
notes: the pinned-zig symlink `engine/.toolchain/zig-0.14.1` still points
at the pre-rename checkout path `…/prog/GGL/…` and is dangling (the build
used `engine/.toolchain/venv/.../ziglang` directly; not fixed here), and the
agent sandbox's `/tmp` is invisible to Docker and podman, so container runs
received their inputs through a Docker volume filled by `tar`.

**Load matrix** (each image's own Node: `require()` then `engineVersion()`):

| host C library | gnu | musl | universal |
| --- | --- | --- | --- |
| glibc 2.28 (Debian 10, `node:18-buster-slim`) | loads | `libc.so: cannot open shared object file` | `undefined symbol: posix_spawn_file_actions_addchdir_np` |
| glibc 2.31 (Debian 11, `node:22-bullseye-slim`) | loads | same | `undefined symbol: fstat` |
| glibc 2.36 (Debian 12, `node:24-bookworm-slim`) | loads | same | loads |
| glibc 2.44 (this machine, Node 26) | loads | `/usr/lib/libc.so: invalid ELF header` | loads |
| musl (Alpine, `node:24-alpine`) | `ld-linux-x86-64.so.2` not found | loads | loads |

**Finding 1 — the glibc floor rises from 2.28 to 2.33.** The musl-flavored
standard library imports `stat`/`fstat`/`lstat` as real functions, which
glibc exports only from 2.33, and `posix_spawn_file_actions_addchdir_np`
(2.29). The zig gnu build's floor is `GLIBC_2.28`, exactly VS Code's own
minimum, so the universal binary would move Debian 10 and 11, Ubuntu
20.04 and RHEL 8 hosts from the engine to the CLI.

**Finding 2 — unversioned imports bind to glibc's oldest ABI.** A musl
build carries no symbol versions, and glibc binds such a reference to the
symbol's `GLIBC_2.2.5` (x86_64 base) version when one exists, otherwise to
its single default version. Of the 115 libc imports, four land on code that
differs from the default — checked by symbol address in the host's
`libc.so.6`/`libm.so.6` 2.44; the `clock_*` (librt, merged in 2.17) and
pthread/`dl*` (merged in 2.34) doubles are aliases of the same code:

- `realpath` binds `__old_realpath`, which rejects a NULL buffer with
  `EINVAL`, and `std::fs::canonicalize` passes NULL. **Measured:** the
  `submodules` export returns `[]` instead of the initialized submodule,
  because `submodule_root` in `engine/native/core/src/config.rs` turns the
  error into `None` — a silent wrong answer, no error, no crash. It is
  latent today only because the TypeScript finds submodules from
  `.gitmodules` and never calls that export; any `canonicalize` reached in
  future inherits it, on glibc only.
- `posix_spawnp` binds the pre-2.15 compat version, which retries through
  `/bin/sh` on `ENOEXEC`.
- `memcpy` binds the old `memmove` alias (a strict superset; harmless).
- `pow` binds the SVID-compat wrapper (same values).

Predicted and refuted: `sched_getaffinity`'s old two-argument `2.3.3` form
looked like a crash in `available_parallelism()` (gix's `parallel` feature
is on). Its oldest version is not `2.2.5`, so it binds the default, and
`strace` in Debian 12 shows the identical `sched_getaffinity(0, 128, …) =
16` from both builds.

**Parity — the universal binary agrees everywhere except Finding 2.** The
harness calls the engine directly (no loader, so no CLI can mask a
failure): every wired export plus the unwired `submodules`, `repoRoot`,
`authorStats`, bodies, summaries, tag details and `countCommitsBefore`;
four `loadCommits` shapes (300, 5000 with Author Date, first-parent,
no remotes/tags), an author filter, three searches, details, line counts
and file content for 65 commits per repository, range and work-tree
comparisons, uncommitted details and counts, both stashes and their
details, and four error paths (missing, a file, not a repository, an
unreadable directory). 578 calls over three repositories: a built fixture
(50 commits, initialized submodule, two stashes one with untracked files, a
rename, binary files, annotated and lightweight tags, a remote, a dirty
tree), gitoxide (16,996 commits) and git.git (82,448). Output is
normalized only for the uncommitted row's wall-clock date and for
`authorStats`' order among equal counts.

- glibc 2.44 host and Debian 12: universal equals gnu except `submodules`.
- Alpine: universal equals musl, and equals Debian 12's gnu output.

**The project's own suite agrees, and missed Finding 2.**
`vitest run --project backend` with the variant overlaid as `linux-x64-gnu`
and the musl directory emptied: universal **747/747 passed, 0 skipped**;
a fresh gnu control the same; with no engine at all, 721 passed and 26
skipped — so a skip count of zero is real evidence the binary served. No
wired read calls `submodules`, so the suite could not see the `realpath`
binding.

**Speed — no difference.** Median of 15 per operation, two A-B-B-A passes,
glibc 2.44 host: universal/gnu ratios `0.99`–`1.04` on every operation on
both large repositories (git.git `loadCommits` 5000 `116.7` vs `117.9` ms,
search `592` vs `606` ms, `authors` `460` vs `471` ms). On glibc the
universal binary allocates through glibc's `malloc`, so musl's slow
allocator never enters.

**Stability, first pass.** 90 seconds each on the host, 20 concurrent
mixed reads per iteration over all three repositories, every handle closed
every 10 iterations: gnu 8,480 calls and universal 7,700, **zero errors and
no crash in either**, RSS peaking at 1,405 and 1,329 MB. That pass picked
its repository at random, so its counts are not a throughput comparison.

**Stability, seeded.** The same load with a seeded job sequence, so both
binaries run identical work; 60 seconds each in A-B-B-A order: gnu 256 and
246 iterations, universal 244 and 244 (20 calls per iteration; 19,800
calls in all). Zero errors and no crash in any pass; RSS peaked at 1,272 and
1,274 MB for gnu and 1,227 and 1,239 MB for universal. The universal
binary's ~3% lower throughput sits inside gnu's own 4% spread between its
two passes, so it is not distinguishable from noise at this length.

**Inside Electron — the extension host's runtime.** The same harness under
the system Electron `43.7.11` run as Node (`ELECTRON_RUN_AS_NODE=1`, Node
`24.21.0`, glibc 2.44). Parity: universal equals gnu except `submodules`,
and Electron's gnu output is byte-identical to plain Node's. Seeded stress,
45 seconds each in A-B-B-A order: gnu 140 and 143 iterations, universal 140
and 140, zero errors, RSS peaking at 258–261 MB for both.

**In Electron neither C library allocates for the engine.** `LD_DEBUG=bindings`
shows both builds' `malloc`, `free`, `calloc` and `realloc` binding to the
`electron` executable itself — Chromium's allocator shim — while under plain
Node they bind to `libc.so.6`. So on desktop VS Code the "musl's allocator in
the engine's parallel walks" worry from the pruning record never arises, for
either build. It does arise for the VS Code Server on Alpine, which runs
plain Node: there the musl and universal builds are the same code and both
use musl's allocator — exactly what ships today.

**Alpine — musl against universal.** Per-operation medians (10 runs, two
A-B-B-A passes, `node:24-alpine`) match: the walks (`authors`, search,
`loadCommits`, status) within 2% either way on both large repositories;
the short reads within 12% either way (git.git `loadRepoInfo` `9.8` vs
`10.6` ms, gitoxide's `0.33` vs `0.30` ms). Stress, 45 seconds each, zero
errors in all eight passes: A-B-B-A gave musl 105/106 against universal
120/120, which looked like a 13% gap, so the order was reversed — B-A-A-B
gave universal 110/104 against musl 119/103. Every pass of either build
lands between 103 and 120 iterations; it is run-to-run noise, not the
binary. **Correction (`2026-10-17`):** these Alpine passes were *not*
seeded — the Docker volume still held the harness from before the seed
was added — so each pass drew its own random job mix, which accounts for
much of that spread; the seeded rerun is in the follow-up below. Alpine's
`node` exports no allocator (`U malloc`), so both builds use musl's there.

**arm64 — predicted, not run.** No arm64 emulator is set up on this
machine, so the arm64 builds (same build path; the zig gnu build's floor is
`GLIBC_2.28` there too) were checked statically. The check is a script that
applies glibc's binding rule — the base-index version if one exists, else
the single default — to the variant's imports against a given glibc's
`libc`, `libm`, `libpthread`, `libdl` and `ld.so`. It was validated on
x86_64 first: it predicts exactly the observed load matrix (2.28 and 2.31
fail on the symbols Node reported, 2.36 and 2.44 load) and exactly the four
differing bindings found by address. Against arm64 glibc from
`node:18-buster-slim` and `node:24-bookworm-slim`:

- **Finding 1 holds on arm64:** glibc 2.28 cannot resolve `stat`, `fstat`,
  `lstat` or `posix_spawn_file_actions_addchdir_np`.
- **Finding 2 almost vanishes on arm64.** glibc's aarch64 ABI begins at
  `GLIBC_2.17`, with no older compatibility layer, so `realpath`,
  `posix_spawnp` and `memcpy` bind their current versions; only `pow`
  lands on its SVID-compat wrapper (same values). Finding 2 is an x86_64
  problem, because only x86_64 carries glibc's original 2002
  (`GLIBC_2.2.5`) ABI.

Incidental, in both builds and unrelated to the C library:

- `authorStats` orders authors with equal counts differently between two
  runs of the same binary (hash-map order). It is unwired today.
- **The engine's memory is allocator retention, not a leak.** Under plain
  Node the concurrent stress drives RSS to 1.2–1.4 GB and it stays at
  1.1–1.3 GB after `closeAllRepositories()`. The identical load inside
  Electron, whose allocator shim serves the engine (above), peaks at about
  260 MB and returns to about 130 MB, its starting level. Same engine code,
  different allocator: the plateau is glibc `malloc` keeping freed memory
  across its per-thread arenas. Electron is what desktop users run, so the
  260 MB figure is the representative one; plain-Node hosts (VS Code Server,
  tests, the benchmark) see the larger number.
- **A locally built `linux-x64-gnu` has a much higher glibc floor than a
  released one.** `pnpm run build` builds the host triple with the system
  linker (no `--cross-compile`), and the binary it left in
  `engine/native/linux-x64-gnu` on this machine needs `GLIBC_2.39`; the zig
  build `build-all.mjs` and CI use needs `GLIBC_2.28`. Harmless for
  installing on the machine that built it, but a VSIX packaged from such a
  tree and handed to anyone on glibc < 2.39 runs on the CLI. Release only
  from `build:all` output, as the release path already does.

**Conclusion.** Every runtime measurement favors the universal binary or
ties: identical output apart from `submodules` across 578 calls on three
hosts and inside Electron, the 747-test suite green with no skips, speed within noise, zero
errors in about 65,000 concurrent calls (about 32,000 of them on the
universal binary), and in Electron not even the allocator differs. What
rules it out is how it can break, not how it ran:

1. It drops the engine on glibc 2.28–2.32 hosts — Debian 10 and 11,
   Ubuntu 20.04, RHEL 8 — that the gnu build serves today. The cause is
   the musl-target standard library's imports, which this project cannot
   change short of patching `std`.
2. On x86_64 it runs some calls against glibc's oldest ABI, and nothing
   enforces which ones: any new import that happens to have a
   `GLIBC_2.2.5` compat version changes meaning silently. `realpath` shows
   the shape — a wrong answer, not an error — and the project's suite
   passed 747/747 while it was wrong, because no wired read reaches it.
3. It depends on a post-link `patchelf` edit that no toolchain supports, so
   a toolchain or dependency bump can change the binding set with nothing
   to say so.

So the pair stays. Re-examine only if the glibc floor stops mattering
(VS Code raising its own minimum to 2.33 or above) *and* the x86_64
binding check becomes part of the build — the method above then answers the
question again.

**Tooling — not kept in the repository.** Nothing was committed. The build
script (the `build-all.mjs` path with an output directory), the harness
(`parity`, `stress` with a seeded job sequence, `bench`; bundled with
esbuild against `src/backend/engine/*`'s real option builders and calling
the addon directly), the normalizer and the binding-model script lived in
the agent session's temporary scratch directory and go with it. Docker
state left on the machine: the `ggl-libc-exp` volume (512 MB: binaries,
harness, fixture clones; `docker volume rm ggl-libc-exp` removes it) and
the `node:18-buster-slim`, `node:22-bullseye-slim`, `node:24-bookworm-slim`
and `node:24-alpine` images.

**Follow-up (`2026-10-17`): the gnu build as the universal binary.** The maintainer's next question: the gnu build works on old glibc,
so would the same `patchelf` treatment of *it* work everywhere? The premise
is sound in a way the musl route's is not — a gnu build carries symbol
versions (`DT_VERNEED`: `libc.so.6` up to `GLIBC_2.28`, `libpthread.so.0`
`GLIBC_2.12`, `libdl.so.2`, `libm.so.6`, `ld-linux-x86-64.so.2` `GLIBC_2.3`),
so glibc keeps binding every import to the version it was built against:
no Finding 1 floor, no Finding 2 compat code. Same zig gnu build as above.

- **Variant 1 — every `DT_NEEDED` removed: fatal on modern hosts.** It loads
  on Debian 10, 11 and 12 (their official Node builds load `libpthread` and
  `libdl`), but on this machine's Node 26 and Electron 43 — glibc 2.44, where
  `libpthread`/`libdl` merged into libc in 2.34 and nothing loads them —
  `require()` never returns: `Inconsistency detected by ld.so:
  dl-version.c: 204: _dl_check_map_versions: Assertion 'needed != NULL'
  failed!`, exit code `127`, the surrounding `try`/`catch` never runs. A
  version need naming a file absent from the process aborts the whole
  process, so in VS Code it would kill the extension host rather than fall
  back. Ruled out.
- **Variant 2 — only `ld-linux-x86-64.so.2` removed.** musl's dynamic linker
  treats `libc.so*`, `libm.so*`, `libpthread.so*`, `libdl.so*` (and `librt`,
  `libutil`, `libxnet`) as names for itself, so the unpatched gnu build was
  refused on Alpine solely for `ld-linux-x86-64.so.2`; glibc always has that
  one loaded (it is the loader), so dropping only it keeps glibc's version
  checks satisfied. Loads on glibc 2.28, 2.31, 2.36 and 2.44 and in
  Electron, with versioned bindings intact (`LD_DEBUG`: `realpath
  [GLIBC_2.3]`, `memcpy [GLIBC_2.14]`, `__tls_get_addr` from `ld.so`). On
  Alpine it is refused with `Error relocating …: gnu_get_libc_version:
  symbol not found`.
- **What musl lacks is one symbol.** Comparing the 121 non-napi imports
  with `node:24-alpine`'s musl exports: `lseek64`, `mmap64`, `open64`,
  `pread64`, `readdir64` and the `__xstat64` family resolve through musl's
  built-in LFS64 renaming (musl ≥ 1.2.4 maps `foo64` to `foo` in the
  dynamic linker); four weak imports (`__cxa_thread_atexit_impl`,
  `pidfd_getpid`, `pidfd_spawnp`, `posix_spawn_file_actions_addchdir`) may
  stay null and `std` checks for that; the only strong gap is
  `gnu_get_libc_version`. The gnu-target `std` calls it from exactly two
  places — process spawning (to decide whether `posix_spawn` is safe) and a
  DNS-failure path. The engine's own code spawns nothing, but gix runs
  `.gitattributes` filter drivers (git-lfs, say) through `std::process`
  when it computes status, so the call is reachable from a read. Measured
  with a fixture whose `*.txt` carry a `clean` filter and a modified file:
  under the plain gnu build `countUncommittedChanges` and
  `loadUncommittedDetails` ran the driver four times between them.
- **Variant 3 — variant 2 plus `gnu_get_libc_version` made a weak import:
  loads on Alpine, then segfaults.** A post-link edit of the one `.dynsym`
  entry's binding (`STB_GLOBAL` to `STB_WEAK`; `patchelf` has no option for
  it), so musl's loader leaves it null instead of refusing the library. On
  `node:24-alpine` it loads and serves `loadCommits`, then the first read
  that runs the filter driver ends the process: `Segmentation fault`, exit
  code `139`, the driver never started. Spawning calls the null pointer
  before it forks. In VS Code that is the extension host dying on any
  repository with a filter driver configured. Ruled out — and it is the
  general lesson of this follow-up: removing or weakening references only
  moves a glibc-only call from load time, where the loader's fallback
  catches it, to run time, where nothing does.
- **Variant 4 — variant 2 plus a linked-in `gnu_get_libc_version`: loads
  everywhere.** No longer `patchelf`-only: a 15-line C file, compiled with
  the pinned zig (`-target x86_64-linux-gnu.2.28`) and passed to the gnu
  build as `-C link-arg`, defines the function to return glibc's own answer
  (`dlsym(RTLD_DEFAULT, …)`) when the process has glibc and `"2.28"` when
  it does not. rustc's version script makes it local, so `std`'s reference
  resolves to it at link time and the import disappears; the floor stays
  `GLIBC_2.28`, the rest of the import list is unchanged, and
  `ld-linux-x86-64.so.2` is then dropped as in variant 2. Built in a
  separate cargo target directory so the repository's `engine/target` was
  not invalidated. It loads, and serves the filter-driver reads (count 1,
  `b.txt` modified, the driver run four times), on glibc 2.28, 2.31, 2.36
  and 2.44, inside Electron 43, and on Alpine — the first single binary in
  this experiment with no known failure.

**Variant 4 — parity and the suite.** The parity harness now also covers
the filter-driver fixture (608 calls over four repositories). Variant 4's
output is byte-identical to the gnu build's on this machine (glibc 2.44),
on Debian 12, on Debian 10 (glibc 2.28, VS Code's floor) and inside
Electron 43, and byte-identical to the musl build's on Alpine — including
`submodules`, since glibc now binds the current `realpath`. The backend
suite with variant 4 overlaid as `linux-x64-gnu` (musl directory emptied):
747/747 passed, 0 skipped.

**Variant 4 on musl — what the gnu-compiled code assumes.** On glibc the
binary *is* the gnu build (same versioned bindings), so the review is of
the 121 imports as musl will serve them on x86_64. Nothing found that
differs: `struct stat` through `__xstat64` → `__xstat` (kernel layout on
both), `dirent` through `readdir64`, `passwd`, `dl_phdr_info` and
`sigset_t` (128 bytes) share layouts; `posix_spawnattr_t` (336 bytes) and
`posix_spawn_file_actions_t` (80) match in size by musl's design, as do the
`POSIX_SPAWN_*` flag values; `pthread_rwlock_t`'s static initializer is all
zeros on both; `msghdr` differs only in padding, which musl zeroes before
the syscall; the `*64` calls are the 64-bit-offset calls either way;
musl's `realpath` accepts NULL. The shim's `"2.28"` answer sends `std` down
its `posix_spawn` path on musl, which is the path the filter-driver read
exercised. What this review cannot see is a future import — the same
class of risk as the musl route's Finding 2, but one-sided: a new
glibc-only symbol fails musl's *load* (caught, CLI fallback) unless it is
weak, and `std`'s weak imports are null-checked by construction.

**Variant 4 — speed and stability on glibc.** Median of 15 per operation,
two A-B-B-A passes against the gnu build on this machine: every walk
within `0.99`–`1.03` (git.git `loadCommits` 5000 `154.0` vs `153.6` ms,
search `775` vs `777` ms, `authors` `607` vs `603` ms); sub-millisecond reads
`0.93`–`1.09` in both directions. The machine was busier than during the
first benchmark (git.git `authors` `607` against `460` ms then), so compare
within a table, not across them. Seeded stress, A-B-B-A: Node 60 seconds
each, gnu 255 and 209 iterations against variant 4's 248 and 209; Electron
45 seconds each, 115 for all four passes; zero errors in 27,620 calls.
Expected — on glibc variant 4 runs the gnu build's code against the same
glibc functions, and the added function runs only when a process is
spawned.

**Wired into the build (`2026-10-17`, branch
`feat/engine-linux-libc-neutral`, not pushed).** The maintainer asked for
variant 4 in the repository. Two changes from the experiment's form, both
so nothing outside Rust and Node is involved:

- **The shim is Rust, not C** — `engine/native/node/src/glibc.rs`, compiled
  only under `cfg(all(target_os = "linux", target_env = "gnu"))`, so no C
  compiler, no `cc` crate, no new dependency. A `#[no_mangle] extern "C"
  fn gnu_get_libc_version` that asks `dlsym(RTLD_NEXT, …)` for glibc's own
  and answers `"2.28"` without one. Unlike the C object, rustc exports it
  from the cdylib, which changes nothing that matters: on glibc the
  standard library's call still reaches glibc's definition first, and the
  addon is loaded `RTLD_LOCAL`. Its unit test compares the answer with
  `confstr(_CS_GNU_LIBC_VERSION)`, glibc's version by another route.
  **That test caught a real flaw on its first run.** The first version asked
  `dlsym(RTLD_DEFAULT, …)` and fell back to the floor when the lookup
  returned the shim itself; in the test executable it answered `2.28` on
  glibc 2.44, because an executable exports a symbol that a shared library
  (here libc) also defines, so the global lookup found the shim first. The
  addon loaded `RTLD_LOCAL` never hits that, but a host loading it
  `RTLD_GLOBAL` would have. `RTLD_NEXT` — the next definition after the
  calling object, `(void *)-1` on both C libraries — is the right primitive:
  glibc's own however the addon is loaded, nothing on musl.
- **The post-link step is Node, not `patchelf`** — `engine/scripts/elf.mjs`,
  a dependency-free reader/editor for 64-bit little-endian ELF (the
  `DT_NEEDED` list through the dynamic segment, undefined symbols through
  `.dynsym`), unit-tested in `tests/backend/engine/elf.test.ts` against a
  synthetic shared object built in the test. Checked against the real
  binary before use: the same 164 undefined symbols `readelf` lists, and a
  removal byte-identical to `patchelf --remove-needed`'s.
  `build-addon.mjs`'s `makeLoadableByMusl` runs it on every `*-linux-gnu`
  artifact (host and cross builds alike) before placing it, then asserts
  the two properties — no glibc-loader `DT_NEEDED`, no
  `gnu_get_libc_version` import — and fails the build otherwise, so a
  toolchain or dependency change cannot quietly undo either.

The musl builds, the loader and the package are unchanged: musl hosts still
try the musl binary first, and the gnu binary is now a working fallback
there instead of a certain `require()` failure. Whether to drop the musl
builds is a separate packaging decision, not made here — it was made the
same day; see "The pair removed" below.

**Line numbers are part of the binary.** The first full rebuild after the
change changed all eight hashes — macOS, Windows and musl included —
although the module is compiled out there. The `mod glibc;` declaration
sat near the top of `lib.rs` and moved everything below it down four
lines, and rustc embeds file/line/column for panic locations
(`#[track_caller]`, `unwrap`, `expect`). Declaring the module at the end of
the file leaves every existing line where it was. A change meant to leave
other platforms untouched has to leave line numbers untouched too, or its
"no change" can only be argued, not shown by hash. With the declaration
last, both musl binaries rebuild byte-identical to the baseline, and the
macOS and Windows ones differ from a same-checkout `HEAD` build only in the
relink fields below (UUID and its signature page hash; the PE and
debug-directory timestamps, whose second byte also moves when two links
are minutes apart) — their code is unchanged.

**macOS and Windows builds are not bit-reproducible on a relink —
correcting "One build path, runnable anywhere".** Forcing a relink of
*unchanged* source (`touch lib.rs`) changes `darwin-x64` in 16 bytes at
offset 2177 (a new random `LC_UUID`), `darwin-arm64` in 48 (that UUID plus
one 32-byte page hash in its ad-hoc code signature), and the two Windows
builds in 10–12 (link timestamps in the PE header and debug directory).
The earlier "bit-identical across two full runs" was almost certainly a
second run cargo served from cache without relinking. Comparing these
builds therefore means comparing everywhere *except* those fields.

**The macOS binaries embed the building checkout's absolute path.** A
Mach-O dylib carries its install name (`LC_ID_DYLIB`), and the linker sets
it to the output path —
`/home/zam/Desktop/prog/_GGL/git-graph-libre/engine/target/x86_64-apple-darwin/release/deps/libgit_graph_node.dylib`
in a build on this machine, `/home/runner/work/…` from CI.
`--remap-path-prefix` cannot reach it: rustc remaps the paths *it* embeds,
and this one is written by the linker. So the shipped macOS binaries name
the builder's home directory, and no two checkouts produce the same macOS
bytes — which also contradicts "Pinned toolchain, remapped paths"'s
identical-across-machines claim for these two targets. Not fixed here;
the fix is to give the dylib a fixed install name at link time (for
example `-C link-arg=-Wl,-install_name,@rpath/git-graph.node` for the
Apple targets — an addon is loaded by path, so nothing reads the install
name), then re-verify that both macOS builds still load.

**The production binary on the matrix.** `engine/native/linux-x64-gnu`
from `build:all` with the Rust shim: loads, and serves the filter-driver
read, on glibc 2.28, 2.31, 2.36 and 2.44, inside Electron 43 and on Alpine;
608-call parity identical to the gnu build on this machine, inside Electron
and on Debian 10, and to the musl build on Alpine. Both production Linux
gnu binaries keep the `GLIBC_2.28` floor and define rather than import
`gnu_get_libc_version`; checked statically against Alpine's musl exports
for both architectures, with the same check that predicted every observed
x86_64 load result, neither has a strong import musl lacks. arm64 never
had an `ld-linux-aarch64.so.1` entry to remove — its TLS goes through TLS
descriptors, not `__tls_get_addr` — and `makeLoadableByMusl` reports
removing nothing there, as it should.

**Gate for the wiring (`2026-10-17`).** Rust arm: `engine:check`,
`engine:test` (12 suites, the shim's test included), `engine:lint`,
`engine:fmt`. Strict Biome on the touched TypeScript, `pnpm run package`,
`pnpm run test` (backend 755, webview 548), `l10n:check`, fresh
`test:coverage`, `sonar:scan`. The first scan's gate was `ERROR` on one
issue this work did not touch: `loadCommits` in `src/webview/graph.ts` at
cognitive complexity 16 against 15, introduced by the unpushed `23d50cd`
(its `setParentBeyondGraph` branch). With the maintainer's approval the
parent-linking loop moved into a private `linkVertices`, unchanged, as its
own commit; the rescan (task `a33d1ecf-7e0d-4f98-98b5-61bcb3b27da7`) is
`OK`. A packaged VSIX of this state
(`git-graph-libre-1.8.1-libc-neutral-universal.vsix`, all eight binaries)
and a test one without the musl builds
(`git-graph-libre-1.8.1-linux-all-in-one-test.vsix`) were handed to the
maintainer for testing; the binary inside both was re-verified on the full
matrix, and its 608-call parity is identical to gnu on this machine and to
musl on Alpine.

**The pair removed (`2026-10-17`, same branch, not pushed).** The maintainer
then asked to stop building the gnu/musl pair altogether and keep only the
universal binary. Six platforms ship: `build-all.mjs` and `build-addon.mjs`
drop both musl triples, `rust-toolchain.toml` stops installing them, and the
Linux directories are renamed `linux-x64` and `linux-arm64` (VS Code's own
target names, and the `darwin-x64` pattern) since a `-gnu` suffix would now
mislead. The loader's platform map is one table:
`platformDirectoriesFor(platform, arch)` loses its musl argument and
`isMuslRuntime()` — a `process.report` call on every activation — is
deleted, as are its two tests and the musl rows of the mapping table; the
load-status tests keep the ranking cases, now across a directory's two
candidate locations. The prune keeps one Linux directory, `publish.yml`
asserts six binaries, README and CHANGELOG say one Linux build serves glibc
and musl. The rebuilt `linux-x64`/`linux-arm64` binaries are byte-identical
to the ones verified on the matrix (`95ac76e2…`, `a37dbf63…`) — only their
directory names changed. The universal package is 13.07 MB against 17.06 MB
with the musl builds. Gates: Rust arm; strict Biome on the nine touched
TypeScript files (and Biome's formatter applied to `webviewPanel.test.ts`,
whose import block had drifted); `package`; tests (backend 751 — four
libc-detection cases fewer — and webview 548, none skipped); `l10n:check`;
coverage; SonarQube `OK` (task `ef581620-bf04-4cd2-b928-7489ea7429a1`). Any
old `engine/native/linux-*-gnu` or `linux-*-musl` directory in a working
tree is now stale and must be deleted before packaging locally, because
`.vscodeignore` ships every `engine/native/*/*.node`.
