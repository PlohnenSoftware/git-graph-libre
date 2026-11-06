import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitRepoInfo, GitWorktree } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

// Its own file on purpose: the render drives a full page load, and a second
// imported copy of the webview in the same file would answer the same
// messages against a detached table.

const REPO = "/workspace/popup repo";
const HEAD = "a".repeat(40);

function worktree(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: REPO,
    head: HEAD,
    branch: "main",
    detached: false,
    bare: false,
    isMain: false,
    isCurrent: false,
    locked: null,
    prunable: null,
    ...overrides
  };
}

function makeViewState(): GGL.GitGraphViewState {
  return {
    autoCenterCommitDetailsView: false,
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
    initialLoadCommits: 300,
    lastActiveRepo: null,
    loadMoreCommits: 75,
    muteCommitsNotAncestorsOfHead: false,
    muteMergeCommits: false,
    boldCheckedOutCommit: false,
    fetchTagsByDefault: false,
    showTagRemotes: "all",
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
}

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: HEAD,
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

function latest<T extends GGL.RequestMessage["command"]>(
  messages: GGL.RequestMessage[],
  command: T
): Extract<GGL.RequestMessage, { command: T }> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.command === command) return msg as Extract<GGL.RequestMessage, { command: T }>;
  }
  throw new Error(`Missing ${command} request`);
}

const SIDE = "/workspace/popup repo.worktrees/side é";
const STALE = "/workspace/popup repo.worktrees/gone";

