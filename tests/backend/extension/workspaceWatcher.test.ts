import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

// The watcher and search run for real against real repositories; only the
// VS Code workspace surface (folders + watcher registration) is stubbed, so
// these tests pin the whole watcher → discovery → manager chain, including
// repositories whose .git is a FILE (linked worktrees, submodules), which
// watcher backends may deliver on the change channel instead of create.

const ws = vi.hoisted(() => ({ folders: [] as { uri: { fsPath: string } }[] }));

vi.mock("vscode", () => ({
  workspace: {
    get workspaceFolders() {
      return ws.folders.length > 0 ? ws.folders : undefined;
    }
  },
  Uri: { file: (p: string) => ({ fsPath: p }) }
}));

import { git } from "@tests/backend/helpers";
import type { Config } from "@/config";
import { createRepoManager } from "@/extension/repoManager";
import { createRepoSearch } from "@/extension/workspaceSearch";
import { createRepoWatcher } from "@/extension/workspaceWatcher";
import type { ExtensionState } from "@/extensionState";
import type { GitRepoSet } from "@/types";

type Fire = (u: { fsPath: string }) => void;

const waitFor = async (cond: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
  expect(cond()).toBe(true);
};

function initRepo(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  git(["init", "-b", "main"], dir);
  git(["config", "user.email", "t@t.com"], dir);
  git(["config", "user.name", "T"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  fs.writeFileSync(path.join(dir, "f"), "x");
  git(["add", "."], dir);
  git(["commit", "-m", "init"], dir);
}

function setupWatch(root: string) {
  ws.folders = [{ uri: { fsPath: root } }];
  let stored: GitRepoSet = {};
  const extensionState = {
    getRepos: () => stored,
    saveRepos: (r: GitRepoSet) => {
      stored = r;
    }
  } as unknown as ExtensionState;
  const config = {
    gitPath: () => "git",
    backend: () => "git-cli",
    maxDepthOfRepoSearch: () => 2
  } as unknown as Config;
  const manager = createRepoManager(extensionState, { setNumRepos: () => {} } as never, config);
  const search = createRepoSearch(manager, config, { log: () => {}, warn: () => {} });

  const handles: { fireCreate: Fire; fireChange: Fire; fireDelete: Fire }[] = [];
  const workspace = {
    workspaceFolders: ws.folders,
    createFileSystemWatcher: () => {
      const h = {
        fireCreate: (() => {}) as Fire,
        fireChange: (() => {}) as Fire,
        fireDelete: (() => {}) as Fire
      };
      handles.push(h);
      return {
        onDidCreate: (fn: Fire) => {
          h.fireCreate = fn;
        },
        onDidChange: (fn: Fire) => {
          h.fireChange = fn;
        },
        onDidDelete: (fn: Fire) => {
          h.fireDelete = fn;
        },
        dispose: () => {}
      };
    },
    onDidChangeWorkspaceFolders: () => ({ dispose: () => {} })
  };
  const watcher = createRepoWatcher(manager, config, search, workspace as never, 0);
  watcher.startWatching();
  return {
    manager,
    watcher,
    known: () => Object.keys(manager.getRepos()),
    fireCreate: (p: string) => handles[0].fireCreate({ fsPath: p }),
    fireChange: (p: string) => handles[0].fireChange({ fsPath: p }),
    fireDelete: (p: string) => handles[0].fireDelete({ fsPath: p })
  };
}

describe("createRepoWatcher discovery (real Git)", () => {
  it("discovers a repository created with git init (.git directory)", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-watch-"));
    try {
      const { watcher, fireCreate, known } = setupWatch(root);
      const repo = path.join(root, "a");
      initRepo(repo);
      fireCreate(repo);
      fireCreate(path.join(repo, ".git"));
      await waitFor(() => known().includes(repo));
      watcher.dispose();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers a linked worktree from its .git file create event", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-watch-"));
    try {
      const main = path.join(root, "main");
      initRepo(main);
      const { watcher, fireCreate, known } = setupWatch(root);
      const wt = path.join(root, "wt");
      git(["worktree", "add", wt, "-b", "wt1"], main);
      expect(fs.statSync(path.join(wt, ".git")).isFile()).toBe(true);
      fireCreate(wt);
      fireCreate(path.join(wt, ".git"));
      await waitFor(() => known().includes(wt));
      watcher.dispose();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers a linked worktree when the .git file arrives as a change event only", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-watch-"));
    try {
      const main = path.join(root, "main");
      initRepo(main);
      const { watcher, fireChange, known } = setupWatch(root);
      const wt = path.join(root, "wt");
      git(["worktree", "add", wt, "-b", "wt1"], main);
      // Some watcher backends deliver a brand-new file as a change; the
      // discovery outcome must not depend on the channel.
      fireChange(path.join(wt, ".git"));
      await waitFor(() => known().includes(wt));
      watcher.dispose();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers a submodule and removes a deleted repository", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-watch-"));
    try {
      const parent = path.join(root, "parent");
      const childSrc = path.join(root, "child-src");
      initRepo(parent);
      initRepo(childSrc);
      const { watcher, fireCreate, fireDelete, known } = setupWatch(root);
      git(
        ["-c", "protocol.file.allow=always", "submodule", "add", childSrc, "modules/child"],
        parent
      );
      const sub = path.join(parent, "modules", "child");
      expect(fs.statSync(path.join(sub, ".git")).isFile()).toBe(true);
      fireCreate(sub);
      fireCreate(path.join(sub, ".git"));
      fireCreate(parent);
      await waitFor(() => known().includes(sub));

      fs.rmSync(sub, { recursive: true, force: true });
      fireDelete(sub);
      await waitFor(() => !known().includes(sub));
      watcher.dispose();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
