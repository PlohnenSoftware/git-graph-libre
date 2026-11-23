import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type SimpleGit, simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_FILE_HISTORY_LIMIT,
  FileHistoryFormatError,
  loadFileHistory,
  MAX_FILE_HISTORY_LIMIT,
  normalizeFileHistoryPath,
  parseFileHistoryRecords
} from "@/backend/queries/fileHistory";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const NUL = "\0";
const US = "\u001f";
const T1 = "2020-01-01T00:00:00Z";
const T1_UNIX = 1_577_836_800;
const T2 = "2020-01-02T00:00:00Z";
const T2_UNIX = 1_577_923_200;
const T3 = "2020-01-03T00:00:00Z";
const T3_UNIX = 1_578_009_600;

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
  const dir = tempDir("ggl-file-history-");
  run(["init", "-q", "-b", "main"], dir);
  run(["config", "commit.gpgsign", "false"], dir);
  return dir;
}

function writeFile(dir: string, relPath: string, content: string): void {
  const full = path.join(dir, ...relPath.split("/"));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(dir: string, message: string, env: Record<string, string> = {}): string {
  run(["add", "-A"], dir);
  run(["commit", "-q", "-m", message], dir, env);
  return run(["rev-parse", "HEAD"], dir).trim();
}

beforeAll(() => {
  const home = tempDir("ggl-file-history-home-");
  const globalConfig = path.join(home, "gitconfig");
  fs.writeFileSync(globalConfig, "");
  Object.assign(isolatedEnv, {
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Author",
    GIT_AUTHOR_EMAIL: "author@example.test",
    GIT_COMMITTER_NAME: "Committer",
    GIT_COMMITTER_EMAIL: "committer@example.test"
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

describe("normalizeFileHistoryPath", () => {
  it("normalizes clean repository-relative paths", () => {
    expect(normalizeFileHistoryPath("src/app.ts")).toEqual({ path: "src/app.ts" });
    expect(normalizeFileHistoryPath("./src//nested/../app.ts")).toEqual({ path: "src/app.ts" });
    expect(normalizeFileHistoryPath("src\\nested\\app.ts")).toEqual({ path: "src/nested/app.ts" });
  });

  it.each([
    ["empty path", ""],
    ["leading dash", "-flag.txt"],
    ["double dash option", "--all"],
    ["normalized leading dash", "./-flag.txt"],
    ["nested escape above root", "../outside.txt"],
    ["inner escape above root", "a/../../outside.txt"],
    ["backslash escape", "..\\outside.txt"],
    ["POSIX absolute path", "/etc/passwd"],
    ["Windows drive path", "C:/repo/file.txt"],
    ["UNC path", "\\\\server\\share\\file.txt"],
    ["NUL byte", "src/app\0.ts"],
    ["newline control character", "src/app\n.ts"],
    ["dot only", "."],
    ["collapses to root", "src/.."]
  ])("refuses %s", (_label, candidate) => {
    const normalized = normalizeFileHistoryPath(candidate);
    expect("problem" in normalized).toBe(true);
  });
});

describe("parseFileHistoryRecords", () => {
  const hash = "a".repeat(40);
  const parent = "b".repeat(40);

  it("parses NUL-terminated records and keeps unit separators inside subjects", () => {
    const raw =
      [hash, parent, "Ann", "ann@example.test", String(T1_UNIX), `fix${US}subject`].join(US) +
      NUL +
      [parent, "", "Bob", "bob@example.test", String(T2_UNIX), "initial"].join(US) +
      NUL;

    expect(parseFileHistoryRecords(raw)).toEqual([
      {
        hash,
        parentHashes: [parent],
        author: "Ann",
        email: "ann@example.test",
        date: T1_UNIX,
        message: `fix${US}subject`
      },
      {
        hash: parent,
        parentHashes: [],
        author: "Bob",
        email: "bob@example.test",
        date: T2_UNIX,
        message: "initial"
      }
    ]);
  });

  it("returns an empty array for empty output", () => {
    expect(parseFileHistoryRecords("")).toEqual([]);
  });

  it("throws FileHistoryFormatError on malformed records", () => {
    expect(() => parseFileHistoryRecords(`${hash}${US}only-two${NUL}`)).toThrow(
      FileHistoryFormatError
    );
    expect(() =>
      parseFileHistoryRecords(
        ["not-a-hash", "", "Ann", "a@t", String(T1_UNIX), "msg"].join(US) + NUL
      )
    ).toThrow(FileHistoryFormatError);
    expect(() =>
      parseFileHistoryRecords([hash, "", "Ann", "a@t", "not-a-time", "msg"].join(US) + NUL)
    ).toThrow(FileHistoryFormatError);
  });
});

describe("loadFileHistory", () => {
  it("lists commits touching a renamed file with and without --follow", async () => {
    const dir = initRepo();
    const body = "line 1\nline 2\nline 3\nline 4\nline 5\n";
    writeFile(dir, "docs/old.txt", body);
    const added = commitAll(dir, "add old", {
      GIT_AUTHOR_DATE: T1,
      GIT_COMMITTER_DATE: T1
    });

    writeFile(dir, "other.txt", "unrelated\n");
    commitAll(dir, "unrelated commit", {
      GIT_AUTHOR_DATE: T2,
      GIT_COMMITTER_DATE: T2
    });

    run(["mv", "docs/old.txt", "docs/new.txt"], dir);
    const renamed = commitAll(dir, "rename to new", {
      GIT_AUTHOR_DATE: T2,
      GIT_COMMITTER_DATE: T2
    });

    writeFile(dir, "docs/new.txt", `${body}line 6\n`);
    const edited = commitAll(dir, "edit new", {
      GIT_AUTHOR_DATE: T3,
      GIT_COMMITTER_DATE: T3
    });

    const git = simpleGit(dir);
    const withFollow = await loadFileHistory(git, dir, { filePath: "docs/new.txt", follow: true });
    expect(withFollow.error).toBeNull();
    expect(withFollow.filePath).toBe("docs/new.txt");
    expect(withFollow.hasMore).toBe(false);
    expect(withFollow.commits.map((entry) => entry.hash)).toEqual([edited, renamed, added]);
    expect(withFollow.commits.map((entry) => entry.message)).toEqual([
      "edit new",
      "rename to new",
      "add old"
    ]);

    const withoutFollow = await loadFileHistory(git, dir, {
      filePath: "docs/new.txt",
      follow: false
    });
    expect(withoutFollow.error).toBeNull();
    expect(withoutFollow.commits.map((entry) => entry.hash)).toEqual([edited, renamed]);
    expect(withoutFollow.commits.map((entry) => entry.message)).toEqual([
      "edit new",
      "rename to new"
    ]);

    // Default matches follow: true.
    const defaultResult = await loadFileHistory(git, dir, { filePath: "docs/new.txt" });
    expect(defaultResult.commits.map((entry) => entry.hash)).toEqual([edited, renamed, added]);
  });

  it("lists commits across all refs, newest first, and computes optional loadCount", async () => {
    const dir = initRepo();
    writeFile(dir, "shared.txt", "v1\n");
    const base = commitAll(dir, "base", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });

    run(["checkout", "-q", "-b", "side"], dir);
    writeFile(dir, "shared.txt", "v2 on side\n");
    const sideCommit = commitAll(dir, "side change", {
      GIT_AUTHOR_DATE: T3,
      GIT_COMMITTER_DATE: T3
    });

    run(["checkout", "-q", "main"], dir);
    writeFile(dir, "unrelated.txt", "noise\n");
    commitAll(dir, "main noise", { GIT_AUTHOR_DATE: T2, GIT_COMMITTER_DATE: T2 });

    const git = simpleGit(dir);
    const result = await loadFileHistory(git, dir, {
      filePath: "shared.txt",
      includeLoadCount: true
    });

    expect(result.error).toBeNull();
    expect(result.commits.map((entry) => entry.hash)).toEqual([sideCommit, base]);
    expect(result.commits[0]?.loadCount).toBe(1);
    expect(result.commits[1]?.loadCount).toBe(3);
  });

  it("reads history for a file inside a linked worktree", async () => {
    const mainDir = initRepo();
    writeFile(mainDir, "notes.txt", "initial\n");
    const first = commitAll(mainDir, "initial notes", {
      GIT_AUTHOR_DATE: T1,
      GIT_COMMITTER_DATE: T1
    });

    const linkedDir = path.join(tempDir("ggl-file-history-wt-"), "linked");
    run(["worktree", "add", "-q", linkedDir, "-b", "wt-branch"], mainDir);
    writeFile(linkedDir, "notes.txt", "initial\nfrom worktree\n");
    const wtCommit = commitAll(linkedDir, "worktree edit", {
      GIT_AUTHOR_DATE: T2,
      GIT_COMMITTER_DATE: T2
    });

    const result = await loadFileHistory(simpleGit(linkedDir), linkedDir, {
      filePath: "notes.txt"
    });
    expect(result.error).toBeNull();
    expect(result.commits.map((entry) => entry.hash)).toEqual([wtCommit, first]);
    expect(result.commits.map((entry) => entry.message)).toEqual([
      "worktree edit",
      "initial notes"
    ]);
  });

  it("respects limit, reports hasMore, and clamps above MAX_FILE_HISTORY_LIMIT", async () => {
    const dir = initRepo();
    const hashes: string[] = [];
    for (let i = 1; i <= 4; i++) {
      writeFile(dir, "count.txt", `step ${i}\n`);
      const ts = `2020-01-0${i}T00:00:00Z`;
      hashes.push(commitAll(dir, `step ${i}`, { GIT_AUTHOR_DATE: ts, GIT_COMMITTER_DATE: ts }));
    }

    const git = simpleGit(dir);
    const bounded = await loadFileHistory(git, dir, { filePath: "count.txt", limit: 2 });
    expect(bounded.error).toBeNull();
    expect(bounded.commits.map((entry) => entry.hash)).toEqual([hashes[3], hashes[2]]);
    expect(bounded.hasMore).toBe(true);

    const exact = await loadFileHistory(git, dir, { filePath: "count.txt", limit: 4 });
    expect(exact.commits).toHaveLength(4);
    expect(exact.hasMore).toBe(false);

    const records: GitCommandRecord[] = [];
    const clamped = await loadFileHistory(
      git,
      dir,
      { filePath: "count.txt", limit: MAX_FILE_HISTORY_LIMIT + 500 },
      (record) => records.push(record)
    );
    expect(clamped.error).toBeNull();
    expect(records[0]?.args).toContain(`--max-count=${MAX_FILE_HISTORY_LIMIT + 1}`);
  });

  it("passes --end-of-options and -- before the file path and uses the default limit", async () => {
    const dir = initRepo();
    writeFile(dir, "src/item.ts", "export const x = 1;\n");
    commitAll(dir, "add item");

    const records: GitCommandRecord[] = [];
    const result = await loadFileHistory(
      simpleGit(dir),
      dir,
      { filePath: "./src/item.ts" },
      (record) => records.push(record)
    );

    expect(result.error).toBeNull();
    const logRecord = records.find((record) => record.label === "fileHistory.log");
    expect(logRecord?.args).toContain("--all");
    expect(logRecord?.args).toContain("--follow");
    expect(logRecord?.args).toContain("--no-show-signature");
    expect(logRecord?.args).toContain(`--max-count=${DEFAULT_FILE_HISTORY_LIMIT + 1}`);
    expect(logRecord?.args.slice(-3)).toEqual(["--end-of-options", "--", "src/item.ts"]);
  });

  it("supports Author Date and Commit Date timestamps", async () => {
    const dir = initRepo();
    writeFile(dir, "dates.txt", "v1\n");
    commitAll(dir, "dates", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T3 });

    const git = simpleGit(dir);
    const byAuthor = await loadFileHistory(git, dir, {
      filePath: "dates.txt",
      dateType: "Author Date"
    });
    const byCommit = await loadFileHistory(git, dir, {
      filePath: "dates.txt",
      dateType: "Commit Date"
    });

    expect(byAuthor.commits[0]?.date).toBe(T1_UNIX);
    expect(byCommit.commits[0]?.date).toBe(T3_UNIX);
  });

  it("reports empty history for an untracked path or unborn repository without an error", async () => {
    const dir = initRepo();
    writeFile(dir, "tracked.txt", "a\n");
    commitAll(dir, "tracked");
    writeFile(dir, "untracked.txt", "b\n");

    const records: GitCommandRecord[] = [];
    const untracked = await loadFileHistory(
      simpleGit(dir),
      dir,
      { filePath: "untracked.txt", includeLoadCount: true },
      (record) => records.push(record)
    );
    expect(untracked).toEqual({
      commits: [],
      hasMore: false,
      filePath: "untracked.txt",
      error: null
    });
    // Empty history does not waste a second walk for positions.
    expect(records.map((record) => record.label)).toEqual(["fileHistory.log"]);

    const unborn = initRepo();
    const unbornResult = await loadFileHistory(simpleGit(unborn), unborn, {
      filePath: "missing.txt"
    });
    expect(unbornResult).toEqual({
      commits: [],
      hasMore: false,
      filePath: "missing.txt",
      error: null
    });
  });

  it.each([
    ["a leading dash", "-n1"],
    ["a double dash flag", "--output=/tmp/x"],
    ["a normalized leading dash", "./--exec=sh"],
    ["a repository escape", "../secret.txt"],
    ["an absolute path", "/etc/passwd"],
    ["a NUL character", "file\0name.txt"],
    ["a newline", "file\nname.txt"],
    ["an empty string", ""]
  ])("refuses %s without invoking Git", async (_label, filePath) => {
    const dir = initRepo();
    const records: GitCommandRecord[] = [];
    const result = await loadFileHistory(simpleGit(dir), dir, { filePath }, (record) =>
      records.push(record)
    );

    expect(result.error).not.toBeNull();
    expect(result.commits).toEqual([]);
    expect(result.filePath).toBeNull();
    expect(records).toEqual([]);
  });

  it("refuses invalid limits without invoking Git", async () => {
    const dir = initRepo();
    for (const limit of [0, -5, 1.5, Number.NaN]) {
      const records: GitCommandRecord[] = [];
      const result = await loadFileHistory(
        simpleGit(dir),
        dir,
        { filePath: "a.txt", limit },
        (record) => records.push(record)
      );
      expect(result.error).not.toBeNull();
      expect(records).toEqual([]);
    }
  });

  it("surfaces genuine Git failures as typed errors", async () => {
    const failure = Object.assign(new Error("fatal: not a git repository"), {
      result: { exitCode: 128, stdErr: "fatal: not a git repository" }
    });
    const fakeGit = {
      raw: async () => {
        throw failure;
      }
    } as unknown as SimpleGit;

    const result = await loadFileHistory(fakeGit, "/not-a-repo", { filePath: "a.txt" });
    expect(result).toEqual({
      commits: [],
      hasMore: false,
      filePath: "a.txt",
      error: {
        message: "fatal: not a git repository",
        stderr: "fatal: not a git repository",
        exitCode: 128,
        task: null
      }
    });
  });
});
