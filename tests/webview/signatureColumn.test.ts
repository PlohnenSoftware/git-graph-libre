import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

// The graph load never verifies signatures: the page renders at once with the
// signature column pending, and the webview asks for exactly the signatures it
// is missing through `commitSignatures`, filling the cells as they arrive.

const REPO = "/workspace/signature-column";
const SIGNED = "a".repeat(40);
const UNSIGNED = "b".repeat(40);
const STASH = "c".repeat(40);

// Each boot imports a new page module. Remove the previous page's global
// listeners as a real document replacement does; otherwise old instances
// consume new replies against detached table elements.
let listeners: MockInstance<typeof window.addEventListener>;
beforeEach(() => {
  listeners = vi.spyOn(window, "addEventListener");
});
afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  for (const [type, listener, options] of listeners.mock.calls) {
    window.removeEventListener(type, listener, options);
  }
  listeners.mockRestore();
});

const viewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  uncommittedFileViewMode: "tree",
  contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  showSignatureColumn: true,
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
  headCommit: SIGNED,
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

/** A fresh page as either backend sends it: no signatures, stash rows pinned to null. */
function page(): GitCommitNode[] {
  return [
    {
      hash: "*",
      parentHashes: [SIGNED],
      author: "*",
      email: "",
      date: 1_700_000_300,
      message: "Uncommitted Changes (1)",
      refs: []
    },
    {
      hash: STASH,
      parentHashes: [SIGNED],
      author: "",
      email: "",
      date: 1_700_000_200,
      message: "WIP",
      refs: [],
      signature: null,
      stash: { ref: "stash@{0}" }
    },
    {
      hash: SIGNED,
      parentHashes: [UNSIGNED],
      author: "Alice",
      email: "alice@example.com",
      date: 1_700_000_100,
      message: "signed",
      refs: [{ hash: SIGNED, name: "main", type: "head" }]
    },
    {
      hash: UNSIGNED,
      parentHashes: [""],
      author: "Alice",
      email: "alice@example.com",
      date: 1_700_000_000,
      message: "unsigned",
      refs: []
    }
  ];
}

function requests<T extends GGL.RequestMessage["command"]>(
  messages: GGL.RequestMessage[],
  command: T
): Extract<GGL.RequestMessage, { command: T }>[] {
  return messages.filter(
    (msg): msg is Extract<GGL.RequestMessage, { command: T }> => msg.command === command
  );
}

function latest<T extends GGL.RequestMessage["command"]>(
  messages: GGL.RequestMessage[],
  command: T
): Extract<GGL.RequestMessage, { command: T }> {
  const found = requests(messages, command).at(-1);
  if (found === undefined) throw new Error(`Missing ${command} request`);
  return found;
}

function answerLoadCommits(vscodeMock: ReturnType<typeof createVscodeMock>, hard = true) {
  receive({
    command: "loadCommits",
    requestId: latest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits: page(),
    head: SIGNED,
    moreCommitsAvailable: false,
    hard,
    error: null
  });
}

async function boot(state: GGL.GitGraphViewState = viewState) {
  vi.resetModules();
  const vscodeMock = createVscodeMock();
  setupHtml(state);
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
    branches: ["main"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
  });
  answerLoadCommits(vscodeMock);
  return vscodeMock;
}

function signatureTone(hash: string): string | null {
  const row = Array.from(document.querySelectorAll<HTMLElement>("#commitTable tr[data-id]")).find(
    (candidate) => candidate.querySelector(`td[title="${hash}"]`) !== null
  );
  const glyph = row?.querySelector("td.signatureCol .commitSignature");
  const tone = Array.from(glyph?.classList ?? []).find((name) =>
    name.startsWith("commitSignature-")
  );
  return tone?.replace("commitSignature-", "") ?? null;
}

function answerSignatures(
  vscodeMock: ReturnType<typeof createVscodeMock>,
  overrides: Partial<Extract<GGL.ResponseMessage, { command: "commitSignatures" }>> = {}
) {
  const request = latest(vscodeMock.sentMessages, "commitSignatures");
  receive({
    command: "commitSignatures",
    requestId: request.requestId,
    repo: request.repo,
    signatures: {
      [SIGNED]: { status: "valid", signer: "Alice", key: "ABC123" },
      [UNSIGNED]: null
    },
    error: null,
    ...overrides
  });
}

