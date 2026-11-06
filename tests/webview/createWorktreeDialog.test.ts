import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo, GitWorktree } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/createrepo";
const OTHER_WORKTREE = "/workspace/worktrees/feature menu é";
const REMOTE_REF = "origin/feature/menu";

/** A folder-template placeholder, built at run time so no string literal in this file spells one. */
function token(name: string): string {
  return `\${${name}}`;
}

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

const commits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: ["def456"],
    author: "Alice",
    email: "alice@example.com",
    date: 1_700_000_000,
    message: "Head commit",
    refs: [
      { hash: "abc123", name: "main", type: "head" },
      { hash: "abc123", name: "v1", type: "tag" }
    ]
  },
  {
    hash: "def456",
    parentHashes: ["fed789"],
    author: "Bob",
    email: "bob@example.com",
    date: 1_699_000_000,
    message: "Remote commit",
    refs: [{ hash: "def456", name: REMOTE_REF, type: "remote" }]
  },
  {
    hash: "fed789",
    parentHashes: [],
    author: "Bob",
    email: "bob@example.com",
    date: 1_698_000_000,
    message: "Local commit",
    refs: [{ hash: "fed789", name: "feature/menu", type: "head" }]
  }
];

function worktree(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: REPO,
    head: "abc123",
    branch: "main",
    detached: false,
    bare: false,
    isMain: true,
    isCurrent: true,
    locked: null,
    prunable: null,
    ...overrides
  };
}

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
  options: {
    branches?: string[];
    worktrees?: GitWorktree[];
    worktreePathTemplate?: string;
    savedState?: WebViewState | null;
  } = {}
) {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const vscodeMock = createVscodeMock(options.savedState ?? null);
  setupHtml({ ...defaultViewState, worktreePathTemplate: options.worktreePathTemplate ?? "" });
  const main = await import("@/webview/main");

  receive({
    command: "loadRepoInfo",
    requestId: latestRequest(vscodeMock.sentMessages, "loadRepoInfo").requestId,
    repoInfo,
    error: null
  });
  receive({
    command: "loadBranches",
    requestId: latestRequest(vscodeMock.sentMessages, "loadBranches").requestId,
    branches: options.branches ?? ["main", "feature/menu", `remotes/${REMOTE_REF}`],
    head: "main",
    hard: true,
    isRepo: true,
    error: null,
    worktrees: options.worktrees ?? [worktree({})],
    upstreams: { main: "origin/main", "feature/menu": REMOTE_REF }
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
  return { vscodeMock, main };
}

function openRefContextMenu(selector: string, namePart: string) {
  const ref = Array.from(document.querySelectorAll<HTMLElement>(selector)).find((elem) =>
    elem.dataset.name?.includes(namePart)
  );
  expect(ref).not.toBeUndefined();
  ref?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
}

function contextMenuItems() {
  return Array.from(document.querySelectorAll("#contextMenu .contextMenuItem")).map(
    (item) => item.textContent ?? ""
  );
}

function clickContextMenuItem(text: string) {
  const item = Array.from(document.querySelectorAll<HTMLElement>("#contextMenu .contextMenuItem"))
    .filter((elem) => elem.textContent === text)
    .at(0);
  expect(item).not.toBeUndefined();
  item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function dialogText() {
  return document.querySelector("#dialog")?.textContent ?? "";
}

function submitDialog() {
  document.getElementById("dialogAction")?.dispatchEvent(new MouseEvent("click"));
}

function dialogInput<T extends HTMLElement>(index: number): T {
  const elem = document.getElementById(`dialogInput${index}`) as T | null;
  expect(elem).not.toBeNull();
  return elem as T;
}

// The finish-step tests run first: they answer a second graph load, which
// a stale webview instance left by an earlier boot in this file would also
// try to render against a detached table.
describe("the finish step (decision Y8)", () => {
  async function createFromBranch() {
    const booted = await bootWebview();
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");
    submitDialog();
    return booted;
  }

  it("asks what next, acts on the choice, and opens on it the next time", async () => {
    const { vscodeMock } = await createFromBranch();
    receive({ command: "addWorktree", status: null });

    expect(dialogText()).toContain("/workspace/createrepo.worktrees/feature/menu");
    const finish = dialogInput<HTMLSelectElement>(0);
    expect(finish.value).toBe("newWindow");
    finish.value = "switch";
    submitDialog();
    expect(latestRequest(vscodeMock.sentMessages, "switchGraphToWorktree")).toMatchObject({
      repo: REPO,
      path: "/workspace/createrepo.worktrees/feature/menu"
    });

    // The success refresh cleared the graph; answer it, then create again.
    receive({
      command: "loadBranches",
      requestId: latestRequest(vscodeMock.sentMessages, "loadBranches").requestId,
      branches: ["main", "feature/menu", `remotes/${REMOTE_REF}`],
      head: "main",
      hard: true,
      isRepo: true,
      error: null,
      worktrees: [worktree({})],
      upstreams: { main: "origin/main", "feature/menu": REMOTE_REF }
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
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");
    submitDialog();
    receive({ command: "addWorktree", status: null });
    expect(dialogInput<HTMLSelectElement>(0).value).toBe("switch");
  });

  it("shows the error instead of the finish step when creation fails", async () => {
    await createFromBranch();
    receive({ command: "addWorktree", status: "git said no" });

    expect(dialogText()).toContain("Unable to Create Worktree");
    expect(dialogText()).toContain("git said no");
    expect(document.querySelector("#dialog select")).toBeNull();
  });
});

describe("defaultWorktreePath (decision Y7)", () => {
  it("puts the worktree in a <repo>.worktrees folder beside the repository", async () => {
    const { main } = await bootWebview();

    expect(main.defaultWorktreePath("/home/u/proj", "feat")).toBe("/home/u/proj.worktrees/feat");
    expect(main.defaultWorktreePath("/home/u/proj/", "feat/x")).toBe(
      "/home/u/proj.worktrees/feat/x"
    );
    expect(main.defaultWorktreePath("/proj", "feat")).toBe("/proj.worktrees/feat");
    expect(main.defaultWorktreePath(String.raw`C:\dev\proj`, "feat")).toBe(
      String.raw`C:\dev\proj.worktrees\feat`
    );
    expect(main.defaultWorktreePath("proj", "feat")).toBe("proj.worktrees/feat");
  });
});

describe("the worktree folder template (W22F)", () => {
  it("resolves the template that spells out the default to the Y7 folder", async () => {
    const { main } = await bootWebview();

    expect(
      main.defaultWorktreePath(
        "/home/u/proj",
        "feat/x",
        `${token("repo")}.worktrees/${token("branch")}`
      )
    ).toBe("/home/u/proj.worktrees/feat/x");
  });

  it("takes a relative template from the repository's parent folder and resolves ..", async () => {
    const { main } = await bootWebview();

    expect(
      main.defaultWorktreePath("/home/u/proj", "feat", `../${token("repo")}-wt/${token("branch")}`)
    ).toBe("/home/proj-wt/feat");
  });

  it("uses an absolute template as written", async () => {
    const { main } = await bootWebview();

    expect(
      main.defaultWorktreePath(
        "/home/u/proj",
        "feat",
        `/srv/wt/${token("repo")}/${token("branch")}`
      )
    ).toBe("/srv/wt/proj/feat");
  });

  it("leaves an unknown placeholder as written", async () => {
    const { main } = await bootWebview();

    expect(
      main.defaultWorktreePath(
        "/home/u/proj",
        "feat",
        `${token("repo")}-${token("owner")}/${token("branch")}`
      )
    ).toBe(`/home/u/proj-${token("owner")}/feat`);
  });

  it("keeps the repository's Windows separator and never climbs above a root", async () => {
    const { main } = await bootWebview();

    expect(
      main.defaultWorktreePath(
        String.raw`C:\dev\proj`,
        "feat",
        `${token("repo")}-wt\\${token("branch")}`
      )
    ).toBe(String.raw`C:\dev\proj-wt\feat`);
    expect(main.defaultWorktreePath("/proj", "feat", `../../${token("branch")}`)).toBe("/feat");
  });

  it("trims the setting and reads anything that is not text as the default", async () => {
    const { main } = await bootWebview();

    expect(main.normalizeWorktreePathTemplate(`  ${token("repo")}-wt/${token("branch")}  `)).toBe(
      `${token("repo")}-wt/${token("branch")}`
    );
    expect(main.normalizeWorktreePathTemplate("   ")).toBe("");
    expect(main.normalizeWorktreePathTemplate(true)).toBe("");
    expect(main.normalizeWorktreePathTemplate(undefined)).toBe("");
  });

  it("pre-fills the dialog's folder from the setting the graph booted with", async () => {
    await bootWebview({ worktreePathTemplate: `${token("repo")}-wt/${token("branch")}` });
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");

    expect(dialogInput<HTMLInputElement>(0).value).toBe("/workspace/createrepo-wt/feature/menu");
  });

  it("applies a changed setting to the next dialog without a reload", async () => {
    await bootWebview();
    receive({
      command: "updateExtensionSetting",
      key: "git-graph-libre.repository.worktreePathTemplate",
      status: null,
      settings: [
        {
          key: "git-graph-libre.repository.worktreePathTemplate",
          configKey: "repository.worktreePathTemplate",
          title: "",
          description: "",
          type: "string",
          value: `  /srv/wt/${token("branch")}  `,
          defaultValue: "",
          scope: "default"
        }
      ]
    });
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");

    expect(dialogInput<HTMLInputElement>(0).value).toBe("/srv/wt/feature/menu");
  });

  it("falls back to the default folder for a stale, non-text setting value", async () => {
    await bootWebview({ worktreePathTemplate: `${token("repo")}-wt/${token("branch")}` });
    receive({
      command: "updateExtensionSetting",
      key: "git-graph-libre.repository.worktreePathTemplate",
      status: null,
      settings: [
        {
          key: "git-graph-libre.repository.worktreePathTemplate",
          configKey: "repository.worktreePathTemplate",
          title: "",
          description: "",
          type: "string",
          value: true,
          defaultValue: "",
          scope: "default"
        }
      ]
    });
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");

    expect(dialogInput<HTMLInputElement>(0).value).toBe(
      "/workspace/createrepo.worktrees/feature/menu"
    );
  });
});

describe("the Browse button (W22F)", () => {
  function clickBrowse() {
    document.getElementById("dialogBrowse0")?.dispatchEvent(new MouseEvent("click"));
  }

  it("fills the folder with the picked folder and creates the worktree there", async () => {
    const { vscodeMock } = await bootWebview();
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");
    clickBrowse();

    const pick = latestRequest(vscodeMock.sentMessages, "pickFolder");
    receive({ command: "pickFolder", requestId: pick.requestId, path: "/picked/elsewhere" });
    expect(dialogInput<HTMLInputElement>(0).value).toBe("/picked/elsewhere");
    submitDialog();

    expect(latestRequest(vscodeMock.sentMessages, "addWorktree")).toMatchObject({
      path: "/picked/elsewhere"
    });
  });

  it("leaves the folder as it was when the picker is cancelled", async () => {
    const { vscodeMock } = await bootWebview();
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");
    clickBrowse();

    const pick = latestRequest(vscodeMock.sentMessages, "pickFolder");
    receive({ command: "pickFolder", requestId: pick.requestId, path: null });
    expect(dialogInput<HTMLInputElement>(0).value).toBe(
      "/workspace/createrepo.worktrees/feature/menu"
    );
  });

  it("ignores an answer to a pick the dialog no longer waits for", async () => {
    const { vscodeMock } = await bootWebview();
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");
    clickBrowse();
    clickBrowse();

    const picks = vscodeMock.sentMessages.filter(
      (msg): msg is Extract<GGL.RequestMessage, { command: "pickFolder" }> =>
        msg.command === "pickFolder"
    );
    expect(picks).toHaveLength(2);
    receive({ command: "pickFolder", requestId: picks[0].requestId, path: "/stale" });
    expect(dialogInput<HTMLInputElement>(0).value).toBe(
      "/workspace/createrepo.worktrees/feature/menu"
    );
  });
});

describe("Create Worktree from a branch", () => {
  it("pre-fills the Y7 folder and checks the branch out", async () => {
    const { vscodeMock } = await bootWebview();
    openRefContextMenu(".gitRef.head", "feature/menu");
    expect(contextMenuItems()).toContain("Create Worktree…");
    clickContextMenuItem("Create Worktree…");

    expect(dialogText()).toContain("feature/menu");
    expect(dialogInput<HTMLInputElement>(0).value).toBe(
      "/workspace/createrepo.worktrees/feature/menu"
    );
    expect(dialogInput<HTMLSelectElement>(1).value).toBe("branch");
    submitDialog();

    expect(latestRequest(vscodeMock.sentMessages, "addWorktree")).toMatchObject({
      repo: REPO,
      path: "/workspace/createrepo.worktrees/feature/menu",
      branch: "feature/menu",
      newBranch: null,
      startPoint: null,
      detach: false,
      lockReason: null
    });
  });

  it("refuses a branch checked out elsewhere and offers that worktree instead", async () => {
    const { vscodeMock } = await bootWebview({
      worktrees: [
        worktree({}),
        worktree({ path: OTHER_WORKTREE, branch: "feature/menu", isMain: false, isCurrent: false })
      ]
    });
    openRefContextMenu(".gitRef.head", "feature/menu");
    clickContextMenuItem("Create Worktree…");

    expect(dialogText()).toContain(OTHER_WORKTREE);
    expect(dialogText()).toContain("Open in New Window");
    submitDialog();

    expect(vscodeMock.sentMessages.some((msg) => msg.command === "addWorktree")).toBe(false);
    expect(latestRequest(vscodeMock.sentMessages, "openWorktree")).toMatchObject({
      path: OTHER_WORKTREE,
      newWindow: true
    });
  });
});

describe("Create Worktree from a remote branch, a commit and a tag", () => {
  it("creates the parsed local branch from the remote branch, locked with a reason", async () => {
    const { vscodeMock } = await bootWebview({ branches: ["main", `remotes/${REMOTE_REF}`] });
    openRefContextMenu(".gitRef.remote", "feature/menu");
    clickContextMenuItem("Create Worktree…");

    expect(dialogInput<HTMLSelectElement>(1).value).toBe("new");
    expect(dialogInput<HTMLInputElement>(2).value).toBe("feature/menu");
    dialogInput<HTMLInputElement>(3).checked = true;
    dialogInput<HTMLInputElement>(4).value = "keep é";
    submitDialog();

    expect(latestRequest(vscodeMock.sentMessages, "addWorktree")).toMatchObject({
      path: "/workspace/createrepo.worktrees/feature/menu",
      branch: null,
      newBranch: "feature/menu",
      startPoint: REMOTE_REF,
      detach: false,
      lockReason: "keep é"
    });
  });

  it("detaches at the clicked commit", async () => {
    const { vscodeMock } = await bootWebview();
    const row = document.querySelector<HTMLElement>('tr.commit[data-hash="fed789"]');
    expect(row).not.toBeNull();
    row?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    clickContextMenuItem("Create Worktree…");

    expect(dialogInput<HTMLSelectElement>(1).value).toBe("detach");
    submitDialog();

    expect(latestRequest(vscodeMock.sentMessages, "addWorktree")).toMatchObject({
      path: "/workspace/createrepo.worktrees/fed789",
      branch: null,
      newBranch: null,
      startPoint: "fed789",
      detach: true,
      lockReason: null
    });
  });

  it("starts a new branch at the clicked tag", async () => {
    const { vscodeMock } = await bootWebview();
    openRefContextMenu(".gitRef.tag", "v1");
    clickContextMenuItem("Create Worktree…");

    expect(dialogInput<HTMLSelectElement>(1).value).toBe("detach");
    const select = dialogInput<HTMLSelectElement>(1);
    select.value = "new";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const name = dialogInput<HTMLInputElement>(2);
    name.value = "from-v1";
    name.dispatchEvent(new Event("keyup", { bubbles: true }));
    submitDialog();

    expect(latestRequest(vscodeMock.sentMessages, "addWorktree")).toMatchObject({
      path: "/workspace/createrepo.worktrees/v1",
      branch: null,
      newBranch: "from-v1",
      startPoint: "v1",
      detach: false,
      lockReason: null
    });
  });
});
