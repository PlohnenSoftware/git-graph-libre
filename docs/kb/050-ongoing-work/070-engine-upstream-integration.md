---
summary: >-
  Active integration of the November 8 engine review: six parallelizable slices
  for ref errors, bounded reads, traversal, encoding, gitlink content and remote
  ref classification, followed by provenance, versioning and full integration gates.
---

# Engine upstream integration (`2026-11-08`)

Status: in progress.

Maintainer request: integrate the recorded findings with parallel agents and
cost-effective models. Follow Multi-agent releases. This is maintenance work,
not authorization to publish a release. Integration branch: `main`; slice
branches: `engine-review/R01` through `R06`; worktrees under `/tmp/ggl-review-*`.
The existing review documentation is the integrator's own uncommitted work,
now recorded with this plan before dispatch.

## Decisions and scope

- Adapt only permitted native code from the reviewed commits; never read or
  copy restricted upstream host/webview or Gerrit code. Integrator updates
  `engine/NOTICE.md` and `LICENSE.mit` for adopted code and tests.
- Models: the maintainer asked for agents and models suited to each task,
  cost-effective rather than always the strongest, and that request
  authorizes these choices. Codex first dispatched R01 on GPT-6 Luna and R02
  and R03 on GPT-6.1 Sol. Those agents stopped after their claim commits when
  Codex hit its usage limit. Claude Code then took over as integrator the same
  evening and dispatched again in the same worktrees, cheapest first: R01 on
  Haiku, R02 and R03 on Sonnet. A slice moves up (Haiku, then Sonnet, then
  Opus) only when it fails or blocks on difficulty.
- Build output: `/tmp` is a 16 GB tmpfs, so each worktree's `engine/target`
  is a symlink to `/home/zam/Desktop/prog/_GGL/.ggl-review-targets/<id>`, a
  btrfs reflink copy of the main checkout's `debug` and
  `x86_64-unknown-linux-gnu` output. `.git/info/exclude` ignores those
  symlinks and the `node_modules` symlink. Delete a slice's target directory
  once its worktree is removed.
- R01 ref errors, R02 bounded reads and R03 traversal can start together.
  R04 encoding follows R03; R05 gitlink content follows R02; R06 remote-ref
  classification follows R01. Shared notices, manifest/version bumps and
  combined tests are the integrator's responsibility.
- Preserve CLI parity and the recorded engine non-goals. Do not take the
  stash-filter semantic change, redundant remote HEAD fix, regex search,
  dispatch or raw-byte exports. Include allocation improvements only where
  relevant to the changed traversal/ref code.
- Bound reads using the existing GGL Diff CLI 64 MiB limit as the common
  ceiling; enforce while reading disk files as well as by object header.
  Preserve the diff editor's smaller configured display limit.
- Author-date correctness must cover filtered and unfiltered walks. Measure
  larger history; do not substitute a bounded heuristic that drops commits.
  Lift topo fallback only after parity evidence. No gate may be weakened.
- Gitlink text is a diff-display representation; explicitly align both
  backends where necessary without misrepresenting raw Git blob semantics.
- R04 may add exact `encoding_rs = "=0.8.44"` (already in Cargo.lock); unsupported
  encodings must safely decline rather than silently corrupt text.

## Slices

| ID | Work | Status |
| --- | --- | --- |
| R01 | Ref failures | integrated `7ee2542` |
| R02 | Bounded reads | integrated `14ffe23` |
| R03 | Traversal correctness and allocations | integrated `ac2fec4` |
| R04 | Encoding and subjects | integrated `a0170ee` |
| R05 | Gitlink file content | integrated `8ca2f01` |
| R06 | Remote-ref classification and allocations | integrated `83cdd5d` |
| R07 | Remote-tag label order (found by R06) | integrated `288d48d` |
| R08 | CJK encodings against Git (R04 follow-up) | ready |
| R09 | Remove the topo decline surface (R03 follow-up) | integrated `66c29d6` |

## Integration acceptance

Every slice has regression coverage and relevant CLI parity. Rebuild the
addon before TS parity tests. Update notices, changelog, engine version and
expected-version contracts together. Run strict touched-file lint, package,
typecheck, full tests, localization checks, Rust fmt/clippy/check/tests,
coverage and SonarQube with explicit gate poll. Refresh KB index/check/graph.
Record genuine pre-existing failures separately; never silently call them
passed. No push or release publication in this integration.

## Integration log

- 2026-11-08: plan recorded; no implementation integrated yet.
- 2026-11-08: Codex stopped at its usage limit after the R01–R03 claim
  commits (`3681c5e`, `2a5af5b`, `73da4f4`), with no implementation.
  Claude Code (Opus) took over as integrator: R01 on Haiku, R02 and R03 on
  Sonnet, each in its existing worktree from its claim commit.
