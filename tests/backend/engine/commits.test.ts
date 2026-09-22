import { describe, expect, it } from "vitest";

import {
  buildLoadCommitsOptions,
  engineLoadCommitsRefs,
  shouldServeLoadCommitsFromEngine,
  type EngineLoadCommitsInput
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
});
