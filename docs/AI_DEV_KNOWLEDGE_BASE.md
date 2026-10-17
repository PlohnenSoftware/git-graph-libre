# AI Development Knowledge Base

This document is the working knowledge base for recreating useful Git Graph
features in Git Graph Libre while keeping this repository free of any material
the project cannot license under the AGPL.

## Contents

Every section of this document, grouped by importance with the most
important first (see Order of this document), with the line its heading is on
(`L<n>`) and what it holds. On a first read, read this list and the sections
marked *always read*, then go straight to the sections your task needs by
passing the line number as the Read tool's `offset`.

The line numbers were exact on `2026-10-17`. Any edit above a heading moves
it, so if the line you land on is not the heading you expected, list the
current ones with:

```bash
grep -nE '^#{2,4} ' docs/AI_DEV_KNOWLEDGE_BASE.md
```

When you add, remove, rename, or move a section, update its entry here in
the same change.

**Mission**: why the project exists, and the license rule everything else follows.

- L155 **Mission** (*always read*) — Mission and core licensing rules: `AGPL-3.0-or-later` since 1.0.0 over the MIT lineage (`NOTICE.md`, `LICENSE.mit`); the license flows one way; the upstream-review marker grep must return `0`; the clean-room reimplementation rule.

**Rules**: how to work in this repository, commit, verify, and keep this document.

- L201 **Renames and relicensing since these notes were written** (*always read*) — Reading note: the project was renamed from the MIT fork `neo-git-graph` to Git Graph Libre; `neo-git-graph.*` IDs are now `git-graph-libre.*`, AGPL from 1.0.0, Sonar key `git-graph-libre`; old notes are kept as written.
- L217 **Maintainer and Agent Source of Truth** (*always read*) — Names this document the single source of truth for `AI-dev` and `main`; `README.md` stays the public entry point; agent files (`CLAUDE.md`, `CODEX.md`, `agents.md`) stay pointer-only.
  - L224 **Branch and release policy** (*always read*) — Standing rules: release by fast-forwarding `main` to `AI-dev`; session-start reading order; workflow (rebase not merge, signing, strict Biome, OKLCH, American English, gate order up to SonarQube `OK`, Rust arm on `engine/**`); handoff rules.
  - L365 **Commit signing** (*always read*) — Standing rule: every commit signed (key `4858F11A2D1DFCBE`), checked with `git log --format='%h %G? %s'`; halt if `gpg-agent` is unreachable, never `--no-gpg-sign`; record of the `2026-09-09` unsigned-commit incident.
- L428 **Documentation and Verification Rules** (*always read*) — Standing rules: tests ship with behavior changes; touched code meets `biome.strict.jsonc`; Biome and SonarQube gate `OK` before commit; fix touched-file issues; no `var`; small commits; record the checks run.
  - L453 **Order of this document** (*always read*) — Standing rule: the document's groups in order (Contents, Mission, Rules, Licensing, Reference, Ongoing work, Future work, History oldest first) and how to keep new and finished work in the right group.

**Licensing**: license verdicts and clean-room records that bind all work.

- L486 **Licensing** (*always read*) — License verdicts and clean-room records that bind all work; the rules they apply are in Mission, the notices in `NOTICE.md`, `LICENSE.mit` and `engine/NOTICE.md`.
  - L492 **`vscode-git-graph-rs` licensing verdict (`2026-09-22`)** (*always read*) — Standing verdict: the `src/` and `web/` layers of `vscode-git-graph-rs` forbid redistribution, so never read or copy them; `native/` is MIT and usable except `native/core/src/gerrit.rs`; any future sync is a manual license audit.
  - L541 **License review of the graph and stash UI slices (`2026-09-09`)** (*always read*) — Clean-room review (`2026-09-09`): a borrowed stash-node shape removed and identifiers renamed. Standing rules: derive constants from this project's own geometry; pair token scans with an identifier census.

**Reference**: standing guidance to read when a task touches its area.

- L570 **Graphify Map** (*always read*) — The graphify code graph, last regenerated `2026-07-29` at `ff8b744` (likely stale), AST-only: the `graphify-out/` artifacts, refreshing with `graphify update .`/`graphify tree`, and query/explain/path examples.
- L623 **Current Architecture** — Layer map (`extension.ts`, `gitClient.ts`, queries, actions, `messageHandler.ts`, webview); Biome and SonarQube setup (`pnpm run sonar:scan`, no empty `SONAR_TOKEN=`); dated `sonar.projectVersion` advances up to `1.8.1`; `ZAM` gate conditions; feature route.
  - L880 **Settings reach the webview twice, and the second time is raw (`2026-09-05`)** — Standing rule: boot reads validated `config` accessors but settings-hub echoes apply raw values, so change both ends; the `b225076` context-menu crash fix; the `onDidChangeConfiguration` whitelist; `pnpm run test` does not typecheck.
- L936 **Webview UI Styling Guide** — Standing UI rules: VS Code theme tokens with `--ngg-*` OKLCH fallbacks; conventions for dialogs, checkboxes, locked controls (`lock: { reason }`), dropdowns, `octicon()` icons, selection tint, graph palette and status strip states; CSS regression tests.
  - L1132 **Verifying webview visuals without a browser (`2026-09-10`)** — Standing rule: before calling a webview visual change done, render it headlessly with `PyQt6` QtWebEngine and `xvfb-run` using the real `media/*.css`; VS Code's bundled Electron can't be used for this.
- L1155 **Telemetry (`telemetry` branch, `2026-08-26`)** — Standing client telemetry rules (ingest lives in `PlohnenSoftware/git-graph-libre-telemetry`): the `createTelemetryLogger` boundary, three chokepoints, once-per-session view features, tri-state `telemetry.enabled`, `TELEMETRY_ENDPOINT`, `telemetry.json`.
  - L1254 **Consent prompt (`2026-09-02`)** — Consent rules for `consentPrompt.ts`: dismissal is not an answer, no latch (a past bug), the "Reject and Don't Show Again" label; the banner reversed into the `webviewConsentScreen.ts` gate; GDPR/Marketplace research.
  - L1385 **End-to-end verification of the sender seam (`2026-09-02`)** — Proof of the `createTelemetryLogger` sender seam: test launches are logging-only (`isLoggingOnly`), so it was verified with a packaged build; the injected `common.*` properties; `commonProperties.ts` and its removal condition.
  - L1485 **Consent epoch — session record (`2026-09-02`)** — Session record of seven consent-epoch slices: gate results and three packaged-build checks (`unset` sends nothing). Open: delete the `probe-machine` row from the production database.
- L1527 **Temporary language switcher (`2026-09-03`)** — Standing rules for the hidden double-right-click language menu: always English, the override kept only in the `webviewPanel.ts` closure, switching by document rebuild, locale validated before `createBundleTranslator()`.

**Ongoing work**: what is in progress now.

