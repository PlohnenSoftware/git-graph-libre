import { beforeAll, describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo, GitUncommittedChanges } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";
import {
  COMMIT_DETAILS_DEFAULT_HEIGHT,
  COMMIT_DETAILS_KEYBOARD_RESIZE_STEP,
  COMMIT_DETAILS_MIN_HEIGHT
} from "@/webview/commitDetailsView";

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
  uncommittedFileViewMode: "tree",
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
  createBranchCheckout: true,
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

  function reloadGraphWithCommits(commits: GitCommitNode[]) {
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
    const request = latestSent("loadCommits");
    receive({
      command: "loadCommits",
      requestId: request.requestId,
      commits,
      head: "abc123",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });
  }

  function reloadGraphWithRow() {
    reloadGraphWithCommits([uncommittedNode, headCommit]);
  }

  function setPanes(stagedOpen: boolean, unstagedOpen: boolean) {
    const wants = new Map([
      ["uncommittedStagedToggle", stagedOpen],
      ["uncommittedUnstagedToggle", unstagedOpen]
    ]);
    for (const [id, want] of wants) {
      const toggle = document.getElementById(id);
      if (toggle?.getAttribute("aria-expanded") !== want.toString()) {
        toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }
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

  it("groups nested paths into draggable folder rows and stages a whole folder", () => {
    receiveUncommittedDetails({
      staged: [],
      unstaged: [
        { path: "src/a.ts", oldPath: null, stagedKind: null, unstagedKind: "M" },
        { path: "src/deep/b.ts", oldPath: null, stagedKind: null, unstagedKind: "M" },
        { path: "top.txt", oldPath: null, stagedKind: null, unstagedKind: "M" }
      ]
    });

    const folder = document.querySelector<HTMLElement>('.uncommittedFolder[data-folderpath="src"]');
    expect(folder).not.toBeNull();
    expect(folder?.getAttribute("draggable")).toBe("true");
    // A top-level file stays a plain row rather than being wrapped.
    expect(document.querySelector('.uncommittedFile[data-filepath="top.txt"]')).not.toBeNull();
    // The folder carries every descendant on offer, so one drop covers the
    // subtree — including the nested folder's file.
    expect(folder?.dataset.paths?.split(" ").map(decodeURIComponent)).toEqual([
      "src/deep/b.ts",
      "src/a.ts"
    ]);

    const stagedPane = document.getElementById("commitDetailsSummary");
    expect(stagedPane?.getAttribute("data-section")).toBe("staged");
    dropOnto(stagedPane as Element, `unstaged ${folder?.dataset.paths}`, "staged");

    expect(latestSent("stageFiles")).toEqual({
      command: "stageFiles",
      repo: REPO,
      filePaths: ["src/deep/b.ts", "src/a.ts"]
    });
  });

  it("switches between the folder tree and a flat path list", () => {
    const nested = {
      staged: [],
      unstaged: [{ path: "src/a.ts", oldPath: null, stagedKind: null, unstagedKind: "M" as const }]
    };
    receiveUncommittedDetails(nested);
    expect(document.querySelector(".uncommittedFolder")).not.toBeNull();

    // The toggle is a checked view option on the uncommitted row's menu.
    unsavedRow().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const item = [...document.querySelectorAll("#contextMenu li")].find((li) =>
      li.textContent?.includes("Group by folder")
    );
    expect(item).toBeDefined();
    expect(item?.classList.contains("contextMenuItemCheckbox")).toBe(true);
    item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // It persists as a global setting rather than as view state.
    expect(latestSent("updateExtensionSetting")).toEqual({
      command: "updateExtensionSetting",
      key: "uncommittedChanges.fileViewMode",
      value: "list",
      global: true
    });

    receiveUncommittedDetails(nested);
    // Flat mode has no folder rows at all — the whole path is on one row, so
    // there is nothing to drag a subtree from.
    expect(document.querySelector(".uncommittedFolder")).toBeNull();
    expect(document.querySelector('.uncommittedFile[data-filepath="src%2Fa.ts"]')).not.toBeNull();

    // Flip back to tree, so the mode this suite shares stays at the default.
    unsavedRow().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    [...document.querySelectorAll("#contextMenu li")]
      .find((li) => li.textContent?.includes("Group by folder"))
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(latestSent("updateExtensionSetting")).toMatchObject({ value: "tree" });
    receiveUncommittedDetails(nested);
    expect(document.querySelector(".uncommittedFolder")).not.toBeNull();
  });

  it("collapses a folder and keeps it collapsed across a re-render", () => {
    receiveUncommittedDetails({
      staged: [],
      unstaged: [{ path: "src/a.ts", oldPath: null, stagedKind: null, unstagedKind: "M" }]
    });
    const header = document.querySelector<HTMLElement>(".uncommittedFolderHeader");
    expect(header?.getAttribute("aria-expanded")).toBe("true");

    header?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const folder = document.querySelector<HTMLElement>(".uncommittedFolder");
    expect(folder?.classList.contains("closed")).toBe(true);
    expect(document.querySelector(".uncommittedFolderHeader")?.getAttribute("aria-expanded")).toBe(
      "false"
    );

    // Every staging action re-queries and re-renders the panel, so collapse
    // state has to survive that or folders reopen on each drop.
    receiveUncommittedDetails({
      staged: [],
      unstaged: [{ path: "src/a.ts", oldPath: null, stagedKind: null, unstagedKind: "M" }]
    });
    expect(document.querySelector(".uncommittedFolder")?.classList.contains("closed")).toBe(true);
  });

  it("expands the graph below the panel, like commit details do", () => {
    // The panel is a #commitDetails row hung off the uncommitted row, but it
    // has no ExpandedCommit. When the graph keyed its gap off `expandedCommit`
    // alone, the panel's height stayed in the measured table height with no
    // gap inserted, so every row height was inflated by a share of it and the
    // dots drifted off their rows. The panel must expand the graph the same
    // way an open commit's details does.
    const details = document.getElementById("commitDetails");
    expect(details).not.toBeNull();
    // The graph reads the expanded row from the row directly above the panel.
    const sourceRow = details?.previousElementSibling;
    expect(sourceRow?.classList.contains("unsavedChanges")).toBe(true);
    expect(sourceRow?.getAttribute("data-id")).toBe("0");
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
    expect(vscodeMock.sentMessages).toHaveLength(sentBefore);
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

  it("accepts drops on a collapsed pane container", () => {
    openPanel();
    setPanes(true, false);
    expect(document.getElementById("commitDetailsFilesBody")?.className).toContain("hidden");

    const unstagedPane = document.getElementById("commitDetailsFiles");
    expect(unstagedPane?.getAttribute("data-section")).toBe("unstaged");
    dropOnto(unstagedPane as Element, "staged added.txt", "unstaged");

    expect(latestSent("unstageFiles")).toEqual({
      command: "unstageFiles",
      repo: REPO,
      filePaths: ["added.txt"]
    });
    dismissActionDialog();
    setPanes(true, true);
  });

  it("resizes with pointer and keyboard input", () => {
    openPanel();
    setPanes(true, true);

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

    handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    const keyboardHeight = draggedHeight - COMMIT_DETAILS_KEYBOARD_RESIZE_STEP;
    expect(details?.style.height).toBe(`${keyboardHeight}px`);

    handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(details?.style.height).toBe(`${COMMIT_DETAILS_MIN_HEIGHT}px`);
    expect(handle?.getAttribute("aria-valuenow")).toBe(COMMIT_DETAILS_MIN_HEIGHT.toString());
  });

  it("keeps the resize handle in the DOM when both panes collapse", () => {
    openPanel();
    setPanes(false, false);

    const details = document.getElementById("commitDetails");
    expect(details?.classList.contains("summaryCollapsed")).toBe(true);
    expect(details?.classList.contains("filesCollapsed")).toBe(true);
    // The existing collapsed rule hides the handle by CSS; the markup stays.
    expect(document.getElementById("commitDetailsResizeHandle")).not.toBeNull();
    setPanes(true, true);
  });

  it("renders the collapsed height when both panes are closed", () => {
    openPanel();
    setPanes(false, false);

    document
      .getElementById("commitDetailsResizeHandle")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));

    expect(document.getElementById("commitDetails")?.style.height).toBe("44px");
    setPanes(true, true);
  });

  it("drops a late details response when its row is gone", () => {
    openPanel();
    document.querySelector("tr.unsavedChanges")?.remove();
    document.getElementById("commitDetails")?.remove();

    receiveUncommittedDetails();

    expect(document.getElementById("commitDetails")).toBeNull();
    reloadGraphWithRow();
    receiveUncommittedDetails();
    expect(document.getElementById("commitDetails")).not.toBeNull();
  });

  it("closes the panel without resending when a refresh drops the row", () => {
    openPanel();
    const detailsBefore = vscodeMock.sentMessages.filter(
      (msg) => msg.command === "uncommittedDetails"
    );

    reloadGraphWithCommits([headCommit]);

    expect(document.getElementById("commitDetails")).toBeNull();
    expect(
      vscodeMock.sentMessages.filter((msg) => msg.command === "uncommittedDetails")
    ).toHaveLength(detailsBefore.length);
    reloadGraphWithRow();
  });

  it("keeps the highlight while crossing pane children and clears it outside", () => {
    openPanel();
    setPanes(true, true);
    const pane = document.getElementById("commitDetailsSummary") as Element;
    const child = pane.querySelector(".uncommittedFile") as Element;

    pane.dispatchEvent(
      Object.assign(new Event("dragover", { bubbles: true }), { dataTransfer: {} })
    );
    expect(pane.classList.contains("dropTarget")).toBe(true);

    pane.dispatchEvent(
      Object.assign(new Event("dragleave", { bubbles: true }), { relatedTarget: child })
    );
    expect(pane.classList.contains("dropTarget")).toBe(true);

    pane.dispatchEvent(
      Object.assign(new Event("dragleave", { bubbles: true }), {
        relatedTarget: document.body
      })
    );
    expect(pane.classList.contains("dropTarget")).toBe(false);
  });

  it("clears dragging and highlight state when a drag aborts", () => {
    openPanel();
    setPanes(true, true);
    const item = document.querySelector(
      '.uncommittedFile[data-filepath="work.txt"]'
    ) as HTMLElement;
    const pane = document.getElementById("commitDetailsSummary") as Element;

    item.dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { effectAllowed: "", setData: () => {} }
      })
    );
    pane.classList.add("dropTarget");
    item.dispatchEvent(new Event("dragend", { bubbles: true }));

    expect(item.classList.contains("dragging")).toBe(false);
    expect(pane.classList.contains("dropTarget")).toBe(false);
  });

  it("refreshes the graph and the panel after a successful stage", () => {
    const detailsBefore = vscodeMock.sentMessages.filter(
      (msg) => msg.command === "uncommittedDetails"
    );
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
      vscodeMock.sentMessages.filter((msg) => msg.command === "uncommittedDetails")
    ).toHaveLength(detailsBefore.length + 1);
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
