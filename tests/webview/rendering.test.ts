import { beforeAll, describe, expect, it, vi } from "vitest";

import type { GitCommitDetails, GitCommitNode, GitCommitSearchResult } from "@/backend/types";
import type * as GG from "@/types";
import {
  COMMIT_DETAILS_COLLAPSED_HEIGHT,
  COMMIT_DETAILS_DEFAULT_HEIGHT,
  COMMIT_DETAILS_KEYBOARD_RESIZE_STEP,
  COMMIT_DETAILS_MIN_HEIGHT
} from "@/webview/commitDetailsView";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/my-repo";
type LoadBranchesRequest = Extract<GG.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GG.RequestMessage, { command: "loadCommits" }>;
type SearchCommitsRequest = Extract<GG.RequestMessage, { command: "searchCommits" }>;

const defaultViewState: GG.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  graphColors: ["oklch(65% 0.16 250)"],
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  graphFontSize: 13,
  graphRowHeight: 24,
  graphStyle: "rounded",
  initialLoadCommits: 300,
  lastActiveRepo: null,
  loadMoreCommits: 75,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  shortHashLength: 4
};

const twoCommits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: ["def456"],
    author: "Alice",
    email: "alice@example.com",
    date: 1700000000,
    message: "Add feature",
    refs: [
      { hash: "abc123", name: "main", type: "head" },
      { hash: "abc123", name: "v1.0.0", type: "tag" }
    ]
  },
  {
    hash: "def456",
    parentHashes: [],
    author: "Bob",
    email: "bob@example.com",
    date: 1699000000,
    message: "Initial commit",
    refs: []
  }
];

const firstCommitDetails: GitCommitDetails = {
  hash: "abc123",
  parents: ["def456"],
  author: "Alice",
  email: "alice@example.com",
  date: 1700000000,
  committer: "Alice",
  body: "Detailed message",
  fileChanges: [
    {
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M",
      additions: 3,
      deletions: 1
    }
  ]
};

