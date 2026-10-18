import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";
import { gitClientFactory } from "@/backend/gitClient";
import { commitDetails } from "@/backend/queries/commitDetails";
import type { GitCommitDetails, QueryResult } from "@/backend/types";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

type FakeUri = { path: string; query: string; toString: () => string };

vi.mock("vscode", () => {
  function parse(value: string): FakeUri {
    const separator = value.indexOf("?");
    const head = separator === -1 ? value : value.slice(0, separator);
    const query = separator === -1 ? "" : value.slice(separator + 1);
    return { path: head.slice(head.indexOf(":") + 1), query, toString: () => value };
  }

  return {
    Uri: { parse },
    EventEmitter: class {
      public event = vi.fn();
      public dispose = vi.fn();
    },
    workspace: {
      onDidCloseTextDocument: () => ({ dispose: () => undefined })
    }
  };
});

function expectCommitDetails(result: QueryResult<"commitDetails">): GitCommitDetails {
  expect(result.error).toBeNull();
  if (result.commitDetails === null) throw new Error("Expected commit details");
  return result.commitDetails;
}

function revParse(dir: string, rev: string): string {
  return cp.execFileSync("git", ["rev-parse", rev], { cwd: dir, encoding: "utf8" }).trim();
}

/**
 * The slice fixture: a clean `--no-ff` merge of a branch adding
 * `feature.txt` into a mainline that added `main-only.txt`.
 */
function makeMergeRepo(): { dir: string; mergeHash: string; firstParentHash: string } {
  const dir = makeRepo();
  git(["checkout", "-qb", "feature"], dir);
  fs.writeFileSync(path.join(dir, "feature.txt"), "feature\n");
  git(["add", "."], dir);
  git(["commit", "-m", "add feature"], dir);
  git(["checkout", "-q", "main"], dir);
  fs.writeFileSync(path.join(dir, "main-only.txt"), "main only\n");
  git(["add", "."], dir);
  git(["commit", "-m", "add main only"], dir);
  const firstParentHash = revParse(dir, "HEAD");
  git(["merge", "-q", "--no-ff", "feature", "-m", "merge feature"], dir);
  return { dir, mergeHash: revParse(dir, "HEAD"), firstParentHash };
}

describe("commitDetails for a merge commit on the CLI path", () => {
  it("lists only the changes against the first parent", async () => {
    const { dir, mergeHash } = makeMergeRepo();
    try {
      const details = expectCommitDetails(
        await commitDetails(simpleGit(dir), {
          commitHash: mergeHash,
          dateType: "Commit Date",
          repo: dir
        })
      );

      expect(details.parents).toHaveLength(2);
      expect(details.fileChanges).toEqual([
        {
          oldFilePath: "feature.txt",
          newFilePath: "feature.txt",
          type: "A",
          additions: 1,
          deletions: 0
        }
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("diffs the merge as <hash>^1 against <hash> without -m or --root", async () => {
    const { dir, mergeHash } = makeMergeRepo();
    const records: GitCommandRecord[] = [];
    try {
      expectCommitDetails(
        await commitDetails(simpleGit(dir), {
          commitHash: mergeHash,
          dateType: "Commit Date",
          repo: dir,
          recordGitCommand: (record) => records.push(record)
        })
      );

      const diffRecords = records.filter(
        (record) =>
          record.label === "commitDetails.nameStatus" || record.label === "commitDetails.numStat"
      );
      expect(diffRecords).toHaveLength(2);
      for (const record of diffRecords) {
        expect(record.args).not.toContain("-m");
        expect(record.args).not.toContain("--root");
        expect(record.args.slice(-2)).toEqual([`${mergeHash}^1`, mergeHash]);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("opens a non-empty diff for every listed file through the provider", async () => {
    const { DiffDocProvider, encodeDiffDocUri } = await import("@/diffDocProvider");
    const { dir, mergeHash } = makeMergeRepo();
    const provider = new DiffDocProvider(gitClientFactory(dir, "git").getInstance);
    try {
      const details = expectCommitDetails(
        await commitDetails(simpleGit(dir), {
          commitHash: mergeHash,
          dateType: "Commit Date",
          repo: dir
        })
      );

      expect(details.fileChanges.length).toBeGreaterThan(0);
      for (const change of details.fileChanges) {
        // The two sides `viewDiff` opens for a commit-details file: the
        // first parent (`<hash>^`) against the commit itself.
        const [oldText, newText] = await Promise.all([
          provider.provideTextDocumentContent(
            encodeDiffDocUri(dir, change.oldFilePath, `${mergeHash}^`) as never
          ),
          provider.provideTextDocumentContent(
            encodeDiffDocUri(dir, change.newFilePath, mergeHash) as never
          )
        ]);
        expect(oldText, `${change.newFilePath} old side`).not.toBe(newText);
      }
    } finally {
      provider.dispose();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the single-parent query for the merge's first parent", async () => {
    const { dir, firstParentHash } = makeMergeRepo();
    try {
      const details = expectCommitDetails(
        await commitDetails(simpleGit(dir), {
          commitHash: firstParentHash,
          dateType: "Commit Date",
          repo: dir
        })
      );

      expect(details.parents).toHaveLength(1);
      expect(details.fileChanges).toEqual([
        {
          oldFilePath: "main-only.txt",
          newFilePath: "main-only.txt",
          type: "A",
          additions: 1,
          deletions: 0
        }
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
