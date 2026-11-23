import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runInteractiveRebase } from "@/backend/actions/rebaseInteractive";
import { loadRebaseRange } from "@/backend/queries/rebaseRange";
import {
  type AutosquashInputCommit,
  type AutosquashTodoEntry,
  arrangeAutosquash,
  hasAutosquashMarkers,
  parseAutosquashMarker,
  parseAutosquashTodo
} from "@/backend/rebase/autosquash";

/**
 * Real-Git parity and behavior tests for autosquash preview (F2-06, IQ11).
 *
 * Every repository is a throwaway temporary directory with an isolated global
 * config (`commit.gpgsign=false` inside the temp repo only). Parity tests
 * capture Git's own `git rebase -i --autosquash` todo via a failing sequence
 * editor in a clean repo, parse it with {@link parseAutosquashTodo}, and
 * assert exact equality with {@link arrangeAutosquash}.
 */

const tempDirs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const isolatedEnv: Record<string, string> = {};

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function git(args: string[], cwd: string, env: Record<string, string> = {}): string {
  return cp.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...isolatedEnv, ...env }
  });
}

function initRepo(prefix: string): string {
  const dir = tempDir(prefix);
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "Fixture"], dir);
  git(["config", "user.email", "fixture@example.test"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  git(["config", "tag.gpgsign", "false"], dir);
  return dir;
}

function commitFile(dir: string, file: string, content: string, message: string): string {
  fs.writeFileSync(path.join(dir, file), content);
  git(["add", file], dir);
  git(["commit", "-q", "-m", message], dir);
  return git(["rev-parse", "HEAD"], dir).trim();
}

function commitEmpty(dir: string, message: string): string {
  git(["commit", "--allow-empty", "-q", "-m", message], dir);
  return git(["rev-parse", "HEAD"], dir).trim();
}

function loadCommits(dir: string, base: string): AutosquashInputCommit[] {
  const out = git(["log", "--topo-order", "--reverse", "--format=%H%x1f%s", `${base}..HEAD`], dir);
  return out
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [hash, subject] = line.split("\u001f");
      return { hash, subject };
    });
}

/**
 * Captures Git's own `git rebase -i --autosquash <base>` todo in a clean
 * fixture repository using a failing sequence editor (leaving no state dir).
 */
function captureGitAutosquash(
  dir: string,
  base: string,
  commits: readonly AutosquashInputCommit[]
): AutosquashTodoEntry[] {
  const capturePath = path.join(tempDir("ggl-as-cap-"), "todo");
  const result = cp.spawnSync("git", ["rebase", "-i", "--autosquash", base], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      ...isolatedEnv,
      GIT_SEQUENCE_EDITOR: 'sh -c \'cp -- "$2" "$1" && exit 1\' _ "$GGL_CAPTURE_FILE"',
      GGL_CAPTURE_FILE: capturePath,
      GIT_EDITOR: "true"
    }
  });
  expect(result.status).not.toBe(0);
  expect(fs.existsSync(path.join(dir, ".git", "rebase-merge"))).toBe(false);
  const rawTodo = fs.readFileSync(capturePath, "utf8");
  return parseAutosquashTodo(rawTodo, commits);
}

beforeAll(() => {
  const emptyConfig = path.join(tempDir("ggl-as-env-"), "gitconfig");
  fs.writeFileSync(emptyConfig, "");
  const overrides: Record<string, string> = {
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    LC_ALL: "C",
    GIT_TERMINAL_PROMPT: "0"
  };
  for (const [key, value] of Object.entries(overrides)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
    isolatedEnv[key] = value;
  }
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseAutosquashMarker and hasAutosquashMarkers", () => {
  it("recognizes fixup!, squash!, amend! and strips chained prefixes", () => {
    expect(parseAutosquashMarker("fixup! Add feature")).toEqual({
      kind: "fixup",
      target: "Add feature"
    });
    expect(parseAutosquashMarker("squash!   Add feature")).toEqual({
      kind: "squash",
      target: "Add feature"
    });
    expect(parseAutosquashMarker("amend! fixup! Add feature")).toEqual({
      kind: "amend",
      target: "Add feature"
    });
    expect(parseAutosquashMarker("fixup! squash! amend! Add feature")).toEqual({
      kind: "fixup",
      target: "Add feature"
    });
  });

  it("rejects uppercase, missing-space, empty-target and plain subjects", () => {
    expect(parseAutosquashMarker("Normal commit")).toBeNull();
    expect(parseAutosquashMarker("FIXUP! Add feature")).toBeNull();
    expect(parseAutosquashMarker("fixup!Add feature")).toBeNull();
    expect(parseAutosquashMarker("fixup! ")).toBeNull();
    expect(parseAutosquashMarker("amend!   ")).toBeNull();
    expect(parseAutosquashMarker("fixup! squash! ")).toBeNull();
  });

  it("reports whether a range contains any autosquash markers", () => {
    expect(
      hasAutosquashMarkers([
        { hash: "a".repeat(40), subject: "First" },
        { hash: "b".repeat(40), subject: "Second" }
      ])
    ).toBe(false);
    expect(
      hasAutosquashMarkers([
        { hash: "a".repeat(40), subject: "First" },
        { hash: "b".repeat(40), subject: "amend! First" }
      ])
    ).toBe(true);
  });
});

