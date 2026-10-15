import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cherrypickCommit } from "@/backend/actions/commit";

let repo: string;
let rootHash: string;
let cherrypickHash: string;

beforeAll(() => {
  repo = makeRepo();
  rootHash = cp
    .execFileSync("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: repo })
    .toString()
    .trim();
  git(["checkout", "-b", "side"], repo);
  fs.writeFileSync(path.join(repo, "g"), "cherry");
  git(["add", "."], repo);
  git(["commit", "-m", "cherry commit"], repo);
  cherrypickHash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
  git(["checkout", "main"], repo);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("cherrypickCommit", () => {
  it("cherry-picks a commit onto the current branch", async () => {
    await cherrypickCommit(simpleGit(repo), {
      commitHash: cherrypickHash,
      parentIndex: 0,
      noCommit: false
    });
    expect(fs.existsSync(path.join(repo, "g"))).toBe(true);
  });

  it("cherry-picks a root commit with parentIndex 0 (no mainline flag)", async () => {
    git(["checkout", "--orphan", "orphan-base"], repo);
    git(["rm", "-rqf", "."], repo);
    fs.writeFileSync(path.join(repo, "h"), "orphan");
    git(["add", "."], repo);
    git(["commit", "-m", "orphan base"], repo);
    await cherrypickCommit(simpleGit(repo), {
      commitHash: rootHash,
      parentIndex: 0,
      noCommit: false
    });
    expect(fs.existsSync(path.join(repo, "f"))).toBe(true);
  });

  it("throws for a nonexistent commit hash", async () => {
    await expect(
      cherrypickCommit(simpleGit(repo), {
        commitHash: "0000000000000000000000000000000000000000",
        parentIndex: 0,
        noCommit: false
      })
    ).rejects.toThrow();
  });

  it("stages the cherry-pick without creating a commit when noCommit is set", async () => {
    const head = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
    git(["checkout", "-b", "nocommit-source"], repo);
    fs.writeFileSync(path.join(repo, "nocommit-file"), "n");
    git(["add", "nocommit-file"], repo);
    git(["commit", "-m", "nocommit source"], repo);
    const source = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
    git(["checkout", head], repo);
    await cherrypickCommit(simpleGit(repo), {
      commitHash: source,
      parentIndex: 0,
      noCommit: true
    });
    expect(cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim()).toBe(
      head
    );
    expect(fs.readFileSync(path.join(repo, "nocommit-file"), "utf8")).toBe("n");
    expect(
      cp.execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: repo }).toString()
    ).toContain("nocommit-file");
    git(["reset", "--hard", "HEAD"], repo);
  });
});
