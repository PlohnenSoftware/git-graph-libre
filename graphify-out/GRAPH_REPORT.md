# Graph Report - git-graph-libre  (2026-07-25)

## Corpus Check
- 190 files · ~109,058 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1921 nodes · 4547 edges · 116 communities (102 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `67e2045b`
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
- git-graph-libre.repository.includeReflog
- git-graph-libre.repository.showRemoteBranches
- git-graph-libre.repository.showTags
- git-graph-libre.showCurrentBranchByDefault
- git-graph-libre.showStatusBarItem
- git-graph-libre.showUncommittedChanges
- .isCommitListUnchanged
- html.ts
- dialogStyles.test.ts
- categories
- repository
- CommitDetailsSection
- .applyStructuredExtensionSetting
- utils/vscode.ts
- manifest.test.ts
- tableStyles.test.ts
- .absoluteFilePathForRepo
- config.test.ts
- vitest.config.ts

## God Nodes (most connected - your core abstractions)
1. `GitGraphView` - 284 edges
2. `runGitRaw()` - 77 edges
3. `sendMessage()` - 75 edges
4. `registerMessageHandlers()` - 70 edges
5. `escapeHtml()` - 69 edges
6. `showActionRunningDialog()` - 40 edges
7. `Dropdown` - 34 edges
8. `showFormDialog()` - 32 edges
9. `scripts` - 31 edges
10. `makeRepo()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `registerHandlersForTest()` --calls--> `registerMessageHandlers()`  [EXTRACTED]
  tests/webview/messageHandler.test.ts → src/extension/messageHandler.ts
- `editRemote()` --references--> `simple-git`  [EXTRACTED]
  src/backend/actions/remote.ts → package.json
- `getUnsavedChanges()` --references--> `simple-git`  [EXTRACTED]
  src/backend/queries/loadCommits.ts → package.json
- `runGitRaw()` --references--> `simple-git`  [EXTRACTED]
  src/backend/utils/gitRunner.ts → package.json
- `makeHarness()` --calls--> `createCommandManager()`  [EXTRACTED]
  tests/webview/commandManager.test.ts → src/extension/commandManager.ts

## Import Cycles
- None detected.

## Communities (116 total, 14 thin omitted)

### Community 0 - "sendMessage"
Cohesion: 0.07
Nodes (9): showActionRunningDialog(), showCheckboxDialog(), showConfirmationDialog(), showDialog(), showErrorDialog(), showFormDialog(), showRefInputDialog(), showSelectDialog() (+1 more)

### Community 1 - "messageHandler.test.ts"
Cohesion: 0.06
Nodes (61): GitClient, DiffDocument, applyExtensionSettings(), clampNumber(), ConfigInspection, expectArray(), expectBoolean(), expectObject() (+53 more)

### Community 2 - "tagDetails.ts"
Cohesion: 0.07
Nodes (32): applySignatureRecord(), cleanEmail(), emptySignature(), failedSignatureCodes, markBadSignature(), markFailedSignature(), markGoodSignature(), markValidSignature() (+24 more)

### Community 3 - "GitGraphView"
Cohesion: 0.06
Nodes (4): DropdownOption, GitGraphView, isCommitOrdering(), isHideableColumn()

### Community 4 - "Graph"
Cohesion: 0.06
Nodes (6): Branch, Graph, UnavailablePoint, Vertex, VertexOrNull, config

### Community 5 - ".constructor"
Cohesion: 0.09
Nodes (4): CommitOrdering, createEmptyGitConfig(), hideDialogAndContextMenu(), postWebviewDiagnostic()

### Community 6 - "messageHandler.ts"
Cohesion: 0.11
Nodes (39): simple-git, simple-git, checkoutBranch(), createBranch(), renameBranch(), ActionInput, ActionPayloadByCommand, applyStash() (+31 more)

### Community 7 - "types.ts"
Cohesion: 0.05
Nodes (38): ExtensionSettingScope, ExtensionSettingType, JsonPrimitive, RequestCompareFileWithWorkingTree, RequestCopyToClipboard, RequestExportExtensionSettings, RequestFetchAvatar, RequestImportExtensionSettings (+30 more)

### Community 8 - "main.ts"
Cohesion: 0.07
Nodes (37): bindTextRefDialogInput(), COLUMN_HIDE_CLASSES, contextMenu, dialog, dialogBacking, errorToDiagnosticMessage(), getDialogFormValues(), getDialogInputValue() (+29 more)

### Community 9 - "rendering.test.ts"
Cohesion: 0.06
Nodes (22): clickContextMenuItem(), contextMenuItem(), defaultViewState, finishAction(), firstCommitDetails, getFindInput(), latestLoadBranchesRequest(), latestLoadCommitsRequest() (+14 more)

### Community 10 - "vscode"
Cohesion: 0.08
Nodes (20): vscode, webviewBridgeFactory(), normalizeRepoPath(), RelativePatternFactory, RepoFileWatcher, shouldRefreshGitPath(), shouldRefreshRepoPath(), trimTrailingSlashes() (+12 more)

### Community 11 - "ExtensionState"
Cohesion: 0.10
Nodes (11): AvatarManager, AvatarRequestItem, GitHubRemoteSource, GitLabRemoteSource, GravatarRemoteSource, RemoteSource, getRemoteUrl(), ExtensionState (+3 more)

### Community 12 - "Dropdown"
Cohesion: 0.12
Nodes (4): Dropdown, DropdownDisplayOptions, truncateMiddle(), truncateRefName()

### Community 13 - ".renderTable"
Cohesion: 0.12
Nodes (4): closestHTMLElement(), showContextMenu(), addListenerToClass(), unescapeHtml()

### Community 14 - "escapeHtml"
Cohesion: 0.14
Nodes (34): booleanSettingOrder, configValueText(), firstRemoteUrl(), getRepoBasename(), getRepoDisplayName(), hasUserDetails(), isRemoteHidden(), normalizeRepoBooleanOverride() (+26 more)

### Community 15 - "Implementation Roadmap"
Cohesion: 0.06
Nodes (30): Agent Instructions, Claude Instructions, Codex Instructions, AI Development Knowledge Base, Branch containment, Current Architecture, Documentation and Verification Rules, Graphify Map (+22 more)

### Community 16 - "devDependencies"
Cohesion: 0.06
Nodes (31): @biomejs/biome, jsdom, devDependencies, @biomejs/biome, esbuild, jsdom, @primer/octicons, tsc-alias (+23 more)

### Community 17 - "scripts"
Cohesion: 0.06
Nodes (31): scripts, clean, compile, compile-tests, format, format:changed, format:changed:fix, format:fix (+23 more)

### Community 18 - "commandManager.ts"
Cohesion: 0.10
Nodes (20): gitClientFactory(), GitInstance, formatGitCommandRecord(), getPathFromStr(), decodeDiffDocUri(), decodeUriQueryArgs(), DiffDocProvider, encodeDiffDocUri() (+12 more)

### Community 19 - "extension.ts"
Cohesion: 0.18
Nodes (17): buildExtensionUri(), Config, activate(), createRepoManager(), createLogger(), Logger, timestamp(), WebviewBridge (+9 more)

### Community 20 - "index.ts"
Cohesion: 0.16
Nodes (21): commitComparison(), CommitComparisonInput, fetchComparisonDiff(), requireRef(), commitDetails(), CommitDetailsInput, fetchNameStatus(), fetchNumStat() (+13 more)

### Community 21 - "global.d.ts"
Cohesion: 0.08
Nodes (24): GitCommitDetails, GitRemote, GitStash, AvatarImageCollection, Config, ContextMenuElement, ContextMenuItem, DialogCheckboxInput (+16 more)

### Community 22 - "properties"
Cohesion: 0.07
Nodes (27): additionalProperties, type, additionalProperties, type, additionalProperties, type, additionalProperties, default (+19 more)

### Community 23 - "loadRepoInfo.ts"
Cohesion: 0.16
Nodes (25): appendUnique(), emptyRepoInfo(), GitQueryContext, isInsideWorkTree(), loadAuthors(), loadConfig(), loadHead(), loadRemotes() (+17 more)

### Community 24 - "commitDetailsView.ts"
Cohesion: 0.14
Nodes (24): CommitDetailsFileViewMode, alterGitFileTree(), capitalizeSection(), CommitDetailsFileViewOptions, CommitDetailsSectionState, compactFolderChain(), compactFolderContents(), compareGitFolderEntries() (+16 more)

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (22): mocha, node, ./node_modules/@types, ./tests/*, compilerOptions, esModuleInterop, isolatedModules, lib (+14 more)

### Community 27 - "remote.ts"
Cohesion: 0.16
Nodes (19): addRemote(), AddRemoteInput, assertPruneTagsSupported(), cleanRemoteName(), cleanRemoteUrl(), deleteRemote(), DeleteRemoteInput, editRemote() (+11 more)

### Community 28 - "path.ts"
Cohesion: 0.17
Nodes (17): doesPathExist(), getPathFromUri(), isDirectory(), RepoManager, createRepoSearch(), RepoSearch, createRepoWatcher(), RepoWatcher (+9 more)

### Community 29 - "repoConfigFile.ts"
Cohesion: 0.18
Nodes (20): ExportedRepoConfig, exportedRepoState(), exportRepoConfigFile(), getRepoConfigFilePath(), importRepoConfigFile(), isColumnWidths(), isCommitOrdering(), isIssueLinkingConfig() (+12 more)

### Community 30 - "Changelog"
Cohesion: 0.10
Nodes (20): [0.1.0] - 2026-02-18, [0.1.1] - 2026-02-23, [0.2.0] - 2026-03-17, [0.3.0] - 2026-03-26, [0.4.0] - 2026-04-10, [1.0.0] - 2026-07-01, Added, Added (+12 more)

### Community 31 - "GitCommandRecorder"
Cohesion: 0.15
Nodes (15): ARCHIVE_FORMATS, ArchiveFormat, archiveFormatFromPath(), createArchive(), CreateArchiveInput, requireArchiveFormat(), requireValue(), FileActionInput (+7 more)

### Community 32 - "runGitRaw"
Cohesion: 0.20
Nodes (17): deleteBranch(), DeleteBranchInput, ActionInput, ActionPayloadByCommand, currentBranch(), deleteRemoteBranch(), fetchIntoLocalBranch(), loadRemoteNames() (+9 more)

### Community 33 - "searchCommits.ts"
Cohesion: 0.21
Nodes (18): escapeRegExp(), GitQueryContext, hashSearch(), loadPositions(), logFormat(), mergeSearchResults(), normalizeMaxResults(), parseLogEntries() (+10 more)

### Community 34 - "webviewL10n.ts"
Cohesion: 0.22
Nodes (13): getWebviewLocalizedStrings(), LocalizedStrings, buildWebviewStatusStrip(), escapeHtml(), buildToolbarButton(), buildToolbarDropdownGroup(), buildWebviewToolbar(), escapeAttribute() (+5 more)

### Community 35 - "linkify.ts"
Cohesion: 0.17
Nodes (18): IssueLinkingConfig, buildIssueUrl(), collectHttpLinks(), collectIssueLinks(), collectLinks(), countCharacter(), createIssuePattern(), extractIssueLinks() (+10 more)

### Community 36 - ".displayHash"
Cohesion: 0.20
Nodes (6): handleActionResponse(), handleCreateArchiveResponse(), handleExtensionSettingsFileResponse(), hideDialog(), refreshGraphOrDisplayError(), setStatusStrip()

### Community 37 - "package.json"
Cohesion: 0.10
Nodes (19): author, name, bugs, url, contributors, dependencies, description, displayName (+11 more)

### Community 38 - "commit.ts"
Cohesion: 0.22
Nodes (16): checkoutCommit(), cherrypickCommit(), CommitActionInput, CommitActionPayloads, dropCommit(), dropCommitSelection(), editHeadCommitMessage(), normalizeCommitMessage() (+8 more)

### Community 40 - "keyboardNavigation.test.ts"
Cohesion: 0.14
Nodes (13): commitDetailsFor(), CommitDetailsRequest, commitRow(), latestRequest(), LoadBranchesRequest, LoadCommitsRequest, loadedCommits, openCommitDetails() (+5 more)

### Community 41 - "loadCommits.ts"
Cohesion: 0.20
Nodes (16): addUnsavedChangesCommit(), createCommitNodes(), getLog(), getRefs(), getUnsavedChanges(), GitLogOptions, GitQueryContext, hasLoadedHead() (+8 more)

### Community 42 - "gitRunner.ts"
Cohesion: 0.22
Nodes (16): arrayOfStrings(), findCredentialHostSeparator(), findUrlEnd(), GitCommandErrorInfo, GitCommandKind, GitCommandOptions, isRecord(), isWhitespace() (+8 more)

### Community 43 - "properties"
Cohesion: 0.12
Nodes (16): properties, title, type, configuration, default, description, type, default (+8 more)

### Community 44 - "default"
Cohesion: 0.12
Nodes (16): default, description, type, git-graph-libre.graphColors, oklch(59% 0.21 130), oklch(59% 0.21 145), oklch(59% 0.21 190), oklch(59% 0.21 245) (+8 more)

### Community 45 - "webviewHtml.ts"
Cohesion: 0.20
Nodes (9): getNonce(), buildWebviewHtml(), escapeJsonForHtml(), initL10n(), interpolate(), loadEnglishTranslations(), resolveTranslationPath(), t() (+1 more)

### Community 46 - "git-graph-libre.customBranchGlobPatterns"
Cohesion: 0.13
Nodes (15): default, description, items, type, items, description, pattern, properties (+7 more)

### Community 47 - "queries.types.ts"
Cohesion: 0.14
Nodes (13): LoadBranchesInput, COMMIT_ORDERINGS, CommitDetailsResult, GitQueryError, LoadBranchesResult, LoadCommitsResult, LoadRepoInfoResult, QueryPayloads (+5 more)

### Community 48 - "config.ts"
Cohesion: 0.19
Nodes (14): commitDetailsFileViewModes, customBranchGlobPatterns(), DEFAULT_GRAPH_COLORS, getColorConfig(), getConfig(), getConfigWithLegacy(), getExplicitConfig(), getNumberConfig() (+6 more)

### Community 49 - "oklchColor.ts"
Cohesion: 0.35
Nodes (11): clamp(), formatOklch(), hexToOklch(), normalizeHue(), OklchColor, parseOklch(), rewritePaletteLightnessChroma(), rgbComponentsToOklch() (+3 more)

### Community 50 - "include"
Cohesion: 0.15
Nodes (12): ./backend/**/*.ts, ./extension/**/*.ts, ../src/backend/**/*.ts, ../src/webview/**/*.ts, ./webview/**/*.ts, compilerOptions, lib, extends (+4 more)

### Community 51 - "GitCommitNode"
Cohesion: 0.18
Nodes (6): GitCommitNode, commitDetails, commits, LoadBranchesRequest, LoadCommitsRequest, viewState

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
Cohesion: 0.20
Nodes (8): GitCommitSearchResult, GitConfigValue, GitLogEntry, GitRef, GitRefData, GitTagDetails, GitTagSignature, GitTagSignatureStatus

### Community 56 - "keyboardShortcuts.ts"
Cohesion: 0.27
Nodes (8): GlobalShortcutAction, GlobalShortcutContext, GlobalShortcutKeyEvent, resolveCommitDetailsNavigate(), resolveCtrlOrMetaShortcut(), resolveEscape(), resolveGlobalShortcut(), resolvePlainKeyShortcut()

### Community 57 - "compilerOptions"
Cohesion: 0.18
Nodes (10): ./**/*.ts, compilerOptions, module, moduleResolution, noEmit, outDir, rootDir, extends (+2 more)

### Community 58 - "userConfig.ts"
Cohesion: 0.33
Nodes (8): deleteUserDetails(), editUserDetails(), requireScope(), requireValue(), setConfigValue(), unsetConfigValue(), UserConfigActionInput, UserConfigActionPayloads

### Community 59 - "actions.types.ts"
Cohesion: 0.18
Nodes (9): ActionPayloads, ActionRequest, ActionResponse, GIT_CONFIG_SCOPES, GIT_PUSH_BRANCH_MODES, GitCommandStatus, GitConfigScope, GitPushBranchMode (+1 more)

### Community 60 - "abbrevCommit"
Cohesion: 0.35
Nodes (7): abbrevCommit(), clampShortHashLength(), commitSearchFields(), findCommitIndexes(), formatFindMatchCount(), normalizeFindText(), commits

### Community 61 - "getCommitDate"
Cohesion: 0.31
Nodes (8): getCommitDate(), formatRelativeDate(), getMonth(), getRelativeFormatter, pad2(), RELATIVE_UNITS, ago(), NOW

### Community 62 - "README.md"
Cohesion: 0.20
Nodes (8): Git Graph Libre — license and provenance, Incorporated MIT-licensed material, NOTICE, Configuration, Features, Installation, License, Why this fork

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
Cohesion: 0.24
Nodes (7): GitRepoInfo, bootWebview(), commits, defaultViewState, latestRequest(), repoInfo, createVscodeMock()

### Community 68 - "activationEvents"
Cohesion: 0.22
Nodes (9): activationEvents, onCommand:git-graph-libre.addRepo, onCommand:git-graph-libre.clearAvatarCache, onCommand:git-graph-libre.removeRepo, onCommand:git-graph-libre.searchCommits, onCommand:git-graph-libre.showDiagnostics, onCommand:git-graph-libre.view, onCommand:git-graph-libre.viewActiveEditorRepo (+1 more)

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
Cohesion: 0.38
Nodes (4): rebaseCurrentBranch(), RebaseCurrentBranchInput, requireValue(), ActionPayload

### Community 75 - "octicons.ts"
Cohesion: 0.48
Nodes (4): octicon(), OcticonName, octicons, svgIcons

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
Cohesion: 0.33
Nodes (6): keywords, branch, git, git graph, git history, git log

### Community 81 - "contextMenuVisibility.ts"
Cohesion: 0.53
Nodes (4): createDefaultContextMenuActionsVisibility(), isRecord(), normalizeContextMenuActionsVisibility(), ContextMenuActionsVisibility

### Community 82 - "dom.ts"
Cohesion: 0.53
Nodes (3): clearRevealHighlight(), insertAfter(), startRevealHighlight()

### Community 83 - "git-graph-libre.revealHighlightColor"
Cohesion: 0.40
Nodes (5): default, description, pattern, type, git-graph-libre.revealHighlightColor

### Community 84 - "src/tsconfig.json"
Cohesion: 0.40
Nodes (4): webview, exclude, extends, ../tsconfig.json

### Community 85 - "generateGitFileTree"
Cohesion: 0.50
Nodes (5): generateGitFileTree(), formatQueryError(), handleCommitComparisonResponse(), handleCommitDetailsResponse(), handleTagDetailsResponse()

### Community 86 - "contributes"
Cohesion: 0.50
Nodes (4): contributes, commands, menus, scm/title

### Community 87 - "git-graph-libre.autoCenterCommitDetailsView"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.autoCenterCommitDetailsView

### Community 88 - "git-graph-libre.commitDetails.compactFolders"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.commitDetails.compactFolders

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

### Community 93 - "git-graph-libre.repository.includeReflog"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.includeReflog

### Community 94 - "git-graph-libre.repository.showRemoteBranches"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.showRemoteBranches

### Community 95 - "git-graph-libre.repository.showTags"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.repository.showTags

### Community 96 - "git-graph-libre.showCurrentBranchByDefault"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showCurrentBranchByDefault

### Community 97 - "git-graph-libre.showStatusBarItem"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showStatusBarItem

### Community 98 - "git-graph-libre.showUncommittedChanges"
Cohesion: 0.50
Nodes (4): default, description, type, git-graph-libre.showUncommittedChanges

### Community 102 - "categories"
Cohesion: 0.67
Nodes (3): categories, SCM Providers, Visualization

### Community 103 - "repository"
Cohesion: 0.67
Nodes (3): repository, type, url

## Knowledge Gaps
- **561 isolated node(s):** `path`, `esbuild`, `production`, `esbuildProblemMatcherPlugin`, `aliasPlugin` (+556 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `simple-git` connect `messageHandler.ts` to `runGitRaw`, `loadCommits.ts`, `remote.ts`, `package.json`?**
  _High betweenness centrality (0.263) - this node is a cross-community bridge._
- **Why does `dependencies` connect `package.json` to `messageHandler.ts`?**
  _High betweenness centrality (0.262) - this node is a cross-community bridge._
- **Why does `GitGraphView` connect `GitGraphView` to `sendMessage`, `messageHandler.test.ts`, `Graph`, `.constructor`, `main.ts`, `Dropdown`, `.renderTable`, `escapeHtml`, `global.d.ts`, `.showCommitDetails`, `.displayHash`, `.bindSettingsWidget`, `GitCommitNode`, `settingsWidget.test.ts`, `git.types.ts`, `actions.types.ts`, `.isCommitListUnchanged`, `CommitDetailsSection`, `.applyStructuredExtensionSetting`, `.absoluteFilePathForRepo`?**
  _High betweenness centrality (0.195) - this node is a cross-community bridge._
- **What connects `path`, `esbuild`, `production` to the rest of the system?**
  _561 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sendMessage` be split into smaller, more focused modules?**
  _Cohesion score 0.06504702194357367 - nodes in this community are weakly interconnected._
- **Should `messageHandler.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05583972719522592 - nodes in this community are weakly interconnected._
- **Should `tagDetails.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06963645673323093 - nodes in this community are weakly interconnected._