import { beforeAll, describe, expect, it, vi } from "vitest";

import type { GitCommitDetails, GitCommitNode } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/keyboard-repo";
type LoadBranchesRequest = Extract<GGL.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GGL.RequestMessage, { command: "loadCommits" }>;
type CommitDetailsRequest = Extract<GGL.RequestMessage, { command: "commitDetails" }>;

const viewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  showSignatureColumn: false,
  graphColors: ["oklch(65% 0.16 250)"],
  customBranchGlobPatterns: [],
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
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
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 8
};

const loadedCommits: GitCommitNode[] = [
  {
    hash: "*",
    parentHashes: ["headhash1"],
    author: "*",
    email: "",
    date: 1700000300,
    message: "Uncommitted changes (1)",
    refs: []
  },
  {
    hash: "headhash1",
    parentHashes: ["olderhash2"],
    author: "Alice",
    email: "alice@example.com",
    date: 1700000200,
    message: "Newest commit",
    refs: [{ hash: "headhash1", name: "main", type: "head" }]
  },
  {
    hash: "olderhash2",
    parentHashes: [],
    author: "Bob",
    email: "bob@example.com",
    date: 1700000100,
    message: "Older commit",
    refs: []
  }
];

function commitDetailsFor(hash: string, parents: string[]): GitCommitDetails {
  return {
    hash,
    parents,
    author: "Alice",
    email: "alice@example.com",
    authorDate: 1700000200,
    committer: "Alice",
    committerEmail: "alice@example.com",
    committerDate: 1700000200,
    body: `Body of ${hash}`,
    fileChanges: [
      { oldFilePath: "src/a.ts", newFilePath: "src/a.ts", type: "M", additions: 1, deletions: 0 }
    ]
  };
}

const scrollIntoViewMock = vi.fn();

