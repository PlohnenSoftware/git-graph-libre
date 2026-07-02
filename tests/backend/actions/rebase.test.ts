import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { rebaseCurrentBranch } from "@/backend/actions/rebase";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string>): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("rebaseCurrentBranch", () => {
  it("rebases onto a commit with ignore-date", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async () => "");

    await rebaseCurrentBranch(
      git,
      {
        repo: "/repo",
        target: "abc123",
        targetType: "commit",
        ignoreDate: true,
        interactive: false
      },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenCalledWith(["rebase", "--ignore-date", "abc123"]);
    expect(records[0]).toMatchObject({
      label: "rebase.commit",
      kind: "action",
      repo: "/repo",
      args: ["rebase", "--ignore-date", "abc123"],
      success: true
    });
  });

  it("rebases onto a branch without ignore-date", async () => {
    const git = gitWithRaw(async () => "");

    await rebaseCurrentBranch(git, {
      target: "feature",
      targetType: "branch",
      ignoreDate: false,
      interactive: false
    });

    expect(git.raw).toHaveBeenCalledWith(["rebase", "feature"]);
  });

  it("rejects empty rebase targets", async () => {
    const git = gitWithRaw(async () => "");

    await expect(
      rebaseCurrentBranch(git, {
        target: "",
        targetType: "branch",
        ignoreDate: false,
        interactive: false
      })
    ).rejects.toThrow("Rebase target is required");
  });
});
