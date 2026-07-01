import * as fs from "node:fs";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { AvatarManager } from "@/avatarManager";
import type { GitClient } from "@/backend/gitClient";
import type { Config } from "@/config";
import { registerMessageHandlers } from "@/extension/messageHandler";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewBridge } from "@/extension/webviewBridge";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { RequestMessage, ResponseMessage } from "@/types";

import { makeRepo } from "@tests/backend/helpers";

let repo: string;

beforeAll(() => {
  repo = makeRepo();
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("registerMessageHandlers", () => {
  it("echoes request ids when loading repository info", async () => {
    const handlers = new Map<
      RequestMessage["command"],
      (msg: RequestMessage) => void | Promise<void>
    >();
    const posts: ResponseMessage[] = [];
    const bridge = {
      post: (msg: ResponseMessage) => {
        posts.push(msg);
      },
      onMessage: <T extends RequestMessage["command"]>(
        command: T,
        handler: (msg: Extract<RequestMessage, { command: T }>) => void | Promise<void>
      ) => {
        handlers.set(command, handler as (msg: RequestMessage) => void | Promise<void>);
      }
    } as WebviewBridge;
    const gitClient = {
      getInstance: () => simpleGit(repo),
      setRepo: vi.fn(),
      setGitPath: vi.fn()
    } as unknown as GitClient;

    registerMessageHandlers(bridge, {
      config: {
        dateType: () => "Author Date",
        showUncommittedChanges: () => false,
        gitPath: () => "git"
      } as unknown as Config,
      gitClient,
      repoManager: {} as RepoManager,
      extensionState: {} as ExtensionState,
      avatarManager: { fetchAvatarImage: vi.fn() } as unknown as AvatarManager,
      repoFileWatcher: { start: vi.fn() } as unknown as RepoFileWatcher
    });

    const handler = handlers.get("loadRepoInfo");
    expect(handler).toBeDefined();
    await handler?.({ command: "loadRepoInfo", requestId: 42, repo });

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      command: "loadRepoInfo",
      requestId: 42,
      repoInfo: {
        isRepo: true,
        head: "main"
      },
      error: null
    });
  });
});
