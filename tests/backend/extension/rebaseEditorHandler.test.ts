import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn() },
  env: { openExternal: vi.fn() },
  l10n: {
    t: (key: string, ...args: unknown[]) =>
      args.length > 0 ? `${key}:${args.map(String).join(",")}` : key
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    parse: (value: string) => ({ toString: () => value })
  },
  window: {
    createTerminal: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showTextDocument: vi.fn()
  },
  workspace: {
    openTextDocument: vi.fn(),
    workspaceFolders: []
  }
}));

vi.mock("@/l10n", () => ({
  t: (key: string, ...args: unknown[]) =>
    args.length > 0 ? `${key}:${args.map(String).join(",")}` : key
}));

import type { AvatarManager } from "@/avatarManager";
import type { GitClient } from "@/backend/gitClient";
import type { Config } from "@/config";
import { registerMessageHandlers } from "@/extension/messageHandler";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewBridge } from "@/extension/webviewBridge";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { RequestMessage, ResponseMessage } from "@/types";

/**
 * Real-Git tests for the interactive rebase editor's message path (F2-04):
 * `rebaseRange` reads and `interactiveRebase` runs go through the message
 * handler against throwaway temporary repositories with an isolated global
 * config, as `tests/webview/worktreeHandlers.test.ts` does for worktrees.
 */

const tempDirs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const isolatedEnv: Record<string, string> = {};

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runGit(args: string[], cwd: string): string {
  return cp.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...isolatedEnv }
  });
}

function initRepoWithThreeCommits(): {
  repo: string;
  c1: string;
  c2: string;
  c3: string;
} {
  const repo = tempDir("ggl-rebase-editor-handler-");
  runGit(["init", "-q", "-b", "main"], repo);
  runGit(["config", "commit.gpgsign", "false"], repo);

  const commitFile = (name: string, content: string, subject: string) => {
    fs.writeFileSync(path.join(repo, name), content);
    runGit(["add", "-A"], repo);
    runGit(["commit", "-q", "-m", subject], repo);
    return runGit(["rev-parse", "HEAD"], repo).trim();
  };

  const c1 = commitFile("a.txt", "one\n", "Commit 1");
  const c2 = commitFile("b.txt", "two\n", "Commit 2");
  const c3 = commitFile("c.txt", "three\n", "Commit 3");
  return { repo, c1, c2, c3 };
}

function createTestHarness(repo: string) {
  const handlers = new Map<string, (msg: RequestMessage) => Promise<void> | void>();
  const posts: ResponseMessage[] = [];

  const bridge = {
    post: (msg: ResponseMessage) => {
      posts.push(msg);
    },
    onMessage: (command: string, handler: (msg: RequestMessage) => Promise<void> | void) => {
      handlers.set(command, handler);
    }
  } as unknown as WebviewBridge;

  registerMessageHandlers(bridge, {
    config: {
      gitPath: () => "git",
      backend: () => "git-cli"
    } as unknown as Config,
    gitClient: { getInstance: () => simpleGit(repo) } as unknown as GitClient,
    repoManager: {
      getRepos: () => ({ [repo]: {} }),
      removeRepo: vi.fn(),
      setRepoState: vi.fn(),
      sendRepos: vi.fn()
    } as unknown as RepoManager,
    extensionState: {} as unknown as ExtensionState,
    avatarManager: { fetchAvatarImage: vi.fn() } as unknown as AvatarManager,
    repoFileWatcher: {
      mute: vi.fn(),
      unmute: vi.fn(),
      start: vi.fn()
    } as unknown as RepoFileWatcher
  });

  const dispatch = async (msg: RequestMessage) => {
    const handler = handlers.get(msg.command);
    if (handler === undefined) {
      throw new Error(`No handler registered for ${msg.command}`);
    }
    await handler(msg);
  };

  const latestResponse = <T extends ResponseMessage["command"]>(
    command: T
  ): Extract<ResponseMessage, { command: T }> => {
    for (let i = posts.length - 1; i >= 0; i--) {
      if (posts[i].command === command) {
        return posts[i] as Extract<ResponseMessage, { command: T }>;
      }
    }
    throw new Error(`Missing ${command} response`);
  };

  return { dispatch, latestResponse };
}

