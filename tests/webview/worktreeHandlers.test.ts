import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import {
  executedCommands,
  openDialogResults,
  resetVscodeMock
} from "@tests/webview/__mocks__/vscode";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvatarManager } from "@/avatarManager";
import type { GitClient } from "@/backend/gitClient";
import type { Config } from "@/config";
import { registerMessageHandlers } from "@/extension/messageHandler";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewBridge } from "@/extension/webviewBridge";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { RequestMessage, ResponseMessage } from "@/types";

const closeEngineRepository = vi.hoisted(() => vi.fn());
vi.mock("@/backend/engine/index", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/backend/engine/index")>()),
  closeEngineRepository
}));

const temporaryDirs: string[] = [];

beforeEach(() => {
  resetVscodeMock();
  closeEngineRepository.mockClear();
});

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A repository whose worktree `feat` (a path with a space and an accent) is a known repository. */
function setup() {
  const repo = makeRepo();
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-wt-"));
  temporaryDirs.push(repo, parent);
  git(["branch", "feat"], repo);
  const featPath = path.join(parent, "wt feat é");
  git(["worktree", "add", featPath, "feat"], repo);

  const known = new Set([repo, featPath]);
  const removeRepo = vi.fn((repoPath: string) => known.delete(repoPath));
  const sendRepos = vi.fn();
  const handlers = new Map<string, (msg: RequestMessage) => void | Promise<void>>();
  const posts: ResponseMessage[] = [];
  const bridge = {
    post: (msg: ResponseMessage) => posts.push(msg),
    onMessage: (command: string, handler: (msg: RequestMessage) => void | Promise<void>) => {
      handlers.set(command, handler);
    }
  } as unknown as WebviewBridge;
  registerMessageHandlers(bridge, {
    config: { gitPath: () => "git", backend: () => "git-cli" } as unknown as Config,
    gitClient: { getInstance: () => simpleGit(repo) } as unknown as GitClient,
    repoManager: {
      getRepos: () => Object.fromEntries([...known].map((repoPath) => [repoPath, {}])),
      removeRepo,
      sendRepos
    } as unknown as RepoManager,
    extensionState: {} as ExtensionState,
    avatarManager: { fetchAvatarImage: vi.fn() } as unknown as AvatarManager,
    repoFileWatcher: {
      mute: vi.fn(),
      unmute: vi.fn(),
      start: vi.fn()
    } as unknown as RepoFileWatcher
  });
  return { repo, parent, featPath, handlers, posts, removeRepo, sendRepos };
}

