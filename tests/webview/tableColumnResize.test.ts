import { describe, expect, it, vi } from "vitest";

import type { GitCommitNode, GitRepoInfo } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

const REPO = "/workspace/my-repo";
const OTHER_REPO = "/workspace/other-repo";
const STORED_WIDTHS = [64, 120, 124, 72, 64];

type LoadBranchesRequest = Extract<GGL.RequestMessage, { command: "loadBranches" }>;
type LoadCommitsRequest = Extract<GGL.RequestMessage, { command: "loadCommits" }>;
type LoadRepoInfoRequest = Extract<GGL.RequestMessage, { command: "loadRepoInfo" }>;
type SaveRepoStateRequest = Extract<GGL.RequestMessage, { command: "saveRepoState" }>;
type SelectRepoRequest = Extract<GGL.RequestMessage, { command: "selectRepo" }>;

function viewState(
  columnWidths: number[] | null,
  // The view mutates the stored widths in place while resizing, so each boot gets
  // its own copy rather than sharing one array across tests.
  repos: Record<string, GGL.GitRepoState> = {
    [REPO]: { columnWidths: columnWidths === null ? null : [...columnWidths] }
  }
): GGL.GitGraphViewState {
  return {
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
    repos,
    showCurrentBranchByDefault: false,
    showRemoteBranches: true,
    showStashes: true,
    showTags: true,
    shortHashLength: 4,
    telemetryConsent: "enabled"
  };
}

const commits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: ["def456"],
    author: "Alice",
    email: "alice@example.com",
    date: 1700000000,
    message: "Add feature",
    refs: [{ hash: "abc123", name: "main", type: "head" }]
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

const repoInfo: GitRepoInfo = {
  isRepo: true,
  head: "main",
  headCommit: "abc123",
  authors: ["Alice", "Bob"],
  tags: [],
  remotes: [],
  stashes: [],
  stashCount: 0,
  config: {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
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

async function boot(state: GGL.GitGraphViewState) {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vscodeMock = createVscodeMock();
  setupHtml(state);
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
}

function headers() {
  const elem = document.getElementById("tableColHeaders");
  if (elem === null) throw new Error("Missing tableColHeaders");
  return elem;
}

function columns() {
  return Array.from(document.getElementsByClassName("tableColHeader")) as HTMLElement[];
}

// The clamp reads the description column's rendered width, which jsdom always
// reports as 0. Stubbing it keeps the resize arithmetic deterministic instead of
// letting every drag collapse against a zero-width neighbour.
function stubDescriptionWidth(value: number) {
  Object.defineProperty(columns()[1], "clientWidth", { value, configurable: true });
}

function grab(col: number, clientX: number) {
  const handle = document.querySelector<HTMLElement>(`.resizeCol[data-col="${col}"]`);
  if (handle === null) throw new Error(`Missing resize handle for column ${col}`);
  handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX }));
}

function move(clientX: number) {
  headers().dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX }));
}

function release() {
  headers().dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

type DragCase = {
  name: string;
  descriptionWidth: number;
  col: number;
  to: number;
  expected: Array<[number, string]>;
};

const dragCases: DragCase[] = [
  {
    name: "widens the graph column",
    descriptionWidth: 300,
    col: 0,
    to: 120,
    expected: [[0, "84px"]]
  },
  {
    name: "clamps the graph column at its 40px minimum",
    descriptionWidth: 300,
    col: 0,
    to: -400,
    expected: [[0, "40px"]]
  },
  {
    name: "stops the graph column before the description column falls under 64px",
    descriptionWidth: 80,
    col: 0,
    to: 200,
    expected: [[0, "80px"]]
  },
  {
    name: "trades width between the description column and its neighbour",
    descriptionWidth: 300,
    col: 1,
    to: 90,
    expected: [[2, "130px"]]
  },
  {
    name: "clamps the description column at its 40px minimum",
    descriptionWidth: 300,
    col: 1,
    to: 400,
    expected: [[2, "40px"]]
  },
  {
    name: "stops the description column at its rendered 64px floor",
    descriptionWidth: 70,
    col: 1,
    to: 80,
    expected: [[2, "126px"]]
  },
  {
    name: "moves width between two adjacent fixed columns",
    descriptionWidth: 300,
    col: 3,
    to: 110,
    expected: [
      [3, "134px"],
      [4, "62px"]
    ]
  },
  {
    name: "clamps a fixed column pair so neither drops below 40px",
    descriptionWidth: 300,
    col: 3,
    to: 500,
    expected: [
      [3, "156px"],
      [4, "40px"]
    ]
  }
];

const migrationCases = [
  {
    name: "gives the signature column its default width",
    stored: [80, 130, 140, 90],
    column: 5,
    width: "64px"
  },
  {
    name: "raises a stored width that is below the minimum",
    stored: [10, 130, 140, 90],
    column: 0,
    width: "40px"
  }
];

describe("commit table column resizing", () => {
  it("renders a resize handle between columns", async () => {
    await boot(viewState(STORED_WIDTHS));

    expect(document.querySelectorAll(".resizeCol").length).toBeGreaterThan(0);
    expect(document.querySelector('.resizeCol[data-col="0"]')).not.toBeNull();
  });

  it.each(dragCases)("$name", async ({ descriptionWidth, col, to, expected }) => {
    await boot(viewState(STORED_WIDTHS));
    stubDescriptionWidth(descriptionWidth);

    grab(col, 100);
    move(to);

    const cols = columns();
    for (const [index, width] of expected) {
      expect(cols[index].style.width).toBe(width);
    }
  });

  it("persists the new widths when the drag ends", async () => {
    await boot(viewState(STORED_WIDTHS));
    stubDescriptionWidth(300);
    vscodeMock.clearMessages();

    grab(0, 100);
    move(130);
    release();

    const saved = latest("saveRepoState") as SaveRepoStateRequest;
    expect(saved.repo).toBe(REPO);
    expect(saved.state.columnWidths).toEqual([94, 120, 124, 72, 64]);
  });

  it("ignores a mouse move that is not part of a drag", async () => {
    await boot(viewState(STORED_WIDTHS));
    stubDescriptionWidth(300);
    vscodeMock.clearMessages();
    const before = columns()[0].style.width;

    move(400);

    expect(columns()[0].style.width).toBe(before);
    expect(() => latest("saveRepoState")).toThrow();
  });

  it.each(migrationCases)(
    "expands legacy four-column widths and $name",
    async ({ stored, column, width }) => {
      await boot(viewState(stored));

      expect(columns()[column].style.width).toBe(width);
    }
  );
});

describe("switching repository", () => {
  it("resets per-repository state and reloads when another repo is picked", async () => {
    await boot(
      viewState(null, {
        [REPO]: { columnWidths: null },
        [OTHER_REPO]: { columnWidths: null }
      })
    );
    vscodeMock.clearMessages();

    const dropdown = document.getElementById("repoSelect");
    dropdown
      ?.querySelector<HTMLElement>(".dropdownCurrentValue")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const option = Array.from(
      dropdown?.querySelectorAll<HTMLElement>(".dropdownOption") ?? []
    ).find((item) => item.textContent?.includes("other-repo"));
    option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect((latest("selectRepo") as SelectRepoRequest).repo).toBe(OTHER_REPO);
    // The switch closes the settings widget and refreshes from scratch.
    expect(document.getElementById("settingsWidget")?.hasAttribute("hidden")).toBe(true);
    expect(latest("loadRepoInfo")).toBeDefined();
  });
});
