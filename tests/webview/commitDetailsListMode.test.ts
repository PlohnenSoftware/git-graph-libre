import type { GitCommitDetails, GitCommitNode } from "@/backend/types";
import type * as GG from "@/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/list-mode-repo";

type LoadBranchesRequest = Extract<GG.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GG.RequestMessage, { command: "loadCommits" }>;

const viewState: GG.GitGraphViewState = {
  autoCenterCommitDetailsView: false,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "list",
  dateFormat: "Date & Time",
  fetchAvatars: false,
  graphColors: ["oklch(65% 0.16 250)"],
  graphFontSize: 13,
  graphRowHeight: 24,
  graphStyle: "rounded",
  initialLoadCommits: 300,
  lastActiveRepo: null,
  loadMoreCommits: 75,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  shortHashLength: 8
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
  date: 1_700_000_000,
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

function latestLoadBranchesRequest(messages: GG.RequestMessage[]): LoadBranchesRequest {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.command === "loadBranches") return msg;
  }
  throw new Error("Missing loadBranches request");
}

function latestLoadCommitsRequest(messages: GG.RequestMessage[]): LoadCommitsRequest {
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
});
