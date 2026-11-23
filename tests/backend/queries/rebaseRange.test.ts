import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadRebaseRange,
  parseDirtyState,
  parseRebaseRangeRecords,
  REBASE_RANGE_LENGTH_LIMIT,
  RebaseRangeFormatError
} from "@/backend/queries/rebaseRange";
import type { GitWorktree } from "@/backend/types";

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

function tryRun(args: string[], cwd: string, env: Record<string, string> = {}): void {
  try {
    run(args, cwd, env);
  } catch {
    // Conflicting merges and rebases exit non-zero on purpose in these fixtures.
  }
}

function initRepo(): string {
  const dir = tempDir("ggl-rebase-range-");
  run(["init", "-q", "-b", "main"], dir);
  run(["config", "commit.gpgsign", "false"], dir);
  return dir;
}

function write(dir: string, name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content);
}

/** Stages everything and commits it; returns the new commit's full hash. */
function commitAll(dir: string, subject: string, body?: string): string {
  run(["add", "-A"], dir);
  run(
    body === undefined
      ? ["commit", "-q", "-m", subject]
      : ["commit", "-q", "-m", subject, "-m", body],
    dir
  );
  return hashOf(dir);
}

/** Writes one new file and commits it under its own name as the subject. */
function commitFile(dir: string, name: string, body?: string): string {
  write(dir, name, `${name}\n`);
  return commitAll(dir, name, body);
}

function hashOf(dir: string, revision = "HEAD"): string {
  return run(["rev-parse", revision], dir).trim();
}

function reader(dir: string) {
  return simpleGit(dir);
}

