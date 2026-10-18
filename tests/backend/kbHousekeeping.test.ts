import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../docs/kb/housekeeping.mjs");
const README_HEAD = "# Knowledge base\n\nHand-written intro.\n\n";
const MARKERS = "<!-- kb-index:start -->\n<!-- kb-index:end -->\n";

type Run = { status: number; stdout: string; stderr: string };

function run(args: string[]): Run {
  const result = cp.spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function section(title: string, summary: string, alwaysRead = false): string {
  const flag = alwaysRead ? "always_read: true\n" : "";
  return `---\nsummary: >-\n  ${summary}\n${flag}---\n\n# ${title}\n\nBody of ${title}.\n`;
}

const roots: string[] = [];

function makeKb(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-kb-"));
  roots.push(root);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

function readme(root: string): string {
  return fs.readFileSync(path.join(root, "README.md"), "utf8");
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("knowledge base housekeeping", () => {
  it("builds the index from titles and front matter, in prefix order, with subsections nested", () => {
    const root = makeKb({
      "README.md": README_HEAD + MARKERS,
      "010-rules.md": section("Rules", "how to work here."),
      "010-rules/020-later.md": section("Later [b]", "comes second"),
      "010-rules/010-first.md": section("First", "comes first: with a colon", true),
      "010-rules/010-first/010-child.md": section("Child", "nested under First", true),
      "020-history.md": section("History", "finished work."),
      "020-history/010-record.md": section("Record", "an old record")
    });

    expect(run(["--root", root]).status).toBe(0);
    expect(readme(root)).toBe(
      `${README_HEAD}<!-- kb-index:start -->

**Always read**, in this order:

1. [First](010-rules/010-first.md)
2. [Child](010-rules/010-first/010-child.md)

**Rules**: how to work here.

- [First](010-rules/010-first.md) (*always read*) — comes first: with a colon
  - [Child](010-rules/010-first/010-child.md) (*always read*) — nested under First
- [Later \\[b\\]](010-rules/020-later.md) — comes second

**History**: finished work.

- [Record](020-history/010-record.md) — an old record

<!-- kb-index:end -->
`
    );
    expect(run(["--check", "--root", root]).status).toBe(0);
  });

  it("joins a summary folded over several lines", () => {
    const root = makeKb({
      "README.md": MARKERS,
      "010-group.md": section("Group", "the group"),
      "010-group/010-long.md": "---\nsummary: >-\n  first half\n  second half\n---\n\n# Long\n"
    });

    expect(run(["--root", root]).status).toBe(0);
    expect(readme(root)).toContain("- [Long](010-group/010-long.md) — first half second half\n");
  });

  it("fails the check while the index is stale, and leaves the file alone", () => {
    const root = makeKb({
      "README.md": MARKERS,
      "010-group.md": section("Group", "the group")
    });

    const result = run(["--check", "--root", root]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("out of date");
    expect(readme(root)).toBe(MARKERS);
  });

  it("reports every file that breaks the layout rules instead of writing an index", () => {
    const root = makeKb({
      "README.md": MARKERS,
      "010-group.md": section("Group", "the group"),
      "010-group/010-a.md": section("A", "first"),
      "010-group/010-b.md": section("B", "same prefix"),
      "010-group/020-no-summary.md": "---\nalways_read: true\n---\n\n# No summary\n",
      "010-group/030-plain.md": "---\nsummary: plain: text\n---\n\n# Plain\n",
      "010-group/040-no-title.md": "---\nsummary: >-\n  text\n---\n\nNo heading.\n",
      "010-group/050-two-titles.md": `${section("One", "text")}\n# Two\n`,
      "010-group/060-orphan/010-x.md": section("X", "lost"),
      "010-group/Bad Name.md": section("Bad", "name")
    });

    const result = run(["--root", root]);
    expect(result.status).toBe(1);
    for (const problem of [
      "010-group/010-b.md: prefix 010 is used twice",
      "010-group/020-no-summary.md: no summary",
      '010-group/030-plain.md: unsupported front matter line "summary: plain: text"',
      "010-group/040-no-title.md: the first line after the front matter must be",
      "010-group/050-two-titles.md: has more than one",
      "010-group/060-orphan/: has no 060-orphan.md beside it",
      "010-group/Bad Name.md: not a section name"
    ]) {
      expect(result.stderr).toContain(problem);
    }
    expect(readme(root)).toBe(MARKERS);
  });

  it("ignores a heading-like line inside a code fence", () => {
    const root = makeKb({
      "README.md": MARKERS,
      "010-group.md": section("Group", "the group"),
      "010-group/010-fenced.md": `${section("Fenced", "text")}\n\`\`\`bash\n# a comment\n\`\`\`\n`
    });

    expect(run(["--root", root]).status).toBe(0);
  });

  it("refuses a README without the index markers", () => {
    const root = makeKb({ "README.md": "# No markers\n", "010-group.md": section("G", "g") });

    const result = run(["--root", root]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing <!-- kb-index:start -->");
  });

  it("finds this repository's knowledge base current and well formed", () => {
    const result = run(["--check"]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});

/** Written by Python's `json.dumps(indent=2)`, exactly as graphify writes graph.json. */
const GRAPH_FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "kb-graph.json"), "utf8");

type GraphEdge = {
  relation: string;
  confidence: string;
  source: string;
  target: string;
  source_location: string;
  _origin: string;
};

/** A repository whose knowledge base matches the fixture graph's document nodes. */
function makeGraphRepo(alphaBody: string, graph = GRAPH_FIXTURE) {
  const repo = makeKb({
    "docs/kb/README.md": MARKERS,
    "docs/kb/010-group.md": section("Group", "the group"),
    "docs/kb/010-group/010-alpha.md": section("Alpha", "mentions code") + alphaBody,
    "docs/kb/010-group/010-alpha/010-child.md": section("Child", "nested"),
    "graphify-out/graph.json": graph
  });
  return {
    root: path.join(repo, "docs", "kb"),
    graphPath: path.join(repo, "graphify-out", "graph.json")
  };
}

function kbEdges(graphPath: string): GraphEdge[] {
  const graph = JSON.parse(fs.readFileSync(graphPath, "utf8")) as { links: GraphEdge[] };
  return graph.links.filter((edge) => edge._origin === "kb");
}

const ALPHA_MENTIONS = [
  "",
  "Exact path `src/engine.ts`, ambiguous path `index.ts`, a code name `readCommitDetails`,",
  "a name four symbols share `loadThing`, and a plain word `run`.",
  "",
  "```bash",
  "cat `src/a/index.ts`",
  "```",
  ""
].join("\n");

describe("knowledge base edges in the graphify graph", () => {
  it("adds the tree and the code mentions, replacing the previous kb edges", () => {
    const { root, graphPath } = makeGraphRepo(ALPHA_MENTIONS);

    const result = run(["--root", root, "--graph"]);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(
      kbEdges(graphPath).map(({ relation, confidence, source, target }) => [
        relation,
        confidence,
        source,
        target
      ])
    ).toEqual([
      ["contains", "EXTRACTED", "docs_kb_readme", "docs_kb_010_group"],
      ["contains", "EXTRACTED", "docs_kb_010_group", "docs_kb_010_group_010_alpha"],
      ["mentions", "EXTRACTED", "docs_kb_010_group_010_alpha", "src_engine"],
      ["mentions", "INFERRED", "docs_kb_010_group_010_alpha", "src_engine_readcommitdetails"],
      [
        "contains",
        "EXTRACTED",
        "docs_kb_010_group_010_alpha",
        "docs_kb_010_group_010_alpha_010_child"
      ]
    ]);
    // Eight lines of front matter, title and body, a blank line, then the mentions.
    expect(kbEdges(graphPath)[2].source_location).toBe("L10");
  });

  it("keeps everything it does not own byte for byte, in graphify's own format", () => {
    const { root, graphPath } = makeGraphRepo(ALPHA_MENTIONS);

    run(["--root", root, "--graph"]);
    const text = fs.readFileSync(graphPath, "utf8");

    const ownedEdgeStart = GRAPH_FIXTURE.indexOf(',\n    {\n      "relation": "mentions"');
    expect(text.startsWith(GRAPH_FIXTURE.slice(0, ownedEdgeStart))).toBe(true);
    expect(text).toContain('"label": "Notes \\u2014 draft"');
    expect(text).toContain('"weight": 1.0,');
    expect(text).toContain('"confidence_score": 0.8');
    expect(text.endsWith('  "built_at_commit": "abc"\n}')).toBe(true);
  });

  it("writes the same file when run again", () => {
    const { root, graphPath } = makeGraphRepo(ALPHA_MENTIONS);

    run(["--root", root, "--graph"]);
    const first = fs.readFileSync(graphPath, "utf8");
    run(["--root", root, "--graph"]);

    expect(fs.readFileSync(graphPath, "utf8")).toBe(first);
  });

  it("asks for graphify update when the graph lacks a section file", () => {
    const { root, graphPath } = makeGraphRepo("");
    fs.writeFileSync(
      path.join(root, "010-group", "020-new.md"),
      section("New", "not in the graph")
    );

    const result = run(["--root", root, "--graph"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("docs/kb/010-group/020-new.md");
    expect(result.stderr).toContain("run graphify update . first");
    expect(fs.readFileSync(graphPath, "utf8")).toBe(GRAPH_FIXTURE);
  });

  it("refuses a graph.json graphify did not write, rather than reformat it", () => {
    const compact = JSON.stringify(JSON.parse(GRAPH_FIXTURE));
    const { root, graphPath } = makeGraphRepo("", compact);

    const result = run(["--root", root, "--graph"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not in the format graphify writes");
    expect(fs.readFileSync(graphPath, "utf8")).toBe(compact);
  });
});
