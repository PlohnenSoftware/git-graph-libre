import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";
import { commitComparison } from "@/backend/queries/commitComparison";

const repos: string[] = [];

function trackedRepo() {
  const repo = makeRepo();
  repos.push(repo);
  return repo;
}

function head(repo: string) {
  return cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
}

afterEach(() => {
  while (repos.length > 0) {
    const repo = repos.pop();
    if (repo !== undefined) fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe("commitComparison", () => {
  it("returns file changes between a loaded commit and HEAD", async () => {
    const repo = trackedRepo();
    const baseHash = head(repo);
    fs.writeFileSync(path.join(repo, "f"), "x\nchanged\n");
    fs.writeFileSync(path.join(repo, "added.txt"), "new\n");
    git(["add", "."], repo);
    git(["commit", "-m", "change files"], repo);

    const result = await commitComparison(simpleGit(repo), {
      repo,
      commitHash: baseHash,
      baseRef: baseHash,
      compareRef: "HEAD",
      dateType: "Author Date"
    });

    expect(result.error).toBeNull();
    expect(result.commitDetails?.hash).toBe(baseHash);
    expect(result.commitDetails?.fileChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          newFilePath: "f",
          type: "M",
          additions: expect.any(Number),
          deletions: expect.any(Number)
        }),
        expect.objectContaining({
          newFilePath: "added.txt",
          type: "A",
          additions: expect.any(Number),
          deletions: expect.any(Number)
        })
      ])
    );
  });

  it("keeps old and new paths for renamed files in comparisons", async () => {
    const repo = trackedRepo();
    const baseHash = head(repo);
    git(["mv", "f", "renamed.txt"], repo);
    git(["commit", "-m", "rename file"], repo);

    const result = await commitComparison(simpleGit(repo), {
      repo,
      commitHash: baseHash,
      baseRef: baseHash,
      compareRef: "HEAD",
      dateType: "Author Date"
    });

    expect(result.error).toBeNull();
    expect(result.commitDetails?.fileChanges).toContainEqual(
      expect.objectContaining({
        oldFilePath: "f",
        newFilePath: "renamed.txt",
        type: "R",
        additions: expect.any(Number),
        deletions: expect.any(Number)
      })
    );
  });

  // A base commit holding two tracked files, then worktree edits on top:
  // one modified, one deleted, plus an untracked file Git never lists.
  function worktreeRepo() {
    const repo = trackedRepo();
    fs.writeFileSync(path.join(repo, "kept.txt"), "one\ntwo\n");
    fs.writeFileSync(path.join(repo, "gone.txt"), "gone\n");
    git(["add", "."], repo);
    git(["commit", "-m", "add tracked files"], repo);
    const baseHash = head(repo);
    fs.writeFileSync(path.join(repo, "kept.txt"), "one\ntwo\nthree\n");
    fs.rmSync(path.join(repo, "gone.txt"));
    fs.writeFileSync(path.join(repo, "untracked.txt"), "untracked\n");
    return { repo, baseHash };
  }

  it("compares a commit with the working tree, without listing untracked files", async () => {
    const { repo, baseHash } = worktreeRepo();

    const result = await commitComparison(simpleGit(repo), {
      repo,
      commitHash: baseHash,
      baseRef: baseHash,
      compareRef: "*",
      dateType: "Author Date"
    });

    // Exactly `git diff --name-status --numstat <base>`: the modification
    // and the deletion with their counts, never the untracked file.
    expect(result.error).toBeNull();
    expect(result.commitDetails?.hash).toBe(baseHash);
    expect(result.commitDetails?.fileChanges).toHaveLength(2);
    expect(result.commitDetails?.fileChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          newFilePath: "kept.txt",
          type: "M",
          additions: 1,
          deletions: 0
        }),
        expect.objectContaining({
          newFilePath: "gone.txt",
          type: "D",
          additions: 0,
          deletions: 1
        })
      ])
    );
    expect(
      result.commitDetails?.fileChanges.some((change) => change.newFilePath === "untracked.txt")
    ).toBe(false);
  });

  it("reverses a working-tree comparison when the working tree is the base", async () => {
    const { repo, baseHash } = worktreeRepo();

    const result = await commitComparison(simpleGit(repo), {
      repo,
      commitHash: baseHash,
      baseRef: "*",
      compareRef: baseHash,
      dateType: "Author Date"
    });

    expect(result.error).toBeNull();
    expect(result.commitDetails?.fileChanges).toHaveLength(2);
    expect(result.commitDetails?.fileChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          newFilePath: "kept.txt",
          type: "M",
          additions: 0,
          deletions: 1
        }),
        expect.objectContaining({
          newFilePath: "gone.txt",
          type: "A",
          additions: 1,
          deletions: 0
        })
      ])
    );
  });
});
