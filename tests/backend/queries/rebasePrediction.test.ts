import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  DEFAULT_PREDICTION_PROBE_LIMIT,
  parseGitVersion,
  parseMergeTreeOutput,
  predictRebaseConflicts,
  supportsMergeTreeMergeBase
} from "@/backend/queries/rebasePrediction";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const tempDirs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const isolatedEnv: Record<string, string> = {};

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function run(args: string[], cwd: string, env: Record<string, string> = {}): string {
  return cp.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...isolatedEnv, ...env }
  });
}

function initRepo(): string {
  const dir = tempDir("ggl-rebase-predict-");
  run(["init", "-q", "-b", "main"], dir);
  run(["config", "commit.gpgsign", "false"], dir);
  return dir;
}

function writeFile(dir: string, relPath: string, content: string): void {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function commitAll(dir: string, subject: string): string {
  run(["add", "-A"], dir);
  run(["commit", "-q", "-m", subject], dir);
  return run(["rev-parse", "HEAD"], dir).trim();
}

function reader(dir: string) {
  return simpleGit(dir);
}

beforeAll(() => {
  const home = tempDir("ggl-rebase-predict-home-");
  const globalConfig = path.join(home, "gitconfig");
  fs.writeFileSync(globalConfig, "");
  Object.assign(isolatedEnv, {
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Author",
    GIT_AUTHOR_EMAIL: "author@example.test",
    GIT_COMMITTER_NAME: "Committer",
    GIT_COMMITTER_EMAIL: "committer@example.test",
    GIT_EDITOR: "true"
  });
  for (const key of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"]) {
    savedEnv[key] = process.env[key];
    process.env[key] = isolatedEnv[key];
  }
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("parseGitVersion and supportsMergeTreeMergeBase", () => {
  it.each([
    ["git version 2.40.0\n", { major: 2, minor: 40 }, true],
    ["git version 2.56.1\n", { major: 2, minor: 56 }, true],
    ["git version 2.47.1.windows.1\n", { major: 2, minor: 47 }, true],
    ["git version 2.39.3 (Apple Git-146)\n", { major: 2, minor: 39 }, false],
    ["git version 1.9.5\n", { major: 1, minor: 9 }, false],
    ["git version 3.0.0\n", { major: 3, minor: 0 }, true],
    ["not a version", null, false]
  ])("%j -> version=%j supported=%s", (stdout, version, supported) => {
    const parsed = parseGitVersion(stdout);
    expect(parsed).toEqual(version);
    expect(supportsMergeTreeMergeBase(parsed)).toBe(supported);
  });
});

describe("parseMergeTreeOutput", () => {
  const TREE_OID = "45467068ddd9d483529461ab92256bb10f180d3b";

  it("parses a clean exit-0 tree OID", () => {
    expect(parseMergeTreeOutput(`${TREE_OID}\0`, 0)).toEqual({
      treeOid: TREE_OID,
      conflictFiles: []
    });
  });

  it("parses NUL-delimited conflicted files without reading message sections", () => {
    const stdout = [
      TREE_OID,
      "a.txt",
      "dir with space/日本語 café.txt",
      "a.txt",
      "",
      "1",
      "a.txt",
      "CONFLICT (contents)",
      "CONFLICT (content): Merge conflict in a.txt\n"
    ].join("\0");
    expect(parseMergeTreeOutput(stdout, 1)).toEqual({
      treeOid: TREE_OID,
      conflictFiles: ["a.txt", "dir with space/日本語 café.txt"]
    });
  });

  it("returns null on malformed output without a tree OID", () => {
    expect(parseMergeTreeOutput("not-an-oid\0", 0)).toBeNull();
  });
});

describe("predictRebaseConflicts (real Git)", () => {
  it("reports clean for a reorder with no conflict", async () => {
    const repo = initRepo();
    writeFile(repo, "a.txt", "a0\n");
    writeFile(repo, "b.txt", "b0\n");
    const base = commitAll(repo, "base");

    writeFile(repo, "a.txt", "a1\n");
    const c1 = commitAll(repo, "edit a");

    writeFile(repo, "b.txt", "b1\n");
    const c2 = commitAll(repo, "edit b");

    const records: GitCommandRecord[] = [];
    const result = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: [
        { action: "pick", hash: c2 },
        { action: "pick", hash: c1 }
      ],
      binary: "git",
      recordGitCommand: (record) => records.push(record)
    });

    expect(result).toEqual({
      status: "clean",
      conflictHash: null,
      conflictFiles: [],
      probedCount: 2,
      totalSteps: 2,
      probeLimit: DEFAULT_PREDICTION_PROBE_LIMIT,
      error: null
    });
    expect(records.filter((r) => r.label === "rebasePrediction.mergeTree")).toHaveLength(2);
  });

  it("reports the first conflicting commit and file for a conflicting reorder", async () => {
    const repo = initRepo();
    writeFile(repo, "shared.txt", "line0\n");
    const base = commitAll(repo, "base");

    writeFile(repo, "shared.txt", "line1\n");
    const c1 = commitAll(repo, "c1");

    writeFile(repo, "shared.txt", "line2\n");
    const c2 = commitAll(repo, "c2");

    const result = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: [
        { action: "pick", hash: c2 },
        { action: "pick", hash: c1 }
      ],
      binary: "git"
    });

    expect(result).toEqual({
      status: "conflict",
      conflictHash: c2,
      conflictFiles: ["shared.txt"],
      probedCount: 1,
      totalSteps: 2,
      probeLimit: DEFAULT_PREDICTION_PROBE_LIMIT,
      error: null
    });
  });

  it("detects a drop that causes a later commit to conflict", async () => {
    const repo = initRepo();
    writeFile(repo, "shared.txt", "v0\n");
    const base = commitAll(repo, "base");

    writeFile(repo, "shared.txt", "v1\n");
    const c1 = commitAll(repo, "c1");

    writeFile(repo, "shared.txt", "v2\n");
    const c2 = commitAll(repo, "c2");

    const result = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: [
        { action: "drop", hash: c1 },
        { action: "pick", hash: c2 }
      ],
      binary: "git"
    });

    expect(result).toEqual({
      status: "conflict",
      conflictHash: c2,
      conflictFiles: ["shared.txt"],
      probedCount: 1,
      totalSteps: 1,
      probeLimit: DEFAULT_PREDICTION_PROBE_LIMIT,
      error: null
    });
  });

  it("detects a squash that conflicts against the accumulated tree", async () => {
    const repo = initRepo();
    writeFile(repo, "shared.txt", "v0\n");
    writeFile(repo, "other.txt", "o0\n");
    const base = commitAll(repo, "base");

    writeFile(repo, "shared.txt", "v1\n");
    const c1 = commitAll(repo, "c1");

    writeFile(repo, "other.txt", "o1\n");
    const c2 = commitAll(repo, "c2");

    writeFile(repo, "shared.txt", "v2\n");
    const c3 = commitAll(repo, "c3");

    const result = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: [
        { action: "drop", hash: c1 },
        { action: "pick", hash: c2 },
        { action: "squash", hash: c3 }
      ],
      binary: "git"
    });

    expect(result).toEqual({
      status: "conflict",
      conflictHash: c3,
      conflictFiles: ["shared.txt"],
      probedCount: 2,
      totalSteps: 2,
      probeLimit: DEFAULT_PREDICTION_PROBE_LIMIT,
      error: null
    });
  });

  it("reports non-ASCII conflicted paths verbatim without quoting", async () => {
    const repo = initRepo();
    const nonAsciiPath = "dir with space/日本語 café.txt";
    writeFile(repo, nonAsciiPath, "base\n");
    const base = commitAll(repo, "base");

    writeFile(repo, nonAsciiPath, "step1\n");
    const c1 = commitAll(repo, "c1");

    writeFile(repo, nonAsciiPath, "step2\n");
    const c2 = commitAll(repo, "c2");

    const result = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: [
        { action: "drop", hash: c1 },
        { action: "pick", hash: c2 }
      ],
      binary: "git"
    });

    expect(result.status).toBe("conflict");
    expect(result.conflictHash).toBe(c2);
    expect(result.conflictFiles).toEqual([nonAsciiPath]);
  });

  it("chains tree OIDs cleanly through a fixup chain and catches breaks in it", async () => {
    const repo = initRepo();
    writeFile(repo, "init.txt", "init\n");
    const base = commitAll(repo, "base");

    writeFile(repo, "chain.txt", "one\n");
    const c1 = commitAll(repo, "add chain");

    writeFile(repo, "chain.txt", "one\ntwo\n");
    const c2 = commitAll(repo, "fixup 1");

    writeFile(repo, "chain.txt", "one\ntwo\nthree\n");
    const c3 = commitAll(repo, "fixup 2");

    const cleanResult = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: [
        { action: "pick", hash: c1 },
        { action: "fixup", hash: c2 },
        { action: "fixup", hash: c3 }
      ],
      binary: "git"
    });

    expect(cleanResult.status).toBe("clean");
    expect(cleanResult.probedCount).toBe(3);
    expect(cleanResult.totalSteps).toBe(3);

    const brokenResult = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: [
        { action: "pick", hash: c1 },
        { action: "drop", hash: c2 },
        { action: "fixup", hash: c3 }
      ],
      binary: "git"
    });

    expect(brokenResult.status).toBe("conflict");
    expect(brokenResult.conflictHash).toBe(c3);
    expect(brokenResult.conflictFiles).toEqual(["chain.txt"]);
  });

  it("caps probes at probeLimit and reports capped when no conflict occurs before the limit", async () => {
    const repo = initRepo();
    writeFile(repo, "base.txt", "base\n");
    const base = commitAll(repo, "base");

    const commits: string[] = [];
    for (let i = 1; i <= 5; i++) {
      writeFile(repo, `file-${i}.txt`, `content ${i}\n`);
      commits.push(commitAll(repo, `commit ${i}`));
    }

    const records: GitCommandRecord[] = [];
    const result = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: commits.map((hash) => ({ action: "pick" as const, hash })),
      binary: "git",
      probeLimit: 3,
      recordGitCommand: (record) => records.push(record)
    });

    expect(result).toEqual({
      status: "capped",
      conflictHash: null,
      conflictFiles: [],
      probedCount: 3,
      totalSteps: 5,
      probeLimit: 3,
      error: null
    });
    expect(records.filter((r) => r.label === "rebasePrediction.mergeTree")).toHaveLength(3);
  });

  it("returns unavailable when the injected capability check reports Git older than 2.40", async () => {
    const repo = initRepo();
    writeFile(repo, "a.txt", "a0\n");
    const base = commitAll(repo, "base");
    writeFile(repo, "a.txt", "a1\n");
    const c1 = commitAll(repo, "c1");

    const records: GitCommandRecord[] = [];
    const result = await predictRebaseConflicts(reader(repo), {
      repo,
      base,
      entries: [{ action: "pick", hash: c1 }],
      binary: "git",
      checkMergeTreeSupport: () => Promise.resolve(false),
      recordGitCommand: (record) => records.push(record)
    });

    expect(result).toEqual({
      status: "unavailable",
      conflictHash: null,
      conflictFiles: [],
      probedCount: 0,
      totalSteps: 1,
      probeLimit: DEFAULT_PREDICTION_PROBE_LIMIT,
      error: null
    });
    expect(records).toHaveLength(0);
  });

  it("handles --root rebases (base === null) and all-dropped todos", async () => {
    const repo = initRepo();
    writeFile(repo, "root.txt", "root\n");
    const c1 = commitAll(repo, "root");
    writeFile(repo, "next.txt", "next\n");
    const c2 = commitAll(repo, "next");

    const rootResult = await predictRebaseConflicts(reader(repo), {
      repo,
      base: null,
      entries: [
        { action: "pick", hash: c1 },
        { action: "reword", hash: c2 }
      ],
      binary: "git"
    });
    expect(rootResult.status).toBe("clean");
    expect(rootResult.probedCount).toBe(2);

    const allDropped = await predictRebaseConflicts(reader(repo), {
      repo,
      base: null,
      entries: [
        { action: "drop", hash: c1 },
        { action: "drop", hash: c2 }
      ],
      binary: "git"
    });
    expect(allDropped.status).toBe("clean");
    expect(allDropped.probedCount).toBe(0);
    expect(allDropped.totalSteps).toBe(0);
  });

  it("rejects unsafe base revisions and invalid hashes without invoking merge-tree", async () => {
    const repo = initRepo();
    writeFile(repo, "a.txt", "a\n");
    const c1 = commitAll(repo, "c1");

    const badBase = await predictRebaseConflicts(reader(repo), {
      repo,
      base: "--exec=bad",
      entries: [{ action: "pick", hash: c1 }],
      binary: "git"
    });
    expect(badBase.status).toBe("error");
    expect(badBase.error?.message).toContain("dash");

    const badHash = await predictRebaseConflicts(reader(repo), {
      repo,
      base: c1,
      entries: [{ action: "pick", hash: "--bad" }],
      binary: "git"
    });
    expect(badHash.status).toBe("error");
    expect(badHash.error?.message).toContain("Invalid commit hash");
  });
});
