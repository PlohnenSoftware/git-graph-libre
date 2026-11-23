import * as cp from "node:child_process";
import * as fs from "node:fs";
import { git, makeRepo } from "@tests/backend/helpers";
import { describe, expect, it } from "vitest";
import {
  classifyFsckRun,
  discoverUnreachableCommitHashes,
  type FsckRun,
  MAX_FSCK_STDERR_CHARS,
  summarizeFsckStderr
} from "@/backend/queries/unreachableCommits";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const hashA = "a".repeat(40);
const hashB = "b".repeat(40);

describe("classifyFsckRun", () => {
  it("yields the hashes behind a non-zero exit instead of failing the scan", () => {
    const result = classifyFsckRun({
      stdout: `unreachable commit ${hashA}\nunreachable tree ${hashB}\n`,
      stderr: "error: Could not read something\n",
      exitCode: 16
    });
    expect(result.hashes).toEqual([hashA]);
    expect(result.error).toBeNull();
    expect(result.exitCode).toBe(16);
    expect(result.stderr).toBe("error: Could not read something");
  });

  it("reports a clean empty scan as no hashes and no error", () => {
    expect(classifyFsckRun({ stdout: "", stderr: "", exitCode: 0 })).toEqual({
      hashes: [],
      error: null,
      stderr: "",
      exitCode: 0
    });
  });

  it("builds a genuine failure from stderr only, never from stdout", () => {
    const result = classifyFsckRun({
      stdout: `unreachable tree ${hashA}\nunreachable blob ${hashB}\n`,
      stderr: "fatal: not a git repository\n",
      exitCode: 128
    });
    expect(result.hashes).toEqual([]);
    expect(result.error).toEqual({
      message: "fatal: not a git repository",
      stderr: "fatal: not a git repository",
      exitCode: 128,
      task: "fsck"
    });
    expect(result.error?.message).not.toContain("unreachable");
  });

  it("falls back to the exit code when a failed run printed no stderr", () => {
    const result = classifyFsckRun({ stdout: "", stderr: "", exitCode: 16 });
    expect(result.error?.message).toBe("git fsck exited with code 16");
    expect(result.error?.stderr).toBeNull();
  });
});

describe("summarizeFsckStderr", () => {
  it("trims and truncates long stderr to a sane length", () => {
    const summary = summarizeFsckStderr(`  ${"e".repeat(MAX_FSCK_STDERR_CHARS + 500)}  `);
    expect(summary).toContain("(truncated)");
    expect(summary.length).toBeLessThan(MAX_FSCK_STDERR_CHARS + 32);
  });

  it("keeps short stderr whole", () => {
    expect(summarizeFsckStderr("\nerror: short\n")).toBe("error: short");
  });
});

describe("discoverUnreachableCommitHashes", () => {
  it("records a non-zero exit with the stderr summary while keeping its hashes", async () => {
    const records: GitCommandRecord[] = [];
    const run: FsckRun = {
      stdout: `unreachable commit ${hashA}\nunreachable blob ${hashB}\n`,
      stderr: "error: Could not read deadbeef\nfailed to parse commit deadbeef\n",
      exitCode: 16
    };
    const result = await discoverUnreachableCommitHashes({
      repo: "/repo",
      gitPath: "git",
      record: (record) => records.push(record),
      runner: async () => run
    });

    expect(result.hashes).toEqual([hashA]);
    expect(result.error).toBeNull();
    expect(result.exitCode).toBe(16);
    expect(records).toHaveLength(1);
    expect(records[0].label).toBe("loadCommits.unreachable");
    expect(records[0].args).toEqual([
      "-c",
      "core.commitGraph=false",
      "fsck",
      "--unreachable",
      "--no-reflogs",
      "--no-progress",
      "--connectivity-only"
    ]);
    expect(records[0].success).toBe(false);
    expect(records[0].error?.exitCode).toBe(16);
    expect(records[0].error?.message).toContain("Could not read deadbeef");
    expect(records[0].error?.message).not.toContain("unreachable commit");
  });

  it("surfaces only stderr when fsck fails without usable output", async () => {
    const result = await discoverUnreachableCommitHashes({
      repo: "/repo",
      gitPath: "git",
      runner: async () => ({
        stdout: `unreachable tree ${hashA}\n`,
        stderr: "fatal: this operation must be run in a work tree\n",
        exitCode: 128
      })
    });
    expect(result.hashes).toEqual([]);
    expect(result.error?.message).toBe("fatal: this operation must be run in a work tree");
    expect(result.error?.message).not.toContain("unreachable tree");
    expect(result.error?.exitCode).toBe(128);
  });

  it("reports a spawn failure as an error with no hashes", async () => {
    const result = await discoverUnreachableCommitHashes({
      repo: "/repo",
      gitPath: "git",
      runner: async () => {
        throw new Error("spawn git ENOENT");
      }
    });
    expect(result.hashes).toEqual([]);
    expect(result.error?.message).toContain("ENOENT");
  });

  it("reports an error when no Git binary path is available", async () => {
    const result = await discoverUnreachableCommitHashes({ repo: "/repo" });
    expect(result.hashes).toEqual([]);
    expect(result.error?.message).toContain("Git binary path");
  });

  it("finds a real dangling commit through the real spawn", async () => {
    const repo = makeRepo();
    try {
      const tree = cp.execFileSync("git", ["write-tree"], { cwd: repo, encoding: "utf8" }).trim();
      const dangling = cp
        .execFileSync("git", ["commit-tree", tree, "-m", "dangling tip"], {
          cwd: repo,
          encoding: "utf8"
        })
        .trim();
      git(["reflog", "expire", "--expire=now", "--all"], repo);

      const result = await discoverUnreachableCommitHashes({ repo, gitPath: "git" });
      expect(result.error).toBeNull();
      expect(result.exitCode).toBe(0);
      expect(result.hashes).toContain(dangling);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("reports a missing Git binary as an error with no hashes", async () => {
    const repo = makeRepo();
    try {
      const result = await discoverUnreachableCommitHashes({
        repo,
        gitPath: "/nonexistent/git-graph-libre-test-binary"
      });
      expect(result.hashes).toEqual([]);
      expect(result.error).not.toBeNull();
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
