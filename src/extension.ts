import * as vscode from "vscode";

import { AvatarManager } from "./avatarManager";
import { gitClientFactory } from "./backend/gitClient";
import { buildExtensionUri } from "./backend/utils/path";
import { config } from "./config";
import { DiffDocProvider } from "./diffDocProvider";
import { createCommandManager } from "./extension/commandManager";
import { registerMessageHandlers } from "./extension/messageHandler";
import { createRepoManager } from "./extension/repoManager";
import { type WebviewBridge, webviewBridgeFactory } from "./extension/webviewBridge";
import { createWebviewPanel, type WebviewPanel } from "./extension/webviewPanel";
import { createLogger } from "./extension/utils/logger";
import { createRepoSearch } from "./extension/workspaceSearch";
import { createRepoWatcher } from "./extension/workspaceWatcher";
import { ExtensionState } from "./extensionState";
import * as l10n from "./l10n";
import { initL10n } from "./l10n";
import { RepoFileWatcher } from "./repoFileWatcher";
import { StatusBarItem } from "./statusBarItem";

export function activate(context: vscode.ExtensionContext) {
  initL10n(context.extensionPath);
  const logger = createLogger(l10n.t("outputChannel.text"));
  const extensionState = new ExtensionState(context);
  const avatarManager = new AvatarManager(config.gitPath, extensionState);
  const statusBarItem = new StatusBarItem(context, config, logger);
  const gitClient = gitClientFactory(extensionState.getLastActiveRepo() ?? "", config.gitPath());
  const repoManager = createRepoManager(extensionState, statusBarItem, config);
  const repoSearch = createRepoSearch(repoManager, config);
  const repoWatcher = createRepoWatcher(repoManager, config, repoSearch);
  let currentPanel: WebviewPanel | undefined;

  function openGraphView(targetRepo?: string) {
    logger.log(`[panel] open target=${JSON.stringify(targetRepo ?? null)}`);
    if (targetRepo) extensionState.setLastActiveRepo(targetRepo);
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (currentPanel) {
      logger.log("[panel] reveal existing");
      currentPanel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "git-graph-libre",
      l10n.t("outputChannel.text"),
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          buildExtensionUri(context.extensionPath, "media"),
          buildExtensionUri(context.extensionPath, "out")
        ]
      }
    );
    let bridge!: WebviewBridge;
    const repoFileWatcher = new RepoFileWatcher(() => {
      if (panel.visible) bridge.post({ command: "refresh" });
    });
    bridge = webviewBridgeFactory(panel.webview, repoFileWatcher);
    avatarManager.registerBridge(bridge.post.bind(bridge));
    const { onPanelShown } = registerMessageHandlers(bridge, {
      config,
      gitClient,
      repoManager,
      extensionState,
      avatarManager,
      repoFileWatcher,
      extensionPath: context.extensionPath,
      outputChannel: logger
    });
    currentPanel = createWebviewPanel({
      panel,
      bridge,
      config,
      repoFileWatcher,
      extensionPath: context.extensionPath,
      extensionState,
      avatarManager,
      repoManager,
      outputChannel: logger,
      onDispose: () => {
        currentPanel = undefined;
      },
      onPanelShown
    });
  }

  const commandManager = createCommandManager({
    extensionVersion: String(context.extension.packageJSON.version ?? "unknown"),
    outputChannel: logger,
    config,
    extensionState,
    repoManager,
    avatarManager,
    openGraphView,
    getCurrentPanel: () => currentPanel
  });

  void (async () => {
    repoManager.removeReposNotInWorkspace();
    if (!(await repoManager.checkReposExist())) repoManager.sendRepos();
    await repoSearch.searchWorkspaceForRepos();
    repoWatcher.startWatching();
  })();

  context.subscriptions.push(
    logger.channel,
    ...commandManager.registerAll(),
    vscode.workspace.registerTextDocumentContentProvider(
      DiffDocProvider.scheme,
      new DiffDocProvider(gitClient.getInstance)
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("git-graph-libre.showStatusBarItem")) {
        statusBarItem.refresh();
      } else if (e.affectsConfiguration("git-graph-libre.maxDepthOfRepoSearch")) {
        repoSearch.maxDepthChanged();
      } else if (e.affectsConfiguration("git.path")) {
        gitClient.setGitPath(config.gitPath());
      }
    }),
    repoWatcher
  );

  logger.log("Extension activated successfully");
}
