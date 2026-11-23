import { describe, expect, it, vi } from "vitest";

import type { GitCommitDetails, GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/context-menu-visibility";

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
  initialState?: Parameters<typeof createVscodeMock>[0],
  loadedCommits = commits
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
    error: null,
    worktrees: [],
    upstreams: {}
  });
  receive({
    command: "loadCommits",
    requestId: latestRequest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits: loadedCommits,
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

/** The menu as drawn: each item's text, and "—" for a divider. */
function contextMenuLayout() {
  return Array.from(document.querySelectorAll<HTMLElement>("#contextMenu li")).map((item) =>
    item.classList.contains("contextMenuDivider") ? "—" : (item.textContent ?? "")
  );
}

describe("context menu visibility rendering", () => {
  it("uses the permanent signature default and restores a temporary header override", async () => {
    const viewState = { ...defaultViewState, showSignatureColumn: true };
    const vscodeMock = await bootWebview(viewState);
    // The page arrives without signatures; the visible column asks for them.
    expect(latestRequest(vscodeMock.sentMessages, "commitSignatures").hashes).toEqual(["abc123"]);
    expect(document.getElementById("commitTable")?.classList.contains("hideSignatureCol")).toBe(
      false
    );

    document
      .querySelector<HTMLElement>(".tableColHeader")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const signatureItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((item) => item.textContent?.includes("Signature"));
    expect(signatureItem?.getAttribute("aria-checked")).toBe("true");
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
          createWorktree: false,
          compareWithHead: false,
          compareWith: false,
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

  it("leaves a hidden action out without drawing a divider in its place", async () => {
    await bootWebview(
      withVisibility({
        commit: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commit,
          createBranch: false,
          cherryPick: false
        },
        tag: { ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.tag, push: false }
      })
    );

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    // Create Branch sat between these two; a divider there would split one group.
    expect(contextMenuLayout().slice(0, 2)).toEqual(["Add Tag…", "Create Worktree…"]);
    const checkout = contextMenuLayout().indexOf("Checkout…");
    expect(contextMenuLayout().slice(checkout - 1, checkout + 2)).toEqual([
      "—",
      "Checkout…",
      "Revert…"
    ]);

    document
      .querySelector<HTMLElement>(".gitRef.tag")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuLayout().slice(0, 3)).toEqual([
      "View Tag Details…",
      "Delete Tag…",
      "Fetch Tags…"
    ]);
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

  it("hides the selected comparison when its commit visibility setting is disabled", async () => {
    await bootWebview(
      withVisibility({
        commit: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commit,
          compareSelection: false
        }
      }),
      undefined,
      [commits[0], { ...commits[0], hash: "def456", refs: [] }]
    );
    for (const hash of ["abc123", "def456"]) {
      document
        .querySelector<HTMLElement>(`tr.commit[data-hash="${hash}"]`)
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    }
    document
      .querySelector<HTMLElement>('tr.commit[data-hash="def456"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    expect(document.querySelectorAll(".commitSelected")).toHaveLength(2);
    expect(contextMenuItems()).not.toContain("Compare Selected Commits");
  });

  it("hides Compare With in the commit, branch and tag menus when disabled", async () => {
    await bootWebview(
      withVisibility({
        commit: { ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commit, compareWith: false },
        branch: { ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.branch, compareWith: false },
        remoteBranch: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.remoteBranch,
          compareWith: false
        },
        tag: { ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.tag, compareWith: false }
      })
    );

    for (const selector of ['tr.commit[data-hash="abc123"]', ".gitRef.head", ".gitRef.tag"]) {
      document
        .querySelector<HTMLElement>(selector)
        ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      expect(contextMenuItems()).not.toContain("Compare With…");
      expect(contextMenuItems().length).toBeGreaterThan(0);
    }
  });

  it("compares a commit with the working tree and diffs its files against it", async () => {
    const vscodeMock = await bootWebview(defaultViewState);

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).toContain("Compare with Working Tree");
    const item = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((candidate) => candidate.textContent === "Compare with Working Tree");
    item?.click();

    expect(latestRequest(vscodeMock.sentMessages, "commitComparison")).toEqual({
      command: "commitComparison",
      repo: REPO,
      commitHash: "abc123",
      baseRef: "abc123",
      compareRef: "*"
    });
    expect(vscodeMock.getState()?.expandedCommit).toMatchObject({
      hash: "abc123",
      comparison: { baseRef: "abc123", compareRef: "*", compareLabel: "Working Tree" }
    });

    const details: GitCommitDetails = {
      hash: "abc123",
      parents: [],
      author: "Alice",
      email: "alice@example.com",
      authorDate: 1,
      committer: "Alice",
      committerEmail: "alice@example.com",
      committerDate: 1,
      body: "Comparison",
      fileChanges: [
        { oldFilePath: "file.txt", newFilePath: "file.txt", type: "M", additions: 1, deletions: 0 }
      ]
    };
    receive({ command: "commitComparison", commitDetails: details, error: null });
    expect(document.getElementById("commitDetails")?.textContent).toContain("Working Tree");

    const file = document.querySelector<HTMLElement>(".gitFile");
    expect(file).not.toBeNull();
    file?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const viewDiffItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((candidate) => candidate.textContent === "View File Diff");
    viewDiffItem?.click();
    expect(latestRequest(vscodeMock.sentMessages, "viewDiff")).toEqual({
      command: "viewDiff",
      repo: REPO,
      commitHash: "abc123",
      oldRef: "abc123",
      newRef: "*",
      oldFilePath: "file.txt",
      newFilePath: "file.txt",
      type: "M"
    });
  });

  it("hides Compare with Working Tree in the commit menu when disabled", async () => {
    await bootWebview(
      withVisibility({
        commit: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commit,
          compareWithWorkingTree: false
        }
      })
    );

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    expect(contextMenuItems()).not.toContain("Compare with Working Tree");
    expect(contextMenuItems().length).toBeGreaterThan(0);
  });

  it("opens a working-tree comparison file in the GGL Diff tab with the '*' side", async () => {
    const vscodeMock = await bootWebview(defaultViewState);

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const compareItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((candidate) => candidate.textContent === "Compare with Working Tree");
    compareItem?.click();

    const details: GitCommitDetails = {
      hash: "abc123",
      parents: [],
      author: "Alice",
      email: "alice@example.com",
      authorDate: 1,
      committer: "Alice",
      committerEmail: "alice@example.com",
      committerDate: 1,
      body: "Comparison",
      fileChanges: [
        { oldFilePath: "file.txt", newFilePath: "file.txt", type: "M", additions: 1, deletions: 0 }
      ]
    };
    receive({ command: "commitComparison", commitDetails: details, error: null });

    document
      .querySelector<HTMLElement>(".gitFile")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).toContain("Open in GGL Diff");
    const openTabItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((candidate) => candidate.textContent === "Open in GGL Diff");
    openTabItem?.click();

    expect(latestRequest(vscodeMock.sentMessages, "openDiffTab")).toEqual({
      command: "openDiffTab",
      repo: REPO,
      commitHash: "abc123",
      oldRef: "abc123",
      newRef: "*",
      oldFilePath: "file.txt",
      newFilePath: "file.txt",
      type: "M"
    });
  });

  it("hides Open in GGL Diff in the file menu when its visibility switch is off", async () => {
    await bootWebview(
      withVisibility({
        commitDetailsViewFile: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commitDetailsViewFile,
          openDiffTab: false
        }
      })
    );

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const details: GitCommitDetails = {
      hash: "abc123",
      parents: [],
      author: "Alice",
      email: "alice@example.com",
      authorDate: 1,
      committer: "Alice",
      committerEmail: "alice@example.com",
      committerDate: 1,
      body: "Details",
      fileChanges: [
        { oldFilePath: "file.txt", newFilePath: "file.txt", type: "M", additions: 1, deletions: 0 }
      ]
    };
    receive({ command: "commitDetails", commitDetails: details, error: null });

    document
      .querySelector<HTMLElement>(".gitFile")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    expect(contextMenuItems()).toContain("View File Diff");
    expect(contextMenuItems()).not.toContain("Open in GGL Diff");
  });

  it("offers Show Blame at Commit for modified and renamed files and omits binary files (F4-07)", async () => {
    const vscodeMock = await bootWebview(defaultViewState);

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const details: GitCommitDetails = {
      hash: "abc123",
      parents: ["parent0"],
      author: "Alice",
      email: "alice@example.com",
      authorDate: 1,
      committer: "Alice",
      committerEmail: "alice@example.com",
      committerDate: 1,
      body: "Details",
      fileChanges: [
        {
          oldFilePath: "src/app.ts",
          newFilePath: "src/app.ts",
          type: "M",
          additions: 2,
          deletions: 1
        },
        {
          oldFilePath: "src/old.ts",
          newFilePath: "src/new.ts",
          type: "R",
          additions: 1,
          deletions: 1
        },
        {
          oldFilePath: "img.png",
          newFilePath: "img.png",
          type: "M",
          additions: null,
          deletions: null
        }
      ]
    };
    receive({ command: "commitDetails", commitDetails: details, error: null });

    const files = document.querySelectorAll<HTMLElement>(".gitFile");
    expect(files).toHaveLength(3);

    files[0]?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const modBlame = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((candidate) => candidate.textContent === "Show Blame at Commit");
    expect(modBlame).toBeDefined();
    modBlame?.click();
    expect(latestRequest(vscodeMock.sentMessages, "showBlame")).toEqual({
      command: "showBlame",
      repo: REPO,
      filePath: "src/app.ts",
      rev: "abc123"
    });

    files[1]?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const renameBlame = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((candidate) => candidate.textContent === "Show Blame at Commit");
    expect(renameBlame).toBeDefined();
    renameBlame?.click();
    expect(latestRequest(vscodeMock.sentMessages, "showBlame")).toEqual({
      command: "showBlame",
      repo: REPO,
      filePath: "src/new.ts",
      rev: "abc123"
    });

    files[2]?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItems()).not.toContain("Show Blame at Commit");
    expect(contextMenuItems()).not.toContain("Show Blame Before Deletion");
  });

  it("offers Show Blame Before Deletion using the first parent, and omits it on root commits without stray dividers (F4-07)", async () => {
    const vscodeMock = await bootWebview(defaultViewState);

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const withParent: GitCommitDetails = {
      hash: "abc123",
      parents: ["parent0", "parent1"],
      author: "Alice",
      email: "alice@example.com",
      authorDate: 1,
      committer: "Alice",
      committerEmail: "alice@example.com",
      committerDate: 1,
      body: "Delete with parent",
      fileChanges: [
        {
          oldFilePath: "removed.ts",
          newFilePath: "removed.ts",
          type: "D",
          additions: 0,
          deletions: 4
        }
      ]
    };
    receive({ command: "commitDetails", commitDetails: withParent, error: null });

    document
      .querySelector<HTMLElement>(".gitFile")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    const beforeDelete = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((candidate) => candidate.textContent === "Show Blame Before Deletion");
    expect(beforeDelete).toBeDefined();
    beforeDelete?.click();
    expect(latestRequest(vscodeMock.sentMessages, "showBlame")).toEqual({
      command: "showBlame",
      repo: REPO,
      filePath: "removed.ts",
      rev: "parent0"
    });

    const withoutParent: GitCommitDetails = {
      ...withParent,
      parents: []
    };
    receive({ command: "commitDetails", commitDetails: withoutParent, error: null });

    document
      .querySelector<HTMLElement>(".gitFile")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuLayout()).toEqual([
      "View File Diff",
      "Open in GGL Diff",
      "—",
      "Copy Absolute File Path to Clipboard",
      "Copy Relative File Path to Clipboard"
    ]);
  });

  it("hides Show Blame in the file menu without leaving a stray divider when disabled (F4-07)", async () => {
    await bootWebview(
      withVisibility({
        commitDetailsViewFile: {
          ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commitDetailsViewFile,
          showBlame: false
        }
      })
    );

    document
      .querySelector<HTMLElement>('tr.commit[data-hash="abc123"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const details: GitCommitDetails = {
      hash: "abc123",
      parents: ["parent0"],
      author: "Alice",
      email: "alice@example.com",
      authorDate: 1,
      committer: "Alice",
      committerEmail: "alice@example.com",
      committerDate: 1,
      body: "Details",
      fileChanges: [
        { oldFilePath: "file.txt", newFilePath: "file.txt", type: "M", additions: 1, deletions: 0 }
      ]
    };
    receive({ command: "commitDetails", commitDetails: details, error: null });

    document
      .querySelector<HTMLElement>(".gitFile")
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    const layout = contextMenuLayout();
    expect(layout).not.toContain("Show Blame at Commit");
    expect(layout.slice(0, 3)).toEqual([
      "View File Diff",
      "Open in GGL Diff",
      "View File at Revision"
    ]);
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
