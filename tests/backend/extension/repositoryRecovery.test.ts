import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeStub = vi.hoisted(() => ({
  update: vi.fn(async () => {}),
  showWarningMessage: vi.fn(),
  executeCommand: vi.fn(async () => {})
}));
const trust = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
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
vi.mock("@/backend/utils/repositoryProbe", () => ({ trustGitRepository: trust.fn }));
vi.mock("@/backend/engine/index", () => ({ closeEngineRepository: engine.close }));
vi.mock("@/extension/componentStatus", () => ({ buildComponentStatus: components.build }));

import { registerRepositoryRecovery } from "@/extension/repositoryRecovery";
import type { RepositoryProbe } from "@/types";

type Handler = (msg: never) => unknown;

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
  const recovery = registerRepositoryRecovery(bridge as never, {
    config: {
      gitPath: () => "git",
      backend: () => "auto",
      maxDepthOfRepoSearch: () => 2
    } as never,
    repoSearch: repoSearch as never,
    visible,
    outputChannel: { appendLine: (line: string) => output.push(line), show: vi.fn() },
    telemetry
  });
  return { recovery, handlers, posted, repoSearch, telemetry, output };
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
  trust.fn.mockClear();
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

    expect(vscodeStub.showWarningMessage).toHaveBeenCalledWith(
      expect.any(String),
      { modal: true },
      expect.any(String)
    );
    expect(trust.fn).toHaveBeenCalledWith("/repo", "git");
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
});
