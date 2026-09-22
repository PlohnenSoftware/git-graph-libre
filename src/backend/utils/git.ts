import * as fs from "node:fs/promises";

import { simpleGit } from "simple-git";

/** A leading Windows drive letter, as in the `C:` of `C:/src/repo`. */
const WINDOWS_DRIVE_LETTER = /^[a-zA-Z]:/;

/**
 * Drop the trailing separators a path built with a final slash carries.
 *
 * Scanned rather than matched with `/\/+$/`: a `+` against an end anchor
 * backtracks super-linearly (`typescript:S8786`), and these paths come from
 * whatever workspace the user opened. The floor of one character keeps the
 * filesystem root as `/` instead of reducing it to the empty string.
 */
function withoutTrailingSeparators(value: string): string {
  let end = value.length;
  while (end > 1 && value.charAt(end - 1) === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

/**
 * Reduce a filesystem path to the one form two paths can be compared in.
 *
 * `isGitRepository()` compares a path this extension holds against the one
 * `git rev-parse --show-toplevel` prints for the same directory, and the two
 * disagree in three ways that have nothing to do with being different
 * directories:
 *
 * - **Symlinks.** git reports the *physical* path of the working tree, while
 *   a workspace folder keeps whatever path the user opened. This is the
 *   common case rather than an exotic one: `os.tmpdir()` on macOS sits under
 *   `/var`, itself a symlink to `/private/var`, so even this repository's own
 *   tests would compare `/var/folders/…` against `/private/var/folders/…`.
 * - **Separators.** Every repository path in the extension is normalized to
 *   `/` (`getPathFromUri`/`getPathFromStr`) and git prints `/` as well, but a
 *   path that reached us through `path.join` on Windows carries `\`.
 * - **Drive-letter case.** VS Code's `Uri.fsPath` lower-cases the drive
 *   letter while git prints it as the filesystem stores it, so one and the
 *   same directory arrives as `c:/src/repo` and `C:/src/repo`.
 *
 * A path that cannot be resolved is kept as it was given rather than
 * throwing: the caller answers `false` for a directory that is not there, and
 * two identically unresolvable paths still compare equal.
 */
export async function canonicalizePath(value: string): Promise<string> {
  const resolved = await fs.realpath(value).catch(() => value);
  const trimmed = withoutTrailingSeparators(resolved.replaceAll("\\", "/"));
  return WINDOWS_DRIVE_LETTER.test(trimmed)
    ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
    : trimmed;
}

/**
 * Whether `repoPath` is itself the root of a Git repository's working tree.
 *
 * `checkIsRepo()` with no argument checks `--is-inside-work-tree`, which is
 * true for every subdirectory of a working tree, not only its root — so it
 * cannot tell a real repository apart from a plain folder inside one. Repo
 * discovery (`repoSearch.ts`) needs the stricter check: without it, a
 * subdirectory reached directly (for example by the workspace file watcher
 * reacting to a newly created directory inside an already-known repository)
 * is indistinguishable from a repository of its own.
 *
 * `simple-git`'s `CheckRepoActions.IS_REPO_ROOT` looks like the fix, but it
 * compares `--git-dir` against `.`/`.git`, which never matches a submodule or
 * a linked worktree: their `.git` is a file pointing elsewhere, so
 * `--git-dir` resolves to an absolute path outside `repoPath`.
 * `--show-toplevel` reports the root of the current working tree regardless
 * of how `.git` is stored, so comparing it against `repoPath` covers ordinary
 * repositories, submodules, and worktrees alike.
 *
 * **Both sides go through `canonicalizePath()` before they are compared**, and
 * that is load-bearing rather than defensive: a raw string comparison answers
 * `false` for every repository opened through a symlink and, because
 * `Uri.fsPath` lower-cases drive letters while git does not, for every
 * repository on Windows. Answering `false` here is not a harmless miss — it
 * removes the repository from discovery, makes `loadBranches` report that the
 * folder is not a repository, and lets `repoManager`'s periodic validation
 * drop it from the dropdown.
 */
export async function isGitRepository(repoPath: string, gitPath: string): Promise<boolean> {
  try {
    const toplevel = await simpleGit({ baseDir: repoPath, binary: gitPath }).raw([
      "rev-parse",
      "--show-toplevel"
    ]);
    const [root, queried] = await Promise.all([
      canonicalizePath(toplevel.trim()),
      canonicalizePath(repoPath)
    ]);
    return root === queried;
  } catch {
    return false;
  }
}

export async function getRemoteUrl(repoPath: string, gitPath: string): Promise<string | null> {
  try {
    const url = await simpleGit({ baseDir: repoPath, binary: gitPath }).raw([
      "config",
      "--get",
      "remote.origin.url"
    ]);
    return url.trim() || null;
  } catch {
    return null;
  }
}
