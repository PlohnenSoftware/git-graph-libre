import * as fs from "node:fs";
import * as path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitOperationStateResult, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import type * as GGL from "@/types";
import { type RebaseBannerCallbacks, renderRebaseBanner } from "@/webview/rebaseBanner";

import { createVscodeMock, receive, setupHtml } from "./setup";

const HASH = "c5fd0647ff319fe137534b6eb5ff3ef91323ef4a";

function rebaseState(overrides: Partial<GitOperationStateResult> = {}): GitOperationStateResult {
  return {
    kind: "rebase",
    rebase: {
      backend: "merge",
      stoppedHash: HASH,
      subject: "commit A",
      current: 1,
      total: 3,
      branch: "main",
      onto: "adb0cb05eb69cd09e948454d99650e00fd48badc",
      stopReason: "edit"
    },
    conflictFiles: [],
    error: null,
    ...overrides
  };
}

function slot(): HTMLElement {
  const element = document.getElementById("rebaseBannerSlot");
  if (element === null) throw new Error("no banner slot");
  return element;
}

function button(action: string): HTMLButtonElement {
  const element = slot().querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  if (element === null) throw new Error(`no ${action} button`);
  return element;
}

describe("rebase banner", () => {
  const callbacks: RebaseBannerCallbacks = {
    onContinue: vi.fn(),
    onSkip: vi.fn(),
    onAbort: vi.fn(),
    onOpenFile: vi.fn()
  };
  let strings: ReturnType<typeof getWebviewLocalizedStrings>;

  beforeEach(() => {
    strings = getWebviewLocalizedStrings();
    (globalThis as unknown as { l10n: typeof strings }).l10n = strings;
    document.body.innerHTML = '<div id="rebaseBannerSlot"></div>';
    vi.clearAllMocks();
  });

  function render(state: GitOperationStateResult | null, busy = false) {
    renderRebaseBanner(slot(), state, { shortHashLength: 8, busy }, callbacks);
  }

  it("renders nothing without a rebase in progress", () => {
    render(null);
    expect(slot().childElementCount).toBe(0);

    render({ kind: null, rebase: null, conflictFiles: [], error: null });
    expect(slot().childElementCount).toBe(0);

    render({ kind: "merge", rebase: null, conflictFiles: [], error: null });
    expect(slot().childElementCount).toBe(0);

    render({
      kind: null,
      rebase: null,
      conflictFiles: [],
      error: { message: "no", stderr: null, exitCode: null, task: null }
    });
    expect(slot().childElementCount).toBe(0);
  });

  it("shows an edit stop with the shortened hash, subject, progress and amend hint", () => {
    render(rebaseState());
    const banner = slot().querySelector<HTMLElement>(".rebaseBanner");
    expect(banner?.getAttribute("aria-label")).toBe(strings.rebaseInProgress);
    expect(banner?.dataset.reason).toBe("edit");
    expect(slot().querySelector(".rebaseBannerText")?.textContent).toBe(
      "Rebase in progress: stopped at c5fd0647 commit A (1 of 3)"
    );
    expect(slot().querySelector(".rebaseBannerHint")?.textContent).toBe(strings.rebaseEditHint);
    expect(button("continue").disabled).toBe(false);
    expect(button("continue").textContent).toBe(strings.rebaseContinue);
    expect(button("skip").textContent).toBe(strings.rebaseSkip);
    expect(button("abort").textContent).toBe(strings.rebaseAbort);
  });

  it("shortens the hash at the length it is given, like the graph", () => {
    renderRebaseBanner(slot(), rebaseState(), { shortHashLength: 12 }, callbacks);
    expect(slot().querySelector(".rebaseBannerText")?.textContent).toContain("c5fd0647ff31");
    expect(slot().querySelector(".rebaseBannerText")?.textContent).not.toContain(HASH);
  });

  it("shows a conflict stop with its files, Continue blocked, and opens a file on click", () => {
    render(
      rebaseState({
        rebase: {
          backend: "merge",
          stoppedHash: HASH,
          subject: "commit B",
          current: 1,
          total: 2,
          branch: "main",
          onto: null,
          stopReason: "conflict"
        },
        conflictFiles: ["src/f.ts", "docs/read me.md"]
      })
    );
    expect(slot().querySelector(".rebaseBannerHint")?.textContent).toBe(strings.rebaseConflictHint);
    expect(slot().querySelector(".rebaseConflictLabel")?.textContent).toBe(
      strings.rebaseConflictFiles
    );
    const files = [...slot().querySelectorAll(".rebaseConflictFile")];
    expect(files.map((file) => file.textContent)).toEqual(["src/f.ts", "docs/read me.md"]);
    expect(files[0]?.getAttribute("title")).toBe(strings.openFile);

    const continueBtn = button("continue");
    expect(continueBtn.disabled).toBe(true);
    expect(continueBtn.title).toBe(strings.rebaseConflictHint);
    expect(button("skip").disabled).toBe(false);
    expect(button("abort").disabled).toBe(false);

    (files[1] as HTMLButtonElement).click();
    expect(callbacks.onOpenFile).toHaveBeenCalledTimes(1);
    expect(callbacks.onOpenFile).toHaveBeenCalledWith("docs/read me.md");
  });

  it("shows any other stop with the generic hint and Continue allowed", () => {
    render(
      rebaseState({
        rebase: {
          backend: "apply",
          stoppedHash: null,
          subject: null,
          current: 2,
          total: 4,
          branch: null,
          onto: null,
          stopReason: "other"
        }
      })
    );
    expect(slot().querySelector(".rebaseBannerText")?.textContent).toBe(
      "Rebase in progress (2 of 4)"
    );
    expect(slot().querySelector(".rebaseBannerHint")?.textContent).toBe(strings.rebaseStoppedHint);
    expect(button("continue").disabled).toBe(false);
  });

  it("runs each control's callback once per click; Abort only asks its caller", () => {
    // The confirmation itself is the caller's dialog (main.ts); the banner
    // must not abort on its own, only report the click.
    render(rebaseState());
    button("continue").click();
    button("skip").click();
    button("abort").click();
    expect(callbacks.onContinue).toHaveBeenCalledTimes(1);
    expect(callbacks.onSkip).toHaveBeenCalledTimes(1);
    expect(callbacks.onAbort).toHaveBeenCalledTimes(1);
  });

  it("disables every control while busy", () => {
    render(rebaseState(), true);
    expect(button("continue").disabled).toBe(true);
    expect(button("skip").disabled).toBe(true);
    expect(button("abort").disabled).toBe(true);
  });

  it("keeps a subject with markup and dollar patterns as plain text", () => {
    const subject = "fix <b>$&</b> and $`tick`";
    render(
      rebaseState({
        rebase: {
          backend: "merge",
          stoppedHash: HASH,
          subject,
          current: null,
          total: null,
          branch: "main",
          onto: null,
          stopReason: "edit"
        }
      })
    );
    expect(slot().querySelector(".rebaseBannerText")?.textContent).toBe(
      `Rebase in progress: stopped at c5fd0647 ${subject}`
    );
    expect(slot().querySelector("b")).toBeNull();
  });
});

