# AI Development Knowledge Base

This document is the working knowledge base for recreating useful Git Graph
features in Git Graph Libre while keeping this repository free of any material
the project cannot license under the AGPL.

## Renames and relicensing since these notes were written

Most of this document, and all of the dated slice notes below, were written
while the project was still the MIT fork `neo-git-graph`. Those notes are kept
as a historical record and are deliberately not rewritten. When reading them,
apply these facts:

- The project is **Git Graph Libre** (`PlohnenSoftware.git-graph-libre`).
- Every setting and command ID moved from the `neo-git-graph.*` prefix to
  `git-graph-libre.*`. Any `neo-git-graph.<id>` named below is dead; check
  `package.json` for the live ID.
- From version 1.0.0 the project as a whole is `AGPL-3.0-or-later`, not MIT.
- The SonarQube project key is `git-graph-libre`, not `neo-git-graph`.
- The local SonarQube setup recorded below belonged to an earlier machine and
  no longer exists; see the Tooling section.

## Mission

Git Graph Libre descends from the MIT lineage of Git Graph: the original
mhutchie repository up to its last MIT commit, continued through the
`asispts/neo-git-graph` MIT fork. From version 1.0.0 the project as a whole is
licensed under `AGPL-3.0-or-later`. The incorporated MIT material, its boundary
commit, and its per-era contributor rosters are recorded in `NOTICE.md` and
`LICENSE.mit`; the MIT grant of sublicensing permission is what allows that
material into the AGPL whole, so those notices must stay intact. If upstream
MIT commits are ever merged in, extend the boundary commit and the roster in
the same change.

**The licence flows one way, and every upstream review must confirm it still
does.** MIT code may come into this AGPL project; AGPL code may not go out into
an MIT one without the copyleft coming with it. Upstream is a sibling MIT fork
of the same ancestor, which makes accidental — or deliberate — reuse of this
project's post-fork work plausible and easy to miss, and redistributing it
under MIT would strip the copyleft that is the whole point of the relicensing.
So on every upstream review, before reading their commits for ideas, check
their tree for code that exists only here. Grep for identifiers introduced
after the fork rather than for shared ancestry, since everything inherited
from the MIT lineage is expected to match:

```bash
git fetch upstream --prune
for marker in truncateRefName startRevealHighlight parseGpgsigPresence \
  isMissingRemoteRefError hexToOklch createBundleTranslator \
  createViewFeatureReporter ngg-reveal-highlight git-graph-libre; do
  printf '%-32s %s\n' "$marker" "$(git grep -l "$marker" upstream/main | wc -l)"
done
```

Every count must be `0`. A non-zero one is not proof of wrongdoing on its own —
check whether the name was theirs first — but it is the point at which to stop
and tell the maintainer rather than carry on reviewing. Extend the marker list
as this project grows distinctive surfaces; the ones above are all post-fork.

The rule for this branch is:

- Use this repository's own code and public API behavior as the implementation
  base. Everything written here is AGPL-3.0-or-later.
- Reimplement behavior from first principles using Git CLI documentation, VS Code
  extension APIs, and this repo's existing patterns.
- Keep implementation notes and comparisons in docs so later contributors can
  see which ideas were considered and how the clean-room boundary was handled.

## Maintainer and Agent Source of Truth

This document is the central maintainer and agentic knowledge base for the
`AI-dev` and `main` branches. `README.md` remains the public project entry
point, while agent, Claude, Codex, and other continuation files should be short
pointers here instead of duplicating rules.

### Branch and release policy

The AI/agent tooling was deliberately kept off the first `v1.0.0` release. On
`2026-07-27` the maintainer lifted that restriction for `main` and releases
starting with `v1.1.0`:

- `CLAUDE.md`, `CODEX.md`, `agents.md`, `docs/AI_DEV_KNOWLEDGE_BASE.md`, and
  `graphify-out/` may be tracked on both `AI-dev` and `main` and included in
  release-tag history. They remain development/maintenance artifacts and do not
  need to be linked from the public README or packaged into the VSIX.
- Supporting configuration such as the `/graphify-out/` ignores in `.gitignore`
  and the `graphify-out/**` Sonar exclusion may also be carried on `main`.
- After the completed `AI-dev` tree passes the full release gates, release by
  fast-forwarding `main` to that exact commit and tagging it. Keep the `AI-dev`
  branch on the remote after publication; do not delete it or rewrite its
  history merely to manufacture a separate release lineage.
- `v1.0.0` remains the historical clean first-release boundary; do not rewrite
  that tag or its history.

At the start of every agent session:

- Read `README.md` first for public project purpose, user-facing features,
  configuration, build notes, and license context.
- Then read this document for the active roadmap, clean-room rules, graphify map,
  implementation phases, current work order, verification expectations, and
  handoff rules.
- Do not infer the next task only from chat memory, private memory, or stale
  branch context. Let the tracked project docs define the current state.
- If `graphify-out/graph.json` exists and the question is about project
  architecture, file relationships, or code flow, use graphify query/explain/path
  as a navigation aid before broad manual scanning.

Workflow rules:

- Work through the documented phases and slices unless the maintainer changes
  priority.
- Treat slices as the unit of progress. Plan remaining microsteps before coding,
  do core behavior first, then tests, UI, reports, docs, and cleanup.
- Before starting work and before every commit, run `git fetch --all --prune`,
  check whether the branch is behind, and update safely if needed.
- Never use destructive remote operations. Never force-push or rewrite shared
  history unless the maintainer explicitly requests that exact operation.
- Prefer small, atomic, reviewable commits and push normally after each coherent
  milestone unless the maintainer says not to push.
- On `AI-dev`, include a commit trailer identifying the agent, for example
  `Co-Authored-By: Codex <codex@openai.com>`. When `main` is fast-forwarded for
  a release, retain the validated commits and their trailers unchanged.
- Add or update tests for every feature or behavior change.
- Use focused checks during a slice and the documented full gate at phase
  boundaries or before calling a larger slice complete.
- Every agile slice should leave touched files cleaner than it found them:
  address existing Biome, SonarQube, type-safety, and obvious maintainability
  issues in files touched by the slice instead of knowingly carrying local debt
  forward. Keep this scoped to touched files unless the maintainer approves a
  broader cleanup.
- Prefer cohesive, narrowly scoped modules/files for new behavior instead of
  growing large catch-all files. Split code when a new helper, command surface,
  parser, view component, or workflow has its own clear responsibility and can
  be tested in isolation.
- Treat `biome.strict.jsonc` as the target rule set for all new code and any
  existing code touched in a slice. The main `biome.jsonc` is a migration bridge
  for whole-tree checks while older files are cleaned up incrementally.
- Do not use `var` in new code, and remove `var` from files touched in a slice
  by replacing it with `const` or `let`. Keep `var` only when a reviewed,
  documented function-scoped escape behavior is required.
- Use OKLCH for repo-owned visual colors in CSS and webview rendering code.
  Prefer semantic CSS custom properties for repeated colors, preserve VS Code
  theme tokens as the primary source where available, and use OKLCH fallbacks
  instead of hex, RGB, HSL, or named color literals in touched visual code.
  User-supplied colors, validation examples, external assets, and compatibility
  fixtures may keep their required formats, but document why when adding them.
- Use American English spelling in all repo code surfaces: identifiers, CSS
  classes and custom properties, setting keys, localization keys, user-facing
  strings, and new documentation ("color", not "colour"). The webview and
  CSS specs use American spelling, so mixed spellings create split
  identifier families. When touching code that still carries British
  spellings, rename it within the slice. Public setting keys renamed for this
  rule keep a legacy fallback read (see the legacy-surfaces note in the Phase 1
  slice notes) so existing user settings keep working; document every such
  fallback with its removal condition. Historical prose in this document is
  exempt; new prose follows the rule.
- Before committing code changes, run Biome over touched/staged files and fix
  findings. The default target is `pnpm run lint:strict:staged` after staging,
  or an equivalent `biome.strict.jsonc` command over the touched files before
  staging. Do not commit with known Biome failures in touched code.
- For meaningful code slices, all gates run **before the commit**. The required
  order is: strict Biome on touched files, full package/typecheck/lint, full
  tests, localization checks, fresh `pnpm run test:coverage`, then
  `pnpm run sonar:scan` and an explicit server-side quality-gate poll. Commit
  only after the SonarQube quality gate is `OK`. If any gate changes code, rerun
  every affected check plus coverage and Sonar before committing. If the server
  is unavailable or the gate cannot run, do not silently substitute a
  post-commit scan; record the exact reason and remaining risk in the handoff.
- SonarQube's local new-code definition is `Previous Version`. The
  `sonar.projectVersion` value is therefore an analysis baseline, not only a
  package-release label. Advance it deliberately when starting a stricter local
  quality-gate epoch, and document the reason in this knowledge base.
- If a full gate cannot be run, record the reason, the exact checks run instead,
  and the remaining risk.
- Update docs in the same slice as behavior changes: roadmap status,
  verification evidence, known limitations, and next steps.
- Keep generated outputs, caches, local scratch folders, and operating-system
  sidecar files out of commits unless they are intentional tracked artifacts.
- When replacing a legacy function, file, workflow, setting, compatibility path,
  or temporary bridge, remove the obsolete surface as soon as the replacement is
  verified. Do not keep parallel legacy code "just in case"; if compatibility
  requires it, document the reason, owner, and removal condition in this
  knowledge base.
- Respect recorded architecture and licensing decisions. Revisit them only when
  new evidence shows they are wrong or the maintainer redirects the plan.

Handoff rules:

- Leave the repo in a resumable state.
- Record changed files, verification commands/results, blockers, non-blocking
  risks, and the exact next slice.
- Keep agent-specific files pointer-only. If a durable rule belongs to future
  agents or maintainers, add it here instead of copying it into `AGENTS.md`,
  `agents.md`, `CLAUDE.md`, `CODEX.md`, or similar files.

## Local Inputs Reviewed

Project inputs:

- `README.md`: states the MIT fork purpose, current features, configuration, and
  license position.
- `agents.md`: original generic continuation guidance. Its durable rules have
  been centralized in this document; the file should now stay pointer-only.
- `package.json`: extension manifest, commands, settings, scripts, and toolchain.
- `src/extension.ts`: activation, webview panel setup, repo discovery, watchers,
  state, and command registration.
- `src/extension/messageHandler.ts`: central webview request/action dispatcher.
- `src/types.ts` and `src/backend/types/*`: message contracts and git data types.
- `src/backend/queries/*`: commit, branch, and commit-detail query surfaces.
- `src/backend/actions/*`: branch, tag, merge, and commit actions.
- `src/webview/main.ts`: webview state, toolbar controls, commit table rendering,
  context menus, and request flow.
- `src/webview/graph.ts`: graph layout and SVG rendering.
- `tests/**`: current unit coverage pattern for backend, extension, and webview
  behavior.

Parent recommendation briefs:

- `../FEATURE_HASHES_DISPLAY.md`
- `../FEATURE_FILTER_BY_BRANCH_TAG_AUTHOR.md`
- `../FEATURE_STASHES_MANAGEMENT.md`
- `../FEATURE_REPO_SETTINGS_MENU.md`

## Current Architecture

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
  `pnpm run sonar:scan:local` against the local server at
  `http://127.0.0.1:9000`, and provide credentials through `SONAR_TOKEN` or an
  explicit scanner property. Keep the project token outside the repo and pass
  it in by environment variable; do not commit tokens. Run
  `pnpm run sonar:auth` before using
  SonarQube CLI commands such as `pnpm run sonar:secrets`; the browser login
  must be completed by a human. Do not commit tokens, generated `.scannerwork/`
  output, generated `coverage/` output, or local SonarQube server data. The
  project key is `git-graph-libre`.
- SonarQube state on this machine (`2026-07-27`): no local server, but a remote
  one is configured and working. `sonar-scanner` `8.0.1.6346` is installed at
  `/opt/sonar-scanner`, and its global config
  `/opt/sonar-scanner/conf/sonar-scanner.properties` holds both `sonar.host.url`
  and `sonar.token` for the maintainer's private instance. Read the address from
  that file when you need it; never record the address or the token anywhere in
  this repository. Run `pnpm run sonar:scan`, not `pnpm run sonar:scan:local` —
  the latter overrides the host with `-Dsonar.host.url=http://127.0.0.1:9000`
  where nothing is listening. **Never prefix the command with an empty
  `SONAR_TOKEN=`**: the environment variable takes precedence over `sonar.token`
  from the config file, so the scan authenticates anonymously and fails with
  `HTTP 401 Unauthorized` on `/api/v2/analysis/version` even though a valid token
  is present. A `401` is not by itself evidence that no credential exists. The
  separate SonarQube CLI is absent, so `pnpm run sonar:auth`,
  `sonar:auth:status`, and `sonar:secrets` cannot run at all; those scripts still
  point at `http://127.0.0.1:9000`.
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
  would trip it. The server is Community Edition (`26.9.0`), so there is no
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

## Webview UI Styling Guide

Durable guidance for agents doing UI work in the webview. The goal is a
native-feeling VS Code surface: theme tokens first, OKLCH fallbacks second,
no raw color literals in repo-owned styles.

Token families by surface (all with `--ngg-*` OKLCH fallbacks where a theme
may not define the token):

- Dialog panel: `--vscode-editorWidget-background/-foreground/-border`,
  `--vscode-widget-shadow`; content is left-aligned; actions right-aligned in
  a `.dialogActions` flex row.
- Dialog markup contract (`showDialog()` in `src/webview/main.ts`): content in
  `.dialogContent`, buttons are `.dialogBtn` divs, the primary action carries
  `dialogBtnPrimary`, and a dismiss-only dialog promotes dismiss to primary.
  Keep ids `dialogAction`/`dialogDismiss` stable; tests and disabled-state CSS
  key off them.
- Text fields and selects: `--vscode-input-*` (`-background`, `-foreground`,
  `-border`, `-placeholderForeground`), focus ring `--vscode-focusBorder`,
  invalid state `--vscode-inputValidation-errorBackground/-errorBorder`;
  selects prefer `--vscode-dropdown-*`. Control metric: 28px height, 4px
  radius, matching `.toolbarFindInput` and `.toolbarIconButton`.
- Buttons: `--vscode-button-background/-foreground/-hoverBackground` for
  primary, `--vscode-button-secondary*` for secondary, 2px radius like native
  VS Code buttons.
- Context menus: `--vscode-menu-*` (`-background`, `-foreground`, `-border`,
  `-selectionBackground/-selectionForeground`, `-separatorBackground`), 5px
  menu radius, 3px item radius, 4px menu padding.
- Dropdown widget: control on `--vscode-dropdown-*`, option list on
  `--vscode-dropdown-listBackground` plus `--vscode-list-*` hover/selection
  tokens, filter input on the input tokens above.
- Checkboxes: `accent-color: var(--vscode-button-background, var(--ngg-accent))`.
- Icons: render icons through `octicon(name, className?)` from the generated
  `src/octicons.ts` module (16px octicons, MIT). Add names to
  `scripts/generate-octicons.js` and regenerate with `pnpm run icons:generate`;
  never hand-edit the generated file or paste raw SVG paths. Icons inherit
  color from the surrounding element via `fill="currentColor"` and can be
  recolored with CSS `fill` rules. The webview-facing catalog stays in
  `src/webview/utils/icons.ts` (`svgIcons`); octicons has no spinner, so
  `svgIcons.loading` reuses the `sync` octicon with the CSS rotation
  animation.
- Selection identity: commit rows expose their graph color through
  `--git-graph-color` (published per `data-color` index by
  `src/extension/webviewHtml.ts`). The selected row background is
  `color-mix(in srgb, var(--git-graph-color) 18%, var(--ngg-transparent))`
  (26% on hover) plus a 3px inset left accent bar, so selection matches the
  commit dot hue instead of a flat list color. Reuse this pattern for future
  per-commit emphasis instead of introducing new solid selection colors.
- Graph palette: defaults are OKLCH with uniform lightness and chroma and
  hue-only variation (`oklch(59% 0.21 <hue>)`, 12 hues). Keep any palette
  change uniform in L/C unless the maintainer asks otherwise; users may still
  configure HEX/RGB/OKLCH values. The defaults live in two places that must
  stay identical: the manifest default for `git-graph-libre.graphColors` and
  `DEFAULT_GRAPH_COLORS` in `src/config.ts`. Earlier lightness values quoted in
  the dated slice notes below are historical.
- CSS regression coverage lives in `tests/webview/dialogStyles.test.ts` and
  `tests/webview/tableStyles.test.ts`; extend those when adding UI styles.

## Graphify Map

Regenerated on `2026-07-29` from the current `AI-dev` working tree based on
commit `ff8b744` at `2,045` nodes / `4,819` edges / `126` communities;
`graph.json` records that base in `built_at_commit` while its nodes and edges
include the uncommitted Phase 15 tag slice. Refresh after code changes with
`graphify update .` then `graphify tree`, and if a query looks stale compare
`built_at_commit` against `git rev-parse HEAD` and inspect the working tree.

Artifacts in this repository:

- `graphify-out/graph.json`: code graph for this repository (tracked).
- `graphify-out/GRAPH_REPORT.md`: generated graph report (tracked).
- `graphify-out/GRAPH_TREE.html`: HTML tree view, regenerated by `graphify tree`
  (tracked).
- `graphify-out/graph.html` and `graphify-out/manifest.json`: written by newer
  graphify versions. `graph.html` duplicates the tree view under the tool's own
  default name, and `manifest.json` is the per-file extraction cache keyed by
  mtime, so both are ignored alongside `.graphify_*` and `cache/`.

Scope and limitations:

- AST-only. No semantic extraction runs because no LLM API key is configured, so
  token cost is `0 input / 0 output`.
- Useful for architecture and navigation queries over symbols, imports, calls and
  structural relationships. It is not evidence of product semantics in
  README/docs/images.

Refreshing the graph:

```bash
graphify update .          # re-extract this repo (AST only, no API cost)
graphify tree              # regenerate graphify-out/GRAPH_TREE.html
```

Useful graph commands:

```bash
graphify query "loadCommits requestLoadCommits GitGraphView" \
  --graph graphify-out/graph.json

graphify explain "loadCommits" \
  --graph graphify-out/graph.json

graphify path "src/webview/main.ts" "src/backend/queries/loadCommits.ts" \
  --graph graphify-out/graph.json
```

Query tip: the current map is AST-only, so symbol names work better than broad
natural-language product questions. For example, `graphify explain "loadCommits"`
resolves the neo backend query at `src/backend/queries/loadCommits.ts` and shows
its imports/calls.

## Implementation Roadmap

Phase status overview (audited `2026-07-03` after Phase 14 verification;
per-phase `Status:` lines below carry the same verdicts — update both
together):

| Phase | Status |
| --- | --- |
| 0 Guardrails and baseline | Complete |
| 0.5 Backend robustness | Complete |
| 1 UI/UX foundation refresh | Complete |
| 2 Commit details UX | Partial — docked-bottom details mode remains |
| 3 Commit hash display | Complete |
| 4 Find, search, keyboard navigation | Complete |
| 5 Branch, tag, and author filters | Complete |
| 6 Repo settings and view options | Mostly complete — initial-branches-on-load remains |
| 7 Stash management | Partial — actions done; graph stash rows remain |
| 8 Comparison and multi-select | Partial — compare-with-HEAD and multi-select done; arbitrary two-commit/ref comparison and external directory diff remain |
| 9 Repository and remote management | Mostly complete — repository dropdown ordering preference remains |
| 10 Advanced history, text, integrations | Partial — issue links, config export, archive, commit and tag signature status done (tag signatures in Phase 15); text rendering, mailmap, code review, encoding remain |
| 12 Toolbar dropdown name truncation and find row | Complete |
| 13 Settings hub: tabbed widget, color editor, settings export | Complete |
| 14 Reveal highlight: persistent blink and configurable color | Complete |
| 15 Tag surfaces: signed-tag distinction and remote tag deletion | Complete |
| Immediate TODOs bug backlog (BUG-1 … BUG-6, `2026-08-25`) | Complete (`2026-08-25`; see the per-entry implementation records) |

### Phase 0: Guardrails and Baseline

**Status: complete.**

Goal: make future implementation reviewable and MIT-clean.

