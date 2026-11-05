import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import {
  createRepoReader,
  didEngineServeRead,
  type LoadCommitsArgs,
  resetEngineServedRead
} from "@/backend/engine/index";
import { readStagedFile } from "@/backend/engine/stagedFile";
import { commitComparison } from "@/backend/queries/commitComparison";
import { commitDetails } from "@/backend/queries/commitDetails";
import { loadCommits } from "@/backend/queries/loadCommits";
import { loadRepoInfo } from "@/backend/queries/loadRepoInfo";
import { searchCommits as searchCommitsQuery } from "@/backend/queries/searchCommits";
import type { GitCommitNode } from "@/backend/types";

/**
 * Every read wired to the engine, driven on a linked worktree against the
 * CLI (slice W40). The fixture is a main repository with two linked
 * worktrees in awkward folders: one with its own branch, a local commit by a
 * second author, a stash, a dirty index and work tree, its own
 * `refs/worktree/*` ref and a `config.worktree` value; the other detached on
 * a commit by a third author that no branch reaches, so only that worktree's
 * HEAD holds it. A divergence is an engine bug, never a test to relax.
 */

const EPOCH = 1700000000;
const dirs: string[] = [];
let main = "";
let one = "";
let two = "";
let oneHead = "";
let mainHead = "";

function commitIn(dir: string, message: string, epoch: number, author: string): string {
  cp.execFileSync("git", ["commit", "-q", "-m", message], {
    cwd: dir,
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: `${epoch} +0000`,
      GIT_COMMITTER_DATE: `${epoch} +0000`,
      GIT_AUTHOR_NAME: author,
      GIT_AUTHOR_EMAIL: `${author.toLowerCase()}@x.com`
    }
  });
  return cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

function requireAddon(context: { skip: (message?: string) => never }): void {
  if (loadEngineAddon() === null) {
    context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
  }
}

beforeAll(() => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-w40-"));
  dirs.push(parent);
  main = path.join(parent, "main repo");
  fs.mkdirSync(main);
  git(["init", "-b", "main"], main);
  for (const [key, value] of [
    ["user.email", "ada@x.com"],
    ["user.name", "Ada"],
    ["commit.gpgsign", "false"],
    ["tag.gpgsign", "false"],
    ["extensions.worktreeConfig", "true"]
  ] as const) {
    git(["config", key, value], main);
  }
  fs.writeFileSync(path.join(main, "a.txt"), "base\n");
  git(["add", "."], main);
  commitIn(main, "base", EPOCH, "Ada");
  fs.writeFileSync(path.join(main, "b.txt"), "second\n");
  git(["add", "."], main);
  mainHead = commitIn(main, "second", EPOCH + 600, "Ada");
  git(["tag", "v1"], main);

  one = path.join(parent, "wt ünï one");
  git(["worktree", "add", "-q", "-b", "feature", one], main);
  git(["config", "--worktree", "user.name", "Worktree User"], one);
  git(["update-ref", "refs/worktree/mine", "HEAD"], one);
  fs.writeFileSync(path.join(one, "one.txt"), "one\n");
  git(["add", "one.txt"], one);
  oneHead = commitIn(one, "local commit", EPOCH + 1200, "Alice");
  fs.writeFileSync(path.join(one, "a.txt"), "stashed\n");
  git(["stash", "push", "-q", "-m", "wip"], one);
  fs.writeFileSync(path.join(one, "a.txt"), "staged\n");
  git(["add", "a.txt"], one);
  fs.writeFileSync(path.join(one, "b.txt"), "unstaged\n");
  fs.writeFileSync(path.join(one, "untracked.txt"), "new\n");

  two = path.join(parent, "wt two");
  git(["worktree", "add", "-q", "-b", "other", two], main);
  git(["checkout", "-q", "--detach"], two);
  fs.writeFileSync(path.join(two, "two.txt"), "two\n");
  git(["add", "two.txt"], two);
  commitIn(two, "detached commit", EPOCH + 1800, "Carol");
}, 180000);

