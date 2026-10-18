# Graph Report - .  (2026-10-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3927 nodes · 9934 edges · 185 communities (174 shown, 11 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 558 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cba7ca61`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- escapeHtml
- messageHandler.test.ts
- git
- error.rs
- Vertex
- details.ts
- messageHandler.ts
- types.ts
- main.ts
- rendering.test.ts
- webviewPanel.test.ts
- ExtensionState
- Dropdown
- .renderTable
- settingsWidget.ts
- 010-active-handoff-git-trust-repository-recovery-and-diagnostics.md
- devDependencies
- scripts
- commandManager.ts
- verifyVsix.test.ts
- tableColumnResize.test.ts
- global.d.ts
- properties
- types/index.ts
- commitDetailsView.ts
- .showCommitDetails
- compilerOptions
- extensionSettings.ts
- telemetry/index.ts
- linkify.ts
- Changelog
- extension.ts
- queries.rs
- loadCommits.ts
- setupHtml
- Engine
- .bindSettingsWidget
- package.json
- tagDetails.ts
- GitGraphView
- keyboardNavigation.test.ts
- repoInfo.ts
- gitRunner.ts
- git-graph-libre.fetchAvatars
- default
- housekeeping.mjs
- git-graph-libre.telemetry.enabled
- node/src/lib.rs
- Repo
- log.rs
- include
- config.ts
- webview/uncommittedDetails.test.ts
- git-graph-libre.dateFormat
- check-l10n.js
- contextMenuVisibility.ts
- addon.ts
- compilerOptions
- graph_and_diff.rs
- commits.ts
- types.rs
- 060-upstream-review-second-pass.md
- README.md
- git-graph-libre.commitDetails.fileViewMode
- git-graph-libre.dateType
- git-graph-libre.graphStyle
- git-graph-libre.tabIconColorTheme
- settingsWidgetActions.test.ts
- search_commits
- generate-octicons.js
- 010-phase-16-rust-engine-backend.md
- esbuild.js
- engine/index.ts
- diffDocProvider.ts
- git-graph-libre.repository.showRemoteBranches
- status.rs
- lib
- git-graph-libre.graph.fontSize
- git-graph-libre.graph.rowHeight
- git-graph-libre.shortHashLength
- keywords
- TestRepo
- mergeDialogDefaults.test.ts
- details.rs
- src/tsconfig.json
- kb/README.md
- contributes
- startup.ts
- blob.rs
- setup.ts
- graph.rs
- webviewHtml.ts
- userConfig.ts
- git-graph-libre.customBranchGlobPatterns
- extensionSettingsContextMenu.test.ts
- read_refs
- properties
- git-graph-libre.repository.onlyFollowFirstParent
- logger.test.ts
- uncommittedDetailsView.ts
- 260-experiment-one-linux-binary-for-both-c-libraries.md
- build-addon.mjs
- git-graph-libre.dialog.pullBranch.noFastForward
- log_and_refs.rs
- queries.types.ts
- 230-upstream-engine-review-first-pass.md
- git-graph-libre.loadMoreCommits
- reader.test.ts
- GitRef
- [1.0.0] - 2026-07-01
- Graph
- Branch
- diff.rs
- receive
- PULL_REQUEST_TEMPLATE.md
- repoConfigFile.ts
- loadBranches
- webview/componentStatus.ts
- commit.ts
- [1.1.0] - 2026-07-27
- prune.ts
- git-graph-libre.columns.signature
- config_and_blob.rs
- stashes.test.ts
- git-graph-libre.repository.fetchTagsByDefault
- git-graph-libre.repository.muteCommitsNotAncestorsOfHead
- pathTree.ts
- git-graph-libre.repository.stashDisplay
- merge.ts
- git-graph-libre.commitDetails.compactFolders
- config.rs
- backend/extension/workspaceSearch.test.ts
- 010-should-the-engine-be-adopted-not-wholesale.md
- git-graph-libre.backend
- git-graph-libre.dialog.merge.noFastForward
- git-graph-libre.repository.includeReflog
- gitPathRescan.test.ts
- [0.4.0] - 2026-04-10
- git_parity.rs
- git-graph-libre.autoCenterCommitDetailsView
- GitFileChange
- git-graph-libre.initialLoadCommits
- [1.8.1] - 2026-10-17
- git-graph-libre.repository.includeUnreachableCommits
- tests/stats.rs
- 040-slice-16-2-build-the-addon-locally-for-one-target.md
- git-graph-libre.maxDepthOfRepoSearch
- repoSearch.ts
- AvatarRequestQueue
- [1.5.0] - 2026-09-07
- 220-author-date-through-the-engine-and-the-status-indicator.md
- git-graph-libre.repository.muteMergeCommits
- git-graph-libre.showUncommittedChanges
- [1.8.0] - 2026-10-16
- [0.2.0] - 2026-03-17
- git-graph-libre.repository.showTags
- git-graph-libre.showStatusBarItem
- keyboardShortcuts.ts
- [1.6.0] - 2026-09-10
- git-graph-libre.revealHighlightColor
- parity.test.ts
- archive.ts
- reftable.rs
- git-graph-libre.restoreTabOnStartup
- [0.3.0] - 2026-03-26
- [1.4.2] - 2026-09-03
- [1.6.2] - 2026-09-22
- extension.test.ts
- Phase 17: VS Code's diff algorithm in the engine
- RefOptionsPayload
- pullRequest.ts
- [1.4.0] - 2026-09-03
- [1.1.1] - 2026-07-29
- octicons.ts
- commitFind.ts
- activationEvents
- .constructor
- 090-uncommitted-changes-staging-panel-released-as-1-5-0.md
- verify-vsix.d.mts

## God Nodes (most connected - your core abstractions)
1. `GitGraphView` - 332 edges
2. `runGitRaw()` - 109 edges
3. `escapeHtml()` - 87 edges
4. `Repo` - 85 edges
5. `sendMessage()` - 84 edges
6. `registerMessageHandlers()` - 80 edges
7. `git()` - 50 edges
8. `GitCommitNode` - 49 edges
9. `scripts` - 46 edges
10. `showActionRunningDialog()` - 46 edges

## Surprising Connections (you probably didn't know these)
- `createEventQueue()` --indirect_call--> `flush()`  [INFERRED]
  src/telemetry/eventQueue.ts → tests/backend/avatarManager.test.ts
