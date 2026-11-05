import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { makeRepo } from "@tests/backend/helpers";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

import { type GitDirs, resolveGitDirs } from "@/backend/utils/gitDirs";
import { RepoFileWatcher } from "@/repoFileWatcher";

type StubUri = { fsPath: string };
type StubPattern = { base: string; pattern: string };
type WatcherHandle = {
  pattern: StubPattern;
  fireCreate: (uri: StubUri) => void;
  fireChange: (uri: StubUri) => void;
  fireDelete: (uri: StubUri) => void;
  disposed: boolean;
};

function makeUri(fsPath: string): StubUri {
  return { fsPath };
}

function tick() {
  return new Promise<void>((resolve) => setTimeout(resolve, 10));
}

function createHarness(
  resolveDirs: (repo: string) => GitDirs = (repo) => ({
    gitDir: `${repo}/.git`,
    commonDir: `${repo}/.git`
  }),
  debounceDelay = 0
) {
  const watcherHandles: WatcherHandle[] = [];
  const callback = vi.fn();
  const workspace = {
    createFileSystemWatcher(pattern: StubPattern) {
      const handle: WatcherHandle = {
        pattern,
        fireCreate: () => {},
        fireChange: () => {},
        fireDelete: () => {},
        disposed: false
      };
      watcherHandles.push(handle);
      return {
        onDidCreate: (handler: (uri: StubUri) => void) => {
          handle.fireCreate = handler;
          return { dispose: () => {} };
        },
        onDidChange: (handler: (uri: StubUri) => void) => {
          handle.fireChange = handler;
          return { dispose: () => {} };
        },
        onDidDelete: (handler: (uri: StubUri) => void) => {
          handle.fireDelete = handler;
          return { dispose: () => {} };
        },
        dispose: () => {
          handle.disposed = true;
        }
      };
    }
  };
  const watcher = new RepoFileWatcher(
    callback,
    workspace as unknown as Pick<typeof vscode.workspace, "createFileSystemWatcher">,
    (base, pattern) => ({ base, pattern }) as unknown as vscode.GlobPattern,
    debounceDelay,
    0,
    resolveDirs
  );
  return { watcher, watcherHandles, callback };
}

