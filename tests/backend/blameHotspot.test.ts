import { describe, expect, it } from "vitest";
import type { GitBlameCommit, GitBlameHunk } from "@/backend/types";
import { BLAME_HEAT_BUCKETS, type BlameHeatLevel, scoreBlameHunks } from "@/blameHotspot";

const DAY = 86_400;
const NOW = 1_800_000_000;

/** A committed or uncommitted blame commit with the fields the model reads. */
function commit(hash: string, authorTime: number, uncommitted = false): GitBlameCommit {
  return {
    hash,
    author: "Author",
    authorMail: "author@example.test",
    authorTime,
    authorTz: "+0000",
    committer: "Author",
    committerMail: "author@example.test",
    committerTime: authorTime,
    committerTz: "+0000",
    summary: `Change ${hash}`,
    boundary: false,
    uncommitted,
    previous: null,
    filename: "file.ts"
  };
}

/** A hunk of `lineCount` lines owned by `commitHash`, starting at `startLine`. */
function hunk(commitHash: string, startLine: number, lineCount = 1): GitBlameHunk {
  return {
    commitHash,
    startLine,
    lineCount,
    origStartLine: startLine,
    filename: "file.ts",
    previous: null,
    lines: []
  };
}

/** Builds the commit map keyed by hash, as the blame query returns it. */
function commitMap(...commits: GitBlameCommit[]): Record<string, GitBlameCommit> {
  return Object.fromEntries(commits.map((entry) => [entry.hash, entry]));
}

