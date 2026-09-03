# Graph Report - git-graph-libre  (2026-09-02)

## Corpus Check
- 232 files · ~163,590 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2272 nodes · 5300 edges · 128 communities (116 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `124b14e7`
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

## God Nodes (most connected - your core abstractions)
1. `GitGraphView` - 304 edges
2. `runGitRaw()` - 86 edges
3. `sendMessage()` - 78 edges
4. `escapeHtml()` - 76 edges
5. `registerMessageHandlers()` - 74 edges
6. `showActionRunningDialog()` - 43 edges
7. `showFormDialog()` - 37 edges
8. `makeRepo()` - 36 edges
9. `GitCommitNode` - 35 edges
10. `Dropdown` - 34 edges

## Surprising Connections (you probably didn't know these)
- `createCommitNodes()` --indirect_call--> `ref()`  [INFERRED]
  src/backend/queries/loadCommits.ts → tests/webview/refLabels.test.ts
- `loadRefs()` --calls--> `loadCommits()`  [EXTRACTED]
  tests/backend/queries/loadCommits/signedTags.test.ts → src/backend/queries/loadCommits.ts
- `registerHandlersForTest()` --calls--> `registerMessageHandlers()`  [EXTRACTED]
  tests/webview/messageHandler.test.ts → src/extension/messageHandler.ts
- `createEventQueue()` --indirect_call--> `flush()`  [INFERRED]
  src/telemetry/eventQueue.ts → tests/backend/avatarManager.test.ts
- `editRemote()` --references--> `simple-git`  [EXTRACTED]
  src/backend/actions/remote.ts → package.json

## Import Cycles
- None detected.

## Communities (128 total, 12 thin omitted)

### Community 0 - "sendMessage"
Cohesion: 0.07
Nodes (9): showActionRunningDialog(), showCheckboxDialog(), showConfirmationDialog(), showDialog(), showErrorDialog(), showFormDialog(), showRefInputDialog(), showSelectDialog() (+1 more)

### Community 1 - "messageHandler.test.ts"
Cohesion: 0.10
Nodes (26): GitClient, createSignatureBearingTag(), registerHandlersForTest(), commands, configurationKey(), configurationWorkspaceFolderValues, configurationWorkspaceValues, createdTerminals (+18 more)

### Community 2 - "tagDetails.ts"
Cohesion: 0.07
Nodes (20): getRemoteUrl(), isGitRepository(), evalPromises(), toRejectionError(), isDirectory(), searchDirectoryForRepos(), createdDirs, makeBareRemote() (+12 more)

### Community 3 - "GitGraphView"
Cohesion: 0.05
Nodes (8): GitCommitSearchResult, DropdownOption, createEmptyGitConfig(), GitGraphView, isCommitOrdering(), isHideableColumn(), postWebviewDiagnostic(), event()

### Community 4 - "Graph"
Cohesion: 0.06
Nodes (6): Branch, Graph, UnavailablePoint, Vertex, VertexOrNull, config

### Community 5 - ".constructor"
Cohesion: 0.19
Nodes (9): FileActionInput, FileActionPayloads, requireRepoRelativePath(), requireValue(), resetFileToRevision(), rebaseCurrentBranch(), RebaseCurrentBranchInput, requireValue() (+1 more)

### Community 6 - "messageHandler.ts"
Cohesion: 0.10
Nodes (45): simple-git, simple-git, checkoutBranch(), createBranch(), deleteBranch(), DeleteBranchInput, renameBranch(), deleteRemoteBranch() (+37 more)

### Community 7 - "types.ts"
Cohesion: 0.05
Nodes (39): ExtensionSettingScope, ExtensionSettingType, JsonPrimitive, RequestCompareFileWithWorkingTree, RequestCopyToClipboard, RequestExportExtensionSettings, RequestFetchAvatar, RequestImportExtensionSettings (+31 more)

### Community 8 - "main.ts"
Cohesion: 0.06
Nodes (49): GitPushBranchMode, bindDialogInputDependencies(), bindFormDialogInputs(), COLUMN_HIDE_CLASSES, COMMIT_SIGNATURE_PRESENTATIONS, contextMenu, dialog, dialogBacking (+41 more)

### Community 9 - "rendering.test.ts"
Cohesion: 0.06
Nodes (24): clickContextMenuItem(), contextMenuItem(), defaultViewState, finishAction(), firstCommitDetails, getFindInput(), latestLoadBranchesRequest(), latestLoadCommitsRequest() (+16 more)

### Community 10 - "vscode"
Cohesion: 0.07
Nodes (21): WebviewBridge, webviewBridgeFactory(), normalizeRepoPath(), RelativePatternFactory, RepoFileWatcher, shouldRefreshGitPath(), shouldRefreshRepoPath(), trimTrailingSlashes() (+13 more)

### Community 12 - "Dropdown"
Cohesion: 0.12
Nodes (4): Dropdown, DropdownDisplayOptions, truncateMiddle(), truncateRefName()

### Community 13 - ".renderTable"
Cohesion: 0.12
Nodes (6): closestHTMLElement(), hideContextMenu(), hideContextMenuListener(), showContextMenu(), addListenerToClass(), unescapeHtml()

### Community 14 - "escapeHtml"
Cohesion: 0.14
Nodes (34): booleanSettingOrder, configValueText(), firstRemoteUrl(), getRepoBasename(), getRepoDisplayName(), hasUserDetails(), isRemoteHidden(), normalizeRepoBooleanOverride() (+26 more)

### Community 15 - "Implementation Roadmap"
Cohesion: 0.04
Nodes (45): Agent Instructions, Claude Instructions, Codex Instructions, AI Development Knowledge Base, Branch and release policy, BUG-1 — `pushTag` hardcodes the `origin` remote, BUG-2 — The tag remote surface is a stub beside the branch remote surface, BUG-3 — "Lightweight" creates a signed annotated tag and opens an editor window (+37 more)

### Community 16 - "devDependencies"
Cohesion: 0.06
Nodes (31): @biomejs/biome, jsdom, devDependencies, @biomejs/biome, esbuild, jsdom, @primer/octicons, tsc-alias (+23 more)

### Community 17 - "scripts"
Cohesion: 0.06
Nodes (31): scripts, clean, compile, compile-tests, format, format:changed, format:changed:fix, format:fix (+23 more)

### Community 18 - "commandManager.ts"
Cohesion: 0.08
Nodes (24): formatGitCommandRecord(), getPathFromStr(), CommandApi, CommandManager, CommandManagerDeps, createCommandManager(), createVsCodeWindowApi(), findKnownRepoForPath() (+16 more)

### Community 19 - "extension.ts"
Cohesion: 0.22
Nodes (10): gitClientFactory(), GitInstance, decodeDiffDocUri(), decodeUriQueryArgs(), DiffDocProvider, activate(), createLogger(), timestamp() (+2 more)

### Community 20 - "index.ts"
Cohesion: 0.11
Nodes (18): boot(), columns(), commits, DragCase, dragCases, headers(), latest(), LoadBranchesRequest (+10 more)

### Community 21 - "global.d.ts"
Cohesion: 0.07
Nodes (26): GitCommitDetails, GitRemote, GitStash, AvatarImageCollection, Config, ContextMenuElement, ContextMenuItem, DialogCheckboxInput (+18 more)

### Community 22 - "properties"
Cohesion: 0.07
Nodes (27): additionalProperties, type, additionalProperties, type, additionalProperties, type, additionalProperties, default (+19 more)

### Community 23 - "loadRepoInfo.ts"
Cohesion: 0.16
Nodes (25): appendUnique(), emptyRepoInfo(), GitQueryContext, isInsideWorkTree(), loadAuthors(), loadConfig(), loadHead(), loadRemotes() (+17 more)

### Community 24 - "commitDetailsView.ts"
Cohesion: 0.12
Nodes (30): CommitDetailsFileViewMode, alterGitFileTree(), capitalizeSection(), CommitDetailsFileViewOptions, CommitDetailsSectionState, compactFolderChain(), compactFolderContents(), compareGitFolderEntries() (+22 more)

### Community 25 - ".showCommitDetails"
Cohesion: 0.13
Nodes (6): GitFileChange, clampCommitDetailsHeight(), CommitDetailsSection, getSectionToggleLabel(), isCommitDetailsSection(), trimRepoTrailingSeparators()

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (22): mocha, node, ./node_modules/@types, compilerOptions, esModuleInterop, isolatedModules, lib, module (+14 more)

### Community 27 - "remote.ts"
Cohesion: 0.15
Nodes (21): addRemote(), AddRemoteInput, assertPruneTagsSupported(), cleanRemoteName(), cleanRemoteUrl(), deleteRemote(), DeleteRemoteInput, editRemote() (+13 more)

### Community 28 - "path.ts"
Cohesion: 0.15
Nodes (15): buildActivationPayload(), createEventQueue(), EventQueue, EventQueueOptions, QueuedTelemetryEvent, TelemetryEventPayload, createTelemetrySender(), isStorablePrimitive() (+7 more)

### Community 29 - "repoConfigFile.ts"
Cohesion: 0.18
Nodes (20): ExportedRepoConfig, exportedRepoState(), exportRepoConfigFile(), getRepoConfigFilePath(), importRepoConfigFile(), isColumnWidths(), isCommitOrdering(), isIssueLinkingConfig() (+12 more)

### Community 30 - "Changelog"
Cohesion: 0.05
Nodes (36): [0.1.0] - 2026-02-18, [0.1.1] - 2026-02-23, [0.2.0] - 2026-03-17, [0.3.0] - 2026-03-26, [0.4.0] - 2026-04-10, [1.0.0] - 2026-07-01, [1.1.0] - 2026-07-27, [1.1.1] - 2026-07-29 (+28 more)

### Community 31 - "GitCommandRecorder"
Cohesion: 0.19
Nodes (19): clampNumber(), ConfigInspection, expectArray(), expectBoolean(), expectObject(), expectString(), loadExtensionSettings(), ManifestSetting (+11 more)

### Community 32 - "runGitRaw"
Cohesion: 0.35
Nodes (7): abbrevCommit(), clampShortHashLength(), commitSearchFields(), findCommitIndexes(), formatFindMatchCount(), normalizeFindText(), commits

### Community 33 - "searchCommits.ts"
Cohesion: 0.12
Nodes (25): addUnsavedChangesCommit(), buildRefFormat(), createCommitNodes(), getLog(), getRefs(), getUnreachableCommitHashes(), getUnsavedChanges(), gitCommitSignatureStatuses (+17 more)

### Community 34 - "webviewL10n.ts"
Cohesion: 0.12
Nodes (22): getWebviewLocalizedStrings(), LocalizedStrings, buildWebviewStatusStrip(), escapeHtml(), buildTelemetryNotice(), escapeHtml(), StatusStripState, BootInput (+14 more)

### Community 35 - "linkify.ts"
Cohesion: 0.07
Nodes (6): CommitOrdering, hideDialogAndContextMenu(), isContextMenuActive(), isDialogActive(), isEditableTarget(), RepoBooleanSettingKey

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
Cohesion: 0.10
Nodes (28): ARCHIVE_FORMATS, ArchiveFormat, archiveFormatFromPath(), createArchive(), CreateArchiveInput, requireArchiveFormat(), requireValue(), arrayOfStrings() (+20 more)

### Community 43 - "properties"
Cohesion: 0.17
Nodes (12): properties, title, type, configuration, default, description, type, default (+4 more)

### Community 44 - "default"
Cohesion: 0.06
Nodes (31): default, description, items, type, default, description, items, type (+23 more)

### Community 45 - "webviewHtml.ts"
Cohesion: 0.16
Nodes (11): getNonce(), buildExtensionUri(), buildWebviewHtml(), escapeJsonForHtml(), createWebviewPanel(), GitGraphViewState, createHarness(), DisposeHandler (+3 more)

### Community 46 - "git-graph-libre.customBranchGlobPatterns"
Cohesion: 0.13
Nodes (15): default, description, enum, enumDescriptions, tags, type, git-graph-libre.telemetry.enabled, %config.telemetry.enabled.disabled% (+7 more)

### Community 47 - "queries.types.ts"
Cohesion: 0.08
Nodes (20): LoadBranchesInput, COMMIT_ORDERINGS, CommitDetailsResult, GitQueryError, LoadBranchesResult, LoadCommitsResult, LoadRepoInfoResult, QueryPayloads (+12 more)

### Community 48 - "config.ts"
Cohesion: 0.09
Nodes (35): ActionInput, ActionPayloadByCommand, currentBranch(), fetchIntoLocalBranch(), loadRemoteNames(), parseRemoteBranch(), pullBranch(), pushBranch() (+27 more)

### Community 49 - "oklchColor.ts"
Cohesion: 0.17
Nodes (14): commitDetailsFileViewModes, customBranchGlobPatterns(), DEFAULT_GRAPH_COLORS, getColorConfig(), getConfig(), getConfigWithLegacy(), getExplicitConfig(), getNumberConfig() (+6 more)

### Community 50 - "include"
Cohesion: 0.15
Nodes (12): ./backend/**/*.ts, ./extension/**/*.ts, ../src/backend/**/*.ts, ../src/webview/**/*.ts, ./webview/**/*.ts, compilerOptions, lib, extends (+4 more)

### Community 51 - "GitCommitNode"
Cohesion: 0.35
Nodes (11): clamp(), formatOklch(), hexToOklch(), normalizeHue(), OklchColor, parseOklch(), rewritePaletteLightnessChroma(), rgbComponentsToOklch() (+3 more)

### Community 52 - "settingsWidget.test.ts"
Cohesion: 0.18
Nodes (12): GitRepoConfig, ExtensionSetting, renderExtensionTab(), renderSettingsWidget(), SettingsWidgetModel, tabHiddenAttr(), tabSelectedAttr(), config (+4 more)

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
Cohesion: 0.33
Nodes (8): deleteUserDetails(), editUserDetails(), requireScope(), requireValue(), setConfigValue(), unsetConfigValue(), UserConfigActionInput, UserConfigActionPayloads

### Community 59 - "actions.types.ts"
Cohesion: 0.12
Nodes (16): ActionPayloads, ActionRequest, ActionResponse, GIT_CONFIG_SCOPES, GIT_PUSH_BRANCH_MODES, GitCommandStatus, GitConfigScope, DateType (+8 more)

### Community 60 - "abbrevCommit"
Cohesion: 0.23
Nodes (12): applyExtensionSettings(), explicitExtensionSettings(), ExportedExtensionSettings, exportExtensionSettingsFile(), importExtensionSettingsFile(), isRecord(), parseExportedExtensionSettings(), JsonValue (+4 more)

### Community 61 - "getCommitDate"
Cohesion: 0.31
Nodes (8): getCommitDate(), formatRelativeDate(), getMonth(), getRelativeFormatter, pad2(), RELATIVE_UNITS, ago(), NOW

### Community 62 - "README.md"
Cohesion: 0.18
Nodes (9): Git Graph Libre — license and provenance, Incorporated MIT-licensed material, NOTICE, Configuration, Features, Installation, License, Telemetry (+1 more)

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

### Community 68 - "activationEvents"
Cohesion: 0.25
Nodes (6): GitRepoInfo, bootWebview(), commits, defaultViewState, latestRequest(), repoInfo

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
Nodes (12): createNoopReporter(), createTelemetryReporter(), ConfigurationTarget, configurationUpdates, env, executedCommands, resetVscodeMock(), telemetryLoggers (+4 more)

### Community 82 - "dom.ts"
Cohesion: 0.20
Nodes (6): GitTagDetails, renderDialogCheckboxInput(), renderDialogInput(), renderDialogSelectInput(), renderDialogTextareaInput(), renderDialogTextInput()

### Community 83 - "git-graph-libre.revealHighlightColor"
Cohesion: 0.43
Nodes (6): buildLogArgs(), buildLogFormat(), isHiddenRemoteRef(), normalizeHiddenRemotes(), remoteExcludeArgs(), remoteNameFromRefName()

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
Cohesion: 0.13
Nodes (20): IssueLinkingConfig, htmlEscapes, htmlUnescapes, buildIssueUrl(), collectHttpLinks(), collectIssueLinks(), collectLinks(), countCharacter() (+12 more)

### Community 89 - "git-graph-libre.fetchAvatars"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.fetchAvatars

### Community 90 - "git-graph-libre.initialLoadCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.initialLoadCommits

### Community 91 - "git-graph-libre.loadMoreCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.loadMoreCommits

### Community 92 - "git-graph-libre.maxDepthOfRepoSearch"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.maxDepthOfRepoSearch

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
Cohesion: 0.14
Nodes (14): AvatarRequestItem, GitHubRemoteSource, GitLabRemoteSource, GravatarRemoteSource, RemoteSource, Avatar, AvatarCache, ResponseMessage (+6 more)

### Community 102 - "categories"
Cohesion: 0.67
Nodes (3): categories, SCM Providers, Visualization

### Community 103 - "html.ts"
Cohesion: 0.22
Nodes (12): commits, latest(), LoadBranchesRequest, LoadCommitsRequest, LoadRepoInfoRequest, makeViewState(), openFetchDialog(), receiveFetchTagsSetting() (+4 more)

### Community 104 - ".applyStructuredExtensionSetting"
Cohesion: 0.12
Nodes (24): vscode, doesPathExist(), getPathFromUri(), isDirectory(), Config, createRepoManager(), RepoManager, Logger (+16 more)

### Community 105 - "extension.test.ts"
Cohesion: 0.62
Nodes (5): buildToolbarButton(), buildToolbarDropdownGroup(), buildWebviewToolbar(), escapeAttribute(), renderToolbar()

### Community 106 - "utils/vscode.ts"
Cohesion: 0.26
Nodes (9): GitRef, CommitRefDisplayItem, groupCommitRefs(), ParsedRemoteBranch, parseRemoteBranchName(), createSignatureBearingTag(), loadRefs(), tagRefs() (+1 more)

### Community 116 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 117 - "CommitDetailsSection"
Cohesion: 0.48
Nodes (4): octicon(), OcticonName, octicons, svgIcons

### Community 119 - "repository"
Cohesion: 0.48
Nodes (4): buildAdditionalCommonProperties(), EnvironmentFacts, leadingDigits(), reducePlatformVersion()

### Community 120 - "statusBarItem.test.ts"
Cohesion: 0.38
Nodes (5): createItem(), FakeStatusBarItem, makeConfig(), makeContext(), state

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

## Knowledge Gaps
- **713 isolated node(s):** `path`, `esbuild`, `production`, `esbuildProblemMatcherPlugin`, `aliasPlugin` (+708 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `simple-git` connect `messageHandler.ts` to `config.ts`, `searchCommits.ts`, `remote.ts`, `package.json`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `dependencies` connect `package.json` to `messageHandler.ts`?**
  _High betweenness centrality (0.231) - this node is a cross-community bridge._
- **Why does `properties` connect `properties` to `properties`, `default`, `git-graph-libre.customBranchGlobPatterns`, `git-graph-libre.dateFormat`, `git-graph-libre.commitDetails.fileViewMode`, `git-graph-libre.dateType`, `git-graph-libre.graphStyle`, `git-graph-libre.tabIconColorTheme`, `ActionPayload`, `git-graph-libre.graph.fontSize`, `git-graph-libre.graph.rowHeight`, `git-graph-libre.shortHashLength`, `generateGitFileTree`, `git-graph-libre.autoCenterCommitDetailsView`, `git-graph-libre.fetchAvatars`, `git-graph-libre.initialLoadCommits`, `git-graph-libre.loadMoreCommits`, `git-graph-libre.maxDepthOfRepoSearch`, `git-graph-libre.revealHighlightColor`, `git-graph-libre.repository.includeUnreachableCommits`, `git-graph-libre.repository.showTags`, `git-graph-libre.showCurrentBranchByDefault`, `git-graph-libre.repository.muteCommitsNotAncestorsOfHead`, `git-graph-libre.showStatusBarItem`, `git-graph-libre.repository.includeReflog`, `git-graph-libre.repository.showStashes`, `git-graph-libre.repository.boldCheckedOutCommit`, `git-graph-libre.repository.fetchTagsByDefault`, `git-graph-libre.repository.muteCommitsNotAncestorsOfHead`, `git-graph-libre.showStatusBarItem`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._
- **What connects `path`, `esbuild`, `production` to the rest of the system?**
  _713 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sendMessage` be split into smaller, more focused modules?**
  _Cohesion score 0.06593406593406594 - nodes in this community are weakly interconnected._
- **Should `messageHandler.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09788359788359788 - nodes in this community are weakly interconnected._
- **Should `tagDetails.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._