- `createFailureScreenReporter()` --indirect_call--> `report()`  [INFERRED]
  src/webview/failureScreen.ts → docs/kb/housekeeping.mjs
- `readInfo()` --calls--> `createRepoReader()`  [EXTRACTED]
  tests/backend/engine/lifecycle.test.ts → src/backend/engine/index.ts
- `comparisonReader()` --calls--> `createRepoReader()`  [EXTRACTED]
  tests/backend/engine/reader.test.ts → src/backend/engine/index.ts
- `detailsReader()` --calls--> `createRepoReader()`  [EXTRACTED]
  tests/backend/engine/reader.test.ts → src/backend/engine/index.ts

## Import Cycles
- None detected.

## Communities (185 total, 11 thin omitted)

### Community 0 - "escapeHtml"
Cohesion: 0.05
Nodes (9): Pull request review — #4 and #5 (`2026-09-05`), GitTagDetails, showActionRunningDialog(), showCheckboxDialog(), showConfirmationDialog(), showRefInputDialog(), showSelectDialog(), escapeHtml() (+1 more)

### Community 1 - "messageHandler.test.ts"
Cohesion: 0.08
Nodes (34): Merged as PR #1, released as `1.4.2` (`2026-09-03`), createSignatureBearingTag(), commands, configurationGlobalValues, configurationKey(), ConfigurationTarget, configurationUpdates, configurationWorkspaceFolderValues (+26 more)

### Community 2 - "git"
Cohesion: 0.07
Nodes (16): PR #8 — `commit.gpgsign` in the fetch-tags fixture, GitCommandRecord, createdDirs, makeBareRemote(), makeRepoWithRemotes(), createdDirs, makeBareRemote(), makeRepoWithRemotes() (+8 more)

### Community 3 - "error.rs"
Cohesion: 0.33
Nodes (7): activity_heatmap(), all_tips_with_stash(), author_stats(), ObjectId, Result, Vec, GitActivityCell

### Community 5 - "details.ts"
Cohesion: 0.14
Nodes (23): applyLineCounts(), EngineCommitDetails, EngineCommitFile, EngineFileChange, engineFileKinds, EngineLineCounts, EngineStashEntry, findStashEntry() (+15 more)

### Community 6 - "messageHandler.ts"
Cohesion: 0.05
Nodes (95): Phase 7: Stash Management, BUG-1 — `pushTag` hardcodes the `origin` remote, BUG-2 — The tag remote surface is a stub beside the branch remote surface, BUG-6 — Cross-cutting: tag actions bypass the command log, checkoutBranch(), createBranch(), deleteBranch(), DeleteBranchInput (+87 more)

### Community 7 - "types.ts"
Cohesion: 0.05
Nodes (41): JsonPrimitive, RequestCompareFileWithWorkingTree, RequestComponentStatus, RequestCopyToClipboard, RequestExportExtensionSettings, RequestFetchAvatar, RequestImportExtensionSettings, RequestImportRepoConfig (+33 more)

### Community 8 - "main.ts"
Cohesion: 0.05
Nodes (62): Webview UI Styling Guide, BUG-3 — "Lightweight" creates a signed annotated tag and opens an editor window, generateGitFileTree(), DialogInput, bindDialogInputDependencies(), bindFormDialogInputs(), bindLockedDialogInputs(), COLUMN_HIDE_CLASSES (+54 more)

### Community 9 - "rendering.test.ts"
Cohesion: 0.05
Nodes (27): clickContextMenuItem(), commitsWithStashRow, contextMenuItem(), defaultViewState, finishAction(), firstCommitDetails, getFindInput(), latestLoadBranchesRequest() (+19 more)

### Community 10 - "webviewPanel.test.ts"
Cohesion: 0.06
Nodes (26): webviewBridgeFactory(), createWebviewPanel(), normalizeRepoPath(), RelativePatternFactory, RepoFileWatcher, shouldRefreshGitPath(), shouldRefreshRepoPath(), trimTrailingSlashes() (+18 more)

### Community 11 - "ExtensionState"
Cohesion: 0.06
Nodes (23): AvatarManager, AvatarRequestItem, GitHubRemoteSource, GitLabRemoteSource, GravatarRemoteSource, RemoteSource, RepoReaderDeps, GitClient (+15 more)

### Community 12 - "Dropdown"
Cohesion: 0.07
Nodes (15): Phase 12: Toolbar Dropdown Name Truncation and Find Row (Bug), Slice 1 — Checkbox appearance, Dropdown, DropdownDisplayOptions, getRepoIndentLevel(), truncateMiddle(), truncateRefName(), css (+7 more)

### Community 13 - ".renderTable"
Cohesion: 0.07
Nodes (12): closestHTMLElement(), hideContextMenu(), hideContextMenuListener(), hideDialogAndContextMenu(), normalizeContextMenuItems(), renderContextMenuHeader(), requireElement(), showContextMenu() (+4 more)

### Community 14 - "settingsWidget.ts"
Cohesion: 0.06
Nodes (59): GitRepoConfig, ExtensionSetting, SettingsWidgetTab, booleanSettingOrder, configValueText(), firstRemoteUrl(), getRepoBasename(), getRepoDisplayName() (+51 more)

### Community 15 - "010-active-handoff-git-trust-repository-recovery-and-diagnostics.md"
Cohesion: 0.09
Nodes (38): Active handoff: Git trust, repository recovery, and diagnostics (`2026-10-17`), formatGitCommandRecord(), operationContext(), RequestContext, requests, runDetached(), traceBackend(), traceRequest() (+30 more)

### Community 16 - "devDependencies"
Cohesion: 0.05
Nodes (37): @biomejs/biome, jsdom, @napi-rs/cli, ovsx, devDependencies, @biomejs/biome, esbuild, jsdom (+29 more)

### Community 17 - "scripts"
Cohesion: 0.04
Nodes (46): scripts, bench:backends, biome-migrate, build, build:all, clean, compile, compile-tests (+38 more)

### Community 18 - "commandManager.ts"
Cohesion: 0.12
Nodes (19): getPathFromStr(), CommandApi, CommandManager, CommandManagerDeps, createCommandManager(), createVsCodeWindowApi(), findKnownRepoForPath(), OutputChannel (+11 more)