describe("worktree handlers", () => {
  it("creating a worktree runs it in the fixture and answers with a clean status", async () => {
    const { repo, parent, handlers, posts } = setup();
    const target = path.join(parent, "wt created é");

    await handlers.get("addWorktree")?.({
      command: "addWorktree",
      repo,
      path: target,
      branch: null,
      newBranch: "created",
      startPoint: "main",
      detach: false,
      lockReason: null
    });

    expect(posts).toEqual([{ command: "addWorktree", status: null }]);
    expect(fs.existsSync(path.join(target, "f"))).toBe(true);
    const listed = cp.execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: repo,
      encoding: "utf8"
    });
    expect(listed).toContain("branch refs/heads/created");
  });

  it("a refused creation reports where the branch is checked out, and creates nothing", async () => {
    const { repo, parent, featPath, handlers, posts } = setup();
    const target = path.join(parent, "wt refused");

    await handlers.get("addWorktree")?.({
      command: "addWorktree",
      repo,
      path: target,
      branch: "feat",
      newBranch: null,
      startPoint: null,
      detach: false,
      lockReason: null
    });

    expect(posts[0]).toMatchObject({ command: "addWorktree" });
    expect((posts[0] as { status: string | null }).status).toContain(featPath);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("removing a worktree closes its engine handle and drops a known repository", async () => {
    const { repo, featPath, handlers, posts, removeRepo, sendRepos } = setup();

    await handlers.get("removeWorktree")?.({
      command: "removeWorktree",
      repo,
      path: featPath,
      force: false,
      unlock: false
    });

    expect(posts).toEqual([{ command: "removeWorktree", status: null }]);
    expect(fs.existsSync(featPath)).toBe(false);
    expect(removeRepo).toHaveBeenCalledWith(featPath);
    expect(removeRepo).not.toHaveBeenCalledWith(repo);
    expect(closeEngineRepository).toHaveBeenCalledWith(featPath);
    expect(sendRepos).toHaveBeenCalled();
  });

  it("a refused removal reports the error and keeps the handle open", async () => {
    const { repo, featPath, handlers, posts, removeRepo } = setup();
    fs.writeFileSync(path.join(featPath, "unsaved.txt"), "work");

    await handlers.get("removeWorktree")?.({
      command: "removeWorktree",
      repo,
      path: featPath,
      force: false,
      unlock: false
    });

    expect(posts[0]).toMatchObject({ command: "removeWorktree" });
    expect((posts[0] as { status: string | null }).status).not.toBeNull();
    expect(fs.existsSync(path.join(featPath, "unsaved.txt"))).toBe(true);
    expect(removeRepo).not.toHaveBeenCalled();
    expect(closeEngineRepository).not.toHaveBeenCalled();
  });

  it("pruning closes the handles of the entries it removed", async () => {
    const { repo, featPath, handlers, posts, removeRepo } = setup();
    fs.rmSync(featPath, { recursive: true });

    await handlers.get("pruneWorktrees")?.({ command: "pruneWorktrees", repo });

    expect(posts).toEqual([{ command: "pruneWorktrees", status: null }]);
    expect(removeRepo).toHaveBeenCalledWith(featPath);
    expect(closeEngineRepository).toHaveBeenCalledWith(featPath);
  });

  it("repair asks for the new folder, and a cancelled picker changes nothing", async () => {
    const { repo, parent, featPath, handlers, posts } = setup();
    const moved = path.join(parent, "moved é");
    fs.renameSync(featPath, moved);

    openDialogResults.push(undefined);
    await handlers.get("repairWorktree")?.({
      command: "repairWorktree",
      repo,
      path: featPath,
      newPath: null
    });
    expect(posts.at(-1)).toEqual({ command: "repairWorktree", status: null });
    expect(simpleGitList(repo)).toContain("prunable");

    openDialogResults.push([{ fsPath: moved } as never]);
    await handlers.get("repairWorktree")?.({
      command: "repairWorktree",
      repo,
      path: featPath,
      newPath: null
    });
    expect(posts.at(-1)).toEqual({ command: "repairWorktree", status: null });
    expect(simpleGitList(repo)).not.toContain("prunable");
  });

  it("forwards each open message to its hidden command, which re-lists first (W31)", async () => {
    const { repo, featPath, handlers, posts } = setup();

    await handlers.get("openWorktree")?.({
      command: "openWorktree",
      repo,
      path: featPath,
      newWindow: true
    });
    await handlers.get("addWorktreeToWorkspace")?.({
      command: "addWorktreeToWorkspace",
      repo,
      path: featPath
    });
    await handlers.get("revealWorktree")?.({ command: "revealWorktree", repo, path: featPath });
    await handlers.get("switchGraphToWorktree")?.({
      command: "switchGraphToWorktree",
      repo,
      path: featPath
    });

    expect(executedCommands).toEqual([
      [
        "git-graph-libre.openWorktree",
        { command: "openWorktree", repo, path: featPath, newWindow: true }
      ],
      [
        "git-graph-libre.addWorktreeToWorkspace",
        { command: "addWorktreeToWorkspace", repo, path: featPath }
      ],
      ["git-graph-libre.revealWorktree", { command: "revealWorktree", repo, path: featPath }],
      [
        "git-graph-libre.switchGraphToWorktree",
        { command: "switchGraphToWorktree", repo, path: featPath }
      ]
    ]);
    expect(posts).toEqual([
      { command: "openWorktree", status: null },
      { command: "addWorktreeToWorkspace", status: null },
      { command: "revealWorktree", status: null },
      { command: "switchGraphToWorktree", status: null }
    ]);
  });

  it("answers the changes query with the files a forced removal would delete", async () => {
    const { repo, featPath, handlers, posts } = setup();
    fs.writeFileSync(path.join(featPath, "unsaved.txt"), "work");

    await handlers.get("worktreeChanges")?.({
      command: "worktreeChanges",
      repo,
      path: featPath,
      requestId: 4
    });

    expect(posts).toEqual([
      {
        command: "worktreeChanges",
        requestId: 4,
        path: featPath,
        files: ["unsaved.txt"],
        truncated: false,
        error: null
      }
    ]);
  });
});

function simpleGitList(repo: string): string {
  return cp.execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repo,
    encoding: "utf8"
  });
}
