import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GitCommitNode,
  GitRebaseRangeCommit,
  GitRebaseRangeResult,
  GitRepoInfo
} from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import type * as GGL from "@/types";
import {
  createRebaseEditorState,
  type InteractiveRebaseStartPayload,
  openRebaseEditorDialog,
  trapFocusInContainer
} from "@/webview/rebaseEditor";

import { createVscodeMock, receive, setupHtml } from "../setup";

const strings = getWebviewLocalizedStrings();
const REPO = "/workspace/rebase-editor";

const ROOT_HASH = "0000000000000000000000000000000000000000";
const HASH_A = "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
const HASH_B = "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";
const HASH_C = "cccc3333cccc3333cccc3333cccc3333cccc3333";
const SIDE_HASH = "dddd4444dddd4444dddd4444dddd4444dddd4444";

function makeRangeCommit(
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
    makeRangeCommit(HASH_A, "Commit A"),
    makeRangeCommit(HASH_B, "Commit B", { parents: [HASH_A] }),
    makeRangeCommit(HASH_C, "Commit C", { parents: [HASH_B] })
  ];
  return {
    commits,
    mergeCount: commits.filter((c) => c.isMerge).length,
    dirty: false,
    hasUntracked: false,
    inProgress: false,
    inProgressKind: null,
    detached: false,
    branch: "feature/rebase",
    upstream: "origin/feature/rebase",
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

describe("rebaseEditor view", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders rows oldest-first with pick/drop selects, move buttons, and disables Start until modified", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const starts: InteractiveRebaseStartPayload[] = [];
    let cancelled = 0;

    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(makeRange(), { base: ROOT_HASH, baseLabel: "00000000" }),
      { shortHashLength: 8 },
      {
        onStart: (payload) => starts.push(payload),
        onCancel: () => {
          cancelled++;
        }
      }
    );

    expect(dialog.classList.contains("rebaseEditorDialog")).toBe(true);
    expect(dialog.classList.contains("noInput")).toBe(true);

    const rows = Array.from(dialog.querySelectorAll<HTMLElement>(".rebaseEditorRow"));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.dataset.hash)).toEqual([HASH_A, HASH_B, HASH_C]);
    expect(rows[0].querySelector(".rebaseEditorHash")?.textContent).toBe("aaaa1111");
    expect(rows[0].querySelector<HTMLButtonElement>(".rebaseEditorMoveUp")?.disabled).toBe(true);
    expect(rows[0].querySelector<HTMLButtonElement>(".rebaseEditorMoveDown")?.disabled).toBe(false);
    expect(rows[2].querySelector<HTMLButtonElement>(".rebaseEditorMoveDown")?.disabled).toBe(true);

    const startBtn = dialog.querySelector<HTMLButtonElement>("#dialogAction");
    const resetBtn = dialog.querySelector<HTMLButtonElement>("#rebaseEditorReset");
    expect(startBtn?.disabled).toBe(true);
    expect(resetBtn?.disabled).toBe(true);

    // Change second row to drop
    const secondSelect = rows[1].querySelector<HTMLSelectElement>(".rebaseEditorActionSelect");
    if (secondSelect === null) throw new Error("Missing second row select");
    secondSelect.value = "drop";
    secondSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(controller.getState().rows[1].action).toBe("drop");
    expect(dialog.querySelectorAll(".rebaseEditorRow")[1].classList.contains("isDropped")).toBe(
      true
    );
    expect(dialog.querySelector(".rebaseEditorNotice-drop")?.textContent).toBe(
      strings.rebaseDropNoticeOne
    );
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(false);
    expect(dialog.querySelector<HTMLButtonElement>("#rebaseEditorReset")?.disabled).toBe(false);

    // Move third row up via button
    dialog
      .querySelectorAll<HTMLButtonElement>(".rebaseEditorMoveUp")[2]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(controller.getState().rows.map((r) => r.hash)).toEqual([HASH_A, HASH_C, HASH_B]);

    // Click Start
    dialog
      .querySelector<HTMLButtonElement>("#dialogAction")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(starts).toEqual([
      {
        base: ROOT_HASH,
        rangeHashes: [HASH_A, HASH_B, HASH_C],
        entries: [
          { action: "pick", hash: HASH_A },
          { action: "pick", hash: HASH_C },
          { action: "drop", hash: HASH_B }
        ]
      }
    ]);

    // Reset button restores original state
    dialog
      .querySelector<HTMLButtonElement>("#rebaseEditorReset")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(controller.getState().rows.map((r) => [r.hash, r.action])).toEqual([
      [HASH_A, "pick"],
      [HASH_B, "pick"],
      [HASH_C, "pick"]
    ]);
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(true);

    // Cancel button triggers onCancel
    dialog
      .querySelector<HTMLButtonElement>("#dialogDismiss")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cancelled).toBe(1);
  });

  it("renders notices for flattened merge commits, published commits, and preflight blockers", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const range = makeRange({
      commits: [
        makeRangeCommit(HASH_A, "Published commit", { isPublished: true }),
        makeRangeCommit(HASH_B, "Merge branch", {
          isMerge: true,
          parents: [HASH_A, SIDE_HASH]
        })
      ],
      dirty: true,
      preflight: { canStart: false, reasons: ["dirty"] }
    });

    openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(range, { base: ROOT_HASH, baseLabel: "main" }),
      { shortHashLength: 8 },
      { onStart: () => undefined, onCancel: () => undefined }
    );

    const errorNotice = dialog.querySelector(".rebaseEditorNotice-error")?.textContent ?? "";
    const warningNotice = dialog.querySelector(".rebaseEditorNotice-warning")?.textContent ?? "";
    const mergeNotice = dialog.querySelector(".rebaseEditorNotice-info")?.textContent ?? "";

    expect(errorNotice).toContain(strings.rebasePreflightDirty);
    expect(warningNotice).toContain("aaaa1111");
    expect(warningNotice).toContain("rewrites history; needs a force push");
    expect(mergeNotice).toContain("bbbb2222");
    expect(mergeNotice).toContain("flattened");

    expect(dialog.querySelector(".rebaseEditorBadge-published")?.textContent).toBe(
      strings.rebaseBadgePublished
    );
    expect(dialog.querySelector(".rebaseEditorBadge-merge")?.textContent).toBe(
      strings.rebaseBadgeMerge
    );
  });

  it("supports Shift+Up/Down reordering, Ctrl/Cmd+Enter start, and traps Tab focus inside the dialog", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const starts: InteractiveRebaseStartPayload[] = [];

    openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(makeRange(), { base: ROOT_HASH, baseLabel: "main" }),
      { shortHashLength: 8 },
      {
        onStart: (payload) => starts.push(payload),
        onCancel: () => undefined
      }
    );

    // Shift+ArrowDown moves row 0 to row 1
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true, bubbles: true })
    );
    expect(
      Array.from(dialog.querySelectorAll<HTMLElement>(".rebaseEditorRow")).map(
        (r) => r.dataset.hash
      )
    ).toEqual([HASH_B, HASH_A, HASH_C]);

    // Focus trap: wrapping forward from the last button returns to the first focusable element
    const cancelBtn = dialog.querySelector<HTMLElement>("#dialogDismiss");
    const firstRow = dialog.querySelector<HTMLElement>('.rebaseEditorRow[data-index="0"]');
    if (cancelBtn === null || firstRow === null) {
      throw new Error("Missing focusable elements");
    }
    cancelBtn.focus();
    expect(trapFocusInContainer(dialog, false, cancelBtn)).toBe(
      dialog.querySelector<HTMLElement>('.rebaseEditorActionSelect[data-index="0"]')
    );

    // Ctrl+Enter submits start
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })
    );
    expect(starts).toHaveLength(1);
    expect(starts[0].entries.map((e) => e.hash)).toEqual([HASH_B, HASH_A, HASH_C]);
  });

  it("escapes untrusted commit subjects and author names without injecting HTML", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const malicious = '<img src=x onerror="alert(1)">';
    const range = makeRange({
      commits: [makeRangeCommit(HASH_A, malicious, { author: malicious })]
    });

    openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(range, { base: ROOT_HASH, baseLabel: malicious }),
      { shortHashLength: 8 },
      { onStart: () => undefined, onCancel: () => undefined }
    );

    expect(dialog.querySelector("img")).toBeNull();
    expect(dialog.querySelector(".rebaseEditorSubject")?.textContent).toBe(malicious);
    expect(dialog.querySelector(".rebaseEditorAuthor")?.textContent).toBe(malicious);
  });

  it("keeps rebase-editor.css on VS Code theme tokens and OKLCH fallbacks with sticky headers", () => {
    const css = readFileSync(join(process.cwd(), "media", "rebase-editor.css"), "utf8");

    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\s*\(/i);
    expect(css).not.toMatch(/\bhsla?\s*\(/i);
    expect(css).not.toContain("in srgb");
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain("position: sticky;");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("min-height: 0;");
    expect(css).toContain("@media (forced-colors: active)");
  });
});

