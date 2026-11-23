---
summary: >-
  F1-09F: Wires the Reflog tab's two assembly sites to F1-09's
  engine-first reader (live `backend` setting and repository
  verification), so the tab actually serves reflog reads from the engine
  instead of staying on the CLI. The W10F shape; no visible change.
---

# F1-09F — Wire the Reflog tab to the engine reader

Status: integrated `10a2c006`

Needs: F1-09

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`070-history/230-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
for this slice's detailed design and the facts it marks [verify]; the Webview
UI Styling Guide (Reference) when the slice touches the webview; the Phase 16
invariants and non-goals when it touches the engine.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy Git Graph+ code (read it only if the slice says so,
and then describe rather than copy). Tests ship with behavior, using real-Git
fixtures in temporary directories only. Strict Biome on touched files, no
`var`, American English, OKLCH colors through `--ngg-*` tokens with VS Code
theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: if a
telemetry chokepoint would count something new or a declaration must change,
stop and report. Do not bump versions or edit CHANGELOG, README or notices;
the integrator does. Report Sonar: integrator.

Opened at F1-09's integration (`2026-11-09`): F1-09 built the engine-first
reader `readReflog` and taught `createReflogSource` to forward optional
`backend` and `isVerified`, but the only sites that hold the live values
are outside F1-09's Touch list, so the tab still reads every page on the
CLI. This is the W10 → W10F shape from release 1.10.0. F1-09's Report
(Deviations) names the two sites and the exact deps; start there.

## Touch

`src/extension/messageHandler.ts` (the default `openReflog` assembly);
`src/extension/commandManager.ts` (its `openReflog`, which holds no
verification dep today); `src/extension.ts` only if the dep must be
threaded from there (an `openReflogTab` assembly like `openScmDiffTab`'s
is the in-house shape); `src/extension/reflogTab/reflogData.ts` only if
its deps shape must change; tests for the touched files; the slice file's
Status and Report. Another agent works F1-04F beside you on the reflog
webview, panel and bundles: do not touch `src/webview/reflogTab/*`,
`src/extension/reflogTab/reflogTabPanel.ts`, `src/reflogTabTypes.ts`,
`media/reflog-tab/*` or the l10n bundles.

## Task and acceptance

- Both assembly sites pass the live values into `createReflogSource`:
  the `backend` setting read per call (messageHandler's live `config`,
  as the graph reader does) and `isVerified` from the repository search
  (`repoSearch.isVerified(repo)` in F1-09's words — verify the live
  names in code). A repository Git has not accepted is never served by
  the engine, exactly as the other reads guarantee.
- Behavior is invisible: with `backend: "git-cli"`, an unverified
  repository, or a binary without the optional export, every page is
  the CLI's, byte for byte as before F1-09; with the engine allowed and
  verified, the parity suites of F1-09 already prove identical results.
- Tests pin the routing at the assembly level: the engine route is
  offered the read when the setting allows and the repository is
  verified; it is not offered when the setting is `git-cli` or the
  repository is unverified (the F1-09 reader's own declines are already
  pinned; do not re-prove them).
- No new telemetry: F1-09 found the worktree-listing precedent (no
  flag touched). If wiring changes that, stop and report.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-09 04:06
- **Branch and commits:** `reflog/F1-09F` — `fe6543e0 G docs(kb): claim slice F1-09F (F1-09F)`; `540dd64c G feat(reflog): wire the tab to the engine reader (F1-09F)`; `60d8b6cc G test(reflog): pin the assembly-level engine routing (F1-09F)`; the report commit that follows this text.
- **Files changed:** `src/extension/messageHandler.ts` (+7/−5: the default `openReflog` passes `backend: config.backend` and `isVerified: (repo) => deps.repoSearch?.isVerified(repo) ?? false` into `createReflogSource`, exactly the diff route's shape beside it); `src/extension/commandManager.ts` (+11/−3: a new optional `CommandManagerDeps.isVerified`, and its default `openReflog` passes `backend: deps.config.backend` and `isVerified: deps.isVerified`); `src/extension.ts` (+1: threads `isVerified: (repo) => repoSearch.isVerified(repo)` into `createCommandManager`, beside `openScmDiffTab`'s dep); new `tests/webview/reflogAssembly.test.ts` (+229); this slice file. `src/extension/reflogTab/reflogData.ts` needed no change — F1-09's deps shape already carries both. Nothing outside the Touch list; none of F1-04F's files touched.
- **Tests added or changed:** 3 new tests in `tests/webview/reflogAssembly.test.ts` (0 before), no existing test changed. They mock the panel, capture the `ReflogSource` each default assembly builds, and drive one real page (temporary fixture, empty global/system Git config) through it while flipping the live deps: `backend=engine` when the setting allows and the repository is verified, `backend=cli reason=setting` under `git-cli`, `backend=cli reason=unverified` when not verified — once per assembly site, on the one captured source, so the live-per-page read is pinned too; plus the command manager built without a verification dep stays on the CLI. The engine-served cases need the built addon, as the trust-gate suite's do. F1-09's reader declines are not re-proven.
- **Gates:**
  - `npx vitest run --project webview tests/webview/reflogAssembly.test.ts tests/webview/commandManager.test.ts tests/webview/messageHandler.test.ts tests/webview/messageHandlerTrustGate.test.ts tests/webview/reflogTab/reflogData.test.ts`: 5 files, 126 passed (123 existing + 3 new). The new file alone first: 3 passed.
  - `pnpm run typecheck`: clean (all three `tsc` projects; run after the wiring and again after the tests).
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the four touched `.ts` files: clean. Biome prints the known schema-version note (config 2.5.13, CLI 2.6.5).
  - `node docs/kb/housekeeping.mjs --check`: exit 0.
  - No backend, `engine/**` or l10n file touched, so no backend suite, Rust arm or `l10n:check`. Sonar: integrator.
- **Acceptance:**
  - Both assembly sites pass the live values (`config.backend` read per page through `readReflog`, `repoSearch.isVerified(repo)`; names verified in `src/config.ts` and `src/extension/workspaceSearch.ts`): met, and pinned live by the new tests (one captured source changes route as the setting and verification flip).
  - Invisible behavior (`git-cli`, unverified, or no optional export ⇒ every page the CLI's; verified and allowed ⇒ F1-09's parity): met — the two CLI routes are pinned in the new tests; the no-export route is F1-09's reader behavior, unchanged; no strings, no visible change.
  - Routing pinned at the assembly level without re-proving F1-09's declines: met.
  - No new telemetry: met. The wiring touches no flag or declaration, following F1-09's worktree-listing precedent; `view.engineBackend` still comes only from the graph reader's session flag.
- **Deviations from the slice:** none in behavior. Two notes: (1) the dep is threaded from `extension.ts` as an optional `isVerified` on `CommandManagerDeps` (absent means never verified, the sibling `ReflogSourceDeps`/`DiffDocProvider` convention), rather than an `openReflogTab` assembly replacing the command manager's default — both assembly sites themselves now pass the live deps, as the acceptance words it. (2) I did not run `pnpm install --frozen-lockfile` from the generic protocol: the Reflog overview's Workspaces decision gives each worktree the `node_modules` symlink and a built addon, and the dispatch forbade the install; the symlink and `engine/native/linux-x64/git-graph.node` were present as described.
- **Open questions / follow-ups:** none from this slice. F1-09's minimum-Git question (engine says `none` where a pre-2.46 CLI says `empty`) is unchanged and still the maintainer's.
