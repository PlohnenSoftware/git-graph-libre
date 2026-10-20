import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vscodeStub = vi.hoisted(() => ({
  update: vi.fn(async () => {}),
  showWarningMessage: vi.fn(),
  executeCommand: vi.fn(async () => {})
}));
// The entry differs from the requested path on purpose (as through a
// symlink), so every case can tell which of the two was shown and written.
const trust = vi.hoisted(() => ({
  fn: vi.fn(async () => {}),
  entry: vi.fn(async (repo: string) => `/real${repo}`)
}));
const engine = vi.hoisted(() => ({ close: vi.fn() }));
const components = vi.hoisted(() => ({
  build: vi.fn(async () => ({
    git: { state: "ok", path: "git", version: "2.47.0" },
    engine: { state: "off" },
    graphLoad: null
  }))
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({ update: vscodeStub.update })
  },
  window: { showWarningMessage: vscodeStub.showWarningMessage },
  commands: { executeCommand: vscodeStub.executeCommand },
  ConfigurationTarget: { Workspace: 2 }
}));
vi.mock("@/l10n", () => ({
  t: (key: string, ...args: unknown[]) => (args.length > 0 ? `${key}:${args.join(",")}` : key)
}));
vi.mock("@/backend/utils/repositoryProbe", () => ({
  trustGitRepository: trust.fn,
  safeDirectoryEntry: trust.entry
}));
vi.mock("@/backend/engine/index", () => ({ closeEngineRepository: engine.close }));
vi.mock("@/extension/componentStatus", () => ({ buildComponentStatus: components.build }));

import { setOperationLog } from "@/backend/utils/operationLog";
import { createGitTrustCommand, registerRepositoryRecovery } from "@/extension/repositoryRecovery";
import type { RepositoryProbe } from "@/types";

type Handler = (msg: never) => unknown;

const created: { dispose(): void }[] = [];
afterEach(() => {
  for (const recovery of created.splice(0)) recovery.dispose();
  vi.useRealTimers();
});

function makeRecovery(repositories: RepositoryProbe[] = [], visible: () => boolean = () => true) {
  const handlers = new Map<string, Handler>();
  const posted: unknown[] = [];
  const bridge = {
    post: vi.fn((msg: unknown) => posted.push(msg)),
    onMessage: vi.fn((command: string, handler: Handler) => handlers.set(command, handler))
  };
  const repoSearch = {
    searchWorkspaceForRepos: vi.fn(async () => {}),
    getDiagnostics: vi.fn(() => ({ roots: ["/ws"], repositories })),
    maxDepthChanged: vi.fn(),
    searchDirectoryForRepos: vi.fn(async () => false)
  };
  const telemetry = { logFeature: vi.fn() };
  const output: string[] = [];
  const showOutput = vi.fn();
  const recovery = registerRepositoryRecovery(bridge as never, {
    config: {
      gitPath: () => "git",
      backend: () => "auto",
      maxDepthOfRepoSearch: () => 2
    } as never,
    repoSearch: repoSearch as never,
    visible,
    outputChannel: { appendLine: (line: string) => output.push(line), show: showOutput },
    telemetry
  });
  created.push(recovery);
  return { recovery, handlers, posted, repoSearch, telemetry, output, showOutput };
}

const untrustedRepo: RepositoryProbe = {
  path: "/repo",
  state: "untrusted",
  repository: true,
  detectedBy: "git",
  detail: "dubious ownership"
} as RepositoryProbe;

beforeEach(() => {
  vscodeStub.update.mockClear();
  vscodeStub.showWarningMessage.mockReset();
  vscodeStub.executeCommand.mockClear();
  trust.fn.mockReset();
  trust.entry.mockReset();
  trust.entry.mockImplementation(async (repo: string) => `/real${repo}`);
  engine.close.mockClear();
  components.build.mockClear();
});

