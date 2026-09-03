import { beforeAll, describe, expect, it, vi } from "vitest";

import type {
  GitCommitDetails,
  GitCommitNode,
  GitCommitSearchResult,
  GitRepoInfo
} from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";
import {
  COMMIT_DETAILS_COLLAPSED_HEIGHT,
  COMMIT_DETAILS_DEFAULT_HEIGHT,
  COMMIT_DETAILS_KEYBOARD_RESIZE_STEP,
  COMMIT_DETAILS_MIN_HEIGHT
} from "@/webview/commitDetailsView";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/my-repo";
type LoadBranchesRequest = Extract<GGL.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GGL.RequestMessage, { command: "loadCommits" }>;
type LoadExtensionSettingsRequest = Extract<
  GGL.RequestMessage,
  { command: "loadExtensionSettings" }
>;
type LoadRepoInfoRequest = Extract<GGL.RequestMessage, { command: "loadRepoInfo" }>;
type SaveRepoStateRequest = Extract<GGL.RequestMessage, { command: "saveRepoState" }>;
type SearchCommitsRequest = Extract<GGL.RequestMessage, { command: "searchCommits" }>;
type UpdateExtensionSettingRequest = Extract<
  GGL.RequestMessage,
  { command: "updateExtensionSetting" }
>;

const defaultViewState: GGL.GitGraphViewState = {
  autoCenterCommitDetailsView: true,
  dateFormat: "Date & Time",
  fetchAvatars: false,
  showSignatureColumn: false,
  graphColors: ["oklch(65% 0.16 250)"],
  customBranchGlobPatterns: [{ name: "Features", glob: "--glob=heads/feature/*" }],
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
  // Deliberately off, unlike the manifest default: the fetch-dialog tests in
  // this file drive the tags checkbox explicitly and assert the "tags not
  // requested" path. The shipped default-on behavior is covered by
  // tests/webview/fetchDialogDefaults.test.ts.
  fetchTagsByDefault: false,
  onlyFollowFirstParent: false,
  repos: { [REPO]: { columnWidths: null } },
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 4,
  telemetryConsent: "enabled"
};

const twoCommits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: ["def456"],
    author: "Alice",
    email: "alice@example.com",
    date: 1700000000,
    message: "Add feature",
    refs: [
      { hash: "abc123", name: "main", type: "head" },
      { hash: "abc123", name: "v1.0.0", type: "tag" }
    ]
  },
  {
    hash: "def456",
    parentHashes: [],
    author: "Bob",
    email: "bob@example.com",
    date: 1699000000,
    message: "Initial commit",
    refs: []
  }
];

const threeCommitChain: GitCommitNode[] = [
  twoCommits[0],
  {
    ...twoCommits[1],
    parentHashes: ["ghi789"]
  },
  {
    hash: "ghi789",
    parentHashes: [],
    author: "Cara",
    email: "cara@example.com",
    date: 1698000000,
    message: "Base commit",
    refs: []
  }
];

const firstCommitDetails: GitCommitDetails = {
  hash: "abc123",
  parents: ["def456"],
  author: "Alice",
  email: "alice@example.com",
  authorDate: 1700000000,
  committer: "Alice",
  committerEmail: "alice@example.com",
  committerDate: 1700000000,
  body: "Detailed message",
  fileChanges: [
    {
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M",
      additions: 3,
      deletions: 1
    }
  ]
};

const repoInfoWithoutRemotes: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
  authors: ["Alice", "Bob"],
  tags: ["v1.0.0"],
  remotes: [],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  }
};

const repoInfoWithRemote: GitRepoInfo = {
  ...repoInfoWithoutRemotes,
  remotes: [
    {
      name: "origin",
      fetchUrls: ["https://example.test/repo.git"],
      pushUrls: ["https://example.test/repo.git"]
    }
  ]
};

const repoInfoWithTwoRemotes: GitRepoInfo = {
  ...repoInfoWithoutRemotes,
  remotes: [
    {
      name: "origin",
      fetchUrls: ["https://example.test/repo.git"],
      pushUrls: ["https://example.test/repo.git"]
    },
    {
      name: "upstream",
      fetchUrls: ["https://example.test/upstream.git"],
      pushUrls: ["https://example.test/upstream.git"]
    }
  ]
};

const repoInfoWithStash: GitRepoInfo = {
  ...repoInfoWithoutRemotes,
  stashes: [
    {
      index: 0,
      ref: "stash@{0}",
      hash: "feed1234",
      message: "WIP on main: stash polish",
      date: 1700500000
    }
  ],
  stashCount: 1
};

