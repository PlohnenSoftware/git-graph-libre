import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { abortRebase, continueRebase, skipRebase } from "@/backend/actions/rebase";
import { runInteractiveRebase } from "@/backend/actions/rebaseInteractive";
import { loadOperationState } from "@/backend/queries/operationState";
import type { TodoEntry } from "@/backend/rebase/todo";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

/**
 * Real-Git tests for the rebase controls (F2-03): continue, skip and abort
 * against rebases the handoff (F2-01b) started and paused. Temporary
 * repositories with an isolated global config only; outcomes asserted by
 * the log, the branch tip and the state files.
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

function makeRepo(): Fixture {
  const dir = tempDir("ggl-controls-");
  initRepo(dir);
  for (const name of ["base", "A", "B", "C"]) {
    fs.writeFileSync(path.join(dir, `f${name}`), `${name}\n`);
    git(["add", `f${name}`], dir);
    git(["commit", "-q", "-m", `commit ${name}`], dir);
  }
  return { dir, hashes: revList(dir) };
}

function makeDependentRepo(): Fixture {
  const dir = tempDir("ggl-controls-dep-");
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

function subjects(dir: string): string[] {
  return git(["log", "--reverse", "--format=%s", "HEAD"], dir).trim().split("\n");
}

function head(dir: string): string {
  return git(["rev-parse", "HEAD"], dir).trim();
}

function gitDirOf(dir: string): string {
  const out = git(["rev-parse", "--git-dir"], dir).trim();
  return path.isAbsolute(out) ? out : path.join(dir, out);
}

function entry(action: TodoEntry["action"], hash: string, message?: string): TodoEntry {
  return message === undefined ? { action, hash } : { action, hash, message };
}

function start(fixture: Fixture, entries: TodoEntry[], rangeHashes = fixture.hashes.slice(1)) {
  return runInteractiveRebase(simpleGit(fixture.dir), {
    repo: fixture.dir,
    binary: "git",
    base: fixture.hashes[0] as string,
    rangeHashes,
    entries
  });
}

function controlInput(fixture: Fixture) {
  return { repo: fixture.dir, binary: "git" };
}

beforeAll(() => {
  const home = tempDir("ggl-controls-home-");
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

describe("rebase controls (real Git)", () => {
  it("continues an edit stop to completion and removes the prepared messages", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const paused = await start(fixture, [
      entry("edit", a),
      entry("reword", b, "B renamed"),
      entry("pick", c)
    ]);
    expect(paused.outcome).toBe("paused-edit");
    const gitDir = gitDirOf(fixture.dir);
    expect(fs.readdirSync(path.join(gitDir, "ggl-rebase"))).toHaveLength(1);

    const records: GitCommandRecord[] = [];
    await continueRebase(simpleGit(fixture.dir), controlInput(fixture), (record) =>
      records.push(record)
    );

    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "B renamed", "commit C"]);
    expect(fs.existsSync(path.join(gitDir, "rebase-merge"))).toBe(false);
    expect(fs.existsSync(path.join(gitDir, "ggl-rebase"))).toBe(false);
    expect(records).toContainEqual(
      expect.objectContaining({ label: "rebase.continue", kind: "action", success: true })
    );
  });

  it("refuses to continue while unmerged paths remain, leaving the stop intact (IQ9)", async () => {
    const fixture = makeDependentRepo();
    const [, a, b] = fixture.hashes as [string, string, string];
    const paused = await start(fixture, [entry("pick", b), entry("pick", a)], [a, b]);
    expect(paused.outcome).toBe("paused-conflict");

    const records: GitCommandRecord[] = [];
    await expect(
      continueRebase(simpleGit(fixture.dir), controlInput(fixture), (record) =>
        records.push(record)
      )
    ).rejects.toThrow("Unmerged paths remain");
    // No `git rebase --continue` ran, and nothing was staged for the user.
    expect(records.some((record) => record.label === "rebase.continue")).toBe(false);
    expect(git(["diff", "--name-only", "--diff-filter=U"], fixture.dir).trim()).toBe("f");
    const state = await loadOperationState(simpleGit(fixture.dir), { repo: fixture.dir });
    expect(state.rebase?.stopReason).toBe("conflict");
    git(["rebase", "--abort"], fixture.dir);
  });

  it("continues a resolved conflict to completion", async () => {
    const fixture = makeDependentRepo();
    const [, a, b] = fixture.hashes as [string, string, string];
    const paused = await start(fixture, [entry("drop", a), entry("pick", b)], [a, b]);
    expect(paused.outcome).toBe("paused-conflict");

    fs.writeFileSync(path.join(fixture.dir, "f"), "one\nB3\n");
    git(["add", "f"], fixture.dir);
    await continueRebase(simpleGit(fixture.dir), controlInput(fixture));

    expect(subjects(fixture.dir)).toEqual(["commit base", "commit B"]);
    expect(fs.readFileSync(path.join(fixture.dir, "f"), "utf8")).toBe("one\nB3\n");
    expect(fs.existsSync(path.join(gitDirOf(fixture.dir), "rebase-merge"))).toBe(false);
  });

  it("pauses again at the next edit stop instead of failing, then finishes", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    await start(fixture, [entry("edit", a), entry("edit", b), entry("pick", c)]);

    await continueRebase(simpleGit(fixture.dir), controlInput(fixture));
    const mid = await loadOperationState(simpleGit(fixture.dir), { repo: fixture.dir });
    expect(mid.rebase).toMatchObject({ stoppedHash: b, current: 2, stopReason: "edit" });

    await continueRebase(simpleGit(fixture.dir), controlInput(fixture));
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
    expect(fs.existsSync(path.join(gitDirOf(fixture.dir), "rebase-merge"))).toBe(false);
  });

  it("skips the conflicting commit and applies the rest", async () => {
    const fixture = makeDependentRepo();
    const [, a, b] = fixture.hashes as [string, string, string];
    const paused = await start(fixture, [entry("pick", b), entry("pick", a)], [a, b]);
    expect(paused.outcome).toBe("paused-conflict");

    const records: GitCommandRecord[] = [];
    await skipRebase(simpleGit(fixture.dir), controlInput(fixture), (record) =>
      records.push(record)
    );

    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A"]);
    expect(fs.readFileSync(path.join(fixture.dir, "f"), "utf8")).toBe("one\nA2\n");
    expect(fs.existsSync(path.join(gitDirOf(fixture.dir), "rebase-merge"))).toBe(false);
    expect(records).toContainEqual(
      expect.objectContaining({ label: "rebase.skip", kind: "action", success: true })
    );
  });

  it("aborts an edit stop, restoring the branch tip and removing the prepared messages", async () => {
    const fixture = makeRepo();
    const [, a, b, c] = fixture.hashes as [string, string, string, string];
    const tipBefore = head(fixture.dir);
    await start(fixture, [entry("edit", a), entry("reword", b, "B renamed"), entry("pick", c)]);
    const gitDir = gitDirOf(fixture.dir);
    expect(fs.existsSync(path.join(gitDir, "ggl-rebase"))).toBe(true);

    const records: GitCommandRecord[] = [];
    await abortRebase(simpleGit(fixture.dir), controlInput(fixture), (record) =>
      records.push(record)
    );

    expect(head(fixture.dir)).toBe(tipBefore);
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);
    expect(fs.existsSync(path.join(gitDir, "rebase-merge"))).toBe(false);
    expect(fs.existsSync(path.join(gitDir, "ggl-rebase"))).toBe(false);
    expect(records).toContainEqual(
      expect.objectContaining({ label: "rebase.abort", kind: "action", success: true })
    );
  });

  it("aborts a conflict stop, restoring the branch tip and the file", async () => {
    const fixture = makeDependentRepo();
    const [, a, b] = fixture.hashes as [string, string, string];
    const tipBefore = head(fixture.dir);
    await start(fixture, [entry("pick", b), entry("pick", a)], [a, b]);

    await abortRebase(simpleGit(fixture.dir), controlInput(fixture));

    expect(head(fixture.dir)).toBe(tipBefore);
    expect(fs.readFileSync(path.join(fixture.dir, "f"), "utf8")).toBe("one\nA2\nB3\n");
    expect(fs.existsSync(path.join(gitDirOf(fixture.dir), "rebase-merge"))).toBe(false);
  });

  it("finishes a terminal-started rebase and aborts another", async () => {
    const fixture = makeRepo();
    const [base, a, b, c] = fixture.hashes as [string, string, string, string];
    const todoFile = path.join(tempDir("ggl-controls-todo-"), "todo");
    fs.writeFileSync(todoFile, `edit ${a}\npick ${b}\npick ${c}\n`);
    git(["rebase", "-i", base], fixture.dir, {
      GIT_SEQUENCE_EDITOR: `cp -- "${todoFile}"`,
      GIT_EDITOR: "true"
    });

    await continueRebase(simpleGit(fixture.dir), controlInput(fixture));
    expect(subjects(fixture.dir)).toEqual(["commit base", "commit A", "commit B", "commit C"]);

    await expect(abortRebase(simpleGit(fixture.dir), controlInput(fixture))).rejects.toThrow();
  });
});