- Keep this knowledge base updated when a feature plan changes.
- Before code work, run a baseline `pnpm` check set if dependencies are present:
  `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and
  `pnpm run l10n:check`.

Acceptance:

- `AI-dev` branch exists.
- `README.md` deliberately does **not** link to this knowledge base; see Branch
  containment.
- This document names source boundaries and current integration points.

### Phase 0.5: Backend Robustness and Data-Source Foundation

**Status: complete.**

Goal: strengthen the extension host, Git data flow, and repository watchers
before adding broader Git operations.

Implementation plan:

- Harden `src/extension/webviewBridge.ts` so watcher unmute always happens in a
  `finally` block, and so unexpected handler errors are logged and surfaced
  through typed responses where possible.
- Treat `simple-git` as an interim transport. New Phase 0.5 work should use
  explicit raw Git commands through `gitRunner`, and should reduce high-level
  `simple-git` parser usage when touching nearby code.
- Add request or refresh ids for async branch, commit, and future repo-info
  loads so stale Git responses cannot overwrite newer UI state.
- Replace brittle newline/text-separator parsing with NUL or record-separated
  formats for log, refs, diff name-status, diff numstat, and future stash data.
- Add a focused `loadRepoInfo` query that returns repo validity, branch head,
  remotes, stashes count/list, and config summary needed by later phases.
- Rework `RepoFileWatcher` to use `vscode.RelativePattern` and a separate
  `.git/**` watcher, while preserving the existing debounce/mute behavior.
- Revisit activation events so the extension can activate on relevant commands or
  Git workspaces instead of always relying on `onStartupFinished`, if that does
  not regress repo discovery.
- Add a small command-manager layer only if it reduces extension-shell growth for
  active-editor repo opening, manual add/remove repo, version diagnostics, and
  future fetch/search commands.

Acceptance:


### Phase 1: UI/UX Foundation Refresh

**Status: complete** — toolbar, status strip, sticky headers with column show/hide, density settings, theme-native dialogs/menus/dropdowns, and selection styling all landed.

Why early: the user-facing surface is currently the weakest part of the MIT fork.
After the Phase 0.5 robustness baseline, visible UX work should come before
adding advanced Git features so the product does not become more complicated
without feeling better.

Implementation plan:

- Extract toolbar rendering from `buildWebviewHtml()` into a small, testable
  webview layout surface.
- Replace text-only `roundedBtn` controls with compact icon+tooltip buttons for
  refresh, jump-to-HEAD, search, repo settings, and future fetch actions.
- Add a persistent action/status strip for loading, refreshing, and running Git
  actions.
- Add sticky table headers and clear focus/hover/selected states using VS Code
  theme variables.
- Add configurable `graph.fontSize` and `graph.rowHeight` equivalents under the
  `neo-git-graph` namespace.
- Keep the first pass visually restrained and work-focused: dense, readable,
  theme-native, no decorative hero/card layout.

Acceptance:

- Existing commit loading, branch selection, remote toggle, refresh, and locate
  HEAD still work.
- Text does not overlap at narrow webview widths.
- Toolbar buttons have accessible labels/tooltips.
- Focus, hover, loading, and disabled states are visible.
- Webview rendering tests cover the new toolbar structure.


### Phase 2: Commit Details UX

**Status: partially complete** — split renderer, collapse/expand, tree/list and compact-folder modes, resizable height, safe linkification, and file actions are done. Remaining: the docked-bottom commit-details mode.

Goal: make inspecting a commit feel usable before adding comparison/review
features.

Implementation plan:

- Split commit details into summary and file-list components.
- Add collapse/expand controls for summary and file changes.
- Add file tree/list mode and compact-folder option.
- Add resizable inline details height before experimenting with docked layouts.
- Add docked-bottom details mode after inline details remains stable.
- Add clickable URLs in commit body using a safe linkifier.
- Add copy file path and open current file actions from the file list.

Acceptance:

- Current diff opening still works.
- Long messages and long paths remain readable and do not break layout.
- Details can be closed, collapsed, and resized with mouse and keyboard.
- Tests cover tree/list rendering, URL escaping/linking, and action messages.


### Phase 3: Commit Hash Display Hardening

**Status: complete.**

Why here: the repo already has almost all underlying data, so this remains a
low-risk data/UI slice after the visual shell is improved.

Implementation plan:

- Add a `shortHashLength` setting with a conservative default such as `8` or keep
  the current `abbrevCommit()` length if existing behavior should remain stable.
- Add a small helper that derives display hashes from the full hash.
- Consider adding `displayHash` to `GitCommitNode` only if multiple render paths
  need it; otherwise keep the model simple and derive in the webview.
- Ensure row `data-hash`, title text, context actions, copy actions, and backend
  requests keep using full hashes.
- Add tests for short hash derivation and rendering behavior.
- Update `package.nls*.json`, `l10n/*.json`, and README configuration docs if a
  new setting is added.

Acceptance:

- Users can see a predictable short hash.
- Full hash remains available through title/data attributes and all actions.
- Changing short length triggers a consistent refresh or rerender.

Slice progress:

- `2026-07-02`: Completed the Phase 3 configurable short-hash display slice.
  Added `neo-git-graph.shortHashLength` with bounded package metadata and
  English, Polish, zh-CN, and zh-TW package descriptions. The shared
  `abbrevCommit()` helper now clamps display lengths and is used by the webview
  and diff-title path; row `data-hash`, commit-cell title attributes,
  copy-to-clipboard payloads, backend action requests, and diff document
  revisions continue to use the full hash. README now documents the setting.
  Verified with:
  - `pnpm run typecheck`
  - `pnpm exec vitest run tests/backend/config.test.ts tests/backend/manifest.test.ts tests/backend/utils/string.test.ts --project backend`
  - `pnpm exec vitest run tests/webview/webviewHtml.test.ts tests/webview/rendering.test.ts tests/webview/messageHandler.test.ts tests/webview/commitDetailsListMode.test.ts tests/webview/graph.test.ts --project webview`
  - `pnpm run l10n:check`
  - `pnpm run package`
  - `pnpm run test`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings --max-diagnostics=300 <touched TypeScript files>`
  - `rg -n "\bvar[[:space:]]+" <touched TypeScript files>` produced no
    JavaScript `var` declaration matches.
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task `7804a9c8-4a0a-454e-b7c1-779bd33b512d`; SonarQube quality
    gate `OK`, new coverage `85.4%`, new violations `0`.

### Phase 4: Find, Search, and Keyboard Navigation

**Status: complete** — loaded-commit find widget, graph keyboard map, and the full-history `searchCommits` command are all implemented.

Goal: let users move around history quickly without visually scanning the whole
table.

Implementation plan:

- Add a find widget for loaded commits: message, author, email, hash, branch
  names, and tag names.
- Add next/previous match navigation and row highlighting.
- Add jump-to-HEAD as a first-class command/button if the head commit is loaded.
- Add keyboard shortcuts for find, refresh, jump-to-HEAD, close, and commit
  details up/down navigation.
- Add a full-history search command that runs a Git query beyond loaded commits.

Acceptance:

- Search does not mutate loaded graph data.
- Empty/no-results states are clear.
- Short and full hashes both match.
- Keyboard behavior does not interfere with text inputs/dialogs.

Slice progress:

- `2026-07-02`: Added the first loaded-commit find widget slice. The toolbar now
  exposes a compact find control with localized labels, match counts,
  previous/next navigation, clear behavior, and Ctrl/Cmd+F plus F3 keyboard
  handling that avoids text inputs and active dialogs. Matching is client-side
  over already loaded commits only, covering subject, author, email, full hash,
  configured short hash, branch names, and tag names without mutating commit
  data or sending new load requests. Find matches are highlighted with VS Code
  theme tokens and OKLCH fallbacks, while the active match is preserved by hash
  across commit reloads. While touching `src/webview/main.ts`, fixed local
  Sonar findings for constructor-only fields, nested ternary flow, negated match
  count logic, and the existing uncommitted-count regex call. Verified with:
  - `pnpm exec vitest run tests/webview/commitFind.test.ts tests/webview/webviewToolbar.test.ts tests/webview/rendering.test.ts tests/webview/tableStyles.test.ts --project webview`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings --max-diagnostics=300 <touched files>`
  - `rg -n "\bvar[[:space:]]+" <touched TypeScript files>` produced no
    JavaScript `var` declaration matches.
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run package`
  - `pnpm run l10n:check`
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task `ed41da47-6e25-46f3-abb3-3089a23ff3e3`; SonarQube quality
    gate `OK`, new coverage `85.2%`, new duplicated-lines density `0.16713`,
    new violations `0`.
- `2026-07-02`: Added graph keyboard navigation as a small resolver module plus
  webview wiring. `src/webview/keyboardShortcuts.ts` maps keydown events to
  typed actions with guards for dialogs, the context menu, and editable
  targets; `Ctrl/Cmd+R` refreshes, `Ctrl/Cmd+H` jumps to HEAD (scroll and
  blink, now shared with the locate-HEAD button), `Escape` closes the find
  widget before commit details, and plain `ArrowUp`/`ArrowDown` step through
  open commit details across loaded commits, skipping the uncommitted-changes
  row and keeping row focus. Escape/`Ctrl+F` handling now also stays inert
  while the context menu is open instead of racing its keyup close path.
  README documents the shortcut map. While running the tree-wide gate, fixed
  a pre-existing `src/webview/graph.ts` formatting drift against the default
  Biome config (format-only hunk). Verified with:
  - `pnpm exec vitest run --project webview tests/webview/keyboardShortcuts.test.ts tests/webview/keyboardNavigation.test.ts`
  - `pnpm run typecheck`
  - `pnpm exec biome format --write --config-path biome.strict.jsonc <touched files>`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings --max-diagnostics=300 <touched files>`
  - `rg -n "\bvar[[:space:]]+" <touched TypeScript files>` produced no
    JavaScript `var` declaration matches.
  - `pnpm run format`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run package`
  - `pnpm run l10n:check`
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task; SonarQube quality gate `OK`, new coverage `87.5%`, new
    duplicated-lines density `0.1467`, new violations `0` (an initial scan
    flagged `S3776` cognitive complexity in the resolver; it was split into
    focused helpers and rescanned to `OK`).
- `2026-07-02`: Added full-history commit search as the final Phase 4 search
  slice. `src/backend/queries/searchCommits.ts` uses explicit Git CLI log
  queries through `gitRunner`, NUL-separated pretty-format parsing,
  fixed-string message search, escaped author/email search, optional hash-prefix
  lookup, and a same-order all-refs position map that tells the webview how many
  commits must be loaded to reveal a selected result. The toolbar find control
  now has a localized "Search full history" button, the command palette exposes
  `neo-git-graph.searchCommits`, and selected results switch to all-branches
  view, load enough history, scroll to the commit, focus the row, and blink it.
  Empty and failure states are surfaced through the existing dialog/status-strip
  patterns. An initial Sonar scan flagged five touched-file findings
  (`.at(-1)`, `Number.parseInt`, `String.raw`, `startsWith`, and `for-of`);
  each was fixed before the final scan. Verified with:
  - `pnpm exec vitest run --project backend tests/backend/queries/searchCommits.test.ts tests/backend/manifest.test.ts`
  - `pnpm exec vitest run --project webview tests/webview/webviewToolbar.test.ts tests/webview/commandManager.test.ts tests/webview/messageHandler.test.ts tests/webview/rendering.test.ts`
  - `pnpm exec biome check --write --config-path biome.strict.jsonc <touched files>`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings --max-diagnostics=300 <touched files>`
  - `rg -n "\bvar[[:space:]]+" <touched TypeScript files>` produced no
    JavaScript `var` declaration matches.
  - `pnpm run typecheck`
  - `pnpm run l10n:check`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run package`
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task `bae7e1b6-2536-4a89-a9e5-2289d95e5d2e`; SonarQube quality
    gate `OK`, new coverage `87.6%`, new duplicated-lines density `0.11867`,
    new violations `0`.
- `2026-07-02`: Ran `sonar list issues -p neo-git-graph` and cleaned all
  unresolved medium-or-higher Sonar issues in touched files across backend,
  extension host, scripts, and webview code. Refactored complex parsing,
  rendering, watcher, and dropdown handlers into focused helpers; removed
  remaining `var`-style and legacy JS API findings; added webview message origin
  validation and coverage for dialog/context-menu flows. Security hotspots were
  reviewed explicitly: CSP nonces now use `crypto.randomBytes`, regex hotspots in
  l10n placeholder scanning, git credential redaction, and repo watcher path
  filtering were replaced with deterministic scans/prefix checks, the local
  avatar cache filename hash was moved to SHA-256, the shipped GitLab
  `Private-Token` header was removed, and the remaining Gravatar MD5 hotspot was
  marked `REVIEWED`/`SAFE` in SonarQube with a comment explaining that it is
  required by the Gravatar lookup protocol and is not used for passwords,
  integrity, signatures, random generation, or authorization.
  Verified with:
  - `pnpm exec vitest run --project backend tests/backend/utils/gitRunner.test.ts tests/backend/utils/nonce.test.ts`
  - `pnpm exec vitest run --project webview tests/webview/rendering.test.ts tests/webview/repoFileWatcher.test.ts`
  - `node ./scripts/check-l10n.js`
  - `pnpm exec biome format --write <touched files>`
  - `pnpm exec biome lint --config-path biome.strict.jsonc --error-on-warnings <touched files>`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run compile-tests`
  - `pnpm run package`
  - `pnpm run test:coverage`
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token) SONAR_HOST_URL=http://127.0.0.1:9000 pnpm run sonar:scan:local`
    submitted task `6c04bdb2-73fa-436e-8852-f9adbb9fcdb9`; current
    SonarQube project quality gate `OK`, new coverage `80.7%`, reviewed
    hotspots `100%`, new duplicated-lines density `0.0`, new violations `0`,
    and unresolved medium-or-higher issues `0`.

### Phase 5: Branch, Tag, and Author Filters

**Status: complete** — multi-branch selection with glob presets plus tag and author filter dropdowns combine with AND semantics (`a1d2bc9` and follow-ups).

Goal: narrow the graph with AND-based filters while preserving predictable graph
state.

Implementation plan:

- Add a `CommitFilter` type with optional `branch`, `tag`, and `author` fields.
- Extend `loadCommits` request input to carry filters, or add a separate filter
  state message if the first slice only filters in the webview.
- Prefer Git-side filtering for branch and author on large histories. Keep a
  client-side fallback only when it is simpler and covered by tests.
- Build branch options from existing `loadBranches`.
- Build tag options from `GitRef` entries of type `tag` or a new lightweight ref
  query if needed.
- Build author options from the currently loaded commits at first; later add a
  dedicated author query if large repos need it.
- Normalize author comparisons by trimming and case-folding names/emails.
- Render active filters in the toolbar and keep empty filters as no-ops.
- Debounce text/search inputs if author filtering is free-form.

Acceptance:

- Multiple filters combine with AND semantics.
- Clearing filters restores the unfiltered graph for the selected repo/branch.
- Tests cover branch-only, tag-only, author-only, combined filters, and empty
  filter behavior.

### Phase 6: Repo Settings and View Options

**Status: mostly complete** — the repository settings modal covers display-name override, per-repo view toggles (stashes, tags, reflog and unreachable commits, first parent, remote branches), user details, remotes, issue linking, and config export. The all-branches view also keeps a detached HEAD visible. Remaining: initial-branches-on-load selection.

Goal: keep the toolbar clean while still exposing repo-scoped rendering options.

Implementation plan:

- Add `RepoSettings` type, for example `{ showTags, showRemotes, showRemoteHeads,
  showStashes, showUncommittedChanges, rowHeight, fontSize }`.
- Add `ExtensionState` helpers for repo settings.
- Use absolute repo path as the first repo key because the extension already
  tracks repos by path. Optionally normalize remote URL later for portability.
- Add `loadRepoSettings` and `saveRepoSettings` messages.
- Add a small webview menu/toggle surface scoped to the active repo.
- Apply settings to existing data flow:
  - `showRemotes` can map to the existing remote branch visibility.
  - `showTags` can filter rendered tag refs or query refs differently.
  - `showStashes` can control the stash UI from Phase 7.
  - row height/font size can feed CSS variables.

Acceptance:

- Switching repos loads each repo's own settings.
- Changes persist across webview reloads.
- Settings changes rerender without restarting the extension.
- The settings UI remains compact and does not dominate the graph.

Slice progress:

- `2026-07-27`: Hardened the all-branches graph and ref labels. The default
  revision set now explicitly includes `HEAD` with `--ignore-missing`, so a
  checked-out detached commit remains visible even when no branch or tag points
  to it. Added opt-in `repository.includeUnreachableCommits` discovery using a
  read-only `git fsck --unreachable --no-reflogs --connectivity-only` scan; it
  applies only to Show All, is persisted globally or per repository, and is
  available as a checked item in the table-header context menu. Matching local
  and remote branches on the same commit now render as one segmented badge with
  the local name followed by compact remote-name segments; every underlying ref
  retains its own tooltip, checkout behavior, and context-menu actions. The UI
  was reimplemented from this repository's own ref model after reviewing only
  the referenced project's public feature description and supplied screenshot;
  no source code from the referenced project was consulted or copied. Renamed
  the internal webview type namespace from `GG` to the project-specific `GGL`
  across declarations, runtime source, and test fixtures.

  Verification:
  - `git fetch --all --prune` (branch level with `origin/AI-dev` before work)
  - strict Biome format and lint checks over all `49` touched/new TypeScript,
    JSON, and CSS files passed with warnings treated as errors
  - `pnpm run format` reported only six pre-existing format drifts in untouched
    files: `.vscode/settings.json`, `tests/backend/avatarManager.test.ts`,
    `tests/backend/diffDocProvider.test.ts`, `tests/backend/manifest.test.ts`,
    `tests/backend/statusBarItem.test.ts`, and `tests/webview/utils/dom.test.ts`
  - `pnpm run package` passed (TypeScript, whole-tree Biome lint, and production
    extension/webview builds); the only lint output was the existing Biome
    schema-version information (`2.5.2` configuration vs `2.5.5` CLI)
  - `pnpm run test` passed: backend `42` files / `299` tests and webview `34`
    files / `283` tests
  - `pnpm run test:ext` passed all `49` extension-host tests after the extension
    test TypeScript config was given explicit local aliases compatible with
    TypeScript 6
  - `pnpm run l10n:check` passed with `100%` package and bundle coverage for
    `pl`, `zh-cn`, and `zh-tw`
  - `pnpm run test:coverage` passed: `76` files / `582` tests, with raw LCOV
    line coverage `91.9%`, branch coverage `77.7%`, and function coverage
    `89.1%`
  - `graphify update .` and `graphify tree` rebuilt the tracked map at `2,023`
    nodes / `4,758` edges and regenerated `GRAPH_TREE.html`
  - Pre-commit SonarQube scans were run from the completed working tree with
    fresh LCOV. The first scans exposed inherited maintainability findings and
    an uncovered extension-host path; both were fixed and all affected gates
    were rerun. Final task `1d55f137-4655-4902-a28d-e2af75ccf720`, analysis
    `47796099-6a08-435b-a519-551af75bfbc4`, passed the `ZAM` quality gate:
    new coverage `88.2%`, new duplicated-lines density `0.0%`, and `0` new or
    unresolved issues. Project-wide maintainability issues/effort,
    reliability issues, and security issues were also all `0`.

### Phase 7: Stash Management

**Status: partially complete** — stash data loading (behind the per-repo toggle) and the apply/pop/drop/branch/stash-uncommitted action suite are done (`6750480`). Remaining: rendering stashes as rows/labels inside the graph itself.

Goal: display stashes and provide safe apply, pop, and drop actions.

Implementation plan:

- Add `GitStash` type with `index`, `ref`, `message`, and optional author/date.
- Add stash data through the Phase 0.5 Git runner or `loadRepoInfo` path, using a
  NUL or record-separated parser robust enough for stash messages.
- Add backend actions `applyStash`, `popStash`, and `dropStash`.
- Require confirmation before `dropStash` and probably before `popStash`.
- On success, refresh stashes and commits; on failure, keep UI state unchanged
  and surface the git error message.
- Add a first UI slice as a compact stash section near the toolbar or footer,
  then later consider graph placement.

Acceptance:

- Empty stash list renders cleanly.
- Apply/pop/drop target the selected `stash@{n}`.
- Drop requires confirmation.
- Conflict/failure messages are visible and do not mutate the displayed stash
  list optimistically.

### Phase 8: Commit Comparison and Multi-Select

**Status: partially complete** — multi-commit selection with squash/drop (`15a1967`) and compare-with-HEAD (`8fc95ef`) are done. Remaining: arbitrary two-loaded-commit and ref-to-ref comparison, and external directory diff.

Goal: compare two commits without importing non-MIT behavior.

Implementation plan:

- Add explicit selection state in the webview.
- Add a backend query for changed files between two commit hashes using Git diff
  commands.
- Reuse the existing `DiffDocProvider` path for per-file diffs.
- Start with two-commit comparison only; leave broader multi-select actions for a
  later slice.

Acceptance:

- Selecting two commits shows a comparison view.
- File diffs open through the existing diff provider.
- Tests cover query parsing and selection-state transitions.

### Phase 9: Repository and Remote Management

**Status: mostly complete** — remotes-gated fetch (`88a7176`), upstream-aware push/pull/fetch-into-local with delete-on-remote (`5966cf3`), the remotes CRUD popup (`693f6eb`), add/remove repo commands, and full-path tooltips are done. Remaining: a repository dropdown ordering preference.

Goal: make multi-repo work and remote operations available without bloating the
main graph table.

Implementation plan:

- Add manual add/remove repository commands for sub-repos.
- Add open-to-active-editor-repo behavior.
- Add repository dropdown ordering and full-path tooltips.
- Add fetch from remote(s) with prune/prune-tags options through the Phase 0.5
  Git runner so progress, logging, and errors are consistent.
- Add remote list management in the repo settings menu.
- Add pull/push branch actions only after fetch/remotes are stable.

Acceptance:

- Remote actions only appear when relevant remotes exist.
- Running actions shows progress and preserves scroll position.
- Errors are surfaced with the command context and git output.

### Phase 10: Advanced History, Text, and Integrations

**Status: partially complete** — issue linking, repo config export/import sharing (`7a18099`), ref archives (`b4d97fe`), commit signature status, and tag signature status (Phase 15, `2026-07-29`) are done. Remaining: markdown/emoji message rendering, inline commit body, `.mailmap` support, code-review state, file encoding setting, and an uncommitted-changes details view.

Goal: close feature gaps after the core UX is strong.

Implementation plan:

- Add markdown, URL, and emoji-shortcode rendering behind safe parsing helpers.
- Add optional inline commit body display.
- Add uncommitted-changes details and compare-to-commit.
- Add issue linking and pull request provider configuration.
- Add commit/tag signature status.
- Add code-review state for commit details/comparison.
- Add external directory diff only after the file details model is robust.

Acceptance:

- Each advanced feature has a toggle or clear entry point.
- Unsafe HTML is not introduced.
- Tests cover parsing, escaping, and message contracts.

Slice progress:

- `2026-07-27`: Added commit signature status as an opt-in table column.
  `GitCommitSignature` carries a normalized `status` mapped from `git log %G?`
  (`G`, `U`, `B`, `X`, `Y`, `R`, `E`, plus `unknown` for anything unrecognized)
  alongside `%GS` signer and `%GK` key. `%G?`/`%GS`/`%GK` are appended to the log
  format only when `showSignature` is requested, so an unsigned or
  signature-blind repository pays no verification cost; `signature` is therefore
  `undefined` when the query skipped it and `null` when the commit is unsigned.
  The column is hidden unless `git-graph-libre.columns.signature` is on
  (default `false`), can be toggled per-session from the table header context
  menu, and reacts to live setting changes. Persisted column visibility is
  versioned with `COLUMN_VISIBILITY_STATE_VERSION` so the new default replaces
  stale saved state instead of resurrecting it. In the same slice,
  `GitCommitDetails` gained `authorDate`, `committerEmail`, and `committerDate`
  in place of the single `dateType`-dependent `date` field, so commit details
  render author and committer rows independently and collapse to one Date row
  only when both identity and date match. Verified with:
  - `git fetch --all --prune` (branch level with `origin/AI-dev`)
  - `pnpm run typecheck`
  - `pnpm run lint` (`176` files; one pre-existing `biome.jsonc` schema-version
    info, `2.5.2` against CLI `2.5.5`)
  - `pnpm run lint:strict:staged` (`34` files, clean)
  - `pnpm run test` (backend `37` files / `195` tests; webview `30` files /
    `244` tests)
  - `pnpm run l10n:check` passed with `100%` package and bundle coverage for
    `pl`, `zh-cn`, and `zh-tw`
  - `pnpm run package`
  - `pnpm run test:coverage` (`67` files / `439` tests, `coverage/lcov.info`
    written)
  - Fixed one stale assertion found by the gate: `tests/backend/manifest.test.ts`
    still required an `onCommand:` activation event per contributed command after
    those entries were dropped from the manifest. With `engines.vscode`
    `^1.98.0`, VS Code generates that activation implicitly, so the test now
    asserts no `onCommand:` events are listed instead.
  - SonarQube scan of committed revision `a20cd94`, analysis
    `68c1e955-1fb8-45c7-935f-5efb2b5684aa`: quality gate **ERROR**.
    `new_violations` `1` against a threshold of `0` and `new_coverage` `80.7%`
    against a threshold of `90%` both failed; `new_duplicated_lines_density`
    `0.0` passed.
  - The one violation was `typescript:S3776` in
    `src/backend/queries/loadCommits.ts`: `getLog` reached cognitive complexity
    `17` against the `15` allowed once signature handling was added. Fixed by
    splitting it into `buildLogFormat`, `buildLogArgs`, and `parseLogEntries`,
    which also resolved `typescript:S7755` on a line the split moved
    (`fields.at(-1)` in place of `fields[fields.length - 1]`). No behavior
    change; the full suite still passes at `67` files / `439` tests.
  - The coverage condition was not a property of this slice. With
    `sonar.projectVersion` still `1.0.0` the `Previous Version` window reaches
    back to the `0.4.1-ai-dev` analysis of `2026-07-03`, covering 16,408 new
    lines with `465` uncovered of `3,121` to cover. The maintainer chose to close
    it with coverage work rather than by advancing the version, so the baseline
    still starts at `0.4.1-ai-dev`.
  - Closed by covering the modules that had no tests at all: `avatarManager`
    (cache and staleness rules, remote-source detection, and the full GitHub and
    GitLab response branches with their rate-limit and back-off paths),
    `statusBarItem`, `diffDocProvider`, `l10n`, the output-channel logger, every
    `config` accessor, and two untested areas of `main.ts` — commit-table column
    resizing and the repository settings widget actions. Test count went from
    `423` to `566`; line coverage reached `92.1%` and blended line-and-branch
    coverage `86.2%`.
  - Final gate on revision `a6410e01`: **`OK`** — `new_coverage` `85.0%` against
    the `85%` threshold, `new_violations` `0`, `new_duplicated_lines_density`
    `0.0`. Note the threshold was `90%` earlier in this slice and the maintainer
    lowered it to `85%`; read the current value from the server rather than
    assuming either number.
  - Coverage sits barely above the threshold, so the next slice that adds
    lightly-tested code will push `new_coverage` back under it. The largest
    remaining pools are `src/webview/main.ts` (`265` uncovered lines),
    `src/avatarManager.ts` (`24`), and `src/extension/messageHandler.ts` (`25`).
  - `2026-07-27`, follow-up: the maintainer added project-wide conditions to the
    gate, which then failed on `software_quality_reliability_issues` `5`. All five
    were `typescript:S7781` (`String#split().join()` where `String#replaceAll()`
    belongs) in `src/backend/actions/file.ts`, `src/backend/actions/commit.ts`,
    and three places in `src/webview/main.ts` — none introduced by this slice;
    they dated from `2026-07-01` and `2026-07-02`. Replaced with `replaceAll`,
    which takes a literal string here and so keeps the deliberate
    no-regex-backtracking property of the CRLF helpers. Gate on revision
    `fb05e6a`: **`OK`** on all five conditions — `new_coverage` `85.0%`,
    `new_duplicated_lines_density` `0.0`, `new_violations` `0`,
    `software_quality_reliability_issues` `0`,
    `software_quality_security_issues` `0`.
  - Correction for future agents: an earlier attempt in this slice reported the
    gate as unrunnable after a `401`. That was wrong — the command had been
    prefixed with an empty `SONAR_TOKEN=`, which overrode the valid
    `sonar.token` in the scanner config. See the SonarQube notes under Current
    Architecture.

### Phase 12: Toolbar Dropdown Name Truncation and Find Row (Bug)

**Status: complete.** Implemented on `2026-07-03` as the first
maintainer-priority slice; Phase 13 is the next required slice.

Goal: stop the toolbar from jumping when Show Remote Branches is toggled, and
keep the branch/author/tag dropdowns compact regardless of how long option
names are, without hiding the parts of a name that distinguish it. Give the
find widget its own toolbar row instead of squeezing into the filter row.

Bug analysis (verified `2026-07-03`):

- `Dropdown.render()` in `src/webview/dropdown.ts` sets the control width from
  `measuredCurrentValueWidth()`, which measures the open menu — i.e. the
  widest option name. The `2026-07-03` fix clamped that measurement to
  `min(max(menuWidth + pad, 130), 300)`, but the width still depends on menu
  content, so toggling Show Remote Branches flips the branch control between
  ~130px (short local names) and the 300px cap, and the whole toolbar reflows
  — this is the residual jump the maintainer reproduced.
- Case study, this repository's own remotes (`git branch -r`):
  - `origin/dependabot/github_actions/actions/checkout-7` (51 chars)
  - `origin/dependabot/github_actions/actions/setup-node-6` (53 chars)
  At 13px these render wider than the 300px control cap, so the menu is also
  much wider than the control. Note the distinctive part (`checkout-7` vs
  `setup-node-6`) is at the END of the name while the shared prefix
  (`origin/dependabot/github_actions/actions/`) dominates the width — plain
  CSS `text-overflow: ellipsis` (end-truncation) would render both as
  `origin/dependabot/github_act…` and make them indistinguishable.

Implementation plan (precise, for the implementing agent):

1. Add a display-truncation helper in a new cohesive module
   `src/webview/utils/truncate.ts`:
   - `truncateRefName(name: string, maxChars: number): string` — segment-aware
     middle truncation for `/`-separated ref names: always keep the first
     segment (remote/namespace, e.g. `origin`) and as many trailing segments
     as fit, replacing the squeezed middle with a single `…` (U+2026), e.g.
     `origin/…/actions/setup-node-6`. If the tail alone exceeds the budget,
     fall back to plain middle truncation that preserves both the start and
     the end of the string (`origin/depend…node-6`), never end-truncation.
   - `truncateMiddle(name: string, maxChars: number): string` — the plain
     start+end middle truncation, used directly for author names/emails
     (their distinctive part can be at either end) and as the ref fallback.
   - Pure string functions, no DOM; return the input unchanged when
     `name.length <= maxChars`.
2. Apply it in `src/webview/dropdown.ts` at render time only:
   - `renderOption()` renders the truncated display name but keeps the FULL
     name in the option `title` tooltip (extend the existing `showInfo` title
     handling so every truncated option gets a tooltip even when `showInfo`
     is off) and the full value in `data-id`/callback plumbing (unchanged).
   - `selectedNames()` (the control text) truncates each selected name before
     joining so multi-select summaries stay short; the control keeps its
     full-value `title`.
   - Filtering (`filter()`) must keep matching against the FULL
     `option.name`, not the truncated display, so typing `setup-node` still
     finds the truncated entry.
   - Pick the char budget as a named constant (suggest `40` for refs, `30`
     for authors) in the dropdown construction sites in
     `src/webview/main.ts`; wire it as a `Dropdown` constructor option so the
     repo dropdown (paths, already tooltipped) can opt out or use a larger
     budget.
3. Make the control width independent of menu content so the toolbar can
   never jump on data changes:
   - Delete `measuredCurrentValueWidth()` and the inline
     `currentValueElem.style.width` assignment in `render()` (including the
     measurement dance with `menuElem.style.cssText` where it exists solely
     for measuring). Per the repo rule on obsolete surfaces, remove the
     leftovers in the same slice: the measurement comment block and the
     `tests/webview/dropdown.test.ts` cases "keeps the control width stable
     across repeated renders" and "caps the control width so wide menus
     cannot stretch the toolbar" must be replaced by the new behavior tests.
   - Give the controls stable CSS widths instead, in `media/main.css`
     toolbar rules: each `.toolbarGroup .dropdown` gets a fixed flex basis
     per selector (suggest branch 200px, author 160px, tag 140px, repo
     220px), `min-width` floor 130px (filter input usability), and the
     existing `max-width: 100%` + `.dropdownCurrentValue` ellipsis for narrow
     windows. The menu keeps `min-width: 100%` and may be wider than the
     control (it is a popup; it must not affect layout). Verify the 640px
     media query still lets groups share rows.
4. Keep truncation out of every non-display path: request payloads, saved
   state, context-menu actions, and find/filter logic all keep full names.
   `escapeHtml` runs on the truncated display string; tooltips escape the
   full value (existing `escapeAttribute`/`escapeHtml` helpers).
5. Find widget on its own toolbar row (maintainer, `2026-07-03`): the open
   find widget (`#findControl` in `src/extension/webviewToolbar.ts`) already
   wraps onto a second line in most window widths, so make that the designed
   behavior instead of a fold: when visible, it takes a full second row of
   `#controls` (CSS `flex-basis: 100%` plus `order` so it always renders as
   the last row, or a dedicated `#findRow` container inside the toolbar —
   prefer whichever keeps `buildWebviewToolbar()` markup simple), right-aligns
   the search controls with a sensible input `max-width`, and never squeezes or reflows the
   filter dropdowns on the first row. Opening/closing find changes the top
   bar height, which the `--ngg-sticky-top` publishing (ResizeObserver on
   `#topBar`) already tracks — verify the sticky table header follows in the
   same frame like the status-strip collapse does, and extend
   `observeTopBarHeight`/`showFindWidget` with a synchronous
   `publishTopBarHeight()` call if it does not.

Acceptance:

- Toggling Show Remote Branches in this repository does not change any
  toolbar control's width or wrap the toolbar (no jump).
- `origin/dependabot/github_actions/actions/checkout-7` and
  `...setup-node-6` render distinguishably in the branch menu (tails
  visible), each with a full-name tooltip, and both stay selectable and
  filterable by any part of the full name.
- Long author names/emails and long tag names get the same treatment.
- No behavior change for names shorter than the budget.
- Opening find (button or `Ctrl/Cmd+F`) shows it on its own toolbar row
  without moving any first-row control; closing it collapses the row; the
  sticky table header stays seamlessly attached in both transitions.

Test plan (same slice):

- Unit tests for `truncateRefName`/`truncateMiddle` covering: short name
  passthrough, this repo's two dependabot branches at the chosen budget
  (distinct outputs, shared prefix collapsed), first-segment preservation,
  tail-longer-than-budget fallback, and exact-boundary lengths.
- Dropdown tests: truncated display + full-name `title` + filter matches the
  full name; control has no inline width; multi-select summary truncates.
- `tests/webview/tableStyles.test.ts`: fixed flex-basis widths present; the
  find-row rule (`flex-basis: 100%`/`order`) present; no regression of the
  wrap/narrow rules.
- Toolbar/rendering tests: find widget markup stays on stable ids
  (`findControl`, `findInput`, ...) so `showFindWidget()` and the keyboard
  shortcuts keep working unchanged.

Implementation record:

- `2026-07-03`: Implemented Phase 12. `src/webview/utils/truncate.ts` now owns
  pure display-only truncation helpers: ref names use segment-aware middle
  truncation that preserves the first segment and visible tail segments, while
  author-like strings use plain start/end middle truncation. `Dropdown` renders
  truncated labels only in the current value and option text, keeps callback
  values and filter matching on the full strings, and shows full-name tooltips
  for truncated display rows. The previous menu-measurement width path and
  font-style refresh loop were removed.
- Toolbar layout no longer depends on dropdown menu contents. CSS gives repo,
  branch, author, and tag dropdowns stable flex bases, keeps a 130px usability
  floor, and lets open menus size as popups without affecting toolbar layout.
  The find widget now uses `order: 10` plus `flex: 0 0 100%`, making it an
  intentional second toolbar row, with the search controls right-aligned within
  that row per maintainer follow-up. `showFindWidget()` and `clearFind()`
  publish the top-bar height synchronously so the sticky header offset follows
  the row transition immediately.
- Focused verification so far:
  - Baseline before edits: `pnpm run typecheck`, `pnpm run lint`,
    `pnpm run test` (`37` backend files / `187` tests, `24` webview files /
    `205` tests), and `pnpm run l10n:check`.
  - `pnpm run format`
  - `pnpm run typecheck`
  - `pnpm exec vitest run --project webview
    tests/webview/utils/truncate.test.ts tests/webview/dropdown.test.ts
    tests/webview/tableStyles.test.ts tests/webview/webviewToolbar.test.ts`
    (`29` tests)
  - `pnpm exec biome check --config-path biome.strict.jsonc
    --error-on-warnings src/webview/utils/truncate.ts src/webview/dropdown.ts
    src/webview/main.ts media/dropdown.css media/main.css
    tests/webview/utils/truncate.test.ts tests/webview/dropdown.test.ts
    tests/webview/tableStyles.test.ts tests/webview/webviewToolbar.test.ts`
    (clean; CSS files are not counted by the current strict Biome config)
  - `pnpm run lint`
  - `pnpm run test` (`37` backend files / `187` tests, `25` webview files /
    `213` tests)
  - `pnpm run l10n:check`
  - `pnpm run package`
  - `pnpm run test:coverage` (`62` files / `400` tests)
  - First SonarQube scan caught one touched-code readability issue
    (`typescript:S7735` in `src/webview/dropdown.ts`), fixed before commit.
  - `SONAR_TOKEN=$(tr -d '\n' < /home/z/.sonar/neo-git-graph.token)
    pnpm run sonar:scan:local`, final task
    `13f1d9b5-1e37-4e4c-8413-026c0c69089a`, analysis
    `5135e3f2-05ef-443e-a53e-7dceab1d24ef`: SonarQube quality gate `OK`,
    new coverage `92.0%`, new duplicated-lines density `0.0`, and new
    violations `0`.

### Phase 13: Settings Hub — Tabbed Widget, Color Editor, Settings Export

**Status: complete.** Set by the maintainer on `2026-07-03` and implemented
as the second maintainer-priority slice after Phase 12.

Goal: turn the repository-settings popup into a two-tab settings hub. Tab 1
(default, "Repository") keeps the current repo-scoped settings. Tab 2
("Extension") lists every `neo-git-graph.*` extension setting with rich,
previewed editors — most importantly the graph colors, which VS Code's
default settings UI shows as a raw JSON array with no preview — plus a graph
color editor that preserves each color's hue while editing
saturation/lightness for the whole palette, and export/import of the
extension's settings only (shareable with friends without touching the rest
of the IDE).

Implementation plan (precise, for the implementing agent):

1. Tab shell in `src/webview/settingsWidget.ts`:
   - Refactor `renderSettingsWidget()` into `renderRepositoryTab(model)` (the
     existing content) and `renderExtensionTab(model)`, under a header with a
     `role="tablist"` of two `role="tab"` buttons (`aria-selected`,
     `aria-controls`, arrow-key navigation, Home/End) and `role="tabpanel"`
     containers. Repository tab is the default; the open tab is webview state
     (`settingsWidgetTab` in `WebViewState`) so it survives reloads.
   - Reuse `.settingsSection`/`.settingsRow` styles; add tab styles to
     `media/main.css` using `--vscode-panelTitle-*` /
     `--vscode-tab-*` tokens with `--ngg-*` OKLCH fallbacks per the styling
     guide.
2. Extension-settings model (extension host side):
   - New module `src/extension/extensionSettings.ts`: build the settings list
     from the extension's own `package.json` `contributes.configuration`
     (id, type, default, enum, markdown/plain description via the existing
     nls machinery) so newly contributed settings appear automatically; pair
     each with its current effective value and scope from
     `vscode.workspace.getConfiguration("neo-git-graph")` `inspect()`.
   - New typed messages in `src/types.ts` +
     `src/extension/messageHandler.ts` routes:
     `loadExtensionSettings` (response: the list above),
     `updateExtensionSetting { key, value, global: true }` (apply via
     `config.update(key, value, vscode.ConfigurationTarget.Global)`,
     respond with the refreshed value or a typed error),
     `exportExtensionSettings`, `importExtensionSettings` (below).
   - Follow the existing request/response patterns (request ids where a
     stale response could race, typed `error` fields, `registerAction()`
     wrapping for actions).
3. Extension tab editors (webview side):
   - Render each setting generically by type: checkbox for booleans, bounded
     number input for numbers (reuse the same clamps as `src/config.ts`),
     dropdown for enums, text input for strings, and a read-only JSON row
     with an Edit dialog for objects (`contextMenuActionsVisibility`,
     `customBranchGlobPatterns`).
   - `graphColors` gets a rich editor instead of JSON: a swatch grid preview
     of all palette entries (reuse `--git-graph-color{i}` custom properties
     so swatches match the graph exactly), per-swatch tooltip with the color
     string, and a small live preview strip of colored graph lines/dots so
     the palette is "nicely previewed".
   - Palette-wide color editor: two sliders — lightness and chroma
     (saturation) — that rewrite every palette entry to
     `oklch(<L>% <C> <hue_i>)` while PRESERVING each entry's hue. This
     matches the documented palette rule (uniform L/C, hue-only variation).
     Implement the color math in a new dependency-free module
     `src/webview/utils/oklchColor.ts`:
     `parseOklch(value)`, `formatOklch({l, c, h})`, and
     `hexToOklch(value)`/`rgbToOklch(value)` (sRGB → linear → OKLab → LCh,
     standard published matrices; unit-test against known reference pairs).
     Non-OKLCH user values are shown as swatches and converted to OKLCH only
     when the user touches the palette sliders (state the conversion in the
     UI). No new runtime dependencies.
   - Per-swatch hue editing is optional scope; if added, a hue slider per
     swatch that keeps the shared L/C.
4. Export/import of extension settings only:
   - New module `src/extension/extensionSettingsFile.ts` modeled on the
     existing `src/extension/repoConfigFile.ts` (same save/open dialog
     patterns): export writes a JSON file (suggest default name
     `neo-git-graph.settings.json`) of shape
     `{ "kind": "neo-git-graph.extension-settings", "version": 1,
     "settings": { "<key>": <value>, ... } }` containing ONLY
     explicitly-set `neo-git-graph.*` values (from `inspect()`
     global/workspace values, not defaults) so importing cannot touch any
     other IDE configuration.
   - Import validates the `kind`/`version` envelope, whitelists keys against
     the manifest-derived list (unknown keys are reported and skipped),
     shows a confirmation dialog listing the changes, then applies each via
     `ConfigurationTarget.Global`. Malformed files produce a typed error
     dialog, never a silent partial apply.
   - Buttons live in the Extension tab next to a short explanatory line;
     l10n strings for all four languages (`en`, `pl`, `zh-cn`, `zh-tw`).
5. Keep the existing repo-settings flows untouched (they stay on Tab 1), and
   keep `package.json` setting descriptions localized via `package.nls*`.

Acceptance:

- The settings popup opens on the Repository tab and behaves as before; the
  Extension tab lists every contributed `neo-git-graph.*` setting with its
  current value and scope, editable in place, persisted globally, and
  reflected in the graph after the existing config-change refresh path.
- Graph colors render as live swatches; moving the lightness/chroma sliders
  updates all colors while each keeps its hue; values persist as OKLCH
  strings; the graph re-renders with the new palette.
- Export produces a file containing only `neo-git-graph.*` settings; import
  on a clean profile reproduces the exported configuration and changes
  nothing else; malformed input is rejected with a clear error.
- Full l10n coverage (`pnpm run l10n:check` passes); keyboard/tab a11y works
  (tablist arrows, focus states, Escape still closes).

Test plan (same slice):

- Unit tests for `oklchColor` conversions (reference values, roundtrips,
  clamping) and for the manifest-derived settings list (every contributed
  key appears; types mapped correctly).
- Webview tests: tab switching + state restore; generic editors dispatch
  `updateExtensionSetting`; palette slider rewrites preserve hue; swatch
  count matches `graphColors`.
- Extension tests: export payload contains only explicitly-set
  `neo-git-graph.*` keys; import whitelists/validates and applies via the
  configuration API; messageHandler routes with typed errors.
- CSS regression: tab styles and swatch styles in
  `tests/webview/tableStyles.test.ts`/`dialogStyles.test.ts` per the
  styling-guide token rules.

Implementation record:

- `2026-07-03`: Implemented Phase 13. The settings popup is now a two-tab hub:
  Repository remains the default tab and keeps the existing repo-scoped flows,
  while Extension lists manifest-derived `neo-git-graph.*` settings. The active
  tab is persisted in webview state as `settingsWidgetTab`, and the tablist uses
  `role="tablist"` / `role="tab"` / `role="tabpanel"` with arrow-key plus
  Home/End navigation.
- Added `src/extension/extensionSettings.ts` to read the extension manifest,
  resolve `package.nls*` setting descriptions, inspect current VS Code
  configuration scopes, validate/clamp imported values, and apply global
  updates. Added `src/extension/extensionSettingsFile.ts` for extension-only
  export/import using the envelope
  `{ kind: "neo-git-graph.extension-settings", version: 1, settings: ... }`.
  Imports whitelist manifest keys, skip unknown/invalid keys, confirm accepted
  changes, and apply via `ConfigurationTarget.Global`.
- Added typed webview/extension messages for loading, updating, exporting, and
  importing extension settings. The webview renders boolean, number, enum,
  string, and JSON editors generically, with a dedicated `graphColors` editor
  showing swatches, preview colors, and hue-preserving lightness/chroma sliders.
  New `src/webview/utils/oklchColor.ts` handles OKLCH parsing/formatting plus
  HEX/RGB-to-OKLCH conversion for user palettes.
- Added English, Polish, Simplified Chinese, and Traditional Chinese l10n keys
  for the tab labels, extension settings UI, import/export dialogs, statuses,
  and error surfaces. Added CSS coverage for settings tabs and color swatches.
- Focused verification:
  - `pnpm run typecheck`
  - `pnpm exec vitest run --project webview
    tests/webview/extensionSettings.test.ts
    tests/webview/settingsWidget.test.ts tests/webview/messageHandler.test.ts
    tests/webview/rendering.test.ts tests/webview/utils/oklchColor.test.ts`
    (`80` tests)
  - `pnpm exec biome check --config-path biome.strict.jsonc
    --error-on-warnings ...` over Phase 13 touched files (`21` files; clean,
    CSS files are not counted by the current strict Biome config)
  - `pnpm run lint`
  - `pnpm run test` (`37` backend files / `187` tests, `28` webview files /
    `225` tests)
  - `pnpm run l10n:check`
  - `pnpm run package`
  - `pnpm run test:coverage` (`65` files / `416` tests)
  - SonarQube initially failed the local gate (`72.0%` new coverage and `5`
    new violations), then after targeted fixes reached `0` new violations, and
    finally passed with task `3879c38f-2547-47ca-92bb-ef5edce77fc5`,
    analysis `bd301361-1721-4f8b-872d-f3d7545e6a57`: quality gate `OK`,
    new coverage `90.0%`, new duplicated-lines density `0.0`, and new
    violations `0`.

### Phase 14: Reveal Highlight — Persistent Blink and Configurable Color

**Status: complete (`2026-07-03`).** Persistent reveal highlighting,
the reveal color setting contribution, and the Phase 13 Extension tab swatch
editor are implemented and verified. A follow-up tuning on `2026-07-03`
aligned find/reveal highlight hue and softened the reveal pulse.

Goal: when Locate HEAD (or any reveal: find navigation, full-history search
result, pending-focus reveal) scrolls to a commit, the row must keep blinking
until the user hovers or clicks it — with smooth scrolling, the current
fixed-length blink can finish before the row is even on screen, so the user
lands on an unhighlighted row. The initial highlight color came from commit
`65056b30ffb70a4f8f51be26e997239535f210b3`; a later maintainer tuning keeps
that green hue while matching the focused find highlight's lightness/chroma
for consistency. The color must be customizable both in the VS Code settings
UI (extension section) and in the settings popup's Extension tab (Phase 13).

Previous state (verified before implementation on `2026-07-03`):

- `blinkHeadRow(hash)` in `src/webview/utils/dom.ts` adds the `blinking`
  class and removes it after a 700ms timeout, matching
  `animation: headPulse 320ms ease-in-out 2` in `media/main.css`.
- `revealCommit()` in `src/webview/main.ts` scrolls with
  `behavior: "smooth"`, so long scrolls outlive the 700ms blink — the bug.
- Current color: `--ngg-success-pulse: oklch(74% 0.12 152 / 0.5)`, keyframes
  transparent → pulse → transparent.
- Required color, taken verbatim from commit
  `65056b30ffb70a4f8f51be26e997239535f210b3` (`media/main.css`,
  `@keyframes headPulse` in this repository's history):
  - 0%: `oklch(87.44% 0.2383 150 / 0.1)`
  - 50% (peak): `oklch(87.44% 0.2383 150 / 0.5)`
  - 100%: transparent

Implementation plan (precise, for the implementing agent):

1. Persistent blink in `src/webview/utils/dom.ts`:
   - Replace `blinkHeadRow` with `startRevealHighlight(row: HTMLElement)`
     (rename per the obsolete-surfaces rule; update the `revealCommit()`
     call site): add the `blinking` class with NO timeout, switch the CSS
     animation to `infinite` iterations, and attach one-shot dismissal
     listeners — `mouseenter`, `click`, and `contextmenu` on the row — that
     remove the class and each other. Export a `clearRevealHighlight()` used
     when a new reveal starts so at most one row is highlighted at a time.
   - Table re-renders rebuild rows via `innerHTML`, which naturally drops
     the class; that is acceptable (a refresh is a user-visible state change)
     — document it in the function comment. The pending-focus reveal path
     re-applies the highlight after its reload.
   - Add `@media (prefers-reduced-motion: reduce)` handling: a steady
     highlight (the peak color, no animation) with the same dismissal.
2. Color swap in `media/main.css`:
   - Replace `--ngg-success-pulse` with `--ngg-reveal-highlight`; the original
     Phase 14 default used the peak from commit `65056b3`, then the
     maintainer follow-up tuned the current default to
     `oklch(90% 0.25 150 / 0.42)` so the locate highlight shares the focused
     find highlight's lightness/chroma and green hue.
   - Update `tests/webview/tableStyles.test.ts` ("uses the fixed green HEAD
     blink color") to the new variable, stops, and `infinite` iteration.
3. Contributed setting (satisfies "VS Code settings, extension section"):
   - `package.json`: `neo-git-graph.revealHighlightColor`, type string,
     current default `"oklch(90% 0.25 150 / 0.42)"`, localized description in
     `package.nls.json` + `pl`/`zh-cn`/`zh-tw` variants (run
     `pnpm run l10n:check`).
   - `src/config.ts`: accessor validating like `graphColors` (accept OKLCH,
     HEX, or RGB strings; fall back to the default on invalid input).
   - Pipe to the webview: add to `GitGraphViewState` (`src/types.ts`), and in
     `src/extension/webviewHtml.ts` emit
     `--ngg-reveal-highlight:<value>;` in `styleVars` so the CSS picks the
     user value up with the OKLCH default as fallback; the existing
     config-change refresh path re-renders with the new color.
   - Add the setting to the README configuration table.
4. Popup Extension tab (depends on Phase 13): the manifest-driven settings
   list picks the new key up automatically; require the color-type preview
   there — a live swatch next to the value using the same swatch styles as
   the `graphColors` editor, editable with the Phase 13 OKLCH affordances.
   If Phase 14 ships first, note in the slice record that the popup surface
   arrives with Phase 13.

Acceptance:

- Locate HEAD from a distant scroll position: the row is still blinking when
  the smooth scroll lands; it keeps blinking indefinitely until hovered or
  clicked, then stops immediately. Same for find/search reveals.
- The current default highlight uses the locate hue `150` with the focused
  find highlight's lightness/chroma (`90% 0.25`) and a gentler alpha/pulse.
- Changing `neo-git-graph.revealHighlightColor` in the VS Code settings UI
  changes the highlight; after Phase 13, the same edit works from the popup
  Extension tab with a live swatch preview.
- With reduced motion enabled, the row shows a steady highlight instead of
  pulsing, dismissed the same way.

Test plan (same slice):

- `dom.ts` util tests: class persists with no timer, `mouseenter`/`click`/
  `contextmenu` each dismiss and detach the other listeners, a second reveal
  clears the first row's highlight.
- Update the Ctrl+H test in `tests/webview/keyboardNavigation.test.ts`: the
  row still has `blinking` after the old 700ms horizon (no fake-timer
  advance needed once the timeout is gone), and hovering removes it.
- `tableStyles.test.ts`: new variable name, exact color stops, `infinite`
  iteration, reduced-motion rule.
- Config/manifest tests: accessor fallback on invalid values
  (`tests/backend/config.test.ts`), contributed key + nls entries
  (`tests/backend/manifest.test.ts`), viewState pass-through
  (`tests/webview/webviewHtml.test.ts` styleVars assertion).

Implementation record (`2026-07-03`):

- Replaced the timeout-based `blinkHeadRow(hash)` with
  `startRevealHighlight(row)` and `clearRevealHighlight()` in
  `src/webview/utils/dom.ts`. Reveals now keep the `blinking` class until
  `mouseenter`, `click`, or `contextmenu` on the row; starting another reveal
  clears the previous row first.
- Updated `revealCommit()` in `src/webview/main.ts` to pass the located row
  directly to the persistent highlight helper.
- Replaced `--ngg-success-pulse` with configurable
  `--ngg-reveal-highlight`. The original default used
  `oklch(87.44% 0.2383 150 / 0.5)`; the current default is
  `oklch(90% 0.25 150 / 0.42)` so locate and focused find highlights share
  lightness/chroma and hue. The keyframes now use a gentler 1100ms pulse with
  a 20% color-mix start before fading back to transparent; reduced-motion
  users get a steady highlight with the same dismissal behavior.
- Tuned search highlights to keep their existing lightness/chroma/alpha while
  using the locate highlight hue: rest matches are
  `oklch(80% 0.2 150 / 0.28)` and focused matches are
  `oklch(90% 0.25 150 / 0.42)`.
- Added `neo-git-graph.revealHighlightColor` to `package.json`,
  `package.nls*.json`, `src/config.ts`, `GitGraphViewState`,
  `src/extension/webviewHtml.ts`, and the README configuration table. The
  setting accepts OKLCH, HEX, or RGB values and falls back to the required
  OKLCH default on invalid raw values.
- Extended the Phase 13 Extension tab so `revealHighlightColor` renders as a
  text input with a live swatch. Manifest string patterns are now sanitized
  during extension-settings update/import flows.
- Added focused coverage for DOM helper persistence/dismissal, Ctrl+H reveal,
  pending-focus reveal, full-history search reveal, CSS variable/keyframes,
  config fallback, manifest contribution, webview style variable pass-through,
  settings widget rendering, and extension-settings import validation.
- Verification:
  - `pnpm run typecheck` passed.
  - Focused Vitest slice passed: `9` files / `108` tests.
  - Scoped strict Biome over touched files passed.
  - `pnpm run lint` passed (`174` files).
  - `pnpm run test` passed: backend `37` files / `189` tests; webview `29`
    files / `234` tests.
  - `pnpm run l10n:check` passed with `100%` package and bundle coverage for
    `pl`, `zh-cn`, and `zh-tw`.
  - `pnpm run package` passed.
  - `pnpm run test:coverage` passed: `66` files / `423` tests.
  - Local SonarQube scan passed quality gate. Task
    `c58de075-bf55-48a3-bba7-8a7b1f09f4f8`, analysis
    `d11117a1-ef5f-4ec8-ab07-1e4612c955b9`; new coverage `90.5%`,
    duplicated lines `0.0%`, new violations `0`.
  - Follow-up highlight color tuning (`2026-07-03`) passed:
    `pnpm run typecheck`, focused Vitest slice (`7` files / `97` tests),
    `pnpm run lint`, `pnpm run test` (backend `37` files / `189` tests;
    webview `29` files / `234` tests), `pnpm run l10n:check`, and
    `pnpm run package`.

### Phase 15: Tag Surfaces — Signed-Tag Distinction and Remote Tag Deletion

**Status: complete (`2026-07-29`).** Maintainer-priority slice released as
`v1.1.1`. It closes the "tag signatures" item listed as remaining under Phase 10.

Goal: make signed tags recognizable at a glance in the graph, let the delete-tag
flow remove the tag from selected remotes, and confirm the tag details popup is
reachable from the tag context menu.

Findings before implementation (verified `2026-07-29`):

- The tag details popup already existed and was already enabled. The backend
  query `src/backend/queries/tagDetails.ts` returns type, object, target, tagger,
  date, subject/body, and a verified signature, and `tag.viewDetails` is `true`
  in `DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY`
  (`src/contextMenuVisibility.ts`). Only the signature line needed work. Check
  this file before treating a "missing" tag feature as unimplemented.
- `GitRef` carried no signature information, so the graph could not distinguish
  signed tags without a second query.
- `deleteTag` had no remote surface at all, and `deleteRemoteBranch` held a
  private `remoteBranchMissing()` helper that the tag path would have duplicated.

Implementation record:

- Signed-tag detection rides on the existing `getRefs()` `for-each-ref` call, so
  it costs no extra git invocation. The format gained `%(objecttype)` and
  `%(if)%(contents:signature)%(then)1%(else)0%(end)`. The `%(if)` conditional is
  load-bearing: `%(contents:signature)` is a multi-line PGP block and would
  otherwise break the one-ref-per-line parsing. A ref is `signed` only when
  `objecttype` is `tag` **and** the signature atom is truthy — a lightweight tag
  points straight at a commit and has no tag object that could be signed.
  Verified against this repository, where `v0.1.0`–`v0.5.0` are signed and
  `v1.0.0`/`v1.1.0` are not.
- This reports only the *presence* of a signature; it deliberately does not run
  `git verify-tag`, which stays in the on-demand `tagDetails` query. Marking a
  tag "signed" is therefore not a claim that the signature is valid.
- `getRefs()` was split into `buildRefFormat()`, `toGitRef()`, and
  `parseRefLines()` after the added branch pushed it to cognitive complexity `16`
  against the `15` allowed (`typescript:S3776`). `toGitRef()` is exported so the
  ref mapping is unit-testable without a repository.
- `remoteBranchMissing()` moved to `isMissingRemoteRefError()` in
  `src/backend/utils/remoteRefs.ts` and is now shared by branch and tag deletion.
  The old private copy was removed in the same slice per the obsolete-surfaces
  rule.
- New `src/backend/actions/tagRemote.ts` owns `deleteRemoteTag()`. It pushes
  `--delete refs/tags/<name>` rather than the bare name so a same-named branch is
  never deleted by mistake. Because `refs/tags` has no per-remote tracking refs,
  the webview cannot know which remotes hold a tag; every remote is offered,
  each unchecked by default, and an already-absent remote tag resolves as success.
- `deleteTag` moved off `git.tag()` to `runGitRaw` so the deletion is recorded
  like every other action, and `messageHandler` now passes `recordGitCommand`.
- Webview: `renderCommitRef()` adds a `signed` class, the `verified` octicon
  (added to `scripts/generate-octicons.js` and regenerated), and a "signed tag"
  tooltip suffix. `--ngg-signed-ref` reuses the commit-signature token chain
  (`--vscode-testing-iconPassed` → `--vscode-charts-green` → `--ngg-success`) so
  the badge and the signature column agree. The tag details signature line is now
  status-colored via `.tagSignature-*`; `formatTagSignature()` returns escaped
  HTML and the signer/key are escaped individually, covered by an XSS test.
- Release workflow rewritten: it packages the VSIX, creates (or updates) the
  GitHub release for the pushed tag with the VSIX attached, and publishes to the
  marketplace only when `VS_MARKETPLACE_TOKEN` is set. The `secrets` context is
  not available to a step-level `if`, so the token presence is resolved into a
  step output first — do not "simplify" that back to `if: secrets.…`.

Verification (`2026-07-29`):

- `git fetch --all --prune`; `AI-dev` level with `origin/AI-dev` at `ff8b744`
- `pnpm run typecheck`
- strict Biome format + lint over all touched files, warnings as errors
- `pnpm run lint`, `pnpm run format`
- `pnpm run test`: backend `44` files / `315` tests, webview `34` files /
  `290` tests
- `pnpm run l10n:check`: `100%` package and bundle coverage for `pl`, `zh-cn`,
  `zh-tw`
- `pnpm run package`
- `pnpm run test:coverage`
- `pnpm run sonar:scan` with fresh coverage from the completed working tree.
  Task `4b2e18a3-89b9-4f70-a82a-4e5cdb3322a8`, analysis
  `9918d4a9-59ba-4570-9fdb-7552bf31f7e2`: `ZAM` quality gate **`OK`** on all six
  conditions — `new_duplicated_lines_density` `0.0`, `new_violations` `0`,
  `software_quality_maintainability_issues` `0`,
  `software_quality_maintainability_remediation_effort` `0`,
  `software_quality_reliability_issues` `0`,
  `software_quality_security_issues` `0`. `new_lines` `184`, overall project
  coverage `84.6%`. The gate no longer carries a `new_coverage` condition; see
  the SonarQube notes under Current Architecture.
- `pnpm run format` still reports the same six pre-existing drifts in files this
  slice did not touch (`.vscode/settings.json`,
  `tests/backend/avatarManager.test.ts`, `tests/backend/diffDocProvider.test.ts`,
  `tests/backend/manifest.test.ts`, `tests/backend/statusBarItem.test.ts`,
  `tests/webview/utils/dom.test.ts`), unchanged since `2026-07-27` and left for a
  dedicated cleanup slice per the scoped-cleanup rule. `pnpm run lint` reports
  only the pre-existing Biome schema-version info (`2.5.2` config vs `2.5.5` CLI).
- `sonar.projectVersion` advanced `1.1.0` → `1.1.1` so the `Previous Version`
  new-code window covers exactly this slice rather than reaching back past the
  1.1.0 release.

Follow-up (`2026-07-29`): tag details popup redesign, same slice. The popup was
read-only with a single Dismiss button and rendered its metadata as inline
`<b>…</b><br>` markup inside the generic `#dialog` (`width: max-content;
max-width: min(440px, 90vw)`), which squeezed hashes and long messages into a
narrow, uneven column. Redesigned it with a dedicated `#dialog.tagDetails`
variant: a structured `dl.tagDetailsFields` two-column grid (`max-content 1fr`)
for label/value rows, a full-width `white-space: pre-wrap` message row, and a
predictable `width: min(460px, 90vw)` so the panel no longer shrink-to-fits.
Added three copy actions in a wrapping flex row — **Copy Tag Name**, **Copy
Object Hash** (`type: "Tag Hash"`), and **Copy Tag Message** (`type:
"Tag Message"`) — each reusing the existing `copyToClipboard` path; the
message copy sends the joined subject+body. New l10n keys
`action.copyTagHash`, `action.copyTagMessage`, `type.tagHash`, `type.tagMessage`
across `en`/`pl`/`zh-cn`/`zh-tw`, and the copy-error `typeLabel` map gained
`Tag Hash`/`Tag Message` for friendly failure labels. Dismiss remains the single
primary action; the copy buttons are bound after `showDialog` returns (same
pattern as `#dialogAction`/`#dialogDismiss`), and `hideDialog()`'s
`dialog.className = ""` already drops the `tagDetails` class. Added a webview
rendering test for the copy actions and a `dialogStyles` CSS regression test
for the grid layout.

Verification (`2026-07-29`):

- `git fetch --all --prune`; `AI-dev` level with `origin/AI-dev` at `ff8b744`
- `pnpm run typecheck`
- strict Biome over the five touched files (`src/webview/main.ts`,
  `src/extension/webviewL10n.ts`, `tests/webview/rendering.test.ts`,
  `tests/webview/dialogStyles.test.ts`; CSS is not counted), warnings as errors,
  clean
- `pnpm run lint` (`189` files; only the pre-existing Biome schema-version info)
- `pnpm run format`: only the same six pre-existing drifts in untouched files
- `pnpm run test`: backend `44` files / `315` tests, webview `34` files /
  `292` tests
- `pnpm run l10n:check`: `100%` package and bundle coverage for `pl`, `zh-cn`,
  `zh-tw`
- `pnpm run package`
- `pnpm run test:coverage` (`78` files / `607` tests, `coverage/lcov.info`)
- `graphify update .` + `graphify tree`: rebuilt the map at `2,059` nodes /
  `4,839` edges / `118` communities
- `pnpm run sonar:scan` with fresh coverage from the completed working tree.
  Task `58015533-498b-45fa-8406-c8fa005054e9`, analysis
  `25fdced8-1fa5-4897-90a9-72f6d35f5423`: `ZAM` quality gate **`OK`** on all
  seven conditions — `new_coverage` `95.8`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `0`, and project-wide maintainability issues/effort,
  reliability issues, and security issues all `0`. Note the `new_coverage >= 85`
  condition is back on the gate (it had been removed per the earlier
  `2026-07-29` note); this slice cleared it at `95.8%`.

Follow-up (`2026-07-29`): signed-tag visual polish, released as `v1.1.2`. The
1.1.1 signed-tag look had regressed: the tag icon was replaced by the verified
glyph and lost its commit-color background. Restored a unified design:

- `refIcon()` always returns the **tag** octicon for tags (signed or not); the
  `signedTag` glyph-as-icon path is gone. A signed tag renders the tag icon on
  the commit-color background, then a `.gitRefSignedBadge` (the verified octicon
  on the signature-status green) sits **flush** against it.
- `.gitRef.tag.signed > svg { margin-right: 0 }` zeroes the default 5px right
  margin only on signed tags so the badge meets the icon with no background gap;
  it does **not** override the icon background, so the commit color is preserved.
- The `.gitRefSignedBadge` is a square (`border-radius: 0`), sized 14px with the
  glyph at 14px to match the 1.1.1 verified-icon weight.
- Signed tags now share the **default neutral border** with every other ref
  (`.gitRef.tag.signed { border-color: var(--ngg-neutral-border-heavy) }`); the
  green verified badge — not the border — carries the signature distinction.
- Commit signature column: `COMMIT_SIGNATURE_PRESENTATIONS.valid` glyph changed
  from the `"✓"` character to `svgIcons.verified`, and `.commitSignature-valid`
  is now a filled `background: var(--ngg-signed-ref)` circle (not the old 14%
  tint) with the glyph in the editor-background color, unifying with the tag
  badge. A new `svgIcons.verified` was added (the `signedTag` alias is kept so
  existing `signedTagIcon` test selectors keep matching).

Verification (`2026-07-29`):

- `git fetch --all --prune`; `AI-dev` level with `origin/AI-dev`
- `pnpm run typecheck`
- strict Biome over the five touched files (clean), `pnpm run lint` (only the
  pre-existing schema-version info), `pnpm run format` (only the six known
  pre-existing drifts in untouched files)
- `pnpm run test`: backend `44` files / `315` tests, webview `34` files /
  `294` tests
- `pnpm run l10n:check` `100%`; `pnpm run package`
- `pnpm run test:coverage` (`78` files / `609` tests)
- `sonar.projectVersion` advanced `1.1.1` → `1.1.2` so the `Previous Version`
  new-code window covers exactly this slice.
- `pnpm run sonar:scan`, task `1f5566fc-d85d-4a1e-a386-881b73a80f3b`: `ZAM`
  quality gate **`OK`** — `new_violations` `0`, `new_duplicated_lines_density`
  `0.0`, and all four project-wide conditions `0`.

Follow-up (`2026-07-29`): SSH-signed commits shown as unsigned, released as
`v1.2.0`. `git log %G?` reports `N` for commits it cannot verify, and that
conflates **truly unsigned** commits with **signed-but-unverifiable** ones —
notably SSH-signed commits when no `gpg.ssh.allowedSignersFile` is configured
(the verifier cannot even run, so it answers `N` instead of `U`). The result
was that every SSH-signed commit in such a repo rendered as `—` Unsigned in the
Signature column. `%GG` (raw signature) is also empty on unverified SSH
signatures, so no `git log` format atom can disambiguate.

The fix: after the log is parsed, the loader collects the hashes of every
commit whose `%G?` was `N` and runs **one** batched `git cat-file --batch` over
them (hashes on stdin). The new `parseGpgsigPresence(stdout)` splits the batch
output on `<40-hex-sha> commit <size>` header lines and flags any block that
contains a `gpgsig ` line. Those commits become
`{ status: "unverifiable", signer: null, key: null }` (reusing the existing
`E`-mapped status the webview already renders as `?` Unverifiable); genuinely
unsigned commits stay `null`. The probe is skipped entirely when the Signature
column is hidden or no commit reported `N`, so the common path adds zero git
calls; failures are swallowed (worst case = pre-fix behavior).

To feed stdin (which `git.raw()` cannot), a new
`runGitWithInput(git, { args, input, binary, repo, record, ... })` spawns the
git binary directly via `node:child_process.spawnSync`. The binary is the
caller-resolved `config.gitPath()` — threaded into `LoadCommitsInput.gitPath`
(mirroring `loadBranches`) rather than guessed from `process.env`, consistent
with the Phase 0.5 direction of diverging from `simple-git`. `runGitWithInput`
goes through the same `runGitCommand` wrapper for timing/recording/error
normalization.

Verification (`2026-07-29`):

- Reproduced the bug against a real repo (`_TA/ALPACA`): `git log %G?` reported
  `N` for all SSH-signed commits, while `git cat-file --batch` showed a
  `gpgsig -----BEGIN SSH SIGNATURE-----` header on every one of them.
- `pnpm run typecheck`; strict Biome over touched files (clean); `pnpm run lint`
  (only the pre-existing schema-version info); `pnpm run format` (only the six
  known pre-existing drifts in untouched files).
- `pnpm run test`: backend `46` files / `322` tests, webview `34` files /
  `294` tests. New tests: `parseGpgsigPresence` (5, pure-function unit cases)
  and `unverifiedSignatures` (2, real-repo integration: a `gpgsig`-bearing
  commit built via `git hash-object -t commit -w --stdin` reclassifies to
  `unverifiable`; a genuinely unsigned commit stays `null`).
- `pnpm run l10n:check` `100%` (no new keys — reused `signatureUnverifiable`);
  `pnpm run package`.
- `pnpm run test:coverage` (`80` files / `616` tests).
- `sonar.projectVersion` advanced `1.1.2` → `1.2.0` so the `Previous Version`
  new-code window covers exactly this slice.
- `pnpm run sonar:scan`. First scan flagged one new-code violation
  (`typescript:S6594`, `.match()` vs `RegExp.exec()` in `parseGpgsigPresence`);
  fixed by switching to `commitHeaderRegex.exec(line)` and rescanned. Final
  `ZAM` quality gate **`OK`** — `new_violations` `0`,
  `new_duplicated_lines_density` `0.0`, `new_coverage` `88.3%`, and all four
  project-wide conditions `0`.

Test notes for future slices:

- A signature-bearing tag object can be created **without a GPG key** by writing
  the object with `git mktag` and pointing the ref at it with `git update-ref`
  (see `tests/backend/queries/loadCommits/signedTags.test.ts`). Use this instead
  of generating throwaway GPG keys, which is slow and flaky in CI.
- Webview tests that click `refreshBtn` must re-supply commits with
  `receiveLoadedCommits(...)` after answering `loadRepoInfo`; the refresh clears
  the table, so ref lookups silently find nothing otherwise.

### Submodule discovery (`2026-08-21`)

Repository discovery reads declared `path` entries from `.gitmodules`, validates
that each path stays inside its parent and is a Git repository, and supports
nested submodules plus parents restored from extension state. The repository
dropdown keeps names clean while structured metadata indents submodules and CSS
draws their branch connectors. The implementation uses this repository's
abstractions and Git/VS Code APIs, with no code copied from the original Git
Graph project or the comparison upstream PR.

`.gitmodules` is not watched live; changes appear on the next repository scan,
such as after reloading the extension. Filesystem watching and stale-submodule
removal remain intentionally out of scope.

#### Merged as PR #1, released as `1.4.2` (`2026-09-03`)

This arrived as the project's **first outside pull request** —
`b38c002` by Kristjan ESPERANTO, merged as `c3f5fc0` — not as an agent slice,
so the gates ran after the merge rather than before the commit. Two points for
whoever handles the next one:

- **An outside contribution is an AGPL contribution, and it does not touch
  `LICENSE.mit`.** That file preserves the MIT notices and the rosters of
  *incorporated MIT material*; adding a direct contributor there would
  advertise their AGPL work as reusable under MIT and break the one-way licence
  rule this project exists to keep. `NOTICE.md` gained a "Contributors to the
  AGPL-licensed work" section for exactly this, the contributor was added to
  `package.json`'s `contributors`, and the CHANGELOG credits them by name and
  PR number so the credit ships in the VSIX rather than living only in the git
  history. Note the maintainer appears in **both** files legitimately: the MIT
  roster for `2026-03-25`, the AGPL section from the `2026-07-01` relicensing.
- **Two defects were fixed on top of the merge**, both in the merged file:
  `path.resolve()` returns backslashes on Windows while every other repository
  path in the extension is normalized to `/` (`getPathFromUri`), so the
  discovered path is now normalized inline — inline and not via
  `@/backend/utils/path`, because that module imports `vscode` and the backend
  test project has no `vscode` alias. And `line.match()` became a hoisted
  `RegExp.exec()`, which is `typescript:S6594` and has been caught by this
  gate before (see the `1.2.0` `parseGpgsigPresence` note). Four merged files
  also needed `biome format`; the contributor's line width differed.

**Telemetry for the feature (`2026-09-03`).** The maintainer asked for
submodule usage to be measurable. Submodules are a *shown* feature — discovery
puts them in the repository dropdown and no command sits behind them — so the
signals went into `createViewFeatureReporter()`, the documented third
chokepoint, and are reported from the existing `recordCommitLoad()` call in the
`loadCommits` route rather than from a new call site. Two ids, both once per
session: `view.submoduleRepo` (a nested repository was in the set to offer) and
`view.submoduleRepoActive` (the graph was actually drawn for one). The second
is the usage signal; the first only says discovery found something.

- **The facts are compared, never sent.** `recordCommitLoad` now takes
  `repoPaths` and `repo`, and containment is decided inside the reporter; the
  payload stays `{ feature, ok }` with a fixed id. The maintainer flagged
  repository-name leakage as critical, so a test asserts the serialized output
  contains none of the path fragments it was given and that every event has
  exactly the `feature`/`ok` keys. Keep that test if this module is refactored.
- **Containment compares on a trailing `/`**, because sibling repositories
  routinely share a name prefix and a bare `startsWith` would report every one
  of them as its neighbour's submodule. There is a test for that too.
- **Read the numbers as "submodule discovery had something to show", not as a
  count of `.gitmodules` files.** A repository added by hand with Add
  Repository can also land inside another one. The workspace scan itself
  cannot produce a nested repository — it stops at a known repository's
  boundary — so `.gitmodules` is the only automatic route, but the manual one
  is a real if rare false positive.
- `telemetry.json` and the README disclosure were updated in the same slice, as
  the telemetry rules require; both state that the deciding paths never leave
  the extension.

**The gate caught a ReDoS in the merged code, and this is the argument for
running it on outside contributions.** The first scan came back **ERROR** on
`software_quality_reliability_issues` `1`: `typescript:S8786` on the
`.gitmodules` reader's `/^\s*path\s*=\s*(.+?)\s*$/` — a lazy `(.+?)` followed
by `\s*$` backtracks super-linearly, and `.gitmodules` is content from whatever
repository the user opened, so it is not trusted input. It was replaced by
`parseSubmodulePathEntry()`, a linear split on the first `=` with both halves
trimmed, which decides the same lines (a `# path = x` comment still does not
trim to the key `path`) and additionally matches git's own case-insensitive
config keys, so a hand-written `Path =` now works. A test pins the accepted and
rejected line shapes including a 5,000-character whitespace run. That finding
was the slice's only new violation.

Verification (`2026-09-03`):

- `git fetch --all --prune`; `main` level with `origin/main` at `c3f5fc0`
- strict Biome `check` (lint + format + import order) over all 11 touched
  files, warnings as errors, clean. Four merged files needed formatting and
  `src/extension/messageHandler.ts` carried a pre-existing import-order
  finding, fixed here under the touched-files rule.
- `pnpm run package` (typecheck, whole-tree lint over `223` files, production
  builds)
- `pnpm run test`: backend `54` files / `421` tests, webview `42` files /
  `413` tests
- `pnpm run test:ext`: both launches green (`53` + `1`)
- `pnpm run l10n:check`: `100%` package and bundle coverage for all five
  languages (no new keys — the telemetry signals have no user-facing string)
- `pnpm run test:coverage`: `96` files / `834` tests
- `graphify update .` + `graphify tree`: rebuilt at `2,321` nodes / `5,409`
  edges / `145` communities
- `pnpm run sonar:scan` with fresh coverage from the completed working tree.
  First scan task `0f8ed3f5-1cda-4766-8925-d7ea394ec577`, analysis
  `af82d354-621f-47d0-a9be-c9af1b6fddc8`: **ERROR**, the S8786 finding above.
  After the fix, task `70e9bb1c-031a-4117-b0e1-d0daa26b75a5`, analysis
  `0a4755cb-5ef4-4eda-b464-de524518eee2`: `ZAM` gate **`OK`** on all seven
  conditions — `new_coverage` `90.3`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `0`, `new_software_quality_high_issues` `0`,
  `software_quality_maintainability_rating` `1`, and project-wide reliability
  and security issues `0`.
- A latent bug in `tests/webview/messageHandler.test.ts` surfaced here and is
  worth knowing about: its `loadCommitsRequest` was a `const` object literal
  built at describe-collection time, so it captured `repo` before `beforeAll`
  assigned it and had been sending `repo: undefined` into the route. The
  telemetry facts read `msg.repo`, which turned that into a crash. It is now a
  factory function; check for the same shape before adding fixtures to that
  file.
- Known gap, unchanged: `pnpm run format` still reports pre-existing drift in
  files this slice did not touch — `.vscode/settings.json`,
  `src/extension/webviewHtml.ts`, `src/extension/webviewLanguages.ts`,
  `tests/backend/avatarManager.test.ts`,
  `tests/backend/diffDocProvider.test.ts`,
  `tests/backend/telemetry/language.test.ts`,
  `tests/webview/telemetryConsentPrompt.test.ts`,
  `tests/webview/utils/dom.test.ts` and `tests/webview/webviewPanel.test.ts`.
  The list has grown since the `2026-07-29` note of six; four arrived with the
  1.4.0 telemetry line. Left for a dedicated cleanup slice per the
  scoped-cleanup rule — `pnpm run package` does not run the formatter, so this
  blocks nothing.

### Upstream review (`2026-07-29`)

`upstream/main` (`asispts/neo-git-graph`) had three commits newer than
`origin/main` at `ff8b744`: `437ee6c` (nix flake/direnv config), `867eddc`
(split `tsconfig.base.json`, explicit `types` per project), and `9349069`
(enforce the `node:` protocol via `.oxlintrc.json`). None were incorporated:

- The nix config is dead weight here — this fork develops through the
  devcontainer and has no nix users.
- The `node:` protocol rule is a good idea but ships as oxlint config; this fork
  uses Biome, and its sources already use `node:` prefixes throughout.
- The tsconfig split is the only one with real merit and is worth revisiting as
  its own slice; this fork's tsconfigs have already diverged (TypeScript 6,
  local aliases for `tests-ext`), so it is a rewrite rather than a merge.

Incorporating any upstream MIT commit also requires extending the boundary
commit and the contributor roster in `NOTICE.md`/`LICENSE.mit` in the same
change. That cost is not worth paying for chore commits; re-evaluate when
upstream lands user-facing behavior this fork wants.

### Upstream review, second pass (`2026-08-25`)

After the bug backlog closed, `upstream/main` was re-reviewed from the merge
base `28300bd` through `750f96f` (33 commits; the `2026-07-29` pass had covered
only the first three past `origin/main`). Every commit was classified. The
useful, missing behavior was implemented as **feature branches off `AI-dev`,
one per feature, gated and pushed, for the maintainer to pick from**:

| Branch | Ports | What it does | State |
| --- | --- | --- | --- |
| `upstream/root-commit-actions` | `4607cdf` | Root (zero-parent) commits take the plain cherry-pick/revert confirmation instead of a zero-option parent-select dialog; Drop exclusion documented (`rebase --onto <root>^` is invalid) | `159e55c`, pushed, ZAM `OK` (task `ec0745b0`, `new_violations` 0) |
| `upstream/bold-current-branch` | `08318d3` | Checked-out branch label renders semibold (`.gitRef.active { font-weight: 600 }`); aliases/tags unaffected | `f7b190a`, pushed, ZAM `OK` (task `b1a0962b`, `new_violations` 0) |
| `upstream/retain-panel` | `0bf8812` + `0c8f1da` | `retainContextWhenHidden` on the graph panel; re-show posts `loadRepos`+`refresh` over the bridge instead of reassigning `webview.html` (which would drop the retained document) | `ce1b143`, pushed, ZAM `OK` (task `cec3c2c3`, `new_violations` 0) |
| `upstream/no-commits-view` | `e7d1f8a` | Dedicated zero-commit view (icon + heading + create-first-commit hint; signal `commits empty && commitHead null && branches empty` so filters cannot fake it) and hidden branch/tag/author/remote-branch controls while it shows | `105a6ec`, pushed, ZAM `OK` (task `986e261d`, analysis `92deacb2`, `new_violations` 0). Landed after a ~35 min Sonar outage on `2026-08-25`; per the no-server rule the commit waited for a healthy gate — fresh coverage was regenerated and the scan re-run after recovery. |
| _(no branch — applied directly)_ | `750f96f` | Release workflow publishes with the official `vsce` CLI (`vsce publish --packagePath --skip-duplicate`, `VSCE_PAT`) instead of the third-party `HaaLeo/publish-vscode-extension` action; sub-actions pinned to exact releases | Applied on `2026-08-25` at maintainer request. **Open VSX deliberately not taken** — upstream's companion `ovsx publish` step and its `ovsx` dependency are excluded; this project publishes to the VS Marketplace only. `pnpm-workspace.yaml` was left alone: upstream's `allowBuilds` rewrite is a pnpm-config change, and our `onlyBuiltDependencies` list already covers the live `@vscode/vsce-sign`/`keytar`/`esbuild` builds. |

**CI note (`2026-08-25`).** The publish step no longer uses a third-party
action. Two properties of the surrounding workflow are load-bearing and must
survive future edits: the `Check marketplace token` step exists because the
`secrets` context is not available to a step-level `if`, and the VSIX is
discovered by glob and carried through `steps.package.outputs.vsix` so the
GitHub release asset keeps its versioned filename rather than upstream's flat
`extension.vsix`. `--skip-duplicate` makes a re-run for an already-published
version a no-op instead of a failure.

**Maintainer reversal of `2026-08-25`: `upstream/bold-current-branch` is
rejected.** Bolding must apply to the commit **description** only, never to
branch or tag labels, so the `font-weight: 600` that `f7b190a` added to
`.gitRef.active` was removed; the rule keeps `border-color:
var(--git-graph-color)`, and the checked-out branch is distinguished by that
colored border alone. The ref-level `active` class and the tests asserting
which ref carries it are unaffected — only the CSS weight went away. Nothing of
`08318d3` remains in the tree as a result; its `NOTICE.md` bullet was **kept**
(attributions are never stripped as a side effect of a behavior change) and its
wording amended to record the removal. `LICENSE.mit` was not touched: the roster
is a historical record of what was incorporated, not of what still ships.

In the same change the maintainer made checked-out-commit emphasis opt-in and
added a fetch default, both wired through the standard eight-hop setting
plumbing (manifest, four `package.nls*.json`, `src/config.ts`, `src/types.ts`,
`webviewHtml.ts`, `global.d.ts`, the webview config switch plus constructor
literal, README):

- `git-graph-libre.repository.boldCheckedOutCommit` (boolean, default `false`).
  `renderCommitRow()` used to bold the current row's message unconditionally; it
  is now gated on this flag. The `<span class="commitMessage">` wrapper is
  emitted in **all** cases — the mute styling keys off it.
- `git-graph-libre.repository.fetchTagsByDefault` (boolean, default `true`)
  pre-checks "Fetch all tags" in the **toolbar** Fetch popup (`showFetchDialog()`).
  Deliberately scoped there only: the per-remote fetch dialog and the dedicated
  Fetch Tags dialog keep their own unchecked defaults, because those are
  explicit per-invocation choices rather than the blanket toolbar fetch.

Licensing pattern for these branches: each branch appends its upstream-commit
bullet to `NOTICE.md`'s "incorporated in part" list and makes the **identical**
two edits to `LICENSE.mit` (roster date range → `2026-08-24`; "all four" →
"all"), so the shared `LICENSE.mit` hunks merge cleanly across branches; only
the appended `NOTICE.md` bullets can textually collide, trivially.

Skipped, with reasons (do not re-propose without new evidence):

- Already implemented independently here: `48f494c` (context-menu
  `preventDefault` — `showContextMenu` line 1), `8402626`
  (`Intl.RelativeTimeFormat` in `src/webview/utils/date.ts`), `d6ebf81`
  (watcher unmute in `finally` — Phase 0.5), `8a63e39` (long-name display —
  Phase 12 is deeper), `e7d1f8a`'s relative-date neighbors, `b4c215f`,
  `deba9af`/`4afcb69`/`951ab64` (already borrowed earlier).
- Rejected earlier (`2026-07-29` pass): `437ee6c`/`8a62dd9` (nix), `9349069`
  (oxlint vs our Biome), `867eddc` (tsconfig split — still a rewrite, our
  tsconfigs diverged further since).
- Not wanted: `e7efada` (preact migration — huge rewrite of a webview we keep
  plain-TS by design), `b4a8e82` (l10n rearchitecture; our key-based bundles +
  checker work), `2c8599c` (removing Locate HEAD conflicts with our Phase 14
  reveal design), `705848d`/`c66c236` (superseded by our Phase 1 redesign),
  dependency/CI/readme chores (`9ad07df`, `4f3f8de`, `2b23693`, `9cccf91`,
  `750f96f`, `5b9f02b`, `9f9a2e9`, `3d34503`, `538fff1`, `4e29e94`, etc.).
- Flagged for the maintainer as decisions, not code: `7b74415` (status bar on
  the right side — ours is Left, cosmetic/design call), `0dd368f` (deprecating
  `fetchAvatars` — product decision; our README still documents the setting).

### Upstream review, third pass (`2026-09-03`)

**Last reviewed upstream commit: `86be522`.** Start the next pass at
`git log 86be522..upstream/main`. The previous pass ended at `750f96f`; the
eight commits between them are classified below.

**Licence check first, and it came back clean.** None of the post-fork markers
listed under Mission appear anywhere in `upstream/main`, and their tree never
mentions this project, its publisher, or the AGPL. Their `LICENSE` reads
`Copyright (c) 2019 mhutchie. Fork (c) 2026-present asispts` with no claim over
material from here. Nothing to raise.

The eight commits are dominated by one architectural push — a webview RPC
protocol replacing their signal-based sync — plus bootstrap and config
cleanups. Nothing was taken; these are candidates for the maintainer to pick
from, listed newest first:

| Commit | What it does | Worth taking? |
| --- | --- | --- |
| `34835ec` | Returns from `activate()` immediately when the window has no workspace folder at all | **The most interesting of the eight**, but read it against BUG-5 before acting: this fork deliberately activates on `onStartupFinished` so the watching-eye status bar item can exist in a *non-git* folder. "No folder open at all" is a genuinely different case from "folder without a `.git`", and skipping activation there costs nothing — but the two are one line apart, and getting it wrong silently reverts a decision the maintainer already made. |
| `49c8025` | Richer no-repository page with an initialize-repository button | Idea only. This fork has its own no-repository and no-commits screens; the button that runs `git init` from the empty state is the part worth considering, and it is a few lines of our own code, not theirs. |
| `86be522` | Regenerates and hardens the tsconfig set | Third time the tsconfig split has come up (`867eddc` in the first pass, still "a rewrite rather than a merge"). Our configs have diverged further since — TypeScript 6, local aliases for `tests-ext` — so this stays a rewrite. Only worth doing as its own deliberate slice. |
| `ee90612`, `fbe641d`, `662d51e` | A typed RPC protocol for webview↔extension, then migrating initialization onto it and deleting the signal-based sync | **Rejected by the maintainer (`2026-09-03`).** Do not re-propose. Our `webviewBridge` already carries typed request/response messages with the union in `src/types.ts`, and theirs is bound to a preact webview this project keeps as plain TypeScript on purpose. |
| `c939ff7` | Simplifies their extension bootstrap | **Rejected (`2026-09-03`).** |
| `a5fc838` | Readme roadmap | **Rejected (`2026-09-03`).** Chore. |

**Maintainer decision (`2026-09-03`): everything in this pass except `34835ec`
and `49c8025` is rejected outright, `86be522` included — the tsconfig question
is closed, not deferred.** The two survivors are under consideration; the
findings below are what the maintainer asked for before giving upstream
feedback.

**`34835ec` in detail.** The guard is four lines at the top of their
`activate()`, and their manifest lists `onStartupFinished` as the only
activation event. Because the early return happens before *any* setup, it skips
their logger, their status bar item **and their
`vscode.commands.registerCommand("neo-git-graph.view", …)`** — so in a window
with no folder the extension counts as activated while its palette command does
not exist. Whether that matters rests entirely on the host being restarted when
a folder appears, and the API contract only promises that softly: `vscode.d.ts`
on `updateWorkspaceFolders` says "**in some cases** calling this method **may**
result in the currently executing extensions … to be terminated and restarted.
For example when the first workspace folder is added, removed or changed". A
`may`, not a guarantee — and nothing at all is promised for a folder arriving
by other routes. The conservative shape is to register commands unconditionally
and skip only the expensive setup.

**This fork cannot take it as written**, for a reason that does not apply to
upstream: they contribute two commands (`view`, `clearAvatarCache`), we
contribute seven, and `git-graph-libre.addRepo` is *designed* to work with no
folder open — it prompts for a directory with `showOpenDialog` and adds it by
path. Guarding activation the same way would unregister it in exactly the
window where someone would reach for it. Read this against BUG-5 too: that
decision restored `onStartupFinished` so the watching-eye status bar item can
exist in a **non-git folder**, which is a different case from **no folder at
all** — one line apart, and confusing them silently reverts a settled decision.

**`49c8025` in detail.** Their no-repository page gained a primary
**Initialize Repository** button, an inline error line (`role="alert"`), a
disabled state while the call is in flight, and an illustrative inline SVG. The
extension side is three lines: the handler simply runs VS Code's built-in
`git.init` command rather than shelling out to git itself, which is the part
worth copying as an idea — it inherits the folder picker, multi-root handling
and the SCM view refresh for free. Three new l10n keys. This fork already has
both a no-repository screen (`body.unableToLoad`) and a no-commits view, so the
question is only whether an action belongs on them; the code would be ours.

### Pull request review — #4 and #5 (`2026-09-05`)

Two open pull requests, both authored by the Copilot coding agent against
issues filed by `yyjdelete`, both branched off `main` at `ffae055` and neither
behind it. Reviewed by running the project gates against each branch's
checkout tree in the maintainer-requested order — **tests first, then strict
Biome, then the `ZAM` gate** — and fixing what the review found on the pull
request branches themselves.

**The gates are not a review.** Both branches passed strict Biome and the
`ZAM` gate on the first run, and PR #5 was still broken: the gate cannot see a
setting that nothing reads. Read the feature, not just the result.

**PR #4 — Merge on the remote branch context menu (`copilot/feature-allow-to-merge-remote-branch`).**
Correct as written, and it lands on existing machinery cleanly:
`normalizeContextMenuActionsVisibility()` iterates the *defaults* object, so
adding `remoteBranch.merge` there seeds persisted settings with no migration;
the manifest declares each visibility group as
`additionalProperties: {type: boolean}`, so no per-key manifest entry is
needed; `GGL.ContextMenuActionsVisibility` is `import * as GGL from "@/types"`,
so `src/types.ts` is the only type to touch; and `mergeBranch` passes its
target straight to `git merge`, which accepts a remote-tracking ref. What was
missing was coverage and a changelog entry, added in `40c962f` and `80e38ed`:

- **`isContextMenuActionVisible()` returns `!== false`, so an unknown action
  key reads as visible.** A menu item wired to a mistyped or absent key
  therefore still appears under the defaults, and a positive rendering
  assertion cannot tell the two apart. The new
  `tests/webview/remoteBranchContextMenu.test.ts` switches the key off and
  asserts the item disappears while its neighbours stay — the remote-branch
  group had no visibility coverage at all, unlike branch, commit and tag.
  Confirmed by mutation: pointing the item at `"mergeTypo"` fails two of its
  three cases.
- The context menu sends the **rendered ref name**, so `mergeBranch` receives
  `origin/<branch>`, a shape no test covered. `mergeBranch.test.ts` gained a
  real-git case that clones a repository and merges `origin/feature`.
- Deliberately **not** done: `buildRemoteBranchContextMenu()` hand-rolls its
  visibility ternaries where `visibleContextMenuItem()` exists, but so does
  `buildTagContextMenu()`; converting one of the two would trade a consistent
  local style for an inconsistent one. Convert both in a cleanup slice or
  neither. Also left alone: the remote menu still has no **Rebase**, which the
  local branch menu offers and `git rebase origin/main` supports — worth
  considering, but issue #2 asked only for merge.

**PR #5 — configurable no-fast-forward dialog defaults (`copilot/git-graph-libre-3-default-value-fast-forward`).**
Shipped half the eight-hop setting plumbing and the settings were **inert**:
`package.json`, the five `package.nls*.json` and the two `src/config.ts`
accessors were there, and nothing anywhere read the accessors. Both dialogs
still hardcoded `value: true` / `value: false`, so both settings appeared in
VS Code's settings UI *and* in the extension's own manifest-derived settings
hub, and changing either did nothing. The branch also **failed
`pnpm run typecheck`**, i.e. `pnpm run package` at its first step: the config
mock in `tests/webview/webviewHtml.test.ts` is typed against the whole `config`
shape and was missing the two accessors. Note `pnpm run test` passed anyway —
vitest does not typecheck, so the vitest suites are not a substitute for the
typecheck step when a shared type changes.

Completed in `638b28a` and `a56da12` along the route
`repository.fetchTagsByDefault` already takes: `GitGraphViewState`,
`webviewHtml.ts`, the webview `Config` interface, the constructor literal, and
a case per key in `applyBooleanExtensionSetting()` so a change made while the
graph is open applies to the next dialog instead of only after a reload. Plus
the README configuration table and a changelog entry. Three points worth
keeping:

- **`dialog.merge.noFastForward` drives two dialogs, not one.**
  `showMergeBranchDialog()` and `showMergeCommitDialog()` render the same
  checkbox from the same `dialogMergeNoFastForward` key; a setting that covered
  only the branch dialog would leave the commit dialog contradicting it.
- **Both defaults reproduce the values the dialogs hardcoded** (`true` for
  merge, `false` for pull), so this is a pure capability addition with no
  behavior change — unlike the `muteMergeCommits` default flip of `2026-08-25`.
- **`tests/webview/telemetryConsentScreen.test.ts` builds its config mock with
  `as unknown as Config`**, which hides a missing accessor from `tsc` and then
  fails at runtime with `config.<name> is not a function`. Adding a `config`
  accessor means updating both that mock and the properly-typed one in
  `webviewHtml.test.ts`; only the second is caught by typecheck.

New coverage in `tests/webview/mergeDialogDefaults.test.ts` drives all three
dialogs in both directions through the real webview bundle, asserts the
submitted `createNewCommit` payload, and exercises the settings-hub live-update
route. Confirmed by mutation: restoring the hardcoded values fails four of its
seven cases. The view-state pass-through assertion in `webviewHtml.test.ts`
mocks both accessors to the **inverse** of their manifest defaults, so it
cannot pass by coincidence.

**Merging both breaks typecheck, whichever goes second.** PR #5 adds two
required fields to `GitGraphViewState`, and PR #4 adds a new test file with its
own view-state literal that cannot carry them (an object literal typed as
`GitGraphViewState` rejects unknown properties, so the fields cannot be
pre-added on PR #4's branch either). Verified on a local trial merge of both
onto `main`: one trivial `CHANGELOG.md` conflict — both bullets are wanted —
and then `tests/webview/remoteBranchContextMenu.test.ts(12,7): error TS2739 …
missing … mergeNoFastForward, pullBranchNoFastForward`. The follow-up is two
lines in that one file (`mergeNoFastForward: true,
pullBranchNoFastForward: false,`). With it applied the merged tree is green on
everything, including the `ZAM` gate. This is the standing cost of a required
field on a widely-fixtured view state; the durable fix is a shared test
view-state factory instead of a dozen literals, which is its own slice.

Verification (`2026-09-05`), all four trees:

| Tree | typecheck | `test` | strict Biome | Sonar task | `ZAM` | `new_coverage` |
| --- | --- | --- | --- | --- | --- | --- |
| PR #4 as pushed | pass | 421 / 413 | clean | `9e025961` | `OK` | `91.3` |
| PR #4 + fixes | pass | 422 / 416 | clean | `ccafdc4c` | `OK` | `92.8` |
| PR #5 as pushed | **FAIL** | 421 / 413 | clean | `3fbc9d0b` | `OK` | `89.6` |
| PR #5 + fixes | pass | 427 / 420 | clean | `1a74acc4` | `OK` | `93.3` |
| both merged + follow-up | pass | 428 / 423 | clean | `812d3749` | `OK` | `93.7` |

`new_violations` `0`, `new_duplicated_lines_density` `0.0`, and all four
project-wide conditions `0` on every one of the five analyses;
`sonar.projectVersion` was left at `1.4.2`, so all five measured against the
same `Previous Version` `1.4.1` window and no baseline moved. `l10n:check`
stayed at `100%` for all five languages (`61` package keys after PR #5).
`pnpm run package` and `pnpm run test:ext` (`53` + `1`) passed on both fixed
trees.

Two things left for the maintainer:

- **The two-line follow-up after the second merge**, above.
- **`tests/extension/workspaceWatcher.test.ts` flaked once** in three
  `test:ext` runs on the PR #5 tree and was green on the other two. Its
  `setTimeout(r, 10)` waits are still there, one sibling at `500` — the same
  flake recorded under BUG-5 on `2026-08-25`, still unfixed and still
  unrelated to whatever slice happens to hit it.

## Immediate TODOs — High-Priority Bug Backlog (`2026-08-25`)

**These bugs outrank every remaining phase item in the roadmap.** The maintainer
reported them against `v1.3.0` (`04b0578`); each was root-caused in the same
session against this working tree, and every "Reproduced" line below is a real
command run against a real repository, not an inference. Do not re-derive the
diagnosis — go straight to the fix, and update the `Status:` line of an entry
when it closes instead of deleting the entry.

Two of these (BUG-1 and BUG-3) make the affected feature fail outright for any
user whose setup differs from the maintainer's earliest test repo, so they are
the first two slices.

**Maintainer decisions of `2026-08-25` are already folded into the entries
below.** Where an entry carries a "Maintainer decision" paragraph, that
paragraph is settled scope — implement it as written rather than re-opening the
trade-off. In short: lightweight tags are unsigned by git's design and the UI
must say so (BUG-3); merge dimming becomes an opt-in setting defaulting to off
(BUG-4); and the status bar eye is restored by putting `onStartupFinished` back
(BUG-5).

### BUG-1 — `pushTag` hardcodes the `origin` remote

**Status: open. Priority: high. Area: backend action + webview dialog.**

Fault: `src/backend/actions/tag.ts:39-41`.

```ts
export async function pushTag(git: SimpleGit, input: ActionPayload<"pushTag">): Promise<void> {
  await git.push("origin", input.tagName);
}
```

The remote name is a string literal. Any repository whose remote is called
something else — `upstream`, `gitlab`, a fork named after its owner, or a repo
with several remotes and no `origin` — cannot push a tag at all.

Reproduced (`git 2.55.0`, scratch repo with a single remote named `upstream`):

```
$ git push origin v1.0
fatal: 'origin' does not appear to be a git repository
fatal: Could not read from remote repository.
```

The user sees the generic `error.unableToPushTag` dialog carrying that text.

Three further defects sit in the same two lines:

1. **Bare refspec.** `git push <remote> <tagName>` is ambiguous when a branch
   and a tag share a name. Reproduced: with both a branch and a tag named
   `v2.0`, `git push upstream v2.0` fails with
   `error: src refspec v2.0 matches more than one`, while
   `git push upstream refs/tags/v2.0` succeeds. `deleteRemoteTag()` in
   `src/backend/actions/tagRemote.ts:29` already learned this lesson and pushes
   `refs/tags/<name>`; `pushTag` never did.
2. **Not recorded.** It calls `git.push()` through `simple-git` instead of
   `runGitRaw`, so the push never reaches the git-command log that every other
   action feeds. `src/extension/messageHandler.ts:356` correspondingly omits
   `recordGitCommand`, unlike the `deleteTag` route one line above it.
3. **No options.** No force/lease mode, no `--no-verify`, no multi-remote fan-out
   — see BUG-2.

Fix:

- Widen `ActionPayload<"pushTag">` in `src/backend/types/actions.types.ts:88`
  from `{ tagName: string }` to carry `remotes: string[]` plus the same option
  fields `pushBranch` already has, and reject an empty `remotes` array the way
  `pushBranch` does (`src/backend/actions/branchRemote.ts:105-107`).
- Reimplement `pushTag` on `runGitRaw` with
  `["push", remote, `refs/tags/${input.tagName}`]`, looping over the selected
  remotes, and thread `recordGitCommand` through `messageHandler`.
- Replace the bare confirmation in `showPushTagDialog()`
  (`src/webview/main.ts:3707-3717`) with the remote-checkbox form used by
  `showPushBranchDialog()` (`src/webview/main.ts:3863-3880`), defaulting the
  checked remote through the existing `defaultPushRemoteName()` helper
  (`src/webview/main.ts:4001`). Keep the plain confirmation only for the
  single-remote case.
- Extend `tests/backend/actions/tag/push.test.ts`: a remote **not** named
  `origin`, a repository with two remotes, and a branch/tag name collision that
  must still push the tag and leave the branch untouched.

Implementation record (`2026-08-25`):

- `ActionPayload<"pushTag">` now carries `{ tagName, remotes: string[],
  mode: GitPushBranchMode, noVerify: boolean }` — the pushBranch shape minus
  branch fields, reusing `GitPushBranchMode` (no second enum). `pushTag` was
  reimplemented on `runGitRaw` (label `tag.pushTag`): rejects an empty
  `remotes` array like `pushBranch`, loops over the selected remotes, and
  pushes the fully-qualified `refs/tags/<name>` refspec. `pushModeArg` moved to
  an export in `branchRemote.ts` so branch and tag pushes share one
  mode→arg mapping; `--force-with-lease`/`--force`/`--no-verify` thread through
  exactly as for branches. `messageHandler` passes `recordGitCommand` (closes
  the pushTag half of BUG-6; the addTag half landed with BUG-3).
- `showPushTagDialog()` now mirrors `showPushBranchDialog()`: no remotes →
  silent return; single remote → plain confirmation sending
  `remotes: [name]`; multiple remotes → checkbox form with the default checked
  remote from `defaultPushRemoteName()` and an empty-selection error. Zero new
  l10n keys — the branch dialog's remote labels carry no branch wording and
  were reused.
- Verified: independent verifier reproduced all three failure modes against
  scratch repos (non-`origin` remote fatal under the old command; branch/tag
  name collision "matches more than one" under the bare refspec; both succeed
  with `refs/tags/` refspec, branch ref untouched; two-remote fan-out works)
  and confirmed the recorded log line embeds `refs/tags/` args. Tests:
  `push.test.ts` rewritten (7 cases incl. collision and two-remote subset),
  webview rendering + messageHandler coverage for the dialog and the record
  line (backend 46/329, webview 34/304).
- Full gate green before commit: strict Biome, typecheck, lint, `test`,
  `l10n:check` 100%, `package`, fresh coverage (80 files / 633 tests, 92.1%
  lines), `sonar:scan` task `9e9165bf-e3be-4814-affa-ba11a5684594`, analysis
  `ef1eaebc-ba59-4d2a-a411-0c5ce58bdf3e`: `ZAM` gate **`OK`** —
  `new_coverage` `93.8%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `2` (unchanged; this slice added 0), reliability and
  security issues `0`. Note: a concurrent editor staged a `biome.jsonc`
  `$schema` bump (2.5.2→2.5.5) mid-campaign; it was unstaged and left as a
  working-tree change, and lint passes under either schema value.

### BUG-2 — The tag remote surface is a stub beside the branch remote surface

**Status: fixed (`2026-08-25`). Priority: high. Area: backend actions + webview. Depends on BUG-1.**

This is the maintainer's "tag pushing/pulling system is quite crude" in concrete
terms. Compare what exists today:

| Capability | Branches | Tags |
| --- | --- | --- |
| Choose the remote | yes, multi-select checkboxes | no, hardcoded `origin` |
| Push through `runGitRaw` (recorded) | yes | no |
| Force / `--force-with-lease` | yes (`pushModeArg`) | no |
| Bypass hooks (`--no-verify`) | yes | no |
| Delete on selected remotes | yes | yes (Phase 15) |
| Fetch/pull the ref from a remote | yes (`fetchIntoLocalBranch`, `pullBranch`) | **nothing** |

There is no tag-fetch surface at all. `fetchRemotes()`
(`src/backend/actions/remote.ts:213`) builds `fetch --all` / `fetch <remote>`
with optional `--prune`/`--prune-tags`, so tags arrive only as a side effect of
git's default tag-following, and there is no way to ask for
`git fetch <remote> --tags` explicitly, no way to refresh a single tag, and no
way to see which remotes carry a given tag. The Phase 15 note in
`src/backend/actions/tagRemote.ts:12-19` already records why that last one is
hard (`refs/tags` has no per-remote tracking refs) — that constraint is real and
the fix must work with it, not against it.

Fix (one slice, after BUG-1 lands):

- Add a `fetchTags` action: `git fetch <remote> --tags`, optionally
  `--prune-tags` (which already has a git-version guard in
  `assertPruneTagsSupported`, `src/backend/actions/remote.ts:46`), exposed from
  the tag context menu and from the existing fetch dialog.
- Add "Push all tags" (`git push <remote> --tags`) as a repository-level action
  next to fetch, not in the per-tag menu.
- Give the tag push dialog the force/no-verify checkboxes the branch dialog has,
  reusing `GitPushBranchMode` rather than inventing a second mode enum.
- Localize every new label across `en`/`pl`/`zh-cn`/`zh-tw` and keep
  `pnpm run l10n:check` at 100%.

Implementation record (`2026-08-25`):

- `fetchTags` (src/backend/actions/remote.ts): per selected remote runs a
  recorded `git fetch <remote> [--prune --prune-tags] --tags` (label
  `remote.fetchTags`) on `runGitRaw`, with `assertPruneTagsSupported` guarding
  the prune flags. `--prune` is deliberately implied with `--prune-tags` —
  empirically, `--prune-tags` without `--prune` silently does not prune.
  Surfaces: a "Fetch Tags…" tag-context-menu item (visibility key
  `tag.fetchTags`, defaulted true; `normalizeContextMenuActionsVisibility`
  seeds persisted settings so no migration is needed) opening a dialog with
  all remotes preselected (fetch is read-only and `refs/tags` has no
  per-remote tracking refs — the Phase 15 constraint) plus a "Prune deleted
  tags" checkbox; and a "Fetch all tags" checkbox in the toolbar fetch dialog
  that sends `fetchTags` for all remotes after `fetchRemotes`.
- `pushAllTags` (src/backend/actions/tag.ts): per selected remote runs a
  recorded `git push <mode-arg] [--no-verify] <remote> --tags` (label
  `tag.pushAllTags`), sharing `pushModeArg` and `GitPushBranchMode`. It is a
  repository-level toolbar button (upload octicon, beside fetch, hidden
  without remotes), not a per-tag menu item.
- The push-tag dialog now always shows the options form (remote checkboxes +
  force-mode select + bypass-hooks checkbox, branch dialog's markup and
  branch-neutral keys reused). Judgment call recorded: BUG-1's interim
  single-remote plain confirmation was removed in this slice — the
  force/no-verify options must be choosable with one remote too, and the
  branch dialog always shows the form. Shared helpers
  (`remoteCheckboxInputs`/`pushOptionInputs`/`parsePushDialogValues`) keep the
  three push dialogs duplication-free.
- Verified: independent verifier demonstrated the tag-following gap (a tag on
  an unreachable commit does not arrive with plain `git fetch` but does with
  `--tags`), both prune directions (with and without `--prune`), two-remote
  `--tags` fan-out with `--no-verify --force-with-lease` args, and
  branch/tag-name collision safety under `git push --tags`. Command-log
  record lines asserted against real bare remotes. l10n: 12 new keys × 4
  languages, `l10n:check` 100% (525 bundle keys).
- Full gate green before commit: strict Biome on 22 touched files, typecheck,
  lint, `test` (backend 47/343, webview 34/312), `l10n:check` 100%,
  `package`, fresh coverage (81 files / 655 tests, 92.1% lines). The first
  scan (task `ccbaaac5-6ad7-4602-afc0-7c5684cec76d`) was `OK` at
  `new_violations` `2` — both findings turned out to date from the BUG-3
  slice's code (`typescript:S6582` optional-chain in
  `isDialogInputVisible`, `typescript:S5906` generic assertion in the
  empty-message test), so per the touched-files rule they were fixed in this
  slice's files and the full gate re-ran: `sonar:scan` task
  `bb2f67ae-66db-4098-a8a5-93c84182cb01`, analysis
  `d2325221-3a85-4799-888c-64a992a563ef`: `ZAM` gate **`OK`** —
  `new_coverage` `92.1%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `0`, reliability and security `0`. The graphify map was
  refreshed from the final tree (`graphify update .` + `graphify tree`).

### BUG-3 — "Lightweight" creates a signed annotated tag and opens an editor window

**Status: fixed (`2026-08-25`). Priority: high. Area: backend action + webview dialog.**

Fault: `src/backend/actions/tag.ts:9-18`.

```ts
if (input.lightweight) {
  args.push(input.tagName);      // <- plain `git tag <name> <hash>`
} else {
  args.push("-a", input.tagName, "-m", input.message);
}
```

`git tag <name> <hash>` is only a lightweight tag when nothing else is
configured. With `tag.gpgsign = true` in the user's git config — which **is** set
on the maintainer's machine, globally — git creates a *signed annotated tag
object* instead and, because no `-m` was supplied, launches `core.editor` to
collect a tag message. That editor is `code-insiders --wait` here, so VS Code
opens a `TAG_EDITMSG` tab and the extension action blocks until the tab is
closed. That is the maintainer's "nasty tag description window", and it is git
opening it, not the webview.

Reproduced (`git 2.55.0`, `tag.gpgsign=true` inherited from `~/.gitconfig`,
`GIT_EDITOR` replaced with a stub that announces itself):

```
$ git tag lw1 $HASH
EDITOR-WAS-OPENED
$ git cat-file -t lw1
tag                     # <- annotated tag object, not a lightweight ref

$ git tag --no-sign lw2 $HASH
$ git cat-file -t lw2
commit                  # <- genuine lightweight tag, no editor
```

So the one-flag fix is `--no-sign` on the lightweight path. `--no-sign` exists
precisely to override `tag.gpgSign`, and the empirical check above confirms it
both suppresses the editor and restores the lightweight ref.

One secondary defect in the same flow: **the Message field is always visible.**
`renderDialogForm()` (`src/webview/main.ts:5829-5838`) emits a static table with
no conditional rows, so `showAddTagDialog()` (`src/webview/main.ts:2971-3005`)
shows the tag Message input even when Type is set to Lightweight, where it is
meaningless and is silently discarded.

**Maintainer decision (`2026-08-25`) — scope of `--no-sign`.** A lightweight tag
is a plain ref pointing straight at a commit; there is no tag object to carry a
signature, so a lightweight tag is *always* unsigned. That is git's design, not
a limitation of this extension, and the extension must not pretend otherwise.
Therefore:

- `--no-sign` is used **only** on the lightweight path, where it exists purely
  to stop `tag.gpgSign` from silently upgrading the tag into a signed tag
  object. It is a correctness guard for "lightweight means lightweight".
- The annotated path passes **no** sign-related flag at all and continues to
  follow the user's git configuration (`tag.gpgSign`, `tag.forceSignAnnotated`,
  `user.signingkey`, `gpg.format`). If the user has configured git to sign
  tags, their annotated tags get signed; that is the behavior they asked git
  for and the extension does not override it. Do **not** add `--no-sign` to the
  annotated path, and do **not** replace the two-way Type select with a
  three-way Lightweight/Annotated/Signed selector — the maintainer considered
  and rejected that; signing stays a git-config concern.
- Because the annotated path honors the config, a machine with signing
  configured but no usable key or agent will see tag creation fail with git's
  own error. That surfaces through the existing `error.unableToAddTag` dialog
  and is correct behavior — do not swallow it.

Fix:

- Lightweight: `git tag --no-sign <name> <hash>`. Non-negotiable, and the reason
  must be commented at the call site — a future reader will otherwise "clean up"
  the flag. State in that comment that the flag is deliberately absent from the
  annotated path.
- Annotated: keep `git tag -a <name> -m <msg> <hash>` exactly as it is. The
  `-m` is load-bearing: it is what guarantees git never opens `core.editor`.
- **Tell the user that lightweight means unsigned.** This is a documentation and
  UI duty, not an implementation detail:
  - Add a short explanatory line to the Add Tag dialog, shown when Lightweight
    is selected — e.g. "Lightweight tags are a plain ref with no tag object, so
    they carry no message and cannot be signed." New l10n key across `en`,
    `pl`, `zh-cn`, and `zh-tw`.
  - Extend the Lightweight option's own label or its adjacent help text so the
    difference is visible before the user commits to a choice.
  - Add a short "Tag types" note to the README next to the tag feature bullet,
    stating that lightweight tags are unsigned by definition and that annotated
    tags follow the user's git signing configuration.
- Hide the Message row when Lightweight is selected. This needs a small
  conditional-visibility affordance in the dialog form (a `dependsOn` field on
  `DialogInput`, or a change listener bound after `showDialog` returns, matching
  how `#dialogAction`/`#dialogDismiss` are already bound). Reject an empty
  message for annotated rather than creating an empty-message tag object — git
  2.55 accepts `-m ""` without complaint, so the guard has to be ours.
- Move `addTag` off `git.tag()` onto `runGitRaw` and pass `recordGitCommand`
  from `src/extension/messageHandler.ts:354`, so tag creation is logged like
  deletion is.
- Tests: `tests/backend/actions/tag/add.test.ts` currently proves lightweight
  creation only in a repo that inherits **no** `tag.gpgsign`, which is exactly
  why this shipped. Add cases that run with `-c tag.gpgsign=true` and assert
  `git cat-file -t` returns `commit` for lightweight (proving `--no-sign` held)
  and `tag` for annotated (proving the config was honored, not overridden),
  plus webview tests that the Message row hides for Lightweight and that the
  unsigned-lightweight explanation renders.

Implementation record (`2026-08-25`):

- Lightweight now runs `git tag --no-sign <name> <hash>` through `runGitRaw`
  (label `tag.addTag`, repo-recorded), with the load-bearing comment explaining
  why the flag exists and that it is deliberately absent from the annotated
  path. Annotated is unchanged (`-a <name> -m <msg> <hash>`), so it keeps
  following `tag.gpgSign`/`tag.forceSignAnnotated`. `messageHandler` passes
  `recordGitCommand` for `addTag` (the addTag half of BUG-6; pushTag remains
  for the BUG-1 slice).
- Add Tag dialog: the Lightweight option label now reads "Lightweight
  (unsigned)" and selecting it hides the Message row (new generic
  `dependsOn`/`required` affordance on `DialogInput`, with a new `note` input
  type rendering the explanation "Lightweight tags are a plain ref with no tag
  object, so they carry no message and cannot be signed."). An empty annotated
  message is rejected by the dialog instead of creating an empty-message tag
  object. New l10n keys across `en`/`pl`/`zh-cn`/`zh-tw`; README gained a
  "Tag types" note beside the tag feature bullet.
- Verified: independent verifier reproduced both halves against a scratch repo
  on this machine (`tag.gpgsign=true` global): old command → editor launched +
  signed `tag` object; new lightweight command → `cat-file -t` = `commit`, no
  editor; annotated → genuinely PGP-signed `tag` object (`git tag -v` Good
  signature), proving the config is honored, not overridden. Unit suites:
  `add.test.ts` uses a stub `gpg.program`/`core.editor` so the gpgsign cases
  are environment-independent; webview tests cover row hiding, the note, and
  empty-message rejection.
- Full gate green before commit: strict Biome on touched files, typecheck,
  lint, `test` (backend 46/324, webview 34/301), `l10n:check` 100%,
  `package`, fresh `test:coverage` (80 files / 625 tests, 92.1% lines), then
  `sonar:scan` task `8777f7a1-e3be-4684-a2f7-12b6ac16a9ac`, analysis
  `e48e5498-ea18-4142-a357-1b250b9036e0`: `ZAM` gate **`OK`** —
  `new_coverage` `94.1%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `2` (of 3 allowed), reliability and security issues `0`.
- Process note: an external formatter reformatted `media/main.css` mid-gate
  (breaking CSS assertions); the tree was restored to HEAD plus the slice's
  genuine 8-line `.dialogFormNote` addition and the whole gate was re-run
  cleanly. Watch for concurrent editors touching this tree during gates.

Follow-up (`2026-09-03`): the maintainer reversed the empty-message part of the
decision after a user reported that annotated tags could not be created without
a message. An annotated tag's message is optional: the dialog labels it as such
and the backend deliberately passes `-m ""` when it is omitted, keeping tag
creation non-interactive. A lightweight tag still cannot carry a message; its
typed request omits the field and the backend rejects a message-bearing payload.
This fix is the `1.4.1` patch release.

Verification (`2026-09-03`): strict Biome passed on the six touched TypeScript
files; `pnpm run package` passed (typecheck, full lint, production builds);
`pnpm run test` passed (`54` backend files / `413` tests and `42` webview files /
`411` tests); `pnpm run l10n:check` remained at `100%` for all five languages;
and fresh `pnpm run test:coverage` passed (`96` files / `824` tests). SonarQube
task `72db4409-bd97-4858-a48f-bd40c31c614b`, analysis
`56894c64-9e4c-473e-b6f6-79c670b8e9ff`, passed the `ZAM` gate: new coverage
`100.0%`, duplication `0.0%`, new violations `0`, maintainability rating `1`,
and reliability/security issues `0`.

### BUG-4 — Branch and tag labels turn gray on every merge commit

**Status: fixed (`2026-08-25`). Priority: high. Area: webview rendering + CSS.**

This is the maintainer's "sometimes it gets gray", and it has a precise trigger:
**the commit is a merge commit.** The dimming *effect* is worth keeping and
becomes an opt-in feature (see the decision below); what is a bug is that it is
unconditional, unconfigurable, undocumented, and reaches past the commit message
into the branch and tag labels.

Fault, two halves that meet in the Description column:

`src/webview/main.ts:4147-4148` —

```ts
if (commit.parentHashes.length > 1) rowClasses.push("mergeCommit");
if (commit.parentHashes.length > 1 || mutedByHeadAncestry) rowClasses.push("mutedCommit");
```

`media/main.css:301-305` —

```css
#commitTable tr.commit.mergeCommit td:nth-child(2),
#commitTable tr.commit.mutedCommit td:nth-child(2) {
  color: var(--vscode-descriptionForeground, var(--ngg-neutral-icon));
}
```

`td:nth-child(2)` is the Description cell, and `renderCommitRow()`
(`src/webview/main.ts:4085-4088`) emits `renderCommitRefs(commit)` **into that
same cell** ahead of the message text. `.gitRef` and `.gitRefGroup`
(`media/main.css:622-651`) set a background and a border but never a `color`, so
the label text inherits the cell's — and the cell's is
`--vscode-descriptionForeground`, a muted gray in every theme, on any merge
commit.

Two consequences, both wrong:

1. **Merge-commit muting is unconditional and unconfigurable.** The
   `repository.muteCommitsNotAncestorsOfHead` setting (`src/config.ts:140`,
   default `false`) gates only the `mutedByHeadAncestry` half. The merge half
   has no setting, no README entry, and no way to turn it off. There is no
   `muteMergeCommits` key anywhere in the manifest.
2. **The muting leaks out of the message and into the ref labels.** Muting a
   merge commit's *message* is a defensible reading aid; graying the branch and
   tag names attached to it is not — those labels are identity, and a branch tip
   that happens to be a merge is exactly where the label matters most.

**Maintainer decision (`2026-08-25`) — keep the behavior, make it opt-in.**
Merge-commit dimming is a legitimate reading aid, so it stays — as a real,
documented, switchable feature rather than a hardcoded surprise. The new setting
defaults to **off**, which is a deliberate behavior change: after this slice
merge commits render at full contrast unless the user turns dimming on.

Fix:

- Contribute `git-graph-libre.repository.muteMergeCommits` (boolean, **default
  `false`**), wired through `src/config.ts`, `GitGraphViewState` in
  `src/types.ts`, `src/extension/webviewHtml.ts`, the webview config-change
  route at `src/webview/main.ts:1502`, the README configuration table, and
  `package.nls*.json` in all four languages. Note the default flip in the
  changelog — existing users will notice merge rows getting brighter.
- Gate the `mergeCommit`-driven mute on that setting. While there, drop the
  redundant double-classing: `mergeCommit` and `mutedCommit` currently both land
  on every merge commit and the CSS lists both selectors for one rule. Keep the
  `mergeCommit` class itself — the graph layout and tests rely on identifying
  merges — and let only the mute styling become conditional.
- Stop the mute from reaching ref labels, for **both** mute sources (the new
  merge setting and the existing `muteCommitsNotAncestorsOfHead`). Dimming a
  commit's *message* is the feature; dimming the branch and tag names attached
  to it is not — those labels are identity, and a branch tip that happens to be
  a merge is exactly where the label matters most. Wrap the message text in its
  own `<span class="commitMessage">` inside the Description cell and move the
  `color:` rule onto that span, so `.gitRef`/`.gitRefGroup` keep full-contrast
  text. Do **not** fix this by hanging an explicit `color` override on
  `.gitRef` — that would fight the cascade instead of scoping it.
- Tests: `tests/webview/tableStyles.test.ts` for the scoped selector,
  `tests/webview/rendering.test.ts` for the class gating (both settings on and
  off), and `tests/backend/manifest.test.ts` + `tests/backend/config.test.ts`
  for the new setting and its `false` default.

Implementation record (`2026-08-25`):

- `git-graph-libre.repository.muteMergeCommits` (boolean, default `false`) is
  wired end-to-end exactly like `muteCommitsNotAncestorsOfHead`: manifest,
  `src/config.ts` accessor, `GitGraphViewState` + webview `Config`,
  `webviewHtml.ts` pass-through, a `repository.muteMergeCommits` case in the
  webview config-change route, README configuration table, `package.nls*.json`
  ×4, and a `CHANGELOG.md` `[Unreleased]` entry calling out the default flip
  (merge rows render brighter unless the user opts in).
- `renderCommitRowAttributes()` now pushes `mergeCommit` for every merge and
  `mutedCommit` only when a mute source is active
  (`isMergeCommit && config.muteMergeCommits || mutedByHeadAncestry`); the
  double-classing is gone. The message text is wrapped in
  `<span class="commitMessage">` inside the Description cell (refs render
  before it, outside the span), and the mute rule became
  `#commitTable tr.commit.mutedCommit td:nth-child(2) .commitMessage` — same
  token chain, span-scoped. `.gitRef`/`.gitRefGroup` keep no `color` of their
  own and inherit the full-contrast page foreground.
- Verified: independent verifier drove a fresh esbuild bundle of the webview in
  jsdom (repo untouched) with a merge commit carrying branch + remote-alias +
  tag labels: default → no `mutedCommit` on the merge; setting on → muted with
  zero refs inside the span; ancestry-mute rows muted in both scenarios and
  their labels outside the span. Cascade enumeration found no remaining rule
  that can gray ref text. The BUG-4 secondary check passed: `.gitRefAlias`
  badge-foreground contrast in the harness VS Code's light themes is
  Light Modern `#3B3B3B`/`#CCCCCC` = 6.98:1, 2026 Light `#FFFFFF`/`#0069CC` =
  5.39:1, Light+ default `#333`/`#C4C4C4` = 7.24:1 — all ≥ AA. Signed-tag pill
  tint (path 3) intentionally untouched.
- **Maintainer re-check pending:** per the action item above, the maintainer
  should re-check the tag-graying impression now that path 1 is scoped. If
  tags still read as gray, the remaining candidate is the intended Phase 15
  signed-vs-unsigned pill tint — a design question to bring back, not a bug.
- Full gate green before commit: strict Biome, typecheck, lint, `test`
  (backend 46/332, webview 34/307), `l10n:check` 100% (53 nls keys),
  `package`, fresh coverage (80 files / 639 tests, 92.1% lines),
  `sonar:scan` task `6cb91cbc-9caa-46a3-81b3-33cdbe52748a`, analysis
  `6ebfe56c-5412-4a91-b158-149478d56e90`: `ZAM` gate **`OK`** —
  `new_coverage` `94.3%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `2` (slice added 0), reliability and security `0`.

#### Tag-specific graying — investigation result (`2026-08-25`)

The maintainer additionally reported seeing tag labels specifically go gray.
Every rendering path was enumerated; these are the **only** places a ref label's
appearance changes, and there is no tag-specific text-graying path anywhere in
the codebase:

1. **Inherited from the muted Description cell** (the rule above). This is the
   one and only path that grays ref label *text*, and it applies to branches and
   tags identically. `renderCommitRef()` (`src/webview/main.ts:4203-4215`) is
   the sole ref-rendering site in the whole webview — nothing else emits a
   `.gitRef` — and it sets no `color` of its own.
2. **`.gitRefGroup > .gitRefAlias`** (`media/main.css:661-665`) uses
   `--vscode-badge-foreground`. This applies **only** to remote-branch segments
   inside a grouped branch badge; `groupCommitRefs()` never puts a tag in a
   group, so tags can never take this rule. Badge foreground is near-white in
   Dark Modern (the maintainer's theme), so it is not a graying source there
   either — but confirm it still reads at full contrast in a light theme once
   the fix lands.
3. **Signed vs unsigned tag pill background** — the likely explanation for the
   tag-specific impression. A signed tag gets
   `color-mix(in srgb, var(--ngg-signed-ref) 12%, transparent)`, a green tint
   (`media/main.css:698-701`), while every other ref including an unsigned tag
   gets the neutral `--ngg-neutral-overlay-muted`, which is literally
   `oklch(60% 0 0 / 0.15)` — a gray overlay. In this repository `v0.1.0`–
   `v0.5.0` are signed and `v1.0.0` onward are not, so the tag column shows
   green-tinted pills above gray pills. That is the intended Phase 15 design,
   not a defect.

Note that in *this* repository the merge rule cannot be what was seen on tags:
every tagged commit here (`v0.1.0` … `v1.3.0`) has exactly one parent, and
`muteCommitsNotAncestorsOfHead` is absent from the maintainer's settings so it
sits at its `false` default. In repositories that tag merge commits — the common
GitHub merge-then-release flow — the merge rule explains it completely.

**Action for the implementing agent:** fix path 1 as described above, then ask
the maintainer to re-check. If tag labels still gray after that, the remaining
candidate is path 3 being read as "gray", and the answer is a design question
(should unsigned tags carry a tint of their own?) rather than a bug — do not
guess at a fix for it.

### BUG-5 — The "watching" eye status bar item can never appear

**Status: fixed (`2026-08-25`). Priority: high. Area: extension manifest. Decision made
(`2026-08-25`): restore `onStartupFinished`.**

The maintainer's report and the borrowed-icon verification are the same bug, so
they are recorded together.

`src/statusBarItem.ts:36-44` says, in a comment written for exactly this case:

```ts
// Stay visible with no repository, so the extension does not simply vanish
// in a non-Git folder. The eye says it is still watching for one.
if (this.numRepos === 0) {
  this.statusBarItem.text = `$(eye) ${name}`;
```

`package.json` says the opposite:

```json
"activationEvents": ["workspaceContains:.git", "workspaceContains:**/.git"]
```

In a folder with no `.git`, the extension never activates, `activate()` never
runs, `new StatusBarItem(...)` never happens, and there is nothing to show an
eye. The `numRepos === 0` branch is reachable only in the few hundred
milliseconds between activation and repo discovery inside a folder that already
*is* a repository — which is why the maintainer only ever sees the
`$(type-hierarchy)` state.

**Borrowed-icon verification (the maintainer's explicit question).** The
behavior came in on `5d9da6d`, adapted from upstream `neo-git-graph` `4afcb69`
and `deba9af`. The adaptation of the *icons and wording* is faithful — upstream
uses the same `$(eye)` / `$(type-hierarchy)` split and the same "watching"
tooltip, and this fork correctly swapped upstream's inline `vscode.l10n.t`
strings for key-based lookups and dropped upstream's earlier
`statusBarItem.warningBackground` treatment. What was **not** carried across is
the precondition that makes it work: upstream activates on `onStartupFinished`
(verified against `upstream/main`'s manifest), so upstream's status bar item
always exists. This fork replaced `onStartupFinished` with the
`workspaceContains` pair in `039aa6c` ("Scope extension activation events") and
then removed the explicit `onCommand:` entries in `55f4d7f`. The borrow landed
on a manifest that cannot support it. The status bar code itself is correct and
needs no change.

The rest of the watching machinery is intact and needs no work:
`createRepoWatcher()` (`src/extension/workspaceWatcher.ts`) already watches every
workspace folder from zero repos, and its create path runs `sendRepos()` →
`statusBarItem.setNumRepos()`, so `git init` in an open folder will flip the eye
to the graph icon the moment activation is fixed.

**Maintainer decision (`2026-08-25`): make the eye work again.** Restore
`onStartupFinished` to `activationEvents`. The watching promise stays; the
manifest is what changes.

Fix:

- Add `onStartupFinished` back to `activationEvents` in `package.json`.
  `activate()` is cheap — repo discovery is already an async IIFE
  (`src/extension.ts:100-105`) — and this is exactly what upstream does, which
  is why the borrowed behavior works there.
- Edit `tests/backend/manifest.test.ts:39`, which currently asserts
  `expect(manifest.activationEvents).not.toContain("onStartupFinished")`. That
  assertion encodes the very decision being reversed by `039aa6c`; replace it
  with a positive assertion and a comment recording that the extension
  deliberately activates at startup so the status bar item can exist in a
  non-Git workspace. Keep the existing assertion that no `onCommand:` entries
  are listed — VS Code still generates those implicitly.
- Leave `src/statusBarItem.ts` alone. The eye branch, the icons, the tooltips
  and the l10n keys are all correct; they were simply unreachable.
- Add an extension-host test that the status bar item is created and shown with
  `numRepos === 0`, so a future activation-scoping change cannot silently break
  this again. `tests/backend/statusBarItem.test.ts` is the existing home for
  status bar coverage.
- Verify by hand: open a folder with no `.git` and confirm the `$(eye)` item
  appears with the watching tooltip, then `git init` in that folder and confirm
  the watcher flips it to `$(type-hierarchy)` without a reload.

**Secondary finding, verify before relying on it:** `workspaceContains:**/.git`
is very likely dead. VS Code resolves a glob-bearing `workspaceContains` through
its file-search service, which honors `files.exclude`, and the default
`files.exclude` contains `**/.git`. If so, only the non-glob
`workspaceContains:.git` fires — meaning a workspace whose **root** is not a
repository but which contains one in a subfolder never activates the extension
either. Confirm this against a real VS Code instance (open a folder containing
only `sub/repo/.git` and watch the extension host log) before either deleting
the entry or replacing it with a working equivalent.

Implementation record (`2026-08-25`):

- `onStartupFinished` is back as the first `activationEvents` entry; the
  negative manifest assertion was replaced with a positive one carrying the
  rationale comment, and the no-`onCommand:` assertion stayed.
- **The secondary finding was confirmed and the dead glob removed in the same
  slice.** Against real VS Code `1.134.0` (variant extension copy without
  `onStartupFinished`, isolated profiles): a workspace whose root is not a repo
  but which holds `sub/repo/.git` never activated under default settings — and
  still never activated with `files.exclude`'s `**/.git` un-excluded, so the
  mechanism is deeper than `files.exclude`: VS Code's file search hard-excludes
  `.git` directories. The control (`.git` at workspace root) activated via the
  non-glob `workspaceContains:.git`, proving the variant was functional.
  `workspaceContains:**/.git` is therefore removed; the manifest test now
  asserts its absence with this evidence recorded in a comment.
- `src/statusBarItem.ts` untouched. Coverage added on two levels: the unit test
  locks construction → `show()` → `$(eye)` at zero repos and the
  `setNumRepos(1)` → `$(type-hierarchy)` flip; a new extension-host launch in
  `.vscode-test.mjs` (`non-git-workspace`, fixture without `.git`) asserts the
  extension activates at startup, which future activation-scoping changes
  cannot silently break. Real-VS-Code hand verification: exthost log shows
  `activationEvent: 'onStartupFinished'` in a no-git folder, and `git init`
  plus a first commit flipped the watcher path (`addRepo → saveRepos →
  sendRepos → setNumRepos(1)` evidenced by the persisted repo state) without a
  window reload.
- Observation for the maintainer (not fixed here): the manifest declares no
  `capabilities.untrustedWorkspaces`, so in an untrusted workspace VS Code
  disables the extension entirely — the eye cannot appear there regardless of
  activation events. Also noted: `tests/extension/workspaceWatcher` host test
  waits only 10ms for a watcher callback and flaked once under VS Code cold
  start (clean on re-run); a future slice should raise that wait like its
  sibling test's 500ms.
- Full gate green before commit: strict Biome, typecheck, lint, `test`
  (backend 46/330, webview 34/304), `test:ext` both launches (49/49 + 1/1),
  `l10n:check` 100%, `package`, fresh coverage (80 files / 634 tests, 92.1%
  lines), `sonar:scan` task `8b6e8aee-fa38-42c9-8105-8670f72e18e2`, analysis
  `1419ad8f-c7d5-4b78-875b-28f930c23f1b`: `ZAM` gate **`OK`** —
  `new_coverage` `93.8%`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `2` (slice added 0), reliability and security `0`.

### BUG-6 — Cross-cutting: tag actions bypass the command log

**Status: fixed (`2026-08-25`). Priority: medium. Area: backend actions + messageHandler.**

Rolled up from BUG-1 and BUG-3 because it is one mechanical change and should
land with whichever of them goes first: `addTag` and `pushTag`
(`src/backend/actions/tag.ts:9`, `:39`) still call `simple-git`'s `git.tag()`
and `git.push()`, and `src/extension/messageHandler.ts:354` and `:356` do not
pass `recordGitCommand`. `deleteTag` was migrated to `runGitRaw` in Phase 15;
these two were left behind. Until they move, the git-command log silently omits
every tag creation and every tag push, which is also why this class of bug was
invisible in earlier debugging. Phase 0.5 already sets the direction: new work
uses explicit raw git commands through `gitRunner` and reduces high-level
`simple-git` parser usage in code it touches.

Resolution record (`2026-08-25`): `addTag` moved to `runGitRaw` with
`recordGitCommand` in the BUG-3 slice; `pushTag` followed in the BUG-1 slice.
All three tag actions (`addTag`, `pushTag`, `deleteTag`) now run through
`runGitRaw` and reach the git-command log; the messageHandler routes pass
`recordGitCommand` for each. Verified by the `tag.addTag`/`tag.pushTag`
record-line assertions in the backend action and webview messageHandler tests.

### Suggested slice order

1. **BUG-3** — one flag (`--no-sign`) removes a blocking, editor-popping
   failure; do it first and ship it.
2. **BUG-1 + BUG-6** — same file, same types, same tests; one slice.
3. **BUG-5** — manifest one-liner plus a test reversal; the maintainer has
   decided (restore `onStartupFinished`), so this is unblocked.
4. **BUG-4** — new setting, so manifest + config + l10n + README + CSS + tests;
   largest of the four.
5. **BUG-2** — the feature work that BUG-1 unblocks.

Each slice follows the standing gate order in this document: strict Biome on
touched files, full typecheck/lint, full tests, `pnpm run l10n:check`, fresh
`pnpm run test:coverage`, then `pnpm run sonar:scan` polled to an `OK` `ZAM`
gate **before** committing. Advance `sonar.projectVersion` when the maintainer
opens a new analysis epoch for this backlog.

## Near-Term Work Order

Maintainer-set priority (`2026-08-25`): **the Immediate TODOs bug backlog above
comes before every phase item below.** BUG-1 through BUG-6 were reported against
`v1.3.0` and root-caused the same day; work them in the slice order recorded at
the end of that section. Nothing in the phase list starts until that backlog is
closed or the maintainer explicitly redirects.

**Backlog closed `2026-08-25`** — all six entries fixed and gated; per-entry
implementation records with Sonar task ids are in the backlog section above.
Deferred to the maintainer: the BUG-4 tag-graying re-check (path 3, the
signed-vs-unsigned pill tint, is a design question if it still reads as gray),
and the untrusted-workspace observation recorded under BUG-5.

Earlier priorities (`2026-07-03`): Phases 12, 13, and 14 are complete.
Phase 15 (tag surfaces) completed `2026-07-29` and shipped as `v1.1.1`.

1. Run baseline checks on `AI-dev` at the start of the session.
2. Work the Immediate TODOs backlog: BUG-3, then BUG-1 + BUG-6, then BUG-5,
   then BUG-4, then BUG-2. All maintainer decisions are recorded in the entries
   (`2026-08-25`); nothing in the backlog is blocked on an answer.
3. Phases 12, 13, and 14 are complete; see their implementation records.
4. Then continue the remaining partial phases:
   docked-bottom commit details (Phase 2), graph stash rows (Phase 7),
   arbitrary two-commit/ref comparison and external directory diff
   (Phase 8), repository dropdown ordering (Phase 9), text
   rendering/tag signatures/mailmap/encoding (Phase 10).

## Telemetry (`telemetry` branch, `2026-08-26`)

Usage telemetry for feature ranking, **client side only in this repository**.
The Go ingest service was extracted on `2026-08-26` into its own private
repository, `PlohnenSoftware/git-graph-libre-telemetry`, checked out beside
this one as `../git-graph-libre-telemetry`. Its self-contained README carries
the design decisions, event model, API contract, schema, deployment, and the
no-IP-address rule; do not move backend detail back into this knowledge base
or the extension README. A merge to that repository's `main` builds the image
in GitHub Actions and calls the Coolify deploy webhook, so a push there is a
deployment.

Client rules that must survive any refactor:

- **Goal**: rank features by how many installations use them, so effort goes
  where it is used. Not crash reporting, not performance, not user counts.
- **Compliance boundary** is `vscode.env.createTelemetryLogger()`. It gates on
  the user's global telemetry setting and scrubs paths, URIs, and usernames
  before our sender is called. Never bypass it with a direct `fetch` from
  feature code.
- **Three chokepoints** cover the feature surface, and telemetry calls must
  not be scattered beyond them: `registerAction()` in
  `src/extension/messageHandler.ts` (all webview actions, outcome included),
  `register()` in `src/extension/commandManager.ts` (palette commands), and
  `createViewFeatureReporter()` in `src/telemetry/viewFeatures.ts`, called from
  the `loadCommits` route, for features that consist of something being
  *shown*. The action payload is in scope at the first one and carries
  repository paths, branch names, and commit hashes — send `command` only.
- **View-side features are reported once per session, never per load.** The
  commit-load path runs on activation, every refresh, every filter change and
  every watcher tick, so per-load reporting would rank one user's refresh
  habits instead of installations; read those numbers as "installations that
  saw it". Two further rules live in that module: a signal fires only when the
  feature *took effect* (the unreachable scan is skipped by the query unless
  the log covers all refs, so an enabled setting under a filter is intent, not
  use), and feature ids must match the ingest's
  `^[a-z][a-zA-Z0-9._-]{0,63}$` — a malformed id makes the ingest reject the
  **whole batch**, silently losing up to 25 unrelated events, which is why the
  pattern is mirrored in the client and asserted in tests.
- **Client modules** in `src/telemetry/`: `index.ts`
  (`createTelemetryReporter()`), `endpoint.ts` (the compiled-in ingest URL),
  `sender.ts` (TelemetrySender → fetch transport), `eventQueue.ts` (pure
  batching: 25 events / 30 seconds), `activationSnapshot.ts` (once-per-session
  settings-divergence snapshot — only *that* a setting changed, never the
  value), `commonProperties.ts` (the OS properties VS Code does not inject;
  carries its own removal condition), `consentPrompt.ts` (the consent
  question — see its own section below), `language.ts` (which translation the
  session actually used).
- **Two settings gate sending**, and both must be on: VS Code's global flag,
  which always wins, and `git-graph-libre.telemetry.enabled`. Ours is a
  three-state consent (`unset` / `enabled` / `disabled`) defaulting to `unset`
  since `2026-09-02`, and only `enabled` sends — an unanswered question is not
  permission, so `unset` is silent *and* keeps prompting. `config.ts`
  normalizes anything unrecognized to `unset` rather than to `enabled`, and
  maps a leftover boolean from the pre-consent branch build onto the state the
  user actually chose (`false` → `disabled`), because reading a refusal as
  "not asked yet" would resume sending.
- **`TELEMETRY_ENDPOINT` in `src/telemetry/endpoint.ts` is the on/off switch.**
  An empty string makes the reporter a total no-op, which is how the client
  shipped while no ingest existed; on `2026-09-02` it was pointed at the
  deployed service, so telemetry is live from the next release. The constant
  sits in its own module precisely because that module imports nothing from
  `vscode`: `index.ts` does, so the backend test project cannot load it, and
  the shipped value would otherwise be untestable
  (`tests/backend/telemetry/endpoint.test.ts`).
- **`sendErrorData` is deliberately a no-op** and the logger sets
  `ignoreUnhandledErrors: true`. The two must change together: without the
  flag, VS Code routes every unhandled extension-host error into the sender,
  and the ingest accepts only `activate` and `feature`.
- **Every user-facing telemetry string is localized in all five languages**
  (`en`, `nl`, `pl`, `zh-cn`, `zh-tw`). Dutch was added on `2026-09-02` as
  `package.nls.nl.json` plus `l10n/bundle.l10n.nl.json`, mirroring the existing
  sets; `pnpm run l10n:check` discovers new locales by filename, so a language
  is complete or it is visibly not. Note `time.needFormatMonth` and
  `time.dateformat` are behavior values rather than prose — Dutch follows the
  Polish pair (`true`, `DD MM YYYY`), not the Chinese one.
- **The `activate` event reports `language` and `translation` together**, and
  the pair is the point: `language` is VS Code's display language, the one the
  user asked for, and `translation` is the bundle that actually served them. A
  difference between the two is a request for a language this build does not
  ship — the single most actionable thing this telemetry can surface, and
  invisible if either property is dropped. `listBundleLanguages()` reads the
  shipped locales off the `l10n` directory rather than a constant, so adding a
  language cannot leave the reported list behind, and `resolveBundleLanguage()`
  deliberately mirrors VS Code's own fallback order (exact, then base language,
  then English) — a resolver that disagreed with the runtime would report a
  translation the user is not seeing.
- **`telemetry.json` at the repository root** declares every collected
  property for `code --telemetry` and is shipped in the VSIX. Update it in the
  same slice as any event or property change, and keep the README's Telemetry
  section (the user-facing disclosure) in sync with it.

Deployment (`2026-09-02`): the ingest answers at
`https://t.plohnensoftware.download`, behind Cloudflare and Caddy. `GET
/healthz` returned `{"database":true,"ok":true}` and a correctly shaped batch
POSTed to `/v1/events` returned `204`, so routing, validation, and the database
write path are all live. That probe inserted one synthetic row; clear it with
`delete from events where machine_id = 'probe-machine';`.

### Consent prompt (`2026-09-02`)

`src/telemetry/consentPrompt.ts` asks the question the `unset` default leaves
open: once from `activate()`, and again from `openGraphView()` on every graph
open while the answer is still missing. Rules worth keeping:

- **Dismissal is not an answer.** Closing the notification leaves the state
  `unset`, so nothing is sent and the next graph open asks again. Recording a
  dismissal either way would collect data nobody agreed to, or bury the
  question forever.
- **No "one question at a time" latch — this was a real bug (`2026-09-02`).**
  The first version held a `pending` flag cleared in the `finally` of the
  `showInformationMessage` promise. That promise often never resolves: the
  workbench's `get sticky()` treats a notification with buttons as sticky only
  at `Severity.Error`, so an Info prompt is non-sticky and
  `PURGE_TIMEOUT[Info]` (10 seconds) calls `removeToast()`, which removes the
  *toast* and leaves the notification in the model — `onDidClose` never fires.
  The flag therefore latched for the rest of the session and silently blocked
  every later prompt, which is what the maintainer hit as "reopening a
  notification some time after it was closed doesn't work": **Set now** and the
  per-graph-open prompt were both dead once the toast had aged out. The guard
  was also unnecessary — `NotificationsModel.addNotification()` closes an
  identical notification before adding the new one, so at most one of these
  prompts exists no matter how many times it is requested. Do not reintroduce
  a latch here; a regression test pins the unresolved-promise case.
- **Expect the toast to vanish by itself after ~10 seconds.** That is why the
  gate screen persists behind it and why its hint text points at **Set now**:
  the notification is recoverable, not permanent.
- **The refusal button is labelled "Reject and Don't Show Again"** (`2026-09-03`)
  because that is what it does — `disabled` is both silent and no longer
  pending, so neither the notification nor the gate screen returns. VS Code's
  notification guidelines ask for a **Do not show again** option on every
  notification; rather than adding a third button that silences without
  answering, the refusal *is* that option and the label says so. Keep the label
  and the written state in agreement: a rename that no longer promises silence,
  or a state that leaves the question pending, would each make the other a lie.
- **Accepting while VS Code's global switch is off** gets a follow-up saying
  that switch wins, with a button running `workbench.action.openSettings` on
  `telemetry.telemetryLevel`. The consent is still stored as `enabled` — it is
  a valid preference that cannot take effect yet, and silently storing it
  without a word would leave the user believing data is flowing.
- **A failed settings write is swallowed and logged**, never allowed to take
  activation or a graph open down with it. The state stays `unset`, so the
  question comes back rather than being lost.
- **No endpoint compiled in, no question.** Asking permission for something
  that cannot happen is noise.

**Maintainer reversal of `2026-09-02`: the banner became a gate.** The first
implementation put a standing notice in `#topBar` above the graph
(`webviewTelemetryNotice.ts`, `#telemetryNotice`, a `telemetryConsentChanged`
push, `renderTelemetryNotice()` in `main.ts`, and `telemetryConsent` on
`GitGraphViewState`). The maintainer rejected it as too easy to read past: an
unanswered question must **replace the whole graph**, not decorate it. All of
those surfaces were removed in the same slice rather than left in place — do
not reintroduce a banner.

