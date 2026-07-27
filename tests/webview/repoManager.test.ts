import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

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
