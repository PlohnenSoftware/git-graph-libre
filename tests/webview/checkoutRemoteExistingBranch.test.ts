import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo, GitWorktree } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/checkout-remote-existing";
const OTHER_WORKTREE = "/workspace/worktrees/admin é";
const REMOTE_REF = "origin/feat/admin-gui";
const LOCAL_NAME = "feat/admin-gui";

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
  initialLoadCommits: 300,
  lastActiveRepo: null,
  loadMoreCommits: 75,
  muteCommitsNotAncestorsOfHead: false,
  muteMergeCommits: false,
  boldCheckedOutCommit: false,
  fetchTagsByDefault: true,
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

function commitsWithRemoteRef(refName: string): GitCommitNode[] {
  return [
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
      parentHashes: [],
      author: "Bob",
      email: "bob@example.com",
      date: 1_699_000_000,
      message: "Remote commit",
      refs: [{ hash: "def456", name: refName, type: "remote" }]
    }
  ];
}

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

type BootOptions = {
  refName?: string;
  branches: string[];
  upstreams?: Record<string, string | null>;
  worktrees?: GitWorktree[];
};

async function bootWebview(options: BootOptions) {
  vi.resetModules();
  const vscodeMock = createVscodeMock();
  setupHtml(viewState);
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
    branches: options.branches,
    head: "main",
    hard: true,
    isRepo: true,
    error: null,
    worktrees: options.worktrees ?? [worktree({})],
    upstreams: options.upstreams ?? {}
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits: commitsWithRemoteRef(options.refName ?? REMOTE_REF),
    head: "abc123",
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscodeMock;
}

function openCheckoutDialog(refName: string) {
  const remoteRef = Array.from(document.querySelectorAll<HTMLElement>(".gitRef.remote")).find(
    (elem) => elem.textContent?.includes(refName)
  );
  expect(remoteRef).not.toBeUndefined();
  remoteRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

  const checkout = Array.from(
    document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
  ).find((item) => item.textContent === "Checkout Branch…");
  expect(checkout).not.toBeUndefined();
  checkout?.click();
}

function dialogText() {
  return document.querySelector("#dialog")?.textContent ?? "";
}

function submitDialog() {
  document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
}

function dialogChoices() {
  return Array.from(document.querySelectorAll<HTMLElement>("#dialog .dialogChoice"));
}

function clickDialogChoice(text: string) {
  const choice = dialogChoices().find((elem) => elem.textContent?.includes(text));
  expect(choice).not.toBeUndefined();
  choice?.click();
}

