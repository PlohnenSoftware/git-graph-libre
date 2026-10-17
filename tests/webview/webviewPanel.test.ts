import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

import type { AvatarManager } from "@/avatarManager";
import type { Config } from "@/config";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewBridge } from "@/extension/webviewBridge";
import { createWebviewPanel } from "@/extension/webviewPanel";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { ComponentStatus, EngineComponentStatus, GitRepoSet, TelemetryConsent } from "@/types";

const ACTIVE_ENGINE: EngineComponentStatus = {
  state: "active",
  version: "1.0.25",
  platform: "linux-x64"
};

const mocks = vi.hoisted(() => ({
  buildWebviewHtml: vi.fn(
    (_opts: {
      language?: string;
    }): {
      html: string;
      isGraphLoaded: boolean;
      engine: EngineComponentStatus | null;
    } => ({
      html: "<html>graph</html>",
      isGraphLoaded: true,
      engine: null
    })
  ),
  buildComponentStatus: vi.fn(
    async (_deps: unknown): Promise<ComponentStatus> => ({
      git: { state: "ok", path: "git", version: "git version 2.51.0" },
      engine: { state: "off" },
      graphLoad: null
    })
  )
}));

vi.mock("@/extension/webviewHtml", () => ({ buildWebviewHtml: mocks.buildWebviewHtml }));
vi.mock("@/extension/componentStatus", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/extension/componentStatus")>()),
  buildComponentStatus: mocks.buildComponentStatus
}));

type ViewStateHandler = () => void;
type RepoCallback = (repos: GitRepoSet, numRepos: number) => void;
type DisposeHandler = () => void;

