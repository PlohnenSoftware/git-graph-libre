import { simpleGit } from "simple-git";

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
 */
export async function isGitRepository(repoPath: string, gitPath: string): Promise<boolean> {
  try {
    const toplevel = await simpleGit({ baseDir: repoPath, binary: gitPath }).raw([
      "rev-parse",
      "--show-toplevel"
    ]);
    return toplevel.trim() === repoPath;
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
