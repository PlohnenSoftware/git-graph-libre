import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { revertCommit } from "@/backend/actions/commit";

let repo: string;
let rootHash: string;
let commitHash: string;

beforeAll(() => {
  repo = makeRepo();
  rootHash = cp
    .execFileSync("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: repo })
    .toString()
    .trim();
  fs.writeFileSync(path.join(repo, "g"), "revert-me");
  git(["add", "."], repo);
  git(["commit", "-m", "second commit"], repo);
  commitHash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("revertCommit", () => {
  it("reverts a commit", async () => {
    await revertCommit(simpleGit(repo), { commitHash, parentIndex: 0 });
    expect(fs.existsSync(path.join(repo, "g"))).toBe(false);
  });

  it("reverts a root commit with parentIndex 0 (no mainline flag)", async () => {
    await revertCommit(simpleGit(repo), { commitHash: rootHash, parentIndex: 0 });
    expect(fs.existsSync(path.join(repo, "f"))).toBe(false);
  });

  it("throws for a nonexistent commit hash", async () => {
    await expect(
      revertCommit(simpleGit(repo), {
        commitHash: "0000000000000000000000000000000000000000",
        parentIndex: 0
      })
    ).rejects.toThrow();
  });
});
