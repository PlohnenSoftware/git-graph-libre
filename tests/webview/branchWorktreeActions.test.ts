import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitQueryError, GitRepoInfo, GitWorktree } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/branch-worktree-actions";
const OTHER_WORKTREE = "/workspace/worktrees/feature menu é";
const REMOTE_REF = "origin/feature/menu";

const defaultViewState: GGL.GitGraphViewState = {
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
  initialLoadCommits: 300,
  lastActiveRepo: null,
  loadMoreCommits: 75,
  muteCommitsNotAncestorsOfHead: false,
  muteMergeCommits: false,
  boldCheckedOutCommit: false,
  fetchTagsByDefault: true,
  showTagRemotes: true,
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

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
  authors: ["Alice"],
  tags: [],
  remotes: [
    {
      name: "origin",
      fetchUrls: ["https://example.test/repo.git"],
      pushUrls: ["https://example.test/repo.git"]
    }
  ],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  }
};

const commits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: ["def456"],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: "Head commit",
    refs: [{ hash: "abc123", name: "main", type: "head" }]
  },
  {
    hash: "def456",
    parentHashes: ["fed789"],
    author: "Bob",
    email: "bob@example.com",
    date: 1_699_000_000,
    message: "Remote commit",
    refs: [{ hash: "def456", name: REMOTE_REF, type: "remote" }]
  },
  {
    hash: "fed789",
    parentHashes: [],
    author: "Bob",
    email: "bob@example.com",
    date: 1_698_000_000,
    message: "Local commit",
    refs: [{ hash: "fed789", name: "feature/menu", type: "head" }]
  }
];

function worktree(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: REPO,
    head: "abc123",
    branch: "main",
    detached: false,
    bare: false,
    isMain: true,
    isCurrent: true,
    locked: null,
    prunable: null,
    ...overrides
  };
}

const WORKTREES_WITH_FEATURE: GitWorktree[] = [
  worktree({}),
  worktree({ path: OTHER_WORKTREE, branch: "feature/menu", isMain: false, isCurrent: false })
];

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

