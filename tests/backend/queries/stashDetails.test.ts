import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { describe, expect, it } from "vitest";
import { commitDetails } from "@/backend/queries/commitDetails";
import type { GitCommitDetails, QueryResult } from "@/backend/types";

function expectCommitDetails(result: QueryResult<"commitDetails">): GitCommitDetails {
  expect(result.error).toBeNull();
  if (result.commitDetails === null) throw new Error("Expected commit details");
  return result.commitDetails;
}

function revParse(dir: string, rev: string): string {
  return cp.execFileSync("git", ["rev-parse", rev], { cwd: dir, encoding: "utf8" }).trim();
}

function makeTrackedRepo(): string {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, "feature.txt"), "feature\n");
  fs.writeFileSync(path.join(dir, "shared.txt"), "shared\n");
  git(["add", "."], dir);
  git(["commit", "-m", "base files"], dir);
  return dir;
}

async function stashDetails(dir: string): Promise<GitCommitDetails> {
  const hash = revParse(dir, "stash@{0}");
  return expectCommitDetails(
    await commitDetails(simpleGit(dir), { commitHash: hash, dateType: "Commit Date", repo: dir })
  );
}

describe("commitDetails for a stash on the CLI path", () => {
  it("lists a stash with untracked files like git stash show --include-untracked", async () => {
    const dir = makeTrackedRepo();
    try {
      fs.writeFileSync(path.join(dir, "shared.txt"), "shared\nstaged\n");
      git(["add", "shared.txt"], dir);
      fs.writeFileSync(path.join(dir, "feature.txt"), "feature\nunstaged\n");
      fs.writeFileSync(path.join(dir, "untracked.txt"), "untracked\n");
      git(["stash", "push", "-u", "-m", "wip"], dir);

      const details = await stashDetails(dir);

      expect(details.parents).toHaveLength(3);
      expect(details.fileChanges).toEqual([
        {
          oldFilePath: "feature.txt",
          newFilePath: "feature.txt",
          type: "M",
          additions: 1,
          deletions: 0
        },
        {
          oldFilePath: "shared.txt",
          newFilePath: "shared.txt",
          type: "M",
          additions: 1,
          deletions: 0
        },
        {
          oldFilePath: "untracked.txt",
          newFilePath: "untracked.txt",
          type: "A",
          additions: 1,
          deletions: 0,
          untracked: true
        }
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists a stash without -u without its untracked file", async () => {
    const dir = makeTrackedRepo();
    try {
      fs.writeFileSync(path.join(dir, "shared.txt"), "shared\nstaged\n");
      git(["add", "shared.txt"], dir);
      fs.writeFileSync(path.join(dir, "feature.txt"), "feature\nunstaged\n");
      fs.writeFileSync(path.join(dir, "untracked.txt"), "untracked\n");
      git(["stash", "push", "-m", "wip"], dir);

      const details = await stashDetails(dir);

      expect(details.parents).toHaveLength(2);
      expect(details.fileChanges).toEqual([
        {
          oldFilePath: "feature.txt",
          newFilePath: "feature.txt",
          type: "M",
          additions: 1,
          deletions: 0
        },
        {
          oldFilePath: "shared.txt",
          newFilePath: "shared.txt",
          type: "M",
          additions: 1,
          deletions: 0
        }
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists a stash holding only a staged change", async () => {
    const dir = makeTrackedRepo();
    try {
      fs.writeFileSync(path.join(dir, "shared.txt"), "shared\nstaged\n");
      git(["add", "shared.txt"], dir);
      git(["stash", "push", "-m", "wip"], dir);

      const details = await stashDetails(dir);

      expect(details.fileChanges).toEqual([
        {
          oldFilePath: "shared.txt",
          newFilePath: "shared.txt",
          type: "M",
          additions: 1,
          deletions: 0
        }
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
