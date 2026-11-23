import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GitCommitNode,
  GitRebasePredictionResult,
  GitRebaseRangeCommit,
  GitRebaseRangeResult,
  GitRepoInfo
} from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import type * as GGL from "@/types";
import {
  createRebaseEditorState,
  openRebaseEditorDialog,
  REBASE_PREDICTION_DEBOUNCE_MS,
  type RebasePredictionRequest
} from "@/webview/rebaseEditor";

import { createVscodeMock, receive, setupHtml } from "../setup";

const strings = getWebviewLocalizedStrings();
const REPO = "/workspace/rebase-prediction";
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
    branch: "feature/predict",
    upstream: null,
    alreadyUsedElsewhere: false,
    tooLong: false,
    preflight: { canStart: true, reasons: [] },
    error: null,
    ...overrides
  };
}

function makePrediction(
  overrides: Partial<GitRebasePredictionResult> = {}
): GitRebasePredictionResult {
  return {
    status: "clean",
    conflictHash: null,
    conflictFiles: [],
    probedCount: 3,
    totalSteps: 3,
    probeLimit: 20,
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

describe("rebaseEditor conflict prediction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById("rebasePredictionPopover")?.remove();
  });

  it("debounces rapid todo edits, ignores message/selection edits, and drops stale replies", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const requests: RebasePredictionRequest[] = [];

    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(makeRange(), { base: ROOT_HASH, baseLabel: "00000000" }),
      { shortHashLength: 8 },
      {
        onStart: () => {},
        onCancel: () => {},
        onPredict: (req) => requests.push(req)
      }
    );

    const statusBefore = dialog.querySelector<HTMLElement>(".rebasePredictionStatus");
    expect(statusBefore?.dataset.status).toBe("checking");
    expect(statusBefore?.textContent).toContain("Prediction:");
    expect(requests).toHaveLength(0);

    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS);
    expect(requests).toHaveLength(1);
    const firstSeq = requests[0].seq;

    // Rapidly edit action and reorder within the debounce window -> coalesces to one request.
    const select0 = dialog.querySelector<HTMLSelectElement>(
      '.rebaseEditorActionSelect[data-index="0"]'
    );
    if (select0 === null) throw new Error("Missing action select");
    select0.value = "drop";
    select0.dispatchEvent(new Event("change", { bubbles: true }));

    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS - 50);
    const moveUp2 = dialog.querySelector<HTMLButtonElement>('.rebaseEditorMoveUp[data-index="2"]');
    moveUp2?.click();

    expect(requests).toHaveLength(1);
    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS);
    expect(requests).toHaveLength(2);
    expect(requests[1].entries).toEqual([
      { action: "drop", hash: HASH_A },
      { action: "pick", hash: HASH_C },
      { action: "pick", hash: HASH_B }
    ]);

    // Stale reply for the first request must be ignored.
    controller.applyPrediction(firstSeq, makePrediction({ status: "clean" }));
    expect(dialog.querySelector<HTMLElement>(".rebasePredictionStatus")?.dataset.status).toBe(
      "checking"
    );

    // Current reply updates the status line.
    controller.applyPrediction(requests[1].seq, makePrediction({ status: "clean" }));
    const cleanEl = dialog.querySelector<HTMLElement>(".rebasePredictionStatus");
    expect(cleanEl?.dataset.status).toBe("clean");
    expect(cleanEl?.textContent).toBe(strings.rebasePredictionClean);

    // Selecting another row does not re-trigger prediction.
    dialog.querySelector<HTMLElement>('.rebaseEditorRow[data-index="1"]')?.click();
    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS * 2);
    expect(requests).toHaveLength(2);

    // Switching row 1 to reword and typing in the message box: action change triggers once, typing does not.
    const select1 = dialog.querySelector<HTMLSelectElement>(
      '.rebaseEditorActionSelect[data-index="1"]'
    );
    if (select1 === null) throw new Error("Missing row 1 select");
    select1.value = "reword";
    select1.dispatchEvent(new Event("change", { bubbles: true }));
    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS);
    expect(requests).toHaveLength(3);

    const textarea = dialog.querySelector<HTMLTextAreaElement>(".rebaseEditorMessageInput");
    if (textarea === null) throw new Error("Missing reword textarea");
    textarea.value = "Edited commit subject";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS * 2);
    expect(requests).toHaveLength(3);

    controller.destroy();
  });

  it("renders capped, unavailable, and error states, each labeled as a prediction", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const requests: RebasePredictionRequest[] = [];

    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(makeRange(), { base: ROOT_HASH, baseLabel: "00000000" }),
      { shortHashLength: 8 },
      {
        onStart: () => {},
        onCancel: () => {},
        onPredict: (req) => requests.push(req)
      }
    );

    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS);
    const seq = requests[0].seq;

    controller.applyPrediction(
      seq,
      makePrediction({ status: "capped", probedCount: 20, totalSteps: 35, probeLimit: 20 })
    );
    const cappedEl = dialog.querySelector<HTMLElement>(".rebasePredictionStatus");
    expect(cappedEl?.dataset.status).toBe("capped");
    expect(cappedEl?.textContent).toBe(
      "Prediction: no conflicts predicted in the first 20 of 35 commits (capped)"
    );

    controller.applyPrediction(
      seq,
      makePrediction({ status: "unavailable", probedCount: 0, totalSteps: 3 })
    );
    const unavailableEl = dialog.querySelector<HTMLElement>(".rebasePredictionStatus");
    expect(unavailableEl?.dataset.status).toBe("unavailable");
    expect(unavailableEl?.textContent).toBe(strings.rebasePredictionUnavailable);

    controller.applyPrediction(
      seq,
      makePrediction({
        status: "error",
        probedCount: 0,
        error: { message: "boom", stderr: null, exitCode: null, task: null }
      })
    );
    const errorEl = dialog.querySelector<HTMLElement>(".rebasePredictionStatus");
    expect(errorEl?.dataset.status).toBe("error");
    expect(errorEl?.textContent).toBe(strings.rebasePredictionFailed);

    controller.destroy();
  });

  it("renders conflict status with shortHashLength and opens/closes the file-list popover", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const requests: RebasePredictionRequest[] = [];

    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(makeRange(), { base: ROOT_HASH, baseLabel: "00000000" }),
      { shortHashLength: 7 },
      {
        onStart: () => {},
        onCancel: () => {},
        onPredict: (req) => requests.push(req)
      }
    );

    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS);
    const seq = requests[0].seq;

    // Single conflicted file.
    controller.applyPrediction(
      seq,
      makePrediction({
        status: "conflict",
        conflictHash: HASH_B,
        conflictFiles: ["src/app.ts"],
        probedCount: 2
      })
    );
    const singleTrigger = dialog.querySelector<HTMLButtonElement>("#rebasePredictionTrigger");
    expect(singleTrigger?.textContent).toBe("Prediction: conflict at bbbb222: 1 file");

    // Multiple conflicted files including non-ASCII and HTML characters.
    controller.applyPrediction(
      seq,
      makePrediction({
        status: "conflict",
        conflictHash: HASH_C,
        conflictFiles: ["src/main.ts", "dir/日本語 <café>.txt"],
        probedCount: 3
      })
    );
    const trigger = dialog.querySelector<HTMLButtonElement>("#rebasePredictionTrigger");
    expect(trigger?.textContent).toBe("Prediction: conflict at cccc333: 2 files");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    // Click opens body-mounted popover with safe textContent paths.
    trigger?.click();
    const popover = document.getElementById("rebasePredictionPopover");
    expect(popover).not.toBeNull();
    expect(popover?.hidden).toBe(false);
    expect(popover?.parentElement).toBe(document.body);
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    const items = Array.from(popover?.querySelectorAll(".rebasePredictionFileItem") ?? []).map(
      (el) => el.textContent
    );
    expect(items).toEqual(["src/main.ts", "dir/日本語 <café>.txt"]);

    // Escape closes the popover and stops propagation before closing the dialog.
    let propagatedEscape = false;
    const escapeSpy = () => {
      propagatedEscape = true;
    };
    document.addEventListener("keydown", escapeSpy);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
    document.removeEventListener("keydown", escapeSpy);
    expect(popover?.hidden).toBe(true);
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(propagatedEscape).toBe(false);

    // Reopen and close via outside mousedown.
    trigger?.click();
    expect(popover?.hidden).toBe(false);
    dialogBacking.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(popover?.hidden).toBe(true);

    // Hovering opens popover; hovering the popover keeps it open; leaving closes after grace.
    trigger?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(popover?.hidden).toBe(false);
    trigger?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    popover?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(popover?.hidden).toBe(false);
    popover?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    vi.advanceTimersByTime(250);
    expect(popover?.hidden).toBe(true);

    // Destroy removes popover from document.body.
    controller.destroy();
    expect(document.getElementById("rebasePredictionPopover")).toBeNull();
  });

  it("wires debounced rebasePrediction messages through the full graph webview", async () => {
    vi.resetModules();
    const vscodeMock = createVscodeMock();
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
    setupHtml(viewState);
    await import("@/webview/main");

    const latestRequest = <T extends GGL.RequestMessage["command"]>(
      command: T
    ): Extract<GGL.RequestMessage, { command: T }> => {
      for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
        const msg = vscodeMock.sentMessages[i];
        if (msg.command === command) {
          return msg as Extract<GGL.RequestMessage, { command: T }>;
        }
      }
      throw new Error(`Missing ${command} request`);
    };

    const commitNodes: GitCommitNode[] = [
      {
        hash: HASH_C,
        parentHashes: [HASH_B],
        author: "Alice",
        email: "alice@example.test",
        date: 1_700_000_300,
        message: "Commit C",
        refs: [{ hash: HASH_C, name: "feature/predict", type: "head" }]
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
        parentHashes: [ROOT_HASH],
        author: "Alice",
        email: "alice@example.test",
        date: 1_700_000_100,
        message: "Commit A",
        refs: []
      },
      {
        hash: ROOT_HASH,
        parentHashes: [],
        author: "Alice",
        email: "alice@example.test",
        date: 1_700_000_000,
        message: "Root",
        refs: []
      }
    ];

    const repoInfo: GitRepoInfo = {
      isRepo: true,
      head: "feature/predict",
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

    receive({
      command: "loadRepoInfo",
      requestId: latestRequest("loadRepoInfo").requestId,
      repoInfo,
      error: null
    });
    receive({
      command: "loadBranches",
      requestId: latestRequest("loadBranches").requestId,
      branches: ["feature/predict"],
      head: "feature/predict",
      hard: true,
      isRepo: true,
      error: null,
      worktrees: [],
      upstreams: {}
    });
    receive({
      command: "loadCommits",
      requestId: latestRequest("loadCommits").requestId,
      commits: commitNodes,
      head: HASH_C,
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    // Open interactive rebase editor via context menu on ROOT_HASH.
    const rootRow = document.querySelector<HTMLElement>(`tr.commit[data-hash="${ROOT_HASH}"]`);
    expect(rootRow).not.toBeNull();
    rootRow?.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, clientX: 10, clientY: 10 })
    );
    const menuItems = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    );
    const rebaseItem = menuItems.find(
      (item) => item.textContent === `${strings.interactiveRebase}…`
    );
    expect(rebaseItem).toBeDefined();
    rebaseItem?.click();

    const rangeReq = latestRequest("rebaseRange");
    receive({
      command: "rebaseRange",
      requestId: rangeReq.requestId,
      repo: REPO,
      ...makeRange()
    });

    vi.advanceTimersByTime(REBASE_PREDICTION_DEBOUNCE_MS);
    const predictReqs = vscodeMock.sentMessages.filter((m) => m.command === "rebasePrediction");
    expect(predictReqs).toHaveLength(1);
    const predictReq = predictReqs[0];
    if (predictReq.command !== "rebasePrediction") return;

    // Reply for a wrong repository is ignored.
    receive({
      command: "rebasePrediction",
      requestId: predictReq.requestId,
      repo: "/other/repo",
      ...makePrediction({ status: "clean" })
    });
    expect(document.querySelector<HTMLElement>(".rebasePredictionStatus")?.dataset.status).toBe(
      "checking"
    );

    // Matching reply populates conflict status line.
    receive({
      command: "rebasePrediction",
      requestId: predictReq.requestId,
      repo: REPO,
      ...makePrediction({
        status: "conflict",
        conflictHash: HASH_B,
        conflictFiles: ["README.md"],
        probedCount: 2
      })
    });
    const trigger = document.querySelector<HTMLButtonElement>("#rebasePredictionTrigger");
    expect(trigger?.textContent).toBe("Prediction: conflict at bbbb2222: 1 file");
  });
});

describe("rebase-editor prediction CSS guards", () => {
  const css = readFileSync(join(process.cwd(), "media", "rebase-editor.css"), "utf8");

  it("styles the prediction status and popover with theme tokens, OKLCH fallbacks, and forced-colors", () => {
    expect(css).toContain(".rebasePredictionStatus");
    expect(css).toContain(".rebasePredictionPopover");
    expect(css).toContain("var(--vscode-editorHoverWidget-background");
    expect(css).toContain("var(--vscode-editorHoverWidget-border");
    expect(css).toContain("z-index: 410;");
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).not.toContain("in srgb");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
