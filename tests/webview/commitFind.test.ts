import { describe, expect, it } from "vitest";

import type { GitCommitNode } from "@/backend/types";
import { findCommitIndexes, formatFindMatchCount } from "@/webview/commitFind";

const commits: GitCommitNode[] = [
  {
    hash: "abc123",
    parentHashes: ["def456"],
    author: "Alice",
    email: "alice@example.com",
    date: 1700000000,
    message: "Add feature",
    refs: [
      { hash: "abc123", name: "main", type: "head" },
      { hash: "abc123", name: "v1.0.0", type: "tag" }
    ]
  },
  {
    hash: "def456",
    parentHashes: [],
    author: "Bob",
    email: "bob@example.com",
    date: 1699000000,
    message: "Initial commit",
    refs: [{ hash: "def456", name: "origin/main", type: "remote" }]
  },
  {
    hash: "*",
    parentHashes: [],
    author: "",
    email: "",
    date: 1701000000,
    message: "Uncommitted changes (2)",
    refs: []
  }
];

describe("commit find matching", () => {
  it("matches loaded commits by visible commit fields", () => {
    expect(findCommitIndexes(commits, "feature", 4)).toEqual([0]);
    expect(findCommitIndexes(commits, "alice", 4)).toEqual([0]);
    expect(findCommitIndexes(commits, "example.com", 4)).toEqual([0, 1]);
    expect(findCommitIndexes(commits, "abc123", 4)).toEqual([0]);
    expect(findCommitIndexes(commits, "abc1", 4)).toEqual([0]);
    expect(findCommitIndexes(commits, "v1.0.0", 4)).toEqual([0]);
    expect(findCommitIndexes(commits, "origin/main", 4)).toEqual([1]);
  });

  it("trims and case-folds queries without mutating commits", () => {
    const before = JSON.stringify(commits);

    expect(findCommitIndexes(commits, "  INITIAL  ", 4)).toEqual([1]);
    expect(findCommitIndexes(commits, "", 4)).toEqual([]);
    expect(findCommitIndexes(commits, "uncommitted", 4)).toEqual([]);
    expect(JSON.stringify(commits)).toBe(before);
  });

  it("formats localized match counts", () => {
    expect(formatFindMatchCount("{0} of {1}", 1, 3)).toBe("2 of 3");
    expect(formatFindMatchCount("{0} z {1}", 0, 2)).toBe("1 z 2");
  });
});