What replaces it is `src/extension/webviewConsentScreen.ts`, a third body
variant in `buildWebviewHtml()` alongside the graph and the no-repository
placeholder:

- **It is a document, not an overlay.** No toolbar, no `web.min.js`, no
  `viewState`; nothing is mounted, so nothing has to be torn down when the
  answer arrives. `isGraphLoaded` is therefore `false` for it, which is what
  keeps `syncRetainedView()` and the repo callback from posting messages into
  a document with no listener.
- **Screen order: no-repository first, consent second.** A workspace with no
  repository cannot show a graph at all, so that screen states the more
  fundamental blocker.
- **Switching screens is a rebuild**, driven by
  `applyTelemetryConsentChange()` from the `telemetry.enabled` branch of the
  configuration listener. It rebuilds *only* when what is mounted contradicts
  the answer (`isGraphViewLoaded === isConsentPending(...)`); an
  `enabled` ↔ `disabled` change shows nothing new, and rebuilding then would
  reload the webview and drop the graph's live state.
- **`Set now` is load-bearing, not decoration.** Blocking the graph is only
  acceptable because there is a way back: dismissing the notification leaves
  the answer `unset`, and without the button the user would be stuck on a
  screen with nothing to click. It posts `showTelemetryConsent`, handled in
  `messageHandler.ts` outside `registerAction()` — it is not a git action, has
  no outcome to report, and telemetry is by definition off while the question
  it re-opens is unanswered.
