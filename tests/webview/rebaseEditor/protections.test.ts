import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GitCommitNode,
  GitRebaseRangeCommit,
  GitRebaseRangeResult,
  GitRepoInfo,
  GitWorktree
} from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import type * as GGL from "@/types";
import {
  canStartInteractiveRebase,
  createRebaseEditorState,
  evaluateInteractiveRebaseMenuState,
  findOtherWorktreeForBranch,
  type InteractiveRebaseStartPayload,
  openRebaseEditorDialog,
  setAutostash,
  setLongRangeConfirmPending,
  setPublishedAcked,
  setRebaseRowAction
} from "@/webview/rebaseEditor";

import { createVscodeMock, receive, setupHtml } from "../setup";

const strings = getWebviewLocalizedStrings();
const REPO = "/workspace/rebase-protections";
const OTHER_WORKTREE = "/workspace/worktrees/feature-other";

const ROOT_HASH = "0000000000000000000000000000000000000000";
const HASH_A = "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
const HASH_B = "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";
const HASH_C = "cccc3333cccc3333cccc3333cccc3333cccc3333";

function makeCommit(
  hash: string,
  subject: string,
  overrides: Partial<GitRebaseRangeCommit> = {}
): GitRebaseRangeCommit {
  return {
    hash,
    subject,
    body: "",
    author: "Alice",
    email: "alice@example.test",
    parents: [ROOT_HASH],
    isMerge: false,
    isPublished: false,
    ...overrides
  };
}

function makeRange(overrides: Partial<GitRebaseRangeResult> = {}): GitRebaseRangeResult {
  const commits = overrides.commits ?? [
    makeCommit(HASH_A, "Commit A"),
    makeCommit(HASH_B, "Commit B", { parents: [HASH_A] }),
    makeCommit(HASH_C, "Commit C", { parents: [HASH_B] })
  ];
  return {
    commits,
    mergeCount: commits.filter((c) => c.isMerge).length,
    dirty: false,
    hasUntracked: false,
    inProgress: false,
    inProgressKind: null,
    detached: false,
    branch: "feature",
    upstream: "origin/feature",
    alreadyUsedElsewhere: false,
    tooLong: false,
    preflight: { canStart: true, reasons: [] },
    error: null,
    ...overrides
  };
}

function mountDialogDom(): { dialog: HTMLElement; dialogBacking: HTMLElement } {
  (globalThis as unknown as { l10n: typeof strings }).l10n = strings;
  document.body.innerHTML = '<div id="dialogBacking"></div><div id="dialog"></div>';
  const dialog = document.getElementById("dialog");
  const dialogBacking = document.getElementById("dialogBacking");
  if (dialog === null || dialogBacking === null) {
    throw new Error("Missing dialog DOM elements");
  }
  return { dialog, dialogBacking };
}

function worktreeEntry(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: REPO,
    head: HASH_C,
    branch: "feature",
    detached: false,
    bare: false,
    isMain: true,
    isCurrent: true,
    locked: null,
    prunable: null,
    ...overrides
  };
}

