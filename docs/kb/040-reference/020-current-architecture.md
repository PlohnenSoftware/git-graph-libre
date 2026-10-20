---
summary: >-
  Layer map (`extension.ts`, `gitClient.ts`, queries, actions,
  `messageHandler.ts`, webview); Biome and SonarQube setup (`pnpm run
  sonar:scan`, no empty `SONAR_TOKEN=`); dated `sonar.projectVersion` advances
  up to `1.9.0`; `ZAM` gate conditions; feature route.
---

# Current Architecture

The extension is already split into clean layers:

- Extension shell: `src/extension.ts` initializes localization, output, persistent
  state, avatar manager, status bar, repo manager/search/watcher, git client, and
  webview panel.
- Git client: `src/backend/gitClient.ts` wraps `simple-git` and swaps base repo or
  git binary when the active repo/config changes.
- Backend queries: `src/backend/queries/loadCommits.ts`,
  `loadBranches.ts`, and `commitDetails.ts` translate webview requests into Git
  data models.
- Backend actions: `src/backend/actions/*` contains small functions for branch,
  tag, merge, and commit operations.
- Message contracts: `src/types.ts` and `src/backend/types/*` define typed request
  and response payloads.
- Webview bridge: `src/extension/webviewBridge.ts` maps messages between the
  extension host and webview.
- Webview UI: `src/webview/main.ts`, `src/webview/dropdown.ts`, and
  `src/webview/graph.ts` render controls, commits, context menus, and the SVG
  graph.
- Styling/localization: `media/*.css`, `l10n/*.json`, and `package.nls*.json`.
- Verification: `pnpm run typecheck`, `pnpm run format`, `pnpm run lint`,
  `pnpm run test`, `pnpm run l10n:check`, and package/build scripts in
  `package.json`.
- Linting and formatting: Biome is the active workflow tool. Keep the existing
  script names (`format`, `format:fix`, `lint`, `lint:fix`) wired to Biome so
  CI, maintainers, and future agents have one stable command surface. Use
  `biome.jsonc` for repository-wide migration-friendly checks and
  `biome.strict.jsonc` as the stricter target for new files and touched code.
- SonarQube is the required deeper pre-commit analysis gate beside Biome. Use
  `sonar-project.properties` for project metadata and exclusions, run
  `pnpm run test:coverage` to generate `coverage/lcov.info`, then run
  `pnpm run sonar:scan` — plain `sonar-scanner`, which takes host and token
  from the system-wide scanner configuration
  (`/opt/sonar-scanner/conf/sonar-scanner.properties`). There is no local
  SonarQube server in use: never override the host or token
  (`-Dsonar.host.url`, `SONAR_HOST_URL`, `SONAR_TOKEN`), and never record
  the configured address or token anywhere in this repository. Do not
  commit tokens, generated `.scannerwork/` output, or generated
  `coverage/` output.
  The project key is `git-graph-libre`.
- SonarQube state on this machine (re-verified `2026-10-17`): no local
  server; the maintainer's remote instance is reached through the global
  config above. `sonar-scanner` is installed at `/opt/sonar-scanner`
  (`SONAR_SCANNER_HOME`). Read the address from that file when you need it
  for an API poll; never record the address or the token anywhere in this
  repository. **Never prefix the command with an empty `SONAR_TOKEN=`**:
  the environment variable takes precedence over `sonar.token` from the
  config file, so the scan authenticates anonymously and fails with
  `HTTP 401 Unauthorized` on `/api/v2/analysis/version` even though a valid
  token is present. A `401` is not by itself evidence that no credential
  exists. The separate SonarQube CLI is absent, so `pnpm run sonar:auth`,
  `sonar:auth:status`, and `sonar:secrets` cannot run on this machine; the
  old `sonar:scan:local` script and `sonar:auth`'s `-s http://127.0.0.1:9000`
  were removed `2026-10-17`. That day's final scan (task
  `9ffe7ba5-e235-49c3-9d59-99072d226e8e`, analysis
  `fc6fbf5e-e5d7-4a9d-9922-b8c2ec90da12`) polled back gate `OK`.