describe("registerRepositoryRecovery refresh", () => {
  it("posts diagnostics, depth and components after rescanning", async () => {
    const { recovery, posted, repoSearch } = makeRecovery([untrustedRepo]);
    await recovery.refresh();
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenCalledWith(false);
    expect(posted).toEqual([
      {
        command: "repositoryStatus",
        startup: expect.objectContaining({
          roots: ["/ws"],
          repositories: [untrustedRepo],
          searchDepth: 2,
          error: null,
          components: expect.objectContaining({ git: expect.objectContaining({ state: "ok" }) })
        })
      }
    ]);
  });

  it("turns a scan failure into the posted error instead of throwing", async () => {
    const { recovery, posted, repoSearch } = makeRecovery();
    repoSearch.searchWorkspaceForRepos.mockRejectedValueOnce(new Error("scan exploded"));
    await recovery.refresh();
    expect(posted[0]).toMatchObject({ startup: { error: "scan exploded" } });
  });
});

describe("registerRepositoryRecovery trust", () => {
  it("confirms modally, trusts the exact path, closes the engine and rescans", async () => {
    vscodeStub.showWarningMessage.mockImplementation(
      async (_msg: string, _opts: unknown, accept: string) => accept
    );
    const { handlers, repoSearch, output } = makeRecovery([untrustedRepo]);
    await handlers.get("trustRepository")?.({ command: "trustRepository", repo: "/repo" } as never);

    // The dialog names the entry that will be written, not the path asked for.
    expect(vscodeStub.showWarningMessage).toHaveBeenCalledWith(
      "startup.trustConfirm:/real/repo",
      { modal: true },
      "startup.trust"
    );
    expect(trust.fn).toHaveBeenCalledWith("/repo", "git", "/real/repo");
    expect(engine.close).toHaveBeenCalledWith("/repo");
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenCalledWith(true);
    expect(trust.fn.mock.invocationCallOrder[0]).toBeLessThan(
      repoSearch.searchWorkspaceForRepos.mock.invocationCallOrder.at(-1) ?? 0
    );
    expect(output.some((line) => line.includes("trust granted"))).toBe(true);
  });

  it("does nothing when the confirmation is declined", async () => {
    vscodeStub.showWarningMessage.mockResolvedValue(undefined);
    const { handlers } = makeRecovery([untrustedRepo]);
    await handlers.get("trustRepository")?.({ command: "trustRepository", repo: "/repo" } as never);
    expect(trust.fn).not.toHaveBeenCalled();
  });

  it("surfaces trust failures and still rescans so the action can be retried", async () => {
    vscodeStub.showWarningMessage.mockImplementation(async (_msg, _opts, accept) => accept);
    trust.fn.mockRejectedValueOnce(new Error("permission denied"));
    const { handlers, posted, repoSearch } = makeRecovery([untrustedRepo]);
    await handlers.get("trustRepository")?.({ command: "trustRepository", repo: "/repo" } as never);
    expect(posted.at(-1)).toMatchObject({ startup: { error: "permission denied" } });
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenCalledWith(true);
    expect(engine.close).not.toHaveBeenCalled();
  });

  it("never prompts for a path that is not a discovered untrusted repository", async () => {
    const { handlers } = makeRecovery([]);
    await handlers.get("trustRepository")?.({ command: "trustRepository", repo: "/etc" } as never);
    expect(vscodeStub.showWarningMessage).not.toHaveBeenCalled();
    expect(trust.fn).not.toHaveBeenCalled();
  });

  it("asks nothing when the repository no longer needs trust, and says so", async () => {
    trust.entry.mockRejectedValueOnce(new Error("no longer needs Git ownership trust"));
    const { handlers, posted } = makeRecovery([untrustedRepo]);
    await handlers.get("trustRepository")?.({ command: "trustRepository", repo: "/repo" } as never);
    expect(vscodeStub.showWarningMessage).not.toHaveBeenCalled();
    expect(trust.fn).not.toHaveBeenCalled();
    expect(posted.at(-1)).toMatchObject({
      startup: { error: expect.stringContaining("no longer needs") }
    });
  });
});

