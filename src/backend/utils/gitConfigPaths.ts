/**
 * Where Git keeps the local and global config files, resolved the way the
 * engine's `config_list` resolves them. Shared by the engine seam and the CLI
 * config query so both decide "this scope has no file" the same way.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveGitDirs } from "./gitDirs";

export function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * The global config file the engine's `config_list` reads, mirroring its
 * resolution order (`GIT_CONFIG_GLOBAL`, then `~/.gitconfig`, then XDG).
 * Null when no home is configured at all.
 */
export function resolveGlobalGitConfigPath(): string | null {
  const explicit = process.env.GIT_CONFIG_GLOBAL;
  if (explicit !== undefined && explicit !== "") return explicit;
  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (home === undefined || home === "") return null;
  const dotted = path.join(home, ".gitconfig");
  if (isFile(dotted)) return dotted;
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg !== undefined && xdg !== "" ? xdg : path.join(home, ".config");
  return path.join(base, "git", "config");
}

/**
 * The local config file `git config --list --local` reads: `<common dir>/config`.
 * The common dir is the git dir for a normal repository and a submodule, and the
 * main repository's directory for a linked worktree, whose private admin dir
 * holds no `config` of its own. Null when `<repo>/.git` does not exist.
 */
export function resolveLocalGitConfigPath(repo: string): string | null {
  try {
    fs.statSync(path.join(repo, ".git"));
  } catch {
    return null;
  }
  return path.join(resolveGitDirs(repo).commonDir, "config");
}

/**
 * True only when the scope's config file is resolvable and every candidate
 * for it is missing. An unresolvable path answers false: absence is never
 * assumed. Classifying by file absence rather than by Git's error text keeps
 * the answer independent of the user's locale.
 */
export function isScopedGitConfigAbsent(scope: "local" | "global", repo: string | null): boolean {
  if (scope === "global") {
    const globalPath = resolveGlobalGitConfigPath();
    return globalPath !== null && !isFile(globalPath);
  }
  if (repo === null) return false;
  const localPath = resolveLocalGitConfigPath(repo);
  return localPath !== null && !isFile(localPath);
}