describe("webview keyboard navigation", () => {
  let vscodeMock: ReturnType<typeof createVscodeMock>;

  function latestRequest<T extends GGL.RequestMessage["command"]>(
    command: T
  ): Extract<GGL.RequestMessage, { command: T }> {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === command) return msg as Extract<GGL.RequestMessage, { command: T }>;
    }
    throw new Error(`Missing ${command} request`);
  }

  function countRequests(command: GGL.RequestMessage["command"]) {
    return vscodeMock.sentMessages.filter((msg) => msg.command === command).length;
  }

  function pressKey(key: string, init: KeyboardEventInit = {}, target: EventTarget = document) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  function respondToLoadRequests() {
    const branchesRequest: LoadBranchesRequest = latestRequest("loadBranches");
    receive({
      command: "loadBranches",
      requestId: branchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const commitsRequest: LoadCommitsRequest = latestRequest("loadCommits");
    receive({
      command: "loadCommits",
      requestId: commitsRequest.requestId,
      commits: loadedCommits,
      head: "headhash1",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });
  }

  function commitRow(hash: string) {
    return document.querySelector<HTMLTableRowElement>(`tr.commit[data-hash="${hash}"]`);
  }

  function openCommitDetails(hash: string, parents: string[]) {
    commitRow(hash)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const request: CommitDetailsRequest = latestRequest("commitDetails");
    expect(request.commitHash).toBe(hash);
    receive({
      command: "commitDetails",
      commitDetails: commitDetailsFor(hash, parents),
      error: null
    });
    // The details row inherits the source row color so hue-tinted styles resolve
    expect(document.getElementById("commitDetails")?.dataset.color).toBe(
      commitRow(hash)?.dataset.color
    );
  }

  beforeAll(async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // jsdom implements neither of these; providing them covers the smooth
    // reveal path and the ResizeObserver branch of the top bar tracking.
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    vscodeMock = createVscodeMock();
    setupHtml(viewState);
    await import("@/webview/main");
    respondToLoadRequests();
  });

  it("refreshes the graph with Ctrl+R and ignores the shortcut in inputs and dialogs", () => {
    const loadBranchesBefore = countRequests("loadBranches");

    const refreshEvent = pressKey("r", { ctrlKey: true });

    expect(refreshEvent.defaultPrevented).toBe(true);
    expect(countRequests("loadBranches")).toBe(loadBranchesBefore + 1);
    respondToLoadRequests();

    const findInput = document.getElementById("findInput");
    const inputEvent = pressKey("r", { ctrlKey: true }, findInput ?? document);
    expect(inputEvent.defaultPrevented).toBe(false);

    document.getElementById("dialog")?.classList.add("active");
    const dialogEvent = pressKey("r", { ctrlKey: true });
    expect(dialogEvent.defaultPrevented).toBe(false);
    document.getElementById("dialog")?.classList.remove("active");

    expect(countRequests("loadBranches")).toBe(loadBranchesBefore + 1);
  });

  it("jumps to the HEAD commit with Ctrl+H", () => {
    const headRow = commitRow("headhash1");
    expect(headRow).not.toBeNull();
    scrollIntoViewMock.mockClear();

    const jumpEvent = pressKey("h", { ctrlKey: true });

    expect(jumpEvent.defaultPrevented).toBe(true);
    expect(headRow?.classList.contains("blinking")).toBe(true);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });

    headRow?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(headRow?.classList.contains("blinking")).toBe(false);
  });

  it("navigates open commit details with plain arrow keys", () => {
    openCommitDetails("headhash1", ["olderhash2"]);
    expect(document.getElementById("commitDetails")).not.toBeNull();

    const downEvent = pressKey("ArrowDown");
    expect(downEvent.defaultPrevented).toBe(true);
    expect(latestRequest("commitDetails").commitHash).toBe("olderhash2");
    receive({
      command: "commitDetails",
      commitDetails: commitDetailsFor("olderhash2", []),
      error: null
    });
    expect(commitRow("olderhash2")?.getAttribute("aria-selected")).toBe("true");
    expect(commitRow("headhash1")?.getAttribute("aria-selected")).toBe("false");

    const detailsRequestsAtOldest = countRequests("commitDetails");
    pressKey("ArrowDown");
    expect(countRequests("commitDetails")).toBe(detailsRequestsAtOldest);

    pressKey("ArrowUp");
    expect(latestRequest("commitDetails").commitHash).toBe("headhash1");
    receive({
      command: "commitDetails",
      commitDetails: commitDetailsFor("headhash1", ["olderhash2"]),
      error: null
    });
    expect(commitRow("headhash1")?.getAttribute("aria-selected")).toBe("true");

    const detailsRequestsAtNewest = countRequests("commitDetails");
    pressKey("ArrowUp");
    expect(countRequests("commitDetails")).toBe(detailsRequestsAtNewest);
    expect(commitRow("headhash1")?.getAttribute("aria-selected")).toBe("true");
  });

  it("closes the find widget before commit details when pressing Escape", () => {
    expect(document.getElementById("commitDetails")).not.toBeNull();
    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("findControl")?.hidden).toBe(false);

    document.getElementById("contextMenu")?.classList.add("active");
    pressKey("Escape");
    expect(document.getElementById("findControl")?.hidden).toBe(false);
    document.getElementById("contextMenu")?.classList.remove("active");

    pressKey("Escape");
    expect(document.getElementById("findControl")?.hidden).toBe(true);
    expect(document.getElementById("commitDetails")).not.toBeNull();

    pressKey("Escape");
    expect(document.getElementById("commitDetails")).toBeNull();
    expect(commitRow("headhash1")?.getAttribute("aria-selected")).toBe("false");
  });

  it("keeps arrow keys inert while no commit details are open", () => {
    expect(document.getElementById("commitDetails")).toBeNull();
    const detailsRequestsBefore = countRequests("commitDetails");

    const downEvent = pressKey("ArrowDown");

    expect(downEvent.defaultPrevented).toBe(false);
    expect(countRequests("commitDetails")).toBe(detailsRequestsBefore);
  });

  it("clears filters and reloads to locate a HEAD that is not rendered", () => {
    // Reload with a HEAD hash that is not among the rendered rows
    pressKey("r", { ctrlKey: true });
    const branchesRequest: LoadBranchesRequest = latestRequest("loadBranches");
    receive({
      command: "loadBranches",
      requestId: branchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const commitsRequest: LoadCommitsRequest = latestRequest("loadCommits");
    receive({
      command: "loadCommits",
      requestId: commitsRequest.requestId,
      commits: loadedCommits,
      head: "hiddenhead9",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });
    expect(commitRow("hiddenhead9")).toBeNull();

    const loadCommitsBefore = countRequests("loadCommits");
    document.getElementById("blinkHeadBtn")?.dispatchEvent(new MouseEvent("click"));

    expect(countRequests("loadCommits")).toBe(loadCommitsBefore + 1);
    expect(document.getElementById("loadingHeader")).not.toBeNull();
    const reloadRequest: LoadCommitsRequest = latestRequest("loadCommits");
    expect(reloadRequest.branchName).toBe("");
    expect(reloadRequest.branches).toBeNull();
    expect(reloadRequest.authors).toBeNull();
    expect(reloadRequest.tags).toBeNull();

    // Once the reloaded commits contain the HEAD row it is revealed and blinks
    receive({
      command: "loadCommits",
      requestId: reloadRequest.requestId,
      commits: [
        ...loadedCommits,
        {
          hash: "hiddenhead9",
          parentHashes: [],
          author: "Alice",
          email: "alice@example.com",
          date: 1700000000,
          message: "Filtered-out HEAD commit",
          refs: []
        }
      ],
      head: "hiddenhead9",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });
    expect(commitRow("hiddenhead9")?.classList.contains("blinking")).toBe(true);
    commitRow("hiddenhead9")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(commitRow("hiddenhead9")?.classList.contains("blinking")).toBe(false);
  });
});
