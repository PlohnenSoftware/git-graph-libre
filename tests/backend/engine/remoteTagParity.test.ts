import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadEngineAddon } from "@/backend/engine/addon";
import {
  createRepoReader,
  didEngineServeRead,
  type LoadCommitsArgs,
  resetEngineServedRead
} from "@/backend/engine/index";
import { loadCommits } from "@/backend/queries/loadCommits";
import type { GitCommitNode } from "@/backend/types";

/**
 * A fetch refspec `+refs/tags/*:refs/remotes/<remote>/tags/*` mirrors every
 * remote tag as `refs/remotes/<remote>/tags/<tag>`. The mirror of a local tag
 * that is the same object must not add a second badge to the commit; one that
 * differs, or has no local tag, must still show as `<remote>/<tag>`. Both
 * backends apply that rule, and must agree.
 */

const dirs: string[] = [];
let repo = "";
let savedGlobal: string | undefined;
const commits: Record<string, string> = {};

function run(args: string[], cwd: string): string {
  return cp.execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();
}

function commitFile(dir: string, name: string): string {
  fs.writeFileSync(path.join(dir, name), name);
  git(["add", name], dir);
  git(["commit", "-m", name], dir);
  return run(["rev-parse", "HEAD"], dir);
}

function makeBareRemote(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-bare-"));
  dirs.push(dir);
  git(["init", "--bare", "-b", "main"], dir);
  return dir;
}

function tagLabels(nodes: GitCommitNode[]): string[] {
  return nodes
    .flatMap((node) =>
      node.refs
        .filter((ref) => ref.type === "tag")
        .map((ref) => `${ref.name}@${ref.hash === node.hash ? "own" : "?"}:${node.hash}`)
    )
    .sort((left, right) => left.localeCompare(right));
}

function badge(name: string, commit: string): string {
  return `${name}@own:${commits[commit]}`;
}

beforeAll(() => {
  const empty = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ngg-cfg-")), "gitconfig");
  fs.writeFileSync(empty, "");
  dirs.push(path.dirname(empty));
  savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = empty;

  repo = makeRepo();
  dirs.push(repo);
  git(["config", "tag.gpgsign", "false"], repo);
  for (const remote of ["origin", "dev"]) {
    git(["remote", "add", remote, makeBareRemote()], repo);
    git(["config", `remote.${remote}.fetch`, `+refs/tags/*:refs/remotes/${remote}/tags/*`], repo);
  }
  commits.ann = commitFile(repo, "ann");
  git(["tag", "-a", "ann", "-m", "annotated"], repo);
  commits.light = commitFile(repo, "light");
  git(["tag", "light"], repo);
  commits.moved = commitFile(repo, "moved");
  git(["tag", "moved"], repo);
  commits.mlocal = commitFile(repo, "mlocal");
  commits.ronly = commitFile(repo, "ronly");
  git(["tag", "ronly"], repo);
  commits.donly = commitFile(repo, "donly");
  git(["tag", "donly"], repo);

  git(["push", "origin", "refs/tags/ann", "refs/tags/light", "refs/tags/moved"], repo);
  git(["push", "origin", "refs/tags/ronly"], repo);
  git(["push", "dev", "refs/tags/ann", "refs/tags/donly"], repo);
  git(["fetch", "origin"], repo);
  git(["fetch", "dev"], repo);
  // The remote's `moved` now differs from the local one; `ronly` and `donly`
  // exist on the remote only.
  git(["tag", "-f", "moved", commits.mlocal], repo);
  git(["tag", "-d", "ronly", "donly"], repo);
});

afterAll(() => {
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

function args(hiddenRemotes: string[]): LoadCommitsArgs {
  return {
    branchName: "",
    branches: null,
    authors: null,
    tags: null,
    maxCommits: 100,
    showRemoteBranches: true,
    hiddenRemotes,
    showTags: true,
    includeReflog: false,
    includeUnreachableCommits: false,
    onlyFollowFirstParent: false,
    commitOrdering: "date",
    showStashes: false,
    dateType: "Commit Date",
    showUncommittedChanges: false,
    repoPath: repo,
    git: simpleGit(repo),
    hard: false
  };
}

async function bothBackends(hiddenRemotes: string[], engineAvailable: boolean) {
  const input = args(hiddenRemotes);
  const { repoPath, git: _git, ...rest } = input;
  resetEngineServedRead();
  const [viaAuto, direct] = await Promise.all([
    createRepoReader({ preference: "auto", gitPath: "git" }).loadCommits({
      ...input,
      git: simpleGit(repo)
    }),
    loadCommits(simpleGit(repo), { ...rest, repo: repoPath })
  ]);
  if (engineAvailable) expect(didEngineServeRead()).toBe(true);
  return { engine: tagLabels(viaAuto.commits), cli: tagLabels(direct.commits) };
}

describe("remote-tracking tag badges", () => {
  it("hides mirrors of the same tag, keeps differing and remote-only ones", async () => {
    const { engine, cli } = await bothBackends([], loadEngineAddon() !== null);
    const expected = [
      // The same annotated tag, mirrored by both remotes: one badge.
      badge("ann", "ann"),
      // The same lightweight tag, mirrored by origin: one badge.
      badge("light", "light"),
      // A local tag moved off the remote's: both show.
      badge("moved", "mlocal"),
      badge("origin/moved", "moved"),
      // Remote-only tags show as `<remote>/<tag>`.
      badge("origin/ronly", "ronly"),
      badge("dev/donly", "donly")
    ].sort((left, right) => left.localeCompare(right));
    expect(cli).toEqual(expected);
    if (loadEngineAddon() !== null) expect(engine).toEqual(cli);
  }, 60000);

  it("shows nothing for a hidden remote", async () => {
    const { engine, cli } = await bothBackends(["dev"], loadEngineAddon() !== null);
    expect(cli.some((label) => label.startsWith("dev/"))).toBe(false);
    expect(cli).toContain(badge("origin/ronly", "ronly"));
    if (loadEngineAddon() !== null) expect(engine).toEqual(cli);
  }, 60000);
});
