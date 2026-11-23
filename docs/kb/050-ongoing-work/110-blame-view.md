---
summary: >-
  Next-release execution overview for the Blame view (`2026-11-23`), modeled on
  the Reflog tab register: slices F4-01 to F4-09 (CLI porcelain blame query,
  hotspot scoring model, GitHub-inspired editor-tab view, 10-step OKLCH heat
  palette, parent-blame rewind and toggles, commit popover and Graph/Diff
  links, editor/Explorer/SCM/Commit Details entry points, worktree/bare/unsaved
  hardening, and optional Rust engine parity). Holds recommended decisions
  BQ1–BQ9, wave schedule, shared-file serialization, model choices, and
  integration acceptance.
---

# Blame view (`2026-11-23`)

Status: in progress (`2026-11-23`), for release 1.11.0.

**Maintainer goal, `2026-11-23`:** "implement the slices described in the
recent commits and finalize release 1.11.0", with the orchestrating agent
as integrator. That goal answers BQ9 (release **1.11.0**) and accepts the
recommended defaults of BQ1–BQ8 below as written; BQ8 stays conditional on
the profiling it names (recorded under F4-09 when it runs). It also sets
the agent choice for every dispatch of this release, as Multi-agent
releases (Rules) requires: **Claude Haiku subagents for the easiest slices
(`F4-02`, `F4-04`, docs and mechanical edits), and headless Muse Code
(`muse exec --yolo "<prompt>"`, run inside the slice worktree) for the
complex ones (`F4-01`, `F4-03`, `F4-05`–`F4-09`)**, replacing the Sonnet
column below. Escalation stays one step up: a failed Haiku slice goes to
Muse Code in the same worktree.

Maintainer request, `2026-11-23`: prepare documentation beside the Git Graph+
phases for an additional **Blame view** inspired by GitHub's blame view with
**hotspot coloring** for the next release — overview first, then tailored
subagent slices for later execution. Multi-agent releases (Rules) applies.
Integration branch: `main`, local and unpushed. Slice branches:
`blame/F4-0N`. Worktrees: `/tmp/ggl-blame-f4-0N`. The release number is the
maintainer's. The detailed design and verified Git `2.56.1` facts live in
"Git Graph+ features and next-release additions: research and slice plan"
(Future work), subsection "Blame view" (`040-blame-view.md`); where a slice
file under `110-blame-view/` differs from that note, the slice file wins.

## Decisions (recommended defaults; confirm before dispatching UI slices)

`F4-01` and `F4-02` are pure backend/scoring foundations with no user-visible
surface and can start immediately. Confirm or override `BQ1`–`BQ9` before
dispatching `F4-03` onward:

- **BQ1 (surface):** dedicated editor-tab webview panel
  (`git-graph-libre.blameTab`, own bundle `out/blameTab.min.js`), modeled on
  the GGL Diff tab and Reflog tab.
- **BQ2 (hotspot scale & palette):** 10-step perceptual OKLCH warm heat ramp
  (`--ngg-blame-heat-0` oldest/coolest through `--ngg-blame-heat-9`
  newest/hottest) over **file-relative rank-quantile** commit timestamps by
  default, with `Off` and optional `Calendar age` / `Churn` modes. Dedicated
  dark-theme, `body.vscode-light`, and `@media (forced-colors: active)` rules;
  uncommitted lines use `--ngg-uncommitted`.
- **BQ3 (tab reuse):** single reused Blame tab with an in-tab Back/Forward
  revision navigation stack, matching GGL Diff tab and Reflog tab.
- **BQ4 (source text):** plain monospaced source text using VS Code's
  `editor.fontSize`, `editor.lineHeight`, and `editor.tabSize` (matching GGL
  Diff tab, zero new runtime dependencies).
- **BQ5 (default blame flags):** plain `git blame --porcelain` by default;
  auto-apply `.git-blame-ignore-revs` when present at the repository root
  with a visible header toggle chip; `-w`, `-M`, and `-C` toggleable in the
  header.
- **BQ6 (unsaved buffers):** when opened from a dirty unsaved editor, blame
  the live buffer via `git blame --contents -` with an "Unsaved buffer" pill
  and a one-click jump to `HEAD`.
- **BQ7 (limits & settings):** constants, no new settings beyond
  `contextMenuActionsVisibility.commitDetailsViewFile.showBlame`: binary sniff
  over the first `8,000` bytes (matching `diffTab/engineSource.ts`), `2 MB`
  size cap, `25,000` line cap.
- **BQ8 (Rust engine read):** CLI first; `F4-09` (`gix` blame in
  `engine/native/core`) runs only after profiling on large files confirms a
  meaningful speedup.
- **BQ9 (release placement):** next feature release; keep `F4-01`–`F4-09`
  until the release number is stamped.

## Release 1.11.0 answers (`2026-11-23`)

"Release 1.11.0 — Looking Back" (Ongoing work) holds the maintainer's answers
for this run. For the Blame slices they mean: no editor title-bar icon
(F4-07); agents translate all four languages; tracks may overlap on shared
files, with the integrator resolving conflicts (this replaces the
serialization rule below for this run), and Blame l10n keys are appended at
the end of each bundle; the Blame tab reports opening and its outcome through
T1's telemetry pattern once T1 is integrated (no other telemetry);
worktrees under `/home/zam/Desktop/prog/_GGL/.ggl-wt/`.

