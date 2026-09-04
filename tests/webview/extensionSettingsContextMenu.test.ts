import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/extension-settings-context-menu";

const defaultViewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: false,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  // What `buildWebviewHtml()` really emits: `config.contextMenuActionsVisibility()`
  // runs `normalizeContextMenuActionsVisibility()`, so the booted webview always
  // holds a fully populated map even when the user has set nothing.
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
  language: "en",
  languages: [{ id: "en", label: "English" }]
};

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
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
    parentHashes: [],
    author: "Bob",
    email: "bob@example.com",
    date: 1_699_000_000,
    message: "Older commit",
    refs: []
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

function extensionSetting(
  configKey: string,
  type: GGL.ExtensionSetting["type"],
  value: GGL.JsonValue,
  defaultValue: GGL.JsonValue
): GGL.ExtensionSetting {
  return {
    key: `git-graph-libre.${configKey}`,
    configKey,
    title: configKey,
    description: "",
    type,
    value,
    defaultValue,
    scope: "default"
  };
}

/**
 * The shape `loadExtensionSettings()` really returns after any settings-hub
 * write: the *whole* manifest-derived list, each entry carrying
 * `config.get(configKey, manifestDefault)`. For a user who has never set
 * `contextMenuActionsVisibility` that value is the manifest default `{}` — not
 * the normalized map the webview booted with.
 */
function settingsListAfterAWrite(): GGL.ExtensionSetting[] {
  return [
    extensionSetting("contextMenuActionsVisibility", "object", {}, {}),
    extensionSetting("dialog.merge.noFastForward", "boolean", false, true)
  ];
}

async function bootWebview() {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const vscodeMock = createVscodeMock();
  setupHtml(defaultViewState);
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

/**
 * Empties the menu element first: a builder that throws leaves the previously
 * rendered menu in the DOM, so asserting against it would read the last
 * successful open rather than this one.
 */
function openContextMenu(selector: string) {
  const menu = document.getElementById("contextMenu");
  if (menu !== null) menu.innerHTML = "";
  document
    .querySelector<HTMLElement>(selector)
    ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
}

function openCommitContextMenu() {
  openContextMenu('tr.commit[data-hash="def456"]');
}

function openBranchContextMenu() {
  openContextMenu(".gitRef.head");
}

function contextMenuItems() {
  return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).map(
    (item) => item.textContent ?? ""
  );
}

describe("context menus survive a settings-hub update", () => {
  it("keeps every context menu working after a setting is changed", async () => {
    await bootWebview();

    openCommitContextMenu();
    expect(contextMenuItems().length).toBeGreaterThan(0);

    // A settings-hub write echoes the whole settings list back, so every
    // setting is re-applied — including ones the user never touched.
    receive({
      command: "updateExtensionSetting",
      key: "git-graph-libre.dialog.merge.noFastForward",
      status: null,
      settings: settingsListAfterAWrite()
    });

    openCommitContextMenu();
    expect(contextMenuItems().length).toBeGreaterThan(0);

    openBranchContextMenu();
    expect(contextMenuItems().length).toBeGreaterThan(0);
  });

  it("keeps the visibility map complete when the stored value is partial", async () => {
    await bootWebview();

    receive({
      command: "updateExtensionSetting",
      key: "git-graph-libre.contextMenuActionsVisibility",
      status: null,
      settings: [
        extensionSetting(
          "contextMenuActionsVisibility",
          "object",
          { commit: { addTag: false } },
          {}
        )
      ]
    });

    openCommitContextMenu();
    const items = contextMenuItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => item.includes("Add Tag"))).toBe(false);
    expect(items.some((item) => item.includes("Create Branch"))).toBe(true);
  });
});
