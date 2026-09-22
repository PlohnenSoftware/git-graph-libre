import { describe, expect, it } from "vitest";

import {
  applySignedTagNames,
  buildLoadCommitsOptions,
  engineLoadCommitsRefs,
  insertRemoteHeadLabels,
  mapEngineCommitData,
  parseEngineCommitData,
  parseRemoteHeadLabels,
  parseSignedTagNames,
  shortStashRef,
  shouldServeLoadCommitsFromEngine,
  type EngineCommit,
  type EngineCommitData,
  type EngineLoadCommitsInput
} from "@/backend/engine/commits";
import type { GitCommitNode } from "@/backend/types";

const BASE: EngineLoadCommitsInput = {
  branchName: "",
  branches: null,
  authors: null,
  tags: null,
  maxCommits: 100,
  showRemoteBranches: true,
  hiddenRemotes: [],
  showTags: true,
  includeReflog: false,
  includeUnreachableCommits: false,
  onlyFollowFirstParent: false,
  commitOrdering: "date",
  showSignature: false,
  showStashes: false,
  dateType: "Commit Date",
  showUncommittedChanges: true
};

describe("engineLoadCommitsRefs", () => {
  it("is null for a show-all load", () => {
    expect(engineLoadCommitsRefs(BASE)).toBeNull();
  });

  it("combines branches, the legacy branch name and selected tags like the CLI", () => {
    expect(engineLoadCommitsRefs({ ...BASE, branches: ["main"] })).toEqual(["main"]);
    expect(engineLoadCommitsRefs({ ...BASE, branchName: "main" })).toEqual(["main"]);
    expect(
      engineLoadCommitsRefs({ ...BASE, branches: ["main"], tags: ["v1.0.0"] })
    ).toEqual(["main", "refs/tags/v1.0.0"]);
  });
});

describe("shouldServeLoadCommitsFromEngine", () => {
  it("serves a plain show-all load", () => {
    expect(shouldServeLoadCommitsFromEngine(BASE)).toBe(true);
  });

  it("declines the moment the signature column is on", () => {
    expect(shouldServeLoadCommitsFromEngine({ ...BASE, showSignature: true })).toBe(false);
    // The column being off again restores the engine path.
    expect(shouldServeLoadCommitsFromEngine({ ...BASE, showSignature: false })).toBe(true);
  });

  it("declines Author Date, whose `%at` has no engine equivalent", () => {
    expect(shouldServeLoadCommitsFromEngine({ ...BASE, dateType: "Author Date" })).toBe(false);
  });

  it("declines reflog and unreachable discovery on show-all loads only", () => {
    expect(shouldServeLoadCommitsFromEngine({ ...BASE, includeReflog: true })).toBe(false);
    expect(shouldServeLoadCommitsFromEngine({ ...BASE, includeUnreachableCommits: true })).toBe(
      false
    );
    // With explicit refs the CLI ignores both flags, so the engine serves.
    const filtered = { ...BASE, branches: ["main"] };
    expect(
      shouldServeLoadCommitsFromEngine({
        ...filtered,
        includeReflog: true,
        includeUnreachableCommits: true
      })
    ).toBe(true);
  });

  it("declines `--glob=` patterns the engine cannot expand", () => {
    expect(
      shouldServeLoadCommitsFromEngine({ ...BASE, branches: ["--glob=feature/*"] })
    ).toBe(false);
    expect(shouldServeLoadCommitsFromEngine({ ...BASE, branches: ["main"] })).toBe(true);
  });
});

describe("buildLoadCommitsOptions", () => {
  it("threads the route input with CLI-equivalent constants", () => {
    expect(JSON.parse(buildLoadCommitsOptions(BASE))).toEqual({
      branches: null,
      authors: null,
      maxCommits: 100,
      showTags: true,
      showRemoteBranches: true,
      showRemoteHeads: true,
      deferRemoteRefs: false,
      includeCommitsMentionedByReflogs: false,
      onlyFollowFirstParent: false,
      commitOrdering: "date",
      remotes: [],
      hideRemotes: [],
      filterPaths: [],
      deferUncommittedChanges: false,
      showUncommittedChanges: true,
      showUntrackedFiles: true,
      showCommitsOnlyReferencedByTags: true,
      useMailmap: false
    });
  });

  it("mirrors the CLI defaults and normalization", () => {
    const options = JSON.parse(
      buildLoadCommitsOptions({
        ...BASE,
        branches: ["main"],
        tags: ["v1.0.0"],
        showTags: undefined,
        commitOrdering: undefined,
        authors: [" Alice ", "", "Alice"],
        hiddenRemotes: [" origin ", "origin", ""],
        onlyFollowFirstParent: true
      })
    );
    expect(options.branches).toEqual(["main", "refs/tags/v1.0.0"]);
    expect(options.showTags).toBe(true);
    expect(options.showCommitsOnlyReferencedByTags).toBe(true);
    expect(options.commitOrdering).toBe("date");
    expect(options.authors).toEqual(["Alice"]);
    expect(options.hideRemotes).toEqual(["origin"]);
    expect(options.onlyFollowFirstParent).toBe(true);
  });

  it("drops tag tips with the tags, like omitting `--tags`", () => {
    const options = JSON.parse(buildLoadCommitsOptions({ ...BASE, showTags: false }));
    expect(options.showTags).toBe(false);
    expect(options.showCommitsOnlyReferencedByTags).toBe(false);
  });

  it("scans tags selected as filters even when tags are hidden", () => {
    const options = JSON.parse(
      buildLoadCommitsOptions({ ...BASE, showTags: false, tags: ["v1.0.0"] })
    );
    expect(options.showTags).toBe(true);
    expect(options.showCommitsOnlyReferencedByTags).toBe(false);
  });
});

