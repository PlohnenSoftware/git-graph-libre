import { beforeEach, describe, expect, it } from "vitest";
import type { GitCommitNode } from "@/backend/types";
import { DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY } from "@/contextMenuVisibility";
import { COMMIT_DETAILS_DEFAULT_HEIGHT } from "@/webview/commitDetailsView";
import { Graph } from "@/webview/graph";

const config: Config = {
  autoCenterCommitDetailsView: true,
  commitDetailsCompactFolders: false,
  commitDetailsFileViewMode: "tree",
  contextMenuActionsVisibility: DEFAULT_CONTEXT_MENU_ACTIONS_VISIBILITY,
  fetchAvatars: false,
  showSignatureColumn: false,
  graphColors: ["oklch(65% 0.16 250)"],
  customBranchGlobPatterns: [],
  graphFontSize: 13,
  graphRowHeight: 24,
  graphStyle: "rounded",
  revealHighlightColor: "oklch(90% 0.25 150 / 0.42)",
  grid: { x: 16, y: 24, offsetX: 8, offsetY: 12, expandY: 250 },
  includeReflog: false,
  includeUnreachableCommits: false,
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  muteCommitsNotAncestorsOfHead: false,
  muteMergeCommits: false,
  boldCheckedOutCommit: false,
  fetchTagsByDefault: true,
  onlyFollowFirstParent: false,
  showCurrentBranchByDefault: false,
  showRemoteBranches: true,
  showStashes: true,
  showTags: true,
  shortHashLength: 8
};

function makeCommit(hash: string, parentHashes: string[] = []): GitCommitNode {
  return {
    hash,
    parentHashes,
    author: "Dev",
    email: "dev@example.com",
    date: 1_700_000_000,
    message: hash === "*" ? "Uncommitted changes" : `Commit ${hash}`,
    refs: []
  };
}

function makeGraph() {
  document.body.innerHTML = '<div id="commitGraph"></div>';
  return new Graph("commitGraph", config);
}

describe("graph rendering", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("initializes SVG mask colors with OKLCH values", () => {
    makeGraph();

    const stops = document.querySelectorAll("#commitGraph stop");

    expect(stops[0]?.getAttribute("stop-color")).toBe("oklch(100% 0 0)");
    expect(stops[1]?.getAttribute("stop-color")).toBe("oklch(0% 0 0)");
  });

  it("renders committed and uncommitted graph strokes with OKLCH colors", () => {
    const graph = makeGraph();
    const commits = [makeCommit("*", ["abc123"]), makeCommit("abc123")];

    graph.loadCommits(commits, "abc123", { "*": 0, abc123: 1 });
    graph.render(null);

    const strokes = Array.from(document.querySelectorAll("#commitGraph path.line")).map((path) =>
      path.getAttribute("stroke")
    );
    const currentCircle = document.querySelector("#commitGraph circle.current");

    expect(strokes).toContain("oklch(60% 0 0)");
    expect(currentCircle?.getAttribute("stroke")).toBe("oklch(60% 0 0)");
  });

  it("renders root commits (no parents) as squares and other commits as circles", () => {
    const graph = makeGraph();
    const commits = [makeCommit("abc123", ["def456"]), makeCommit("def456")];

    graph.loadCommits(commits, "abc123", { abc123: 0, def456: 1 });
    graph.render(null);

    const rects = document.querySelectorAll("#commitGraph g rect");
    const circles = document.querySelectorAll("#commitGraph g circle");

    expect(rects).toHaveLength(1);
    expect(circles).toHaveLength(1);
    expect(rects[0]?.getAttribute("width")).toBe("8");
    expect(rects[0]?.getAttribute("height")).toBe("8");
  });

  it("does not trail a line below a root commit that has no parent", () => {
    const graph = makeGraph();
    // "Ra" is a root (no parents) that is NOT at the bottom of the graph; "B" is
    // an older orphan root beneath it. A root has no parent, so no line should
    // extend downward from "Ra" toward "B".
    const commits = [makeCommit("A", ["Ra"]), makeCommit("Ra"), makeCommit("B")];

    graph.loadCommits(commits, "A", { A: 0, Ra: 1, B: 2 });
    graph.render(null);

    const ys = Array.from(document.querySelectorAll("#commitGraph g path.line"))
      .flatMap((path) => {
        const d = path.getAttribute("d") ?? "";
        return (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      })
      .filter((_, index) => index % 2 === 1);

    // The line must reach the root "Ra" (row 1 -> y = 36) but never the orphan
    // root "B" beneath it (row 2 -> y = 60).
    expect(ys).toContain(36);
    expect(ys).not.toContain(60);
  });

  it("replaces rendered groups, applies width limits, and clears the graph", () => {
    const graph = makeGraph();
    const commits = [makeCommit("abc123", ["def456"]), makeCommit("def456")];
    const expandedCommit: ExpandedCommit = {
      id: 0,
      hash: "abc123",
      srcElem: null,
      commitDetails: null,
      fileTree: null,
      comparison: null,
      detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT,
      summaryOpen: true,
      filesOpen: true
    };

    graph.loadCommits(commits, "abc123", { abc123: 0, def456: 1 });
    graph.render(null);
    const firstGroup = document.querySelector("#commitGraph g");

    graph.limitMaxWidth(20);
    graph.render(expandedCommit);

    const svg = document.querySelector("#commitGraph svg");
    const groups = document.querySelectorAll("#commitGraph g");
    const stops = document.querySelectorAll("#commitGraph stop");

    expect(groups).toHaveLength(1);
    expect(groups[0]).not.toBe(firstGroup);
    expect(svg?.getAttribute("height")).toBe("298");
    expect(stops[0]?.getAttribute("offset")).toBe("0.5");
    expect(stops[1]?.getAttribute("offset")).toBe("1.25");

    graph.clear();

    expect(document.querySelector("#commitGraph g")).toBeNull();
    expect(svg?.getAttribute("width")).toBe("0");
    expect(svg?.getAttribute("height")).toBe("0");
  });
});
