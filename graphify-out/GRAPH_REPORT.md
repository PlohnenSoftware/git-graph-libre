# Graph Report - git-graph-libre  (2026-09-10)

## Corpus Check
- 257 files · ~207,458 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2556 nodes · 5941 edges · 160 communities (147 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2ef27d6c`
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
- merge.ts
- AI_DEV_KNOWLEDGE_BASE.md
- dom.ts
- Telemetry (`telemetry` branch, `2026-08-26`)
- CommitDetailsSection
- .value
- uncommittedDetails.ts
- statusStrip.ts
- statusBarItem.test.ts
- git.types.ts
- remoteRefs.ts
- octicons.ts
- .showTagDetails
- contextMenuVisibility.ts
- [1.4.2] - 2026-09-03
- push.test.ts
- Submodule discovery (`2026-08-21`)
- git-graph-libre.dialog.merge.noFastForward
- git-graph-libre.maxDepthOfRepoSearch
- generateGitFileTree
- [1.4.2] - 2026-09-03
- .applyStructuredExtensionSetting
- Maintainer and Agent Source of Truth
- [1.1.2] - 2026-07-29
- git-graph-libre.showUncommittedChanges
- [1.5.1] - 2026-09-07
- [0.2.0] - 2026-03-17
- git-graph-libre.fetchAvatars
- .applyStructuredExtensionSetting
- categories
- extension.test.ts
- statusStrip.ts

## God Nodes (most connected - your core abstractions)
1. `GitGraphView` - 326 edges
2. `runGitRaw()` - 92 edges
3. `escapeHtml()` - 84 edges
4. `sendMessage()` - 83 edges
5. `registerMessageHandlers()` - 77 edges
6. `showActionRunningDialog()` - 44 edges
7. `GitCommitNode` - 40 edges
8. `showFormDialog()` - 40 edges
9. `makeRepo()` - 39 edges
10. `Dropdown` - 35 edges

## Surprising Connections (you probably didn't know these)
- `registerHandlersForTest()` --calls--> `registerMessageHandlers()`  [EXTRACTED]
  tests/webview/messageHandler.test.ts → src/extension/messageHandler.ts
- `createEventQueue()` --indirect_call--> `flush()`  [INFERRED]
  src/telemetry/eventQueue.ts → tests/backend/avatarManager.test.ts
- `editRemote()` --references--> `simple-git`  [EXTRACTED]
  src/backend/actions/remote.ts → package.json
- `loadBranches()` --references--> `simple-git`  [EXTRACTED]
  src/backend/queries/loadBranches.ts → package.json
- `runGitRaw()` --references--> `simple-git`  [EXTRACTED]
  src/backend/utils/gitRunner.ts → package.json

## Import Cycles
- None detected.

## Communities (160 total, 13 thin omitted)

### Community 0 - "sendMessage"
Cohesion: 0.07
Nodes (10): showActionRunningDialog(), showCheckboxDialog(), showConfirmationDialog(), showDialog(), showErrorDialog(), showFormDialog(), showRefInputDialog(), showSelectDialog() (+2 more)

### Community 1 - "messageHandler.test.ts"
Cohesion: 0.08
Nodes (32): GitClient, createSignatureBearingTag(), registerHandlersForTest(), commands, configurationKey(), ConfigurationTarget, configurationUpdates, configurationWorkspaceFolderValues (+24 more)

### Community 2 - "tagDetails.ts"
Cohesion: 0.09
Nodes (13): getRemoteUrl(), createdDirs, makeBareRemote(), makeRepoWithRemotes(), createdDirs, makeBareRemote(), makeRepoWithRemotes(), git() (+5 more)

### Community 3 - "GitGraphView"
Cohesion: 0.06
Nodes (5): GitCommitNode, DropdownOption, GitGraphView, requireElement(), arraysEqual()

### Community 4 - "Graph"
Cohesion: 0.06
Nodes (6): Branch, Graph, UnavailablePoint, Vertex, VertexOrNull, config

### Community 5 - ".constructor"
Cohesion: 0.12
Nodes (13): commitDetailsFileViewModes, customBranchGlobPatterns(), DEFAULT_GRAPH_COLORS, getColorConfig(), getConfig(), getConfigWithLegacy(), getExplicitConfig(), getNumberConfig() (+5 more)

### Community 6 - "messageHandler.ts"
Cohesion: 0.11
Nodes (34): simple-git, simple-git, checkoutBranch(), createBranch(), deleteBranch(), DeleteBranchInput, renameBranch(), deleteRemoteBranch() (+26 more)

### Community 7 - "types.ts"
Cohesion: 0.05
Nodes (42): CustomBranchGlobPattern, DateFormat, GraphStyle, JsonPrimitive, RequestCompareFileWithWorkingTree, RequestCopyToClipboard, RequestExportExtensionSettings, RequestFetchAvatar (+34 more)

### Community 8 - "main.ts"
Cohesion: 0.07
Nodes (34): bindLockedDialogInputs(), COLUMN_HIDE_CLASSES, COMMIT_SIGNATURE_PRESENTATIONS, contextMenu, dialog, dialogBacking, errorToDiagnosticMessage(), gitGraph (+26 more)

### Community 9 - "rendering.test.ts"
Cohesion: 0.05
Nodes (27): clickContextMenuItem(), commitsWithStashRow, contextMenuItem(), defaultViewState, finishAction(), firstCommitDetails, getFindInput(), latestLoadBranchesRequest() (+19 more)

### Community 10 - "vscode"
Cohesion: 0.08
Nodes (20): webviewBridgeFactory(), normalizeRepoPath(), RelativePatternFactory, RepoFileWatcher, shouldRefreshGitPath(), shouldRefreshRepoPath(), trimTrailingSlashes(), watchedGitFiles (+12 more)

### Community 11 - "ExtensionState"
Cohesion: 0.08
Nodes (16): AvatarManager, AvatarRequestItem, GitHubRemoteSource, GitLabRemoteSource, GravatarRemoteSource, RemoteSource, ExtensionState, Avatar (+8 more)

### Community 12 - "Dropdown"
Cohesion: 0.12
Nodes (4): Dropdown, DropdownDisplayOptions, truncateMiddle(), truncateRefName()

### Community 13 - ".renderTable"
Cohesion: 0.08
Nodes (7): closestHTMLElement(), hideContextMenu(), hideContextMenuListener(), renderContextMenuHeader(), showContextMenu(), addListenerToClass(), unescapeHtml()

### Community 14 - "escapeHtml"
Cohesion: 0.13
Nodes (25): SettingsWidgetTab, booleanSettingOrder, configValueText(), firstRemoteUrl(), getRepoBasename(), getRepoDisplayName(), getRepoIndentLevel(), getRepoParent() (+17 more)

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
Cohesion: 0.10
Nodes (20): gitClientFactory(), GitInstance, getPathFromStr(), decodeDiffDocUri(), decodeUriQueryArgs(), DiffDocProvider, CommandApi, CommandManager (+12 more)

### Community 19 - "extension.ts"
Cohesion: 0.15
Nodes (21): addRemote(), AddRemoteInput, assertPruneTagsSupported(), cleanRemoteName(), cleanRemoteUrl(), deleteRemote(), DeleteRemoteInput, editRemote() (+13 more)

### Community 20 - "index.ts"
Cohesion: 0.11
Nodes (18): boot(), columns(), commits, DragCase, dragCases, headers(), latest(), LoadBranchesRequest (+10 more)

### Community 21 - "global.d.ts"
Cohesion: 0.08
Nodes (23): GitRemote, GitStash, AvatarImageCollection, Config, ContextMenuElement, DialogCheckboxInput, DialogInputDependency, DialogInputLock (+15 more)

### Community 22 - "properties"
Cohesion: 0.07
Nodes (27): additionalProperties, type, additionalProperties, type, additionalProperties, type, additionalProperties, default (+19 more)

### Community 23 - "loadRepoInfo.ts"
Cohesion: 0.17
Nodes (20): commitComparison(), CommitComparisonInput, fetchComparisonDiff(), requireRef(), commitDetails(), CommitDetailsInput, fetchNameStatus(), fetchNumStat() (+12 more)

### Community 24 - "commitDetailsView.ts"
Cohesion: 0.07
Nodes (49): CommitDetailsFileViewMode, IssueLinkingConfig, alterGitFileTree(), capitalizeSection(), CommitDetailsFileViewOptions, CommitDetailsSectionState, compactFolderChain(), compactFolderContents() (+41 more)

### Community 25 - ".showCommitDetails"
Cohesion: 0.14
Nodes (5): GitFileChange, clampCommitDetailsHeight(), CommitDetailsSection, isCommitDetailsSection(), insertAfter()

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (22): mocha, node, ./node_modules/@types, compilerOptions, esModuleInterop, isolatedModules, lib, module (+14 more)

### Community 27 - "remote.ts"
Cohesion: 0.16
Nodes (21): clampNumber(), ConfigInspection, expectArray(), expectBoolean(), expectObject(), expectString(), explicitExtensionSettings(), listPackageNlsLanguages() (+13 more)

### Community 28 - "path.ts"
Cohesion: 0.22
Nodes (16): checkoutCommit(), cherrypickCommit(), CommitActionInput, CommitActionPayloads, dropCommit(), dropCommitSelection(), editHeadCommitMessage(), normalizeCommitMessage() (+8 more)

### Community 29 - "repoConfigFile.ts"
Cohesion: 0.18
Nodes (20): ExportedRepoConfig, exportedRepoState(), exportRepoConfigFile(), getRepoConfigFilePath(), importRepoConfigFile(), isColumnWidths(), isCommitOrdering(), isIssueLinkingConfig() (+12 more)

### Community 30 - "Changelog"
Cohesion: 0.14
Nodes (14): [0.1.0] - 2026-02-18, [0.1.1] - 2026-02-23, [1.1.2] - 2026-07-29, [1.2.0] - 2026-07-29, [1.2.1] - 2026-07-31, [1.3.0] - 2026-08-06, [1.4.1] - 2026-09-03, Added (+6 more)

### Community 31 - "GitCommandRecorder"
Cohesion: 0.14
Nodes (16): buildActivationPayload(), createEventQueue(), EventQueue, EventQueueOptions, QueuedTelemetryEvent, TelemetryEventPayload, createTelemetrySender(), isStorablePrimitive() (+8 more)

### Community 32 - "runGitRaw"
Cohesion: 0.48
Nodes (5): commitSearchFields(), findCommitIndexes(), formatFindMatchCount(), normalizeFindText(), commits

### Community 33 - "searchCommits.ts"
Cohesion: 0.11
Nodes (28): addUnsavedChangesCommit(), buildLogArgs(), buildLogFormat(), buildRefFormat(), getLog(), getRefs(), getUnreachableCommitHashes(), gitCommitSignatureStatuses (+20 more)

### Community 34 - "webviewL10n.ts"
Cohesion: 0.09
Nodes (24): GitRepoInfo, bootWebview(), commits, defaultViewState, latestRequest(), repoInfo, mount(), viewStateFixture (+16 more)

### Community 35 - "linkify.ts"
Cohesion: 0.09
Nodes (23): DateType, GitCommitDetails, GitCommitSearchResult, GitCommitSignature, GitCommitSignatureStatus, GitConfigValue, GitLogEntry, GitRefData (+15 more)

### Community 36 - ".displayHash"
Cohesion: 0.25
Nodes (17): escapeRegExp(), GitQueryContext, hashSearch(), loadPositions(), logFormat(), mergeSearchResults(), normalizeMaxResults(), parseLogEntries() (+9 more)

### Community 37 - "package.json"
Cohesion: 0.10
Nodes (19): author, name, bugs, url, contributors, dependencies, description, displayName (+11 more)

### Community 38 - "commit.ts"
Cohesion: 0.16
Nodes (22): applySignatureRecord(), cleanEmail(), emptySignature(), failedSignatureCodes, markBadSignature(), markFailedSignature(), markGoodSignature(), markValidSignature() (+14 more)

### Community 39 - ".bindSettingsWidget"
Cohesion: 0.06
Nodes (4): createEmptyGitConfig(), hideDialogAndContextMenu(), postWebviewDiagnostic(), RepoBooleanSettingKey

### Community 40 - "keyboardNavigation.test.ts"
Cohesion: 0.15
Nodes (11): commitDetailsFor(), CommitDetailsRequest, commitRow(), latestRequest(), LoadBranchesRequest, LoadCommitsRequest, loadedCommits, openCommitDetails() (+3 more)

### Community 41 - "loadCommits.ts"
Cohesion: 0.16
Nodes (21): appendUnique(), emptyRepoInfo(), GitQueryContext, isInsideWorkTree(), loadAuthors(), loadConfig(), loadHead(), loadRemotes() (+13 more)

### Community 42 - "gitRunner.ts"
Cohesion: 0.10
Nodes (29): loadBranches(), LoadBranchesInput, loadStashes(), parseStashes(), parseStashIndex(), StashQueryContext, StashQueryResult, GitQueryError (+21 more)

### Community 43 - "properties"
Cohesion: 0.12
Nodes (16): properties, title, type, configuration, default, description, type, default (+8 more)

### Community 44 - "default"
Cohesion: 0.06
Nodes (31): default, description, items, type, default, description, items, type (+23 more)

### Community 45 - "webviewHtml.ts"
Cohesion: 0.31
Nodes (12): ActionInput, ActionPayloadByCommand, applyStash(), branchFromStash(), cleanUntrackedFiles(), dropStash(), popStash(), pushStash() (+4 more)

### Community 46 - "git-graph-libre.customBranchGlobPatterns"
Cohesion: 0.13
Nodes (15): default, enum, enumDescriptions, markdownDescription, tags, type, git-graph-libre.telemetry.enabled, %config.telemetry.enabled.disabled% (+7 more)

### Community 47 - "queries.types.ts"
Cohesion: 0.11
Nodes (24): ActionInput, ActionPayloadByCommand, currentBranch(), fetchIntoLocalBranch(), loadRemoteNames(), parseRemoteBranch(), pullBranch(), pushBranch() (+16 more)

### Community 48 - "config.ts"
Cohesion: 0.15
Nodes (14): GitRepoConfig, ExtensionSetting, renderExtensionSettingRow(), renderExtensionTab(), renderSettingsWidget(), scopeLabel(), SettingsWidgetModel, tabHiddenAttr() (+6 more)

### Community 49 - "oklchColor.ts"
Cohesion: 0.18
Nodes (13): DiffDocument, applyExtensionSettings(), sanitizeImportedExtensionSettings(), ExportedExtensionSettings, importExtensionSettingsFile(), isRecord(), parseExportedExtensionSettings(), JsonValue (+5 more)

### Community 50 - "include"
Cohesion: 0.15
Nodes (12): ./backend/**/*.ts, ./extension/**/*.ts, ../src/backend/**/*.ts, ../src/webview/**/*.ts, ./webview/**/*.ts, compilerOptions, lib, extends (+4 more)

### Community 51 - "GitCommitNode"
Cohesion: 0.10
Nodes (38): vscode, buildExtensionUri(), doesPathExist(), getPathFromUri(), isDirectory(), Config, activate(), createRepoManager() (+30 more)

### Community 52 - "settingsWidget.test.ts"
Cohesion: 0.18
Nodes (13): receive(), defaultViewState, headCommit, latestSent(), openPanel(), receiveLoadedCommits(), receiveUncommittedDetails(), reloadGraphWithCommits() (+5 more)

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
Cohesion: 0.31
Nodes (8): createCommitNodes(), GitRef, CommitRefDisplayItem, groupCommitRefs(), ParsedRemoteBranch, parseRemoteBranchName(), tagRefs(), ref()

### Community 59 - "actions.types.ts"
Cohesion: 0.14
Nodes (9): GitTagDetails, DialogInput, handleActionResponse(), handleCreateArchiveResponse(), handleExtensionSettingsFileResponse(), handleTagDetailsResponse(), hideDialog(), refreshGraphOrDisplayError() (+1 more)

### Community 60 - "abbrevCommit"
Cohesion: 0.20
Nodes (9): ActionPayloads, ActionRequest, ActionResponse, GIT_CONFIG_SCOPES, GIT_PUSH_BRANCH_MODES, GitCommandStatus, GitConfigScope, GitPushBranchMode (+1 more)

### Community 61 - "getCommitDate"
Cohesion: 0.31
Nodes (8): getCommitDate(), formatRelativeDate(), getMonth(), getRelativeFormatter, pad2(), RELATIVE_UNITS, ago(), NOW

### Community 62 - "README.md"
Cohesion: 0.29
Nodes (6): Configuration, Features, Installation, License, Telemetry, Why this fork

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

### Community 67 - "contextMenuVisibilityRendering.test.ts"
Cohesion: 0.15
Nodes (13): click(), commits, dialogActions, extensionTabActions, latest(), LoadBranchesRequest, LoadCommitsRequest, LoadRepoInfoRequest (+5 more)

### Community 68 - "activationEvents"
Cohesion: 0.33
Nodes (10): renderBooleanEditor(), renderColorStringEditor(), renderColorSwatch(), renderEnumEditor(), renderExtensionSettingEditor(), renderGraphColorsEditor(), renderJsonEditor(), renderNumberEditor() (+2 more)

### Community 69 - "generate-octicons.js"
Cohesion: 0.22
Nodes (7): data, entries, fs, ICON_NAMES, missing, outFile, path

### Community 70 - "merge.ts"
Cohesion: 0.19
Nodes (9): rebaseCurrentBranch(), RebaseCurrentBranchInput, requireValue(), ActionInput, ActionPayloadByCommand, requirePaths(), stageFiles(), unstageFiles() (+1 more)

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
Cohesion: 0.21
Nodes (12): bindDialogInputDependencies(), bindFormDialogInputs(), getDialogFormValues(), getDialogInputFallbackValue(), getDialogInputValue(), getFormDialogInputState(), getTextRefDialogClassName(), isDialogInputVisible() (+4 more)

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
Cohesion: 0.06
Nodes (34): default, description, enum, enumDescriptions, type, keywords, git-graph-libre.repository.stashDisplay, action (+26 more)

### Community 81 - "contextMenuVisibility.ts"
Cohesion: 0.15
Nodes (6): channelLines, gitClientStub, makeContext(), repoManagerStub, repoSearchStub, vscodeMocks

### Community 82 - "dom.ts"
Cohesion: 0.20
Nodes (7): bootWebview(), commits, Defaults, latest(), makeViewState(), receiveSetting(), repoInfo

### Community 84 - "src/tsconfig.json"
Cohesion: 0.40
Nodes (4): webview, exclude, extends, ../tsconfig.json

### Community 85 - "generateGitFileTree"
Cohesion: 0.43
Nodes (6): interpolate(), loadEnglishTranslations(), resolveTranslationPath(), t(), TranslationRecord, TranslationValue

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
Cohesion: 0.48
Nodes (4): buildAdditionalCommonProperties(), EnvironmentFacts, leadingDigits(), reducePlatformVersion()

### Community 90 - "git-graph-libre.initialLoadCommits"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.initialLoadCommits

### Community 91 - "git-graph-libre.loadMoreCommits"
Cohesion: 0.08
Nodes (31): getNonce(), buildTelemetryConsentScreen(), escapeHtml(), buildWebviewHtml(), escapeJsonForHtml(), getWebviewLocalizedStrings(), LocalizedStrings, bundlePath() (+23 more)

### Community 92 - "git-graph-libre.maxDepthOfRepoSearch"
Cohesion: 0.33
Nodes (8): deleteUserDetails(), editUserDetails(), requireScope(), requireValue(), setConfigValue(), unsetConfigValue(), UserConfigActionInput, UserConfigActionPayloads

### Community 93 - "git-graph-libre.revealHighlightColor"
Cohesion: 0.32
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
Cohesion: 0.06
Nodes (42): GitUncommittedChanges, GitUncommittedFile, buildToolbarButton(), buildToolbarDropdownGroup(), buildWebviewToolbar(), escapeAttribute(), octicon(), OcticonName (+34 more)

### Community 100 - "html.ts"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.dialog.createBranch.checkout

### Community 101 - "dialogStyles.test.ts"
Cohesion: 0.25
Nodes (7): css, dropdownCss, css, dropdownCss, readDropdownCss(), readWebviewCss(), WEBVIEW_CSS_FILES

### Community 102 - "categories"
Cohesion: 0.67
Nodes (3): [0.3.0] - 2026-03-26, Added, Changed

### Community 103 - "html.ts"
Cohesion: 0.18
Nodes (8): createNoopReporter(), createTelemetryReporter(), Batch, QueuedEvent, env, resetVscodeMock(), telemetryLoggers, reporterFor()

### Community 104 - ".applyStructuredExtensionSetting"
Cohesion: 0.33
Nodes (8): FolderChangeEvent, makeFolder(), makeStubs(), makeUri(), StubFolder, StubUri, tick(), waitFor()

### Community 105 - "extension.test.ts"
Cohesion: 0.33
Nodes (4): Contributors to the AGPL-licensed work, Git Graph Libre — license and provenance, Incorporated MIT-licensed material, NOTICE

### Community 106 - "utils/vscode.ts"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.loadMoreCommits

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
Cohesion: 0.15
Nodes (14): ARCHIVE_FORMATS, ArchiveFormat, archiveFormatFromPath(), createArchive(), CreateArchiveInput, requireArchiveFormat(), requireValue(), FileActionInput (+6 more)

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
Cohesion: 0.27
Nodes (9): commits, latest(), LoadBranchesRequest, LoadCommitsRequest, LoadRepoInfoRequest, makeViewState(), openFetchDialog(), receiveFetchTagsSetting() (+1 more)

### Community 127 - ".value"
Cohesion: 0.22
Nodes (9): BUG-1 — `pushTag` hardcodes the `origin` remote, BUG-2 — The tag remote surface is a stub beside the branch remote surface, BUG-3 — "Lightweight" creates a signed annotated tag and opens an editor window, BUG-4 — Branch and tag labels turn gray on every merge commit, BUG-5 — The "watching" eye status bar item can never appear, BUG-6 — Cross-cutting: tag actions bypass the command log, Immediate TODOs — High-Priority Bug Backlog (`2026-08-25`), Suggested slice order (+1 more)

### Community 128 - "merge.ts"
Cohesion: 0.39
Nodes (6): buildMergeArgs(), MergeActionInput, MergeActionPayloads, mergeBranch(), mergeCommit(), requireValue()

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
Cohesion: 0.18
Nodes (11): Follow-up — list/tree toggle, and the stash-branch dialog, Follow-up — staging catalogue view, and two rendering fixes, Follow-up — where stashes appear, and a checkout default, Graph and stash UI slices (`2026-09-09`), Licence review of these slices (`2026-09-09`), Release gate for these slices (`2026-09-09`), Slice 1 — Checkbox appearance, Slice 2 — Remote sub-label restyle (+3 more)

### Community 134 - "uncommittedDetails.ts"
Cohesion: 0.48
Nodes (4): parseStatusEntries(), uncommittedDetails(), UncommittedDetailsInput, UNMERGED_PAIRS

### Community 135 - "statusStrip.ts"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.includeReflog

### Community 136 - "statusBarItem.test.ts"
Cohesion: 0.38
Nodes (5): createItem(), FakeStatusBarItem, makeConfig(), makeContext(), state

### Community 137 - "git.types.ts"
Cohesion: 0.67
Nodes (3): [0.4.0] - 2026-04-10, Added, Fixed

### Community 138 - "remoteRefs.ts"
Cohesion: 0.70
Nodes (4): isHiddenRemoteRef(), normalizeHiddenRemotes(), remoteExcludeArgs(), remoteNameFromRefName()

### Community 139 - "octicons.ts"
Cohesion: 0.40
Nodes (5): default, description, pattern, type, git-graph-libre.revealHighlightColor

### Community 140 - ".showTagDetails"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.commitDetails.compactFolders

### Community 141 - "contextMenuVisibility.ts"
Cohesion: 0.67
Nodes (3): [1.1.1] - 2026-07-29, Added, Changed

### Community 142 - "[1.4.2] - 2026-09-03"
Cohesion: 0.40
Nodes (5): Added, Changed, Changed, Fixed, [Unreleased]

### Community 143 - "push.test.ts"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.includeUnreachableCommits

### Community 145 - "git-graph-libre.dialog.merge.noFastForward"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.dialog.merge.noFastForward

### Community 146 - "git-graph-libre.maxDepthOfRepoSearch"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.maxDepthOfRepoSearch

### Community 147 - "generateGitFileTree"
Cohesion: 0.50
Nodes (5): generateGitFileTree(), formatQueryError(), handleCommitComparisonResponse(), handleCommitDetailsResponse(), handleUncommittedDetailsResponse()

### Community 148 - "[1.4.2] - 2026-09-03"
Cohesion: 0.67
Nodes (3): [1.4.2] - 2026-09-03, Added, Fixed

### Community 149 - ".applyStructuredExtensionSetting"
Cohesion: 0.50
Nodes (4): [1.5.0] - 2026-09-07, Added, Changed, Fixed

### Community 150 - "Maintainer and Agent Source of Truth"
Cohesion: 0.67
Nodes (3): activationEvents, onStartupFinished, workspaceContains:.git

### Community 152 - "git-graph-libre.showUncommittedChanges"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showUncommittedChanges

### Community 153 - "[1.5.1] - 2026-09-07"
Cohesion: 0.67
Nodes (3): [1.5.1] - 2026-09-07, Changed, Fixed

### Community 154 - "[0.2.0] - 2026-03-17"
Cohesion: 0.67
Nodes (3): [0.2.0] - 2026-03-17, Added, Fixed

### Community 155 - "git-graph-libre.fetchAvatars"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.fetchAvatars

### Community 157 - "categories"
Cohesion: 0.67
Nodes (3): categories, SCM Providers, Visualization

## Knowledge Gaps
- **810 isolated node(s):** `path`, `esbuild`, `production`, `esbuildProblemMatcherPlugin`, `aliasPlugin` (+805 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `simple-git` connect `messageHandler.ts` to `webviewHtml.ts`, `gitRunner.ts`, `extension.ts`, `package.json`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Why does `dependencies` connect `package.json` to `messageHandler.ts`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Why does `properties` connect `properties` to `CommitDetailsSection`, `statusStrip.ts`, `octicons.ts`, `.showTagDetails`, `push.test.ts`, `git-graph-libre.dialog.merge.noFastForward`, `git-graph-libre.maxDepthOfRepoSearch`, `properties`, `git-graph-libre.showUncommittedChanges`, `git-graph-libre.fetchAvatars`, `default`, `git-graph-libre.customBranchGlobPatterns`, `git-graph-libre.dateFormat`, `git-graph-libre.commitDetails.fileViewMode`, `git-graph-libre.dateType`, `git-graph-libre.graphStyle`, `git-graph-libre.tabIconColorTheme`, `ActionPayload`, `git-graph-libre.graph.fontSize`, `git-graph-libre.graph.rowHeight`, `git-graph-libre.shortHashLength`, `keywords`, `git-graph-libre.autoCenterCommitDetailsView`, `git-graph-libre.initialLoadCommits`, `git-graph-libre.showCurrentBranchByDefault`, `git-graph-libre.repository.muteCommitsNotAncestorsOfHead`, `html.ts`, `utils/vscode.ts`, `git-graph-libre.repository.includeReflog`, `git-graph-libre.repository.showStashes`, `git-graph-libre.repository.boldCheckedOutCommit`, `git-graph-libre.repository.fetchTagsByDefault`, `git-graph-libre.repository.muteCommitsNotAncestorsOfHead`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **What connects `path`, `esbuild`, `production` to the rest of the system?**
  _810 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sendMessage` be split into smaller, more focused modules?**
  _Cohesion score 0.07210031347962383 - nodes in this community are weakly interconnected._
- **Should `messageHandler.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08253968253968254 - nodes in this community are weakly interconnected._
- **Should `tagDetails.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08865248226950355 - nodes in this community are weakly interconnected._