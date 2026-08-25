import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

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

function createHarness() {
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
    0,
    0
  );
  return { watcher, watcherHandles, callback };
}

describe("RepoFileWatcher", () => {
  it("creates separate RelativePattern watchers for repo and .git paths", () => {
    const { watcher, watcherHandles } = createHarness();

    watcher.start("/repo/");

    expect(watcherHandles.map((handle) => handle.pattern)).toEqual([
      { base: "/repo", pattern: "**" },
      { base: "/repo", pattern: ".git/**" }
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