const COMMIT: EngineCommit = {
  hash: "a".repeat(40),
  parents: ["b".repeat(40)],
  author: "Ada",
  email: "ada@x.com",
  date: 1790090408,
  message: "second",
  heads: ["main"],
  tags: [{ name: "v1.0.0", annotated: false }],
  remotes: [{ name: "origin/main", remote: "origin" }],
  stash: null
};

const STASH_ROW: EngineCommit = {
  hash: "c".repeat(40),
  parents: ["b".repeat(40)],
  author: "Ada",
  email: "ada@x.com",
  date: 1790090500,
  message: "On main: wip",
  heads: [],
  tags: [],
  remotes: [],
  stash: { selector: "refs/stash@{0}", baseHash: "b".repeat(40), untrackedFilesHash: null }
};

const PAGE: EngineCommitData = {
  commits: [COMMIT, STASH_ROW],
  head: "a".repeat(40),
  tags: ["v1.0.0"],
  branches: ["main"],
  moreCommitsAvailable: false,
  error: null
};

describe("parseEngineCommitData", () => {
  it("decodes a complete payload", () => {
    expect(parseEngineCommitData(JSON.stringify(PAGE))).toEqual(PAGE);
  });

  it("accepts a payload without the optional branch list", () => {
    const { branches: _dropped, ...withoutBranches } = PAGE;
    expect(parseEngineCommitData(JSON.stringify(withoutBranches))?.branches).toBeNull();
  });

  it.each(["not json", "[1]", "null", '"str"', "42"])("rejects %s", (text) => {
    expect(parseEngineCommitData(text)).toBeNull();
  });

  it("rejects payloads with missing or mistyped fields", () => {
    expect(parseEngineCommitData(JSON.stringify({ ...PAGE, commits: "x" }))).toBeNull();
    expect(
      parseEngineCommitData(
        JSON.stringify({ ...PAGE, commits: [{ ...COMMIT, date: "yesterday" }] })
      )
    ).toBeNull();
    expect(
      parseEngineCommitData(
        JSON.stringify({ ...PAGE, commits: [{ ...COMMIT, tags: [{ name: "v" }] }] })
      )
    ).toBeNull();
    expect(parseEngineCommitData(JSON.stringify({ ...PAGE, head: 42 }))).toBeNull();
    expect(parseEngineCommitData(JSON.stringify({ ...PAGE, moreCommitsAvailable: 0 }))).toBeNull();
    const { error: _dropped, ...withoutError } = PAGE;
    expect(parseEngineCommitData(JSON.stringify(withoutError))).toBeNull();
  });
});

describe("shortStashRef", () => {
  it("strips the whole-ref prefix the engine names", () => {
    expect(shortStashRef("refs/stash@{0}")).toBe("stash@{0}");
    expect(shortStashRef("stash@{2}")).toBe("stash@{2}");
  });
});

describe("parseRemoteHeadLabels", () => {
  it("keeps only symref lines under refs/remotes", () => {
    const stdout = [
      `${"a".repeat(40)}\0refs/remotes/origin/HEAD\0refs/remotes/origin/main`,
      `${"a".repeat(40)}\0refs/remotes/origin/main\0`,
      `${"b".repeat(40)}\0refs/heads/main\0refs/heads/main`,
      "garbage",
      ""
    ].join("\n");
    expect(parseRemoteHeadLabels(stdout)).toEqual([{ hash: "a".repeat(40), name: "origin/HEAD" }]);
  });
});

describe("parseSignedTagNames", () => {
  it("keeps only signature-carrying lines under refs/tags", () => {
    const stdout = [
      `refs/tags/faketag\0${"1"}`,
      `refs/tags/v1.0.0\0${"0"}`,
      `refs/remotes/origin/main\0${"1"}`,
      "garbage",
      ""
    ].join("\n");
    expect(parseSignedTagNames(stdout)).toEqual(["faketag"]);
  });
});

describe("applySignedTagNames", () => {
  it("flips the badge on named tag labels and ignores the rest", () => {
    const nodes: GitCommitNode[] = [
      {
        hash: "a".repeat(40),
        parentHashes: [],
        author: "Ada",
        email: "ada@x.com",
        date: 1,
        message: "tip",
        refs: [
          { hash: "a".repeat(40), name: "main", type: "head" },
          { hash: "a".repeat(40), name: "faketag", type: "tag", signed: false },
          { hash: "a".repeat(40), name: "v1.0.0", type: "tag", signed: false }
        ]
      }
    ];
    applySignedTagNames(nodes, ["faketag", "missing"]);
    expect(nodes[0]?.refs.map((ref) => ref.signed)).toEqual([undefined, true, false]);
    const before = JSON.stringify(nodes);
    applySignedTagNames(nodes, []);
    expect(JSON.stringify(nodes)).toBe(before);
  });
});