/* Full webview integration tests: context menu entry points, visibility settings, and messages */

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
  },
  {
    hash: SIDE_HASH,
    parentHashes: [],
    author: "Bob",
    email: "bob@example.test",
    date: 1_700_000_050,
    message: "Unrelated side commit",
    refs: [{ hash: SIDE_HASH, name: "side", type: "head" }]
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

async function bootWebview(viewState: GGL.GitGraphViewState = defaultViewState) {
  vi.resetModules();
  const vscodeMock = createVscodeMock();
  setupHtml(viewState);
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
    branches: ["feature", "main", "side"],
    head: "feature",
    hard: true,
    isRepo: true,
    error: null,
    worktrees: [],
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

function contextMenuItems(): string[] {
  return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).map(
    (item) => item.textContent ?? ""
  );
}

function clickMenuItem(label: string) {
  const item = Array.from(
    document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
  ).find((el) => el.textContent === label);
  if (item === undefined) {
    throw new Error(`Context menu item not found: ${label}`);
  }
  item.click();
}

describe("rebaseEditor webview integration", () => {
  it("offers Interactive Rebase… on ancestor commits, ancestor branches, and contiguous HEAD multi-selections", async () => {
    const vscodeMock = await bootWebview();

    // HEAD commit itself does NOT offer Interactive Rebase… (HEAD..HEAD is empty)
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_C}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).not.toContain("Interactive Rebase…");

    // Non-ancestor commit does NOT offer Interactive Rebase…
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${SIDE_HASH}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).not.toContain("Interactive Rebase…");

    // Ancestor commit offers Interactive Rebase… and keeps Rebase current branch here…
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).toContain("Rebase current branch here…");
    expect(contextMenuItems()).toContain("Interactive Rebase…");

    // Ancestor branch ("main" on HASH_A) offers Interactive Rebase…; non-ancestor branch ("side") does not
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${SIDE_HASH}"] .gitRef.head`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).not.toContain("Interactive Rebase…");

    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"] .gitRef.head`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).toContain("Interactive Rebase…");
    clickMenuItem("Interactive Rebase…");
    expect(latestRequest(vscodeMock.sentMessages, "rebaseRange")).toMatchObject({
      command: "rebaseRange",
      repo: REPO,
      base: HASH_A
    });

    // Multi-selection ending at HEAD (HASH_C + HASH_B) starts after HASH_B's parent (HASH_A).
    // A plain click first clears the single selection left by the menus above.
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_C}"]`)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    for (const hash of [HASH_C, HASH_B]) {
      document
        .querySelector<HTMLElement>(`tr.commit[data-hash="${hash}"]`)
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    }
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_B}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).toContain("Interactive Rebase…");
    clickMenuItem("Interactive Rebase…");
    expect(latestRequest(vscodeMock.sentMessages, "rebaseRange")).toMatchObject({
      command: "rebaseRange",
      repo: REPO,
      base: HASH_A
    });

    // Multi-selection reaching the root commit (HASH_C + HASH_B + HASH_A) sends base: null (--root)
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"]`)
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickMenuItem("Interactive Rebase…");
    expect(latestRequest(vscodeMock.sentMessages, "rebaseRange")).toMatchObject({
      command: "rebaseRange",
      repo: REPO,
      base: null
    });
  });

  it("hides Interactive Rebase… when commit or branch interactiveRebase visibility is disabled", async () => {
    await bootWebview({
      ...defaultViewState,
      contextMenuActionsVisibility: {
        ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
        branch: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.branch,
          interactiveRebase: false
        },
        commit: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commit,
          interactiveRebase: false
        }
      }
    });

    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).not.toContain("Interactive Rebase…");

    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"] .gitRef.head`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).not.toContain("Interactive Rebase…");
  });

  it("opens the editor on rebaseRange reply, sends interactiveRebase on Start, and hands over to the rebase banner on pause", async () => {
    const vscodeMock = await bootWebview();

    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${HASH_A}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickMenuItem("Interactive Rebase…");

    const rangeReq = latestRequest(vscodeMock.sentMessages, "rebaseRange");
    expect(rangeReq.base).toBe(HASH_A);

    const range = makeRange({
      commits: [
        makeRangeCommit(HASH_B, "Commit B", { parents: [HASH_A] }),
        makeRangeCommit(HASH_C, "Commit C", { parents: [HASH_B] })
      ]
    });
    receive({
      command: "rebaseRange",
      requestId: rangeReq.requestId,
      repo: REPO,
      ...range
    });

    const dialog = document.getElementById("dialog");
    expect(dialog?.classList.contains("rebaseEditorDialog")).toBe(true);

    // Reorder row 1 above row 0 and start
    dialog
      ?.querySelectorAll<HTMLButtonElement>(".rebaseEditorMoveUp")[1]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      ]
    });

    // Backend replies status: null (paused or completed), which refreshes and queries operationState
    receive({ command: "interactiveRebase", status: null });
    const opReq = latestRequest(vscodeMock.sentMessages, "operationState");
    receive({
      command: "operationState",
      requestId: opReq.requestId,
      repo: REPO,
      kind: "rebase",
      rebase: {
        backend: "merge",
        stoppedHash: HASH_C,
        subject: "Commit C",
        current: 1,
        total: 2,
        branch: "feature",
        onto: HASH_A,
        stopReason: "conflict"
      },
      conflictFiles: ["conflict.txt"],
      error: null
    });

    expect(document.getElementById("rebaseBannerSlot")?.textContent).toContain("conflict.txt");
  });
});