### Community 19 - "verifyVsix.test.ts"
Cohesion: 0.12
Nodes (26): Verifying the packaged VSIX on every platform (`2026-10-17`), ENGINE, HERE, main(), pinnedZigDirectory(), remapArguments(), run(), TARGETS (+18 more)

### Community 20 - "tableColumnResize.test.ts"
Cohesion: 0.11
Nodes (18): boot(), columns(), commits, DragCase, dragCases, headers(), latest(), LoadBranchesRequest (+10 more)

### Community 21 - "global.d.ts"
Cohesion: 0.07
Nodes (26): GitCommitDetails, GitRemote, GitStash, AvatarImageCollection, Config, ContextMenuElement, DialogCheckboxInput, DialogGroupInput (+18 more)

### Community 22 - "properties"
Cohesion: 0.07
Nodes (27): additionalProperties, type, additionalProperties, type, additionalProperties, type, additionalProperties, default (+19 more)

### Community 23 - "types/index.ts"
Cohesion: 0.11
Nodes (29): commitComparison(), CommitComparisonInput, fetchComparisonDiff(), requireRef(), commitDetails(), CommitDetailsInput, fetchNameStatus(), fetchNumStat() (+21 more)

### Community 24 - "commitDetailsView.ts"
Cohesion: 0.13
Nodes (27): CommitDetailsFileViewMode, alterGitFileTree(), capitalizeSection(), CommitDetailsFileViewOptions, CommitDetailsSectionState, compactFolderChain(), compactFolderContents(), compareGitFolderEntries() (+19 more)

### Community 25 - ".showCommitDetails"
Cohesion: 0.12
Nodes (9): clampCommitDetailsHeight(), CommitDetailsSection, ContextMenuHeader, ContextMenuItem, getSectionToggleLabel(), isCommitDetailsSection(), isUncommittedSection(), UncommittedSection (+1 more)

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+14 more)

### Community 27 - "extensionSettings.ts"
Cohesion: 0.11
Nodes (32): DiffDocument, applyExtensionSettings(), clampNumber(), ConfigInspection, expectArray(), expectBoolean(), expectObject(), expectString() (+24 more)

### Community 28 - "telemetry/index.ts"
Cohesion: 0.08
Nodes (28): End-to-end verification of the sender seam (`2026-09-02`), buildAdditionalCommonProperties(), EnvironmentFacts, leadingDigits(), reducePlatformVersion(), createEventQueue(), EventQueue, EventQueueOptions (+20 more)

### Community 29 - "linkify.ts"
Cohesion: 0.17
Nodes (18): IssueLinkingConfig, buildIssueUrl(), collectHttpLinks(), collectIssueLinks(), collectLinks(), countCharacter(), createIssuePattern(), extractIssueLinks() (+10 more)

### Community 30 - "Changelog"
Cohesion: 0.12
Nodes (17): [0.1.0] - 2026-02-18, [0.1.1] - 2026-02-23, [1.1.2] - 2026-07-29, [1.2.0] - 2026-07-29, [1.2.1] - 2026-07-31, [1.3.0] - 2026-08-06, [1.4.1] - 2026-09-03, [1.6.1] - 2026-09-17 (+9 more)

### Community 31 - "extension.ts"
Cohesion: 0.11
Nodes (19): Graphify Map, Current Architecture, Consent epoch — session record (`2026-09-02`), Telemetry (`telemetry` branch, `2026-08-26`), Reference, gitClientFactory(), setOperationLog(), activate() (+11 more)

### Community 32 - "queries.rs"
Cohesion: 0.06
Nodes (18): Two environment facts recorded while doing this, Error, ErrorKind, ResultExt, Result, Self, String, T (+10 more)

### Community 33 - "loadCommits.ts"
Cohesion: 0.06
Nodes (53): Phase 10: Advanced History, Text, and Integrations, Phase 4: Find, Search, and Keyboard Navigation, Phase 15: Tag Surfaces — Signed-Tag Distinction and Remote Tag Deletion, deleteRemoteTag(), DeleteRemoteTagInput, addUnsavedChangesCommit(), buildLogArgs(), buildLogFormat() (+45 more)

### Community 34 - "setupHtml"
Cohesion: 0.09
Nodes (23): bootWebview(), commits, defaultViewState, latestRequest(), repoInfo, mount(), viewStateFixture, BootInput (+15 more)

### Community 35 - "Engine"
Cohesion: 0.08
Nodes (19): default_graph_options_match_the_views_first_request(), Engine, GraphOptions, Arc, AsRef, BTreeMap, CommitOrdering, Default (+11 more)

### Community 36 - ".bindSettingsWidget"
Cohesion: 0.14
Nodes (5): Settings reach the webview twice, and the second time is raw (`2026-09-05`), Phase 13: Settings Hub — Tabbed Widget, Color Editor, Settings Export, isJsonObject(), normalizeCustomBranchGlobPattern(), RepoBooleanSettingKey

### Community 37 - "package.json"
Cohesion: 0.07
Nodes (27): author, name, bugs, url, capabilities, untrustedWorkspaces, categories, contributors (+19 more)

### Community 38 - "tagDetails.ts"
Cohesion: 0.16
Nodes (22): applySignatureRecord(), cleanEmail(), emptySignature(), failedSignatureCodes, markBadSignature(), markFailedSignature(), markGoodSignature(), markValidSignature() (+14 more)

### Community 39 - "GitGraphView"
Cohesion: 0.05
Nodes (6): Phase 3: Commit Hash Display Hardening, GitCommitNode, DropdownOption, GitGraphView, arraysEqual(), event()

### Community 40 - "keyboardNavigation.test.ts"
Cohesion: 0.15
Nodes (11): commitDetailsFor(), CommitDetailsRequest, commitRow(), latestRequest(), LoadBranchesRequest, LoadCommitsRequest, loadedCommits, openCommitDetails() (+3 more)

### Community 41 - "repoInfo.ts"
Cohesion: 0.08
Nodes (54): Slice 16.4 — `loadRepoInfo`, Why the graph opened no faster, and what fixed it (`2026-09-23`), collects_authors_from_every_ref_not_just_head(), buildRepoInfoOptions(), composeEngineRepoInfo(), engineAuthors(), engineRemotes(), EngineRepoInfo (+46 more)

### Community 42 - "gitRunner.ts"
Cohesion: 0.10
Nodes (26): FileActionInput, FileActionPayloads, requireRepoRelativePath(), requireValue(), resetFileToRevision(), rebaseCurrentBranch(), RebaseCurrentBranchInput, requireValue() (+18 more)

