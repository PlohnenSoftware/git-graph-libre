import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/compare-with";
const LABEL = "Compare With…";
const HEAD_HASH = "aaa1111";
const REMOTE_HASH = "bbb2222";
const TAG_HASH = "ccc3333";
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

function commit(hash: string, refs: GitCommitNode["refs"]): GitCommitNode {
  return {
    hash,
    parentHashes: [],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: hash,
    refs
  };
}

// One ref of each kind on its own commit, so each renders as a standalone
// badge with its own context menu.
const commits = [
  commit(HEAD_HASH, [{ hash: HEAD_HASH, name: "main", type: "head" }]),
  commit(REMOTE_HASH, [{ hash: REMOTE_HASH, name: "origin/feature", type: "remote" }]),
  commit(TAG_HASH, [{ hash: TAG_HASH, name: "v1.0", type: "tag" }])
];
const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: HEAD_HASH,
  authors: ["Alice"],
  tags: ["v1.0", "v0.9"],
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

function requests(messages: GGL.RequestMessage[], command: GGL.RequestMessage["command"]) {
  return messages.filter((message) => message.command === command);
}

async function boot() {
  const vscode = createVscodeMock();
  setupHtml(viewState);
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
    branches: ["main", "feature", "remotes/origin/feature"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscode.sentMessages, "loadCommits").requestId,
    commits,
    head: HEAD_HASH,
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscode;
}

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`Missing element ${selector}`);
  return found;
}

function openMenuOn(selector: string) {
  element(selector).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
}

function menuItem(label: string) {
  return Array.from(document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")).find(
    (item) => item.textContent === label
  );
}

function openCompareWithDialog(selector: string) {
  openMenuOn(selector);
  const item = menuItem(LABEL);
  expect(item).toBeDefined();
  item?.click();
  return element("#dialogInput0") as HTMLInputElement;
}

function submitDialog(input: HTMLInputElement, value: string) {
  input.value = value;
  // A datalist pick fires `input`, not `keyup`; submit the same way.
  input.dispatchEvent(new Event("input", { bubbles: true }));
  element("#dialogAction").click();
}

beforeEach(() => vi.resetModules());

describe("compare with dialog", () => {
  it.each([
    ["commit", `tr[data-hash="${TAG_HASH}"]`],
    ["branch", ".gitRef.head"],
    ["remote branch", ".gitRef.remote"],
    ["tag", ".gitRef.tag"]
  ])("offers Compare With in the %s context menu", async (_group, selector) => {
    await boot();
    openMenuOn(selector);
    expect(menuItem(LABEL)).toBeDefined();
  });

  it("offers Compare With on the checked-out branch, where Compare with HEAD cannot", async () => {
    await boot();
    openMenuOn(".gitRef.head");
    expect(menuItem("Compare with HEAD")).toBeUndefined();
    expect(menuItem(LABEL)).toBeDefined();
  });

  it("suggests HEAD, local branches, remote branches and tags, in that order", async () => {
    await boot();
    const input = openCompareWithDialog(`tr[data-hash="${TAG_HASH}"]`);
    expect(input.getAttribute("placeholder")).toBe("SHA, branch or tag");
    expect(input.getAttribute("list")).toBe("compareWithSuggestions");
    const options = Array.from(
      document.querySelectorAll<HTMLOptionElement>("#compareWithSuggestions option")
    ).map((option) => option.value);
    expect(options).toEqual(["HEAD", "main", "feature", "origin/feature", "v1.0", "v0.9"]);
  });

  it("resolves the submitted ref, then compares clicked to resolved", async () => {
    const vscode = await boot();
    const input = openCompareWithDialog(`tr[data-hash="${TAG_HASH}"]`);
    submitDialog(input, "v1.0");

    const resolveRequest = latestRequest(vscode.sentMessages, "resolveRef");
    expect(resolveRequest).toEqual({
      command: "resolveRef",
      repo: REPO,
      ref: "v1.0",
      requestId: expect.any(Number)
    });
    expect(requests(vscode.sentMessages, "commitComparison")).toEqual([]);

    receive({
      command: "resolveRef",
      requestId: resolveRequest.requestId,
      hash: "ddd4444dddd",
      error: null
    });
    expect(latestRequest(vscode.sentMessages, "commitComparison")).toEqual({
      command: "commitComparison",
      repo: REPO,
      commitHash: TAG_HASH,
      baseRef: TAG_HASH,
      compareRef: "ddd4444dddd"
    });
    expect(vscode.getState()?.expandedCommit).toMatchObject({
      hash: TAG_HASH,
      comparison: { baseRef: TAG_HASH, compareRef: "ddd4444dddd", compareLabel: "v1.0" }
    });
  });

  it("labels a branch base by name and a typed hash by abbreviation", async () => {
    const vscode = await boot();
    const input = openCompareWithDialog(".gitRef.head");
    submitDialog(input, REMOTE_HASH);
    receive({
      command: "resolveRef",
      requestId: latestRequest(vscode.sentMessages, "resolveRef").requestId,
      hash: "bbb2222bbbb",
      error: null
    });
    expect(latestRequest(vscode.sentMessages, "commitComparison")).toEqual({
      command: "commitComparison",
      repo: REPO,
      commitHash: HEAD_HASH,
      baseRef: HEAD_HASH,
      compareRef: "bbb2222bbbb"
    });
    const comparison = vscode.getState()?.expandedCommit?.comparison;
    expect(comparison?.baseLabel).toBe("main");
    expect(comparison?.compareLabel).toBeUndefined();
  });

  it("shows the error dialog when the ref does not resolve", async () => {
    const vscode = await boot();
    const input = openCompareWithDialog(`tr[data-hash="${TAG_HASH}"]`);
    submitDialog(input, "nope");
    receive({
      command: "resolveRef",
      requestId: latestRequest(vscode.sentMessages, "resolveRef").requestId,
      hash: null,
      error: { message: "'nope' is not a commit.", stderr: null, exitCode: null, task: null }
    });
    expect(requests(vscode.sentMessages, "commitComparison")).toEqual([]);
    const dialogText = element("#dialog").textContent ?? "";
    expect(dialogText).toContain("Unable to resolve ref");
    expect(dialogText).toContain("'nope' is not a commit.");
  });

  it("ignores a stale resolveRef reply", async () => {
    const vscode = await boot();
    submitDialog(openCompareWithDialog(`tr[data-hash="${TAG_HASH}"]`), "v1.0");
    const staleRequestId = latestRequest(vscode.sentMessages, "resolveRef").requestId;
    submitDialog(openCompareWithDialog(`tr[data-hash="${TAG_HASH}"]`), "main");
    const latestRequestId = latestRequest(vscode.sentMessages, "resolveRef").requestId;
    expect(latestRequestId).not.toBe(staleRequestId);

    receive({ command: "resolveRef", requestId: staleRequestId, hash: "ddd4444dddd", error: null });
    expect(requests(vscode.sentMessages, "commitComparison")).toEqual([]);

    receive({
      command: "resolveRef",
      requestId: latestRequestId,
      hash: "eee5555eeee",
      error: null
    });
    expect(latestRequest(vscode.sentMessages, "commitComparison")).toMatchObject({
      commitHash: TAG_HASH,
      baseRef: TAG_HASH,
      compareRef: "eee5555eeee"
    });
  });

  it("does not submit an empty ref", async () => {
    const vscode = await boot();
    openCompareWithDialog(`tr[data-hash="${TAG_HASH}"]`);
    element("#dialogAction").click();
    expect(requests(vscode.sentMessages, "resolveRef")).toEqual([]);
  });
});
