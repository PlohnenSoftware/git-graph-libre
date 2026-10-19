import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GitCommitDetails, GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/compare-selection";
const LABEL = "Compare Selected Commits";
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
  initialLoadCommits: 250,
  lastActiveRepo: null,
  loadMoreCommits: 750,
  muteCommitsNotAncestorsOfHead: false,
  muteMergeCommits: false,
  boldCheckedOutCommit: false,
  fetchTagsByDefault: true,
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

function commit(hash: string, parents: string[], date: number): GitCommitNode {
  return {
    hash,
    parentHashes: parents,
    author: "Alice",
    email: "alice@example.com",
    date,
    message: hash,
    refs: []
  };
}

// The selected rows are neither contiguous nor on the HEAD chain. Their
// timestamps deliberately disagree with graph order, which defines direction.
const commits = [
  commit("head123", ["middle123"], 3),
  commit("new123", ["root123"], 1),
  commit("middle123", ["root123"], 2),
  commit("old123", [], 4),
  commit("root123", [], 0)
];
const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "head123",
  authors: ["Alice"],
  tags: [],
  remotes: [],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  }
};

function latestRequest<T extends GGL.RequestMessage["command"]>(
  messages: GGL.RequestMessage[],
  command: T
): Extract<GGL.RequestMessage, { command: T }> {
  const message = messages.findLast((message) => message.command === command);
  if (message === undefined) throw new Error(`Missing ${command} request`);
  return message as Extract<GGL.RequestMessage, { command: T }>;
}

async function boot(loadedCommits = commits, state = viewState) {
  const vscode = createVscodeMock();
  setupHtml(state);
  await import("@/webview/main");
  receive({
    command: "loadRepoInfo",
    requestId: latestRequest(vscode.sentMessages, "loadRepoInfo").requestId,
    repoInfo,
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: latestRequest(vscode.sentMessages, "loadBranches").requestId,
    branches: ["main"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscode.sentMessages, "loadCommits").requestId,
    commits: loadedCommits,
    head: "head123",
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscode;
}

function row(hash: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`tr[data-hash="${hash}"]`);
  if (element === null) throw new Error(`Missing row ${hash}`);
  return element;
}

function select(hashes: string[], modifier: "ctrlKey" | "metaKey" = "ctrlKey") {
  for (const hash of hashes) {
    row(hash).dispatchEvent(new MouseEvent("click", { bubbles: true, [modifier]: true }));
  }
}

function openMenu(hash: string) {
  row(hash).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
}

function menuItem(label: string) {
  return Array.from(document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")).find(
    (item) => item.textContent === label
  );
}

beforeEach(() => vi.resetModules());

describe("selected commit comparison", () => {
  it.each([
    ["ctrlKey", ["new123", "old123"], "new123"],
    ["ctrlKey", ["old123", "new123"], "old123"],
    ["metaKey", ["new123", "old123"], "old123"],
    ["metaKey", ["old123", "new123"], "new123"]
  ] as const)(
    "compares in graph order with %s, selection %s, attaching to %s",
    async (modifier, selected, attachedHash) => {
      const vscode = await boot();
      select([...selected], modifier);
      openMenu(attachedHash);
      expect(menuItem(LABEL)).toBeDefined();
      menuItem(LABEL)?.click();
      expect(latestRequest(vscode.sentMessages, "commitComparison")).toEqual({
        command: "commitComparison",
        repo: REPO,
        commitHash: attachedHash,
        baseRef: "old123",
        compareRef: "new123"
      });
      expect(vscode.getState()?.expandedCommit).toMatchObject({
        hash: attachedHash,
        comparison: { baseRef: "old123", compareRef: "new123" }
      });

      const details: GitCommitDetails = {
        hash: attachedHash,
        parents: [],
        author: "Alice",
        email: "alice@example.com",
        authorDate: 1,
        committer: "Alice",
        committerEmail: "alice@example.com",
        committerDate: 1,
        body: "Comparison",
        fileChanges: [
          {
            oldFilePath: "file.txt",
            newFilePath: "file.txt",
            type: "M",
            additions: 1,
            deletions: 1
          }
        ]
      };
      receive({ command: "commitComparison", commitDetails: details, error: null });
      expect(row(attachedHash).classList.contains("commitDetailsOpen")).toBe(true);
      const file = document.querySelector<HTMLElement>(".gitFile");
      expect(file).not.toBeNull();
      file?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      menuItem("View File Diff")?.click();
      expect(latestRequest(vscode.sentMessages, "viewDiff")).toEqual({
        command: "viewDiff",
        repo: REPO,
        commitHash: attachedHash,
        oldRef: "old123",
        newRef: "new123",
        oldFilePath: "file.txt",
        newFilePath: "file.txt",
        type: "M"
      });
    }
  );

  it.each([["new123"], ["new123", "middle123", "old123"]])(
    "hides comparison for selection %s",
    async (...selected) => {
      await boot();
      select(selected);
      openMenu("new123");
      expect(menuItem(LABEL)).toBeUndefined();
    }
  );

  it("does not compare an uncommitted row with a selected commit", async () => {
    await boot([commit("*", ["head123"], 5), ...commits]);
    select(["*", "new123"]);
    openMenu("new123");
    expect(menuItem(LABEL)).toBeUndefined();
    select(["old123"]);
    openMenu("new123");
    expect(menuItem(LABEL)).toBeDefined();
    openMenu("*");
    expect(menuItem(LABEL)).toBeUndefined();
  });

  it("keeps compare-with-HEAD's request unchanged", async () => {
    const vscode = await boot();
    openMenu("old123");
    expect(menuItem("Compare with HEAD")).toBeDefined();
    menuItem("Compare with HEAD")?.click();
    expect(latestRequest(vscode.sentMessages, "commitComparison")).toEqual({
      command: "commitComparison",
      repo: REPO,
      commitHash: "old123",
      baseRef: "old123",
      compareRef: "HEAD"
    });
  });
});
