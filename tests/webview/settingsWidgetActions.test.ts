import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/my-repo";

type LoadBranchesRequest = Extract<GGL.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GGL.RequestMessage, { command: "loadCommits" }>;
type LoadRepoInfoRequest = Extract<GGL.RequestMessage, { command: "loadRepoInfo" }>;

// A repository with every optional setting populated, so the settings widget
// renders the remove/clear actions alongside the edit ones.
const repoState: GGL.GitRepoState = {
  columnWidths: null,
  displayName: "My Repo",
  issueLinking: { pattern: "#(\\d+)", urlTemplate: "https://example.test/issues/$1" },
  pullRequest: {
    remoteName: "origin",
    baseBranch: "main",
    urlTemplate: "https://example.test/compare/$1",
    pushBeforeCreate: false
  }
};

const viewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  showSignatureColumn: false,
  graphColors: ["oklch(65% 0.16 250)"],
  customBranchGlobPatterns: [],
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
  graphFontSize: 13,
  graphRowHeight: 24,
  graphStyle: "rounded",
  revealHighlightColor: "oklch(90% 0.25 150 / 0.42)",
  includeReflog: false,
  includeUnreachableCommits: false,
  initialLoadCommits: 300,
  lastActiveRepo: null,
  loadMoreCommits: 75,
  muteCommitsNotAncestorsOfHead: true,
  muteMergeCommits: false,
  boldCheckedOutCommit: false,
  fetchTagsByDefault: true,
  onlyFollowFirstParent: false,
  repos: { [REPO]: repoState },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 4,
  telemetryConsent: "enabled"
};

const commits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: [],
    author: "Ada",
    email: "ada@example.test",
    date: 1700000000,
    message: "Initial commit",
    refs: [{ hash: "abc123", name: "main", type: "head" }]
  }
];

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
  authors: ["Ada"],
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
    userName: { local: "Ada", global: "Ada Lovelace" },
    userEmail: { local: "ada@example.test", global: "ada@global.test" }
  }
};

let vscodeMock: ReturnType<typeof createVscodeMock>;

function latest<T extends GGL.RequestMessage["command"]>(command: T) {
  for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
    const msg = vscodeMock.sentMessages[i];
    if (msg.command === command) return msg as Extract<GGL.RequestMessage, { command: T }>;
  }
  throw new Error(`Missing ${command} request`);
}

async function bootWithSettingsOpen() {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vscodeMock = createVscodeMock();
  setupHtml(structuredClone(viewState));
  await import("@/webview/main");
  receive({
    command: "loadRepoInfo",
    requestId: (latest("loadRepoInfo") as LoadRepoInfoRequest).requestId,
    repoInfo,
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: (latest("loadBranches") as LoadBranchesRequest).requestId,
    branches: ["main"],
    head: "main",
    hard: true,
    isRepo: true,
    error: null
  });
  receive({
    command: "loadCommits",
    requestId: (latest("loadCommits") as LoadCommitsRequest).requestId,
    commits,
    head: "abc123",
    moreCommitsAvailable: false,
    hard: true,
    error: null
  } as unknown as GGL.ResponseMessage);
  document.getElementById("settingsBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  vscodeMock.clearMessages();
}

function click(id: string) {
  const button = document.getElementById(id);
  if (button === null) throw new Error(`Missing settings control #${id}`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

// Selecting the extension tab asks the host for the settings list; the tab's
// controls only render once that response arrives.
function openExtensionTab() {
  click("settingsExtensionTab");
  const settings: GGL.ExtensionSetting[] = [
    {
      key: "git-graph-libre.repository.showTags",
      configKey: "repository.showTags",
      title: "repository.showTags",
      description: "Show tags",
      type: "boolean",
      value: true,
      defaultValue: true,
      scope: "global"
    }
  ];
  receive({
    command: "loadExtensionSettings",
    requestId: latest("loadExtensionSettings").requestId,
    settings,
    status: null
  } as unknown as GGL.ResponseMessage);
}

function dialogIsOpen() {
  const dialog = document.getElementById("dialog");
  return dialog !== null && dialog.innerHTML.trim() !== "";
}

const dialogActions = [
  "settingsEditRepoName",
  "settingsEditUserDetails",
  "settingsRemoveUserDetails",
  "settingsAddRemote",
  "settingsEditIssueLinking",
  "settingsEditPullRequest",
  "settingsExportRepoConfig",
  "settingsImportRepoConfig"
];

const messageActions = [
  "settingsClearRepoName",
  "settingsRemoveIssueLinking",
  "settingsRemovePullRequest"
];

// These two live on the extension tab, so they only exist once it is selected.
const extensionTabActions = ["settingsExportExtensionSettings", "settingsImportExtensionSettings"];

describe("repository settings widget actions", () => {
  it("opens the widget from the toolbar", async () => {
    await bootWithSettingsOpen();

    expect(document.getElementById("settingsWidget")?.hasAttribute("hidden")).toBe(false);
    expect(document.getElementById("settingsBtn")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("closes the widget from its close control", async () => {
    await bootWithSettingsOpen();

    click("settingsCloseBtn");

    expect(document.getElementById("settingsWidget")?.hasAttribute("hidden")).toBe(true);
  });

  it.each(dialogActions)("opens a dialog from %s", async (id) => {
    await bootWithSettingsOpen();

    click(id);

    expect(dialogIsOpen()).toBe(true);
  });

  it.each(messageActions)("sends a request from %s", async (id) => {
    await bootWithSettingsOpen();

    click(id);

    expect(vscodeMock.sentMessages.length).toBeGreaterThan(0);
  });

  it.each(extensionTabActions)("sends a request from %s on the extension tab", async (id) => {
    await bootWithSettingsOpen();
    openExtensionTab();
    vscodeMock.clearMessages();

    click(id);

    expect(vscodeMock.sentMessages.length).toBeGreaterThan(0);
  });

  it("switches between the repository and extension tabs", async () => {
    await bootWithSettingsOpen();

    click("settingsExtensionTab");
    expect(document.getElementById("settingsExtensionPanel")?.hasAttribute("hidden")).toBe(false);

    click("settingsRepositoryTab");
    expect(document.getElementById("settingsRepositoryPanel")?.hasAttribute("hidden")).toBe(false);
  });
});
