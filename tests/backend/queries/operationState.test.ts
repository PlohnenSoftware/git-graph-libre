import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runInteractiveRebase } from "@/backend/actions/rebaseInteractive";
import { loadOperationState } from "@/backend/queries/operationState";
import type { TodoEntry } from "@/backend/rebase/todo";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

/**
 * Real-Git tests for the operation-state reader (F2-03). Every repository
 * is a throwaway temporary directory with an isolated global config, like
 * the handoff tests; states are produced by real rebases (through
 * `runInteractiveRebase` and through plain Git, as the terminal mode or an
 * external shell would start them) and asserted from the returned shape,
 * never from Git's message text.
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

function initRepo(dir: string): void {
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "Fixture"], dir);
  git(["config", "user.email", "fixture@example.test"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  git(["config", "tag.gpgsign", "false"], dir);
}

type Fixture = { dir: string; hashes: string[] };

/** A repository with commits base, A, B, C, each adding its own file `f<name>`. */
function makeRepo(): Fixture {
  const dir = tempDir("ggl-opstate-");
  initRepo(dir);
  for (const name of ["base", "A", "B", "C"]) {
    fs.writeFileSync(path.join(dir, `f${name}`), `${name}\n`);
    git(["add", `f${name}`], dir);
    git(["commit", "-q", "-m", `commit ${name}`], dir);
  }
  return { dir, hashes: revList(dir) };
}

/** A repository base -> A -> B where each commit appends a line to the same file. */
function makeDependentRepo(): Fixture {
  const dir = tempDir("ggl-opstate-dep-");
  initRepo(dir);
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

function gitDirOf(dir: string): string {
  const out = git(["rev-parse", "--git-dir"], dir).trim();
  return path.isAbsolute(out) ? out : path.join(dir, out);
}

function entry(action: TodoEntry["action"], hash: string, message?: string): TodoEntry {
  return message === undefined ? { action, hash } : { action, hash, message };
}

function rebase(fixture: Fixture, entries: TodoEntry[]) {
  return runInteractiveRebase(simpleGit(fixture.dir), {
    repo: fixture.dir,
    binary: "git",
    base: fixture.hashes[0] as string,
    rangeHashes: fixture.hashes.slice(1),
    entries
  });
}

/** Starts an interactive rebase with plain Git only, as a terminal would. */
function rebaseFromTerminal(dir: string, base: string, todoLines: string[]): void {
  const todoFile = path.join(tempDir("ggl-opstate-todo-"), "todo");
  fs.writeFileSync(todoFile, `${todoLines.join("\n")}\n`);
  cp.execFileSync("git", ["rebase", "-i", base], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...isolatedEnv,
      GIT_SEQUENCE_EDITOR: `cp -- "${todoFile}"`,
      GIT_EDITOR: "true"
    }
  });
}

function abort(dir: string): void {
  try {
    git(["rebase", "--abort"], dir);
  } catch {
    // Already finished: nothing to clean up.
  }
}

function load(dir: string, records?: GitCommandRecord[]) {
  return loadOperationState(simpleGit(dir), {
    repo: dir,
    recordGitCommand: records ? (record) => records.push(record) : undefined
  });
}

