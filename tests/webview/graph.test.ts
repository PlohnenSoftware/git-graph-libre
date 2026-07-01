import type { GitCommitNode } from "@/backend/types";
import { Graph } from "@/webview/graph";
import { beforeEach, describe, expect, it } from "vitest";

const config: Config = {
  autoCenterCommitDetailsView: true,
  fetchAvatars: false,
  graphColours: ["oklch(65% 0.16 250)"],
  graphFontSize: 13,
  graphRowHeight: 24,
  graphStyle: "rounded",
  grid: { x: 16, y: 24, offsetX: 8, offsetY: 12, expandY: 250 },
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  showCurrentBranchByDefault: false
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

  it("replaces rendered groups, applies width limits, and clears the graph", () => {
    const graph = makeGraph();
    const commits = [makeCommit("abc123", ["def456"]), makeCommit("def456")];
    const expandedCommit: ExpandedCommit = {
      id: 0,
      hash: "abc123",
      srcElem: null,
      commitDetails: null,
      fileTree: null
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