beforeAll(() => {
  const home = tempDir("ggl-rebase-range-home-");
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

describe("parseDirtyState", () => {
  it.each([
    ["", false, false],
    ["M  f\n", true, false],
    [" M f\n", true, false],
    ["?? new\n", false, true],
    [" M f\n?? new\n", true, true],
    ["UU conflicted\n", true, false]
  ])("porcelain %j gives dirty=%s untracked=%s", (stdout, dirty, hasUntracked) => {
    expect(parseDirtyState(stdout)).toEqual({ dirty, hasUntracked });
  });
});

describe("parseRebaseRangeRecords", () => {
  it("rejects a record with too few fields", () => {
    expect(() => parseRebaseRangeRecords("only-one-field\0", null)).toThrow(RebaseRangeFormatError);
  });

  it("rejects a record whose hash is not an object name", () => {
    const record = ["nope", "", "A", "a@e.test", "subject", ""].join("\u001f");
    expect(() => parseRebaseRangeRecords(`${record}\0`, null)).toThrow(RebaseRangeFormatError);
  });
});

describe("loadRebaseRange", () => {
  it("lists base..HEAD oldest first with parents, author, subject and body", async () => {
    const dir = initRepo();
    const base = commitFile(dir, "base.txt");
    const first = commitFile(dir, "first.txt", "the body\nsecond line");
    const second = commitFile(dir, "second.txt");

    const result = await loadRebaseRange(reader(dir), { repo: dir, base });

    expect(result.error).toBeNull();
    expect(result.commits.map((commit) => commit.hash)).toEqual([first, second]);
    expect(result.commits.map((commit) => commit.subject)).toEqual(["first.txt", "second.txt"]);
    expect(result.commits[0]?.parents).toEqual([base]);
    expect(result.commits[1]?.parents).toEqual([first]);
    expect(result.commits[0]?.author).toBe("Author");
    expect(result.commits[0]?.email).toBe("author@example.test");
    expect(result.commits[0]?.body).toBe("the body\nsecond line");
    expect(result.commits[1]?.body).toBe("");
    expect(result.commits.every((commit) => !commit.isMerge && !commit.isPublished)).toBe(true);
    expect(result.mergeCount).toBe(0);
    expect(result.branch).toBe("main");
    expect(result.detached).toBe(false);
    expect(result.upstream).toBeNull();
    expect(result.dirty).toBe(false);
    expect(result.hasUntracked).toBe(false);
    expect(result.inProgress).toBe(false);
    expect(result.inProgressKind).toBeNull();
    expect(result.alreadyUsedElsewhere).toBe(false);
    expect(result.tooLong).toBe(false);
    expect(result.preflight).toEqual({ canStart: true, reasons: [] });
  });

  it("reads the whole history, root included, when the base is null", async () => {
    const dir = initRepo();
    const root = commitFile(dir, "root.txt");
    const next = commitFile(dir, "next.txt");

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.error).toBeNull();
    expect(result.commits.map((commit) => commit.hash)).toEqual([root, next]);
    expect(result.commits[0]?.parents).toEqual([]);
  });

  it("reports an empty range when the base is HEAD", async () => {
    const dir = initRepo();
    commitFile(dir, "a.txt");
    const head = hashOf(dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: head });

    expect(result.error).toBeNull();
    expect(result.commits).toEqual([]);
    expect(result.preflight).toEqual({ canStart: false, reasons: ["emptyRange"] });
  });

  it("reads a repository with no commit yet as an empty range on its branch", async () => {
    const dir = initRepo();

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.error).toBeNull();
    expect(result.commits).toEqual([]);
    expect(result.branch).toBe("main");
    expect(result.detached).toBe(false);
    expect(result.preflight).toEqual({ canStart: false, reasons: ["emptyRange"] });
  });

  it("flags merge commits and counts them", async () => {
    const dir = initRepo();
    const base = commitFile(dir, "base.txt");
    run(["checkout", "-q", "-b", "side"], dir);
    commitFile(dir, "side.txt");
    run(["checkout", "-q", "main"], dir);
    commitFile(dir, "main.txt");
    run(["merge", "-q", "--no-edit", "side"], dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base });

    expect(result.error).toBeNull();
    expect(result.commits).toHaveLength(3);
    expect(result.mergeCount).toBe(1);
    const merge = result.commits.at(-1);
    expect(merge?.isMerge).toBe(true);
    expect(merge?.parents).toHaveLength(2);
    expect(result.preflight.canStart).toBe(true);
  });

  it("splits published from local commits against a bare remote", async () => {
    const remote = tempDir("ggl-rebase-range-remote-");
    run(["init", "-q", "--bare", "-b", "main"], remote);
    const dir = initRepo();
    const base = commitFile(dir, "base.txt");
    commitFile(dir, "pushed.txt");
    run(["remote", "add", "origin", remote], dir);
    run(["push", "-q", "-u", "origin", "main"], dir);
    commitFile(dir, "local-one.txt");
    commitFile(dir, "local-two.txt");

    const result = await loadRebaseRange(reader(dir), { repo: dir, base });

    expect(result.error).toBeNull();
    expect(result.upstream).toBe("origin/main");
    expect(result.commits.map((commit) => commit.subject)).toEqual([
      "pushed.txt",
      "local-one.txt",
      "local-two.txt"
    ]);
    expect(result.commits.map((commit) => commit.isPublished)).toEqual([true, false, false]);
  });

  it("reads a detached HEAD as detached, with no branch and no upstream", async () => {
    const dir = initRepo();
    const base = commitFile(dir, "base.txt");
    const middle = commitFile(dir, "middle.txt");
    commitFile(dir, "tip.txt");
    run(["checkout", "-q", middle], dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base });

    expect(result.error).toBeNull();
    expect(result.detached).toBe(true);
    expect(result.branch).toBeNull();
    expect(result.upstream).toBeNull();
    expect(result.commits.map((commit) => commit.hash)).toEqual([middle]);
    expect(result.preflight.canStart).toBe(true);
  });

  it("calls staged changes dirty and refuses the start", async () => {
    const dir = initRepo();
    const base = commitFile(dir, "tracked.txt");
    commitFile(dir, "tip.txt");
    write(dir, "tracked.txt", "changed\n");
    run(["add", "tracked.txt"], dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base });

    expect(result.dirty).toBe(true);
    expect(result.hasUntracked).toBe(false);
    expect(result.preflight).toEqual({ canStart: false, reasons: ["dirty"] });
  });

  it("calls unstaged changes dirty", async () => {
    const dir = initRepo();
    const base = commitFile(dir, "tracked.txt");
    commitFile(dir, "tip.txt");
    write(dir, "tracked.txt", "changed\n");

    const result = await loadRebaseRange(reader(dir), { repo: dir, base });

    expect(result.dirty).toBe(true);
    expect(result.preflight.reasons).toContain("dirty");
  });

  it("reports untracked files apart: they alone are not dirty", async () => {
    const dir = initRepo();
    const base = commitFile(dir, "base.txt");
    commitFile(dir, "tip.txt");
    write(dir, "untracked.txt", "new\n");

    const result = await loadRebaseRange(reader(dir), { repo: dir, base });

    expect(result.dirty).toBe(false);
    expect(result.hasUntracked).toBe(true);
    expect(result.preflight).toEqual({ canStart: true, reasons: [] });
  });

  it("does not call a stale REBASE_HEAD an in-progress rebase", async () => {
    const dir = initRepo();
    commitFile(dir, "base.txt");
    commitFile(dir, "one.txt");
    const tip = commitFile(dir, "two.txt");
    run(["rebase", "-i", "HEAD~2"], dir, { GIT_SEQUENCE_EDITOR: "true" });
    // A finished rebase can leave REBASE_HEAD behind; write the stale file
    // when this Git cleaned it up, so the case is exercised either way.
    const rebaseHead = path.join(dir, ".git", "REBASE_HEAD");
    if (!fs.existsSync(rebaseHead)) fs.writeFileSync(rebaseHead, `${tip}\n`);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.error).toBeNull();
    expect(result.inProgress).toBe(false);
    expect(result.inProgressKind).toBeNull();
  });

  it("sees a rebase stopped on a conflict as in progress", async () => {
    const dir = initRepo();
    write(dir, "shared.txt", "base\n");
    commitAll(dir, "base");
    run(["checkout", "-q", "-b", "side"], dir);
    write(dir, "shared.txt", "side\n");
    commitAll(dir, "side");
    run(["checkout", "-q", "main"], dir);
    write(dir, "shared.txt", "main\n");
    commitAll(dir, "main");
    run(["checkout", "-q", "side"], dir);
    tryRun(["rebase", "main"], dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.error).toBeNull();
    expect(result.inProgress).toBe(true);
    expect(result.inProgressKind).toBe("rebase");
    expect(result.preflight.canStart).toBe(false);
    expect(result.preflight.reasons).toContain("inProgress");
    run(["rebase", "--abort"], dir);
  });

  it("sees a merge stopped on a conflict as in progress", async () => {
    const dir = initRepo();
    write(dir, "shared.txt", "base\n");
    commitAll(dir, "base");
    run(["checkout", "-q", "-b", "side"], dir);
    write(dir, "shared.txt", "side\n");
    commitAll(dir, "side");
    run(["checkout", "-q", "main"], dir);
    write(dir, "shared.txt", "main\n");
    commitAll(dir, "main");
    tryRun(["merge", "--no-edit", "side"], dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.inProgress).toBe(true);
    expect(result.inProgressKind).toBe("merge");
    expect(result.preflight.reasons).toContain("inProgress");
  });

  it("sees a rebase on the apply backend as in progress", async () => {
    const dir = initRepo();
    write(dir, "shared.txt", "base\n");
    commitAll(dir, "base");
    run(["checkout", "-q", "-b", "side"], dir);
    write(dir, "shared.txt", "side\n");
    commitAll(dir, "side");
    run(["checkout", "-q", "main"], dir);
    write(dir, "shared.txt", "main\n");
    commitAll(dir, "main");
    run(["checkout", "-q", "side"], dir);
    tryRun(["rebase", "--apply", "main"], dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.inProgress).toBe(true);
    expect(result.inProgressKind).toBe("rebase");
    run(["rebase", "--abort"], dir);
  });

  it("sees a cherry-pick stopped on a conflict as in progress", async () => {
    const dir = initRepo();
    write(dir, "shared.txt", "base\n");
    commitAll(dir, "base");
    run(["checkout", "-q", "-b", "side"], dir);
    write(dir, "shared.txt", "side\n");
    const side = commitAll(dir, "side");
    run(["checkout", "-q", "main"], dir);
    write(dir, "shared.txt", "main\n");
    commitAll(dir, "main");
    tryRun(["cherry-pick", side], dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.inProgress).toBe(true);
    expect(result.inProgressKind).toBe("cherry-pick");
  });

  it("sees a revert stopped on a conflict as in progress", async () => {
    const dir = initRepo();
    write(dir, "shared.txt", "one\n");
    commitAll(dir, "one");
    write(dir, "shared.txt", "two\n");
    const two = commitAll(dir, "two");
    write(dir, "shared.txt", "three\n");
    commitAll(dir, "three");
    tryRun(["revert", "--no-edit", two], dir);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.inProgress).toBe(true);
    expect(result.inProgressKind).toBe("revert");
  });

  it("reads a linked worktree through its own git directory", async () => {
    const dir = initRepo();
    write(dir, "shared.txt", "base\n");
    commitAll(dir, "base");
    run(["branch", "topic"], dir);
    run(["checkout", "-q", "-b", "side"], dir);
    write(dir, "shared.txt", "side\n");
    commitAll(dir, "side");
    run(["checkout", "-q", "main"], dir);
    write(dir, "shared.txt", "main\n");
    commitAll(dir, "main");
    const linked = path.join(tempDir("ggl-rebase-range-wt-"), "linked");
    run(["worktree", "add", "-q", linked, "topic"], dir);
    // The conflict state lands in the main worktree's git directory only.
    tryRun(["merge", "--no-edit", "side"], dir);

    const fromLinked = await loadRebaseRange(reader(linked), { repo: linked, base: null });
    const fromMain = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(fromLinked.error).toBeNull();
    expect(fromLinked.branch).toBe("topic");
    expect(fromLinked.inProgress).toBe(false);
    expect(fromLinked.alreadyUsedElsewhere).toBe(false);
    expect(fromMain.inProgress).toBe(true);
    expect(fromMain.inProgressKind).toBe("merge");
  });

  it("marks a range past the length limit tooLong without refusing it", async () => {
    const dir = makeLongRepo(REBASE_RANGE_LENGTH_LIMIT + 1);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.error).toBeNull();
    expect(result.commits).toHaveLength(REBASE_RANGE_LENGTH_LIMIT + 1);
    expect(result.tooLong).toBe(true);
    expect(result.preflight.canStart).toBe(true);
  });

  it("does not mark a range at the length limit tooLong", async () => {
    const dir = makeLongRepo(REBASE_RANGE_LENGTH_LIMIT);

    const result = await loadRebaseRange(reader(dir), { repo: dir, base: null });

    expect(result.error).toBeNull();
    expect(result.commits).toHaveLength(REBASE_RANGE_LENGTH_LIMIT);
    expect(result.tooLong).toBe(false);
  });

  it("takes alreadyUsedElsewhere from worktree data the caller holds", async () => {
    const dir = initRepo();
    const base = commitFile(dir, "base.txt");
    const tip = commitFile(dir, "tip.txt");
    const held: GitWorktree[] = [
      {
        path: dir,
        head: tip,
        branch: "main",
        detached: false,
        bare: false,
        isMain: true,
        isCurrent: true,
        locked: null,
        prunable: null
      },
      {
        path: "/somewhere/else",
        head: tip,
        branch: "main",
        detached: false,
        bare: false,
        isMain: false,
        isCurrent: false,
        locked: null,
        prunable: null
      }
    ];

    const result = await loadRebaseRange(reader(dir), { repo: dir, base, worktrees: held });

    expect(result.alreadyUsedElsewhere).toBe(true);
    expect(result.preflight).toEqual({ canStart: false, reasons: ["alreadyUsedElsewhere"] });
  });

  it("errors on a base that names no commit, and on one that must not reach Git", async () => {
    const dir = initRepo();
    commitFile(dir, "a.txt");

    const missing = await loadRebaseRange(reader(dir), { repo: dir, base: "no-such-ref" });
    const dashed = await loadRebaseRange(reader(dir), { repo: dir, base: "-abc" });
    const empty = await loadRebaseRange(reader(dir), { repo: dir, base: "" });

    expect(missing.error?.message).toContain("is not an existing commit");
    expect(missing.commits).toEqual([]);
    expect(missing.preflight).toEqual({ canStart: false, reasons: ["readFailed"] });
    expect(dashed.error).not.toBeNull();
    expect(empty.error).not.toBeNull();
  });
});

/** A repository of `count` one-file commits, built in one `git fast-import` run. */
function makeLongRepo(count: number): string {
  const dir = initRepo();
  const chunks: string[] = [];
  for (let n = 1; n <= count; n += 1) {
    const subject = `commit ${n}`;
    const content = `${n}\n`;
    chunks.push(
      "commit refs/heads/main",
      `mark :${n}`,
      "author Author <author@example.test> 1700000000 +0000",
      "committer Committer <committer@example.test> 1700000000 +0000",
      `data ${Buffer.byteLength(subject)}`,
      subject,
      ...(n > 1 ? [`from :${n - 1}`] : []),
      "M 644 inline f.txt",
      `data ${Buffer.byteLength(content)}`,
      content
    );
  }
  cp.execFileSync("git", ["fast-import", "--quiet"], {
    cwd: dir,
    input: chunks.join("\n"),
    env: { ...process.env, ...isolatedEnv }
  });
  run(["reset", "--hard", "-q", "HEAD"], dir);
  return dir;
}