- Quality profiles on the server (`2026-10-19`): every language this project
  scans has a profile named `Zam` inheriting from the built-in **Sonar way
  comprehensive**.
  - **Rust** (`rust`) differs from its parent in one override:
    cognitive complexity `S3776`, threshold 16 instead of 15, severity
    `CRITICAL`.
  - **JavaScript** (`js`, created `2026-10-19`) carries the same `S3776`
    override and 16 rules of its own, 440 active in all:
    - from the built-in **Sonar agentic AI** profile, the two its parent
      lacks: `S6440` and `S7764`;
    - ten rules the TypeScript `Zam` enforces, at its severities: `S2260`,
      `S3786`, `S1117`, `S1172`, `S3801`, `S2424`, `S2427`, `S4139`,
      `S5867`, `S4326`;
    - four guards against quietly bypassing checks: `S1291` (tracks
      `NOSONAR`), `S125` (commented-out code), `S3827` (use before
      definition), and the custom rule `javascript:zam_suppression_comments`.
      That last one is built on the `S124` template because templates can't
      be activated directly, and flags `biome-ignore`, `eslint-disable`,
      `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck`.
    The TypeScript `Zam` has the same guards (`2026-10-19`): `S1291`, `S125`
    and `typescript:zam_suppression_comments`. It has no `S3827`, because the
    TypeScript compiler already rejects use before definition. That makes
    476 active rules.
  - **TypeScript** (`ts`) activates 34 rules beyond its parent.
  Rust and TypeScript are assigned to the `git-graph-libre` project rather
  than set as server defaults. JavaScript was not yet assigned when this
  was recorded. Read the current state off the server (`/api/qualityprofiles/search`)
  rather than trusting this list.
- Scan the completed, uncommitted working tree with fresh coverage **before**
  committing. SonarQube logs `Missing blame information` for changed/new files
  and identifies the report with the current HEAD revision; those warnings are
  expected in this pre-commit workflow and do not replace the requirement to
  poll the compute-engine task and quality-gate APIs. A scan without
  `coverage/lcov.info` records no coverage, so always run
  `pnpm run test:coverage` immediately before the scan. Fix gate findings, rerun
  affected checks and coverage, rescan until the gate is `OK`, and only then
  commit.
- The `Previous Version` new-code window is only as tight as
  `sonar.projectVersion`. It remained `1.0.0` from the `0.4.1-ai-dev` analysis
  of `2026-07-03` through the completed 1.0.0 quality work. On `2026-07-27` it
  was deliberately advanced to `1.1.0` with the package's backward-compatible
  history-recovery and ref-label feature release, starting the next stricter
  analysis epoch. The first 1.1.0 analysis follows the same pre-commit rule and
  must use fresh coverage from the completed working tree.
- On `2026-08-06` `sonar.projectVersion` was advanced to `1.3.0` with the
  root-commit square rendering and root-line termination release, correcting the
  drift where it had stayed at `1.2.0` through the `1.2.0`/`1.2.1` releases. The
  first 1.3.0 analysis uses fresh coverage from the completed working tree.
- On `2026-09-03` the package version and `sonar.projectVersion` were advanced
  together to `1.4.0`. Reason: the whole telemetry and consent epoch — the
  client, the three-state consent, the gate screen, the read-side instrumentation
  and Dutch — had accumulated inside a `Previous Version` window still anchored
  at `1.2.0`, so a slice adding a handful of lines was being measured against
  thousands. Advancing closes that window and starts the next analysis epoch at
  the 1.4.0 line. The first 1.4.0 analysis uses fresh coverage from the completed
  working tree, and the gate window will report `1.3.0` until the following
  advance — that is the definition working as intended, not drift.
- On `2026-09-03` both versions advanced to `1.4.1` for the annotated-tag
  empty-message bug fix. This opens a patch-release analysis epoch for the
  changed tag request, backend action, and dialog behavior.
