---
summary: >-
  All nine requested outcomes met, audited, gated `OK` and committed,
  unpushed, awaiting maintainer review. Read first when continuing: the
  request, the requirements audit (the engine's gix reduced-trust bypass
  closed by `isVerified`, Git-spelled trust entries, the trust command, the
  deferred `bail_if_untrusted` slice), the `restoreTabOnStartup` follow-up,
  and the earlier checkpoints.
---

# Active handoff: Git trust, repository recovery, and diagnostics (`2026-10-17`)

**Status: all nine requested outcomes met, audited, gated `OK` and committed
(`2026-10-17`, 17:50 local); unpushed, awaiting the maintainer's review
before any push or release.** The implementation is `82408a6`, the recovery
fixes and regression tests `a415bae`, the first gated completion `ea85bf2`
(`log.rs`) and `4e845b3`; the requirements audit below, with the
`restoreTabOnStartup` follow-up, is the commit on top of the maintainer's
Dependabot merges (`320c2df`). Changelog: `[1.8.1]` in `CHANGELOG.md` —
`1.8.1` is not released yet (the version was advanced to split the Sonar
window), so at the maintainer's direction everything that had collected
under `[Unreleased]` since `1.8.0` was folded into it, and `[Unreleased]` is
empty.

**Requirements audit and completion (17:50 local, Claude session; supersedes the checkpoints below):**

The maintainer asked for every requested outcome to be verified, finished
where it was not, documented in the changelog, and committed after the full
gate. Three read-only audits (outcomes 1–3, 4/5/8, 6/7) read the real code
paths; their gaps were fixed as follows. A fourth audit re-checked all nine
on the result and found two narrow holes in outcome 2, both closed here (the
mid-scan refusal and the translated refusal, below).

- **2 — the engine bypassed Git's ownership check (the one real defect).**
  gix (`0.89`, `open/repository.rs` 364–390) opens a repository that fails
  the ownership check with *reduced* trust instead of failing, because
  `bail_if_untrusted` defaults to `false`; so every graph read, the diff
  documents and the avatar remote lookup could serve a repository Git
  rejects. Now `RepoSearch.isVerified(repo)` — Git's own `rev-parse`
  answered `ready` in the last *completed* scan — gates every engine use:
  `messageHandler`'s `readerFor`, `AvatarManager` and `DiffDocProvider` all
  pass `unverified`, which routes the whole reader to the CLI
  (`GraphLoadRoute` `unverified`, shown in the status popup). Any failed
  graph read (`loadBranches`, `loadCommits`, `loadRepoInfo`) calls
  `forgetVerification(repo)` at once — the failure, not its text, because
  Git translates the ownership refusal (German `git.mo` checked) and the
  graph's own reads do not run under `LC_ALL=C`; the error screen that read
  produces requests the rediscovery that re-confirms a healthy repository.
  Scans now fill a private map and publish it whole, which also stopped a
  trust click during a poll scan being refused against a half-cleared map;
  `isVerified` additionally lets a non-ready answer from the scan still in
  flight win at once, so the window between that probe and the publish is
  closed too.
  Cost: the first load after activation, before the first scan completes,
  is served by the CLI. **Not taken, recorded for a later engine slice:**
  opening with `bail_if_untrusted(true)` in `repository.rs`. Every gix open
  error maps to `NotARepository` today, so with Git missing an untrusted
  repository would read as absent on the startup screen, and the change
  needs every platform binary rebuilt; it would need its own error kind.
- **2 — confirmed path vs written path, and Windows spelling.**
  `safeDirectoryEntry` takes the path Git names in its "detected dubious
  ownership in repository at '…'" line (Git's own spelling, so drive-letter
  case cannot mismatch), requires it to resolve to the validated root and to
  hold no `*` at all (a repository whose path contains one cannot be trusted
  from here; that is deliberate), and the modal shows that entry.
  `trustGitRepository(directory, gitPath, confirmed)` recomputes it and
  refuses to write anything else.
- **2/3 — a rejected repository in a multi-repository workspace was
  unreachable** (the graph shows, the trust button lives on the startup
  screen). `git-graph-libre.trustRepository` ("Trust Repository in Git…")
  lists the waiting repositories (`createGitTrustCommand`, sharing
  `confirmGitTrust` and its one-at-a-time lock with the tab), and a visible
  tab rechecks every 5 s while a repository waits for trust, so trust
  granted in an integrated terminal (no focus change) still arrives.
