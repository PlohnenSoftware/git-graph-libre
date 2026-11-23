import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GitCommitNode,
  GitRebaseRangeCommit,
  GitRebaseRangeResult,
  GitRepoInfo
} from "@/backend/types";
import {
  DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
  normalizeContextMenuActionsVisibility
} from "@/contextMenuVisibility";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import type * as GGL from "@/types";
import {
  combinedGroupMessage,
  createRebaseEditorState,
  type InteractiveRebaseStartPayload,
  isRebaseStateModified,
  openRebaseEditorDialog,
  resetRebaseEditorState,
  setAutosquashEnabled,
  toInteractiveRebasePayload
} from "@/webview/rebaseEditor";

import { createVscodeMock, receive, setupHtml } from "../setup";

const strings = getWebviewLocalizedStrings();
const REPO = "/workspace/autosquash";

const ROOT_HASH = "0000000000000000000000000000000000000000";
const HASH_A = "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
const HASH_B = "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";
const HASH_FIX = "cccc3333cccc3333cccc3333cccc3333cccc3333";
const HASH_AMEND = "dddd4444dddd4444dddd4444dddd4444dddd4444";
const HASH_SIDE = "eeee5555eeee5555eeee5555eeee5555eeee5555";

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
    makeCommit(HASH_A, "Alpha feature"),
    makeCommit(HASH_B, "Beta feature", { parents: [HASH_A] }),
    makeCommit(HASH_FIX, "fixup! Alpha feature", { parents: [HASH_B] }),
    makeCommit(HASH_AMEND, "amend! Beta feature", {
      parents: [HASH_FIX],
      body: "Beta feature (renamed)"
    })
  ];
  return {
    commits,
    mergeCount: 0,
    dirty: false,
    hasUntracked: false,
    inProgress: false,
    inProgressKind: null,
    detached: false,
    branch: "feature/autosquash",
    upstream: null,
    alreadyUsedElsewhere: false,
    tooLong: false,
    autoSquash: null,
    preflight: { canStart: true, reasons: [] },
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

describe("rebaseEditor autosquash model and view (F2-06)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("hides the autosquash switch when no markers exist in the range", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const state = createRebaseEditorState(
      makeRange({
        commits: [makeCommit(HASH_A, "Alpha"), makeCommit(HASH_B, "Beta", { parents: [HASH_A] })]
      }),
      { base: ROOT_HASH, baseLabel: "00000000" }
    );
    expect(state.hasAutosquashMarkers).toBe(false);
    expect(state.autosquashEnabled).toBe(false);

    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      state,
      { shortHashLength: 8 },
      { onStart: () => undefined, onCancel: () => undefined }
    );
    expect(dialog.querySelector("#rebaseEditorAutosquashBar")).toBeNull();
    controller.destroy();
  });

  it("defaults autosquash ON when markers exist and rebase.autoSquash is unset or true, and OFF when false", () => {
    const onDefault = createRebaseEditorState(makeRange({ autoSquash: null }), {
      base: ROOT_HASH,
      baseLabel: "00000000"
    });
    expect(onDefault.hasAutosquashMarkers).toBe(true);
    expect(onDefault.autosquashEnabled).toBe(true);
    expect(onDefault.rows.map((r) => [r.hash, r.action, r.fixupFlag])).toEqual([
      [HASH_A, "pick", undefined],
      [HASH_FIX, "fixup", undefined],
      [HASH_B, "pick", undefined],
      [HASH_AMEND, "fixup", "-C"]
    ]);
    expect(isRebaseStateModified(onDefault)).toBe(true);

    const onTrue = createRebaseEditorState(makeRange({ autoSquash: true }), {
      base: ROOT_HASH,
      baseLabel: "00000000"
    });
    expect(onTrue.autosquashEnabled).toBe(true);

    const offConfig = createRebaseEditorState(makeRange({ autoSquash: false }), {
      base: ROOT_HASH,
      baseLabel: "00000000"
    });
    expect(offConfig.hasAutosquashMarkers).toBe(true);
    expect(offConfig.autosquashEnabled).toBe(false);
    expect(offConfig.rows.map((r) => [r.hash, r.action])).toEqual([
      [HASH_A, "pick"],
      [HASH_B, "pick"],
      [HASH_FIX, "pick"],
      [HASH_AMEND, "pick"]
    ]);
    expect(isRebaseStateModified(offConfig)).toBe(false);
  });

  it("toggles autosquash off to restore source order and carries fixupFlag -C in the payload", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: ROOT_HASH,
      baseLabel: "00000000"
    });
    expect(combinedGroupMessage(initial.rows, 2, [3])).toBe("Beta feature (renamed)");

    const payload = toInteractiveRebasePayload(initial);
    expect(payload.entries).toEqual([
      { action: "pick", hash: HASH_A },
      { action: "fixup", hash: HASH_FIX },
      { action: "pick", hash: HASH_B },
      { action: "fixup", hash: HASH_AMEND, fixupFlag: "-C" }
    ]);
    expect(payload.rangeHashes).toEqual([HASH_A, HASH_B, HASH_FIX, HASH_AMEND]);

    const restored = setAutosquashEnabled(initial, false);
    expect(restored.autosquashEnabled).toBe(false);
    expect(restored.rows.map((r) => [r.hash, r.action])).toEqual([
      [HASH_A, "pick"],
      [HASH_B, "pick"],
      [HASH_FIX, "pick"],
      [HASH_AMEND, "pick"]
    ]);
    expect(isRebaseStateModified(restored)).toBe(false);

    const reset = resetRebaseEditorState(initial);
    expect(reset.autosquashEnabled).toBe(false);
    expect(isRebaseStateModified(reset)).toBe(false);
  });

  it("renders the autosquash switch, shows the fixup -C badge, toggles rows, and syncs on Reset", () => {
    const { dialog, dialogBacking } = mountDialogDom();
    const starts: InteractiveRebaseStartPayload[] = [];
    const controller = openRebaseEditorDialog(
      dialog,
      dialogBacking,
      createRebaseEditorState(makeRange(), { base: ROOT_HASH, baseLabel: "00000000" }),
      { shortHashLength: 8 },
      { onStart: (payload) => starts.push(payload), onCancel: () => undefined }
    );

    const toggle = dialog.querySelector<HTMLInputElement>("#rebaseEditorAutosquash");
    expect(toggle?.checked).toBe(true);
    expect(dialog.querySelector(".rebaseEditorBadge-amend")?.textContent).toBe(
      strings.rebaseBadgeAmend
    );
    expect(
      Array.from(dialog.querySelectorAll<HTMLElement>(".rebaseEditorRow")).map(
        (r) => r.dataset.hash
      )
    ).toEqual([HASH_A, HASH_FIX, HASH_B, HASH_AMEND]);

    // Turn autosquash off -> restores source order, hides fixup -C badge, disables Start.
    if (toggle === null) throw new Error("Missing autosquash toggle");
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      Array.from(dialog.querySelectorAll<HTMLElement>(".rebaseEditorRow")).map(
        (r) => r.dataset.hash
      )
    ).toEqual([HASH_A, HASH_B, HASH_FIX, HASH_AMEND]);
    expect(dialog.querySelector(".rebaseEditorBadge-amend")).toBeNull();
    expect(dialog.querySelector<HTMLButtonElement>("#dialogAction")?.disabled).toBe(true);

    // Turn autosquash back on and Start -> sends arranged todo with fixupFlag -C.
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    dialog.querySelector<HTMLButtonElement>("#dialogAction")?.click();
    expect(starts).toHaveLength(1);
    expect(starts[0].entries[3]).toEqual({
      action: "fixup",
      hash: HASH_AMEND,
      fixupFlag: "-C"
    });

    // Reset unchecks the toggle.
    dialog.querySelector<HTMLButtonElement>("#rebaseEditorReset")?.click();
    expect(dialog.querySelector<HTMLInputElement>("#rebaseEditorAutosquash")?.checked).toBe(false);
    controller.destroy();
  });
});

