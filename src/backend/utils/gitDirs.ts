/**
 * Where a repository's git directories live: the directory that holds its own
 * HEAD and index (`gitDir`) and the one that holds the shared refs, config and
 * `worktrees/` (`commonDir`). The two are equal for a normal repository and a
 * submodule; in a linked worktree `gitDir` is `<common>/worktrees/<id>`.
 */

import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export type GitDirs = { gitDir: string; commonDir: string };

const gitDirPrefix = "gitdir:";

function readFirstLine(file: string): string | null {
  try {
    return (fs.readFileSync(file, "utf8").split(/\r?\n/)[0] ?? "").trim();
  } catch {
    return null;
  }
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/** The git dir `<repo>/.git` names, whether it is a directory or a `gitdir:` file. */
function readGitDir(repo: string): string | null {
  const dotGit = path.join(repo, ".git");
  if (isDirectory(dotGit)) return dotGit;
  const line = readFirstLine(dotGit);
  if (line === null || !line.startsWith(gitDirPrefix)) return null;
  const target = line.slice(gitDirPrefix.length).trim();
  return target === "" ? null : path.resolve(repo, target);
}

function resolveWithFileSystem(repo: string): GitDirs | null {
  const gitDir = readGitDir(repo);
  if (gitDir === null) return null;
  const common = readFirstLine(path.join(gitDir, "commondir"));
  const commonDir = common === null || common === "" ? gitDir : path.resolve(gitDir, common);
  return { gitDir, commonDir };
}

function resolveWithGit(repo: string): GitDirs | null {
  try {
    const out = cp
      .execFileSync("git", ["rev-parse", "--absolute-git-dir", "--git-common-dir"], {
        cwd: repo,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000
      })
      .split(/\r?\n/);
    const gitDir = out[0] ?? "";
    const common = out[1] ?? "";
    if (gitDir === "" || common === "") return null;
    return { gitDir: path.resolve(gitDir), commonDir: path.resolve(repo, common) };
  } catch {
    return null;
  }
}

/**
 * Resolves the git dirs of `repo` from the file system (the `.git` file and
 * the admin dir's `commondir`), falling back to `git rev-parse`, and finally
 * to `<repo>/.git` for both when neither can answer.
 */
export function resolveGitDirs(repo: string): GitDirs {
  const resolved = resolveWithFileSystem(repo) ?? resolveWithGit(repo);
  if (resolved !== null) return resolved;
  const fallback = path.join(repo, ".git");
  return { gitDir: fallback, commonDir: fallback };
}
