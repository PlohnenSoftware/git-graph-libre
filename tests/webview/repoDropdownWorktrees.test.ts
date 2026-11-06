import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import type * as GGL from "@/types";

import { createVscodeMock, receive, setupHtml } from "./setup";

// Its own file on purpose: the render drives a full page load, and a second
// imported copy of the webview in the same file would answer the same
// messages against a detached table.

const MAIN = "/workspace/main";
const SIDE = "/workspace/side wt é";
const OUTSIDE = "/elsewhere/out wt";
const COMMON = "/workspace/main/.git";

const LAYOUT: GGL.RepoLayout = {
  worktrees: {
    [MAIN]: { commonDir: COMMON, linked: false, branch: "main", detached: false },
    [SIDE]: { commonDir: COMMON, linked: true, branch: "side", detached: false }
  },
  outside: [
    { path: OUTSIDE, commonDir: COMMON, linked: true, branch: "out-b", detached: false, repo: MAIN }
  ]
};

function makeViewState(): GGL.GitGraphViewState {
  return {
    autoCenterCommitDetailsView: false,
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
    fetchTagsByDefault: false,
    showTagRemotes: true,
    mergeNoFastForward: true,
    pullBranchNoFastForward: false,
    createBranchCheckout: true,
    onlyFollowFirstParent: false,
    repos: { [MAIN]: { columnWidths: null }, [SIDE]: { columnWidths: null } },
    repoLayout: LAYOUT,
    showCurrentBranchByDefault: false,
    showRemoteBranches: true,
    showStashes: true,
    showTags: true,
    shortHashLength: 8,
    language: "en",
    languages: [{ id: "en", label: "English" }]
  };
}

async function boot() {
  vi.resetModules();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const vscodeMock = createVscodeMock();
  setupHtml({ ...makeViewState(), lastActiveRepo: MAIN });
  await import("@/webview/main");
  return vscodeMock;
}

function optionTexts() {
  return [...document.querySelectorAll("#repoSelect .dropdownOption")].map((option) =>
    option.textContent?.trim()
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the repository dropdown with worktrees", () => {
  it("lists the main worktree, its linked worktree beneath it, then the outside one", async () => {
    await boot();

    expect(optionTexts()).toEqual([
      "main (main)",
      "side wt é (side)",
      "out wt (out-b) · outside workspace"
    ]);
    const indents = [...document.querySelectorAll("#repoSelect .dropdownOption")].map((option) =>
      option.getAttribute("data-indent-level")
    );
    expect(indents).toEqual(["0", "1", "1"]);
  });

  it("asks the host to add and switch to an outside worktree, and keeps the current repository meanwhile", async () => {
    const vscodeMock = await boot();
    const before = vscodeMock.sentMessages.length;

    document
      .querySelector("#repoSelect .dropdownCurrentValue")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const outside = document.querySelectorAll("#repoSelect .dropdownOption")[2];
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const sent = vscodeMock.sentMessages.slice(before);
    expect(sent).toContainEqual({ command: "switchGraphToWorktree", repo: MAIN, path: OUTSIDE });
    expect(sent.some((msg) => msg.command === "selectRepo")).toBe(false);
    expect(document.querySelector("#repoSelect .dropdownCurrentValue")?.textContent).toContain(
      "main (main)"
    );
  });

  it("follows the host's list once the outside worktree has been added", async () => {
    await boot();
    const layout: GGL.RepoLayout = {
      worktrees: {
        ...LAYOUT.worktrees,
        [OUTSIDE]: { commonDir: COMMON, linked: true, branch: "out-b", detached: false }
      },
      outside: []
    };

    receive({
      command: "loadRepos",
      repos: {
        [MAIN]: { columnWidths: null },
        [OUTSIDE]: { columnWidths: null },
        [SIDE]: { columnWidths: null }
      },
      lastActiveRepo: OUTSIDE,
      layout
    });

    expect(optionTexts()).toEqual(["main (main)", "out wt (out-b)", "side wt é (side)"]);
  });

  it("keeps the layout the host last sent when a later loadRepos carries none", async () => {
    await boot();

    receive({
      command: "loadRepos",
      repos: { [MAIN]: { columnWidths: null }, [SIDE]: { columnWidths: null } },
      lastActiveRepo: MAIN
    });

    expect(optionTexts()).toEqual([
      "main (main)",
      "side wt é (side)",
      "out wt (out-b) · outside workspace"
    ]);
  });
});
