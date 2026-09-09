import { describe, expect, it, vi } from "vitest";

const channelLines: string[] = [];

const vscodeMocks = vi.hoisted(() => ({
  configListener: null as null | ((e: { affectsConfiguration(section: string): boolean }) => void)
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
  window: {
    createOutputChannel: () => ({
      appendLine: (line: string) => {
        channelLines.push(line);
      },
      show: vi.fn()
    }),
    activeTextEditor: undefined,
    createWebviewPanel: vi.fn()
  },
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, defaultValue: unknown) => defaultValue ?? null,
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
    registerCommand: () => ({ dispose: () => {} })
  },
  env: { language: "en" },
  ViewColumn: { One: 1 }
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
  webviewBridgeFactory: () => ({})
}));

vi.mock("@/extension/webviewPanel", () => ({
  createWebviewPanel: () => ({})
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

  it("ignores unrelated configuration changes", () => {
    activate(makeContext());
    const calls = gitClientStub.setGitPath.mock.calls.length;

    vscodeMocks.configListener?.({ affectsConfiguration: () => false });

    expect(gitClientStub.setGitPath.mock.calls).toHaveLength(calls);
  });
});