- 2026-11-08: R02 (Claude Sonnet) integrated at `14ffe23` and R01 (Claude
  Haiku) at `7ee2542`, both rebased onto `main` and fast-forwarded. Gates on
  `7ee2542`: `engine:fmt`, `engine:lint`, `engine:check` clean;
  `engine:test` 242 passed, 0 failed; `engine:build` and `engine:smoke`
  (`1.0.31`); `typecheck` clean; strict Biome on R02's four touched
  TypeScript files clean; `pnpm run test` backend 1,428 and webview 1,011
  passed; KB check clean. Provenance for `f007528` and `634ca6c` added to
  `engine/NOTICE.md`, `NOTICE.md` and `LICENSE.mit`. Coverage and SonarQube
  run at the end of the wave. R05 and R06 are ready.
- 2026-11-08: R05 dispatched on Claude Sonnet and R06 on Claude Haiku, both
  from `6f8bf0f` in the recycled worktrees `/tmp/ggl-review-r05` and
  `/tmp/ggl-review-r06`. R06 blocked before any code (`85738de`): its task
  also removed the `/tags/` classification, but W26J (maintainer,
  `2026-11-06`) keeps it on both backends, which the review's candidate 9
  predates. The integrator applied that recorded decision: R06 now removes
  only the `/changes/` filter and does the allocation cleanups, the `/tags/`
  classification stays, its Touch list adds
  `engine/native/core/tests/log_and_refs.rs` (whose
  `never_shows_code_review_change_refs` pins the old filter), and the review
  text is corrected. The same agent resumes R06.
- 2026-11-08: R05 (Claude Sonnet) integrated at `8ca2f01`. Its first report
  left one gap: when a submodule's commit exists in the superproject,
  `git show <rev>:<sub>` prints that commit on the CLI route. The
  integrator asked for parity, and the same agent closed the gap
  (`startsLikeCommitHeader`, so only commit-like output pays a second Git
  call). Gates on `8ca2f01`: engine fmt, clippy, check clean; engine tests
  247 passed, 0 failed (`vscode_fixtures` passes here, while R05's
  worktree saw an ENOENT); addon rebuilt, smoke `1.0.31`; typecheck clean;
  strict Biome on the five touched TypeScript files clean; `pnpm run test`
  backend 1,441 and webview 1,015 passed; KB check clean.
- 2026-11-08: R06 (Claude Haiku) integrated at `83cdd5d`. It removes only
  the engine's `/changes/` filter and replaces the test that pinned it, and
  its allocation cleanups change no behavior. Its TypeScript parity case
  found a pre-existing divergence in label order between the backends when a
  mirrored remote tag and a remote branch share a commit. That is recorded as
  R07, which waits on R03 because both edit `src/backend/engine/commits.ts`.
  Gates on `83cdd5d`: engine fmt, clippy, check clean; engine tests 251
  passed, 0 failed; addon rebuilt, smoke `1.0.31`; typecheck clean; strict
  Biome on `parity.test.ts` clean; `pnpm run test` backend 1,442 and webview
  1,015 passed; KB check clean.
- 2026-11-08: the R05 worktree and the integrated `engine-review/R02` and
  `engine-review/R05` branches were removed by something other than the
  integrator after R05 was integrated. Both branches were fully merged, so
  nothing was lost.
- 2026-11-08: R03 (Claude Sonnet) integrated at `9b5962c`, plus the
  integrator's `ac2fec4`: `reader.test.ts`, outside R03's Touch list, still
  pinned the topo decline R03 lifted. R03 fixes first-parent path filtering
  (`f007528`), seeds topo order newest tip first (`ff4aafe`), picks
  author-date pages from the whole history (`634ca6c`), prepares author
  patterns once, and serves `topo` from the engine after 1,224 of 1,224
  parity comparisons with `git log --topo-order` (new `log/ranked.rs`).
  Gates on `ac2fec4`: engine fmt, clippy, check clean; engine tests 265
  passed, 0 failed; addon rebuilt, smoke `1.0.31`; typecheck clean; strict
  Biome on the four touched TypeScript files clean; `pnpm run test` backend
  1,442 and webview 1,015 passed; KB check clean. R04 and R07 are ready.
- 2026-11-08: R04 dispatched on Claude Sonnet and R07 on Claude Haiku, both
  from `51908ec`. A SonarQube scan of `51908ec` (task
  `c12cb0a5-4a22-4b11-938d-8feb2b550b0a`) failed the gate on three
  reliability issues in R05's `startsLikeCommitHeader`; the integrator fixed
  them in `e4269db`. R07 blocked with evidence: the engine payload names a
  mirrored remote tag only `<remote>/<tag>`, so its mapper cannot reproduce
  the CLI's order. Its branch holds a red reproduction test (`5131007`) and
  is not integrated. R04's agent once ran `git stash pop` in its worktree;
  the stash list is shared, the pop of the maintainer's `stash@{0}` failed
  on a conflict, and the entry is intact.
