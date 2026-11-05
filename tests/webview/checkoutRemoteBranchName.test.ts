import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/checkout-remote-branch-name";

const viewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
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
  fetchTagsByDefault: true,
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

function repoInfoWithRemotes(remoteNames: readonly string[]): GitRepoInfo {
  return {
    isRepo: true,
    head: "main",
    headCommit: "abc123",
    authors: ["Alice"],
    tags: [],
    remotes: remoteNames.map((name) => ({
      name,
      fetchUrls: [`https://example.test/${name}.git`],
      pushUrls: [`https://example.test/${name}.git`]
    })),
    stashes: [],
    stashCount: 0,
    config: {
      userName: { local: null, global: null },
      userEmail: { local: null, global: null }
    }
  };
}

// The remote ref sits on its own commit, away from `main`, so it renders as a
// standalone `.gitRef.remote` that the context menu can open on.
function commitsWithRemoteRef(refName: string): GitCommitNode[] {
  return [
    {
      hash: "abc123",
      parentHashes: ["def456"],
      author: "Alice",
      email: "alice@example.com",
      date: 1_700_000_000,
      message: "Head commit",
      refs: [{ hash: "abc123", name: "main", type: "head" }]
    },
    {
      hash: "def456",
      parentHashes: [],
      author: "Bob",
      email: "bob@example.com",
      date: 1_699_000_000,
      message: "Remote commit",
      refs: [{ hash: "def456", name: refName, type: "remote" }]
    }
  ];
}

function latestRequest<T extends GGL.RequestMessage["command"]>(
  messages: GGL.RequestMessage[],
  command: T
): Extract<GGL.RequestMessage, { command: T }> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.command === command) return msg as Extract<GGL.RequestMessage, { command: T }>;
  }
  throw new Error(`Missing ${command} request`);
}

/**
 * Boots the webview with the given remotes and a remote ref, opens the remote
 * branch's Checkout Branch dialog, and returns the name it pre-fills.
 */
async function prefilledCheckoutName(remoteNames: readonly string[], refName: string) {
  vi.resetModules();
  const vscodeMock = createVscodeMock();
  setupHtml(viewState);
  await import("@/webview/main");

  receive({
    command: "loadRepoInfo",
    requestId: latestRequest(vscodeMock.sentMessages, "loadRepoInfo").requestId,
    repoInfo: repoInfoWithRemotes(remoteNames),
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: latestRequest(vscodeMock.sentMessages, "loadBranches").requestId,
    branches: ["main"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null,
    worktrees: [],
    upstreams: {}
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits: commitsWithRemoteRef(refName),
    head: "abc123",
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });

  const remoteRef = Array.from(document.querySelectorAll<HTMLElement>(".gitRef.remote")).find(
    (elem) => elem.textContent?.includes(refName)
  );
  expect(remoteRef).not.toBeUndefined();
  remoteRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

  const checkout = Array.from(
    document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
  ).find((item) => item.textContent === "Checkout Branch…");
  expect(checkout).not.toBeUndefined();
  checkout?.click();

  return (document.getElementById("dialogInput0") as HTMLInputElement | null)?.value;
}

describe("checkout remote branch suggested name", () => {
  it("suggests the full branch name, slashes included", async () => {
    expect(await prefilledCheckoutName(["origin"], "origin/feat/admin-gui")).toBe("feat/admin-gui");
  });

  it("splits at the longest known remote name when the remote itself has a slash", async () => {
    expect(await prefilledCheckoutName(["origin", "my/fork"], "my/fork/topic")).toBe("topic");
  });

  it("falls back to the full ref name when the ref matches no known remote", async () => {
    expect(await prefilledCheckoutName(["origin"], "upstream/topic")).toBe("upstream/topic");
  });

  it("still suggests a slash-free branch name such as main", async () => {
    expect(await prefilledCheckoutName(["origin"], "origin/main")).toBe("main");
  });
});
