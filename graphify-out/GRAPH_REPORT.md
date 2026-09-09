# Graph Report - git-graph-libre  (2026-09-09)

## Corpus Check
- 257 files · ~203,473 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2540 nodes · 5917 edges · 155 communities (144 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `28c2685e`
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
- push.test.ts
- Submodule discovery (`2026-08-21`)
- git-graph-libre.dialog.merge.noFastForward
- git-graph-libre.maxDepthOfRepoSearch
- parseStatusEntries
- [1.4.2] - 2026-09-03
- .applyStructuredExtensionSetting
- Maintainer and Agent Source of Truth
- [1.1.2] - 2026-07-29
- git-graph-libre.showUncommittedChanges
- [1.5.1] - 2026-09-07
- [0.2.0] - 2026-03-17

## God Nodes (most connected - your core abstractions)
1. `GitGraphView` - 325 edges
2. `runGitRaw()` - 92 edges
3. `escapeHtml()` - 83 edges
4. `sendMessage()` - 82 edges
5. `registerMessageHandlers()` - 77 edges
6. `showActionRunningDialog()` - 44 edges
7. `GitCommitNode` - 40 edges
8. `makeRepo()` - 39 edges
9. `showFormDialog()` - 38 edges
10. `Dropdown` - 35 edges

## Surprising Connections (you probably didn't know these)
- `createEventQueue()` --indirect_call--> `flush()`  [INFERRED]
  src/telemetry/eventQueue.ts → tests/backend/avatarManager.test.ts
- `loadRefs()` --calls--> `loadCommits()`  [EXTRACTED]
  tests/backend/queries/loadCommits/signedTags.test.ts → src/backend/queries/loadCommits.ts
- `registerHandlersForTest()` --calls--> `registerMessageHandlers()`  [EXTRACTED]
  tests/webview/messageHandler.test.ts → src/extension/messageHandler.ts
- `editRemote()` --references--> `simple-git`  [EXTRACTED]
  src/backend/actions/remote.ts → package.json
- `loadBranches()` --references--> `simple-git`  [EXTRACTED]
  src/backend/queries/loadBranches.ts → package.json

## Import Cycles
- None detected.

## Communities (155 total, 11 thin omitted)

### Community 0 - "sendMessage"
Cohesion: 0.07
Nodes (7): GitFileChange, showActionRunningDialog(), showCheckboxDialog(), showConfirmationDialog(), showFormDialog(), showRefInputDialog(), sendMessage()

### Community 1 - "messageHandler.test.ts"
Cohesion: 0.05
Nodes (67): GitClient, DiffDocument, applyExtensionSettings(), clampNumber(), ConfigInspection, expectArray(), expectBoolean(), expectObject() (+59 more)

### Community 2 - "tagDetails.ts"
Cohesion: 0.10
Nodes (10): createdDirs, makeBareRemote(), makeRepoWithRemotes(), git(), makeRepo(), repos, trackedRepo(), commitFile() (+2 more)

### Community 3 - "GitGraphView"
Cohesion: 0.06
Nodes (6): DropdownOption, GitGraphView, postWebviewDiagnostic(), requireElement(), trimRepoTrailingSeparators(), event()

### Community 4 - "Graph"
Cohesion: 0.06
Nodes (6): Branch, Graph, UnavailablePoint, Vertex, VertexOrNull, config

### Community 5 - ".constructor"
Cohesion: 0.19
Nodes (11): FileActionInput, FileActionPayloads, requireRepoRelativePath(), requireValue(), resetFileToRevision(), ActionInput, ActionPayloadByCommand, requirePaths() (+3 more)

### Community 6 - "messageHandler.ts"
Cohesion: 0.09
Nodes (45): simple-git, simple-git, checkoutBranch(), createBranch(), renameBranch(), checkoutCommit(), cherrypickCommit(), CommitActionInput (+37 more)

### Community 7 - "types.ts"
Cohesion: 0.05
Nodes (41): ExtensionSettingScope, ExtensionSettingType, JsonPrimitive, RequestCompareFileWithWorkingTree, RequestCopyToClipboard, RequestExportExtensionSettings, RequestFetchAvatar, RequestImportExtensionSettings (+33 more)

### Community 8 - "main.ts"
Cohesion: 0.06
Nodes (48): bindDialogInputDependencies(), bindFormDialogInputs(), COLUMN_HIDE_CLASSES, COMMIT_SIGNATURE_PRESENTATIONS, contextMenu, dialog, dialogBacking, errorToDiagnosticMessage() (+40 more)

### Community 9 - "rendering.test.ts"
Cohesion: 0.05
Nodes (25): clickContextMenuItem(), commitsWithStashRow, contextMenuItem(), defaultViewState, finishAction(), firstCommitDetails, getFindInput(), latestLoadBranchesRequest() (+17 more)

### Community 10 - "vscode"
Cohesion: 0.07
Nodes (23): vscode, webviewBridgeFactory(), normalizeRepoPath(), RelativePatternFactory, RepoFileWatcher, shouldRefreshGitPath(), shouldRefreshRepoPath(), trimTrailingSlashes() (+15 more)

### Community 11 - "ExtensionState"
Cohesion: 0.08
Nodes (18): AvatarManager, AvatarRequestItem, GitHubRemoteSource, GitLabRemoteSource, GravatarRemoteSource, RemoteSource, getRemoteUrl(), ExtensionState (+10 more)

### Community 12 - "Dropdown"
Cohesion: 0.12
Nodes (4): Dropdown, DropdownDisplayOptions, truncateMiddle(), truncateRefName()

### Community 13 - ".renderTable"
Cohesion: 0.08
Nodes (6): closestHTMLElement(), hideContextMenu(), hideContextMenuListener(), showContextMenu(), addListenerToClass(), unescapeHtml()

### Community 14 - "escapeHtml"
Cohesion: 0.09
Nodes (36): GitRepoConfig, ExtensionSetting, booleanSettingOrder, configValueText(), firstRemoteUrl(), getRepoBasename(), getRepoDisplayName(), getRepoIndentLevel() (+28 more)

### Community 15 - "Implementation Roadmap"
Cohesion: 0.09
Nodes (23): Implementation Roadmap, Phase 0.5: Backend Robustness and Data-Source Foundation, Phase 0: Guardrails and Baseline, Phase 10: Advanced History, Text, and Integrations, Phase 12: Toolbar Dropdown Name Truncation and Find Row (Bug), Phase 13: Settings Hub — Tabbed Widget, Color Editor, Settings Export, Phase 14: Reveal Highlight — Persistent Blink and Configurable Color, Phase 15: Tag Surfaces — Signed-Tag Distinction and Remote Tag Deletion (+15 more)

### Community 16 - "devDependencies"
Cohesion: 0.06
Nodes (31): @biomejs/biome, jsdom, devDependencies, @biomejs/biome, esbuild, jsdom, @primer/octicons, tsc-alias (+23 more)

### Community 17 - "scripts"
Cohesion: 0.06
Nodes (31): scripts, clean, compile, compile-tests, format, format:changed, format:changed:fix, format:fix (+23 more)

### Community 18 - "commandManager.ts"
Cohesion: 0.09
Nodes (29): buildExtensionUri(), getPathFromStr(), CommandApi, CommandManager, CommandManagerDeps, createCommandManager(), createVsCodeWindowApi(), findKnownRepoForPath() (+21 more)

### Community 19 - "extension.ts"
Cohesion: 0.10
Nodes (16): gitClientFactory(), GitInstance, decodeDiffDocUri(), decodeUriQueryArgs(), DiffDocProvider, activate(), createLogger(), timestamp() (+8 more)

### Community 20 - "index.ts"
Cohesion: 0.11
Nodes (18): boot(), columns(), commits, DragCase, dragCases, headers(), latest(), LoadBranchesRequest (+10 more)

### Community 21 - "global.d.ts"
Cohesion: 0.08
Nodes (25): GitCommitDetails, GitRemote, GitStash, AvatarImageCollection, Config, ContextMenuElement, DialogCheckboxInput, DialogInput (+17 more)

### Community 22 - "properties"
Cohesion: 0.07
Nodes (27): additionalProperties, type, additionalProperties, type, additionalProperties, type, additionalProperties, default (+19 more)

### Community 23 - "loadRepoInfo.ts"
Cohesion: 0.10
Nodes (31): loadBranches(), LoadBranchesInput, appendUnique(), emptyRepoInfo(), GitQueryContext, isInsideWorkTree(), loadAuthors(), loadConfig() (+23 more)

### Community 24 - "commitDetailsView.ts"
Cohesion: 0.11
Nodes (30): CommitDetailsFileViewMode, alterGitFileTree(), capitalizeSection(), CommitDetailsFileViewOptions, CommitDetailsSectionState, compactFolderChain(), compactFolderContents(), compareGitFolderEntries() (+22 more)

### Community 25 - ".showCommitDetails"
Cohesion: 0.16
Nodes (5): clampCommitDetailsHeight(), CommitDetailsSection, getSectionToggleLabel(), isCommitDetailsSection(), insertAfter()

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
Cohesion: 0.09
Nodes (38): ExportedRepoConfig, exportedRepoState(), exportRepoConfigFile(), getRepoConfigFilePath(), importRepoConfigFile(), isColumnWidths(), isCommitOrdering(), isIssueLinkingConfig() (+30 more)

### Community 30 - "Changelog"
Cohesion: 0.12
Nodes (17): [0.1.0] - 2026-02-18, [0.1.1] - 2026-02-23, [0.3.0] - 2026-03-26, [1.1.2] - 2026-07-29, [1.2.0] - 2026-07-29, [1.2.1] - 2026-07-31, [1.3.0] - 2026-08-06, [1.4.1] - 2026-09-03 (+9 more)

### Community 32 - "runGitRaw"
Cohesion: 0.48
Nodes (5): commitSearchFields(), findCommitIndexes(), formatFindMatchCount(), normalizeFindText(), commits

### Community 33 - "searchCommits.ts"
Cohesion: 0.08
Nodes (33): buildLogArgs(), buildLogFormat(), buildRefFormat(), getLog(), getRefs(), getUnreachableCommitHashes(), gitCommitSignatureStatuses, GitLogOptions (+25 more)

### Community 34 - "webviewL10n.ts"
Cohesion: 0.07
Nodes (31): GitRepoInfo, bootWebview(), commits, defaultViewState, latestRequest(), repoInfo, commits, latest() (+23 more)

### Community 35 - "linkify.ts"
Cohesion: 0.09
Nodes (3): CommitOrdering, createEmptyGitConfig(), hideDialogAndContextMenu()

### Community 36 - ".displayHash"
Cohesion: 0.25
Nodes (17): escapeRegExp(), GitQueryContext, hashSearch(), loadPositions(), logFormat(), mergeSearchResults(), normalizeMaxResults(), parseLogEntries() (+9 more)

### Community 37 - "package.json"
Cohesion: 0.10
Nodes (19): author, name, bugs, url, contributors, dependencies, description, displayName (+11 more)

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
Cohesion: 0.11
Nodes (24): rebaseCurrentBranch(), RebaseCurrentBranchInput, requireValue(), getUnsavedChanges(), arrayOfStrings(), findCredentialHostSeparator(), findUrlEnd(), GitCommandError (+16 more)

### Community 43 - "properties"
Cohesion: 0.12
Nodes (17): properties, title, type, configuration, default, description, type, default (+9 more)

### Community 44 - "default"
Cohesion: 0.12
Nodes (16): default, description, type, git-graph-libre.graphColors, oklch(59% 0.21 130), oklch(59% 0.21 145), oklch(59% 0.21 190), oklch(59% 0.21 245) (+8 more)

### Community 45 - "webviewHtml.ts"
Cohesion: 0.28
Nodes (10): getWebviewLocalizedStrings(), LocalizedStrings, buildWebviewStatusStrip(), escapeHtml(), buildToolbarButton(), buildToolbarDropdownGroup(), buildWebviewToolbar(), escapeAttribute() (+2 more)

### Community 46 - "git-graph-libre.customBranchGlobPatterns"
Cohesion: 0.13
Nodes (15): default, enum, enumDescriptions, markdownDescription, tags, type, git-graph-libre.telemetry.enabled, %config.telemetry.enabled.disabled% (+7 more)

### Community 47 - "queries.types.ts"
Cohesion: 0.17
Nodes (11): COMMIT_ORDERINGS, CommitDetailsResult, LoadBranchesResult, LoadCommitsResult, LoadRepoInfoResult, QueryPayloads, QueryRequest, QueryResponse (+3 more)

### Community 48 - "config.ts"
Cohesion: 0.16
Nodes (17): GitTagDetails, renderContextMenuHeader(), renderBooleanEditor(), renderColorStringEditor(), renderColorSwatch(), renderEnumEditor(), renderExtensionSettingEditor(), renderExtensionSettingRow() (+9 more)

### Community 49 - "oklchColor.ts"
Cohesion: 0.14
Nodes (15): commitDetailsFileViewModes, customBranchGlobPatterns(), DEFAULT_GRAPH_COLORS, getColorConfig(), getConfig(), getConfigWithLegacy(), getExplicitConfig(), getNumberConfig() (+7 more)

### Community 50 - "include"
Cohesion: 0.15
Nodes (12): ./backend/**/*.ts, ./extension/**/*.ts, ../src/backend/**/*.ts, ../src/webview/**/*.ts, ./webview/**/*.ts, compilerOptions, lib, extends (+4 more)

### Community 51 - "GitCommitNode"
Cohesion: 0.19
Nodes (11): Config, createRepoManager(), Logger, StatusBarItem, createItem(), FakeStatusBarItem, makeConfig(), makeContext() (+3 more)

### Community 52 - "settingsWidget.test.ts"
Cohesion: 0.16
Nodes (15): receiveExtensionSetting(), receiveLoadedCommits(), receive(), defaultViewState, headCommit, latestSent(), openPanel(), receiveLoadedCommits() (+7 more)

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
Cohesion: 0.13
Nodes (28): deleteBranch(), DeleteBranchInput, ActionInput, ActionPayloadByCommand, currentBranch(), deleteRemoteBranch(), fetchIntoLocalBranch(), loadRemoteNames() (+20 more)

### Community 59 - "actions.types.ts"
Cohesion: 0.17
Nodes (12): default, description, enum, enumDescriptions, type, git-graph-libre.repository.stashDisplay, both, %config.repository.stashDisplay.both% (+4 more)

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
Nodes (14): bootWithSettingsOpen(), click(), commits, dialogActions, extensionTabActions, latest(), LoadBranchesRequest, LoadCommitsRequest (+6 more)

### Community 68 - "activationEvents"
Cohesion: 0.16
Nodes (18): GitUncommittedChanges, renderCommitDetailsResizeHandle(), getStagingDropAction(), RenderUncommittedDetailsOptions, renderUncommittedDetailsRowHtml(), renderUncommittedFileItem(), renderUncommittedFileList(), renderUncommittedFolder() (+10 more)

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
Cohesion: 0.27
Nodes (11): ActionInput, ActionPayloadByCommand, applyStash(), branchFromStash(), cleanUntrackedFiles(), dropStash(), popStash(), pushStash() (+3 more)

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
Nodes (22): keywords, action, branch, cherry-pick, commit, devcontainer, diff, git (+14 more)

### Community 81 - "contextMenuVisibility.ts"
Cohesion: 0.15
Nodes (7): addUnsavedChangesCommit(), hasLoadedHead(), insertStashNodes(), loadCommits(), loadStashGraphNodes(), moveHeadIntoPage(), loadStashesMock

### Community 83 - "git-graph-libre.revealHighlightColor"
Cohesion: 0.13
Nodes (15): default, description, items, type, items, description, pattern, properties (+7 more)

### Community 84 - "src/tsconfig.json"
Cohesion: 0.40
Nodes (4): webview, exclude, extends, ../tsconfig.json

### Community 85 - "generateGitFileTree"
Cohesion: 0.24
Nodes (4): ContextMenuHeader, ContextMenuItem, isUncommittedSection(), UncommittedSection

### Community 86 - "contributes"
Cohesion: 0.50
Nodes (4): contributes, commands, menus, scm/title

### Community 87 - "git-graph-libre.autoCenterCommitDetailsView"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.autoCenterCommitDetailsView

### Community 88 - "git-graph-libre.commitDetails.compactFolders"
Cohesion: 0.14
Nodes (14): AI Development Knowledge Base, Branch and release policy, Commit signing, Current Architecture, Documentation and Verification Rules, Future direction: integrate with VS Code's native source control (`2026-09-03`), Graphify Map, Local Inputs Reviewed (+6 more)

### Community 89 - "git-graph-libre.fetchAvatars"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.fetchAvatars

### Community 90 - "git-graph-libre.initialLoadCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.initialLoadCommits

### Community 91 - "git-graph-libre.loadMoreCommits"
Cohesion: 0.14
Nodes (20): getNonce(), buildTelemetryConsentScreen(), escapeHtml(), buildWebviewHtml(), escapeJsonForHtml(), bundlePath(), createBundleTranslator(), LANGUAGE_LABELS (+12 more)

### Community 92 - "git-graph-libre.maxDepthOfRepoSearch"
Cohesion: 0.33
Nodes (8): deleteUserDetails(), editUserDetails(), requireScope(), requireValue(), setConfigValue(), unsetConfigValue(), UserConfigActionInput, UserConfigActionPayloads

### Community 93 - "git-graph-libre.revealHighlightColor"
Cohesion: 0.27
Nodes (9): isGitRepository(), evalPromises(), toRejectionError(), isDirectory(), parseSubmodulePathEntry(), readSubmodulePaths(), searchDirectoryForRepos(), searchSubmodules() (+1 more)

### Community 94 - "git-graph-libre.repository.includeUnreachableCommits"
Cohesion: 0.23
Nodes (10): bootWebview(), commits, defaultViewState, extensionSetting(), latest(), openBranchContextMenu(), openCommitContextMenu(), openContextMenu() (+2 more)

### Community 95 - "git-graph-libre.repository.showTags"
Cohesion: 0.35
Nodes (11): clamp(), formatOklch(), hexToOklch(), normalizeHue(), OklchColor, parseOklch(), rewritePaletteLightnessChroma(), rgbComponentsToOklch() (+3 more)

### Community 96 - "git-graph-libre.showCurrentBranchByDefault"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showCurrentBranchByDefault

### Community 97 - "git-graph-libre.repository.muteCommitsNotAncestorsOfHead"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.onlyFollowFirstParent

### Community 99 - "git-graph-libre.showStatusBarItem"
Cohesion: 0.23
Nodes (10): buildPathTree(), childFolder(), compact(), compareNodes(), emptyFolder(), findFolder(), PathTreeFolder, PathTreeLeaf (+2 more)

### Community 100 - "html.ts"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.dialog.createBranch.checkout

### Community 101 - "dialogStyles.test.ts"
Cohesion: 0.25
Nodes (7): css, dropdownCss, css, dropdownCss, readDropdownCss(), readWebviewCss(), WEBVIEW_CSS_FILES

### Community 102 - "categories"
Cohesion: 0.67
Nodes (3): categories, SCM Providers, Visualization

### Community 103 - "html.ts"
Cohesion: 0.15
Nodes (12): buildAdditionalCommonProperties(), EnvironmentFacts, leadingDigits(), reducePlatformVersion(), createNoopReporter(), createTelemetryReporter(), TelemetryReporter, TelemetryReporterOptions (+4 more)

### Community 104 - ".applyStructuredExtensionSetting"
Cohesion: 0.10
Nodes (21): doesPathExist(), getPathFromUri(), isDirectory(), createRepoSearch(), RepoSearch, ScanLogger, scanLogLevel(), createRepoWatcher() (+13 more)

### Community 105 - "extension.test.ts"
Cohesion: 0.33
Nodes (4): Contributors to the AGPL-licensed work, Git Graph Libre — license and provenance, Incorporated MIT-licensed material, NOTICE

### Community 106 - "utils/vscode.ts"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.loadMoreCommits

### Community 108 - "tableStyles.test.ts"
Cohesion: 0.18
Nodes (9): ActionPayloads, ActionRequest, ActionResponse, GIT_CONFIG_SCOPES, GIT_PUSH_BRANCH_MODES, GitCommandStatus, GitConfigScope, GitPushBranchMode (+1 more)

### Community 109 - "git-graph-libre.repository.includeReflog"
Cohesion: 0.50
Nodes (4): [1.0.0] - 2026-07-01, Added, Changed, Fixed

### Community 116 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 117 - "CommitDetailsSection"
Cohesion: 0.15
Nodes (8): CommitLoadFacts, hasNestedRepo(), isNestedRepo(), ViewFeatureReporter, branch, quietLoad, signedTag, unsignedTag

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
Cohesion: 0.22
Nodes (8): BootInput, bootWebview(), defaultViewState, emptyRepoInfo, latestRequest(), normalCommits, populatedRepoInfo, uncommittedChangesRow

### Community 127 - ".value"
Cohesion: 0.22
Nodes (9): BUG-1 — `pushTag` hardcodes the `origin` remote, BUG-2 — The tag remote surface is a stub beside the branch remote surface, BUG-3 — "Lightweight" creates a signed annotated tag and opens an editor window, BUG-4 — Branch and tag labels turn gray on every merge commit, BUG-5 — The "watching" eye status bar item can never appear, BUG-6 — Cross-cutting: tag actions bypass the command log, Immediate TODOs — High-Priority Bug Backlog (`2026-08-25`), Suggested slice order (+1 more)

### Community 128 - "repoSearch.ts"
Cohesion: 0.16
Nodes (12): formatQueryError(), handleActionResponse(), handleCommitDetailsResponse(), handleCreateArchiveResponse(), handleExtensionSettingsFileResponse(), handleTagDetailsResponse(), handleUncommittedDetailsResponse(), hideDialog() (+4 more)

### Community 129 - "AI_DEV_KNOWLEDGE_BASE.md"
Cohesion: 0.29
Nodes (3): Agent Instructions, Claude Instructions, Codex Instructions

### Community 131 - "Telemetry (`telemetry` branch, `2026-08-26`)"
Cohesion: 0.50
Nodes (4): Consent epoch — session record (`2026-09-02`), Consent prompt (`2026-09-02`), End-to-end verification of the sender seam (`2026-09-02`), Telemetry (`telemetry` branch, `2026-08-26`)

### Community 132 - "CommitDetailsSection"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.muteMergeCommits

### Community 133 - ".value"
Cohesion: 0.25
Nodes (8): Follow-up — where stashes appear, and a checkout default, Graph and stash UI slices (`2026-09-09`), Licence review of these slices (`2026-09-09`), Release gate for these slices (`2026-09-09`), Slice 1 — Checkbox appearance, Slice 2 — Remote sub-label restyle, Slice 3 — Stash list above the table, Slice 4 — Stashes as graph rows

### Community 134 - "utils/vscode.ts"
Cohesion: 0.39
Nodes (5): parseStatusEntries(), uncommittedDetails(), UncommittedDetailsInput, UNMERGED_PAIRS, GitUncommittedFile

### Community 135 - "statusStrip.ts"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.includeReflog

### Community 137 - "git.types.ts"
Cohesion: 0.67
Nodes (3): [0.4.0] - 2026-04-10, Added, Fixed

### Community 138 - "branch.ts"
Cohesion: 0.23
Nodes (10): createCommitNodes(), GitRef, CommitRefDisplayItem, groupCommitRefs(), ParsedRemoteBranch, parseRemoteBranchName(), createSignatureBearingTag(), loadRefs() (+2 more)

### Community 139 - "octicons.ts"
Cohesion: 0.48
Nodes (4): octicon(), OcticonName, octicons, svgIcons

### Community 140 - ".showTagDetails"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.commitDetails.compactFolders

### Community 141 - "contextMenuVisibility.ts"
Cohesion: 0.67
Nodes (3): [1.1.1] - 2026-07-29, Added, Changed

### Community 142 - "[1.4.2] - 2026-09-03"
Cohesion: 0.67
Nodes (3): Added, Changed, [Unreleased]

### Community 143 - "push.test.ts"
Cohesion: 0.33
Nodes (3): createdDirs, makeBareRemote(), makeRepoWithRemotes()

### Community 145 - "git-graph-libre.dialog.merge.noFastForward"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.dialog.merge.noFastForward

### Community 146 - "git-graph-libre.maxDepthOfRepoSearch"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.maxDepthOfRepoSearch

### Community 147 - "parseStatusEntries"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.showTags

### Community 148 - "[1.4.2] - 2026-09-03"
Cohesion: 0.67
Nodes (3): [1.4.2] - 2026-09-03, Added, Fixed

### Community 149 - ".applyStructuredExtensionSetting"
Cohesion: 0.50
Nodes (4): [1.5.0] - 2026-09-07, Added, Changed, Fixed

### Community 150 - "Maintainer and Agent Source of Truth"
Cohesion: 0.67
Nodes (3): activationEvents, onStartupFinished, workspaceContains:.git

### Community 151 - "[1.1.2] - 2026-07-29"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.dialog.pullBranch.noFastForward

### Community 152 - "git-graph-libre.showUncommittedChanges"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showUncommittedChanges

### Community 153 - "[1.5.1] - 2026-09-07"
Cohesion: 0.67
Nodes (3): [1.5.1] - 2026-09-07, Changed, Fixed

### Community 154 - "[0.2.0] - 2026-03-17"
Cohesion: 0.67
Nodes (3): [0.2.0] - 2026-03-17, Added, Fixed

## Knowledge Gaps
- **801 isolated node(s):** `path`, `esbuild`, `production`, `esbuildProblemMatcherPlugin`, `aliasPlugin` (+796 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `simple-git` connect `messageHandler.ts` to `package.json`, `gitRunner.ts`, `loadRepoInfo.ts`, `userConfig.ts`, `remote.ts`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Why does `dependencies` connect `package.json` to `messageHandler.ts`?**
  _High betweenness centrality (0.239) - this node is a cross-community bridge._
- **Why does `properties` connect `properties` to `CommitDetailsSection`, `statusStrip.ts`, `.showTagDetails`, `git-graph-libre.dialog.merge.noFastForward`, `git-graph-libre.maxDepthOfRepoSearch`, `parseStatusEntries`, `properties`, `[1.1.2] - 2026-07-29`, `git-graph-libre.showUncommittedChanges`, `default`, `git-graph-libre.customBranchGlobPatterns`, `git-graph-libre.dateFormat`, `actions.types.ts`, `git-graph-libre.commitDetails.fileViewMode`, `git-graph-libre.dateType`, `git-graph-libre.graphStyle`, `git-graph-libre.tabIconColorTheme`, `ActionPayload`, `git-graph-libre.graph.fontSize`, `git-graph-libre.graph.rowHeight`, `git-graph-libre.shortHashLength`, `git-graph-libre.revealHighlightColor`, `git-graph-libre.autoCenterCommitDetailsView`, `git-graph-libre.fetchAvatars`, `git-graph-libre.initialLoadCommits`, `git-graph-libre.showCurrentBranchByDefault`, `git-graph-libre.repository.muteCommitsNotAncestorsOfHead`, `html.ts`, `utils/vscode.ts`, `git-graph-libre.repository.includeReflog`, `git-graph-libre.repository.showStashes`, `git-graph-libre.repository.boldCheckedOutCommit`, `git-graph-libre.repository.fetchTagsByDefault`, `git-graph-libre.repository.muteCommitsNotAncestorsOfHead`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **What connects `path`, `esbuild`, `production` to the rest of the system?**
  _801 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sendMessage` be split into smaller, more focused modules?**
  _Cohesion score 0.06654622101776574 - nodes in this community are weakly interconnected._
- **Should `messageHandler.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05087719298245614 - nodes in this community are weakly interconnected._
- **Should `tagDetails.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10336817653890824 - nodes in this community are weakly interconnected._