import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: { workspaceFolders: undefined }
}));

import { createRepoManager } from "@/extension/repoManager";
import type { GitRepoSet } from "@/types";

// Slice F1-08: the Reflog tab closes when its repository leaves the list,
// through the removal hook every removal path funnels into.

function makeManager(initialRepos: GitRepoSet = {}) {
  const store = { repos: { ...initialRepos } as GitRepoSet };
  const extensionState = {
    getRepos: () => store.repos,
    saveRepos: (repos: GitRepoSet) => {
      store.repos = repos;
    }
  };
  const statusBar = { setNumRepos: () => {} };
  const config = { gitPath: () => "git", backend: () => "cli" };
  const manager = createRepoManager(extensionState as never, statusBar as never, config as never);
  return { manager, store };
}

describe("repoManager removal hook (F1-08)", () => {
  it("names the removed repository, and nothing else triggers it", () => {
    const { manager } = makeManager({
      "/ws/a": { columnWidths: null },
      "/ws/b": { columnWidths: null }
    });
    const removed: string[] = [];
    manager.registerRepoRemovedCallback((repo) => removed.push(repo));
    manager.addRepo("/ws/c");
    manager.sendRepos();
    expect(removed).toEqual([]);
    manager.removeRepo("/ws/a");
    expect(removed).toEqual(["/ws/a"]);
    manager.removeRepo("/ws/b");
    expect(removed).toEqual(["/ws/a", "/ws/b"]);
  });

  it("fires for every repository a folder removal drops", () => {
    const { manager } = makeManager({
      "/ws/a": { columnWidths: null },
      "/ws/a/nested": { columnWidths: null },
      "/ws/b": { columnWidths: null }
    });
    const removed: string[] = [];
    manager.registerRepoRemovedCallback((repo) => removed.push(repo));
    manager.removeReposWithinFolder("/ws/a");
    expect(removed.toSorted()).toEqual(["/ws/a", "/ws/a/nested"]);
  });

  it("stays silent after deregistering, and a new registration replaces the old", () => {
    const { manager } = makeManager({
      "/ws/a": { columnWidths: null },
      "/ws/b": { columnWidths: null },
      "/ws/c": { columnWidths: null }
    });
    const first: string[] = [];
    const second: string[] = [];
    manager.registerRepoRemovedCallback((repo) => first.push(repo));
    manager.registerRepoRemovedCallback((repo) => second.push(repo));
    manager.removeRepo("/ws/a");
    expect(first).toEqual([]);
    expect(second).toEqual(["/ws/a"]);
    manager.deregisterRepoRemovedCallback();
    manager.removeRepo("/ws/b");
    expect(second).toEqual(["/ws/a"]);
  });
});
