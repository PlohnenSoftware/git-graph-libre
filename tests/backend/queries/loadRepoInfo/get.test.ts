import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit, type SimpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadRepoInfo } from "@/backend/queries/loadRepoInfo";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

import { git, makeRepo } from "@tests/backend/helpers";

let repo: string;
let repoWithRemote: string;
let remoteRepo: string;

beforeAll(() => {
  repo = makeRepo();

  remoteRepo = makeRepo();
  repoWithRemote = makeRepo();
  git(["remote", "add", "origin", remoteRepo], repoWithRemote);
  git(["remote", "set-url", "--push", "origin", "ssh://example.test/repo.git"], repoWithRemote);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(repoWithRemote, { recursive: true, force: true });
  fs.rmSync(remoteRepo, { recursive: true, force: true });
});

describe("loadRepoInfo", () => {
  it("returns repository validity, HEAD, local config, and empty collections", async () => {
    const result = await loadRepoInfo(simpleGit(repo), { repo });

    expect(result.error).toBeNull();
    expect(result.repoInfo).toEqual({
      isRepo: true,
      head: "main",
      headCommit: expect.stringMatching(/^[0-9a-f]{40,64}$/i),
      remotes: [],
      stashes: [],
      stashCount: 0,
      config: {
        userName: "T",
        userEmail: "t@t.com"
      }
    });
  });

  it("returns isRepo: false with empty repo info for a non-git directory", async () => {
    const result = await loadRepoInfo(simpleGit(os.tmpdir()), { repo: os.tmpdir() });

    expect(result).toEqual({
      repoInfo: {
        isRepo: false,
        head: null,
        headCommit: null,
        remotes: [],
        stashes: [],
        stashCount: 0,
        config: {
          userName: null,
          userEmail: null
        }
      },
      error: null
    });
  });

  it("parses fetch and push remote URLs without losing URL credentials in data", async () => {
    git(
      ["remote", "set-url", "origin", "https://user:secret@example.test/repo.git"],
      repoWithRemote
    );

    const result = await loadRepoInfo(simpleGit(repoWithRemote), { repo: repoWithRemote });

    expect(result.error).toBeNull();
    expect(result.repoInfo.remotes).toEqual([
      {
        name: "origin",
        fetchUrls: ["https://user:secret@example.test/repo.git"],
        pushUrls: ["ssh://example.test/repo.git"]
      }
    ]);
  });

  it("parses NUL-separated stash records", async () => {
    const stashRepo = makeRepo();
    try {
      fs.writeFileSync(path.join(stashRepo, "f"), "changed");
      git(["stash", "push", "-m", "work in progress"], stashRepo);

      const result = await loadRepoInfo(simpleGit(stashRepo), { repo: stashRepo });

      expect(result.error).toBeNull();
      expect(result.repoInfo.stashCount).toBe(1);
      expect(result.repoInfo.stashes).toEqual([
        {
          index: 0,
          ref: "stash@{0}",
          hash: expect.stringMatching(/^[0-9a-f]{40,64}$/i),
          message: expect.stringContaining("work in progress"),
          date: expect.any(Number)
        }
      ]);
    } finally {
      fs.rmSync(stashRepo, { recursive: true, force: true });
    }
  });

  it("records sanitized Git command metadata", async () => {
    git(
      ["remote", "set-url", "origin", "https://user:secret@example.test/repo.git"],
      repoWithRemote
    );
    const records: GitCommandRecord[] = [];

    const result = await loadRepoInfo(simpleGit(repoWithRemote), {
      repo: repoWithRemote,
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.error).toBeNull();
    expect(records.map((record) => record.label)).toEqual(
      expect.arrayContaining([
        "loadRepoInfo.isRepo",
        "loadRepoInfo.headBranch",
        "loadRepoInfo.headCommit",
        "loadRepoInfo.remotes",
        "loadRepoInfo.stashes",
        "loadRepoInfo.config"
      ])
    );
    const remoteRecord = records.find((record) => record.label === "loadRepoInfo.remotes");
    expect(remoteRecord).toMatchObject({
      repo: repoWithRemote,
      args: ["remote", "-v"],
      success: true,
      error: null
    });
    expect(remoteRecord?.args.join(" ")).not.toContain("secret");
  });

  it("returns a typed error when a repo-info subquery fails", async () => {
    const failure = Object.assign(new Error("fatal: remote failed"), {
      result: { exitCode: 128, stdErr: "fatal: remote failed" }
    });
    const failingGit = {
      raw: async (args: string[]) => {
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true\n";
        if (args[0] === "branch") return "main\n";
        if (args[0] === "rev-parse" && args[1] === "--verify") return "abc123\n";
        if (args[0] === "remote") throw failure;
        if (args[0] === "stash") return "";
        if (args[0] === "config") return "user.name\nT\0user.email\nt@t.com\0";
        throw new Error(`unexpected git command: ${args.join(" ")}`);
      }
    } as unknown as SimpleGit;

    const result = await loadRepoInfo(failingGit, { repo: "/repo" });

    expect(result).toEqual({
      repoInfo: {
        isRepo: true,
        head: "main",
        headCommit: "abc123",
        remotes: [],
        stashes: [],
        stashCount: 0,
        config: {
          userName: "T",
          userEmail: "t@t.com"
        }
      },
      error: {
        message: "fatal: remote failed",
        stderr: "fatal: remote failed",
        exitCode: 128,
        task: null
      }
    });
  });
});
