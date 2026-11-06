import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: { workspaceFolders: undefined }
}));

import { createRepoManager } from "@/extension/repoManager";
import type { GitRepoSet } from "@/types";

// Release 1.10.0, W34 (Y18 (a)): a linked worktree inherits the main worktree's
// issue-linking and pull-request settings the first time it is added. Every
// fixture is a repository this file builds under its own temporary directory.

const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
const issueLinking = { pattern: "#(\\d+)", urlTemplate: "https://example.test/i/$1" };
const pullRequest = {
  remoteName: "origin",
  baseBranch: "main",
  urlTemplate: "https://example.test/pr/new",
  pushBeforeCreate: true
};

let scratch: string;
const created: string[] = [];
let branchCount = 0;

/** A repository's state as the main worktree holds it, with view options that must not move. */
function mainState(): GitRepoSet[string] {
  return {
    columnWidths: [100, 200],
    issueLinking: { ...issueLinking },
    pullRequest: { ...pullRequest },
    showTags: "enabled",
    showStashes: "disabled"
  };
}

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

/** A linked worktree of `repo`, in a folder whose name has a space and a non-ASCII letter. */
function addLinkedWorktree(repo: string): string {
  const parent = fs.mkdtempSync(path.join(scratch, "wt-"));
  const linked = path.join(parent, "linked wt é");
  branchCount++;
  git(["worktree", "add", "-b", `w34-${branchCount}`, linked], repo);
  return linked;
}

beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-inherit-"));
  created.push(scratch);
  const globalConfig = path.join(scratch, "gitconfig");
  fs.writeFileSync(globalConfig, "");
  process.env.GIT_CONFIG_GLOBAL = globalConfig;
});

afterAll(() => {
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

describe("linked worktree inherits the main worktree's repository settings", () => {
  it("copies issue linking and pull-request settings on first add", () => {
    const main = makeRepo();
    created.push(main);
    const linked = addLinkedWorktree(main);
    const { manager, store } = makeManager({ [main]: mainState() });
    manager.addRepo(linked);
    expect(store.repos[linked]).toEqual({ columnWidths: null, issueLinking, pullRequest });
  });

  it("does not inherit view options", () => {
    const main = makeRepo();
    created.push(main);
    const linked = addLinkedWorktree(main);
    const { manager, store } = makeManager({ [main]: mainState() });
    manager.addRepo(linked);
    expect(Object.keys(store.repos[linked]).sort()).toEqual([
      "columnWidths",
      "issueLinking",
      "pullRequest"
    ]);
  });

  it("copies the values, so the linked state does not share objects with the main one", () => {
    const main = makeRepo();
    created.push(main);
    const linked = addLinkedWorktree(main);
    const { manager, store } = makeManager({ [main]: mainState() });
    manager.addRepo(linked);
    const copy = store.repos[linked].issueLinking;
    expect(copy).toBeTruthy();
    if (copy) copy.pattern = "changed";
    expect(store.repos[main].issueLinking?.pattern).toBe("#(\\d+)");
  });

  it("inherits an explicit null as null", () => {
    const main = makeRepo();
    created.push(main);
    const linked = addLinkedWorktree(main);
    const { manager, store } = makeManager({
      [main]: { columnWidths: null, issueLinking: null, pullRequest: null }
    });
    manager.addRepo(linked);
    expect(store.repos[linked]).toEqual({
      columnWidths: null,
      issueLinking: null,
      pullRequest: null
    });
  });

  it("inherits nothing when the main worktree never set those settings", () => {
    const main = makeRepo();
    created.push(main);
    const linked = addLinkedWorktree(main);
    const { manager, store } = makeManager({ [main]: { columnWidths: null } });
    manager.addRepo(linked);
    expect(store.repos[linked]).toEqual({ columnWidths: null });
  });

  it("inherits nothing when the main worktree is not in the list", () => {
    const main = makeRepo();
    created.push(main);
    const linked = addLinkedWorktree(main);
    const { manager, store } = makeManager({ "/elsewhere": mainState() });
    manager.addRepo(linked);
    expect(store.repos[linked]).toEqual({ columnWidths: null });
  });

  it("gives an unrelated repository no settings", () => {
    const main = makeRepo();
    const other = makeRepo();
    created.push(main, other);
    const { manager, store } = makeManager({ [main]: mainState() });
    manager.addRepo(other);
    expect(store.repos[other]).toEqual({ columnWidths: null });
  });

  it("never overwrites a linked worktree's existing state", () => {
    const main = makeRepo();
    created.push(main);
    const linked = addLinkedWorktree(main);
    const own = { columnWidths: null, issueLinking: null };
    const { manager, store } = makeManager({ [main]: mainState(), [linked]: own });
    manager.addRepo(linked);
    expect(store.repos[linked]).toEqual(own);
  });

  it("does not synchronize later edits of the main worktree", () => {
    const main = makeRepo();
    created.push(main);
    const linked = addLinkedWorktree(main);
    const { manager, store } = makeManager({ [main]: mainState() });
    manager.addRepo(linked);
    manager.setRepoState(main, { columnWidths: null, issueLinking: null });
    expect(store.repos[linked].issueLinking).toEqual(issueLinking);
  });

  it.skipIf(process.platform === "win32")(
    "finds the main worktree when the repository list holds a symlinked spelling",
    () => {
      const main = makeRepo();
      created.push(main);
      const linked = addLinkedWorktree(main);
      const link = path.join(scratch, "main link");
      fs.symlinkSync(main, link, "dir");
      const { manager, store } = makeManager({ [link]: mainState() });
      manager.addRepo(linked);
      expect(store.repos[linked].issueLinking).toEqual(issueLinking);
    }
  );
});
