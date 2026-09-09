import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCommits } from "@/backend/queries/loadCommits";

let repo: string;
let baseHead: string;

function rev(selector: string): string {
  return cp.execFileSync("git", ["rev-parse", selector], { cwd: repo }).toString().trim();
}

function loadOptions(extra: { maxCommits?: number; showStashes?: boolean } = {}) {
  return {
    branchName: "",
    maxCommits: 300,
    showRemoteBranches: false,
    showSignature: false,
    showUncommittedChanges: false,
    hard: true,
    dateType: "Author Date",
    ...extra
  } as Parameters<typeof loadCommits>[1];
}

beforeAll(() => {
  repo = makeRepo();
  fs.writeFileSync(path.join(repo, "f2"), "y");
  git(["add", "."], repo);
  git(["commit", "-m", "second"], repo);
  baseHead = rev("HEAD");

  // A stash taken with --include-untracked has three parents (base, index,
  // untracked); the row must link the base only.
  fs.writeFileSync(path.join(repo, "f2"), "changed");
  fs.writeFileSync(path.join(repo, "untracked"), "new");
  git(["stash", "push", "-u", "-m", "checkpoint"], repo);

  // A newer commit on top, so paging the base off the page is testable.
  fs.writeFileSync(path.join(repo, "f2"), "third");
  git(["add", "."], repo);
  git(["commit", "-m", "third"], repo);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("loadCommits stash rows", () => {
  it("injects one row per stash directly above its base commit", async () => {
    const result = await loadCommits(simpleGit(repo), loadOptions({ showStashes: true }));

    expect(result.error).toBeNull();
    const stashHash = rev("stash@{0}");
    const baseIndex = result.commits.findIndex((commit) => commit.hash === baseHead);
    expect(baseIndex).toBeGreaterThan(0);
    const row = result.commits[baseIndex - 1];
    expect(row.hash).toBe(stashHash);
    // Only the base is linked: the index and untracked commits behind the
    // stash must not surface as ordinary rows or phantom lines.
    expect(row.parentHashes).toEqual([baseHead]);
    expect(row.stash).toEqual({ ref: "stash@{0}" });
    expect(row.message).toContain("checkpoint");
    expect(row.signature).toBeNull();
    expect(
      result.commits.some((commit) => /index on|untracked files on/.test(commit.message))
    ).toBe(false);
  });

  it("adds no rows without the showStashes opt-in", async () => {
    const result = await loadCommits(simpleGit(repo), loadOptions());

    expect(result.error).toBeNull();
    expect(result.commits.every((commit) => commit.stash === undefined)).toBe(true);
  });

  it("skips stashes whose base commit is not on the page", async () => {
    const result = await loadCommits(
      simpleGit(repo),
      loadOptions({ showStashes: true, maxCommits: 1 })
    );

    expect(result.error).toBeNull();
    expect(result.commits).toHaveLength(1);
    expect(result.commits.every((commit) => commit.stash === undefined)).toBe(true);
  });

  it("re-resolves selectors after a stash is dropped", async () => {
    fs.writeFileSync(path.join(repo, "f2"), "again");
    git(["stash", "push", "-m", "newer"], repo);

    const before = await loadCommits(simpleGit(repo), loadOptions({ showStashes: true }));
    const olderHash = rev("stash@{1}");
    expect(before.commits.find((commit) => commit.hash === olderHash)?.stash).toEqual({
      ref: "stash@{1}"
    });

    git(["stash", "drop", "stash@{0}"], repo);
    const after = await loadCommits(simpleGit(repo), loadOptions({ showStashes: true }));
    // The surviving stash keeps its hash but moves to the fresh selector;
    // rows never carry a cached selector across refreshes.
    expect(after.commits.find((commit) => commit.hash === olderHash)?.stash).toEqual({
      ref: "stash@{0}"
    });
    expect(after.commits.filter((commit) => commit.stash !== undefined)).toHaveLength(1);
  });
});
