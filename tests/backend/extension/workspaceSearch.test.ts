import { describe, expect, it, vi } from "vitest";

const workspaceState = vi.hoisted(() => ({
  folders: undefined as undefined | { uri: { fsPath: string } }[]
}));

const searchUtilMock = vi.hoisted(() => vi.fn());

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

import type { Config } from "@/config";
import { createRepoSearch } from "@/extension/workspaceSearch";

function makeConfig() {
  return {
    maxDepthOfRepoSearch: () => 2,
    gitPath: () => "/usr/bin/git"
  } as unknown as Config;
}

function makeRepoManager(repos: Record<string, unknown> = {}) {
  return {
    getRepos: () => repos,
    addRepo: vi.fn((repo: string) => {
      repos[repo] = {};
    }),
    sendRepos: vi.fn()
  };
}

function makeLogger() {
  return { log: vi.fn(), warn: vi.fn() };
}

describe("scanLogLevel", () => {
  it("warns on an empty scan and logs otherwise", async () => {
    const { scanLogLevel } = await import("@/extension/workspaceSearch");

    expect(scanLogLevel(0)).toBe("warn");
    expect(scanLogLevel(1)).toBe("log");
    expect(scanLogLevel(3)).toBe("log");
  });
});

describe("createRepoSearch workspace scan", () => {
  it("warns with the binary and depth when no workspace folders exist", async () => {
    workspaceState.folders = undefined;
    const repoManager = makeRepoManager();
    const logger = makeLogger();
    const search = createRepoSearch(repoManager as never, makeConfig(), logger);

    await search.searchWorkspaceForRepos();

    expect(searchUtilMock).not.toHaveBeenCalled();
    expect(repoManager.sendRepos).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[0]).toContain('git: "/usr/bin/git"');
    expect(logger.warn.mock.calls[0]?.[0]).toContain("depth: 2");
    expect(logger.warn.mock.calls[0]?.[0]).toContain("git.path");
    expect(logger.log).not.toHaveBeenCalled();
  });

  it("logs a singular summary and pushes repos when the scan finds one", async () => {
    workspaceState.folders = [{ uri: { fsPath: "/workspace" } }];
    searchUtilMock.mockResolvedValue(["/workspace/repo"]);
    const repoManager = makeRepoManager();
    const logger = makeLogger();
    const search = createRepoSearch(repoManager as never, makeConfig(), logger);

    await search.searchWorkspaceForRepos();

    expect(repoManager.addRepo).toHaveBeenCalledWith("/workspace/repo");
    expect(repoManager.sendRepos).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log.mock.calls[0]?.[0]).toContain("1 repository");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs a plural summary without pushing when the scan finds nothing new", async () => {
    workspaceState.folders = [{ uri: { fsPath: "/workspace" } }];
    searchUtilMock.mockResolvedValue([]);
    const repoManager = makeRepoManager({ "/workspace/a": {}, "/workspace/b": {} });
    const logger = makeLogger();
    const search = createRepoSearch(repoManager as never, makeConfig(), logger);

    await search.searchWorkspaceForRepos();

    expect(repoManager.sendRepos).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log.mock.calls[0]?.[0]).toContain("2 repositories");
  });
});
