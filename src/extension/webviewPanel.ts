import type * as vscode from "vscode";

import type { AvatarManager } from "@/avatarManager";
import { buildExtensionUri } from "@/backend/utils/path";
import type { Config } from "@/config";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { TelemetryReporter } from "@/telemetry";
import { isConsentPending } from "@/telemetry/consentPrompt";
import type { GitRepoSet } from "@/types";

import { buildComponentStatus, describeEngineStatus } from "./componentStatus";
import type { RepoManager } from "./repoManager";
import type { WebviewBridge } from "./webviewBridge";
import { buildWebviewHtml } from "./webviewHtml";
import { listWebviewLanguages } from "./webviewLanguages";
import { registerRepositoryRecovery } from "./repositoryRecovery";
import type { RepoSearch } from "./workspaceSearch";

export function createWebviewPanel(opts: {
  panel: vscode.WebviewPanel;
  bridge: WebviewBridge;
  config: Config;
  repoFileWatcher: RepoFileWatcher;
  extensionPath: string;
  extensionState: ExtensionState;
  avatarManager: AvatarManager;
  repoManager: RepoManager;
  repoSearch?: RepoSearch;
  extensionVersion: string;
  outputChannel?: Pick<vscode.OutputChannel, "appendLine"> & Partial<Pick<vscode.OutputChannel, "show">>;
  telemetry?: Pick<TelemetryReporter, "logFeature">;
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
    telemetry,
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
  /**
   * Language override for this panel only, set from the webview's language
   * switcher. Held in this closure on purpose: nothing persists it, so
   * closing the graph tab ends it and the next open is back in the editor's
   * own language. Someone helping at another person's keyboard cannot leave
   * their editor changed.
   */
  let temporaryLanguage: string | undefined;
  let isPanelVisible = true;
  let hadRepositories = Object.keys(repoManager.getRepos()).length > 0;
  let disposed = false;
  const recovery = opts.repoSearch ? registerRepositoryRecovery(bridge, {
    config, repoSearch: opts.repoSearch, outputChannel, telemetry,
    visible: () => !disposed && panel.visible
  }) : undefined;

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
      extensionVersion,
      language: temporaryLanguage
    });
    outputChannel?.appendLine(
      `[panel] render repos=${Object.keys(repoManager.getRepos()).length} graph=${result.isGraphLoaded}`
    );
    // "Did the engine start?" answered in the log, at the moment the graph
    // that would use it is built.
    if (result.engine !== null) {
      outputChannel?.appendLine(`[engine] ${describeEngineStatus(result.engine)}`);
    }
    panel.webview.html = result.html;
    isGraphViewLoaded = result.isGraphLoaded;
    hadRepositories = Object.keys(repoManager.getRepos()).length > 0;
    if (isGraphViewLoaded) recovery?.clearFailure();
  }

  // Bring a re-shown panel up to date without disturbing the retained
  // document: push fresh repo and graph data over the bridge instead of
  // rebuilding the HTML, which would reload the webview and drop its live
  // state. Only the placeholder document is rebuilt, because it cannot
  // receive messages.
  function syncRetainedView() {
    // The view callback ignores hidden panels, so a zero/nonzero transition
    // from while hidden is still unapplied: swap documents now, whichever
    // side of it is mounted, exactly as the visible path would have.
    if (hadRepositories !== (Object.keys(repoManager.getRepos()).length > 0)) {
      update();
      return;
    }
    if (!isGraphViewLoaded) {
      if (!hadRepositories) void recovery?.refresh();
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
    if (disposed) return;
    disposed = true;
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

  bridge.onMessage("setTemporaryLanguage", (msg) => {
    if (!listWebviewLanguages(extensionPath).some((entry) => entry.id === msg.language)) return;
    temporaryLanguage = msg.language;
    outputChannel?.appendLine(`[panel] temporary language ${msg.language}`);
    telemetry?.logFeature("setTemporaryLanguage", true);
    // A rebuild rather than a message: every string in the document was
    // baked in at build time, including the toolbar and the status strip.
    update();
  });

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
    if (hadRepositories !== (numRepos > 0)) {
      // The placeholder document cannot receive loadRepos, so the first
      // discovered repository requires a document swap to mount the graph.
      update();
      return;
    }
    if (!isGraphViewLoaded) return;
    bridge.post({
      command: "loadRepos",
      repos,
      lastActiveRepo: extensionState.getLastActiveRepo()
    });
  });

  return {
    /** The temporary language override, if the switcher has set one. */
    getLanguage() {
      return temporaryLanguage;
    },
    reveal(column?: vscode.ViewColumn) {
      panel.reveal(column);
      if (!isGraphViewLoaded && !hadRepositories) void recovery?.refresh();
    },
    startHistorySearch() {
      bridge.post({ command: "startHistorySearch" });
    },
    /**
     * Pushes fresh component status to the graph unasked. Called when the
     * backend setting or `git.path` changes, so the status indicator follows
     * them without a reload. A placeholder document cannot receive messages
     * and shows no indicator, so it is skipped.
     */
    async refreshComponentStatus() {
      if (!isGraphViewLoaded) {
        if (!hadRepositories) await recovery?.refresh();
        return;
      }
      const components = await buildComponentStatus({
        preference: config.backend(),
        gitPath: config.gitPath()
      });
      outputChannel?.appendLine(`[engine] ${describeEngineStatus(components.engine)}`);
      bridge.post({ command: "componentStatus", components });
    },
    /**
     * Swaps between the consent screen and the graph when the answer changes.
     *
     * They are different documents, so this is a rebuild rather than a
     * message — and a rebuild only when what is mounted contradicts the
     * answer: the graph is up while the question has been reopened, or a
     * placeholder is up when it no longer is. An enabled ↔ disabled change
     * shows nothing new, and rebuilding then would reload the webview and
     * drop the graph's live state.
     */
    applyTelemetryConsentChange() {
      if (isGraphViewLoaded !== isConsentPending(config.telemetryConsent())) return;
      update();
    },
    dispose
  };
}

export type WebviewPanel = ReturnType<typeof createWebviewPanel>;
