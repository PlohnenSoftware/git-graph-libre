import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dropCommit, dropCommitSelection, squashCommitSelection } from "@/backend/actions/commit";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

/**
 * Real-Git tests for drop and squash routed through the interactive todo
 * (F2-10). Every repository is a throwaway temporary directory with an
 * isolated global config; fixture commits never sign. Outcomes are
 * asserted by the log, authorship and file content, never by Git's text.
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

type Fixture = { dir: string; hashes: string[] };

function initRepo(dir: string): void {
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "Fixture"], dir);
  git(["config", "user.email", "fixture@example.test"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  git(["config", "tag.gpgsign", "false"], dir);
}

/** One commit adding its own file, authored by `Author <name>` so authorship is checkable. */
function commitFile(dir: string, name: string): string {
  fs.writeFileSync(path.join(dir, `f${name}`), `${name}\n`);
  git(["add", `f${name}`], dir);
  git(["commit", "-q", "-m", `commit ${name}`], dir, {
    GIT_AUTHOR_NAME: `Author ${name}`,
    GIT_AUTHOR_EMAIL: `${name.toLowerCase()}@example.test`
  });
  return git(["rev-parse", "HEAD"], dir).trim();
}

/** A repository with the named commits in order, each adding its own file. */
function makeRepo(names: readonly string[]): Fixture {
  const dir = tempDir("ggl-drop-squash-");
  initRepo(dir);
  for (const name of names) commitFile(dir, name);
  return { dir, hashes: revList(dir) };
}

/** Creates one commit on a side branch forked from the root and returns to `main`. */
function addSideCommit(fixture: Fixture, branchName: string, fileName: string): string {
  git(["checkout", "-q", "-b", branchName, fixture.hashes[0] as string], fixture.dir);
  const hash = commitFile(fixture.dir, fileName);
  git(["checkout", "-q", "main"], fixture.dir);
  return hash;
}

/**
 * A repository with a merge commit in `main`:
 * `root -> A -> B -> M -> D (HEAD)` with side branch `A -> X -> M`.
 */
function makeMergedRepo(): {
  dir: string;
  root: string;
  a: string;
  b: string;
  x: string;
  merge: string;
  d: string;
} {
  const dir = tempDir("ggl-drop-squash-merge-");
  initRepo(dir);
  const root = commitFile(dir, "root");
  const a = commitFile(dir, "A");
  const b = commitFile(dir, "B");
  git(["checkout", "-q", "-b", "side", a], dir);
  const x = commitFile(dir, "X");
  git(["checkout", "-q", "main"], dir);
  git(["merge", "-q", "--no-ff", "-m", "merge side", "side"], dir);
  const merge = git(["rev-parse", "HEAD"], dir).trim();
  const d = commitFile(dir, "D");
  return { dir, root, a, b, x, merge, d };
}

function revList(dir: string): string[] {
  return git(["rev-list", "--reverse", "HEAD"], dir).trim().split("\n");
}

function subjects(dir: string): string[] {
  return git(["log", "--reverse", "--format=%s", "HEAD"], dir).trim().split("\n");
}

function fullMessage(dir: string, ref: string): string {
  return git(["log", "-1", "--format=%B", ref], dir).trim();
}

function authorOf(dir: string, ref: string): string {
  return git(["log", "-1", "--format=%an <%ae>", ref], dir).trim();
}

function fileExists(dir: string, name: string): boolean {
  return fs.existsSync(path.join(dir, name));
}

function stateExists(dir: string): boolean {
  const gitDir = git(["rev-parse", "--absolute-git-dir"], dir).trim();
  return (
    fs.existsSync(path.join(gitDir, "rebase-merge")) ||
    fs.existsSync(path.join(gitDir, "rebase-apply"))
  );
}

function abortIfNeeded(dir: string): void {
  try {
    git(["rebase", "--abort"], dir);
  } catch {
    // Nothing to abort.
  }
}