describe("webview rendering", () => {
  let vscodeMock: ReturnType<typeof createVscodeMock>;

  function latestLoadBranchesRequest(): LoadBranchesRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "loadBranches") return msg;
    }
    throw new Error("Missing loadBranches request");
  }

  function latestLoadCommitsRequest(): LoadCommitsRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "loadCommits") return msg;
    }
    throw new Error("Missing loadCommits request");
  }

  function latestSearchCommitsRequest(): SearchCommitsRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "searchCommits") return msg;
    }
    throw new Error("Missing searchCommits request");
  }

  function sentLoadCommitsCount() {
    return vscodeMock.sentMessages.filter((msg) => msg.command === "loadCommits").length;
  }

  function getFindInput() {
    const input = document.getElementById("findInput") as HTMLInputElement | null;
    if (input === null) throw new Error("Missing find input");
    return input;
  }

  function setFindQuery(query: string) {
    const input = getFindInput();
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function findRow(hash: string) {
    return document.querySelector<HTMLTableRowElement>(`tr.commit[data-hash="${hash}"]`);
  }

  function clearFind() {
    document
      .getElementById("findClearBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  beforeAll(async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vscodeMock = createVscodeMock();
    setupHtml(defaultViewState);
    await import("@/webview/main");
    const loadBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const loadCommitsRequest = latestLoadCommitsRequest();
    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("shows Load More Commits button when more commits are available", () => {
    expect(document.getElementById("loadMoreCommitsBtn")).not.toBeNull();
  });

  it("renders the graph controls as an accessible toolbar", () => {
    const controls = document.getElementById("controls");

    expect(controls?.tagName).toBe("HEADER");
    expect(controls?.getAttribute("role")).toBe("toolbar");
    expect(document.getElementById("refreshBtn")?.tagName).toBe("BUTTON");
    expect(document.getElementById("blinkHeadBtn")?.getAttribute("aria-label")).toBe("Locate HEAD");
  });

  it("renders the graph status strip as ready after loading commits", () => {
    const status = document.getElementById("statusStrip");

    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.dataset.state).toBe("ready");
    expect(status?.getAttribute("aria-busy")).toBe("false");
    expect(document.getElementById("statusText")?.textContent).toBe("Ready");
  });

  it("renders commit rows with keyboard focus and selection state", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    const olderRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="def456"]');

    expect(headRow?.getAttribute("tabindex")).toBe("0");
    expect(headRow?.getAttribute("aria-current")).toBe("true");
    expect(headRow?.getAttribute("aria-selected")).toBe("false");
    expect(olderRow?.getAttribute("tabindex")).toBe("0");
    expect(olderRow?.hasAttribute("aria-current")).toBe(false);
  });

  it("renders configured short hashes while retaining full hash attributes", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    const commitCell = headRow?.querySelectorAll("td")[4];

    expect(headRow?.dataset.hash).toBe("abc123");
    expect(commitCell?.textContent).toBe("abc1");
    expect(commitCell?.getAttribute("title")).toBe("abc123");
  });

  it("finds loaded commits by message, author, email, refs, and hashes without loading data", () => {
    const loadCommitRequestsBefore = sentLoadCommitsCount();

    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("findControl")?.hidden).toBe(false);

    setFindQuery("alice");
    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);
    expect(document.getElementById("findMatchCount")?.textContent).toBe("1 of 1");

    setFindQuery("v1.0.0");
    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);

    setFindQuery("def456");
    expect(findRow("def456")?.classList.contains("findMatchActive")).toBe(true);

    setFindQuery("def4");
    expect(findRow("def456")?.classList.contains("findMatchActive")).toBe(true);

    setFindQuery("example.com");
    expect(document.getElementById("findMatchCount")?.textContent).toBe("1 of 2");
    expect(findRow("abc123")?.classList.contains("findMatch")).toBe(true);
    expect(findRow("def456")?.classList.contains("findMatch")).toBe(true);
    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);

    setFindQuery("missing");
    expect(document.getElementById("findMatchCount")?.textContent).toBe("No matches");
    expect(document.querySelector("tr.commit.findMatch")).toBeNull();

    expect(sentLoadCommitsCount()).toBe(loadCommitRequestsBefore);
    expect(document.querySelectorAll("tr.commit")).toHaveLength(2);

    clearFind();
    expect(document.getElementById("findControl")?.hidden).toBe(true);
  });

  it("navigates find matches with buttons and input shortcuts", () => {
    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    setFindQuery("example.com");

    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);
    expect(document.getElementById("findMatchCount")?.textContent).toBe("1 of 2");

    document
      .getElementById("findNextBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(findRow("def456")?.classList.contains("findMatchActive")).toBe(true);
    expect(document.getElementById("findMatchCount")?.textContent).toBe("2 of 2");

    document
      .getElementById("findPreviousBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);

    getFindInput().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    );

    expect(findRow("def456")?.classList.contains("findMatchActive")).toBe(true);

    getFindInput().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
        cancelable: true
      })
    );

    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);

    clearFind();
  });

  it("searches full history and loads enough commits to reveal a selected result", () => {
    const archivedSearchResult: GitCommitSearchResult = {
      hash: "ghi789",
      parentHashes: ["def456"],
      author: "Cara",
      email: "cara@example.com",
      date: 1698000000,
      message: "Deep archived fix",
      loadCount: 305
    };
    const archivedCommit: GitCommitNode = {
      ...archivedSearchResult,
      refs: []
    };

    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    setFindQuery("archived");

    document
      .getElementById("findSearchHistoryBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const searchRequest = latestSearchCommitsRequest();
    expect(searchRequest).toMatchObject({
      command: "searchCommits",
      repo: REPO,
      query: "archived",
      maxResults: 50,
      showRemoteBranches: true
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Searching history");

    receive({
      command: "searchCommits",
      requestId: searchRequest.requestId,
      results: [archivedSearchResult],
      error: null
    });

    expect(document.getElementById("dialog")?.textContent).toContain(
      "Search history results for archived"
    );
    expect(document.getElementById("dialog")?.textContent).toContain("ghi7 - Deep archived fix");

    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    const loadCommitsRequest = latestLoadCommitsRequest();
    expect(loadCommitsRequest).toMatchObject({
      command: "loadCommits",
      branchName: "",
      maxCommits: 305,
      hard: true
    });

    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: [twoCommits[0], archivedCommit, twoCommits[1]],
      head: "abc123",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    expect(findRow("ghi789")).not.toBeNull();
    expect(findRow("ghi789")?.classList.contains("blinking")).toBe(true);

    clearFind();
  });

  it("opens find from keyboard without stealing text input or dialog shortcuts", () => {
    clearFind();

    const documentFindEvent = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(documentFindEvent);

    expect(documentFindEvent.defaultPrevented).toBe(true);
    expect(document.getElementById("findControl")?.hidden).toBe(false);

    const inputFindEvent = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    getFindInput().dispatchEvent(inputFindEvent);

    expect(inputFindEvent.defaultPrevented).toBe(false);

    clearFind();
    document.getElementById("dialog")?.classList.add("active");

    const dialogFindEvent = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(dialogFindEvent);

    expect(dialogFindEvent.defaultPrevented).toBe(false);
    expect(document.getElementById("findControl")?.hidden).toBe(true);

    document.getElementById("dialog")?.classList.remove("active");
    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true
    });
    getFindInput().dispatchEvent(escapeEvent);

    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(document.getElementById("findControl")?.hidden).toBe(true);
  });

  it("copies the full commit hash from the commit context menu", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();

    headRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const copyHashItem = Array.from(
      document.querySelectorAll("#contextMenu .contextMenuItem")
    ).find((item) => item.textContent?.includes("Copy Commit Hash"));
    expect(copyHashItem).not.toBeUndefined();

    copyHashItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Commit Hash",
      data: "abc123"
    });
  });

  it("toggles commit details from keyboard activation", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "commitDetails",
      repo: REPO,
      commitHash: "abc123"
    });

    receive({ command: "commitDetails", commitDetails: firstCommitDetails, error: null });

    expect(headRow?.classList.contains("commitDetailsOpen")).toBe(true);
    expect(headRow?.getAttribute("aria-selected")).toBe("true");

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

    expect(document.getElementById("commitDetails")).toBeNull();
    expect(headRow?.getAttribute("aria-selected")).toBe("false");
  });

  it("collapses and expands commit detail sections with persisted state", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    receive({ command: "commitDetails", commitDetails: firstCommitDetails, error: null });

    const summaryToggle = document.getElementById("commitDetailsSummaryToggle");
    const filesToggle = document.getElementById("commitDetailsFilesToggle");

    summaryToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    filesToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitDetails")?.classList.contains("summaryCollapsed")).toBe(
      true
    );
    expect(document.getElementById("commitDetails")?.classList.contains("filesCollapsed")).toBe(
      true
    );
    expect(summaryToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(filesToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("commitDetailsSummaryBody")?.classList.contains("hidden")).toBe(
      true
    );
    expect(document.getElementById("commitDetailsFilesBody")?.classList.contains("hidden")).toBe(
      true
    );
    expect(vscodeMock.getState()?.expandedCommit?.summaryOpen).toBe(false);
    expect(vscodeMock.getState()?.expandedCommit?.filesOpen).toBe(false);

    summaryToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitDetails")?.classList.contains("summaryCollapsed")).toBe(
      false
    );
    expect(document.getElementById("commitDetailsSummaryBody")?.classList.contains("hidden")).toBe(
      false
    );
    expect(vscodeMock.getState()?.expandedCommit?.summaryOpen).toBe(true);

    headRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("commitDetails")).toBeNull();
  });

  it("resizes commit details with pointer and keyboard input", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    receive({ command: "commitDetails", commitDetails: firstCommitDetails, error: null });

    const details = document.getElementById("commitDetails");
    const handle = document.getElementById("commitDetailsResizeHandle");

    expect(details?.style.height).toBe(`${COMMIT_DETAILS_DEFAULT_HEIGHT}px`);
    expect(handle?.getAttribute("aria-valuenow")).toBe(COMMIT_DETAILS_DEFAULT_HEIGHT.toString());

    handle?.dispatchEvent(new MouseEvent("mousedown", { button: 0, clientY: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 320, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    const draggedHeight = COMMIT_DETAILS_DEFAULT_HEIGHT + 120;
    expect(details?.style.height).toBe(`${draggedHeight}px`);
    expect(handle?.getAttribute("aria-valuenow")).toBe(draggedHeight.toString());
    expect(vscodeMock.getState()?.expandedCommit?.detailsHeight).toBe(draggedHeight);
    expect(document.body.classList.contains("commitDetailsResizing")).toBe(false);

    handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

    const keyboardHeight = draggedHeight - COMMIT_DETAILS_KEYBOARD_RESIZE_STEP;
    expect(details?.style.height).toBe(`${keyboardHeight}px`);
    expect(vscodeMock.getState()?.expandedCommit?.detailsHeight).toBe(keyboardHeight);

    handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

    expect(details?.style.height).toBe(`${COMMIT_DETAILS_MIN_HEIGHT}px`);
    expect(handle?.getAttribute("aria-valuenow")).toBe(COMMIT_DETAILS_MIN_HEIGHT.toString());

    document
      .getElementById("commitDetailsSummaryToggle")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document
      .getElementById("commitDetailsFilesToggle")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(details?.style.height).toBe(`${COMMIT_DETAILS_COLLAPSED_HEIGHT}px`);

    document
      .getElementById("commitDetailsSummaryToggle")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(details?.style.height).toBe(`${COMMIT_DETAILS_MIN_HEIGHT}px`);

    headRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("commitDetails")).toBeNull();
  });

  it("shows refreshing status while a hard refresh is pending", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("statusStrip")?.dataset.state).toBe("loading");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("statusText")?.textContent).toBe("Refreshing graph");

    const loadBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const loadCommitsRequest = latestLoadCommitsRequest();
    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("ignores stale branch load responses", () => {
    const commitRequestsBefore = sentLoadCommitsCount();

    receive({
      command: "loadBranches",
      requestId: 999,
      branches: ["stale-branch"],
      head: "stale-branch",
      hard: true,
      isRepo: true,
      error: null
    });

    expect(document.getElementById("branchSelect")?.textContent).not.toContain("stale-branch");
    expect(sentLoadCommitsCount()).toBe(commitRequestsBefore);
  });

  it("ignores stale commit load responses", () => {
    const tableTextBefore = document.getElementById("commitTable")?.textContent;

    receive({
      command: "loadCommits",
      requestId: 999,
      commits: [
        {
          hash: "999999",
          parentHashes: [],
          author: "Old",
          email: "old@example.com",
          date: 1680000000,
          message: "Stale commit",
          refs: []
        }
      ],
      head: "999999",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    expect(document.getElementById("commitTable")?.textContent).toBe(tableTextBefore);
    expect(document.getElementById("commitTable")?.textContent).not.toContain("Stale commit");
  });

  it("shows action status when a tag push starts", () => {
    const tagRef = document.querySelector(".gitRef.tag");
    expect(tagRef).not.toBeNull();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    const pushTagItem = Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).find(
      (item) => item.textContent?.includes("Push Tag")
    );
    expect(pushTagItem).not.toBeUndefined();
    pushTagItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelector("#dialog .dialogContent")).not.toBeNull();
    expect(document.querySelector("#dialog .dialogActions")).not.toBeNull();
    expect(document.getElementById("dialogAction")?.classList.contains("dialogBtnPrimary")).toBe(
      true
    );
    const dismissBtn = document.getElementById("dialogDismiss");
    expect(dismissBtn?.classList.contains("dialogBtn")).toBe(true);
    expect(dismissBtn?.classList.contains("dialogBtnPrimary")).toBe(false);

    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pushTag",
      repo: REPO,
      tagName: "v1.0.0"
    });
    expect(document.getElementById("statusStrip")?.dataset.state).toBe("action");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("statusText")?.textContent).toBe("Pushing Tag...");

    // The action-running dialog only offers dismiss, which becomes the primary button
    expect(document.getElementById("dialogAction")).toBeNull();
    expect(document.getElementById("dialogDismiss")?.classList.contains("dialogBtnPrimary")).toBe(
      true
    );
  });

  it("shows a graph error state when commit loading fails", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const loadCommitsRequest = latestLoadCommitsRequest();

    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: [],
      head: null,
      moreCommitsAvailable: false,
      hard: true,
      error: {
        message: "fatal: bad revision",
        stderr: "fatal: bad revision",
        exitCode: 128,
        task: null
      }
    });

    expect(document.body.classList.contains("unableToLoad")).toBe(true);
    expect(document.getElementById("statusStrip")?.dataset.state).toBe("error");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("false");
    expect(document.getElementById("statusText")?.textContent).toBe("Error");
    expect(document.getElementById("commitTable")?.textContent).toContain(
      "Unable to load Git Graph"
    );
    expect(document.getElementById("commitTable")?.textContent).toContain("fatal: bad revision");
  });

  it("shows commit details error reasons in the dialog", () => {
    receive({
      command: "commitDetails",
      commitDetails: null,
      error: {
        message: "fatal: could not show commit",
        stderr: null,
        exitCode: 128,
        task: null
      }
    });

    expect(document.getElementById("dialog")?.textContent).toContain(
      "Unable to load commit details"
    );
    expect(document.getElementById("dialog")?.textContent).toContain(
      "fatal: could not show commit"
    );
  });

  it("switches repos when loadRepos carries an explicit lastActiveRepo", () => {
    const otherRepo = "/workspace/other-repo";

    receive({
      command: "loadRepos",
      repos: {
        [REPO]: { columnWidths: null },
        [otherRepo]: { columnWidths: null }
      },
      lastActiveRepo: otherRepo
    });

    const selectRepoMessages = vscodeMock.sentMessages.filter(
      (msg) => msg.command === "selectRepo"
    );
    expect(selectRepoMessages[selectRepoMessages.length - 1]).toEqual({
      command: "selectRepo",
      repo: otherRepo
    });
  });
});
