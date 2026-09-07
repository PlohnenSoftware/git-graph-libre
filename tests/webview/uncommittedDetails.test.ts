import { beforeAll, describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo, GitUncommittedChanges } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/my-repo";

const defaultViewState: GGL.GitGraphViewState = {
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
  fetchTagsByDefault: false,
  mergeNoFastForward: true,
  pullBranchNoFastForward: false,
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 4,
  language: "en",
  languages: [{ id: "en", label: "English" }]
};

const uncommittedNode: GitCommitNode = {
  hash: "*",
  parentHashes: [],
  author: "*",
  email: "",
  date: 1701000000,
  message: "Uncommitted changes (2)",
  refs: []
};

const headCommit: GitCommitNode = {
  hash: "abc123",
  parentHashes: [],
  author: "Alice",
  email: "alice@example.com",
  date: 1700000000,
  message: "Add feature",
  refs: []
};

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
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

const uncommittedChanges: GitUncommittedChanges = {
  staged: [{ path: "added.txt", oldPath: null, stagedKind: "A", unstagedKind: null }],
  unstaged: [{ path: "work.txt", oldPath: null, stagedKind: null, unstagedKind: "M" }]
};

describe("uncommitted details", () => {
  let vscodeMock: ReturnType<typeof createVscodeMock>;

  function latestSent<T extends GGL.RequestMessage["command"]>(
    command: T
  ): Extract<GGL.RequestMessage, { command: T }> {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === command) return msg as Extract<GGL.RequestMessage, { command: T }>;
    }
    throw new Error(`Missing ${command} request`);
  }

  function receiveLoadedCommits() {
    const request = latestSent("loadCommits");
    receive({
      command: "loadCommits",
      requestId: request.requestId,
      commits: [uncommittedNode, headCommit],
      head: "abc123",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });
  }

  function receiveUncommittedDetails(changes: GitUncommittedChanges = uncommittedChanges) {
    receive({ command: "uncommittedDetails", changes, error: null });
  }

  function unsavedRow(): HTMLElement {
    const row = document.querySelector<HTMLElement>("tr.unsavedChanges");
    expect(row).not.toBeNull();
    return row as HTMLElement;
  }

  function openPanel() {
    if (document.getElementById("commitDetails") === null) {
      unsavedRow().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(latestSent("uncommittedDetails")).toMatchObject({ repo: REPO });
    }
    receiveUncommittedDetails();
    expect(document.getElementById("commitDetails")).not.toBeNull();
  }

  function dropOnto(zone: Element, payload: string, targetSection: "staged" | "unstaged"): void {
    zone.dispatchEvent(
      Object.assign(new Event("drop", { bubbles: true }), {
        dataTransfer: { getData: () => payload }
      })
    );
    expect(zone.getAttribute("data-section")).toBe(targetSection);
  }

  function dismissActionDialog() {
    document.getElementById("dialogDismiss")?.dispatchEvent(new MouseEvent("click"));
  }

  beforeAll(async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vscodeMock = createVscodeMock();
    setupHtml(defaultViewState);
    await import("@/webview/main");
    const repoInfoRequest = latestSent("loadRepoInfo");
    receive({
      command: "loadRepoInfo",
      requestId: repoInfoRequest.requestId,
      repoInfo,
      error: null
    });
    const branchesRequest = latestSent("loadBranches");
    receive({
      command: "loadBranches",
      requestId: branchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receiveLoadedCommits();
  });

  it("requests uncommitted details when the row is clicked", () => {
    unsavedRow().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(latestSent("uncommittedDetails")).toEqual({
      command: "uncommittedDetails",
      repo: REPO
    });
    receiveUncommittedDetails();
  });

  it("renders staged and unstaged panes with draggable rows", () => {
    expect(document.getElementById("uncommittedStagedToggle")).not.toBeNull();
    expect(document.getElementById("uncommittedUnstagedToggle")).not.toBeNull();
    const stagedItem = document.querySelector('.uncommittedFile[data-filepath="added.txt"]');
    expect(stagedItem?.getAttribute("draggable")).toBe("true");
    const unstagedItem = document.querySelector('.uncommittedFile[data-filepath="work.txt"]');
    expect(unstagedItem?.getAttribute("draggable")).toBe("true");
  });

  it("toggles closed when the row is clicked again", () => {
    unsavedRow().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitDetails")).toBeNull();
  });

  it("opens from the keyboard and stages a file dropped on the staged pane", () => {
    unsavedRow().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(latestSent("uncommittedDetails")).toMatchObject({ repo: REPO });
    receiveUncommittedDetails();

    const stagedBody = document.getElementById("commitDetailsSummaryBody");
    expect(stagedBody).not.toBeNull();
    dropOnto(stagedBody as Element, "unstaged work.txt", "staged");

    expect(latestSent("stageFiles")).toEqual({
      command: "stageFiles",
      repo: REPO,
      filePaths: ["work.txt"]
    });
    dismissActionDialog();
  });

  it("unstages a file dropped on the unstaged pane and ignores same-pane drops", () => {
    const unstagedBody = document.getElementById("commitDetailsFilesBody");
    expect(unstagedBody).not.toBeNull();
    dropOnto(unstagedBody as Element, "staged added.txt", "unstaged");

    expect(latestSent("unstageFiles")).toEqual({
      command: "unstageFiles",
      repo: REPO,
      filePaths: ["added.txt"]
    });
    dismissActionDialog();

    const sentBefore = vscodeMock.sentMessages.length;
    dropOnto(unstagedBody as Element, "unstaged work.txt", "unstaged");
    expect(vscodeMock.sentMessages.length).toBe(sentBefore);
  });

  it("unstages through the row button without dragging", () => {
    const button = document.querySelector('.uncommittedMoveFile[data-filepath="added.txt"]');
    expect(button).not.toBeNull();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(latestSent("unstageFiles")).toEqual({
      command: "unstageFiles",
      repo: REPO,
      filePaths: ["added.txt"]
    });
    dismissActionDialog();
  });

  it("collapses a pane from its toggle", () => {
    document
      .getElementById("uncommittedStagedToggle")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitDetailsSummaryBody")?.className).toContain("hidden");
    expect(document.getElementById("commitDetails")).not.toBeNull();
  });

  it("refreshes the graph and the panel after a successful stage", () => {
    const detailsBefore = vscodeMock.sentMessages.filter(
      (msg) => msg.command === "uncommittedDetails"
    ).length;
    receive({ command: "stageFiles", status: null });

    const repoInfoRequest = latestSent("loadRepoInfo");
    receive({
      command: "loadRepoInfo",
      requestId: repoInfoRequest.requestId,
      repoInfo,
      error: null
    });
    const branchesRequest = latestSent("loadBranches");
    receive({
      command: "loadBranches",
      requestId: branchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receiveLoadedCommits();
    expect(
      vscodeMock.sentMessages.filter((msg) => msg.command === "uncommittedDetails").length
    ).toBeGreaterThan(detailsBefore);
    receiveUncommittedDetails();
    expect(document.getElementById("commitDetails")).not.toBeNull();
  });

  it("shows an error and closes the panel when details fail to load", () => {
    openPanel();
    receive({
      command: "uncommittedDetails",
      changes: null,
      error: { message: "fatal: no status", stderr: null, exitCode: 128, task: null }
    });

    expect(document.getElementById("commitDetails")).toBeNull();
    expect(document.getElementById("dialog")?.textContent).toContain("fatal: no status");
    dismissActionDialog();
  });
});
