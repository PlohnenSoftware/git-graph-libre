import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import {
  addRemote,
  deleteRemote,
  editRemote,
  fetchRemotes,
  pruneRemote
} from "@/backend/actions/remote";
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

  it("fetches a selected remote", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async () => "");

    await fetchRemotes(
      git,
      {
        repo: "/repo",
        remote: "origin",
        prune: true,
        pruneTags: false
      },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenCalledWith(["fetch", "origin", "--prune"]);
    expect(records[0]).toMatchObject({
      label: "fetchRemotes.fetchRemote",
      kind: "action",
      repo: "/repo",
      args: ["fetch", "origin", "--prune"],
      success: true
    });
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

describe("remote actions", () => {
  it("adds a remote, optional push URL, and optional fetch", async () => {
    const git = gitWithRaw(async () => "");

    await addRemote(git, {
      repo: "/repo",
      name: " origin ",
      fetchUrl: " https://example.test/repo.git ",
      pushUrl: " ssh://example.test/repo.git ",
      fetch: true
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, [
      "remote",
      "add",
      "origin",
      "https://example.test/repo.git"
    ]);
    expect(git.raw).toHaveBeenNthCalledWith(2, [
      "remote",
      "set-url",
      "--push",
      "origin",
      "ssh://example.test/repo.git"
    ]);
    expect(git.raw).toHaveBeenNthCalledWith(3, ["fetch", "origin"]);
  });

  it("edits a remote name and URLs", async () => {
    const git = gitWithRaw(async () => "");

    await editRemote(git, {
      repo: "/repo",
      oldName: "origin",
      name: "upstream",
      fetchUrl: "https://example.test/upstream.git",
      pushUrl: "ssh://example.test/upstream.git"
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, ["remote", "rename", "origin", "upstream"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, [
      "remote",
      "set-url",
      "upstream",
      "https://example.test/upstream.git"
    ]);
    expect(git.raw).toHaveBeenNthCalledWith(3, [
      "remote",
      "set-url",
      "--push",
      "upstream",
      "ssh://example.test/upstream.git"
    ]);
  });

  it("clears an existing push URL when editing with an empty push URL", async () => {
    const git = gitWithRaw(async (args) =>
      args[0] === "config" && args[1] === "--get-all" ? "ssh://example.test/repo.git\n" : ""
    );

    await editRemote(git, {
      repo: "/repo",
      oldName: "origin",
      name: "origin",
      fetchUrl: "https://example.test/repo.git",
      pushUrl: null
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, [
      "remote",
      "set-url",
      "origin",
      "https://example.test/repo.git"
    ]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["config", "--get-all", "remote.origin.pushurl"]);
    expect(git.raw).toHaveBeenNthCalledWith(3, ["config", "--unset-all", "remote.origin.pushurl"]);
  });

  it("deletes and prunes named remotes", async () => {
    const git = gitWithRaw(async () => "");

    await deleteRemote(git, { repo: "/repo", name: "origin" });
    await pruneRemote(git, { repo: "/repo", name: "origin" });

    expect(git.raw).toHaveBeenNthCalledWith(1, ["remote", "remove", "origin"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["remote", "prune", "origin"]);
  });
});
