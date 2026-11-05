import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitRepoInfo, GitWorktree } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

// Its own file on purpose: the render drives a full page load, and a second
// imported copy of the webview in the same file would answer the same
// messages against a detached table.

const REPO = "/workspace/worktree-head-repo";
const HEAD = "a".repeat(40);
const DETACHED = "b".repeat(40);

function worktree(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: REPO,
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
    showTagRemotes: true,
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

describe("detached worktree HEAD row marker", () => {
  it("marks the commit another worktree's detached HEAD sits on", async () => {
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
    const sidePath = `${REPO}-side`;
    receive({
      command: "loadBranches",
      requestId: latest(vscodeMock.sentMessages, "loadBranches").requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null,
      worktrees: [
        worktree({ path: REPO, branch: "main", isMain: true, isCurrent: true }),
        worktree({ path: sidePath, branch: null, detached: true, head: DETACHED })
      ],
      upstreams: { main: null }
    });
    const node = (hash: string, parents: string[], message: string) => ({
      hash,
      parentHashes: parents,
      author: "Ada",
      email: "ada@x.com",
      date: 1700000000,
      message,
      refs: []
    });
    receive({
      command: "loadCommits",
      requestId: latest(vscodeMock.sentMessages, "loadCommits").requestId,
      commits: [node(DETACHED, [HEAD], "detached work"), node(HEAD, [""], "base")],
      head: HEAD,
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    const markers = document.querySelectorAll<HTMLElement>(".worktreeHeadRef");
    expect(markers).toHaveLength(1);
    expect(markers[0]?.textContent).toContain("HEAD of worktree worktree-head-repo-side");
    expect(markers[0]?.title).toBe(sidePath);
    const markedRow = markers[0]?.closest("tr");
    expect(markedRow?.dataset.hash).toBe(DETACHED);
    // The marker is not a ref: no branch menu or checkout attaches to it.
    expect(markers[0]?.classList.contains("gitRef")).toBe(false);
  });
});
