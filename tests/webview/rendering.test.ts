import { beforeAll, describe, expect, it, vi } from "vitest";

import type { GitCommitNode } from "@/backend/types";
import type * as GG from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/my-repo";
type LoadBranchesRequest = Extract<GG.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GG.RequestMessage, { command: "loadCommits" }>;

const defaultViewState: GG.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  graphColours: ["#0085d9"],
  graphStyle: "rounded",
  initialLoadCommits: 300,
  lastActiveRepo: null,
  loadMoreCommits: 75,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false
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

  function sentLoadCommitsCount() {
    return vscodeMock.sentMessages.filter((msg) => msg.command === "loadCommits").length;
  }

  beforeAll(async () => {
    vi.resetModules();
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

    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pushTag",
      repo: REPO,
      tagName: "v1.0.0"
    });
    expect(document.getElementById("statusStrip")?.dataset.state).toBe("action");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("statusText")?.textContent).toBe("Pushing Tag...");
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
