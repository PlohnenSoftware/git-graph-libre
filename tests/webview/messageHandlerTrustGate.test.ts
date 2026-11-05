import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvatarManager } from "@/avatarManager";
import type { RepoReaderDeps } from "@/backend/engine/index";
import type { GitClient } from "@/backend/gitClient";
import type { WorktreeReader } from "@/backend/queries/loadBranches";
import { loadWorktrees } from "@/backend/queries/worktrees";
import { setOperationLog } from "@/backend/utils/operationLog";
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

// The backend setting is read live by the handler, so the test can flip it
// between calls on the same reader.
const backendSetting = vi.hoisted(() => ({ value: "auto" as "auto" | "git-cli" }));
const branches = vi.hoisted(() => ({
  error: null as unknown,
  input: null as { readWorktrees?: WorktreeReader } | null
}));
vi.mock("@/backend/queries/loadBranches", () => ({
  loadBranches: async (_git: unknown, input: { readWorktrees?: WorktreeReader }) => {
    branches.input = input;
    return {
      branches: [],
      head: null,
      hard: false,
      isRepo: true,
      error: branches.error
    };
  }
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
      backend: () => backendSetting.value,
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
  branches.input = null;
  backendSetting.value = "auto";
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

describe("the worktree reader the handler gives loadBranches", () => {
  let savedGlobal: string | undefined;
  let root: string;
  let confirmed: string;
  let unconfirmed: string;

  beforeAll(() => {
    savedGlobal = process.env.GIT_CONFIG_GLOBAL;
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-handler-wt-"));
    const emptyConfig = path.join(root, "empty.gitconfig");
    fs.writeFileSync(emptyConfig, "");
    process.env.GIT_CONFIG_GLOBAL = emptyConfig;

    confirmed = makeRepo();
    git(["branch", "feat"], confirmed);
    git(["worktree", "add", path.join(root, "linked wt"), "feat"], confirmed);
    unconfirmed = makeRepo();
  });

  afterAll(() => {
    if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
    for (const dir of [confirmed, unconfirmed, root]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads the backend setting live, and offers the engine only a confirmed repository", async () => {
    const { send } = register({
      isVerified: (repo) => repo === confirmed,
      forgetVerification: vi.fn()
    });
    await send({ command: "selectRepo", repo: confirmed });
    await send({ command: "loadBranches", requestId: 4, hard: false, showRemoteBranches: false });
    const read = branches.input?.readWorktrees;
    if (read === undefined) throw new Error("loadBranches received no worktree reader");

    const lines: string[] = [];
    const log = setOperationLog((line) => lines.push(line));
    try {
      // The git-cli preference answers from the CLI, for a confirmed repository too.
      backendSetting.value = "git-cli";
      const viaCli = await read(simpleGit(confirmed), confirmed);
      expect(viaCli.error).toBeNull();
      expect(viaCli.value.map((item) => item.branch)).toEqual(["main", "feat"]);
      expect(lines.some((line) => line.includes("listWorktrees backend=cli reason=setting"))).toBe(
        true
      );

      // The same reader after the setting flips: an unconfirmed repository stays on the CLI.
      backendSetting.value = "auto";
      const unverified = await read(simpleGit(unconfirmed), unconfirmed);
      expect(unverified.error).toBeNull();
      expect(unverified.value).toHaveLength(1);
      expect(
        lines.some((line) => line.includes("listWorktrees backend=cli reason=unverified"))
      ).toBe(true);
    } finally {
      log.dispose();
    }
  });

  it("serves a confirmed repository from the engine, as the CLI would list it", async () => {
    // Needs the built engine (`pnpm run engine:build`), as the W03 parity tests do.
    const { send } = register({
      isVerified: (repo) => repo === confirmed,
      forgetVerification: vi.fn()
    });
    await send({ command: "selectRepo", repo: confirmed });
    await send({ command: "loadBranches", requestId: 5, hard: false, showRemoteBranches: false });
    const read = branches.input?.readWorktrees;
    if (read === undefined) throw new Error("loadBranches received no worktree reader");

    const lines: string[] = [];
    const log = setOperationLog((line) => lines.push(line));
    try {
      backendSetting.value = "auto";
      const served = await read(simpleGit(confirmed), confirmed);
      const viaCli = await loadWorktrees(simpleGit(confirmed), confirmed);
      expect(lines).toContainEqual(
        expect.stringContaining("operation=listWorktrees backend=engine")
      );
      expect(served.error).toBeNull();
      expect(served.value).toEqual(viaCli.value);
    } finally {
      log.dispose();
    }
  });
});