/** Freezes a value and everything under it, so a mutation would throw in strict mode. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function levelsOf(
  hunks: GitBlameHunk[],
  commits: Record<string, GitBlameCommit>,
  mode: "age" | "calendar" | "churn" | "off",
  nowSeconds = NOW
) {
  return scoreBlameHunks(hunks, commits, mode, nowSeconds).map((heat) => heat.level);
}

describe("BLAME_HEAT_BUCKETS", () => {
  it("has ten steps, 0 through 9", () => {
    expect(BLAME_HEAT_BUCKETS).toBe(10);
  });
});

describe("scoreBlameHunks: empty and single commit (age)", () => {
  it("returns an empty result for no hunks", () => {
    expect(scoreBlameHunks([], {}, "age", NOW)).toEqual([]);
  });

  it("gives a single-commit file the neutral level 5, never NaN", () => {
    const commits = commitMap(commit("a".repeat(40), NOW - DAY));
    const hunks = [hunk("a".repeat(40), 1, 3), hunk("a".repeat(40), 10, 2)];
    const levels = levelsOf(hunks, commits, "age");
    expect(levels).toEqual([5, 5]);
    for (const level of levels) expect(Number.isNaN(level)).toBe(false);
  });
});

describe("scoreBlameHunks: two commits and skewed timestamps (age)", () => {
  it("gives the older commit 0 and the newer commit 9", () => {
    const older = "1".repeat(40);
    const newer = "2".repeat(40);
    const commits = commitMap(commit(older, NOW - 30 * DAY), commit(newer, NOW - DAY));
    expect(levelsOf([hunk(older, 1), hunk(newer, 2)], commits, "age")).toEqual([0, 9]);
  });

  it("spreads skewed timestamps evenly across 0..9 by rank", () => {
    // One ten-year-old license header, then nine commits within the past week.
    const hashes = Array.from({ length: 10 }, (_, index) => (index + 1).toString(16).repeat(40));
    const commits = commitMap(
      commit(hashes[0], NOW - 10 * 365 * DAY),
      ...hashes.slice(1).map((hash, index) => commit(hash, NOW - (hashes.length - 1 - index) * 3600))
    );
    const hunks = hashes.map((hash, index) => hunk(hash, index + 1));
    const levels = levelsOf(hunks, commits, "age");
    expect(levels).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("gives equal timestamps equal levels", () => {
    const first = "a".repeat(40);
    const second = "b".repeat(40);
    const third = "c".repeat(40);
    const commits = commitMap(
      commit(first, NOW - 100 * DAY),
      commit(second, NOW - 100 * DAY),
      commit(third, NOW - DAY)
    );
    const levels = levelsOf([hunk(first, 1), hunk(second, 2), hunk(third, 3)], commits, "age");
    expect(levels[0]).toBe(levels[1]);
    expect(levels).toEqual([0, 0, 9]);
  });

  it("excludes uncommitted hunks from the rank pool", () => {
    const older = "1".repeat(40);
    const newer = "2".repeat(40);
    const working = "0".repeat(40);
    // The working-tree time sits between the two committed times; it must not
    // push the committed pair apart or take a rank of its own.
    const commits = commitMap(
      commit(older, NOW - 30 * DAY),
      commit(newer, NOW - DAY),
      commit(working, NOW - 10 * DAY, true)
    );
    const heat = scoreBlameHunks(
      [hunk(older, 1), hunk(working, 2), hunk(newer, 3)],
      commits,
      "age",
      NOW
    );
    expect(heat.map((entry) => entry.level)).toEqual([0, null, 9]);
    expect(heat[1]).toEqual({
      level: null,
      uncommitted: true,
      commitHunkCount: 1,
      commitLineCount: 1
    });
  });

  it("treats a hunk whose commit is missing from the map as uncommitted", () => {
    const known = "1".repeat(40);
    const commits = commitMap(commit(known, NOW - DAY));
    const heat = scoreBlameHunks([hunk(known, 1), hunk("9".repeat(40), 2)], commits, "age", NOW);
    expect(heat[1]?.uncommitted).toBe(true);
    expect(heat[1]?.level).toBeNull();
  });
});

describe("scoreBlameHunks: calendar", () => {
  const hash = "c".repeat(40);

  /** The level of a single hunk whose commit is `age` seconds old. */
  function levelAtAge(age: number): BlameHeatLevel | null {
    const ageCommits = commitMap(commit(hash, NOW - age));
    return scoreBlameHunks([hunk(hash, 1)], ageCommits, "calendar", NOW)[0]?.level ?? null;
  }

  it("checks every boundary against the fixed thresholds", () => {
    const boundaries: [number, BlameHeatLevel][] = [
      [0, 9],
      [1 * DAY, 9],
      [1 * DAY + 1, 8],
      [2 * DAY, 8],
      [2 * DAY + 1, 7],
      [7 * DAY, 7],
      [14 * DAY, 6],
      [30 * DAY, 5],
      [90 * DAY, 4],
      [180 * DAY, 3],
      [365 * DAY, 2],
      [730 * DAY, 1],
      [730 * DAY + 1, 0]
    ];
    for (const [age, expected] of boundaries) {
      expect(levelAtAge(age), `age ${age}s`).toBe(expected);
    }
  });

  it("gives a timestamp after now (future) the hottest level 9", () => {
    const futureCommits = commitMap(commit(hash, NOW + 5 * DAY));
    expect(scoreBlameHunks([hunk(hash, 1)], futureCommits, "calendar", NOW)[0]?.level).toBe(9);
  });

  it("leaves uncommitted hunks null", () => {
    const working = "0".repeat(40);
    const mixed = commitMap(commit(hash, NOW - DAY), commit(working, NOW, true));
    const heat = scoreBlameHunks([hunk(working, 1), hunk(hash, 2)], mixed, "calendar", NOW);
    expect(heat[0]?.level).toBeNull();
    expect(heat[0]?.uncommitted).toBe(true);
    expect(heat[1]?.level).toBe(9);
  });

  it("is driven by the injected clock, not the wall clock", () => {
    const old = commitMap(commit(hash, NOW - 40 * DAY));
    expect(scoreBlameHunks([hunk(hash, 1)], old, "calendar", NOW)[0]?.level).toBe(4);
    expect(scoreBlameHunks([hunk(hash, 1)], old, "calendar", NOW + 800 * DAY)[0]?.level).toBe(0);
  });
});

