import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { type SimpleGit, simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  dropCommit,
  dropCommitSelection,
  editHeadCommitMessage,
  squashCommitSelection,
  undoLastCommit
} from "@/backend/actions/commit";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function gitWithRaw(raw: (args: string[]) => Promise<string>): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

const tempDirs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const isolatedEnv: Record<string, string> = {};

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runGit(args: string[], cwd: string): string {
  return cp.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...isolatedEnv }
  });
}

function makeLinearRepo(names: readonly string[]): { dir: string; hashes: string[] } {
  const dir = tempDir("ggl-commit-advanced-");
  runGit(["init", "-q", "-b", "main"], dir);
  runGit(["config", "user.name", "Fixture"], dir);
  runGit(["config", "user.email", "fixture@example.test"], dir);
  runGit(["config", "commit.gpgsign", "false"], dir);
  for (const name of names) {
    fs.writeFileSync(path.join(dir, `${name}.txt`), `${name}\n`);
    runGit(["add", `${name}.txt`], dir);
    runGit(["commit", "-q", "-m", name], dir);
  }
  const hashes = runGit(["rev-list", "--reverse", "HEAD"], dir).trim().split("\n");
  return { dir, hashes };
}

function subjects(dir: string): string[] {
  return runGit(["log", "--reverse", "--format=%s", "HEAD"], dir).trim().split("\n");
}

beforeAll(() => {
  const home = tempDir("ggl-commit-advanced-home-");
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

describe("advanced commit actions", () => {
  it("drops a commit through one interactive rebase todo", async () => {
    const fixture = makeLinearRepo(["base", "first", "second"]);
    const records: GitCommandRecord[] = [];

    await dropCommit(
      simpleGit(fixture.dir),
      {
        repo: fixture.dir,
        binary: "git",
        commitHash: fixture.hashes[1] as string
      },
      (record) => records.push(record)
    );

    expect(subjects(fixture.dir)).toEqual(["base", "second"]);
    expect(records.filter((record) => record.label === "rebase.interactive")).toHaveLength(1);
  });

  it("drops selected commits in one interactive rebase", async () => {
    const fixture = makeLinearRepo(["base", "oldest", "middle", "newest"]);
    const records: GitCommandRecord[] = [];

    await dropCommitSelection(
      simpleGit(fixture.dir),
      {
        repo: fixture.dir,
        binary: "git",
        commitHashes: [
          fixture.hashes[3] as string,
          fixture.hashes[2] as string,
          fixture.hashes[1] as string
        ]
      },
      (record) => records.push(record)
    );

    expect(subjects(fixture.dir)).toEqual(["base"]);
    expect(records.filter((record) => record.label === "rebase.interactive")).toHaveLength(1);
  });

  it("squashes a selected commit chain through the interactive todo", async () => {
    const fixture = makeLinearRepo(["base", "oldest", "middle", "newest"]);
    const records: GitCommandRecord[] = [];

    await squashCommitSelection(
      simpleGit(fixture.dir),
      {
        repo: fixture.dir,
        binary: "git",
        commitHashes: [
          fixture.hashes[3] as string,
          fixture.hashes[2] as string,
          fixture.hashes[1] as string
        ],
        message: "combined message"
      },
      (record) => records.push(record)
    );

    expect(subjects(fixture.dir)).toEqual(["base", "combined message"]);
    expect(fs.existsSync(path.join(fixture.dir, "oldest.txt"))).toBe(true);
    expect(fs.existsSync(path.join(fixture.dir, "middle.txt"))).toBe(true);
    expect(fs.existsSync(path.join(fixture.dir, "newest.txt"))).toBe(true);
    expect(records.filter((record) => record.label === "rebase.interactive")).toHaveLength(1);
  });

  it("undoes the last commit with a soft reset", async () => {
    const git = gitWithRaw(async () => "");

    await undoLastCommit(git, { repo: "/repo" });

    expect(git.raw).toHaveBeenCalledWith(["reset", "--soft", "HEAD^"]);
  });

  it("edits the HEAD commit message with amend", async () => {
    const git = gitWithRaw(async (args) => {
      if (args[0] === "rev-parse") return "abc123\n";
      if (args[0] === "log") return "old message\n";
      return "";
    });

    await editHeadCommitMessage(git, {
      repo: "/repo",
      commitHash: "abc123",
      message: "new message\n\nbody"
    });

    expect(git.raw).toHaveBeenNthCalledWith(1, ["rev-parse", "HEAD"]);
    expect(git.raw).toHaveBeenNthCalledWith(2, ["log", "-1", "--format=%B", "HEAD"]);
    expect(git.raw).toHaveBeenNthCalledWith(3, ["commit", "--amend", "-m", "new message\n\nbody"]);
  });

  it("rejects non-HEAD commit message edits", async () => {
    const git = gitWithRaw(async () => "different\n");

    await expect(
      editHeadCommitMessage(git, {
        commitHash: "abc123",
        message: "new message"
      })
    ).rejects.toThrow("only for HEAD");
  });

  it("does nothing when the edited message is unchanged", async () => {
    const git = gitWithRaw(async (args) => {
      if (args[0] === "rev-parse") return "abc123\n";
      return "same message\n";
    });

    await editHeadCommitMessage(git, {
      commitHash: "abc123",
      message: "same message"
    });

    expect(git.raw).toHaveBeenCalledTimes(2);
  });
});