const REPO = "/workspace/rebaserepo";

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
  showTagRemotes: "off",
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
  headCommit: HASH,
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

const commits: GitCommitNode[] = [
  {
    hash: HASH,
    parentHashes: [],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: "commit A",
    refs: [{ hash: HASH, name: "main", type: "head" }]
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

async function bootWebviewWithBannerSlot() {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const vscodeMock = createVscodeMock(null);
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
    branches: ["main"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null,
    worktrees: [],
    upstreams: {}
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits,
    head: HASH,
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscodeMock;
}

describe("rebase banner in the graph view", () => {
  it("requests operationState on refresh, renders the banner, confirms Abort, and handles control replies", async () => {
    const strings = getWebviewLocalizedStrings();
    const vscodeMock = await bootWebviewWithBannerSlot();
    const opReq = latestRequest(vscodeMock.sentMessages, "operationState");
    expect(opReq.repo).toBe(REPO);

    // Stale or wrong-repo replies are ignored.
    receive({
      command: "operationState",
      requestId: opReq.requestId + 99,
      repo: REPO,
      ...rebaseState()
    });
    expect(slot().childElementCount).toBe(0);

    receive({
      command: "operationState",
      requestId: opReq.requestId,
      repo: "/other/repo",
      ...rebaseState()
    });
    expect(slot().childElementCount).toBe(0);

    // Matching reply renders the banner.
    receive({
      command: "operationState",
      requestId: opReq.requestId,
      repo: REPO,
      ...rebaseState({
        conflictFiles: ["src/conflict.ts"]
      })
    });
    expect(slot().querySelector(".rebaseBannerText")?.textContent).toContain("stopped at c5fd0647");
    expect(button("continue").disabled).toBe(true);

    // Clicking a conflict file sends openFile.
    slot().querySelector<HTMLButtonElement>(".rebaseConflictFile")?.click();
    expect(latestRequest(vscodeMock.sentMessages, "openFile")).toEqual({
      command: "openFile",
      repo: REPO,
      filePath: "src/conflict.ts"
    });

    // Clicking Abort opens the confirmation dialog first; it does not send abortRebase yet.
    button("abort").click();
    expect(document.getElementById("dialog")?.textContent).toContain(strings.rebaseAbortConfirm);
    expect(vscodeMock.sentMessages.some((msg) => msg.command === "abortRebase")).toBe(false);

    // Confirming the dialog sends abortRebase and marks the banner busy.
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(latestRequest(vscodeMock.sentMessages, "abortRebase")).toEqual({
      command: "abortRebase",
      repo: REPO
    });
    expect(button("skip").disabled).toBe(true);

    // A failed control reply opens the error dialog, re-enables the banner, and re-requests state.
    receive({ command: "abortRebase", status: "cannot abort right now" });
    expect(document.getElementById("dialog")?.textContent).toContain(strings.unableToAbortRebase);
    expect(document.getElementById("dialog")?.textContent).toContain("cannot abort right now");
    expect(button("skip").disabled).toBe(false);

    // Answer the re-requested state without conflicts so Continue is enabled.
    const nextOpReq = latestRequest(vscodeMock.sentMessages, "operationState");
    receive({
      command: "operationState",
      requestId: nextOpReq.requestId,
      repo: REPO,
      ...rebaseState()
    });
    expect(button("continue").disabled).toBe(false);

    // Continue and Skip send their actions and refresh on success.
    button("continue").click();
    expect(latestRequest(vscodeMock.sentMessages, "continueRebase")).toEqual({
      command: "continueRebase",
      repo: REPO
    });
    receive({ command: "continueRebase", status: null });

    const afterContinueOpReq = latestRequest(vscodeMock.sentMessages, "operationState");
    expect(afterContinueOpReq.requestId).toBeGreaterThan(nextOpReq.requestId);
    receive({
      command: "operationState",
      requestId: afterContinueOpReq.requestId,
      repo: REPO,
      ...rebaseState()
    });

    button("skip").click();
    expect(latestRequest(vscodeMock.sentMessages, "skipRebase")).toEqual({
      command: "skipRebase",
      repo: REPO
    });
    receive({ command: "skipRebase", status: "skip failed" });
    expect(document.getElementById("dialog")?.textContent).toContain(strings.unableToSkipRebase);
  });

  it("styles the rebase banner with VS Code tokens, OKLCH fallbacks, overflow-wrap and forced-colors", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "media", "rebase-banner.css"), "utf8");
    expect(css).toContain("#rebaseBannerSlot:empty");
    expect(css).toContain("display: none;");
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain("var(--vscode-banner-background, var(--ngg-neutral-overlay-subtle))");
    expect(css).toContain("var(--vscode-editorWarning-foreground, var(--ngg-warning))");
    expect(css).toContain("var(--vscode-button-background, var(--ngg-accent))");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).not.toMatch(/rgba?\(/);
    expect(css).not.toMatch(/hsla?\(/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(css).not.toMatch(/color-mix\(\s*in srgb/);
  });
});
