import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

const probeState = vi.hoisted(() => ({ states: new Map<string, string>() }));
const engine = vi.hoisted(() => ({ close: vi.fn() }));

vi.mock("@/backend/utils/repositoryProbe", () => ({
  inspectRepository: vi.fn(async (directory: string) => {
    const state = probeState.states.get(directory) ?? "ready";
    return {
      path: directory,
      state,
      // gitUnavailable also reports absence through the engine here, so the
      // tests below prove deletion keys on the explicit state alone.
      repository: state === "notRepository" || state === "gitUnavailable" ? false : true,
      detectedBy: "git",
      detail: null
    };
  })
}));
vi.mock("@/backend/engine/index", () => ({ closeEngineRepository: engine.close }));

import type { Config } from "@/config";
import { createRepoManager } from "@/extension/repoManager";
import type { ExtensionState } from "@/extensionState";
import type { StatusBarItem } from "@/statusBarItem";
import type { GitRepoSet } from "@/types";

const mutableWorkspace = vscode.workspace as unknown as {
  workspaceFolders: vscode.WorkspaceFolder[] | undefined;
};

afterEach(() => {
  mutableWorkspace.workspaceFolders = undefined;
});

describe("repository manager", () => {
  it("sorts, matches, and filters repositories against workspace roots", () => {
    const repos: GitRepoSet = {
      "/workspace2/shared-prefix": { columnWidths: null },
      "/workspace/project": { columnWidths: null },
      "/outside/repo": { columnWidths: null },
      "/workspace/nested/repo": { columnWidths: null }
    };
    const extensionState = {
      getRepos: () => repos,
      saveRepos: vi.fn()
    } as unknown as ExtensionState;
    const statusBar = { setNumRepos: vi.fn() } as unknown as StatusBarItem;
    const config = { gitPath: () => "git" } as Config;
    const manager = createRepoManager(extensionState, statusBar, config);

    expect(Object.keys(manager.getRepos())).toEqual([
      "/outside/repo",
      "/workspace/nested/repo",
      "/workspace/project",
      "/workspace2/shared-prefix"
    ]);
    expect(manager.isDirectoryWithinRepos("/workspace/project/src")).toBe(true);
    expect(manager.isDirectoryWithinRepos("/unrelated")).toBe(false);
    expect(manager.removeReposWithinFolder("/workspace/nested")).toBe(true);

    mutableWorkspace.workspaceFolders = [
      { uri: vscode.Uri.file("/workspace"), name: "workspace", index: 0 }
    ];
    manager.removeReposNotInWorkspace();

    expect(Object.keys(repos)).toEqual(["/workspace/project"]);
    expect(extensionState.saveRepos).toHaveBeenCalled();
  });
});

describe("repository manager availability", () => {
  beforeEach(() => {
    probeState.states.clear();
    engine.close.mockClear();
  });

  function makeManager(repos: GitRepoSet) {
    const extensionState = {
      getRepos: () => repos,
      saveRepos: vi.fn()
    } as unknown as ExtensionState;
    const statusBar = { setNumRepos: vi.fn() } as unknown as StatusBarItem;
    const config = { gitPath: () => "git", backend: () => "auto" } as unknown as Config;
    return {
      manager: createRepoManager(extensionState, statusBar, config),
      extensionState,
      statusBar
    };
  }

  it("hides an untrusted repository without deleting it or its settings, then restores it", async () => {
    const settings = { columnWidths: [10, 20] };
    const repos: GitRepoSet = { "/repo": settings as never };
    const { manager, extensionState, statusBar } = makeManager(repos);

    probeState.states.set("/repo", "untrusted");
    await manager.checkReposExist();
    await manager.checkReposExist();

    expect(manager.getRepos()).toEqual({});
    expect(manager.getKnownRepos()).toEqual(repos);
    // The engine may hold files open in a repository the CLI now refuses —
    // closed once on the transition, not on every poll re-check.
    expect(engine.close).toHaveBeenCalledTimes(1);
    expect(engine.close).toHaveBeenCalledWith("/repo");
    expect(statusBar.setNumRepos).toHaveBeenCalledTimes(1);
    expect(extensionState.saveRepos).not.toHaveBeenCalled();

    probeState.states.set("/repo", "ready");
    await manager.checkReposExist();

    expect(manager.getRepos()).toEqual(repos);
    expect(manager.getKnownRepos()["/repo"]).toBe(settings);
    expect(extensionState.saveRepos).not.toHaveBeenCalled();
  });

  it("deletes only on an explicit notRepository, never for gitUnavailable", async () => {
    const repos: GitRepoSet = { "/repo": { columnWidths: null } };
    const { manager, extensionState } = makeManager(repos);

    probeState.states.set("/repo", "gitUnavailable");
    await manager.checkReposExist();
    expect(Object.keys(manager.getKnownRepos())).toEqual(["/repo"]);
    expect(extensionState.saveRepos).not.toHaveBeenCalled();

    probeState.states.set("/repo", "notRepository");
    await manager.checkReposExist();
    expect(manager.getKnownRepos()).toEqual({});
    expect(extensionState.saveRepos).toHaveBeenCalled();
  });

  it("re-adding an unavailable repository unhides it without resetting settings", async () => {
    const settings = { columnWidths: [5] };
    const repos: GitRepoSet = { "/repo": settings as never };
    const { manager } = makeManager(repos);
    probeState.states.set("/repo", "untrusted");
    await manager.checkReposExist();
    expect(manager.getRepos()).toEqual({});

    manager.addRepo("/repo");

    expect(manager.getRepos()).toEqual(repos);
    expect(manager.getKnownRepos()["/repo"]).toBe(settings);
  });

  it("keeps an unavailable in-workspace repository through the workspace filter", async () => {
    const repos: GitRepoSet = {
      "/workspace/blocked": { columnWidths: null },
      "/outside": { columnWidths: null }
    };
    const { manager } = makeManager(repos);
    probeState.states.set("/workspace/blocked", "untrusted");
    await manager.checkReposExist();

    mutableWorkspace.workspaceFolders = [
      { uri: vscode.Uri.file("/workspace"), name: "workspace", index: 0 }
    ];
    manager.removeReposNotInWorkspace();

    expect(Object.keys(manager.getKnownRepos())).toEqual(["/workspace/blocked"]);
    expect(manager.getRepos()).toEqual({});
  });
});
