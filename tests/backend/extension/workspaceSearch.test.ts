import { beforeEach, describe, expect, it, vi } from "vitest";

const workspaceState = vi.hoisted(() => ({
  folders: undefined as undefined | { uri: { fsPath: string } }[]
}));

const searchUtilMock = vi.hoisted(() => vi.fn());
const probeStates = vi.hoisted(() => new Map<string, string>());
const inspectMock = vi.hoisted(() =>
  vi.fn(async (directory: string) => {
    const state = probeStates.get(directory) ?? "notRepository";
    return {
      path: directory,
      state,
      repository:
        state === "ready" || state === "untrusted"
          ? true
          : state === "notRepository"
            ? false
            : null,
      detectedBy: "git",
      detail: state === "untrusted" ? "dubious ownership" : null
    };
  })
);

vi.mock("vscode", () => ({
  workspace: {
    get workspaceFolders() {
      return workspaceState.folders;
    }
  }
}));

vi.mock("@/backend/utils/repoSearch", () => ({
  searchDirectoryForRepos: searchUtilMock
}));

vi.mock("@/backend/utils/repositoryProbe", () => ({
  inspectRepository: inspectMock
}));

import type { Config } from "@/config";
import { createRepoSearch } from "@/extension/workspaceSearch";

function makeConfig() {
  return {
    maxDepthOfRepoSearch: () => 2,
    gitPath: () => "/usr/bin/git",
    backend: () => "auto"
  } as unknown as Config;
}

function makeRepoManager(repos: Record<string, unknown> = {}) {
  return {
    getRepos: () => repos,
    getKnownRepos: () => repos,
    addRepo: vi.fn((repo: string) => {
      repos[repo] ??= {};
    }),
    removeRepo: vi.fn((repo: string) => {
      delete repos[repo];
    }),
    setRepoUnavailable: vi.fn(),
    sendRepos: vi.fn()
  };
}

function makeLogger() {
  return { log: vi.fn(), warn: vi.fn() };
}

function summaryCalls(logger: ReturnType<typeof makeLogger>) {
  return [...logger.log.mock.calls, ...logger.warn.mock.calls]
    .map((call) => String(call[0]))
    .filter((line) => line.includes("workspace scan complete"));
}

beforeEach(() => {
  workspaceState.folders = undefined;
  probeStates.clear();
  searchUtilMock.mockReset();
  searchUtilMock.mockResolvedValue([]);
  inspectMock.mockClear();
});

describe("scanLogLevel", () => {
  it("warns on an empty scan and logs otherwise", async () => {
    const { scanLogLevel } = await import("@/extension/workspaceSearch");

    expect(scanLogLevel(0)).toBe("warn");
    expect(scanLogLevel(1)).toBe("log");
    expect(scanLogLevel(3)).toBe("log");
  });
});

