import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";

import { simpleGit, type SimpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadBranches } from "@/backend/queries/loadBranches";

import { git, makeRepo } from "@tests/backend/helpers";

let simpleRepo: string;
let detachedRepo: string;
let repoWithRemote: string;
let originalLang: string | undefined;

beforeAll(() => {
  originalLang = process.env.LANG;
  process.env.LANG = "en_US.UTF-8";
  simpleRepo = makeRepo();
  git(["branch", "feature/foo"], simpleRepo);

  detachedRepo = makeRepo();
  const hash = cp
    .execFileSync("git", ["rev-parse", "HEAD"], { cwd: detachedRepo })
    .toString()
    .trim();
  git(["checkout", "--detach", hash], detachedRepo);

  const remoteRepo = makeRepo();
  repoWithRemote = makeRepo();
  git(["remote", "add", "origin", remoteRepo], repoWithRemote);
  git(["fetch", "origin"], repoWithRemote);
});

afterAll(() => {
  if (originalLang === undefined) {
    delete process.env.LANG;
  } else {
    process.env.LANG = originalLang;
  }
  fs.rmSync(simpleRepo, { recursive: true, force: true });
  fs.rmSync(detachedRepo, { recursive: true, force: true });
  fs.rmSync(repoWithRemote, { recursive: true, force: true });
});

describe("loadBranches", () => {
  it("head branch is first in the returned array", async () => {
    const result = await loadBranches(simpleGit(simpleRepo), {
      showRemoteBranches: false,
      hard: false,
      currentRepo: simpleRepo,
      gitPath: "git"
    });
    expect(result).toEqual({
      branches: expect.any(Array),
      head: "main",
      hard: false,
      isRepo: true,
      error: null
    });
    expect(result.branches[0]).toBe("main");
  });

  it("non-head branches are present", async () => {
    const result = await loadBranches(simpleGit(simpleRepo), {
      showRemoteBranches: false,
      hard: false,
      currentRepo: simpleRepo,
      gitPath: "git"
    });
    expect(result.branches).toContain("feature/foo");
  });

  it("detached HEAD yields head: null with branches still listed", async () => {
    const result = await loadBranches(simpleGit(detachedRepo), {
      showRemoteBranches: false,
      hard: false,
      currentRepo: detachedRepo,
      gitPath: "git"
    });
    expect(result).toEqual({
      branches: expect.any(Array),
      head: null,
      hard: false,
      isRepo: true,
      error: null
    });
    expect(result.branches.length).toBeGreaterThan(0);
  });

  it("excludes remote-tracking branches when showRemoteBranches is false", async () => {
    const result = await loadBranches(simpleGit(repoWithRemote), {
      showRemoteBranches: false,
      hard: false,
      currentRepo: repoWithRemote,
      gitPath: "git"
    });
    expect(result).toEqual({
      branches: expect.any(Array),
      head: expect.any(String),
      hard: false,
      isRepo: true,
      error: null
    });
    expect(result.branches.some((b) => b.startsWith("remotes/"))).toBe(false);
  });

  it("includes remote-tracking branches when showRemoteBranches is true", async () => {
    const result = await loadBranches(simpleGit(repoWithRemote), {
      showRemoteBranches: true,
      hard: false,
      currentRepo: repoWithRemote,
      gitPath: "git"
    });
    expect(result).toEqual({
      branches: expect.any(Array),
      head: expect.any(String),
      hard: false,
      isRepo: true,
      error: null
    });
    expect(result.branches.some((b) => b.startsWith("remotes/origin/"))).toBe(true);
  });

  it("hides selected remote-tracking branches when remote branches are shown", async () => {
    const result = await loadBranches(simpleGit(repoWithRemote), {
      showRemoteBranches: true,
      hiddenRemotes: ["origin"],
      hard: false,
      currentRepo: repoWithRemote,
      gitPath: "git"
    });

    expect(result.error).toBeNull();
    expect(result.branches.some((b) => b.startsWith("remotes/origin/"))).toBe(false);
    expect(result.branches).toContain("main");
  });

  it("returns isRepo: false for a non-git directory", async () => {
    const result = await loadBranches(simpleGit(os.tmpdir()), {
      showRemoteBranches: false,
      hard: false,
      currentRepo: os.tmpdir(),
      gitPath: "git"
    });
    expect(result).toEqual({
      branches: [],
      head: null,
      hard: false,
      isRepo: false,
      error: null
    });
  });

  it("passes hard flag through to the result", async () => {
    const result = await loadBranches(simpleGit(simpleRepo), {
      showRemoteBranches: false,
      hard: true,
      currentRepo: simpleRepo,
      gitPath: "git"
    });
    expect(result).toEqual({
      branches: expect.any(Array),
      head: expect.any(String),
      hard: true,
      isRepo: true,
      error: null
    });
  });

  it("returns a typed error for branch command failures in a repository", async () => {
    const failure = Object.assign(new Error("fatal: branch failed"), {
      result: { exitCode: 128, stdErr: "fatal: branch failed" }
    });
    const failingGit = {
      branchLocal: async () => {
        throw failure;
      }
    } as unknown as SimpleGit;

    const result = await loadBranches(failingGit, {
      showRemoteBranches: false,
      hard: false,
      currentRepo: simpleRepo,
      gitPath: "git"
    });

    expect(result).toEqual({
      branches: [],
      head: null,
      hard: false,
      isRepo: true,
      error: {
        message: "fatal: branch failed",
        stderr: "fatal: branch failed",
        exitCode: 128,
        task: null
      }
    });
  });
});