### Community 43 - "git-graph-libre.fetchAvatars"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.fetchAvatars

### Community 44 - "default"
Cohesion: 0.12
Nodes (16): default, description, type, git-graph-libre.graphColors, oklch(59% 0.21 130), oklch(59% 0.21 145), oklch(59% 0.21 190), oklch(59% 0.21 245) (+8 more)

### Community 45 - "housekeeping.mjs"
Cohesion: 0.08
Nodes (39): codeTargets(), edge(), fileNodes(), inlineCode(), isCodeShapedName(), knowledgeBaseEdges(), linkGraph(), mentionEdges() (+31 more)

### Community 46 - "git-graph-libre.telemetry.enabled"
Cohesion: 0.13
Nodes (15): default, enum, enumDescriptions, markdownDescription, tags, type, git-graph-libre.telemetry.enabled, %config.telemetry.enabled.disabled% (+7 more)

### Community 47 - "node/src/lib.rs"
Cohesion: 0.19
Nodes (41): Slice 16.6 — Commit details, comparison, and line counts, Slice 16.7 — The remaining reads, The engine surface: what is wired, what was removed, what is kept (`2026-09-23`), Diff parity against real history, and a gix Myers fix (`2026-10-18`), activity_heatmap(), author_stats(), authors(), compare_commits() (+33 more)

### Community 48 - "Repo"
Cohesion: 0.11
Nodes (20): ConfigStamp, file_stamp(), Repo, RepoManager, resolve_commit_in(), Arc, AsRef, Commit (+12 more)

### Community 49 - "log.rs"
Cohesion: 0.15
Nodes (35): all_tips(), authors(), changes_path(), changes_paths(), commit_matches_author(), count_commits_before(), entry_named(), order() (+27 more)

### Community 50 - "include"
Cohesion: 0.15
Nodes (12): compilerOptions, lib, extends, include, ./backend/**/*.ts, ./extension/**/*.ts, ../src/backend/**/*.ts, ../src/webview/**/*.ts (+4 more)

### Community 51 - "config.ts"
Cohesion: 0.05
Nodes (62): BUG-5 — The "watching" eye status bar item can never appear, vscode, doesPathExist(), getPathFromUri(), isDirectory(), commitDetailsFileViewModes, Config, DEFAULT_GRAPH_COLORS (+54 more)

### Community 52 - "webview/uncommittedDetails.test.ts"
Cohesion: 0.17
Nodes (12): defaultViewState, headCommit, latestSent(), openPanel(), receiveLoadedCommits(), receiveUncommittedDetails(), reloadGraphWithCommits(), reloadGraphWithRow() (+4 more)

### Community 53 - "git-graph-libre.dateFormat"
Cohesion: 0.17
Nodes (12): default, description, enum, enumDescriptions, type, git-graph-libre.dateFormat, %config.dateFormat.dateOnly%, %config.dateFormat.dateTime% (+4 more)

### Community 54 - "check-l10n.js"
Cohesion: 0.26
Nodes (11): checkFileSet(), checkTranslations(), extractPlaceholders(), formatCoverage(), fs, L10N_DIR, loadJson(), path (+3 more)

### Community 55 - "contextMenuVisibility.ts"
Cohesion: 0.19
Nodes (8): createDefaultContextMenuActionsVisibility(), isRecord(), normalizeContextMenuActionsVisibility(), ContextMenuActionsVisibility, commits, LoadBranchesRequest, LoadCommitsRequest, viewState

### Community 56 - "addon.ts"
Cohesion: 0.09
Nodes (25): ActiveStatus, AddonAttempt, attemptAddon(), candidateAddonFiles(), classifyLoadedAddon(), EngineLoad, engineLoadStatus(), firstLine() (+17 more)

### Community 57 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, module, moduleResolution, noEmit, outDir, paths, rootDir, extends (+5 more)

### Community 58 - "graph_and_diff.rs"
Cohesion: 0.07
Nodes (11): adds_an_uncommitted_changes_row_above_head(), allows_branch_filtered_graphs_with_reflog_option(), assembles_a_graph_with_its_branch_and_tag_labels(), declines_graphs_that_include_reflog_commits(), declines_mailmapped_graphs_only_when_a_mailmap_exists(), hangs_a_stash_row_off_the_commit_it_was_taken_from(), open(), reports_the_author_date_only_when_asked() (+3 more)

### Community 59 - "commits.ts"
Cohesion: 0.10
Nodes (31): License review of the graph and stash UI slices (`2026-09-09`), Slice 16.5 — `loadCommits`, and the three declines, buildLoadCommitsOptions(), compareRefNames(), EngineCommit, EngineCommitData, EngineCommitRemote, EngineCommitStash (+23 more)

### Community 60 - "types.rs"
Cohesion: 0.17
Nodes (31): `vscode-git-graph-rs` licensing verdict (`2026-09-22`), ConfigSnapshot, GitAuthor, GitAuthorStat, GitCommit, GitCommitData, GitCommitDetails, GitCommitRemote (+23 more)

### Community 61 - "060-upstream-review-second-pass.md"
Cohesion: 0.22
Nodes (9): Upstream review, second pass (`2026-08-25`), getCommitDate(), formatRelativeDate(), getMonth(), getRelativeFormatter, pad2(), RELATIVE_UNITS, ago() (+1 more)

### Community 62 - "README.md"
Cohesion: 0.10
Nodes (14): Agent Instructions, Renames and relicensing since these notes were written, Branch and release policy, Commit signing, Maintainer and Agent Source of Truth, Order of this document, Documentation and Verification Rules, Rules (+6 more)

### Community 63 - "git-graph-libre.commitDetails.fileViewMode"
Cohesion: 0.12
Nodes (18): default, description, enum, enumDescriptions, type, default, description, enum (+10 more)

### Community 64 - "git-graph-libre.dateType"
Cohesion: 0.20
Nodes (10): default, description, enum, enumDescriptions, type, git-graph-libre.dateType, Author Date, Commit Date (+2 more)

### Community 65 - "git-graph-libre.graphStyle"
Cohesion: 0.20
Nodes (10): default, description, enum, enumDescriptions, type, git-graph-libre.graphStyle, angular, %config.graphStyle.angular% (+2 more)

