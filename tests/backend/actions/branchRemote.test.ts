import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import {
  deleteRemoteBranch,
  fetchIntoLocalBranch,
  pullBranch,
  pushBranch,
  updateBranchFromUpstream
} from "@/backend/actions/branchRemote";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string>): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("branch remote actions", () => {
  it("pushes a branch to selected remotes with upstream and force-with-lease", async () => {
    const git = gitWithRaw(async () => "");

    await pushBranch(git, {
      repo: "/repo",
      branchName: "feature/menu",
      remotes: ["origin", "backup"],
      setUpstream: true,
      mode: "force-with-lease",
      noVerify: false
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, [
      "push",
      "--set-upstream",
      "--force-with-lease",
      "origin",
      "feature/menu"
    ]);
    expect(git.raw).toHaveBeenNthCalledWith(2, [
      "push",
      "--set-upstream",
      "--force-with-lease",
      "backup",
      "feature/menu"
    ]);
  });

  it("rejects pushing when no remote is selected", async () => {
    const git = gitWithRaw(async () => "");

    await expect(
      pushBranch(git, {
        repo: "/repo",
        branchName: "feature/menu",
        remotes: [],
        setUpstream: true,
        mode: "normal",
        noVerify: false
      })
    ).rejects.toThrow("No remotes were selected");
  });

  it("fetches into a non-checked-out local branch with a refspec", async () => {
    const git = gitWithRaw(async (args) => (args[0] === "branch" ? "main\n" : ""));

    await fetchIntoLocalBranch(git, {
      repo: "/repo",
      remote: "origin",
      remoteBranch: "feature/menu",
      localBranch: "feature/menu",
      force: true
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, ["branch", "--show-current"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, [
      "fetch",
      "-f",
      "origin",
      "feature/menu:feature/menu"
    ]);
  });

  it("pulls when updating the checked-out branch without force", async () => {
    const git = gitWithRaw(async (args) => (args[0] === "branch" ? "feature/menu\n" : ""));

    await fetchIntoLocalBranch(git, {
      repo: "/repo",
      remote: "origin",
      remoteBranch: "feature/menu",
      localBranch: "feature/menu",
      force: false
    });

    expect(git.raw).toHaveBeenNthCalledWith(2, ["pull", "origin", "feature/menu"]);
  });

  it("fetches and hard-resets when force-updating the checked-out branch", async () => {
    const git = gitWithRaw(async (args) => (args[0] === "branch" ? "feature/menu\n" : ""));

    await fetchIntoLocalBranch(git, {
      repo: "/repo",
      remote: "origin",
      remoteBranch: "feature/menu",
      localBranch: "feature/menu",
      force: true
    });

    expect(git.raw).toHaveBeenNthCalledWith(2, ["fetch", "origin", "feature/menu"]);
    expect(git.raw).toHaveBeenNthCalledWith(3, ["reset", "--hard", "origin/feature/menu"]);
  });

  it("resolves a branch upstream in the backend before updating", async () => {
    const git = gitWithRaw(async (args) => {
      if (args[0] === "rev-parse") return "upstream/feature/menu\n";
      if (args[0] === "remote") return "origin\nupstream\n";
      if (args[0] === "branch") return "main\n";
      return "";
    });

    await updateBranchFromUpstream(git, {
      repo: "/repo",
      branchName: "feature/menu",
      force: false
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "feature/menu@{upstream}"
    ]);
    expect(git.raw).toHaveBeenNthCalledWith(4, ["fetch", "upstream", "feature/menu:feature/menu"]);
  });

  it("falls back to deleting a stale remote-tracking branch when the remote ref is gone", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async (args) => {
      if (args[0] === "push") throw new Error("remote ref does not exist");
      return "";
    });

    await deleteRemoteBranch(
      git,
      { repo: "/repo", remote: "origin", branchName: "deleted" },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenNthCalledWith(1, ["push", "origin", "--delete", "deleted"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["branch", "-d", "-r", "origin/deleted"]);
    expect(records.map((record) => record.success)).toEqual([false, true]);
  });

  it("pulls a remote branch with merge options", async () => {
    const git = gitWithRaw(async () => "");

    await pullBranch(git, {
      repo: "/repo",
      remote: "origin",
      branchName: "release",
      createNewCommit: true,
      squash: false,
      noVerify: false
    });
    await pullBranch(git, {
      repo: "/repo",
      remote: "origin",
      branchName: "release",
      createNewCommit: true,
      squash: true,
      noVerify: true
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, ["pull", "origin", "release", "--no-ff"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, [
      "pull",
      "origin",
      "release",
      "--squash",
      "--no-verify"
    ]);
  });

  it("pushes a branch while bypassing git hooks", async () => {
    const git = gitWithRaw(async () => "");

    await pushBranch(git, {
      repo: "/repo",
      branchName: "feature/menu",
      remotes: ["origin"],
      setUpstream: false,
      mode: "normal",
      noVerify: true
    });

    expect(git.raw).toHaveBeenCalledWith(["push", "--no-verify", "origin", "feature/menu"]);
  });
});
