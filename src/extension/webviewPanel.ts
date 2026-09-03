import type * as vscode from "vscode";

import type { AvatarManager } from "@/avatarManager";
import { buildExtensionUri } from "@/backend/utils/path";
import type { Config } from "@/config";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { GitRepoSet, TelemetryConsent } from "@/types";

import type { RepoManager } from "./repoManager";
import type { WebviewBridge } from "./webviewBridge";
import { buildWebviewHtml } from "./webviewHtml";

export function createWebviewPanel(opts: {
  panel: vscode.WebviewPanel;
  bridge: WebviewBridge;
  config: Config;
  repoFileWatcher: RepoFileWatcher;
  extensionPath: string;
  extensionState: ExtensionState;
  avatarManager: AvatarManager;
  repoManager: RepoManager;
  extensionVersion: string;
  outputChannel?: Pick<vscode.OutputChannel, "appendLine">;
  onDispose: () => void;
  onPanelShown: () => void;
}) {
  const {
    panel,
    bridge,
    config,
    repoFileWatcher,
    extensionPath,
    extensionState,
    avatarManager,
    repoManager,
    extensionVersion,
    outputChannel,
    onDispose,
    onPanelShown
  } = opts;

  const disposables: vscode.Disposable[] = [];
  // The panel is created with `retainContextWhenHidden: true`, so the graph
  // document — and every state the webview keeps inside it — stays alive while
  // the panel is hidden, and re-showing it is instant. Re-assigning
  // `panel.webview.html` destroys that document, so it is reserved for genuine
  // document transitions: the initial build and leaving the static
  // "no repositories" placeholder, which carries no script and can therefore
  // neither hold state nor receive bridge messages.
  let isGraphViewLoaded = false;
  let isPanelVisible = true;

  // Both tab icon variants ship a light/dark pair: the grey one has to invert to
  // stay legible, and the color one keeps its graph hues but greys the bird to
  // suit the background. The setting values double as the filename segment.
  const iconVariant = config.tabIconColorTheme();
  panel.iconPath = {
    light: buildExtensionUri(extensionPath, "resources", `webview-icon-${iconVariant}-light.svg`),
    dark: buildExtensionUri(extensionPath, "resources", `webview-icon-${iconVariant}-dark.svg`)
  };

  function update() {
    const result = buildWebviewHtml({
      webview: panel.webview,
      config,
      extensionPath,
      extensionState,
      repoManager,
      extensionVersion
    });
    outputChannel?.appendLine(
      `[panel] render repos=${Object.keys(repoManager.getRepos()).length} graph=${result.isGraphLoaded}`
    );
    panel.webview.html = result.html;
    isGraphViewLoaded = result.isGraphLoaded;
  }

  // Bring a re-shown panel up to date without disturbing the retained
  // document: push fresh repo and graph data over the bridge instead of
  // rebuilding the HTML, which would reload the webview and drop its live
  // state. Only the placeholder document is rebuilt, because it cannot
  // receive messages.
  function syncRetainedView() {
    if (!isGraphViewLoaded) {
      update();
      return;
    }
    bridge.post({
      command: "loadRepos",
      repos: repoManager.getRepos(),
      lastActiveRepo: extensionState.getLastActiveRepo()
    });
    bridge.post({ command: "refresh" });
  }

  function dispose() {
    onDispose();
    panel.dispose();
    avatarManager.deregisterBridge();
    repoFileWatcher.stop();
    repoManager.deregisterViewCallback();
    while (disposables.length) {
      const x = disposables.pop();
      if (x) x.dispose();
    }
  }

  update();
  panel.onDidDispose(() => dispose(), null, disposables);
  panel.onDidChangeViewState(
    () => {
      if (panel.visible !== isPanelVisible) {
        if (panel.visible) {
          onPanelShown();
          syncRetainedView();
        } else {
          repoFileWatcher.stop();
        }
        isPanelVisible = panel.visible;
      }
    },
    null,
    disposables
  );

  repoManager.registerViewCallback((repos: GitRepoSet, numRepos: number) => {
    if (!panel.visible) return;
    outputChannel?.appendLine(`[panel] repos update repos=${numRepos} graph=${isGraphViewLoaded}`);
    if (!isGraphViewLoaded && numRepos > 0) {
      // The placeholder document cannot receive loadRepos, so the first
      // discovered repository requires a document swap to mount the graph.
      update();
      return;
    }
    bridge.post({
      command: "loadRepos",
      repos,
      lastActiveRepo: extensionState.getLastActiveRepo()
    });
  });

  return {
    reveal(column?: vscode.ViewColumn) {
      panel.reveal(column);
    },
    startHistorySearch() {
      bridge.post({ command: "startHistorySearch" });
    },
    /**
     * Pushed rather than re-rendered: rebuilding the HTML would reload the
     * webview and drop the retained graph state, and the notice is a single
     * `hidden` toggle.
     */
    setTelemetryConsent(consent: TelemetryConsent) {
      if (!isGraphViewLoaded) return;
      bridge.post({ command: "telemetryConsentChanged", consent });
    },
    dispose
  };
}

export type WebviewPanel = ReturnType<typeof createWebviewPanel>;