### Community 66 - "git-graph-libre.tabIconColorTheme"
Cohesion: 0.20
Nodes (10): default, description, enum, enumDescriptions, type, git-graph-libre.tabIconColorTheme, color, %config.tabIconColorTheme.color% (+2 more)

### Community 67 - "settingsWidgetActions.test.ts"
Cohesion: 0.15
Nodes (13): click(), commits, dialogActions, extensionTabActions, latest(), LoadBranchesRequest, LoadCommitsRequest, LoadRepoInfoRequest (+5 more)

### Community 68 - "search_commits"
Cohesion: 0.11
Nodes (23): author_contains(), is_hash_like(), Commit, ObjectId, Result, Vec, search_commits(), search_tips() (+15 more)

### Community 69 - "generate-octicons.js"
Cohesion: 0.22
Nodes (7): data, entries, fs, ICON_NAMES, missing, outFile, path

### Community 70 - "010-phase-16-rust-engine-backend.md"
Cohesion: 0.06
Nodes (19): Near-Term Work Order, Design rules — invariants every slice must keep, Slice 16.1 — A gate for the Rust side, with no wiring at all, Slice 16.8 — Handle lifetime and post-write freshness, Building the whole stack (`2026-09-23`), One build path, runnable anywhere (`2026-09-23`), Search in the engine, and a CLI bug it exposed (`2026-09-23`), Pinned toolchain, remapped paths, cached CI (`2026-09-23`) (+11 more)

### Community 71 - "esbuild.js"
Cohesion: 0.29
Nodes (7): aliasPlugin, esbuild, esbuildProblemMatcherPlugin, main(), path, production, watch

### Community 72 - "engine/index.ts"
Cohesion: 0.17
Nodes (31): EngineAddon, createRepoReader(), declineKind(), FALLBACK_ERROR_PREFIXES, fillLineCounts(), isEngineFallbackError(), noteEngineThrow(), noteMalformedPayload() (+23 more)

### Community 73 - "diffDocProvider.ts"
Cohesion: 0.13
Nodes (12): Slice 16.3 — The seam, the escape hatch, and one trivial read, GitInstance, decodeDiffDocUri(), decodeUriQueryArgs(), DiffDocProvider, DiffDocProviderDeps, DiffDocRequest, FileContentAddon (+4 more)

### Community 74 - "git-graph-libre.repository.showRemoteBranches"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.showRemoteBranches

### Community 75 - "status.rs"
Cohesion: 0.17
Nodes (22): classify_staged(), classify_unstaged(), count_changes(), is_conflict(), is_dirty(), PathState, Renames, BTreeMap (+14 more)

### Community 76 - "lib"
Cohesion: 0.29
Nodes (6): compilerOptions, lib, extends, dom, es2023, ../../tsconfig.json

### Community 77 - "git-graph-libre.graph.fontSize"
Cohesion: 0.33
Nodes (6): default, description, maximum, minimum, type, git-graph-libre.graph.fontSize

### Community 78 - "git-graph-libre.graph.rowHeight"
Cohesion: 0.33
Nodes (6): default, description, maximum, minimum, type, git-graph-libre.graph.rowHeight

### Community 79 - "git-graph-libre.shortHashLength"
Cohesion: 0.33
Nodes (6): default, description, maximum, minimum, type, git-graph-libre.shortHashLength

### Community 80 - "keywords"
Cohesion: 0.09
Nodes (22): keywords, action, branch, cherry-pick, commit, devcontainer, diff, git (+14 more)

### Community 81 - "TestRepo"
Cohesion: 0.20
Nodes (8): git_available(), repo_root(), Path, PathBuf, String, Vec, TestRepo, TempDir

### Community 82 - "mergeDialogDefaults.test.ts"
Cohesion: 0.20
Nodes (7): bootWebview(), commits, Defaults, latest(), makeViewState(), receiveSetting(), repoInfo

### Community 83 - "details.rs"
Cohesion: 0.22
Nodes (19): commit_bodies(), commit_details(), commit_details_base(), commit_summaries(), is_safe_tag_name(), read_signature(), BTreeMap, Commit (+11 more)

### Community 84 - "src/tsconfig.json"
Cohesion: 0.40
Nodes (4): exclude, extends, webview, ../tsconfig.json

### Community 85 - "kb/README.md"
Cohesion: 0.05
Nodes (28): Mission, Mission, Verifying webview visuals without a browser (`2026-09-10`), Phase 2: Commit Details UX, Phase 6: Repo Settings and View Options, Phase 8: Commit Comparison and Multi-Select, Phase 9: Repository and Remote Management, Roadmap: open phases (+20 more)

### Community 86 - "contributes"
Cohesion: 0.50
Nodes (4): contributes, commands, menus, scm/title

### Community 87 - "startup.ts"
Cohesion: 0.13
Nodes (14): FailureScreen, RepositoryProbe, RequestMessage, StartupStatus, createFailureScreenReporter(), initStartupScreen(), renderRepository(), repositoryStateText() (+6 more)

### Community 88 - "blob.rs"
Cohesion: 0.16
Nodes (18): ConsumeHunk, DiffLineKind, blob_at(), commit_file(), commit_file_diff(), git_range(), HunkSink, index_file() (+10 more)

### Community 89 - "setup.ts"
Cohesion: 0.19
Nodes (14): getWebviewLocalizedStrings(), LocalizedStrings, buildWebviewStatusStrip(), escapeHtml(), buildToolbarButton(), buildToolbarDropdownGroup(), buildWebviewToolbar(), escapeAttribute() (+6 more)

### Community 90 - "graph.rs"
Cohesion: 0.19
Nodes (19): annotate_refs(), insert_stashes(), insert_uncommitted_row(), load_commits(), now_seconds(), repo_info(), resolve_tips(), GitRefData (+11 more)

### Community 91 - "webviewHtml.ts"
Cohesion: 0.06
Nodes (36): Consent prompt (`2026-09-02`), Temporary language switcher (`2026-09-03`), Phase 14: Reveal Highlight — Persistent Blink and Configurable Color, BUG-4 — Branch and tag labels turn gray on every merge commit, Follow-up — where stashes appear, and a checkout default, Follow-up — list/tree toggle, and the stash-branch dialog, getNonce(), buildExtensionUri() (+28 more)