describe("signature column", () => {
  it("redraws an unchanged commit page after a transient graph failure", async () => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    const vscodeMock = await boot();
    function refreshPage() {
      receive({ command: "refresh" });
      receive({
        command: "loadBranches",
        requestId: latest(vscodeMock.sentMessages, "loadBranches").requestId,
        branches: ["main"],
        head: "main",
        hard: false,
        isRepo: true,
        error: null
      });
    }
    refreshPage();
    receive({
      command: "loadCommits",
      requestId: latest(vscodeMock.sentMessages, "loadCommits").requestId,
      commits: [],
      head: null,
      moreCommitsAvailable: false,
      hard: false,
      error: { message: "permission denied", stderr: null, exitCode: 128, task: null }
    });
    expect(document.body.classList.contains("unableToLoad")).toBe(true);
    expect(vscodeMock.sentMessages).toContainEqual({ command: "loadRepos", check: true });
    refreshPage();
    answerLoadCommits(vscodeMock, false);
    expect(document.body.classList.contains("unableToLoad")).toBe(false);
    expect(document.querySelectorAll("#commitTable tr[data-id]")).toHaveLength(4);
    expect(requests(vscodeMock.sentMessages, "failureScreenShown")).toEqual([
      { command: "failureScreenShown", screen: "graphLoadError" },
      { command: "failureScreenShown", screen: null }
    ]);
  });
  it("renders the page at once with the column pending, then asks for the signatures it lacks", async () => {
    const vscodeMock = await boot();

    expect(signatureTone(SIGNED)).toBe("pending");
    expect(signatureTone(UNSIGNED)).toBe("pending");
    // Stash rows are never verified, and the uncommitted row has nothing to verify.
    expect(latest(vscodeMock.sentMessages, "commitSignatures")).toMatchObject({
      repo: REPO,
      hashes: [SIGNED, UNSIGNED]
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Loading signature status...");
  });

  it("fills the cells in place when the answer arrives, and returns to Ready", async () => {
    const vscodeMock = await boot();
    const table = document.getElementById("commitTable")?.innerHTML;

    answerSignatures(vscodeMock);

    expect(signatureTone(SIGNED)).toBe("valid");
    expect(signatureTone(UNSIGNED)).toBe("unsigned");
    expect(document.getElementById("statusText")?.textContent).toBe("Ready");
    // Only the signature cells changed; the rest of the table was not rebuilt.
    expect(document.getElementById("commitTable")?.innerHTML).not.toBe(table);
    expect(document.querySelectorAll("#commitTable tr[data-id]")).toHaveLength(4);
  });

  it("keeps the signatures across a refresh instead of asking again", async () => {
    const vscodeMock = await boot();
    answerSignatures(vscodeMock);
    const asked = requests(vscodeMock.sentMessages, "commitSignatures").length;

    receive({ command: "refresh" });
    answerLoadCommits(vscodeMock, false);

    expect(signatureTone(SIGNED)).toBe("valid");
    expect(requests(vscodeMock.sentMessages, "commitSignatures")).toHaveLength(asked);
  });

  it("asks again after the toolbar's refresh button, so new keys are picked up", async () => {
    const vscodeMock = await boot();
    answerSignatures(vscodeMock);
    const asked = requests(vscodeMock.sentMessages, "commitSignatures").length;

    document.getElementById("refreshBtn")?.dispatchEvent(new MouseEvent("click"));
    receive({
      command: "loadBranches",
      requestId: latest(vscodeMock.sentMessages, "loadBranches").requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    answerLoadCommits(vscodeMock);

    expect(requests(vscodeMock.sentMessages, "commitSignatures")).toHaveLength(asked + 1);
  });

  it("asks for nothing while the column is hidden, and only for signatures when it is shown", async () => {
    const vscodeMock = await boot({ ...viewState, showSignatureColumn: false });
    expect(requests(vscodeMock.sentMessages, "commitSignatures")).toHaveLength(0);
    const loads = requests(vscodeMock.sentMessages, "loadCommits").length;

    document
      .querySelector<HTMLElement>(".tableColHeader")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    Array.from(document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem"))
      .find((item) => item.textContent?.includes("Signature"))
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // The page is already loaded; showing the column reads just the signatures.
    expect(requests(vscodeMock.sentMessages, "loadCommits")).toHaveLength(loads);
    expect(latest(vscodeMock.sentMessages, "commitSignatures").hashes).toEqual([SIGNED, UNSIGNED]);
  });

  it("reports a failed read on the strip and leaves the cells pending", async () => {
    const vscodeMock = await boot();

    answerSignatures(vscodeMock, {
      signatures: {},
      error: { message: "gpg failed", stderr: null, exitCode: 2, task: null }
    });

    expect(signatureTone(SIGNED)).toBe("pending");
    expect(document.getElementById("statusText")?.textContent).toBe(
      "Unable to load commit signatures"
    );
  });

  it("ignores an answer for a repository that is no longer shown", async () => {
    const vscodeMock = await boot();

    answerSignatures(vscodeMock, { repo: "/workspace/elsewhere" });

    expect(signatureTone(SIGNED)).toBe("pending");
  });
});
