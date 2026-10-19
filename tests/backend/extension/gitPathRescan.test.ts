import { describe, expect, it, vi } from "vitest";

const channelLines: string[] = [];

const vscodeMocks = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  focusListener: null as null | ((state: { focused: boolean }) => void),
  configListener: null as null | ((e: { affectsConfiguration(section: string): boolean }) => void),
  serializer: null as null | {
    deserializeWebviewPanel(panel: unknown): Promise<void>;
  }
}));

const panelStub = vi.hoisted(() => ({
  create: vi.fn((_opts: { panel: unknown }) => ({
    reveal: vi.fn(),
    startHistorySearch: vi.fn(),
    getLanguage: () => undefined,
    refreshComponentStatus: async () => {},
    applyTelemetryConsentChange: () => {},
    dispose: vi.fn()
  }))
}));

const gitClientStub = vi.hoisted(() => ({
  setGitPath: vi.fn(),
  getInstance: {}
}));

const repoSearchStub = vi.hoisted(() => ({
  searchWorkspaceForRepos: vi.fn(async () => {}),
  maxDepthChanged: vi.fn()
}));

const repoManagerStub = vi.hoisted(() => ({
  removeReposNotInWorkspace: vi.fn(async () => {}),
  checkReposExist: vi.fn(async () => true),
  sendRepos: vi.fn()
}));

vi.mock("vscode", () => ({
  Uri: {
    file: (p: string) => ({ fsPath: p, path: p })
  },
  window: {
    createOutputChannel: () => ({
      appendLine: (line: string) => {
        channelLines.push(line);
      },
      show: vi.fn()
    }),
    activeTextEditor: undefined,
    createWebviewPanel: vi.fn(),
    registerWebviewPanelSerializer: (_type: string, serializer: never) => {
      vscodeMocks.serializer = serializer;
      return { dispose: () => {} };
    },
    onDidChangeWindowState: (listener: (state: { focused: boolean }) => void) => {
      vscodeMocks.focusListener = listener;
      return { dispose: () => {} };
    }
  },
  workspace: {
    getConfiguration: () => ({
      get: (key: string, defaultValue: unknown) =>
        key in vscodeMocks.settings ? vscodeMocks.settings[key] : (defaultValue ?? null),
      inspect: () => undefined
    }),
    onDidChangeConfiguration: (
      listener: (e: { affectsConfiguration(section: string): boolean }) => void
    ) => {
      vscodeMocks.configListener = listener;
      return { dispose: () => {} };
    },
    registerTextDocumentContentProvider: () => ({ dispose: () => {} })
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: vi.fn(async () => {})
  },
  env: { language: "en" },
  ViewColumn: { One: 1 },
  ExtensionMode: { Production: 1, Development: 2, Test: 3 }
}));

vi.mock("@/avatarManager", () => ({
  AvatarManager: class {
    registerBridge() {}
  }
}));

vi.mock("@/backend/gitClient", () => ({
  gitClientFactory: () => gitClientStub
}));

vi.mock("@/diffDocProvider", () => ({
  DiffDocProvider: class {
    static scheme = "git-graph-libre";
    client: unknown;
    constructor(client: unknown) {
      this.client = client;
    }
  }
}));

vi.mock("@/extension/commandManager", () => ({
  createCommandManager: () => ({ registerAll: () => [] })
}));

vi.mock("@/extension/extensionSettings", () => ({
  explicitExtensionSettings: () => ({})
}));

vi.mock("@/extension/messageHandler", () => ({
  registerMessageHandlers: () => ({ onPanelShown: () => {} })
}));

vi.mock("@/extension/repoManager", () => ({
  createRepoManager: () => repoManagerStub
}));

vi.mock("@/extension/workspaceSearch", () => ({
  createRepoSearch: () => repoSearchStub
}));

vi.mock("@/extension/workspaceWatcher", () => ({
  createRepoWatcher: () => ({ startWatching: vi.fn() })
}));

vi.mock("@/extensionState", () => ({
  ExtensionState: class {
    getLastActiveRepo() {
      return null;
    }
    setLastActiveRepo() {}
  }
}));

vi.mock("@/l10n", () => ({
  initL10n: () => {},
  t: (key: string) => key
}));

vi.mock("@/repoFileWatcher", () => ({
  RepoFileWatcher: class {
    callback: unknown;
    constructor(callback: unknown) {
      this.callback = callback;
    }
  }
}));

vi.mock("@/statusBarItem", () => ({
  StatusBarItem: class {
    refresh() {}
  }
}));