- **`isConsentPending()` in `consentPrompt.ts` is the single predicate** behind
  both the notification and the screen, so they cannot disagree about whether
  the question is open. It also carries the empty-endpoint check: with
  telemetry compiled off there is no gate and no prompt.

**Research on the gate, `2026-09-03`** (done because an earlier note in this
file guessed that marketplace review might read the gate as coercive — that
guess was unfounded and is retracted):

- **No Marketplace rule prohibits it.** Nothing in the Visual Studio
  Marketplace Terms of Use or the Publisher Agreement addresses withholding
  functionality pending a consent answer, and no precedent of an extension
  being pulled for it was found.
- **GDPR Art. 7(4)'s bundling prohibition is not engaged.** EDPB Guidelines
  05/2020 invalidate consent when access is conditional on *consenting* to
  non-necessary processing. This gate conditions access on *answering*:
  refusing costs nothing and opens the graph, so there is no detriment to
  refusal.
- **What the guidance does bite on is prominence.** EDPB Guidelines 03/2022 on
  deceptive design name "unequal prominence" — accept visually dominant,
  refusal minimised — as non-compliant, and refusal must be as easy and
  conspicuous as acceptance. Our Accept is the accented primary because VS Code
  hard-codes `secondary: index > 0`; modal dialogs style their first button the
  same way, so **equal weighting is not achievable inside a notification at
  all** — only in our own webview. The maintainer accepted that trade-off
  knowingly; if it is ever revisited, the fix is Accept/Reject on the gate
  screen with identical styling, not a change to the notification.