describe("fixup/squash/reword context menu visibility and dialogs (F2-06)", () => {
  const defaultViewState: GGL.GitGraphViewState = {
    autoCenterCommitDetailsView: true,
    commitDetailsCompactFolders: false,
    commitDetailsFileViewMode: "tree",
    uncommittedFileViewMode: "tree",
    contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
    dateFormat: "Date & Time",
    fetchAvatars: false,
    showSignatureColumn: false,
    graphColors: ["oklch(59% 0.21 255)"],
    graphFontSize: 13,
    graphRowHeight: 24,
    graphStyle: "rounded",
    revealHighlightColor: "oklch(68% 0.16 245)",
    customBranchGlobPatterns: [],
    includeReflog: false,
    includeUnreachableCommits: false,
    initialLoadCommits: 100,
    loadMoreCommits: 100,
    muteCommitsNotAncestorsOfHead: false,
    muteMergeCommits: false,
    boldCheckedOutCommit: false,
    fetchTagsByDefault: true,
    showTagRemotes: "origin",
    worktreePathTemplate: "",
    mergeNoFastForward: true,
    pullBranchNoFastForward: false,
    createBranchCheckout: true,
    lastActiveRepo: REPO,
    onlyFollowFirstParent: false,
    repos: { [REPO]: { columnWidths: null } },
    repoLayout: { worktrees: {}, outside: [] },
    showCurrentBranchByDefault: false,
    showRemoteBranches: true,
    showStashes: true,
    stashDisplay: "both",
    showTags: true,
    shortHashLength: 8,
    language: "en",
    languages: [{ id: "en", label: "English" }]
  };

  const repoInfo: GitRepoInfo = {
    isRepo: true,
    head: "main",
    headCommit: HASH_B,
    authors: ["Alice"],
    tags: [],
    remotes: [],
    stashes: [],
    stashCount: 0,
    config: {
      userName: { local: "Alice", global: null },
      userEmail: { local: "alice@example.test", global: null }
    }
  };

  const commits: GitCommitNode[] = [
    {
      hash: HASH_B,
      parentHashes: [HASH_A],
      author: "Alice",
      email: "alice@example.test",
      date: 200,
      message: "Beta feature",
      refs: [{ hash: HASH_B, name: "main", type: "head" }]
    },
    {
      hash: HASH_SIDE,
      parentHashes: [ROOT_HASH],
      author: "Alice",
      email: "alice@example.test",
      date: 150,
      message: "Side branch commit",
      refs: [{ hash: HASH_SIDE, name: "side", type: "head" }]
    },
    {
      hash: HASH_A,
      parentHashes: [ROOT_HASH],
      author: "Alice",
      email: "alice@example.test",
      date: 100,
      message: "Alpha feature",
      refs: []
    },
    {
      hash: ROOT_HASH,
      parentHashes: [],
      author: "Alice",
      email: "alice@example.test",
      date: 50,
      message: "Initial commit",
      refs: []
    }
  ];

  async function bootGraph(
    visibility: GGL.ContextMenuActionsVisibility = DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY
  ) {
    vi.resetModules();
    const viewState: GGL.GitGraphViewState = {
      ...defaultViewState,
      contextMenuActionsVisibility: visibility
    };
    setupHtml(viewState);
    const vscodeMock = createVscodeMock();
    (globalThis as unknown as { viewState: GGL.GitGraphViewState }).viewState = viewState;
    (globalThis as unknown as { l10n: typeof strings }).l10n = strings;
    await import("@/webview/main");

    const latest = <K extends GGL.RequestMessage["command"]>(command: K) => {
      const msg = [...vscodeMock.sentMessages].reverse().find((m) => m.command === command);
      if (msg === undefined) throw new Error(`Missing request ${command}`);
      return msg as Extract<GGL.RequestMessage, { command: K }>;
    };

    receive({
      command: "loadRepoInfo",
      requestId: latest("loadRepoInfo").requestId,
      repoInfo,
      error: null
    });
    receive({
      command: "loadBranches",
      requestId: latest("loadBranches").requestId,
      branches: ["main", "side"],
      head: "main",
      hard: true,
      isRepo: true,
      error: null,
      worktrees: [],
      upstreams: {}
    });
    receive({
      command: "loadCommits",
      requestId: latest("loadCommits").requestId,
      commits,
      head: HASH_B,
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });
    return { vscodeMock, latest };
  }

  function openMenuOn(hash: string): string[] {
    document
      .querySelector<HTMLElement>(`tr.commit[data-hash="${hash}"]`)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    return Array.from(document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")).map(
      (item) => item.textContent ?? ""
    );
  }

  it("defaults createFixup, createSquash, and createReword to visible and honors overrides", () => {
    const normalized = normalizeContextMenuActionsVisibility({
      commit: { createFixup: false, createSquash: true, createReword: false }
    });
    expect(normalized.commit.createFixup).toBe(false);
    expect(normalized.commit.createSquash).toBe(true);
    expect(normalized.commit.createReword).toBe(false);
    expect(normalizeContextMenuActionsVisibility({}).commit.createFixup).toBe(true);
    expect(normalizeContextMenuActionsVisibility({}).commit.createSquash).toBe(true);
    expect(normalizeContextMenuActionsVisibility({}).commit.createReword).toBe(true);
  });

  it("offers fixup/squash/reword only on HEAD and its ancestors, and respects visibility settings", async () => {
    await bootGraph();

    const onAncestor = openMenuOn(HASH_A);
    expect(onAncestor).toContain(`${strings.rebaseCreateFixup}…`);
    expect(onAncestor).toContain(`${strings.rebaseCreateSquash}…`);
    expect(onAncestor).toContain(`${strings.rebaseCreateReword}…`);

    const onHead = openMenuOn(HASH_B);
    expect(onHead).toContain(`${strings.rebaseCreateFixup}…`);

    const onSideBranch = openMenuOn(HASH_SIDE);
    expect(onSideBranch).not.toContain(`${strings.rebaseCreateFixup}…`);
    expect(onSideBranch).not.toContain(`${strings.rebaseCreateSquash}…`);
    expect(onSideBranch).not.toContain(`${strings.rebaseCreateReword}…`);

    await bootGraph({
      ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
      commit: {
        ...DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY.commit,
        createFixup: false,
        createReword: false
      }
    });
    const hidden = openMenuOn(HASH_A);
    expect(hidden).not.toContain(`${strings.rebaseCreateFixup}…`);
    expect(hidden).toContain(`${strings.rebaseCreateSquash}…`);
    expect(hidden).not.toContain(`${strings.rebaseCreateReword}…`);
  });

  it("blocks fixup submission when 0 files are staged, allows it with staged files, and allows reword with 0 staged files", async () => {
    const { vscodeMock, latest } = await bootGraph();

    // 1. Create Fixup Commit with 0 staged files -> submit disabled.
    openMenuOn(HASH_A);
    const fixupItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((item) => item.textContent === `${strings.rebaseCreateFixup}…`);
    fixupItem?.click();

    const infoReq1 = latest("fixupDialogInfo");
    expect(infoReq1.target).toBe(HASH_A);
    receive({
      command: "fixupDialogInfo",
      requestId: infoReq1.requestId,
      repo: REPO,
      stagedCount: 0,
      targetSubject: "Alpha feature",
      targetMessage: "Alpha feature",
      error: null
    });
    expect(document.getElementById("dialog")?.className).toBe("active noInput");
    expect(document.getElementById("dialog")?.textContent).toContain("fixup! Alpha feature");
    expect(document.getElementById("dialog")?.textContent).toContain(
      strings.rebaseFixupNoStagedChanges
    );
    document.getElementById("dialogAction")?.click();
    expect(vscodeMock.sentMessages.some((m) => m.command === "commitFixup")).toBe(false);
    document.getElementById("dialogDismiss")?.click();

    // 2. Create Squash Commit with 2 staged files -> submits commitFixup(squash) with extra message.
    openMenuOn(HASH_A);
    const squashItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((item) => item.textContent === `${strings.rebaseCreateSquash}…`);
    squashItem?.click();

    const infoReq2 = latest("fixupDialogInfo");
    receive({
      command: "fixupDialogInfo",
      requestId: infoReq2.requestId,
      repo: REPO,
      stagedCount: 2,
      targetSubject: "Alpha feature",
      targetMessage: "Alpha feature",
      error: null
    });
    expect(document.getElementById("dialog")?.textContent).toContain("2 files");
    expect(document.getElementById("dialog")?.textContent).toContain("squash! Alpha feature");
    const extraBox = document.querySelector<HTMLTextAreaElement>("#dialog textarea");
    if (extraBox === null) throw new Error("Missing squash message textarea");
    extraBox.value = "Extra squash note";
    document.getElementById("dialogAction")?.click();
    expect(latest("commitFixup")).toEqual({
      command: "commitFixup",
      repo: REPO,
      target: HASH_A,
      kind: "squash",
      message: "Extra squash note"
    });

    // 3. Create Reword Commit with 0 staged files -> pre-fills message and submits commitFixup(reword).
    openMenuOn(HASH_A);
    const rewordItem = Array.from(
      document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem")
    ).find((item) => item.textContent === `${strings.rebaseCreateReword}…`);
    rewordItem?.click();

    const infoReq3 = latest("fixupDialogInfo");
    receive({
      command: "fixupDialogInfo",
      requestId: infoReq3.requestId,
      repo: REPO,
      stagedCount: 0,
      targetSubject: "Alpha feature",
      targetMessage: "Alpha feature\n\nBody text",
      error: null
    });
    expect(document.getElementById("dialog")?.className).toBe("active");
    expect(document.getElementById("dialog")?.textContent).toContain("amend! Alpha feature");
    const rewordBox = document.querySelector<HTMLTextAreaElement>("#dialog textarea");
    expect(rewordBox?.value).toBe("Alpha feature\n\nBody text");
    if (rewordBox === null) throw new Error("Missing reword textarea");
    rewordBox.value = "Alpha feature (reworded)";
    rewordBox.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("dialogAction")?.click();
    expect(latest("commitFixup")).toEqual({
      command: "commitFixup",
      repo: REPO,
      target: HASH_A,
      kind: "reword",
      message: "Alpha feature (reworded)"
    });
  });
});
