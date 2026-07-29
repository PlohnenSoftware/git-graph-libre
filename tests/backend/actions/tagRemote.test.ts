import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { deleteRemoteTag } from "@/backend/actions/tagRemote";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string>): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("deleteRemoteTag", () => {
  it("deletes the tag on the remote using its full ref", async () => {
    const git = gitWithRaw(async () => "");

    await deleteRemoteTag(git, { repo: "/repo", remote: "origin", tagName: "v1.2.3" });

    expect(git.raw).toHaveBeenCalledWith(["push", "origin", "--delete", "refs/tags/v1.2.3"]);
  });

  it("treats an already-absent remote tag as success", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async () => {
      throw new Error("error: unable to delete 'v9'; remote ref does not exist");
    });

    await expect(
      deleteRemoteTag(git, { repo: "/repo", remote: "origin", tagName: "v9" }, (record) =>
        records.push(record)
      )
    ).resolves.toBeUndefined();

    expect(git.raw).toHaveBeenCalledTimes(1);
    expect(records.map((record) => record.success)).toEqual([false]);
  });

  it("propagates other push failures", async () => {
    const git = gitWithRaw(async () => {
      throw new Error("fatal: Authentication failed");
    });

    await expect(
      deleteRemoteTag(git, { repo: "/repo", remote: "origin", tagName: "v1" })
    ).rejects.toThrow(/Authentication failed/);
  });

  it("disambiguates a tag whose name collides with a branch", async () => {
    const git = gitWithRaw(async () => "");

    await deleteRemoteTag(git, { repo: "/repo", remote: "origin", tagName: "main" });

    // Without the refs/tags/ prefix this would delete the remote branch instead.
    expect(git.raw).toHaveBeenCalledWith(["push", "origin", "--delete", "refs/tags/main"]);
  });
});
