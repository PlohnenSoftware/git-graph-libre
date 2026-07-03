import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import {
  createdTerminals,
  executedCommands,
  openedExternalUris,
  openedTextDocuments,
  resetVscodeMock,
  saveDialogResults,
  shownSaveDialogs,
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
import type { GitRepoState, RequestMessage, ResponseMessage } from "@/types";

let repo: string;

beforeAll(() => {
  repo = makeRepo();
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("registerMessageHandlers", () => {
  function registerHandlersForTest(activeRepo = repo) {
    const handlers = new Map<
      RequestMessage["command"],
      (msg: RequestMessage) => void | Promise<void>
    >();
    const posts: ResponseMessage[] = [];
    const outputLines: string[] = [];
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
      getInstance: () => simpleGit(activeRepo),
      setRepo: vi.fn(),
      setGitPath: vi.fn()
    } as unknown as GitClient;

    const repoStates = new Map<string, GitRepoState>([[activeRepo, { columnWidths: null }]]);
    const repoManager = {
      getRepos: () => Object.fromEntries(repoStates),
      setRepoState: (repoPath: string, state: unknown) => {
        repoStates.set(repoPath, state as { columnWidths: null });
      }
    } as unknown as RepoManager;
    const repoFileWatcher = {
      mute: vi.fn(),
      unmute: vi.fn(),
      start: vi.fn()
    } as unknown as RepoFileWatcher;

    registerMessageHandlers(bridge, {
      config: {
        dateType: () => "Author Date",
        showUncommittedChanges: () => false,
        shortHashLength: () => 4,
        gitPath: () => "git"
      } as unknown as Config,
      gitClient,
      repoManager,
      extensionState: {} as ExtensionState,
      avatarManager: { fetchAvatarImage: vi.fn() } as unknown as AvatarManager,
      repoFileWatcher,
      outputChannel: {
        appendLine: (line: string) => outputLines.push(line)
      }
    });

    return { handlers, posts, outputLines, repoStates, repoFileWatcher };
  }

  it("echoes request ids when loading repository info", async () => {
    const { handlers, posts } = registerHandlersForTest();

    const handler = handlers.get("loadRepoInfo");
    expect(handler).toBeDefined();
    await handler?.({ command: "loadRepoInfo", requestId: 42, repo, showStashes: true });

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
      showRemoteBranches: false,
      showTags: true
    });

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      command: "searchCommits",
      requestId: 7,
      results: [expect.objectContaining({ message: "init", loadCount: 1 })],
      error: null
    });
  });

  it("routes tag detail queries", async () => {
    git(["tag", "-a", "v-details", "-m", "Release details", "-m", "Body"], repo);
    const { handlers, posts, outputLines } = registerHandlersForTest();

    const handler = handlers.get("tagDetails");
    expect(handler).toBeDefined();
    await handler?.({ command: "tagDetails", repo, tagName: "v-details" });

    expect(posts[posts.length - 1]).toMatchObject({
      command: "tagDetails",
      tagName: "v-details",
      tagDetails: {
        type: "annotated",
        subject: "Release details",
        body: "Body"
      },
      error: null
    });
    expect(outputLines.some((line) => line.includes("tagDetails.info"))).toBe(true);
  });

  it("writes webview diagnostics to the output channel", async () => {
    const { handlers, outputLines } = registerHandlersForTest();
    const handler = handlers.get("webviewDiagnostic");

    expect(handler).toBeDefined();
    await handler?.({
      command: "webviewDiagnostic",
      stage: "load.start",
      repo,
      repoCount: 1,
      requestId: 2,
      message: "checking"
    });

    expect(outputLines[outputLines.length - 1]).toContain("[webview] load.start");
    expect(outputLines[outputLines.length - 1]).toContain("repos=1");
    expect(outputLines[outputLines.length - 1]).toContain("request=2");
    expect(outputLines[outputLines.length - 1]).toContain("checking");
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

  it("creates archives from a save-dialog path", async () => {
    resetVscodeMock();
    const { handlers, posts, outputLines } = registerHandlersForTest();
    const handler = handlers.get("createArchive");
    const archivePath = path.join(repo, "archive.tar");
    saveDialogResults.push({ fsPath: archivePath });

    expect(handler).toBeDefined();
    await handler?.({ command: "createArchive", repo, ref: "HEAD" });

    expect(posts[posts.length - 1]).toEqual({
      command: "createArchive",
      status: null
    });
    expect(fs.existsSync(archivePath)).toBe(true);
    expect(shownSaveDialogs).toHaveLength(1);
    expect(
      outputLines.some((line) => line.includes("archive.create") && line.includes('"--format=tar"'))
    ).toBe(true);
  });

  it("does not run archive when the save dialog is canceled", async () => {
    resetVscodeMock();
    const { handlers, posts, outputLines } = registerHandlersForTest();
    const handler = handlers.get("createArchive");
    saveDialogResults.push(undefined);

    expect(handler).toBeDefined();
    await handler?.({ command: "createArchive", repo, ref: "HEAD" });

    expect(posts[posts.length - 1]).toEqual({
      command: "createArchive",
      status: null
    });
    expect(outputLines.some((line) => line.includes("archive --format"))).toBe(false);
  });

  it("rejects archive output paths without tar or zip extensions", async () => {
    resetVscodeMock();
    const { handlers, posts, outputLines } = registerHandlersForTest();
    const handler = handlers.get("createArchive");
    saveDialogResults.push({ fsPath: path.join(repo, "archive.txt") });

    expect(handler).toBeDefined();
    await handler?.({ command: "createArchive", repo, ref: "HEAD" });

    expect(posts[posts.length - 1]).toMatchObject({
      command: "createArchive",
      status: expect.stringContaining(".tar or .zip")
    });
    expect(outputLines.some((line) => line.includes("archive --format"))).toBe(false);
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

    await handler?.({
      command: "viewDiff",
      repo,
      commitHash: "def4567890abcdef",
      oldRef: "def4567890abcdef",
      newRef: "HEAD",
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M"
    });
    expect(executedCommands[executedCommands.length - 1]?.[3]).toBe("example.ts (def4 ↔ HEAD)");
  });

  it("routes commit comparison queries", async () => {
    const comparisonRepo = makeRepo();
    try {
      const baseHash = cp
        .execFileSync("git", ["rev-parse", "HEAD"], { cwd: comparisonRepo })
        .toString()
        .trim();
      fs.writeFileSync(path.join(comparisonRepo, "f"), "x\nchanged\n");
      git(["add", "."], comparisonRepo);
      git(["commit", "-m", "change file"], comparisonRepo);

      const { handlers, posts } = registerHandlersForTest(comparisonRepo);
      const handler = handlers.get("commitComparison");

      expect(handler).toBeDefined();
      await handler?.({
        command: "commitComparison",
        repo: comparisonRepo,
        commitHash: baseHash,
        baseRef: baseHash,
        compareRef: "HEAD"
      });

      expect(posts[posts.length - 1]).toMatchObject({
        command: "commitComparison",
        commitDetails: {
          hash: baseHash,
          fileChanges: [expect.objectContaining({ newFilePath: "f", type: "M" })]
        },
        error: null
      });
    } finally {
      fs.rmSync(comparisonRepo, { recursive: true, force: true });
    }
  });

  it("opens files at a selected revision through the virtual document provider", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("viewFileAtRevision");

    expect(handler).toBeDefined();
    await handler?.({
      command: "viewFileAtRevision",
      repo,
      commitHash: "abcdef1234567890",
      filePath: "src/example.ts"
    });

    expect(posts[posts.length - 1]).toEqual({
      command: "viewFileAtRevision",
      success: true
    });
    expect(openedTextDocuments[openedTextDocuments.length - 1]?.value).toContain(
      "git-graph-libre:src/example.ts"
    );
    expect(openedTextDocuments[openedTextDocuments.length - 1]?.query).toContain(
      "commit=abcdef1234567890"
    );
    expect(shownTextDocuments[shownTextDocuments.length - 1]?.options).toEqual({ preview: true });
  });

  it("compares a revision file with the working tree file", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("compareFileWithWorkingTree");

    expect(handler).toBeDefined();
    await handler?.({
      command: "compareFileWithWorkingTree",
      repo,
      commitHash: "abcdef1234567890",
      filePath: "src/example.ts"
    });

    expect(posts[posts.length - 1]).toEqual({
      command: "compareFileWithWorkingTree",
      success: true
    });
    const command = executedCommands[executedCommands.length - 1];
    expect(command?.[0]).toBe("vscode.diff");
    expect(command?.[1]).toMatchObject({ path: "src/example.ts" });
    expect(command?.[2]).toMatchObject({ fsPath: path.join(repo, "src/example.ts") });
    expect(command?.[3]).toBe("example.ts (abcd ↔ Working Tree)");
  });

  it("opens the VS Code Source Control view", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("openSourceControl");

    expect(handler).toBeDefined();
    await handler?.({ command: "openSourceControl" });

    expect(posts[posts.length - 1]).toEqual({
      command: "openSourceControl",
      success: true
    });
    expect(executedCommands[executedCommands.length - 1]?.[0]).toBe("workbench.view.scm");
  });

  it("opens safe external URLs and rejects unsafe schemes", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("openExternalUrl");

    expect(handler).toBeDefined();
    await handler?.({ command: "openExternalUrl", url: "https://example.test/pull/1" });
    await handler?.({ command: "openExternalUrl", url: "javascript:alert(1)" });

    expect(posts.at(-2)).toEqual({ command: "openExternalUrl", success: true });
    expect(posts.at(-1)).toEqual({ command: "openExternalUrl", success: false });
    expect(openedExternalUris.map((uri) => uri.toString())).toEqual([
      "https://example.test/pull/1"
    ]);
  });

  it("exports and imports repository configuration files", async () => {
    const { handlers, posts, repoStates, repoFileWatcher } = registerHandlersForTest();
    repoStates.set(repo, {
      columnWidths: null,
      displayName: "Test Repo",
      issueLinking: { pattern: "#(\\d+)", urlTemplate: "https://issues.test/$1" }
    });

    const exportHandler = handlers.get("exportRepoConfig");
    expect(exportHandler).toBeDefined();
    await exportHandler?.({ command: "exportRepoConfig", repo });

    expect(posts.at(-1)).toEqual({ command: "exportRepoConfig", status: null });
    expect(repoFileWatcher.mute).toHaveBeenCalled();
    expect(repoFileWatcher.unmute).toHaveBeenCalled();
    const configPath = path.join(repo, ".vscode", "git-graph-libre.json");
    expect(fs.existsSync(configPath)).toBe(true);

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        repoState: {
          displayName: "Imported Repo",
          showTags: "disabled"
        }
      })
    );

    const importHandler = handlers.get("importRepoConfig");
    expect(importHandler).toBeDefined();
    await importHandler?.({ command: "importRepoConfig", repo });

    expect(posts.at(-1)).toMatchObject({
      command: "importRepoConfig",
      repo,
      status: null,
      state: {
        displayName: "Imported Repo",
        showTags: "disabled"
      }
    });
  });

  it("opens generated pull request URLs from the create pull request action", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("createPullRequest");

    expect(handler).toBeDefined();
    await handler?.({
      command: "createPullRequest",
      repo,
      branchName: "feature/demo",
      remoteName: "origin",
      remoteUrl: "https://github.com/owner/repo.git",
      baseBranch: "main",
      urlTemplate: "https://{host}/{owner}/{repo}/compare/{baseBranch}...{sourceBranch}",
      pushBeforeCreate: false
    });

    expect(posts.at(-1)).toEqual({ command: "createPullRequest", status: null });
    expect(openedExternalUris.map((uri) => uri.toString())).toEqual([
      "https://github.com/owner/repo/compare/main...feature%2Fdemo"
    ]);
  });

  it("opens an interactive rebase terminal from the rebase action", async () => {
    resetVscodeMock();
    const { handlers, posts } = registerHandlersForTest();
    const handler = handlers.get("rebaseCurrentBranch");

    expect(handler).toBeDefined();
    await handler?.({
      command: "rebaseCurrentBranch",
      repo,
      target: "feature/topic",
      targetType: "branch",
      ignoreDate: true,
      interactive: true
    });

    expect(posts[posts.length - 1]).toEqual({
      command: "rebaseCurrentBranch",
      status: null
    });
    expect(createdTerminals).toHaveLength(1);
    expect(createdTerminals[0]).toMatchObject({
      options: {
        cwd: repo
      },
      shown: true,
      sentText: ["git rebase --interactive 'feature/topic'"]
    });
  });
});
