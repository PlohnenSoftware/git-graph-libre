import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
      repository: !(state === "notRepository" || state === "gitUnavailable"),
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
    const config = { gitPath: () => "git", worktreesOutsideWorkspace: () => true } as Config;
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
    const config = {
      gitPath: () => "git",
      backend: () => "auto",
      worktreesOutsideWorkspace: () => true
    } as unknown as Config;
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

describe("repository manager worktrees outside the workspace (Y9)", () => {
  const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  const savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
  let root: string;
  let workspace: string;
  let main: string;
  let outsideLinked: string;
  let orphanMain: string;
  let orphanLinked: string;

  const slash = (file: string) => file.replaceAll("\\", "/");

  beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ngg-manager-")));
    const emptyConfig = path.join(root, "empty.gitconfig");
    fs.writeFileSync(emptyConfig, "");
    process.env.GIT_CONFIG_GLOBAL = emptyConfig;
    process.env.GIT_CONFIG_NOSYSTEM = "1";
    workspace = path.join(root, "work space");
    fs.mkdirSync(workspace);
    main = makeRepo();
    fs.renameSync(main, path.join(workspace, "main"));
    main = path.join(workspace, "main");
    outsideLinked = path.join(root, "elsewhere", "linked é");
    fs.mkdirSync(path.dirname(outsideLinked));
    git(["worktree", "add", "-b", "out-b", outsideLinked], main);
    // A second repository whose main worktree is outside the workspace.
    orphanMain = makeRepo();
    orphanLinked = path.join(root, "elsewhere", "orphan wt");
    git(["worktree", "add", "-b", "orphan-b", orphanLinked], orphanMain);
  });

  afterAll(() => {
    if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
    if (savedNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
    else process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem;
    fs.rmSync(orphanMain, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });

  function makeManager(repos: GitRepoSet, outsideSetting: boolean) {
    const extensionState = {
      getRepos: () => repos,
      saveRepos: vi.fn()
    } as unknown as ExtensionState;
    const statusBar = { setNumRepos: vi.fn() } as unknown as StatusBarItem;
    const config = {
      gitPath: () => "git",
      backend: () => "auto",
      worktreesOutsideWorkspace: () => outsideSetting
    } as unknown as Config;
    mutableWorkspace.workspaceFolders = [
      { uri: vscode.Uri.file(workspace), name: "workspace", index: 0 }
    ];
    return createRepoManager(extensionState, statusBar, config);
  }

  const known = (...paths: string[]): GitRepoSet =>
    Object.fromEntries(paths.map((repo) => [slash(repo), { columnWidths: null }]));

  it("keeps an outside linked worktree through activation while its main worktree is known", () => {
    const repos = known(main, outsideLinked);
    makeManager(repos, true).removeReposNotInWorkspace();

    expect(Object.keys(repos).toSorted()).toEqual([slash(main), slash(outsideLinked)].toSorted());
  });

  it("purges outside worktrees as before when the setting is off", () => {
    const repos = known(main, outsideLinked);
    makeManager(repos, false).removeReposNotInWorkspace();

    expect(Object.keys(repos)).toEqual([slash(main)]);
  });

  it("purges an outside linked worktree whose main worktree is not a known repository", () => {
    const repos = known(main, orphanLinked);
    makeManager(repos, true).removeReposNotInWorkspace();

    expect(Object.keys(repos)).toEqual([slash(main)]);
  });

  it("still purges an outside repository that is not a linked worktree", () => {
    const repos = known(main, orphanMain);
    makeManager(repos, true).removeReposNotInWorkspace();

    expect(Object.keys(repos)).toEqual([slash(main)]);
  });

  it("publishes the layout with the repository list, and drops an outside entry once it joins", () => {
    const repos = known(main);
    const manager = makeManager(repos, true);
    const callback = vi.fn();
    manager.registerViewCallback(callback);
    const entry = {
      path: slash(outsideLinked),
      commonDir: "ignored",
      linked: true,
      branch: "out-b",
      detached: false,
      repo: slash(main)
    };
    manager.setWorktreeDetails(new Map([[slash(main), { branch: "main", detached: false }]]), [
      entry
    ]);

    manager.sendRepos();

    const layout = callback.mock.calls[0]?.[2];
    expect(layout.outside).toEqual([entry]);
    expect(layout.worktrees[slash(main)]).toMatchObject({ linked: false, branch: "main" });

    manager.addRepo(slash(outsideLinked));
    const joined = manager.getLayout();
    expect(joined.outside).toEqual([]);
    expect(joined.worktrees[slash(outsideLinked)]).toMatchObject({ linked: true });
    expect(joined.worktrees[slash(outsideLinked)].commonDir).toBe(
      joined.worktrees[slash(main)].commonDir
    );
  });
});
