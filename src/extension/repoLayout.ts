/**
 * How the listed repositories group into Git repositories (release 1.10.0,
 * W32). The dropdown groups worktrees by their common git directory, never by
 * path prefix, so a sibling worktree, a nested one and one beside a bare
 * repository all land with the repository they belong to.
 *
 * The grouping is read from the file system (`resolveGitDirs`), so it is
 * synchronous and costs no Git process. Only the branch labels and the
 * outside-workspace entries need `git worktree list`; they arrive through
 * `WorktreeDetails` and `OutsideWorktree`, filled in after each scan.
 */

import * as fs from "node:fs";

import { resolveGitDirs } from "@/backend/utils/gitDirs";
import type { OutsideWorktree, RepoLayout, RepoWorktreeInfo } from "@/types";

/** What `git worktree list` says about one worktree, keyed by its normalized path. */
export type WorktreeDetails = { branch: string | null; detached: boolean };

/** Forward slashes, like every repository path the extension keeps. */
function normalize(file: string): string {
  return file.replaceAll("\\", "/");
}

/** A path with symlinks resolved, so two spellings of one directory compare equal. */
function realPath(file: string): string {
  try {
    return normalize(fs.realpathSync(file));
  } catch {
    return normalize(file);
  }
}

/** The shared git directory of `repo`, and whether `repo` is a linked worktree of it. */
export function worktreeGroupOf(repo: string): { commonDir: string; linked: boolean } {
  const dirs = resolveGitDirs(repo);
  return {
    commonDir: realPath(dirs.commonDir),
    linked: realPath(dirs.gitDir) !== realPath(dirs.commonDir)
  };
}

/**
 * The main worktree that owns a linked worktree's common dir, or null when
 * there is none to name: a bare repository, or a git dir that is not `.git`.
 */
export function mainWorktreeOf(commonDir: string): string | null {
  const normalized = normalize(commonDir);
  const slash = normalized.lastIndexOf("/");
  if (slash <= 0 || normalized.slice(slash + 1) !== ".git") return null;
  return normalized.slice(0, slash);
}

export function buildRepoLayout(
  repoPaths: readonly string[],
  details: ReadonlyMap<string, WorktreeDetails>,
  outside: readonly OutsideWorktree[]
): RepoLayout {
  const worktrees: { [repo: string]: RepoWorktreeInfo } = {};
  for (const repo of repoPaths) {
    const listed = details.get(normalize(repo));
    worktrees[repo] = {
      ...worktreeGroupOf(repo),
      branch: listed?.branch ?? null,
      detached: listed?.detached ?? false
    };
  }
  const known = new Set(repoPaths.map(normalize));
  return { worktrees, outside: outside.filter((entry) => !known.has(normalize(entry.path))) };
}
