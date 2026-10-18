---
summary: >-
  `2026-09-22` recommendation: do not adopt wholesale (no reflog, unreachable
  commits, signature status or glob patterns; six-triple build cost); a
  bounded opt-in experiment proposed, which Phase 16 later pursued.
---

# Should the engine be adopted? Not wholesale

The engine is good work — roughly 4,800 lines with its own 3,700-line `cargo
test` suite, a deliberate "one type, one file" library facade in `api.rs`, and
the lane layout left in the webview (so it is *not* a port of mhutchie's
`graph.ts`). Their measured numbers, on a 10,000-commit synthetic repository:
view load `429.7 ms` → `96.5 ms`, `getCommitDetails` `125.7 ms` → `0.7 ms`,
`getConfig` `69.6 ms` → `0.1 ms`. The gap is the process-spawn floor
(~40–70 ms per `git` on Windows) and it does not shrink as repositories grow.

**The costs land badly for this project, and the decisive one is feature
coverage, not effort.** The three things that distinguish this fork are
exactly what the engine declines:

- `repository.includeReflog` → the engine answers `Unsupported` for reflog
  tips and falls back to the CLI.
- `repository.includeUnreachableCommits` (`git fsck --unreachable`) → **no
  equivalent at all**.
- Signature status → the engine reads signature *presence* only and leaves
  engine-only installations at status `E`. The `1.2.0` `parseGpgsigPresence`
  work, which distinguishes genuinely unsigned from SSH-signed-but-unverifiable,
  has no counterpart.
- `customBranchGlobPatterns` → `--glob=` is declined.
- The staging panel and every write stay on the CLI regardless; gix has no
  `push`.

The one clean fit is stashes: their `GitStash.base_hash` maps onto this
project's `sourceHash`.

Against that: six target triples each needing their own link environment (MSVC
plus the Windows SDK, a separate ARM64 CRT, `cargo-xwin`, `cargo-zigbuild` and
zig, Xcode — see their `docs/DEPENDENCIES.md`), per-platform VSIXs where there
is now one `263 KB` artifact from one job, a second quality-gate toolchain that
`sonar.sources` and Biome do not cover, and a dual-backend architecture whose
two implementations must be proven to agree. **Nothing in the roadmap or the
bug backlog reports the graph as slow.**

**Recommendation on record: do not adopt wholesale.** If the performance is
ever wanted, the proportionate route is a bounded experiment — vendor the
engine minus Gerrit behind this project's own seam for `loadRepoInfo`,
`loadCommits` and `commitDetails` only, keep `gitRunner` as the sole path for
reflog, unreachable commits, signature verification, glob patterns and every
write, ship it off by default on one platform, and measure before committing
to the build matrix.
