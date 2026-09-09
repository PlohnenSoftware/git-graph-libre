import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import type { GitStash } from "@/backend/types";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const loadStashesMock = vi.hoisted(() => vi.fn());

vi.mock("@/backend/queries/stashes", () => ({
  loadStashes: loadStashesMock
}));

import { loadCommits } from "@/backend/queries/loadCommits";

let repo: string;
let baseHead: string;

function rev(selector: string): string {
  return cp.execFileSync("git", ["rev-parse", selector], { cwd: repo }).toString().trim();
}

function loadOptions() {
  return {
    branchName: "",
    maxCommits: 300,
    showRemoteBranches: false,
    showSignature: false,
    showStashes: true,
    showUncommittedChanges: false,
    hard: true,
    dateType: "Author Date"
  } as Parameters<typeof loadCommits>[1];
}

function stashNode(overrides: Partial<GitStash>): GitStash {
  return {
    index: 0,
    ref: "stash@{0}",
    hash: "feed1234feed1234feed1234feed1234feed1234",
    message: "WIP on main: checkpoint",
    date: 1700500000,
    sourceHash: baseHead,
    ...overrides
  };
}

beforeAll(() => {
  repo = makeRepo();
  fs.writeFileSync(path.join(repo, "f2"), "y");
  git(["add", "."], repo);
  git(["commit", "-m", "second"], repo);
  baseHead = rev("HEAD");
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("loadCommits stash edge cases", () => {
  it("drops stashes whose base commit resolves to nothing", async () => {
    loadStashesMock.mockResolvedValue({
      value: [stashNode({ sourceHash: null })],
      error: null
    });

    const result = await loadCommits(simpleGit(repo), loadOptions());

    expect(result.error).toBeNull();
    expect(loadStashesMock).toHaveBeenCalled();
    expect(result.commits.every((commit) => commit.stash === undefined)).toBe(true);
  });

  it("falls back to the base date when a stash carries no date", async () => {
    loadStashesMock.mockResolvedValue({
      value: [stashNode({ date: null })],
      error: null
    });

    const result = await loadCommits(simpleGit(repo), loadOptions());

    expect(result.error).toBeNull();
    const row = result.commits.find((commit) => commit.stash !== undefined);
    const base = result.commits.find((commit) => commit.hash === baseHead);
    expect(row).not.toBeUndefined();
    expect(base).not.toBeUndefined();
    expect(row?.date).toBe(base?.date);
  });
});
