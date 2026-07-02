import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import {
  applyStash,
  branchFromStash,
  cleanUntrackedFiles,
  dropStash,
  popStash,
  pushStash,
  resetUncommittedChanges
} from "@/backend/actions/stash";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string> = async () => ""): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("stash actions", () => {
  it("applies and pops stashes with optional index reinstatement", async () => {
    const git = gitWithRaw();

    await applyStash(git, {
      repo: "/repo",
      selector: "stash@{0}",
      reinstateIndex: true
    });
    await popStash(git, {
      repo: "/repo",
      selector: "stash@{1}",
      reinstateIndex: false
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, ["stash", "apply", "--index", "stash@{0}"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["stash", "pop", "stash@{1}"]);
  });

  it("creates a branch from a stash and drops a selected stash", async () => {
    const git = gitWithRaw();

    await branchFromStash(git, {
      repo: "/repo",
      selector: "stash@{0}",
      branchName: "recover/work"
    });
    await dropStash(git, {
      repo: "/repo",
      selector: "stash@{0}"
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, ["stash", "branch", "recover/work", "stash@{0}"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["stash", "drop", "stash@{0}"]);
  });

  it("pushes uncommitted changes to a stash with message and untracked option", async () => {
    const git = gitWithRaw();

    await pushStash(git, {
      repo: "/repo",
      message: "local checkpoint",
      includeUntracked: true
    });
    await pushStash(git, {
      repo: "/repo",
      message: "",
      includeUntracked: false
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, [
      "stash",
      "push",
      "--include-untracked",
      "--message",
      "local checkpoint"
    ]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["stash", "push"]);
  });

  it("resets uncommitted changes and cleans untracked files", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw();

    await resetUncommittedChanges(
      git,
      {
        repo: "/repo",
        resetMode: "hard"
      },
      (record) => records.push(record)
    );
    await cleanUntrackedFiles(
      git,
      {
        repo: "/repo",
        includeDirectories: true
      },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenNthCalledWith(1, ["reset", "--hard", "HEAD"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["clean", "-f", "-d"]);
    expect(records.map((record) => record.label)).toEqual([
      "stash.resetUncommitted",
      "stash.cleanUntracked"
    ]);
  });

  it("rejects unsupported uncommitted reset modes before running git", async () => {
    const git = gitWithRaw();

    await expect(
      resetUncommittedChanges(git, {
        repo: "/repo",
        resetMode: "soft" as unknown as "mixed"
      })
    ).rejects.toThrow("Reset mode must be mixed or hard.");
    expect(git.raw).not.toHaveBeenCalled();
  });
});
