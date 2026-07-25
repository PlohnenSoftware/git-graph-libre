import type * as vscode from "vscode";

import type { AvatarManager } from "@/avatarManager";
import { buildExtensionUri } from "@/backend/utils/path";
import type { Config } from "@/config";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { GitRepoSet } from "@/types";

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
    outputChannel,
    onDispose,
    onPanelShown
  } = opts;

  const disposables: vscode.Disposable[] = [];
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
      repoManager
    });
    outputChannel?.appendLine(
      `[panel] render repos=${Object.keys(repoManager.getRepos()).length} graph=${result.isGraphLoaded}`
    );
    panel.webview.html = result.html;
    isGraphViewLoaded = result.isGraphLoaded;
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
          update();
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
    if ((numRepos === 0 && isGraphViewLoaded) || (numRepos > 0 && !isGraphViewLoaded)) {
      update();
    } else {
      bridge.post({
        command: "loadRepos",
        repos,
        lastActiveRepo: extensionState.getLastActiveRepo()
      });
    }
  });

  return {
    reveal(column?: vscode.ViewColumn) {
      panel.reveal(column);
    },
    startHistorySearch() {
      bridge.post({ command: "startHistorySearch" });
    },
    dispose
  };
}

export type WebviewPanel = ReturnType<typeof createWebviewPanel>;