function typeIntoDialogInput(index: number, value: string) {
  const input = document.getElementById(`dialogInput${index}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}

function checkoutMessages(vscodeMock: { sentMessages: GGL.RequestMessage[] }) {
  return vscodeMock.sentMessages.filter(
    (msg) => msg.command === "checkoutBranch" || msg.command === "checkoutAndFastForward"
  );
}

describe("checking out a remote branch whose local branch exists (W24)", () => {
  it("offers switch, fast-forward and another name as buttons on a name collision, and switch sends a plain checkout", async () => {
    const vscodeMock = await bootWebview({
      branches: ["main", LOCAL_NAME, `remotes/${REMOTE_REF}`]
    });
    openCheckoutDialog(REMOTE_REF);

    expect(dialogText()).toContain(`A local branch named ${LOCAL_NAME} already exists.`);
    // One button per choice, no native dropdown and no generic submit.
    expect(dialogChoices().map((elem) => elem.textContent)).toEqual([
      `Switch to ${LOCAL_NAME}`,
      `Switch to ${LOCAL_NAME} and fast-forward it to ${REMOTE_REF}`,
      "Create a branch with another name"
    ]);
    expect(document.querySelector("#dialog select")).toBeNull();
    expect(document.getElementById("dialogAction")).toBeNull();
    expect(dialogChoices()[0]?.className).toContain("dialogBtnPrimary");
    expect(document.getElementById("dialogDismiss")?.className).not.toContain("dialogBtnPrimary");

    dialogChoices()[0]?.click();

    expect(checkoutMessages(vscodeMock)).toEqual([
      { command: "checkoutBranch", repo: REPO, branchName: LOCAL_NAME, remoteBranch: null }
    ]);
  });

  it("switch and fast-forward sends checkoutAndFastForward to the clicked remote-tracking ref", async () => {
    const vscodeMock = await bootWebview({
      branches: ["main", LOCAL_NAME, `remotes/${REMOTE_REF}`]
    });
    openCheckoutDialog(REMOTE_REF);
    clickDialogChoice(`fast-forward it to ${REMOTE_REF}`);

    expect(checkoutMessages(vscodeMock)).toEqual([
      { command: "checkoutAndFastForward", repo: REPO, branchName: LOCAL_NAME, target: REMOTE_REF }
    ]);
  });

  it("takes a choice by keyboard, without confirming the name prompt it opens", async () => {
    const vscodeMock = await bootWebview({
      branches: ["main", LOCAL_NAME, `remotes/${REMOTE_REF}`]
    });
    openCheckoutDialog(REMOTE_REF);

    const create = dialogChoices().find((elem) =>
      elem.textContent?.includes("Create a branch with another name")
    );
    create?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    // The name prompt is open, empty and unsubmitted: the same Enter must
    // not have confirmed it through the document-level handler.
    const input = document.getElementById("dialogInput0") as HTMLInputElement | null;
    expect(input?.value).toBe("");
    expect(document.getElementById("dialog")?.className).toContain("noInput");
    expect(checkoutMessages(vscodeMock)).toEqual([]);
  });

  it("finds a local branch tracking the clicked remote branch under another name", async () => {
    const vscodeMock = await bootWebview({
      branches: ["main", "admin-gui", `remotes/${REMOTE_REF}`],
      upstreams: { main: "origin/main", "admin-gui": REMOTE_REF }
    });
    openCheckoutDialog(REMOTE_REF);

    expect(dialogText()).toContain(`The local branch admin-gui already tracks ${REMOTE_REF}.`);
    clickDialogChoice("Switch to admin-gui and");

    expect(checkoutMessages(vscodeMock)).toEqual([
      { command: "checkoutAndFastForward", repo: REPO, branchName: "admin-gui", target: REMOTE_REF }
    ]);
  });

  it("creates a branch with another name from the remote branch", async () => {
    const vscodeMock = await bootWebview({
      branches: ["main", LOCAL_NAME, `remotes/${REMOTE_REF}`]
    });
    openCheckoutDialog(REMOTE_REF);
    clickDialogChoice("Create a branch with another name");

    // The same-name collision leaves no free default to offer.
    const input = document.getElementById("dialogInput0") as HTMLInputElement;
    expect(input.value).toBe("");
    typeIntoDialogInput(0, "feat/admin-copy");
    submitDialog();

    expect(checkoutMessages(vscodeMock)).toEqual([
      {
        command: "checkoutBranch",
        repo: REPO,
        branchName: "feat/admin-copy",
        remoteBranch: REMOTE_REF
      }
    ]);
  });

  it("offers the suggested name in the other-name prompt when a tracking branch leaves it free", async () => {
    const vscodeMock = await bootWebview({
      branches: ["main", "admin-gui", `remotes/${REMOTE_REF}`],
      upstreams: { "admin-gui": REMOTE_REF }
    });
    openCheckoutDialog(REMOTE_REF);
    clickDialogChoice("Create a branch with another name");

    const input = document.getElementById("dialogInput0") as HTMLInputElement;
    expect(input.value).toBe(LOCAL_NAME);
    submitDialog();

    expect(checkoutMessages(vscodeMock)).toEqual([
      { command: "checkoutBranch", repo: REPO, branchName: LOCAL_NAME, remoteBranch: REMOTE_REF }
    ]);
  });

  it("blocks a taken name inline in the other-name prompt, and submits nothing", async () => {
    const vscodeMock = await bootWebview({
      branches: ["main", LOCAL_NAME, `remotes/${REMOTE_REF}`]
    });
    openCheckoutDialog(REMOTE_REF);
    clickDialogChoice("Create a branch with another name");
    typeIntoDialogInput(0, "main");

    const dialog = document.getElementById("dialog");
    expect(dialog?.className).toContain("inputInvalid");
    expect(document.getElementById("dialogAction")?.title).toContain("already exists");
    const before = vscodeMock.sentMessages.length;
    submitDialog();

    expect(vscodeMock.sentMessages).toHaveLength(before);
    expect(checkoutMessages(vscodeMock)).toEqual([]);
  });

  it("offers the worktree, not the switch choices, when another worktree holds the tracking branch", async () => {
    const vscodeMock = await bootWebview({
      branches: ["main", "admin-gui", `remotes/${REMOTE_REF}`],
      upstreams: { "admin-gui": REMOTE_REF },
      worktrees: [
        worktree({}),
        worktree({ path: OTHER_WORKTREE, branch: "admin-gui", isMain: false, isCurrent: false })
      ]
    });
    openCheckoutDialog(REMOTE_REF);

    expect(dialogText()).toContain(OTHER_WORKTREE);
    expect(dialogChoices().map((elem) => elem.textContent)).toEqual([
      "Open in New Window",
      "Create a branch with another name"
    ]);
    dialogChoices()[0]?.click();

    expect(vscodeMock.sentMessages.at(-1)).toEqual({
      command: "openWorktree",
      repo: REPO,
      path: OTHER_WORKTREE,
      newWindow: true
    });
    expect(checkoutMessages(vscodeMock)).toEqual([]);
  });

  it("offers the choices for origin/main while main is checked out (issue #39's case)", async () => {
    const vscodeMock = await bootWebview({
      refName: "origin/main",
      branches: ["main", "remotes/origin/main"],
      upstreams: { main: "origin/main" }
    });
    openCheckoutDialog("origin/main");

    expect(dialogText()).toContain("A local branch named main already exists.");
    clickDialogChoice("fast-forward it to origin/main");

    expect(checkoutMessages(vscodeMock)).toEqual([
      { command: "checkoutAndFastForward", repo: REPO, branchName: "main", target: "origin/main" }
    ]);
  });
});

describe("checking out a remote branch with no local branch (unchanged, W24)", () => {
  it("keeps today's name prompt and sends the remote checkout", async () => {
    const vscodeMock = await bootWebview({ branches: ["main", `remotes/${REMOTE_REF}`] });
    openCheckoutDialog(REMOTE_REF);

    const input = document.getElementById("dialogInput0") as HTMLInputElement;
    expect(input.value).toBe(LOCAL_NAME);
    submitDialog();

    expect(checkoutMessages(vscodeMock)).toEqual([
      { command: "checkoutBranch", repo: REPO, branchName: LOCAL_NAME, remoteBranch: REMOTE_REF }
    ]);
  });

  it("blocks the prompt inline when the name is edited to an existing branch", async () => {
    const vscodeMock = await bootWebview({ branches: ["main", `remotes/${REMOTE_REF}`] });
    openCheckoutDialog(REMOTE_REF);
    typeIntoDialogInput(0, "main");

    expect(document.getElementById("dialog")?.className).toContain("inputInvalid");
    expect(document.getElementById("dialogAction")?.title).toContain("already exists");
    const before = vscodeMock.sentMessages.length;
    submitDialog();

    expect(vscodeMock.sentMessages).toHaveLength(before);
    expect(checkoutMessages(vscodeMock)).toEqual([]);
  });
});