beforeAll(() => {
  const home = tempDir("ggl-opstate-home-");
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

describe("loadOperationState (real Git)", () => {
  it("reports no operation in a clean repository, without running Git", async () => {
    const fixture = makeRepo();
    const records: GitCommandRecord[] = [];
    const state = await load(fixture.dir, records);
    expect(state).toEqual({ kind: null, rebase: null, conflictFiles: [], error: null });
    expect(records).toEqual([]);
  });

  it("reads an edit stop: hash, subject, progress, branch and onto", async () => {
    const fixture = makeRepo();
    const [base, a, b, c] = fixture.hashes as [string, string, string, string];
    await rebase(fixture, [entry("edit", a), entry("pick", b), entry("pick", c)]);

    const state = await load(fixture.dir);
    expect(state.error).toBeNull();
    expect(state.kind).toBe("rebase");
    expect(state.conflictFiles).toEqual([]);
    expect(state.rebase).toEqual({
      backend: "merge",
      stoppedHash: a,
      subject: "commit A",
      current: 1,
      total: 3,
      branch: "main",
      onto: base,
      stopReason: "edit"
    });
    abort(fixture.dir);
  });

  it("reads a conflict stop with its unmerged files, then a resolved one as other", async () => {
    const fixture = makeDependentRepo();
    const [base, a, b] = fixture.hashes as [string, string, string];
    await runInteractiveRebase(simpleGit(fixture.dir), {
      repo: fixture.dir,
      binary: "git",
      base,
      rangeHashes: [a, b],
      entries: [entry("pick", b), entry("pick", a)]
    });

    const stopped = await load(fixture.dir);
    expect(stopped.kind).toBe("rebase");
    expect(stopped.conflictFiles).toEqual(["f"]);
    expect(stopped.rebase).toMatchObject({
      backend: "merge",
      stoppedHash: b,
      subject: "commit B",
      current: 1,
      total: 2,
      stopReason: "conflict"
    });

    // Resolved and staged, still paused: no unmerged paths (Continue is
    // allowed again), and it is not an edit stop.
    fs.writeFileSync(path.join(fixture.dir, "f"), "one\nA2\nB3\n");
    git(["add", "f"], fixture.dir);
    const resolved = await load(fixture.dir);
    expect(resolved.conflictFiles).toEqual([]);
    expect(resolved.rebase?.stopReason).toBe("other");
    abort(fixture.dir);
  });

  it("reads a failed exec stop as other, with progress but no stopped hash", async () => {
    const fixture = makeRepo();
    const [base, a, b, c] = fixture.hashes as [string, string, string, string];
    // A terminal-started rebase whose exec line fails: Git stops with state
    // left, a filled `done`, and no `stopped-sha`.
    expect(() =>
      rebaseFromTerminal(fixture.dir, base, [`pick ${a}`, "exec false", `pick ${b}`, `pick ${c}`])
    ).toThrow();
    const state = await load(fixture.dir);
    expect(state.kind).toBe("rebase");
    expect(state.rebase).toMatchObject({
      backend: "merge",
      stoppedHash: null,
      subject: null,
      current: 2,
      total: 4,
      stopReason: "other"
    });
    abort(fixture.dir);
  });

  it("detects a rebase started outside the banner, from a terminal", async () => {
    const fixture = makeRepo();
    const [base, a, b, c] = fixture.hashes as [string, string, string, string];
    rebaseFromTerminal(fixture.dir, base, [`edit ${a}`, `pick ${b}`, `pick ${c}`]);
    const state = await load(fixture.dir);
    expect(state.kind).toBe("rebase");
    expect(state.rebase).toMatchObject({ stoppedHash: a, stopReason: "edit", current: 1 });
    abort(fixture.dir);
  });

  it("does not call a stale REBASE_HEAD after success an in-progress rebase (a79f444)", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    await rebase(fixture, [entry("edit", a), entry("pick", b), entry("pick", c)]);
    git(["rebase", "--continue"], fixture.dir, { GIT_EDITOR: "true" });
    const gitDir = gitDirOf(fixture.dir);
    expect(fs.existsSync(path.join(gitDir, "rebase-merge"))).toBe(false);
    // Git leaves REBASE_HEAD behind after success; spell that stale shape
    // out so the regression holds even where a Git cleans it up.
    const rebaseHead = path.join(gitDir, "REBASE_HEAD");
    if (!fs.existsSync(rebaseHead)) fs.writeFileSync(rebaseHead, `${a}\n`);
    expect(fs.existsSync(rebaseHead)).toBe(true);
    const state = await load(fixture.dir);
    expect(state).toEqual({ kind: null, rebase: null, conflictFiles: [], error: null });
  });

  it("reads a rebase-apply state from a plain --apply rebase", async () => {
    const dir = tempDir("ggl-opstate-apply-");
    initRepo(dir);
    fs.writeFileSync(path.join(dir, "f"), "one\n");
    git(["add", "f"], dir);
    git(["commit", "-q", "-m", "commit base"], dir);
    git(["switch", "-q", "-c", "side"], dir);
    fs.writeFileSync(path.join(dir, "f"), "one\nside\n");
    git(["add", "f"], dir);
    git(["commit", "-q", "-m", "commit side"], dir);
    const sideTip = git(["rev-parse", "HEAD"], dir).trim();
    git(["switch", "-q", "main"], dir);
    fs.writeFileSync(path.join(dir, "f"), "one\nmain\n");
    git(["add", "f"], dir);
    git(["commit", "-q", "-m", "commit mainwork"], dir);
    const mainTip = git(["rev-parse", "HEAD"], dir).trim();
    expect(() => git(["rebase", "--apply", "side"], dir)).toThrow();

    const state = await load(dir);
    expect(state.kind).toBe("rebase");
    expect(state.conflictFiles).toEqual(["f"]);
    expect(state.rebase).toEqual({
      backend: "apply",
      stoppedHash: mainTip,
      subject: "commit mainwork",
      current: 1,
      total: 1,
      branch: "main",
      onto: sideTip,
      stopReason: "conflict"
    });
    abort(dir);
  });

  it("reads a linked worktree's rebase from its own git dir, not the main one", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    git(["branch", "topic"], fixture.dir);
    const worktree = path.join(tempDir("ggl-opstate-wt-"), "linked");
    git(["worktree", "add", "-q", worktree, "topic"], fixture.dir);
    tempDirs.push(worktree);
    await runInteractiveRebase(simpleGit(worktree), {
      repo: worktree,
      binary: "git",
      base: fixture.hashes[0] as string,
      rangeHashes: fixture.hashes.slice(1),
      entries: [entry("edit", a), entry("pick", b), entry("pick", c)]
    });

    const linked = await load(worktree);
    expect(linked.kind).toBe("rebase");
    expect(linked.rebase).toMatchObject({ stoppedHash: a, branch: "topic", stopReason: "edit" });

    const main = await load(fixture.dir);
    expect(main).toEqual({ kind: null, rebase: null, conflictFiles: [], error: null });
    abort(worktree);
  });

  it("reports a detached HEAD rebase with no branch", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    git(["checkout", "-q", "--detach", "HEAD"], fixture.dir);
    await rebase(fixture, [entry("edit", a), entry("pick", b), entry("pick", c)]);
    const state = await load(fixture.dir);
    expect(state.rebase).toMatchObject({ stoppedHash: a, branch: null, stopReason: "edit" });
    abort(fixture.dir);
  });

  it("reports a merge in progress as context, with no rebase state", async () => {
    const fixture = makeDependentRepo();
    git(["switch", "-q", "-c", "side", "HEAD~1"], fixture.dir);
    fs.writeFileSync(path.join(fixture.dir, "f"), "one\nside\n");
    git(["add", "f"], fixture.dir);
    git(["commit", "-q", "-m", "commit side"], fixture.dir);
    git(["switch", "-q", "main"], fixture.dir);
    expect(() => git(["merge", "side"], fixture.dir)).toThrow();
    expect(fs.existsSync(path.join(gitDirOf(fixture.dir), "MERGE_HEAD"))).toBe(true);

    const state = await load(fixture.dir);
    expect(state).toEqual({ kind: "merge", rebase: null, conflictFiles: [], error: null });
    git(["merge", "--abort"], fixture.dir);
  });

  it("detects an autostash conflict from the kept stash entry and unmerged paths without parsing text", async () => {
    const fixture = makeDependentRepo();
    const [base, a, b] = fixture.hashes as [string, string, string];
    fs.writeFileSync(path.join(fixture.dir, "f"), "one\nA2\nB3-dirty\n");

    const result = await runInteractiveRebase(simpleGit(fixture.dir), {
      repo: fixture.dir,
      binary: "git",
      base,
      rangeHashes: [a, b],
      entries: [entry("pick", a), entry("drop", b)],
      autostash: true
    });
    expect(result.outcome).toBe("completed");
    expect(result.autostashConflict).toBe(true);

    const stashHash = git(["rev-parse", "refs/stash"], fixture.dir).trim();
    const conflictState = await load(fixture.dir);
    expect(conflictState).toEqual({
      kind: null,
      rebase: null,
      conflictFiles: ["f"],
      autostashConflict: { stashSelector: "stash@{0}", stashHash },
      error: null
    });

    // Once resolved and staged, unmerged paths are gone and the conflict clears.
    fs.writeFileSync(path.join(fixture.dir, "f"), "one\nA2\nresolved\n");
    git(["add", "f"], fixture.dir);
    const resolvedState = await load(fixture.dir);
    expect(resolvedState).toEqual({ kind: null, rebase: null, conflictFiles: [], error: null });
  });

  it("ignores a normal stash entry when there are no unmerged paths", async () => {
    const fixture = makeRepo();
    fs.writeFileSync(path.join(fixture.dir, "fA"), "stashed edit\n");
    git(["stash", "push", "-q", "-m", "regular stash"], fixture.dir);

    const state = await load(fixture.dir);
    expect(state).toEqual({ kind: null, rebase: null, conflictFiles: [], error: null });
  });
});
