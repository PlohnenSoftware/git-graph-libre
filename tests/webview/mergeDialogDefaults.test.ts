import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/merge-dialog-defaults";
const MERGE_CONFIG_KEY = "dialog.merge.noFastForward";
const PULL_CONFIG_KEY = "dialog.pullBranch.noFastForward";

type Defaults = { mergeNoFastForward: boolean; pullBranchNoFastForward: boolean };

function makeViewState({ mergeNoFastForward, pullBranchNoFastForward }: Defaults) {
  return {
    autoCenterCommitDetailsView: false,
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
    mergeNoFastForward,
    pullBranchNoFastForward,
    onlyFollowFirstParent: false,
    repos: { [REPO]: { columnWidths: null } },
    showCurrentBranchByDefault: false,
    showRemoteBranches: true,
    showStashes: true,
    showTags: true,
    shortHashLength: 8,
    language: "en",
    languages: [{ id: "en", label: "English" }]
  } satisfies GGL.GitGraphViewState;
}

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

// Each ref sits on its own commit: a local branch and its remote counterpart
// would otherwise be rendered as one grouped badge.
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
    parentHashes: ["ghi789"],
    author: "Bob",
    email: "bob@example.com",
    date: 1_699_000_000,
    message: "Feature commit",
    refs: [{ hash: "def456", name: "feature", type: "head" }]
  },
  {
    hash: "ghi789",
    parentHashes: [],
    author: "Cara",
    email: "cara@example.com",
    date: 1_698_000_000,
    message: "Remote commit",
    refs: [{ hash: "ghi789", name: "origin/other", type: "remote" }]
  }
];

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

/**
 * Sends the live settings-hub update the extension host posts back when the
 * user flips one of the dialog defaults while the graph is open, so the next
 * dialog reads the changed config rather than the boot view state.
 */
function receiveSetting(configKey: string, value: boolean) {
  const key = `git-graph-libre.${configKey}`;
  receive({
    command: "updateExtensionSetting",
    key,
    status: null,
    settings: [
      {
        key,
        configKey,
        title: configKey,
        description: "",
        type: "boolean",
        value,
        defaultValue: false,
        scope: "global"
      }
    ]
  });
}

async function bootWebview(defaults: Defaults) {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const vscodeMock = createVscodeMock();
  setupHtml(makeViewState(defaults));
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
    branches: ["main", "feature", "remotes/origin/other"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
  });
  receive({
    command: "loadCommits",
    requestId: latest(vscodeMock.sentMessages, "loadCommits").requestId,
    commits,
    head: "abc123",
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });
  return vscodeMock;
}

function openContextMenu(selector: string, label: string) {
  const source = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (elem) => label === "" || elem.textContent?.includes(label)
  );
  expect(source).not.toBeUndefined();
  source?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
}

function clickContextMenuItem(text: string) {
  const item = Array.from(document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem"))
    .filter((elem) => elem.textContent?.includes(text))
    .at(0);
  expect(item).not.toBeUndefined();
  item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function noFastForwardCheckbox() {
  const checkbox = document.getElementById("dialogInput0") as HTMLInputElement | null;
  expect(checkbox).not.toBeNull();
  return checkbox;
}

function submitDialog() {
  document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
}

const MERGE_LABEL = "Merge into current branch";

describe("merge and pull dialog no-fast-forward defaults", () => {
  it.each([true, false])(
    "opens the branch merge dialog with the no-fast-forward option set to %s",
    async (mergeNoFastForward) => {
      const vscodeMock = await bootWebview({ mergeNoFastForward, pullBranchNoFastForward: false });

      openContextMenu(".gitRef.head", "feature");
      clickContextMenuItem(MERGE_LABEL);
      expect(noFastForwardCheckbox()?.checked).toBe(mergeNoFastForward);

      submitDialog();
      expect(latest(vscodeMock.sentMessages, "mergeBranch")).toEqual({
        command: "mergeBranch",
        repo: REPO,
        branchName: "feature",
        createNewCommit: mergeNoFastForward,
        squash: false,
        noCommit: false,
        noVerify: false
      });
    }
  );

  it.each([true, false])(
    "opens the commit merge dialog with the no-fast-forward option set to %s",
    async (mergeNoFastForward) => {
      const vscodeMock = await bootWebview({ mergeNoFastForward, pullBranchNoFastForward: false });

      openContextMenu('tr.commit[data-hash="ghi789"]', "");
      clickContextMenuItem(MERGE_LABEL);
      expect(noFastForwardCheckbox()?.checked).toBe(mergeNoFastForward);

      submitDialog();
      expect(latest(vscodeMock.sentMessages, "mergeCommit")).toEqual({
        command: "mergeCommit",
        repo: REPO,
        commitHash: "ghi789",
        createNewCommit: mergeNoFastForward,
        squash: false,
        noCommit: false,
        noVerify: false
      });
    }
  );

  it.each([true, false])(
    "opens the pull dialog with the no-fast-forward option set to %s",
    async (pullBranchNoFastForward) => {
      const vscodeMock = await bootWebview({
        mergeNoFastForward: true,
        pullBranchNoFastForward
      });

      openContextMenu(".gitRef.remote", "origin/other");
      clickContextMenuItem("Pull Branch");
      expect(noFastForwardCheckbox()?.checked).toBe(pullBranchNoFastForward);

      submitDialog();
      expect(latest(vscodeMock.sentMessages, "pullBranch")).toEqual({
        command: "pullBranch",
        repo: REPO,
        remote: "origin",
        branchName: "other",
        createNewCommit: pullBranchNoFastForward,
        squash: false,
        noVerify: false
      });
    }
  );

  it("applies both defaults flipped live from the settings hub", async () => {
    await bootWebview({ mergeNoFastForward: true, pullBranchNoFastForward: false });

    receiveSetting(MERGE_CONFIG_KEY, false);
    receiveSetting(PULL_CONFIG_KEY, true);

    openContextMenu(".gitRef.head", "feature");
    clickContextMenuItem(MERGE_LABEL);
    expect(noFastForwardCheckbox()?.checked).toBe(false);
    submitDialog();

    openContextMenu(".gitRef.remote", "origin/other");
    clickContextMenuItem("Pull Branch");
    expect(noFastForwardCheckbox()?.checked).toBe(true);
  });
});