## Standing rules for every slice

- **Clean-room:** implement from Git's `git-blame(1)` documentation, VS Code
  APIs, and Git Graph Libre's own patterns. Copy no code, CSS, or literals
  from GitHub, GitLens, Git Graph+, `vscode-git-graph-rs/src` or `/web`, or
  post-MIT `mhutchie` sources.
- **One name and one shape for a shared concept (Reference):** from `F4-03`
  onward, reuse `abbrevCommit` + `config.shortHashLength()`, `ui.commit`,
  `ui.date`, `config.dateFormat()` + `src/webview/utils/date.ts`,
  `editor.fontSize`/`lineHeight`/`tabSize` (`diffTabPanel.ts` convention),
  resizable gutter width (40px floor, `reflogTab/columnResize.ts` pattern),
  `linkifyText` + `issueLinking`, and `AvatarManager`. Do not invent parallel
  hash-length or date helpers.
- **Styling & accessibility:** VS Code theme tokens first, `--ngg-*` OKLCH
  fallbacks second, `color-mix(in oklab, ...)` for tints, zero hex/RGB/HSL or
  named color literals, CSS regression test, and headless QtWebEngine dark +
  light renders for every slice that changes visual appearance.
- **No unapproved telemetry:** registering palette/menu commands through
  `commandManager.register()` uses the already-declared `feature` event; no
  new telemetry event or `telemetry.json` change is allowed.
- **Models (cheapest first, escalate one step on failure):** Claude Haiku for
  `F4-02` and `F4-04`; Claude Sonnet for `F4-01`, `F4-03`, `F4-05`, `F4-06`,
  `F4-07`, `F4-08`, and `F4-09`.
- **Shared-file serialization & wave schedule:**
  - `F4-01` runs alone first (establishes backend types & CLI query).
  - `F4-02` runs after `F4-01`; optional `F4-09` (if `BQ8` is approved) touches
    only `engine/**` and `src/backend/engine/blame.ts`, so it may run in
    parallel with `F4-02`–`F4-07` without colliding on shared files.
  - `F4-03` through `F4-08` all edit `src/webview/blameTab/*`,
    `src/extension/blameTab/*`, and `l10n/bundle.l10n*.json` (with `F4-06` and
    `F4-07` also touching `src/extension/messageHandler.ts`, `src/types.ts`,
    `package.json`, and `src/webview/main.ts`), so they run **serially** one
    after another. Never overlap two slices that touch `package.json`,
    `l10n/bundle.l10n*.json`, `src/types.ts`, `src/extension/messageHandler.ts`,
    or `src/webview/blameTab/*`.
  - If the remaining Reflog slices (`F1-05`–`F1-08`) are executed in the same
    session, never run a Reflog slice that edits `l10n/bundle.l10n*.json`,
    `package.json`, or `src/extension/messageHandler.ts` concurrently with
    `F4-03`–`F4-08`.
- **Workspaces:** each worktree gets a `node_modules` symlink and a copy of
  the built addon (`engine/native/linux-x64/git-graph.node`), so TypeScript
  tests load without a Rust build. `F4-09` additionally gets a reflink Cargo
  target cache under `/home/zam/Desktop/prog/_GGL/.ggl-blame-targets`.

## Slices

| ID | Work | Needs | Model | Status |
| --- | --- | --- | --- | --- |
| F4-01 | Blame CLI read query and porcelain parser | — | Sonnet | integrated `1aac24df` |
| F4-02 | Hotspot age-heat and churn scoring model | F4-01 | Haiku | integrated `c06c041c` |
| F4-03 | Blame editor-tab panel and read-only view | F4-01, F4-02 | Sonnet | integrated `3e916dff` |
| F4-04 | Hotspot OKLCH palette, heat rail, legend and hover highlight | F4-03 | Haiku | integrated `444b9703` |
| F4-05 | Parent-blame rewind stack, options, ignore-revs and find | F4-04 | Sonnet | ready |
| F4-06 | Commit popover, Show in Graph, GGL Diff and Open File at Line | F4-05 | Sonnet | waiting |
| F4-07 | Editor, Explorer, SCM and Commit Details entry points | F4-06 | Sonnet | in progress (pulled forward) |
| F4-08 | Worktrees, bare repositories, unsaved buffers and watcher refresh | F4-07 | Sonnet | waiting |
| F4-09 | Optional: Rust engine blame read with parity tests | F4-01 | Muse Code | deferred (BQ8 profiling: `gix` slower) |

## Integration acceptance

