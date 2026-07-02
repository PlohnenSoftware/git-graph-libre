import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { dropCommit, editHeadCommitMessage, undoLastCommit } from "@/backend/actions/commit";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string>): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("advanced commit actions", () => {
  it("drops a commit by rebasing around it", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async () => "");

    await dropCommit(
      git,
      {
        repo: "/repo",
        commitHash: "abc123"
      },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenCalledWith(["rebase", "--onto", "abc123^", "abc123"]);
    expect(records[0]).toMatchObject({
      label: "commit.drop",
      kind: "action",
      repo: "/repo",
      args: ["rebase", "--onto", "abc123^", "abc123"],
      success: true
    });
  });

  it("undoes the last commit with a soft reset", async () => {
    const git = gitWithRaw(async () => "");

    await undoLastCommit(git, { repo: "/repo" });

    expect(git.raw).toHaveBeenCalledWith(["reset", "--soft", "HEAD^"]);
  });

  it("edits the HEAD commit message with amend", async () => {
    const git = gitWithRaw(async (args) => {
      if (args[0] === "rev-parse") return "abc123\n";
      if (args[0] === "log") return "old message\n";
      return "";
    });

    await editHeadCommitMessage(git, {
      repo: "/repo",
      commitHash: "abc123",
      message: "new message\n\nbody"
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, ["rev-parse", "HEAD"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["log", "-1", "--format=%B", "HEAD"]);
    expect(git.raw).toHaveBeenNthCalledWith(3, ["commit", "--amend", "-m", "new message\n\nbody"]);
  });

  it("rejects non-HEAD commit message edits", async () => {
    const git = gitWithRaw(async () => "different\n");

    await expect(
      editHeadCommitMessage(git, {
        commitHash: "abc123",
        message: "new message"
      })
    ).rejects.toThrow("only for HEAD");
  });

  it("does nothing when the edited message is unchanged", async () => {
    const git = gitWithRaw(async (args) => {
      if (args[0] === "rev-parse") return "abc123\n";
      return "same message\n";
    });

    await editHeadCommitMessage(git, {
      commitHash: "abc123",
      message: "same message"
    });

    expect(git.raw).toHaveBeenCalledTimes(2);
  });
});
