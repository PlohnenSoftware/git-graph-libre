/**
 * Where a repository's git directories live: the directory that holds its own
 * HEAD and index (`gitDir`) and the one that holds the shared refs, config and
 * `worktrees/` (`commonDir`). The two are equal for a normal repository, a
 * submodule and a bare repository; in a linked worktree `gitDir` is
 * `<common>/worktrees/<id>`.
 *
 * Everything is read from the file system. No Git process is spawned, so the
 * answer does not depend on `PATH`.
 */

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

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/** The git dir `<repo>/.git` names, whether it is a directory or a `gitdir:` file. */
function readGitDir(repo: string): string | null {
  const dotGit = path.join(repo, ".git");
  if (isDirectory(dotGit)) return dotGit;
  const line = readFirstLine(dotGit);
  if (!line?.startsWith(gitDirPrefix)) return null;
  const target = line.slice(gitDirPrefix.length).trim();
  return target === "" ? null : path.resolve(repo, target);
}

/** The common dir a git dir names in its `commondir` file, or the git dir itself. */
function commonDirOf(gitDir: string): string {
  const common = readFirstLine(path.join(gitDir, "commondir"));
  return common === null || common === "" ? gitDir : path.resolve(gitDir, common);
}

/**
 * A bare repository has no `.git`: the repository directory is itself the git
 * dir, recognized by its `HEAD` file and its `objects` directory.
 */
function isBareRepo(repo: string): boolean {
  return (
    !fs.existsSync(path.join(repo, ".git")) &&
    isFile(path.join(repo, "HEAD")) &&
    isDirectory(path.join(repo, "objects"))
  );
}

function resolveFromFileSystem(repo: string): GitDirs | null {
  const gitDir = readGitDir(repo);
  if (gitDir !== null) return { gitDir, commonDir: commonDirOf(gitDir) };
  if (isBareRepo(repo)) return { gitDir: repo, commonDir: commonDirOf(repo) };
  return null;
}

/**
 * Resolves the git dirs of `repo` from the file system: the `.git` directory or
 * `gitdir:` file, the bare-repository layout, and the admin dir's `commondir`.
 * When none of them applies, answers `<repo>/.git` for both.
 */
export function resolveGitDirs(repo: string): GitDirs {
  const resolved = resolveFromFileSystem(repo);
  if (resolved !== null) return resolved;
  const fallback = path.join(repo, ".git");
  return { gitDir: fallback, commonDir: fallback };
}