describe("scoreBlameHunks: churn", () => {
  const oldest = "a".repeat(40);
  const middle = "b".repeat(40);
  const newest = "c".repeat(40);
  const commits = commitMap(
    commit(oldest, NOW - 300 * DAY),
    commit(middle, NOW - 100 * DAY),
    commit(newest, NOW - DAY)
  );

  it("scores by recency times hunk count, scaled so the largest is 9", () => {
    // Ranks 0, 1, 2 give fractions 1/3, 2/3, 1. Hunk counts 1, 2, 3 give raw
    // scores 1/3, 4/3 and 3; scaled by the largest (3) they are 1, 4 and 9.
    const hunks = [
      hunk(oldest, 1),
      hunk(middle, 2),
      hunk(middle, 5),
      hunk(newest, 8),
      hunk(newest, 10),
      hunk(newest, 12)
    ];
    const heat = scoreBlameHunks(hunks, commits, "churn", NOW);
    expect(heat.map((entry) => entry.level)).toEqual([1, 4, 4, 9, 9, 9]);
    expect(heat[3]?.commitHunkCount).toBe(3);
    expect(heat[1]?.commitHunkCount).toBe(2);
  });

  it("is deterministic and monotonic in recency for equal hunk counts", () => {
    const hunks = [hunk(oldest, 1), hunk(middle, 2), hunk(newest, 3)];
    const first = levelsOf(hunks, commits, "churn");
    expect(levelsOf(hunks, commits, "churn")).toEqual(first);
    expect(first[0]).toBeLessThanOrEqual(first[1] ?? -1);
    expect(first[1]).toBeLessThanOrEqual(first[2] ?? -1);
  });

  it("leaves uncommitted hunks null and out of the scale", () => {
    const working = "0".repeat(40);
    const withWorking = commitMap(
      commit(oldest, NOW - 300 * DAY),
      commit(newest, NOW - DAY),
      commit(working, NOW, true)
    );
    const hunks = [hunk(oldest, 1), hunk(newest, 2), hunk(working, 3), hunk(working, 4)];
    const heat = scoreBlameHunks(hunks, withWorking, "churn", NOW);
    // Oldest: 0.5 of the scale, 4.5 rounds to 5; newest is the largest, 9.
    expect(heat.map((entry) => entry.level)).toEqual([5, 9, null, null]);
    expect(heat[2]?.commitHunkCount).toBe(2);
  });
});

describe("scoreBlameHunks: off", () => {
  it("returns null levels but still fills the uncommitted flag and footprint", () => {
    const first = "a".repeat(40);
    const working = "0".repeat(40);
    const commits = commitMap(commit(first, NOW - DAY), commit(working, NOW, true));
    const hunks = [hunk(first, 1, 4), hunk(first, 9, 2), hunk(working, 5, 3)];
    expect(scoreBlameHunks(hunks, commits, "off", NOW)).toEqual([
      { level: null, uncommitted: false, commitHunkCount: 2, commitLineCount: 6 },
      { level: null, uncommitted: false, commitHunkCount: 2, commitLineCount: 6 },
      { level: null, uncommitted: true, commitHunkCount: 1, commitLineCount: 3 }
    ]);
  });
});

describe("scoreBlameHunks: immutability", () => {
  it("never mutates its hunks or commits in any mode", () => {
    const first = "a".repeat(40);
    const second = "b".repeat(40);
    const working = "0".repeat(40);
    const hunks = deepFreeze([hunk(first, 1, 2), hunk(second, 3), hunk(working, 5)]);
    const commits = deepFreeze(
      commitMap(
        commit(first, NOW - 90 * DAY),
        commit(second, NOW - DAY),
        commit(working, NOW, true)
      )
    );
    const before = structuredClone({ hunks, commits });

    for (const mode of ["age", "calendar", "churn", "off"] as const) {
      expect(() => scoreBlameHunks(hunks, commits, mode, NOW)).not.toThrow();
    }
    expect({ hunks, commits }).toEqual(before);
  });
});
