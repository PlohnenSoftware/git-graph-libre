import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/context-menu-visibility";

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
  boldCheckedOutCommit: false,
  fetchTagsByDefault: true,
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 8,
  telemetryConsent: "enabled"
};

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
  authors: ["Alice"],
  tags: ["v1.0.0"],
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
    hash: "abc123",
    parentHashes: [],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: "Tagged commit",
    refs: [
      { hash: "abc123", name: "main", type: "head" },
      { hash: "abc123", name: "v1.0.0", type: "tag" }
    ]
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

async function bootWebview(
  viewState: GGL.GitGraphViewState,
  initialState?: Parameters<typeof createVscodeMock>[0]
) {
  vi.resetModules();
  const vscodeMock = createVscodeMock(initialState);
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
    branches: ["main"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
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

function withVisibility(
  visibility: Partial<GGL.ContextMenuActionsVisibility>
): GGL.GitGraphViewState {
  return {
    ...defaultViewState,
    contextMenuActionsVisibility: {
      ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
      ...visibility
    }
  };
}

function contextMenuItems() {
  return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).map(
    (item) => item.textContent ?? ""
  );
}

describe("context menu visibility rendering", () => {
  it("uses the permanent signature default and restores a temporary header override", async () => {
    const viewState = { ...defaultViewState, showSignatureColumn: true };
    const vscodeMock = await bootWebview(viewState);
    expect(latestRequest(vscodeMock.sentMessages, "loadCommits").showSignature).toBe(true);
    expect(document.getElementById("commitTable")?.classList.contains("hideSignatureCol")).toBe(
      false
    );

    document
      .querySelector<HTMLElement>(".tableColHeader")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const signatureItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((item) => item.textContent?.includes("Signature"));
    expect(signatureItem?.textContent).toBe("✓ Signature");
    signatureItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const savedState = vscodeMock.getState();
    expect(savedState?.hiddenColumns).toContain("signature");
    expect(savedState?.columnVisibilityVersion).toBe(1);

    await bootWebview(viewState, savedState);
    expect(document.getElementById("commitTable")?.classList.contains("hideSignatureCol")).toBe(
      true
    );
  });

  it("migrates old Date/Author/Commit visibility state without enabling signatures", async () => {
    const vscodeMock = await bootWebview(defaultViewState);
    const currentState = vscodeMock.getState();
    expect(currentState).toBeDefined();
    const legacyState = {
      ...currentState,
      hiddenColumns: ["date"],
      columnVisibilityVersion: undefined
    } as NonNullable<typeof currentState>;

    await bootWebview(defaultViewState, legacyState);
    const table = document.getElementById("commitTable");
    expect(table?.classList.contains("hideDateCol")).toBe(true);
    expect(table?.classList.contains("hideSignatureCol")).toBe(true);
  });

  it("hides disabled tag actions and removes redundant dividers", async () => {
    await bootWebview(
      withVisibility({
        tag: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.tag,
          viewDetails: false,
          delete: false,
          push: false,
          fetchTags: false,
          compareWithHead: false,
          copyName: false
        }
      })
    );

    document
      .querySelector<HTMLElement>(".gitRef.tag")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    const dividers = document.querySelectorAll("#contextMenu .contextMenuDivider");

    expect(contextMenuItems()).toEqual(["Create Archive"]);
    expect(dividers).toHaveLength(0);
  });

  it("hides all disabled commit actions", async () => {
    await bootWebview(
      withVisibility({
        commit: Object.fromEntries(
          Object.keys(DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commit).map((key) => [key, false])
        ) as GGL.ContextMenuActionsVisibility["commit"]
      })
    );

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    expect(contextMenuItems()).toEqual([]);
  });

  it("hides all disabled local branch actions", async () => {
    await bootWebview(
      withVisibility({
        branch: Object.fromEntries(
          Object.keys(DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.branch).map((key) => [key, false])
        ) as GGL.ContextMenuActionsVisibility["branch"]
      })
    );

    document
      .querySelector<HTMLElement>(".gitRef.head")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    expect(contextMenuItems()).toEqual([]);
  });
});