async function boot(worktrees: GitWorktree[]) {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const vscodeMock = createVscodeMock();
  setupHtml(makeViewState());
  await import("@/webview/main");
  receive({
    command: "loadRepoInfo",
    requestId: latest(vscodeMock.sentMessages, "loadRepoInfo").requestId,
    repoInfo,
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: latest(vscodeMock.sentMessages, "loadBranches").requestId,
    branches: ["main", "side"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null,
    worktrees,
    upstreams: { main: null, side: null }
  });
  return vscodeMock;
}

const LISTED = [
  worktree({ isMain: true, isCurrent: true }),
  worktree({ path: SIDE, branch: "side" }),
  worktree({ path: STALE, branch: "gone", prunable: { reason: "gone" } })
];

function click(selector: string) {
  const elem = document.querySelector(selector);
  expect(elem).not.toBeNull();
  elem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function rowAction(index: number, action: string) {
  click(`.worktreeRow[data-worktree-index="${index}"] [data-worktree-action="${action}"]`);
}

function popup() {
  return document.getElementById("worktreeList") as HTMLElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Worktrees toolbar popup", () => {
  it("is closed until the toolbar button opens it, and closes from its button, backing and Escape", async () => {
    await boot(LISTED);
    expect(document.getElementById("worktreesBtn")?.getAttribute("title")).toBe("Worktrees");
    expect(popup().hidden).toBe(true);

    click("#worktreesBtn");
    expect(popup().hidden).toBe(false);
    expect(document.querySelectorAll(".worktreeRow")).toHaveLength(3);
    expect(document.getElementById("worktreesBtn")?.getAttribute("aria-pressed")).toBe("true");

    click("#worktreeListClose");
    expect(popup().hidden).toBe(true);

    click("#worktreesBtn");
    click("#worktreeListBacking");
    expect(popup().hidden).toBe(true);

    click("#worktreesBtn");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(popup().hidden).toBe(true);
  });

  it("is available with only the main worktree, since it also creates worktrees", async () => {
    await boot([worktree({ isMain: true, isCurrent: true })]);
    click("#worktreesBtn");
    expect(document.querySelectorAll(".worktreeRow")).toHaveLength(1);
    expect(document.querySelector("[data-worktree-footer='create']")).not.toBeNull();
    expect(document.querySelector("[data-worktree-footer='prune']")).toBeNull();
  });

  it("sends open, switch and copy for the clicked row, closing after open and switch", async () => {
    const mock = await boot(LISTED);
    click("#worktreesBtn");

    rowAction(1, "copyPath");
    expect(latest(mock.sentMessages, "copyToClipboard")).toMatchObject({ data: SIDE });
    expect(popup().hidden).toBe(false);

    rowAction(1, "openNewWindow");
    expect(latest(mock.sentMessages, "openWorktree")).toMatchObject({
      repo: REPO,
      path: SIDE,
      newWindow: true
    });
    expect(popup().hidden).toBe(true);

    click("#worktreesBtn");
    rowAction(1, "openHere");
    expect(latest(mock.sentMessages, "openWorktree")).toMatchObject({
      path: SIDE,
      newWindow: false
    });

    click("#worktreesBtn");
    rowAction(1, "switchGraph");
    expect(latest(mock.sentMessages, "switchGraphToWorktree")).toMatchObject({
      repo: REPO,
      path: SIDE
    });
  });

  it("asks before removing, then reads the worktree's changes through W21's flow", async () => {
    const mock = await boot(LISTED);
    click("#worktreesBtn");
    rowAction(1, "remove");

    expect(document.getElementById("dialog")?.textContent).toContain(SIDE);
    expect(mock.sentMessages.some((msg) => msg.command === "removeWorktree")).toBe(false);
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(latest(mock.sentMessages, "worktreeChanges")).toMatchObject({ path: SIDE });
  });

  it("removes a stale entry at once, without a warning, and repairs through the picker flow", async () => {
    const mock = await boot(LISTED);
    click("#worktreesBtn");

    rowAction(2, "removeStale");
    expect(latest(mock.sentMessages, "removeWorktree")).toMatchObject({
      path: STALE,
      force: false,
      unlock: false
    });

    rowAction(2, "repair");
    expect(latest(mock.sentMessages, "repairWorktree")).toMatchObject({
      path: STALE,
      newPath: null
    });
  });

  it("opens the prune preview and the Create Worktree dialog from the footer", async () => {
    await boot(LISTED);
    click("#worktreesBtn");

    click("[data-worktree-footer='prune']");
    expect(document.getElementById("dialog")?.textContent).toContain(STALE);
    document.getElementById("dialogDismiss")?.dispatchEvent(new MouseEvent("click"));

    click("[data-worktree-footer='create']");
    expect(document.getElementById("dialog")?.textContent).toContain("Create a worktree from HEAD");
  });

  it("redraws when the worktree list changes while open", async () => {
    const mock = await boot(LISTED);
    click("#worktreesBtn");
    expect(document.querySelectorAll(".worktreeRow")).toHaveLength(3);

    click("#refreshBtn");
    receive({
      command: "loadBranches",
      requestId: latest(mock.sentMessages, "loadBranches").requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null,
      worktrees: [LISTED[0] as GitWorktree],
      upstreams: { main: null }
    });
    expect(document.querySelectorAll(".worktreeRow")).toHaveLength(1);
  });
});

const LOCKED_SIDE = [
  worktree({ isMain: true, isCurrent: true }),
  worktree({ path: SIDE, branch: "side", locked: { reason: "usb stick" } })
];

function dialogField(index: number): HTMLInputElement {
  const elem = document.getElementById(`dialogInput${index}`) as HTMLInputElement | null;
  expect(elem).not.toBeNull();
  return elem as HTMLInputElement;
}

function submitDialog() {
  document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
}

function dialogText(): string {
  return document.getElementById("dialog")?.textContent ?? "";
}

describe("the Worktrees popup's lock, unlock and move (W23)", () => {
  it("locks with a typed reason, trimmed, and an empty one locks without a reason", async () => {
    const mock = await boot(LISTED);
    click("#worktreesBtn");

    rowAction(1, "lock");
    expect(dialogText()).toContain(SIDE);
    dialogField(0).value = "  keep é  ";
    submitDialog();
    expect(latest(mock.sentMessages, "lockWorktree")).toMatchObject({
      repo: REPO,
      path: SIDE,
      reason: "keep é"
    });

    rowAction(1, "lock");
    dialogField(0).value = "";
    submitDialog();
    expect(latest(mock.sentMessages, "lockWorktree")).toMatchObject({ path: SIDE, reason: "" });
  });

  it("moves to the typed folder, and sends nothing for an empty folder", async () => {
    const mock = await boot(LISTED);
    click("#worktreesBtn");
    const moves = () => mock.sentMessages.filter((msg) => msg.command === "moveWorktree").length;

    rowAction(1, "move");
    submitDialog();
    expect(moves()).toBe(0);

    const target = "/workspace/moved é dir";
    dialogField(0).value = target;
    dialogField(0).dispatchEvent(new Event("input", { bubbles: true }));
    submitDialog();
    expect(latest(mock.sentMessages, "moveWorktree")).toMatchObject({
      repo: REPO,
      path: SIDE,
      newPath: target
    });
  });

  it("explains a locked worktree's move and offers Unlock first, never a move", async () => {
    const mock = await boot(LOCKED_SIDE);
    click("#worktreesBtn");

    rowAction(1, "move");
    expect(dialogText()).toContain("usb stick");
    expect(dialogText()).toContain("Unlock it first?");
    submitDialog();

    expect(latest(mock.sentMessages, "unlockWorktree")).toMatchObject({ repo: REPO, path: SIDE });
    expect(mock.sentMessages.some((msg) => msg.command === "moveWorktree")).toBe(false);
  });

  it("unlocks at once from the row, which offers Unlock where a locked worktree has Lock", async () => {
    const mock = await boot(LOCKED_SIDE);
    click("#worktreesBtn");
    const row = (action: string) =>
      document.querySelector(
        `.worktreeRow[data-worktree-index="1"] [data-worktree-action="${action}"]`
      );
    expect(row("lock")).toBeNull();
    expect(row("unlock")).not.toBeNull();

    rowAction(1, "unlock");
    expect(latest(mock.sentMessages, "unlockWorktree")).toMatchObject({ repo: REPO, path: SIDE });
  });
});