### Community 92 - "userConfig.ts"
Cohesion: 0.15
Nodes (16): deleteUserDetails(), editUserDetails(), requireScope(), requireValue(), setConfigValue(), unsetConfigValue(), UserConfigActionInput, UserConfigActionPayloads (+8 more)

### Community 93 - "git-graph-libre.customBranchGlobPatterns"
Cohesion: 0.13
Nodes (15): default, description, items, type, items, description, pattern, properties (+7 more)

### Community 94 - "extensionSettingsContextMenu.test.ts"
Cohesion: 0.23
Nodes (10): bootWebview(), commits, defaultViewState, extensionSetting(), latest(), openBranchContextMenu(), openCommitContextMenu(), openContextMenu() (+2 more)

### Community 95 - "read_refs"
Cohesion: 0.17
Nodes (20): The two ref fills, removed from the engine rather than optimised (`2026-09-23`), bstr_to_string(), direct_target(), direct_target_id(), read_refs(), read_remote_refs(), GitRefData, ObjectId (+12 more)

### Community 96 - "properties"
Cohesion: 0.10
Nodes (20): properties, title, type, configuration, default, description, type, default (+12 more)

### Community 97 - "git-graph-libre.repository.onlyFollowFirstParent"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.onlyFollowFirstParent

### Community 99 - "uncommittedDetailsView.ts"
Cohesion: 0.15
Nodes (19): GitUncommittedChanges, GitUncommittedFile, renderCommitDetailsResizeHandle(), getStagingDropAction(), RenderUncommittedDetailsOptions, renderUncommittedDetailsRowHtml(), renderUncommittedFileItem(), renderUncommittedFileList() (+11 more)

### Community 100 - "260-experiment-one-linux-binary-for-both-c-libraries.md"
Cohesion: 0.16
Nodes (18): c_char, Experiment: one Linux binary for both C libraries (`2026-10-16`), answers_with_the_running_glibcs_version(), gnu_get_libc_version(), makeLoadableByMusl(), fileOffset(), neededLibraries(), readDynamic() (+10 more)

### Community 101 - "build-addon.mjs"
Cohesion: 0.22
Nodes (17): buildEnvironment(), buildWindowsArm64Locally(), cargoArtifactName(), copyReplacingHeldFile(), extractArm64CrtLibraries(), findCachedArm64CrtVsix(), findCrtLibDir(), findWindowsKitsArm64() (+9 more)

### Community 102 - "git-graph-libre.dialog.pullBranch.noFastForward"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.dialog.pullBranch.noFastForward

### Community 103 - "log_and_refs.rs"
Cohesion: 0.11
Nodes (9): limits_the_page_to_the_requested_size(), never_shows_a_parent_before_its_child(), open(), reports_tag_signature_presence_the_way_for_each_ref_does(), CommitOrdering, String, Vec, walk_all() (+1 more)

### Community 104 - "queries.types.ts"
Cohesion: 0.08
Nodes (24): CommitSignaturesInput, commitSignatureStatuses, GitQueryContext, parseCommitSignature(), parseGpgsigPresence(), parseSignatureEntries(), reclassifyUnverifiedSignatures(), SignatureEntry (+16 more)

### Community 105 - "230-upstream-engine-review-first-pass.md"
Cohesion: 0.09
Nodes (17): Licensing, Licensing, Upstream engine review, first pass (`2026-10-16`), The filtered engine repository, merged onto `rusty` (`2026-09-22`), Fixes adapted after the import, License, NOTICE — the Git engine, Obligation that survives (+9 more)

### Community 106 - "git-graph-libre.loadMoreCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.loadMoreCommits

### Community 107 - "reader.test.ts"
Cohesion: 0.09
Nodes (22): AddonProvider, closeAllEngineRepositories(), closeEngineRepository(), CommitComparisonArgs, CommitDetailsArgs, didEngineDeclineRead(), didEngineFailRead(), openEngineRepositoryCount() (+14 more)

### Community 108 - "GitRef"
Cohesion: 0.20
Nodes (10): Tag-specific graying — investigation result (`2026-08-25`), Slice 2 — Remote sub-label restyle, createCommitNodes(), GitRef, CommitRefDisplayItem, groupCommitRefs(), ParsedRemoteBranch, parseRemoteBranchName() (+2 more)

### Community 109 - "[1.0.0] - 2026-07-01"
Cohesion: 0.50
Nodes (4): [1.0.0] - 2026-07-01, Added, Changed, Fixed

### Community 110 - "Graph"
Cohesion: 0.18
Nodes (4): Graph, UnavailablePoint, VertexOrNull, config

### Community 112 - "diff.rs"
Cohesion: 0.27
Nodes (18): apply_worktree_status(), classify(), collect_changes(), diff_against_worktree(), diff_commit(), diff_commits(), diff_revisions(), line_counts() (+10 more)

### Community 113 - "receive"
Cohesion: 0.13
Nodes (22): commits, latest(), LoadBranchesRequest, LoadCommitsRequest, LoadRepoInfoRequest, makeViewState(), openFetchDialog(), receiveFetchTagsSetting() (+14 more)

### Community 114 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.22
Nodes (8): All contributions, Checklist, How it was tested, Includes third-party code, License, Only code I wrote myself, Type of change, What and why

### Community 115 - "repoConfigFile.ts"
Cohesion: 0.18
Nodes (20): ExportedRepoConfig, exportedRepoState(), exportRepoConfigFile(), getRepoConfigFilePath(), importRepoConfigFile(), isColumnWidths(), isCommitOrdering(), isIssueLinkingConfig() (+12 more)

### Community 116 - "loadBranches"
Cohesion: 0.24
Nodes (9): PR #9 — repository discovery, right diagnosis and a broken comparison, Pull request review — #8 and #9, released as `1.6.2` (`2026-09-22`), dependencies, simple-git, simple-git, loadBranches(), canonicalizePath(), isGitRepository() (+1 more)

### Community 117 - "webview/componentStatus.ts"
Cohesion: 0.13
Nodes (28): ComponentStatus, applyComponentStatus(), cancelClose(), cancelOpen(), CLI_ROUTES, closePopup(), componentRows(), engineRow() (+20 more)

### Community 118 - "commit.ts"
Cohesion: 0.22
Nodes (15): checkoutCommit(), cherrypickCommit(), CommitActionInput, CommitActionPayloads, dropCommit(), dropCommitSelection(), editHeadCommitMessage(), normalizeCommitMessage() (+7 more)