Each slice is reviewed, rebased onto `main`, fast-forwarded, and gated as the
Reflog tab slices are: strict Biome on touched files, `pnpm run typecheck`,
the full backend and webview test suites, `pnpm run l10n:check`, `pnpm run kb:check`,
and the Rust arm plus an addon rebuild whenever `engine/**` changed. At release
end: `pnpm run package`, `pnpm run test:coverage`, `pnpm run sonar:scan` with
an explicit gate poll (`OK` required), `kb:index`, `kb:check`, and `kb:graph`;
`README.md` feature list and `CHANGELOG.md` entries; and headless renders of
the Blame tab in dark, light, and forced-colors themes (including a file with
both old and recent commits, an uncommitted hunk, and a rewound historical
revision). Nothing is pushed without explicit instruction.

## Integration log

- `2026-11-23`: Blame view design (`040-blame-view.md`) and execution overview
  (`110-blame-view.md`) written beside the Git Graph+ phases (`dc000485`); Git
  `2.56.1` porcelain, rename `previous`, binary/empty/untracked/bare/worktree,
  `--contents -`, `--ignore-rev`, broken `blame.ignoreRevsFile`, and
  `--end-of-options` behaviors verified in temporary repositories.
- `2026-11-23`: Tailored subagent slice files `100-f4-01-blame-cli-query.md`
  through `180-f4-09-engine-blame-read.md` written under `110-blame-view/` for
  later execution (`F4-01` ready; `F4-02`–`F4-09` waiting on dependencies and
  maintainer confirmation of `BQ1`–`BQ9`).
- `2026-11-23`: F4-01 (Muse Code) integrated at `1aac24df` by fast-forward:
  `loadBlame` and `parseBlamePorcelain` in `src/backend/queries/blame.ts`, the
  blame types in `queries.types.ts`, a minimal `src/backend/queries/index.ts`
  barrel, 41 real-Git tests. Choices recorded in its report: untracked and
  unborn decided by structural probes, never Git's message text; a
  `contents` buffer is a revision blame, so bare repositories serve it;
  every revision resolved through `rev-parse`; `MAX_BLAME_FILE_BYTES` is
  2 MiB. The machine rebooted after the report and before integration; the
  slice branch held every commit, and the worktree was recreated under
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/` because `/tmp` does not survive a
  reboot. Gates on `f0a51986` (with F1-05): strict Biome on the four touched
  files clean; typecheck clean; `pnpm run test` backend 1,614 and webview
  1,116 passed. F4-02 is ready.
- `2026-11-23`: F4-02 (Claude Haiku) integrated at `c06c041c` by fast-forward,
  plus an integrator formatting fix `5c3ade6d` (one test line over the strict
  formatter's width): `src/blameHotspot.ts` with `scoreBlameHunks` and the
  `age`, `calendar`, `churn` and `off` modes, 17 tests. Churn, which the slice
  left open, is `((rank + 1) / distinct timestamps) × the commit's hunks in the
  file`, normalized so the hottest committed hunk is 9; line counts are not
  used; a hunk whose commit is missing from the map counts as uncommitted.
  Gates: strict Biome clean after the fix; typecheck clean; hotspot tests 17
  passed; KB check clean. F4-03 is ready.
- `2026-11-23`: F4-03 integrated at `3e916dff` (first run Muse Code, cut off by
  its quota; finished by Gemini 4 Argon through `agy`): the Blame editor tab
  (`src/blameTabTypes.ts`, `src/extension/blameTab/`, `src/webview/blameTab/`,
  `media/blame-tab/blame-tab.css`, bundle `blameTab.min`) and the palette
  command `git-graph-libre.showBlame` ("Show Blame for Current File", the
  cursor line as target). GitHub-style grouped hunks with summary, author,
  the graph's hash length and date format, a resizable gutter kept per
  repository, an uncommitted band, loading/empty/error states. 14 new
  strings appended at the end of the bundles, agent-translated. Renders under
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-03/`. The tab-open
  telemetry hook (`reportBlameOpened`) is wired by slice T1b. Gates on
  `3e916dff`: strict Biome on 29 files, typecheck, `l10n:check`, KB check,
  backend 1,578 passed (60 skipped in the worktree) and webview 1,195
  passed. F4-04 is ready.
- `2026-11-23`: F4-07 pulled forward to run beside F4-04 (integrator, under the maintainer's overlap answer): its `Needs: F4-06` only serialized shared files; it builds on F4-03's `showBlame`. Dispatched to Gemini 4 Neon (`agy`).
- `2026-11-23`: F4-04 (Claude Haiku) integrated at `444b9703`: ten OKLCH tokens
  `--ngg-blame-heat-0`..`9` (dark and light), a 4px heat rail per hunk, a
  `color-mix(in oklab, …)` gutter wash, a neutral rail for uncommitted lines
  and for Off, the header legend (Older, ten swatches, Newer) with the mode
  selector (Age default, Calendar, Churn, Off) kept in webview state and
  re-scored in the webview with `src/blameHotspot.ts`, same-commit
  highlighting on hover and focus (each hunk is a tab stop), forced-colors
  and reduced-motion rules. Follow-up, not blocking: under forced colors the
  heat level shows only as rail presence and the legend, with no per-hunk
  text label (each hunk still shows its date). Renders under
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-04/`. Gates on `444b9703`:
  strict Biome on 14 files, typecheck, `l10n:check`, KB check, backend 1,579
  passed (60 skipped in the worktree) and webview 1,232 passed. F4-05 is
  ready.
