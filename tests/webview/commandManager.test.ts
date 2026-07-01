import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { Config } from "@/config";
import { createCommandManager } from "@/extension/commandManager";
import type { RepoManager } from "@/extension/repoManager";
import type { ExtensionState } from "@/extensionState";
import type { GitRepoSet } from "@/types";

import { makeRepo } from "@tests/backend/helpers";

type CommandHandler = (...args: unknown[]) => unknown;
type QuickPickItem = {
  label: string;
  description: string;
  repo: string;
};

function makeUri(fsPath: string) {
  return { fsPath };
}

function makeHarness(initialRepos: GitRepoSet = {}, initialLastRepo: string | null = null) {
  const repos: GitRepoSet = { ...initialRepos };
  const handlers = new Map<string, CommandHandler>();
  const disposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
  let lastActiveRepo = initialLastRepo;
  let activeTextEditorUri: { fsPath: string } | undefined;
  let sendReposCount = 0;
  const outputLines: string[] = [];

  const commandApi = {
    registerCommand: (id: string, handler: CommandHandler) => {
      const disposable = { dispose: vi.fn() };
      handlers.set(id, handler);
      disposables.push(disposable);
      return disposable;
    }
  };

  const windowApi = {
    getActiveTextEditorUri: vi.fn(() => activeTextEditorUri),
    showErrorMessage: vi.fn(async (_message: string) => undefined),
    showInformationMessage: vi.fn(async (_message: string) => undefined),
    showOpenDialog: vi.fn(async () => undefined as Array<{ fsPath: string }> | undefined),
    showQuickPick: vi.fn(
      async (_items: readonly QuickPickItem[]) => undefined as QuickPickItem | undefined
    ),
    showWarningMessage: vi.fn(async (_message: string) => undefined)
  };

  const repoManager = {
    getRepos: () => ({ ...repos }),
    addRepo: (repo: string) => {
      repos[repo] = { columnWidths: null };
    },
    removeRepo: (repo: string) => {
      delete repos[repo];
    },
    sendRepos: () => {
      sendReposCount++;
    }
  } as unknown as RepoManager;

  const extensionState = {
    getLastActiveRepo: () => lastActiveRepo,
    setLastActiveRepo: (repo: string | null) => {
      lastActiveRepo = repo;
    }
  } as unknown as ExtensionState;

  const outputChannel = {
    appendLine: (line: string) => {
      outputLines.push(line);
    },
    show: vi.fn()
  };

  const openGraphView = vi.fn();
  const clearCache = vi.fn();
  const manager = createCommandManager({
    commandApi,
    windowApi,
    extensionVersion: "0.4.0",
    outputChannel,
    config: { gitPath: () => "git" } as unknown as Config,
    extensionState,
    repoManager,
    avatarManager: { clearCache },
    openGraphView,
    getCurrentPanel: () => undefined
  });
  manager.registerAll();

  async function run(command: string) {
    const handler = handlers.get(command);
    if (!handler) throw new Error(`Missing command: ${command}`);
    await handler();
  }

  return {
    clearCache,
    disposables,
    getLastActiveRepo: () => lastActiveRepo,
    getRepos: () => ({ ...repos }),
    getSendReposCount: () => sendReposCount,
    handlers,
    manager,
    openGraphView,
    outputChannel,
    outputLines,
    run,
    setActiveTextEditorPath: (filePath: string) => {
      activeTextEditorUri = makeUri(filePath);
    },
    windowApi
  };
}

