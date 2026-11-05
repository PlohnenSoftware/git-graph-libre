import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitCommitNode, GitRepoInfo, GitWorktree } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

// Its own file on purpose: the render drives a full page load, and a second
// imported copy of the webview in the same file would answer the same
// messages against a detached table.

const REPO = "/workspace/worktree-badge-repo";
const HEAD = "a".repeat(40);
const FEAT_HEAD = "b".repeat(40);
const PLAIN_HEAD = "c".repeat(40);
const LOCKED_PATH = `${REPO}/../wt feat é`;
const GONE_PATH = `${REPO}/../wt-gone`;

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

function node(
  hash: string,
  parents: string[],
  message: string,
  branch: string
): GitCommitNode {
  return {
    hash,
    parentHashes: parents,
    author: "Ada",
    email: "ada@x.com",
    date: 1700000000,
    message,
    refs: [{ hash, name: branch, type: "head" }]
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("worktree segment on a branch badge (W11)", () => {
  it("marks only branches checked out elsewhere, with folder, path and state on hover", async () => {
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
    receive({
      command: "loadBranches",
      requestId: latest(vscodeMock.sentMessages, "loadBranches").requestId,
      branches: ["main", "feat", "plain"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null,
      worktrees: [
        worktree({ path: REPO, branch: "main", isMain: true, isCurrent: true }),
        worktree({
          path: LOCKED_PATH,
          branch: "feat",
          head: FEAT_HEAD,
          locked: { reason: "on a USB stick" }
        }),
        worktree({
          path: GONE_PATH,
          branch: "feat",
          head: FEAT_HEAD,
          prunable: { reason: "gitdir file points to non-existent location" }
        })
      ],
      upstreams: { main: null, feat: null, plain: null }
    });
    receive({
      command: "loadCommits",
      requestId: latest(vscodeMock.sentMessages, "loadCommits").requestId,
      commits: [
        node(FEAT_HEAD, [PLAIN_HEAD], "feature work", "feat"),
        node(PLAIN_HEAD, [HEAD], "plain work", "plain"),
        node(HEAD, [""], "base", "main")
      ],
      head: HEAD,
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    // One segment for the branch, however many worktrees hold it.
    const badges = document.querySelectorAll<HTMLElement>(".gitRefWorktreeBadge");
    expect(badges).toHaveLength(1);
    expect(badges[0]?.querySelector("svg.octicon-file-directory")).not.toBeNull();

    const featRef = badges[0]?.closest<HTMLElement>(".gitRef.head");
    expect(featRef?.dataset.name).toBe("feat");
    expect(featRef?.classList.contains("inWorktree")).toBe(true);
    expect(featRef?.title).toContain(
      `feat — Checked out in worktree wt feat é (${LOCKED_PATH}), locked: on a USB stick`
    );
    expect(featRef?.title).toContain(
      `Checked out in worktree wt-gone (${GONE_PATH}), missing (moved or deleted)`
    );

    // The current worktree's branch and an unheld branch keep today's badge.
    for (const name of ["main", "plain"]) {
      const ref = Array.from(document.querySelectorAll<HTMLElement>(".gitRef.head")).find(
        (elem) => elem.dataset.name === name
      );
      expect(ref?.querySelector(".gitRefWorktreeBadge")).toBeNull();
      expect(ref?.classList.contains("inWorktree")).toBe(false);
      expect(ref?.title).toBe(name);
    }

    // The context-menu header says the same as the tooltip.
    featRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const header = document.querySelector("#contextMenu .contextMenuHeader")?.textContent ?? "";
    expect(header).toContain("Checked out in another worktree");
    expect(header).toContain(`Checked out in worktree wt feat é (${LOCKED_PATH})`);
    expect(header).toContain("locked: on a USB stick");
    expect(header).toContain(`Checked out in worktree wt-gone (${GONE_PATH})`);
    expect(header).toContain("missing (moved or deleted)");
  });
});
