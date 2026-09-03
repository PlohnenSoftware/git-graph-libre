# Graph Report - git-graph-libre  (2026-09-03)

## Corpus Check
- 237 files · ~175,189 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2321 nodes · 5409 edges · 145 communities (131 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c3f5fc02`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sendMessage
- messageHandler.test.ts
- tagDetails.ts
- GitGraphView
- Graph
- .constructor
- messageHandler.ts
- types.ts
- main.ts
- rendering.test.ts
- vscode
- ExtensionState
- Dropdown
- .renderTable
- escapeHtml
- Implementation Roadmap
- devDependencies
- scripts
- commandManager.ts
- extension.ts
- index.ts
- global.d.ts
- properties
- loadRepoInfo.ts
- commitDetailsView.ts
- .showCommitDetails
- compilerOptions
- remote.ts
- path.ts
- repoConfigFile.ts
- Changelog
- GitCommandRecorder
- runGitRaw
- searchCommits.ts
- webviewL10n.ts
- linkify.ts
- .displayHash
- package.json
- commit.ts
- .bindSettingsWidget
- keyboardNavigation.test.ts
- loadCommits.ts
- gitRunner.ts
- properties
- default
- webviewHtml.ts
- git-graph-libre.customBranchGlobPatterns
- queries.types.ts
- config.ts
- oklchColor.ts
- include
- GitCommitNode
- settingsWidget.test.ts
- git-graph-libre.dateFormat
- check-l10n.js
- git.types.ts
- keyboardShortcuts.ts
- compilerOptions
- userConfig.ts
- actions.types.ts
- abbrevCommit
- getCommitDate
- README.md
- git-graph-libre.commitDetails.fileViewMode
- git-graph-libre.dateType
- git-graph-libre.graphStyle
- git-graph-libre.tabIconColorTheme
- contextMenuVisibilityRendering.test.ts
- activationEvents
- generate-octicons.js
- merge.ts
- esbuild.js
- pullRequest.ts
- AvatarRequestQueue
- ActionPayload
- octicons.ts
- webview/tsconfig.json
- git-graph-libre.graph.fontSize
- git-graph-libre.graph.rowHeight
- git-graph-libre.shortHashLength
- keywords
- contextMenuVisibility.ts
- dom.ts
- git-graph-libre.revealHighlightColor
- src/tsconfig.json
- generateGitFileTree
- contributes
- git-graph-libre.autoCenterCommitDetailsView
- git-graph-libre.commitDetails.compactFolders
- git-graph-libre.fetchAvatars
- git-graph-libre.initialLoadCommits
- git-graph-libre.loadMoreCommits
- git-graph-libre.maxDepthOfRepoSearch
- git-graph-libre.revealHighlightColor
- git-graph-libre.repository.includeUnreachableCommits
- git-graph-libre.repository.showTags
- git-graph-libre.showCurrentBranchByDefault
- git-graph-libre.repository.muteCommitsNotAncestorsOfHead
- git-graph-libre.showUncommittedChanges
- git-graph-libre.showStatusBarItem
- html.ts
- dialogStyles.test.ts
- categories
- html.ts
- .applyStructuredExtensionSetting
- extension.test.ts
- utils/vscode.ts
- manifest.test.ts
- tableStyles.test.ts
- git-graph-libre.repository.includeReflog
- config.test.ts
- vitest.config.ts
- repository
- CommitDetailsSection
- extension.test.ts
- repository
- statusBarItem.test.ts
- git-graph-libre.repository.includeReflog
- git-graph-libre.repository.showStashes
- git-graph-libre.repository.boldCheckedOutCommit
- git-graph-libre.repository.fetchTagsByDefault
- git-graph-libre.repository.muteCommitsNotAncestorsOfHead
- git-graph-libre.showStatusBarItem
- .value
- repoSearch.ts
- AI_DEV_KNOWLEDGE_BASE.md
- dom.ts
- Telemetry (`telemetry` branch, `2026-08-26`)
- CommitDetailsSection
- .value
- utils/vscode.ts
- statusStrip.ts
- [0.3.0] - 2026-03-26
- git.types.ts
- branch.ts
- octicons.ts
- .showTagDetails
- contextMenuVisibility.ts
- [1.4.2] - 2026-09-03
- extension.test.ts
- Submodule discovery (`2026-08-21`)

## God Nodes (most connected - your core abstractions)
1. `GitGraphView` - 303 edges
2. `runGitRaw()` - 86 edges
3. `sendMessage()` - 79 edges
4. `escapeHtml()` - 77 edges
5. `registerMessageHandlers()` - 74 edges
6. `showActionRunningDialog()` - 43 edges
7. `showFormDialog()` - 37 edges
8. `makeRepo()` - 36 edges
9. `GitCommitNode` - 35 edges
10. `Dropdown` - 35 edges

## Surprising Connections (you probably didn't know these)
- `createEventQueue()` --indirect_call--> `flush()`  [INFERRED]
  src/telemetry/eventQueue.ts → tests/backend/avatarManager.test.ts
- `registerHandlersForTest()` --calls--> `registerMessageHandlers()`  [EXTRACTED]
  tests/webview/messageHandler.test.ts → src/extension/messageHandler.ts
- `createHarness()` --calls--> `createWebviewPanel()`  [EXTRACTED]
  tests/webview/webviewPanel.test.ts → src/extension/webviewPanel.ts
- `reporterFor()` --calls--> `createTelemetryReporter()`  [EXTRACTED]
  tests/webview/telemetryReporter.test.ts → src/telemetry/index.ts
- `groupCommitRefs()` --indirect_call--> `ref()`  [INFERRED]
  src/webview/refLabels.ts → tests/webview/refLabels.test.ts

## Import Cycles
- None detected.

## Communities (145 total, 14 thin omitted)

### Community 0 - "sendMessage"
Cohesion: 0.06
Nodes (8): GitFileChange, showActionRunningDialog(), showCheckboxDialog(), showConfirmationDialog(), showFormDialog(), showRefInputDialog(), showSelectDialog(), sendMessage()

### Community 1 - "messageHandler.test.ts"
Cohesion: 0.10
Nodes (26): GitClient, createSignatureBearingTag(), registerHandlersForTest(), commands, configurationKey(), configurationWorkspaceFolderValues, configurationWorkspaceValues, createdTerminals (+18 more)

### Community 2 - "tagDetails.ts"
Cohesion: 0.09
Nodes (15): GitCommandRecord, createdDirs, makeBareRemote(), makeRepoWithRemotes(), createdDirs, makeBareRemote(), makeRepoWithRemotes(), git() (+7 more)

### Community 3 - "GitGraphView"
Cohesion: 0.06
Nodes (3): DropdownOption, GitGraphView, trimRepoTrailingSeparators()

### Community 4 - "Graph"
Cohesion: 0.07
Nodes (3): Branch, Graph, Vertex

### Community 5 - ".constructor"
Cohesion: 0.39
Nodes (5): FileActionInput, FileActionPayloads, requireRepoRelativePath(), requireValue(), resetFileToRevision()

### Community 6 - "messageHandler.ts"
Cohesion: 0.11
Nodes (35): ActionInput, ActionPayloadByCommand, applyStash(), branchFromStash(), cleanUntrackedFiles(), dropStash(), popStash(), pushStash() (+27 more)

### Community 7 - "types.ts"
Cohesion: 0.04
Nodes (44): CustomBranchGlobPattern, DateFormat, ExtensionSettingScope, ExtensionSettingType, GraphStyle, JsonPrimitive, RequestCompareFileWithWorkingTree, RequestCopyToClipboard (+36 more)

### Community 8 - "main.ts"
Cohesion: 0.05
Nodes (52): CommitDetailsSection, bindDialogInputDependencies(), bindFormDialogInputs(), COLUMN_HIDE_CLASSES, COMMIT_SIGNATURE_PRESENTATIONS, contextMenu, dialog, dialogBacking (+44 more)

### Community 9 - "rendering.test.ts"
Cohesion: 0.06
Nodes (24): clickContextMenuItem(), contextMenuItem(), defaultViewState, finishAction(), firstCommitDetails, getFindInput(), latestLoadBranchesRequest(), latestLoadCommitsRequest() (+16 more)

### Community 10 - "vscode"
Cohesion: 0.06
Nodes (26): WebviewBridge, webviewBridgeFactory(), normalizeRepoPath(), RelativePatternFactory, RepoFileWatcher, shouldRefreshGitPath(), shouldRefreshRepoPath(), trimTrailingSlashes() (+18 more)

### Community 11 - "ExtensionState"
Cohesion: 0.06
Nodes (26): AvatarManager, AvatarRequestItem, AvatarRequestQueue, GitHubRemoteSource, GitLabRemoteSource, GravatarRemoteSource, RemoteSource, getRemoteUrl() (+18 more)

### Community 12 - "Dropdown"
Cohesion: 0.12
Nodes (4): Dropdown, DropdownDisplayOptions, truncateMiddle(), truncateRefName()

### Community 13 - ".renderTable"
Cohesion: 0.13
Nodes (7): closestHTMLElement(), hideContextMenu(), hideContextMenuListener(), hideDialogAndContextMenu(), requireElement(), showContextMenu(), addListenerToClass()

### Community 14 - "escapeHtml"
Cohesion: 0.09
Nodes (36): GitRepoConfig, ExtensionSetting, booleanSettingOrder, configValueText(), firstRemoteUrl(), getRepoBasename(), getRepoDisplayName(), getRepoIndentLevel() (+28 more)

### Community 15 - "Implementation Roadmap"
Cohesion: 0.10
Nodes (20): Implementation Roadmap, Phase 0.5: Backend Robustness and Data-Source Foundation, Phase 0: Guardrails and Baseline, Phase 10: Advanced History, Text, and Integrations, Phase 12: Toolbar Dropdown Name Truncation and Find Row (Bug), Phase 13: Settings Hub — Tabbed Widget, Color Editor, Settings Export, Phase 14: Reveal Highlight — Persistent Blink and Configurable Color, Phase 15: Tag Surfaces — Signed-Tag Distinction and Remote Tag Deletion (+12 more)

### Community 16 - "devDependencies"
Cohesion: 0.06
Nodes (31): @biomejs/biome, jsdom, devDependencies, @biomejs/biome, esbuild, jsdom, @primer/octicons, tsc-alias (+23 more)

### Community 17 - "scripts"
Cohesion: 0.06
Nodes (31): scripts, clean, compile, compile-tests, format, format:changed, format:changed:fix, format:fix (+23 more)

### Community 18 - "commandManager.ts"
Cohesion: 0.14
Nodes (18): getPathFromStr(), CommandApi, CommandManager, CommandManagerDeps, createCommandManager(), createVsCodeWindowApi(), findKnownRepoForPath(), OutputChannel (+10 more)

### Community 19 - "extension.ts"
Cohesion: 0.16
Nodes (15): gitClientFactory(), GitInstance, decodeDiffDocUri(), decodeUriQueryArgs(), DiffDocProvider, activate(), createLogger(), timestamp() (+7 more)

### Community 20 - "index.ts"
Cohesion: 0.11
Nodes (18): boot(), columns(), commits, DragCase, dragCases, headers(), latest(), LoadBranchesRequest (+10 more)

### Community 21 - "global.d.ts"
Cohesion: 0.07
Nodes (26): GitCommitDetails, GitRemote, GitStash, AvatarImageCollection, Config, ContextMenuElement, ContextMenuHeader, ContextMenuItem (+18 more)

### Community 22 - "properties"
Cohesion: 0.07
Nodes (27): additionalProperties, type, additionalProperties, type, additionalProperties, type, additionalProperties, default (+19 more)

### Community 23 - "loadRepoInfo.ts"
Cohesion: 0.16
Nodes (25): appendUnique(), emptyRepoInfo(), GitQueryContext, isInsideWorkTree(), loadAuthors(), loadConfig(), loadHead(), loadRemotes() (+17 more)

### Community 24 - "commitDetailsView.ts"
Cohesion: 0.10
Nodes (35): CommitDetailsFileViewMode, IssueLinkingConfig, alterGitFileTree(), capitalizeSection(), CommitDetailsFileViewOptions, CommitDetailsSectionState, compactFolderChain(), compactFolderContents() (+27 more)

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (22): mocha, node, ./node_modules/@types, compilerOptions, esModuleInterop, isolatedModules, lib, module (+14 more)

### Community 27 - "remote.ts"
Cohesion: 0.15
Nodes (21): addRemote(), AddRemoteInput, assertPruneTagsSupported(), cleanRemoteName(), cleanRemoteUrl(), deleteRemote(), DeleteRemoteInput, editRemote() (+13 more)

### Community 28 - "path.ts"
Cohesion: 0.16
Nodes (14): buildActivationPayload(), createEventQueue(), EventQueue, EventQueueOptions, QueuedTelemetryEvent, TelemetryEventPayload, createTelemetrySender(), isStorablePrimitive() (+6 more)

### Community 29 - "repoConfigFile.ts"
Cohesion: 0.18
Nodes (20): ExportedRepoConfig, exportedRepoState(), exportRepoConfigFile(), getRepoConfigFilePath(), importRepoConfigFile(), isColumnWidths(), isCommitOrdering(), isIssueLinkingConfig() (+12 more)

### Community 30 - "Changelog"
Cohesion: 0.13
Nodes (15): [0.1.0] - 2026-02-18, [0.1.1] - 2026-02-23, [1.1.2] - 2026-07-29, [1.2.0] - 2026-07-29, [1.2.1] - 2026-07-31, [1.3.0] - 2026-08-06, [1.4.1] - 2026-09-03, Added (+7 more)

### Community 31 - "GitCommandRecorder"
Cohesion: 0.19
Nodes (19): clampNumber(), ConfigInspection, expectArray(), expectBoolean(), expectObject(), expectString(), loadExtensionSettings(), ManifestSetting (+11 more)

### Community 32 - "runGitRaw"
Cohesion: 0.48
Nodes (5): commitSearchFields(), findCommitIndexes(), formatFindMatchCount(), normalizeFindText(), commits

### Community 33 - "searchCommits.ts"
Cohesion: 0.10
Nodes (30): addUnsavedChangesCommit(), buildLogArgs(), buildLogFormat(), buildRefFormat(), createCommitNodes(), getLog(), getRefs(), getUnreachableCommitHashes() (+22 more)

### Community 34 - "webviewL10n.ts"
Cohesion: 0.12
Nodes (19): GitRepoInfo, bootWebview(), commits, defaultViewState, latestRequest(), repoInfo, mount(), viewStateFixture (+11 more)

### Community 36 - ".displayHash"
Cohesion: 0.25
Nodes (17): escapeRegExp(), GitQueryContext, hashSearch(), loadPositions(), logFormat(), mergeSearchResults(), normalizeMaxResults(), parseLogEntries() (+9 more)

### Community 37 - "package.json"
Cohesion: 0.09
Nodes (22): activationEvents, author, name, bugs, url, contributors, dependencies, description (+14 more)

### Community 38 - "commit.ts"
Cohesion: 0.20
Nodes (20): applySignatureRecord(), cleanEmail(), emptySignature(), failedSignatureCodes, markBadSignature(), markFailedSignature(), markGoodSignature(), markValidSignature() (+12 more)

### Community 39 - ".bindSettingsWidget"
Cohesion: 0.15
Nodes (11): interpolate(), loadEnglishTranslations(), resolveTranslationPath(), t(), TranslationRecord, TranslationValue, ConsentPrompt, ConsentPromptDeps (+3 more)

### Community 40 - "keyboardNavigation.test.ts"
Cohesion: 0.15
Nodes (11): commitDetailsFor(), CommitDetailsRequest, commitRow(), latestRequest(), LoadBranchesRequest, LoadCommitsRequest, loadedCommits, openCommitDetails() (+3 more)

### Community 41 - "loadCommits.ts"
Cohesion: 0.18
Nodes (20): commitComparison(), CommitComparisonInput, fetchComparisonDiff(), requireRef(), commitDetails(), CommitDetailsInput, fetchNameStatus(), fetchNumStat() (+12 more)

### Community 42 - "gitRunner.ts"
Cohesion: 0.16
Nodes (20): loadBranches(), arrayOfStrings(), findCredentialHostSeparator(), findUrlEnd(), GitCommandError, GitCommandErrorInfo, GitCommandKind, GitCommandOptions (+12 more)

### Community 43 - "properties"
Cohesion: 0.17
Nodes (12): properties, title, type, configuration, default, description, type, default (+4 more)

### Community 44 - "default"
Cohesion: 0.06
Nodes (31): default, description, items, type, default, description, items, type (+23 more)

### Community 45 - "webviewHtml.ts"
Cohesion: 0.11
Nodes (28): getNonce(), buildExtensionUri(), buildTelemetryConsentScreen(), escapeHtml(), buildWebviewHtml(), escapeJsonForHtml(), getWebviewLocalizedStrings(), LocalizedStrings (+20 more)

### Community 46 - "git-graph-libre.customBranchGlobPatterns"
Cohesion: 0.13
Nodes (15): default, enum, enumDescriptions, markdownDescription, tags, type, git-graph-libre.telemetry.enabled, %config.telemetry.enabled.disabled% (+7 more)

### Community 47 - "queries.types.ts"
Cohesion: 0.17
Nodes (11): COMMIT_ORDERINGS, CommitDetailsResult, CommitOrdering, LoadBranchesResult, LoadCommitsResult, LoadRepoInfoResult, QueryPayloads, QueryRequest (+3 more)

### Community 48 - "config.ts"
Cohesion: 0.13
Nodes (26): deleteBranch(), ActionInput, ActionPayloadByCommand, currentBranch(), deleteRemoteBranch(), fetchIntoLocalBranch(), loadRemoteNames(), parseRemoteBranch() (+18 more)

### Community 49 - "oklchColor.ts"
Cohesion: 0.23
Nodes (11): commitDetailsFileViewModes, customBranchGlobPatterns(), DEFAULT_GRAPH_COLORS, getColorConfig(), getConfig(), getConfigWithLegacy(), getExplicitConfig(), getNumberConfig() (+3 more)

### Community 50 - "include"
Cohesion: 0.15
Nodes (12): ./backend/**/*.ts, ./extension/**/*.ts, ../src/backend/**/*.ts, ../src/webview/**/*.ts, ./webview/**/*.ts, compilerOptions, lib, extends (+4 more)

### Community 51 - "GitCommitNode"
Cohesion: 0.18
Nodes (12): Config, createRepoManager(), Logger, StatusBarItem, GitRepoSet, createItem(), FakeStatusBarItem, makeConfig() (+4 more)

### Community 52 - "settingsWidget.test.ts"
Cohesion: 0.18
Nodes (17): buildIssueUrl(), collectHttpLinks(), collectIssueLinks(), collectLinks(), countCharacter(), createIssuePattern(), extractIssueLinks(), isSafeUrl() (+9 more)

### Community 53 - "git-graph-libre.dateFormat"
Cohesion: 0.17
Nodes (12): default, description, enum, enumDescriptions, type, git-graph-libre.dateFormat, %config.dateFormat.dateOnly%, %config.dateFormat.dateTime% (+4 more)

### Community 54 - "check-l10n.js"
Cohesion: 0.26
Nodes (11): checkFileSet(), checkTranslations(), extractPlaceholders(), formatCoverage(), fs, L10N_DIR, loadJson(), path (+3 more)

### Community 55 - "git.types.ts"
Cohesion: 0.18
Nodes (9): createDefaultContextMenuActionsVisibility(), isRecord(), normalizeContextMenuActionsVisibility(), ContextMenuActionsVisibility, commitDetails, commits, LoadBranchesRequest, LoadCommitsRequest (+1 more)

### Community 56 - "keyboardShortcuts.ts"
Cohesion: 0.27
Nodes (8): GlobalShortcutAction, GlobalShortcutContext, GlobalShortcutKeyEvent, resolveCommitDetailsNavigate(), resolveCtrlOrMetaShortcut(), resolveEscape(), resolveGlobalShortcut(), resolvePlainKeyShortcut()

### Community 57 - "compilerOptions"
Cohesion: 0.14
Nodes (13): ./**/*.ts, compilerOptions, module, moduleResolution, noEmit, outDir, paths, rootDir (+5 more)

### Community 58 - "userConfig.ts"
Cohesion: 0.15
Nodes (15): rebaseCurrentBranch(), RebaseCurrentBranchInput, requireValue(), deleteUserDetails(), editUserDetails(), requireScope(), requireValue(), setConfigValue() (+7 more)

### Community 59 - "actions.types.ts"
Cohesion: 0.12
Nodes (15): ActionPayloads, ActionRequest, ActionResponse, GIT_PUSH_BRANCH_MODES, GitCommandStatus, GitPushBranchMode, GitCommitSearchResult, GitCommitSignature (+7 more)

### Community 60 - "abbrevCommit"
Cohesion: 0.23
Nodes (12): applyExtensionSettings(), explicitExtensionSettings(), ExportedExtensionSettings, exportExtensionSettingsFile(), importExtensionSettingsFile(), isRecord(), parseExportedExtensionSettings(), JsonValue (+4 more)

### Community 61 - "getCommitDate"
Cohesion: 0.31
Nodes (8): getCommitDate(), formatRelativeDate(), getMonth(), getRelativeFormatter, pad2(), RELATIVE_UNITS, ago(), NOW

### Community 62 - "README.md"
Cohesion: 0.29
Nodes (6): Configuration, Features, Installation, License, Telemetry, Why this fork

### Community 63 - "git-graph-libre.commitDetails.fileViewMode"
Cohesion: 0.20
Nodes (10): default, description, enum, enumDescriptions, type, git-graph-libre.commitDetails.fileViewMode, %config.commitDetails.fileViewMode.list%, %config.commitDetails.fileViewMode.tree% (+2 more)

### Community 64 - "git-graph-libre.dateType"
Cohesion: 0.20
Nodes (10): default, description, enum, enumDescriptions, type, git-graph-libre.dateType, Author Date, Commit Date (+2 more)

### Community 65 - "git-graph-libre.graphStyle"
Cohesion: 0.20
Nodes (10): default, description, enum, enumDescriptions, type, git-graph-libre.graphStyle, angular, %config.graphStyle.angular% (+2 more)

### Community 66 - "git-graph-libre.tabIconColorTheme"
Cohesion: 0.20
Nodes (10): default, description, enum, enumDescriptions, type, git-graph-libre.tabIconColorTheme, color, %config.tabIconColorTheme.color% (+2 more)

### Community 67 - "contextMenuVisibilityRendering.test.ts"
Cohesion: 0.15
Nodes (13): click(), commits, dialogActions, extensionTabActions, latest(), LoadBranchesRequest, LoadCommitsRequest, LoadRepoInfoRequest (+5 more)

### Community 69 - "generate-octicons.js"
Cohesion: 0.22
Nodes (7): data, entries, fs, ICON_NAMES, missing, outFile, path

### Community 70 - "merge.ts"
Cohesion: 0.39
Nodes (6): buildMergeArgs(), MergeActionInput, MergeActionPayloads, mergeBranch(), mergeCommit(), requireValue()

### Community 71 - "esbuild.js"
Cohesion: 0.29
Nodes (7): aliasPlugin, esbuild, esbuildProblemMatcherPlugin, main(), path, production, watch

### Community 72 - "pullRequest.ts"
Cohesion: 0.43
Nodes (6): assertHttpUrl(), buildPullRequestUrl(), parseRemoteUrl(), PullRequestUrlInput, RemoteUrlParts, stripGitSuffix()

### Community 74 - "ActionPayload"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.showRemoteBranches

### Community 75 - "octicons.ts"
Cohesion: 0.12
Nodes (5): GitCommitNode, UnavailablePoint, VertexOrNull, arraysEqual(), config

### Community 76 - "webview/tsconfig.json"
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
Nodes (23): keywords, action, branch, cherry-pick, commit, devcontainer, diff, git (+15 more)

### Community 81 - "contextMenuVisibility.ts"
Cohesion: 0.18
Nodes (10): ConfigurationTarget, configurationUpdates, env, executedCommands, resetVscodeMock(), telemetryLoggers, createWindowStub(), promptFor() (+2 more)

### Community 82 - "dom.ts"
Cohesion: 0.10
Nodes (9): DialogInput, handleActionResponse(), handleCreateArchiveResponse(), handleExtensionSettingsFileResponse(), hideDialog(), refreshGraphOrDisplayError(), showDialog(), showErrorDialog() (+1 more)

### Community 83 - "git-graph-libre.revealHighlightColor"
Cohesion: 0.31
Nodes (7): LoadBranchesInput, GitQueryError, QueryResult, isHiddenRemoteRef(), normalizeHiddenRemotes(), remoteExcludeArgs(), remoteNameFromRefName()

### Community 84 - "src/tsconfig.json"
Cohesion: 0.40
Nodes (4): webview, exclude, extends, ../tsconfig.json

### Community 85 - "generateGitFileTree"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.muteMergeCommits

### Community 86 - "contributes"
Cohesion: 0.50
Nodes (4): contributes, commands, menus, scm/title

### Community 87 - "git-graph-libre.autoCenterCommitDetailsView"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.autoCenterCommitDetailsView

### Community 88 - "git-graph-libre.commitDetails.compactFolders"
Cohesion: 0.15
Nodes (13): AI Development Knowledge Base, Branch and release policy, Current Architecture, Documentation and Verification Rules, Future direction: integrate with VS Code's native source control (`2026-09-03`), Graphify Map, Local Inputs Reviewed, Maintainer and Agent Source of Truth (+5 more)

### Community 89 - "git-graph-libre.fetchAvatars"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.fetchAvatars

### Community 90 - "git-graph-libre.initialLoadCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.initialLoadCommits

### Community 91 - "git-graph-libre.loadMoreCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.loadMoreCommits

### Community 93 - "git-graph-libre.revealHighlightColor"
Cohesion: 0.40
Nodes (5): default, description, pattern, type, git-graph-libre.revealHighlightColor

### Community 94 - "git-graph-libre.repository.includeUnreachableCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.includeUnreachableCommits

### Community 95 - "git-graph-libre.repository.showTags"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.showTags

### Community 96 - "git-graph-libre.showCurrentBranchByDefault"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showCurrentBranchByDefault

### Community 97 - "git-graph-libre.repository.muteCommitsNotAncestorsOfHead"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.onlyFollowFirstParent

### Community 99 - "git-graph-libre.showStatusBarItem"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showUncommittedChanges

### Community 100 - "html.ts"
Cohesion: 0.21
Nodes (16): checkoutCommit(), cherrypickCommit(), CommitActionInput, CommitActionPayloads, dropCommit(), dropCommitSelection(), editHeadCommitMessage(), normalizeCommitMessage() (+8 more)

### Community 102 - "categories"
Cohesion: 0.67
Nodes (3): categories, SCM Providers, Visualization

### Community 103 - "html.ts"
Cohesion: 0.18
Nodes (10): buildAdditionalCommonProperties(), EnvironmentFacts, leadingDigits(), reducePlatformVersion(), createNoopReporter(), createTelemetryReporter(), TelemetryReporter, TelemetryReporterOptions (+2 more)

### Community 104 - ".applyStructuredExtensionSetting"
Cohesion: 0.14
Nodes (18): vscode, doesPathExist(), getPathFromUri(), isDirectory(), RepoManager, createRepoSearch(), RepoSearch, RepoWatcher (+10 more)

### Community 105 - "extension.test.ts"
Cohesion: 0.33
Nodes (4): Contributors to the AGPL-licensed work, Git Graph Libre — license and provenance, Incorporated MIT-licensed material, NOTICE

### Community 106 - "utils/vscode.ts"
Cohesion: 0.50
Nodes (3): htmlEscapes, htmlUnescapes, unescapeHtml()

### Community 109 - "git-graph-libre.repository.includeReflog"
Cohesion: 0.50
Nodes (4): [1.0.0] - 2026-07-01, Added, Changed, Fixed

### Community 116 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 117 - "CommitDetailsSection"
Cohesion: 0.13
Nodes (13): GitRef, CommitLoadFacts, hasNestedRepo(), isNestedRepo(), ViewFeatureReporter, CommitRefDisplayItem, groupCommitRefs(), ParsedRemoteBranch (+5 more)

### Community 118 - "extension.test.ts"
Cohesion: 0.29
Nodes (8): ARCHIVE_FORMATS, ArchiveFormat, archiveFormatFromPath(), createArchive(), CreateArchiveInput, requireArchiveFormat(), requireValue(), chooseArchiveOutputPath()

### Community 119 - "repository"
Cohesion: 0.50
Nodes (4): [1.1.0] - 2026-07-27, Added, Changed, Fixed

### Community 120 - "statusBarItem.test.ts"
Cohesion: 0.50
Nodes (4): [1.4.0] - 2026-09-03, Added, Changed, Fixed

### Community 121 - "git-graph-libre.repository.includeReflog"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.columns.signature

### Community 122 - "git-graph-libre.repository.showStashes"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.showStashes

### Community 123 - "git-graph-libre.repository.boldCheckedOutCommit"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.boldCheckedOutCommit

### Community 124 - "git-graph-libre.repository.fetchTagsByDefault"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.fetchTagsByDefault

### Community 125 - "git-graph-libre.repository.muteCommitsNotAncestorsOfHead"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.muteCommitsNotAncestorsOfHead

### Community 126 - "git-graph-libre.showStatusBarItem"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showStatusBarItem

### Community 127 - ".value"
Cohesion: 0.22
Nodes (9): BUG-1 — `pushTag` hardcodes the `origin` remote, BUG-2 — The tag remote surface is a stub beside the branch remote surface, BUG-3 — "Lightweight" creates a signed annotated tag and opens an editor window, BUG-4 — Branch and tag labels turn gray on every merge commit, BUG-5 — The "watching" eye status bar item can never appear, BUG-6 — Cross-cutting: tag actions bypass the command log, Immediate TODOs — High-Priority Bug Backlog (`2026-08-25`), Suggested slice order (+1 more)

### Community 128 - "repoSearch.ts"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.includeReflog

### Community 129 - "AI_DEV_KNOWLEDGE_BASE.md"
Cohesion: 0.29
Nodes (3): Agent Instructions, Claude Instructions, Codex Instructions

### Community 130 - "dom.ts"
Cohesion: 0.53
Nodes (3): clearRevealHighlight(), insertAfter(), startRevealHighlight()

### Community 131 - "Telemetry (`telemetry` branch, `2026-08-26`)"
Cohesion: 0.50
Nodes (4): Consent epoch — session record (`2026-09-02`), Consent prompt (`2026-09-02`), End-to-end verification of the sender seam (`2026-09-02`), Telemetry (`telemetry` branch, `2026-08-26`)

### Community 132 - "CommitDetailsSection"
Cohesion: 0.35
Nodes (11): clamp(), formatOklch(), hexToOklch(), normalizeHue(), OklchColor, parseOklch(), rewritePaletteLightnessChroma(), rgbComponentsToOklch() (+3 more)

### Community 134 - "utils/vscode.ts"
Cohesion: 0.22
Nodes (12): commits, latest(), LoadBranchesRequest, LoadCommitsRequest, LoadRepoInfoRequest, makeViewState(), openFetchDialog(), receiveFetchTagsSetting() (+4 more)

### Community 135 - "statusStrip.ts"
Cohesion: 0.67
Nodes (3): [0.2.0] - 2026-03-17, Added, Fixed

### Community 136 - "[0.3.0] - 2026-03-26"
Cohesion: 0.67
Nodes (3): [0.3.0] - 2026-03-26, Added, Changed

### Community 137 - "git.types.ts"
Cohesion: 0.67
Nodes (3): [0.4.0] - 2026-04-10, Added, Fixed

### Community 138 - "branch.ts"
Cohesion: 0.36
Nodes (6): simple-git, simple-git, checkoutBranch(), createBranch(), DeleteBranchInput, renameBranch()

### Community 139 - "octicons.ts"
Cohesion: 0.48
Nodes (4): octicon(), OcticonName, octicons, svgIcons

### Community 140 - ".showTagDetails"
Cohesion: 0.22
Nodes (14): GitTagDetails, renderBooleanEditor(), renderColorStringEditor(), renderColorSwatch(), renderEnumEditor(), renderExtensionSettingEditor(), renderExtensionSettingRow(), renderGraphColorsEditor() (+6 more)

### Community 141 - "contextMenuVisibility.ts"
Cohesion: 0.67
Nodes (3): [1.1.1] - 2026-07-29, Added, Changed

### Community 142 - "[1.4.2] - 2026-09-03"
Cohesion: 0.67
Nodes (3): [1.4.2] - 2026-09-03, Added, Fixed

## Knowledge Gaps
- **731 isolated node(s):** `path`, `esbuild`, `production`, `esbuildProblemMatcherPlugin`, `aliasPlugin` (+726 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `simple-git` connect `branch.ts` to `searchCommits.ts`, `package.json`, `gitRunner.ts`, `config.ts`, `remote.ts`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `dependencies` connect `package.json` to `branch.ts`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `contributes` connect `contributes` to `properties`, `package.json`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **What connects `path`, `esbuild`, `production` to the rest of the system?**
  _731 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sendMessage` be split into smaller, more focused modules?**
  _Cohesion score 0.05592105263157895 - nodes in this community are weakly interconnected._
- **Should `messageHandler.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09788359788359788 - nodes in this community are weakly interconnected._
- **Should `tagDetails.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09098639455782313 - nodes in this community are weakly interconnected._