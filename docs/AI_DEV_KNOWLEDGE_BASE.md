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

The rule for this branch is:

- Use this repository's own code and public API behavior as the implementation
  base. Everything written here is AGPL-3.0-or-later.
- Reimplement behavior from first principles using Git CLI documentation, VS Code
  extension APIs, and this repo's existing patterns.
- Keep implementation notes and comparisons in docs so later contributors can
  see which ideas were considered and how the clean-room boundary was handled.

## Maintainer and Agent Source of Truth

This document is the central maintainer and agentic knowledge base for the
`AI-dev` branch. `README.md` remains the public project entry point, but agent,
Claude, Codex, and other continuation files should be short pointers here
instead of duplicating rules.

### Branch containment

`AI-dev` is the only branch that carries AI/agent tooling. Release branches
(`v1.0.0` and any later line) must stay free of it:

- `CLAUDE.md`, `CODEX.md`, `agents.md`, `docs/AI_DEV_KNOWLEDGE_BASE.md`, and
  `graphify-out/` exist only here. Never add them to a release branch, and
  never link to them from `README.md` or any other published file.
- Tooling config that only these artifacts need — the `/graphify-out/` ignores
  in `.gitignore` and the `graphify-out/**` Sonar exclusion — also belongs only
  here. Both had leaked onto `v1.0.0` and had to be removed.
- Integrate by rebasing `AI-dev` onto the updated release branch. Never merge
  `AI-dev` into a release branch.

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
  `Co-Authored-By: Codex <codex@openai.com>`. Never add an agent trailer to a
  commit on a release branch; see Branch containment above.
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
- For meaningful code slices, generate coverage with `pnpm run test:coverage`
  before SonarQube and require the local SonarQube quality gate to pass. If the
  SonarQube server is unavailable or the gate cannot be run, record the exact
  reason and remaining risk in the handoff.
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
- SonarQube is the optional deeper analysis gate beside Biome. Use
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
- Scan a committed revision with coverage already generated. A scan of a
  staged-but-uncommitted tree logs `Missing blame information` for every changed
  file and tags the analysis with the *previous* revision, which makes new-code
  classification unreliable; a scan without `coverage/lcov.info` logs `No LCOV
  files were found` and records no coverage at all. Run
  `pnpm run test:coverage`, commit, then scan.
- The `Previous Version` new-code window is only as tight as
  `sonar.projectVersion`. That value has stayed `1.0.0` since the
  `0.4.1-ai-dev` analysis of `2026-07-03`, so new code currently spans 16,408
  lines — the whole 1.0.0 body of work, not the slice in front of you. Expect
  gate conditions to describe the release rather than your change until the
  version is deliberately advanced.
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

Regenerated on `2026-07-25` from branch `AI-dev` at commit `67e2045`, which is
reachable; `graph.json` records it in `built_at_commit`. Refresh after code
changes with `graphify update .` then `graphify tree`, and if a query looks stale
compare `built_at_commit` against `git rev-parse HEAD`.

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
| 10 Advanced history, text, integrations | Partial — issue links, config export, archive, commit signature status done; text rendering, tag signatures, mailmap, code review, encoding remain |
| 12 Toolbar dropdown name truncation and find row | Complete |
| 13 Settings hub: tabbed widget, color editor, settings export | Complete |
| 14 Reveal highlight: persistent blink and configurable color | Complete |

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

**Status: mostly complete** — the repository settings modal covers display-name override, per-repo view toggles (stashes, tags, reflog commits, first parent, remote branches), user details, remotes, issue linking, and config export. Remaining: initial-branches-on-load selection.

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

**Status: partially complete** — issue linking, repo config export/import sharing (`7a18099`), ref archives (`b4d97fe`), and commit signature status are done. Remaining: markdown/emoji message rendering, inline commit body, tag signature status, `.mailmap` support, code-review state, file encoding setting, and an uncommitted-changes details view.

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
  - The coverage condition is not a property of this slice. With
    `sonar.projectVersion` still `1.0.0` the `Previous Version` window reaches
    back to the `0.4.1-ai-dev` analysis of `2026-07-03`, covering 16,408 new
    lines with `465` uncovered of `3,121` to cover. Closing it means either
    broad coverage work across the 1.0.0 surface or advancing
    `sonar.projectVersion` to open a new baseline. **Open maintainer decision.**
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

## Near-Term Work Order

Maintainer-set priorities (`2026-07-03`): Phases 12, 13, and 14 are complete.

1. Run baseline checks on `AI-dev` at the start of the session.
2. Phase 12 is complete; see the Phase 12 implementation record for details.
3. Phase 13 is complete; see the Phase 13 implementation record for details.
4. Then continue the remaining partial phases:
   docked-bottom commit details (Phase 2), graph stash rows (Phase 7),
   arbitrary two-commit/ref comparison and external directory diff
   (Phase 8), repository dropdown ordering (Phase 9), text
   rendering/tag signatures/mailmap/encoding (Phase 10).

## Documentation and Verification Rules

- Keep README as the entry point and link deeper docs from it.
- Update this file when adding or reordering feature phases.
- Add or update tests in the same slice as behavior changes.
- Keep all new code and code touched in a slice compatible with
  `biome.strict.jsonc`; do not use the migration-friendly baseline as the quality
  target for fresh work.
- Treat Biome and SonarQube as pre-commit gates for meaningful code slices:
  strict Biome must be clean for touched/staged files, coverage must be generated
  with `pnpm run test:coverage`, and the local SonarQube quality gate should be
  `OK`. If the gate cannot be run, record that it was skipped, why, and what
  risk remains.
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