describe("createGitTrustCommand", () => {
  function makeCommand(repositories: RepositoryProbe[]) {
    const window = {
      showWarningMessage: vi.fn(async (_m: string, _o: unknown, accept: string) => accept),
      showInformationMessage: vi.fn(async () => undefined),
      showErrorMessage: vi.fn(async () => undefined),
      showQuickPick: vi.fn(async (items: readonly string[]) => items[1])
    };
    const repoSearch = {
      getDiagnostics: () => ({ roots: ["/ws"], repositories }),
      searchWorkspaceForRepos: vi.fn(async () => {})
    };
    const run = createGitTrustCommand({
      config: { gitPath: () => "git" },
      repoSearch,
      window: window as never
    });
    return { run, window, repoSearch };
  }
  const second = { ...untrustedRepo, path: "/other" } as RepositoryProbe;

  it("says so when no repository waits for trust", async () => {
    const { run, window } = makeCommand([{ ...untrustedRepo, state: "ready" }]);
    await run();
    expect(window.showInformationMessage).toHaveBeenCalledWith("command.trustRepository.none");
    expect(window.showWarningMessage).not.toHaveBeenCalled();
  });

  it("confirms the only blocked repository directly, then rescans", async () => {
    const { run, window, repoSearch } = makeCommand([untrustedRepo]);
    await run();
    expect(window.showQuickPick).not.toHaveBeenCalled();
    expect(trust.fn).toHaveBeenCalledWith("/repo", "git", "/real/repo");
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenCalledWith(true);
  });

  it("lets the user pick among several, and does nothing when the pick is dismissed", async () => {
    const { run, window } = makeCommand([untrustedRepo, second]);
    await run();
    expect(window.showQuickPick).toHaveBeenCalledWith(["/repo", "/other"], expect.anything());
    expect(trust.fn).toHaveBeenCalledWith("/other", "git", "/real/other");

    trust.fn.mockClear();
    window.showQuickPick.mockResolvedValueOnce(undefined as never);
    await run();
    expect(trust.fn).not.toHaveBeenCalled();
  });

  it("shows a failed trust as an error", async () => {
    trust.fn.mockRejectedValueOnce(new Error("permission denied"));
    const { run, window } = makeCommand([untrustedRepo]);
    await run();
    expect(window.showErrorMessage).toHaveBeenCalledWith("permission denied");
  });
});

describe("registerRepositoryRecovery trust recheck", () => {
  it("rescans a visible tab while a repository waits for trust, and stops when disposed", async () => {
    vi.useFakeTimers();
    let visible = true;
    const { recovery, repoSearch } = makeRecovery([untrustedRepo], () => visible);
    await vi.advanceTimersByTimeAsync(5000);
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenCalledTimes(1);

    visible = false;
    await vi.advanceTimersByTimeAsync(5000);
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenCalledTimes(1);

    visible = true;
    recovery.dispose();
    await vi.advanceTimersByTimeAsync(10000);
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenCalledTimes(1);
  });

  it("costs nothing while no repository waits for trust", async () => {
    vi.useFakeTimers();
    const { repoSearch } = makeRecovery([{ ...untrustedRepo, state: "ready" }]);
    await vi.advanceTimersByTimeAsync(15000);
    expect(repoSearch.searchWorkspaceForRepos).not.toHaveBeenCalled();
  });
});

describe("registerRepositoryRecovery diagnostics", () => {
  // Sent by the startup screen's button and by the graph's Hidden menu alike.
  it("shows the output channel without taking focus from the tab", async () => {
    const { handlers, showOutput } = makeRecovery();
    await handlers.get("showOutput")?.({ command: "showOutput" } as never);
    expect(showOutput).toHaveBeenCalledWith(true);
  });

  it.each([
    ["openLogFile", "git-graph-libre.openLogFile"],
    ["copyRecentLog", "git-graph-libre.copyRecentLog"]
  ])("runs the %s command for the matching message", async (message, commandId) => {
    const { handlers } = makeRecovery();
    await handlers.get(message)?.({ command: message } as never);
    expect(vscodeStub.executeCommand).toHaveBeenCalledWith(commandId);
  });
});

