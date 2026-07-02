import * as fs from "node:fs";
import * as path from "node:path";
import { makeRepo } from "@tests/backend/helpers";
import {
  executedCommands,
  openedTextDocuments,
  resetVscodeMock,
  shownTextDocuments
} from "@tests/webview/__mocks__/vscode";
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

let repo: string;

beforeAll(() => {
  repo = makeRepo();
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("registerMessageHandlers", () => {
  function registerHandlersForTest() {
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
        shortHashLength: () => 4,
        gitPath: () => "git"
      } as unknown as Config,
      gitClient,
      repoManager: {} as RepoManager,
      extensionState: {} as ExtensionState,
      avatarManager: { fetchAvatarImage: vi.fn() } as unknown as AvatarManager,
      repoFileWatcher: { start: vi.fn() } as unknown as RepoFileWatcher
    });

    return { handlers, posts };
  }

  it("echoes request ids when loading repository info", async () => {
    const { handlers, posts } = registerHandlersForTest();

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

  it("echoes request ids when searching commits", async () => {
    const { handlers, posts } = registerHandlersForTest();

    const handler = handlers.get("searchCommits");
    expect(handler).toBeDefined();
    await handler?.({
      command: "searchCommits",
      requestId: 7,
      repo,
      query: "init",
      maxResults: 10,
      showRemoteBranches: false
    });

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      command: "searchCommits",
      requestId: 7,
      results: [expect.objectContaining({ message: "init", loadCount: 1 })],
      error: null
    });
  });

  it("opens current files from repo-contained paths", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("openFile");
    const filePath = path.join(repo, "src/example.ts");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "export const value = 1;\n");

    expect(handler).toBeDefined();
    await handler?.({ command: "openFile", repo, filePath: "src/example.ts" });

    expect(posts[posts.length - 1]).toEqual({
      command: "openFile",
      success: true
    });
    expect(openedTextDocuments[openedTextDocuments.length - 1]?.fsPath).toBe(filePath);
    expect(shownTextDocuments[shownTextDocuments.length - 1]?.document.uri.fsPath).toBe(filePath);
  });

  it("rejects file open paths outside the selected repo", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("openFile");

    expect(handler).toBeDefined();
    await handler?.({ command: "openFile", repo, filePath: "../outside.ts" });

    expect(posts[posts.length - 1]).toEqual({
      command: "openFile",
      success: false
    });
    expect(openedTextDocuments).toHaveLength(0);
    expect(shownTextDocuments).toHaveLength(0);
  });

  it("uses configured short hashes in diff titles while opening full hash revisions", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("viewDiff");

    expect(handler).toBeDefined();
    await handler?.({
      command: "viewDiff",
      repo,
      commitHash: "abcdef1234567890",
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M"
    });

    expect(posts[posts.length - 1]).toEqual({
      command: "viewDiff",
      success: true
    });
    expect(executedCommands[executedCommands.length - 1]?.[3]).toBe("example.ts (abcd^ ↔ abcd)");
    expect(JSON.stringify(executedCommands[executedCommands.length - 1])).toContain(
      "abcdef1234567890"
    );
  });
});