describe("insertRemoteHeadLabels", () => {
  const node = (): GitCommitNode => ({
    hash: "a".repeat(40),
    parentHashes: [],
    author: "Ada",
    email: "ada@x.com",
    date: 1,
    message: "tip",
    refs: [
      { hash: "a".repeat(40), name: "main", type: "head" },
      { hash: "a".repeat(40), name: "origin/main", type: "remote" },
      { hash: "a".repeat(40), name: "v1.0.0", type: "tag", signed: false }
    ]
  });

  it("inserts in for-each-ref order among the remote labels", () => {
    const nodes = [node()];
    insertRemoteHeadLabels(nodes, [{ hash: "a".repeat(40), name: "origin/HEAD" }]);
    expect(nodes[0]?.refs.map((ref) => `${ref.type}:${ref.name}`)).toEqual([
      "head:main",
      "remote:origin/HEAD",
      "remote:origin/main",
      "tag:v1.0.0"
    ]);
  });

  it("inserts past off-page targets and duplicates", () => {
    const nodes = [node()];
    insertRemoteHeadLabels(nodes, [
      { hash: "f".repeat(40), name: "origin/HEAD" },
      { hash: "a".repeat(40), name: "origin/main" },
      { hash: "a".repeat(40), name: "origin/HEAD" }
    ]);
    expect(nodes[0]?.refs.map((ref) => `${ref.type}:${ref.name}`)).toEqual([
      "head:main",
      "remote:origin/HEAD",
      "remote:origin/main",
      "tag:v1.0.0"
    ]);
  });

  it("keeps hidden remotes hidden and ignores empty fills", () => {
    const nodes = [node()];
    insertRemoteHeadLabels(nodes, [{ hash: "a".repeat(40), name: "origin/HEAD" }], ["origin"]);
    expect(nodes[0]?.refs).toHaveLength(3);
    const before = JSON.stringify(nodes);
    insertRemoteHeadLabels(nodes, []);
    expect(JSON.stringify(nodes)).toBe(before);
  });
});

describe("mapEngineCommitData", () => {
  it("maps labels onto project refs and leaves the signature key absent", () => {
    const [node] = mapEngineCommitData(PAGE, true);
    expect(node).toEqual({
      hash: "a".repeat(40),
      parentHashes: ["b".repeat(40)],
      author: "Ada",
      email: "ada@x.com",
      date: 1790090408,
      message: "second",
      refs: [
        { hash: "a".repeat(40), name: "main", type: "head" },
        { hash: "a".repeat(40), name: "origin/main", type: "remote" },
        { hash: "a".repeat(40), name: "v1.0.0", type: "tag", signed: false }
      ]
    });
    expect("signature" in (node ?? {})).toBe(false);
  });

  it("sorts labels into for-each-ref order regardless of wire order", () => {
    const [node] = mapEngineCommitData(
      {
        ...PAGE,
        commits: [
          {
            ...COMMIT,
            heads: ["zebra", "alpha"],
            tags: [
              { name: "v1.0.0", annotated: false },
              { name: "a-tag", annotated: true }
            ],
            remotes: [
              { name: "origin/main", remote: "origin" },
              { name: "origin/HEAD", remote: "origin" }
            ]
          }
        ]
      },
      true
    );
    expect(node?.refs.map((ref) => `${ref.type}:${ref.name}`)).toEqual([
      "head:alpha",
      "head:zebra",
      "remote:origin/HEAD",
      "remote:origin/main",
      "tag:a-tag",
      "tag:v1.0.0"
    ]);
  });

  it("mirrors the CLI root wart: no parents parses to [\"\"]", () => {
    const [node] = mapEngineCommitData({ ...PAGE, commits: [{ ...COMMIT, parents: [] }] }, true);
    expect(node?.parentHashes).toEqual([""]);
  });

  it("shapes stash rows like the CLI injection: blank author, null signature, short ref", () => {
    const [, row] = mapEngineCommitData(PAGE, true);
    expect(row).toEqual({
      hash: "c".repeat(40),
      parentHashes: ["b".repeat(40)],
      author: "",
      email: "",
      date: 1790090500,
      message: "On main: wip",
      refs: [],
      signature: null,
      stash: { ref: "stash@{0}" }
    });
  });

  it("drops stash rows and strips in-place marks when the caller did not opt in", () => {
    const marked: EngineCommit = {
      ...COMMIT,
      parents: ["b".repeat(40), "d".repeat(40)],
      stash: { selector: "refs/stash@{1}", baseHash: "b".repeat(40), untrackedFilesHash: null }
    };
    const nodes = mapEngineCommitData({ ...PAGE, commits: [marked, STASH_ROW] }, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).not.toHaveProperty("stash");
    expect(nodes[0]).not.toHaveProperty("signature");
  });
});
