import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { resetFileToRevision } from "@/backend/actions/file";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string> = async () => ""): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("file actions", () => {
  it("checks out one file from a selected revision", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw();

    await resetFileToRevision(
      git,
      {
        repo: "/repo",
        commitHash: "abc123",
        filePath: "src/example.ts"
      },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenCalledWith(["checkout", "abc123", "--", "src/example.ts"]);
    expect(records[0]).toMatchObject({
      label: "file.resetToRevision",
      kind: "action",
      repo: "/repo",
      args: ["checkout", "abc123", "--", "src/example.ts"],
      success: true
    });
  });

  it("rejects paths outside the repository before running git", async () => {
    const git = gitWithRaw();

    await expect(
      resetFileToRevision(git, {
        repo: "/repo",
        commitHash: "abc123",
        filePath: "../outside.ts"
      })
    ).rejects.toThrow("inside the repository");
    expect(git.raw).not.toHaveBeenCalled();
  });
});
