---
summary: >-
  How `pnpm run bench:backends` works (`backends.bench.ts`, `GGL_BENCH_REPO`,
  `didEngineServeRead()`); `vitest bench` is gone in Vitest 5; the first
  results (`loadCommits` `0.7x`) were fixed in the sections above.
---

# Benchmarking the two backends (`2026-09-23`)

`pnpm run bench:backends` times the same reads through the engine and through
the `git` CLI. Both sides are `createRepoReader()` with the backend preference
flipped — the extension's own seam, not a reimplementation of it — so a
difference it shows is a difference a user would feel.

- The benchmark is TypeScript (`tests/backend/engine/backends.bench.ts`)
  because it drives that seam; `scripts/bench-backends.mjs` only esbuilds and
  runs it. **The bundle must be CJS and must land inside the project**: the
  addon loader resolves `engine/native/...` relative to `__dirname`, which ESM
  does not have, and dependencies stay external so Node has to be able to
  resolve `node_modules` from wherever the bundle sits.
- `vitest bench` was tried first and abandoned: **Vitest 5 no longer exports
  `bench`**, only the CLI subcommand. Do not re-propose it without checking
  that export exists.
- The fixture is generated with `git fast-import` — 2,000 commits, 40
  branches, 120 tags in about a second, and identical every run so two runs
  compare. `GGL_BENCH_REPO` points it at a real repository instead;
  `GGL_BENCH_COMMITS` and `GGL_BENCH_RUNS` size the synthetic one.
- **Every row reports whether the engine actually served it**, via
  `resetEngineServedRead()`/`didEngineServeRead()`. Without that a decline
  reads as a `1.0x` speedup, because both columns are then timing the same CLI
  code. A `CLI fallback` verdict is a correct outcome for a declined shape, not
  a measurement.

**First results, and two of them want explaining before anyone quotes this
phase's performance case.** On the 2,000-commit fixture, engine serving every
row:

| operation | git CLI | engine | |
| --- | ---: | ---: | ---: |
| remote url | `53.2` | `0.0` | `1785x` |
| commit details | `7.6` | `0.2` | `33x` |
| commit comparison | `6.6` | `0.4` | `16x` |
| loadRepoInfo | `60.7` | `59.0` | `1.0x` |
| view load | `71.1` | `71.7` | `1.0x` |
| loadCommits (300) | `11.7` | `12.7` | `0.9x` |
| loadCommits (1000) | `15.8` | `22.6` | **`0.7x`** |

The single-object reads land where upstream's numbers predicted. The two that
matter most to a user do not:

- **`loadRepoInfo` is a wash**, and the likely reason is that the engine path
  composes an engine payload with **CLI fills** (slice 16.7's user-config
  read, among others), so the CLI half sets the floor. `didEngineServeRead()`
  answers true for the read as a whole and cannot see that, which is a limit
  of the instrument worth remembering.
- **`loadCommits` is slower, and worsens with page size** — `0.9x` at 300,
  `0.7x` at 1000. Candidates: the topological re-ordering window, and
  serialising a page across the Node-API boundary as JSON. Neither is
  confirmed.

**Do not treat these as the verdict on Phase 16.** They are one synthetic
repository with no remotes on one machine, and the fixture is deliberately
uniform in a way real history is not. But `loadCommits` is *the* hot path this
phase exists for, so the `0.7x` is the first thing to chase before `1.7.0`
ships — measure against a real repository with `GGL_BENCH_REPO` first, since a
fixture with 40 branches and no remotes may be flattering the CLI.