- **`Don't: Send repeated notifications` does not apply**, and an earlier
  reading of this file's that said it did was wrong. The same guidelines ask for
  a **Do not show again** option on every notification; a clean refusal here
  stops the asking permanently, each prompt follows a user action (opening the
  graph) in a state where nothing else can proceed, and VS Code's own
  `addNotification()` dedupe satisfies "show one notification at a time".
- **Closest precedent**: the Julia extension defaults `julia.enableTelemetry`
  to `null`, prompts, and sends nothing until opted in — the same tri-state
  shape — but does *not* restrict functionality. The gate is this project's own
  choice, not common practice.

**Notification button styling — settled, do not re-open.** An earlier session
left this unresolved: modal dialogs clearly style their first button as
primary, and it was unclear whether plain notifications do. They do.
`renderButtons()` in `workbench.desktop.main.js` constructs each button with
`{ title: true, secondary: index > 0, ...defaultButtonStyles }`, so the
accenting comes from **argument order alone** — the first item passed to
`showInformationMessage` is the primary action and every later one is
secondary. Accept is therefore passed first, and `PROMPT_MODAL` in that module
stays `false`: modality would add nothing to the styling and would seize the
window. The flag exists as one line only because the modality choice is a
judgment call, not because the styling is in doubt.

### End-to-end verification of the sender seam (`2026-09-02`)