function createHarness(opts?: {
  initialIsGraphLoaded?: boolean;
  consent?: TelemetryConsent;
  initialRepos?: GitRepoSet;
  initialVisible?: boolean;
  repoSearch?: boolean;
}) {
  const initialIsGraphLoaded = opts?.initialIsGraphLoaded ?? true;
  let consent: TelemetryConsent = opts?.consent ?? "enabled";
  mocks.buildWebviewHtml.mockImplementationOnce(() => ({
    html: initialIsGraphLoaded ? "<html>graph</html>" : "<html>placeholder</html>",
    isGraphLoaded: initialIsGraphLoaded,
    engine: initialIsGraphLoaded ? ACTIVE_ENGINE : null
  }));

  let viewStateHandler: ViewStateHandler | undefined;
  let disposeHandler: DisposeHandler | undefined;
  const webview = { html: "" };
  const panel = {
    visible: opts?.initialVisible ?? true,
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
  const bridgeHandlers = new Map<string, (msg: unknown) => void>();
  const bridge = {
    post: vi.fn(),
    onMessage: vi.fn((command: string, handler: (msg: unknown) => void) => {
      bridgeHandlers.set(command, handler);
    })
  };
  const repoFileWatcher = { stop: vi.fn() };
  const repos: GitRepoSet = opts?.initialRepos ?? { "/repo": { columnWidths: null } };
  let currentRepos: GitRepoSet = repos;
  let repoCallback: RepoCallback | undefined;
  const repoManager = {
    getRepos: vi.fn(() => currentRepos),
    registerViewCallback: vi.fn((handler: RepoCallback) => {
      repoCallback = handler;
    }),
    deregisterViewCallback: vi.fn()
  };
  const repoSearch = opts?.repoSearch
    ? {
        searchWorkspaceForRepos: vi.fn(async () => {}),
        getDiagnostics: vi.fn(() => ({ roots: ["/workspace"], repositories: [] }))
      }
    : undefined;
  const avatarManager = { deregisterBridge: vi.fn() };
  const extensionState = { getLastActiveRepo: vi.fn(() => "/repo") };
  const onDispose = vi.fn();
  const onPanelShown = vi.fn();
  const outputChannel = { appendLine: vi.fn() };
  const telemetryEvents: Array<{ feature: string; ok: boolean }> = [];

  const webviewPanel = createWebviewPanel({
    panel: panel as unknown as vscode.WebviewPanel,
    bridge: bridge as unknown as WebviewBridge,
    config: {
      tabIconColorTheme: () => "color",
      telemetryConsent: () => consent,
      backend: () => "git-cli",
      gitPath: () => "/opt/git",
      maxDepthOfRepoSearch: () => 2
    } as unknown as Config,
    repoFileWatcher: repoFileWatcher as unknown as RepoFileWatcher,
    extensionPath: process.cwd(),
    extensionState: extensionState as unknown as ExtensionState,
    avatarManager: avatarManager as unknown as AvatarManager,
    repoManager: repoManager as unknown as RepoManager,
    repoSearch: repoSearch as never,
    extensionVersion: "1.2.3",
    outputChannel,
    telemetry: {
      logFeature: (feature: string, ok: boolean) => {
        telemetryEvents.push({ feature, ok });
      }
    },
    onDispose,
    onPanelShown
  });

  return {
    avatarManager,
    bridge,
    send: (command: string, msg: unknown) => bridgeHandlers.get(command)?.(msg),
    telemetryEvents,
    setConsent: (next: TelemetryConsent) => {
      consent = next;
    },
    disposeHandler: () => disposeHandler,
    hide: () => {
      panel.visible = false;
      viewStateHandler?.();
    },
    onDispose,
    onPanelShown,
    outputChannel,
    panel,
    repoCallback: () => repoCallback,
    repoFileWatcher,
    repoManager,
    repoSearch,
    repos,
    emitRepos: (next: GitRepoSet) => {
      currentRepos = next;
      repoCallback?.(next, Object.keys(next).length);
    },
    show: () => {
      panel.visible = true;
      viewStateHandler?.();
    },
    webview,
    webviewPanel
  };
}

describe("createWebviewPanel", () => {
  it("synchronizes a restored panel that starts hidden when it first becomes visible", () => {
    const harness = createHarness({ initialVisible: false });
    harness.emitRepos({});
    harness.show();
    expect(harness.onPanelShown).toHaveBeenCalledTimes(1);
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
  });
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

  it("posts loadRepos without rebuilding when the repo set changes on the same side of zero", () => {
    const harness = createHarness();

    harness.emitRepos({ "/repo": { columnWidths: null }, "/repo2": { columnWidths: null } });

    expect(harness.bridge.post).toHaveBeenCalledWith({
      command: "loadRepos",
      repos: { "/repo": { columnWidths: null }, "/repo2": { columnWidths: null } },
      lastActiveRepo: "/repo"
    });
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
    expect(harness.webview.html).toBe("<html>graph</html>");
  });

  it("swaps documents in both directions across the zero-repository transition", () => {
    const harness = createHarness();

    // The last repository became unavailable: the graph document gives way
    // to the startup screen instead of receiving an empty loadRepos.
    harness.emitRepos({});
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(harness.bridge.post).not.toHaveBeenCalled();

    // And back: the first usable repository mounts the graph again.
    harness.emitRepos(harness.repos);
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(3);
    expect(harness.bridge.post).not.toHaveBeenCalled();

    harness.emitRepos(harness.repos);
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(3);
    expect(harness.bridge.post).toHaveBeenCalledTimes(1);
  });

  it("swaps the placeholder document once repositories are discovered", () => {
    const harness = createHarness({ initialIsGraphLoaded: false, initialRepos: {} });
    expect(harness.webview.html).toBe("<html>placeholder</html>");

    harness.emitRepos({ "/repo": { columnWidths: null } });

    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(harness.webview.html).toBe("<html>graph</html>");
    expect(harness.bridge.post).not.toHaveBeenCalled();

    harness.emitRepos({ "/repo": { columnWidths: null } });
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(harness.bridge.post).toHaveBeenCalledTimes(1);
  });

  it("refreshes recovery in place when re-shown without repositories", async () => {
    const harness = createHarness({
      initialIsGraphLoaded: false,
      initialRepos: {},
      repoSearch: true
    });
    harness.hide();
    harness.show();

    expect(harness.onPanelShown).toHaveBeenCalledTimes(1);
    // The startup document is live script now: it is refreshed by message,
    // not rebuilt. The post lands after the re-scan it triggers completes.
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(harness.bridge.post).toHaveBeenCalledWith(
        expect.objectContaining({ command: "repositoryStatus" })
      );
    });
    expect(harness.repoSearch?.searchWorkspaceForRepos).toHaveBeenCalled();
  });

  it("applies a repository transition that happened while hidden on re-show", () => {
    const harness = createHarness();
    harness.hide();

    // The callback fires while hidden and is ignored; nothing swaps yet.
    harness.emitRepos({});
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);

    harness.show();

    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(harness.bridge.post).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: "loadRepos" })
    );
  });

  it("counts a failure screen again only after the graph actually recovered", () => {
    const harness = createHarness({
      initialIsGraphLoaded: false,
      initialRepos: {},
      repoSearch: true
    });
    const failures = () =>
      harness.telemetryEvents.filter((event) => event.feature.startsWith("view.failure."));
    const show = (screen: string) =>
      harness.send("failureScreenShown", { command: "failureScreenShown", screen });

    show("repositoryError");
    show("repositoryError");
    expect(failures()).toHaveLength(1);

    // Recovered: the startup screen gave way to the graph...
    harness.emitRepos({ "/repo": { columnWidths: null } });
    // ...and then lost it again, so the same failure is a new appearance.
    mocks.buildWebviewHtml.mockImplementationOnce(() => ({
      html: "<html>placeholder</html>",
      isGraphLoaded: false,
      engine: null
    }));
    harness.emitRepos({});
    show("repositoryError");
    expect(failures()).toHaveLength(2);
  });

  it("does not count a failure again when the graph is only rebuilt in place", () => {
    const harness = createHarness({ repoSearch: true });
    const failures = () =>
      harness.telemetryEvents.filter((event) => event.feature.startsWith("view.failure."));
    const show = () =>
      harness.send("failureScreenShown", {
        command: "failureScreenShown",
        screen: "graphLoadError"
      });

    show();
    harness.send("setTemporaryLanguage", { command: "setTemporaryLanguage", language: "pl" });
    // The rebuilt document reports the error it still shows.
    show();
    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(failures()).toEqual([{ feature: "view.failure.graphLoadError", ok: false }]);
  });

  it("stops rechecking repositories once the panel is disposed", () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({ repoSearch: true });
      harness.repoSearch?.getDiagnostics.mockReturnValue({
        roots: ["/workspace"],
        repositories: [
          {
            path: "/workspace",
            state: "untrusted",
            repository: true,
            detectedBy: "git",
            detail: null
          }
        ]
      } as never);
      vi.advanceTimersByTime(5000);
      expect(harness.repoSearch?.searchWorkspaceForRepos).toHaveBeenCalledTimes(1);
      harness.disposeHandler()?.();
      vi.advanceTimersByTime(20000);
      expect(harness.repoSearch?.searchWorkspaceForRepos).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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

  // The consent screen and the graph are separate documents, so crossing the
  // pending boundary is the only reason to rebuild — and rebuilding a mounted
  // graph would reload the webview and drop its live state.
  it("swaps the consent screen for the graph once the question is answered", () => {
    const harness = createHarness({ initialIsGraphLoaded: false, consent: "unset" });
    expect(harness.webview.html).toBe("<html>placeholder</html>");

    harness.setConsent("enabled");
    harness.webviewPanel.applyTelemetryConsentChange();

    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(harness.webview.html).toBe("<html>graph</html>");
  });

  it("puts the consent screen back if the answer is cleared", () => {
    const harness = createHarness({ consent: "enabled" });

    harness.setConsent("unset");
    harness.webviewPanel.applyTelemetryConsentChange();

    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
  });

  it.each<TelemetryConsent>(["enabled", "disabled"])(
    "does not rebuild a mounted graph when the answer changes to %s",
    (next) => {
      const harness = createHarness({ consent: "enabled" });

      harness.setConsent(next);
      harness.webviewPanel.applyTelemetryConsentChange();

      expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
    }
  );

  it("does not rebuild while the consent screen is already showing", () => {
    const harness = createHarness({ initialIsGraphLoaded: false, consent: "unset" });

    harness.webviewPanel.applyTelemetryConsentChange();

    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
  });

  // The switch is a document rebuild, not a message: every string in the
  // document — toolbar, status strip, table headers — was baked in at build
  // time.
  it("rebuilds the document in the requested language", () => {
    const harness = createHarness();

    harness.send("setTemporaryLanguage", { command: "setTemporaryLanguage", language: "pl" });

    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(2);
    expect(mocks.buildWebviewHtml.mock.calls[1][0]).toMatchObject({ language: "pl" });
  });

  it("keeps serving the chosen language on later rebuilds", () => {
    const harness = createHarness();
    harness.send("setTemporaryLanguage", { command: "setTemporaryLanguage", language: "nl" });

    harness.repoCallback()?.(harness.repos, 1);

    for (const call of mocks.buildWebviewHtml.mock.calls.slice(1)) {
      expect(call[0]).toMatchObject({ language: "nl" });
    }
  });

  // Anything reaching the bridge is webview input; an unknown locale must not
  // become a filename to read.
  it("ignores a language it does not ship", () => {
    const harness = createHarness();

    harness.send("setTemporaryLanguage", { command: "setTemporaryLanguage", language: "../etc" });

    expect(mocks.buildWebviewHtml).toHaveBeenCalledTimes(1);
  });

  it("reports the switch as a feature", () => {
    const harness = createHarness();

    harness.send("setTemporaryLanguage", { command: "setTemporaryLanguage", language: "pl" });

    expect(harness.telemetryEvents).toEqual([{ feature: "setTemporaryLanguage", ok: true }]);
  });

  it("forwards reveal to the panel", () => {
    const { panel, webviewPanel } = createHarness();
    webviewPanel.reveal(3 as unknown as vscode.ViewColumn);
    expect(panel.reveal).toHaveBeenCalledWith(3);
  });

  it("logs the engine state when it builds the graph document, and not for a placeholder", () => {
    const graph = createHarness();
    expect(graph.outputChannel.appendLine).toHaveBeenCalledWith(
      "[engine] Rust engine 1.0.25 active (linux-x64)"
    );

    const placeholder = createHarness({ initialIsGraphLoaded: false });
    const engineLines = placeholder.outputChannel.appendLine.mock.calls.filter(([line]) =>
      String(line).startsWith("[engine]")
    );
    expect(engineLines).toHaveLength(0);
  });

  it("pushes fresh component status to a mounted graph, with the live settings", async () => {
    const { bridge, outputChannel, webviewPanel } = createHarness();

    await webviewPanel.refreshComponentStatus();

    expect(mocks.buildComponentStatus).toHaveBeenCalledWith({
      preference: "git-cli",
      gitPath: "/opt/git"
    });
    expect(bridge.post).toHaveBeenCalledWith({
      command: "componentStatus",
      components: {
        git: { state: "ok", path: "git", version: "git version 2.51.0" },
        engine: { state: "off" },
        graphLoad: null
      }
    });
    expect(outputChannel.appendLine).toHaveBeenLastCalledWith(
      "[engine] Rust engine off: the backend setting is git-cli, so every read uses the git CLI"
    );
  });

  it("skips the push while a placeholder, which cannot receive it, is mounted", async () => {
    const { bridge, webviewPanel } = createHarness({ initialIsGraphLoaded: false });

    await webviewPanel.refreshComponentStatus();

    expect(mocks.buildComponentStatus).not.toHaveBeenCalled();
    expect(bridge.post).not.toHaveBeenCalled();
  });
});