describe("command manager", () => {
  it("registers the extension command surface", () => {
    const { handlers, manager } = makeHarness();

    expect([...handlers.keys()].toSorted()).toEqual([
      "git-graph-libre.addRepo",
      "git-graph-libre.clearAvatarCache",
      "git-graph-libre.removeRepo",
      "git-graph-libre.showDiagnostics",
      "git-graph-libre.view",
      "git-graph-libre.viewActiveEditorRepo"
    ]);
    expect(
      manager
        .getRegisteredCommands()
        .map((command) => command.id)
        .toSorted()
    ).toEqual([
      "git-graph-libre.addRepo",
      "git-graph-libre.clearAvatarCache",
      "git-graph-libre.removeRepo",
      "git-graph-libre.showDiagnostics",
      "git-graph-libre.view",
      "git-graph-libre.viewActiveEditorRepo"
    ]);
  });

  it("opens the longest matching known repository for the active editor", async () => {
    const { getLastActiveRepo, getSendReposCount, openGraphView, run, setActiveTextEditorPath } =
      makeHarness({
        "/workspace/project": { columnWidths: null },
        "/workspace/project-nested": { columnWidths: null }
      });
    setActiveTextEditorPath("/workspace/project/src/file.ts");

    await run("git-graph-libre.viewActiveEditorRepo");

    expect(getLastActiveRepo()).toBe("/workspace/project");
    expect(openGraphView).toHaveBeenCalledWith("/workspace/project");
    expect(getSendReposCount()).toBe(1);
  });

  it("discovers and opens the active editor git root when it is not known yet", async () => {
    const repo = makeRepo();
    const fileDir = path.join(repo, "src");
    const filePath = path.join(fileDir, "file.ts");
    fs.mkdirSync(fileDir);
    fs.writeFileSync(filePath, "export const value = 1;\n");
    try {
      const { getLastActiveRepo, getRepos, openGraphView, run, setActiveTextEditorPath } =
        makeHarness();
      setActiveTextEditorPath(filePath);

      await run("git-graph-libre.viewActiveEditorRepo");

      expect(getRepos()[repo]).toEqual({ columnWidths: null });
      expect(getLastActiveRepo()).toBe(repo);
      expect(openGraphView).toHaveBeenCalledWith(repo);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("shows a warning when the active editor is not in a git repository", async () => {
    const dir = fs.mkdtempSync("/tmp/ngg-command-manager-");
    const filePath = path.join(dir, "file.ts");
    fs.writeFileSync(filePath, "export const value = 1;\n");
    try {
      const { openGraphView, run, setActiveTextEditorPath, windowApi } = makeHarness();
      setActiveTextEditorPath(filePath);

      await run("git-graph-libre.viewActiveEditorRepo");

      expect(windowApi.showWarningMessage).toHaveBeenCalled();
      expect(openGraphView).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("shows a warning when no active editor is open", async () => {
    const { openGraphView, run, windowApi } = makeHarness();

    await run("git-graph-libre.viewActiveEditorRepo");

    expect(windowApi.showWarningMessage).toHaveBeenCalledWith(
      "Open a file inside a Git repository first."
    );
    expect(openGraphView).not.toHaveBeenCalled();
  });

  it("adds a selected repository and opens it", async () => {
    const repo = makeRepo();
    try {
      const { getLastActiveRepo, getRepos, openGraphView, run, windowApi } = makeHarness();
      windowApi.showOpenDialog.mockResolvedValue([makeUri(repo)]);

      await run("git-graph-libre.addRepo");

      expect(getRepos()[repo]).toEqual({ columnWidths: null });
      expect(getLastActiveRepo()).toBe(repo);
      expect(openGraphView).toHaveBeenCalledWith(repo);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("rejects a selected folder that is not a git repository", async () => {
    const dir = fs.mkdtempSync("/tmp/ngg-command-manager-");
    try {
      const { getRepos, openGraphView, run, windowApi } = makeHarness();
      windowApi.showOpenDialog.mockResolvedValue([makeUri(dir)]);

      await run("git-graph-libre.addRepo");

      expect(getRepos()).toEqual({});
      expect(windowApi.showErrorMessage).toHaveBeenCalled();
      expect(openGraphView).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("removes a selected repository and advances last active repo", async () => {
    const { getLastActiveRepo, getRepos, getSendReposCount, run, windowApi } = makeHarness(
      {
        "/workspace/a": { columnWidths: null },
        "/workspace/b": { columnWidths: null }
      },
      "/workspace/b"
    );
    windowApi.showQuickPick.mockImplementation(async (items: readonly QuickPickItem[]) =>
      items.find((item) => item.repo === "/workspace/b")
    );

    await run("git-graph-libre.removeRepo");

    expect(getRepos()).toEqual({ "/workspace/a": { columnWidths: null } });
    expect(getLastActiveRepo()).toBe("/workspace/a");
    expect(getSendReposCount()).toBe(1);
  });

  it("shows an information message when there are no repositories to remove", async () => {
    const { getSendReposCount, run, windowApi } = makeHarness();

    await run("git-graph-libre.removeRepo");

    expect(windowApi.showInformationMessage).toHaveBeenCalledWith(
      "There are no Git repositories to remove."
    );
    expect(getSendReposCount()).toBe(0);
  });

  it("keeps the existing avatar cache command registered", async () => {
    const { clearCache, run } = makeHarness();

    await run("git-graph-libre.clearAvatarCache");

    expect(clearCache).toHaveBeenCalled();
  });

  it("disposes all command registrations", () => {
    const { disposables, manager } = makeHarness();

    manager.dispose();

    for (const disposable of disposables) expect(disposable.dispose).toHaveBeenCalled();
  });

  it("writes version diagnostics to the output channel", async () => {
    const { outputChannel, outputLines, run, windowApi } = makeHarness({
      "/workspace/repo": { columnWidths: null }
    });

    await run("git-graph-libre.showDiagnostics");

    expect(outputLines.join("\n")).toContain("extension=0.4.0");
    expect(outputLines.join("\n")).toContain("repos=1");
    expect(outputLines.join("\n")).toContain("repo=/workspace/repo");
    expect(outputChannel.show).toHaveBeenCalledWith(true);
    expect(windowApi.showInformationMessage).toHaveBeenCalled();
  });
});
