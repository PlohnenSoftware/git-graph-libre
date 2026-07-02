import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { fetchRemotes } from "@/backend/actions/remote";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string>): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("fetchRemotes", () => {
  it("fetches all remotes without pruning by default", async () => {
    const git = gitWithRaw(async () => "");

    await fetchRemotes(git, {
      repo: "/repo",
      prune: false,
      pruneTags: false
    });

    expect(git.raw).toHaveBeenCalledWith(["fetch", "--all"]);
  });

  it("adds prune options and records action command metadata", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async (args) => (args[0] === "--version" ? "git version 2.43.0" : ""));

    await fetchRemotes(
      git,
      {
        repo: "/repo",
        prune: true,
        pruneTags: true
      },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenNthCalledWith(1, ["--version"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["fetch", "--all", "--prune", "--prune-tags"]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      label: "fetchRemotes.version",
      kind: "action",
      repo: "/repo",
      args: ["--version"],
      success: true
    });
    expect(records[1]).toMatchObject({
      label: "fetchRemotes.fetch",
      kind: "action",
      repo: "/repo",
      args: ["fetch", "--all", "--prune", "--prune-tags"],
      success: true
    });
  });

  it("rejects prune-tags when prune is disabled", async () => {
    const git = gitWithRaw(async () => "");

    await expect(
      fetchRemotes(git, {
        repo: "/repo",
        prune: false,
        pruneTags: true
      })
    ).rejects.toThrow("--prune-tags requires prune");

    expect(git.raw).not.toHaveBeenCalled();
  });

  it("rejects prune-tags on unsupported Git versions before fetching", async () => {
    const git = gitWithRaw(async () => "git version 2.16.6");

    await expect(
      fetchRemotes(git, {
        repo: "/repo",
        prune: true,
        pruneTags: true
      })
    ).rejects.toThrow("Git 2.17 or newer");

    expect(git.raw).toHaveBeenCalledTimes(1);
    expect(git.raw).toHaveBeenCalledWith(["--version"]);
  });
});
