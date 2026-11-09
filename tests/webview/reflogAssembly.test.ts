import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvatarManager } from "@/avatarManager";
import type { GitClient } from "@/backend/gitClient";
import { setOperationLog } from "@/backend/utils/operationLog";
import type { Config } from "@/config";
import { createCommandManager } from "@/extension/commandManager";
import { registerMessageHandlers } from "@/extension/messageHandler";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewBridge } from "@/extension/webviewBridge";
import type { RepoSearch } from "@/extension/workspaceSearch";
import type { ExtensionState } from "@/extensionState";
import type { ReflogSource } from "@/reflogTabTypes";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { RequestMessage, ResponseMessage } from "@/types";

/**
 * F1-09F: the two sites that assemble the Reflog tab's source — the graph
 * handler's default `openReflog` and the command manager's — pass the live
 * `backend` setting and the repository's verification into
 * `createReflogSource`. The panel is replaced so each case can take the
 * source a site built and drive one real page through it: the engine is
 * offered the read only when the setting allows it and the repository is
 * verified. F1-09's parity suite proves the reader's own declines and
 * that engine and CLI pages agree; this file pins only the wiring. The
 * engine-served cases need the built engine (`pnpm run engine:build`),
 * like the trust-gate suite's.
 */
const opened = vi.hoisted(() => ({
  calls: [] as Array<{ repo: string; source: ReflogSource }>
}));
vi.mock("@/extension/reflogTab/reflogTabPanel", () => ({
  openReflogTab: (repo: string, source: ReflogSource) => {
    opened.calls.push({ repo, source });
  }
}));

// Both are read live by the assemblies, so a case flips them between pages
// served by the one source it captured.
const backendSetting = { value: "auto" as "auto" | "git-cli" };
const verified = { value: true };

let repo: string;
let root: string;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  // Real Git and the engine read no global or system config in here.
  root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-reflog-assembly-"));
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
  fs.writeFileSync(path.join(repo, "second"), "second");
  git(["add", "."], repo);
  git(["commit", "-m", "second"], repo);
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

function capturedSource(): ReflogSource {
  const call = opened.calls.at(-1);
  if (call === undefined || call.repo !== repo) {
    throw new Error("the reflog panel was not opened for the fixture repository");
  }
  return call.source;
}

/** One page through the captured source, with the route lines it logs. */
async function routeLines(source: ReflogSource): Promise<string[]> {
  const lines: string[] = [];
  const log = setOperationLog((line) => lines.push(line));
  try {
    const page = await source.loadPage(repo, 0, 200);
    expect(page.error).toBeNull();
    expect(page.rows.length).toBeGreaterThan(0);
  } finally {
    log.dispose();
  }
  return lines;
}

function openViaMessageHandler(): ReflogSource {
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
    // No openReflogTab: the handler's default assembly is under test.
  });
  handlers.get("showReflog")?.({ command: "showReflog", repo } as RequestMessage);
  return capturedSource();
}

type QuickPickItem = { label: string; description: string; repo: string };
type CommandHandler = (...args: unknown[]) => unknown;

async function openViaCommandManager(withVerified: boolean): Promise<ReflogSource> {
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
    ...(withVerified ? { isVerified: () => verified.value } : {})
    // No openReflogTab: the manager's default assembly is under test.
  });
  manager.registerAll();
  await handlers.get("git-graph-libre.showReflog")?.(repo);
  manager.dispose();
  return capturedSource();
}

/** The three routes one assembled source must take as its live deps flip. */
async function expectLiveRouting(source: ReflogSource): Promise<void> {
  // Allowed and verified: the engine serves the page.
  expect(await routeLines(source)).toContainEqual(
    expect.stringContaining("operation=loadReflog backend=engine")
  );
  // The git-cli preference is read live, so the same source stays on the CLI.
  backendSetting.value = "git-cli";
  expect(await routeLines(source)).toContainEqual(
    expect.stringContaining("operation=loadReflog backend=cli reason=setting")
  );
  // Allowed again, but a repository Git has not accepted is never offered.
  backendSetting.value = "auto";
  verified.value = false;
  expect(await routeLines(source)).toContainEqual(
    expect.stringContaining("operation=loadReflog backend=cli reason=unverified")
  );
}

describe("the reflog sources the two assembly sites build (F1-09F)", () => {
  it("the graph handler's source follows the live backend and verification", async () => {
    await expectLiveRouting(openViaMessageHandler());
  });

  it("the command manager's source follows the live backend and verification", async () => {
    await expectLiveRouting(await openViaCommandManager(true));
  });

  it("the command manager without a verification dep stays on the CLI", async () => {
    const source = await openViaCommandManager(false);
    expect(await routeLines(source)).toContainEqual(
      expect.stringContaining("operation=loadReflog backend=cli reason=unverified")
    );
  });
});
