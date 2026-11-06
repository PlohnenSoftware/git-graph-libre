import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitRepoInfo, GitWorktree } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/branch-worktrees-repo";
const HEAD = "a".repeat(40);

type LoadBranchesRequest = Extract<GGL.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GGL.RequestMessage, { command: "loadCommits" }>;

function worktree(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: "/workspace/repo",
    head: HEAD,
    branch: "main",
    detached: false,
    bare: false,
    isMain: false,
    isCurrent: false,
    locked: null,
    prunable: null,
    ...overrides
  };
}

function makeViewState(): GGL.GitGraphViewState {
  return {
    autoCenterCommitDetailsView: false,
    commitDetailsCompactFolders: false,
    commitDetailsFileViewMode: "tree",
    uncommittedFileViewMode: "tree",
    contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
    dateFormat: "Date & Time",
    fetchAvatars: false,
    showSignatureColumn: false,
    graphColors: ["oklch(65% 0.16 250)"],
    customBranchGlobPatterns: [],
    graphFontSize: 13,
    graphRowHeight: 24,
    graphStyle: "rounded",
    revealHighlightColor: "oklch(90% 0.25 150 / 0.42)",
    includeReflog: false,
    includeUnreachableCommits: false,
    initialLoadCommits: 300,
    lastActiveRepo: null,
    loadMoreCommits: 75,
    muteCommitsNotAncestorsOfHead: false,
    muteMergeCommits: false,
    boldCheckedOutCommit: false,
    fetchTagsByDefault: false,
    showTagRemotes: "all",
    mergeNoFastForward: true,
    pullBranchNoFastForward: false,
    createBranchCheckout: true,
    onlyFollowFirstParent: false,
    repos: { [REPO]: { columnWidths: null } },
    showCurrentBranchByDefault: false,
    showRemoteBranches: true,
    showStashes: true,
    showTags: true,
    shortHashLength: 8,
    language: "en",
    languages: [{ id: "en", label: "English" }]
  };
}

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: HEAD,
  authors: [],
  tags: [],
  remotes: [],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  }
};

function latest<T extends GGL.RequestMessage["command"]>(
  messages: GGL.RequestMessage[],
  command: T
): Extract<GGL.RequestMessage, { command: T }> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.command === command) return msg as Extract<GGL.RequestMessage, { command: T }>;
  }
  throw new Error(`Missing ${command} request`);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("branchWorktreeMap", () => {
  it("leaves out the current worktree, and detached and bare worktrees", async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    createVscodeMock();
    setupHtml(makeViewState());
    const { branchWorktreeMap } = await import("@/webview/main");

    const map = branchWorktreeMap([
      worktree({ path: "/workspace/repo", branch: "main", isMain: true, isCurrent: true }),
      worktree({ path: "/workspace/feat", branch: "feat" }),
      worktree({ path: "/workspace/detached", branch: null, detached: true }),
      worktree({ path: "/workspace/bare", branch: null, bare: true })
    ]);

    expect([...map.entries()]).toEqual([["feat", ["/workspace/feat"]]]);
  });

  it("lists every other worktree of a branch checked out twice", async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    createVscodeMock();
    setupHtml(makeViewState());
    const { branchWorktreeMap } = await import("@/webview/main");

    const map = branchWorktreeMap([
      worktree({ path: "/workspace/repo", branch: "other", isMain: true, isCurrent: true }),
      worktree({ path: "/workspace/twin-a", branch: "twin" }),
      worktree({ path: "/workspace/twin-b", branch: "twin" })
    ]);

    expect(map.get("twin")).toEqual(["/workspace/twin-a", "/workspace/twin-b"]);
    expect(map.has("other")).toBe(false);
  });

  it("is empty for a repository with only its current worktree", async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    createVscodeMock();
    setupHtml(makeViewState());
    const { branchWorktreeMap } = await import("@/webview/main");

    expect(branchWorktreeMap([worktree({ isMain: true, isCurrent: true })]).size).toBe(0);
  });
});

describe("loadBranches response with worktrees", () => {
  it("is accepted and the graph still goes on to load its commits", async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const vscodeMock = createVscodeMock();
    setupHtml(makeViewState());
    await import("@/webview/main");

    receive({
      command: "loadRepoInfo",
      requestId: latest(vscodeMock.sentMessages, "loadRepoInfo").requestId,
      repoInfo,
      error: null
    });
    const branchesRequest: LoadBranchesRequest = latest(vscodeMock.sentMessages, "loadBranches");
    receive({
      command: "loadBranches",
      requestId: branchesRequest.requestId,
      branches: ["main", "feat"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null,
      worktrees: [
        worktree({ path: REPO, branch: "main", isMain: true, isCurrent: true }),
        worktree({ path: `${REPO}-feat`, branch: "feat" })
      ],
      upstreams: { main: "origin/main", feat: null }
    });

    const commitsRequest: LoadCommitsRequest = latest(vscodeMock.sentMessages, "loadCommits");
    expect(commitsRequest.repo).toBe(REPO);
  });
});