describe("createRepoSearch workspace scan", () => {
  it("publishes an empty result and warns with the binary and depth when no folders exist", async () => {
    const repoManager = makeRepoManager();
    const logger = makeLogger();
    const search = createRepoSearch(repoManager as never, makeConfig(), logger);

    await search.searchWorkspaceForRepos();

    expect(searchUtilMock).not.toHaveBeenCalled();
    // Completion is always published now: a failure screen needs the fresh
    // evidence exactly when the result is empty.
    expect(repoManager.sendRepos).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[0]).toContain('git: "/usr/bin/git"');
    expect(logger.warn.mock.calls[0]?.[0]).toContain("depth: 2");
    expect(logger.warn.mock.calls[0]?.[0]).toContain('check the "git.path" setting');
    expect(search.getDiagnostics()).toEqual({ roots: [], repositories: [] });
  });

  it("adds a ready repository the scan finds and logs a singular summary", async () => {
    workspaceState.folders = [{ uri: { fsPath: "/workspace" } }];
    probeStates.set("/workspace/repo", "ready");
    searchUtilMock.mockImplementation(
      async (_dir: string, _depth: number, _git: string, _known: string[], probe: never) => {
        await (probe as (d: string) => Promise<boolean>)("/workspace");
        await (probe as (d: string) => Promise<boolean>)("/workspace/repo");
        return ["/workspace/repo"];
      }
    );
    const repoManager = makeRepoManager();
    const logger = makeLogger();
    const search = createRepoSearch(repoManager as never, makeConfig(), logger);

    await search.searchWorkspaceForRepos();

    expect(repoManager.addRepo).toHaveBeenCalledWith("/workspace/repo");
    expect(repoManager.sendRepos).toHaveBeenCalledTimes(1);
    expect(summaryCalls(logger)[0]).toContain("1 repository");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("re-probes known repositories and logs a plural summary", async () => {
    workspaceState.folders = [{ uri: { fsPath: "/workspace" } }];
    probeStates.set("/workspace/a", "ready");
    probeStates.set("/workspace/b", "ready");
    const repoManager = makeRepoManager({ "/workspace/a": {}, "/workspace/b": {} });
    const logger = makeLogger();
    const search = createRepoSearch(repoManager as never, makeConfig(), logger);

    await search.searchWorkspaceForRepos();

    expect(inspectMock).toHaveBeenCalledWith(
      "/workspace/a",
      expect.objectContaining({ useEngine: true })
    );
    expect(repoManager.sendRepos).toHaveBeenCalledTimes(1);
    expect(summaryCalls(logger)[0]).toContain("2 repositories");
  });

  it("hides a known repository that becomes untrusted, then restores it when ready", async () => {
    const repoManager = makeRepoManager({ "/repo": { columnWidths: [10] } });
    const search = createRepoSearch(repoManager as never, makeConfig(), makeLogger());

    probeStates.set("/repo", "untrusted");
    await search.searchWorkspaceForRepos();
    expect(repoManager.setRepoUnavailable).toHaveBeenCalledWith("/repo");
    expect(repoManager.removeRepo).not.toHaveBeenCalled();
    expect(search.getDiagnostics().repositories.map((r) => r.state)).toEqual(["untrusted"]);

    probeStates.set("/repo", "ready");
    await search.searchWorkspaceForRepos();
    expect(repoManager.addRepo).toHaveBeenCalledWith("/repo");
    expect(search.getDiagnostics().repositories.map((r) => r.state)).toEqual(["ready"]);
  });

  it("removes a known repository that is no longer a repository", async () => {
    const repoManager = makeRepoManager({ "/repo": {} });
    const search = createRepoSearch(repoManager as never, makeConfig(), makeLogger());

    probeStates.set("/repo", "ready");
    await search.searchWorkspaceForRepos();
    probeStates.set("/repo", "notRepository");
    await search.searchWorkspaceForRepos();

    expect(repoManager.removeRepo).toHaveBeenCalledWith("/repo");
  });

  it("surfaces blocked roots in diagnostics without adding them or flooding plain folders", async () => {
    workspaceState.folders = [{ uri: { fsPath: "/workspace" } }];
    probeStates.set("/workspace/blocked", "untrusted");
    searchUtilMock.mockImplementation(
      async (_dir: string, _depth: number, _git: string, _known: string[], probe: never) => {
        const run = probe as (d: string) => Promise<boolean>;
        await run("/workspace");
        await run("/workspace/plain-nested");
        await run("/workspace/blocked");
        return ["/workspace/blocked"];
      }
    );
    const repoManager = makeRepoManager();
    const search = createRepoSearch(repoManager as never, makeConfig(), makeLogger());

    await search.searchWorkspaceForRepos();

    expect(repoManager.addRepo).not.toHaveBeenCalled();
    const diagnostics = search.getDiagnostics();
    expect(diagnostics.roots).toEqual(["/workspace"]);
    expect(diagnostics.repositories.map((r) => r.path)).toEqual([
      "/workspace",
      "/workspace/blocked"
    ]);
  });

  it("coalesces concurrent scans and runs one more when forced", async () => {
    workspaceState.folders = [{ uri: { fsPath: "/workspace" } }];
    const gates: (() => void)[] = [];
    let calls = 0;
    searchUtilMock.mockImplementation(async () => {
      calls += 1;
      if (calls <= 2) {
        await new Promise<void>((resolve) => {
          gates.push(resolve);
        });
      }
      return [];
    });
    const repoManager = makeRepoManager();
    const search = createRepoSearch(repoManager as never, makeConfig(), makeLogger());

    // Two unforced calls share the one in-flight scan.
    const first = search.searchWorkspaceForRepos();
    const second = search.searchWorkspaceForRepos();
    expect(second).toBe(first);
    // The walk starts after the remembered repositories are probed, so wait
    // for it rather than assume it began in the same tick.
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    gates[0]();
    await Promise.all([first, second]);
    expect(searchUtilMock).toHaveBeenCalledTimes(1);

    // A forced call during a scan queues exactly one more scan behind it.
    const third = search.searchWorkspaceForRepos();
    const forced = search.searchWorkspaceForRepos(true);
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    gates[1]();
    await Promise.all([third, forced]);
    expect(searchUtilMock).toHaveBeenCalledTimes(3);
  });
});