Everything below `vscode.env.createTelemetryLogger()` is unit-tested against a
fake and everything above it is VS Code's own code, so the handover between
them was the one unproven link — and it fails silently, which is
indistinguishable from "nobody uses this extension". It is now proven, and the
reason it *looked* broken is recorded here so nobody spends another session on
it.

**The extension host does not call a sender inside a test launch.**
`isLoggingOnly()` in
`resources/app/out/vs/workbench/workbench.desktop.main.js` is

```js
extensionTestsLocationURI ? true : !(isBuilt || disableTelemetry || (enableTelemetry && aiConfig?.ariaKey))
```

Its result reaches the extension host as
`initData.environment.isExtensionTelemetryLoggingOnly` and becomes
`ExtHostTelemetryLogger._inLoggingOnlyMode`, which `logEvent()` consumes as
`this._inLoggingOnlyMode || this._sender?.sendEventData(name, data)` — the
event goes to the hidden `extHostTelemetry (Not Sent)` output logger and the
sender is skipped. Every `pnpm run test:ext` launch sets
`extensionTestsLocationURI`, so `vscode.env.isTelemetryEnabled` and
`logger.isUsageEnabled` both read `true` while nothing is forwarded. An
earlier session hypothesized `ExtensionMode.Development` as the cause; that was
close but wrong, and the distinction matters — an ordinary F5 development host
of a *built* VS Code has `isBuilt` true and therefore **does** send.