describe("webview rendering", () => {
  let vscodeMock: ReturnType<typeof createVscodeMock>;

  function latestLoadBranchesRequest(): LoadBranchesRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "loadBranches") return msg;
    }
    throw new Error("Missing loadBranches request");
  }

  function latestLoadCommitsRequest(): LoadCommitsRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "loadCommits") return msg;
    }
    throw new Error("Missing loadCommits request");
  }

  function latestLoadExtensionSettingsRequest(): LoadExtensionSettingsRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "loadExtensionSettings") return msg;
    }
    throw new Error("Missing loadExtensionSettings request");
  }

  function latestLoadRepoInfoRequest(): LoadRepoInfoRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "loadRepoInfo") return msg;
    }
    throw new Error("Missing loadRepoInfo request");
  }

  function latestSearchCommitsRequest(): SearchCommitsRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "searchCommits") return msg;
    }
    throw new Error("Missing searchCommits request");
  }

  function latestUpdateExtensionSettingRequest(): UpdateExtensionSettingRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "updateExtensionSetting") return msg;
    }
    throw new Error("Missing updateExtensionSetting request");
  }

  function latestSaveRepoStateRequest(): SaveRepoStateRequest {
    for (let i = vscodeMock.sentMessages.length - 1; i >= 0; i--) {
      const msg = vscodeMock.sentMessages[i];
      if (msg.command === "saveRepoState") return msg;
    }
    throw new Error("Missing saveRepoState request");
  }

  function sentLoadCommitsCount() {
    return vscodeMock.sentMessages.filter((msg) => msg.command === "loadCommits").length;
  }

  function getFindInput() {
    const input = document.getElementById("findInput") as HTMLInputElement | null;
    if (input === null) throw new Error("Missing find input");
    return input;
  }

  function setFindQuery(query: string) {
    const input = getFindInput();
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function findRow(hash: string) {
    return document.querySelector<HTMLTableRowElement>(`tr.commit[data-hash="${hash}"]`);
  }

  function clearFind() {
    document
      .getElementById("findClearBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function contextMenuItem(label: string) {
    return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).find((item) =>
      item.textContent?.includes(label)
    );
  }

  function clickContextMenuItem(label: string) {
    const item = contextMenuItem(label);
    expect(item).not.toBeUndefined();
    item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function openHeadCommitContextMenu() {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();
    headRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  }

  function openStashContextMenu() {
    const stashRow = document.querySelector<HTMLElement>(".stashRow");
    expect(stashRow).not.toBeNull();
    stashRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  }

  function openUncommittedChangesContextMenu() {
    const unsavedRow = document.querySelector<HTMLElement>(".unsavedChanges");
    expect(unsavedRow).not.toBeNull();
    unsavedRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  }

  function openFirstGitFileContextMenu() {
    const gitFile = document.querySelector<HTMLElement>(".gitFile");
    expect(gitFile).not.toBeNull();
    gitFile?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
  }

  function dismissDialog() {
    document.getElementById("dialogDismiss")?.dispatchEvent(new MouseEvent("click"));
  }

  function gitRef(label: string, selector = ".gitRef") {
    return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((ref) =>
      ref.textContent?.includes(label)
    );
  }

  function clickDropdownOption(dropdownId: string, label: string) {
    const dropdown = document.getElementById(dropdownId);
    const currentValue = dropdown?.querySelector<HTMLElement>(".dropdownCurrentValue");
    currentValue?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const option = Array.from(
      dropdown?.querySelectorAll<HTMLElement>(".dropdownOption") ?? []
    ).find((item) => item.textContent?.includes(label));
    expect(option).not.toBeUndefined();
    option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function setDialogInput(value: string) {
    const input = document.getElementById("dialogInput0") as HTMLInputElement | null;
    if (input === null) throw new Error("Missing dialog input");
    input.value = value;
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  function receiveLoadedCommits(commits: GitCommitNode[], head: string) {
    receive({
      command: "loadCommits",
      requestId: null,
      commits,
      head,
      moreCommitsAvailable: true,
      hard: true,
      error: null
    } as unknown as GGL.ResponseMessage);
  }

  function receiveExtensionSetting(configKey: string, value: GGL.JsonValue) {
    receive({
      command: "updateExtensionSetting",
      key: `git-graph-libre.${configKey}`,
      status: null,
      settings: [
        {
          key: `git-graph-libre.${configKey}`,
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

  beforeAll(async () => {
    vi.resetModules();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vscodeMock = createVscodeMock();
    setupHtml(defaultViewState);
    await import("@/webview/main");
    const loadRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: loadRepoInfoRequest.requestId,
      repoInfo: repoInfoWithoutRemotes,
      error: null
    });
    const loadBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const loadCommitsRequest = latestLoadCommitsRequest();
    expect(loadCommitsRequest.showSignature).toBe(false);
    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("shows Load More Commits button when more commits are available", () => {
    expect(document.getElementById("loadMoreCommitsBtn")).not.toBeNull();
  });

  it("loads more commits from the footer action", () => {
    document
      .getElementById("loadMoreCommitsBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("statusText")?.textContent).toBe("Loading more commits");
    expect(latestLoadCommitsRequest().maxCommits).toBe(375);

    const loadCommitsRequest = latestLoadCommitsRequest();
    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("renders the graph controls as an accessible toolbar", () => {
    const controls = document.getElementById("controls");

    expect(controls?.tagName).toBe("HEADER");
    expect(controls?.getAttribute("role")).toBe("toolbar");
    expect(document.getElementById("refreshBtn")?.tagName).toBe("BUTTON");
    expect((document.getElementById("fetchBtn") as HTMLButtonElement | null)?.hidden).toBe(true);
    expect(document.getElementById("blinkHeadBtn")?.getAttribute("aria-label")).toBe("Locate HEAD");
    expect(document.getElementById("terminalBtn")).toBeNull();
    expect(document.getElementById("settingsBtn")?.getAttribute("aria-label")).toBe(
      "Repository Settings"
    );
    expect(document.getElementById("authorSelect")?.classList.contains("dropdown")).toBe(true);
    expect(document.getElementById("tagSelect")?.classList.contains("dropdown")).toBe(true);
  });

  it("marks signed tags with the signed class, verified icon, and tooltip", () => {
    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [
            { hash: "abc123", name: "v1.0.0", type: "tag", signed: true },
            { hash: "abc123", name: "v0.9.0", type: "tag", signed: false },
            { hash: "abc123", name: "v0.8.0", type: "tag" }
          ]
        },
        twoCommits[1]
      ],
      "abc123"
    );

    const signed = gitRef("v1.0.0", ".gitRef.tag");
    expect(signed?.classList.contains("signed")).toBe(true);
    expect(signed?.title).toBe("v1.0.0 — signed tag");
    // The signed tag keeps the tag icon (on the commit-color background) AND
    // adds a separate verified badge on the signature-status green.
    expect(signed?.querySelector(".gitRefSignedBadge")).not.toBeNull();
    expect(signed?.querySelector(".gitRefSignedBadge svg.signedTagIcon")).not.toBeNull();
    expect(signed?.querySelector(":scope > svg.signedTagIcon")).toBeNull();

    for (const name of ["v0.9.0", "v0.8.0"]) {
      const unsigned = gitRef(name, ".gitRef.tag");
      expect(unsigned?.classList.contains("signed")).toBe(false);
      expect(unsigned?.title).toBe(name);
      // Normal/unsigned tags keep the tag icon and have no verified badge.
      expect(unsigned?.querySelector(".gitRefSignedBadge")).toBeNull();
    }

    expect(document.querySelectorAll(".gitRef.tag.signed")).toHaveLength(1);
    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("never marks branch refs as signed", () => {
    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [{ hash: "abc123", name: "main", type: "head" }]
        },
        twoCommits[1]
      ],
      "abc123"
    );

    expect(document.querySelectorAll(".gitRef.signed")).toHaveLength(0);
    expect(gitRef("main", ".gitRef.head")?.querySelector("svg.signedTagIcon")).toBeNull();
    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("groups local and matching remote branch refs without losing ref actions", () => {
    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [
            { hash: "abc123", name: "main", type: "head" },
            { hash: "abc123", name: "origin/main", type: "remote" },
            { hash: "abc123", name: "upstream/main", type: "remote" },
            { hash: "abc123", name: "v1.0.0", type: "tag" }
          ]
        },
        twoCommits[1]
      ],
      "abc123"
    );

    const group = document.querySelector<HTMLElement>(".gitRefGroup.active");
    expect(group?.querySelector(".gitRefPrimary.head")?.textContent).toContain("main");
    const aliases = Array.from(group?.querySelectorAll<HTMLElement>(".gitRefAlias.remote") ?? []);
    expect(aliases.map((alias) => alias.textContent?.trim())).toEqual(["origin", "upstream"]);
    expect(aliases.map((alias) => alias.title)).toEqual(["origin/main", "upstream/main"]);
    // Only the checked-out local segment carries the active (colored-border)
    // class; the remote alias segments sharing its group never do.
    expect(group?.querySelector(".gitRef.gitRefPrimary")?.classList.contains("active")).toBe(true);
    for (const alias of aliases) {
      expect(alias.classList.contains("active")).toBe(false);
    }
    expect(document.querySelectorAll(".gitRefGroup")).toHaveLength(1);
    expect(document.querySelectorAll(".gitRef.tag")).toHaveLength(1);

    aliases[0]?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Copy Branch Name");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Branch Name",
      data: "origin/main"
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("marks only the checked-out branch label as active beside other branches and tags", () => {
    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [
            { hash: "abc123", name: "feature/topic", type: "head" },
            { hash: "abc123", name: "main", type: "head" },
            { hash: "abc123", name: "v1.0.0", type: "tag" }
          ]
        },
        twoCommits[1]
      ],
      "abc123"
    );

    const activeRefs = document.querySelectorAll<HTMLElement>(".gitRef.active");
    expect(activeRefs).toHaveLength(1);
    expect(activeRefs[0]?.classList.contains("head")).toBe(true);
    expect(activeRefs[0]?.textContent).toContain("main");
    expect(gitRef("feature/topic", ".gitRef.head")?.classList.contains("active")).toBe(false);
    expect(gitRef("v1.0.0", ".gitRef.tag")?.classList.contains("active")).toBe(false);
    expect(document.querySelectorAll(".gitRefGroup")).toHaveLength(0);

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("sends selected branch glob, author, and tag filters from toolbar dropdowns", () => {
    clickDropdownOption("branchSelect", "Glob: Features");
    clickDropdownOption("authorSelect", "Alice");
    clickDropdownOption("tagSelect", "v1.0.0");

    const request = latestLoadCommitsRequest();
    expect(request).toMatchObject({
      branchName: "--glob=heads/feature/*",
      branches: ["--glob=heads/feature/*"],
      authors: ["Alice"],
      tags: ["v1.0.0"]
    });

    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    setFindQuery("feature");
    document
      .getElementById("findSearchHistoryBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const searchRequest = latestSearchCommitsRequest();
    expect(searchRequest).toMatchObject({
      branches: ["--glob=heads/feature/*"],
      authors: ["Alice"],
      tags: ["v1.0.0"]
    });
    receive({
      command: "searchCommits",
      requestId: searchRequest.requestId,
      results: [],
      error: null
    });
    clearFind();

    clickDropdownOption("tagSelect", "Show All");
    clickDropdownOption("authorSelect", "Show All");
    clickDropdownOption("branchSelect", "Show All");
    const resetRequest = latestLoadCommitsRequest();
    expect(resetRequest).toMatchObject({ branches: null, authors: null, tags: null });
    receive({
      command: "loadCommits",
      requestId: resetRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
    clearFind();
  });

  it("closes the settings popup from its header close button", () => {
    document
      .getElementById("settingsBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const settingsWidget = document.getElementById("settingsWidget");
    expect(settingsWidget?.hidden).toBe(false);
    const closeBtn = document.getElementById("settingsCloseBtn");
    expect(closeBtn?.getAttribute("aria-label")).toBe("Close settings");

    closeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("settingsWidget")?.hidden).toBe(true);
    expect(document.getElementById("settingsBtn")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("renders the extension settings tab and wires accessible tab controls", () => {
    const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement | null;
    expect(settingsBtn).not.toBeNull();
    if (document.getElementById("settingsWidget")?.hidden !== false) {
      settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }

    const extensionTab = document.getElementById(
      "settingsExtensionTab"
    ) as HTMLButtonElement | null;
    expect(extensionTab?.getAttribute("role")).toBe("tab");
    extensionTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const loadSettingsRequest = latestLoadExtensionSettingsRequest();
    expect(loadSettingsRequest.requestId).toBeGreaterThan(0);
    expect(vscodeMock.getState()?.settingsWidgetTab).toBe("extension");
    expect(document.getElementById("settingsRepositoryPanel")?.hidden).toBe(true);
    expect(document.getElementById("settingsExtensionPanel")?.hidden).toBe(false);
    expect(document.getElementById("settingsExtensionPanel")?.getAttribute("role")).toBe(
      "tabpanel"
    );

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
      },
      {
        key: "git-graph-libre.graphColors",
        configKey: "graphColors",
        title: "graphColors",
        description: "Graph colors",
        type: "array",
        value: ["oklch(63% 0.2 245)", "oklch(63% 0.2 350)"],
        defaultValue: [],
        scope: "default"
      },
      {
        key: "git-graph-libre.revealHighlightColor",
        configKey: "revealHighlightColor",
        title: "revealHighlightColor",
        description: "Reveal color",
        type: "string",
        value: "oklch(90% 0.25 150 / 0.42)",
        defaultValue: "oklch(90% 0.25 150 / 0.42)",
        scope: "default"
      }
    ];
    receive({
      command: "loadExtensionSettings",
      requestId: loadSettingsRequest.requestId,
      settings,
      status: null
    });

    const settingsWidget = document.getElementById("settingsWidget") as HTMLElement | null;
    expect(settingsWidget?.textContent).toContain("Extension Settings");
    expect(settingsWidget?.querySelectorAll(".settingsColorSwatch")).toHaveLength(3);

    const showTags = settingsWidget?.querySelector<HTMLInputElement>(
      'input[data-setting-key="git-graph-libre.repository.showTags"]'
    );
    expect(showTags?.checked).toBe(true);
    if (showTags === undefined || showTags === null) return;
    showTags.checked = false;
    showTags.dispatchEvent(new Event("change", { bubbles: true }));
    expect(latestUpdateExtensionSettingRequest()).toEqual({
      command: "updateExtensionSetting",
      key: "git-graph-libre.repository.showTags",
      value: false,
      global: true
    });

    const lightness = settingsWidget?.querySelector<HTMLInputElement>(
      '.settingsPaletteSlider[data-channel="lightness"]'
    );
    expect(lightness).not.toBeNull();
    if (lightness === undefined || lightness === null) return;
    lightness.value = "70";
    lightness.dispatchEvent(new Event("input", { bubbles: true }));
    const paletteRequest = latestUpdateExtensionSettingRequest();
    expect(paletteRequest.key).toBe("git-graph-libre.graphColors");
    expect(paletteRequest.value).toEqual(["oklch(70% 0.2 245)", "oklch(70% 0.2 350)"]);

    const revealColor = settingsWidget?.querySelector<HTMLInputElement>(
      'input[data-setting-key="git-graph-libre.revealHighlightColor"]'
    );
    expect(revealColor?.value).toBe("oklch(90% 0.25 150 / 0.42)");

    receive({
      command: "updateExtensionSetting",
      key: "git-graph-libre.dateType",
      status: null,
      settings: [
        {
          key: "git-graph-libre.autoCenterCommitDetailsView",
          configKey: "autoCenterCommitDetailsView",
          title: "autoCenterCommitDetailsView",
          description: "",
          type: "boolean",
          value: false,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.commitDetails.compactFolders",
          configKey: "commitDetails.compactFolders",
          title: "commitDetails.compactFolders",
          description: "",
          type: "boolean",
          value: true,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.commitDetails.fileViewMode",
          configKey: "commitDetails.fileViewMode",
          title: "commitDetails.fileViewMode",
          description: "",
          type: "string",
          value: "list",
          defaultValue: "tree",
          scope: "global"
        },
        {
          key: "git-graph-libre.contextMenuActionsVisibility",
          configKey: "contextMenuActionsVisibility",
          title: "contextMenuActionsVisibility",
          description: "",
          type: "object",
          value: { branch: { checkout: false } },
          defaultValue: {},
          scope: "global"
        },
        {
          key: "git-graph-libre.customBranchGlobPatterns",
          configKey: "customBranchGlobPatterns",
          title: "customBranchGlobPatterns",
          description: "",
          type: "array",
          value: [{ name: "Releases", glob: "heads/release/*" }],
          defaultValue: [],
          scope: "global"
        },
        {
          key: "git-graph-libre.dateFormat",
          configKey: "dateFormat",
          title: "dateFormat",
          description: "",
          type: "string",
          value: "Relative",
          defaultValue: "Date & Time",
          scope: "global"
        },
        {
          key: "git-graph-libre.dateType",
          configKey: "dateType",
          title: "dateType",
          description: "Date type",
          type: "string",
          value: "Commit Date",
          defaultValue: "Author Date",
          scope: "global"
        },
        {
          key: "git-graph-libre.fetchAvatars",
          configKey: "fetchAvatars",
          title: "fetchAvatars",
          description: "",
          type: "boolean",
          value: true,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.graph.fontSize",
          configKey: "graph.fontSize",
          title: "graph.fontSize",
          description: "",
          type: "number",
          value: 15,
          defaultValue: 13,
          scope: "global"
        },
        {
          key: "git-graph-libre.graph.rowHeight",
          configKey: "graph.rowHeight",
          title: "graph.rowHeight",
          description: "",
          type: "number",
          value: 30,
          defaultValue: 24,
          scope: "global"
        },
        {
          key: "git-graph-libre.graphColors",
          configKey: "graphColors",
          title: "graphColors",
          description: "",
          type: "array",
          value: ["oklch(70% 0.2 245)", "ignored"],
          defaultValue: [],
          scope: "global"
        },
        {
          key: "git-graph-libre.graphStyle",
          configKey: "graphStyle",
          title: "graphStyle",
          description: "",
          type: "string",
          value: "angular",
          defaultValue: "rounded",
          scope: "global"
        },
        {
          key: "git-graph-libre.revealHighlightColor",
          configKey: "revealHighlightColor",
          title: "revealHighlightColor",
          description: "",
          type: "string",
          value: "#0085d9",
          defaultValue: "oklch(90% 0.25 150 / 0.42)",
          scope: "global"
        },
        {
          key: "git-graph-libre.initialLoadCommits",
          configKey: "initialLoadCommits",
          title: "initialLoadCommits",
          description: "",
          type: "number",
          value: 250,
          defaultValue: 300,
          scope: "global"
        },
        {
          key: "git-graph-libre.loadMoreCommits",
          configKey: "loadMoreCommits",
          title: "loadMoreCommits",
          description: "",
          type: "number",
          value: 50,
          defaultValue: 75,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.includeReflog",
          configKey: "repository.includeReflog",
          title: "repository.includeReflog",
          description: "",
          type: "boolean",
          value: true,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.muteCommitsNotAncestorsOfHead",
          configKey: "repository.muteCommitsNotAncestorsOfHead",
          title: "repository.muteCommitsNotAncestorsOfHead",
          description: "",
          type: "boolean",
          value: false,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.onlyFollowFirstParent",
          configKey: "repository.onlyFollowFirstParent",
          title: "repository.onlyFollowFirstParent",
          description: "",
          type: "boolean",
          value: true,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.showRemoteBranches",
          configKey: "repository.showRemoteBranches",
          title: "repository.showRemoteBranches",
          description: "",
          type: "boolean",
          value: false,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.showStashes",
          configKey: "repository.showStashes",
          title: "repository.showStashes",
          description: "",
          type: "boolean",
          value: false,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.showTags",
          configKey: "repository.showTags",
          title: "repository.showTags",
          description: "",
          type: "boolean",
          value: false,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.shortHashLength",
          configKey: "shortHashLength",
          title: "shortHashLength",
          description: "",
          type: "number",
          value: 10,
          defaultValue: 8,
          scope: "global"
        },
        {
          key: "git-graph-libre.showCurrentBranchByDefault",
          configKey: "showCurrentBranchByDefault",
          title: "showCurrentBranchByDefault",
          description: "",
          type: "boolean",
          value: true,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.showUncommittedChanges",
          configKey: "showUncommittedChanges",
          title: "showUncommittedChanges",
          description: "",
          type: "boolean",
          value: true,
          defaultValue: true,
          scope: "global"
        }
      ]
    });
    expect(latestLoadBranchesRequest().hard).toBe(true);
    expect(document.body.style.getPropertyValue("--git-graph-font-size")).toBe("15px");
    expect(document.body.style.getPropertyValue("--git-graph-row-height")).toBe("30px");
    expect(document.body.style.getPropertyValue("--ngg-reveal-highlight")).toBe("#0085d9");

    receive({
      command: "updateExtensionSetting",
      key: "git-graph-libre.graph.fontSize",
      status: null,
      settings: [
        {
          key: "git-graph-libre.autoCenterCommitDetailsView",
          configKey: "autoCenterCommitDetailsView",
          title: "autoCenterCommitDetailsView",
          description: "",
          type: "boolean",
          value: true,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.commitDetails.compactFolders",
          configKey: "commitDetails.compactFolders",
          title: "commitDetails.compactFolders",
          description: "",
          type: "boolean",
          value: false,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.commitDetails.fileViewMode",
          configKey: "commitDetails.fileViewMode",
          title: "commitDetails.fileViewMode",
          description: "",
          type: "string",
          value: "tree",
          defaultValue: "tree",
          scope: "global"
        },
        {
          key: "git-graph-libre.contextMenuActionsVisibility",
          configKey: "contextMenuActionsVisibility",
          title: "contextMenuActionsVisibility",
          description: "",
          type: "object",
          value: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
          defaultValue: {},
          scope: "global"
        },
        {
          key: "git-graph-libre.customBranchGlobPatterns",
          configKey: "customBranchGlobPatterns",
          title: "customBranchGlobPatterns",
          description: "",
          type: "array",
          value: defaultViewState.customBranchGlobPatterns,
          defaultValue: [],
          scope: "global"
        },
        {
          key: "git-graph-libre.dateFormat",
          configKey: "dateFormat",
          title: "dateFormat",
          description: "",
          type: "string",
          value: "Date & Time",
          defaultValue: "Date & Time",
          scope: "global"
        },
        {
          key: "git-graph-libre.fetchAvatars",
          configKey: "fetchAvatars",
          title: "fetchAvatars",
          description: "",
          type: "boolean",
          value: false,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.graph.fontSize",
          configKey: "graph.fontSize",
          title: "graph.fontSize",
          description: "",
          type: "number",
          value: defaultViewState.graphFontSize,
          defaultValue: 13,
          scope: "global"
        },
        {
          key: "git-graph-libre.graph.rowHeight",
          configKey: "graph.rowHeight",
          title: "graph.rowHeight",
          description: "",
          type: "number",
          value: defaultViewState.graphRowHeight,
          defaultValue: 24,
          scope: "global"
        },
        {
          key: "git-graph-libre.graphColors",
          configKey: "graphColors",
          title: "graphColors",
          description: "",
          type: "array",
          value: defaultViewState.graphColors,
          defaultValue: [],
          scope: "global"
        },
        {
          key: "git-graph-libre.graphStyle",
          configKey: "graphStyle",
          title: "graphStyle",
          description: "",
          type: "string",
          value: "rounded",
          defaultValue: "rounded",
          scope: "global"
        },
        {
          key: "git-graph-libre.revealHighlightColor",
          configKey: "revealHighlightColor",
          title: "revealHighlightColor",
          description: "",
          type: "string",
          value: "blue",
          defaultValue: "oklch(90% 0.25 150 / 0.42)",
          scope: "global"
        },
        {
          key: "git-graph-libre.initialLoadCommits",
          configKey: "initialLoadCommits",
          title: "initialLoadCommits",
          description: "",
          type: "number",
          value: defaultViewState.initialLoadCommits,
          defaultValue: 300,
          scope: "global"
        },
        {
          key: "git-graph-libre.loadMoreCommits",
          configKey: "loadMoreCommits",
          title: "loadMoreCommits",
          description: "",
          type: "number",
          value: defaultViewState.loadMoreCommits,
          defaultValue: 75,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.includeReflog",
          configKey: "repository.includeReflog",
          title: "repository.includeReflog",
          description: "",
          type: "boolean",
          value: defaultViewState.includeReflog,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.muteCommitsNotAncestorsOfHead",
          configKey: "repository.muteCommitsNotAncestorsOfHead",
          title: "repository.muteCommitsNotAncestorsOfHead",
          description: "",
          type: "boolean",
          value: defaultViewState.muteCommitsNotAncestorsOfHead,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.onlyFollowFirstParent",
          configKey: "repository.onlyFollowFirstParent",
          title: "repository.onlyFollowFirstParent",
          description: "",
          type: "boolean",
          value: defaultViewState.onlyFollowFirstParent,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.showRemoteBranches",
          configKey: "repository.showRemoteBranches",
          title: "repository.showRemoteBranches",
          description: "",
          type: "boolean",
          value: defaultViewState.showRemoteBranches,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.showStashes",
          configKey: "repository.showStashes",
          title: "repository.showStashes",
          description: "",
          type: "boolean",
          value: defaultViewState.showStashes,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.repository.showTags",
          configKey: "repository.showTags",
          title: "repository.showTags",
          description: "",
          type: "boolean",
          value: defaultViewState.showTags,
          defaultValue: true,
          scope: "global"
        },
        {
          key: "git-graph-libre.shortHashLength",
          configKey: "shortHashLength",
          title: "shortHashLength",
          description: "",
          type: "number",
          value: defaultViewState.shortHashLength,
          defaultValue: 8,
          scope: "global"
        },
        {
          key: "git-graph-libre.showCurrentBranchByDefault",
          configKey: "showCurrentBranchByDefault",
          title: "showCurrentBranchByDefault",
          description: "",
          type: "boolean",
          value: defaultViewState.showCurrentBranchByDefault,
          defaultValue: false,
          scope: "global"
        }
      ]
    });
    expect(document.body.style.getPropertyValue("--git-graph-font-size")).toBe("13px");
    expect(document.body.style.getPropertyValue("--git-graph-row-height")).toBe("24px");
    expect(document.body.style.getPropertyValue("--ngg-reveal-highlight")).toBe(
      "oklch(90% 0.25 150 / 0.42)"
    );

    receive({
      command: "updateExtensionSetting",
      key: "git-graph-libre.unknown",
      status: null,
      settings: [
        {
          key: "git-graph-libre.unknownBoolean",
          configKey: "unknownBoolean",
          title: "unknownBoolean",
          description: "",
          type: "boolean",
          value: true,
          defaultValue: false,
          scope: "global"
        },
        {
          key: "git-graph-libre.unknownNumber",
          configKey: "unknownNumber",
          title: "unknownNumber",
          description: "",
          type: "number",
          value: 1,
          defaultValue: 0,
          scope: "global"
        },
        {
          key: "git-graph-libre.unknownString",
          configKey: "unknownString",
          title: "unknownString",
          description: "",
          type: "string",
          value: "value",
          defaultValue: "",
          scope: "global"
        }
      ]
    });

    document
      .getElementById("settingsExtensionTab")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(document.getElementById("settingsRepositoryTab")?.getAttribute("aria-selected")).toBe(
      "true"
    );
    document
      .getElementById("settingsRepositoryTab")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(document.getElementById("settingsExtensionTab")?.getAttribute("aria-selected")).toBe(
      "true"
    );
    document
      .getElementById("settingsExtensionTab")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(document.getElementById("settingsRepositoryTab")?.getAttribute("aria-selected")).toBe(
      "true"
    );

    settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("settingsWidget")?.hidden).toBe(true);
  });

  it("persists repository settings overrides and reloads with resolved flags", () => {
    const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement | null;
    expect(settingsBtn).not.toBeNull();
    settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const settingsWidget = document.getElementById("settingsWidget") as HTMLElement | null;
    expect(settingsWidget?.hidden).toBe(false);
    expect(settingsWidget?.textContent).toContain("Show remote branches");
    if (settingsWidget === null) return;

    const remoteSelect = settingsWidget.querySelector<HTMLSelectElement>(
      '[data-setting="showRemoteBranches"]'
    );
    expect(remoteSelect).not.toBeNull();
    if (remoteSelect === null) return;

    remoteSelect.value = "disabled";
    remoteSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(latestSaveRepoStateRequest()).toMatchObject({
      repo: REPO,
      state: { showRemoteBranches: "disabled" }
    });
    expect(latestLoadBranchesRequest().showRemoteBranches).toBe(false);
    expect(
      (document.getElementById("showRemoteBranchesCheckbox") as HTMLInputElement).checked
    ).toBe(false);

    const restoredSelect = document.querySelector<HTMLSelectElement>(
      '#settingsWidget [data-setting="showRemoteBranches"]'
    );
    expect(restoredSelect).not.toBeNull();
    if (restoredSelect === null) return;
    restoredSelect.value = "default";
    restoredSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(latestSaveRepoStateRequest().repo).toBe(REPO);
    expect(latestSaveRepoStateRequest().state.showRemoteBranches).toBeUndefined();
    expect(latestLoadBranchesRequest().showRemoteBranches).toBe(true);
    const restoredBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: restoredBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const restoredCommitsRequest = latestLoadCommitsRequest();
    receive({
      command: "loadCommits",
      requestId: restoredCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
    settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(settingsWidget?.hidden).toBe(true);
  });

  it("renders repository settings as a popup and wires hidden remote reloads", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: loadRepoInfoRequest.requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });

    const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement | null;
    settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const settingsWidget = document.getElementById("settingsWidget") as HTMLElement | null;
    const settingsBacking = document.getElementById("settingsWidgetBacking") as HTMLElement | null;
    expect(settingsWidget).not.toBeNull();
    expect(settingsBacking).not.toBeNull();
    if (settingsWidget === null) return;
    expect(settingsWidget.hidden).toBe(false);
    expect(settingsBacking?.hidden).toBe(false);
    expect(settingsWidget.getAttribute("role")).toBe("dialog");
    expect(settingsWidget.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(settingsWidget);
    expect(settingsWidget.textContent).toContain("Remote Configuration");
    expect(settingsWidget.textContent).toContain("origin");
    expect(settingsWidget.textContent).toContain("https://example.test/repo.git");

    const hideRemote = settingsWidget.querySelector<HTMLButtonElement>(
      ".settingsToggleRemoteVisibility"
    );
    expect(hideRemote).not.toBeNull();
    hideRemote?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(latestSaveRepoStateRequest()).toMatchObject({
      repo: REPO,
      state: { hiddenRemotes: ["origin"] }
    });
    const loadBranchesRequest = latestLoadBranchesRequest();
    expect(loadBranchesRequest.hiddenRemotes).toEqual(["origin"]);
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    expect(latestLoadCommitsRequest().hiddenRemotes).toEqual(["origin"]);
    receive({
      command: "loadCommits",
      requestId: latestLoadCommitsRequest().requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });

    const showRemote = settingsWidget.querySelector<HTMLButtonElement>(
      ".settingsToggleRemoteVisibility"
    );
    showRemote?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(latestSaveRepoStateRequest().state.hiddenRemotes).toBeUndefined();
    const restoreBranchesRequest = latestLoadBranchesRequest();
    expect(restoreBranchesRequest.hiddenRemotes).toEqual([]);
    receive({
      command: "loadBranches",
      requestId: restoreBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receive({
      command: "loadCommits",
      requestId: latestLoadCommitsRequest().requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });

    settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(settingsWidget.hidden).toBe(true);
    expect(settingsBacking?.hidden).toBe(true);
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const resetRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: resetRepoInfoRequest.requestId,
      repoInfo: repoInfoWithoutRemotes,
      error: null
    });
    const resetBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: resetBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receive({
      command: "loadCommits",
      requestId: latestLoadCommitsRequest().requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("closes the settings popup from its viewport backing", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: loadRepoInfoRequest.requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });

    document
      .getElementById("settingsBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const settingsWidget = document.getElementById("settingsWidget") as HTMLElement | null;
    const settingsBacking = document.getElementById("settingsWidgetBacking") as HTMLElement | null;
    expect(settingsWidget?.hidden).toBe(false);
    expect(settingsBacking?.hidden).toBe(false);

    settingsBacking?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(settingsWidget?.hidden).toBe(true);
    expect(settingsBacking?.hidden).toBe(true);
  });

  it("sends remote action messages from the settings popup", () => {
    function finishAction(command: GGL.ResponseMessage["command"], repoInfo = repoInfoWithRemote) {
      receive({ command, status: null } as unknown as GGL.ResponseMessage);
      const repoInfoRequest = latestLoadRepoInfoRequest();
      receive({
        command: "loadRepoInfo",
        requestId: repoInfoRequest.requestId,
        repoInfo,
        error: null
      });
      const branchesRequest = latestLoadBranchesRequest();
      receive({
        command: "loadBranches",
        requestId: branchesRequest.requestId,
        branches: ["main"],
        head: "main",
        hard: true,
        isRepo: true,
        error: null
      });
      receive({
        command: "loadCommits",
        requestId: latestLoadCommitsRequest().requestId,
        commits: twoCommits,
        head: "abc123",
        moreCommitsAvailable: true,
        hard: true,
        error: null
      });
    }

    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: loadRepoInfoRequest.requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });

    const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement | null;
    settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const settingsWidget = document.getElementById("settingsWidget") as HTMLElement | null;
    expect(settingsWidget).not.toBeNull();
    if (settingsWidget === null) return;

    document
      .getElementById("settingsAddRemote")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const remoteName = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const fetchUrl = document.getElementById("dialogInput1") as HTMLInputElement | null;
    const pushUrl = document.getElementById("dialogInput2") as HTMLInputElement | null;
    const fetchAfterAdd = document.getElementById("dialogInput3") as HTMLInputElement | null;
    expect(remoteName).not.toBeNull();
    expect(fetchUrl).not.toBeNull();
    expect(pushUrl).not.toBeNull();
    expect(fetchAfterAdd).not.toBeNull();
    if (remoteName === null || fetchUrl === null || pushUrl === null || fetchAfterAdd === null) {
      return;
    }
    remoteName.value = "upstream";
    remoteName.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    fetchUrl.value = "https://example.test/upstream.git";
    pushUrl.value = "ssh://example.test/upstream.git";
    fetchAfterAdd.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "addRemote",
      repo: REPO,
      name: "upstream",
      fetchUrl: "https://example.test/upstream.git",
      pushUrl: "ssh://example.test/upstream.git",
      fetch: true
    });
    finishAction("addRemote");

    settingsWidget
      .querySelector<HTMLButtonElement>(".settingsEditRemote")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const editName = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const editFetchUrl = document.getElementById("dialogInput1") as HTMLInputElement | null;
    const editPushUrl = document.getElementById("dialogInput2") as HTMLInputElement | null;
    expect(editName).not.toBeNull();
    expect(editFetchUrl).not.toBeNull();
    expect(editPushUrl).not.toBeNull();
    if (editName === null || editFetchUrl === null || editPushUrl === null) return;
    editName.value = "upstream";
    editName.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    editFetchUrl.value = "https://example.test/upstream.git";
    editPushUrl.value = "";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "editRemote",
      repo: REPO,
      oldName: "origin",
      name: "upstream",
      fetchUrl: "https://example.test/upstream.git",
      pushUrl: null
    });
    finishAction("editRemote");

    settingsWidget
      .querySelector<HTMLButtonElement>(".settingsFetchRemote")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const prune = document.getElementById("dialogInput0") as HTMLInputElement | null;
    expect(prune).not.toBeNull();
    if (prune !== null) prune.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "fetchRemotes",
      repo: REPO,
      remote: "origin",
      prune: true,
      pruneTags: false
    });
    finishAction("fetchRemotes");

    settingsWidget
      .querySelector<HTMLButtonElement>(".settingsPruneRemote")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pruneRemote",
      repo: REPO,
      name: "origin"
    });
    finishAction("pruneRemote");

    settingsWidget
      .querySelector<HTMLButtonElement>(".settingsDeleteRemote")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "deleteRemote",
      repo: REPO,
      name: "origin"
    });
    finishAction("deleteRemote", repoInfoWithoutRemotes);
    settingsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  it("shows fetch for repos with remotes and sends the selected prune options", () => {
    const fetchBtn = document.getElementById("fetchBtn") as HTMLButtonElement | null;
    expect(fetchBtn).not.toBeNull();
    expect(fetchBtn?.hidden).toBe(true);

    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: loadRepoInfoRequest.requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });

    expect(fetchBtn?.hidden).toBe(false);
    expect(fetchBtn?.disabled).toBe(false);

    const sentFetchesBefore = vscodeMock.sentMessages.filter(
      (msg) => msg.command === "fetchRemotes"
    ).length;
    fetchBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const pruneTagsOnly = document.getElementById("dialogInput1") as HTMLInputElement | null;
    expect(pruneTagsOnly).not.toBeNull();
    if (pruneTagsOnly !== null) pruneTagsOnly.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages.filter((msg) => msg.command === "fetchRemotes")).toHaveLength(
      sentFetchesBefore
    );
    expect(document.getElementById("dialog")?.textContent).toContain(
      "Enable prune before pruning tags."
    );

    fetchBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const prune = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const pruneTags = document.getElementById("dialogInput1") as HTMLInputElement | null;
    expect(prune).not.toBeNull();
    expect(pruneTags).not.toBeNull();
    if (prune !== null) prune.checked = true;
    if (pruneTags !== null) pruneTags.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "fetchRemotes",
      repo: REPO,
      prune: true,
      pruneTags: true
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Fetching Remotes...");

    receive({ command: "fetchRemotes", status: null });
    receive({
      command: "loadBranches",
      requestId: latestLoadBranchesRequest().requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receive({
      command: "loadCommits",
      requestId: latestLoadCommitsRequest().requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("renders the graph status strip as ready after loading commits", () => {
    const status = document.getElementById("statusStrip");

    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.dataset.state).toBe("ready");
    expect(status?.getAttribute("aria-busy")).toBe("false");
    expect(document.getElementById("statusText")?.textContent).toBe("Ready");
  });

  it("ignores response messages from untrusted origins", () => {
    const loadBranchesBefore = vscodeMock.sentMessages.filter(
      (msg) => msg.command === "loadBranches"
    ).length;

    window.dispatchEvent(
      new MessageEvent("message", { data: { command: "refresh" }, origin: "https://example.test" })
    );

    const loadBranchesAfter = vscodeMock.sentMessages.filter(
      (msg) => msg.command === "loadBranches"
    ).length;
    expect(loadBranchesAfter).toBe(loadBranchesBefore);
  });

  it("renders commit rows with keyboard focus and selection state", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    const olderRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="def456"]');

    expect(headRow?.getAttribute("tabindex")).toBe("0");
    expect(headRow?.getAttribute("aria-current")).toBe("true");
    expect(headRow?.getAttribute("aria-selected")).toBe("false");
    expect(olderRow?.getAttribute("tabindex")).toBe("0");
    expect(olderRow?.hasAttribute("aria-current")).toBe(false);
  });

  it("renders configured short hashes while retaining full hash attributes", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    const commitCell = headRow?.querySelectorAll("td")[4];

    expect(headRow?.dataset.hash).toBe("abc123");
    expect(commitCell?.textContent).toBe("abc1");
    expect(commitCell?.getAttribute("title")).toBe("abc123");
  });

  it("finds loaded commits by message, author, email, refs, and hashes without loading data", () => {
    const loadCommitRequestsBefore = sentLoadCommitsCount();

    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("findControl")?.hidden).toBe(false);

    setFindQuery("alice");
    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);
    expect(document.getElementById("findMatchCount")?.textContent).toBe("1 of 1");

    setFindQuery("v1.0.0");
    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);

    setFindQuery("def456");
    expect(findRow("def456")?.classList.contains("findMatchActive")).toBe(true);

    setFindQuery("def4");
    expect(findRow("def456")?.classList.contains("findMatchActive")).toBe(true);

    setFindQuery("example.com");
    expect(document.getElementById("findMatchCount")?.textContent).toBe("1 of 2");
    expect(findRow("abc123")?.classList.contains("findMatch")).toBe(true);
    expect(findRow("def456")?.classList.contains("findMatch")).toBe(true);
    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);

    setFindQuery("missing");
    expect(document.getElementById("findMatchCount")?.textContent).toBe("No matches");
    expect(document.querySelector("tr.commit.findMatch")).toBeNull();

    expect(sentLoadCommitsCount()).toBe(loadCommitRequestsBefore);
    expect(document.querySelectorAll("tr.commit")).toHaveLength(2);

    clearFind();
    expect(document.getElementById("findControl")?.hidden).toBe(true);
  });

  it("navigates find matches with buttons and input shortcuts", () => {
    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    setFindQuery("example.com");

    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);
    expect(document.getElementById("findMatchCount")?.textContent).toBe("1 of 2");

    document
      .getElementById("findNextBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(findRow("def456")?.classList.contains("findMatchActive")).toBe(true);
    expect(document.getElementById("findMatchCount")?.textContent).toBe("2 of 2");

    document
      .getElementById("findPreviousBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);

    getFindInput().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    );

    expect(findRow("def456")?.classList.contains("findMatchActive")).toBe(true);

    getFindInput().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
        cancelable: true
      })
    );

    expect(findRow("abc123")?.classList.contains("findMatchActive")).toBe(true);

    clearFind();
  });

  it("searches full history and loads enough commits to reveal a selected result", () => {
    const archivedSearchResult: GitCommitSearchResult = {
      hash: "ghi789",
      parentHashes: ["def456"],
      author: "Cara",
      email: "cara@example.com",
      date: 1698000000,
      message: "Deep archived fix",
      loadCount: 305
    };
    const archivedCommit: GitCommitNode = {
      ...archivedSearchResult,
      refs: []
    };

    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    setFindQuery("archived");

    document
      .getElementById("findSearchHistoryBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const searchRequest = latestSearchCommitsRequest();
    expect(searchRequest).toMatchObject({
      command: "searchCommits",
      repo: REPO,
      query: "archived",
      maxResults: 50,
      showRemoteBranches: true,
      showTags: true
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Searching history");

    receive({
      command: "searchCommits",
      requestId: searchRequest.requestId,
      results: [archivedSearchResult],
      error: null
    });

    expect(document.getElementById("dialog")?.textContent).toContain(
      "Search history results for archived"
    );
    expect(document.getElementById("dialog")?.textContent).toContain("ghi7 - Deep archived fix");

    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    const loadCommitsRequest = latestLoadCommitsRequest();
    expect(loadCommitsRequest).toMatchObject({
      command: "loadCommits",
      branchName: "",
      hard: true
    });
    expect(loadCommitsRequest.maxCommits).toBeGreaterThanOrEqual(305);

    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: [twoCommits[0], archivedCommit, twoCommits[1]],
      head: "abc123",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    expect(findRow("ghi789")).not.toBeNull();
    expect(findRow("ghi789")?.classList.contains("blinking")).toBe(true);
    findRow("ghi789")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(findRow("ghi789")?.classList.contains("blinking")).toBe(false);

    clearFind();
  });

  it("opens find from keyboard without stealing text input or dialog shortcuts", () => {
    clearFind();

    const documentFindEvent = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(documentFindEvent);

    expect(documentFindEvent.defaultPrevented).toBe(true);
    expect(document.getElementById("findControl")?.hidden).toBe(false);

    const inputFindEvent = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    getFindInput().dispatchEvent(inputFindEvent);

    expect(inputFindEvent.defaultPrevented).toBe(false);

    clearFind();
    document.getElementById("dialog")?.classList.add("active");

    const dialogFindEvent = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(dialogFindEvent);

    expect(dialogFindEvent.defaultPrevented).toBe(false);
    expect(document.getElementById("findControl")?.hidden).toBe(true);

    document.getElementById("dialog")?.classList.remove("active");
    document.getElementById("findBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true
    });
    getFindInput().dispatchEvent(escapeEvent);

    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(document.getElementById("findControl")?.hidden).toBe(true);
  });

  it("toggles column visibility from the header context menu", () => {
    function headerMenuItem(label: string) {
      document
        .querySelector(".tableColHeader")
        ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).find((item) =>
        item.textContent?.includes(label)
      );
    }

    const loadsBeforeDateToggle = sentLoadCommitsCount();
    const dateItem = headerMenuItem("Date");
    expect(dateItem?.textContent).toBe("✓ Date");
    dateItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitTable")?.classList.contains("hideDateCol")).toBe(true);
    expect(vscodeMock.getState()?.hiddenColumns).toEqual(["signature", "date"]);
    expect(sentLoadCommitsCount()).toBe(loadsBeforeDateToggle);

    const hiddenDateItem = headerMenuItem("Date");
    expect(hiddenDateItem?.textContent).toBe("Date");
    hiddenDateItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitTable")?.classList.contains("hideDateCol")).toBe(false);
    expect(vscodeMock.getState()?.hiddenColumns).toEqual(["signature"]);
    expect(vscodeMock.getState()?.columnVisibilityVersion).toBe(1);
    expect(sentLoadCommitsCount()).toBe(loadsBeforeDateToggle);

    for (const [label, column, className] of [
      ["Author", "author", "hideAuthorCol"],
      ["Commit", "commit", "hideCommitCol"]
    ] as const) {
      const visibleItem = headerMenuItem(label);
      expect(visibleItem?.textContent).toBe(`✓ ${label}`);
      visibleItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(document.getElementById("commitTable")?.classList.contains(className)).toBe(true);
      expect(vscodeMock.getState()?.hiddenColumns).toEqual(["signature", column]);

      const hiddenItem = headerMenuItem(label);
      expect(hiddenItem?.textContent).toBe(label);
      hiddenItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(document.getElementById("commitTable")?.classList.contains(className)).toBe(false);
      expect(vscodeMock.getState()?.hiddenColumns).toEqual(["signature"]);
    }
    expect(sentLoadCommitsCount()).toBe(loadsBeforeDateToggle);

    const signatureItem = headerMenuItem("Signature");
    expect(signatureItem?.textContent).toBe("Signature");
    signatureItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitTable")?.classList.contains("hideSignatureCol")).toBe(
      false
    );
    expect(vscodeMock.getState()?.hiddenColumns).toEqual([]);
    expect(sentLoadCommitsCount()).toBe(loadsBeforeDateToggle + 1);
    const signatureRequest = latestLoadCommitsRequest();
    expect(signatureRequest).toMatchObject({ showSignature: true, hard: true });
    expect(
      document.querySelector('tr.commit[data-hash="abc123"] .commitSignature-pending')?.textContent
    ).toBe("…");

    receive({
      command: "loadCommits",
      requestId: signatureRequest.requestId,
      commits: [
        {
          ...twoCommits[0],
          signature: { status: "valid", signer: "Alice", key: "ABC123" }
        },
        { ...twoCommits[1], signature: null }
      ],
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });

    const validSignature = document.querySelector(
      'tr.commit[data-hash="abc123"] .commitSignature-valid'
    );
    // The valid signature renders the verified symbol (a filled green circle
    // with the verified glyph), not a plain "✓" character.
    expect(validSignature?.querySelector("svg.signedTagIcon")).not.toBeNull();
    expect(validSignature?.getAttribute("title")).toContain("Valid signature");
    expect(validSignature?.getAttribute("title")).toContain("Signer: Alice");
    expect(validSignature?.getAttribute("aria-label")).toContain("Key: ABC123");
    const unsignedSignature = document.querySelector(
      'tr.commit[data-hash="def456"] .commitSignature-unsigned'
    );
    expect(unsignedSignature?.textContent).toBe("—");
    expect(unsignedSignature?.getAttribute("title")).toBe("Unsigned commit");

    const loadsBeforeHide = sentLoadCommitsCount();
    const shownSignatureItem = headerMenuItem("Signature");
    expect(shownSignatureItem?.textContent).toBe("✓ Signature");
    shownSignatureItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("commitTable")?.classList.contains("hideSignatureCol")).toBe(
      true
    );
    expect(vscodeMock.getState()?.hiddenColumns).toEqual(["signature"]);
    expect(sentLoadCommitsCount()).toBe(loadsBeforeHide);
  });

  it("toggles unreachable-commit discovery from a checked header menu item", () => {
    function openDiscoveryMenuItem() {
      document
        .querySelector(".tableColHeader")
        ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      return contextMenuItem("Include unreachable commits") as HTMLElement | undefined;
    }

    const disabledItem = openDiscoveryMenuItem();
    expect(disabledItem?.getAttribute("role")).toBe("menuitemcheckbox");
    expect(disabledItem?.getAttribute("aria-checked")).toBe("false");
    disabledItem
      ?.querySelector(".contextMenuCheck")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(latestSaveRepoStateRequest().state.includeUnreachableCommits).toBe("enabled");

    const enabledBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: enabledBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const enabledCommitsRequest = latestLoadCommitsRequest();
    expect(enabledCommitsRequest.includeUnreachableCommits).toBe(true);
    receive({
      command: "loadCommits",
      requestId: enabledCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });

    const enabledItem = openDiscoveryMenuItem();
    expect(enabledItem?.getAttribute("aria-checked")).toBe("true");
    enabledItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(latestSaveRepoStateRequest().state.includeUnreachableCommits).toBeUndefined();

    const defaultBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: defaultBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const defaultCommitsRequest = latestLoadCommitsRequest();
    expect(defaultCommitsRequest.includeUnreachableCommits).toBe(false);
    receive({
      command: "loadCommits",
      requestId: defaultCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("changes commit ordering from the header context menu", () => {
    function headerMenuItem(label: string) {
      document
        .querySelector(".tableColHeader")
        ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).find((item) =>
        item.textContent?.includes(label)
      );
    }

    const topoItem = headerMenuItem("Topological Order");
    expect(topoItem?.textContent).toBe("Topological Order");
    topoItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.getState()?.gitRepos[REPO].commitOrdering).toBe("topo");
    expect(vscodeMock.sentMessages).toContainEqual({
      command: "saveRepoState",
      repo: REPO,
      state: { columnWidths: null, commitOrdering: "topo" }
    });
    const topoRequest = latestLoadCommitsRequest();
    expect(topoRequest).toMatchObject({
      command: "loadCommits",
      commitOrdering: "topo",
      maxCommits: defaultViewState.initialLoadCommits,
      hard: true
    });

    receive({
      command: "loadCommits",
      requestId: topoRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });

    expect(headerMenuItem("Topological Order")?.textContent).toBe("✓ Topological Order");
    const dateItem = headerMenuItem("Commit Date Order");
    expect(dateItem?.textContent).toBe("Commit Date Order");
    dateItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.getState()?.gitRepos[REPO].commitOrdering).toBe("date");
    expect(vscodeMock.sentMessages).toContainEqual({
      command: "saveRepoState",
      repo: REPO,
      state: { columnWidths: null, commitOrdering: "date" }
    });
    const dateRequest = latestLoadCommitsRequest();
    expect(dateRequest).toMatchObject({
      command: "loadCommits",
      commitOrdering: "date",
      maxCommits: defaultViewState.initialLoadCommits,
      hard: true
    });

    receive({
      command: "loadCommits",
      requestId: dateRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("copies the full commit hash from the commit context menu", () => {
    openHeadCommitContextMenu();
    const copyHashItem = contextMenuItem("Copy Commit Hash");
    expect(copyHashItem).not.toBeUndefined();

    copyHashItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Commit Hash",
      data: "abc123"
    });
  });

  it("renders stashes from repo info and sends stash action messages", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: loadRepoInfoRequest.requestId,
      repoInfo: repoInfoWithStash,
      error: null
    });

    expect(document.getElementById("stashList")?.textContent).toContain("Stashes");
    expect(document.querySelector(".stashRow")?.textContent).toContain("stash@{0}");
    expect(document.querySelector(".stashRow")?.textContent).toContain("WIP on main");

    openStashContextMenu();
    clickContextMenuItem("Copy Stash Hash");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Stash Hash",
      data: "feed1234"
    });

    openStashContextMenu();
    clickContextMenuItem("Apply Stash");
    const applyIndex = document.getElementById("dialogInput0") as HTMLInputElement | null;
    expect(applyIndex).not.toBeNull();
    if (applyIndex !== null) applyIndex.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "applyStash",
      repo: REPO,
      selector: "stash@{0}",
      reinstateIndex: true
    });
    dismissDialog();

    openStashContextMenu();
    clickContextMenuItem("Create Branch from Stash");
    setDialogInput("recover/stash");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "branchFromStash",
      repo: REPO,
      selector: "stash@{0}",
      branchName: "recover/stash"
    });
    dismissDialog();

    openStashContextMenu();
    clickContextMenuItem("Pop Stash");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "popStash",
      repo: REPO,
      selector: "stash@{0}",
      reinstateIndex: false
    });
    dismissDialog();

    openStashContextMenu();
    clickContextMenuItem("Drop Stash");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "dropStash",
      repo: REPO,
      selector: "stash@{0}"
    });
    dismissDialog();

    receive({
      command: "loadBranches",
      requestId: latestLoadBranchesRequest().requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receive({
      command: "loadCommits",
      requestId: latestLoadCommitsRequest().requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("sends uncommitted changes action messages from the row context menu", () => {
    receiveLoadedCommits(
      [
        {
          hash: "*",
          parentHashes: [],
          author: "*",
          email: "",
          date: 1701000000,
          message: "Uncommitted changes (2)",
          refs: []
        },
        ...twoCommits
      ],
      "abc123"
    );

    openUncommittedChangesContextMenu();
    clickContextMenuItem("Stash Changes");
    const stashMessage = document.getElementById("dialogInput0") as HTMLInputElement | null;
    expect(stashMessage).not.toBeNull();
    if (stashMessage !== null) stashMessage.value = "checkpoint";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pushStash",
      repo: REPO,
      message: "checkpoint",
      includeUntracked: true
    });
    dismissDialog();

    openUncommittedChangesContextMenu();
    clickContextMenuItem("Reset Changes");
    const resetMode = document.getElementById("dialogInput0") as HTMLSelectElement | null;
    expect(resetMode).not.toBeNull();
    if (resetMode !== null) resetMode.value = "hard";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "resetUncommittedChanges",
      repo: REPO,
      resetMode: "hard"
    });
    dismissDialog();

    openUncommittedChangesContextMenu();
    clickContextMenuItem("Clean Untracked Files");
    const includeDirectories = document.getElementById("dialogInput0") as HTMLInputElement | null;
    expect(includeDirectories).not.toBeNull();
    if (includeDirectories !== null) includeDirectories.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "cleanUntrackedFiles",
      repo: REPO,
      includeDirectories: true
    });
    dismissDialog();

    openUncommittedChangesContextMenu();
    clickContextMenuItem("Open Source Control View");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "openSourceControl"
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("runs commit context menu actions through dialogs", () => {
    openHeadCommitContextMenu();
    clickContextMenuItem("Cherry Pick");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "cherrypickCommit",
      repo: REPO,
      commitHash: "abc123",
      parentIndex: 0
    });

    openHeadCommitContextMenu();
    clickContextMenuItem("Revert");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "revertCommit",
      repo: REPO,
      commitHash: "abc123",
      parentIndex: 0
    });

    openHeadCommitContextMenu();
    clickContextMenuItem("Merge");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "mergeCommit",
      repo: REPO,
      commitHash: "abc123",
      createNewCommit: true,
      squash: false,
      noCommit: false,
      noVerify: false
    });

    openHeadCommitContextMenu();
    clickContextMenuItem("Reset current branch");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "resetToCommit",
      repo: REPO,
      commitHash: "abc123",
      resetMode: "mixed"
    });
  });

  it("compares loaded commits with HEAD from the commit context menu", () => {
    const baseRow = findRow("def456");
    expect(baseRow).not.toBeNull();
    baseRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Compare with HEAD");

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "commitComparison",
      repo: REPO,
      commitHash: "def456",
      baseRef: "def456",
      compareRef: "HEAD"
    });

    const comparisonDetails: GitCommitDetails = {
      ...firstCommitDetails,
      hash: "def456",
      parents: [],
      fileChanges: [
        {
          oldFilePath: "src/example.ts",
          newFilePath: "src/example.ts",
          type: "M",
          additions: 4,
          deletions: 2
        }
      ]
    };
    receive({ command: "commitComparison", commitDetails: comparisonDetails, error: null });
    expect(baseRow?.classList.contains("commitDetailsOpen")).toBe(true);

    openFirstGitFileContextMenu();
    clickContextMenuItem("View File Diff");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "viewDiff",
      repo: REPO,
      commitHash: "def456",
      oldRef: "def456",
      newRef: "HEAD",
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M"
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("runs advanced commit context menu actions", () => {
    openHeadCommitContextMenu();
    clickContextMenuItem("Copy Commit Subject");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Commit Subject",
      data: "Add feature"
    });

    openHeadCommitContextMenu();
    clickContextMenuItem("Rebase current branch here");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "rebaseCurrentBranch",
      repo: REPO,
      target: "abc123",
      targetType: "commit",
      interactive: false,
      ignoreDate: true
    });

    openHeadCommitContextMenu();
    clickContextMenuItem("Reset Last Commit");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "undoLastCommit",
      repo: REPO
    });

    openHeadCommitContextMenu();
    clickContextMenuItem("Edit Message");
    const message = document.getElementById("dialogInput0") as HTMLTextAreaElement | null;
    if (message === null) throw new Error("Missing edit message textarea");
    message.value = "New subject\n\nBody";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "editHeadCommitMessage",
      repo: REPO,
      commitHash: "abc123",
      message: "New subject\n\nBody"
    });

    openHeadCommitContextMenu();
    clickContextMenuItem("Drop Commit");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "dropCommit",
      repo: REPO,
      commitHash: "abc123"
    });
  });

  it("mutes loaded commits outside the HEAD ancestry when enabled", () => {
    receiveLoadedCommits(
      [
        twoCommits[0],
        twoCommits[1],
        {
          hash: "side999",
          parentHashes: [],
          author: "Drew",
          email: "drew@example.com",
          date: 1_697_000_000,
          message: "Side branch",
          refs: []
        }
      ],
      "abc123"
    );

    expect(findRow("abc123")?.classList.contains("mutedCommit")).toBe(false);
    expect(findRow("def456")?.classList.contains("mutedCommit")).toBe(false);
    expect(findRow("side999")?.classList.contains("mutedCommit")).toBe(true);

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("sends selection commit actions from the selected-row context menu", () => {
    receiveLoadedCommits(threeCommitChain, "abc123");

    findRow("ghi789")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    findRow("abc123")?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    findRow("def456")?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    const secondRow = findRow("def456");
    expect(findRow("abc123")?.classList.contains("commitSelected")).toBe(true);
    expect(secondRow?.classList.contains("commitSelected")).toBe(true);

    secondRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Squash Selection");
    const message = document.getElementById("dialogInput0") as HTMLTextAreaElement | null;
    const bypassHooks = document.getElementById("dialogInput1") as HTMLInputElement | null;
    expect(message).not.toBeNull();
    expect(bypassHooks).not.toBeNull();
    if (message !== null) message.value = "Combined selection";
    if (bypassHooks !== null) bypassHooks.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "squashCommitSelection",
      repo: REPO,
      commitHashes: ["abc123", "def456"],
      message: "Combined selection",
      noVerify: true
    });

    findRow("abc123")?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    findRow("def456")?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    findRow("def456")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Drop Selection");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "dropCommitSelection",
      repo: REPO,
      commitHashes: ["abc123", "def456"]
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("adds tags and checks out commits from the commit context menu", () => {
    openHeadCommitContextMenu();
    clickContextMenuItem("Add Tag");
    setDialogInput("v2.0.0");
    const tagType = document.getElementById("dialogInput1") as HTMLSelectElement | null;
    if (tagType === null) throw new Error("Missing tag type input");
    tagType.value = "lightweight";
    tagType.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "addTag",
      repo: REPO,
      tagName: "v2.0.0",
      commitHash: "abc123",
      lightweight: true,
      message: ""
    });

    openHeadCommitContextMenu();
    clickContextMenuItem("Checkout");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "checkoutCommit",
      repo: REPO,
      commitHash: "abc123"
    });
  });

  it("hides the tag message row for lightweight tags and explains they are unsigned", () => {
    openHeadCommitContextMenu();
    clickContextMenuItem("Add Tag");

    // Annotated is the default: the message row shows, the note does not.
    const messageRow = document.getElementById("dialogInputRow2");
    const noteRow = document.getElementById("dialogInputRow3");
    expect(messageRow?.hidden).toBe(false);
    expect(noteRow?.hidden).toBe(true);
    expect(noteRow?.textContent).toContain("cannot be signed");

    const tagType = document.getElementById("dialogInput1") as HTMLSelectElement | null;
    if (tagType === null) throw new Error("Missing tag type input");
    tagType.value = "lightweight";
    tagType.dispatchEvent(new Event("change", { bubbles: true }));
    expect(messageRow?.hidden).toBe(true);
    expect(noteRow?.hidden).toBe(false);

    // Flipping the Type select back and forth keeps both rows in sync.
    tagType.value = "annotated";
    tagType.dispatchEvent(new Event("change", { bubbles: true }));
    expect(messageRow?.hidden).toBe(false);
    expect(noteRow?.hidden).toBe(true);

    dismissDialog();
  });

  it("rejects an empty annotated tag message instead of creating an empty tag object", () => {
    openHeadCommitContextMenu();
    clickContextMenuItem("Add Tag");
    setDialogInput("v3.0.0");

    const messagesBefore = vscodeMock.sentMessages.length;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    const messagesAfter = vscodeMock.sentMessages.slice(messagesBefore);
    expect(messagesAfter.filter((message) => message.command === "addTag")).toHaveLength(0);
    expect(messagesAfter).toHaveLength(0);
    expect(document.getElementById("dialog")?.className).toBe("active noInput");

    const tagMessage = document.getElementById("dialogInput2") as HTMLInputElement | null;
    if (tagMessage === null) throw new Error("Missing tag message input");
    tagMessage.value = "Release";
    tagMessage.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "addTag",
      repo: REPO,
      tagName: "v3.0.0",
      commitHash: "abc123",
      lightweight: false,
      message: "Release"
    });
  });

  it("passes the selected parent index for multi-parent commit actions", () => {
    const mergeCommits: GitCommitNode[] = [
      {
        hash: "merge123",
        parentHashes: ["left111", "right222"],
        author: "Mia",
        email: "mia@example.com",
        date: 1701000000,
        message: "Merge branches",
        refs: [{ hash: "merge123", name: "merge-branch", type: "head" }]
      },
      {
        hash: "left111",
        parentHashes: [],
        author: "Lee",
        email: "lee@example.com",
        date: 1700000000,
        message: "Left parent",
        refs: []
      },
      {
        hash: "right222",
        parentHashes: [],
        author: "Rae",
        email: "rae@example.com",
        date: 1700001000,
        message: "Right parent",
        refs: []
      }
    ];
    receiveLoadedCommits(mergeCommits, "merge123");

    const mergeRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="merge123"]');
    expect(mergeRow).not.toBeNull();
    mergeRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Cherry Pick");
    const parentSelect = document.getElementById("dialogInput0") as HTMLSelectElement | null;
    if (parentSelect === null) throw new Error("Missing parent select input");
    parentSelect.value = "2";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "cherrypickCommit",
      repo: REPO,
      commitHash: "merge123",
      parentIndex: 2
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("cherry-picks and reverts a root commit through the plain confirmation dialog", () => {
    const rootRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="def456"]');
    expect(rootRow).not.toBeNull();
    rootRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(contextMenuItem("Drop Commit")).toBeUndefined();
    clickContextMenuItem("Cherry Pick");
    expect(document.getElementById("dialogInput0")).toBeNull();
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "cherrypickCommit",
      repo: REPO,
      commitHash: "def456",
      parentIndex: 0
    });
    dismissDialog();

    rootRow?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Revert");
    expect(document.getElementById("dialogInput0")).toBeNull();
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "revertCommit",
      repo: REPO,
      commitHash: "def456",
      parentIndex: 0
    });
    dismissDialog();
  });

  it("keeps the single-parent cherry-pick on the plain confirmation path", () => {
    openHeadCommitContextMenu();
    clickContextMenuItem("Cherry Pick");
    expect(document.getElementById("dialogInput0")).toBeNull();
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "cherrypickCommit",
      repo: REPO,
      commitHash: "abc123",
      parentIndex: 0
    });
    dismissDialog();
  });

  it("handles tag and non-current branch ref menu actions", () => {
    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Copy Tag Name");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Tag Name",
      data: "v1.0.0"
    });

    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("View Tag Details");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "tagDetails",
      repo: REPO,
      tagName: "v1.0.0"
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Loading tag details...");
    receive({
      command: "tagDetails",
      tagName: "v1.0.0",
      tagDetails: {
        tagName: "v1.0.0",
        type: "annotated",
        objectHash: "tagobject123",
        targetHash: "abc123",
        targetType: "commit",
        taggerName: "Alice",
        taggerEmail: "alice@example.com",
        taggerDate: 1700000000,
        subject: "Release v1.0.0",
        body: "Stable release",
        signature: null
      },
      error: null
    });
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain("Tag v1.0.0");
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain("Annotated");
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain(
      "Release v1.0.0"
    );
    expect(document.querySelector("#dialog .tagSignature-unsigned")?.textContent).toBe("Unsigned");
    dismissDialog();

    receive({
      command: "tagDetails",
      tagName: "v-light",
      tagDetails: {
        tagName: "v-light",
        type: "lightweight",
        objectHash: "def456",
        targetHash: "def456",
        targetType: "commit",
        taggerName: null,
        taggerEmail: null,
        taggerDate: null,
        subject: "",
        body: "",
        signature: { status: "valid", key: "ABCDEF", signer: "Tag Signer" }
      },
      error: null
    });
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain("Lightweight");
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain(
      "Not available"
    );
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain("Tag Signer");
    expect(document.querySelector("#dialog .tagSignature-valid")?.textContent).toBe("Valid");
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain("ABCDEF");
    dismissDialog();

    receive({
      command: "tagDetails",
      tagName: "v-bad",
      tagDetails: {
        tagName: "v-bad",
        type: "annotated",
        objectHash: "bad123",
        targetHash: "abc123",
        targetType: "commit",
        taggerName: "Mallory",
        taggerEmail: "mallory@example.com",
        taggerDate: 1700000000,
        subject: "Tampered",
        // A signer name containing markup must not reach the DOM as HTML.
        body: "",
        signature: { status: "bad", key: null, signer: "<img src=x onerror=alert(1)>" }
      },
      error: null
    });
    expect(document.querySelector("#dialog .tagSignature-bad")?.textContent).toBe("Bad");
    expect(document.querySelector("#dialog .dialogContent img")).toBeNull();
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain(
      "<img src=x onerror=alert(1)>"
    );
    dismissDialog();

    receive({
      command: "tagDetails",
      tagName: "missing",
      tagDetails: null,
      error: {
        message: "missing tag",
        stderr: null,
        exitCode: 128,
        task: "for-each-ref"
      }
    });
    expect(document.querySelector("#dialog .dialogContent")?.textContent).toContain(
      "Unable to load tag details"
    );
    dismissDialog();

    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Delete Tag");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "deleteTag",
      repo: REPO,
      tagName: "v1.0.0"
    });

    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [
            { hash: "abc123", name: "main", type: "head" },
            { hash: "abc123", name: "feature/menu", type: "head" },
            { hash: "abc123", name: "v1.0.0", type: "tag" }
          ]
        },
        twoCommits[1]
      ],
      "abc123"
    );

    const branchRef = gitRef("feature/menu", ".gitRef.head");
    expect(branchRef).not.toBeUndefined();
    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Delete Branch");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "deleteBranch",
      repo: REPO,
      branchName: "feature/menu",
      forceDelete: false
    });

    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Merge");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "mergeBranch",
      repo: REPO,
      branchName: "feature/menu",
      createNewCommit: true,
      squash: false,
      noCommit: false,
      noVerify: false
    });

    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Rebase current branch here");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "rebaseCurrentBranch",
      repo: REPO,
      target: "feature/menu",
      targetType: "branch",
      interactive: false,
      ignoreDate: true
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("compares non-head ref labels with HEAD", () => {
    receiveLoadedCommits(
      [
        twoCommits[0],
        {
          ...twoCommits[1],
          refs: [{ hash: "def456", name: "feature/old", type: "head" }]
        }
      ],
      "abc123"
    );

    const branchRef = gitRef("feature/old", ".gitRef.head");
    expect(branchRef).not.toBeUndefined();
    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Compare with HEAD");

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "commitComparison",
      repo: REPO,
      commitHash: "def456",
      baseRef: "def456",
      compareRef: "HEAD"
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("renders the tag details popup with copy actions", () => {
    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("View Tag Details");
    receive({
      command: "tagDetails",
      tagName: "v1.0.0",
      tagDetails: {
        tagName: "v1.0.0",
        type: "annotated",
        objectHash: "tagobject123",
        targetHash: "abc123",
        targetType: "commit",
        taggerName: "Alice",
        taggerEmail: "alice@example.com",
        taggerDate: 1700000000,
        subject: "Release v1.0.0",
        body: "Stable release",
        signature: null
      },
      error: null
    });

    // Structured layout: a grid of label/value rows and the title use dedicated
    // classes instead of the old inline `<b>/<br>` flow.
    expect(document.getElementById("dialog")?.classList.contains("tagDetails")).toBe(true);
    expect(document.querySelector("#dialog dl.tagDetailsFields")).not.toBeNull();
    expect(document.querySelector("#dialog .tagDetailsTitle")?.textContent).toContain("Tag v1.0.0");

    // All three copy action buttons are present.
    const copyName = document.getElementById("tagDetailsCopyName");
    const copyHash = document.getElementById("tagDetailsCopyHash");
    const copyMessage = document.getElementById("tagDetailsCopyMessage");
    expect(copyName?.textContent).toContain("Copy Tag Name");
    expect(copyHash?.textContent).toContain("Copy Object Hash");
    expect(copyMessage?.textContent).toContain("Copy Tag Message");

    // Copy Tag Name → reuse the existing Tag Name clipboard path.
    copyName?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Tag Name",
      data: "v1.0.0"
    });

    // The popup is dismissed after a copy; reopen it for the next action.
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("View Tag Details");
    receive({
      command: "tagDetails",
      tagName: "v1.0.0",
      tagDetails: {
        tagName: "v1.0.0",
        type: "annotated",
        objectHash: "tagobject123",
        targetHash: "abc123",
        targetType: "commit",
        taggerName: "Alice",
        taggerEmail: "alice@example.com",
        taggerDate: 1700000000,
        subject: "Release v1.0.0",
        body: "Stable release",
        signature: null
      },
      error: null
    });
    document
      .getElementById("tagDetailsCopyHash")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Tag Hash",
      data: "tagobject123"
    });

    // Reopen and copy the message (subject + body joined).
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("View Tag Details");
    receive({
      command: "tagDetails",
      tagName: "v1.0.0",
      tagDetails: {
        tagName: "v1.0.0",
        type: "annotated",
        objectHash: "tagobject123",
        targetHash: "abc123",
        targetType: "commit",
        taggerName: "Alice",
        taggerEmail: "alice@example.com",
        taggerDate: 1700000000,
        subject: "Release v1.0.0",
        body: "Stable release",
        signature: null
      },
      error: null
    });
    document
      .getElementById("tagDetailsCopyMessage")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "Tag Message",
      data: "Release v1.0.0\n\nStable release"
    });

    dismissDialog();
    expect(document.getElementById("dialog")?.classList.contains("tagDetails")).toBe(false);
    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("sends archive requests from tag, local branch, and remote branch menus", () => {
    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Create Archive");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "createArchive",
      repo: REPO,
      ref: "v1.0.0"
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Creating Archive...");
    receive({ command: "createArchive", status: null });
    expect(document.getElementById("statusText")?.textContent).toBe("Ready");

    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [
            { hash: "abc123", name: "main", type: "head" },
            { hash: "abc123", name: "feature/menu", type: "head" }
          ]
        },
        twoCommits[1]
      ],
      "abc123"
    );
    const branchRef = gitRef("feature/menu", ".gitRef.head");
    expect(branchRef).not.toBeUndefined();
    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Create Archive");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "createArchive",
      repo: REPO,
      ref: "feature/menu"
    });
    receive({ command: "createArchive", status: null });

    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: loadRepoInfoRequest.requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });
    receive({
      command: "loadBranches",
      requestId: null,
      branches: ["main", "feature/menu", "remotes/origin/feature/menu"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    } as unknown as GGL.ResponseMessage);
    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [{ hash: "abc123", name: "origin/feature/menu", type: "remote" }]
        },
        twoCommits[1]
      ],
      "abc123"
    );
    const remoteRef = gitRef("origin/feature/menu", ".gitRef.remote");
    expect(remoteRef).not.toBeUndefined();
    remoteRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Create Archive");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "createArchive",
      repo: REPO,
      ref: "origin/feature/menu"
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("sends local branch remote action messages from context menus", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadRepoInfoRequest = latestLoadRepoInfoRequest();
    receive({
      command: "loadRepoInfo",
      requestId: loadRepoInfoRequest.requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });
    receive({
      command: "loadBranches",
      requestId: null,
      branches: ["main", "feature/menu", "remotes/origin/feature/menu"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    } as unknown as GGL.ResponseMessage);
    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [
            { hash: "abc123", name: "main", type: "head" },
            { hash: "abc123", name: "feature/menu", type: "head" }
          ]
        },
        twoCommits[1]
      ],
      "abc123"
    );

    const branchRef = gitRef("feature/menu", ".gitRef.head");
    expect(branchRef).not.toBeUndefined();

    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Push Branch");
    const bypassHooks = document.getElementById("dialogInput2") as HTMLInputElement | null;
    const pushMode = document.getElementById("dialogInput3") as HTMLSelectElement | null;
    expect(bypassHooks).not.toBeNull();
    expect(pushMode).not.toBeNull();
    if (bypassHooks !== null) bypassHooks.checked = true;
    if (pushMode !== null) pushMode.value = "force-with-lease";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pushBranch",
      repo: REPO,
      branchName: "feature/menu",
      remotes: ["origin"],
      setUpstream: true,
      noVerify: true,
      mode: "force-with-lease"
    });

    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Pull Branch");
    const forceUpdate = document.getElementById("dialogInput0") as HTMLInputElement | null;
    expect(forceUpdate).not.toBeNull();
    if (forceUpdate !== null) forceUpdate.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "updateBranchFromUpstream",
      repo: REPO,
      branchName: "feature/menu",
      force: true
    });

    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Delete Branch");
    const deleteOnRemote = document.getElementById("dialogInput1") as HTMLInputElement | null;
    expect(deleteOnRemote).not.toBeNull();
    if (deleteOnRemote !== null) deleteOnRemote.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "deleteBranch",
      repo: REPO,
      branchName: "feature/menu",
      forceDelete: false,
      deleteOnRemotes: ["origin"]
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("deletes a tag on the remotes selected in the delete dialog", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");

    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Delete Tag");

    const deleteOnOrigin = document.getElementById("dialogInput0") as HTMLInputElement | null;
    expect(deleteOnOrigin).not.toBeNull();
    // Deleting on a remote is destructive, so it must be opt-in.
    expect(deleteOnOrigin?.checked).toBe(false);
    if (deleteOnOrigin !== null) deleteOnOrigin.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "deleteTag",
      repo: REPO,
      tagName: "v1.0.0",
      deleteOnRemotes: ["origin"]
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Deleting Tag...");
  });

  it("omits deleteOnRemotes when no remote is selected", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");

    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Delete Tag");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "deleteTag",
      repo: REPO,
      tagName: "v1.0.0"
    });
  });

  it("falls back to a plain confirmation when the repository has no remotes", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithoutRemotes,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");

    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Delete Tag");

    expect(document.getElementById("dialogInput0")).toBeNull();
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "deleteTag",
      repo: REPO,
      tagName: "v1.0.0"
    });
  });

  it("sends remote branch action messages from context menus", () => {
    receive({
      command: "loadBranches",
      requestId: null,
      branches: ["main", "feature/menu", "remotes/origin/feature/menu"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    } as unknown as GGL.ResponseMessage);
    receiveLoadedCommits(
      [
        {
          ...twoCommits[0],
          refs: [{ hash: "abc123", name: "origin/feature/menu", type: "remote" }]
        },
        twoCommits[1]
      ],
      "abc123"
    );

    const remoteRef = gitRef("origin/feature/menu", ".gitRef.remote");
    expect(remoteRef).not.toBeUndefined();

    remoteRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Fetch into local branch");
    const forceFetch = document.getElementById("dialogInput0") as HTMLInputElement | null;
    expect(forceFetch).not.toBeNull();
    if (forceFetch !== null) forceFetch.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "fetchIntoLocalBranch",
      repo: REPO,
      remote: "origin",
      remoteBranch: "feature/menu",
      localBranch: "feature/menu",
      force: true
    });

    remoteRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Pull Branch");
    const noFastForward = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const squash = document.getElementById("dialogInput1") as HTMLInputElement | null;
    const bypassHooks = document.getElementById("dialogInput2") as HTMLInputElement | null;
    expect(noFastForward).not.toBeNull();
    expect(squash).not.toBeNull();
    expect(bypassHooks).not.toBeNull();
    if (noFastForward !== null) noFastForward.checked = true;
    if (squash !== null) squash.checked = true;
    if (bypassHooks !== null) bypassHooks.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pullBranch",
      repo: REPO,
      remote: "origin",
      branchName: "feature/menu",
      createNewCommit: true,
      squash: true,
      noVerify: true
    });

    remoteRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Delete Remote Branch");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "deleteRemoteBranch",
      repo: REPO,
      remote: "origin",
      branchName: "feature/menu"
    });

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("creates branches and renames local refs from context menus", () => {
    openHeadCommitContextMenu();
    clickContextMenuItem("Create Branch");
    setDialogInput("feature/sonar-cleanup");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "createBranch",
      repo: REPO,
      branchName: "feature/sonar-cleanup",
      commitHash: "abc123"
    });

    const headRef = document.querySelector<HTMLElement>(".gitRef.head");
    headRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Rename Branch");
    setDialogInput("main-renamed");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "renameBranch",
      repo: REPO,
      oldName: "main",
      newName: "main-renamed"
    });
  });

  it("toggles commit details from keyboard activation", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "commitDetails",
      repo: REPO,
      commitHash: "abc123"
    });

    receive({ command: "commitDetails", commitDetails: firstCommitDetails, error: null });

    expect(headRow?.classList.contains("commitDetailsOpen")).toBe(true);
    expect(headRow?.getAttribute("aria-selected")).toBe("true");

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

    expect(document.getElementById("commitDetails")).toBeNull();
    expect(headRow?.getAttribute("aria-selected")).toBe("false");
  });

  it("opens commit detail file context actions", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    receive({ command: "commitDetails", commitDetails: firstCommitDetails, error: null });

    openFirstGitFileContextMenu();
    expect(contextMenuItem("View File Diff")).not.toBeUndefined();
    expect(contextMenuItem("View File at Revision")).not.toBeUndefined();
    expect(contextMenuItem("Compare with Working Tree")).not.toBeUndefined();
    expect(contextMenuItem("Open File")).not.toBeUndefined();
    expect(contextMenuItem("Reset File to Revision")).not.toBeUndefined();
    expect(contextMenuItem("Copy Absolute File Path")).not.toBeUndefined();
    expect(contextMenuItem("Copy Relative File Path")).not.toBeUndefined();

    clickContextMenuItem("View File Diff");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "viewDiff",
      repo: REPO,
      commitHash: "abc123",
      oldFilePath: "src/example.ts",
      newFilePath: "src/example.ts",
      type: "M"
    });

    openFirstGitFileContextMenu();
    clickContextMenuItem("View File at Revision");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "viewFileAtRevision",
      repo: REPO,
      commitHash: "abc123",
      filePath: "src/example.ts"
    });

    openFirstGitFileContextMenu();
    clickContextMenuItem("Compare with Working Tree");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "compareFileWithWorkingTree",
      repo: REPO,
      commitHash: "abc123",
      filePath: "src/example.ts"
    });

    openFirstGitFileContextMenu();
    clickContextMenuItem("Open File");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "openFile",
      repo: REPO,
      filePath: "src/example.ts"
    });

    openFirstGitFileContextMenu();
    clickContextMenuItem("Copy Absolute File Path");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "File Path",
      data: "/workspace/my-repo/src/example.ts"
    });

    openFirstGitFileContextMenu();
    clickContextMenuItem("Copy Relative File Path");
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "copyToClipboard",
      type: "File Path",
      data: "src/example.ts"
    });

    openFirstGitFileContextMenu();
    clickContextMenuItem("Reset File to Revision");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "resetFileToRevision",
      repo: REPO,
      commitHash: "abc123",
      filePath: "src/example.ts"
    });
    dismissDialog();
    headRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  it("collapses and expands commit detail sections with persisted state", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    receive({ command: "commitDetails", commitDetails: firstCommitDetails, error: null });

    const summaryToggle = document.getElementById("commitDetailsSummaryToggle");
    const filesToggle = document.getElementById("commitDetailsFilesToggle");

    summaryToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    filesToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitDetails")?.classList.contains("summaryCollapsed")).toBe(
      true
    );
    expect(document.getElementById("commitDetails")?.classList.contains("filesCollapsed")).toBe(
      true
    );
    expect(summaryToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(filesToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("commitDetailsSummaryBody")?.classList.contains("hidden")).toBe(
      true
    );
    expect(document.getElementById("commitDetailsFilesBody")?.classList.contains("hidden")).toBe(
      true
    );
    expect(vscodeMock.getState()?.expandedCommit?.summaryOpen).toBe(false);
    expect(vscodeMock.getState()?.expandedCommit?.filesOpen).toBe(false);

    summaryToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("commitDetails")?.classList.contains("summaryCollapsed")).toBe(
      false
    );
    expect(document.getElementById("commitDetailsSummaryBody")?.classList.contains("hidden")).toBe(
      false
    );
    expect(vscodeMock.getState()?.expandedCommit?.summaryOpen).toBe(true);

    headRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("commitDetails")).toBeNull();
  });

  it("resizes commit details with pointer and keyboard input", () => {
    const headRow = document.querySelector<HTMLTableRowElement>('tr.commit[data-hash="abc123"]');
    expect(headRow).not.toBeNull();

    headRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    receive({ command: "commitDetails", commitDetails: firstCommitDetails, error: null });

    const details = document.getElementById("commitDetails");
    const handle = document.getElementById("commitDetailsResizeHandle");

    expect(details?.style.height).toBe(`${COMMIT_DETAILS_DEFAULT_HEIGHT}px`);
    expect(handle?.getAttribute("aria-valuenow")).toBe(COMMIT_DETAILS_DEFAULT_HEIGHT.toString());

    handle?.dispatchEvent(new MouseEvent("mousedown", { button: 0, clientY: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 320, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    const draggedHeight = COMMIT_DETAILS_DEFAULT_HEIGHT + 120;
    expect(details?.style.height).toBe(`${draggedHeight}px`);
    expect(handle?.getAttribute("aria-valuenow")).toBe(draggedHeight.toString());
    expect(vscodeMock.getState()?.expandedCommit?.detailsHeight).toBe(draggedHeight);
    expect(document.body.classList.contains("commitDetailsResizing")).toBe(false);

    handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

    const keyboardHeight = draggedHeight - COMMIT_DETAILS_KEYBOARD_RESIZE_STEP;
    expect(details?.style.height).toBe(`${keyboardHeight}px`);
    expect(vscodeMock.getState()?.expandedCommit?.detailsHeight).toBe(keyboardHeight);

    handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

    expect(details?.style.height).toBe(`${COMMIT_DETAILS_MIN_HEIGHT}px`);
    expect(handle?.getAttribute("aria-valuenow")).toBe(COMMIT_DETAILS_MIN_HEIGHT.toString());

    document
      .getElementById("commitDetailsSummaryToggle")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document
      .getElementById("commitDetailsFilesToggle")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(details?.style.height).toBe(`${COMMIT_DETAILS_COLLAPSED_HEIGHT}px`);

    document
      .getElementById("commitDetailsSummaryToggle")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(details?.style.height).toBe(`${COMMIT_DETAILS_MIN_HEIGHT}px`);

    headRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("commitDetails")).toBeNull();
  });

  it("shows refreshing status while a hard refresh is pending", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("statusStrip")?.dataset.state).toBe("loading");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("statusText")?.textContent).toBe("Refreshing graph");

    const loadBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const loadCommitsRequest = latestLoadCommitsRequest();
    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
  });

  it("ignores stale branch load responses", () => {
    const commitRequestsBefore = sentLoadCommitsCount();

    receive({
      command: "loadBranches",
      requestId: 999,
      branches: ["stale-branch"],
      head: "stale-branch",
      hard: true,
      isRepo: true,
      error: null
    });

    expect(document.getElementById("branchSelect")?.textContent).not.toContain("stale-branch");
    expect(sentLoadCommitsCount()).toBe(commitRequestsBefore);
  });

  it("ignores stale commit load responses", () => {
    const tableTextBefore = document.getElementById("commitTable")?.textContent;

    receive({
      command: "loadCommits",
      requestId: 999,
      commits: [
        {
          hash: "999999",
          parentHashes: [],
          author: "Old",
          email: "old@example.com",
          date: 1680000000,
          message: "Stale commit",
          refs: []
        }
      ],
      head: "999999",
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    expect(document.getElementById("commitTable")?.textContent).toBe(tableTextBefore);
    expect(document.getElementById("commitTable")?.textContent).not.toContain("Stale commit");
  });

  it("shows action status when a tag push starts", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");

    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));

    const pushTagItem = Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).find(
      (item) => item.textContent?.includes("Push Tag")
    );
    expect(pushTagItem).not.toBeUndefined();
    pushTagItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Even a single remote shows the push options form: the remote checkbox,
    // the bypass-hooks checkbox, and the mode select.
    expect(document.querySelector("#dialog .dialogContent")).not.toBeNull();
    expect(document.querySelector("#dialog .dialogActions")).not.toBeNull();
    const pushToOrigin = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const bypassHooks = document.getElementById("dialogInput1") as HTMLInputElement | null;
    const pushMode = document.getElementById("dialogInput2") as HTMLSelectElement | null;
    expect(pushToOrigin).not.toBeNull();
    expect(bypassHooks).not.toBeNull();
    expect(pushMode).not.toBeNull();
    expect(pushToOrigin?.checked).toBe(true);
    expect(bypassHooks?.checked).toBe(false);
    expect(pushMode?.value).toBe("normal");
    expect(document.getElementById("dialogAction")?.classList.contains("dialogBtnPrimary")).toBe(
      true
    );
    const dismissBtn = document.getElementById("dialogDismiss");
    expect(dismissBtn?.classList.contains("dialogBtn")).toBe(true);
    expect(dismissBtn?.classList.contains("dialogBtnPrimary")).toBe(false);

    if (bypassHooks !== null) bypassHooks.checked = true;
    if (pushMode !== null) pushMode.value = "force";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pushTag",
      repo: REPO,
      tagName: "v1.0.0",
      remotes: ["origin"],
      mode: "force",
      noVerify: true
    });
    expect(document.getElementById("statusStrip")?.dataset.state).toBe("action");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("statusText")?.textContent).toBe("Pushing Tag...");

    // The action-running dialog only offers dismiss, which becomes the primary button
    expect(document.getElementById("dialogAction")).toBeNull();
    expect(document.getElementById("dialogDismiss")?.classList.contains("dialogBtnPrimary")).toBe(
      true
    );
  });

  it("opens no push tag dialog when the repository has no remotes", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithoutRemotes,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");

    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    vscodeMock.clearMessages();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Push Tag");

    expect(document.querySelector("#dialog .dialogContent")).toBeNull();
    expect(vscodeMock.sentMessages.some((msg) => msg.command === "pushTag")).toBe(false);
  });

  it("sends the remotes checked in the push tag dialog", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithTwoRemotes,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");

    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Push Tag");

    const pushToOrigin = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const pushToUpstream = document.getElementById("dialogInput1") as HTMLInputElement | null;
    const bypassHooks = document.getElementById("dialogInput2") as HTMLInputElement | null;
    const pushMode = document.getElementById("dialogInput3") as HTMLSelectElement | null;
    expect(pushToOrigin).not.toBeNull();
    expect(pushToUpstream).not.toBeNull();
    expect(bypassHooks).not.toBeNull();
    expect(pushMode).not.toBeNull();
    // The default remote (origin) is preselected; others are opt-in.
    expect(pushToOrigin?.checked).toBe(true);
    expect(pushToUpstream?.checked).toBe(false);
    if (pushToUpstream !== null) pushToUpstream.checked = true;
    if (pushMode !== null) pushMode.value = "force-with-lease";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pushTag",
      repo: REPO,
      tagName: "v1.0.0",
      remotes: ["origin", "upstream"],
      mode: "force-with-lease",
      noVerify: false
    });

    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithoutRemotes,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("fetches tags from the remotes checked in the tag context menu dialog", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithTwoRemotes,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");

    const tagRef = gitRef("v1.0.0", ".gitRef.tag");
    expect(tagRef).not.toBeUndefined();
    tagRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Fetch Tags");

    // Fetching is read-only, so every remote is preselected; the prune-tags
    // option sits after the remote checkboxes.
    const fetchFromOrigin = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const fetchFromUpstream = document.getElementById("dialogInput1") as HTMLInputElement | null;
    const pruneTags = document.getElementById("dialogInput2") as HTMLInputElement | null;
    expect(fetchFromOrigin).not.toBeNull();
    expect(fetchFromUpstream).not.toBeNull();
    expect(pruneTags).not.toBeNull();
    expect(fetchFromOrigin?.checked).toBe(true);
    expect(fetchFromUpstream?.checked).toBe(true);
    expect(pruneTags?.checked).toBe(false);
    if (fetchFromUpstream !== null) fetchFromUpstream.checked = false;
    if (pruneTags !== null) pruneTags.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "fetchTags",
      repo: REPO,
      remotes: ["origin"],
      pruneTags: true
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Fetching Tags...");
    receive({ command: "fetchTags", status: null });

    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithoutRemotes,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("sends fetchTags only when the fetch dialog tags option is checked", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithTwoRemotes,
      error: null
    });

    vscodeMock.clearMessages();
    document.getElementById("fetchBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const fetchTagsCheckbox = document.getElementById("dialogInput2") as HTMLInputElement | null;
    expect(fetchTagsCheckbox).not.toBeNull();
    expect(document.getElementById("dialog")?.textContent).toContain("Fetch all tags");

    // Without the tags option the plain remotes fetch runs alone.
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
    expect(vscodeMock.sentMessages.filter((msg) => msg.command === "fetchTags")).toHaveLength(0);
    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "fetchRemotes",
      repo: REPO,
      prune: false,
      pruneTags: false
    });
    receive({ command: "fetchRemotes", status: null });

    // With the tags option both commands are sent in sequence.
    document.getElementById("fetchBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const tagsCheckbox = document.getElementById("dialogInput2") as HTMLInputElement | null;
    if (tagsCheckbox !== null) tagsCheckbox.checked = true;
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    const commands = vscodeMock.sentMessages.map((msg) => msg.command);
    expect(commands).toContain("fetchRemotes");
    expect(commands).toContain("fetchTags");
    const fetchTagsMessage = vscodeMock.sentMessages.find((msg) => msg.command === "fetchTags");
    expect(fetchTagsMessage).toEqual({
      command: "fetchTags",
      repo: REPO,
      remotes: ["origin", "upstream"],
      pruneTags: false
    });
    receive({ command: "fetchRemotes", status: null });
    receive({ command: "fetchTags", status: null });

    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithoutRemotes,
      error: null
    });
  });

  it("pushes all tags from the repository-level toolbar action", () => {
    const pushTagsBtn = document.getElementById("pushTagsBtn") as HTMLButtonElement | null;
    expect(pushTagsBtn).not.toBeNull();
    expect(pushTagsBtn?.hidden).toBe(true);

    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithTwoRemotes,
      error: null
    });

    expect(pushTagsBtn?.hidden).toBe(false);
    expect(pushTagsBtn?.disabled).toBe(false);
    pushTagsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const pushToOrigin = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const pushToUpstream = document.getElementById("dialogInput1") as HTMLInputElement | null;
    const bypassHooks = document.getElementById("dialogInput2") as HTMLInputElement | null;
    const pushMode = document.getElementById("dialogInput3") as HTMLSelectElement | null;
    expect(pushToOrigin).not.toBeNull();
    expect(pushToUpstream).not.toBeNull();
    expect(bypassHooks).not.toBeNull();
    expect(pushMode).not.toBeNull();
    expect(pushToOrigin?.checked).toBe(true);
    expect(pushToUpstream?.checked).toBe(false);
    if (pushToUpstream !== null) pushToUpstream.checked = true;
    if (bypassHooks !== null) bypassHooks.checked = true;
    if (pushMode !== null) pushMode.value = "force";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "pushAllTags",
      repo: REPO,
      remotes: ["origin", "upstream"],
      mode: "force",
      noVerify: true
    });
    expect(document.getElementById("statusText")?.textContent).toBe("Pushing All Tags...");
    receive({ command: "pushAllTags", status: null });

    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithoutRemotes,
      error: null
    });
    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("auto-loads more commits when scrolled to the bottom", () => {
    const loadCommitsBefore = sentLoadCommitsCount();
    expect(document.getElementById("loadMoreCommitsBtn")).not.toBeNull();

    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 10000, configurable: true });
    document.dispatchEvent(new Event("scroll"));

    expect(sentLoadCommitsCount()).toBe(loadCommitsBefore + 1);
    expect(document.getElementById("loadMoreCommitsBtn")).toBeNull();
    expect(document.getElementById("loadingHeader")).not.toBeNull();

    // Further scrolls while loading do not send duplicate requests
    document.dispatchEvent(new Event("scroll"));
    expect(sentLoadCommitsCount()).toBe(loadCommitsBefore + 1);

    const loadCommitsRequest = latestLoadCommitsRequest();
    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: twoCommits,
      head: "abc123",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });
    expect(document.getElementById("loadMoreCommitsBtn")).not.toBeNull();

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("shows a localized empty state when a branch has no commits", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadBranches",
      requestId: latestLoadBranchesRequest().requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receive({
      command: "loadCommits",
      requestId: latestLoadCommitsRequest().requestId,
      commits: [],
      head: null,
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });

    expect(document.querySelector(".emptyGraphRow")?.textContent).toBe(
      "No commits to show for this branch"
    );
  });

  it("marks merge commits with a muted row class", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    receive({
      command: "loadCommits",
      requestId: latestLoadCommitsRequest().requestId,
      commits: [
        {
          hash: "merge99",
          parentHashes: ["abc123", "def456"],
          author: "Alice",
          email: "alice@example.com",
          date: 1700000100,
          message: "Merge branch",
          refs: []
        },
        ...twoCommits
      ],
      head: "merge99",
      moreCommitsAvailable: true,
      hard: true,
      error: null
    });

    expect(findRow("merge99")?.classList.contains("mergeCommit")).toBe(true);
    expect(findRow("merge99")?.classList.contains("mutedCommit")).toBe(false);
    expect(findRow("abc123")?.classList.contains("mergeCommit")).toBe(false);
    expect(findRow("abc123")?.classList.contains("mutedCommit")).toBe(false);
  });

  it("mutes merge commit messages only while the setting is enabled", () => {
    receiveLoadedCommits(
      [
        {
          hash: "merge99",
          parentHashes: ["abc123", "def456"],
          author: "Alice",
          email: "alice@example.com",
          date: 1700000100,
          message: "Merge branch",
          refs: [{ hash: "merge99", name: "release", type: "head" }]
        },
        ...twoCommits
      ],
      "merge99"
    );

    expect(findRow("merge99")?.classList.contains("mutedCommit")).toBe(false);

    receiveExtensionSetting("repository.muteMergeCommits", true);
    expect(findRow("merge99")?.classList.contains("mergeCommit")).toBe(true);
    expect(findRow("merge99")?.classList.contains("mutedCommit")).toBe(true);
    expect(findRow("abc123")?.classList.contains("mutedCommit")).toBe(false);
    expect(findRow("def456")?.classList.contains("mutedCommit")).toBe(false);

    receiveExtensionSetting("repository.muteMergeCommits", false);
    expect(findRow("merge99")?.classList.contains("mergeCommit")).toBe(true);
    expect(findRow("merge99")?.classList.contains("mutedCommit")).toBe(false);

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("bolds the checked-out commit message only while its setting is enabled", () => {
    receiveLoadedCommits(twoCommits, "abc123");

    const headMessage = () => findRow("abc123")?.querySelector<HTMLElement>(".commitMessage");
    const olderMessage = () => findRow("def456")?.querySelector<HTMLElement>(".commitMessage");
    // Bolding is scoped to the commit description. No ref label may pick up a
    // weight from the renderer, in either setting state — the checked-out
    // branch is distinguished by its colored border alone.
    const boldRefs = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".gitRef")).filter(
        (ref) => ref.querySelector("b") !== null || ref.style.fontWeight !== ""
      );

    // Off by default: the wrapper span still renders (the mute styling keys off
    // it), it just carries no <b>.
    expect(headMessage()).not.toBeNull();
    expect(headMessage()?.textContent).toBe("Add feature");
    expect(headMessage()?.querySelector("b")).toBeNull();
    expect(boldRefs()).toHaveLength(0);

    receiveExtensionSetting("repository.boldCheckedOutCommit", true);
    expect(headMessage()?.querySelector("b")?.textContent).toBe("Add feature");
    expect(olderMessage()).not.toBeNull();
    expect(olderMessage()?.querySelector("b")).toBeNull();
    expect(boldRefs()).toHaveLength(0);

    receiveExtensionSetting("repository.boldCheckedOutCommit", false);
    expect(headMessage()?.querySelector("b")).toBeNull();
    expect(headMessage()?.textContent).toBe("Add feature");
    expect(boldRefs()).toHaveLength(0);

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("keeps ancestry muting gated by its own setting", () => {
    receiveLoadedCommits(
      [
        twoCommits[0],
        twoCommits[1],
        {
          hash: "side999",
          parentHashes: [],
          author: "Drew",
          email: "drew@example.com",
          date: 1_697_000_000,
          message: "Side branch",
          refs: []
        }
      ],
      "abc123"
    );

    expect(findRow("side999")?.classList.contains("mutedCommit")).toBe(true);

    receiveExtensionSetting("repository.muteCommitsNotAncestorsOfHead", false);
    expect(findRow("side999")?.classList.contains("mutedCommit")).toBe(false);

    receiveExtensionSetting("repository.muteCommitsNotAncestorsOfHead", true);
    expect(findRow("side999")?.classList.contains("mutedCommit")).toBe(true);

    receiveLoadedCommits(twoCommits, "abc123");
  });

  it("wraps the commit message in its own span, outside the ref labels", () => {
    receiveLoadedCommits(twoCommits, "abc123");

    const row = findRow("abc123");
    const message = row?.querySelector(".commitMessage");
    expect(message?.textContent).toBe("Add feature");
    // Ref labels are identity: they share the Description cell but never the
    // message span, so a muted row cannot gray their text.
    expect(message?.querySelector(".gitRef")).toBeNull();
    expect(row?.querySelectorAll("td:nth-child(2) > .gitRef")).toHaveLength(2);
  });

  it("configures issue linking and pull request creation from settings", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    receive({
      command: "loadRepoInfo",
      requestId: latestLoadRepoInfoRequest().requestId,
      repoInfo: repoInfoWithRemote,
      error: null
    });

    document
      .getElementById("settingsBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const settingsWidget = document.getElementById("settingsWidget") as HTMLElement | null;
    expect(settingsWidget?.textContent).toContain("Issue Linking");

    document
      .getElementById("settingsEditIssueLinking")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const issuePattern = document.getElementById("dialogInput0") as HTMLInputElement | null;
    const issueUrl = document.getElementById("dialogInput1") as HTMLInputElement | null;
    expect(issuePattern).not.toBeNull();
    expect(issueUrl).not.toBeNull();
    if (issuePattern === null || issueUrl === null) return;
    issuePattern.value = "#(\\d+)";
    issueUrl.value = "https://issues.example.test/$1";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(latestSaveRepoStateRequest().state.issueLinking).toEqual({
      pattern: "#(\\d+)",
      urlTemplate: "https://issues.example.test/$1"
    });

    document
      .getElementById("settingsEditPullRequest")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const baseBranch = document.getElementById("dialogInput1") as HTMLInputElement | null;
    const urlTemplate = document.getElementById("dialogInput2") as HTMLInputElement | null;
    expect(baseBranch).not.toBeNull();
    expect(urlTemplate).not.toBeNull();
    if (baseBranch === null || urlTemplate === null) return;
    baseBranch.value = "main";
    urlTemplate.value = "https://example.test/{sourceBranch}";
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(latestSaveRepoStateRequest().state.pullRequest).toMatchObject({
      remoteName: "origin",
      baseBranch: "main",
      urlTemplate: "https://example.test/{sourceBranch}",
      pushBeforeCreate: true
    });

    const issueBranchCommits: GitCommitNode[] = [
      {
        ...twoCommits[0],
        refs: [
          { hash: "abc123", name: "feature/#123", type: "head" },
          { hash: "abc123", name: "origin/feature/#123", type: "remote" }
        ]
      },
      twoCommits[1]
    ];
    receiveLoadedCommits(issueBranchCommits, "abc123");
    const branchRef = gitRef("feature/#123", ".gitRef.head");
    expect(branchRef).not.toBeUndefined();
    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("View Issue");

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "openExternalUrl",
      url: "https://issues.example.test/123"
    });

    branchRef?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Create Pull Request");
    document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));

    expect(vscodeMock.sentMessages[vscodeMock.sentMessages.length - 1]).toEqual({
      command: "createPullRequest",
      repo: REPO,
      branchName: "feature/#123",
      remoteName: "origin",
      remoteUrl: "https://example.test/repo.git",
      baseBranch: "main",
      urlTemplate: "https://example.test/{sourceBranch}",
      pushBeforeCreate: true
    });
  });

  it("shows a graph error state when commit loading fails", () => {
    document
      .getElementById("refreshBtn")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const loadBranchesRequest = latestLoadBranchesRequest();
    receive({
      command: "loadBranches",
      requestId: loadBranchesRequest.requestId,
      branches: ["main"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null
    });
    const loadCommitsRequest = latestLoadCommitsRequest();

    receive({
      command: "loadCommits",
      requestId: loadCommitsRequest.requestId,
      commits: [],
      head: null,
      moreCommitsAvailable: false,
      hard: true,
      error: {
        message: "fatal: bad revision",
        stderr: "fatal: bad revision",
        exitCode: 128,
        task: null
      }
    });

    expect(document.body.classList.contains("unableToLoad")).toBe(true);
    expect(document.getElementById("statusStrip")?.dataset.state).toBe("error");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("false");
    expect(document.getElementById("statusText")?.textContent).toBe("Error");
    expect(document.getElementById("commitTable")?.textContent).toContain(
      "Unable to load Git Graph"
    );
    expect(document.getElementById("commitTable")?.textContent).toContain("fatal: bad revision");
  });

  it("shows commit details error reasons in the dialog", () => {
    receive({
      command: "commitDetails",
      commitDetails: null,
      error: {
        message: "fatal: could not show commit",
        stderr: null,
        exitCode: 128,
        task: null
      }
    });

    expect(document.getElementById("dialog")?.textContent).toContain(
      "Unable to load commit details"
    );
    expect(document.getElementById("dialog")?.textContent).toContain(
      "fatal: could not show commit"
    );
  });

  it("switches repos when loadRepos carries an explicit lastActiveRepo", () => {
    const otherRepo = "/workspace/other-repo";

    receive({
      command: "loadRepos",
      repos: {
        [REPO]: { columnWidths: null },
        [otherRepo]: { columnWidths: null }
      },
      lastActiveRepo: otherRepo
    });

    const selectRepoMessages = vscodeMock.sentMessages.filter(
      (msg) => msg.command === "selectRepo"
    );
    expect(selectRepoMessages[selectRepoMessages.length - 1]).toEqual({
      command: "selectRepo",
      repo: otherRepo
    });
  });
});
