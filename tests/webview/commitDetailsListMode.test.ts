import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitCommitDetails, GitCommitNode } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/list-mode-repo";

type LoadBranchesRequest = Extract<GGL.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GGL.RequestMessage, { command: "loadCommits" }>;

const viewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: false,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "list",
  uncommittedFileViewMode: "list",
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

const commits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: ["def456"],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: "Add feature",
    refs: []
  }
];

const commitDetails: GitCommitDetails = {
  hash: "abc123",
  parents: ["def456"],
  author: "Alice",
  email: "alice@example.com",
  authorDate: 1_700_000_000,
  committer: "Alice",
  committerEmail: "alice@example.com",
  committerDate: 1_700_000_000,
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

function latestLoadBranchesRequest(messages: GGL.RequestMessage[]): LoadBranchesRequest {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.command === "loadBranches") return msg;
  }
  throw new Error("Missing loadBranches request");
}

function latestLoadCommitsRequest(messages: GGL.RequestMessage[]): LoadCommitsRequest {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.command === "loadCommits") return msg;
  }
  throw new Error("Missing loadCommits request");
}

describe("commit details list mode runtime", () => {
  let vscodeMock: ReturnType<typeof createVscodeMock>;

  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vscodeMock = createVscodeMock();
    setupHtml(viewState);
  });

  async function showCommitDetails(details: GitCommitDetails) {
    await import("@/webview/main");
    receive({
      command: "loadBranches",
      requestId: latestLoadBranchesRequest(vscodeMock.sentMessages).requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receive({
      command: "loadCommits",
      requestId: latestLoadCommitsRequest(vscodeMock.sentMessages).requestId,
      commits,
      head: "abc123",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });
    document
      .querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({ command: "commitDetails", commitDetails: details, error: null });
  }

  function fileContextMenuItems(): HTMLElement[] {
    document
      .querySelector<HTMLElement>(".gitFileList .gitFile")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    return Array.from(document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem"));
  }

  it("renders flat file paths and keeps diff opening wired", async () => {
    await import("@/webview/main");

    const loadBranchesRequest = latestLoadBranchesRequest(vscodeMock.sentMessages);
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const loadCommitsRequest = latestLoadCommitsRequest(vscodeMock.sentMessages);
    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits,
      head: "abc123",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    document
      .querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({ command: "commitDetails", commitDetails, error: null });

    expect(document.querySelector(".gitFileList")).not.toBeNull();
    expect(document.querySelector(".gitFolder")).toBeNull();

    document
      .querySelector<HTMLButtonElement>(".gitFileList .gitFileCopyPath")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "File Path",
      data: "src/example.ts"
    });

    document
      .querySelector<HTMLButtonElement>(".gitFileList .gitFileOpenFile")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "openFile",
      repo: REPO,
      filePath: "src/example.ts"
    });

    document
      .querySelector<HTMLElement>(".gitFileList .gitFile")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "viewDiff",
      repo: REPO,
      commitHash: "abc123",
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M"
    });
  });

  it("opens a stashed untracked file from the stash's third parent", async () => {
    await import("@/webview/main");

    const loadBranchesRequest = latestLoadBranchesRequest(vscodeMock.sentMessages);
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const loadCommitsRequest = latestLoadCommitsRequest(vscodeMock.sentMessages);
    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits,
      head: "abc123",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    document
      .querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "commitDetails",
      commitDetails: {
        ...commitDetails,
        fileChanges: [
          {
            oldFilePath: "untracked.txt",
            newFilePath: "untracked.txt",
            type: "A",
            additions: 1,
            deletions: 0,
            untracked: true
          }
        ]
      },
      error: null
    });

    document
      .querySelector<HTMLElement>(".gitFileList .gitFile")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "viewDiff",
      repo: REPO,
      commitHash: "abc123",
      oldRef: "abc123^",
      newRef: "abc123^3",
      oldFilePath: "untracked.txt",
      newFilePath: "untracked.txt",
      type: "A"
    });

    // The GGL Diff tab opens the same third-parent pair (D47).
    document
      .querySelector<HTMLElement>(".gitFileList .gitFile")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const openInGglDiff = Array.from(
      document.querySelectorAll("#contextMenu .contextMenuItem")
    ).find((item) => item.textContent?.includes("Open in GGL Diff"));
    expect(openInGglDiff).not.toBeUndefined();
    openInGglDiff?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "openDiffTab",
      repo: REPO,
      commitHash: "abc123",
      oldRef: "abc123^",
      newRef: "abc123^3",
      oldFilePath: "untracked.txt",
      newFilePath: "untracked.txt",
      type: "A"
    });

    document
      .querySelector<HTMLElement>(".gitFileList .gitFile")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const viewAtRevision = Array.from(
      document.querySelectorAll("#contextMenu .contextMenuItem")
    ).find((item) => item.textContent?.includes("View File at Revision"));
    expect(viewAtRevision).not.toBeUndefined();
    viewAtRevision?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "viewFileAtRevision",
      repo: REPO,
      commitHash: "abc123^3",
      filePath: "untracked.txt"
    });
  });

  it("offers Open in GGL Diff beside View File Diff, with the same message fields", async () => {
    await showCommitDetails(commitDetails);

    const items = fileContextMenuItems();
    const titles = items.map((item) => item.textContent ?? "");
    const viewDiffIndex = titles.indexOf("View File Diff");
    expect(viewDiffIndex).toBeGreaterThanOrEqual(0);
    expect(titles[viewDiffIndex + 1]).toBe("Open in GGL Diff");

    items[viewDiffIndex + 1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "openDiffTab",
      repo: REPO,
      commitHash: "abc123",
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M"
    });

    // A plain click still opens vscode.diff through viewDiff.
    document
      .querySelector<HTMLElement>(".gitFileList .gitFile")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "viewDiff",
      repo: REPO,
      commitHash: "abc123",
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M"
    });
  });

  it("offers no diff of either kind for a binary file", async () => {
    await showCommitDetails({
      ...commitDetails,
      fileChanges: [
        {
          oldFilePath: "image.png",
          newFilePath: "image.png",
          type: "M",
          additions: null,
          deletions: null
        }
      ]
    });

    const titles = fileContextMenuItems().map((item) => item.textContent ?? "");
    expect(titles).not.toContain("View File Diff");
    expect(titles).not.toContain("Open in GGL Diff");

    const sentBefore = vscodeMock.sentMessages.length;
    document
      .querySelector<HTMLElement>(".gitFileList .gitFile")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const diffCommands = vscodeMock.sentMessages
      .slice(sentBefore)
      .filter((msg) => msg.command === "viewDiff" || msg.command === "openDiffTab");
    expect(diffCommands).toEqual([]);
  });
});
