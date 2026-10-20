import fs from "node:fs";
import path from "node:path";
import { makeRepo } from "@tests/backend/helpers";
import { describe, expect, it, vi } from "vitest";
import type { Config } from "@/config";
import { createCommandManager } from "@/extension/commandManager";
import type { DiagnosticsFacts } from "@/extension/diagnosticsReport";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewPanel } from "@/extension/webviewPanel";
import type { ExtensionState } from "@/extensionState";
import type { GitRepoSet } from "@/types";

type CommandHandler = (...args: unknown[]) => unknown;
type QuickPickItem = {
  label: string;
  description: string;
  repo: string;
};

function makeUri(fsPath: string) {
  return { fsPath };
}

type LogOptions = {
  logPath?: string;
  lines?: string[];
  copyOk?: boolean;
  /** Replaces the fact gathering; omitted, the real gathering runs. */
  facts?: DiagnosticsFacts;
  /** What the quick pick answers; undefined means dismissed. */
  choice?: string;
};

function makeHarness(
  initialRepos: GitRepoSet = {},
  initialLastRepo: string | null = null,
  logOptions: LogOptions = {}
) {
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
    showWarningMessage: vi.fn(async (_message: string) => undefined),
    openFile: vi.fn(async (_filePath: string) => undefined),
    showChoice: vi.fn(
      async (_items: readonly { id: string; label: string }[], _holder: string) => logOptions.choice
    ),
    openUntitledMarkdown: vi.fn(async (_content: string) => undefined)
  };
  const openExternal = vi.fn(async (_url: string) => true);
  const logLines = logOptions.lines ?? [];
  const logAccess = {
    flush: vi.fn(async () => {}),
    logFilePath: () => logOptions.logPath,
    recentLines: vi.fn((count: number) => logLines.slice(-count))
  };
  const copyText = vi.fn(async (_text: string) => logOptions.copyOk ?? true);

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
  const openScmDiffTab = vi.fn();
  const currentPanel = {
    startHistorySearch: vi.fn()
  };
  const clearCache = vi.fn();
  const telemetryEvents: Array<{ feature: string; ok: boolean }> = [];
  const manager = createCommandManager({
    commandApi,
    windowApi,
    extensionVersion: "0.4.0",
    outputChannel,
    logAccess,
    copyText,
    openExternal,
    changedSettings: () => ["git-graph-libre.backend"],
    ...(logOptions.facts === undefined
      ? {}
      : { collectDiagnosticsFacts: async () => logOptions.facts as DiagnosticsFacts }),
    config: { gitPath: () => "git", backend: () => "git-cli" } as unknown as Config,
    extensionState,
    repoManager,
    avatarManager: { clearCache },
    openGraphView,
    openScmDiffTab,
    getCurrentPanel: () => currentPanel as unknown as WebviewPanel,
    telemetry: {
      logFeature: (feature: string, ok: boolean) => {
        telemetryEvents.push({ feature, ok });
      }
    }
  });
  manager.registerAll();

  async function run(command: string, ...args: unknown[]) {
    const handler = handlers.get(command);
    if (!handler) throw new Error(`Missing command: ${command}`);
    await handler(...args);
  }

  return {
    clearCache,
    copyText,
    logAccess,
    currentPanel,
    disposables,
    getLastActiveRepo: () => lastActiveRepo,
    getRepos: () => ({ ...repos }),
    getSendReposCount: () => sendReposCount,
    handlers,
    manager,
    openExternal,
    openGraphView,
    openScmDiffTab,
    outputChannel,
    outputLines,
    run,
    telemetryEvents,
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
      "git-graph-libre.copyDiagnostics",
      "git-graph-libre.copyRecentLog",
      "git-graph-libre.openDiffTab.index",
      "git-graph-libre.openDiffTab.untracked",
      "git-graph-libre.openDiffTab.workingTree",
      "git-graph-libre.openLogFile",
      "git-graph-libre.removeRepo",
      "git-graph-libre.searchCommits",
      "git-graph-libre.showDiagnostics",
      "git-graph-libre.trustRepository",
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
      "git-graph-libre.copyDiagnostics",
      "git-graph-libre.copyRecentLog",
      "git-graph-libre.openDiffTab.index",
      "git-graph-libre.openDiffTab.untracked",
      "git-graph-libre.openDiffTab.workingTree",
      "git-graph-libre.openLogFile",
      "git-graph-libre.removeRepo",
      "git-graph-libre.searchCommits",
      "git-graph-libre.showDiagnostics",
      "git-graph-libre.trustRepository",
      "git-graph-libre.view",
      "git-graph-libre.viewActiveEditorRepo"
    ]);
  });

  it("opens the GGL Diff tab for a Source Control resource, through register", async () => {
    const { openScmDiffTab, run, telemetryEvents } = makeHarness({
      "/workspace/project": { columnWidths: null }
    });

    await run("git-graph-libre.openDiffTab.workingTree", {
      resourceUri: { fsPath: "/workspace/project/src/file.ts" }
    });

    expect(openScmDiffTab).toHaveBeenCalledWith({
      repo: "/workspace/project",
      left: { kind: "index", path: "src/file.ts" },
      right: { kind: "workingTree", path: "src/file.ts" },
      title: "file.ts (Index ↔ Working Tree)"
    });
    // Through `register`, so the telemetry wrapper reports the outcome.
    expect(telemetryEvents).toContainEqual({
      feature: "git-graph-libre.openDiffTab.workingTree",
      ok: true
    });
  });

  it.each([
    ["/workspace/b", "/workspace/b"],
    ["/workspace/a/nested", "/workspace/a/nested"],
    ["C:/workspace/b", "C:\\workspace\\b"]
  ])("opens the clicked Source Control repository %s", async (repo, fsPath) => {
    const repos = {
      "/workspace/a": { columnWidths: null },
      [repo]: { columnWidths: null }
    };
    const harness = makeHarness(repos, "/workspace/a");
    harness.setActiveTextEditorPath("/workspace/a/file.ts");

    await harness.run("git-graph-libre.view", { rootUri: makeUri("/workspace/a") });
    await harness.run("git-graph-libre.view", { rootUri: makeUri(fsPath) });

    expect(harness.openGraphView.mock.calls).toEqual([["/workspace/a"], [repo]]);
    expect(harness.getLastActiveRepo()).toBe(repo);
    expect(harness.getSendReposCount()).toBe(2);
    expect(harness.getRepos()).toEqual(repos);
    expect(harness.outputLines).toEqual([]);
    expect(harness.telemetryEvents).toEqual([
      { feature: "git-graph-libre.view", ok: true },
      { feature: "git-graph-libre.view", ok: true }
    ]);
  });

  it.each([false, true])(
    "discovers the clicked Source Control repository (known parent: %s)",
    async (knownParent) => {
      const repo = makeRepo();
      const initialRepos = knownParent ? { [path.dirname(repo)]: { columnWidths: null } } : {};
      const harness = makeHarness(initialRepos);
      try {
        await harness.run("git-graph-libre.view", { rootUri: makeUri(repo) });

        expect(harness.getRepos()[repo]).toEqual({ columnWidths: null });
        expect(harness.getLastActiveRepo()).toBe(repo);
        expect(harness.openGraphView).toHaveBeenCalledExactlyOnceWith(repo);
        expect(harness.getSendReposCount()).toBe(1);
        expect(harness.outputLines.join("\n")).toContain('args=["rev-parse" "--show-toplevel"]');
      } finally {
        fs.rmSync(repo, { recursive: true, force: true });
      }
    }
  );

  it("keeps the last repository when opened without a Source Control context", async () => {
    const harness = makeHarness({ "/workspace/a": { columnWidths: null } }, "/workspace/a");

    await harness.run("git-graph-libre.view");

    expect(harness.openGraphView).toHaveBeenCalledExactlyOnceWith();
    expect(harness.getLastActiveRepo()).toBe("/workspace/a");
    expect(harness.getSendReposCount()).toBe(0);
  });

  it.each([
    null,
    "invalid",
    {},
    { rootUri: null },
    { rootUri: {} },
    { rootUri: { fsPath: 42 } },
    { rootUri: { fsPath: "" } }
  ])("ignores a malformed Source Control context: %j", async (context) => {
    const harness = makeHarness({ "/workspace/a": { columnWidths: null } }, "/workspace/a");

    await harness.run("git-graph-libre.view", context);

    expect(harness.openGraphView).toHaveBeenCalledExactlyOnceWith();
    expect(harness.getLastActiveRepo()).toBe("/workspace/a");
    expect(harness.getSendReposCount()).toBe(0);
    expect(harness.outputLines).toEqual([]);
  });

  it("keeps the last repository if the Source Control root cannot be resolved", async () => {
    const dir = fs.mkdtempSync("/tmp/ngg-command-manager-");
    const repos = { "/workspace/a": { columnWidths: null } };
    const harness = makeHarness(repos, "/workspace/a");
    try {
      await harness.run("git-graph-libre.view", { rootUri: makeUri(dir) });

      expect(harness.openGraphView).toHaveBeenCalledExactlyOnceWith();
      expect(harness.getLastActiveRepo()).toBe("/workspace/a");
      expect(harness.getRepos()).toEqual(repos);
      expect(harness.getSendReposCount()).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
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

  it("opens the graph and starts the full-history search UI", async () => {
    const { currentPanel, openGraphView, run } = makeHarness();

    await run("git-graph-libre.searchCommits");

    expect(openGraphView).toHaveBeenCalledTimes(1);
    expect(openGraphView.mock.calls[0]).toEqual([]);
    expect(currentPanel.startHistorySearch).toHaveBeenCalled();
  });

  // register() is the palette-side chokepoint, mirroring registerAction for
  // webview actions.
  it("records a feature event for a command that succeeds", async () => {
    const harness = makeHarness();

    await harness.run("git-graph-libre.view");

    expect(harness.telemetryEvents).toContainEqual({
      feature: "git-graph-libre.view",
      ok: true
    });
  });

  // Telemetry observes the outcome; it must not swallow it.
  it("records ok:false and rethrows when a command throws", async () => {
    const harness = makeHarness();
    harness.openGraphView.mockImplementationOnce(() => {
      throw new Error("panel unavailable");
    });

    await expect(harness.run("git-graph-libre.view")).rejects.toThrow("panel unavailable");

    expect(harness.telemetryEvents).toContainEqual({
      feature: "git-graph-libre.view",
      ok: false
    });
  });

  it("disposes all command registrations", () => {
    const { disposables, manager } = makeHarness();

    manager.dispose();

    for (const disposable of disposables) expect(disposable.dispose).toHaveBeenCalled();
  });

  it("opens the log mirror file after flushing it, through register", async () => {
    const { logAccess, run, telemetryEvents, windowApi } = makeHarness({}, null, {
      logPath: "/logs/git-graph-libre.log"
    });

    await run("git-graph-libre.openLogFile");

    expect(logAccess.flush).toHaveBeenCalled();
    expect(windowApi.openFile).toHaveBeenCalledWith("/logs/git-graph-libre.log");
    expect(telemetryEvents).toEqual([{ feature: "git-graph-libre.openLogFile", ok: true }]);
  });

  it("says so and shows the channel when the log mirror is disabled", async () => {
    const { outputChannel, run, windowApi } = makeHarness();

    await run("git-graph-libre.openLogFile");

    expect(windowApi.openFile).not.toHaveBeenCalled();
    expect(outputChannel.show).toHaveBeenCalledWith(true);
    expect(windowApi.showWarningMessage).toHaveBeenCalled();
  });

  it("copies at most the last 200 log lines and confirms the count", async () => {
    const lines = Array.from({ length: 250 }, (_, index) => `line ${index}`);
    const { copyText, run, windowApi } = makeHarness({}, null, { lines });

    await run("git-graph-libre.copyRecentLog");

    const copied = String(copyText.mock.calls[0]?.[0]).split("\n");
    expect(copied).toHaveLength(200);
    expect(copied[0]).toBe("line 50");
    expect(copied.at(-1)).toBe("line 249");
    expect(windowApi.showInformationMessage).toHaveBeenCalled();
  });

  it("warns instead of copying an empty log, and reports a clipboard failure", async () => {
    const empty = makeHarness();
    await empty.run("git-graph-libre.copyRecentLog");
    expect(empty.copyText).not.toHaveBeenCalled();
    expect(empty.windowApi.showWarningMessage).toHaveBeenCalled();

    const failing = makeHarness({}, null, { lines: ["a"], copyOk: false });
    await failing.run("git-graph-libre.copyRecentLog");
    expect(failing.windowApi.showErrorMessage).toHaveBeenCalled();
  });

  it("writes version diagnostics to the output channel", async () => {
    const { outputChannel, outputLines, run, windowApi } = makeHarness({
      "/workspace/repo": { columnWidths: null }
    });

    await run("git-graph-libre.showDiagnostics");

    const written = outputLines.join("\n");
    expect(written).toContain("- Extension version: 0.4.0");
    expect(written).toContain("- Backend setting: git-cli");
    expect(written).toContain("Count: 1");
    expect(written).toContain("- /workspace/repo");
    expect(written).toContain("- git-graph-libre.backend");
    expect(written).toContain("- Path: git");
    expect(outputChannel.show).toHaveBeenCalledWith(true);
    expect(windowApi.showInformationMessage).toHaveBeenCalled();
  });

  describe("Copy Diagnostics Report", () => {
    const FACTS: DiagnosticsFacts = {
      extensionVersion: "1.9.0",
      repos: [
        {
          path: "/home/u/secret/repo",
          remotes: [{ name: "origin", url: "https://user:ghp_TOKEN@host/o/r.git" }]
        }
      ],
      logLines: ["[t] [git:query] cwd=/home/u/secret/repo"]
    };

    it("does nothing when the quick pick is dismissed", async () => {
      const harness = makeHarness({}, null, { facts: FACTS });

      await harness.run("git-graph-libre.copyDiagnostics");

      expect(harness.copyText).not.toHaveBeenCalled();
      expect(harness.windowApi.openUntitledMarkdown).not.toHaveBeenCalled();
      expect(harness.openExternal).not.toHaveBeenCalled();
      expect(harness.windowApi.showChoice.mock.calls[0]?.[0].map((item) => item.id)).toEqual([
        "clipboard",
        "documentFull",
        "documentFolders",
        "issue"
      ]);
    });

    it("copies the full report to the clipboard, redacted, and says paths are included", async () => {
      const harness = makeHarness({}, null, { facts: FACTS, choice: "clipboard" });

      await harness.run("git-graph-libre.copyDiagnostics");

      const copied = String(harness.copyText.mock.calls[0]?.[0]);
      expect(copied).toContain("/home/u/secret/repo");
      expect(copied).toContain("Repository paths are included.");
      expect(copied).not.toContain("ghp_TOKEN");
      expect(harness.windowApi.showInformationMessage).toHaveBeenCalled();
    });

    it("reports a clipboard failure", async () => {
      const harness = makeHarness({}, null, { facts: FACTS, choice: "clipboard", copyOk: false });

      await harness.run("git-graph-libre.copyDiagnostics");

      expect(harness.windowApi.showErrorMessage).toHaveBeenCalled();
    });

    it("opens an untitled document with full paths", async () => {
      const harness = makeHarness({}, null, { facts: FACTS, choice: "documentFull" });

      await harness.run("git-graph-libre.copyDiagnostics");

      const content = String(harness.windowApi.openUntitledMarkdown.mock.calls[0]?.[0]);
      expect(content).toContain("- /home/u/secret/repo");
      expect(harness.copyText).not.toHaveBeenCalled();
    });

    it("opens an untitled document with folder names only", async () => {
      const harness = makeHarness({}, null, { facts: FACTS, choice: "documentFolders" });

      await harness.run("git-graph-libre.copyDiagnostics");

      const content = String(harness.windowApi.openUntitledMarkdown.mock.calls[0]?.[0]);
      expect(content).not.toContain("/home/u");
      expect(content).toContain("- repo");
    });

    it("opens a prefilled GitHub issue with the report as its body", async () => {
      const harness = makeHarness({}, null, {
        facts: { extensionVersion: "1.9.0" },
        choice: "issue"
      });

      await harness.run("git-graph-libre.copyDiagnostics");

      const url = String(harness.openExternal.mock.calls[0]?.[0]);
      expect(url.startsWith("https://github.com/PlohnenSoftware/git-graph-libre/issues/new?")).toBe(
        true
      );
      expect(decodeURIComponent(url)).toContain("- Extension version: 1.9.0");
      expect(decodeURIComponent(url)).toContain("Recent log (last 200 lines)");
      expect(harness.copyText).not.toHaveBeenCalled();
    });

    it("drops the log tail first when only that makes the issue link fit", async () => {
      const lines = Array.from(
        { length: 200 },
        (_, index) => `[t] line ${index} ${"x".repeat(40)}`
      );
      const harness = makeHarness({}, null, {
        facts: { extensionVersion: "1.9.0", logLines: lines },
        choice: "issue"
      });

      await harness.run("git-graph-libre.copyDiagnostics");

      const url = decodeURIComponent(String(harness.openExternal.mock.calls[0]?.[0]));
      expect(url).not.toContain("line 199");
      expect(url).toContain("The recent log was left out to fit the link");
      expect(url).toContain("Copy Recent Log");
      expect(url).toContain("- Extension version: 1.9.0");
      expect(harness.copyText).not.toHaveBeenCalled();
    });

    it("copies to the clipboard when even the report without the tail is too long", async () => {
      const harness = makeHarness({}, null, {
        facts: {
          extensionVersion: "1.9.0",
          logLines: ["[t] line 7"],
          changedSettings: Array.from({ length: 400 }, (_, index) => `git-graph-libre.s${index}`)
        },
        choice: "issue"
      });

      await harness.run("git-graph-libre.copyDiagnostics");

      expect(harness.openExternal).not.toHaveBeenCalled();
      expect(String(harness.copyText.mock.calls[0]?.[0])).toContain("line 7");
      expect(harness.windowApi.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("too long")
      );
    });

    it("counts only through register, with no payload beyond the command id", async () => {
      const harness = makeHarness({}, null, { facts: FACTS, choice: "clipboard" });

      await harness.run("git-graph-libre.copyDiagnostics");

      expect(harness.telemetryEvents).toEqual([
        { feature: "git-graph-libre.copyDiagnostics", ok: true }
      ]);
    });
  });
});
