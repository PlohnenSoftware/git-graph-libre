import * as vscode from "vscode";

import { AvatarManager } from "./avatarManager";
import { gitClientFactory } from "./backend/gitClient";
import { buildExtensionUri } from "./backend/utils/path";
import { config } from "./config";
import { DiffDocProvider } from "./diffDocProvider";
import { createCommandManager } from "./extension/commandManager";
import { explicitExtensionSettings } from "./extension/extensionSettings";
import { registerMessageHandlers } from "./extension/messageHandler";
import { createRepoManager } from "./extension/repoManager";
import { createLogger } from "./extension/utils/logger";
import { type WebviewBridge, webviewBridgeFactory } from "./extension/webviewBridge";
import { createWebviewPanel, type WebviewPanel } from "./extension/webviewPanel";
import { createRepoSearch } from "./extension/workspaceSearch";
import { createRepoWatcher } from "./extension/workspaceWatcher";
import { ExtensionState } from "./extensionState";
import * as l10n from "./l10n";
import { initL10n } from "./l10n";
import { RepoFileWatcher } from "./repoFileWatcher";
import { StatusBarItem } from "./statusBarItem";
import { createTelemetryReporter } from "./telemetry";
import { buildActivationPayload } from "./telemetry/activationSnapshot";
import { createConsentPrompt } from "./telemetry/consentPrompt";

export function activate(context: vscode.ExtensionContext) {
  initL10n(context.extensionPath);
  const logger = createLogger(l10n.t("outputChannel.text"));
  const extensionState = new ExtensionState(context);
  const avatarManager = new AvatarManager(config.gitPath, extensionState);
  const statusBarItem = new StatusBarItem(context, config, logger);
  // Usage telemetry. Gated twice: by VS Code's global telemetry setting,
  // which always wins, and by git-graph-libre.telemetry.enabled. With no
  // endpoint compiled in it is a total no-op.
  const telemetry = createTelemetryReporter({ config, logger });
  // Nothing is sent while the consent setting is `unset`, so the question has
  // to be put to the user. Asked once here and again on every graph open until
  // it is answered; dismissing the notification leaves it open.
  const consentPrompt = createConsentPrompt({ config, logger });
  const gitClient = gitClientFactory(extensionState.getLastActiveRepo() ?? "", config.gitPath());
  const repoManager = createRepoManager(extensionState, statusBarItem, config);
  const repoSearch = createRepoSearch(repoManager, config);
  const repoWatcher = createRepoWatcher(repoManager, config, repoSearch);
  let currentPanel: WebviewPanel | undefined;

  function openGraphView(targetRepo?: string) {
    logger.log(`[panel] open target=${JSON.stringify(targetRepo ?? null)}`);
    void consentPrompt.promptIfUnset();
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
        retainContextWhenHidden: true,
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
      outputChannel: logger,
      telemetry,
      telemetryConsentPrompt: consentPrompt
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
      extensionVersion: String(context.extension.packageJSON.version ?? "unknown"),
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
    getCurrentPanel: () => currentPanel,
    telemetry
  });

  // One activation event per session. It is the denominator every feature
  // ratio is measured against, and its settings flags are how dead settings
  // get identified. Reading the manifest can throw on a damaged install, and
  // telemetry must never be the reason activation fails.
  try {
    telemetry.logActivate(buildActivationPayload(explicitExtensionSettings(context.extensionPath)));
  } catch (error: unknown) {
    logger.log(`[telemetry] activation snapshot skipped: ${String(error)}`);
  }

  void consentPrompt.promptIfUnset();

  void (async () => {
    repoManager.removeReposNotInWorkspace();
    if (!(await repoManager.checkReposExist())) repoManager.sendRepos();
    await repoSearch.searchWorkspaceForRepos();
    repoWatcher.startWatching();
  })();

  context.subscriptions.push(
    logger.channel,
    telemetry,
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
      } else if (e.affectsConfiguration("git-graph-libre.telemetry.enabled")) {
        // Answering the prompt writes this setting, so this is what swaps the
        // consent screen for the graph the moment the user chooses.
        currentPanel?.applyTelemetryConsentChange();
      } else if (e.affectsConfiguration("git.path")) {
        gitClient.setGitPath(config.gitPath());
      }
    }),
    repoWatcher
  );

  logger.log("Extension activated successfully");
}
