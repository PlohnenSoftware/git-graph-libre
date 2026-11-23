import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  classifyRebaseOutcome,
  type InteractiveRebaseInput,
  type InteractiveRebaseResult,
  runInteractiveRebase
} from "@/backend/actions/rebaseInteractive";
import { loadRebaseRange } from "@/backend/queries/rebaseRange";
import type { TodoEntry } from "@/backend/rebase/todo";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

/**
 * Real-Git tests for the interactive rebase handoff (F2-01b). Every
 * repository is a throwaway temporary directory with an isolated global
 * config; fixture commits never sign (`commit.gpgsign=false` is set inside
 * those temporary repositories only). Outcomes are asserted by the log,
 * the file content and the state files, never by Git's message text.
 */

const tempDirs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const isolatedEnv: Record<string, string> = {};

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** Runs real Git in a fixture, with no global or system config and a fixed identity. */
function git(args: string[], cwd: string, env: Record<string, string> = {}): string {
  return cp.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...isolatedEnv, ...env }
  });
}

type Fixture = { dir: string; hashes: string[] };

/** A repository with commits base, A, B, C, each adding its own file `f<name>`. */
function makeRepo(parent?: string): Fixture {
  const dir = parent ?? tempDir("ggl-rebase-");
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "Fixture"], dir);
  git(["config", "user.email", "fixture@example.test"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  git(["config", "tag.gpgsign", "false"], dir);
  for (const name of ["base", "A", "B", "C"]) {
    fs.writeFileSync(path.join(dir, `f${name}`), `${name}\n`);
    git(["add", `f${name}`], dir);
    git(["commit", "-q", "-m", `commit ${name}`], dir);
  }
  return { dir, hashes: revList(dir) };
}

/** A repository base -> A -> B where each commit appends a line to the same file. */
function makeDependentRepo(): Fixture {
  const dir = tempDir("ggl-rebase-dep-");
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "Fixture"], dir);
  git(["config", "user.email", "fixture@example.test"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  const contents: Array<[string, string]> = [
    ["base", "one\n"],
    ["A", "one\nA2\n"],
    ["B", "one\nA2\nB3\n"]
  ];
  for (const [name, content] of contents) {
    fs.writeFileSync(path.join(dir, "f"), content);
    git(["add", "f"], dir);
    git(["commit", "-q", "-m", `commit ${name}`], dir);
  }
  return { dir, hashes: revList(dir) };
}

function revList(dir: string): string[] {
  return git(["rev-list", "--reverse", "HEAD"], dir).trim().split("\n");
}

function subjects(dir: string): string[] {
  return git(["log", "--reverse", "--format=%s", "HEAD"], dir).trim().split("\n");
}

function fullMessage(dir: string, ref: string): string {
  return git(["log", "-1", "--format=%B", ref], dir);
}

function gitDirOf(dir: string): string {
  const out = git(["rev-parse", "--git-dir"], dir).trim();
  return path.isAbsolute(out) ? out : path.join(dir, out);
}

function stateDir(dir: string): string | null {
  const gitDir = gitDirOf(dir);
  for (const name of ["rebase-merge", "rebase-apply"]) {
    const candidate = path.join(gitDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function expectNoTodoFile(dir: string): void {
  const leftovers = fs
    .readdirSync(gitDirOf(dir))
    .filter((name) => name.startsWith("ggl-rebase-todo-"));
  expect(leftovers).toEqual([]);
}

function entry(action: TodoEntry["action"], hash: string, message?: string): TodoEntry {
  return message === undefined ? { action, hash } : { action, hash, message };
}

type RunOverrides = Partial<InteractiveRebaseInput> & { records?: GitCommandRecord[] };

function rebase(
  fixture: Fixture,
  entries: TodoEntry[],
  overrides: RunOverrides = {}
): Promise<InteractiveRebaseResult> {
  const { records, ...input } = overrides;
  return runInteractiveRebase(
    simpleGit(fixture.dir),
    {
      repo: fixture.dir,
      binary: "git",
      base: fixture.hashes[0] as string,
      rangeHashes: fixture.hashes.slice(1),
      entries,
      ...input
    },
    records ? (record) => records.push(record) : undefined
  );
}

function continueInTerminal(dir: string): void {
  // A plain terminal continue: none of the handoff environment is present,
  // and the editor is stood in for so the test cannot block.
  git(["rebase", "--continue"], dir, { GIT_EDITOR: "true" });
}

function abort(dir: string): void {
  try {
    git(["rebase", "--abort"], dir);
  } catch {
    // Already finished: nothing to clean up.
  }
}

beforeAll(() => {
  const home = tempDir("ggl-rebase-home-");
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
  // The dedicated spawn inherits this process's environment, so the runner
  // reads no real global config either.
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

describe("classifyRebaseOutcome", () => {
  const base = {
    exitCode: 0,
    hasState: false,
    hasStoppedSha: false,
    hasProgress: false,
    hasUnmergedPaths: false
  };

  it("maps the recorded state shapes to outcomes", () => {
    expect(classifyRebaseOutcome(base)).toBe("completed");
    expect(classifyRebaseOutcome({ ...base, exitCode: 1 })).toBe("failed");
    expect(classifyRebaseOutcome({ ...base, exitCode: null })).toBe("failed");
    expect(
      classifyRebaseOutcome({
        ...base,
        exitCode: 1,
        hasState: true,
        hasStoppedSha: true,
        hasUnmergedPaths: true
      })
    ).toBe("paused-conflict");
    expect(classifyRebaseOutcome({ ...base, hasState: true, hasStoppedSha: true })).toBe(
      "paused-edit"
    );
    // A failed exec line: no stopped-sha, but `done` lists lines that ran.
    expect(classifyRebaseOutcome({ ...base, exitCode: 1, hasState: true, hasProgress: true })).toBe(
      "paused-edit"
    );
    // A todo Git refused before any line ran (a leading fixup, verbatim Git).
    expect(classifyRebaseOutcome({ ...base, exitCode: 1, hasState: true })).toBe("invalid-todo");
  });
});

describe("runInteractiveRebase (real Git)", () => {
  it("reorders commits", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [entry("pick", c), entry("pick", a), entry("pick", b)]);
    expect(result).toMatchObject({ outcome: "completed", exitCode: 0 });
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit C", "commit A", "commit B"]);
    expect(fs.readFileSync(path.join(fixture.dir, "fB"), "utf8")).toBe("B\n");
    expect(stateDir(fixture.dir)).toBeNull();
    expectNoTodoFile(fixture.dir);
  });

  it("drops a commit", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [entry("pick", a), entry("drop", b), entry("pick", c)]);
    expect(result.outcome).toBe("completed");
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit C"]);
    expect(fs.existsSync(path.join(fixture.dir, "fB"))).toBe(false);
    expectNoTodoFile(fixture.dir);
  });

  it("pauses at an edit stop with exit 0 and state, then a terminal continue finishes", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [entry("edit", a), entry("pick", b), entry("pick", c)]);
    expect(result).toMatchObject({ outcome: "paused-edit", exitCode: 0 });
    const state = stateDir(fixture.dir);
    expect(state).not.toBeNull();
    expect(fs.existsSync(path.join(state as string, "stopped-sha"))).toBe(true);
    expectNoTodoFile(fixture.dir);
    continueInTerminal(fixture.dir);
    expect(stateDir(fixture.dir)).toBeNull();
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
  });

  it("pauses on a conflict with exit 1 and unmerged paths", async () => {
    const fixture = makeDependentRepo();
    const [base, a, b] = fixture.hashes as [string, string, string];
    const result = await rebase(fixture, [entry("pick", b), entry("pick", a)], {
      base,
      rangeHashes: [a, b]
    });
    expect(result).toMatchObject({ outcome: "paused-conflict", exitCode: 1 });
    expect(stateDir(fixture.dir)).not.toBeNull();
    expect(git(["diff", "--name-only", "--diff-filter=U"], fixture.dir).trim()).toBe("f");
    expectNoTodoFile(fixture.dir);
    abort(fixture.dir);
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B"]);
  });

  it("rewords a commit to a single line and removes the message files", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [
      entry("reword", a, "A renamed"),
      entry("pick", b),
      entry("pick", c)
    ]);
    expect(result.outcome).toBe("completed");
    expect(subjects(fixture.dir)).toEqual(["commit base", "A renamed", "commit B", "commit C"]);
    expect(fs.existsSync(path.join(gitDirOf(fixture.dir), "ggl-rebase"))).toBe(false);
    expectNoTodoFile(fixture.dir);
  });

  it("rewords with a multi-line message with non-ASCII, quotes, a dollar and a backtick", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const message =
      "Subject $HOME `tick` \"quoted\"\n\nBody ünïcödë, $dollar, `cmd` and 'single'\n";
    const result = await rebase(fixture, [
      entry("pick", a),
      entry("reword", b, message),
      entry("pick", c)
    ]);
    expect(result.outcome).toBe("completed");
    expect(fullMessage(fixture.dir, "HEAD~1").trim()).toBe(message.trim());
  });

  it("keeps a later reword through an edit stop and a plain terminal continue (IQ4)", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [
      entry("edit", a),
      entry("reword", b, "B after the stop"),
      entry("pick", c)
    ]);
    expect(result.outcome).toBe("paused-edit");
    const messageDir = path.join(gitDirOf(fixture.dir), "ggl-rebase");
    expect(fs.readdirSync(messageDir)).toHaveLength(1);
    continueInTerminal(fixture.dir);
    expect(subjects(fixture.dir)).toEqual([
      "commit base",
      "commit A",
      "B after the stop",
      "commit C"
    ]);
  });

  it("squashes with Git's unedited combined message", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [entry("pick", a), entry("squash", b), entry("pick", c)]);
    expect(result.outcome).toBe("completed");
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit C"]);
    expect(fullMessage(fixture.dir, "HEAD~1").trim()).toBe("commit A\n\ncommit B");
    expect(fs.existsSync(path.join(fixture.dir, "fB"))).toBe(true);
  });

  it("squashes with an edited message carried by the target", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [
      entry("pick", a, "A and B combined"),
      entry("squash", b),
      entry("pick", c)
    ]);
    expect(result.outcome).toBe("completed");
    expect(subjects(fixture.dir)).toEqual(["commit base", "A and B combined", "commit C"]);
    expect(fullMessage(fixture.dir, "HEAD~1").trim()).toBe("A and B combined");
    expect(fs.existsSync(path.join(gitDirOf(fixture.dir), "ggl-rebase"))).toBe(false);
  });

  it("fixups keep the target message, and an edited fixup group uses the target's", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [
      entry("pick", a, "A with B folded in"),
      entry("fixup", b),
      entry("pick", c)
    ]);
    expect(result.outcome).toBe("completed");
    expect(subjects(fixture.dir)).toEqual(["commit base", "A with B folded in", "commit C"]);
    expect(fs.existsSync(path.join(fixture.dir, "fB"))).toBe(true);

    const plain = makeRepo();
    const [, pa, pb, pc] = plain.hashes as [string, string, string, string];
    const plainResult = await rebase(plain, [
      entry("pick", pa),
      entry("fixup", pb),
      entry("pick", pc)
    ]);
    expect(plainResult.outcome).toBe("completed");
    expect(fullMessage(plain.dir, "HEAD~1").trim()).toBe("commit A");
  });

  it("rejects a first-entry fixup before any Git process starts", async () => {
    const fixture = makeRepo();
    const [, a, b] = fixture.hashes as [string, string, string, string];
    const records: GitCommandRecord[] = [];
    await expect(
      rebase(fixture, [entry("fixup", a), entry("pick", b)], {
        rangeHashes: [a, b],
        records
      })
    ).rejects.toThrow("first-entry-squash");
    expect(records).toEqual([]);
    expect(stateDir(fixture.dir)).toBeNull();
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
    expectNoTodoFile(fixture.dir);
  });

  it("rejects an invalid hash before any Git process starts", async () => {
    const fixture = makeRepo();
    const records: GitCommandRecord[] = [];
    await expect(
      rebase(fixture, [entry("pick", "abc123")], { rangeHashes: ["abc123"], records })
    ).rejects.toThrow("bad-hash");
    expect(records).toEqual([]);
    expect(stateDir(fixture.dir)).toBeNull();
  });

  it("reports a sequence-editor failure as failed and leaves no state", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [entry("pick", a), entry("pick", b), entry("pick", c)], {
      sequenceEditor: "false"
    });
    expect(result.outcome).toBe("failed");
    expect(result.exitCode).not.toBe(0);
    expect(stateDir(fixture.dir)).toBeNull();
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
    expectNoTodoFile(fixture.dir);
  });

  it("works in a repository path with spaces and an ampersand, exec paths included", async () => {
    const parent = tempDir("ggl-rebase-awkward-");
    const dir = path.join(parent, "sp ace & co");
    fs.mkdirSync(dir);
    tempDirs.push(dir);
    const fixture = makeRepo(dir);
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(fixture, [
      entry("pick", c),
      entry("reword", a, "A in an awkward path"),
      entry("pick", b)
    ]);
    expect(result.outcome).toBe("completed");
    expect(subjects(dir)).toEqual(["commit base", "commit C", "A in an awkward path", "commit B"]);
    expectNoTodoFile(dir);
  });

  it("runs in a linked worktree, with state and messages in its own git dir", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    git(["branch", "topic"], fixture.dir);
    const worktreeParent = tempDir("ggl-rebase-wt-");
    const worktree = path.join(worktreeParent, "linked");
    git(["worktree", "add", "-q", worktree, "topic"], fixture.dir);
    tempDirs.push(worktree);
    const linked: Fixture = { dir: worktree, hashes: fixture.hashes };

    const result = await rebase(linked, [
      entry("edit", a),
      entry("reword", b, "B in the linked worktree"),
      entry("pick", c)
    ]);
    expect(result.outcome).toBe("paused-edit");
    const linkedGitDir = gitDirOf(worktree);
    expect(linkedGitDir).toContain(`${path.sep}worktrees${path.sep}`);
    expect(fs.existsSync(path.join(linkedGitDir, "rebase-merge"))).toBe(true);
    expect(fs.existsSync(path.join(fixture.dir, ".git", "rebase-merge"))).toBe(false);
    expect(fs.readdirSync(path.join(linkedGitDir, "ggl-rebase"))).toHaveLength(1);
    expectNoTodoFile(worktree);

    continueInTerminal(worktree);
    expect(subjects(worktree)).toEqual([
      "commit base",
      "commit A",
      "B in the linked worktree",
      "commit C"
    ]);
    // The main worktree's branch never moved.
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
  });

  it("reports a dirty tree as failed and leaves no state", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    fs.appendFileSync(path.join(fixture.dir, "fA"), "dirty\n");
    const result = await rebase(fixture, [entry("pick", c), entry("pick", a), entry("pick", b)]);
    expect(result.outcome).toBe("failed");
    expect(result.exitCode).not.toBe(0);
    expect(stateDir(fixture.dir)).toBeNull();
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
    expectNoTodoFile(fixture.dir);
  });

  it("rebases a detached HEAD", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    git(["checkout", "-q", "--detach", "HEAD"], fixture.dir);
    const result = await rebase(fixture, [entry("pick", a), entry("drop", b), entry("pick", c)]);
    expect(result.outcome).toBe("completed");
    expect(git(["rev-parse", "--abbrev-ref", "HEAD"], fixture.dir).trim()).toBe("HEAD");
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit C"]);
  });

  it("rebases a root range with --root", async () => {
    const fixture = makeRepo();
    const [root, a, b, c] = fixture.hashes as [string, string, string, string];
    const result = await rebase(
      fixture,
      [entry("pick", root), entry("drop", a), entry("pick", b), entry("pick", c)],
      { base: null, rangeHashes: fixture.hashes }
    );
    expect(result.outcome).toBe("completed");
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit B", "commit C"]);
    expect(fs.existsSync(path.join(fixture.dir, "fA"))).toBe(false);
    expectNoTodoFile(fixture.dir);
  });

  it("refuses to start while a rebase is already in progress, and leaves it intact", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const paused = await rebase(fixture, [entry("edit", a), entry("pick", b), entry("pick", c)]);
    expect(paused.outcome).toBe("paused-edit");
    await expect(
      rebase(fixture, [entry("pick", a), entry("pick", b), entry("pick", c)])
    ).rejects.toThrow("already in progress");
    expect(stateDir(fixture.dir)).not.toBeNull();
    continueInTerminal(fixture.dir);
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
  });

  it("classifies a failed exec amend (rejected by commit-msg) as a stop with progress", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const hooks = path.join(fixture.dir, "hooks");
    fs.mkdirSync(hooks);
    fs.writeFileSync(path.join(hooks, "commit-msg"), '#!/bin/sh\ngrep -q REJECT "$1" && exit 1\n');
    fs.chmodSync(path.join(hooks, "commit-msg"), 0o755);
    git(["config", "core.hooksPath", hooks], fixture.dir);

    const result = await rebase(fixture, [
      entry("reword", a, "REJECT this message"),
      entry("pick", b),
      entry("pick", c)
    ]);
    expect(result).toMatchObject({ outcome: "paused-edit", exitCode: 1 });
    const state = stateDir(fixture.dir) as string;
    expect(fs.existsSync(path.join(state, "stopped-sha"))).toBe(false);
    expect(fs.readFileSync(path.join(state, "done"), "utf8")).toContain("exec git commit --amend");
    // The message file is still there for the stop to be handled (F2-03).
    expect(fs.readdirSync(path.join(gitDirOf(fixture.dir), "ggl-rebase"))).toHaveLength(1);
    expectNoTodoFile(fixture.dir);
    abort(fixture.dir);
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
  });

  it("stashes and reapplies dirty tracked changes when autostash is enabled", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const dirtyPath = path.join(fixture.dir, "fbase");
    fs.writeFileSync(dirtyPath, "base\nlocal dirty edit\n");

    const result = await rebase(fixture, [entry("pick", c), entry("pick", a), entry("pick", b)], {
      autostash: true
    });

    expect(result).toMatchObject({ outcome: "completed", exitCode: 0 });
    expect(result.autostashConflict).toBeUndefined();
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit C", "commit A", "commit B"]);
    expect(fs.readFileSync(dirtyPath, "utf8")).toBe("base\nlocal dirty edit\n");
    expect(git(["stash", "list"], fixture.dir).trim()).toBe("");
    expect(stateDir(fixture.dir)).toBeNull();
    expectNoTodoFile(fixture.dir);
  });

  it("passes --no-autostash so Git refuses a dirty tree even when rebase.autoStash is true", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    git(["config", "rebase.autoStash", "true"], fixture.dir);
    fs.appendFileSync(path.join(fixture.dir, "fA"), "dirty\n");

    const result = await rebase(fixture, [entry("pick", c), entry("pick", a), entry("pick", b)], {
      autostash: false
    });

    expect(result.outcome).toBe("failed");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
    expect(stateDir(fixture.dir)).toBeNull();
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
    expectNoTodoFile(fixture.dir);
  });

  it("keeps the stash entry and flags autostashConflict when applying the autostash conflicts", async () => {
    const fixture = makeDependentRepo();
    const [base, a, b] = fixture.hashes as [string, string, string];
    fs.writeFileSync(path.join(fixture.dir, "f"), "one\nA2\nB3-dirty\n");

    const result = await rebase(fixture, [entry("pick", a), entry("drop", b)], {
      base,
      rangeHashes: [a, b],
      autostash: true
    });

    expect(result).toMatchObject({ outcome: "completed", exitCode: 0, autostashConflict: true });
    expect(stateDir(fixture.dir)).toBeNull();
    expect(git(["diff", "--name-only", "--diff-filter=U"], fixture.dir).trim()).toBe("f");
    expect(git(["stash", "list", "--format=%gd %gs"], fixture.dir).trim()).toBe(
      "stash@{0} autostash"
    );
    expectNoTodoFile(fixture.dir);
  });

  it("refuses a branch checked out in another worktree in preflight and reports alreadyUsedElsewhere", async () => {
    const fixture = makeRepo();
    const worktreeParent = tempDir("ggl-rebase-wt-conflict-");
    const otherWorktree = path.join(worktreeParent, "other-main");
    git(["worktree", "add", "-q", "--force", otherWorktree, "main"], fixture.dir);
    tempDirs.push(otherWorktree);

    const range = await loadRebaseRange(simpleGit(fixture.dir), {
      repo: fixture.dir,
      base: fixture.hashes[0] as string
    });

    expect(range.error).toBeNull();
    expect(range.alreadyUsedElsewhere).toBe(true);
    expect(range.preflight).toEqual({
      canStart: false,
      reasons: ["alreadyUsedElsewhere"]
    });
  });

  it("distinguishes published commits for ahead, behind and diverged states against a bare remote", async () => {
    const remote = tempDir("ggl-rebase-bare-remote-");
    git(["init", "-q", "--bare", "-b", "main"], remote);

    // Clone/push baseline with two pushed commits (base, A) and one local ahead commit (B).
    const dir = tempDir("ggl-rebase-pub-");
    git(["init", "-q", "-b", "main"], dir);
    git(["config", "user.name", "Fixture"], dir);
    git(["config", "user.email", "fixture@example.test"], dir);
    git(["config", "commit.gpgsign", "false"], dir);
    for (const name of ["base", "A"]) {
      fs.writeFileSync(path.join(dir, `f${name}`), `${name}\n`);
      git(["add", `f${name}`], dir);
      git(["commit", "-q", "-m", `commit ${name}`], dir);
    }
    git(["remote", "add", "origin", remote], dir);
    git(["push", "-q", "-u", "origin", "main"], dir);
    const [base, a] = revList(dir) as [string, string];

    // Ahead variant: B is local-only, A is published.
    fs.writeFileSync(path.join(dir, "fB"), "B\n");
    git(["add", "fB"], dir);
    git(["commit", "-q", "-m", "commit B"], dir);
    const ahead = await loadRebaseRange(simpleGit(dir), { repo: dir, base });
    expect(ahead.error).toBeNull();
    expect(ahead.commits.map((c) => [c.subject, c.isPublished])).toEqual([
      ["commit A", true],
      ["commit B", false]
    ]);

    // Behind variant: another clone pushes C to origin/main, local resets back to A and fetches.
    const peer = tempDir("ggl-rebase-peer-");
    git(["clone", "-q", remote, peer], peer);
    git(["config", "user.name", "Fixture"], peer);
    git(["config", "user.email", "fixture@example.test"], peer);
    git(["config", "commit.gpgsign", "false"], peer);
    fs.writeFileSync(path.join(peer, "fC"), "C\n");
    git(["add", "fC"], peer);
    git(["commit", "-q", "-m", "commit C"], peer);
    git(["push", "-q", "origin", "main"], peer);

    git(["fetch", "-q", "origin"], dir);
    // Diverged (both ahead with B and behind origin/main with C): A is published, B is local-only.
    const diverged = await loadRebaseRange(simpleGit(dir), { repo: dir, base });
    expect(diverged.error).toBeNull();
    expect(diverged.commits.map((c) => [c.subject, c.isPublished])).toEqual([
      ["commit A", true],
      ["commit B", false]
    ]);

    // Pure behind (HEAD at A, origin/main at C): A is published.
    git(["reset", "-q", "--hard", a], dir);
    const behind = await loadRebaseRange(simpleGit(dir), { repo: dir, base });
    expect(behind.error).toBeNull();
    expect(behind.commits.map((c) => [c.subject, c.isPublished])).toEqual([["commit A", true]]);
  });
});
