import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import type { SimpleGit } from "simple-git";
import { simpleGit } from "simple-git";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  addRemote,
  deleteRemote,
  editRemote,
  fetchRemotes,
  fetchTags,
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

describe("fetchTags", () => {
  it("fetches tags from each selected remote and records the action", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async () => "");

    await fetchTags(
      git,
      { repo: "/repo", remotes: ["origin", "upstream"], pruneTags: false },
      (record) => records.push(record)
    );

    expect(git.raw).toHaveBeenNthCalledWith(1, ["fetch", "origin", "--tags"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["fetch", "upstream", "--tags"]);
    expect(records.map((record) => record.label)).toEqual(["remote.fetchTags", "remote.fetchTags"]);
    expect(records[0]).toMatchObject({
      kind: "action",
      repo: "/repo",
      args: ["fetch", "origin", "--tags"],
      success: true
    });
  });

  it("adds prune and prune-tags flags behind the git version guard", async () => {
    const records: GitCommandRecord[] = [];
    const git = gitWithRaw(async (args) => (args[0] === "--version" ? "git version 2.43.0" : ""));

    await fetchTags(git, { repo: "/repo", remotes: ["origin"], pruneTags: true }, (record) =>
      records.push(record)
    );

    expect(git.raw).toHaveBeenNthCalledWith(1, ["--version"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, [
      "fetch",
      "origin",
      "--prune",
      "--prune-tags",
      "--tags"
    ]);
    expect(records[1]).toMatchObject({
      label: "remote.fetchTags",
      args: ["fetch", "origin", "--prune", "--prune-tags", "--tags"],
      success: true
    });
  });

  it("rejects prune-tags on unsupported Git versions before fetching", async () => {
    const git = gitWithRaw(async () => "git version 2.16.6");

    await expect(
      fetchTags(git, { repo: "/repo", remotes: ["origin"], pruneTags: true })
    ).rejects.toThrow("Git 2.17 or newer");

    expect(git.raw).toHaveBeenCalledTimes(1);
    expect(git.raw).toHaveBeenCalledWith(["--version"]);
  });

  it("rejects an empty remotes selection", async () => {
    const git = gitWithRaw(async () => "");

    await expect(fetchTags(git, { repo: "/repo", remotes: [], pruneTags: false })).rejects.toThrow(
      "No remotes were selected"
    );

    expect(git.raw).not.toHaveBeenCalled();
  });
});

describe("fetchTags against a real repository", () => {
  const createdDirs: string[] = [];

  function makeBareRemote(): string {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-bare-"));
    createdDirs.push(bare);
    cp.execFileSync("git", ["init", "--bare", "-b", "main", bare]);
    return bare;
  }

  afterAll(() => {
    for (const dir of createdDirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("restores remote tags that are missing locally without touching local-only tags", async () => {
    const source = makeRepo();
    createdDirs.push(source);
    git(["tag", "v1.0"], source);
    git(["tag", "v2.0"], source);
    const bare = makeBareRemote();
    git(["remote", "add", "origin", bare], source);
    git(["push", "origin", "main", "--tags"], source);

    const repo = makeRepo();
    createdDirs.push(repo);
    git(["remote", "add", "origin", bare], repo);
    git(["tag", "local-only"], repo);

    await fetchTags(simpleGit(repo), { repo, remotes: ["origin"], pruneTags: false });

    const tags = cp.execFileSync("git", ["tag", "-l"], { cwd: repo }).toString().trim().split("\n");
    expect(tags).toContain("v1.0");
    expect(tags).toContain("v2.0");
    // A plain `--tags` fetch never prunes tags the remote does not carry.
    expect(tags).toContain("local-only");
  });

  it("prunes local tags deleted on the remote when prune-tags is enabled", async () => {
    const source = makeRepo();
    createdDirs.push(source);
    git(["tag", "v1.0"], source);
    git(["tag", "v2.0"], source);
    const bare = makeBareRemote();
    git(["remote", "add", "origin", bare], source);
    git(["push", "origin", "main", "--tags"], source);

    const repo = makeRepo();
    createdDirs.push(repo);
    git(["remote", "add", "origin", bare], repo);

    await fetchTags(simpleGit(repo), { repo, remotes: ["origin"], pruneTags: false });
    expect(cp.execFileSync("git", ["tag", "-l"], { cwd: repo }).toString()).toContain("v2.0");

    git(["push", "origin", "--delete", "refs/tags/v2.0"], source);
    await fetchTags(simpleGit(repo), { repo, remotes: ["origin"], pruneTags: true });
    const tags = cp.execFileSync("git", ["tag", "-l"], { cwd: repo }).toString();
    expect(tags).toContain("v1.0");
    expect(tags).not.toContain("v2.0");
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