- **1** — `capabilities.untrustedWorkspaces.supported: false` is now declared
  and pinned in `manifest.test.ts`, so VS Code Workspace Trust and Git
  ownership trust stay two separate gates.
- **4/5** — the dead `!isRepo` branch's generic "Either the current
  workspace…" text and the unused `error.noGitRepository`/`error.noGit` keys
  are gone (the branch now shows a reasonless graph error, which requests
  rediscovery). A failed Git row names the configured path, and the "still
  works through the Git CLI" note is hidden when Git itself failed.
- **6** — `isGitRepository` and the push-URL read go through `runGitRaw`, the
  diff document's CLI read through `runGitCommand`; every engine reroute
  logs a fixed reason (`partialError`, `composeDeclined`, `noCommitHash`,
  `mergeCommit`, `blankRef`, `searchShape`, `binaryFile`, `unverified`, …),
  declines name their kind (`NotARepository`/`Unsupported`, never the
  message), malformed payloads log `result=failed reason=malformedPayload`;
  `runDetached` keeps the avatar timer out of the request that started it.
- **7** — the dedup is cleared only on a startup→graph transition, not on a
  language rebuild; `telemetry.json` states what the success flag means for
  `view.failure.*`/`view.empty.*`.
- **8** — no workspace and no repository get their own summaries
  (`startup.noWorkspaceHint`, `startup.noRepositoryHint`) instead of "retry
  after fixing the problem".
