import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GG from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/context-menu-visibility";

const defaultViewState: GG.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  graphColors: ["oklch(65% 0.16 250)"],
  customBranchGlobPatterns: [],
  graphFontSize: 13,
  graphRowHeight: 24,
  graphStyle: "rounded",
  includeReflog: false,
  initialLoadCommits: 300,
  lastActiveRepo: null,
  loadMoreCommits: 75,
  muteCommitsNotAncestorsOfHead: false,
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 8
};

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
  authors: ["Alice"],
  tags: ["v1.0.0"],
  remotes: [],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  }
};

const commits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: [],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: "Tagged commit",
    refs: [
      { hash: "abc123", name: "main", type: "head" },
      { hash: "abc123", name: "v1.0.0", type: "tag" }
    ]
  }
];

function latestRequest<T extends GG.RequestMessage["command"]>(
  messages: GG.RequestMessage[],
  command: T
): Extract<GG.RequestMessage, { command: T }> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.command === command) return msg as Extract<GG.RequestMessage, { command: T }>;
  }
  throw new Error(`Missing ${command} request`);
}

async function bootWebview(viewState: GG.GitGraphViewState) {
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
    branches: ["main"],
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
}

function withVisibility(
  visibility: Partial<GG.ContextMenuActionsVisibility>
): GG.GitGraphViewState {
  return {
    ...defaultViewState,
    contextMenuActionsVisibility: {
      ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
      ...visibility
    }
  };
}

function contextMenuItems() {
  return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).map(
    (item) => item.textContent ?? ""
  );
}

describe("context menu visibility rendering", () => {
  it("hides disabled tag actions and removes redundant dividers", async () => {
    await bootWebview(
      withVisibility({
        tag: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.tag,
          viewDetails: false,
          delete: false,
          push: false,
          compareWithHead: false,
          copyName: false
        }
      })
    );

    document
      .querySelector<HTMLElement>(".gitRef.tag")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    const dividers = document.querySelectorAll("#contextMenu .contextMenuDivider");

    expect(contextMenuItems()).toEqual(["Create Archive"]);
    expect(dividers).toHaveLength(0);
  });

  it("hides all disabled commit actions", async () => {
    await bootWebview(
      withVisibility({
        commit: Object.fromEntries(
          Object.keys(DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commit).map((key) => [key, false])
        ) as GG.ContextMenuActionsVisibility["commit"]
      })
    );

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    expect(contextMenuItems()).toEqual([]);
  });

  it("hides all disabled local branch actions", async () => {
    await bootWebview(
      withVisibility({
        branch: Object.fromEntries(
          Object.keys(DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.branch).map((key) => [key, false])
        ) as GG.ContextMenuActionsVisibility["branch"]
      })
    );

    document
      .querySelector<HTMLElement>(".gitRef.head")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    expect(contextMenuItems()).toEqual([]);
  });
});
