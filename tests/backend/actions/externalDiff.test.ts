import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ExternalDiffSpawn, openExternalDirDiff } from "@/backend/actions/externalDiff";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const repos: string[] = [];
let configDir = "";
let savedGlobal: string | undefined;
let savedSystem: string | undefined;

type SpawnCall = {
  binary: string;
  args: string[];
  options: { cwd: string; detached: true; stdio: "ignore" };
  unrefed: boolean;
};

function head(repo: string) {
  return cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
}

function trackedRepo() {
  const repo = makeRepo();
  repos.push(repo);
  const first = head(repo);
  fs.writeFileSync(path.join(repo, "f"), "y");
  git(["add", "."], repo);
  git(["commit", "-m", "second"], repo);
  return { repo, first, second: head(repo) };
}

function fakeSpawn(calls: SpawnCall[]): ExternalDiffSpawn {
  return (binary, args, options) => {
    const call: SpawnCall = { binary, args, options, unrefed: false };
    calls.push(call);
    return {
      unref: () => {
        call.unrefed = true;
      }
    };
  };
}

beforeEach(() => {
  // No tool may leak in from the developer's own configuration: global and
  // system config both point at an empty file inside a temp directory.
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-d15-config-"));
  const empty = path.join(configDir, "gitconfig");
  fs.writeFileSync(empty, "");
  savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  savedSystem = process.env.GIT_CONFIG_SYSTEM;
  process.env.GIT_CONFIG_GLOBAL = empty;
  process.env.GIT_CONFIG_SYSTEM = empty;
});

afterEach(() => {
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  if (savedSystem === undefined) delete process.env.GIT_CONFIG_SYSTEM;
  else process.env.GIT_CONFIG_SYSTEM = savedSystem;
  fs.rmSync(configDir, { recursive: true, force: true });
  while (repos.length > 0) {
    const repo = repos.pop();
    if (repo !== undefined) fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe("openExternalDirDiff", () => {
  it("starts nothing and reports unconfigured with no tool set", async () => {
    const { repo, first, second } = trackedRepo();
    const calls: SpawnCall[] = [];

    await expect(
      openExternalDirDiff(simpleGit(repo), {
        repo,
        baseRef: first,
        compareRef: second,
        gitPath: "git",
        spawn: fakeSpawn(calls)
      })
    ).resolves.toEqual({ configured: false });
    expect(calls).toEqual([]);
  });

  it("spawns a detached dir-diff with full hashes when diff.tool is set", async () => {
    const { repo, first, second } = trackedRepo();
    git(["config", "diff.tool", "faketool"], repo);
    const calls: SpawnCall[] = [];
    const records: GitCommandRecord[] = [];

    await expect(
      openExternalDirDiff(simpleGit(repo), {
        repo,
        baseRef: first,
        compareRef: second,
        gitPath: "git",
        spawn: fakeSpawn(calls),
        recordGitCommand: (record) => records.push(record)
      })
    ).resolves.toEqual({ configured: true });

    expect(calls).toEqual([
      {
        binary: "git",
        args: ["difftool", "--dir-diff", "--no-prompt", first, second],
        options: { cwd: repo, detached: true, stdio: "ignore" },
        unrefed: true
      }
    ]);
    expect(records.at(-1)).toMatchObject({
      label: "externalDiff.open",
      kind: "action",
      success: true,
      args: ["difftool", "--dir-diff", "--no-prompt", first, second]
    });
  });

  it("adds --gui when diff.guitool is the configured tool", async () => {
    const { repo, first, second } = trackedRepo();
    git(["config", "diff.guitool", "fakeguitool"], repo);
    const calls: SpawnCall[] = [];

    await openExternalDirDiff(simpleGit(repo), {
      repo,
      baseRef: first,
      compareRef: second,
      gitPath: "git",
      spawn: fakeSpawn(calls)
    });

    expect(calls[0]?.args).toEqual([
      "difftool",
      "--dir-diff",
      "--no-prompt",
      "--gui",
      first,
      second
    ]);
  });

  it("passes a single hash for a working-tree comparison", async () => {
    const { repo, first } = trackedRepo();
    git(["config", "diff.tool", "faketool"], repo);
    const calls: SpawnCall[] = [];

    await openExternalDirDiff(simpleGit(repo), {
      repo,
      baseRef: first,
      compareRef: "*",
      gitPath: "git",
      spawn: fakeSpawn(calls)
    });

    expect(calls[0]?.args).toEqual(["difftool", "--dir-diff", "--no-prompt", first]);
  });

  it("resolves HEAD to its full hash instead of passing the name", async () => {
    const { repo, first, second } = trackedRepo();
    git(["config", "diff.tool", "faketool"], repo);
    const calls: SpawnCall[] = [];

    await openExternalDirDiff(simpleGit(repo), {
      repo,
      baseRef: first,
      compareRef: "HEAD",
      gitPath: "git",
      spawn: fakeSpawn(calls)
    });

    expect(calls[0]?.args).toEqual(["difftool", "--dir-diff", "--no-prompt", first, second]);
  });

  it.each([
    ["an option-like ref", "--upload-pack=touch-pwned", "HEAD"],
    ["an unknown ref", "no-such-ref", "HEAD"],
    ["the working tree as base", "*", "HEAD"]
  ])("rejects %s and spawns nothing", async (_label, baseRef, compareRef) => {
    const { repo } = trackedRepo();
    git(["config", "diff.tool", "faketool"], repo);
    const calls: SpawnCall[] = [];

    await expect(
      openExternalDirDiff(simpleGit(repo), {
        repo,
        baseRef,
        compareRef,
        gitPath: "git",
        spawn: fakeSpawn(calls)
      })
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