- 2026-11-08: R04 (Claude Sonnet) integrated at `a0170ee`: commit text is
  decoded as Git prints it (`ff4aafe` `text.rs`), declining to the CLI where
  the decoding could differ. Then the engine moved to `1.0.32`
  (`engine/Cargo.toml`, `engine/package.json`, `Cargo.lock`,
  `EXPECTED_ENGINE_VERSION`) with CHANGELOG entries. Gates on the result:
  engine fmt, clippy, check clean; engine tests 281 passed, 0 failed; addon
  rebuilt, smoke `1.0.32`; typecheck clean; strict Biome on the touched
  TypeScript clean; `pnpm run test` backend 1,445 and webview 1,015 passed;
  `l10n:check` complete; `test:coverage` 187 files and 2,460 tests passed;
  SonarQube task `a33d8327-bdf4-4c90-a9f2-2ac93a2eb61e` on the working tree
  before the commit, gate `OK` (new coverage 94.2%, 0 new violations, 0
  reliability issues). Integrated so far: R01–R06. Nothing is pushed.
- 2026-11-08: R07 resumed as an engine change (invariant 3), with R08 and
  R09 added as follow-ups. All three are dispatched in parallel from
  `main`: R07 on Claude Sonnet in its existing worktree, rebased onto
  `main`; R08 and R09 on Claude Haiku in new worktrees.
- 2026-11-08: R09 (Claude Haiku) integrated at `66c29d6` by fast-forward:
  `topoOrdering` is gone outside `docs/` and `CHANGELOG.md`, and no
  telemetry declaration named it. Gates on `66c29d6`: typecheck clean;
  strict Biome on the four touched files clean; `l10n:check` complete;
  `pnpm run test` backend 1,445 and webview 1,014 passed (one route row
  removed).
- 2026-11-08: R07 integrated at `288d48d`. The first pass (Claude Haiku)
  proved the payload could not carry the CLI's order. The cleanup (Claude
  Sonnet, by the escalation rule) gives every tag its full `ref_name`
  (`refName` on the wire, kept inside `commits.ts`), and the mapper sorts a
  commit's labels by full ref name, as `for-each-ref` does. The red test
  `9d8880d` turned green with its assertions unchanged. Gates on
  `288d48d`: engine fmt, clippy, check clean; engine tests 282 passed, 0
  failed; addon rebuilt, smoke `1.0.32`; typecheck clean; strict Biome on
  the three touched files clean; `pnpm run test` backend 1,448 and webview
  1,014 passed; KB check clean.

## Follow-ups and notes for the maintainer

- **R07 was unblocked by a standing rule, not a new decision.** Its agent
  offered two options: an engine change that gives each tag its real ref
  name or owning remote, or accepting the divergence. Phase 16 invariant 3
  ("a divergence is an engine bug, not a test to relax") already chose the
  first, which is what was integrated.
- **R08** verifies the CJK and other unverified encodings R04 accepts
  against Git's iconv, and declines any that differ.
- **R09** removes the `topoOrdering` decline id and its route text, l10n
  strings and test row, which R03 made unreachable.
- **Cost of exact `author-date` and `topo` orderings (R03), integrated as
  the plan decided.** The plan required exact pages with no bounded
  heuristic, and the cost measured, so both orderings read the whole
  reachable history (headers only) before the first page. Release build,
  page of 100:
  - this repository (1,458 commits): 4 ms to 18 ms;
  - a generated 150,000-commit history: 1 ms to 614 ms, and 16 MB to 81 MB
    resident.
  `git log --author-date-order -n 100` takes 0.39 s there without a
  commit-graph, and git walks incrementally with one. The default ordering,
  `date`, is unaffected. A possible later enhancement, beyond the upstream
  finding: bound the walk with commit-graph generation numbers, as git
  does. If very large repositories need it before then, the maintainer can
  route these orderings to the CLI above a history size.
- **`/changes/` remote refs (R06), integrated as both reviews recommended.**
  The engine now lists them as remote branches, as the CLI always has. The
  filter had been kept for remotes with tens of thousands of code-review
  refs, which are rare in `refs/remotes`.
- **Pre-existing divergences R03 found, outside the upstream findings.** A
  filtered `date` walk is not re-ranked, so with skewed or equal committer
  clocks it can differ from `git log --date-order` with the same filter. On
  equal dates the engine passes tips as heads, remotes, stashes, while the
  CLI passes them in ref order. Both are engine bugs under invariant 3, for
  a later slice.