beforeAll(() => {
  const home = tempDir("ggl-rebase-editor-home-");
  const globalConfig = path.join(home, "gitconfig");
  fs.writeFileSync(globalConfig, "");
  Object.assign(isolatedEnv, {
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Author",
    GIT_AUTHOR_EMAIL: "author@example.test",
    GIT_COMMITTER_NAME: "Committer",
    GIT_COMMITTER_EMAIL: "committer@example.test",
    GIT_EDITOR: "true"
  });
  for (const [key, value] of Object.entries(isolatedEnv)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("rebaseEditor messageHandler integration", () => {
  it("loads rebaseRange oldest-first and executes a drop through interactiveRebase", async () => {
    const { repo, c1, c2, c3 } = initRepoWithThreeCommits();
    const { dispatch, latestResponse } = createTestHarness(repo);

    await dispatch({
      command: "rebaseRange",
      requestId: 1,
      repo,
      base: c1
    });

    const rangeRes = latestResponse("rebaseRange");
    expect(rangeRes.error).toBeNull();
    expect(rangeRes.preflight).toEqual({ canStart: true, reasons: [] });
    expect(rangeRes.commits.map((c) => [c.hash, c.subject])).toEqual([
      [c2, "Commit 2"],
      [c3, "Commit 3"]
    ]);

    // Drop Commit 2 and keep Commit 3
    await dispatch({
      command: "interactiveRebase",
      repo,
      base: c1,
      rangeHashes: [c2, c3],
      entries: [
        { action: "drop", hash: c2 },
        { action: "pick", hash: c3 }
      ]
    });

    expect(latestResponse("interactiveRebase")).toEqual({
      command: "interactiveRebase",
      status: null
    });

    const subjects = runGit(["log", "--format=%s"], repo).trim().split("\n");
    expect(subjects).toEqual(["Commit 3", "Commit 1"]);
    expect(fs.existsSync(path.join(repo, "b.txt"))).toBe(false);
    expect(fs.existsSync(path.join(repo, "c.txt"))).toBe(true);
  });

  it("reorders commits through interactiveRebase and hands over to operationState when paused on edit", async () => {
    const { repo, c1, c2, c3 } = initRepoWithThreeCommits();
    const { dispatch, latestResponse } = createTestHarness(repo);

    // Reorder Commit 3 before Commit 2
    await dispatch({
      command: "interactiveRebase",
      repo,
      base: c1,
      rangeHashes: [c2, c3],
      entries: [
        { action: "pick", hash: c3 },
        { action: "pick", hash: c2 }
      ]
    });
    expect(latestResponse("interactiveRebase").status).toBeNull();
    expect(runGit(["log", "--format=%s"], repo).trim().split("\n")).toEqual([
      "Commit 2",
      "Commit 3",
      "Commit 1"
    ]);

    // Read the new range and pause on edit at its first commit
    await dispatch({
      command: "rebaseRange",
      requestId: 2,
      repo,
      base: c1
    });
    const [newFirst, newSecond] = latestResponse("rebaseRange").commits;

    await dispatch({
      command: "interactiveRebase",
      repo,
      base: c1,
      rangeHashes: [newFirst.hash, newSecond.hash],
      entries: [
        { action: "edit", hash: newFirst.hash },
        { action: "pick", hash: newSecond.hash }
      ]
    });
    expect(latestResponse("interactiveRebase")).toEqual({
      command: "interactiveRebase",
      status: null
    });

    await dispatch({
      command: "operationState",
      requestId: 3,
      repo
    });
    const opState = latestResponse("operationState");
    expect(opState.error).toBeNull();
    expect(opState.kind).toBe("rebase");
    expect(opState.rebase).toMatchObject({
      stoppedHash: newFirst.hash,
      stopReason: "edit",
      current: 1,
      total: 2
    });
  });

  it("reports stale-range errors back through interactiveRebase status", async () => {
    const { repo, c1, c2, c3 } = initRepoWithThreeCommits();
    const { dispatch, latestResponse } = createTestHarness(repo);

    await dispatch({
      command: "interactiveRebase",
      repo,
      base: c1,
      rangeHashes: [c2],
      entries: [
        { action: "pick", hash: c2 },
        { action: "pick", hash: c3 }
      ]
    });

    expect(latestResponse("interactiveRebase").status).not.toBeNull();
    // Nothing was rewritten.
    expect(runGit(["rev-parse", "HEAD"], repo).trim()).toBe(c3);
  });
});
