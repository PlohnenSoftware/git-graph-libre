import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/fetch-defaults-repo";
const FETCH_TAGS_CONFIG_KEY = "repository.fetchTagsByDefault";
const FETCH_TAGS_SETTING_KEY = `git-graph-libre.${FETCH_TAGS_CONFIG_KEY}`;

type LoadBranchesRequest = Extract<GGL.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GGL.RequestMessage, { command: "loadCommits" }>;
type LoadRepoInfoRequest = Extract<GGL.RequestMessage, { command: "loadRepoInfo" }>;

function makeViewState(fetchTagsByDefault: boolean): GGL.GitGraphViewState {
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
    fetchTagsByDefault,
    onlyFollowFirstParent: false,
    repos: { [REPO]: { columnWidths: null } },
    showCurrentBranchByDefault: false,
    showRemoteBranches: true,
    showStashes: true,
    showTags: true,
    shortHashLength: 8
  };
}

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
  authors: ["Alice"],
  tags: ["v1.0.0"],
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
    parentHashes: [],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: "Add feature",
    refs: [{ hash: "abc123", name: "main", type: "head" }]
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
 * Sends the live settings-hub update the extension host posts back after the
 * user flips `repository.fetchTagsByDefault` while the graph is open.
 */
function receiveFetchTagsSetting(value: boolean) {
  receive({
    command: "updateExtensionSetting",
    key: FETCH_TAGS_SETTING_KEY,
    status: null,
    settings: [
      {
        key: FETCH_TAGS_SETTING_KEY,
        configKey: FETCH_TAGS_CONFIG_KEY,
        title: FETCH_TAGS_CONFIG_KEY,
        description: "",
        type: "boolean",
        value,
        defaultValue: true,
        scope: "global"
      }
    ]
  });
}

/**
 * Boots the webview against a view state carrying the given setting, answers
 * the startup requests so the toolbar Fetch button is available (it is hidden
 * until the repo is known to have a remote), optionally flips the setting live
 * the way the settings hub does, then opens the Fetch popup.
 */
async function openFetchDialog(fetchTagsByDefault: boolean, applySetting?: boolean) {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const vscodeMock = createVscodeMock();
  setupHtml(makeViewState(fetchTagsByDefault));
  await import("@/webview/main");

  const loadRepoInfoRequest: LoadRepoInfoRequest = latest(vscodeMock.sentMessages, "loadRepoInfo");
  receive({
    command: "loadRepoInfo",
    requestId: loadRepoInfoRequest.requestId,
    repoInfo,
    error: null
  });
  const loadBranchesRequest: LoadBranchesRequest = latest(vscodeMock.sentMessages, "loadBranches");
  receive({
    command: "loadBranches",
    requestId: loadBranchesRequest.requestId,
    branches: ["main"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
  });
  const loadCommitsRequest: LoadCommitsRequest = latest(vscodeMock.sentMessages, "loadCommits");
  receive({
    command: "loadCommits",
    requestId: loadCommitsRequest.requestId,
    commits,
    head: "abc123",
    moreCommitsAvailable: false,
    hard: true,
    error: null
  });

  if (applySetting !== undefined) receiveFetchTagsSetting(applySetting);

  const fetchBtn = document.getElementById("fetchBtn") as HTMLButtonElement | null;
  expect(fetchBtn?.hidden).toBe(false);
  fetchBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  return {
    vscodeMock,
    tagsCheckbox: document.getElementById("dialogInput2") as HTMLInputElement | null
  };
}

describe("fetch dialog defaults", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pre-checks the fetch tags option when the setting is enabled", async () => {
    const { tagsCheckbox } = await openFetchDialog(true);

    // The tags option is the third checkbox in the toolbar Fetch popup, after
    // prune and prune tags; those two stay unchecked regardless.
    expect(document.getElementById("dialog")?.textContent).toContain("Fetch all tags");
    expect(tagsCheckbox).not.toBeNull();
    expect(tagsCheckbox?.checked).toBe(true);
    expect((document.getElementById("dialogInput0") as HTMLInputElement | null)?.checked).toBe(
      false
    );
    expect((document.getElementById("dialogInput1") as HTMLInputElement | null)?.checked).toBe(
      false
    );
  });

  it("leaves the fetch tags option unchecked when the setting is disabled", async () => {
    const { tagsCheckbox } = await openFetchDialog(false);

    expect(document.getElementById("dialog")?.textContent).toContain("Fetch all tags");
    expect(tagsCheckbox).not.toBeNull();
    expect(tagsCheckbox?.checked).toBe(false);
  });

  it("pre-checks the fetch tags option after the setting is turned on live", async () => {
    // Boot with the setting off, then flip it through the settings-hub update
    // route so the dialog reads the changed config, not the boot view state.
    const { tagsCheckbox } = await openFetchDialog(false, true);

    expect(tagsCheckbox).not.toBeNull();
    expect(tagsCheckbox?.checked).toBe(true);
  });

  it("fetches tags straight from the pre-checked default on submit", async () => {
    const { vscodeMock } = await openFetchDialog(true);

    vscodeMock.clearMessages();
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    const commands = vscodeMock.sentMessages.map((msg) => msg.command);
    expect(commands).toContain("fetchRemotes");
    expect(commands).toContain("fetchTags");
    expect(vscodeMock.sentMessages.find((msg) => msg.command === "fetchTags")).toEqual({
      command: "fetchTags",
      repo: REPO,
      remotes: ["origin"],
      pruneTags: false
    });
  });
});