describe("RepoFileWatcher", () => {
  it("creates separate RelativePattern watchers for the repo and its git dir", () => {
    const { watcher, watcherHandles } = createHarness();

    watcher.start("/repo/");

    expect(watcherHandles.map((handle) => handle.pattern)).toEqual([
      { base: "/repo", pattern: "**" },
      { base: "/repo/.git", pattern: "**" }
    ]);
    watcher.stop();
    expect(watcherHandles.every((handle) => handle.disposed)).toBe(true);
  });

  it("refreshes for working tree files and git ref changes", async () => {
    const { watcher, watcherHandles, callback } = createHarness();
    watcher.start("/repo");

    watcherHandles[0].fireChange(makeUri("/repo/src/file.ts"));
    await tick();
    watcherHandles[1].fireChange(makeUri("/repo/.git/HEAD"));
    await tick();
    watcherHandles[1].fireChange(makeUri("/repo/.git/refs/heads/main"));
    await tick();
    watcherHandles[1].fireChange(makeUri("/repo/.git/packed-refs"));
    await tick();

    expect(callback).toHaveBeenCalledTimes(4);
  });

  it("ignores noisy .git internals while keeping dot-git working-tree files", async () => {
    const { watcher, watcherHandles, callback } = createHarness();
    watcher.start("/repo");

    watcherHandles[0].fireChange(makeUri("/repo/.git/config"));
    watcherHandles[1].fireChange(makeUri("/repo/.git/objects/aa/object"));
    await tick();
    expect(callback).not.toHaveBeenCalled();

    watcherHandles[0].fireChange(makeUri("/repo/.gitignore"));
    await tick();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("suppresses refresh while muted and resumes after unmute", async () => {
    const { watcher, watcherHandles, callback } = createHarness();
    watcher.start("/repo");

    watcher.mute();
    watcherHandles[1].fireChange(makeUri("/repo/.git/index"));
    await tick();
    expect(callback).not.toHaveBeenCalled();

    watcher.unmute();
    watcherHandles[1].fireChange(makeUri("/repo/.git/index"));
    await tick();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("creates no watchers for an empty repo path", () => {
    const { watcher, watcherHandles } = createHarness();

    watcher.start("");

    expect(watcherHandles).toEqual([]);
    watcher.stop();
  });

  it("clears pending refreshes when stopped", async () => {
    const { watcher, watcherHandles, callback } = createHarness();
    watcher.start("/repo");

    watcherHandles[0].fireChange(makeUri("/repo/file"));
    watcher.stop();
    await tick();

    expect(callback).not.toHaveBeenCalled();
  });
});

// --- worktree fixtures: real repositories, real git dirs, stubbed watchers ---

const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function run(args: string[], cwd: string) {
  cp.execFileSync("git", args, { cwd, stdio: "pipe", env: gitEnv });
}

const tempRoots: string[] = [];
let mainRepo: string;
let spaced: string;
let accented: string;
let remote: string;

beforeAll(() => {
  mainRepo = fs.realpathSync(makeRepo());
  tempRoots.push(mainRepo);
  const holder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ngg-wt-")));
  tempRoots.push(holder);
  spaced = path.join(holder, "wt with space");
  accented = path.join(holder, "wt-ünï");
  run(["worktree", "add", "-b", "feat-space", spaced], mainRepo);
  run(["worktree", "add", "-b", "feat-accent", accented], mainRepo);
  remote = path.join(holder, "remote.git");
  run(["init", "--bare", "-b", "main", remote], holder);
  run(["remote", "add", "origin", remote], mainRepo);
  run(["push", "origin", "main"], mainRepo);
});

afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function bases(handles: WatcherHandle[]) {
  return handles.map((handle) => handle.pattern.base);
}

describe("RepoFileWatcher on worktrees", () => {
  it.each([
    ["a path with a space", () => spaced],
    ["a non-ASCII path", () => accented]
  ])("a linked worktree at %s watches its admin dir and the common dir", (_name, getPath) => {
    const wt = getPath();
    const { gitDir, commonDir } = resolveGitDirs(wt);
    expect(fs.realpathSync(commonDir)).toBe(path.join(mainRepo, ".git"));
    expect(path.dirname(path.dirname(gitDir))).toBe(commonDir);
    expect(fs.statSync(path.join(gitDir, "HEAD")).isFile()).toBe(true);

    const { watcher, watcherHandles } = createHarness(resolveGitDirs);
    watcher.start(wt);

    expect(bases(watcherHandles)).toEqual([
      wt.replaceAll("\\", "/"),
      gitDir.replaceAll("\\", "/"),
      commonDir.replaceAll("\\", "/")
    ]);
    watcher.stop();
  });

  it("refreshes a linked worktree for a commit, a checkout and a fetch made in a terminal", async () => {
    const wt = spaced;
    const { gitDir, commonDir } = resolveGitDirs(wt);
    const { watcher, watcherHandles, callback } = createHarness(resolveGitDirs);
    watcher.start(wt);
    const [, ownDir, sharedDir] = watcherHandles;

    // Commit: moves refs/heads/<branch> in the common dir.
    fs.writeFileSync(path.join(wt, "g"), "y");
    run(["add", "g"], wt);
    run(["commit", "-m", "in worktree"], wt);
    expect(fs.existsSync(path.join(commonDir, "refs", "heads", "feat-space"))).toBe(true);
    sharedDir.fireChange(makeUri(path.join(commonDir, "refs", "heads", "feat-space")));
    await tick();
    expect(callback).toHaveBeenCalledTimes(1);

    // The index and HEAD live in the admin dir.
    ownDir.fireChange(makeUri(path.join(gitDir, "index")));
    await tick();
    run(["checkout", "-b", "other"], wt);
    expect(fs.readFileSync(path.join(gitDir, "HEAD"), "utf8")).toContain("refs/heads/other");
    ownDir.fireChange(makeUri(path.join(gitDir, "HEAD")));
    await tick();
    expect(callback).toHaveBeenCalledTimes(3);

    // Fetch: writes refs/remotes/origin/* in the common dir.
    run(["push", "origin", "feat-space:refs/heads/pushed"], wt);
    run(["fetch", "origin"], wt);
    const remoteRef = path.join(commonDir, "refs", "remotes", "origin", "pushed");
    expect(fs.existsSync(remoteRef)).toBe(true);
    sharedDir.fireCreate(makeUri(remoteRef));
    await tick();
    expect(callback).toHaveBeenCalledTimes(4);
    watcher.stop();
  });

  it("refreshes the main graph when a linked worktree checks out, is locked, or is removed", async () => {
    const { watcher, watcherHandles, callback } = createHarness(resolveGitDirs);
    watcher.start(mainRepo);
    expect(watcherHandles).toHaveLength(2);
    const commonHandle = watcherHandles[1];
    const adminDir = resolveGitDirs(accented).gitDir;

    run(["checkout", "--detach"], accented);
    commonHandle.fireChange(makeUri(path.join(adminDir, "HEAD")));
    await tick();
    expect(callback).toHaveBeenCalledTimes(1);

    run(["worktree", "lock", "--reason", "on a stick", accented], mainRepo);
    expect(fs.existsSync(path.join(adminDir, "locked"))).toBe(true);
    commonHandle.fireCreate(makeUri(path.join(adminDir, "locked")));
    await tick();
    expect(callback).toHaveBeenCalledTimes(2);

    run(["worktree", "unlock", accented], mainRepo);
    commonHandle.fireDelete(makeUri(path.join(adminDir, "locked")));
    await tick();
    expect(callback).toHaveBeenCalledTimes(3);

    // A throwaway worktree is added and removed, so the id directory comes and goes.
    const extra = path.join(path.dirname(spaced), "wt-extra");
    run(["worktree", "add", "-b", "extra", extra], mainRepo);
    const extraAdmin = resolveGitDirs(extra).gitDir;
    commonHandle.fireCreate(makeUri(extraAdmin));
    await tick();
    expect(callback).toHaveBeenCalledTimes(4);
    run(["worktree", "remove", extra], mainRepo);
    expect(fs.existsSync(extraAdmin)).toBe(false);
    commonHandle.fireDelete(makeUri(extraAdmin));
    await tick();
    expect(callback).toHaveBeenCalledTimes(5);

    // Admin entries that are not worktree state stay quiet.
    commonHandle.fireChange(makeUri(path.join(adminDir, "logs", "HEAD")));
    commonHandle.fireChange(makeUri(path.join(adminDir, "index")));
    await tick();
    expect(callback).toHaveBeenCalledTimes(5);
    watcher.stop();
  });

  it("keeps a submodule's behavior: one git dir, no commondir", async () => {
    const outer = fs.realpathSync(makeRepo());
    tempRoots.push(outer);
    const inner = fs.realpathSync(makeRepo());
    tempRoots.push(inner);
    run(["-c", "protocol.file.allow=always", "submodule", "add", inner, "sub"], outer);
    const sub = path.join(outer, "sub");
    expect(fs.statSync(path.join(sub, ".git")).isFile()).toBe(true);

    const { gitDir, commonDir } = resolveGitDirs(sub);
    expect(commonDir).toBe(gitDir);
    expect(gitDir).toBe(path.join(outer, ".git", "modules", "sub"));

    const { watcher, watcherHandles, callback } = createHarness(resolveGitDirs);
    watcher.start(sub);
    expect(bases(watcherHandles)).toEqual([sub, gitDir]);
    watcherHandles[1].fireChange(makeUri(path.join(gitDir, "HEAD")));
    watcherHandles[1].fireChange(makeUri(path.join(gitDir, "objects", "aa", "obj")));
    await tick();
    expect(callback).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("refreshes once for one event reported by two watchers", () => {
    vi.useFakeTimers();
    const wt = spaced;
    const { gitDir, commonDir } = resolveGitDirs(wt);
    const { watcher, watcherHandles, callback } = createHarness(resolveGitDirs, 750);
    watcher.start(wt);
    const [, ownDir, sharedDir] = watcherHandles;

    // A checkout in the worktree rewrites its admin HEAD, which both the admin
    // and the common-dir watchers see.
    ownDir.fireChange(makeUri(path.join(gitDir, "HEAD")));
    sharedDir.fireChange(makeUri(path.join(commonDir, "worktrees", path.basename(gitDir), "HEAD")));
    sharedDir.fireChange(makeUri(path.join(commonDir, "refs", "heads", "x")));
    vi.advanceTimersByTime(749);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);
    watcher.stop();
  });
});
