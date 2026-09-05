import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/remote-branch-context-menu";
const REMOTE_REF = "origin/feature/menu";

const defaultViewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
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
  mergeNoFastForward: true,
  pullBranchNoFastForward: false,
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

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
  authors: ["Alice"],
  tags: [],
  remotes: [
    {
      name: "origin",
      fetchUrls: ["https://example.test/repo.git"],
      pushUrls: ["https://example.test/repo.git"]
    }
  ],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  }
};

// The remote ref deliberately sits on a different commit from `main`, so it is
// rendered as a standalone `.gitRef.remote` rather than being folded into the
// checked-out branch's grouped badge.
const commits: GitCommitNode[] = [
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
    refs: [{ hash: "def456", name: REMOTE_REF, type: "remote" }]
  }
];

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

async function bootWebview(viewState: GGL.GitGraphViewState) {
  vi.resetModules();
  const vscodeMock = createVscodeMock();
  setupHtml(viewState);
  await import("@/webview/main");

  receive({
    command: "loadRepoInfo",
    requestId: latestRequest(vscodeMock.sentMessages, "loadRepoInfo").requestId,
    repoInfo,
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: latestRequest(vscodeMock.sentMessages, "loadBranches").requestId,
    branches: ["main", "feature/menu", `remotes/${REMOTE_REF}`],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits,
    head: "abc123",
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscodeMock;
}

function withRemoteBranchVisibility(
  overrides: Partial<GGL.ContextMenuActionsVisibility["remoteBranch"]>
): GGL.GitGraphViewState {
  return {
    ...defaultViewState,
    contextMenuActionsVisibility: {
      ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
      remoteBranch: { ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.remoteBranch, ...overrides }
    }
  };
}

function openRemoteRefContextMenu() {
  const remoteRef = Array.from(document.querySelectorAll<HTMLElement>(".gitRef.remote")).find(
    (elem) => elem.textContent?.includes(REMOTE_REF)
  );
  expect(remoteRef).not.toBeUndefined();
  remoteRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
}

function contextMenuItems() {
  return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).map(
    (item) => item.textContent ?? ""
  );
}

describe("remote branch context menu visibility", () => {
  it("offers Merge alongside the other remote branch actions by default", async () => {
    await bootWebview(defaultViewState);
    openRemoteRefContextMenu();

    expect(contextMenuItems()).toEqual([
      "Checkout Branch…",
      "Delete Remote Branch…",
      "Merge into current branch…",
      "Fetch into local branch…",
      "Pull Branch…",
      "Create Archive",
      "Compare with HEAD",
      "Copy Branch Name to Clipboard"
    ]);
  });

  // `isContextMenuActionVisible` treats an unknown action key as visible, so an
  // action that reads the wrong key still shows up under the defaults. Only
  // switching the key off proves `remoteBranch.merge` is the key actually read.
  it("hides only Merge when remoteBranch.merge is disabled", async () => {
    await bootWebview(withRemoteBranchVisibility({ merge: false }));
    openRemoteRefContextMenu();

    const items = contextMenuItems();
    expect(items).not.toContain("Merge into current branch…");
    expect(items).toContain("Delete Remote Branch…");
    expect(items).toContain("Fetch into local branch…");
    expect(items).toContain("Pull Branch…");
  });

  it("hides all disabled remote branch actions", async () => {
    await bootWebview(
      withRemoteBranchVisibility(
        Object.fromEntries(
          Object.keys(DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.remoteBranch).map((key) => [
            key,
            false
          ])
        ) as GGL.ContextMenuActionsVisibility["remoteBranch"]
      )
    );
    openRemoteRefContextMenu();

    expect(contextMenuItems()).toEqual([]);
    expect(document.querySelectorAll("#contextMenu .contextMenuDivider")).toHaveLength(0);
  });
});
