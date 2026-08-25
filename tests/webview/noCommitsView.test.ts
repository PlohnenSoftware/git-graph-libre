import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/no-commits-repo";

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
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 8
};

// `git branch --show-current` still names the unborn branch, while
// `git rev-parse --verify HEAD` fails — the zero-commit repository shape.
const emptyRepoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: null,
  authors: [],
  tags: [],
  remotes: [],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  }
};

const populatedRepoInfo: GitRepoInfo = {
  ...emptyRepoInfo,
  head: "main",
  headCommit: "abc123",
  authors: ["Alice"],
  tags: ["v1.0.0"]
};

const normalCommits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: [],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: "Initial commit",
    refs: [{ hash: "abc123", name: "main", type: "head" }]
  }
];

const uncommittedChangesRow: GitCommitNode = {
  hash: "*",
  parentHashes: [],
  author: "*",
  email: "",
  date: 1_700_000_100,
  message: "Uncommitted Changes (2)",
  refs: []
};

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

type BootInput = {
  repoInfo: GitRepoInfo;
  branches: string[];
  branchHead: string | null;
  commits: GitCommitNode[];
  commitHead: string | null;
};

async function bootWebview(input: BootInput) {
  vi.resetModules();
  const vscodeMock = createVscodeMock();
  setupHtml(defaultViewState);
  await import("@/webview/main");

  receive({
    command: "loadRepoInfo",
    requestId: latestRequest(vscodeMock.sentMessages, "loadRepoInfo").requestId,
    repoInfo: input.repoInfo,
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: latestRequest(vscodeMock.sentMessages, "loadBranches").requestId,
    branches: input.branches,
    head: input.branchHead,
    hard: true,
    isRepo: true,
    error: null
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits: input.commits,
    head: input.commitHead,
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscodeMock;
}

function controlHidden(id: string) {
  const elem = document.getElementById(id);
  expect(elem).not.toBeNull();
  return (elem as HTMLElement).hidden;
}

describe("no-commits repository view", () => {
  it("renders the dedicated view instead of the generic empty-graph row", async () => {
    await bootWebview({
      repoInfo: emptyRepoInfo,
      branches: [],
      branchHead: null,
      commits: [],
      commitHead: null
    });

    const l10n = getWebviewLocalizedStrings();
    const row = document.querySelector<HTMLTableRowElement>("tr.noCommitsRow");
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain(l10n.noCommits);
    expect(row?.textContent).toContain(l10n.createFirstCommit);
    expect(row?.querySelector("svg.noCommitsIcon")).not.toBeNull();
    expect(document.querySelector("tr.emptyGraphRow")).toBeNull();
  });

  it("hides the meaningless filter controls while the repo has no commits", async () => {
    await bootWebview({
      repoInfo: emptyRepoInfo,
      branches: [],
      branchHead: null,
      commits: [],
      commitHead: null
    });

    expect(controlHidden("branchControl")).toBe(true);
    expect(controlHidden("authorControl")).toBe(true);
    expect(controlHidden("tagControl")).toBe(true);
    expect(controlHidden("showRemoteBranchesControl")).toBe(true);
    expect(controlHidden("repoControl")).toBe(false);
    expect(controlHidden("refreshBtn")).toBe(false);
  });

  it("keeps a rendered uncommitted-changes row instead of replacing it", async () => {
    await bootWebview({
      repoInfo: emptyRepoInfo,
      branches: [],
      branchHead: null,
      commits: [uncommittedChangesRow],
      commitHead: null
    });

    expect(document.querySelector("tr.unsavedChanges")).not.toBeNull();
    expect(document.querySelector("tr.noCommitsRow")).toBeNull();
    expect(document.querySelector("tr.emptyGraphRow")).toBeNull();
  });

  it("keeps the generic empty-graph row for a filtered-to-nothing view", async () => {
    await bootWebview({
      repoInfo: populatedRepoInfo,
      branches: ["main"],
      branchHead: "main",
      commits: [],
      commitHead: "abc123"
    });

    const l10n = getWebviewLocalizedStrings();
    const row = document.querySelector<HTMLTableRowElement>("tr.emptyGraphRow");
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain(l10n.emptyGraph);
    expect(document.querySelector("tr.noCommitsRow")).toBeNull();
    expect(controlHidden("branchControl")).toBe(false);
    expect(controlHidden("authorControl")).toBe(false);
    expect(controlHidden("tagControl")).toBe(false);
    expect(controlHidden("showRemoteBranchesControl")).toBe(false);
  });

  it("leaves a populated repository unchanged", async () => {
    await bootWebview({
      repoInfo: populatedRepoInfo,
      branches: ["main"],
      branchHead: "main",
      commits: normalCommits,
      commitHead: "abc123"
    });

    expect(document.querySelector('tr.commit[data-hash="abc123"]')).not.toBeNull();
    expect(document.querySelector("tr.noCommitsRow")).toBeNull();
    expect(document.querySelector("tr.emptyGraphRow")).toBeNull();
    expect(controlHidden("branchControl")).toBe(false);
    expect(controlHidden("authorControl")).toBe(false);
    expect(controlHidden("tagControl")).toBe(false);
    expect(controlHidden("showRemoteBranchesControl")).toBe(false);
    expect(controlHidden("repoControl")).toBe(false);
    expect(controlHidden("refreshBtn")).toBe(false);
  });
});
