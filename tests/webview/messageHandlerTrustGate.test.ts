import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AvatarManager } from "@/avatarManager";
import type { RepoReaderDeps } from "@/backend/engine/index";
import type { GitClient } from "@/backend/gitClient";
import type { Config } from "@/config";
import { registerMessageHandlers } from "@/extension/messageHandler";
import type { RepoManager } from "@/extension/repoManager";
import type { WebviewBridge } from "@/extension/webviewBridge";
import type { RepoSearch } from "@/extension/workspaceSearch";
import type { ExtensionState } from "@/extensionState";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { RequestMessage, ResponseMessage } from "@/types";

// The gate under test sits between the webview's request and the reader: it
// decides, per repository, whether the Rust engine may be offered the read at
// all. The reader is replaced so each case can see exactly what it was told.
const readers = vi.hoisted(() => ({
  created: [] as RepoReaderDeps[],
  error: null as null | { message: string; stderr: string | null }
}));
const OWNERSHIP = {
  message: "fatal: detected dubious ownership in repository at '/repo'",
  stderr: null,
  exitCode: 128,
  task: null
};

vi.mock("@/backend/engine/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/backend/engine/index")>();
  return {
    ...actual,
    createRepoReader: (deps: RepoReaderDeps) => {
      readers.created.push(deps);
      return {
        getRemoteUrl: async () => null,
        loadRepoInfo: async () => ({ repoInfo: null, error: readers.error }),
        loadCommits: async () => ({
          commits: [],
          head: null,
          moreCommitsAvailable: false,
          hard: false,
          error: readers.error
        }),
        loadCommitDetails: async () => ({ commitDetails: null, error: null }),
        loadCommitComparison: async () => ({ commitDetails: null, error: null }),
        searchCommits: async () => ({ results: [], error: null })
      };
    }
  };
});

const branches = vi.hoisted(() => ({ error: null as unknown }));
vi.mock("@/backend/queries/loadBranches", () => ({
  loadBranches: async () => ({
    branches: [],
    head: null,
    hard: false,
    isRepo: true,
    error: branches.error
  })
}));

function register(
  repoSearch?: Partial<Pick<RepoSearch, "searchWorkspaceForRepos">> &
    Pick<RepoSearch, "isVerified" | "forgetVerification">
) {
  const handlers = new Map<RequestMessage["command"], (msg: RequestMessage) => unknown>();
  const bridge = {
    post: (_msg: ResponseMessage) => {},
    onMessage: (command: RequestMessage["command"], handler: (msg: RequestMessage) => unknown) => {
      handlers.set(command, handler);
    }
  } as unknown as WebviewBridge;
  registerMessageHandlers(bridge, {
    config: {
      backend: () => "auto",
      gitPath: () => "git",
      dateType: () => "Author Date",
      showUncommittedChanges: () => false
    } as unknown as Config,
    gitClient: { getInstance: () => ({}), setRepo: vi.fn() } as unknown as GitClient,
    repoManager: { getRepos: () => ({}) } as unknown as RepoManager,
    repoSearch: repoSearch as RepoSearch | undefined,
    extensionState: { setLastActiveRepo: vi.fn() } as unknown as ExtensionState,
    avatarManager: {} as AvatarManager,
    repoFileWatcher: { start: vi.fn() } as unknown as RepoFileWatcher
  });
  const send = (msg: Record<string, unknown>) =>
    handlers.get(msg.command as RequestMessage["command"])?.(msg as RequestMessage);
  return { send };
}

const loadCommits = (repo: string) => ({ command: "loadCommits", repo, requestId: 1, hard: false });

beforeEach(() => {
  readers.created.length = 0;
  readers.error = null;
  branches.error = null;
});

describe("the engine trust gate", () => {
  it("offers the engine only a repository Git confirmed", async () => {
    const { send } = register({
      isVerified: (repo) => repo === "/confirmed",
      forgetVerification: vi.fn()
    });

    await send(loadCommits("/confirmed"));
    await send(loadCommits("/rejected"));
    await send({ command: "commitDetails", repo: "/rejected", commitHash: "abc" });
    await send({ command: "loadRepoInfo", repo: "/rejected", requestId: 2, showStashes: false });

    expect(readers.created.map((deps) => deps.unverified)).toEqual([false, true, true, true]);
  });

  it("treats every repository as unconfirmed when there is no discovery to ask", async () => {
    const { send } = register();
    await send(loadCommits("/repo"));
    expect(readers.created[0]?.unverified).toBe(true);
  });

  it("withdraws the confirmation the moment a graph read fails", async () => {
    const forgetVerification = vi.fn();
    const { send } = register({ isVerified: () => true, forgetVerification });

    await send(loadCommits("/repo"));
    expect(forgetVerification).not.toHaveBeenCalled();

    // Git words its refusal in the user's language, so the failure counts,
    // not its English text.
    readers.error = {
      message: "fatal: zweifelhafte Eigentümerschaft im Repository unter '/repo' erkannt",
      stderr: null
    };
    await send(loadCommits("/translated"));
    expect(forgetVerification).toHaveBeenLastCalledWith("/translated");

    forgetVerification.mockClear();
    readers.error = OWNERSHIP;
    await send(loadCommits("/repo"));
    await send({ command: "loadRepoInfo", repo: "/other", requestId: 2, showStashes: false });
    expect(forgetVerification.mock.calls).toEqual([["/repo"], ["/other"]]);

    send({ command: "selectRepo", repo: "/selected" });
    branches.error = OWNERSHIP;
    await send({ command: "loadBranches", requestId: 3, hard: false, showRemoteBranches: true });
    expect(forgetVerification).toHaveBeenLastCalledWith("/selected");
  });

  it("hands a graph error's recheck to discovery", async () => {
    const searchWorkspaceForRepos = vi.fn(async () => {});
    const { send } = register({
      isVerified: () => true,
      forgetVerification: vi.fn(),
      searchWorkspaceForRepos
    });
    await send({ command: "loadRepos", check: true });
    expect(searchWorkspaceForRepos).toHaveBeenCalledTimes(1);
  });
});
