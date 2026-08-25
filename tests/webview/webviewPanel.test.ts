import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

import type { AvatarManager } from "@/avatarManager";
import type { Config } from "@/config";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewBridge } from "@/extension/webviewBridge";
import { createWebviewPanel } from "@/extension/webviewPanel";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { GitRepoSet } from "@/types";

const mocks = vi.hoisted(() => ({
  buildWebviewHtml: vi.fn((): { html: string; isGraphLoaded: boolean } => ({
    html: "<html>graph</html>",
    isGraphLoaded: true
  }))
}));

vi.mock("@/extension/webviewHtml", () => ({ buildWebviewHtml: mocks.buildWebviewHtml }));

type ViewStateHandler = () => void;
type RepoCallback = (repos: GitRepoSet, numRepos: number) => void;
type DisposeHandler = () => void;

function createHarness(opts?: { initialIsGraphLoaded: boolean }) {
  const initialIsGraphLoaded = opts?.initialIsGraphLoaded ?? true;
  mocks.buildWebviewHtml.mockImplementationOnce(() => ({
    html: initialIsGraphLoaded ? "<html>graph</html>" : "<html>placeholder</html>",
    isGraphLoaded: initialIsGraphLoaded
  }));

  let viewStateHandler: ViewStateHandler | undefined;
  let disposeHandler: DisposeHandler | undefined;
  const webview = { html: "" };
  const panel = {
    visible: true,
    webview,
    iconPath: undefined,
    onDidDispose: vi.fn((handler: DisposeHandler) => {
      disposeHandler = handler;
      return { dispose: vi.fn() };
    }),
    onDidChangeViewState: vi.fn((handler: ViewStateHandler) => {
      viewStateHandler = handler;
      return { dispose: vi.fn() };
    }),
    reveal: vi.fn(),
    dispose: vi.fn()
  };
  const bridge = { post: vi.fn() };
  const repoFileWatcher = { stop: vi.fn() };
  const repos: GitRepoSet = { "/repo": { columnWidths: null } };
  let repoCallback: RepoCallback | undefined;
  const repoManager = {
    getRepos: vi.fn(() => repos),
    registerViewCallback: vi.fn((handler: RepoCallback) => {
      repoCallback = handler;
    }),
    deregisterViewCallback: vi.fn()
  };
  const avatarManager = { deregisterBridge: vi.fn() };
  const extensionState = { getLastActiveRepo: vi.fn(() => "/repo") };
  const onDispose = vi.fn();
  const onPanelShown = vi.fn();

  const webviewPanel = createWebviewPanel({
    panel: panel as unknown as vscode.WebviewPanel,
    bridge: bridge as unknown as WebviewBridge,
    config: { tabIconColorTheme: () => "color" } as unknown as Config,
    repoFileWatcher: repoFileWatcher as unknown as RepoFileWatcher,
    extensionPath: "/extension",
    extensionState: extensionState as unknown as ExtensionState,
    avatarManager: avatarManager as unknown as AvatarManager,
    repoManager: repoManager as unknown as RepoManager,
    extensionVersion: "1.2.3",
    outputChannel: { appendLine: vi.fn() },
    onDispose,
    onPanelShown
  });

  return {
    avatarManager,
    bridge,
    disposeHandler: () => disposeHandler,
    hide: () => {
      panel.visible = false;
      viewStateHandler?.();
    },
    onDispose,
    onPanelShown,
    panel,
    repoCallback: () => repoCallback,
    repoFileWatcher,
    repoManager,
    repos,
    show: () => {
      panel.visible = true;
      viewStateHandler?.();
    },
    webview,
    webviewPanel
  };
}

describe("createWebviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the initial document once and wires the lifecycle handlers", () => {
    const { bridge, panel, repoManager, webview } = createHarness();

    expect(webview.html).toBe("<html>graph</html>");
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
    expect(panel.onDidDispose).toHaveBeenCalledTimes(1);
    expect(panel.onDidChangeViewState).toHaveBeenCalledTimes(1);
    expect(repoManager.registerViewCallback).toHaveBeenCalledTimes(1);
    expect(bridge.post).not.toHaveBeenCalled();
  });

  it("keeps the retained document and pushes data after a hide-and-show cycle", () => {
    const harness = createHarness();
    harness.hide();

    expect(harness.repoFileWatcher.stop).toHaveBeenCalledTimes(1);

    harness.show();

    expect(harness.onPanelShown).toHaveBeenCalledTimes(1);
    expect(harness.bridge.post).toHaveBeenNthCalledWith(1, {
      command: "loadRepos",
      repos: harness.repos,
      lastActiveRepo: "/repo"
    });
    expect(harness.bridge.post).toHaveBeenNthCalledWith(2, { command: "refresh" });
    expect(harness.webview.html).toBe("<html>graph</html>");
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
  });

  it("ignores view state events that do not change visibility", () => {
    const harness = createHarness();

    harness.show();
    harness.show();

    expect(harness.onPanelShown).not.toHaveBeenCalled();
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
    expect(harness.bridge.post).not.toHaveBeenCalled();
  });

  it("posts loadRepos without rebuilding when the repo set changes", () => {
    const harness = createHarness();
    const repoCallback = harness.repoCallback();
    if (!repoCallback) throw new Error("view callback was not registered");

    repoCallback(harness.repos, 1);
    expect(harness.bridge.post).toHaveBeenCalledWith({
      command: "loadRepos",
      repos: harness.repos,
      lastActiveRepo: "/repo"
    });

    repoCallback({}, 0);
    expect(harness.bridge.post).toHaveBeenCalledTimes(2);
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
    expect(harness.webview.html).toBe("<html>graph</html>");
  });

  it("swaps the placeholder document once repositories are discovered", () => {
    const harness = createHarness({ initialIsGraphLoaded: false });
    expect(harness.webview.html).toBe("<html>placeholder</html>");

    const repoCallback = harness.repoCallback();
    if (!repoCallback) throw new Error("view callback was not registered");
    repoCallback(harness.repos, 1);

    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(harness.webview.html).toBe("<html>graph</html>");
    expect(harness.bridge.post).not.toHaveBeenCalled();

    repoCallback(harness.repos, 1);
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(harness.bridge.post).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the placeholder document when re-shown without repositories", () => {
    const harness = createHarness({ initialIsGraphLoaded: false });
    harness.hide();
    harness.show();

    expect(harness.onPanelShown).toHaveBeenCalledTimes(1);
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(harness.bridge.post).not.toHaveBeenCalled();
  });

  it("disposes the panel and its collaborators", () => {
    const harness = createHarness();
    const disposeHandler = harness.disposeHandler();
    disposeHandler?.();

    expect(harness.onDispose).toHaveBeenCalledTimes(1);
    expect(harness.panel.dispose).toHaveBeenCalledTimes(1);
    expect(harness.avatarManager.deregisterBridge).toHaveBeenCalledTimes(1);
    expect(harness.repoFileWatcher.stop).toHaveBeenCalledTimes(1);
    expect(harness.repoManager.deregisterViewCallback).toHaveBeenCalledTimes(1);
  });

  it("forwards reveal to the panel", () => {
    const { panel, webviewPanel } = createHarness();
    webviewPanel.reveal(3 as unknown as vscode.ViewColumn);
    expect(panel.reveal).toHaveBeenCalledWith(3);
  });
});
