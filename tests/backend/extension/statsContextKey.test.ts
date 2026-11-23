import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { loadEngineAddon } from "@/backend/engine/addon";
import { STATS_TAB_AVAILABLE_CONTEXT } from "@/extension/statsTab/availability";

const vscodeMocks = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  configListener: null as null | ((e: { affectsConfiguration(section: string): boolean }) => void),
  executeCommand: vi.fn(async (..._args: unknown[]) => {})
}));

vi.mock("vscode", () => ({
  Uri: {
    file: (p: string) => ({ fsPath: p, path: p })
  },
  window: {
    createOutputChannel: () => ({
      appendLine: vi.fn(),
      show: vi.fn()
    }),
    activeTextEditor: undefined,
    createWebviewPanel: vi.fn(),
    registerWebviewPanelSerializer: () => ({ dispose: () => {} }),
    onDidChangeWindowState: () => ({ dispose: () => {} })
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
    executeCommand: (...args: unknown[]) => vscodeMocks.executeCommand(...args)
  },
  version: "1.98.0",
  env: { language: "en", appName: "Visual Studio Code" },
  ViewColumn: { One: 1 },
  ExtensionMode: { Production: 1, Development: 2, Test: 3 }
}));

vi.mock("@/avatarManager", () => ({
  AvatarManager: class {
    registerBridge() {}
  }
}));

vi.mock("@/backend/gitClient", () => ({
  gitClientFactory: () => ({ setGitPath: vi.fn(), getInstance: {} })
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
  registerMessageHandlers: () => ({ onPanelShown: () => {}, dispose: () => {} })
}));

vi.mock("@/extension/repoManager", () => ({
  createRepoManager: () => ({
    removeReposNotInWorkspace: vi.fn(async () => {}),
    checkReposExist: vi.fn(async () => true),
    sendRepos: vi.fn()
  })
}));

vi.mock("@/extension/workspaceSearch", () => ({
  createRepoSearch: () => ({
    searchWorkspaceForRepos: vi.fn(async () => {}),
    maxDepthChanged: vi.fn(),
    isVerified: () => true
  })
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
  RepoFileWatcher: class {}
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
  createWebviewPanel: vi.fn()
}));

import { activate } from "@/extension";

const logRoots: string[] = [];
afterAll(() => {
  for (const root of logRoots) fs.rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  vscodeMocks.executeCommand.mockClear();
  vscodeMocks.configListener = null;
  for (const key of Object.keys(vscodeMocks.settings)) delete vscodeMocks.settings[key];
});

function makeContext() {
  const logRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-stats-ctx-"));
  logRoots.push(logRoot);
  return {
    subscriptions: [] as { dispose(): void }[],
    logUri: { fsPath: path.join(logRoot, "logs") },
    extensionPath: "",
    extension: { packageJSON: { version: "1.10.0" } }
  } as unknown as import("vscode").ExtensionContext;
}

function statsContextCalls(): boolean[] {
  return vscodeMocks.executeCommand.mock.calls
    .filter((args) => args[0] === "setContext" && args[1] === STATS_TAB_AVAILABLE_CONTEXT)
    .map((args) => args[2] as boolean);
}

describe("statsTabAvailable activation and backend change wiring", () => {
  it("sets statsTabAvailable at activation and recomputes it when backend changes", () => {
    const addon = loadEngineAddon();
    const expectedOnAuto =
      typeof addon?.authorStats === "function" && typeof addon?.activityHeatmap === "function";

    vscodeMocks.settings.backend = "auto";
    activate(makeContext());
    expect(statsContextCalls()).toEqual([expectedOnAuto]);

    vscodeMocks.settings.backend = "git-cli";
    vscodeMocks.configListener?.({ affectsConfiguration: (s) => s === "git-graph-libre.backend" });
    expect(statsContextCalls()).toEqual([expectedOnAuto, false]);

    vscodeMocks.settings.backend = "auto";
    vscodeMocks.configListener?.({ affectsConfiguration: (s) => s === "git-graph-libre.backend" });
    expect(statsContextCalls()).toEqual([expectedOnAuto, false, expectedOnAuto]);
  });

  it("sets statsTabAvailable to false at activation when backend starts as git-cli", () => {
    vscodeMocks.settings.backend = "git-cli";
    activate(makeContext());
    expect(statsContextCalls()).toEqual([false]);
  });
});