afterAll(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

function maskVolatile(nodes: GitCommitNode[]): GitCommitNode[] {
  return nodes.map((node) => (node.hash === "*" ? { ...node, date: 0 } : node));
}

function baseArgs(dir: string): LoadCommitsArgs {
  return {
    branchName: "",
    branches: null,
    authors: null,
    tags: null,
    maxCommits: 100,
    showRemoteBranches: true,
    hiddenRemotes: [],
    showTags: true,
    includeReflog: false,
    includeUnreachableCommits: false,
    onlyFollowFirstParent: false,
    commitOrdering: "date",
    showStashes: true,
    dateType: "Commit Date",
    showUncommittedChanges: true,
    repoPath: dir,
    git: simpleGit(dir),
    hard: false
  };
}

const auto = () => createRepoReader({ preference: "auto", gitPath: "git" });

describe("engine/CLI parity on a linked worktree", () => {
  it("serves repository info, with the same authors as git log --all", async (context) => {
    requireAddon(context);
    for (const dir of [one, two, main]) {
      resetEngineServedRead();
      const [viaAuto, direct] = await Promise.all([
        auto().loadRepoInfo({ repoPath: dir, git: simpleGit(dir), showStashes: true }),
        loadRepoInfo(simpleGit(dir), { repo: dir, showStashes: true })
      ]);
      expect(didEngineServeRead(), `${dir} served`).toBe(true);
      expect(viaAuto, dir).toEqual(direct);
      // The detached sibling's commit is reachable only from its HEAD.
      expect(viaAuto.repoInfo.authors).toContain("Carol");
    }
  }, 120000);

  it("serves commits, stashes and the uncommitted row", async (context) => {
    requireAddon(context);
    for (const dir of [one, two]) {
      const args = baseArgs(dir);
      const { repoPath, git: _git, ...input } = args;
      resetEngineServedRead();
      const [viaAuto, direct] = await Promise.all([
        auto().loadCommits(args),
        loadCommits(simpleGit(dir), { ...input, repo: repoPath })
      ]);
      expect(didEngineServeRead(), `${dir} served`).toBe(true);
      expect(maskVolatile(viaAuto.commits), dir).toEqual(maskVolatile(direct.commits));
      expect({ head: viaAuto.head, more: viaAuto.moreCommitsAvailable }, dir).toEqual({
        head: direct.head,
        more: direct.moreCommitsAvailable
      });
    }
    const shown = (await auto().loadCommits(baseArgs(one))).commits;
    expect(shown.some((node) => node.hash === "*")).toBe(true);
    expect(shown.some((node) => node.stash !== null)).toBe(true);
  }, 120000);

  it("serves commit details and comparisons, including to the work tree", async (context) => {
    requireAddon(context);
    const base = { repoPath: one, git: simpleGit(one), dateType: "Commit Date" as const };
    // The uncommitted row (`*`) and any comparison against the work tree stay on the
    // CLI by design, so the engine's answer is checked for them only by being
    // declined: the reader returns exactly what the query returns.
    for (const commitHash of [oneHead, mainHead, "*"]) {
      const expectedServed = commitHash !== "*";
      resetEngineServedRead();
      const [viaAuto, direct] = await Promise.all([
        auto().loadCommitDetails({ ...base, commitHash }),
        commitDetails(simpleGit(one), { commitHash, dateType: "Commit Date", repo: one })
      ]);
      expect(didEngineServeRead(), `${commitHash} served`).toBe(expectedServed);
      expect(viaAuto, commitHash).toEqual(direct);
    }
    for (const [baseRef, compareRef] of [
      [mainHead, oneHead],
      [oneHead, "*"],
      [mainHead, "*"]
    ] as const) {
      const expectedServed = compareRef !== "*";
      resetEngineServedRead();
      const [viaAuto, direct] = await Promise.all([
        auto().loadCommitComparison({ ...base, commitHash: compareRef, baseRef, compareRef }),
        commitComparison(simpleGit(one), {
          commitHash: compareRef,
          baseRef,
          compareRef,
          dateType: "Commit Date",
          repo: one
        })
      ]);
      expect(didEngineServeRead(), `${baseRef}..${compareRef} served`).toBe(expectedServed);
      expect(viaAuto, `${baseRef}..${compareRef}`).toEqual(direct);
    }
  }, 120000);

  it("serves search and the staged copy of a file", async (context) => {
    requireAddon(context);
    for (const query of ["local", "detached", "base"]) {
      const args = {
        repoPath: one,
        git: simpleGit(one),
        query,
        maxResults: 50,
        showRemoteBranches: true,
        showTags: true,
        branches: null,
        authors: null,
        tags: null,
        dateType: "Commit Date" as const
      };
      resetEngineServedRead();
      const viaAuto = await auto().searchCommits(args);
      expect(didEngineServeRead(), `${query} served`).toBe(true);
      const direct = await searchCommitsQuery(simpleGit(one), { ...args, repo: one });
      expect(viaAuto, query).toEqual(direct);
    }
    const deps = {
      gitPath: "git",
      backend: () => "auto" as const,
      addonProvider: () => loadEngineAddon(),
      isVerified: () => true
    };
    const cliDeps = { gitPath: "git", backend: () => "git-cli" as const };
    expect(await readStagedFile(one, "a.txt", deps)).toEqual({ text: "staged\n" });
    expect(await readStagedFile(one, "a.txt", cliDeps)).toEqual({ text: "staged\n" });
    // The sibling's index is its own: it never staged this file.
    expect(await readStagedFile(two, "a.txt", deps)).toEqual(
      await readStagedFile(two, "a.txt", cliDeps)
    );
  }, 120000);

  it("declines a worktree that was removed, instead of answering from a stale handle", async (context) => {
    requireAddon(context);
    const gone = path.join(main, ".worktrees", "wt gone");
    git(["worktree", "add", "-q", "-b", "gone", gone], main);
    const addon = loadEngineAddon();
    if (addon === null) throw new Error("addon vanished");
    const refs = JSON.parse(await addon.loadRefs(gone, "{}")) as { head?: string };
    expect(refs.head).toMatch(/^[0-9a-f]{40}$/);
    git(["worktree", "remove", "--force", gone], main);
    // The folder sits inside the main repository's work tree, so searching upwards from it
    // would find that repository and answer in the worktree's place.
    await expect(addon.loadRefs(gone, "{}")).rejects.toThrow(/no longer exists|not a/i);
  }, 120000);
});