### Community 119 - "[1.1.0] - 2026-07-27"
Cohesion: 0.50
Nodes (4): [1.1.0] - 2026-07-27, Added, Changed, Fixed

### Community 120 - "prune.ts"
Cohesion: 0.26
Nodes (8): ENGINE_PLATFORM_DIRECTORIES, platformDirectoriesFor(), NOTHING, pruneInstalledEngineBinaries(), PruneResult, pruneUnusedEngineBinaries(), removePlatformDirectory(), roots

### Community 121 - "git-graph-libre.columns.signature"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.columns.signature

### Community 124 - "git-graph-libre.repository.fetchTagsByDefault"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.fetchTagsByDefault

### Community 125 - "git-graph-libre.repository.muteCommitsNotAncestorsOfHead"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.muteCommitsNotAncestorsOfHead

### Community 126 - "pathTree.ts"
Cohesion: 0.21
Nodes (11): Follow-up — staging catalogue view, and two rendering fixes, renderUncommittedFolder(), buildPathTree(), childFolder(), collectLeafPaths(), compact(), compareNodes(), emptyFolder() (+3 more)

### Community 127 - "git-graph-libre.repository.stashDisplay"
Cohesion: 0.17
Nodes (12): default, description, enum, enumDescriptions, type, git-graph-libre.repository.stashDisplay, both, %config.repository.stashDisplay.both% (+4 more)

### Community 128 - "merge.ts"
Cohesion: 0.39
Nodes (6): buildMergeArgs(), MergeActionInput, MergeActionPayloads, mergeBranch(), mergeCommit(), requireValue()

### Community 129 - "git-graph-libre.commitDetails.compactFolders"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.commitDetails.compactFolders

### Community 130 - "config.rs"
Cohesion: 0.25
Nodes (14): config_list(), ConfigLocation, global_config_path(), read_config(), remote_url(), BTreeMap, Option, Path (+6 more)

### Community 131 - "backend/extension/workspaceSearch.test.ts"
Cohesion: 0.17
Nodes (5): inspectMock, probeOverrides, probeStates, searchUtilMock, workspaceState

### Community 132 - "010-should-the-engine-be-adopted-not-wholesale.md"
Cohesion: 0.10
Nodes (16): Non-goals, permanently, Slice 16.9 — Per-platform packaging, Should the engine be adopted? Not wholesale, Evaluating the Rust engine of `vscode-git-graph-rs` (`2026-09-22`), Dependencies: What the Engine Is Built From, and What It Links Against, `git-graph-core` (the engine — no Node, no VS Code), `git-graph-node` (the Node-API addon), Re-verifying all of this (+8 more)

### Community 133 - "git-graph-libre.backend"
Cohesion: 0.20
Nodes (10): default, description, enum, enumDescriptions, type, git-graph-libre.backend, auto, %config.backend.auto% (+2 more)

### Community 134 - "git-graph-libre.dialog.merge.noFastForward"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.dialog.merge.noFastForward

### Community 135 - "git-graph-libre.repository.includeReflog"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.includeReflog

### Community 136 - "gitPathRescan.test.ts"
Cohesion: 0.14
Nodes (7): channelLines, gitClientStub, makeContext(), panelStub, repoManagerStub, repoSearchStub, vscodeMocks

### Community 137 - "[0.4.0] - 2026-04-10"
Cohesion: 0.67
Nodes (3): [0.4.0] - 2026-04-10, Added, Fixed

### Community 138 - "git_parity.rs"
Cohesion: 0.22
Nodes (4): a_shallow_boundary_commit_has_no_parents_and_opens_its_details(), open(), porcelain_lines(), replacement_objects_hand_history_reads_to_git()

### Community 139 - "git-graph-libre.autoCenterCommitDetailsView"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.autoCenterCommitDetailsView

### Community 141 - "git-graph-libre.initialLoadCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.initialLoadCommits

### Community 142 - "[1.8.1] - 2026-10-17"
Cohesion: 0.50
Nodes (4): [1.8.1] - 2026-10-17, Added, Changed, Fixed

### Community 143 - "git-graph-libre.repository.includeUnreachableCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.includeUnreachableCommits

### Community 145 - "040-slice-16-2-build-the-addon-locally-for-one-target.md"
Cohesion: 0.15
Nodes (13): Slice 16.2 — Build the addon locally for one target, description, license, name, napi, binaryName, private, version (+5 more)

### Community 146 - "git-graph-libre.maxDepthOfRepoSearch"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.maxDepthOfRepoSearch

### Community 147 - "repoSearch.ts"
Cohesion: 0.38
Nodes (8): evalPromises(), toRejectionError(), isDirectory(), parseSubmodulePathEntry(), readSubmodulePaths(), RootCheck, searchDirectoryForRepos(), searchSubmodules()

### Community 149 - "[1.5.0] - 2026-09-07"
Cohesion: 0.50
Nodes (4): [1.5.0] - 2026-09-07, Added, Changed, Fixed

### Community 150 - "220-author-date-through-the-engine-and-the-status-indicator.md"
Cohesion: 0.24
Nodes (11): Author Date through the engine, and the status indicator (`2026-10-16`), engineComponentStatus(), engineUnavailableReason(), lastGraphLoadRoute(), buildComponentStatus(), ComponentStatusDeps, describeEngineStatus(), probeGit() (+3 more)

### Community 151 - "git-graph-libre.repository.muteMergeCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.muteMergeCommits

### Community 152 - "git-graph-libre.showUncommittedChanges"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showUncommittedChanges

### Community 153 - "[1.8.0] - 2026-10-16"
Cohesion: 0.33
Nodes (6): [1.8.0] - 2026-10-16, Added, Changed, Changed, Fixed, Fixed

### Community 154 - "[0.2.0] - 2026-03-17"
Cohesion: 0.67
Nodes (3): [0.2.0] - 2026-03-17, Added, Fixed

### Community 155 - "git-graph-libre.repository.showTags"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.showTags

### Community 156 - "git-graph-libre.showStatusBarItem"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showStatusBarItem

### Community 157 - "keyboardShortcuts.ts"
Cohesion: 0.27
Nodes (8): GlobalShortcutAction, GlobalShortcutContext, GlobalShortcutKeyEvent, resolveCommitDetailsNavigate(), resolveCtrlOrMetaShortcut(), resolveEscape(), resolveGlobalShortcut(), resolvePlainKeyShortcut()