describe("rebaseEditor protections (unit & dialog)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (globalThis as unknown as { l10n: typeof strings }).l10n = strings;
  });

  it("offers autostash choice with explanation on a dirty tree and gates Start until opted in", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const starts: InteractiveRebaseStartPayload[] = [];
    let cancelled = 0;

    const range = makeRange({
      dirty: true,
      preflight: { canStart: false, reasons: ["dirty"] }
    });
    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(range, { base: ROOT_HASH, baseLabel: "main" }),
      { shortHashLength: 8 },
      {
        onStart: (payload) => starts.push(payload),
        onCancel: () => {
          cancelled += 1;
        }
      }
    );

    const dirtyNotice = dialog.querySelector(".rebaseEditorNotice-dirty");
    expect(dirtyNotice?.classList.contains("rebaseEditorNotice-error")).toBe(true);
    expect(dirtyNotice?.textContent).toContain(strings.rebasePreflightDirty);
    expect(dirtyNotice?.textContent).toContain(strings.rebaseDirtyExplain);

    const autostashInput = dialog.querySelector<HTMLInputElement>("#rebaseEditorAutostash");
    expect(autostashInput).not.toBeNull();
    expect(autostashInput?.checked).toBe(false);
    expect(autostashInput?.closest("label")?.classList.contains("checkRow")).toBe(true);

    // Modifying a row still leaves Start disabled while dirty and autostash is unchecked
    const select = dialog.querySelectorAll<HTMLSelectElement>(".rebaseEditorActionSelect")[1];
    select.value = "drop";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(true);

    // Checking autostash clears the dirty blocker and switches notice severity
    const checkbox = dialog.querySelector<HTMLInputElement>("#rebaseEditorAutostash");
    if (checkbox === null) throw new Error("Missing autostash checkbox");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    expect(controller.getState().autostash).toBe(true);
    expect(
      dialog
        .querySelector(".rebaseEditorNotice-dirty")
        ?.classList.contains("rebaseEditorNotice-info")
    ).toBe(true);
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(false);

    // Clicking Start sends autostash: true
    dialog
      .querySelector<HTMLButtonElement>("#dialogAction")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(starts).toHaveLength(1);
    expect(starts[0]?.autostash).toBe(true);

    // Cancel button cancels cleanly
    dialog
      .querySelector<HTMLButtonElement>("#dialogDismiss")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cancelled).toBe(1);
  });

  it("keeps Start blocked when dirty autostash is checked alongside another preflight blocker", () => {
    const state = createRebaseEditorState(
      makeRange({
        dirty: true,
        inProgress: true,
        inProgressKind: "rebase",
        preflight: { canStart: false, reasons: ["inProgress", "dirty"] }
      }),
      { base: ROOT_HASH, baseLabel: "main" }
    );
    const modified = setAutostash(setRebaseRowAction(state, 1, "drop"), true);
    expect(canStartInteractiveRebase(modified)).toBe(false);
  });

  it("requires IQ5 published-commit acknowledgement by default, lists published commits, and never offers force push", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const starts: InteractiveRebaseStartPayload[] = [];
    const range = makeRange({
      commits: [
        makeCommit(HASH_A, "Already pushed <b>commit</b>", { isPublished: true }),
        makeCommit(HASH_B, "Second pushed commit", { isPublished: true, parents: [HASH_A] }),
        makeCommit(HASH_C, "Local commit", { isPublished: false, parents: [HASH_B] })
      ]
    });

    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(range, { base: ROOT_HASH, baseLabel: "main" }),
      { shortHashLength: 8 },
      { onStart: (payload) => starts.push(payload), onCancel: () => undefined }
    );

    expect(controller.getState().requirePublishedAck).toBe(true);
    const publishedItems = Array.from(dialog.querySelectorAll(".rebaseEditorPublishedItem"));
    expect(publishedItems).toHaveLength(2);
    expect(publishedItems[0]?.textContent).toContain("aaaa1111");
    expect(publishedItems[0]?.textContent).toContain("Already pushed <b>commit</b>");
    expect(dialog.querySelector(".rebaseEditorPublishedList b")).toBeNull();
    expect(publishedItems[1]?.textContent).toContain("bbbb2222");

    const ackCheckbox = dialog.querySelector<HTMLInputElement>("#rebaseEditorPublishedAck");
    expect(ackCheckbox).not.toBeNull();
    expect(ackCheckbox?.checked).toBe(false);
    expect(ackCheckbox?.closest("label")?.classList.contains("checkRow")).toBe(true);

    // Modifying a row leaves Start disabled until IQ5 acknowledgement is checked
    const select = dialog.querySelectorAll<HTMLSelectElement>(".rebaseEditorActionSelect")[2];
    select.value = "drop";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(true);

    // Check acknowledgement -> Start enables
    const ackAfterEdit = dialog.querySelector<HTMLInputElement>("#rebaseEditorPublishedAck");
    if (ackAfterEdit === null) throw new Error("Missing published ack checkbox");
    ackAfterEdit.checked = true;
    ackAfterEdit.dispatchEvent(new Event("change", { bubbles: true }));
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(false);

    // Uncheck acknowledgement -> Start disables again
    const ackChecked = dialog.querySelector<HTMLInputElement>("#rebaseEditorPublishedAck");
    if (ackChecked === null) throw new Error("Missing published ack checkbox");
    ackChecked.checked = false;
    ackChecked.dispatchEvent(new Event("change", { bubbles: true }));
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(true);

    // Re-check and start
    const ackRecheck = dialog.querySelector<HTMLInputElement>("#rebaseEditorPublishedAck");
    if (ackRecheck === null) throw new Error("Missing published ack checkbox");
    ackRecheck.checked = true;
    ackRecheck.dispatchEvent(new Event("change", { bubbles: true }));
    dialog
      .querySelector<HTMLButtonElement>("#dialogAction")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(starts).toHaveLength(1);
    expect("forcePush" in starts[0]).toBe(false);
  });

  it("caps the visible published-commit list at 12 and shows a +N more summary", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const commits = Array.from({ length: 15 }, (_, idx) =>
      makeCommit(`${String(idx).padStart(40, "a")}`, `Published ${idx + 1}`, { isPublished: true })
    );
    openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(makeRange({ commits }), { base: ROOT_HASH, baseLabel: "main" }),
      { shortHashLength: 8 },
      { onStart: () => undefined, onCancel: () => undefined }
    );

    expect(dialog.querySelectorAll(".rebaseEditorPublishedItem")).toHaveLength(12);
    expect(dialog.querySelector(".rebaseEditorPublishedMore")?.textContent).toBe("+3 more");
  });

  it("shows checked-out worktree path and Open Worktree button when alreadyUsedElsewhere blocks start", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const opened: string[] = [];

    openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(
        makeRange({
          alreadyUsedElsewhere: true,
          preflight: { canStart: false, reasons: ["alreadyUsedElsewhere"] }
        }),
        { base: ROOT_HASH, baseLabel: "main", otherWorktreePath: OTHER_WORKTREE }
      ),
      { shortHashLength: 8 },
      {
        onStart: () => undefined,
        onCancel: () => undefined,
        onOpenWorktree: (worktreePath) => opened.push(worktreePath)
      }
    );

    const errorNotice = dialog.querySelector('[data-reason="alreadyUsedElsewhere"]');
    expect(errorNotice?.textContent).toContain(OTHER_WORKTREE);
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(true);

    const openBtn = dialog.querySelector<HTMLButtonElement>("#rebaseEditorOpenWorktree");
    expect(openBtn?.textContent).toBe(`${strings.openWorktree}…`);
    openBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(opened).toEqual([OTHER_WORKTREE]);
  });

  it("points at the F2-03 banner when a rebase is already in progress", () => {
    const { dialog, dialogBacking } = mountDialogDom();

    openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(
        makeRange({
          inProgress: true,
          inProgressKind: "rebase",
          preflight: { canStart: false, reasons: ["inProgress"] }
        }),
        { base: ROOT_HASH, baseLabel: "main" }
      ),
      { shortHashLength: 8 },
      { onStart: () => undefined, onCancel: () => undefined }
    );

    const notice = dialog.querySelector('[data-reason="inProgress"]');
    expect(notice?.textContent).toContain(strings.rebasePreflightRebaseInProgress);
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(true);
  });

  it("asks for confirmation before starting a very long range and preserves edits if cancelled", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const starts: InteractiveRebaseStartPayload[] = [];

    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(makeRange({ tooLong: true }), {
        base: ROOT_HASH,
        baseLabel: "main"
      }),
      { shortHashLength: 8 },
      { onStart: (payload) => starts.push(payload), onCancel: () => undefined }
    );

    expect(dialog.querySelector(".rebaseEditorNotice-tooLong")?.textContent).toContain("3 commits");

    // Modify second row so Start is enabled
    const select = dialog.querySelectorAll<HTMLSelectElement>(".rebaseEditorActionSelect")[1];
    select.value = "drop";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    // First Start click opens confirmation prompt instead of starting
    dialog
      .querySelector<HTMLButtonElement>("#dialogAction")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(starts).toHaveLength(0);
    expect(controller.getState().longRangeConfirmPending).toBe(true);
    expect(dialog.querySelector("#rebaseEditorLongRangePrompt")?.textContent).toContain(
      "3 commits"
    );

    // Cancelling the prompt preserves the edited todo
    dialog
      .querySelector<HTMLButtonElement>("#rebaseEditorCancelLongRange")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(controller.getState().longRangeConfirmPending).toBe(false);
    expect(controller.getState().rows[1]?.action).toBe("drop");
    expect(dialog.querySelector("#rebaseEditorLongRangePrompt")).toBeNull();
    expect(starts).toHaveLength(0);

    // Ctrl+Enter opens the prompt again; confirming starts the rebase
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })
    );
    expect(controller.getState().longRangeConfirmPending).toBe(true);
    expect(starts).toHaveLength(0);

    dialog
      .querySelector<HTMLButtonElement>("#rebaseEditorConfirmLongRange")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(starts).toHaveLength(1);
    expect(starts[0]?.entries[1]?.action).toBe("drop");

    // Pure model setters clear longRangeConfirmPending cleanly
    const pending = setLongRangeConfirmPending(
      setPublishedAcked(controller.getState(), true),
      true
    );
    expect(pending.longRangeConfirmPending).toBe(true);
    expect(setPublishedAcked(pending, false).longRangeConfirmPending).toBe(false);
  });

  it("evaluates menu disabled states for in-progress rebase and branch in another worktree", () => {
    const worktrees = [
      worktreeEntry({ path: REPO, isCurrent: true }),
      worktreeEntry({ path: OTHER_WORKTREE, isMain: false, isCurrent: false })
    ];
    expect(findOtherWorktreeForBranch(worktrees, "feature")?.path).toBe(OTHER_WORKTREE);
    expect(findOtherWorktreeForBranch(worktrees, null)).toBeNull();

    expect(
      evaluateInteractiveRebaseMenuState({
        operationState: {
          kind: "rebase",
          rebase: {
            backend: "merge",
            stoppedHash: HASH_B,
            subject: "Commit B",
            current: 1,
            total: 2,
            branch: "feature",
            onto: ROOT_HASH,
            stopReason: "edit"
          },
          conflictFiles: [],
          error: null
        },
        currentBranch: "feature",
        worktrees
      })
    ).toEqual({
      disabled: true,
      kind: "inProgress",
      reason: strings.rebaseMenuDisabledInProgress
    });

    expect(
      evaluateInteractiveRebaseMenuState({
        operationState: null,
        currentBranch: "feature",
        worktrees
      })
    ).toEqual({
      disabled: true,
      kind: "worktree",
      reason: strings.rebaseMenuDisabledWorktree.replace("{0}", OTHER_WORKTREE),
      worktreePath: OTHER_WORKTREE
    });

    expect(
      evaluateInteractiveRebaseMenuState({
        operationState: null,
        currentBranch: "feature",
        worktrees: [worktreeEntry({ path: REPO, isCurrent: true })]
      })
    ).toEqual({ disabled: false });
  });

  it("keeps protection CSS on VS Code theme tokens, OKLCH fallbacks, and forced-colors", () => {
    const editorCss = readFileSync(join(process.cwd(), "media", "rebase-editor.css"), "utf8");
    const checkboxCss = readFileSync(join(process.cwd(), "media", "checkbox.css"), "utf8");
    const dialogsCss = readFileSync(join(process.cwd(), "media", "dialogs.css"), "utf8");

    expect(checkboxCss).toContain('.rebaseEditorCheckbox[type="checkbox"],');
    expect(editorCss).toContain(".rebaseEditorCheckRow");
    expect(editorCss).toContain(".rebaseEditorPublishedList");
    expect(editorCss).toContain(".rebaseEditorLongRangePrompt");
    expect(editorCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(editorCss).not.toMatch(/\brgba?\s*\(/i);
    expect(editorCss).not.toMatch(/\bhsla?\s*\(/i);
    expect(editorCss).not.toContain("in srgb");

    expect(dialogsCss).toContain("#contextMenu li.contextMenuItem.contextMenuItemDisabled");
    expect(dialogsCss).toContain(".contextMenuItemReason");
    expect(dialogsCss).toContain("overflow-wrap: anywhere;");
    expect(dialogsCss).not.toMatch(/background-color:\s*transparent\b/);
  });
});

/* Full webview integration tests: context-menu disabled states, autostash & stderr refusal */

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
  head: "feature",
  headCommit: HASH_C,
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

const graphCommits: GitCommitNode[] = [
  {
    hash: HASH_C,
    parentHashes: [HASH_B],
    author: "Alice",
    email: "alice@example.test",
    date: 1_700_000_300,
    message: "Commit C",
    refs: [{ hash: HASH_C, name: "feature", type: "head" }]
  },
  {
    hash: HASH_B,
    parentHashes: [HASH_A],
    author: "Alice",
    email: "alice@example.test",
    date: 1_700_000_200,
    message: "Commit B",
    refs: []
  },
  {
    hash: HASH_A,
    parentHashes: [],
    author: "Alice",
    email: "alice@example.test",
    date: 1_700_000_100,
    message: "Commit A",
    refs: [{ hash: HASH_A, name: "main", type: "head" }]
  }
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

async function bootWebview(worktrees: GitWorktree[] = []) {
  vi.resetModules();
  const vscodeMock = createVscodeMock();
  setupHtml(defaultViewState);
  const topBar = document.getElementById("topBar");
  const bannerSlot = document.createElement("div");
  bannerSlot.id = "rebaseBannerSlot";
  topBar?.appendChild(bannerSlot);
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
    branches: ["feature", "main"],
    head: "feature",
    hard: true,
    isRepo: true,
    error: null,
    worktrees,
    upstreams: {}
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits: graphCommits,
    head: HASH_C,
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscodeMock;
}

describe("rebaseEditor protections webview integration", () => {
  it("disables Interactive Rebase in commit and branch menus with worktree path and offers Open Worktree", async () => {
    const vscodeMock = await bootWebview([
      worktreeEntry({ path: REPO, isCurrent: true }),
      worktreeEntry({ path: OTHER_WORKTREE, isMain: false, isCurrent: false })
    ]);

    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    const disabledItem = document.querySelector<HTMLElement>(
      "#contextMenu .contextMenuItemDisabled"
    );
    expect(disabledItem).not.toBeNull();
    expect(disabledItem?.getAttribute("aria-disabled")).toBe("true");
    expect(disabledItem?.textContent).toContain("Interactive Rebase…");
    expect(disabledItem?.textContent).toContain(`Checked out at ${OTHER_WORKTREE}`);

    // Clicking the disabled item does not request rebaseRange
    disabledItem?.click();
    expect(vscodeMock.sentMessages.some((m) => m.command === "rebaseRange")).toBe(false);

    // Open Worktree… is offered right beside it and opens the W31 dialog
    const openWorktreeItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((el) => el.textContent === `${strings.openWorktree}…`);
    expect(openWorktreeItem).toBeDefined();
    openWorktreeItem?.click();
    expect(document.getElementById("dialog")?.textContent).toContain(OTHER_WORKTREE);
  });

  it("disables Interactive Rebase in menus when a rebase is already in progress and points at the F2-03 banner", async () => {
    const vscodeMock = await bootWebview();

    const opReq = latestRequest(vscodeMock.sentMessages, "operationState");
    receive({
      command: "operationState",
      requestId: opReq.requestId,
      repo: REPO,
      kind: "rebase",
      rebase: {
        backend: "merge",
        stoppedHash: HASH_B,
        subject: "Commit B",
        current: 1,
        total: 2,
        branch: "feature",
        onto: HASH_A,
        stopReason: "edit"
      },
      conflictFiles: [],
      error: null
    });

    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"] .gitRef.head`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    const disabledItem = document.querySelector<HTMLElement>(
      "#contextMenu .contextMenuItemDisabled"
    );
    expect(disabledItem?.getAttribute("aria-disabled")).toBe("true");
    expect(disabledItem?.textContent).toContain(strings.rebaseMenuDisabledInProgress);

    disabledItem?.click();
    expect(vscodeMock.sentMessages.some((m) => m.command === "rebaseRange")).toBe(false);
  });

  it("forwards autostash: true, shows Git stderr on refusal, and renders autostash conflict banner", async () => {
    const vscodeMock = await bootWebview();

    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const item = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((el) => el.textContent === "Interactive Rebase…");
    item?.click();

    const rangeReq = latestRequest(vscodeMock.sentMessages, "rebaseRange");
    receive({
      command: "rebaseRange",
      requestId: rangeReq.requestId,
      repo: REPO,
      ...makeRange({
        commits: [
          makeCommit(HASH_B, "Commit B", { parents: [HASH_A] }),
          makeCommit(HASH_C, "Commit C", { parents: [HASH_B] })
        ],
        dirty: true,
        preflight: { canStart: false, reasons: ["dirty"] }
      })
    });

    const dialog = document.getElementById("dialog");
    dialog
      ?.querySelectorAll<HTMLButtonElement>(".rebaseEditorMoveUp")[1]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const autostash = dialog?.querySelector<HTMLInputElement>("#rebaseEditorAutostash");
    if (autostash === null || autostash === undefined) throw new Error("Missing autostash box");
    autostash.checked = true;
    autostash.dispatchEvent(new Event("change", { bubbles: true }));

    dialog
      ?.querySelector<HTMLButtonElement>("#dialogAction")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(latestRequest(vscodeMock.sentMessages, "interactiveRebase")).toEqual({
      command: "interactiveRebase",
      repo: REPO,
      base: HASH_A,
      rangeHashes: [HASH_B, HASH_C],
      entries: [
        { action: "pick", hash: HASH_C },
        { action: "pick", hash: HASH_B }
      ],
      autostash: true
    });

    // Backend reports autostash conflict via operationState after completion
    receive({ command: "interactiveRebase", status: null });
    const opReq = latestRequest(vscodeMock.sentMessages, "operationState");
    receive({
      command: "operationState",
      requestId: opReq.requestId,
      repo: REPO,
      kind: null,
      rebase: null,
      conflictFiles: ["dirty.txt"],
      autostashConflict: { stashSelector: "stash@{0}", stashHash: HASH_C },
      error: null
    });

    const bannerSlot = document.getElementById("rebaseBannerSlot");
    expect(bannerSlot?.textContent).toContain(strings.rebaseAutostashConflictTitle);
    expect(bannerSlot?.textContent).toContain("stash@{0}");
    expect(bannerSlot?.textContent).toContain("dirty.txt");

    // Backend refusal surfaces Git's stderr verbatim in the error dialog
    receive({
      command: "interactiveRebase",
      status: "error: cannot rebase: You have unstaged changes."
    });
    expect(document.getElementById("dialog")?.textContent).toContain(
      "error: cannot rebase: You have unstaged changes."
    );
  });
});