describe("registerRepositoryRecovery depth and telemetry", () => {
  it("ignores hidden appearances but accepts recovery while hidden", async () => {
    let visible = false;
    const { handlers, telemetry } = makeRecovery([], () => visible);
    const shown = handlers.get("failureScreenShown");
    const failure = { command: "failureScreenShown", screen: "graphLoadError" } as never;
    await shown?.(failure);
    expect(telemetry.logFeature).not.toHaveBeenCalled();
    visible = true;
    await shown?.(failure);
    visible = false;
    await shown?.({ command: "failureScreenShown", screen: null } as never);
    visible = true;
    await shown?.(failure);
    expect(telemetry.logFeature.mock.calls).toEqual([
      ["view.failure.graphLoadError", false],
      ["view.failure.graphLoadError", false]
    ]);
  });
  it("persists a valid depth before rescanning, and rejects invalid depths", async () => {
    const { handlers, repoSearch, posted } = makeRecovery();
    const setDepth = handlers.get("setRepoSearchDepth");

    await setDepth?.({ command: "setRepoSearchDepth", depth: 21 } as never);
    await setDepth?.({ command: "setRepoSearchDepth", depth: 1.5 } as never);
    expect(vscodeStub.update).not.toHaveBeenCalled();
    expect(posted.at(-1)).toMatchObject({
      startup: { error: expect.stringContaining("between 0 and 20") }
    });

    await setDepth?.({ command: "setRepoSearchDepth", depth: 3 } as never);
    expect(vscodeStub.update).toHaveBeenCalledWith("maxDepthOfRepoSearch", 3, 2);
    expect(repoSearch.maxDepthChanged).toHaveBeenCalled();
    expect(vscodeStub.update.mock.invocationCallOrder[0]).toBeLessThan(
      repoSearch.maxDepthChanged.mock.invocationCallOrder[0] ?? 0
    );
    // The rescan is forced, so a scan already running at the old depth
    // cannot stand in for one at the new depth.
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenLastCalledWith(true);
  });

  it("posts a failed write, such as having no workspace to save to, and still rescans", async () => {
    vscodeStub.update.mockRejectedValueOnce(new Error("Unable to write to Workspace Settings"));
    const { handlers, repoSearch, posted } = makeRecovery();
    await handlers.get("setRepoSearchDepth")?.({
      command: "setRepoSearchDepth",
      depth: 1
    } as never);
    expect(repoSearch.maxDepthChanged).not.toHaveBeenCalled();
    expect(repoSearch.searchWorkspaceForRepos).toHaveBeenCalledWith(true);
    expect(posted.at(-1)).toMatchObject({
      startup: { error: expect.stringContaining("Workspace Settings") }
    });
  });

  it("records each distinct failure screen once with the fixed category only", async () => {
    const { handlers, telemetry, recovery } = makeRecovery();
    const shown = handlers.get("failureScreenShown");
    await shown?.({ command: "failureScreenShown", screen: "gitUntrusted" } as never);
    await shown?.({ command: "failureScreenShown", screen: "gitUntrusted" } as never);
    await shown?.({ command: "failureScreenShown", screen: "noRepository" } as never);
    await shown?.({ command: "failureScreenShown", screen: "/home/user/secret" } as never);
    await shown?.({ command: "failureScreenShown", screen: null } as never);
    await shown?.({ command: "failureScreenShown", screen: "noRepository" } as never);

    expect(telemetry.logFeature.mock.calls).toEqual([
      ["view.failure.gitUntrusted", false],
      ["view.empty.noRepository", true],
      ["view.empty.noRepository", true]
    ]);
    recovery.clearFailure();
    await shown?.({ command: "failureScreenShown", screen: "noRepository" } as never);
    expect(telemetry.logFeature).toHaveBeenCalledTimes(4);
  });

  it("logs one application line per distinct failure screen, category only", async () => {
    const lines: string[] = [];
    const log = setOperationLog((line) => lines.push(line));
    try {
      const { handlers } = makeRecovery();
      const shown = handlers.get("failureScreenShown");
      await shown?.({ command: "failureScreenShown", screen: "graphLoadError" } as never);
      await shown?.({ command: "failureScreenShown", screen: "graphLoadError" } as never);
      await shown?.({ command: "failureScreenShown", screen: "/home/user/secret" } as never);
      await shown?.({ command: "failureScreenShown", screen: null } as never);
      expect(lines).toEqual([
        "[application] request=background response=failureScreenShown category=graphLoadError"
      ]);
    } finally {
      log.dispose();
    }
  });
});
