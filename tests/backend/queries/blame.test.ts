import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  BlameFormatError,
  loadBlame,
  MAX_BLAME_FILE_BYTES,
  MAX_BLAME_LINES,
  parseBlamePorcelain
} from "@/backend/queries/blame";
import type { GitBlameRequest, GitBlameResult } from "@/backend/types";
import type { GitCommandRecord, GitCommandRecorder } from "@/backend/utils/gitRunner";

const T1 = "2001-01-01T00:00:00Z";
const T1_UNIX = 978_307_200;
const T2 = "2002-02-02T00:00:00Z";
const T2_UNIX = 1_012_608_000;
const T3 = "2003-03-03T00:00:00Z";
const ZEROS = "0".repeat(40);

const tempDirs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const isolatedEnv: Record<string, string> = {};

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** Runs real Git in a fixture, with no global or system config and a fixed identity. */
function run(args: string[], cwd: string, env: Record<string, string> = {}): string {
  return cp.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...isolatedEnv, ...env }
  });
}

function initRepo(extra: string[] = []): string {
  const dir = tempDir("ggl-blame-");
  run(["init", "-q", "-b", "main", ...extra], dir);
  run(["config", "commit.gpgsign", "false"], dir);
  return dir;
}

function writeFile(dir: string, relPath: string, content: string | Buffer): void {
  const absolute = path.join(dir, ...relPath.split("/"));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

/** Stages everything and commits; returns the new HEAD hash. */
function commitAll(dir: string, message: string, env: Record<string, string> = {}): string {
  run(["add", "."], dir);
  run(["commit", "-q", "-m", message], dir, env);
  return run(["rev-parse", "HEAD"], dir).trim();
}

function blame(dir: string, request: GitBlameRequest, record?: GitCommandRecorder) {
  return loadBlame(simpleGit(dir), dir, request, record);
}

/** The hunk covering a 1-based final line, for readable assertions. */
function hunkAt(result: GitBlameResult, finalLine: number) {
  return result.hunks.find(
    (hunk) => finalLine >= hunk.startLine && finalLine < hunk.startLine + hunk.lineCount
  );
}

beforeAll(() => {
  const home = tempDir("ggl-blame-home-");
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
  // simple-git inherits this process's environment, so the query reads no real config either.
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

describe("parseBlamePorcelain", () => {
  const hashA = "a".repeat(40);
  const hashB = "b".repeat(40);
  const hashC = "c".repeat(64);
  const metaA = [
    "author Ann Author",
    "author-mail <ann@example.test>",
    `author-time ${T1_UNIX}`,
    "author-tz +0200",
    "committer Cal Committer",
    "committer-mail <cal@example.test>",
    `committer-time ${T2_UNIX}`,
    "committer-tz -0500",
    "summary first subject",
    "filename dir/file.txt"
  ];
  const metaB = [
    "author Bo",
    "author-mail <bo@example.test>",
    `author-time ${T2_UNIX}`,
    "author-tz +0000",
    "committer Bo",
    "committer-mail <bo@example.test>",
    `committer-time ${T2_UNIX}`,
    "committer-tz +0000",
    "summary second",
    "filename dir/file.txt"
  ];
  const block = (
    hash: string,
    orig: number,
    final: number,
    meta: string[],
    content: string
  ): string => `${[`${hash} ${orig} ${final} 1`, ...meta, `\t${content}`].join("\n")}\n`;

  it("parses empty output as no lines", () => {
    expect(parseBlamePorcelain("")).toEqual({ commits: {}, hunks: [], totalLines: 0 });
  });

  it("groups consecutive lines and unwraps commit metadata", () => {
    const parsed = parseBlamePorcelain(
      block(hashA, 1, 1, metaA, "one") +
        block(hashA, 2, 2, [], "two\twith tab") +
        block(hashB, 1, 3, metaB, "") +
        block(hashA, 3, 4, [], "four ütf8")
    );
    expect(parsed.totalLines).toBe(4);
    expect(parsed.hunks.map((hunk) => [hunk.commitHash, hunk.startLine, hunk.lineCount])).toEqual([
      [hashA, 1, 2],
      [hashB, 3, 1],
      [hashA, 4, 1]
    ]);
    expect(parsed.hunks[0]?.lines.map((line) => line.content)).toEqual(["one", "two\twith tab"]);
    expect(parsed.hunks[1]?.lines[0]?.content).toBe("");
    expect(parsed.commits[hashA]).toMatchObject({
      author: "Ann Author",
      authorMail: "ann@example.test",
      authorTime: T1_UNIX,
      authorTz: "+0200",
      committer: "Cal Committer",
      committerMail: "cal@example.test",
      committerTime: T2_UNIX,
      committerTz: "-0500",
      summary: "first subject",
      boundary: false,
      uncommitted: false,
      previous: null,
      filename: "dir/file.txt"
    });
  });

  it("reads boundary, previous and paths with spaces and non-ASCII", () => {
    const meta = [
      "author Ann",
      "author-mail <ann@example.test>",
      `author-time ${T1_UNIX}`,
      "author-tz +0000",
      "committer Ann",
      "committer-mail <ann@example.test>",
      `committer-time ${T1_UNIX}`,
      "committer-tz +0000",
      "summary ünïcode subject",
      "boundary",
      "filename dïr/fïle name.txt"
    ];
    const childMeta = [
      "author Bo",
      "author-mail <bo@example.test>",
      `author-time ${T2_UNIX}`,
      "author-tz +0000",
      "committer Bo",
      "committer-mail <bo@example.test>",
      `committer-time ${T2_UNIX}`,
      "committer-tz +0000",
      "summary rename",
      `previous ${hashA} old name.txt`,
      "filename new name.txt"
    ];
    const parsed = parseBlamePorcelain(
      block(hashA, 1, 1, meta, "x") + block(hashB, 1, 2, childMeta, "y")
    );
    expect(parsed.commits[hashA]?.boundary).toBe(true);
    expect(parsed.commits[hashA]?.filename).toBe("dïr/fïle name.txt");
    expect(parsed.commits[hashA]?.summary).toBe("ünïcode subject");
    expect(parsed.hunks[1]?.previous).toEqual({ hash: hashA, path: "old name.txt" });
    expect(parsed.hunks[1]?.filename).toBe("new name.txt");
    expect(parsed.commits[hashB]?.previous).toEqual({ hash: hashA, path: "old name.txt" });
  });

  it("marks the all-zero OID uncommitted, including the 64-hex form", () => {
    const zeros64 = "0".repeat(64);
    const parsed = parseBlamePorcelain(
      block(ZEROS, 1, 1, metaA, "draft") + block(zeros64, 1, 2, metaB, "draft 64")
    );
    expect(parsed.commits[ZEROS]?.uncommitted).toBe(true);
    expect(parsed.commits[zeros64]?.uncommitted).toBe(true);
    const sha256 = parseBlamePorcelain(block(hashC, 1, 1, metaA, "sha256 line"));
    expect(sha256.commits[hashC]?.uncommitted).toBe(false);
  });

  it("splits hunks when a later group of one commit names another origin file", () => {
    const parsed = parseBlamePorcelain(
      block(hashA, 1, 1, metaA, "native") +
        block(hashA, 9, 2, ["filename donor.txt"], "copied") +
        block(hashA, 10, 3, [], "copied too") +
        block(hashA, 2, 4, ["filename dir/file.txt"], "native again")
    );
    expect(parsed.hunks.map((hunk) => [hunk.filename, hunk.startLine, hunk.origStartLine])).toEqual(
      [
        ["dir/file.txt", 1, 1],
        ["donor.txt", 2, 9],
        ["dir/file.txt", 4, 2]
      ]
    );
    // The commit record keeps the first filename it was seen with.
    expect(parsed.commits[hashA]?.filename).toBe("dir/file.txt");
  });

  it("splits a hunk when origin lines jump", () => {
    const parsed = parseBlamePorcelain(
      block(hashA, 1, 1, metaA, "a") + block(hashA, 7, 2, [], "b")
    );
    expect(parsed.hunks).toHaveLength(2);
  });

  it("tolerates a CRLF stream and keeps content free of the carriage return", () => {
    const lf = block(hashA, 1, 1, metaA, "crlf text") + block(hashA, 2, 2, [], "second");
    const parsed = parseBlamePorcelain(lf.replaceAll("\n", "\r\n"));
    expect(parsed.hunks[0]?.lines.map((line) => line.content)).toEqual(["crlf text", "second"]);
    expect(parsed.commits[hashA]?.summary).toBe("first subject");
  });

  it("ignores unknown metadata keys from a newer Git", () => {
    const parsed = parseBlamePorcelain(
      block(hashA, 1, 1, [...metaA, "future-key some value", "future-flag"], "x")
    );
    expect(parsed.totalLines).toBe(1);
  });

  it("rejects malformed streams instead of guessing", () => {
    expect(() => parseBlamePorcelain("\torphan\n")).toThrow(BlameFormatError);
    expect(() => parseBlamePorcelain("author Ann\n\tx\n")).toThrow(/no header/);
    expect(() => parseBlamePorcelain(`${hashA} 1 1 1\n${hashA} 2 2 1\n\tx\n`)).toThrow(
      /missing its content/
    );
    expect(() => parseBlamePorcelain(`${hashA} 1 1 1\nauthor Ann\n`)).toThrow(
      /missing its content/
    );
    expect(() => parseBlamePorcelain("!!! not porcelain\n")).toThrow(/unexpected line/);
    expect(() => parseBlamePorcelain(block(hashA, 1, 1, ["author-time soon"], "x"))).toThrow(
      /invalid author time/
    );
    expect(() =>
      parseBlamePorcelain(block(hashA, 1, 1, ["previous not-a-hash path.txt"], "x"))
    ).toThrow(/unexpected previous/);
  });
});

describe("loadBlame at revisions", () => {
  let dir: string;
  let c1: string;
  let c2: string;

  beforeAll(() => {
    dir = initRepo();
    writeFile(dir, "basic.txt", "line one\nline two\nline three\n");
    c1 = commitAll(dir, "first commit", {
      GIT_AUTHOR_DATE: T1,
      GIT_COMMITTER_DATE: T1,
      GIT_AUTHOR_NAME: "First Author",
      GIT_AUTHOR_EMAIL: "first@example.test"
    });
    writeFile(dir, "basic.txt", "line one\nline two edited\nline three\nline four\n");
    writeFile(dir, "added.txt", "only in second\n");
    c2 = commitAll(dir, "second commit", {
      GIT_AUTHOR_DATE: T2,
      GIT_COMMITTER_DATE: T2,
      GIT_AUTHOR_NAME: "Second Author",
      GIT_AUTHOR_EMAIL: "second@example.test"
    });
  });

  it("blames HEAD with hunks, identities, boundary and previous", async () => {
    const result = await blame(dir, { filePath: "basic.txt", rev: "HEAD" });
    expect(result.error).toBeNull();
    expect(result.state).toBe("lines");
    expect(result.resolvedRev).toBe(c2);
    expect(result.totalLines).toBe(4);
    expect(result.hunks.map((hunk) => [hunk.commitHash, hunk.startLine])).toEqual([
      [c1, 1],
      [c2, 2],
      [c1, 3],
      [c2, 4]
    ]);
    expect(result.commits[c1]).toMatchObject({
      author: "First Author",
      authorMail: "first@example.test",
      authorTime: T1_UNIX,
      committerMail: "committer@example.test",
      summary: "first commit",
      boundary: true,
      uncommitted: false,
      previous: null,
      filename: "basic.txt"
    });
    expect(result.commits[c2]).toMatchObject({
      author: "Second Author",
      authorTime: T2_UNIX,
      boundary: false,
      previous: { hash: c1, path: "basic.txt" }
    });
    expect(hunkAt(result, 2)?.lines[0]?.content).toBe("line two edited");
  });

  it("resolves branch names and revision expressions to OIDs", async () => {
    const byBranch = await blame(dir, { filePath: "basic.txt", rev: "main" });
    expect(byBranch.resolvedRev).toBe(c2);
    const byExpression = await blame(dir, { filePath: "basic.txt", rev: "HEAD~1" });
    expect(byExpression.resolvedRev).toBe(c1);
    expect(byExpression.totalLines).toBe(3);
    expect(byExpression.hunks.every((hunk) => hunk.commitHash === c1)).toBe(true);
  });

  it("blames a clean working tree with no resolved revision", async () => {
    const result = await blame(dir, { filePath: "basic.txt" });
    expect(result.state).toBe("lines");
    expect(result.resolvedRev).toBeNull();
    expect(result.totalLines).toBe(4);
  });

  it("records the blame run for the command log", async () => {
    const records: GitCommandRecord[] = [];
    const result = await blame(dir, { filePath: "basic.txt", rev: "HEAD" }, (record) => {
      records.push(record);
    });
    expect(result.state).toBe("lines");
    expect(records.some((record) => record.label === "blame.read" && record.success)).toBe(true);
  });

  it("reports a path missing at an older revision as an error, at HEAD as untracked", async () => {
    const older = await blame(dir, { filePath: "added.txt", rev: c1 });
    expect(older.state).toBeNull();
    expect(older.error).not.toBeNull();
    const missingAtHead = await blame(dir, { filePath: "never-existed.txt", rev: "HEAD" });
    expect(missingAtHead).toMatchObject({ state: "untracked", error: null, resolvedRev: c2 });
  });

  it("folds dot segments in the file path", async () => {
    const result = await blame(dir, { filePath: "sub/../basic.txt", rev: "HEAD" });
    expect(result.state).toBe("lines");
  });
});

describe("loadBlame across a rename", () => {
  it("carries previous to the pre-rename path and follows it", async () => {
    const dir = initRepo();
    writeFile(dir, "orig.txt", "alpha one\nalpha two\nalpha three\n");
    const c1 = commitAll(dir, "create orig", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    run(["mv", "orig.txt", "renamed.txt"], dir);
    writeFile(dir, "renamed.txt", "alpha one edited\nalpha two\nalpha three\n");
    const c2 = commitAll(dir, "rename and edit", { GIT_AUTHOR_DATE: T3, GIT_COMMITTER_DATE: T3 });

    const result = await blame(dir, { filePath: "renamed.txt", rev: "HEAD" });
    expect(result.state).toBe("lines");
    const edited = hunkAt(result, 1);
    expect(edited?.commitHash).toBe(c2);
    expect(edited?.filename).toBe("renamed.txt");
    expect(edited?.previous).toEqual({ hash: c1, path: "orig.txt" });
    const kept = hunkAt(result, 2);
    expect(kept?.commitHash).toBe(c1);
    expect(kept?.filename).toBe("orig.txt");
    expect(result.commits[c1]?.boundary).toBe(true);

    // The parent blame the view's rewind button performs.
    const parent = await blame(dir, {
      filePath: edited?.previous?.path ?? "",
      rev: edited?.previous?.hash
    });
    expect(parent.state).toBe("lines");
    expect(parent.resolvedRev).toBe(c1);
    expect(parent.hunks.every((hunk) => hunk.commitHash === c1)).toBe(true);
    expect(parent.hunks[0]?.lines[0]?.content).toBe("alpha one");
  });
});

describe("loadBlame in the working tree and from a buffer", () => {
  function repoWithFile(): { dir: string; head: string } {
    const dir = initRepo();
    writeFile(dir, "tracked.txt", "stable one\nstable two\nstable three\n");
    const head = commitAll(dir, "tracked", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    return { dir, head };
  }

  it("attributes unsaved working-tree edits to the all-zero commit", async () => {
    const { dir, head } = repoWithFile();
    writeFile(dir, "tracked.txt", "stable one\nedited two\nstable three\nbrand new\n");
    const result = await blame(dir, { filePath: "tracked.txt" });
    expect(result.state).toBe("lines");
    expect(hunkAt(result, 2)?.commitHash).toBe(ZEROS);
    expect(hunkAt(result, 4)?.commitHash).toBe(ZEROS);
    expect(result.commits[ZEROS]).toMatchObject({
      uncommitted: true,
      author: "Not Committed Yet",
      previous: { hash: head, path: "tracked.txt" }
    });
  });

  it("blames a staged but uncommitted file in the working tree", async () => {
    const { dir } = repoWithFile();
    writeFile(dir, "staged.txt", "staged line\n");
    run(["add", "staged.txt"], dir);
    const result = await blame(dir, { filePath: "staged.txt" });
    expect(result.state).toBe("lines");
    expect(result.hunks[0]?.commitHash).toBe(ZEROS);
  });

  it("calls an unstaged new file untracked, not an error", async () => {
    const { dir } = repoWithFile();
    writeFile(dir, "fresh.txt", "never committed\n");
    const result = await blame(dir, { filePath: "fresh.txt" });
    expect(result).toMatchObject({ state: "untracked", error: null, hunks: [] });
  });

  it("errors on a tracked file deleted from disk", async () => {
    const { dir } = repoWithFile();
    fs.rmSync(path.join(dir, "tracked.txt"));
    const result = await blame(dir, { filePath: "tracked.txt" });
    expect(result.state).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("blames an unsaved buffer against HEAD via --contents -", async () => {
    const { dir, head } = repoWithFile();
    const result = await blame(dir, {
      filePath: "tracked.txt",
      contents: "stable one\nbuffer edit\nstable three\n",
      binary: "git"
    });
    expect(result.state).toBe("lines");
    expect(result.resolvedRev).toBe(head);
    expect(hunkAt(result, 1)?.commitHash).toBe(head);
    expect(hunkAt(result, 2)?.commitHash).toBe(ZEROS);
    expect(result.commits[ZEROS]?.uncommitted).toBe(true);
    expect(result.commits[ZEROS]?.author).toContain("External file");
  });

  it("requires the Git binary path for buffer blame", async () => {
    const { dir } = repoWithFile();
    const result = await blame(dir, { filePath: "tracked.txt", contents: "x\n" });
    expect(result.state).toBeNull();
    expect(result.error?.message).toContain("Git binary path is required");
  });

  it("calls a buffer for a path HEAD does not know untracked", async () => {
    const { dir, head } = repoWithFile();
    const result = await blame(dir, {
      filePath: "buffer-only.txt",
      contents: "only in the editor\n",
      binary: "git"
    });
    expect(result).toMatchObject({ state: "untracked", error: null, resolvedRev: head });
  });

  it("treats an empty buffer as an empty file", async () => {
    const { dir } = repoWithFile();
    const result = await blame(dir, { filePath: "tracked.txt", contents: "", binary: "git" });
    expect(result).toMatchObject({ state: "empty", error: null, totalLines: 0 });
  });
});

describe("loadBlame blame options", () => {
  it("ignores whitespace with -w", async () => {
    const dir = initRepo();
    writeFile(dir, "w.txt", "first line\n  indented line\nlast line\n");
    const c1 = commitAll(dir, "indent", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    writeFile(dir, "w.txt", "first line\n        indented line\nlast line\n");
    const c2 = commitAll(dir, "reindent", { GIT_AUTHOR_DATE: T2, GIT_COMMITTER_DATE: T2 });

    const plain = await blame(dir, { filePath: "w.txt", rev: "HEAD" });
    expect(hunkAt(plain, 2)?.commitHash).toBe(c2);
    const ignoring = await blame(dir, { filePath: "w.txt", rev: "HEAD", ignoreWhitespace: true });
    expect(hunkAt(ignoring, 2)?.commitHash).toBe(c1);
  });

  it("detects moved lines with -M", async () => {
    const dir = initRepo();
    const blockA = [1, 2, 3, 4, 5, 6].map((n) => `block A line ${n} unique alpha content`);
    const blockB = [1, 2, 3, 4, 5, 6].map((n) => `block B line ${n} unique bravo content`);
    writeFile(dir, "swap.txt", `${[...blockA, "--- separator ---", ...blockB].join("\n")}\n`);
    const c1 = commitAll(dir, "blocks", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    writeFile(dir, "swap.txt", `${[...blockB, "--- separator ---", ...blockA].join("\n")}\n`);
    const c2 = commitAll(dir, "swap blocks", { GIT_AUTHOR_DATE: T2, GIT_COMMITTER_DATE: T2 });

    const plain = await blame(dir, { filePath: "swap.txt", rev: "HEAD" });
    expect(hunkAt(plain, 8)?.commitHash).toBe(c2);
    const moved = await blame(dir, { filePath: "swap.txt", rev: "HEAD", detectMoves: true });
    expect(hunkAt(moved, 8)?.commitHash).toBe(c1);
    expect(hunkAt(moved, 8)?.origStartLine).toBe(1);
  });

  it("detects copied lines with -C and tracks the origin file per hunk", async () => {
    const dir = initRepo();
    const source = Array.from(
      { length: 30 },
      (_, i) => `source line number ${i + 1} with some distinctive text here`
    );
    writeFile(dir, "source.txt", `${source.join("\n")}\n`);
    const c1 = commitAll(dir, "source", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    writeFile(dir, "source.txt", `${[...source, "source appended later"].join("\n")}\n`);
    writeFile(dir, "copy.txt", `copy header\n${source.slice(9, 24).join("\n")}\ncopy footer\n`);
    const c2 = commitAll(dir, "copy chunk", { GIT_AUTHOR_DATE: T2, GIT_COMMITTER_DATE: T2 });

    const plain = await blame(dir, { filePath: "copy.txt", rev: "HEAD" });
    expect(plain.hunks.every((hunk) => hunk.commitHash === c2)).toBe(true);

    const copied = await blame(dir, { filePath: "copy.txt", rev: "HEAD", detectCopies: true });
    const chunk = hunkAt(copied, 2);
    expect(chunk?.commitHash).toBe(c1);
    expect(chunk?.filename).toBe("source.txt");
    expect(chunk?.origStartLine).toBe(10);
    expect(chunk?.lineCount).toBe(15);
    expect(hunkAt(copied, 1)?.commitHash).toBe(c2);
    expect(hunkAt(copied, 17)?.commitHash).toBe(c2);
    expect(hunkAt(copied, 17)?.filename).toBe("copy.txt");
  });

  it("skips commits named by --ignore-rev and --ignore-revs-file", async () => {
    const dir = initRepo();
    writeFile(dir, "f.txt", "aaa\nbbb\nccc\n");
    const c1 = commitAll(dir, "original", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    writeFile(dir, "f.txt", "aaa  \nbbb  \nccc  \n");
    const c2 = commitAll(dir, "trailing spaces", { GIT_AUTHOR_DATE: T2, GIT_COMMITTER_DATE: T2 });

    const plain = await blame(dir, { filePath: "f.txt", rev: "HEAD" });
    expect(plain.hunks.every((hunk) => hunk.commitHash === c2)).toBe(true);

    const byRev = await blame(dir, { filePath: "f.txt", rev: "HEAD", ignoreRevs: [c2] });
    expect(byRev.state).toBe("lines");
    expect(byRev.hunks.every((hunk) => hunk.commitHash === c1)).toBe(true);

    writeFile(dir, "ignore-revs.txt", `# formatting commits\n\n${c2}\n`);
    const byFile = await blame(dir, {
      filePath: "f.txt",
      rev: "HEAD",
      ignoreRevsFile: "ignore-revs.txt"
    });
    expect(byFile.state).toBe("lines");
    expect(byFile.hunks.every((hunk) => hunk.commitHash === c1)).toBe(true);
    expect(byFile.ignoreRevsFileUsed).toBe("ignore-revs.txt");
    expect(plain.ignoreRevsFileUsed).toBeNull();
  });

  it("runs normally with a comment-only ignore file and errors on a missing one", async () => {
    const dir = initRepo();
    writeFile(dir, "f.txt", "only line\n");
    commitAll(dir, "only", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    writeFile(dir, "comments.txt", "# nothing ignored yet\n\n");

    const commented = await blame(dir, {
      filePath: "f.txt",
      rev: "HEAD",
      ignoreRevsFile: "comments.txt"
    });
    expect(commented.state).toBe("lines");
    expect(commented.ignoreRevsFileUsed).toBe("comments.txt");

    const missing = await blame(dir, {
      filePath: "f.txt",
      rev: "HEAD",
      ignoreRevsFile: "no-such-ignore.txt"
    });
    expect(missing.state).toBeNull();
    expect(missing.error?.message).toContain("no-such-ignore.txt");
  });

  it("surfaces a broken blame.ignoreRevsFile configuration as an error", async () => {
    const dir = initRepo();
    writeFile(dir, "f.txt", "only line\n");
    commitAll(dir, "only", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    run(["config", "blame.ignoreRevsFile", "missing-config-file.txt"], dir);
    const result = await blame(dir, { filePath: "f.txt", rev: "HEAD" });
    expect(result.state).toBeNull();
    expect(result.error?.message).toContain("missing-config-file.txt");
  });
});

describe("loadBlame file states", () => {
  it("calls a tracked empty file empty at a revision and in the working tree", async () => {
    const dir = initRepo();
    writeFile(dir, "empty.txt", "");
    commitAll(dir, "empty", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    const atRev = await blame(dir, { filePath: "empty.txt", rev: "HEAD" });
    expect(atRev).toMatchObject({ state: "empty", error: null, totalLines: 0, hunks: [] });
    const inTree = await blame(dir, { filePath: "empty.txt" });
    expect(inTree.state).toBe("empty");
  });

  it("refuses binary files in every mode before blaming", async () => {
    const dir = initRepo();
    writeFile(dir, "bin.dat", Buffer.from([0x41, 0x00, 0x42, 0x0a, 0x43]));
    commitAll(dir, "binary", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    const atRev = await blame(dir, { filePath: "bin.dat", rev: "HEAD" });
    expect(atRev).toMatchObject({ state: "binary", error: null });
    const inTree = await blame(dir, { filePath: "bin.dat" });
    expect(inTree.state).toBe("binary");
    const fromBuffer = await blame(dir, {
      filePath: "bin.dat",
      contents: "text\0with nul\n",
      binary: "git"
    });
    expect(fromBuffer.state).toBe("binary");
  });

  it("refuses files over the line limit in every mode", async () => {
    const dir = initRepo();
    const manyLines = "x\n".repeat(MAX_BLAME_LINES + 1);
    writeFile(dir, "big.txt", manyLines);
    commitAll(dir, "big", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    const atRev = await blame(dir, { filePath: "big.txt", rev: "HEAD" });
    expect(atRev).toMatchObject({
      state: "tooLarge",
      error: null,
      totalLines: MAX_BLAME_LINES + 1
    });
    const fromBuffer = await blame(dir, {
      filePath: "big.txt",
      contents: manyLines,
      binary: "git"
    });
    expect(fromBuffer.state).toBe("tooLarge");

    writeFile(dir, "big-untracked.txt", manyLines);
    const inTree = await blame(dir, { filePath: "big-untracked.txt" });
    expect(inTree.state).toBe("tooLarge");
  });

  it("refuses content over the byte limit", async () => {
    const dir = initRepo();
    writeFile(dir, "f.txt", "small\n");
    commitAll(dir, "small", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    const result = await blame(dir, {
      filePath: "f.txt",
      contents: "x".repeat(MAX_BLAME_FILE_BYTES + 1),
      binary: "git"
    });
    expect(result).toMatchObject({ state: "tooLarge", error: null, totalLines: 1 });
  });

  it("answers unborn for a repository with no commit yet", async () => {
    const dir = initRepo();
    writeFile(dir, "u.txt", "unborn line\n");
    run(["add", "u.txt"], dir);
    const inTree = await blame(dir, { filePath: "u.txt" });
    expect(inTree).toMatchObject({ state: "unborn", error: null });
    const atHead = await blame(dir, { filePath: "u.txt", rev: "HEAD" });
    expect(atHead.state).toBe("unborn");
    const fromBuffer = await blame(dir, { filePath: "u.txt", contents: "x\n", binary: "git" });
    expect(fromBuffer.state).toBe("unborn");
    const byBranch = await blame(dir, { filePath: "u.txt", rev: "main" });
    expect(byBranch.state).toBeNull();
    expect(byBranch.error?.message).toContain("is not a commit");
  });

  it("blames non-ASCII paths with spaces", async () => {
    const dir = initRepo();
    const relPath = "dïr/fïle name.txt";
    writeFile(dir, relPath, "ünïcode line\n");
    commitAll(dir, "unicode path", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    const atRev = await blame(dir, { filePath: relPath, rev: "HEAD" });
    expect(atRev.state).toBe("lines");
    expect(atRev.hunks[0]?.filename).toBe(relPath);
    expect(atRev.hunks[0]?.lines[0]?.content).toBe("ünïcode line");
    const inTree = await blame(dir, { filePath: relPath });
    expect(inTree.state).toBe("lines");
  });
});

describe("loadBlame in bare repositories and linked worktrees", () => {
  function seedRepo(): string {
    const dir = initRepo();
    writeFile(dir, "seed.txt", "seed one\nseed two\n");
    commitAll(dir, "seed", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
    return dir;
  }

  it("blames a bare repository at a revision and refuses its working tree", async () => {
    const dir = seedRepo();
    const bare = tempDir("ggl-blame-bare-");
    run(["clone", "-q", "--bare", dir, bare], os.tmpdir());

    const atRev = await loadBlame(simpleGit(bare), bare, { filePath: "seed.txt", rev: "HEAD" });
    expect(atRev.state).toBe("lines");
    expect(atRev.totalLines).toBe(2);

    const inTree = await loadBlame(simpleGit(bare), bare, { filePath: "seed.txt" });
    expect(inTree.state).toBeNull();
    expect(inTree.error?.message).toContain("bare repository has no working tree");

    const fromBuffer = await loadBlame(simpleGit(bare), bare, {
      filePath: "seed.txt",
      rev: "HEAD",
      contents: "seed one\nseed two\nbuffer three\n",
      binary: "git"
    });
    expect(fromBuffer.state).toBe("lines");
    expect(hunkAt(fromBuffer, 3)?.commitHash).toBe(ZEROS);
  });

  it("blames the working tree of a linked worktree", async () => {
    const dir = seedRepo();
    const linked = path.join(os.tmpdir(), `${path.basename(dir)}-linked`);
    tempDirs.push(linked);
    run(["worktree", "add", "-q", linked], dir);

    const clean = await loadBlame(simpleGit(linked), linked, { filePath: "seed.txt" });
    expect(clean.state).toBe("lines");
    writeFile(linked, "seed.txt", "seed one edited\nseed two\n");
    const dirty = await loadBlame(simpleGit(linked), linked, { filePath: "seed.txt" });
    expect(hunkAt(dirty, 1)?.commitHash).toBe(ZEROS);
    const atRev = await loadBlame(simpleGit(linked), linked, {
      filePath: "seed.txt",
      rev: "HEAD"
    });
    expect(atRev.state).toBe("lines");
    expect(atRev.hunks[0]?.lines[0]?.content).toBe("seed one");
  });
});

describe("loadBlame input validation", () => {
  let dir: string;

  beforeAll(() => {
    dir = initRepo();
    writeFile(dir, "basic.txt", "line\n");
    commitAll(dir, "basic", { GIT_AUTHOR_DATE: T1, GIT_COMMITTER_DATE: T1 });
  });

  it("rejects unusable file paths before running Git", async () => {
    const cases: Array<[string, RegExp]> = [
      ["", /path is required/],
      ["../outside.txt", /stay inside the repository/],
      ["a/../../outside.txt", /stay inside the repository/],
      ["/absolute.txt", /relative to the repository root/],
      ["a\0b.txt", /NUL byte/],
      [".", /name a file inside the repository/]
    ];
    for (const [filePath, pattern] of cases) {
      const result = await blame(dir, { filePath });
      expect(result.state, filePath).toBeNull();
      expect(result.error?.message, filePath).toMatch(pattern);
    }
  });

  it("rejects revisions that could be read as options", async () => {
    const cases: Array<[GitBlameRequest, RegExp]> = [
      [{ filePath: "basic.txt", rev: "" }, /cannot be empty/],
      [{ filePath: "basic.txt", rev: "-w" }, /cannot start with a dash/],
      [
        { filePath: "basic.txt", rev: "--ignore-revs-file=/etc/passwd" },
        /cannot start with a dash/
      ],
      [{ filePath: "basic.txt", rev: "HEAD\u0007" }, /control characters/],
      [{ filePath: "basic.txt", rev: "HEAD", ignoreRevs: ["-C"] }, /ignored revision/],
      [{ filePath: "basic.txt", rev: "HEAD", ignoreRevs: [""] }, /ignored revision/],
      [{ filePath: "basic.txt", rev: "HEAD", ignoreRevsFile: "" }, /ignore revisions file/]
    ];
    for (const [request, pattern] of cases) {
      const result = await blame(dir, request);
      expect(result.state, JSON.stringify(request)).toBeNull();
      expect(result.error?.message, JSON.stringify(request)).toMatch(pattern);
    }
  });

  it("reports an unknown revision as not a commit", async () => {
    const result = await blame(dir, { filePath: "basic.txt", rev: "no-such-ref" });
    expect(result.state).toBeNull();
    expect(result.error?.message).toBe('"no-such-ref" is not a commit.');
    expect(result.resolvedRev).toBeNull();
  });
});
