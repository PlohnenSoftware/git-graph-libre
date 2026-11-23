import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AvatarManager } from "@/avatarManager";
import { loadEngineAddon } from "@/backend/engine/addon";
import type { GitClient } from "@/backend/gitClient";
import type { Config } from "@/config";
import { createCommandManager } from "@/extension/commandManager";
import { registerMessageHandlers } from "@/extension/messageHandler";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewBridge } from "@/extension/webviewBridge";
import type { RepoSearch } from "@/extension/workspaceSearch";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { StatsSource } from "@/statsTabTypes";
import type { RequestMessage, ResponseMessage } from "@/types";

/**
 * F3-02: the two sites that assemble the Statistics tab's source — the
 * graph handler's default `openStatistics` and the command manager's —
 * pass the live `backend` setting and the repository's verification
 * into `createStatsSource`. The panel is replaced so each case can
 * take the source a site built and drive one real load through it as
 * those deps flip. The gated answers (`backendCli`, `notVerified`)
 * hold with or without a built engine; the served one needs it.
 */
const opened = vi.hoisted(() => ({
  calls: [] as Array<{ repo: string; source: StatsSource }>
}));
vi.mock("@/extension/statsTab/statsTabPanel", () => ({
  openStatsTab: (repo: string, source: StatsSource) => {
    opened.calls.push({ repo, source });
  }
}));

const backendSetting = { value: "auto" as "auto" | "git-cli" };
const verified = { value: true };

let repo: string;
let root: string;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-stats-assembly-"));
  const emptyConfig = path.join(root, "empty.gitconfig");
  fs.writeFileSync(emptyConfig, "");
  for (const [key, value] of [
    ["GIT_CONFIG_GLOBAL", emptyConfig],
    ["GIT_CONFIG_NOSYSTEM", "1"]
  ] as const) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  repo = makeRepo();
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of [repo, root]) fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  opened.calls.length = 0;
  backendSetting.value = "auto";
  verified.value = true;
});

function capturedSource(): StatsSource {
  const call = opened.calls.at(-1);
  if (call === undefined || call.repo !== repo) {
    throw new Error("the statistics panel was not opened for the fixture repository");
  }
  return call.source;
}

function openViaMessageHandler(): Map<RequestMessage["command"], (msg: RequestMessage) => unknown> {
  const handlers = new Map<RequestMessage["command"], (msg: RequestMessage) => unknown>();
  const bridge = {
    post: (_msg: ResponseMessage) => {},
    onMessage: (command: RequestMessage["command"], handler: (msg: RequestMessage) => unknown) => {
      handlers.set(command, handler);
    }
  } as unknown as WebviewBridge;
  registerMessageHandlers(bridge, {
    config: {
      backend: () => backendSetting.value,
      gitPath: () => "git",
      dateType: () => "Author Date",
      showUncommittedChanges: () => false
    } as unknown as Config,
    gitClient: { getInstance: () => ({}), setRepo: vi.fn() } as unknown as GitClient,
    repoManager: {
      getRepos: () => ({ [repo]: { columnWidths: null } })
    } as unknown as RepoManager,
    repoSearch: {
      isVerified: () => verified.value,
      forgetVerification: vi.fn()
    } as unknown as RepoSearch,
    extensionState: { setLastActiveRepo: vi.fn() } as unknown as ExtensionState,
    avatarManager: {} as AvatarManager,
    repoFileWatcher: { start: vi.fn() } as unknown as RepoFileWatcher
    // No openStatsTab: the handler's default assembly is under test.
  });
  return handlers;
}

type QuickPickItem = { label: string; description: string; repo: string };
type CommandHandler = (...args: unknown[]) => unknown;

async function openViaCommandManager(): Promise<StatsSource> {
  const handlers = new Map<string, CommandHandler>();
  const manager = createCommandManager({
    commandApi: {
      registerCommand: (id: string, handler: CommandHandler) => {
        handlers.set(id, handler);
        return { dispose: vi.fn() };
      }
    },
    windowApi: {
      getActiveTextEditorUri: vi.fn(() => undefined),
      showErrorMessage: vi.fn(async (_message: string) => undefined),
      showInformationMessage: vi.fn(async (_message: string) => undefined),
      showOpenDialog: vi.fn(async () => undefined as Array<{ fsPath: string }> | undefined),
      showQuickPick: vi.fn(
        async (_items: readonly QuickPickItem[]) => undefined as QuickPickItem | undefined
      ),
      showWarningMessage: vi.fn(async (_message: string) => undefined),
      openFile: vi.fn(async (_filePath: string) => undefined),
      showChoice: vi.fn(
        async (_items: readonly { id: string; label: string }[], _holder: string) => undefined
      ),
      openUntitledMarkdown: vi.fn(async (_content: string) => undefined)
    },
    folderApi: {
      workspaceFolderPaths: vi.fn(() => []),
      addWorkspaceFolder: vi.fn((_folderPath: string) => true),
      openFolder: vi.fn(async (_folderPath: string, _newWindow: boolean) => undefined),
      revealInOS: vi.fn(async (_folderPath: string) => undefined)
    },
    extensionVersion: "0.0.0",
    outputChannel: { appendLine: () => {}, show: vi.fn() },
    config: {
      gitPath: () => "git",
      backend: () => backendSetting.value
    } as unknown as Config,
    extensionState: {
      getLastActiveRepo: () => repo,
      setLastActiveRepo: vi.fn()
    } as unknown as ExtensionState,
    repoManager: {
      getRepos: () => ({ [repo]: { columnWidths: null } })
    } as unknown as RepoManager,
    avatarManager: { clearCache: vi.fn() },
    openGraphView: vi.fn(),
    getCurrentPanel: () => undefined,
    extensionPath: root,
    isVerified: () => verified.value
    // No openStatsTab: the manager's default assembly is under test.
  });
  manager.registerAll();
  await handlers.get("git-graph-libre.showStatistics")?.(repo);
  manager.dispose();
  return capturedSource();
}

/** The answers one assembled source must give as its live deps flip. */
async function expectLiveGates(source: StatsSource): Promise<void> {
  const served = await source.load(repo);
  if (loadEngineAddon() === null) {
    expect(served).toEqual({ state: "unavailable", reason: "noAddon" });
  } else {
    expect(served.state).toBe("ok");
    if (served.state === "ok") {
      expect(served.authors).toEqual([{ name: "T", email: "t@t.com", commits: 1 }]);
      expect(served.cells).toHaveLength(1);
    }
  }
  backendSetting.value = "git-cli";
  await expect(source.load(repo)).resolves.toEqual({ state: "unavailable", reason: "backendCli" });
  backendSetting.value = "auto";
  verified.value = false;
  await expect(source.load(repo)).resolves.toEqual({
    state: "unavailable",
    reason: "notVerified"
  });
}

describe("statistics tab assembly (F3-02)", () => {
  it("the graph handler opens the tab only for a known repository, with live gates", async () => {
    const handlers = openViaMessageHandler();
    handlers.get("showStatistics")?.({ command: "showStatistics", repo: "/elsewhere" });
    expect(opened.calls).toHaveLength(0);
    handlers.get("showStatistics")?.({ command: "showStatistics", repo });
    await expectLiveGates(capturedSource());
  });

  it("the command manager assembles the same source for its command", async () => {
    await expectLiveGates(await openViaCommandManager());
  });
});