**Verified against a packaged build.** `pnpm exec vsce package
--no-dependencies` with `TELEMETRY_ENDPOINT` temporarily pointed at a local
listener, installed into an isolated `--extensions-dir` plus `--user-data-dir`
(so the maintainer's real editor was untouched) under code-insiders
`1.136.0-insider`, opening a scratch repository with `--disable-workspace-trust`.
The `activate` event arrived roughly 30s later — the queue's flush interval,
not a hang — as a single-event batch. Two client behaviors were confirmed on
the wire at the same time: the event name arrived as the bare `activate`, so
`normalizeEventName()` really is load-bearing (VS Code prefixes
`PlohnenSoftware.git-graph-libre/`), and the batch envelope is the shape the
ingest validates.

**The common properties VS Code actually injects**, observed in that batch and
matching `getBuiltInCommonProperties` in the shipped extension host:
`common.extname`, `common.extversion`, `common.vscodeversion`,
`common.vscodemachineid`, `common.vscodesessionid`, `common.vscodecommithash`,
`common.vscodereleasedate`, `common.sqmid` (empty on this install),
`common.devDeviceId`, `common.isnewappinstall`, `common.product`,
`common.uikind`, `common.remotename`. Thirteen properties, far inside the
ingest's 64-property cap. Two corrections follow from that list:

- `common.devDeviceId` is **camelCase**, so "VS Code lowercases the injected
  keys" holds only for the keys the ingest actually maps to columns. Do not
  write a test asserting every `common.*` key is lowercase; it fails against
  reality.
- **`common.os`, `common.nodearch` and `common.platformversion` are not
  injected at all.** VS Code leaves that gap open in
  `extHostTelemetry.ts`. The ingest has `os`/`node_arch`/`platform_version`
  columns and both the README and `telemetry.json` promised them, so those
  columns were guaranteed to stay NULL and the user-facing disclosure
  overstated what was sent. Maintainer decision (`2026-09-02`): keep the
  columns and supply the three properties from the client through
  `createTelemetryLogger`'s `additionalCommonProperties`. Implemented the same
  day in `src/telemetry/commonProperties.ts` (no `vscode` import, so the
  backend project tests it): `common.os` and `common.nodearch` come from
  `process`, and `common.platformversion` is `os.release()` reduced to its
  leading numeric segments — the build/distribution suffix is the identifying
  part and is dropped. **Removal condition: when VS Code closes its own TODO
  and starts injecting them, delete that module in the same slice.** Nothing
  breaks if it is missed, because the logger mixes its built-ins in *after* the
  additional properties and VS Code's values would win, which is precisely why
  the duplication could sit there unnoticed. Owner: whoever next touches
  `src/telemetry/index.ts`.

`tests/extension/telemetry.test.ts` was rewritten to assert only what a test
launch can see — that the real `createTelemetryLogger` accepts the sender's
shape (its `validateSender` throws during activation, so a shape regression
breaks the extension rather than just losing data), that the logging-only
blindness is still the behavior, and that an empty endpoint is inert. Its
header comment carries the mechanism above; the throwaway `zzProbe.test.ts`
that discovered it was deleted.

**History note (`2026-09-03`).** This work was originally built as sixty-four
small resumable commits, and was squashed onto `AI-dev` as eight logical ones
at the maintainer's request. Two consequences for anyone reading back:

- **The per-slice records in this document cite Sonar task ids, not commit
  hashes**, which is why nothing here dangles after the rewrite. Keep it that
  way — a task id survives a rebase, a short SHA does not.
- **The ingest service is not in this history at all.** It was developed here
  for about twenty commits before moving to
  `PlohnenSoftware/git-graph-libre-telemetry`, and since it never shipped from
  this repository the add-and-remove churn was squashed out rather than
  preserved. Its design, deployment and schema live in that repository's own
  README; there is no `server/` directory here and the former
  `docs/TELEMETRY_PLAN.md` is gone with it. The durable client rules are the
  section above.

Every slice was gated to an `OK` `ZAM` result before its original commit, and
the squashed branch was gated again as a whole after the rewrite.

### Consent epoch — session record (`2026-09-02`)

Seven slices, each gated in full before its commit (strict Biome on staged
files, `package`, `test`, `l10n:check`, fresh `test:coverage`, `sonar:scan`
polled to an `OK` `ZAM` gate). In order: the sender-seam verification, the OS
common properties, the three-state consent setting, the consent prompt, the
graph notice, the two read-side features, and Dutch. Gate results ran
`new_coverage` `89.3`–`93.7`, `new_violations` `0`, duplication `0.0`, and all
four project-wide conditions `0`. One scan came back with `new_violations` `2`
— both `typescript:S1135` for the word `TODO` in a prose comment of this
slice's own new module — and was fixed and re-gated rather than accepted under
the threshold of `5`.

Verified against a packaged build, in an isolated `--extensions-dir` /
`--user-data-dir` under real code-insiders `1.136.0-insider`, three times:

1. **Before consent existed**: the `activate` event arrived, proving the seam
   (recorded in the section above).
2. **Consent at its `unset` default**: the notification appeared, and the local
   listener received **nothing at all** across a full run and the disposal
   flush that follows window close. The default really is silent, not merely
   unsent-by-accident.
3. **Consent set to `enabled`**: the `activate` event arrived carrying
   `common.os` `linux`, `common.nodearch` `x64` and `common.platformversion`
   `7.2.2` — the `-1-cachyos` suffix stripped as designed — alongside
   `settingsChanged` `1` and `setting.telemetry.enabled` `true`, i.e. the
   snapshot recording *that* the setting was set without its value.

The notification's rendering was also confirmed by eye at (2): **Accept
accented, the refusal secondary**, matching the `secondary: index > 0` reading
of `renderButtons()` with no modality needed. (The refusal was labelled
`Reject` at the time; it became `Reject and Don't Show Again` on `2026-09-03`.)

`pnpm run test:ext` passes with the prompt wired in — a test launch shows the
notification and moves on, so the suite is unaffected.

Left for the maintainer, unchanged from the previous session: the synthetic row
from the `2026-09-02` route probe is still in the production database
(`delete from events where machine_id = 'probe-machine';`). The probes above
never touched production — the endpoint was pointed at `127.0.0.1` for each
one, and restored afterwards.

## Temporary language switcher (`2026-09-03`)

A double right-click on the version in the status strip opens a small menu
headed **Hidden menu**, listing every shipped locale; picking one re-renders
the graph in that language. Four properties are deliberate and should survive
any refactor:

- **It is English, always.** `HIDDEN_MENU_HEADER` and the language labels in
  `webviewLanguages.ts` are hardcoded English rather than localized. The menu
  exists to be usable when the interface is in a language the reader cannot
  navigate; translating it would put the escape hatch behind the very door it
  opens. Do not "fix" this by running the labels through `l10n.t()`.
- **The override lives in the panel closure and nowhere else.**
  `temporaryLanguage` in `webviewPanel.ts` is not persisted to settings or
  workspace state, so closing the graph tab ends it. Anyone can switch the
  language on someone else's editor without leaving it changed.
- **Switching is a document rebuild, not a message.** Every string is baked in
  at build time — toolbar, status strip, table headers — so `update()` is the
  only honest way to apply a new language. That is also why the switcher is
  worth having as a rebuild rather than a live re-render: correctness over
  keeping graph state across a deliberate, momentary switch.
- **The requested locale is validated against the shipped list** before it
  reaches `createBundleTranslator()`. Anything arriving over the bridge is
  webview input, and an unchecked locale would become a filename to read.

`getWebviewLocalizedStrings()` takes a `translate` function for this, defaulting
to `l10n.t`; `createBundleTranslator()` reads the requested bundle and falls
back to English, then to the key, which is the same order `l10n.t()` degrades
in — a switched webview never looks more broken than an unswitched one.

## Future direction: integrate with VS Code's native source control (`2026-09-03`)

**Nothing here is implemented, and nothing should be implemented from it
without the maintainer saying so.** These are findings from a survey of what
VS Code 1.136 actually exposes, recorded so the next attempt starts from facts
rather than from a fresh survey. Maintainer's intent: stop treating the graph
as an island and cooperate with the editor's own SCM surfaces for **choosing
which repository is active**, **initialising new repositories**, and **showing
which repository the graph is on**. Repository selection in a graph navbar is
something the non-free Git Graph forks have and this project has only inside
its own toolbar; the maintainer would rather hook the editor's selector than
grow another one.

**The target is the built-in `vscode.git` extension's API** (confirmed by the
maintainer). It is reached with
`vscode.extensions.getExtension("vscode.git")?.exports.getAPI(1)`, and its
package version in 1.136 is `10.0.0`. Read it from
`resources/app/extensions/git/dist/main.js` when the shape matters; the useful
surfaces are:

- `api.repositories`, `api.onDidOpenRepository`, `api.onDidCloseRepository`,
  `api.getRepository(uri)`, `api.getRepositoryRoot(...)`, `api.openRepository`.
- **`repository.ui.selected` plus `repository.ui.onDidChange`** — this is the
  "which repository is active in the SCM UI" signal, and it is the piece worth
  building on. In the bundle it is a small class whose `onDidChange` wraps the
  repository's `onDidChangeSelection`, and `selected` reads straight through.
  Following it would let the graph track the editor's active repository instead
  of keeping an independent notion of one.
- **`api.init(uri)`** for creating a repository, rather than the
  `executeCommand("git.init")` route upstream took in `49c8025`. Both inherit
  the built-in behavior; the API version returns the repository.
- The workbench keeps `scm.activeRepositoryName` and
  `scm.activeRepositoryBranchName` context keys, usable in `when` clauses.

**On sitting "next to the branch selector":** that indicator is not a status
bar item an extension can neighbour reliably. The Git extension publishes it
through `SourceControl.statusBarCommands`, which the workbench renders itself —
the only `window.createStatusBarItem` in the whole Git extension is
`git.blame` (Right, priority 200). So the options are a status bar item of our
own with a tuned priority (fragile, ordering is a popularity contest), or the
sanctioned route: contribute to the SCM menus. The contribution points that
exist in 1.136 are `scm/title`, `scm/sourceControl`, `scm/repository`,
`scm/repositories/title`, `scm/resourceState/context`,
`scm/resourceGroup/context`, `scm/resourceFolder/context`, `scm/change/title`,
`scm/history/title`, `scm/historyItem/context`, `scm/historyItemRef/context`,
`scm/artifact/context`, `scm/artifactGroup/context` and `scm/inputBox`. An
"Open in Git Graph" on `scm/sourceControl` or `scm/repository` is the obvious
first step and costs almost nothing.

Open questions for whoever picks this up: whether the graph's own repository
dropdown should follow `ui.selected` or keep an independent selection (they
will disagree the moment someone changes one of them); whether selecting a
repository in the graph should write back through the Git extension at all,
given the API exposes selection as read-only state; and what happens in
multi-root workspaces where the graph currently tracks its own last-active
repository in `ExtensionState`.

## Documentation and Verification Rules

- Keep README as the entry point and link deeper docs from it.
- Update this file when adding or reordering feature phases.
- Add or update tests in the same slice as behavior changes.
- Keep all new code and code touched in a slice compatible with
  `biome.strict.jsonc`; do not use the migration-friendly baseline as the quality
  target for fresh work.
- Treat Biome and SonarQube as pre-commit gates for meaningful code slices:
  strict Biome must be clean for touched/staged files, coverage must be generated
  with `pnpm run test:coverage`, and the configured SonarQube quality gate must
  be `OK` before committing. If the gate cannot be run, do not commit; record
  why it is blocked and what risk remains.
- While touching a file in an agile cycle, fix existing local code issues in
  that file when they are reasonable to address in the slice, including findings
  reported by Biome, SonarQube, typechecking, and obvious maintainability
  problems. Do not hide behind legacy debt in touched files, but keep unrelated
  whole-tree cleanup in a separate slice.
- Treat `var` as forbidden in fresh and touched code. Prefer `const` by default,
  use `let` only for reassignment, and document the rare case where `var`
  function scoping is intentionally required.
- Prefer small commits by feature slice.
- Before calling a feature complete, record the exact checks run and any known
  gaps in the commit or handoff note.