beforeAll(() => {
  const home = tempDir("ggl-drop-squash-home-");
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

describe("drop through the todo (F2-10)", () => {
  it("drops one middle commit in a single rebase", async () => {
    const fixture = makeRepo(["base", "A", "B", "C", "D"]);
    const records: GitCommandRecord[] = [];
    await dropCommit(
      simpleGit(fixture.dir),
      { repo: fixture.dir, binary: "git", commitHash: fixture.hashes[2] as string },
      (record) => records.push(record)
    );
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit C", "commit D"]);
    expect(fileExists(fixture.dir, "fB")).toBe(false);
    expect(fileExists(fixture.dir, "fC")).toBe(true);
    expect(records.filter((record) => record.label === "rebase.interactive")).toHaveLength(1);
  });

  it("drops the HEAD commit", async () => {
    const fixture = makeRepo(["base", "A", "B"]);
    await dropCommit(simpleGit(fixture.dir), {
      repo: fixture.dir,
      binary: "git",
      commitHash: fixture.hashes[2] as string
    });
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A"]);
    expect(fileExists(fixture.dir, "fB")).toBe(false);
  });

  it("drops a non-contiguous selection that does not end at HEAD in one rebase", async () => {
    const fixture = makeRepo(["base", "A", "B", "C", "D", "E"]);
    const records: GitCommandRecord[] = [];
    // Oldest first on purpose: the range order, not the caller's, decides.
    await dropCommitSelection(
      simpleGit(fixture.dir),
      {
        repo: fixture.dir,
        binary: "git",
        commitHashes: [fixture.hashes[2] as string, fixture.hashes[4] as string]
      },
      (record) => records.push(record)
    );
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit C", "commit E"]);
    expect(fileExists(fixture.dir, "fB")).toBe(false);
    expect(fileExists(fixture.dir, "fD")).toBe(false);
    expect(fileExists(fixture.dir, "fE")).toBe(true);
    expect(records.filter((record) => record.label === "rebase.interactive")).toHaveLength(1);
  });

  it("drops every commit after the base, leaving HEAD on the base", async () => {
    const fixture = makeRepo(["base", "A", "B"]);
    await dropCommitSelection(simpleGit(fixture.dir), {
      repo: fixture.dir,
      binary: "git",
      commitHashes: [fixture.hashes[2] as string, fixture.hashes[1] as string]
    });
    expect(revList(fixture.dir)).toEqual([fixture.hashes[0]]);
    expect(fileExists(fixture.dir, "fA")).toBe(false);
    expect(fileExists(fixture.dir, "fB")).toBe(false);
  });

  it("drops commits from both sides of a merge while refusing the merge commit itself", async () => {
    const merged = makeMergedRepo();
    const instance = simpleGit(merged.dir);
    await expect(
      dropCommit(instance, { repo: merged.dir, binary: "git", commitHash: merged.merge })
    ).rejects.toThrow("exactly one parent");
    expect(stateExists(merged.dir)).toBe(false);

    await dropCommitSelection(instance, {
      repo: merged.dir,
      binary: "git",
      commitHashes: [merged.b, merged.x]
    });
    expect(subjects(merged.dir)).toEqual(["commit root", "commit A", "commit D"]);
    expect(fileExists(merged.dir, "fB")).toBe(false);
    expect(fileExists(merged.dir, "fX")).toBe(false);
    expect(fileExists(merged.dir, "fD")).toBe(true);
    expect(stateExists(merged.dir)).toBe(false);
  });

  it("pauses for the in-progress banner when dropping causes a conflict", async () => {
    const dir = tempDir("ggl-drop-conflict-");
    initRepo(dir);
    fs.writeFileSync(path.join(dir, "shared"), "line1\n");
    git(["add", "shared"], dir);
    git(["commit", "-q", "-m", "base"], dir);
    fs.writeFileSync(path.join(dir, "shared"), "line1\nA\n");
    git(["add", "shared"], dir);
    git(["commit", "-q", "-m", "A"], dir);
    const aHash = git(["rev-parse", "HEAD"], dir).trim();
    fs.writeFileSync(path.join(dir, "shared"), "line1\nA\nB\n");
    git(["add", "shared"], dir);
    git(["commit", "-q", "-m", "B"], dir);

    await dropCommit(simpleGit(dir), { repo: dir, binary: "git", commitHash: aHash });
    expect(stateExists(dir)).toBe(true);
    expect(git(["diff", "--name-only", "--diff-filter=U"], dir).trim()).toBe("shared");
    abortIfNeeded(dir);
    expect(subjects(dir)).toEqual(["base", "A", "B"]);
  });

  it("refuses the root commit, a short hash, an outside commit and an orphan commit", async () => {
    const fixture = makeRepo(["base", "A"]);
    const instance = simpleGit(fixture.dir);
    await expect(
      dropCommit(instance, {
        repo: fixture.dir,
        binary: "git",
        commitHash: fixture.hashes[0] as string
      })
    ).rejects.toThrow("root commit");
    await expect(
      dropCommit(instance, { repo: fixture.dir, binary: "git", commitHash: "abc123" })
    ).rejects.toThrow("full commit hash");
    const side = addSideCommit(fixture, "side", "Side");
    await expect(
      dropCommit(instance, { repo: fixture.dir, binary: "git", commitHash: side })
    ).rejects.toThrow("current branch's history");
    git(["checkout", "-q", "--orphan", "unrelated"], fixture.dir);
    git(["rm", "-rf", "-q", "."], fixture.dir);
    const orphan = commitFile(fixture.dir, "Orphan");
    git(["checkout", "-q", "main"], fixture.dir);
    await expect(
      dropCommit(instance, { repo: fixture.dir, binary: "git", commitHash: orphan })
    ).rejects.toThrow("current branch's history");
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A"]);
  });
});

describe("squash through the todo (F2-10)", () => {
  it("squashes a non-HEAD contiguous range, keeps oldest author, and replays later commits", async () => {
    const fixture = makeRepo(["base", "A", "B", "C", "D"]);
    const records: GitCommandRecord[] = [];
    await squashCommitSelection(
      simpleGit(fixture.dir),
      {
        repo: fixture.dir,
        binary: "git",
        commitHashes: [fixture.hashes[3] as string, fixture.hashes[2] as string],
        message: "B and C combined\n\nBody paragraph"
      },
      (record) => records.push(record)
    );
    expect(subjects(fixture.dir)).toEqual([
      "commit base",
      "commit A",
      "B and C combined",
      "commit D"
    ]);
    expect(fullMessage(fixture.dir, "HEAD~1")).toBe("B and C combined\n\nBody paragraph");
    expect(authorOf(fixture.dir, "HEAD~1")).toBe("Author B <b@example.test>");
    expect(authorOf(fixture.dir, "HEAD")).toBe("Author D <d@example.test>");
    expect(fileExists(fixture.dir, "fB")).toBe(true);
    expect(fileExists(fixture.dir, "fC")).toBe(true);
    expect(fileExists(fixture.dir, "fD")).toBe(true);
    expect(records.filter((record) => record.label === "rebase.interactive")).toHaveLength(1);
  });

  it("runs commit-msg hooks on squash and pauses on rejection (no bypass option)", async () => {
    const fixture = makeRepo(["base", "A", "B", "C"]);
    const hooksDir = path.join(fixture.dir, "hooks");
    fs.mkdirSync(hooksDir);
    fs.writeFileSync(
      path.join(hooksDir, "commit-msg"),
      '#!/bin/sh\ngrep -q BLOCKED "$1" && exit 1\n'
    );
    fs.chmodSync(path.join(hooksDir, "commit-msg"), 0o755);
    git(["config", "core.hooksPath", hooksDir], fixture.dir);

    await squashCommitSelection(simpleGit(fixture.dir), {
      repo: fixture.dir,
      binary: "git",
      commitHashes: [fixture.hashes[2] as string, fixture.hashes[1] as string],
      message: "BLOCKED message"
    });
    expect(stateExists(fixture.dir)).toBe(true);
    abortIfNeeded(fixture.dir);
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
  });

  it("refuses a non-contiguous selection, duplicate hashes, and sibling commits across a merge", async () => {
    const fixture = makeRepo(["base", "A", "B", "C", "D"]);
    const instance = simpleGit(fixture.dir);
    await expect(
      squashCommitSelection(instance, {
        repo: fixture.dir,
        binary: "git",
        commitHashes: [fixture.hashes[4] as string, fixture.hashes[2] as string],
        message: "non-contiguous"
      })
    ).rejects.toThrow("unbroken run");
    await expect(
      squashCommitSelection(instance, {
        repo: fixture.dir,
        binary: "git",
        commitHashes: [fixture.hashes[2] as string, (fixture.hashes[2] as string).toUpperCase()],
        message: "duplicate"
      })
    ).rejects.toThrow("distinct commit hashes");

    const merged = makeMergedRepo();
    await expect(
      squashCommitSelection(simpleGit(merged.dir), {
        repo: merged.dir,
        binary: "git",
        commitHashes: [merged.b, merged.x],
        message: "siblings"
      })
    ).rejects.toThrow("unbroken run");
    expect(stateExists(merged.dir)).toBe(false);
  });

  it("works inside a linked worktree without moving the main worktree", async () => {
    const fixture = makeRepo(["base", "A", "B", "C"]);
    git(["branch", "topic"], fixture.dir);
    const wtDir = path.join(tempDir("ggl-drop-squash-wt-"), "linked");
    git(["worktree", "add", "-q", wtDir, "topic"], fixture.dir);

    await squashCommitSelection(simpleGit(wtDir), {
      repo: wtDir,
      binary: "git",
      commitHashes: [fixture.hashes[2] as string, fixture.hashes[1] as string],
      message: "AB in worktree"
    });
    expect(subjects(wtDir)).toEqual(["commit base", "AB in worktree", "commit C"]);
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
  });
});