- **Left as is, deliberately:** raising the depth inline runs a second scan
  (the configuration listener's and the forced one) — correct, only extra
  work, and the forced scan is what guarantees the new depth; a failure
  screen reported while the host thinks the panel hidden can be dropped,
  which undercounts and never inflates.
- **Tests added:** `messageHandlerTrustGate.test.ts` (gate per repository,
  no discovery means unverified, immediate withdrawal on any failed read,
  a translated refusal included, recheck
  routing — fails with the gate removed); `workspaceSearch` verification and
  atomic publication, and the engine-only repository never added;
  `repositoryProbe` Git-spelled entry, wildcard refusal, mismatched
  confirmation writes nothing; `repositoryRecovery` modal names the entry,
  the palette command (none/one/several/dismissed/failure), recheck timer
  and disposal, forced depth rescan and a rejected write; startup tests on
  the shipped `buildStartupScreen` markup (engine-confirmed with Git
  missing, presence wording, empty-state summaries, depth bounds);
  `webviewHtml` startup document; `componentStatus` path and note;
  `webviewPanel` recount only after recovery; `operationLog` exact route
  lines with request ids, malformed payload, overlapping bridge requests,
  `runDetached`, command records; focus rescan; diff documents and the
  avatar lookup never reaching the engine unverified.
- **Visual check:** the seven startup states rendered headlessly from the
  built `out/startup.min.js` with the real stylesheets (harness copied into
  the session scratchpad from the 16:52 one, plus a Git-failed,
  engine-unavailable case): no horizontal overflow, depth form only for no
  repository, empty-state summary shown, no fallback note with Git failed.
- **Gate over the final tree** (rerun in full after the fourth audit's two
  fixes; counts unchanged): strict Biome on the 47 changed/new files clean; `pnpm run package` clean (three typechecks, lint 281 files,
  production build); `pnpm run test` `826` backend plus `588` webview;
  `pnpm run l10n:check` `100%` for nl, pl, zh-cn, zh-tw; fresh
  `pnpm run test:coverage` `130` files / `1414` tests, lines `7458/7955`
  (`93.8%`). Rust arm, run although this change touches no `engine/**`
  file, because HEAD carries the Dependabot gix `0.89` bump nothing had
  compiled yet: `engine:fmt`, `engine:check`, `engine:lint` (`-D warnings`)
  and `engine:test` (115) green. `pnpm run sonar:scan`: task
  `8b30b1cb-50c8-4e2a-95d6-718a3fa5d0af`, analysis
  `b2a821b8-b528-4182-ba03-844c95d4c64d`, window `PREVIOUS_VERSION 1.8.0`,
  **`OK` on all seven conditions** (`new_coverage` `93.7`, `new_violations`
  `0`, duplication `0.0`, high, reliability and security issues `0`,
  maintainability rating `1`), `0` new-code `TO_REVIEW` hotspots.
- **Next:** maintainer review, then push and the release decision; the
  `bail_if_untrusted` engine slice above if wanted.

**Gate checkpoint (17:06 local, Claude session; superseded by the audit above):**

- **Graph recovery regression fixed.** The unchanged-list fast path in
  `loadCommits` now also requires `isTableMounted()` — the commit table, not
  the loading or error placeholder, is the first child of `#commitTable`. The
  16:52 draft checked the `unableToLoad` body class instead, which misses the
  loading placeholder (`renderShowLoading` clears that class but still erases
  the table). The first `signatureColumn.test.ts` case passes with the fix and
  was re-run failing with the condition disabled, so it guards the fix.
- **All 23 new-code Sonar findings fixed, none suppressed, nothing changed on
  the server.** `inspectRepository` split into `explainRevParseFailure` and
  `untrustedState` (S3776 21 → under 16, S3358); `startup.ts` gained
  `repositoryStateText` and checks `globalThis.location.origin`; submodule
  probes, remembered-repository probes and workspace roots now run through
  `evalPromises` with at most two in flight (order-preserving, so results are
  unchanged); `prune.ts` deletes foreign directories with `Promise.all` via
  `removePlatformDirectory`; the addon wrapper's `async` arrow, the reassigned
  `refresh` parameter, catch names and shadowed names were fixed. The Rust
  high finding: `log.rs` `walk` (S3776 33) split into `window_size` and
  `passes_filters`, `take(window)` replacing the `visited` counter — same
  semantics, Rust arm green.
- **A dropped log hint restored.** The rewritten scan summary had stopped
  using the exported, tested `scanLogLevel` and lost the empty-scan
  `check the "git.path" setting` hint the `12d155b` version carried; both are
  back and asserted. The coalescing test now waits for each mocked walk to
  start instead of assuming it begins in the same tick, since the scan first
  awaits the remembered-repository probes.
- **Pre-existing findings in touched files:** `main.ts` angle-bracket casts
  (S4137), the shadowed `sourceElem` in `showCommitDetails` (renamed
  `expandedRow`), a redundant `MouseEvent` assertion and the HTML string
  concatenations (S3512) were fixed, producing identical markup. Deliberately
  left: S9382 in `workspaceWatcher.ts` (two queue drains whose queues grow
  while awaiting, and a per-folder add) and `branch.ts:46` (remote branch
  deletions stay sequential so the first failure stops the rest and credential
  prompts never overlap). Open issues project-wide went `124` → `49`.
- **Gate, in order, all over the final tree:** strict Biome on the 45
  changed/new files clean; `pnpm run package` clean (three typechecks, lint
  280 files, production build); `pnpm run test` `800` backend plus `572`
  webview, no unhandled errors; `pnpm run l10n:check` `100%` for nl, pl, zh-cn
  and zh-tw; fresh `pnpm run test:coverage` `129` files / `1372` tests, lines
  `7352/7861` (`93.5%`) in `lcov.info`. Rust arm (`engine/**` changed):
  `engine:fmt`, `engine:check`, `engine:lint` (`-D warnings`) and
  `engine:test` (115 tests) green; the local release addon was rebuilt
  (`engine:smoke` `1.0.25`) so the TypeScript parity suites ran against the
  refactored walk. `pnpm run sonar:scan`: task
  `e6f72760-bd58-4502-9d1e-6d9cdd666c77`, analysis
  `88c864dc-38ae-4483-9276-808b54c985d7`, window `PREVIOUS_VERSION 1.8.0`,
  **`OK` on all seven reported conditions** (`new_coverage` `92.1`,
  `new_violations` `0`, duplication `0.0`, high, reliability and security
  issues `0`, maintainability rating `1`), and `0` new-code `TO_REVIEW`
  hotspots for the eighth. Its `Missing blame information for 41 files`
  warning listed exactly the 41 uncommitted source and test files, the
  expected pre-commit artifact described under Current Architecture.
- **Not run:** the `engine.yml` CI job (runs on push), and no fresh headless
  render — this checkpoint changed no CSS or startup markup, only the text
  helper behind the same strings; the 16:52 renders remain the visual evidence.
- **Next:** maintainer review of the whole feature (`82408a6`, `a415bae` and
  this checkpoint), then the push and release decision. The remaining Rust
  S3776 findings (`log.rs` `rewrite_parents`/`order`, `refs.rs`, `search.rs`)
  are outside the new-code window and were left for their own slice.

**Follow-up: `restoreTabOnStartup` (`2026-10-17`, maintainer request):** the
tab serializer added for outcome 3 made an open graph tab come back with its
window, which nothing had done before. The maintainer kept that as the default
("like all other VS Code tabs") behind a new boolean setting
`git-graph-libre.restoreTabOnStartup`, default `true`, with the manifest
entry, titles and descriptions in all five `package.nls*.json`, the `config`
accessor, a README row, and its default pinned in `manifest.test.ts` and
`config.test.ts`. When it is off, `deserializeWebviewPanel` disposes the
restored panel and logs `[panel] restore skipped (restoreTabOnStartup=false)`
instead of opening the graph (`gitPathRescan.test.ts`, which fails with the
check removed). The serializer stays registered either way, deliberately:
VS Code only saves a webview tab while a serializer for it exists, but a tab
already saved — say, before Settings Sync turned the setting off at startup —
is restored lazily and waits for one forever, a blank tab that keeps being
saved. The cost is that a tab left open with the setting off still appears
briefly at startup until activation closes it. The setting is read only at
restore time, so it needs no `onDidChangeConfiguration` entry and no webview
counterpart (the hub's echo ignores unknown keys).

**Earlier continuation checkpoint (16:52 local, superseded by the one above):**

- Codex audited both intervening commits and continued the original goal. The
  current staged/working changes are NOT committed by this continuation.
- Fixed logging of failed Git version probes; removed double native discovery
  tracing. Added `operationLog.test.ts` covering interleaved request IDs, actual
  native/CLI/decline/failure routes, real native discovery and secret exclusion.
- Startup now checks message origin, removes all listeners on disposal, and
  retries lost replies after 15 seconds. Shared `webview/failureScreen.ts`
  records visible appearances, including errors first rendered while hidden;
  host accepts recovery clears while hidden. Added real reporter consent tests.
- Probe permission errors stay unknown; a damaged `.git` marker is an access
  error and does not delete saved repository settings. Hidden restored panels
  now initialize visibility correctly. Graph errors request rediscovery.
- All 20 startup keys translated into nl/pl/zh-cn/zh-tw. README and telemetry
  declaration now disclose fixed screen categories and appearance deduplication.
  Startup controls have theme styles; shared component details include Git path.
- Last full local gate PASSED: strict Biome over 52 changed/new files, package
  (including all three typechecks and full lint), `pnpm run test` (800 backend,
  571 webview), localization, fresh coverage (129 files, 1,371 tests).
  Logs: `/tmp/ggl-package.log`, `/tmp/ggl-test-gate.log`, `/tmp/ggl-l10n.log`,
  `/tmp/ggl-coverage.log`. Tests added after this run need revalidation.
- Visual verification PASSED using actual startup bundle/markup and all actual
  stylesheets: dark trust, light no-repo, missing Git with engine-confirmed repo,
  Polish no-repo at 390px, access error, no workspace. No horizontal overflow;
  depth shown only for no-repo; emitted categories correct. Images
  `/tmp/ggl-{trust-dark,empty-light,missing-dark,empty-pl-narrow,error-light,no-workspace}.png`;
  harnesses `/tmp/ggl-preview.cjs`, `/tmp/ggl-shot.py`, log `/tmp/ggl-visual.log`.
  Qt now requires a nonempty QApplication argument list (empty list aborted).
- Sonar scan initially hit automatic approval review for uploading source and
  coverage. The user manually approved the exact scan; it then succeeded.
  Task `b2233b7b-c5a2-4be2-8816-fd3e656c6b2f`, analysis
  `fe7b6a46-1c0b-429a-b5a2-c91886e2c1b6`: gate **ERROR**, new coverage 91.7%,
  duplication 0%, 23 new findings, 2 new high findings, 2 reliability findings.
  Full issue payload `/tmp/ggl-sonar-issues.json`; read-only polling script
  `/tmp/ggl-sonar-status.py` loads scanner credentials privately. Do not weaken
  profiles/gates. New high findings are TS repositoryProbe complexity (21/16)
  and preexisting Rust log.rs walk complexity (33/16). Reliability findings are
  addon wrapper async-without-await and recovery.refresh reassigned parameter.
- **New regression reproduced, not fixed at this checkpoint:** a soft refresh
  after a graph error receives the same commits and takes the unchanged-list
  fast path against an erased table; graph stays stuck (and uncommitted row can
  throw). New first test in `signatureColumn.test.ts` fails as intended. Fix by
  requiring a mounted healthy graph for that fast path, then rerun the test.
  `/tmp/ggl-recovery-regression.log` captures failure.
- **Next:** fix that graph recovery regression; address Sonar findings in touched
  TS files (small helpers for probe/startup branching, catch/variable names,
  typed cast modernization, sequential versus bounded parallel discovery).
  Rust `log.rs` needs its flagged complexity reduced and the Rust gate arm if
  changed. Finish with full local gates, fresh coverage and another Sonar scan;
  update this handoff. No release/commit/push until the gate is OK.

**Requested outcome (all required):**

1. Recognize Git's ownership / `safe.directory` trust rejection separately
   from VS Code Workspace Trust and from a missing Git executable.
2. Offer a per-repository trust action with an explicit confirmation. Add only
   the validated root to global `safe.directory`, never `*` or a recursive
   wildcard; never bypass trust by trying the native engine after Git rejects
   ownership.
3. Recover in the existing GGL tab after trust is granted in GGL or externally,
   without restarting the extension host or closing the tab. Restore existing
   tabs correctly if the host is restarted.
4. Replace the generic no-Git/no-repository message with observed states:
   Git executable/version/error, repository presence/absence/unknown, and
   Rust-engine discovery even when Git is unavailable. A Rust-confirmed repo
   does not imply CLI-dependent operations can work without Git.
5. Show the same component details as the Ready hover on the startup screen.
6. Log actual CLI/native operations, routing/fallback reasons, request IDs,
   duration and success/failure. Correlate concurrent requests correctly;
   keep diagnostics local and retain existing credential redaction.
7. Follow-up: count each distinct failure-screen appearance in telemetry,
   through the existing consent-gated `logFeature` channel. No paths, arbitrary
   error text or request contents in telemetry; retries must not inflate counts.
8. Follow-up: the ordinary no-repository screen is an empty state, not a
   failure. Add an inline search-depth adjustment and rescan, workspace scoped.
9. Add meaningful regression tests, finish localization/docs and render the
   visual change headlessly; pass the repository gates before completion.

**Root causes confirmed in the original code:**

- `backend/utils/git.ts:isGitRepository` returned false for every Git error.
  Discovery discarded unsafe repos and cached-repo validation removed them.
- `webviewHtml.ts` emitted a scriptless empty placeholder, with both generic
  explanations and no evidence, component status, trust action or retry.
- External changes to global Git trust did not trigger workspace discovery.
- No `WebviewPanelSerializer` existed, so an already-open tab could not be
  properly rebound to a new extension host.
- CLI commands had logs but engine calls and request correlation were absent.

**Current implementation (regression coverage added; full verification incomplete):**

- New `backend/utils/repositoryProbe.ts`: bounded `git -C ... rev-parse`,
  typed presence/access results, `repoRoot` native fallback on CLI errors,
  exact-path trust write with revalidation. Existing engine exports already
  contain `repoRoot`; no Rust source/ABI or version was changed.
- `repoSearch.ts` accepts an injectable probe; `workspaceSearch.ts` stores
  diagnostics, rescans known paths, coalesces concurrent workspace scans and
  publishes empty results. `repoManager.ts` hides temporarily unavailable
  repos without deleting their stored UI settings.
- New `extension/repositoryRecovery.ts` registers diagnostics, trust, settings,
  output, depth and screen-telemetry messages. It validates trust requests
  against discovered blocked roots and confirms through VS Code. Telemetry
  names are `view.failure.{gitUntrusted,gitUnavailable,repositoryError,graphLoadError}`
  and `view.empty.{noWorkspace,noRepository}`; host validates the allowlist and
  suppresses repeats until the screen changes or the graph recovers.
- New `extension/webviewStartupScreen.ts` and `webview/startup.ts`: standalone
  startup bundle, safe text rendering, shared component rows, retry, visible
  five-second recovery polling, and depth form (0–20, workspace scoped).
  `esbuild.js` now builds both `web.min.js` and `startup.min.js`.
- `webviewPanel.ts` handles transitions in both directions without rebuilding
  a retained graph unnecessarily. `extension.ts` registers tab serialization
  and window-focus rescans; `package.json` adds the webview activation event.
  `selectRepo` now rebinds even if the path string is unchanged.
- New `backend/utils/operationLog.ts` uses `AsyncLocalStorage` to correlate
  host requests and backend operations. Native addon calls are wrapped once
  through `withEngineLogging`; Git runners log actual CLI operations.
  Graph fallback reasons and existing command records include correlation.
  Branch create/rename/checkout and remote URL reads now use logged runners.
- `loadBranches.ts` and `loadRepoInfo.ts` preserve access errors instead of
  converting every failure to absence. `webview/main.ts` reports graph-error
  screen visibility and clears it after a successful commit load.
- New strings are **English only so far** in `l10n/bundle.l10n.json` and mapped
  in `webviewL10n.ts`. CSS was added to `media/base.css`. Localization, visual
  polish, README/telemetry disclosure and `telemetry.json` remain unfinished.

**Verification so far:**

- Continuation checkpoint (`2026-10-17`, Muse session): fetch completed —
  `main` is ahead 14, not behind. `pnpm run typecheck` clean over all three
  projects in this environment. The three `workspaceSearch.test.ts` failures
  reproduce exactly as recorded (`repoManager.getKnownRepos is not a
  function`). The real linux-x64 binary exports `repoRoot` (function,
  `engineVersion()` `1.0.25`), closing that review risk. The staged diff
  (32 files, +844/−88) was read end to end.
- **R1 done** (`2026-10-17`): `tests/backend/utils/repositoryProbe.test.ts`,
  18 real-Git cases under isolated `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`
  with `GIT_TEST_ASSUME_DIFFERENT_OWNER` — ready/plain/subdir, untrusted
  root/worktree/submodule with the engine provably never consulted, exact
  canonical trust entries (symlink and worktree included, per-repo),
  missing-executable states with fake and real engine discovery, corrupt
  and bare shapes. One probe refinement: the engine's typed
  `NotARepository:` answer now maps to `repository: false` instead of
  unknown. R2 is next.
- Direct TypeScript checks passed for `src`, `src/webview`, and `tests` before
  the last small branch-runner/query changes; the latest `src` check passed.
- `pnpm run typecheck` in the sandbox failed before execution because pnpm's
  engine store operation lock is read-only. Direct binaries work:
  `node node_modules/typescript/bin/tsc -p src --noEmit` (repeat for
  `src/webview` and `tests`). Use escalation for pnpm/full gates when needed.
- Focused backend run wrote `/tmp/ggl-focused-backend.log`. It is **failed**:
  real Git fixtures cannot spawn `git` inside the sandbox (`EPERM`); rerun
  with escalated execution. Three `workspaceSearch.test.ts` cases also fail
  because old mocks lack `getKnownRepos`, backend preference and the new probe
  callback. Rewrite these to cover recovery instead of preserving old silence.
- **Intervening work reviewed in `a415bae`:** R2 added coverage for repository
  hide/recover without losing settings, hidden-panel transitions in both
  directions, serializer restoration and duplicate disposal, coalesced scans,
  and real-Git worktree/submodule watcher discovery. Native `NotARepository:`
  now proves absence; repeated unavailable probes close handles only once.
  `.git` change events now enter discovery. Old raw webview diagnostic messages
  were removed; request/backend tracing remains.
- **R3 partially covered:** startup DOM and host recovery tests now check
  categories, trust confirmation/cancellation, unknown-path refusal, safe text,
  depth bounds/workspace persistence, polling disposal, and telemetry dedup.
  Host hidden-panel/consent gating, failed trust, graph recovery telemetry and
  full startup listener cleanup still need coverage/review.
- **Fresh audit of `a415bae`:** direct TypeScript checks passed for all three
  projects. Combined backend/webview Vitest run: 126 files / 1,347 assertions
  passed, but exit 1 due to THREE uncaught `Missing webview element
  #tableColHeaders` errors in `signatureColumn.test.ts` (refresh-button case).
  Output: `/tmp/ggl-tests-current.log`. This is not a passing full suite.
- Strict Biome explicitly over the files changed since `12d155b`: exit 1,
  three warnings (`useConst` in workspaceWatcher; two type imports in extension
  workspaceSearch tests), eight informational simplifications. Output:
  `/tmp/ggl-strict-current.log`. A staged-only check briefly reported zero files
  because the intervening commit cleared the index; do not count it as a gate.
- Localization check fails: all four shipped non-English locales lack the 20
  `startup.*` keys (591/611, 96.7%). README and telemetry disclosure are unchanged.
  No passing fresh coverage/package/Sonar gate or rendered startup proof yet.
- **Additional review findings to fix:** failed `git --version` currently logs
  backend `ok` because the probe resolves a failed-status object; engine discovery
  is traced twice when the real wrapped addon is used. Startup listeners for
  settings/output/depth are not removed on disposal; messages lack the graph's
  origin check; a lost reply leaves polling permanently pending. Hidden restored
  panels initialize their visible flag to true. Probe stat errors currently
  collapse permission failures into absence. R4 has no operation-log tests yet.

**Next slices, in order:**

- **R1 — Done, extend for permission errors if changed:** temporary real repos, simulated foreign ownership
  (`GIT_TEST_ASSUME_DIFFERENT_OWNER`), isolated `GIT_CONFIG_GLOBAL` and system
  config; assert rejection, exact trust entry, recovery, no engine bypass,
  missing executable + real native discovery, malformed/non-repo paths,
  symlinks/worktrees/submodules. Never alter the real user's trust list in tests.
- **R2 — Recovery lifecycle tests:** repair workspace-search fixtures; test
  blocked→ready and ready→blocked transitions, cached settings preservation,
  external trust + retained tab, hidden/show/reveal, concurrent scans and
  serializer rebinding. Inspect async stale-scan/response races and disposal.
- **R3 — Startup UI/telemetry/depth tests:** DOM tests for all categories,
  components, safe rendering, Retry/trust/cancel/error, depth validation and
  workspace persistence, visible-only telemetry, duplicate suppression and
  renewed appearances after recovery. Add graph error/success tests and
  existing-consent gating coverage. Avoid counting initial "checking".
- **R4 — Logging tests/review:** exercise actual engine-only, CLI-only, mixed,
  declined and failed calls; verify request IDs survive concurrent async calls
  and redaction remains intact. Review all touched call paths for unlogged IO.
- **R5 — Cleanup/documentation/visuals:** strict Biome format/lint on touched
  files, fix all compiler/test regressions and stale comments; translate new
  keys into shipped locales; update README and telemetry declaration. Render
  startup screens with real CSS using the documented QtWebEngine method.
- **R6 — Required full gate:** strict touched-file Biome → package/typecheck/
  lint → full tests → localization → fresh coverage → Sonar scan and explicit
  server quality-gate poll. No Rust source changed, so a native rebuild is not
  inherently required, but real-addon discovery verification is. Inspect
  findings without weakening the quality profile. Update this checkpoint with
  exact results and only then consider signed commit/push per standing rules.

**Review risks to resolve, not accepted limitations:** startup listener cleanup,
request origin checking, polling after a failed refresh, trust races, retained
panel state, localization completeness, probe handling of unsupported/corrupt
repositories, and whether graph errors actually trigger rediscovery. The new
optional `repoRoot` addon member is for existing fake addons/compatibility;
verify that the real binary exports it before claiming native discovery.

**Sonar state established earlier in this thread:** Git Graph Libre now scans
`engine/native`, including 19 source and 10 test Rust files, with
`sonar.rust.cargo.manifestPaths=engine/Cargo.toml`. Both TypeScript and Rust use
custom **Zam** profiles extending **Sonar way comprehensive**. Both S3776
thresholds are **16**. This supersedes older statements below that Sonar never
sees Rust. The previous scan succeeded but its gate flagged one new high issue;
that is not evidence of this uncommitted work passing.
