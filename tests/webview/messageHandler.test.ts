import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import {
  ConfigurationTarget,
  configurationGlobalValues,
  configurationUpdates,
  createdTerminals,
  executedCommands,
  openDialogResults,
  openedExternalUris,
  openedTextDocuments,
  resetVscodeMock,
  saveDialogResults,
  setConfigurationValue,
  shownSaveDialogs,
  shownTextDocuments,
  shownWarningMessages,
  warningMessageResults
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

/**
 * Writes a tag object carrying a PGP signature block without needing a GPG key,
 * the same trick the loadCommits signed-tag suite uses: `%(contents:signature)`
 * keys off the block, not off a valid signature.
 */
function createSignatureBearingTag(dir: string, tagName: string, target: string) {
  const tagHash = cp
    .execFileSync("git", ["mktag"], {
      cwd: dir,
      input: [
        `object ${cp.execFileSync("git", ["rev-parse", target], { cwd: dir }).toString().trim()}`,
        "type commit",
        `tag ${tagName}`,
        "tagger T <t@t.com> 1700000000 +0000",
        "",
        "signed release",
        "-----BEGIN PGP SIGNATURE-----",
        "",
        "aGVsbG8gd29ybGQK",
        "=abcd",
        "-----END PGP SIGNATURE-----",
        ""
      ].join("\n")
    })
    .toString()
    .trim();
  git(["update-ref", `refs/tags/${tagName}`, tagHash], dir);
}

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("registerMessageHandlers", () => {
  function registerHandlersForTest(activeRepo = repo, options: { extensionPath?: string } = {}) {
    const telemetryEvents: Array<{ feature: string; ok: boolean }> = [];
    const consentPrompts: number[] = [];
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
      extensionPath: options.extensionPath,
      outputChannel: {
        appendLine: (line: string) => outputLines.push(line)
      },
      telemetry: {
        logFeature: (feature: string, ok: boolean) => {
          telemetryEvents.push({ feature, ok });
        }
      },
      telemetryConsentPrompt: {
        promptIfUnset: () => {
          consentPrompts.push(Date.now());
          return Promise.resolve();
        }
      }
    });

    return {
      handlers,
      posts,
      outputLines,
      repoStates,
      repoFileWatcher,
      telemetryEvents,
      consentPrompts
    };
  }

  // registerAction is the chokepoint the whole action surface funnels through,
  // so one call there instruments every context-menu item, dialog, and toolbar
  // action at once.
  it("records a feature event with the outcome for a successful action", async () => {
    const { handlers, telemetryEvents } = registerHandlersForTest();

    await handlers.get("addTag")?.({
      command: "addTag",
      repo,
      tagName: "v9.9.9-telemetry",
      commitHash: "HEAD",
      lightweight: true,
      message: ""
    } as RequestMessage);

    expect(telemetryEvents).toEqual([{ feature: "addTag", ok: true }]);
  });

  it("records ok:false when an action throws", async () => {
    const { handlers, telemetryEvents } = registerHandlersForTest();

    await handlers.get("deleteTag")?.({
      command: "deleteTag",
      repo,
      tagName: "definitely-not-a-real-tag"
    } as RequestMessage);

    expect(telemetryEvents).toEqual([{ feature: "deleteTag", ok: false }]);
  });

  // The payload is in scope at the chokepoint and carries repository paths,
  // branch names, and commit hashes. Only the command name may be sent.
  it("never sends the action payload", async () => {
    const { handlers, telemetryEvents } = registerHandlersForTest();

    await handlers.get("deleteTag")?.({
      command: "deleteTag",
      repo,
      tagName: "acme-corp-release"
    } as RequestMessage);

    const serialized = JSON.stringify(telemetryEvents);
    expect(serialized).not.toContain("acme-corp-release");
    expect(serialized).not.toContain(repo);
    expect(Object.keys(telemetryEvents[0])).toEqual(["feature", "ok"]);
  });

  // Set now on the consent screen. That screen replaces the graph while the
  // question is open, so without this route a dismissed notification would
  // leave the user with nothing to click.
  it("re-opens the consent notification for the consent screen's button", async () => {
    const { handlers, consentPrompts, posts, telemetryEvents } = registerHandlersForTest();

    await handlers.get("showTelemetryConsent")?.({
      command: "showTelemetryConsent"
    } as RequestMessage);

    expect(consentPrompts).toHaveLength(1);
    // Not an action: nothing to answer, and nothing to report about a request
    // made while telemetry is by definition off.
    expect(posts).toEqual([]);
    expect(telemetryEvents).toEqual([]);
  });

  // The action chokepoint above cannot see features that consist of something
  // being shown, so the commit-load route reports those separately.
  describe("read-side features", () => {
    const loadCommitsRequest = {
      command: "loadCommits" as const,
      requestId: 1,
      branchName: "",
      branches: null,
      authors: null,
      tags: null,
      maxCommits: 50,
      showRemoteBranches: false,
      hiddenRemotes: [],
      showTags: true,
      includeReflog: false,
      includeUnreachableCommits: false,
      onlyFollowFirstParent: false,
      commitOrdering: "date" as const,
      showSignature: false,
      hard: true,
      repo
    };

    it("reports history recovery when the log actually included it", async () => {
      const { handlers, telemetryEvents } = registerHandlersForTest();

      await handlers.get("loadCommits")?.({
        ...loadCommitsRequest,
        includeReflog: true,
        includeUnreachableCommits: true
      } as RequestMessage);

      expect(telemetryEvents).toEqual([
        { feature: "view.includeReflog", ok: true },
        { feature: "view.includeUnreachableCommits", ok: true }
      ]);
    });

    // The unreachable scan is skipped by the query itself unless the log
    // covers all refs, so an enabled setting under a branch filter is intent,
    // not use.
    it("does not report the unreachable scan under a branch filter", async () => {
      const { handlers, telemetryEvents } = registerHandlersForTest();

      await handlers.get("loadCommits")?.({
        ...loadCommitsRequest,
        branches: ["main"],
        includeUnreachableCommits: true
      } as RequestMessage);

      expect(telemetryEvents).toEqual([]);
    });

    it("reports the signed-tag badge from the commits the load returned", async () => {
      createSignatureBearingTag(repo, "v9.9.9-signed", "HEAD");
      const { handlers, telemetryEvents } = registerHandlersForTest();

      await handlers.get("loadCommits")?.(loadCommitsRequest as RequestMessage);

      expect(telemetryEvents).toEqual([{ feature: "view.signedTagBadge", ok: true }]);
      git(["tag", "-d", "v9.9.9-signed"], repo);
    });

    // The load path runs on every refresh and every watcher tick.
    it("reports each read-side feature once per session", async () => {
      const { handlers, telemetryEvents } = registerHandlersForTest();

      await handlers.get("loadCommits")?.({
        ...loadCommitsRequest,
        includeReflog: true
      } as RequestMessage);
      await handlers.get("loadCommits")?.({
        ...loadCommitsRequest,
        includeReflog: true
      } as RequestMessage);

      expect(telemetryEvents).toEqual([{ feature: "view.includeReflog", ok: true }]);
    });

    it("still answers the request with the commits", async () => {
      const { handlers, posts } = registerHandlersForTest();

      await handlers.get("loadCommits")?.({
        ...loadCommitsRequest,
        includeReflog: true
      } as RequestMessage);

      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({ command: "loadCommits", requestId: 1 });
      expect((posts[0] as { commits: unknown[] }).commits.length).toBeGreaterThan(0);
    });
  });

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

  it("pushes a tag to the selected remote and records the git command", async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-push-bare-"));
    try {
      cp.execFileSync("git", ["init", "--bare", "-b", "main", bare]);
      git(["remote", "add", "origin", bare], repo);
      git(["tag", "v-push"], repo);
      const { handlers, posts, outputLines } = registerHandlersForTest();

      const handler = handlers.get("pushTag");
      expect(handler).toBeDefined();
      await handler?.({
        command: "pushTag",
        repo,
        tagName: "v-push",
        remotes: ["origin"],
        mode: "normal",
        noVerify: false
      });

      expect(posts[posts.length - 1]).toEqual({ command: "pushTag", status: null });
      expect(cp.execFileSync("git", ["tag", "-l"], { cwd: bare }).toString().trim()).toBe("v-push");
      expect(
        outputLines.some(
          (line) => line.includes("tag.pushTag") && line.includes("refs/tags/v-push")
        )
      ).toBe(true);
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it("pushes all tags to the selected remotes and records the git command", async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-pushall-bare-"));
    try {
      cp.execFileSync("git", ["init", "--bare", "-b", "main", bare]);
      git(["remote", "add", "alltags", bare], repo);
      git(["tag", "v-all1"], repo);
      git(["tag", "v-all2"], repo);
      const { handlers, posts, outputLines } = registerHandlersForTest();

      const handler = handlers.get("pushAllTags");
      expect(handler).toBeDefined();
      await handler?.({
        command: "pushAllTags",
        repo,
        remotes: ["alltags"],
        mode: "normal",
        noVerify: false
      });

      expect(posts[posts.length - 1]).toEqual({ command: "pushAllTags", status: null });
      // `--tags` carries every local tag, including those created by earlier
      // tests; the assertion only pins this test's tags.
      const bareTags = cp.execFileSync("git", ["tag", "-l"], { cwd: bare }).toString();
      expect(bareTags).toContain("v-all1");
      expect(bareTags).toContain("v-all2");
      expect(
        outputLines.some((line) => line.includes("tag.pushAllTags") && line.includes("--tags"))
      ).toBe(true);
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it("fetches tags from the selected remote and records the git command", async () => {
    const source = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-fetchtags-src-"));
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-fetchtags-bare-"));
    try {
      cp.execFileSync("git", ["init", "-b", "main", source]);
      git(["config", "user.email", "t@t.com"], source);
      git(["config", "user.name", "T"], source);
      git(["config", "tag.gpgsign", "false"], source);
      fs.writeFileSync(path.join(source, "f"), "x");
      git(["add", "."], source);
      git(["commit", "-m", "init"], source);
      git(["tag", "v-fetched"], source);
      cp.execFileSync("git", ["init", "--bare", "-b", "main", bare]);
      git(["remote", "add", "origin", bare], source);
      git(["push", "origin", "main", "--tags"], source);

      git(["remote", "add", "tagsource", bare], repo);
      const { handlers, posts, outputLines } = registerHandlersForTest();

      const handler = handlers.get("fetchTags");
      expect(handler).toBeDefined();
      await handler?.({
        command: "fetchTags",
        repo,
        remotes: ["tagsource"],
        pruneTags: false
      });

      expect(posts[posts.length - 1]).toEqual({ command: "fetchTags", status: null });
      expect(cp.execFileSync("git", ["tag", "-l"], { cwd: repo }).toString()).toContain(
        "v-fetched"
      );
      expect(
        outputLines.some((line) => line.includes("remote.fetchTags") && line.includes("--tags"))
      ).toBe(true);
    } finally {
      fs.rmSync(source, { recursive: true, force: true });
      fs.rmSync(bare, { recursive: true, force: true });
    }
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

  it("loads, updates, exports, and imports extension settings", async () => {
    resetVscodeMock();
    setConfigurationValue("git-graph-libre", "graph.fontSize", 17);
    setConfigurationValue("git-graph-libre", "graphColors", [
      "oklch(63% 0.2 245)",
      "oklch(63% 0.2 350)"
    ]);
    const { handlers, posts } = registerHandlersForTest();

    const loadHandler = handlers.get("loadExtensionSettings");
    expect(loadHandler).toBeDefined();
    await loadHandler?.({ command: "loadExtensionSettings", requestId: 91 });

    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    const expectedSettings = Object.keys(
      manifest.contributes.configuration.properties as Record<string, unknown>
    ).filter((key) => key.startsWith("git-graph-libre."));
    const loadResponse = posts.at(-1);
    expect(loadResponse).toMatchObject({
      command: "loadExtensionSettings",
      requestId: 91,
      status: null
    });
    if (loadResponse?.command !== "loadExtensionSettings") {
      throw new Error("Missing loadExtensionSettings response");
    }
    const loadedSettings = loadResponse.settings;
    expect(loadedSettings).toHaveLength(expectedSettings.length);
    expect(
      loadedSettings.find((setting) => setting.key === "git-graph-libre.graph.fontSize")
    ).toMatchObject({
      value: 17,
      scope: "global",
      minimum: 8,
      maximum: 24
    });
    expect(
      loadedSettings.find((setting) => setting.key === "git-graph-libre.graphColors")
    ).toMatchObject({
      type: "array",
      value: ["oklch(63% 0.2 245)", "oklch(63% 0.2 350)"]
    });

    const updateHandler = handlers.get("updateExtensionSetting");
    expect(updateHandler).toBeDefined();
    await updateHandler?.({
      command: "updateExtensionSetting",
      key: "git-graph-libre.graph.fontSize",
      value: 99,
      global: true
    });

    expect(configurationUpdates.at(-1)).toEqual({
      section: "git-graph-libre",
      key: "graph.fontSize",
      value: 24,
      target: ConfigurationTarget.Global
    });
    expect(posts.at(-1)).toMatchObject({
      command: "updateExtensionSetting",
      key: "git-graph-libre.graph.fontSize",
      status: null
    });

    await updateHandler?.({
      command: "updateExtensionSetting",
      key: "git-graph-libre.unknown",
      value: true,
      global: true
    });
    expect(posts.at(-1)).toMatchObject({
      command: "updateExtensionSetting",
      key: "git-graph-libre.unknown",
      status: "Unknown setting: git-graph-libre.unknown",
      settings: expect.arrayContaining([
        expect.objectContaining({ key: "git-graph-libre.graph.fontSize" })
      ])
    });

    const exportPath = path.join(repo, "git-graph-libre.settings.json");
    saveDialogResults.push({ fsPath: exportPath });
    const exportHandler = handlers.get("exportExtensionSettings");
    expect(exportHandler).toBeDefined();
    await exportHandler?.({ command: "exportExtensionSettings" });

    expect(shownSaveDialogs).toHaveLength(1);
    expect(posts.at(-1)).toEqual({
      command: "exportExtensionSettings",
      status: null,
      exportedPath: exportPath
    });
    const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
    expect(exported).toMatchObject({
      kind: "git-graph-libre.extension-settings",
      version: 1,
      settings: {
        "git-graph-libre.graph.fontSize": 24,
        "git-graph-libre.graphColors": ["oklch(63% 0.2 245)", "oklch(63% 0.2 350)"]
      }
    });
    expect(exported.settings["git-graph-libre.loadMoreCommits"]).toBeUndefined();

    const importPath = path.join(repo, "imported-extension-settings.json");
    fs.writeFileSync(
      importPath,
      JSON.stringify({
        kind: "git-graph-libre.extension-settings",
        version: 1,
        settings: {
          "git-graph-libre.graph.rowHeight": 18,
          "git-graph-libre.unknown": true
        }
      })
    );
    openDialogResults.push([{ fsPath: importPath }]);
    warningMessageResults.push("Apply Settings");
    const importHandler = handlers.get("importExtensionSettings");
    expect(importHandler).toBeDefined();
    await importHandler?.({ command: "importExtensionSettings" });

    expect(shownWarningMessages).toHaveLength(1);
    expect(configurationGlobalValues.get("git-graph-libre.graph.rowHeight")).toBe(18);
    expect(posts.at(-1)).toMatchObject({
      command: "importExtensionSettings",
      status: null,
      importedKeys: ["git-graph-libre.graph.rowHeight"],
      skippedKeys: ["git-graph-libre.unknown"]
    });
  });

  it("reports extension settings failures from an unreadable manifest path", async () => {
    resetVscodeMock();
    const badExtensionPath = path.join(repo, "missing-extension");
    const { handlers, posts } = registerHandlersForTest(repo, { extensionPath: badExtensionPath });

    await handlers.get("loadExtensionSettings")?.({
      command: "loadExtensionSettings",
      requestId: 111
    });
    expect(posts.at(-1)).toMatchObject({
      command: "loadExtensionSettings",
      requestId: 111,
      settings: [],
      status: expect.stringContaining("package.json")
    });

    await handlers.get("updateExtensionSetting")?.({
      command: "updateExtensionSetting",
      key: "git-graph-libre.graph.fontSize",
      value: 14,
      global: true
    });
    expect(posts.at(-1)).toMatchObject({
      command: "updateExtensionSetting",
      key: "git-graph-libre.graph.fontSize",
      settings: [],
      status: expect.stringContaining("package.json")
    });

    saveDialogResults.push({ fsPath: path.join(repo, "bad-export.json") });
    await handlers.get("exportExtensionSettings")?.({ command: "exportExtensionSettings" });
    expect(posts.at(-1)).toMatchObject({
      command: "exportExtensionSettings",
      exportedPath: null,
      status: expect.stringContaining("package.json")
    });

    openDialogResults.push(undefined);
    await handlers.get("importExtensionSettings")?.({ command: "importExtensionSettings" });
    expect(posts.at(-1)).toMatchObject({
      command: "importExtensionSettings",
      settings: [],
      importedKeys: [],
      skippedKeys: [],
      status: expect.stringContaining("package.json")
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