- On `2026-09-03` both versions advanced again to `1.4.2` for the merged
  submodule-discovery pull request and its telemetry. Advancing matters more
  than usual here: the new code arrived from **outside** and was analyzed only
  after it was already on `main`, so the `Previous Version` window is the one
  thing that isolates a contributor's diff for review. Leaving it at `1.4.1`
  would have measured the merge against an empty window instead.
- On `2026-09-07` both versions went `1.4.3` → `1.5.0` with the staging-panel
  release. **`1.4.3` was analyzed but never tagged or published**, so it is a
  version string in the analysis history and not a release; the maintainer
  chose `1.5.0` for the tag because the staging panel makes the delta since
  `v1.4.2` a minor. The consequence for reading the gate: the `1.4.3` analysis
  of that morning is what measured the whole release against the `1.4.2`
  baseline, and the `1.5.0` analysis behind it measures only what changed after
  it. Two analyses, one release — check the window (`period.parameter`) before
  quoting a `new_coverage` number from either.
- On `2026-10-16` both versions advanced `1.7.0` → `1.8.0` at the maintainer's
  request. **`1.7.0` was analyzed but never tagged or published** — the last
  release tag stays `v1.6.2` until `v1.8.0` is cut — so this is the third
  folded version number after `1.4.3` and `1.5.1`: the whole Rust engine line
  (Phase 16), the dialog Enter-to-confirm, the multi-select quick toggle, the
  `--no-commit` dialog options, and the context-menu overflow fix ship as one
  `1.8.0` section in the changelog, and there is no `[1.7.0]` heading or
  compare link. Advancing `sonar.projectVersion` with the package version
  closes the `Previous Version` window that measured the engine line against
  `1.6.2` and starts the next epoch at the `1.8.0` line; the first `1.8.0`
  analysis therefore measures only what changes after it, so check
  `period.parameter` before quoting a `new_coverage` number from either side
  of the advance. The `1.6.0`/`1.6.1`/`1.6.2` and `1.7.0`-line advances are
  recorded in their release and slice notes rather than in this list.
  Gate over the bumped tree (`2026-10-16`): strict Biome clean on the touched
  files, `pnpm run package` clean (258 files linted; one `info` that the
  `biome.jsonc` `$schema` still names `2.5.13` against CLI `2.5.15`),
  `pnpm run test` green (`69`/`704` backend plus `48`/`503` webview),
  `pnpm run l10n:check` `100%` for all four locales, fresh
  `pnpm run test:coverage` `117` files / `1207` tests at `93.0%` lines
  (`6558/7054` in the generated `lcov.info`). The Rust arm was skipped under
  its own rule: the bump touches no `engine/**` file.
  The first `pnpm run sonar:scan` attempt that day failed during bootstrap
  (`Failed to parse the entry in the bootstrap index`): the configured host
  was answering every path with a Cloudflare `307` to a GitHub organization
  page, so the scanner downloaded markup where it expects its engine index,
  and nothing listened on `127.0.0.1:9000` either. After the maintainer
  restored the instance the same day — it came back as `26.10` and sat at
  `DB_MIGRATION_NEEDED` until its migration ran, then `UP` — the whole gate
  was rerun in order with fresh coverage, and the scan completed: task
  `a383aee0-9cd1-4be8-bff5-7cd52d491360`, analysis
  `55b3f62f-40b1-4af0-9836-a8a79c388e47`, window `PREVIOUS_VERSION 1.7.0`
  as expected for the first `1.8.0` analysis. **That first verdict was
  `ERROR`, on exactly one of its seven reported conditions**: the
  project-wide `software_quality_reliability_issues = 0` read `13`. Every
  new-code condition passed (`new_coverage` `88.8` against `85`,
  `new_violations` `3` against `5`, `new_duplicated_lines_density` `0.0`,
  `new_software_quality_high_issues` `0`), as did the maintainability-rating
  and security project-wide conditions. The `13` were all inherited, none of
  them in code this bump — or the whole `1.7.0` line — added: ten
  `typescript:S9383` floating-promise findings (eight in
  `src/avatarManager.ts`, one each in `src/extension/repoManager.ts` and
  `src/extension/workspaceSearch.ts`) and three `typescript:S7503`
  async-without-await findings that now carry a `RELIABILITY` impact
  (`src/backend/utils/gitRunner.ts`, `src/extension/messageHandler.ts`,
  `src/extension/workspaceWatcher.ts`). They surfaced because the server
  was upgraded (`26.9` → `26.10`) between the last green scan and this one;
  this is the project-wide-condition trap the gate notes above describe,
  arriving via a rule-set change rather than via code. The `3`
  new-code violations under the threshold were all `typescript:S5906`
  assertion-style findings in `tests/webview/rendering.test.ts` from the
  merged feature branches.
  The maintainer directed fixing them rather than accepting them in the UI,
  in small signed commits on this branch: the eight `avatarManager`
  floating promises settled or explicitly `void`ed, `checkReposExist`
  rewritten as plain `async`/`await` (its promise-constructor wrapper would
  have hung forever on a rejection, though `isGitRepository` cannot reject),
  the depth-change rescan marked `void` like its `extension.ts` twin, the
  three needless `async`s dropped where each contract already allowed it
  (`runGitCommand` awaits its operation inside `try`/`catch`; the bridge
  handler type is `void | Promise<void>`; the watcher matches its
  non-async sibling), and the three `S5906` assertions switched to
  `toHaveLength` instead of sheltering under the threshold of `5`. Each
  commit ran strict Biome on its staged files, the full typecheck, and its
  focused suites. The whole gate then reran in order — `package`, `test`
  (`69`/`704` plus `48`/`503`), `l10n:check` `100%`, fresh `test:coverage`
  (`117`/`1207`, `93.0%` lines in `lcov.info`) — and the rescan returned
  **`OK` on all seven conditions**: task
  `69732471-f01e-40f6-9d16-b34d5979f2dc`, analysis
  `e48941f4-7920-4689-8f8f-20b352682e4c`, window `PREVIOUS_VERSION 1.7.0`,
  `software_quality_reliability_issues` `0`, `new_violations` `0`,
  `new_coverage` `87.0`, duplication `0.0`, high issues `0`. An independent
  re-read of the API after that analysis agrees: reliability-impact open
  issues `0`, new-period open issues `0`, new-period `TO_REVIEW` hotspots
  `0` (26.10's hotspots search wants `project=`, not `projectKey=`). Only
  with that `OK` on record was the bump itself committed.
- On `2026-10-16`, the same day `v1.8.0` was tagged, both versions advanced
  `1.8.0` → `1.8.1` at the maintainer's request, before the scan of the
  engine Author Date and status-indicator slice (see "Author Date through the
  engine, and the status indicator" under Phase 16). The first `1.8.1`
  analysis reports window `PREVIOUS_VERSION 1.8.0` as expected: task
  `176b638a-3278-46da-9ec3-def314094b4c`, analysis
  `ac7c34e8-2c17-4711-bf1f-653a9e7d36a4`, **`OK` on all seven conditions**
  (`new_coverage` `95.7`, `new_violations` `0`, duplication `0.0`, high,
  reliability and security issues `0`, maintainability rating `1`), and no
  `TO_REVIEW` hotspots in new code.
- On `2026-10-20` the maintainer advanced both versions `1.8.1` → `1.9.0` on
  `main` (`d2b3f4f`) for release 1.9.0, "The Diff", and `the-diff` was
  rebased onto that commit. Every 1.9.0 integration analysis before it ran
  at `1.8.1`, so their window was `PREVIOUS_VERSION 1.8.0`. The first
  `1.9.0` analysis reports window `PREVIOUS_VERSION 1.8.1` as expected:
  task `252c38e1-306d-470a-bda0-e2d38a86e5ae`, analysis
  `e04774ed-1e18-455b-8097-a9c23207cc46`, **`OK`** on the seven conditions it
  reported (`new_violations` `0`; high, blocker, reliability and security
  issues `0`; maintainability issues `41`; rating `1`), and no `TO_REVIEW`
  hotspots in new code. Check `period.parameter` before quoting a new-code
  number from either side of the advance.
- The project uses the maintainer's `ZAM` quality gate, and **not all of its
  conditions are scoped to new code**. As of `2026-07-29` it has six conditions:
  `new_duplicated_lines_density` at most `1` and `new_violations` at most `3` on
  new code, plus project-wide limits of at most `20` maintainability issues, at
  most `180` minutes maintainability remediation effort, `0` reliability issues,
  and `0` security issues. These project-wide conditions mean a slice can fail on
  pre-existing issues it never touched, so read the gate off the server
  (`/api/qualitygates/get_by_project` then `/api/qualitygates/show`) rather than
  assuming the conditions above are still current, and expect to fix inherited
  findings needed to get the slice green.
- The maintainer changed the gate between `2026-07-27` and `2026-07-29`: the
  `new_coverage >= 85` condition was **removed** and `new_violations` was
  loosened from `0` to `3`. Earlier slice notes quoting an `85%` coverage
  threshold are historical. Coverage is still worth generating and watching
  (`pnpm run test:coverage` before every scan) — it is simply no longer a gate
  condition, so a green gate is not evidence that coverage held.
- The gate changed again by `2026-09-02`, which is why it must be read off the
  server rather than from this list. `new_coverage >= 85` is **back**,
  `new_violations` is now at most `5`, and the project-wide issue-count and
  remediation-effort conditions have been replaced by
  `new_software_quality_high_issues = 0`,
  `software_quality_maintainability_rating = 1`,
  `software_quality_reliability_issues = 0`, and
  `software_quality_security_issues = 0`. The gate reports its `Previous
  Version` window as `1.2.0` while `sonar-project.properties` says `1.3.0` —
  that is the definition working as intended, not drift: new code is everything
  since the last analysis of the *previous* version, so the whole `1.3.0` line
  of work stays inside the window until the version is advanced again.
- The gate carried **eight** conditions when read on `2026-09-05`: the seven
  above plus `new_security_hotspots_reviewed >= 100`. It is reported back only
  when the analysis actually has new hotspots, so a `project_status` response
  listing seven `OK` conditions is not evidence the eighth is gone — read
  `/api/qualitygates/show?name=ZAM` for the conditions and
  `/api/hotspots/search?...&inNewCodePeriod=true&status=TO_REVIEW` for what
  would trip it. The server is Community Edition (`26.10.0.133078` as of
  `2026-10-16`; it was `26.9.0` when the eight conditions above were read), so there is no
  branch or pull-request analysis: every scan lands on the project's single
  branch, which is why the pre-commit working-tree workflow is the only one
  available and why reviewing a branch means scanning its checked-out tree.
- Polling the API from the CLI: `sonar.host.url` in the scanner config has
  trailing whitespace, so `curl` fails with exit `3` (malformed URL) unless the
  value is sanitized, e.g.
  `HOST=$(grep -oP '^sonar\.host\.url=\K.*' /opt/sonar-scanner/conf/sonar-scanner.properties | tr -d ' \r\n' | sed 's:/*$::')`.
  A silent empty curl response is this, not an outage.
- The setup recorded in the older slice notes below — a ZIP install under
  `~/.local/opt/sonarqube` backed by `postgresql.service`, run as a
  `sonarqube.service` systemd user unit for user `z`, with a token at
  `/home/z/.sonar/neo-git-graph.token`, on WSL — belonged to an earlier machine.
  None of those paths exist now, and this machine is not WSL. Treat the exact
  commands recorded in those notes as historical evidence, not as runnable
  instructions.
- `sonar.coverage.exclusions=scripts/**,esbuild.js` keeps repo build tooling
  (l10n checker, octicons generator, esbuild driver) out of coverage
  requirements: these scripts run at build time outside the extension and have
  no unit-test harness. They remain fully analyzed for reliability and
  maintainability issues.

This gives future features a consistent route:

1. Add or extend backend types.
2. Add a focused query/action with tests.
3. Register it in `messageHandler.ts`.
4. Add webview request/state/rendering.
5. Add localized labels and manifest settings if user configurable.
6. Verify with focused tests, then full package checks for larger slices.