vi.mock("@/telemetry", () => ({
  createTelemetryReporter: () => ({ logActivate: vi.fn() })
}));

vi.mock("@/telemetry/consentPrompt", () => ({
  createConsentPrompt: () => ({ promptIfUnset: async () => {} })
}));

vi.mock("@/extension/webviewBridge", () => ({
  webviewBridgeFactory: () => ({ post: vi.fn(), onMessage: vi.fn() })
}));

vi.mock("@/extension/webviewPanel", () => ({
  createWebviewPanel: panelStub.create
}));

import { activate } from "@/extension";

function makeContext() {
  return {
    subscriptions: [] as { dispose(): void }[],
    extensionPath: "",
    extension: { packageJSON: { version: "1.5.1" } }
  } as unknown as import("vscode").ExtensionContext;
}

describe("activate git.path rescan", () => {
  it("repoints the client and rescans when git.path changes", () => {
    activate(makeContext());

    expect(vscodeMocks.configListener).not.toBeNull();
    vscodeMocks.configListener?.({ affectsConfiguration: (s) => s === "git.path" });

    expect(gitClientStub.setGitPath).toHaveBeenCalledWith("git");
    expect(repoSearchStub.searchWorkspaceForRepos).toHaveBeenCalled();
    expect(channelLines.some((line) => line.includes("[config] git.path changed"))).toBe(true);
  });

  // Trust granted in an external terminal changes nothing VS Code watches;
  // coming back to the window is the moment to look again.
  it("rediscovers repositories when the window regains focus, not when it loses it", () => {
    activate(makeContext());
    repoSearchStub.searchWorkspaceForRepos.mockClear();

    vscodeMocks.focusListener?.({ focused: false });
    expect(repoSearchStub.searchWorkspaceForRepos).not.toHaveBeenCalled();
    vscodeMocks.focusListener?.({ focused: true });
    expect(repoSearchStub.searchWorkspaceForRepos).toHaveBeenCalledTimes(1);
  });

  it("ignores unrelated configuration changes", () => {
    activate(makeContext());
    const calls = gitClientStub.setGitPath.mock.calls.length;

    vscodeMocks.configListener?.({ affectsConfiguration: () => false });

    expect(gitClientStub.setGitPath.mock.calls).toHaveLength(calls);
  });
});

// Runs before the cases below, while no graph panel is live, so closing the
// restored tab can only come from the setting, not from the duplicate path.
describe("activate webview panel serializer with restoring off", () => {
  it("closes a restored tab without opening the graph", async () => {
    vscodeMocks.settings.restoreTabOnStartup = false;
    try {
      activate(makeContext());
      const restored = { webview: {}, visible: true, dispose: vi.fn(), reveal: vi.fn() };

      await vscodeMocks.serializer?.deserializeWebviewPanel(restored);

      expect(restored.dispose).toHaveBeenCalledTimes(1);
      expect(panelStub.create).not.toHaveBeenCalled();
      expect(
        channelLines.some((line) =>
          line.includes("[panel] restore skipped (restoreTabOnStartup=false)")
        )
      ).toBe(true);
    } finally {
      delete vscodeMocks.settings.restoreTabOnStartup;
    }
  });
});

// Order-coupled on purpose: `currentPanel` is module state in extension.ts,
// so the duplicate-restore case needs the panel the first case rebound.
describe("activate webview panel serializer", () => {
  it("rebinds a restored panel instead of creating a new one, then rescans", async () => {
    activate(makeContext());
    expect(vscodeMocks.serializer).not.toBeNull();
    const restored = { webview: {}, visible: true, dispose: vi.fn(), reveal: vi.fn() };

    await vscodeMocks.serializer?.deserializeWebviewPanel(restored);

    expect(panelStub.create).toHaveBeenCalledTimes(1);
    expect(panelStub.create.mock.calls[0]?.[0]).toMatchObject({ panel: restored });
    expect(repoSearchStub.searchWorkspaceForRepos).toHaveBeenCalled();
    expect(restored.dispose).not.toHaveBeenCalled();
  });

  it("disposes a duplicate restored panel when a graph panel is already live", async () => {
    let disposed = 0;
    const duplicate = {
      webview: {},
      visible: true,
      dispose: () => {
        disposed += 1;
      },
      reveal: vi.fn()
    };

    await vscodeMocks.serializer?.deserializeWebviewPanel(duplicate);

    expect(disposed).toBe(1);
    // Call counts reset between tests; no new panel may be created here.
    expect(panelStub.create).not.toHaveBeenCalled();
  });
});