- L1562 **Active handoff: Git trust, repository recovery, and diagnostics (`2026-10-17`)** — All nine requested outcomes met, audited, gated `OK` and committed, unpushed, awaiting maintainer review. Read first when continuing: the request, the requirements audit (the engine's gix reduced-trust bypass closed by `isVerified`, Git-spelled trust entries, the trust command, the deferred `bail_if_untrusted` slice), the `restoreTabOnStartup` follow-up, and the earlier checkpoints.
- L1560 **Near-Term Work Order** (*always read*) — Next (`2026-10-16`, awaiting the maintainer): the upstream engine review's ranked candidates, config staleness first; earlier: the Phase 16 Rust engine, slices 16.1–16.9 done; then older priorities and the partial Phases 2 and 7–10.
- L2087 **Implementation Roadmap** (*always read*) — Status table for every phase (audited `2026-07-03`, kept in sync with each phase's `Status:` line), then Phase 16, the active phase; open and completed phases have their own sections.
  - L2114 **Phase 16: Rust Engine Backend** — In progress as of `2026-10-16`: slices 16.1–16.9 shipped in `v1.8.0`, Author Date and the status indicator in `1.8.1`, upstream candidates open. Wires the `engine/` Rust addon into the hot reads with CLI fallback; goal and speed numbers.
    - L2135 **Non-goals, permanently** — Standing rule: permanently excluded from the engine are all writes, `includeReflog`, `includeUnreachableCommits`, signature verification and `customBranchGlobPatterns`; each is a decline routed to the CLI and pinned by a test.
    - L2155 **Design rules — invariants every slice must keep** — Standing invariants for every engine slice: map to project types, CLI stays the default, cross-backend parity tests, no user-visible change, close handles, telemetry only at the documented chokepoints.
    - L2182 **Slice 16.1 — A gate for the Rust side, with no wiring at all** — Done (`2026-09-22`): `engine:check`/`test`/`lint`/`fmt` scripts, `.github/workflows/engine.yml` CI keyed on `engine/**`, `engine/**` in `sonar.exclusions`, the Rust arm added to the gate order.
    - L2224 **Slice 16.2 — Build the addon locally for one target** — Done (`2026-09-22`): `@napi-rs/cli` devDependency, `engine:build` (host triple, debug), `engine:smoke` version check, `engine/package.json` napi config; the other triples deferred.
    - L2270 **Slice 16.3 — The seam, the escape hatch, and one trivial read** — Done (`2026-09-22`): `src/backend/engine/addon.ts` loader, `createRepoReader` falling back only on `NotARepository`/`Unsupported`, the `git-graph-libre.backend` setting, `remoteUrl` wired, parity test, `view.engineBackend` telemetry.
    - L2351 **Slice 16.4 — `loadRepoInfo`** — Done (`2026-09-22`): `loadRepoInfo` served by the engine (`src/backend/engine/repoInfo.ts`), with CLI fills and ordering through the CLI sorters; parity table, probe findings; `loadBranches` untouched.
    - L2394 **Slice 16.5 — `loadCommits`, and the three declines** — Done (`2026-09-22`): `loadCommits` served by the engine (`commits.ts`), declining up front for the signature column, reflog, unreachable commits, `--glob=` and `topo`; parity table, known deviations.
    - L2483 **Slice 16.6 — Commit details, comparison, and line counts** — Done (`2026-09-23`): commit details and comparison via the engine (`details.ts`) with eager `load_line_counts`; `DiffDocProvider` reads file content from the engine; merges, the `*` row and failed counts reroute to the CLI.
    - L2543 **Slice 16.7 — The remaining reads** — Done (`2026-09-23`): only `config_list` wired (user identity in repo info); the other reads declined, each with its reason; `search_history` superseded by the engine's `search_commits`, then deleted.
    - L2592 **Slice 16.8 — Handle lifetime and post-write freshness** — Done (`2026-09-23`): a probe showed warm gix handles see external writes, so no cache bust is needed — corrected `2026-10-16`: config stays cached; `removeRepo` and `deactivate` close handles; lifecycle test.
    - L2638 **Slice 16.9 — Per-platform packaging** — Done (`2026-09-23`): `native-build.yml` builds the triples; the maintainer chose one universal VSIX (`15.06 MB`) over the seven-VSIX plan; `.vscodeignore` whitelist; local packaging can ship a debug binary.
    - L2712 **Building the whole stack (`2026-09-23`)** — Rule: `pnpm run build` builds the release addon, runs `engine:smoke`, then `package`; `pnpm run package` and `vsce package` build only the TypeScript, never the addon.
    - L2729 **One build path, runnable anywhere (`2026-09-23`)** — Decision: cross-compile every platform from one machine with `engine/scripts/build-all.mjs` (CI `native-build.yml`, local `engine:build:all`); zig pinned `0.14.1`, `--cross-compile`, macOS ad-hoc signing, untested cross-builds.
    - L2788 **Why the graph opened no faster, and what fixed it (`2026-09-23`)** — Record: simple-git adds ~50 ms to empty-output commands (`runGitRaw` move still open); `composeEngineRepoInfo` CLI fills moved into the engine; `log::authors` all-refs bug fixed; `loadRepoInfo` 7.2x faster.
    - L2861 **The two ref fills, removed from the engine rather than optimised (`2026-09-23`)** — Record: the `attachRemoteHeadLabels`/`attachSignedTagNames` `for-each-ref` fills deleted; the engine reports tag `signed` and symbolic `origin/HEAD`; `loadCommits` spawns nothing. Benchmark only `engine:build:release`, never debug.
    - L2950 **Search in the engine, and a CLI bug it exposed (`2026-09-23`)** — Record: the engine's `search_commits` (literal message, author and hash matches in one walk, 7.9x) replaces `search_history`; the parity table exposed a CLI `--author` `escapeRegExp` bug, fixed with `--fixed-strings`.
    - L3013 **The engine surface: what is wired, what was removed, what is kept (`2026-09-23`)** — Audit of the 31 `#[napi]` exports (18 wired): five removed (`search_history`, write-flow helpers), dropping the `regex` crate; table of the exports kept unwired; a planned engine-only Statistics tab.
    - L3085 **What the page-size defaults are actually worth (`2026-09-23`)** — Record (`2026-09-23`): `initialLoadCommits` `300` → `250`, `loadMoreCommits` `100` → `750`; the full `renderTable` rebuild is the real cost (open); keep manifest, accessor, README and test defaults in step.
    - L3153 **Benchmarking the two backends (`2026-09-23`)** — How `pnpm run bench:backends` works (`backends.bench.ts`, `GGL_BENCH_REPO`, `didEngineServeRead()`); `vitest bench` is gone in Vitest 5; the first results (`loadCommits` `0.7x`) were fixed in the sections above.
    - L3213 **Pinned toolchain, remapped paths, cached CI (`2026-09-23`)** — Rules: `rust-toolchain.toml` stays at the repo root; `--remap-path-prefix` makes builds identical across machines; CI caches cargo-xwin, zig (`engine/.toolchain/`) and `engine/target`.
    - L3264 **Alpine and the C library (`2026-09-23`)** — Superseded `2026-10-17` by one Linux binary per architecture. Recorded decision: ship eight platforms, adding `linux-x64-musl`/`linux-arm64-musl`, with `isMuslRuntime()` and ordered `platformDirectoriesFor()`; `linux-armhf` deliberately excluded; Windows still needs cargo-xwin.
    - L3329 **Author Date through the engine, and the status indicator (`2026-10-16`)** — Done (`1.8.1`): engine `1.0.25` `useAuthorDate` lifts the Author Date decline; rule: bump the engine version when TS relies on behavior an older binary silently lacks; `loadCommitsDecline()` reasons; the status popup, amber unavailable state, `[engine]` log line; response field `components`, never `status`.
    - L3422 **Upstream engine review, first pass (`2026-10-16`)** — Audit of upstream `native/` to `6357ec1`: license still MIT, no new tainted port; ranked unported candidates (config staleness, tags of trees/blobs, shallow clones, status counts, topo seeding, numstat, encoding, replace refs, remote-ref special cases).
    - L3463 **Signatures leave the graph load; a one-off CLI reload and engine-failure telemetry (`2026-10-16`)** — Done (taken over mid-flight, gated `OK`): the CLI-only `commitSignatures` query lifts the signature-column decline; the Hidden menu's `forced` reload; reader failure/decline flags feeding `view.engineUnavailable.<reason>`, `view.engineFailed`, `view.engineDeclined`, `view.forceCliReload`; the `backend: "git-cli"` setting already existed.
    - L3545 **Pruning the universal package on activation (`2026-10-16`)** — The universal VSIX stays (platform VSIXs declined again with numbers on the table); `prune.ts` deletes foreign-platform binaries on Production activation under test-pinned rails (six directories since `2026-10-17`); signature verification is install-time, so no reinstall; musl-only Linux measured impossible with the zig dynamic build.
    - L3587 **Experiment: one Linux binary for both C libraries (`2026-10-16`)** — Done: the musl route fails (glibc floor 2.33; x86_64 binds glibc's oldest ABI, `realpath` silently empties `submodules`); the gnu route works — a Rust `gnu_get_libc_version` (`RTLD_NEXT`) plus dropping only the `ld-linux` `DT_NEEDED` (`elf.mjs`, asserted by `build-addon.mjs`) loads on glibc ≥ 2.28 and musl with identical parity; the gnu/musl pair is removed, `linux-x64`/`linux-arm64` ship. Also: engine memory is allocator retention, macOS/Windows relinks are not reproducible, macOS embeds the checkout path.
    - L4081 **Risks to decide before 16.5, not during** — Phase 16 risks: ordering within a window (resolved in 16.5), devcontainer/Alpine CLI fallback, refusing `engineVersion()` skew, the unresolved `penghongxia`/`neophack` identity question.

**Future work**: open roadmap items and directions nobody has started.

- L4104 **Roadmap: open phases** — Phases with open items (2, 6, 8, 9, 10), in phase order; each phase's `Status:` line names what remains.
  - L4111 **Phase 2: Commit Details UX** — Partial. Done: split renderer, collapse/expand, tree/list and compact folders, resizable height, safe linkification, file actions. Open: the docked-bottom commit-details mode.
  - L4135 **Phase 6: Repo Settings and View Options** — Mostly complete: repo settings modal and per-repo view toggles. Open: initial branches on load. `2026-07-27` record: detached-HEAD visibility, `repository.includeUnreachableCommits` (`git fsck`), segmented local/remote ref badges.
  - L4213 **Phase 8: Commit Comparison and Multi-Select** — Partial: multi-select squash/drop (`15a1967`) and compare-with-HEAD (`8fc95ef`) done. Open: comparing any two loaded commits, ref-to-ref comparison, external directory diff.
  - L4234 **Phase 9: Repository and Remote Management** — Mostly complete: fetch shown only when remotes exist, upstream-aware push/pull, remotes CRUD popup, add/remove repo commands, full-path tooltips. Open: a preference for repository dropdown ordering.
  - L4257 **Phase 10: Advanced History, Text, and Integrations** — Partial. Done: issue linking, config sharing, archives, commit/tag signatures, staging panel (`1.5.0`). Open: markdown/emoji, inline body, `.mailmap`, encoding. `2026-07-27` record: signature column, SonarQube gate, the empty-`SONAR_TOKEN=` pitfall.
- L4367 **Future direction: integrate with VS Code's native source control (`2026-09-03`)** — Unimplemented future direction that needs maintainer go-ahead: use the built-in `vscode.git` API (`repository.ui.selected`, `api.init`) and `scm/*` menu contributions instead of the graph's own selector; open questions.

**History**: finished work, oldest first, kept as the record.

- L4424 **Local Inputs Reviewed** — Historical list of the inputs reviewed when this document began: `README.md`, `agents.md`, `package.json`, key `src/` files, `tests/**`, and the parent `../FEATURE_*.md` recommendation briefs.
- L4452 **Roadmap: completed phases** — Finished phases (0, 0.5, 1, 3, 4, 5, 7, 12–15), in phase order, with their plans, acceptance criteria and slice records.
  - L4458 **Phase 0: Guardrails and Baseline** — Complete. Guardrails: keep this document current, baseline `pnpm run typecheck`/`lint`/`test`/`l10n:check`; acceptance: `AI-dev` exists, and `README.md` deliberately does not link this document.
  - L4476 **Phase 0.5: Backend Robustness and Data-Source Foundation** — Complete. Hardening `webviewBridge.ts`, raw Git via `gitRunner` over `simple-git`, request ids against stale responses, NUL-separated parsing, `loadRepoInfo`, the `RepoFileWatcher` rework.
  - L4508 **Phase 1: UI/UX Foundation Refresh** — Complete: toolbar icon buttons, status strip, sticky headers with column show/hide, font-size and row-height density settings, theme-native dialogs and menus; original plan and acceptance criteria.
  - L4541 **Phase 3: Commit Hash Display Hardening** — Complete: `shortHashLength` setting via `abbrevCommit()`, with full hashes kept in `data-hash` and in actions; `2026-07-02` slice record with verification commands and Sonar result (its machine paths are dead).
  - L4591 **Phase 4: Find, Search, and Keyboard Navigation** — Complete: loaded-commit find widget (Ctrl/Cmd+F, F3), the `keyboardShortcuts.ts` key map, the full-history `searchCommits` command; `2026-07-02` slice records, including a Sonar cleanup and hotspot review.
  - L4732 **Phase 5: Branch, Tag, and Author Filters** — Complete: AND-combined filter dropdowns for branches (multi-select, glob presets), tags and authors (`a1d2bc9`); also keeps the original `CommitFilter` plan and acceptance criteria.
  - L4762 **Phase 7: Stash Management** — Complete: stash loading behind a per-repo toggle, the apply/pop/drop/branch actions (`6750480`), the stash list panel and graph stash rows; original plan and acceptance criteria.
  - L4788 **Phase 12: Toolbar Dropdown Name Truncation and Find Row (Bug)** — Complete (`2026-07-03`): segment-aware middle truncation of dropdown names (`src/webview/utils/truncate.ts`), fixed CSS dropdown widths so the toolbar stops jumping, the find widget on its own row.
  - L4964 **Phase 13: Settings Hub — Tabbed Widget, Color Editor, Settings Export** — Complete (`2026-07-03`): settings popup with Repository and Extension tabs, editors built from the manifest, hue-preserving OKLCH `graphColors` editor (`oklchColor.ts`), export/import of extension settings only.
  - L5132 **Phase 14: Reveal Highlight — Persistent Blink and Configurable Color** — Complete (`2026-07-03`): the reveal highlight blinks until hover or click (`startRevealHighlight`), with reduced-motion handling; new setting `revealHighlightColor`, default `oklch(90% 0.25 150 / 0.42)`.
  - L5290 **Phase 15: Tag Surfaces — Signed-Tag Distinction and Remote Tag Deletion** — Complete (`2026-07-29`, `v1.1.1`–`v1.2.0`): signed-tag badges, remote tag deletion (`tagRemote.ts`), tag details popup redesign, SSH-signed commits detected via a batched `gpgsig` probe, release-workflow token rule.
- L5539 **Upstream review (`2026-07-29`)** — Record: three `upstream/main` commits (nix flake, tsconfig split, oxlint `node:` rule) not taken; taking any upstream MIT commit also requires updating `NOTICE.md`/`LICENSE.mit`.
- L5559 **Submodule discovery (`2026-08-21`)** — Feature record: submodule discovery from `.gitmodules` `path` entries, with validation, nested submodules and an indented dropdown, written clean-room; `.gitmodules` is not watched live.
  - L5573 **Merged as PR #1, released as `1.4.2` (`2026-09-03`)** — Record of the first outside PR (#1, released `1.4.2`): AGPL contributor credit goes in `NOTICE.md`, never `LICENSE.mit`; Windows path and ReDoS fixes, `view.submoduleRepo*` telemetry, verification.
- L5688 **Immediate TODOs — High-Priority Bug Backlog (`2026-08-25`)** — Dated `2026-08-25` backlog of six bugs reported against `v1.3.0`, ranked above the roadmap. Rules: don't re-derive diagnoses, update `Status:` lines in place; the BUG-3/4/5 maintainer decisions.
  - L5709 **BUG-1 — `pushTag` hardcodes the `origin` remote** — BUG-1: `pushTag` hardcoded `origin`. Implemented `2026-08-25` (pushes `refs/tags/<name>` to the chosen remotes via `runGitRaw`, force/`--no-verify`), though its `Status:` line still says open.
  - L5806 **BUG-2 — The tag remote surface is a stub beside the branch remote surface** — BUG-2, fixed `2026-08-25`: `fetchTags` (`--tags`, `--prune-tags` implies `--prune`), a toolbar `pushAllTags` button, force/no-verify in the tag push dialog; a branch-versus-tag capability table.
  - L5894 **BUG-3 — "Lightweight" creates a signed annotated tag and opens an editor window** — BUG-3, fixed `2026-08-25`: the lightweight path passes `--no-sign` to defeat `tag.gpgSign`; annotated tags follow git's signing config; an empty annotated message is allowed again since `1.4.1`.
  - L6054 **BUG-4 — Branch and tag labels turn gray on every merge commit** — BUG-4, fixed `2026-08-25`: merge-commit dimming grayed ref labels; now opt-in via `repository.muteMergeCommits` (default `false`) and scoped to the `.commitMessage` span. Maintainer re-check pending.
    - L6175 **Tag-specific graying — investigation result (`2026-08-25`)** — Finding: no tag-specific graying path exists; lists the only three ref-appearance paths (muted cell, `.gitRefAlias`, signed/unsigned pill tint); the unsigned gray tint is intended design.
  - L6216 **BUG-5 — The "watching" eye status bar item can never appear** — BUG-5, fixed `2026-08-25`: the status bar `$(eye)` could never appear; restored `onStartupFinished`, removed the dead `workspaceContains:**/.git`; notes the untrusted-workspace limitation.
  - L6344 **BUG-6 — Cross-cutting: tag actions bypass the command log** — BUG-6, fixed `2026-08-25`: `addTag` and `pushTag` moved to `runGitRaw` with `recordGitCommand`, so all three tag actions reach the git-command log.
  - L6366 **Suggested slice order** — Historical slice order for the bug backlog (BUG-3, BUG-1+6, BUG-5, BUG-4, BUG-2), plus the per-slice gate order ending with an `OK` `ZAM` Sonar gate before committing.
- L6383 **Upstream review, second pass (`2026-08-25`)** — Record: 33 upstream commits classified and ported as per-feature branches off `AI-dev`; upstream's `vsce` publish applied (Open VSX later restored); bold-branch rejected; adds `boldCheckedOutCommit`, `fetchTagsByDefault`; skip list.
- L6463 **Upstream review, third pass (`2026-09-03`)** — Record: last reviewed upstream commit `86be522` — start the next pass there. License clean. All rejected except `34835ec` (no-folder activation) and `49c8025` (init-repository button).
- L6530 **Pull request review — #4 and #5 (`2026-09-05`)** — Record: review of the Copilot PRs #4 (merge on a remote branch) and #5 (no-fast-forward dialog defaults, inert settings fixed). Passing gates is not a review; merging both needed a typecheck fix.
- L6657 **Uncommitted-changes staging panel, released as `1.5.0` (`2026-09-07`)** — Record of the `1.5.0` staging panel: reuses `#commitDetails`, re-queries after actions, drag payload format, `--untracked-files=normal`; `1.4.3` was never released; pnpm 12 `allowBuilds` switch; release verification.
- L6786 **Graph and stash UI slices (`2026-09-09`)** — Intro to the stash/graph UI slices. Standing rules: the stash list sits in `#topBar` `#stashListSlot`, folds away on scroll, and calls `publishTopBarHeight()` synchronously after slot changes.
  - L6827 **Slice 1 — Checkbox appearance** — Slice 1: one shared `media/checkbox.css` restyle with VS Code checkbox tokens, a neutral box, a `clip-path` tick and `:indeterminate`; accent fill rejected. Lesson: check styling records against the actual CSS.
  - L6880 **Slice 2 — Remote sub-label restyle** — Slice 2: the `.gitRefGroup > .gitRefAlias` divider in `media/refs.css` restyled to badge foreground at 30% via `color-mix(in oklab)`; AA contrast re-verified; CSS regression tests forbid `in srgb`.
  - L6904 **Slice 3 — Stash list above the table** — Slice 3: `renderStashList()` moves the stash list from the footer into `#stashListSlot`; `renderGraph()` re-pins the canvas top. Rule: `tests/webview/setup.ts` duplicates the body markup, so update both.
  - L6936 **Slice 4 — Stashes as graph rows** — Slice 4, closes Phase 7: stash graph rows injected on the backend above their base commit (`src/backend/queries/stashes.ts`); the `stashRing` halo-exemption CSS trap, marker geometry, `view.stashRows` telemetry.
  - L7028 **Follow-up — where stashes appear, and a checkout default** — Two settings: `repository.stashDisplay` (`table`/`graph`/`both`, under `repository.showStashes`) and `dialog.createBranch.checkout` (default `true`; branch and checkout run as two separate steps).
  - L7047 **Follow-up — staging catalogue view, and two rendering fixes** — Staging panes get a folder tree via the pure `src/webview/utils/pathTree.ts`; contracts for folder-drag payloads, path-keyed collapse state and the `dragstart` guard; two rendering fixes. Open: migrating `generateGitFileTree`.
  - L7083 **Follow-up — list/tree toggle, and the stash-branch dialog** — The `uncommittedChanges.fileViewMode` tree/list setting, separate from `commitDetails.fileViewMode`; a new `GitGraphViewState` field broke thirteen fixtures (shared factory still needed); the `git stash branch` dialog.
  - L7116 **Release gate for these slices (`2026-09-09`)** — Record of the `2026-09-09` gate over six already-committed slices: Biome, package, tests, l10n, coverage `92.9%`, Sonar `OK` after an `S7761` failure; `sonar.projectVersion` deliberately left at `1.5.1`.
  - L7158 **Release `1.6.0` (`2026-09-10`)** — Record of release `1.6.0` (`2026-09-10`): `1.5.1` was never tagged and folded in; `view.stashRows`/`view.uncommittedTree` telemetry; gate results; the tag was created locally, with the push left for later.
- L7217 **Open VSX restored as a publish target, released as `1.6.1` (`2026-09-17`)** — Maintainer reversal of the `2026-08-25` decision, not to be re-dropped: releases publish to Open VSX again; `ovsx` devDependency, `OPEN_VSX_TOKEN` → `OVSX_PAT`, separate token checks, `--skip-duplicate`, namespace claiming.
  - L7267 **Toolchain upgraded in the same change (`2026-09-17`)** — Record of the `pnpm up --latest` upgrade (Vitest 5, `vsce` 4). Rules: pin `@types/vscode` `~1.98.0` to `engines.vscode`; avoid `pnpm add`; known format drift and a `vitest.config.ts` warning.
  - L7322 **Release gate for `1.6.1` (`2026-09-17`)** — Record of the `1.6.1` release gate: no extension change, only the first Open VSX publish; test counts, `sonar:scan` `ZAM` `OK` with task ids, `sonar.projectVersion` bump.
- L7346 **Pull request review — #8 and #9, released as `1.6.2` (`2026-09-22`)** — Record of reviewing outside contributor Arezim's PRs #8 and #9, both green on `ZAM` though #9 was broken. Lesson: the gate misses untested paths, so read the feature.
  - L7354 **PR #8 — `commit.gpgsign` in the fetch-tags fixture** — PR #8 merged: `commit.gpgsign false` in the `fetchTags` fixture; why the signature tests stay valid (`git mktag`, `hash-object`). Open follow-up: use `makeRepo()` instead.
  - L7382 **PR #9 — repository discovery, right diagnosis and a broken comparison** — PR #9: `checkIsRepo()` accepted subdirectories; the raw `--show-toplevel` comparison broke on symlinks and Windows drive case; fixed by `canonicalizePath()` (`e1668f9`). Rule: no quantifier-before-anchor regex on user paths (`S8786`).
  - L7456 **Two environment facts recorded while doing this** — Environment facts: Rust via `rustup` (`1.98.1`, conflicts with the distro `rust`; use `rustup default stable`), and a flaky engine test whose `git clone` reads the real `~/.gitconfig`.
- L7475 **Evaluating the Rust engine of `vscode-git-graph-rs` (`2026-09-22`)** — Intro to the `2026-09-22` evaluation of the `neophack/vscode-git-graph-rs` Rust engine (adoption and licensing); its "nothing adopted" status was later superseded by the `rusty` merge and Phase 16. Its licensing verdict is under Licensing.
  - L7486 **Should the engine be adopted? Not wholesale** — `2026-09-22` recommendation: do not adopt wholesale (no reflog, unreachable commits, signature status or glob patterns; six-triple build cost); a bounded opt-in experiment proposed, which Phase 16 later pursued.
  - L7531 **The filtered engine repository, merged onto `rusty` (`2026-09-22`)** — Record of merging the filtered engine under `engine/` on `rusty`: 52 re-signed commits, `gerrit.rs` and licenses excluded, `engine/NOTICE.md`, `LICENSE.mit` roster, crate attribution.
- L7607 **Root squares only for true roots (`2026-10-16`)** — Fix: `Vertex.parents` holds drawn parents only, so page-boundary commits took root squares; `hasParentBeyondGraph` now reserves the square for commits both backends report parentless (`[""]`).

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
- **Never merge `main` into a pull request branch to bring it up to date.**
  Rebase the branch onto `main` instead. A branch that is going to be merged
  back into `main` gains nothing from having `main` merged into it, and the
  merge commit is not free: GitHub disables **Rebase and merge** on any pull
  request whose branch contains one, so the merge obfuscates the history *and*
  takes away the maintainer's chosen merge button. This is the one place a
  force-push is expected — rebasing a pull request branch and pushing it with
  `--force-with-lease` is normal here and does not need a separate request; the
  no-force rule above is about `main`, release tags, and shared long-lived
  branches.
- Never use destructive remote operations. Never force-push or rewrite shared
  history unless the maintainer explicitly requests that exact operation.
- Prefer small, atomic, reviewable commits and push normally after each coherent
  milestone unless the maintainer says not to push.
- **Every commit must be signed, and an unsigned commit must never be pushed.**
  If signing cannot work — the usual cause is a sandbox with no access to
  `gpg-agent` — stop, push nothing, and hand the decision to the maintainer.
  See Commit signing below.
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
- The Rust arm runs **only when `engine/**` changed**: `pnpm run engine:check`,
  `pnpm run engine:test`, `pnpm run engine:lint`, `pnpm run engine:fmt`
  (each with `--manifest-path engine/Cargo.toml`), plus the `engine.yml` CI
  job on GitHub. Biome and SonarQube never see `engine/` — their configs are
  allowlists that miss it, and `sonar.exclusions` names it explicitly — so a
  slice that touches no Rust file skips this arm entirely, and a slice that
  does must pass it before committing alongside the TypeScript gates above.
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

### Commit signing

**Every commit must be signed, and an unsigned commit must never be pushed.**
Both the repository config and the maintainer's global config set
`commit.gpgsign true`, `tag.gpgsign true`, and `user.signingkey`
`4858F11A2D1DFCBE`, so signing is the default and an unsigned commit means
something bypassed it. The maintainer's GitHub account also has vigilant mode
on ("Flag unsigned commits as unverified"), so an unsigned commit does not
merely go unbadged — it publishes with an **Unverified** badge beside the
maintainer's name.

Prove it before pushing rather than assuming it:

```bash
git log --format='%h %G? %s' @{upstream}..HEAD   # or origin/main..HEAD
```

Every line must start with `G`. `N` is no signature at all and is the failure
this rule exists for; `B`, `U`, `X`, `Y`, and `R` are bad, untrusted, expired,
or revoked and are equally not pushable. (`E` shows up for SSH-signed commits
from outside contributors when no `gpg.ssh.allowedSignersFile` is configured —
a local verification limit on someone else's commits, not a defect in one of
ours.)

**If signing cannot work, stop.** A sandboxed agent usually cannot reach the
`gpg-agent` socket under `~/.gnupg` or run a pinentry, so `git commit` fails.
The forbidden responses are `--no-gpg-sign`, `-c commit.gpgsign=false`,
`git config commit.gpgsign false`, and any other route that produces a commit
without a signature. Do not commit unsigned "for now", do not push, and do not
carry on to the next slice: halt there and hand the decision to the maintainer
with the diagnosis and the options, for example

- re-run the agent with its sandbox disabled, or grant the sandbox read/write
  access to `~/.gnupg` including the agent socket and pass `GPG_TTY` through,
  then commit normally;
- leave the work uncommitted so the maintainer commits and signs it; or
- explicitly authorize an unsigned commit for this one case, knowing it
  publishes as Unverified — a maintainer decision, never an agent's.

Repair exists only **before** the push, while the commits are still local:

```bash
git rebase --exec 'git commit --amend --no-edit -S' <last-good-commit>
```

Re-verify with the `%G?` command above afterwards. After the push there is no
cheap fix: re-signing rewrites every commit from the unsigned one forward, and
on `main` that means a force-push plus moving any release tag that contains it.
Do not propose it as a routine cleanup.

**The incident this rule was written from (`2026-09-09`).** `eb20a0a` (the CSS
split) and `e55012e` (the staging panel), both `Co-Authored-By: Muse Code` and
both committed on `AI-dev` on `2026-09-07`, carry no `gpgsig` header at all;
GitHub reports `verification.reason` `unsigned` for each. Their own commit
messages record that they were written in a sandbox with no external network,
and the shell history shows the agent being restarted as
`muse --disable-sandbox` at `03:00` — every Muse commit from `3d7f0cc`
(`03:05`) onward is signed again. So the sandbox is the cause, and the agent's
answer to a failing `gpg` was to commit without one. Both are ancestors of the
published `v1.5.0` tag with six signed commits on top, so they were **left as
they are**: the repair would force-push `main` and move a released tag, which
costs more than the two badges.

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

### Order of this document

This document is ordered by importance, so a reader who stops early has
still read what matters most. Keep its sections in these groups, in this
order:

1. **Contents**: the table of contents. It stays first.
2. **Mission**.
3. **Rules**: the note on reading this document, maintainer and agent
   policy, commit signing, and these documentation and verification rules.
4. **Licensing**: license verdicts and clean-room records.
5. **Reference**: the graphify map, architecture, UI rules, telemetry, and
   other standing guidance.
6. **Ongoing work**: the work order and the active roadmap phase.
7. **Future work**: roadmap phases with open items, and recorded directions
   nobody has started.
8. **History**: completed phases and dated records of finished work, oldest
   first. Older notes call earlier records "above", and this order keeps
   them right.

To keep it in that order:

- Put a new section in the group it belongs to, not at the end of the file.
  A new dated record of finished work goes at the end of History.
- When work finishes, move its section from Ongoing work or Future work to
  History in the same change that marks it done, and update the status table
  in Implementation Roadmap.
- When a dated record produces a standing rule, put the rule in Rules,
  Licensing or Reference, and have the record point to it rather than
  repeat it.
- Update Contents in the same change: its group labels, its entries, and its
  line numbers.

## Licensing

License verdicts and clean-room records that bind all work in this
repository. The rules they apply are in Mission; the notices themselves are
in `NOTICE.md`, `LICENSE.mit` and `engine/NOTICE.md`.

### `vscode-git-graph-rs` licensing verdict (`2026-09-22`)

**`src/` and `web/` are unusable — 41,543 lines under a licence that forbids
redistribution.** That project's own `LICENSE` says the webview and
extension-host layers are ported from Git Graph by mhutchie and governed by
`licenses/LICENSE_GIT_GRAPH`, whose text reads *"Permission is NOT GRANTED to
publish, distribute, sublicense, and/or sell derivative works of the
Software."* Every post-MIT surface is present (`pullRequests.ts`,
`askpass/*`, code review, worktrees, `openExternalDirDiff`). Treat that tree
the way the Mission section treats any non-MIT material: do not read it for
implementation, do not copy from it, do not merge it.

Two details worth carrying:

- Their `package.json` declares `"license": "MIT"` for the whole extension and
  they publish to both registries. The package metadata is not evidence of
  anything.
- Their initial commit is titled *"…the Gerrit integration removed"* and a
  later one *"re-port the Gerrit integration"*, but mhutchie's Git Graph has
  no Gerrit support. What they ported was a Gerrit-carrying derivative they
  attribute to mhutchie, so the provenance chain is murkier than their
  `LICENSE` states.

**`native/` is MIT and may come in — with one carve-out.** The workspace
declares `license = "MIT"` and the root `LICENSE` names "the Rust native
engine (./native/)" among its Original Contributions, Copyright (c) 2026
penghongxia. MIT into AGPL is the direction the Mission section allows.
However **`native/core/src/gerrit.rs` is not clean**, by its own module
documentation: *"The classification below is a faithful port of the parser
that ran on the extension host (see `src/gerrit.ts`), case for case"* — and
`src/gerrit.ts` is inside the restricted tree. It arrived in `d625ec3`,
**later** than the initial import, which is the pattern to expect: their
engine absorbs code from the restricted layer over time. Any future sync is a
manual licence audit, not a merge.

`native/core/src/types.rs` is a second, much milder case: it states that every
struct "serialises to exactly the shape the existing webview already consumes
(see the shared types in `src/types` in the original extension)". That is
interface compatibility rather than copied expression, and most of the names
(`GitCommit`, `GitRef`, `GitStash`, `UNCOMMITTED`) predate the MIT boundary
anyway — but the free fix is to define this project's own serde shapes against
`GitCommitNode`/`GitRef` and not carry theirs across.

**`neophack/git-graph-studio`**: everything committed to that repository is
original (a Tauri 2 desktop workbench) and MIT, but its *built products* embed
the restricted webview from the `vscode-git-graph-rs` submodule. Nothing in it
is useful to a VS Code extension. Its only relevance is as proof that
`native/core`'s `api::Engine` works as a standalone library.

### License review of the graph and stash UI slices (`2026-09-09`)

The whole stack was reviewed against a maintainer-supplied comparison build
before any of it was pushed, at token level and by identifier. The review
found and removed one genuine problem, and it is recorded here because the
*way* it arrived is the reusable lesson: an intermediate commit rewrote this
project's own independently-written stash node — a stroked ring at
`NODE_RADIUS + 1.5` with a filled dot — into a shape carrying two class names
and two radii that were not ours. Our own construction was restored, and the
node's two identifiers were renamed into this project's vocabulary
(`isStashRow`/`setStashRow`, and `sourceHash` on `GitStash`). The commits were
rewritten rather than fixed forward, so none of it reached published history.

Two durable points:

- **A visual target and a code target are different things.** Matching how a
  feature *looks* is fine; arriving at the same identifiers and the same
  magic numbers is not, and expressing a borrowed constant as arithmetic on
  one of ours (`NODE_RADIUS + 0.5` for `4.5`) disguises it without changing
  it. Derive constants from this project's own geometry and say in a comment
  why that derivation is the right one.
- **Token-run scanning alone is not enough.** A renamed transliteration
  breaks every token run below the detection threshold, so the scan stayed
  silent on the one real finding; it surfaced only from reading the two
  routines side by side, and from an identifier census that asked which names
  are new here *and* present there. Run both, and treat generic English and
  API-mandated names (git flags, `--vscode-*` tokens, CSS syntax, assertion
  boilerplate) as expected overlap rather than signal.

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

### Settings reach the webview twice, and the second time is raw (`2026-09-05`)

A setting arrives in the webview by two different routes, and they do not agree
on what they hand over. Getting this wrong shipped a crash that made the graph
look broken (fixed in `b225076`).

- **At boot**, `buildWebviewHtml()` fills `GitGraphViewState` from the `config`
  accessors in `src/config.ts`, and several of those **validate or complete**
  the stored value: `contextMenuActionsVisibility()` runs
  `normalizeContextMenuActionsVisibility()`, `graphColors()` filters with
  `isGraphColor`, `shortHashLength()` clamps, `revealHighlightColor()` falls
  back on an unparseable color.
- **Afterwards**, every settings-hub write echoes the *whole* manifest-derived
  list back through `updateExtensionSetting` (and `importExtensionSettings`),
  and `applyExtensionSettings()` re-applies **every entry**, not just the one
  that changed. Each entry carries `config.get(configKey, manifestDefault)` —
  the raw stored value, with none of that validation.

So any accessor that does more than `getConfig()` has a counterpart obligation
in `applyBooleanExtensionSetting` / `applyNumberExtensionSetting` /
`applyStringExtensionSetting` / `applyStructuredExtensionSetting`. **When you
add or change a validating accessor, change both ends.**

The bug this cost: `applyStructuredExtensionSetting()` assigned the raw
`contextMenuActionsVisibility` behind an `as GGL.ContextMenuActionsVisibility`
cast. The stored value is the manifest default `{}` until a user customizes it,
so changing *any* setting in the hub replaced the complete visibility map with
an empty object, and `isContextMenuActionVisible()` — which reads
`visibility[group][action]` — threw
`TypeError: Cannot read properties of undefined` for every group. Every
right-click in the graph then did nothing until the view was reloaded. The
`as` cast was the whole bug: it promised a complete map and delivered `{}`.
Regression test: `tests/webview/extensionSettingsContextMenu.test.ts`, written
as a failing test against untouched `main` first.

Two divergences of the same shape are still open, neither of which crashes, so
they are left for a slice that touches them:

- `graphColors`: the host filters with `isGraphColor`, the webview keeps any
  string.
- `shortHashLength`: the host clamps to the manifest bounds, the webview
  assigns the number as given. Hub writes are clamped by
  `sanitizeSettingValue`, so only a hand-edited `settings.json` reaches this.

Two things worth knowing when a setting "does nothing":

- **`vscode.workspace.onDidChangeConfiguration` in `src/extension.ts` is a
  whitelist**, not a catch-all — it reacts only to `showStatusBarItem`,
  `maxDepthOfRepoSearch`, `telemetry.enabled` and `git.path`. Every other
  `git-graph-libre.*` key reaches an open graph **only** through the settings
  hub's echo, or on the next window/graph open. Editing one in VS Code's own
  settings UI does not update a graph that is already open.
- **`pnpm run test` does not typecheck.** Vitest transpiles, so a shared type
  change that breaks a fixture or a typed mock passes `test` and fails
  `package`. Run `typecheck` before believing a green vitest run.

## Webview UI Styling Guide

Durable guidance for agents doing UI work in the webview. The goal is a
native-feeling VS Code surface: theme tokens first, OKLCH fallbacks second,
no raw color literals in repo-owned styles.

Token families by surface (all with `--ngg-*` OKLCH fallbacks where a theme
may not define the token):

- Dialog panel: `--vscode-editorWidget-background/-foreground/-border`,
  `--vscode-widget-shadow`; content is left-aligned; actions right-aligned in
  a `.dialogActions` flex row.
- **A run of related checkboxes gets a `group` heading *and* marked members.**
  A heading alone marks only where a group starts, so the rows after it still
  read as part of it — the first attempt left "Set upstream" looking like one
  of the remote checkboxes, which is the exact confusion the grouping existed
  to remove. Members carry `grouped: true`, and the left rule lives on the
  **cell** (`td:has(> .dialogFormCheckbox.grouped)`) because cells of adjacent
  rows meet under `border-collapse: collapse`, while a per-span border is cut
  into dashes by the row padding.

  **Why this grouping exists:** cloning a fork with the `gh` CLI writes a
  remote literally named `upstream` — `gh` does it unasked, where plain
  `git clone` only ever creates `origin` — so a push dialog shows "Push to
  upstream" beside "Set upstream". Those are different concepts pointing at
  different repositories: the first is a remote, the second is
  `git push --set-upstream`, which sets the branch's upstream *branch*
  (`@{u}`). Labelling the group is what tells them apart. Use
  "upstream branch" for the `-u` sense, "the `upstream` remote" for the fork
  sense, and avoid "tracking branch" entirely — people use it for both that
  and `origin/main`.

  **A value-less row shifts every input index, so never count positions by
  hand.** `parsePushDialogValues()` read remotes as `values[index]` and took
  an `optionsOffset` counted at each call site; adding the heading would have
  silently pushed to the wrong remote. It now derives positions from the input
  *types* — remotes are the leading checkboxes, bypass-hooks is the last, the
  mode is the only select — which is stable against any number of headings or
  notes. Two rendering tests drive a two-remote dialog, so a misroute fails
  the suite instead of reaching a user.
- **A checkbox names itself: its text goes in the `<label>` beside the box, on
  a row spanning the whole form.** Never in the form's label column. This is
  not a style preference — a `100%`-width input in the neighbouring column
  squeezes the label column to its narrowest word, so
  "Check out the branch after creating it" stacks one word per line. That
  shipped once and looked broken. `renderDialogInputRow()` gives every
  checkbox `colspan="2"`, and the label column stays `white-space: nowrap`
  for short field names only. Two matching rules: an *empty* label cell drops
  its gutter padding (`:empty`), or an unlabelled control is inset from the
  flush-left rows around it; and a row containing a `textarea` top-aligns its
  label, since a label centered against a tall control floats away from the
  text it names.
- **Every dialog opens with a `.dialogTitle` and shares one width floor.**
  All five content builders (`showConfirmationDialog`, `showFormDialog` via
  `renderDialogForm`, `showErrorDialog`, `showActionRunningDialog`, and the tag
  details popup) go through `dialogTitleHtml()`, so the size step and the space
  below it cannot drift apart between popups. The bottom margin is
  `:not(:last-child)`, so a message-only dialog carries no trailing gap above
  its buttons. Hierarchy comes from **size only** — not weight, not caps, not
  an accent on one word, all of which fight the emphasis the messages already
  put on ref names.

  The width floor lives on `#dialog.active`, **not** on `table.dialogForm`.
  It was on the table first, which left form dialogs stable while a
  confirmation sat ~300px and an error ~215px beside a 375px form, so opening
  two dialogs in a row resized the panel under the pointer. `.dialogForm`
  keeps `width: 100%` and relies on that floor: `#dialog.active` is
  `width: max-content`, so a percentage-width table contributes no intrinsic
  width and a form would otherwise shrink to its title line.
- **Dialog forms obey the same control metric as the toolbar** — 28px tall,
  4px radius — and their rows are laid on one 8px rhythm with cells
  **middle-aligned**. They were top-aligned with only a `padding-top`, which
  put every label above the vertical center of its control and is what made
  the forms look misassembled. The label column is a fixed 12px gutter with a
  `max-width` and `white-space: normal`, so a long label wraps instead of
  forcing the dialog past its width cap. Focus rings take
  `outline-offset: 1px` so they clear the input's own border rather than
  drawing on top of it, and buttons are equal-width (`min-width: 78px`) with
  centered text and their own `:focus-visible` ring.
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
  tokens, filter input on the input tokens above. The open menu is a flex
  column in which the filter row — the input plus, in multi-selects, the
  invert-selection button — is a fixed header (`flex: none`) and only
  `.dropdownOptions` scrolls; never put `overflow-y: auto` back on
  `.dropdownMenu`, which scrolls the header away together with the list
  (maintainer fix, `2026-10-16`; pinned in `dialogStyles.test.ts`).
- **Forced settings use a locked control, never prose and never a missing
  control.** When the git command behind a dialog does not let the user choose
  a value, show the **same control in the same place**, in its forced state,
  and explain it there. Concretely: keep the real `input`, keep it `checked`
  (or whatever the forced value is) so the submitted payload is honest, mark
  it `aria-disabled="true"` with `aria-describedby` pointing at the reason,
  give the row `cursor: help` and a `?` marker, and reveal a
  `.dialogLockHint` bubble on `:hover` and `:focus-within`. Add
  `lock: { reason }` to the `DialogInput` rather than inventing a variant.

  Three things are deliberate and should not be "simplified":

  - **Not `disabled`.** A disabled control leaves the tab order and greys
    out the very value the user is trying to read, exactly when they most
    want to know why it will not move. It stays enabled and refuses the
    change instead.
  - **Not a `note`.** A paragraph explaining that a checkbox would have been
    pointless is worse than the checkbox: the user loses the row they were
    looking for and has to read prose to find out what the setting is. The
    `note` input still exists for genuine asides (lightweight tags), not for
    this.
  - **The value is re-asserted on a microtask**, not inside the click
    handler. A checkbox is toggled by the pre-click activation steps *before*
    listeners run and reverted *after* them, so an assignment in the handler
    is overwritten; `queueMicrotask` lands after the activation steps finish
    and holds whatever an engine does in between. `preventDefault()` is what
    refuses the toggle in a real browser and stays.

  The first use is the Create Branch from Stash dialog: `git stash branch`
  always checks the branch out (verified against git `2.55.0`), so its
  "Check out" checkbox is locked on. Apply the same treatment to any future
  forced option.
- Checkboxes: keep the native `input[type="checkbox"]` and restyle it with
  `appearance: none` plus a themed box (`--vscode-checkbox-background` /
  `--vscode-checkbox-border` with `--ngg-*` OKLCH fallbacks, 3px radius in the
  existing 3–4px family). The box stays **neutral whether set or unset** — the
  tick alone marks the state, and the tick takes
  `--vscode-checkbox-foreground` with `currentColor` behind it. An accent fill
  on `:checked` was tried and **rejected by the maintainer**: at 16px, beside
  the toolbar's other neutral controls, a saturated square pulls far more
  attention than the setting it represents. Do not reintroduce it; a CSS
  regression test scans every checkbox box rule for the button tokens. The
  tick is an `::after` shape
  clipped with `clip-path: polygon(...)` in **percentages**, never pasted SVG
  paths (`octicon()` is unavailable from CSS) and never a rotated border — a
  percentage clip scales with the box, so a compact variant needs no tick
  metrics of its own, while a rotated border needs hand-tuned `left`/`top` per
  size and leaves blunt ends where the two arms meet. `:focus-visible` rings
  `--vscode-focusBorder` at `outline-offset: 2px`, `:disabled` dims, and every
  checkbox rule set carries `@media (forced-colors: active)` and
  `@media (prefers-reduced-motion: reduce)` counterparts.
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
  `color-mix(in oklab, var(--git-graph-color) 18%, var(--ngg-transparent))`
  (26% on hover) plus a 3px inset left accent bar, so selection matches the
  commit dot hue instead of a flat list color. Reuse this pattern for future
  per-commit emphasis instead of introducing new solid selection colors.
  Interpolate `color-mix()` in `oklab`, never `srgb`: every mix here runs
  toward the transparent token, and only the rectangular space keeps the tint
  hue-stable unconditionally (no reliance on the polar powerless-component
  rule). `oklch` is out for the same reason — obvious beats subtle.
- Graph palette: defaults are OKLCH with uniform lightness and chroma and
  hue-only variation (`oklch(59% 0.21 <hue>)`, 12 hues). Keep any palette
  change uniform in L/C unless the maintainer asks otherwise; users may still
  configure HEX/RGB/OKLCH values. The defaults live in two places that must
  stay identical: the manifest default for `git-graph-libre.graphColors` and
  `DEFAULT_GRAPH_COLORS` in `src/config.ts`. Earlier lightness values quoted in
  the dated slice notes below are historical.
- **Status strip states.** `data-state` (ready, loading, action, error) and
  `data-engine` (active, off, unavailable) are independent.
  Ready-and-unavailable is amber and shows the "Rust engine unavailable"
  note; ready-and-off shows the Ready green as a hollow ring with a
  "Rust off" note — lit versus unlit, never amber, so an accidental
  `git-cli` is discoverable without reading as a fault (maintainer reversal
  of the stays-green decision, `2026-10-16`; each note's reveal names its
  own span id so the two never show together). Busy and error keep their
  own look. Anything that pops out of the
  strip must be parented on `body` with `position: fixed`, because the strip
  clips its overflow so it can collapse while the graph scrolls. The
  component popup uses the editor hover tokens, like `.dialogLockHint`.
- CSS regression coverage lives in `tests/webview/dialogStyles.test.ts` and
  `tests/webview/tableStyles.test.ts`; extend those when adding UI styles.

### Verifying webview visuals without a browser (`2026-09-10`)

Two visual defects shipped in a row because they were reasoned about instead
of looked at: an accent-filled checkbox the maintainer rejected, and a dialog
label wrapped one word per line. There **is** a way to see the result on this
machine, and it should be used before calling any visual change done:

`PyQt6.QtWebEngineWidgets` is installed (a real Chromium) and `Xvfb` is
available, so a page built from the actual `media/*.css` can be rendered and
screenshotted headlessly:

```bash
xvfb-run -a python3 shot.py preview.html out.png   # QWebEngineView + grab()
```

The scratchpad harness that produced the dialog screenshots builds a page from
the real stylesheet list, injects Dark Modern token values so the theme
fallbacks resolve the way they do in the editor, and forces hover-only
elements visible. Do the same for future visual work: render it, read the
image, then fix what the image shows. Note VS Code's bundled Electron
(`.vscode-test/*/code`) is **not** usable for this — it starts VS Code rather
than accepting a URL — and no standalone Chromium or Firefox is installed.

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
the graph in that language. Since `2026-10-16` the menu also carries
**Reload once with Git CLI** (see the Phase 16 record of that date): English
for the same reason as everything else in the menu, and its one-shot flag
lives only in the webview instance, never in settings or saved state. Four
properties are deliberate and should survive any refactor:

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

## Near-Term Work Order

### Active handoff: Git trust, repository recovery, and diagnostics (`2026-10-17`)

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

**Next (`2026-10-16`), awaiting the maintainer:** what remains of the
upstream engine review's ranked candidates. Landed the same day, each in
its own signed commit on `feat/engine-author-date-status`: config
staleness (`a17048e`, correcting the 16.8 record), tags of trees and blobs
(`7982c4a`), the shallow-clone boundary (`358f8eb`), status counts
(`bcde994`) and the replace-ref decline (`00ce508`) — candidates 1–4 and 8.
Signatures then left the graph load, with the Hidden menu's one-off CLI
reload and engine-failure telemetry, gated the same day (see that record
under Phase 16). Still open, in ranked order: topo seeding (#5, could lift
the `topoOrdering` decline), numstat completeness (#6), encoding handling
(#7) and the remote-ref special cases (#9). Each fix needs a parity case,
and taking upstream code also needs the `LICENSE.mit` and
`engine/NOTICE.md` updates. `1.8.1` (Author Date through the engine, the
status indicator) is done and gated; see its record under Phase 16.

**Current priority (`2026-09-22`): Phase 16, the Rust engine backend**, on the
`rusty` branch, which is where `1.7.0` is being assembled. The engine's source
and history are merged under `engine/`, and since 16.3 the extension reads
through it wherever it is available and allowed to; the phase
plan cuts the wiring into slices 16.1–16.9, and **16.1 (a gate for the Rust
side) came first** — nothing else can be verified until `cargo check`,
`cargo test`, `cargo clippy` and `cargo fmt` are part of the documented gate,
because `sonar.sources` and Biome's allowlist both miss `engine/` entirely.
Slice 16.1 is done (`2026-09-22`: `engine:*` scripts, `engine.yml` CI,
`sonar.exclusions`, gate-order docs) and so is 16.2 (local addon build plus
smoke test, debug binary loading with `engineVersion()` `1.0.24`); 16.3 is
done too (the seam, the `backend` setting, `remoteUrl` on the reader with a
parity table, and `view.engineBackend` telemetry); 16.4 is done as well
(`loadRepoInfo` through the reader: engine head/tags/stashes with CLI
fills, parity byte-for-byte, `loadBranches` untouched).
**16.5 (`loadCommits`) is done** (`2026-09-22`: pre-call declines plus
post-call HEAD/unborn reroutes, seam mapping with two gated CLI fills,
`topo` declined over a measured tie-break difference, byte-for-byte parity
with the served flag; the two fills were deleted on `2026-09-23` once the
engine carried tag signatures and symbolic remote HEADs itself, taking
`loadCommits` from `0.8x` to `1.5x`). **16.6 (commit details, comparison, line counts) is
done** (`2026-09-23`: eager whole-list counts fill, merges/`*`/blank/stash
reroutes, file content through the provider with binary CLI fallback,
parity over renames/copies/binary/root/unborn/dirty plus file bytes).
**16.7 (the remaining reads) is done** (`2026-09-23`: the user-config
fill from `config_list` with whole-read rollback, parity over plain,
include-carrying and missing-global cases, every other candidate
declined with its reason recorded). **16.8 (handle lifetime and post-write freshness) is done**
(`2026-09-23`: warm handles proven fresh against external writes by
probe, so no write-time bust — only leak prevention via removal and
deactivation closes, with a no-accumulation test). **16.9
(per-platform packaging) is done** (`2026-09-23`: native-build matrix
for six triples, seven VSIXs — six platform plus the universal
CLI-only fallback — release shape preserved, universal `272.52 KB`
and linux-x64 `37.63 MB` measured, remaining platform sizes pending
the first tag push, which also proves the remote CI matrix).

Maintainer-set priority (`2026-08-25`): **the Immediate TODOs bug backlog below
comes before every phase item.** BUG-1 through BUG-6 were reported against
`v1.3.0` and root-caused the same day; work them in the slice order recorded at
the end of that section. Nothing in the phase list starts until that backlog is
closed or the maintainer explicitly redirects.

**Current priority (`2026-09-09`): the graph/stash UI slices** in the section
below — checkboxes, remote sub-label restyle, stash-list move, graph stash
rows, then the stash-display choice and the create-branch checkout default —
before any other remaining phase item. All six are implemented and committed
on `AIdev`, unpushed, awaiting the release gate.

**Backlog closed `2026-08-25`** — all six entries fixed and gated; per-entry
implementation records with Sonar task ids are in the backlog section below.
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
| 7 Stash management | Complete — actions, stash list panel, and graph stash rows done |
| 8 Comparison and multi-select | Partial — compare-with-HEAD and multi-select done; arbitrary two-commit/ref comparison and external directory diff remain |
| 9 Repository and remote management | Mostly complete — repository dropdown ordering preference remains |
| 10 Advanced history, text, integrations | Partial — issue links, config export, archive, commit and tag signature status done (tag signatures in Phase 15); text rendering, mailmap, code review, encoding remain |
| 12 Toolbar dropdown name truncation and find row | Complete |
| 13 Settings hub: tabbed widget, color editor, settings export | Complete |
| 14 Reveal highlight: persistent blink and configurable color | Complete |
| 15 Tag surfaces: signed-tag distinction and remote tag deletion | Complete |
| 16 Rust engine backend | In progress (`2026-10-16`) — 16.1–16.9 done, shipped in `v1.8.0`; Author Date and the status indicator in `1.8.1`; upstream candidates 1–4 and 8 landed, signatures left the graph load with a one-off CLI reload and engine-failure telemetry; topo, numstat, encoding, remote-ref cases open |
| Immediate TODOs bug backlog (BUG-1 … BUG-6, `2026-08-25`) | Complete (`2026-08-25`; see the per-entry implementation records) |

### Phase 16: Rust Engine Backend

**Status: in progress (`2026-10-16`) — slices 16.1–16.9 all done and shipped
in `v1.8.0`; `1.8.1` serves Author Date from the engine and adds the status
indicator popup; the upstream review's candidates 1–4 and 8 landed the same
day, as did signatures leaving the graph load, the Hidden menu's one-off
CLI reload and engine-failure telemetry; topo seeding, numstat, encoding
and the remote-ref special cases remain open.** The engine's source and its
52-commit history live on `rusty` under `engine/`; see "Evaluating the Rust
engine of `vscode-git-graph-rs`" for what it is, what was excluded, and why it
was not adopted wholesale. **Nothing in the extension reads it yet.** This
phase is the wiring, cut so that every slice leaves a shippable extension and
can be abandoned without unwinding the ones before it.

Goal: serve the hot repository reads in process from the engine where it is
available *and* correct to do so, and from the `git` CLI everywhere else, with
no user-visible change except speed. Their measured numbers on a
10,000-commit repository are a `4.5×` view load and one to two orders of
magnitude on single-object reads, because a `git` spawn costs ~40–70 ms on
Windows before it does any work.

#### Non-goals, permanently

No slice should try to move these. They are not deferred, they are excluded:

- **Every write.** All 41 operations stay on `runGitRaw`. gix implements no
  `push`, so a literal 100% is not reachable and chasing it is not the point.
- **`repository.includeReflog`.** The engine declines reflog tips with
  `Unsupported`.
- **`repository.includeUnreachableCommits`.** `git fsck --unreachable` has no
  engine equivalent at all.
- **Signature verification.** The engine reports signature *presence* and
  leaves status `E`. This project's `1.2.0` work — `%G?` plus the batched
  `git cat-file --batch` `gpgsig` probe that separates genuinely unsigned from
  SSH-signed-but-unverifiable — has no counterpart and must not regress.
- **`customBranchGlobPatterns`.** `--glob=` is not understood by the engine's
  tip resolution.

Each of these is a *decline*, not a bug: the backend wrapper routes them to
the CLI automatically, and a test pins that it does.

#### Design rules — invariants every slice must keep

1. **This project's types, never the engine's wire shapes.** `engine/native/
   core/src/types.rs` says its structs serialise "to exactly the shape the
   existing webview already consumes" — that is *their* webview. Map at the
   seam into `GitCommitNode`, `GitRef`, `GitStash` and friends. Two reasons:
   it keeps this project independent of their type evolution, and it keeps the
   licence boundary clean (see the evaluation section on `types.rs`).
2. **The CLI is the default and the engine is the optimization.** Every read
   keeps a working CLI implementation. A platform with no prebuilt binary, a
   failed `require()`, a version-skewed addon, or a user who switched the
   setting off must all land on exactly the behavior of 1.6.2.
3. **Two implementations, proven to agree.** Every read wired to the engine
   gains a cross-backend parity test that drives both against the same real
   repository and asserts identical output. A divergence is an engine bug, not
   a test to relax.
4. **No slice changes user-visible behavior.** If a slice would, it is the
   wrong slice: split the behavior change out and take it on its own merits.
5. **Handles are resources.** `open_repository` keeps pack indexes and an
   object cache resident for the session — that is where the speed comes from
   and also where a leak would come from. Every path that removes a repository
   from the workspace must call `close_repository`.
6. **Telemetry stays at the three documented chokepoints.** Which backend
   served is a *shown* property, so it belongs in
   `createViewFeatureReporter()`, once per session, as a fixed id — never a
   path, never a per-load count.

#### Slice 16.1 — A gate for the Rust side, with no wiring at all

Nothing can be verified until the Rust half has a gate, and today
`sonar.sources` (`src,scripts,esbuild.js`) and Biome's `includes` allowlist
both miss `engine/` entirely.

1. Add package scripts: `engine:check` (`cargo check --workspace
   --all-targets`), `engine:test` (`cargo test --workspace`), `engine:lint`
   (`cargo clippy --workspace --all-targets -- -D warnings`), `engine:fmt`
   (`cargo fmt --all --check`), each running with `--manifest-path
   engine/Cargo.toml` so they work from the repository root.
2. Add a CI job that runs all four on `ubuntu-latest`, keyed on changes under
   `engine/**`.
3. Add `engine/**` to `sonar.exclusions` **explicitly**. It is already outside
   `sonar.sources`, so this is belt-and-braces — but the exclusion is one line
   and the failure it prevents (a 418-line `build-addon.mjs` with
   `spawnSync(…, { shell: true })` entering analysis if `sonar.sources` is
   ever broadened) lands on an unrelated slice.
4. Extend the documented gate order in this file with the Rust arm, stating
   that it runs only when `engine/**` changed.

Acceptance: the four scripts exist and pass from a clean checkout; CI runs
them; `pnpm run lint` still reports the same file count it does today.

Implementation record (`2026-09-22`, four subslice commits, all signed):

- 16.1a `package.json`: the four `engine:*` scripts, each with
  `--manifest-path engine/Cargo.toml`. All pass: `fmt` clean, `check` with
  zero warnings, `cargo test` 101 passed / 0 failed, `clippy` clean under
  `-D warnings`.
- 16.1b `.github/workflows/engine.yml`: runs the four scripts on
  `ubuntu-latest`, keyed on `engine/**` plus the workflow itself. Action pins
  and Node setup mirror `publish.yml`; `rustup component add clippy rustfmt`
  covers components the runner image does not guarantee.
- 16.1c `sonar-project.properties`: `engine/**` appended to
  `sonar.exclusions` with the belt-and-braces comment. `pnpm run lint` checks
  243 files before and after — the acceptance count.
- 16.1d this file: the Rust arm added to the documented gate order, running
  only when `engine/**` changed.
- Nothing in `src/` references the engine; `git status` shows only the four
  intended files across the subslices, and `engine/target/` stays ignored.

#### Slice 16.2 — Build the addon locally for one target

1. Add `@napi-rs/cli` as a devDependency (upstream pins `^3.8.6`; the crates
   are `napi` 3 with the `napi4` feature).
2. Add `engine:build` producing `engine/native/<triple>/git-graph.node` for
   the host triple only. `engine/.gitignore` already ignores `native/*/`, so
   the artifact is untracked by construction — confirm, do not assume.
3. Add a smoke test, run by the Rust arm rather than vitest, that `require()`s
   the built addon and asserts `engineVersion()` equals the workspace version
   in `engine/Cargo.toml`.

Acceptance: `pnpm run engine:build` produces a loadable `.node` on
`x86_64-unknown-linux-gnu`; `git status` is clean afterwards; nothing in
`src/` references it.

Implementation record (`2026-09-22`, three subslice commits, all signed):

- 16.2a `@napi-rs/cli` as a root devDependency (resolved `3.10.4` against
  the `^3.8.6` pin). The CLI ships in the workspace root's `node_modules`,
  so `build-addon.mjs` now resolves it there first, keeping an
  engine-local `node_modules` as the fallback for standalone checkouts.
- 16.2b `engine:build` (host triple, debug — the script's documented local
  default) and `engine:smoke` (`engine/scripts/smoke-addon.mjs`), which
  `require()`s the built addon and asserts `engineVersion()` equals the
  `[workspace.package]` version in `engine/Cargo.toml`, refusing a stale
  binary. The smoke runs by hand, not under vitest, which never builds it.
- Two wiring findings, both fixed in 16.2b: napi's CLI requires an
  `engine/package.json` for its config lookup (the filtered import dropped
  it with the TS layer — first build failed `package.json not found`), so a
  private manifest now carries name/version plus `napi.binaryName` and the
  single-key `engine/napi.conf.json` is removed as superseded; its
  `version` must track the Cargo workspace version (drift only affects the
  staging filename, which the build discards, but keep them together).
- Verified on `x86_64-unknown-linux-gnu`: debug build placed
  `engine/native/linux-x64-gnu/git-graph.node` (186.2 MB — debug symbols;
  release size is recorded in 16.9), smoke reports `engineVersion()`
  `1.0.24`, `git status` shows no artifacts (`native/*/` stays ignored),
  `pnpm install --frozen-lockfile` still passes (the engine manifest is not
  a workspace package), `pnpm run package` green, manifest tests 16/16.
- Nothing in `src/` references the addon.

**Do not attempt the other five triples in this slice.** Their link
environments are the expensive part (`docs/DEPENDENCIES.md` in `engine/` is
the map: MSVC plus the Windows SDK, a separate ARM64 CRT, `cargo-xwin`,
`cargo-zigbuild` with zig, Xcode) and none of it is needed until 16.8.

#### Slice 16.3 — The seam, the escape hatch, and one trivial read

The first wiring slice. It proves loader, fallback, setting, parity testing
and telemetry end to end on a read whose result is a single string, so that
nothing about data-shape mapping can obscure a plumbing failure.

1. **`src/backend/engine/addon.ts`** — the only module that knows the engine
   is a `.node` binary. Resolves the path for the host platform, `require()`s
   it inside a `try`, and exports `null` when it is absent or throws. Nothing
   above it may know the file exists.
2. **`src/backend/engine/index.ts`** — `createRepoReader(config)` returning an
   object that satisfies the reader interface, choosing engine-with-CLI-
   fallback or CLI-only. The fallback rule is upstream's and is worth keeping:
   fall back only on "not a repository" and "unsupported"; a genuine Git
   failure (bad revision, corrupt object) must not be retried through the CLI,
   because it will fail again more slowly and hide the real error.
3. **The setting, before any read depends on it.**
   `git-graph-libre.backend` (`"auto"` | `"git-cli"`, default `"auto"`)
   through the standard eight-hop plumbing — manifest, five
   `package.nls*.json`, `src/config.ts`, `src/types.ts`, `webviewHtml.ts`,
   `global.d.ts`, the webview config switch plus constructor literal, and the
   README table. `"git-cli"` must be a total no-op path: the addon is not even
   loaded.
4. **Wire exactly one read: `remoteUrl`** (`remote_url`). One string in, one
   string or null out.
5. **Cross-backend parity test** — `tests/backend/engine/parity.test.ts`,
   built to grow: a table of cases driven against both implementations over
   real scratch repositories, asserting identical results. Skip the engine
   half with a clear message when no addon is built, so the suite passes on a
   machine that has never run `engine:build`.
6. **Telemetry**: `view.engineBackend`, once per session, reported from the
   existing `recordCommitLoad()` call site, true only when the engine actually
   served a read. Update `telemetry.json` and the README disclosure in the
   same slice, as the telemetry rules require.

Acceptance: with no addon built, every existing test passes and behavior is
identical to 1.6.2; with an addon built, `remoteUrl` is served by the engine
and the parity test proves the two agree; setting `backend` to `"git-cli"`
restores the CLI path without a reload of the window.

Implementation record (`2026-09-22`, five subslice commits, all signed):

- 16.3a `git-graph-libre.backend` (`auto` | `git-cli`, default `auto`):
  manifest, five `package.nls*.json`, validated `config.backend()`, the
  `EngineBackend` type, README row. The first pass also carried the full
  webview cascade (view-state field, Config field, echo case) per the hop
  list — removed again in 16.3e: the setting is consumed only on the host
  (like `tabIconColorTheme`, which has no webview surface at all), the hub
  echo safely ignores unknown keys without reloading, and the case was
  unobservable and therefore uncoverable dead code. The fourteen test
  literals the cascade briefly required are reverted with it.
- 16.3e corrections: `AvatarManager` takes the preference as a *required*
  thunk (no `auto` default to hide behind); the loader gained a pure
  `platformDirectoryFor()` and an exported `validateLoadedAddon()` so every
  triple and every refusal is unit-tested; the dead outer try/catch is gone
  (each stage guards itself).
- 16.3b `src/backend/engine/addon.ts` (the only module that knows the
  `.node` file: dual `__dirname` anchors, `createRequire` on absolute
  paths, `EXPECTED_ENGINE_VERSION` refusal) and `index.ts` (engine-first
  reader, fallback only on `NotARepository:`/`Unsupported:`, genuine
  failures to null without CLI retry, `git-cli` never loads, session
  served-flag, per-call preference).
- 16.3c AvatarManager wiring (preference as a live thunk) plus the
  parity table (https origin, split push url, no remotes, non-repo dir)
  and a manager→github end-to-end wiring test on real backends.
- 16.3d `view.engineBackend` from the existing `recordCommitLoad` call
  site, true only when the engine served; `telemetry.json` and the README
  disclosure moved in the same slice.
- Four findings fixed inside the slice: napi camelCases exports (the
  addon speaks `remoteUrl`, verified against the binary; the loader
  refuses a binary without it); the engine contract is
  URL-or-null-or-decline (a non-repo throws `NotARepository`, which the
  parity model and the reader both route to the CLI); stub-based avatar
  tests pin `git-cli` to stay hermetic; fake timers hold back the engine
  threadpool, so the wiring test polls on real timers (proven by probe).
- Gate: the first scan failed `new_coverage` at `71.2` (ten uncovered
  lines: foreign-platform branches, the validator's refusal paths, the
  dead echo case, the preference default) and passed everything else;
  after the 16.3e corrections the gate is `OK` — full numbers in the
  16.3e commit.

#### Slice 16.4 — `loadRepoInfo`

Branches, tags, remotes, stashes and HEAD — one engine call (`load_repo_info`)
against several CLI invocations, and the first slice where mapping matters.

1. Map `GitRepoInfo` onto this project's shape. Watch the ordering contracts:
   the repository dropdown and the branch dropdown both depend on the order
   they receive names in, and `read_refs` orders by its own scan.
2. `showRemoteBranches`, `showRemoteHeads`, `hideRemotes` and the stash toggle
   all have engine equivalents — thread them rather than post-filtering.
3. Parity cases: no remotes, several remotes, detached HEAD, an unborn branch,
   a repository with no commits, annotated and lightweight tags, hidden
   remotes, stashes on and off.

Acceptance: the graph opens identically on both backends for every case above;
parity test green; no change to `loadBranches`.

Implementation record (`2026-09-22`, four subslice commits, all signed):

- 16.4b `src/backend/engine/repoInfo.ts`: options builder (only
  `showStashes` threaded; the ref options take engine defaults),
  strict payload guard, stash mapping through the CLI's own
  `parseStashIndex`, composition from engine head/tags/stashes plus the
  CLI fills (headCommit, authors, remotes with push URLs, config —
  exported for the seam). Tags go through the CLI's own sorter, so every
  locale matches by construction.
- 16.4c reader `loadRepoInfo` with the 16.3 routing shape, the
  `loadRepoInfo` route reading the preference live, and the loader
  refusing binaries without the new export. Nine routing cases with a
  counted CLI module.
- 16.4d parity table: plain, featured (±stashes), detached, unborn —
  auto, git-cli, and direct CLI agree byte for byte with the served flag
  pinning the engine.
- Probe findings (throwaway scripts, `/tmp`): engine tags arrive in CLI
  order even adversarially; stashes arrive newest-first with
  `refs/`-prefixed selectors; `hideRemotes` and the remote toggles leave
  the consumed fields invariant (they only reshape the dropped branches);
  detached gives `head: null`; unborn answers with a name; non-repos
  throw `NotARepository:`. A global `tag.gpgsign=true` on dev machines
  hangs plain `git tag` — the test helpers already neutralise it.
- `loadBranches` untouched: filtering still travels on its own message.
- Gate: numbers in the 16.4e commit.

#### Slice 16.5 — `loadCommits`, and the three declines

The largest slice and the one that can most easily regress this fork's
distinguishing features. **Read the non-goals above before starting.**

1. Route to the engine **only** when none of the declines apply: reflog off,
   unreachable-commit discovery off, no `--glob=` branch patterns, and the
   signature column not requested. Anything else goes straight to the CLI —
   decided *before* the call, not by catching a failure.
2. Signature handling is the trap. `git-graph-libre.columns.signature` is off
   by default, so the engine path is the common one; but the moment the column
   is on, the whole load must take the CLI path, or `parseGpgsigPresence` and
   the `unverifiable` status disappear. A test must pin that turning the
   column on changes which backend serves the load.
3. Stash rows: the engine's `GitStash.base_hash` is this project's
   `sourceHash`, and injection above the base commit with parent-0-only
   linking must be preserved exactly — the layout walker loops forever
   otherwise (see the Slice 4 note under the graph/stash section).
4. Uncommitted-changes row, `more_commits_available`, author and path filters,
   and the three commit orderings all have engine equivalents; the engine's
   ordering is exact within a bounded window rather than over the whole
   history, which is a real behavioral difference — pin it with a parity test
   over a branchy history and record the result, then decide whether it is
   acceptable or whether this read stays CLI.

Acceptance: parity across filters, orderings, page sizes and stash display;
every declined shape provably lands on the CLI; the `1.2.0` signature
behavior unchanged.

Implementation record (`2026-09-22`, twelve subslice commits, all signed):

- 16.5a `src/backend/engine/commits.ts`: the pre-call decline predicate
  (`showSignature`, `Author Date`, reflog/unreachable discovery on
  show-all loads, `--glob=` patterns; the `Author Date` decline was lifted
  on `2026-10-16` by engine `1.0.25`, see "Author Date through the engine,
  and the status indicator") plus the `LogOptions` builder reusing
  the CLI's own ref/author/remote helpers with CLI-equivalent constants.
- 16.5b wire guard (`parseEngineCommitData`) and node mapping
  (`mapEngineCommitData`): heads/tags/remotes onto project refs, no
  `signature` key except the CLI-pinned null on stash rows, in-place stash
  marks stripped, rows dropped when the caller did not opt in.
- 16.5c reader `loadCommits` with the 16.3 routing shape, the route reading
  the preference live, and the loader refusing binaries without the new
  export. Routing cases with a counted CLI module, including the pin that
  turning the signature column on moves the load from engine to CLI.
- 16.5d1 ref labels re-sorted into `for-each-ref` order (heads, remotes,
  tags, byte-sorted) and the root `[""]` parse artifact mirrored, so the
  parity table stays a strict `toEqual` that fails loudly on CLI change.
- 16.5d2 the tag scan flag covers shown *or* selected tags (the CLI scans
  `refs/tags` for both) while only shown tags become walk tips.
- 16.5d3/d5 two CLI fills, each gated on page content so remoteless loads
  pay no spawn: symbolic remote HEADs (`origin/HEAD`) attached in CLI
  order, and signed-tag badges flipped reusing the loader's own signature
  atom (probed end to end against a crafted PGP-signed tag).
  **Both were removed on `2026-09-23`** — the engine now carries the two
  fields itself and the `loadCommits` engine path spawns nothing. See "The
  two ref fills, removed from the engine rather than optimised".
- 16.5d4 post-call reroutes: unborn stays on the CLI, which owns the
  empty-graph error shape; unfiltered show-all pages that lost HEAD go back
  to the whole CLI read, mirroring the move-HEAD-onto-page contract.
  Filtered loads exclude HEAD by request on both backends.
- 16.5d6 `topo` declined to the CLI: the engine walks each history line
  depth-first while git interleaves branch lines by date under the same
  topological constraint — both valid, visibly different row orders. Date
  and author-date agree byte for byte past the window floor.
- 16.5d7 parity table: deterministic fixtures (branchy clean/dirty, clone,
  detached deep/tip, unborn, 30-commit roomy) across orderings, filters,
  page sizes and stash display, strict `toEqual` with the served flag. Only
  the `*` date is masked; author cases collapse the pre-existing CLI
  duplication quirk below.
- Probe findings (throwaway scripts, `/tmp/parity*`, preserved for review):
  date/author-date exact on a 433-commit branchy history past the
  256-commit window floor, so the window never materialized; same-second
  ties can order differently on either backend (inherent to equal
  timestamps, recorded); the CLI duplicates an author match when HEAD is
  filtered out — its detached recovery re-queries HEAD alone and prepends
  a row that already appears below, adjacently or not — while the engine
  is provably correct, so the loader keeps that bug for its own behavior
  slice; `for-each-ref` sorts globally (heads < remotes < tags) while the
  engine annotates heads, tags, remotes; unborn errors on the CLI where the
  engine returns null; a detached HEAD deeper than the page needs the
  CLI's move-onto-page.
- Known engine deviations, recorded not fixed (exotic layouts): Gerrit
  `/changes/` refs are dropped from labels, remote tag refs
  (`refs/remotes/*/tags/*`) classify as tags rather than remotes, and a
  dangling symref HEAD with no other remote label on the page gets no fill
  (the fill gates on page remotes).
- Gate: numbers in the 16.5e commit.

#### Slice 16.6 — Commit details, comparison, and line counts

`load_commit_details`, `load_stash_details`, `load_uncommitted_details`,
`compare_commits`, `load_line_counts`, `load_commit_file`,
`load_commit_file_diff`.

1. The engine returns file lists as statuses only and settles `+N/-M`
   separately, because each count reads two blobs. This project renders counts
   eagerly. Either adopt the deferred shape (a real UX change, so its own
   slice) or call `load_line_counts` for the whole list — measure both before
   choosing, and record the numbers here.
2. `load_commit_file_diff` covers the commit↔parent case only; an arbitrary
   from→to pair stays CLI.
3. Rename detection matches git's `-M50%`. Parity must cover renames, copies,
   binary files, a root commit, an unborn branch, and a file that is modified
   but unstaged.

Implementation record (`2026-09-23`, six subslice commits, all signed):

- 16.6a `src/backend/engine/details.ts`: strict parsers and mapping for
  the details payload, the bare `compare_commits` list, the `+N/-M` map,
  and the stash entries (find-by-hash plus the `stash_json` argument) —
  bodies through the CLI's own trailing-blank trim, counts joined by path
  exactly like the CLI's numstat pass, `Untracked` mapped to added (what
  `git stash show` reports).
- 16.6b reader `loadCommitDetails`/`loadCommitComparison` with eager
  whole-list `load_line_counts` fill, and both routes reading through the
  reader. Reroutes back to the whole CLI read: blank hashes/refs (the CLI
  rejects them before any git call), the `*` row (the engine would serve
  uncommitted-shaped data — a UX change for its own slice), multi-parent
  merges (the engine diffs the first parent only, the CLI passes `-m`),
  stash hashes (through `load_stash_details` diffed against the base with
  untracked appended), and any failed or malformed counts call (counts are
  the point of the read; serving them null would be silently wrong).
- 16.6c1/c2 file content: the addon seam gains `loadCommitFile`, and
  `DiffDocProvider` serves text from the engine on `auto`, falling back to
  `git show` on the `git-cli` preference, a missing addon, any engine
  throw, a malformed payload, or the binary marker — keeping the
  byte-identical binary presentation instead of an empty document.
- 16.6d parity table (against the built addon, `1.0.24`): a deterministic
  fixture proves renames arrive as `R` with settled counts, copies as `A`
  on both sides (neither passes `-C`), binary rows carry null counts on
  both sides, the root commit reports added files, merges stay CLI-served,
  unborn errors on both sides, and a dirty worktree leaks into no answer;
  `load_commit_file` bytes equal `git show` output, file for file,
  including across the rename, with the binary marker and matching
  failures on missing paths.
- Deferred-shape decision (item 1): eager whole-list fill, measured at
  7.8ms versus 7.5ms for the CLI's three spawns on a 200-file commit and
  1.1ms versus 4.3ms on a two-file one — within noise on large pages and
  decisively faster on small ones, with no UX change.
- `load_commit_file_diff` (item 2) has no TypeScript consumer and gains
  none here: both sides of `viewDiff` resolve through the single-revision
  provider, so an arbitrary from→to pair stays CLI by construction, and
  wiring the unified diff would be a renderer change for its own slice.
- `load_uncommitted_details` is likewise unwired: the `*` row stays on the
  CLI (see the 16.6b reroute), so the uncommitted shape is a later slice
  with the deferred-counts question if it ever renders counts.
- Gate: numbers in the 16.6e commit.

#### Slice 16.7 — The remaining reads

`search_history`, `load_tag_details`, `load_commit_bodies`,
`load_commit_subject`, `load_commit_summaries`, `count_commits_before`,
`current_branch_upstream`, `current_branch_name`, `remote_names`,
`submodules`, `load_config`/`config_list`, `repo_root`.

Individually small; take them in one slice with one parity table. Note
`count_commits_before` declines reflog tips and `--glob=` patterns, and
`config_list` declines a file carrying `include`/`includeIf` directives.

Implementation record (`2026-09-23`, four subslice commits, all signed):

- 16.7a the one viable wiring: the seam gains `configList` and the
  repoInfo composition serves user identity from `config_list` (local
  plus global). A declined, failed, or malformed fill — or a
  resolvable-but-absent file on either scope, where the CLI errors and
  the engine answers empty — rolls the composition back to the whole CLI
  read, never a mixed half-engine shape (the parity table caught the
  first revision mixing a CLI fill in and misattributing the served
  flag). Path resolution mirrors the engine's global order and follows
  `gitdir:` link files without a regex (the first scan caught an S8786
  there, fixed and rescanned).
- 16.7b parity table (against the built addon, `1.0.24`, the global
  file controlled through `GIT_CONFIG_GLOBAL` on both sides): plain
  repositories served from the engine, local and global include
  directives declined to the CLI which resolves them, and a missing
  global file staying CLI with the CLI's own error shape.
- Declines, each with its reason — no code, no behavior change:
  `search_history` (the engine matches message regex while the CLI
  searches fixed strings plus author, hash, positions and ref filters)
  — **superseded and then removed on `2026-09-23`**: rather than wire the
  mismatched function, the engine gained a `search_commits` that
  reproduces this project's semantics, and the search now routes through
  it. `search_history` itself was deleted. See "Search in the engine" and
  "The engine surface: what is wired, what was removed, what is kept";
  `load_tag_details` (the engine reports signatures present but
  unverified; verification is a permanent non-goal); `current_branch_*`
  and `remote_names` (their consumers are `kind: "action"` write flows,
  and every write stays on `runGitRaw`); `load_commit_subject` (its only
  consumer is the amend action); `submodules` (the hand-written
  `.gitmodules` parse carries documented quirks the engine would
  change); `repo_root` (bare repositories diverge: `--show-toplevel`
  fails where discovery succeeds); `load_config` (singular),
  `load_commit_bodies`, `load_commit_summaries`, `count_commits_before`
  (no TypeScript consumers at all — no `rev-list`, no batch message
  reads anywhere in `src/`).
- Gate: numbers in the 16.7c commit.

#### Slice 16.8 — Handle lifetime and post-write freshness

**The correctness risk that is easiest to miss, and it deserves its own
slice.** The engine keeps a repository open for the session. This project
writes through the CLI, so after every write the engine's view must be proven
fresh, and after a repository leaves the workspace its handle must be dropped.

1. Establish empirically — against real repositories, recorded here — whether
   a warm handle sees a commit, a ref update, a stash push and a checkout made
   by an external `git` process, and how quickly. Do not infer this from gix's
   documentation.
2. If it does not, the fix is a cache-bust at the existing chokepoint: every
   action already triggers a refresh, and `RepoFileWatcher` already fires.
   Upstream's answer was a watcher plus a 5-second poll; prefer dropping the
   handle on write, which this project can do precisely because writes are
   funnelled through `registerAction()`.
3. Call `close_repository` when a repository is removed, and
   `close_all_repositories` on deactivate. `open_repository_count()` exists for
   the test that proves handles do not accumulate across repository switches.

Implementation record (`2026-09-23`, three subslice commits, all signed):

- Empirical probe first (`/tmp/probe168.mjs`, preserved for review):
  a warmed handle was opened, then an external commit, branch and tag
  creation, a stash push and a checkout were made by a separate `git`
  process. The immediate re-read showed all of them — commits 1→3, head
  `main`→`side`, one stash, the new tag — with no change after a further
  6s settle wait, and a second external wave was seen too. gix re-reads
  refs and objects fresh on every call; the handle caches only immutable
  data. So no write-time cache bust exists in this slice: there is
  nothing to bust.
  **Correction (`2026-10-16`): the handle does cache one mutable thing —
  configuration.** The probe above covered commits, refs, stashes and
  checkouts, never config. A probe during the upstream review showed that
  after `git remote add` or `git remote set-url`, `loadRepoInfo`'s
  remotes, `remoteUrl` and `loadConfig` all stay stale until
  `closeRepository`. See "Upstream engine review, first pass".
- 16.8a the seam gains `closeRepository`, `closeAllRepositories` and
  `openRepositoryCount`, with best-effort wrappers that never throw, so
  removal and deactivation succeed whether or not the engine cooperates.
- 16.8b `removeRepo` — the single funnel for every repository removal —
  drops the engine handle in exactly one place, and a new `deactivate`
  export closes all handles. A real-addon lifecycle test proves handles
  do not accumulate across reads, drop on close, and reopen lazily.
- Gate: numbers in the 16.8c commit.

#### Slice 16.9 — Per-platform packaging

Only now, and only if the earlier slices have paid off.

1. Build the six triples in CI on native runners, following
   `engine/docs/DEPENDENCIES.md`.
2. Publish per-platform VSIXs (`vsce package --target win32-x64`,
   `linux-x64`, `darwin-arm64`, …) **plus a universal CLI-only VSIX** as the
   fallback for every platform not built — musl/Alpine above all, where the
   gnu binaries will not load.
3. The release workflow's shape is load-bearing and must survive: the token
   checks exist because the `secrets` context is not available to a
   step-level `if`, and both publishes take `--packagePath` against the same
   artifact with `--skip-duplicate`. A matrix must not quietly break either.
4. Size: today's VSIX is `263 KB` from one job. Record the new per-platform
   size here when it is known.

Implementation record (`2026-09-23`, three subslice commits, all signed):

- 16.9a `native-build.yml` (called by `publish.yml` on tags with
  `scope: full`, runnable by hand): matrix over the triples, each on
  the runner where its linker already exists — Windows x64, Linux x64
  and Linux arm64 and macOS arm64 natively; Windows arm64 through
  cargo-xwin and macOS x64 through zig, both installed on first use by
  the build script, which also owns the triple-to-directory mapping.
  One `native-<dir>` artifact per binary.
- 16.9b `publish.yml` packages seven VSIXs (six `--target` platform
  builds each staging exactly one binary directory, plus a binary-free
  universal CLI-only build guarded by an assert-no-binary step), then
  releases all seven and publishes each against its own path with
  `--skip-duplicate` on both registries. The token-check shape
  survives: outputs plus step-level `if`s, untouched.
- `.vscodeignore` whitelists only `engine/native/*/*.node` — the first
  revision opened the whole native tree and shipped Rust sources, caught
  by unzipping a local build. Inclusion proven with vsce 4.0.0's own
  minimatch pipeline (its semantics, not gitignore's).
- Sizes, measured locally with vsce 4.0.0: universal `272.52 KB`
  (36 files, no binary — the CLI-only fallback); linux-x64 **`2.73 MB`**
  (37 files, a `5.9 MB` release binary inside). The other five platform
  sizes are pending the first tag run; musl/Alpine is covered by the
  universal VSIX, whose gnu-binary absence is the point.

  **Maintainer decision (`2026-09-23`): one universal VSIX, not seven.** The
  per-platform matrix was replaced by a single package carrying every
  platform's binary, which `vsce` is given no `--target` for, so one artifact
  installs everywhere. Measured at **`15.06 MB`** (42 files, six binaries) —
  about 5.5× a single-platform VSIX rather than 6×, since they compress well
  together. It needs no code: `platformDirectoryFor()` already picks the
  directory from `process.platform`/`process.arch` at load time, and
  `.vscodeignore` whitelists `engine/native/*/*.node` across every directory.
  The cost is accepted knowingly — each install carries five binaries it
  cannot load — and it buys one file to download instead of seven, which is
  what the maintainer asked for and what `vscode-git-graph-rs` did by default
  (their `package-platforms.mjs` is the per-platform alternative, not the
  norm). `publish.yml` is correspondingly one package job rather than a
  seven-way matrix, and asserts it staged exactly six binaries, because a
  missing one would package silently and leave that platform on the CLI with
  nothing to say why.

  **An earlier revision of this line recorded linux-x64 at `37.63 MB`
  with "the 195 MB binary inside", and that number was measured against
  a *debug* build.** `engine:build` defaults to debug, and
  `vsce package` runs `vscode:prepublish`, which builds only the
  TypeScript half and never rebuilds the addon — so it silently packages
  whatever `.node` happens to be sitting in `engine/native/`. A debug
  binary is `195 MB` against the release build's `5.9 MB`, i.e. a
  fourteenfold difference in the packaged VSIX. CI is unaffected
  (`native-build.yml` passes `--release`), so no published artifact was
  ever wrong; the hazard is local packaging, and
  `pnpm run build` is what removes it.
- Gate: `vsce package` green for both shapes locally (which also runs
  `vscode:prepublish`), both workflows YAML-parsed; the six-remote CI
  matrix itself is proven on the first tag push, not here.

#### Building the whole stack (`2026-09-23`)

`pnpm run build` is the only command that builds both halves:

```
engine:build:release   ->  the addon for the host platform, --release
engine:smoke           ->  it loads, and engineVersion() matches Cargo
package                ->  typecheck, whole-tree lint, production bundle
```

Roughly 35 seconds from cold on this machine. **`pnpm run package` builds
only the TypeScript half** — that is what it has always done, and it is
the command `vsce package` reaches through `vscode:prepublish`, so
neither of them ever rebuilds or validates the addon. Use `build` before
packaging anything you intend to install or measure; use `package` when
only TypeScript changed.

#### One build path, runnable anywhere (`2026-09-23`)

**Maintainer decision: cross-compile every platform from one machine, and use
the same path in CI and locally.** The reasoning is not cost — the six-runner
matrix was free — but permanence: a release must not depend on a CI provider
still existing, still offering these runners, or still offering them free. A
build path that only works inside GitHub is not a build path.

`engine/scripts/build-all.mjs` is that path. `.github/workflows/native-build.yml`
runs it on one `ubuntu-latest` and uploads one artifact; `pnpm run
engine:build:all` runs the identical script locally, and `pnpm run build:all`
adds the extension on top, so a maintainer can produce the release VSIX with
no CI at all.

Measured on this machine (Linux, x64): **all six platforms in 58 seconds**,
and a rebuild produced **bit-identical binaries** — verified by sha256 across
two full runs. (**Corrected `2026-10-17`:** true for the Linux builds, but
the macOS and Windows ones change on every relink — a random Mach-O UUID,
PE link timestamps — so the second run was most likely served from cargo's
cache; see "Experiment: one Linux binary for both C libraries".) The
universal VSIX built from them is **15.59 MB** (42 files;
darwin-arm64 `7.6`, darwin-x64 `7.5`, win32-x64 `6.1`, linux-x64 `5.9`,
win32-arm64 `5.7`, linux-arm64 `5.4` MB).

**zig is pinned to `0.14.1`, and that pin is load-bearing.** The distribution's
zig `0.16.0` fails *both* macOS targets: rustc passes
`-Wl,-exported_symbols_list` for a cdylib, and 0.16's Mach-O driver reads the
*following* flag as the list's path, so the link dies with `unable to read
exported symbols list '-dead_strip': FileNotFound`. `0.14.1` links both
cleanly. The pin is delivered through the `ziglang` wheel into a throwaway
virtualenv under `engine/target/toolchain/`, because that is the one mechanism
that installs the same zig on every operating system without a package manager
having an opinion. **Do not "simplify" this to the system zig** — that is the
configuration that was already broken once.

**Every target is built with `--cross-compile`, including the host's own.**
`build-addon.mjs` previously refused that combination; it now allows it,
because the alternative is that the host binary is linked by the system linker
while the other five are linked by zig, and a laptop and a CI runner ship
different bytes for the same platform. One linker for all six is what makes
the two paths comparable.

**Apple Silicon code signing — answered, not assumed.** arm64 macOS refuses to
load unsigned Mach-O, and whether zig's linker ad-hoc signs was the one thing
that could have made cross-building macOS useless. It does: `darwin-arm64`
carries an `LC_CODE_SIGNATURE` load command with a 61,808-byte blob whose magic
is `0xfade0cc0` (`CSMAGIC_EMBEDDED_SIGNATURE`). `darwin-x64` carries none, and
that is correct rather than a gap — Intel macOS does not require one. So zig
signs exactly where the platform demands it.

**What this gives up, and it is real.** Native runners could at least run
`engine:smoke` on the binary they had just built. Nothing cross-built is ever
loaded before it ships, and the failure mode is silent by construction: the
loader's contract is that an unloadable binary returns `null` and falls back
to the `git` CLI, so a broken platform would look like a slow one. Only
`linux-x64-gnu` is smoke-tested locally, by `build:all`. If that matters more
later, the shape to add is a small verification matrix of native runners that
download the artifact and run nothing but the smoke test.

#### Why the graph opened no faster, and what fixed it (`2026-09-23`)

The benchmark's first run showed `loadRepoInfo` and the view load at `1.0x` —
the engine serving the read and taking exactly as long as the CLI. Two
independent causes, and both are worth knowing because neither is where anyone
would look first.

**1. simple-git adds ~50 ms to any git command that produces empty stdout.**

Established by measurement, not inference. Same binary, same arguments, same
repository — the spawn was traced to confirm it is byte-identical — and the
only variable is whether anything came back:

| call | output | time |
| --- | --- | ---: |
| `git remote -v`, no remotes configured | empty | `52.2 ms` |
| `git remote -v`, one remote configured | non-empty | `1.7 ms` |
| `git config --get-regexp ^remote.`, matches | non-empty | `1.6 ms` |
| `git config --get-regexp ^nosuch.`, no match | empty | `52.1 ms` |
| the same empty call through `execFile` | empty | `1.5 ms` |

Repeated identical calls show no warm-up effect, so it is not a queue or a
scheduling quantum. **`runGitRaw` is `git.raw(options.args)`**, so every CLI
read in the extension is exposed, and empty output is routine: no tags, no
stashes, no remotes, a filtered log that matches nothing. A fresh repository
plausibly pays this twice on every graph open.

This is unfixed. `runGitRaw` has no `binary` in its options — it relies on
simple-git's configured one — so replacing `git.raw` with a direct spawn means
threading `config.gitPath()` through its call sites. `runGitWithInput` already
spawns directly and shows the shape. **Do not make the `binary` optional when
doing it**: a two-path runner leaves the slow path wherever nobody threaded it,
and the obsolete-surfaces rule in this file says to remove the bridge rather
than keep it.

**2. The engine path was spawning `git` three times anyway.**

`composeEngineRepoInfo` filled head, remotes and authors from the CLI —
`git branch --show-current` plus `git rev-parse --verify HEAD`,
`git remote -v`, and `git log --format=%an --all` — even with an addon
present. The engine exports `currentBranchName`, `loadRefs`, `loadConfig` and
`authors`, and the loader's `EngineAddon` interface declared only
`configList`, so nothing above could reach them. Slice 16.7 wired the
user-config read and stopped.

They are wired now, each falling back to its own CLI fill rather than rolling
the whole read back — the engine's `authors` legitimately errors on an unborn
branch, where the CLI fill returns the empty-with-error shape the view already
handles, and a whole-read rollback would take the CLI path for every empty
repository. The parity table caught that: the `unborn branch` fixture failed
on the first attempt.

**Result, same fixture, engine serving every row:**

| operation | before | after | |
| --- | ---: | ---: | ---: |
| view load | `71.7 ms` | **`18.7 ms`** | `3.6x` |
| loadRepoInfo | `59.0 ms` | **`8.2 ms`** | `7.2x` |

**An engine bug found on the way, and fixed in the engine.** `log::authors`
walked from `head_id()` — one tip — while `git log --format=%an --all` walks
every ref, so any contributor whose work was only on a branch that is not
checked out was missing from the author filter. On this repository it returned
19 of 20 authors; the missing one had commits reachable only from
`refs/remotes/origin/commit_blink`. It now walks `all_tips(repo, true, true)`
plus the stash, mirroring what `stats.rs` already did and what `--all`
actually covers. `collects_authors_from_every_ref_not_just_head` pins it, and
a mutation back to head-only fails it.

**`loadCommits` was still slower than the CLI** — `0.9x` at a 300-commit page,
`0.7x` at 1000 — and was untouched by any of the above. That is the next
subsection.

#### The two ref fills, removed from the engine rather than optimised (`2026-09-23`)

`loadCommits` was the one read where the engine *lost*: `12.9 ms` against the
CLI's `10.8 ms` on a real 1,036-commit repository. The engine call itself was
`7.1 ms` — comfortably ahead. The loss was entirely in what ran afterwards.

Two CLI fills (16.5d3/d5) ran `for-each-ref` on the engine path, sequentially,
to put back two facts the engine's types did not carry:

| fill | spawn | the missing field |
| --- | --- | --- |
| `attachRemoteHeadLabels` | `for-each-ref refs/remotes` | symbolic `origin/HEAD` |
| `attachSignedTagNames` | `for-each-ref refs/tags` | tag signature presence |

This is the same defect as the `repoInfo` one above, one layer down: ask the
engine, then spawn `git` anyway. The fix is the same shape — teach the engine
the field and delete the fill, rather than make the spawn cheaper.

**`GitTagRef.signed` and `GitCommitTag.signed`.** `refs.rs` reads the tag
object's signature while it is peeling the tag it would peel regardless, and
records the flag on *both* records of an annotated tag — the signature belongs
to the tag, not to either hash, and the graph attaches the peeled one. A
`find_header` call settles the object kind first, so a lightweight tag costs a
header lookup rather than a commit read.

The semantics were verified against git rather than assumed. `for-each-ref`'s
`%(contents:signature)` is non-empty **only** for an annotated tag object that
was signed — a lightweight tag over a *signed commit* reports nothing:

| tag | object type | `%(contents:signature)` |
| --- | --- | ---: |
| annotated, signed | `tag` | `1` |
| annotated, unsigned | `tag` | `0` |
| lightweight, on a signed commit | `commit` | `0` |
| lightweight, on an unsigned commit | `commit` | `0` |

That third row is the one worth pinning: the commit was genuinely signed
(`%G?` = `G`) and the tag still reports unsigned. The engine matches by
construction — it reads the tag object, and a lightweight tag has none.

**Symbolic remote HEADs, resolved instead of dropped.** `direct_target`
returns `None` for a symbolic ref, so `refs/remotes/origin/HEAD` — what every
`git clone` writes — never reached the graph. `for-each-ref %(objectname)`
reports the object such a ref resolves to, so `read_remote_refs` now does the
same. Only a remote's handful of `/HEAD` refs are ever symbolic, so this costs
one lookup each and nothing in the common case.

**Verification.** A clone carrying all four tag shapes *and* a symbolic
`origin/HEAD` was read through `createRepoReader` on both backends, and the ref
labels compared:

```
engine served the read: true
  ccaf060 remote origin/HEAD
  ccaf060 tag    annotated-signed   signed=true
  ccaf060 tag    light-on-signed    signed=false
IDENTICAL: true
```

Spawn counts on that repository, through `recordGitCommand`:

| backend | git spawns |
| --- | ---: |
| `git-cli` | 3 (`refs`, `head`, `log`) |
| `auto` (engine) | **0** (was 2) |

| operation | CLI | engine before | engine after | |
| --- | ---: | ---: | ---: | ---: |
| `loadCommits` (300) | `11.5 ms` | `12.9 ms` | **`7.7 ms`** | `1.5x` |
| `loadCommits` (1000) | `17.1 ms` | `19.3 ms` | **`13.6 ms`** | `1.3x` |
| view load | `68.7 ms` | — | **`15.7 ms`** | `4.4x` |

`reports_tag_signature_presence_the_way_for_each_ref_does` and
`resolves_a_symbolic_remote_head_rather_than_dropping_it` pin both changes;
each was mutation-checked and kills only its own test. The signed-tag fixture
writes the tag object by hand through `git hash-object -t tag -w`, so it needs
no keyring and stays deterministic on CI — the engine reports signature
*presence*, so a fabricated block exercises the identical path.

`attachRemoteHeadLabels`, `attachSignedTagNames`, their parsers, their
appliers and their tests are deleted. Nothing in the engine's `loadCommits`
path spawns a process any more.

**A measurement trap worth recording.** The first benchmark after this change
showed the engine *five times slower*, because `pnpm run engine:build` builds
the **debug** profile (186 MB, unoptimised) while the benchmark numbers above
are all release (5.9 MB). Always `pnpm run engine:build:release` before
benchmarking; a debug addon is not a slow engine, it is a different one.

#### Search in the engine, and a CLI bug it exposed (`2026-09-23`)

Slice 16.7 declined `search_history` because the engine's search and this
project's search answer different questions. That decline was correct and the
conclusion drawn from it was not: the fix is not to wire the mismatched
function, and not to leave search on four `git` processes, but to give the
engine a search with *these* semantics. `search_commits` is that function, new
in `engine/native/core/src/search.rs`. `search_history` was then removed
outright — see the surface audit below.

What had to be reproduced, and what the engine's own search does instead:

| | this project | `log::search_history` |
| --- | --- | --- |
| message match | literal substring, case-insensitive | regular expression |
| author match | yes | no |
| hash match | yes, abbreviated resolves | no |
| refs searched | the ones the view shows | every ref, always |
| author filter | honoured | ignored |
| ordering | position in the graph's walk | commit date |

The CLI answers with four `git log` runs at once — `--fixed-strings --grep`,
`--author`, a hash lookup, and one unbounded walk that numbers every commit.
That numbering is the `loadCount` each result carries, and it is also a
*filter*: a hit with no position is dropped, which is why a hash that resolves
to an unreachable commit is not a result. The engine does the same three
matches in a single walk, which is where the speed comes from.

Verified deliberately at the boundaries the two disagree on, in the parity
table (`engine/CLI parity: searchCommits`, eight cases, plus twelve engine-side
tests): a literal dot that a regex would widen, a query that is not valid
regex at all, case folding, a body-only term that `--grep` reaches and `%s`
does not show, an author-only match, an abbreviated hash, a hash that resolves
but is unreachable, and a `--glob=` ref pattern that still declines to the CLI.

**The CLI bug the parity table found.** The `(` case failed — not because the
engine was wrong, but because **git was rejecting the search outright**:

```
fatal: header, '\(': Unmatched ( or \(
```

`searchCommits` escaped the query for its `--author` run with a
JavaScript-style `escapeRegExp`, turning `(` into `\(`. But `--author` takes a
*basic* regular expression, in which `\(` **opens a group** rather than
escaping a parenthesis — so the escaping inverted the meaning, and because the
four runs share a `Promise.all`, any query containing an unbalanced `(` or `[`
failed the entire Find dialogue. A literal match was always the intent;
`--fixed-strings` is how git spells it, and it matches name and email
substrings case-insensitively exactly as before. Verified against git directly
before changing anything.

This is worth recording as a pattern, not just a fix: the parity table earns
its keep by failing on the *CLI* side. Two implementations that must agree
catch bugs in whichever one is wrong.

| | git CLI | engine | |
| --- | ---: | ---: | ---: |
| search (message term), 1,036 commits | `62.0 ms` | **`7.8 ms`** | `7.9x` |

Second only to `loadRepoInfo` among the wired reads, because four processes
collapse to one walk.

#### The engine surface: what is wired, what was removed, what is kept (`2026-09-23`)

An audit of every `#[napi]` export against the TypeScript that calls it. **31
exports, 18 wired, 13 unwired.** The unwired ones are not an oversight — each
is listed below with why it is there — but they are not free either: a
`#[napi]` function is an exported symbol, so it is a linker *root* and LTO
cannot strip it. Dead exports are genuinely in every shipped binary.

**Removed (`2026-09-23`).** Five exports, chosen because a recorded permanent
non-goal blocks them forever, not because nothing calls them today:

| removed | why it could never be wired |
| --- | --- |
| `search_history` | superseded by `search_commits`; its regex semantics are wrong here |
| `current_branch_name` | consumer is a write flow |
| `current_branch_upstream` | consumer is a write flow |
| `remote_names` | consumer is a write flow |
| `load_commit_subject` | only consumer is the amend action |

"Every write stays on `runGitRaw`" is the first permanent non-goal, so the
last four had no reachable future. Their `api::Engine` methods, tests and the
orphaned `GitHistoryMatch`, `SEARCH_LIMIT` and `collapse_whitespace` went with
them. `Repo::remote_names` is a *different* function and stays — `graph.rs`
needs it for `load_commits`.

The TypeScript side lost `currentBranchName` too. It was declared on
`EngineAddon` **and in the `isEngineAddon` load-time guard**, so it could have
rejected a perfectly good engine binary over a method nothing called.

**What it saved.** `search_history` was the only consumer of the `regex`
crate, so the dependency went as well:

| | bytes |
| --- | ---: |
| before | `6,183,072` |
| after | `4,814,416` |
| saving | **`1,368,656` (22.1%) per platform, ~10.4 MB across all eight** |

**Kept deliberately — available for later wiring.** Nothing below is dead by
intent; each is a function whose consumer does not exist *yet*:

| kept | what it would serve |
| --- | --- |
| `activity_heatmap`, `author_stats` | **a Statistics tab** — see below |
| `load_uncommitted_details` | the `*` row, if it moves off the CLI (16.6) |
| `count_uncommitted_changes` | that row's count — redundant while `load_commits` builds it |
| `load_commit_file_diff` | a unified-diff renderer, replacing VS Code's diff editor |
| `new_path_of_renamed_file` | rename tracking between a commit and the working tree |
| `load_commit_bodies`, `load_commit_summaries` | batch message reads, if a view ever wants them |
| `count_commits_before` | anything needing `rev-list` counts |
| `load_tag_details` | blocked on signature verification, a permanent non-goal |
| `repo_root`, `submodules` | blocked on discovery semantics diverging from the CLI's |
| `open_repository` | explicit handle opening; handles currently open implicitly |

The last three rows are blocked rather than merely unwired, and could be
removed on the same reasoning as the five above. They are kept because the
maintainer may want the option, and because the saving is already taken.

**Planned: a Statistics tab.** The maintainer intends to add one
(`2026-09-23`). `stats.rs` already provides both halves — `author_stats`
(commit counts per author across every ref, merges excluded) and
`activity_heatmap` (author-local weekday/hour cells, sparse, merges excluded).
Both are inherited from `vscode-git-graph-rs`, where they backed that
project's own Statistics view, and neither has ever been wired here. Wiring
them is a feature slice, not a parity slice: there is no CLI implementation to
agree with, so the usual "two implementations, proven to agree" rule does not
apply and the engine would be the *only* backend. That is a deliberate
exception to design rule 2 and must be recorded as one when it happens —
including what the view does when the engine is unavailable, which for every
other read is "fall back to the CLI" and here would have to be "the tab is not
offered".

#### What the page-size defaults are actually worth (`2026-09-23`)

Asked why `initialLoadCommits` is `300` when 1,000 costs only milliseconds
more. Three separate costs were measured, and the answer is that two of them
are now negligible and the third was never measured here.

**Where the number came from.** It is inherited, not chosen:
`git show upstream/main:package.json` gives `initialLoadCommits: 300`, and the
only commits that ever touched it in this fork are `3ba4217 Initial
implementation of Git Graph` and an i18n pass. It is mhutchie's number, picked
when every read was a `git` spawn.

| | 300 | 1,000 | 10,000 |
| --- | ---: | ---: | ---: |
| backend read (CLI) | `11.5 ms` | `17.1 ms` | — |
| backend read (engine) | `7.7 ms` | `13.6 ms` | — |
| graph layout (jsdom) | `0.2 ms` | `0.4 ms` | `1.1 ms` |

700 extra commits cost about `6 ms` of git and essentially nothing to lay out.

**The render is the real cost, and it scales with the whole table.**
`renderTable` builds one HTML string over `this.commits` — *all* of them, not
the new page — and assigns it to `tableElem.innerHTML`. So every "load more"
rebuilds the entire table, and the cost of reaching N commits is the sum of
every rebuild along the way. Driving the real load-more flow through the
webview harness:

| table size | full rebuild (jsdom) |
| ---: | ---: |
| 1,000 rows | `921 ms` |
| 2,000 rows | `2,783 ms` |

**Those are jsdom numbers and must not be quoted as browser numbers** — jsdom
parses HTML far slower than a browser and does no layout or paint at all. What
they do establish is the *shape*: the rebuild is at least linear in total rows
and the constant is not small.

The consequence decides the page sizes. Because the whole table is rebuilt
each time, a larger `loadMoreCommits` means strictly *less* total work, not
more: reaching 3,000 commits costs about 27 rebuilds of a growing table at a
step of 100, and about 4 at a step of 750. The trade is fewer, larger
stalls instead of many smaller ones — and since `autoLoadMoreCommitsOnScroll`
fires whenever the viewport comes within 96 px of the bottom, the small-step
version stalls repeatedly during ordinary scrolling.

**Set on `2026-09-23` at the maintainer's direction**: `initialLoadCommits`
`300` -> `250`, `loadMoreCommits` `100` -> `750`. The first page is the
latency-critical paint and is trimmed slightly; the follow-on page is the one
that was costing repeated stalls and is raised well clear of them. Both sit
below the round numbers this section measured, which is the conservative
direction given that the render figures below are jsdom's and not a
browser's.

**The real fix, not done here.** The rebuild is `O(total)` per load when it
could be `O(step)` — appending the new rows instead of regenerating the table
would make page size nearly free and remove the stalls entirely. That is a
separate change to `renderTable` and its callers, and it is the thing to do if
these stalls are ever felt.

**A defaults drift found while answering.** `loadMoreCommits` was declared
`100` in the manifest and documented as `100` in the README, but
`src/config.ts` fell back to `75`, and `tests/backend/config.test.ts` pinned
the `75` — a wrong value frozen by the test meant to protect it. The fallback
never fires in a real install, because VS Code returns the manifest default for
an unset key, so nothing user-visible was wrong. All four now read `1000`. The
accessor table in that test mirrors manifest defaults by hand, so it can drift
again; keep the manifest, the accessor, the README table and that test in step.

#### Benchmarking the two backends (`2026-09-23`)

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

#### Pinned toolchain, remapped paths, cached CI (`2026-09-23`)

**The first CI run of the build matrix proved it works and proved the earlier
reproducibility claim too narrow.** All eight binaries built on
`ubuntu-latest` in `9m19s`, and every one differed from the local build —
`linux-x64-gnu` `6,164,416` bytes on the runner against `5,9xx,xxx` here.
Bit-identical *across rebuilds on one machine* had been established; identical
*across machines* had not, and the difference was the compiler version and the
absolute paths rustc bakes in.

Both are now closed:

- **`rust-toolchain.toml` at the repository root** pins the channel, the
  profile, `clippy`/`rustfmt` and all eight targets. **Root, not `engine/`,
  and that is load-bearing**: rustup resolves an override by walking up from
  the *current directory*, and the two ways cargo is invoked here start in
  different places — `build-addon.mjs` runs it with `engine/` as the cwd,
  while `engine:check`/`test`/`lint`/`fmt` run from the repository root with
  `--manifest-path`. Only a root file is found by both, so only a root file
  pins the build and the gate to one compiler. Verified: `rustc --version`
  reports the pin from both directories.
- **`--remap-path-prefix`**, added to `RUSTFLAGS` by `build-all.mjs`, replaces
  the checkout path and the cargo registry path with `/engine` and
  `/cargo/registry`. Without it `/home/zam/…` versus `/home/runner/work/…`
  ends up inside the artifact and no two machines can agree. The cost is that
  panics and backtraces name `/engine/...`; use a plain `engine:build` for
  anything to be debugged.

`rust-version` in `engine/Cargo.toml` is a different thing and stays: that is
the minimum the source supports, the toml is what it is built with. **Raising
the channel is a deliberate act** — do it alone, rebuild all eight, and expect
every hash to change.

**CI caches three things, because the run populates three unrelated ones.**
Measured locally: `~/.cache/cargo-xwin` is `1.2 GB` (the MSVC CRT and SDK that
cargo-xwin downloads for the Windows targets), the pinned zig is `350 MB`, and
`engine/target` reaches `1.8 GB` across eight targets. The first run pays for
all of it; nothing after should.

The zig install moved from `engine/target/toolchain/` to `engine/.toolchain/`
to make that possible: `Swatinem/rust-cache` owns `target/` and prunes it, and
a 350 MB download that only changes when the pin does has no business being
evicted by that.

**What the first run actually caught** is the argument for having run it:
`native-build.yml` had `corepack enable` but no `pnpm install`, so
`@napi-rs/cli` was missing and the build died in 28 seconds. It passed locally
only because `node_modules` was already on disk — exactly the class of defect
a first CI run exists to find, and one no amount of local testing would have
surfaced.

#### Alpine and the C library (`2026-09-23`)

**Superseded (`2026-10-17`): one Linux binary per architecture.** The musl
builds are gone. The glibc build is made loadable by musl when it is built
and ships as `linux-x64`/`linux-arm64`; `isMuslRuntime()` and the ordered
two-directory fallback are removed, and six platforms ship. See "Experiment:
one Linux binary for both C libraries" for the measurements. What follows is
the eight-platform decision as it stood.

**Eight platforms ship, not six.** `linux-x64-musl` and `linux-arm64-musl`
were added after establishing that the previous framing was wrong in a way
worth not repeating.

**The old claim, in three places, was that musl "has no prebuilt target" and
so "falls back to the CLI by construction".** That describes a mechanism that
never ran. `process.platform` is `"linux"` on Alpine exactly as on Debian, so
`platformDirectoryFor("linux", "x64")` returned `"linux-x64-gnu"` — a real
directory, with a real file in it. The load then failed at `require()`,
because a gnu binary needs `libc.so.6` and musl provides `libc.so`; the
`catch { continue }` swallowed it and the caller reached the CLI. The right
answer by the wrong route, documented as the wrong route, with no test over
the branch that actually ran.

**musl was never unbuildable.** zig ships musl libc, so both triples build
through the same cargo-zigbuild path as everything else — verified here in the
same run as the other six, and the binaries link `libc.so` rather than
`libc.so.6`, which is the whole difference.

What the loader does now:

- `isMuslRuntime()` reads `process.report.getReport().header.glibcVersionRuntime`,
  which is present on glibc and absent on musl. That is the check
  `detect-libc` makes and the only one available without spawning anything. An
  unreadable report is treated as glibc, the overwhelmingly commoner case.
- `platformDirectoriesFor()` returns an **ordered list**, not one directory:
  the detected C library first, the other as a fallback. A misdetection then
  costs one failed `require()` instead of silently dropping the platform to
  the CLI — the `catch` becomes a deliberate safety net rather than the
  primary mechanism.

Measured: all eight platforms in **75 seconds** on this machine, universal
VSIX **20.44 MB** (44 files) against **15.59 MB** for six — `+4.85 MB`, well
under the `+11 MB` the uncompressed binary sizes suggest.

**The remaining gap is deliberate and is one target: `linux-armhf`, 32-bit
ARM.** `vsce`'s own target list is the ceiling here — `win32-x64`,
`win32-arm64`, `linux-x64`, `linux-arm64`, `linux-armhf`, `alpine-x64`,
`alpine-arm64`, `darwin-x64`, `darwin-arm64`, and `web` — so there is no
PowerPC or RISC-V question to answer: VS Code does not run there. Eight of the
nine desktop targets carry an engine; armhf is a shrinking Raspberry Pi
niche (64-bit has been the Pi OS default since 2022), it is the one triple
whose zig route is untested here, and it runs on the CLI like any other
engine-less install.

**Why Windows still needs cargo-xwin, and zig cannot replace it.** `zig cc`
links Windows through the **MinGW** ABI (`*-pc-windows-gnu`), which is what a
standalone `.exe` wants. A `.node` is a DLL loaded into an MSVC-built
Electron, so it wants `*-pc-windows-msvc`, whose CRT and SDK import libraries
Microsoft does not redistribute in a form zig can bundle. napi-rs refuses the
combination outright: *"`cargo-xwin` only handles MSVC targets and the build
would fail at link time … `napi-build` additionally needs `libnode.dll` via
the `LIBNODE_PATH` environment variable"*. That `libnode.dll` requirement is
the real blocker and is specific to addons — do not re-propose dropping
cargo-xwin on the strength of a project that builds executables.

#### Author Date through the engine, and the status indicator (`2026-10-16`)

**Why.** `dateType` defaults to `"Author Date"`, and slice 16.5 declined
it, so on default settings the engine never served the graph load — the one
read the phase's view-load numbers are about. It surfaced while answering the
maintainer's "how do I see the engine started?": nothing in the extension
said, and their own settings declined twice (signature column on, Author
Date by default).

**Engine `1.0.25`.** `LogOptions.use_author_date` (struct-level serde
default, so `false` when absent) makes `graph.rs` emit `record.author_date`,
which `log::read_commit` already carried for the author-date ordering. Only
the row date changes: the walk still ranks by `commit_ordering`, as
`git log --date-order --format=%at` does, and stash rows keep the committer
date on both backends, because the CLI lists them with
`git stash list --format=%ct`. `search_commits` already had the option.
`reports_the_author_date_only_when_asked` pins it — an amend with `--date`
makes the two dates differ — and the mutation back to `record.date` fails
only that test.

**Bump the engine version when the TypeScript starts relying on behavior an
older binary would silently lack.** serde drops unknown fields, so a `1.0.24`
binary would accept `useAuthorDate` and answer with committer dates. Moving
`EXPECTED_ENGINE_VERSION` and the Cargo workspace version (plus
`engine/package.json`) to `1.0.25` together makes the loader refuse that
binary into the CLI path instead. A payload *shape* change needs no bump —
the strict payload guards already refuse it — but a new *option* does.

**TypeScript.** The decline is gone and `buildLoadCommitsOptions` sends
`useAuthorDate: dateType === "Author Date"`. The predicate became
`loadCommitsDecline()`, which returns the reason (`GraphLoadDecline`:
`signatureColumn`, `topoOrdering`, `reflog`, `unreachableCommits`,
`globPattern`) instead of a boolean; `shouldServeLoadCommitsFromEngine` was
removed with it.

**Parity needed a new fixture.** Every earlier fixture wrote equal author and
committer dates, so an Author Date case over them passes with the engine
wrong. `skewed` has a rebased branch (authored early, committed late) and a
commit authored after it was committed, and the case first asserts that the
CLI's dates differ between the two settings. It then compares both date
types across both orderings, stash rows, a small page and a branch filter.
Forcing `useAuthorDate: false` fails exactly that case.

**The status indicator.** The dot and the "Ready" text in the status strip
are one focusable target (`#statusSummary`). Resting on it for 700 ms, or
focusing it, opens a popup listing the Git CLI (`git --version` through the
configured binary), the engine (version and build target, `off` under
`git-cli`, or the reason it is unavailable with the loader's own detail) and
which backend answered the last graph load — with the decline reason when it
was the CLI. A ready strip over an unavailable engine turns the dot amber and
reads "Ready (Rust engine unavailable)". `git-cli` stays green: a choice, not
a degradation. The pieces:

- `addon.ts` describes its single load attempt: `engineLoadStatus()`, built
  by the pure `resolveEngineLoad()`, which reports the most telling refusal
  across every candidate (`versionMismatch` > `incompatible` > `loadFailed` >
  `missing` > `unsupportedPlatform`; Node's `MODULE_NOT_FOUND` is `missing`).
  Without the ranking a glibc host whose binary failed to load would report
  the musl fallback's absence.
- `index.ts` exports `engineComponentStatus(preference)` — `git-cli`
  answers `off` without touching the loader — and `lastGraphLoadRoute()`,
  set on every `readCommits` return path. That route is local state only; it
  is not telemetry and never leaves the extension.
- `src/extension/componentStatus.ts` is `vscode`-free so the backend project
  tests it: `probeGit()` (`execFile`, 5 s timeout, never rejects),
  `buildComponentStatus()`, and `describeEngineStatus()` for the output
  channel, which gets an `[engine] …` line whenever the graph document is
  built — the log answer to "did the engine start?".
- The webview asks (`componentStatus`) when a hover begins, so answers are
  usually back before the popup opens. The host also pushes unasked when
  `git-graph-libre.backend` or `git.path` changes; `backend` was added to the
  `onDidChangeConfiguration` whitelist for that. The engine state is baked
  into the strip as `data-engine` at document build.
- **The response field is `components`, not `status`.** `handleActionResponse`
  in `main.ts` treats any response carrying `status` as a git action's
  outcome; the typecheck caught the collision. Do not name a new response
  field `status` unless it is one.

Verified visually with the headless QtWebEngine harness in Dark and Light
Modern. The images showed two defects that were then fixed: a label centered
against a wrapped value (now `align-self: start`), and `overflow-wrap:
anywhere` splitting `linux-x64-gnu` (now `break-word`, with the width cap
raised to 480 px).

Gate (`2026-10-16`): strict Biome clean on the 26 touched TypeScript files,
`pnpm run package` clean (262 files linted), `pnpm run test` green (`70`/`725`
backend plus `49`/`537` webview), `l10n:check` `100%` (589 bundle keys per
locale), fresh `test:coverage` `119` files / `1262` tests at `93.1%` lines
(`6763/7262`), Rust arm green (`cargo fmt --check`, clippy `-D warnings`,
`107` passed / `0` failed), the release addon rebuilt and smoke-tested at
`1.0.25`, and the Author Date parity case run against it, not skipped. Sonar
numbers are in the `1.8.1` entry under Current Architecture.

#### Upstream engine review, first pass (`2026-10-16`)

At the maintainer's request, upstream's engine was audited for fixes worth
taking. Only `native/` was read, per the licensing verdict.

- **Where upstream is.** Tip `6357ec1` (`2026-09-30`, "bump version to
  1.0.26"). There are 23 commits after our `f93e8b2` baseline, and 8 touch
  `native/`. `gerrit.rs` is untouched since the baseline, and the root
  `LICENSE` is unchanged — `native/` is still MIT, by penghongxia. All 29
  `native/` commits of the imported range are in our history.
- **No new tainted port**, but some `ff4aafe` comments describe their
  TypeScript CLI backend ("trimmed as the CLI backend trims `%B`"). Reword
  those in terms of git when porting, as with `types.rs`. Taking any upstream
  commit means extending the `LICENSE.mit` roster date range and the boundary
  recorded in `engine/NOTICE.md` in the same change.
- **Upstream's `1.0.25` and `1.0.26` are different code from ours.** The
  version numbers collide; our line is independent of theirs.
- **Upstream did not add `use_author_date`.** Their graph rows always carry
  the committer date, so this project's `1.0.25` is its own work.

Ranked candidates. Every row was reproduced against our built addon, except
where noted. None is ported yet:

| # | Source | Bug in our engine | Value |
| --- | --- | --- | --- |
| 1 | ours (prompted by `5e25de8`'s message) | The handle reads config once, so remotes go stale after a remote edit. Suggested fix: reopen when `.git/config` or the global and XDG config mtimes change, which also catches terminal edits. Upstream closed handles from their own TypeScript instead. | high |
| 2 | `ff4aafe` `all_tips` | A tag naming a tree or blob stops `authors()` early (git.git and linux both carry one), truncating the author filter | high |
| 3 | `ff4aafe` shallow | At a shallow boundary, commit details and line counts fail with a genuine error (no CLI fallback), and the graph shows a missing parent | high |
| 4 | `ff4aafe` `status.rs` | The uncommitted count differs from the CLI: `add -N` 0 vs 1, `rm --cached` 1 vs 2, `status.renames=false` 1 vs 2 | high/medium |
| 5 | `ff4aafe` topo | Topological order seeded oldest-first; git seeds newest-first (`prio_queue_reverse`). A scratch build with upstream's ~6-line fix matched `git log --topo-order`, so the 16.5d6 explanation may be a misdiagnosis. Our parity table has not been run against it. | medium (could lift the `topoOrdering` decline) |
| 6 | `ff4aafe` `diff.rs` | Numstat misses a last line gaining its newline, submodule line counts, and empty-file renames | medium |
| 7 | `ff4aafe` `text.rs` | Non-UTF-8 commits ignore the `encoding` header; a subject after leading blank lines is lost | medium/low |
| 8 | `ff4aafe` | `refs/replace/*` is honored backwards by gix 0.88 — decline when any exist | medium/low |
| 9 | ours | The engine drops remote branches containing `/changes/` (a Gerrit leftover) and classifies `<remote>/…/tags/…` as tags; the CLI shows both as remote branches. Remove both special cases rather than port upstream's narrowing. | medium |

Not worth taking: the JSON `dispatch` layer and the `fileBytes` hex-viewer
exports (an unstrippable export and a `base64` dependency for a surface
nothing uses); single-file diff headers (`load_commit_file_diff` is unwired);
and `tag_details` and mailmap in `author_stats`, until the Statistics tab
exists.

#### Signatures leave the graph load; a one-off CLI reload and engine-failure telemetry (`2026-10-16`)

Three maintainer asks landed together, plus the change that makes two of
them matter less often.

**The signature column is read after the page renders.** `%G?` runs GPG (or
SSH verification) once per signed commit, while everything else about a
page is a cheap read — so the visible column both slowed every CLI load
and, since 16.5, declined the engine outright; with Author Date it was one
of the two declines in the maintainer's own default settings. The graph
load now never asks for signatures on either backend (`showSignature` is
gone from the query, the reader and the messages). The new CLI-only
`commitSignatures` query (`src/backend/queries/commitSignatures.ts`) reads
exactly the hashes the webview shows — `git log --no-walk=unsorted` in
chunks of 200, full object names only, since the hashes arrive over the
bridge and become command-line arguments — and the `1.2.0` `gpgsig` probe
moved there with it, so verification stays a permanent engine non-goal,
unchanged. The webview caches answers per repository (the toolbar refresh
empties the cache, so newly trusted keys are picked up on request), fills
cells in place, and leaves them pending with a strip error when the read
fails. The `signatureColumn` decline, route and strings are removed
everywhere; the remaining declines are `topoOrdering`, `reflog`,
`unreachableCommits` and `globPattern`.

**Forcing the CLI: the setting already existed; the one-off did not.**
`git-graph-libre.backend: "git-cli"` (16.3) already never loads the addon
— every reader path checks the preference first — and is read live per
load, so no second setting was added. New is the Hidden menu's **Reload
once with Git CLI**: `forceCliOnce` in the webview marks the next
`loadRepoInfo` and `loadCommits` requests `forceCli` and clears when the
commit load is asked for, so exactly one reload is affected and the
setting is untouched. In the reader `forceCli` behaves exactly as
`git-cli` (the provider is never called) but records its own graph-load
route, `forced`, which the status popup names in all five locales.
"Once" means the reload: commit details, comparison and search afterwards
use the configured backend again.

**How often the engine fails is now measurable.** The reader keeps three
session flags beside `didEngineServeRead()`: every engine throw is
classified by `noteEngineThrow()` — a fallback error (`NotARepository` /
`Unsupported`) is a *decline* (the CLI served the read), anything else a
*failure*, as is every payload the strict guards refuse. The `loadCommits`
route — the existing telemetry chokepoint, no new call sites — feeds them
to the view reporter as once-per-session signals: `view.engineUnavailable.<reason>`
(the fixed five-member reason union completes the id; `git-cli` reads as
null because it never tries, and no path, platform string or error text is
ever part of it), `view.engineFailed`, `view.engineDeclined` and
`view.forceCliReload`. Like every signal here they measure the share of
sessions in which it happened, read against the `activate` denominator
and the `common.os` / `common.nodearch` each event carries — which is how
a platform binary that cannot load becomes visible at all, since such an
install otherwise just looks slow. The README list and the
`telemetry.json` declaration were extended in the same change.

This work was left staged but unfinished by a Claude Code session that hit
its limit, and was taken over, audited and gated in Muse the same day:
the audit removed three dead `showSignature` properties the type removal
had stranded in tests behind `as` casts, and added the README, changelog
and this record.

Gate (`2026-10-16`): staged format and strict Biome clean (34 files; one
formatter fix in `hiddenMenu.test.ts`), `pnpm run package` clean (264 files
linted), `pnpm run test` green (`70`/`740` backend plus `50`/`545`
webview), `l10n:check` `100%` for all four locales, fresh
`test:coverage` `120` files / `1285` tests at `93.3%` lines (`6870/7366`).
The Rust arm was skipped under its own rule: no `engine/**` file changed.
The first Sonar scan (task `10e0c345-c59e-42f8-823d-d50f445128b9`, analysis
`8284db07-89d2-4d82-bfe4-6ac4ea6fcc6c`, window `PREVIOUS_VERSION 1.8.0`)
was `ERROR` on one condition, `new_software_quality_high_issues = 1`: an
`S3776` cognitive-complexity finding on `recordCommitLoad` (16 over the
allowed 15 — the four new conditionals), plus an `S6582` optional-chain
finding in the new signature fill. The engine signals moved into a
`reportEngineSignals()` helper and the chain was applied; the whole gate
reran in order and the rescan returned **`OK` on all seven conditions**
(task `3d71e650-8e4e-44cb-bcf8-0326e15ae348`, analysis
`168329c8-2972-4a1c-9f51-8ecba0bd8ac2`): `new_coverage` `94.4`,
`new_violations` `0`, duplication `0.0`, high, reliability and security
issues `0`, maintainability rating `1`, and no `TO_REVIEW` hotspots in new
code. One polling note: the proxy in front of the SonarQube instance
answers Python's `urllib` with `403` even on the public status endpoint,
while `curl` with the same token succeeds — poll with `curl`.

#### Pruning the universal package on activation (`2026-10-16`)

**Updated (`2026-10-17`):** six platform directories now, not eight, and a
Linux host keeps its one directory — the gnu/musl pair is gone (see the
experiment record below). The rails are unchanged.

The universal VSIX (the 16.9 maintainer decision) installs eight engine
binaries, about 50 MB on disk, of which a host can load at most two. The
extension now deletes the others on activation
(`src/backend/engine/prune.ts`, wired Production-only in `activate()`).
The docs questions were checked first: VS Code has no post-install script
concept for extensions — the earliest extension code runs at activation —
and the Marketplace signature is verified when an extension is installed,
on the package, so removing unused files afterward triggers no
re-verification or reinstall; an update arrives as a fresh version
directory and the prune simply runs again. The sanctioned alternative,
platform-specific VSIXs (targets include `alpine-x64`/`alpine-arm64`, an
untargeted package is the fallback), was put to the maintainer with the
numbers and declined again in favor of the single file plus this prune.

Rails, each test-pinned: only the eight shipped directory names are
eligible; the loader's own candidate list is the keep set (Linux keeps
both libc builds of its architecture — the fallback is deliberate);
nothing is deleted unless a kept directory actually holds the binary;
all failures are swallowed. Production-only matters: a development host
runs from this repository, where the same path holds the developer's own
built binaries. A shared or portable extensions directory used from
another OS loses that side's binary and degrades to the CLI until the
next update — accepted and recorded here.

**Shipping musl-only for Linux does not work, measured.** The zig-built
musl binary is dynamically linked against `libc.so` (the musl soname);
on a glibc host that name resolves to glibc's text linker script and
`require()` fails with `/usr/lib/libc.so: invalid ELF header`, while the
gnu build loads (`engineVersion()` `1.0.25`). A fully static musl rebuild
could in principle dlopen under glibc, but two libcs in one process
(static TLS budget under Electron, musl's allocator in the engine's
parallel walks) would need its own parity and benchmark evidence to save
roughly one binary per Linux install; not pursued. The other route — one
binary that binds whichever C library the process already has — is
measured in the next record.

#### Experiment: one Linux binary for both C libraries (`2026-10-16`)

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

#### Risks to decide before 16.5, not during

- **Ordering within a window.** The engine orders exactly within a window that
  is a multiple of the page, not over the whole history. On a branchy
  repository this can differ from `git log`. If it does, `loadCommits` may
  have to stay CLI and the phase loses most of its value — so measure this
  early, in 16.4 or a spike, rather than discovering it in 16.5.
  **Resolved in 16.5:** measured late but decisively — date and author-date
  agree byte for byte on a 433-commit branchy history past the 256-commit
  window floor, so the window never materialized. Topo diverges for a
  different reason (depth-first lines versus git's date-interleaved lines)
  and stays CLI by decline, which moots the window question for it too.
- **Devcontainers and remote.** This project advertises "Works in remote and
  container environments". The addon must match the *remote* platform, which
  per-platform VSIXs handle for the targets that are built and nothing else.
  Alpine-based devcontainers fall back to the CLI and must be tested doing so.
- **`engineVersion()` skew.** A `.node` from a different build than the
  TypeScript expects must be detected and refused into the CLI path, not
  trusted.
- **Two identities in the engine's history.** Whether `penghongxia` and
  `neophack` are one person is unresolved; it affects nothing technical but
  the rosters record both as the history has them.

## Roadmap: open phases

Phases that still have open items, in phase order. The status table in
Implementation Roadmap summarizes them, and each phase's `Status:` line names
what remains. When a phase's last item lands, move it to Roadmap: completed
phases.

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

**Status: partially complete** — issue linking, repo config export/import sharing (`7a18099`), ref archives (`b4d97fe`), commit signature status, and tag signature status (Phase 15, `2026-07-29`) are done. Remaining: markdown/emoji message rendering, inline commit body, `.mailmap` support, code-review state, and file encoding setting. The uncommitted-changes details view landed as the staged/unstaged drag-drop staging panel (`2026-09-07`), released as `1.5.0`.

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

## Roadmap: completed phases

Finished phases, in phase order, kept as the record of what each one
planned and how it was built. The status table in Implementation Roadmap
summarizes them.

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

### Phase 7: Stash Management

**Status: complete** — stash data loading (behind the per-repo toggle), the apply/pop/drop/branch/stash-uncommitted action suite (`6750480`), the stash list panel above the table, and graph stash rows beside their base commits are all done.

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

## Upstream review (`2026-07-29`)

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

## Submodule discovery (`2026-08-21`)

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

### Merged as PR #1, released as `1.4.2` (`2026-09-03`)

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

## Upstream review, second pass (`2026-08-25`)

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
| _(no branch — applied directly)_ | `750f96f` | Release workflow publishes with the official `vsce` CLI (`vsce publish --packagePath --skip-duplicate`, `VSCE_PAT`) instead of the third-party `HaaLeo/publish-vscode-extension` action; sub-actions pinned to exact releases | Applied on `2026-08-25` at maintainer request. **Open VSX deliberately not taken** — upstream's companion `ovsx publish` step and its `ovsx` dependency are excluded; this project publishes to the VS Marketplace only. **Reversed on `2026-09-17`; see "Open VSX restored as a publish target" below.** `pnpm-workspace.yaml` was left alone: upstream's `allowBuilds` rewrite is a pnpm-config change, and our `onlyBuiltDependencies` list already covers the live `@vscode/vsce-sign`/`keytar`/`esbuild` builds. |

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

## Upstream review, third pass (`2026-09-03`)

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

## Pull request review — #4 and #5 (`2026-09-05`)

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

## Uncommitted-changes staging panel, released as `1.5.0` (`2026-09-07`)

The staging panel closes the "uncommitted-changes details view" item Phase 10
had been carrying. What is durable about it:

- **It is the commit details row wearing a different face.** The panel is
  inserted as the same `#commitDetails` element (plus an `uncommittedDetails`
  class), and its Staged/Unstaged panes take the summary and files pane ids, so
  collapse styling, the resize handle, the height clamp and the graph's
  row-height math are inherited rather than duplicated. The price is that only
  one of the two panels can be open at a time, which is why every entry point
  hides the other first, and why `detailsHeightOwner()` can treat "whichever is
  open" as a selection rather than a precedence rule. Do not give the panel its
  own ids without also giving it its own copies of all of that.
- **The panel re-queries instead of patching.** A staging action is followed by
  the ordinary refresh, and `restoreUncommittedDetails()` re-sends
  `uncommittedDetails` after the table is rebuilt — that is what makes the
  panes show the result of the `git add`/`git reset`, and it is also what
  closes the panel when the working tree comes out clean.
- **The drag payload is `"<section> <uri-encoded path>"`.** The space separator
  is only safe because the renderer percent-encodes the path: real worktree
  paths contain spaces, and `-z` status output hands them over unquoted. Change
  both ends together or use a different encoding.
- **`--untracked-files=normal` is deliberate.** Git collapses a wholly
  untracked folder into a single `sub/` entry, and staging that row stages the
  folder (verified: `git add -- sub/` stages every file under it). `all` would
  flatten a fresh source tree into hundreds of rows without offering any choice
  the single row does not.
- **`git reset HEAD -- <paths>` is safe on an unborn branch.** Verified against
  git 2.55: unstaging the very first `git add` in a repository with no commits
  returns the file to untracked rather than failing on an unresolvable `HEAD`,
  so the unstage path needs no special case for a fresh repository.
- **The telemetry signal comes from a query route, not the load path.** Opening
  the panel is not a commit load, so `createViewFeatureReporter()` gained
  `recordUncommittedDetailsOpened()` and the `uncommittedDetails` route calls
  it. That keeps the third chokepoint the only place view features are
  reported, and the once-per-session rule and the fixed-id-only payload are
  unchanged — `msg` carries the repository path and never reaches the reporter.

**`1.4.3` was prepared but never released, and `1.5.0` is what shipped.** The
version was bumped and a dated `1.4.3` changelog section written on
`2026-09-06` (in `eb20a0a`, whose own message records that Sonar, `test:ext`
and graphify could not run in its sandbox and had to be re-run before release),
and a `1.4.3` analysis followed on the morning of `2026-09-07`. No tag, GitHub
release, or Marketplace version ever carried it. At release time the maintainer
chose `1.5.0`, so that section and the staging work were folded into one
`1.5.0` entry: the staging panel is a new feature, which makes the whole delta
since `v1.4.2` a minor rather than a patch, and a dated `1.4.3` section whose
`v1.4.2...v1.4.3` compare link 404s would be worse than one honest release
entry. Do not look for a `v1.4.3` tag — the sequence is `v1.4.2` → `v1.5.0`.

**The toolchain moved to pnpm 12 in the same line of work**, and it reverses a
narrower note from the `2026-08-25` upstream review. `package.json` pins
`pnpm@12.3.4` and `pnpm-workspace.yaml` now uses pnpm 12's `allowBuilds` map in
place of `onlyBuiltDependencies`; the lockfile carries the
`packageManagerDependencies` block pnpm 12 writes for a pinned package manager.
That block was described in `3e3ed75`'s message as an "unreviewed pnpm 10
lockfile migration" to be dropped, but **that commit's diff is the
`allowBuilds` rewrite, not a lockfile revert** — the message and the content
disagree, and the block is still there on purpose. It belongs there:
`pnpm install --frozen-lockfile`, which is exactly what the release workflow
runs, passes against this tree under pnpm 12.3.4. The earlier "leave
`pnpm-workspace.yaml` alone" decision was about pnpm 10, where
`onlyBuiltDependencies` was the current key.

Verification (`2026-09-07`), release gate for `1.5.0`:

- `git fetch --all --prune`; `AI-dev` was ahead of `origin/main` by six commits
  and a strict fast-forward, so the release is `main` moved to that exact
  commit and tagged, per the branch and release policy.
- Documentation pass over the new code before the gate: `src/backend/actions/stage.ts`
  had no comments at all (it now records why `--` is load-bearing, why a literal
  `--` path is rejected, and that the unstage path is safe on an unborn branch);
  `parseStatusEntries()`'s JSDoc was attached to the `UNMERGED_PAIRS` constant
  that had been inserted between it and the function, so it documented the wrong
  declaration; and the panel's non-obvious contracts in `src/webview/main.ts`
  (the `#commitDetails` id reuse, the re-query-not-patch refresh, the
  `"<section> <uri-encoded path>"` drag payload) were undocumented.
- Three empirical checks behind those comments, against git `2.55.0`: rename
  records really arrive as `RM new\0old\0`; `--untracked-files=normal` collapses
  a wholly untracked folder to one `sub/` row and `git add -- sub/` stages every
  file under it; `git reset HEAD -- <path>` unstages the first ever `git add` in
  a repository with no commits instead of failing on `HEAD`.
- Strict Biome (`check`, lint + format + import order, warnings as errors) over
  all 23 touched/new TypeScript files: three findings, all in the new code and
  all mechanical — import order in `src/extension/messageHandler.ts` and
  `tests/webview/uncommittedDetailsView.test.ts`, formatting in
  `tests/webview/uncommittedDetails.test.ts`. Fixed, re-run clean. Note the
  whole-tree `pnpm run lint` (migration config) passed on all three before the
  fix: it does not carry the import-order assist, so it is not a substitute for
  the strict config on new files.
- `pnpm run package` (typecheck, whole-tree lint over `235` files, production
  builds) passed.
- `pnpm run test`: backend `56` files / `443` tests, webview `47` files /
  `460` tests.
- `pnpm run test:ext`: both launches green (exit `0`), including the non-git
  workspace launch that guards BUG-5.
- `pnpm run l10n:check`: `100%` package and bundle coverage for all five
  languages (`96` package keys).
- `pnpm run test:coverage`: `103` files / `903` tests, raw LCOV line coverage
  `92.6%` (`5,721`/`6,175`).
- `pnpm install --frozen-lockfile` — the release workflow's own install step —
  passes under pnpm `12.3.4` against this tree.
- `graphify update .` + `graphify tree` rebuilt the tracked map at `2,441`
  nodes / `5,731` edges / `150` communities, closing the refresh `eb20a0a`
  deferred.
- SonarQube, two analyses and both `ZAM` **`OK`** — read them together, because
  each one's window covers only part of the release:
  - `b89d1e18-afa2-43c7-8153-50bda2cc6bbc` (labelled `1.4.3`), window
    `Previous Version` `1.4.2`: this is the analysis that measured the whole
    release — `new_coverage` `93.0`, `new_violations` `0`,
    `new_duplicated_lines_density` `0.0`, `new_software_quality_high_issues`
    `0`, maintainability rating `1`, reliability and security issues `0`.
  - task `dc7e485e-9315-41af-af83-d11a601daa3b`, analysis
    `658a233c-b8e9-4d60-aa67-be1681de1886` (labelled `1.5.0`), window
    `Previous Version` `1.4.3`: the documentation pass and Biome fixes above —
    `new_coverage` `100.0`, `new_violations` `0`, duplication `0.0`, and the
    same four project-wide conditions clean.
- Known gap, unchanged and pre-existing: `pnpm run format` reports drift in
  eight files this slice did not touch (`.vscode/settings.json`,
  `src/extension/webviewLanguages.ts`, `tests/backend/avatarManager.test.ts`,
  `tests/backend/diffDocProvider.test.ts`,
  `tests/backend/telemetry/language.test.ts`,
  `tests/webview/telemetryConsentPrompt.test.ts`,
  `tests/webview/utils/dom.test.ts`, `tests/webview/webviewPanel.test.ts`) —
  one fewer than the `2026-09-03` list, since `src/extension/webviewHtml.ts`
  was formatted in the stylesheet split. Still left for a dedicated cleanup
  slice; `pnpm run package` does not run the formatter, so it blocks nothing.

## Graph and stash UI slices (`2026-09-09`)

Maintainer-prioritized work, taken in slice order: checkbox appearance,
remote sub-label restyle, stash-list move out of the footer, then
stashes as graph rows (closing Phase 7's remaining item). Two follow-ups
landed on top: a per-repo choice of where stashes appear, and a
create-branch checkout default. Behavioral write-ups were approved by the
maintainer before code was written, with both the `#stashList` panel and the
graph stash rows staying (neither surface replaces the other).

**The stash-list placement moved twice, and its scroll behavior was settled
separately.** It sits inside `#topBar`, in a `#stashListSlot` between the
status strip and the toolbar. It was first put at the top of `#content`
specifically to dodge the sticky-offset cost, and the maintainer rejected
that: the list belongs with the window chrome, not floating above the table
headers.

**It folds away on scroll rather than holding position** (`#topBar.scrolled
#stashListSlot`), mirroring the readiness strip. The rule to carry forward is
which chrome earns permanent space: the **toolbar** and the table's **column
headers** must stay reachable at any scroll position, while the stash list is
reference rather than navigation and yields its band as soon as the user
scrolls. An intermediate version kept it pinned; that was rejected. Note
`overflow: hidden` is load-bearing in the fold — without it the panel's own
margins survive `height: 0` and leave a live ~12px band behind.

That cost is now paid deliberately, and it is the thing to preserve.
`#topBar` is measured by the `ResizeObserver` in `observeTopBarHeight()` and
published as `--ngg-sticky-top`, which `media/table.css` consumes for the
sticky header's `top` and for `scroll-margin-top`. The observer only reacts a
frame later — long enough for the header to visibly detach — so
`renderStashSection()` and `clearStashSection()` both call
`publishTopBarHeight()` synchronously after touching the slot, the same fix
the find widget needed on `2026-07-03` (Phase 12). `#stashListSlot:empty` is
`display: none` for the same reason: residual padding in an empty slot would
push the sticky header down by that much.

Two parts of this record still bind later work and are kept elsewhere:
its license review under Licensing, and the headless way to verify
webview visuals under Webview UI Styling Guide.

### Slice 1 — Checkbox appearance

One shared rule set in `media/checkbox.css` (wired into `webviewHtml.ts` and
the CSS test helper alongside the other links) covers every checkbox in the
webview — dialog forms, settings hub, toolbar — so the box, tick, and states
stay identical everywhere. Each site keeps its native
`input[type="checkbox"]`, restyled with `appearance: none` plus a themed box
(`--vscode-checkbox-background` / `--vscode-checkbox-border` with `--ngg-*`
OKLCH fallbacks, 3px radius): a neutral box whether set or unset, a clipped
`::after` check mark in `--vscode-button-foreground`, hover feedback,
`:focus-visible` ring on `--vscode-focusBorder` at `outline-offset: 2px`,
`:disabled` dimming, and `forced-colors` / `prefers-reduced-motion`
counterparts. Only the box size lives outside the shared selectors (dialog
alignment/margin, toolbar 14px; dialog and settings share the 16px box). The
Webview UI Styling Guide checkbox line was rewritten to describe this
pattern. CSS regression coverage in `tests/webview/dialogStyles.test.ts` and
`tests/webview/tableStyles.test.ts`.

**Two defects were found in this slice after it was first written, and both
are worth not repeating.** The maintainer reported the result as looking
strange, and the cause was not subtle once the CSS was read against the
rendered control:

- **The record and the stylesheet disagreed.** The paragraph above originally
  described an accent fill on `:checked` that the stylesheet never carried —
  there was no `:checked` rule at all, only `:checked::after` for the tick.
  Treat a styling record as a claim to verify, not as evidence. The fix,
  though, was **not** to add the fill: an accent-filled box was implemented,
  shown to the maintainer, and rejected as far too loud at this size. The box
  is neutral by design and the tick carries the state; what actually needed
  fixing was the tick's shape and contrast.
- **The resting box ignored VS Code's checkbox tokens**, using the repo's
  generic grey overlays directly, so it looked foreign beside native
  controls. The tokens are now the primary source with the OKLCH neutrals as
  fallbacks, per the styling guide's own token-first rule.

The tick was also rebuilt: it is one `::after` shape clipped with
`clip-path: polygon(...)` in percentages rather than a rotated border. The
percentage clip scales with the box, which deleted the toolbar's separate
tick metrics — the compact variant previously carried its own hand-tuned
`left`/`top`/`width`/`height`, a second set of numbers that could drift from
the first. `:indeterminate` was added in the same pass and shares the set-box
fill with a bar-shaped clip. A regression test pins that no per-site tick
override exists.

Verification: focused vitest (`dialogStyles`, `tableStyles`: 44 passed),
strict Biome over the touched files (clean after one formatting fix). The
tick polygon was additionally rasterized off-tree and inspected by eye before
committing, since the defect being fixed was one that only shows up rendered.

Gate evidence: covered by the release gate of `2026-09-09` recorded at the
end of this section (one gate over the completed six-commit tree).

### Slice 2 — Remote sub-label restyle

Appearance only; `groupCommitRefs()` already emits one abbreviated segment per
remote with the full ref in the tooltip, so no grouping-logic change was
needed. In `media/refs.css` the `.gitRefGroup > .gitRefAlias` divider changed
from the neutral heavy border to the badge foreground at 30% via
`color-mix(in oklab, …)`; fill, text, hidden icon, tooltips, and the
border-only active distinction are untouched. Contrast re-verified with an
independent script (kept outside the repo): Light Modern 6.98:1, 2026 Light
5.39:1, Light+ default 7.24:1 — all ≥ AA, reproducing the BUG-4 numbers
exactly since the fill/text pair did not move. New CSS regression tests pin
the badge token chain, the oklab-only divider, the hidden alias icon, no
`color` on `.gitRef`/`.gitRefGroup`, no `font-weight` on the active rules,
and no `in srgb` mix anywhere in the webview bundle; the existing
`rendering.test.ts` group test already pins abbreviated labels, full-ref
titles, and per-alias actions.

Verification: focused vitest (`dialogStyles`, `tableStyles`, `refLabels`,
`rendering`: 121 passed), strict Biome over the touched test file (clean;
CSS is not counted by the strict config).

Gate evidence: covered by the release gate of `2026-09-09` recorded at the
end of this section (one gate over the completed six-commit tree).

### Slice 3 — Stash list above the table

`renderStashFooter()` became `renderStashList()` (same section HTML, same
`#stashList` id, `aria-label`, `.stashRow` markup, and `data-stash-ref` /
`data-stash-hash`), and `renderStashSection()` writes it into
`#stashListSlot` inside `#topBar`, between the status strip and the toolbar.
`renderLoadMoreFooter()` now renders only the load-more control; the loading
and error paths call `clearStashSection()`, since the list is outside both
the table and the footer and emptying either no longer covers it. The
`showStashes` gating is unchanged (it flows through the loaded stash data).
Both slot writers republish the sticky offset synchronously — see the
placement note at the top of this section.

One adjacency the move out of the footer required, and it still holds:
`#commitGraph` is an overlay pinned at the content top while its dot math
starts at the table header, so `renderGraph()` re-pins the canvas `top` to
the table's `offsetTop` on every render, and show/hide and count changes
self-correct with no observer. Rendering tests assert the slot, its two
siblings in `#topBar`, that neither `#content` nor `#footer` contains the
list, and listeners firing after a re-render.

**The webview body markup is duplicated in `tests/webview/setup.ts`.** Adding
`#stashListSlot` to `webviewHtml.ts` broke three tests until the fixture was
updated to match. Any change to that body structure needs both.

Verification: `pnpm run typecheck` clean; focused vitest (`rendering`,
`tableStyles`: 99 passed); strict Biome over `src/webview/main.ts` and both
touched test files (clean).

Gate evidence: covered by the release gate of `2026-09-09` recorded at the
end of this section (one gate over the completed six-commit tree).

### Slice 4 — Stashes as graph rows

**A `stroke` set from `graph.ts` loses to CSS, and it hid the stash ring
entirely.** `setAttribute("stroke", color)` produces a *presentation
attribute*, which ranks below every CSS declaration, and
`#commitGraph circle:not(.current)` in `media/table.css` paints every node's
stroke in `--vscode-editor-background` as a halo. The stash ring's stroke *is*
the marker, so it was being repainted background-on-background: only the inner
dot ever rendered, which is what "the ring and dot doesn't look properly"
turned out to be. The ring now carries a `stashRing` class, the halo rule
excludes it (`:not(.current):not(.stashRing)`), and a CSS regression test
pins both halves — the exemption and the absence of any `stroke` of its own
in that rule. **The class and the exemption must travel together.** The same
trap applies to any future node that needs its own stroke color.

The marker's proportions were then set from what survives at the default row
height rather than by eye in isolation: ring radius `NODE_RADIUS`, band `2`,
dot radius `NODE_RADIUS - 2`, so the outer edge lands at 5 and the marker is
only slightly wider than a commit dot. Two rejected attempts are worth
knowing: a `1.5` band smeared band, gap, and dot into one shape (each landed
on roughly one device pixel), and a `NODE_RADIUS + 1` ring left the dot
floating in too large a hole. Candidates were rasterized at 1:1 and compared
against a plain commit dot before choosing — a zoomed rendering flatters a
10px marker and will mislead you.

Closes Phase 7's remaining item (Phase 7 `Status:` and the overview table
both move to Complete in this slice). Both stash surfaces stay on purpose:
the `#stashList` panel is the compact action surface (every stash in one
place, keyboard-operable list), while graph rows show each stash in context
beside the commit it was taken from. Either surface alone would lose
something — the panel has no base-commit context, the rows only appear when
their base is on the page.

Data flow (backend injection, not webview merge): the stash query moved into
a shared `src/backend/queries/stashes.ts` used by both `loadRepoInfo` and
`loadCommits`. The query format gained `%P`, so each `GitStash` carries
`sourceHash` (parent 0) at no extra git cost; a repository with no stash
answers exit 0 with an empty list. `loadCommits` takes an opt-in
`showStashes` (absent means off, so existing callers are unchanged),
plumbed from the webview's per-repo toggle through the `loadCommits`
message — no new setting, no settings-plumbing change. Injection runs after
paging: one synthetic `GitCommitNode` (`stash: { ref }` marker, empty
author/email, base-or-stash date, `signature: null`) spliced directly above
its base commit, linking parent 0 only. Above, not below: the layout walker
only follows parents forward (children above parents), so a stash placed
after its base never resolves its parent and the layout loops forever. The index and untracked parents are
deliberately excluded — linking them would draw phantom lines per stash and
promote internal commits to ordinary rows. Stashes whose base is filtered
out or paged off are skipped, and stash rows never consume the commit
budget. A stash-query failure degrades to no rows rather than a failed
graph. Rows and their selectors come from the same backend load, so the
selector in `data-stash-ref` is always fresh — nothing caches `stash@{n}`
across refreshes.

Webview: `renderStashGraphRow()` emits `tr.stashGraphRow` (never the
`commit` class) with badge, message, date, hash, and an unsigned signature
cell. Click/Enter/Space opens the read-only commit details through the
existing panel path (inheriting the one-panel constraint); right-click
reuses `buildStashContextMenu()`. Find matches selector, message, and hash
(`commitFind` gains the selector field; full-history search is unchanged —
it operates on git log history, which never contains stashes). ArrowUp/Down
details stepping, reveal, and details restore reach stash rows via
`findAnyRowByHash()`; range selection skips them and they can never enter
the selection set, so multi-select and compare are untouched. The layout
engine draws each row as a ring-and-dot pendant in the branch color
(`Vertex.setStash()`); row hover, focus, details-open tint, find highlight,
blink, mute, and scroll-margin selectors cover the new class with the same
BUG-4 scoping (message span only, no `color` on ref selectors, no
font-weight, oklab mixes only). No new user-facing strings, so l10n is
untouched. Telemetry: `view.stashRows` reported once per session from the
commit-load chokepoint only when a load actually contains a stash row;
`telemetry.json` and the README disclosure updated in the same slice.

Git facts, all reproduced against real scratch repositories (kept outside
the repo): default `git log` (HEAD/branches) excludes stash commits while
`--all` includes them; a `-u` stash has three parents (base, index,
untracked) and a plain stash two; empty `git stash list` exits 0; dropping
`stash@{1}` renumbered the old `stash@{2}` hash to `stash@{1}`, confirming
selectors must be re-resolved per refresh.

Verification: backend `stashRows` (4 passed, real repositories: injection
above base with base-only parents, no index/untracked phantoms, opt-in
gating, base-off-page skip, drop-and-renumber re-resolution),
`loadRepoInfo/get` (6 passed), `viewFeatures` (stash signal + id pattern);
webview `rendering` (75), `tableStyles` (25), `dialogStyles`,
`commitFind`, `graph` (ring-and-dot) — 129 passed across the five files;
`pnpm run typecheck` clean; `pnpm run l10n:check` 100% (no new strings);
strict Biome over all touched files (clean after two format-only fixes).

Gate evidence: covered by the release gate of `2026-09-09` recorded at the
end of this section (one gate over the completed six-commit tree).

### Follow-up — where stashes appear, and a checkout default

Two additions on top of the four slices, both through the standard setting
plumbing (manifest, five `package.nls*.json`, `src/config.ts`,
`src/types.ts`, `webviewHtml.ts`, `global.d.ts`, the webview config switch
plus constructor literal, README):

- `repository.stashDisplay` (`"table"` / `"graph"` / `"both"`, default
  `"both"`) chooses which stash surface is shown. It is **scoped by**
  `repository.showStashes` rather than replacing it: the boolean still gates
  whether stashes load at all, so switching it off hides both surfaces
  regardless of this value. Keep that nesting — a three-way display mode that
  could resurrect stashes a user had switched off would be a surprise.
- `dialog.createBranch.checkout` (default `true`) pre-checks "Check out" in
  the create-branch dialog. The backend does the create and the checkout as
  two steps (`branch` then `checkout`) rather than `checkout -b`, so a failed
  checkout still leaves the branch created — which is the recoverable
  outcome, and the one the dialog's own error path already reports.

### Follow-up — staging catalogue view, and two rendering fixes

**The uncommitted panes render a folder tree.** `src/webview/utils/pathTree.ts`
is a new pure module that groups flat `a/b/c.txt` paths into folders, with
optional compaction of single-child chains and a `collectLeafPaths()` used by
the folder drag. It deliberately does **no** rendering: commit details and the
staging panes need the same grouping but very different rows, so only the
grouping is shared. `commitDetailsView.generateGitFileTree()` still has its own
older builder — migrating it onto `pathTree` is a follow-up, not done here
because its per-folder open state and leaf renderer are entangled with its
markup, and that is a commit-details slice rather than a staging one.

Three contracts worth keeping:

- **A folder drag carries every descendant path, not the folder path.** The
  payload grew from `"<section> <path>"` to `"<section> <path>..."`, and the
  drop handler now accepts two-or-more fields. Handing git the folder itself
  (`git add -- dir/`) would also sweep in changes the pane is not showing —
  the other section's changes to the same folder, for one — so the descendants
  actually on screen are listed explicitly. The space separator is still only
  safe because every path is percent-encoded; that has not changed.
- **Folder collapse state lives in the view state, keyed by path.** Every
  staging action re-queries and re-renders the panel, so DOM-held state would
  reopen every folder on each drop. Toggling is applied in place rather than by
  re-rendering, because a re-render needs another round trip for the change
  list and the row heights feed the graph's expansion.
- **A file row inside a folder row is also draggable**, so the folder's
  `dragstart` ignores events whose target is not the folder itself. Without
  that guard, dragging one file stages the whole subtree.

**Two rendering bugs fixed in the same pass**, both recorded in detail in the
Slice 3 and Slice 4 notes above: the graph did not expand for the uncommitted
panel (it keyed off `expandedCommit`, which the panel does not have), and the
stash ring was repainted invisible by the halo rule because a presentation
attribute loses to CSS.

### Follow-up — list/tree toggle, and the stash-branch dialog

**`uncommittedChanges.fileViewMode`** (`"tree"` | `"list"`, default `"tree"`)
switches the staging panel between the folder tree and the flat list it had
before. It is a **separate setting from `commitDetails.fileViewMode`**
deliberately: the two views are read in different situations, and one is a
staging surface where a folder row is draggable while the other is not. The
toggle is a checked item on the uncommitted-changes context menu, which is
where this project already puts view options, and it writes the global setting
through `updateExtensionSetting` rather than holding view state — so the
choice survives a reload and appears in the settings hub for free. Flat mode
skips grouping entirely rather than flattening a built tree, so a flat list has
no folder rows to drag.

**Adding a required field to `GitGraphViewState` cost thirteen test fixtures**,
which is the standing tax the `2026-09-05` PR-review note predicted. Two of
them are worth knowing about because `tsc` cannot see them:
`tests/webview/telemetryConsentScreen.test.ts` builds its config mock with
`as unknown as Config` and failed at *runtime* with four broken tests after
typecheck was already green, and `tests/backend/config.test.ts` has no plain
literal to patch. The durable fix is still a shared view-state factory.

**`git stash branch` has no opt-out, and the dialog now says so.** Verified
against git `2.55.0` in a scratch repository: `git stash branch <name>` moved
`HEAD` from `main` to the new branch and dropped the stash. The maintainer
reported the missing "Check out" checkbox as a bug against the other
create-branch dialogs; it is not an omission, because a cleared checkbox could
not be honored without abandoning `git stash branch` altogether. The dialog
gained a `note` input — the same affordance BUG-3 added for lightweight tags —
stating that git checks the branch out and drops the stash. A rendering test
pins both the absence of a checkbox and the presence of the note, so a future
"fix" cannot quietly add a control that does nothing.

### Release gate for these slices (`2026-09-09`)

One gate over the completed tree covering all six commits, in the documented
order. The commits were already made when the gate ran — the slices were
committed before review rather than after, contrary to the standing rule — so
this is a gate on committed-but-unpushed work rather than on a clean working
tree. Nothing was pushed before it passed.

- strict Biome (`biome.strict.jsonc`, lint + format + import order, warnings
  as errors) over all touched files: clean, after one formatting fix in
  `tests/webview/rendering.test.ts` that the patch replay had introduced.
  Note both configs carry the same `lineWidth: 100`, so strict and whole-tree
  formatting do not disagree here.
- `pnpm run package`: typecheck (three projects), whole-tree `biome lint`
  over `241` files, and production builds — all clean.
- `pnpm run test`: `48` files / `499` tests.
- `pnpm run l10n:check`: `100%` bundle and package coverage for `nl`, `pl`,
  `zh-cn`, `zh-tw`.
- `pnpm run test:coverage`: `109` files / `977` tests, raw LCOV line coverage
  `92.9%` (`6,034`/`6,496`).
- `pnpm run sonar:scan`, task `f48436b6-303d-4622-99e2-f547982d995f`,
  analysis `3722726b-68fd-494b-85fe-c1330db6ba6a`: `ZAM` gate **`OK`** on all
  seven reported conditions (`new_coverage` `91.8`). Earlier passes were
  `42fa24ac`, `4a45bffb`, `2fed9d8d`, `2dd77b07`, and `55613d77` — `2dd77b07`
  **failed** on `new_software_quality_high_issues` `1`
  (`typescript:S7761`, `getAttribute("data-id")` where `.dataset` belongs, in
  the new `expandedRowId()` helper). Fixed and rescanned; note the gate treats
  that rule as HIGH maintainability impact, so it fails the build rather than
  counting against the `new_violations` budget — `new_coverage` `92.6`,
  `new_duplicated_lines_density` `0.0`, `new_violations` `0`,
  `new_software_quality_high_issues` `0`,
  `software_quality_maintainability_rating` `1`, and project-wide reliability
  and security issues `0`. Window `PREVIOUS_VERSION` `1.5.0`. The eighth
  condition (`new_security_hotspots_reviewed`) was not reported because
  `/api/hotspots/search?inNewCodePeriod=true&status=TO_REVIEW` returns `0`.
- `graphify update .` + `graphify tree`: map rebuilt at `2,517` nodes /
  `5,864` edges / `155` communities.
- `sonar.projectVersion` was **deliberately left at `1.5.1`**, so this
  analysis measures against the `1.5.0` baseline and covers the whole
  delta. Advancing it is a maintainer decision about opening a new analysis
  epoch and has not been taken.

### Release `1.6.0` (`2026-09-10`)

Sixteen commits since `v1.5.0`. Stash graph rows, the staging folder tree with
folder drag-staging, two new settings, the dialog control system, and the
locked-control pattern — a minor, and it closes Phase 7's remaining item.

**`1.5.1` was prepared but never tagged, so it folded into this release.**
This is the second time (see `1.4.3` above), and the handling is the same: one
honest dated section rather than a `1.5.1` heading whose
`v1.5.0...v1.5.1` compare link would 404. The link-reference block was
updated too — the stale `[1.5.1]` entry pointed at a tag that will never
exist. **Check that block whenever a prepared version is skipped**; the
section heading is the obvious half and the links are the half that gets
missed. Do not look for a `v1.5.1` tag: the sequence is `v1.5.0` → `v1.6.0`.

**Two telemetry signals ship with it**, both through
`createViewFeatureReporter()` and both once per session:
`view.stashRows` (added with the graph rows) and the new
`view.uncommittedTree`. The second fires only when the panel *actually* drew a
folder tree — tree mode selected **and** a change in a subdirectory — because
tree mode over root-level changes renders a flat list either way, and
reporting that would count intent rather than use. `grouped` is computed in
the `uncommittedDetails` route rather than inside the reporter, so no path
crosses into the telemetry module; the payload stays the fixed id.

**A limitation worth knowing before someone reads these numbers:** folder
drag-staging is *not* separately measurable. It sends the same `stageFiles` /
`unstageFiles` commands as a single-file drag, and distinguishing them would
mean either a new command invented for telemetry's sake or a call outside the
three chokepoints. `view.uncommittedTree` says the tree was shown; the drag
itself is inferred from that plus the action counts.

Release gate over the completed tree, all clean: strict Biome (one formatting
fix in `messageHandler.ts`), `pnpm run package`, `pnpm run test` `48` files /
`500` tests, `pnpm run l10n:check` `100%` for all four locales,
`pnpm run test:coverage` `109` files / `979` tests at `92.9%` lines
(`6,040`/`6,502`), and `pnpm run sonar:scan` task
`be1392ab-99e1-466e-823d-24b7183fa873`, analysis
`44a5b83d-2389-4f26-b6d1-7e3d2498e376`: `ZAM` gate **`OK`** on all seven
reported conditions — `new_coverage` `91.1`, `new_violations` `0`,
duplication `0.0`, window `PREVIOUS_VERSION` `1.5.1`.

The remote-grouping change landed *after* the first release gate, so the tag
was moved to the final commit and the gate re-run each time; earlier passes
were tasks `62558a8f-8c00-4d74-85d2-7256c6a7a405` and
`ac35cff7-cee1-41d8-96b0-774ba0e8d26d`. Moving a tag is only safe because
nothing had been pushed — once a tag is published, move it and you have
changed what a released version means.

`sonar.projectVersion` advanced `1.5.1` → `1.6.0` with the package version, so
this analysis measures the whole delta since the last analyzed version and the
next one starts a fresh window.

**The tag was created without pushing, at the maintainer's explicit request.**
`main` has *not* been fast-forwarded and nothing is on the remote, so the
branch-and-release policy's final steps are still outstanding: fast-forward
`main` to this commit, then push the branch and the tag to let the Marketplace
workflow run.

## Open VSX restored as a publish target, released as `1.6.1` (`2026-09-17`)

**Maintainer reversal of the `2026-08-25` decision.** The release workflow
publishes to Open VSX again, so releases reach VSCodium, Cursor, Gitpod and
Eclipse Theia as well as the VS Marketplace. Open VSX was this project's own
second target until `3be16fc` (`2026-07-25`) collapsed the two-entry
`HaaLeo/publish-vscode-extension` matrix to a Marketplace-only job; the
`2026-08-25` upstream review then recorded the exclusion as deliberate. Both
notes are historical now — do not re-propose dropping it without a new
maintainer decision.

What the restoration is made of:

- **`ovsx` is a devDependency** (`^1.2.0`), so the CLI version is pinned by the
  lockfile exactly like `@vscode/vsce`. Do not switch this to `pnpm dlx`: an
  unpinned publisher is the thing the `2026-08-25` move off the third-party
  action was avoiding.
- **The secret keeps its historical name, `OPEN_VSX_TOKEN`** — the name
  `3be16fc` removed, and the one upstream uses. `ovsx` itself reads the token
  from `OVSX_PAT`, so the step maps one to the other; they are not
  interchangeable.
- **Two token-check steps, not one.** `Check Open VSX token` mirrors
  `Check marketplace token` for the same reason that step exists at all: the
  `secrets` context is not available to a step-level `if`. Keeping them
  separate is what lets a release publish to one registry while the other's
  token is absent.
- **Both publishes take `--packagePath "$VSIX" --skip-duplicate`** against the
  single VSIX that `Package extension` built and the GitHub release carries, so
  the two registries cannot receive differently-built artifacts and a re-run is
  a no-op rather than a failure.
- **The steps are sequential, so a failing Marketplace publish skips Open VSX.**
  That is the existing workflow's shape, kept deliberately: `--skip-duplicate`
  makes re-running the whole job safe. If a registry outage ever makes that
  coupling expensive, the fix is an `if: !cancelled()` guard on the Open VSX
  step plus an explicit `steps.package.outcome == 'success'` condition — not
  `always()`, which would run it after a failed package step.

**The `PlohnenSoftware` namespace must exist and be claimed before the first
publish, and neither is the workflow's job.** Creating it is
`ovsx create-namespace PlohnenSoftware -p <token>` once; until a namespace has
an owner, Open VSX shows "This namespace is not verified" and a warning icon
instead of the shield. Ownership is granted by the Eclipse Foundation on a
public request issue at
`github.com/EclipseFdn/open-vsx.org/issues/new/choose`, which requires having
logged into open-vsx.org at least once and signed the Publisher Agreement. The
criteria exist to stop namespace squatting — an extension published on both
registries should come from the same person or organization — so the request
should link this repository and the Marketplace publisher page as evidence.
Publishing works while unverified; only the badge and banner change.

### Toolchain upgraded in the same change (`2026-09-17`)

`pnpm up --latest` on the maintainer's request. `@biomejs/biome` `2.5.5` →
`2.5.13`, `@primer/octicons` `19.31.0` → `19.36.0`, `@types/node` `26.1.1` →
`26.6.1`, `@vitest/coverage-v8` and `vitest` `4.1.10` → `5.0.1`,
`@vscode/vsce` `3.9.2` → `4.0.0`, `esbuild` `0.28.1` → `0.28.2`, `jsdom`
`29.1.1` → `30.0.1`, `tsc-alias` `1.9.1` → `1.9.5`. Three findings worth
keeping:

- **`@types/vscode` must not be upgraded past `engines.vscode`.** `pnpm up
  --latest` raised it to `~1.137.0` against `engines.vscode` `^1.98.0`, and
  `vsce package` refuses that outright: `@types/vscode ~1.137.0 greater than
  engines.vscode ^1.98.0`. That is the release workflow's first step, so the
  upgrade would have broken every release. It is pinned back to `~1.98.0`;
  raising it is only correct as half of a deliberate decision to raise the
  minimum supported VS Code, which drops users below that version.
- **`pnpm add <pkg>` upgrades every other dependency too** under pnpm 12.3.4 —
  it rewrote all nine specifiers in `package.json` while adding `ovsx`. Add a
  dependency by editing `package.json` and running `pnpm install
  --lockfile-only` when the intent is to add one thing. Running `pnpm` at all
  in this tree also drops the `@pnpm/exe` entries from the lockfile's
  package-manager document; they were restored by hand so the diff stays the
  dependency change.
- **The Biome config schema versions were stale** (`2.5.5` in `biome.jsonc`,
  `2.5.2` in `biome.strict.jsonc`) and are now both `2.5.13`, which clears the
  schema-version info that every `pnpm run lint` had been printing since
  `2026-07-27`.

Verification of the upgraded tree: `pnpm run typecheck` clean;
`pnpm run lint` clean (`243` files, no diagnostics at all now);
`pnpm run test` backend `61` files / `479` tests and webview `48` files / `500`
tests; `pnpm run l10n:check` `100%` for `nl`, `pl`, `zh-cn`, `zh-tw`;
`pnpm run package` clean; `pnpm run test:coverage` `109` files / `979` tests;
`pnpm run test:ext` both launches green (`58` + `1`, exit `0`);
`pnpm install --frozen-lockfile` — the release workflow's own install step —
passes; `pnpm exec vsce package --no-dependencies` produces a `263.58 KB`
VSIX under `vsce` `4.0.0`; and `pnpm exec ovsx publish --packagePath <vsix>
--skip-duplicate` was run without a token, which resolved the namespace and
stopped at the credential prompt, proving the invocation rather than
publishing anything.

Two knowns, neither caused by the upgrade:

- **`pnpm run format` still reports drift in ten untouched files** — the eight
  of the `2026-09-07` list plus `tests/webview/tableColumnResize.test.ts` and
  `tests/webview/webviewHtml.test.ts`. Verified identical under Biome `2.5.5`
  and `2.5.13`, so the upgrade added none of it, and whole-tree strict Biome
  reports the same `7` warnings under both versions.
- **Vitest 5 prints a Vite warning about `vitest.config.ts`**: ESM syntax in a
  file loaded as CommonJS, unsupported by the `configLoader: 'native'` that a
  future Vite major will default to. Renaming it to `.mts` is the documented
  fix but the file uses `__dirname`, which does not exist in ESM, so the
  rename has to come with an `import.meta.dirname` rewrite. Left as noise for
  a slice that can test it.

### Release gate for `1.6.1` (`2026-09-17`)

A patch release with **no change to the extension itself** — its whole purpose
is to put 1.6.0's feature set on the second registry, so the first Open VSX
version is one the Marketplace already carries rather than a fork-specific
build. `1.6.0` was live on the Marketplace at `194` installs when this started
and Open VSX had nothing.

Run in the documented order over the completed tree: strict Biome on the
touched JSON configs (clean), `pnpm run package`, `pnpm run test` (backend `61`
files / `479` tests, webview `48` / `500`), `pnpm run l10n:check` `100%` for
all four locales, `pnpm run test:ext` (both launches, `58` + `1`, exit `0`),
fresh `pnpm run test:coverage` (`109` files / `979` tests), then
`pnpm run sonar:scan` — task `3876e0c3-5df3-4b76-a254-95d630442a95`, analysis
`95f16d0c-d671-4322-a3cc-219bbdff8709`: `ZAM` gate **`OK`** on all seven
reported conditions — `new_coverage` `100.0`, `new_violations` `0`,
`new_duplicated_lines_density` `0.0`, `new_software_quality_high_issues` `0`,
maintainability rating `1`, reliability and security issues `0`. The eighth
condition was not reported because
`/api/hotspots/search?inNewCodePeriod=true&status=TO_REVIEW` returns `0`.

`sonar.projectVersion` advanced `1.6.0` → `1.6.1` with the package version, so
this analysis measures the whole delta since the last analyzed version.

## Pull request review — #8 and #9, released as `1.6.2` (`2026-09-22`)

Two pull requests from the same outside contributor (Arezim,
`Arezimt <arezimt@gmail.com>`), both branched on `main` and both green
on the `ZAM` gate as pushed. **One of them was still broken**, which is the
`2026-09-05` lesson repeating: the gate cannot see a comparison that is wrong
for paths no test exercises. Read the feature, not just the result.

### PR #8 — `commit.gpgsign` in the fetch-tags fixture

One line, correct, merged. The `fetchTags` test in
`tests/webview/messageHandler.test.ts` hand-rolls its own repository with
`cp.execFileSync("git", ["init", …])` instead of using `makeRepo()`, and set
only `tag.gpgsign false`. With the maintainer's global `commit.gpgsign true`,
its `git commit -m init` waits on a pinentry prompt.

**It does not weaken signature coverage, and the reason is worth knowing
before anyone else asks the same question.** The tests that exercise signing
never consult git's signing configuration at all — they synthesize signed
objects directly:

- `tests/backend/queries/loadCommits/signedTags.test.ts` writes a
  signature-bearing tag object with `git mktag` and points a ref at it with
  `update-ref`.
- `tests/backend/queries/loadCommits/unverifiedSignatures.test.ts` writes a
  commit carrying a `gpgsig -----BEGIN SSH SIGNATURE-----` header through
  `git hash-object -t commit -w --stdin`.
- `tests/backend/actions/tag/add.test.ts` sets `tag.gpgsign **true**` on its
  own repository on purpose, to prove BUG-3's `--no-sign`.

So no fixture's signing configuration can make a signature test pass
vacuously, and `git config` without `--global` cannot reach outside the one
`mkdtemp` directory it is run in. Follow-up not taken: that fixture should use
`makeRepo()` (`tests/backend/helpers.ts`), which sets both keys, rather than
hand-rolling a repository.

### PR #9 — repository discovery, right diagnosis and a broken comparison

The defect it reports is real, and was confirmed before anything was changed:
`checkIsRepo()` with no argument falls through to
`["rev-parse", "--is-inside-work-tree"]` in `node_modules/simple-git`, and a
probe against unmodified `main` showed a subdirectory of a repository
answering `true`. Discovery masks this because the top-down scan stops at the
first hit, but the workspace watcher calls the search directly on whatever
directory it just saw created.

The fix compared `git rev-parse --show-toplevel` against the queried path as
**raw strings**, and that is wrong in three ways that have nothing to do with
being different directories:

- **Symlinks.** `--show-toplevel` prints the *physical* path. Reproduced
  against git `2.55.0`: a repository opened through a symlink answered
  `false`, where the `checkIsRepo()` being replaced answered `true`. This
  project performs no `realpath` normalization anywhere — `grep -rn realpath
  src/` returns nothing — so there was no second line of defence.
- **Drive-letter case.** `getPathFromUri` is
  `uri.fsPath.replaceAll("\\", "/")`, and `Uri.fsPath` lower-cases the drive
  letter while git prints it as the filesystem stores it. `"C:/…" === "c:/…"`
  is false, so **every** repository on Windows would have failed the check.
- **Trailing separators**, for a path that arrived through `path.join` rather
  than `getPathFromUri`.

**Answering `false` here is not a harmless miss.** `isGitRepository()` backs
three call sites — `repoSearch.ts` (discovery), the not-a-repository answer in
`loadBranches`, and `repoManager`'s periodic "does this repository still
exist" validation — so a false negative removes the repository from the
dropdown *and* keeps it out.

Fixed in `e1668f9` with `canonicalizePath()`, applied to both sides.
It is exported rather than private because the Windows shapes are pure string
normalization and can only be covered from a Linux or macOS run by driving
them directly. Note also that the branch's own new tests would have **failed
on macOS**: `os.tmpdir()` lives under `/var`, itself a symlink to
`/private/var`.

**`typescript:S8786` caught a ReDoS in the fix itself, and this is its third
appearance.** The first version trimmed trailing separators with `/\/+$/`; a
`+` against an end anchor backtracks super-linearly, and these paths come from
whatever workspace the user opened. The gate came back **ERROR** on
`software_quality_reliability_issues` `1`. Replaced with a linear scan that
also keeps the filesystem root as `/`. The rule to carry forward: **no
quantifier-before-anchor regex on a path or a config line that came from the
user's disk** — it flagged the `.gitmodules` reader when PR #1 was merged
(`1.4.2`) and it flagged this.

Verification (`2026-09-22`), all three trees:

| Tree | strict Biome | `test` | Sonar task | `ZAM` | `new_coverage` |
| --- | --- | --- | --- | --- | --- |
| PR #8 as pushed | clean | 479 / 500 | `f6501c34` | `OK` | `100.0` |
| PR #9 as pushed | **FAIL** | 481 / 500 | `f3848b99` | `OK` | `100.0` |
| PR #9 + fix | clean | 488 / 500 | `12096efb` | `OK` | `100.0` |

`new_violations` `0`, duplication `0.0` and all four project-wide conditions
`0` on the first and third; the middle scan is the one whose gate passed while
the branch was broken. Windows `PREVIOUS_VERSION` `1.6.0` throughout, new
security hotspots to review `0`. `package`, `l10n:check` (100%, all four
locales) and fresh `test:coverage` (109 files / 988 tests on the fixed tree)
all passed.

The new coverage was confirmed by mutation: restoring the raw comparison fails
the symlink and trailing-separator cases.

**The strict-Biome failure on PR #9 was pre-existing on `main`** — the import
block of `tests/backend/utils/isGitRepository.test.ts` was already unsorted
and the branch added `node:path` into it. Whole-tree `pnpm run lint` passes
either way, because the migration config carries no import-order assist; that
is the `2026-09-07` note repeating. Fixed in the same push under the
touched-files rule.

### Two environment facts recorded while doing this

- **A Rust toolchain is now installed**: `rustup` from `pacman` with a stable
  toolchain (`rustc`/`cargo` `1.98.1`) in `~/.rustup`. `rustup` and the distro
  `rust` package **conflict** on Arch — `rustup` declares
  `Conflicts With: rust cargo rustfmt` and owns `/usr/bin/cargo` as a shim —
  so `rustup default stable` is the only way to make the installed package
  functional, and it is also the one that keeps `rustup target add` for
  cross-compilation.
- **`tests/backend/utils` has a latent flaky test**, unrelated to any slice
  that happens to hit it. `queries.rs`'s
  `a_bare_repository_has_no_upstream_and_no_submodules` (in the engine
  repository, see the next section) fails intermittently under load with
  `git clone --bare` reporting `fatal: unknown error occurred while reading
  the configuration files`. Cause: the `TestRepo` harness sets
  `.env("HOME", …)` on every git call **except** that one `git clone`, which
  therefore reads the real `~/.gitconfig`. The same shape of bug is worth
  checking for in this repository's own fixtures.

## Evaluating the Rust engine of `vscode-git-graph-rs` (`2026-09-22`)

The maintainer asked whether the Rust engine of
[`neophack/vscode-git-graph-rs`](https://github.com/neophack/vscode-git-graph-rs)
could be adopted, and whether that project's licensing is safe to build on.
Nothing has been adopted. This section is the record so the next attempt
starts from findings rather than a fresh survey.

The licensing verdict from this evaluation still binds all work, so it
is kept under Licensing.

### Should the engine be adopted? Not wholesale

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

### The filtered engine repository, merged onto `rusty` (`2026-09-22`)

The engine was extracted to `../git-graph-engine` and, once `1.6.2` shipped,
merged into this repository on the **`rusty`** branch with
`git merge --allow-unrelated-histories`. It lands entirely under `engine/`, so
the merge touched no existing path — verified before merging by intersecting
both trees, which returned nothing. Nothing in the extension reads it yet:
this is the history and the source arriving, not an integration.

What the imported history is, so nobody has to re-derive it:

- **52 commits**, filtered from the 154 of `611a8fa`…`f93e8b2`
  (`2026-08-22`…`2026-09-21`). The 49 that carried engine content keep their
  original authors and author dates — penghongxia (31), neophack (14),
  unusuallman (4); the other three are the maintainer's.
- **Every commit is signed and the committer is the maintainer.** Signing was
  done with `git filter-branch --commit-filter 'git commit-tree -S "$@"'`
  rather than a rebase, so the two merge commits survive.
- **Excluded from every commit, not merely from the tip**: the whole
  TypeScript extension layer, `native/core/src/gerrit.rs` and its test, the
  upstream root `LICENSE`, and the entire `licenses/` directory. Audited by
  walking every tree of every commit.
- **The imported commits keep the upstream directory layout**, deliberately,
  so any one of them can be diffed against `neophack/vscode-git-graph-rs` to
  verify exactly what was taken — confirmed by hashing `log.rs`, `status.rs`,
  `node/src/lib.rs` and `Cargo.lock` against their upstream counterparts. A
  single later commit re-homes the tree under `engine/`; `git log` on a moved
  file therefore needs `--follow` to reach back past it.
- **`engine/NOTICE.md`** carries what the removed licence files legitimately
  held: penghongxia's verbatim MIT copyright line and permission notice (which
  MIT requires be included in all copies), the provenance and authorship, the
  exclusion list with the Gerrit reasoning, and the crate-attribution
  obligation.
- Verified with the toolchain above: `cargo check --workspace --all-targets`
  clean with **zero warnings**, `cargo test --workspace` **101 passed, 0
  failed**.

**The licence paperwork landed in the merge commit itself**, not after it,
because the Mission section requires the roster and the boundary to move in
the same change as the material. `LICENSE.mit` gained penghongxia's copyright
notice verbatim, a paragraph stating that this last notice belongs to a
separate MIT work rather than to the Git Graph lineage, and a roster of the
three engine authors with their date ranges. `NOTICE.md` gained a
`### The Git engine (engine/)` subsection under the incorporated-MIT heading —
deliberately a sibling of `### The Git Graph lineage` rather than an item
inside it, since the engine does not descend from that lineage — recording the
boundary commits, pointing at `engine/NOTICE.md`, and stating what was
excluded and why. `package.json`'s `contributors` gained all three; only
`neophack` and `unusuallman` carry URLs, because `penghongxia`'s git identity
is a work email with no handle to link. **Whether `penghongxia` and `neophack`
are the same person is unresolved** — the former is the name on the upstream
`LICENSE`, the latter owns the repository — so both are recorded exactly as
the git history has them rather than merged on a guess.

No `CHANGELOG.md` entry: the engine ships nothing to users yet, and
`.vscodeignore` is deny-all plus a whitelist, so `engine/` is already excluded
from the VSIX. `sonar.sources` names `src,scripts,esbuild.js` as an explicit
list, so `engine/` stays outside analysis without a new exclusion, and Biome's
`includes` is likewise an allowlist that does not reach it. **The Rust side is
therefore covered by no gate in this repository** — `cargo check` and
`cargo test` have to be run by hand until a CI arm exists for them.

Shipping a compiled `git-graph.node` additionally requires
attributing the ~175 statically linked crates (`MIT OR Apache-2.0`, plus
`zlib-rs` under Zlib and a BSD-3-Clause component in `encoding_rs`), including
the Apache-2.0 §4(d) notice for binary redistribution; `cargo about generate`
produces that inventory.

**Layout decision, if it is merged**: under `engine/`, not at the repository
root. Beyond keeping the licence boundary a directory rather than a file list,
there is a concrete gate reason — `sonar.sources=src,scripts,esbuild.js` names
`scripts` as a directory, so a root-level merge would put the engine's
418-line `build-addon.mjs` (which calls `spawnSync(…, { shell: true })`, a
security hotspot) into analysis, where it would count against the gate on
whatever unrelated slice was scanned next.

## Root squares only for true roots (`2026-10-16`)

`Vertex.parents` holds *drawn* parents only — `Graph.loadCommits()` adds a
parent solely when its hash is in the loaded lookup — and the square test
was `parents.length === 0`, so every commit at the edge of the loaded
window (page boundary, filtered-out parents) rendered as a root. A vertex
now also records `hasParentBeyondGraph` for any non-empty parent hash the
lookup misses, and the square requires both no drawn parents and none
beyond the graph. Both backends normalize a truly parentless commit to
`parentHashes: [""]` (the CLI's `"".split(" ")`, the engine mapper
explicitly), which is what makes the test exact rather than a heuristic.
Lane assignment is untouched: it still runs on drawn parents alone, so a
boundary commit keeps its lane end and merely changes marker. Verified by
two new cases in `tests/webview/graph.test.ts` (the boundary case written
failing first) and a headless QtWebEngine screenshot of the real `Graph`
SVG: boundary circle, true-root square.
