import * as cp from "node:child_process";
import * as fs from "node:fs";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, describe, expect, it } from "vitest";

import { loadEngineAddon } from "@/backend/engine/addon";
import {
  createRepoReader,
  didEngineServeRead,
  type LoadCommitsArgs,
  resetEngineServedRead
} from "@/backend/engine/index";
import { loadCommits } from "@/backend/queries/loadCommits";

/**
 * Commits stored in another encoding. Git prints them as UTF-8, and the
 * engine must show the same text, or decline so the CLI answers. The commits
 * are raw objects, so their bytes and `encoding` header are exactly what a
 * user's `i18n.commitEncoding` produces.
 */

const dirs: string[] = [];

function run(args: string[], cwd: string, input?: Buffer): string {
  return cp.execFileSync("git", args, { cwd, input, stdio: "pipe" }).toString().trim();
}

function repoWithRawCommit(encoding: string | null, author: Buffer, message: Buffer): string {
  const dir = makeRepo();
  dirs.push(dir);
  const tree = run(["rev-parse", "HEAD^{tree}"], dir);
  const parent = run(["rev-parse", "HEAD"], dir);
  const identity = Buffer.concat([
    author,
    Buffer.from(" <a@example.com> 1700000000 +0000\n", "latin1")
  ]);
  const object = Buffer.concat([
    Buffer.from(`tree ${tree}\nparent ${parent}\nauthor `, "latin1"),
    identity,
    Buffer.from("committer ", "latin1"),
    identity,
    Buffer.from(encoding === null ? "\n" : `encoding ${encoding}\n\n`, "latin1"),
    message
  ]);
  const hash = run(["hash-object", "-t", "commit", "-w", "--stdin", "--literally"], dir, object);
  git(["update-ref", "refs/heads/main", hash], dir);
  return dir;
}

function args(repo: string): LoadCommitsArgs {
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
    showStashes: false,
    dateType: "Commit Date",
    showUncommittedChanges: false,
    repoPath: repo,
    git: simpleGit(repo),
    hard: false
  };
}

async function bothBackends(repo: string) {
  const input = args(repo);
  const { repoPath, git: _git, ...rest } = input;
  resetEngineServedRead();
  const viaAuto = await createRepoReader({ preference: "auto", gitPath: "git" }).loadCommits({
    ...input,
    git: simpleGit(repo)
  });
  const served = didEngineServeRead();
  const direct = await loadCommits(simpleGit(repo), { ...rest, repo: repoPath });
  const rows = (nodes: typeof direct.commits) =>
    nodes.map(({ author, email, message }) => ({ author, email, message }));
  return { engine: rows(viaAuto.commits), cli: rows(direct.commits), served };
}

afterAll(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("engine/CLI parity: commit encodings", () => {
  const engineBuilt = loadEngineAddon() !== null;

  it("serves an ISO-8859-1 commit with the text Git prints", async () => {
    const repo = repoWithRawCommit(
      "ISO-8859-1",
      Buffer.from("Jos\xe9", "latin1"),
      Buffer.from("caf\xe9\n\nbody\n", "latin1")
    );
    const { engine, cli, served } = await bothBackends(repo);
    expect(cli[0]).toEqual({ author: "José", email: "a@example.com", message: "café" });
    expect(engine).toEqual(cli);
    if (engineBuilt) expect(served).toBe(true);
  }, 60000);

  it("skips the blank lines before a subject and folds its first paragraph", async () => {
    const repo = repoWithRawCommit(
      null,
      Buffer.from("Ann"),
      Buffer.from("\n\nfirst line\nsecond line\n\nbody\n")
    );
    const { engine, cli, served } = await bothBackends(repo);
    expect(cli[0].message).toBe("first line second line");
    expect(engine).toEqual(cli);
    if (engineBuilt) expect(served).toBe(true);
  }, 60000);

  it("leaves an encoding it cannot decode as Git does to the CLI", async () => {
    const repo = repoWithRawCommit("klingon", Buffer.from("Ann"), Buffer.from("text\n"));
    const { engine, cli, served } = await bothBackends(repo);
    expect(engine).toEqual(cli);
    expect(served).toBe(false);
  }, 60000);
});
