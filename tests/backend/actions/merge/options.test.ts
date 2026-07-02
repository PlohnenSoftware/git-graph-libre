import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { mergeBranch, mergeCommit } from "@/backend/actions/merge";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string>): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("merge options", () => {
  it("uses squash instead of no-ff when both options are enabled", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async () => "");

    await mergeCommit(
      git,
      {
        repo: "/repo",
        commitHash: "abc123",
        createNewCommit: true,
        squash: true,
        noCommit: true,
        noVerify: true
      },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenCalledWith([
      "merge",
      "abc123",
      "--squash",
      "--no-commit",
      "--no-verify"
    ]);
    expect(records[0]).toMatchObject({
      label: "merge.commit",
      kind: "action",
      repo: "/repo",
      args: ["merge", "abc123", "--squash", "--no-commit", "--no-verify"],
      success: true
    });
  });

  it("keeps branch merge no-ff when squash is disabled", async () => {
    const git = gitWithRaw(async () => "");

    await mergeBranch(git, {
      branchName: "feature",
      createNewCommit: true,
      squash: false,
      noCommit: false,
      noVerify: false
    });

    expect(git.raw).toHaveBeenCalledWith(["merge", "feature", "--no-ff"]);
  });
});
