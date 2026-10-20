/**
 * Where Git keeps the local and global config files, resolved the way the
 * engine's `config_list` resolves them. Shared by the engine seam and the CLI
 * config query so both decide "this scope has no file" the same way.
 */

import * as fs from "node:fs";
import * as path from "node:path";

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

const gitDirPrefix = "gitdir:";

function parseGitDirLine(firstLine: string): string | null {
  if (!firstLine.startsWith(gitDirPrefix)) return null;
  const target = firstLine.slice(gitDirPrefix.length).trim();
  return target === "" ? null : target;
}

/**
 * The local config file `git config --list --local` reads (`<gitdir>/config`;
 * a `.git` file, as in worktrees and submodules, names the real git dir on
 * its `gitdir:` line). Null when it cannot be resolved.
 */
export function resolveLocalGitConfigPath(repo: string): string | null {
  const dotGit = path.join(repo, ".git");
  let gitDir: string;
  try {
    if (fs.statSync(dotGit).isDirectory()) {
      gitDir = dotGit;
    } else {
      const firstLine = fs.readFileSync(dotGit, "utf8").split("\n")[0] ?? "";
      const target = parseGitDirLine(firstLine);
      if (target === null) return null;
      gitDir = path.resolve(repo, target);
    }
  } catch {
    return null;
  }
  return path.join(gitDir, "config");
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