describe("arrangeAutosquash parity with real Git", () => {
  it("matches by exact subject and prefers exact over prefix, matching Git", () => {
    const dir = initRepo("ggl-as-subject-");
    const base = commitEmpty(dir, "base");
    const c1 = commitEmpty(dir, "Add feature foo");
    const c2 = commitEmpty(dir, "Add feature");
    const c3 = commitEmpty(dir, "Other work");
    const fixExact = commitEmpty(dir, "fixup! Add feature");
    const sqPrefix = commitEmpty(dir, "squash! Other");

    const commits = loadCommits(dir, base);
    const actual = arrangeAutosquash(commits);
    const expected = captureGitAutosquash(dir, base, commits);

    expect(actual).toEqual(expected);
    expect(actual).toEqual([
      { action: "pick", hash: c1 },
      { action: "pick", hash: c2 },
      { action: "fixup", hash: fixExact },
      { action: "pick", hash: c3 },
      { action: "squash", hash: sqPrefix }
    ]);
  });

  it("matches by hash prefix (4+ hex digits, case-insensitive) and ignores <4 hex digits", () => {
    const dir = initRepo("ggl-as-hash-");
    const base = commitEmpty(dir, "base");
    const alpha = commitEmpty(dir, "Alpha commit");
    const beta = commitEmpty(dir, "Beta commit");
    const f4 = commitEmpty(dir, `fixup! ${alpha.slice(0, 4)}`);
    const fUpper = commitEmpty(dir, `squash! ${beta.slice(0, 7).toUpperCase()}`);
    const fTooShort = commitEmpty(dir, `fixup! ${alpha.slice(0, 3)}`);

    const commits = loadCommits(dir, base);
    const actual = arrangeAutosquash(commits);
    const expected = captureGitAutosquash(dir, base, commits);

    expect(actual).toEqual(expected);
    expect(actual).toEqual([
      { action: "pick", hash: alpha },
      { action: "fixup", hash: f4 },
      { action: "pick", hash: beta },
      { action: "squash", hash: fUpper },
      { action: "pick", hash: fTooShort }
    ]);
  });

  it("handles chained markers (prefix chains and hash chains), matching Git order", () => {
    const dir = initRepo("ggl-as-chain-");
    const base = commitEmpty(dir, "base");
    const a = commitEmpty(dir, "Feature A");
    const b = commitEmpty(dir, "Feature B");
    const f1 = commitEmpty(dir, "fixup! Feature A");
    const f2 = commitEmpty(dir, `fixup! ${f1.slice(0, 7)}`);
    const f3 = commitEmpty(dir, "squash! fixup! Feature A");
    const f4 = commitEmpty(dir, `amend! ${f2.slice(0, 7)}`);

    const commits = loadCommits(dir, base);
    const actual = arrangeAutosquash(commits);
    const expected = captureGitAutosquash(dir, base, commits);

    expect(actual).toEqual(expected);
    expect(actual).toEqual([
      { action: "pick", hash: a },
      { action: "fixup", hash: f1 },
      { action: "squash", hash: f3 },
      { action: "fixup", hash: f2 },
      { action: "fixup", hash: f4, fixupFlag: "-C" },
      { action: "pick", hash: b }
    ]);
  });

  it("turns amend! into fixup -C, matching Git", () => {
    const dir = initRepo("ggl-as-amend-");
    const base = commitEmpty(dir, "base");
    const target = commitEmpty(dir, "Initial subject");
    const other = commitEmpty(dir, "Unrelated commit");
    const reword = commitEmpty(dir, "amend! Initial subject\n\nBetter subject\n\nWith details");

    const commits = loadCommits(dir, base);
    const actual = arrangeAutosquash(commits);
    const expected = captureGitAutosquash(dir, base, commits);

    expect(actual).toEqual(expected);
    expect(actual).toEqual([
      { action: "pick", hash: target },
      { action: "fixup", hash: reword, fixupFlag: "-C" },
      { action: "pick", hash: other }
    ]);
  });

  it("leaves unmatched markers and markers targeting commits outside the range as pick", () => {
    const dir = initRepo("ggl-as-nomatch-");
    const outside = commitEmpty(dir, "Outside commit");
    const base = commitEmpty(dir, "Range base");
    const inside = commitEmpty(dir, "Inside commit");
    const noMatch = commitEmpty(dir, "fixup! Does not exist");
    const outsideSubject = commitEmpty(dir, "fixup! Outside commit");
    const outsideHash = commitEmpty(dir, `fixup! ${outside.slice(0, 7)}`);
    const forwardMarker = commitEmpty(dir, "fixup! Later commit");
    const later = commitEmpty(dir, "Later commit");

    const commits = loadCommits(dir, base);
    const actual = arrangeAutosquash(commits);
    const expected = captureGitAutosquash(dir, base, commits);

    expect(actual).toEqual(expected);
    expect(actual).toEqual([
      { action: "pick", hash: inside },
      { action: "pick", hash: noMatch },
      { action: "pick", hash: outsideSubject },
      { action: "pick", hash: outsideHash },
      { action: "pick", hash: forwardMarker },
      { action: "pick", hash: later }
    ]);
  });

  it("produces the exact same preview on a dirty working tree and dirty index without touching them", async () => {
    const dir = initRepo("ggl-as-dirty-");
    const base = commitFile(dir, "a.txt", "base\n", "base");
    const alpha = commitFile(dir, "a.txt", "alpha\n", "Alpha");
    const beta = commitFile(dir, "b.txt", "beta\n", "Beta");
    const fix = commitFile(dir, "a.txt", "alpha fixed\n", "fixup! Alpha");

    const cleanCommits = loadCommits(dir, base);
    const cleanPreview = arrangeAutosquash(cleanCommits);
    const gitPreview = captureGitAutosquash(dir, base, cleanCommits);
    expect(cleanPreview).toEqual(gitPreview);

    // Dirty both index (staged) and working tree (unstaged) on the same file.
    fs.writeFileSync(path.join(dir, "a.txt"), "staged version\n");
    git(["add", "a.txt"], dir);
    fs.writeFileSync(path.join(dir, "a.txt"), "unstaged version\n");
    fs.writeFileSync(path.join(dir, "untracked.txt"), "new\n");

    const range = await loadRebaseRange(simpleGit(dir), { repo: dir, base });
    expect(range.error).toBeNull();
    expect(range.dirty).toBe(true);

    const dirtyPreview = arrangeAutosquash(range.commits);
    expect(dirtyPreview).toEqual(cleanPreview);
    expect(dirtyPreview).toEqual([
      { action: "pick", hash: alpha },
      { action: "fixup", hash: fix },
      { action: "pick", hash: beta }
    ]);

    // Verify neither staged index nor working tree was disturbed by previewing.
    expect(git(["diff", "--cached", "--name-only"], dir).trim()).toBe("a.txt");
    expect(git(["show", ":a.txt"], dir)).toBe("staged version\n");
    expect(fs.readFileSync(path.join(dir, "a.txt"), "utf8")).toBe("unstaged version\n");
    expect(fs.existsSync(path.join(dir, ".git", "rebase-merge"))).toBe(false);
  });

  it("executes an autosquashed fixup and amend! (fixup -C) end-to-end through runInteractiveRebase", async () => {
    const dir = initRepo("ggl-as-e2e-");
    const base = commitFile(dir, "base.txt", "base\n", "base");
    const alpha = commitFile(dir, "alpha.txt", "v1\n", "Alpha feature");
    const beta = commitFile(dir, "beta.txt", "b1\n", "Beta feature");
    // Create a fixup for non-HEAD commit alpha, and an amend! reword for alpha.
    commitFile(dir, "alpha.txt", "v2\n", "fixup! Alpha feature");
    commitEmpty(dir, "amend! Alpha feature\n\nAlpha feature (refined)\n\nDetailed body");

    const range = await loadRebaseRange(simpleGit(dir), { repo: dir, base });
    expect(range.error).toBeNull();
    expect(hasAutosquashMarkers(range.commits)).toBe(true);

    const arranged = arrangeAutosquash(range.commits);
    expect(arranged[0]).toEqual({ action: "pick", hash: alpha });
    expect(arranged[1].action).toBe("fixup");
    expect(arranged[1].fixupFlag).toBeUndefined();
    expect(arranged[2].action).toBe("fixup");
    expect(arranged[2].fixupFlag).toBe("-C");
    expect(arranged[3]).toEqual({ action: "pick", hash: beta });

    const result = await runInteractiveRebase(simpleGit(dir), {
      repo: dir,
      binary: "git",
      base,
      entries: arranged,
      rangeHashes: range.commits.map((c) => c.hash)
    });
    expect(result.outcome).toBe("completed");

    const subjectsAfter = git(["log", "--reverse", "--format=%s", `${base}..HEAD`], dir)
      .trim()
      .split("\n");
    expect(subjectsAfter).toEqual(["Alpha feature (refined)", "Beta feature"]);
    const alphaBody = git(["log", "-1", "--format=%B", "HEAD~1"], dir).trim();
    expect(alphaBody).toBe("Alpha feature (refined)\n\nDetailed body");
    expect(fs.readFileSync(path.join(dir, "alpha.txt"), "utf8")).toBe("v2\n");
    expect(fs.readFileSync(path.join(dir, "beta.txt"), "utf8")).toBe("b1\n");
  });
});