### Community 159 - "[1.6.0] - 2026-09-10"
Cohesion: 0.40
Nodes (5): [1.6.0] - 2026-09-10, Added, Changed, Fixed, Telemetry

### Community 160 - "git-graph-libre.revealHighlightColor"
Cohesion: 0.40
Nodes (5): default, description, pattern, type, git-graph-libre.revealHighlightColor

### Community 161 - "parity.test.ts"
Cohesion: 0.07
Nodes (43): Benchmarking the two backends (`2026-09-23`), entry, outDir, outFile, root, didEngineServeRead(), LoadCommitsArgs, RepoReader (+35 more)

### Community 162 - "archive.ts"
Cohesion: 0.33
Nodes (7): ARCHIVE_FORMATS, ArchiveFormat, archiveFormatFromPath(), createArchive(), CreateArchiveInput, requireArchiveFormat(), requireValue()

### Community 165 - "git-graph-libre.restoreTabOnStartup"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.restoreTabOnStartup

### Community 166 - "[0.3.0] - 2026-03-26"
Cohesion: 0.67
Nodes (3): [0.3.0] - 2026-03-26, Added, Changed

### Community 167 - "[1.4.2] - 2026-09-03"
Cohesion: 0.67
Nodes (3): [1.4.2] - 2026-09-03, Added, Fixed

### Community 168 - "[1.6.2] - 2026-09-22"
Cohesion: 0.67
Nodes (3): [1.6.2] - 2026-09-22, Changed, Fixed

### Community 170 - "Phase 17: VS Code's diff algorithm in the engine"
Cohesion: 0.22
Nodes (9): Architecture, Decisions for the maintainer, Legal plan, Phase 17: VS Code's diff algorithm in the engine, Risks, Slices, Test strategy: five implementations, one answer, Using it in Git Graph Libre (decision D4) (+1 more)

### Community 171 - "RefOptionsPayload"
Cohesion: 0.40
Nodes (3): RefOptionsPayload, Default, Self

### Community 172 - "pullRequest.ts"
Cohesion: 0.43
Nodes (6): assertHttpUrl(), buildPullRequestUrl(), parseRemoteUrl(), PullRequestUrlInput, RemoteUrlParts, stripGitSuffix()

### Community 173 - "[1.4.0] - 2026-09-03"
Cohesion: 0.50
Nodes (4): [1.4.0] - 2026-09-03, Added, Changed, Fixed

### Community 174 - "[1.1.1] - 2026-07-29"
Cohesion: 0.67
Nodes (3): [1.1.1] - 2026-07-29, Added, Changed

### Community 175 - "octicons.ts"
Cohesion: 0.48
Nodes (4): octicon(), OcticonName, octicons, svgIcons

### Community 176 - "commitFind.ts"
Cohesion: 0.48
Nodes (5): commitSearchFields(), findCommitIndexes(), formatFindMatchCount(), normalizeFindText(), commits

### Community 177 - "activationEvents"
Cohesion: 0.50
Nodes (4): activationEvents, onStartupFinished, onWebviewPanel:git-graph-libre, workspaceContains:.git

### Community 210 - ".constructor"
Cohesion: 0.06
Nodes (6): What the page-size defaults are actually worth (`2026-09-23`), Slice 3 — Stash list above the table, Slice 4 — Stashes as graph rows, Release gate for these slices (`2026-09-09`), Graph and stash UI slices (`2026-09-09`), createEmptyGitConfig()

### Community 254 - "090-uncommitted-changes-staging-panel-released-as-1-5-0.md"
Cohesion: 0.10
Nodes (15): Uncommitted-changes staging panel, released as `1.5.0` (`2026-09-07`), Release `1.6.0` (`2026-09-10`), parseStatusEntries(), uncommittedDetails(), UNMERGED_PAIRS, TelemetryReporter, CommitLoadFacts, createViewFeatureReporter() (+7 more)

## Knowledge Gaps
- **1059 isolated node(s):** `name`, `version`, `private`, `license`, `description` (+1054 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `properties` connect `properties` to `git-graph-libre.commitDetails.compactFolders`, `git-graph-libre.backend`, `git-graph-libre.dialog.merge.noFastForward`, `git-graph-libre.repository.includeReflog`, `git-graph-libre.autoCenterCommitDetailsView`, `git-graph-libre.initialLoadCommits`, `git-graph-libre.repository.includeUnreachableCommits`, `git-graph-libre.maxDepthOfRepoSearch`, `properties`, `git-graph-libre.repository.muteMergeCommits`, `git-graph-libre.showUncommittedChanges`, `git-graph-libre.repository.showTags`, `git-graph-libre.showStatusBarItem`, `git-graph-libre.revealHighlightColor`, `git-graph-libre.restoreTabOnStartup`, `git-graph-libre.fetchAvatars`, `default`, `git-graph-libre.telemetry.enabled`, `git-graph-libre.dateFormat`, `git-graph-libre.commitDetails.fileViewMode`, `git-graph-libre.dateType`, `git-graph-libre.graphStyle`, `git-graph-libre.tabIconColorTheme`, `git-graph-libre.repository.showRemoteBranches`, `git-graph-libre.graph.fontSize`, `git-graph-libre.graph.rowHeight`, `git-graph-libre.shortHashLength`, `git-graph-libre.customBranchGlobPatterns`, `git-graph-libre.repository.onlyFollowFirstParent`, `git-graph-libre.dialog.pullBranch.noFastForward`, `git-graph-libre.loadMoreCommits`, `git-graph-libre.columns.signature`, `git-graph-libre.repository.fetchTagsByDefault`, `git-graph-libre.repository.muteCommitsNotAncestorsOfHead`, `git-graph-libre.repository.stashDisplay`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `contributes` connect `contributes` to `properties`, `package.json`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `configuration` connect `properties` to `contributes`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `runGitRaw()` (e.g. with `010-active-handoff-git-trust-repository-recovery-and-diagnostics.md` and `010-non-goals-permanently.md`) actually correct?**
  _`runGitRaw()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1059 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `escapeHtml` be split into smaller, more focused modules?**
  _Cohesion score 0.053650326109825376 - nodes in this community are weakly interconnected._
- **Should `messageHandler.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08250355618776671 - nodes in this community are weakly interconnected._