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

function args(hiddenRemotes: string[], dir: string = repo): LoadCommitsArgs {
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
    repoPath: dir,
    git: simpleGit(dir),
    hard: false
  };
}

async function bothBackends(hiddenRemotes: string[], engineAvailable: boolean, dir: string = repo) {
  const input = args(hiddenRemotes, dir);
  const { repoPath, git: _git, ...rest } = input;
  resetEngineServedRead();
  const [viaAuto, direct] = await Promise.all([
    createRepoReader({ preference: "auto", gitPath: "git" }).loadCommits({
      ...input,
      git: simpleGit(dir)
    }),
    loadCommits(simpleGit(dir), { ...rest, repo: repoPath })
  ]);
  if (engineAvailable) expect(didEngineServeRead()).toBe(true);
  return {
    engine: tagLabels(viaAuto.commits),
    cli: tagLabels(direct.commits),
    viaAuto: viaAuto.commits,
    direct: direct.commits
  };
}

/**
 * One line per commit that carries labels, with the labels in the order the backend lists
 * them. The order is the thing under test, so labels are kept in sequence within a commit;
 * the lines are sorted only because commits that share a date may come in either order.
 */
function orderedRefLabels(nodes: GitCommitNode[], names: Record<string, string>): string[] {
  return nodes
    .filter((node) => node.refs.length > 0)
    .map((node) => {
      const labels = node.refs.map((ref) => `${ref.type}:${ref.name}`).join(" ");
      return `${names[node.hash] ?? node.hash}: ${labels}`;
    })
    .sort((left, right) => left.localeCompare(right));
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

describe("remote-tag label order", () => {
  // `shared` carries a mirrored remote tag of each of two remotes (`dev/t`, `origin/v`), a
  // remote branch of origin (`origin/changes/foo`) and a local tag `u` that mirrors origin's
  // `u` on the same object, so W26J drops that mirror. The CLI lists labels in `for-each-ref`
  // order of the real refnames: `refs/remotes/dev/tags/t` sorts before
  // `refs/remotes/origin/changes/foo`, and both remote tags sort among the remote branches,
  // ahead of the local `refs/tags/u`.
  let orderRepo = "";
  const orderCommits: Record<string, string> = {};

  beforeAll(() => {
    orderRepo = makeRepo();
    dirs.push(orderRepo);
    git(["config", "tag.gpgsign", "false"], orderRepo);
    for (const remote of ["origin", "dev"]) {
      git(["remote", "add", remote, makeBareRemote()], orderRepo);
      // Add the tag mirror next to the default branch refspec, which `remote add` created.
      git(
        ["config", "--add", `remote.${remote}.fetch`, `+refs/tags/*:refs/remotes/${remote}/tags/*`],
        orderRepo
      );
    }
    orderCommits.shared = commitFile(orderRepo, "shared");
    git(["tag", "t", orderCommits.shared], orderRepo);
    git(["tag", "v", orderCommits.shared], orderRepo);
    git(["tag", "u", orderCommits.shared], orderRepo);
    git(["push", "dev", "refs/tags/t"], orderRepo);
    git(["push", "origin", "refs/tags/v", "refs/tags/u"], orderRepo);
    git(["push", "origin", `${orderCommits.shared}:refs/heads/changes/foo`], orderRepo);
    git(["fetch", "origin"], orderRepo);
    git(["fetch", "dev"], orderRepo);
    // `t` and `v` now exist only on the remotes.
    git(["tag", "-d", "t", "v"], orderRepo);
    orderCommits.tip = commitFile(orderRepo, "tip");
  });

  it("lists a commit's labels in the CLI's refname order on both backends", async () => {
    const { viaAuto, direct } = await bothBackends([], loadEngineAddon() !== null, orderRepo);
    const names = Object.fromEntries(
      Object.entries(orderCommits).map(([name, hash]) => [hash, name])
    );
    const expected = [
      "shared: tag:dev/t remote:origin/changes/foo tag:origin/v tag:u",
      "tip: head:main"
    ].sort((left, right) => left.localeCompare(right));
    expect(orderedRefLabels(direct, names)).toEqual(expected);
    if (loadEngineAddon() !== null) {
      expect(orderedRefLabels(viaAuto, names)).toEqual(expected);
    }
  }, 60000);
});
