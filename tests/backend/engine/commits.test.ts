import { describe, expect, it } from "vitest";

import {
  buildLoadCommitsOptions,
  type EngineCommit,
  type EngineCommitData,
  type EngineLoadCommitsInput,
  engineLoadCommitsRefs,
  loadCommitsDecline,
  mapEngineCommitData,
  parseEngineCommitData,
  shortStashRef
} from "@/backend/engine/commits";

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
    expect(engineLoadCommitsRefs({ ...BASE, branches: ["main"], tags: ["v1.0.0"] })).toEqual([
      "main",
      "refs/tags/v1.0.0"
    ]);
  });
});

describe("loadCommitsDecline", () => {
  it("serves a plain show-all load", () => {
    expect(loadCommitsDecline(BASE)).toBeNull();
  });

  it("serves Author Date, which the engine answers through `useAuthorDate`", () => {
    expect(loadCommitsDecline({ ...BASE, dateType: "Author Date" })).toBeNull();
  });

  it("declines topo ordering, whose tie-breaks differ visibly from git", () => {
    expect(loadCommitsDecline({ ...BASE, commitOrdering: "topo" })).toBe("topoOrdering");
    expect(loadCommitsDecline({ ...BASE, commitOrdering: "date" })).toBeNull();
    expect(loadCommitsDecline({ ...BASE, commitOrdering: "author-date" })).toBeNull();
  });

  it("declines reflog and unreachable discovery on show-all loads only", () => {
    expect(loadCommitsDecline({ ...BASE, includeReflog: true })).toBe("reflog");
    expect(loadCommitsDecline({ ...BASE, includeUnreachableCommits: true })).toBe(
      "unreachableCommits"
    );
    // With explicit refs the CLI ignores both flags, so the engine serves.
    const filtered = { ...BASE, branches: ["main"] };
    expect(
      loadCommitsDecline({
        ...filtered,
        includeReflog: true,
        includeUnreachableCommits: true
      })
    ).toBeNull();
  });

  it("declines `--glob=` patterns the engine cannot expand", () => {
    expect(loadCommitsDecline({ ...BASE, branches: ["--glob=feature/*"] })).toBe("globPattern");
    expect(loadCommitsDecline({ ...BASE, branches: ["main"] })).toBeNull();
  });

  it("names the first decline that holds when several apply", () => {
    // The order is the predicate's: the reason shown is the first that holds.
    expect(loadCommitsDecline({ ...BASE, commitOrdering: "topo", includeReflog: true })).toBe(
      "topoOrdering"
    );
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
      useMailmap: false,
      useAuthorDate: false
    });
  });

  it("asks for the author date exactly when the view shows Author Date", () => {
    // The CLI formats `%at` for Author Date and `%ct` otherwise.
    expect(
      JSON.parse(buildLoadCommitsOptions({ ...BASE, dateType: "Author Date" })).useAuthorDate
    ).toBe(true);
    expect(
      JSON.parse(buildLoadCommitsOptions({ ...BASE, dateType: "Commit Date" })).useAuthorDate
    ).toBe(false);
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
  tags: [{ name: "v1.0.0", annotated: false, signed: false }],
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
              { name: "v1.0.0", annotated: false, signed: false },
              { name: "a-tag", annotated: true, signed: false }
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

  it('mirrors the CLI root wart: no parents parses to [""]', () => {
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