const DETACHED = "b".repeat(40);

describe("detachedWorktreeHeadMap and worktreeFolderName", () => {
  it("maps only other worktrees' detached HEADs, all of them per commit", async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    createVscodeMock();
    setupHtml(makeViewState());
    const { detachedWorktreeHeadMap } = await import("@/webview/main");

    const map = detachedWorktreeHeadMap([
      worktree({ path: "/workspace/repo", branch: "main", isMain: true, isCurrent: true }),
      worktree({ path: "/workspace/feat", branch: "feat", head: HEAD }),
      worktree({ path: "/workspace/side", branch: null, detached: true, head: DETACHED }),
      worktree({ path: "/workspace/twin", branch: null, detached: true, head: DETACHED }),
      worktree({
        path: "/workspace/here",
        branch: null,
        detached: true,
        head: DETACHED,
        isCurrent: true
      }),
      worktree({ path: "/workspace/bare", branch: null, bare: true, head: null })
    ]);

    expect([...map.keys()]).toEqual([DETACHED]);
    expect(map.get(DETACHED)?.map((holder) => holder.path)).toEqual([
      "/workspace/side",
      "/workspace/twin"
    ]);
  });

  it("takes a folder name from either separator, trailing ones included", async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    createVscodeMock();
    setupHtml(makeViewState());
    const { worktreeFolderName } = await import("@/webview/utils/git");

    expect(worktreeFolderName("/workspace/wt side")).toBe("wt side");
    expect(worktreeFolderName("C:\\repos\\wt ünï")).toBe("wt ünï");
    expect(worktreeFolderName("/workspace/wt/")).toBe("wt");
    expect(worktreeFolderName("/")).toBe("/");
  });
});

describe("otherWorktreesHoldingBranch and describeWorktreeCheckout (W11)", () => {
  const strings = {
    checkedOutInWorktree: "Checked out in worktree {0} ({1})",
    worktreeLocked: "locked: {0}",
    worktreeLockedNoReason: "locked",
    worktreeMissing: "missing (moved or deleted)"
  };

  async function loadHelpers() {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    createVscodeMock();
    setupHtml(makeViewState());
    return import("@/webview/main");
  }

  it("returns every other worktree holding the branch, never the current one", async () => {
    const { otherWorktreesHoldingBranch } = await loadHelpers();

    const holders = otherWorktreesHoldingBranch(
      [
        worktree({ path: "/workspace/repo", branch: "feat", isMain: true, isCurrent: true }),
        worktree({ path: "/workspace/feat a", branch: "feat" }),
        worktree({ path: "/workspace/feat-b", branch: "feat" }),
        worktree({ path: "/workspace/other", branch: "other" }),
        worktree({ path: "/workspace/detached", branch: null, detached: true })
      ],
      "feat"
    );

    expect(holders.map((holder) => holder.path)).toEqual([
      "/workspace/feat a",
      "/workspace/feat-b"
    ]);
    expect(otherWorktreesHoldingBranch([], "feat")).toEqual([]);
  });

  it("names the folder and the full path of a plain checkout", async () => {
    const { describeWorktreeCheckout } = await loadHelpers();

    expect(
      describeWorktreeCheckout(worktree({ path: "/workspace/feat a", branch: "feat" }), strings)
    ).toBe("Checked out in worktree feat a (/workspace/feat a)");
  });

  it("adds the lock reason, or a bare locked when Git gave none", async () => {
    const { describeWorktreeCheckout } = await loadHelpers();

    expect(
      describeWorktreeCheckout(
        worktree({
          path: "/workspace/feat",
          branch: "feat",
          locked: { reason: "on a USB stick" }
        }),
        strings
      )
    ).toBe("Checked out in worktree feat (/workspace/feat), locked: on a USB stick");
    expect(
      describeWorktreeCheckout(
        worktree({ path: "/workspace/feat", branch: "feat", locked: { reason: "" } }),
        strings
      )
    ).toBe("Checked out in worktree feat (/workspace/feat), locked");
  });

  it("calls a prunable worktree missing", async () => {
    const { describeWorktreeCheckout } = await loadHelpers();

    expect(
      describeWorktreeCheckout(
        worktree({
          path: "/workspace/gone",
          branch: "feat",
          prunable: { reason: "gitdir file points to non-existent location" }
        }),
        strings
      )
    ).toBe("Checked out in worktree gone (/workspace/gone), missing (moved or deleted)");
  });

  it("keeps replacement patterns in paths and reasons literal", async () => {
    const { describeWorktreeCheckout } = await loadHelpers();

    expect(
      describeWorktreeCheckout(
        worktree({
          path: "/workspace/wt $& é",
          branch: "feat",
          locked: { reason: "kept $` safe" }
        }),
        strings
      )
    ).toBe("Checked out in worktree wt $& é (/workspace/wt $& é), locked: kept $` safe");
  });
});