async function bootWebview(worktrees: GitWorktree[]) {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const vscodeMock = createVscodeMock();
  setupHtml(defaultViewState);
  await import("@/webview/main");

  receive({
    command: "loadRepoInfo",
    requestId: latestRequest(vscodeMock.sentMessages, "loadRepoInfo").requestId,
    repoInfo,
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: latestRequest(vscodeMock.sentMessages, "loadBranches").requestId,
    branches: ["main", "feature/menu", `remotes/${REMOTE_REF}`],
    head: "main",
    hard: true,
    isRepo: true,
    error: null,
    worktrees,
    upstreams: { main: "origin/main", "feature/menu": REMOTE_REF }
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits,
    head: "abc123",
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscodeMock;
}

function openRefContextMenu(kind: "head" | "remote") {
  const ref = Array.from(document.querySelectorAll<HTMLElement>(`.gitRef.${kind}`)).find((elem) =>
    elem.dataset.name?.includes("feature/menu")
  );
  expect(ref).not.toBeUndefined();
  ref?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
}

function contextMenuItems() {
  return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).map(
    (item) => item.textContent ?? ""
  );
}

function contextMenuHeader() {
  return document.querySelector("#contextMenu .contextMenuHeader")?.textContent ?? null;
}

function clickContextMenuItem(text: string) {
  const item = Array.from(document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem"))
    .filter((elem) => elem.textContent === text)
    .at(0);
  expect(item).not.toBeUndefined();
  item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function dialogText() {
  return document.querySelector("#dialog")?.textContent ?? "";
}

function submitDialog() {
  document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
}

describe("a local branch checked out in another worktree", () => {
  it("offers Open Worktree instead of Checkout and drops Pull, and says why in a header", async () => {
    await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("head");

    const items = contextMenuItems();
    expect(items).toContain("Open Worktree…");
    expect(items).not.toContain("Checkout Branch");
    expect(items).not.toContain("Pull Branch…");
    // Reads and the rename stay available.
    expect(items).toEqual(
      expect.arrayContaining(["Rename Branch…", "Delete Branch…", "Merge into current branch…"])
    );
    expect(contextMenuHeader()).toContain("Checked out in another worktree");
    expect(contextMenuHeader()).toContain(OTHER_WORKTREE);
  });

  it("keeps Checkout and Pull, with no header, when no other worktree has the branch", async () => {
    await bootWebview([worktree({})]);
    openRefContextMenu("head");

    const items = contextMenuItems();
    expect(items).toContain("Checkout Branch");
    expect(items).toContain("Pull Branch…");
    expect(items).not.toContain("Open Worktree…");
    expect(contextMenuHeader()).toBeNull();
  });

  it("leaves the current worktree's own branch with its usual menu", async () => {
    // The current worktree is left out of the map, so main keeps its usual menu.
    await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("head");
    expect(contextMenuItems()).not.toContain("Checkout Branch");

    const main = Array.from(document.querySelectorAll<HTMLElement>(".gitRef.head")).find(
      (elem) => elem.dataset.name === "main"
    );
    main?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuHeader()).toBeNull();
    expect(contextMenuItems()).toContain("Pull Branch…");
  });

  it("names the worktree in a dialog and copies its path, starting no Git action", async () => {
    const vscodeMock = await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("head");
    clickContextMenuItem("Open Worktree…");

    expect(dialogText()).toContain(OTHER_WORKTREE);
    expect(dialogText()).toContain("feature/menu");
    submitDialog();

    expect(vscodeMock.sentMessages.at(-1)).toEqual({
      command: "copyToClipboard",
      type: "File Path",
      data: OTHER_WORKTREE
    });
    expect(vscodeMock.sentMessages.some((msg) => msg.command === "checkoutBranch")).toBe(false);
  });

  it("explains instead of deleting, and submits nothing, when the main worktree holds the branch", async () => {
    // Only the main worktree can never be removed, so only it keeps the explanation.
    const vscodeMock = await bootWebview([
      worktree({ path: OTHER_WORKTREE, branch: "main", isMain: false, isCurrent: true }),
      worktree({ path: REPO, branch: "feature/menu", isMain: true, isCurrent: false })
    ]);
    const before = vscodeMock.sentMessages.length;
    openRefContextMenu("head");
    clickContextMenuItem("Delete Branch…");

    expect(dialogText()).toContain(REPO);
    expect(document.getElementById("dialogAction")).toBeNull();
    expect(vscodeMock.sentMessages).toHaveLength(before);
  });

  it("notes in the rename dialog that the other worktree follows, and still renames", async () => {
    const vscodeMock = await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("head");
    clickContextMenuItem("Rename Branch…");

    expect(dialogText()).toContain("follows the new name");
    expect(dialogText()).toContain(OTHER_WORKTREE);
    const input = document.getElementById("dialogInput0") as HTMLInputElement;
    input.value = "feature/renamed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    submitDialog();

    expect(latestRequest(vscodeMock.sentMessages, "renameBranch")).toMatchObject({
      oldName: "feature/menu",
      newName: "feature/renamed"
    });
  });

  it("does not add a rename note when the branch is not checked out elsewhere", async () => {
    await bootWebview([worktree({})]);
    openRefContextMenu("head");
    clickContextMenuItem("Rename Branch…");

    expect(dialogText()).not.toContain("follows the new name");
  });
});

describe("a remote branch whose local branch is checked out in another worktree", () => {
  it("offers Open Worktree and Pull, but not Checkout or Fetch into local branch", async () => {
    await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("remote");

    const items = contextMenuItems();
    expect(items[0]).toBe("Open Worktree…");
    expect(items).not.toContain("Checkout Branch…");
    expect(items).not.toContain("Fetch into local branch…");
    // Pulling the remote branch merges it into the current branch, which Git allows.
    expect(items).toContain("Pull Branch…");
    expect(contextMenuHeader()).toContain(OTHER_WORKTREE);
  });

  it("keeps Checkout and Fetch into local branch when no worktree holds the local branch", async () => {
    await bootWebview([worktree({})]);
    openRefContextMenu("remote");

    const items = contextMenuItems();
    expect(items).toContain("Checkout Branch…");
    expect(items).toContain("Fetch into local branch…");
    expect(contextMenuHeader()).toBeNull();
  });
});

function tickDialogCheckbox(index: number) {
  const box = document.getElementById(`dialogInput${index}`) as HTMLInputElement;
  box.checked = true;
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

function removeWorktreeRequests(vscodeMock: { sentMessages: GGL.RequestMessage[] }) {
  return vscodeMock.sentMessages.filter((msg) => msg.command === "removeWorktree");
}

function answerChanges(
  vscodeMock: { sentMessages: GGL.RequestMessage[] },
  files: string[],
  extra: { truncated?: boolean; error?: GitQueryError | null } = {}
) {
  const request = latestRequest(vscodeMock.sentMessages, "worktreeChanges");
  receive({
    command: "worktreeChanges",
    requestId: request.requestId,
    path: request.path,
    files,
    truncated: extra.truncated ?? false,
    error: extra.error ?? null
  });
}

describe("removing the worktree that holds a branch (W21)", () => {
  it("offers the removal as an unchecked option, and a dialog left unchecked sends nothing", async () => {
    const vscodeMock = await bootWebview(WORKTREES_WITH_FEATURE);
    const before = vscodeMock.sentMessages.length;
    openRefContextMenu("head");
    clickContextMenuItem("Delete Branch…");

    expect(dialogText()).toContain(OTHER_WORKTREE);
    expect(dialogText()).toContain("Also remove the worktree at");
    expect((document.getElementById("dialogInput0") as HTMLInputElement).checked).toBe(false);
    submitDialog();

    expect(vscodeMock.sentMessages).toHaveLength(before);
  });

  it("removes a clean worktree with plain remove, then the branch", async () => {
    const vscodeMock = await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("head");
    clickContextMenuItem("Delete Branch…");
    tickDialogCheckbox(0);
    submitDialog();

    // The files it would lose are read first, and nothing is removed yet.
    expect(latestRequest(vscodeMock.sentMessages, "worktreeChanges").path).toBe(OTHER_WORKTREE);
    expect(removeWorktreeRequests(vscodeMock)).toHaveLength(0);

    answerChanges(vscodeMock, []);

    expect(latestRequest(vscodeMock.sentMessages, "removeWorktree")).toMatchObject({
      path: OTHER_WORKTREE,
      force: false,
      unlock: false,
      deleteBranch: { branchName: "feature/menu", forceDelete: false }
    });
  });

  it("names the files a forced removal deletes, and forces only after the second confirmation", async () => {
    const vscodeMock = await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("head");
    clickContextMenuItem("Delete Branch…");
    tickDialogCheckbox(0);
    submitDialog();

    answerChanges(vscodeMock, ["notes é.txt", "src/edited.ts"], { truncated: true });

    expect(removeWorktreeRequests(vscodeMock)).toHaveLength(0);
    expect(dialogText()).toContain("deleted permanently");
    expect(dialogText()).toContain("notes é.txt");
    expect(dialogText()).toContain("src/edited.ts");
    expect(dialogText()).toContain("more files");
    submitDialog();

    expect(latestRequest(vscodeMock.sentMessages, "removeWorktree")).toMatchObject({
      path: OTHER_WORKTREE,
      force: true,
      unlock: false
    });
  });

  it("never forces after an unreadable status: Git's refusal stays the guard", async () => {
    const vscodeMock = await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("head");
    clickContextMenuItem("Delete Branch…");
    tickDialogCheckbox(0);
    submitDialog();

    answerChanges(vscodeMock, [], {
      error: { message: "boom", stderr: null, exitCode: null, task: null }
    });

    expect(latestRequest(vscodeMock.sentMessages, "removeWorktree").force).toBe(false);
  });

  it("says a locked worktree is unlocked first, and asks for that, never a double force", async () => {
    const vscodeMock = await bootWebview([
      worktree({}),
      worktree({
        path: OTHER_WORKTREE,
        branch: "feature/menu",
        isMain: false,
        isCurrent: false,
        locked: { reason: "on a usb stick" }
      })
    ]);
    openRefContextMenu("head");
    clickContextMenuItem("Delete Branch…");

    expect(dialogText()).toContain("on a usb stick");
    expect(dialogText()).toContain("unlocked");
    tickDialogCheckbox(0);
    submitDialog();
    answerChanges(vscodeMock, []);

    expect(latestRequest(vscodeMock.sentMessages, "removeWorktree")).toMatchObject({
      unlock: true,
      force: false
    });
  });

  it("removes a stale entry at once, with no read and no data-loss warning", async () => {
    const vscodeMock = await bootWebview([
      worktree({}),
      worktree({
        path: OTHER_WORKTREE,
        branch: "feature/menu",
        isMain: false,
        isCurrent: false,
        prunable: { reason: "gitdir file points to non-existent location" }
      })
    ]);
    openRefContextMenu("head");
    clickContextMenuItem("Delete Branch…");

    expect(dialogText()).toContain("nothing on disk is deleted");
    tickDialogCheckbox(0);
    submitDialog();

    expect(vscodeMock.sentMessages.some((msg) => msg.command === "worktreeChanges")).toBe(false);
    expect(latestRequest(vscodeMock.sentMessages, "removeWorktree")).toMatchObject({
      path: OTHER_WORKTREE,
      force: false
    });
  });
});

describe("stale and moved worktrees (W21)", () => {
  const STALE = "/workspace/worktrees/gone é";
  const LOCKED_STALE = "/workspace/worktrees/gone locked";
  const withStale = [
    ...WORKTREES_WITH_FEATURE.slice(0, 1),
    worktree({
      path: OTHER_WORKTREE,
      branch: "feature/menu",
      isMain: false,
      isCurrent: false,
      prunable: { reason: "gitdir file points to non-existent location" }
    }),
    worktree({
      path: STALE,
      branch: null,
      detached: true,
      isMain: false,
      isCurrent: false,
      prunable: { reason: "gitdir file points to non-existent location" }
    }),
    worktree({
      path: LOCKED_STALE,
      branch: null,
      detached: true,
      isMain: false,
      isCurrent: false,
      locked: { reason: "keep" },
      prunable: { reason: "gitdir file points to non-existent location" }
    })
  ];

  it("offers Remove, Repair and Prune for a branch whose worktree folder is gone", async () => {
    const vscodeMock = await bootWebview(withStale);
    openRefContextMenu("head");

    expect(contextMenuItems()).toEqual(
      expect.arrayContaining([
        "Remove Stale Worktree Entry",
        "Repair Worktree…",
        "Prune Stale Worktrees…"
      ])
    );

    clickContextMenuItem("Repair Worktree…");
    expect(latestRequest(vscodeMock.sentMessages, "repairWorktree")).toEqual({
      command: "repairWorktree",
      repo: REPO,
      path: OTHER_WORKTREE,
      newPath: null
    });
  });

  it("removes the stale entry from the menu without a confirmation", async () => {
    const vscodeMock = await bootWebview(withStale);
    openRefContextMenu("head");
    clickContextMenuItem("Remove Stale Worktree Entry");

    expect(latestRequest(vscodeMock.sentMessages, "removeWorktree")).toMatchObject({
      path: OTHER_WORKTREE,
      force: false
    });
  });

  it("previews the entries prune removes, leaving a locked one out, then prunes", async () => {
    const vscodeMock = await bootWebview(withStale);
    openRefContextMenu("head");
    clickContextMenuItem("Prune Stale Worktrees…");

    expect(dialogText()).toContain(OTHER_WORKTREE);
    expect(dialogText()).toContain(STALE);
    expect(dialogText()).not.toContain(LOCKED_STALE);
    expect(vscodeMock.sentMessages.some((msg) => msg.command === "pruneWorktrees")).toBe(false);
    submitDialog();

    expect(latestRequest(vscodeMock.sentMessages, "pruneWorktrees")).toEqual({
      command: "pruneWorktrees",
      repo: REPO
    });
  });

  it("shows none of these items when no worktree is stale", async () => {
    await bootWebview(WORKTREES_WITH_FEATURE);
    openRefContextMenu("head");

    const items = contextMenuItems();
    expect(items).not.toContain("Remove Stale Worktree Entry");
    expect(items).not.toContain("Repair Worktree…");
    expect(items).not.toContain("Prune Stale Worktrees…");
  });
});
