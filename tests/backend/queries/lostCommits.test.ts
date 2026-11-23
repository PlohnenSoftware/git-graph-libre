import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterEach, describe, expect, it } from "vitest";
import {
  FSCK_LOST_COMMITS_LABEL,
  LOST_COMMITS_DETAILS_LABEL,
  loadLostCommits,
  parseLostCommitRecords,
  runBoundedGitProcess
} from "@/backend/queries/lostCommits";
import { FSCK_UNREACHABLE_ARGS } from "@/backend/queries/unreachableCommits";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const dirs: string[] = [];

function repo(): string {
  const dir = makeRepo();
  dirs.push(dir);
  return dir;
}

function revParse(ref: string, cwd: string): string {
  return cp.execFileSync("git", ["rev-parse", ref], { cwd, encoding: "utf8" }).trim();
}

afterEach(() => {
  while (dirs.length > 0) {
    fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

describe("parseLostCommitRecords", () => {
  it("parses NUL-delimited commit records and sorts newest first", () => {
    const hashA = "a".repeat(40);
    const hashB = "b".repeat(40);
    const hashC = "c".repeat(40);
    const stdout = [
      `${hashA}\u001f1700000100\u001folder commit`,
      `${hashB}\u001f1700000300\u001fnewest commit`,
      `${hashC}\u001f1700000200\u001f`
    ].join("\0");

    expect(parseLostCommitRecords(stdout)).toEqual([
      { hash: hashB, time: 1_700_000_300, subject: "newest commit" },
      { hash: hashC, time: 1_700_000_200, subject: "" },
      { hash: hashA, time: 1_700_000_100, subject: "older commit" }
    ]);
  });

  it("deduplicates hashes and skips malformed records", () => {
    const hashA = "a".repeat(40);
    const stdout = [
      "not-a-hash\u001f1700000100\u001fbad",
      `${hashA}\u001fnot-a-number\u001fbad time`,
      `${hashA}\u001f1700000100\u001ffirst`,
      `${hashA}\u001f1700000999\u001fduplicate`,
      ""
    ].join("\0");

    expect(parseLostCommitRecords(stdout)).toEqual([
      { hash: hashA, time: 1_700_000_100, subject: "first" }
    ]);
    expect(parseLostCommitRecords("")).toEqual([]);
  });
});

describe("loadLostCommits (real Git)", () => {
  it("finds a dropped stash and an abandoned commit without writing lost-found", async () => {
    const dir = repo();

    // Abandoned commit after hard reset + reflog expiry.
    fs.writeFileSync(path.join(dir, "work.txt"), "abandoned work");
    git(["add", "."], dir);
    git(["commit", "-m", "abandoned work"], dir);
    const abandonedHash = revParse("HEAD", dir);
    git(["reset", "--hard", "HEAD~1"], dir);

    // Dropped stash + reflog expiry.
    fs.writeFileSync(path.join(dir, "f"), "stashed edits");
    git(["stash", "push", "-m", "dropped stash work"], dir);
    const stashHash = revParse("refs/stash", dir);
    git(["stash", "drop"], dir);

    // Expire reflogs so both commits are unreachable from refs and reflogs alike.
    git(["reflog", "expire", "--expire=now", "--all"], dir);

    const records: GitCommandRecord[] = [];
    const result = await loadLostCommits({
      repo: dir,
      gitPath: "git",
      record: (entry) => records.push(entry)
    });

    expect(result.error).toBeNull();
    expect(result.canceled).toBe(false);
    expect(result.timedOut).toBe(false);

    const byHash = new Map(result.commits.map((commit) => [commit.hash, commit]));
    expect(byHash.get(abandonedHash)).toMatchObject({
      hash: abandonedHash,
      subject: "abandoned work"
    });
    expect(byHash.get(abandonedHash)?.time).toBeGreaterThan(0);

    expect(byHash.get(stashHash)).toMatchObject({
      hash: stashHash,
      subject: expect.stringContaining("dropped stash work")
    });
    expect(byHash.get(stashHash)?.time).toBeGreaterThan(0);

    // Strictly read-only: never creates .git/lost-found, never runs --lost-found or gc/prune.
    expect(fs.existsSync(path.join(dir, ".git", "lost-found"))).toBe(false);
    const fsckRecord = records.find((entry) => entry.label === FSCK_LOST_COMMITS_LABEL);
    expect(fsckRecord?.args).toEqual(FSCK_UNREACHABLE_ARGS);
    expect(fsckRecord?.args).not.toContain("--lost-found");
    expect(records.some((entry) => entry.label === LOST_COMMITS_DETAILS_LABEL)).toBe(true);
  });

  it("returns an empty list on a repository with no unreachable commits", async () => {
    const dir = repo();
    const records: GitCommandRecord[] = [];
    const result = await loadLostCommits({
      repo: dir,
      gitPath: "git",
      record: (entry) => records.push(entry)
    });

    expect(result).toEqual({
      commits: [],
      canceled: false,
      timedOut: false,
      error: null
    });
    expect(records.map((entry) => entry.label)).toEqual([FSCK_LOST_COMMITS_LABEL]);
  });

  it("keeps hashes reported behind a non-zero fsck exit (reusing U1 tolerance)", async () => {
    const dir = repo();
    const headHash = revParse("HEAD", dir);
    const result = await loadLostCommits({
      repo: dir,
      gitPath: "git",
      fsckRunner: async () => ({
        stdout: `unreachable commit ${headHash}\nunreachable tree ${"b".repeat(40)}\n`,
        stderr: "error: Could not read stale object\n",
        exitCode: 16
      })
    });

    expect(result.error).toBeNull();
    expect(result.canceled).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]).toMatchObject({ hash: headHash, subject: "init" });
  });

  it("surfaces only stderr when fsck fails with no usable commit hashes", async () => {
    const result = await loadLostCommits({
      repo: "/repo",
      gitPath: "git",
      fsckRunner: async () => ({
        stdout: `unreachable blob ${"a".repeat(40)}\n`,
        stderr: "fatal: not a git repository\n",
        exitCode: 128
      })
    });

    expect(result.commits).toEqual([]);
    expect(result.canceled).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(result.error?.message).toBe("fatal: not a git repository");
    expect(result.error?.message).not.toContain("unreachable blob");
  });

  it("reports a missing Git binary path without spawning", async () => {
    const result = await loadLostCommits({ repo: "/repo", gitPath: "" });
    expect(result.commits).toEqual([]);
    expect(result.canceled).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(result.error?.message).toContain("Git binary path");
  });

  it("cancels immediately when the AbortSignal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let ran = false;
    const result = await loadLostCommits({
      repo: "/repo",
      gitPath: "git",
      signal: controller.signal,
      fsckRunner: async () => {
        ran = true;
        return { stdout: "", stderr: "", exitCode: 0 };
      }
    });

    expect(ran).toBe(false);
    expect(result).toEqual({
      commits: [],
      canceled: true,
      timedOut: false,
      error: null
    });
  });

  it("cancels an in-flight scan when the AbortSignal fires", async () => {
    const controller = new AbortController();
    const pending = loadLostCommits({
      repo: "/repo",
      gitPath: "git",
      signal: controller.signal,
      timeoutMs: 5_000,
      fsckRunner: () => new Promise(() => {})
    });
    controller.abort();
    const result = await pending;

    expect(result).toEqual({
      commits: [],
      canceled: true,
      timedOut: false,
      error: null
    });
  });

  it("times out a slow scan and reports timedOut", async () => {
    const result = await loadLostCommits({
      repo: "/repo",
      gitPath: "git",
      timeoutMs: 30,
      fsckRunner: () => new Promise(() => {})
    });

    expect(result.commits).toEqual([]);
    expect(result.canceled).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.error?.message).toContain("timed out");
  });

  it("cancels and times out a real child process via runBoundedGitProcess", async () => {
    const controller = new AbortController();
    const cancelRun = runBoundedGitProcess({
      binary: process.execPath,
      args: ["-e", "setTimeout(() => {}, 30000)"],
      timeoutMs: 10_000,
      signal: controller.signal
    });
    setTimeout(() => controller.abort(), 30);
    const canceled = await cancelRun;
    expect(canceled.stopReason).toBe("canceled");

    const timedOut = await runBoundedGitProcess({
      binary: process.execPath,
      args: ["-e", "setTimeout(() => {}, 30000)"],
      timeoutMs: 40
    });
    expect(timedOut.stopReason).toBe("timedOut");
  });
});
