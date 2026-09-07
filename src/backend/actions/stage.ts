/**
 * Staging actions behind the uncommitted-changes panel: move files between the
 * index and the worktree. Both run through `runGitRaw` so every stage and
 * unstage reaches the git-command log like the other actions, and both take a
 * list rather than a single path so a future multi-select needs no new action.
 */
import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type ActionPayloadByCommand = {
  stageFiles: ActionPayload<"stageFiles">;
  unstageFiles: ActionPayload<"unstageFiles">;
};

type ActionInput<T extends keyof ActionPayloadByCommand> = ActionPayloadByCommand[T] & {
  repo?: string | null;
};

/**
 * Reject payloads git would read as something other than the file list.
 *
 * The paths arrive from the webview, so they are checked here rather than
 * trusted: an empty list would make `git add --` stage nothing (or, worse, a
 * future arg change stage everything), a blank path is never a real worktree
 * entry, and a literal `--` would close the pathspec separator the callers
 * below rely on.
 */
function requirePaths(filePaths: string[]): void {
  if (filePaths.length === 0) throw new Error("File paths are required.");
  for (const filePath of filePaths) {
    if (filePath.trim() === "" || filePath === "--") {
      throw new Error("File paths must not be empty.");
    }
  }
}

/**
 * Stage the given worktree paths (`git add`).
 *
 * The `--` separator is load-bearing: without it a path that begins with `-`,
 * or one that happens to match a branch or tag name, is read as an option or a
 * revision instead of as a file.
 */
export async function stageFiles(
  git: SimpleGit,
  input: ActionInput<"stageFiles">,
  record?: GitCommandRecorder
): Promise<void> {
  requirePaths(input.filePaths);
  await runGitRaw(git, {
    label: "stage.add",
    kind: "action",
    args: ["add", "--", ...input.filePaths],
    repo: input.repo ?? null,
    record
  });
}

/**
 * Unstage the given paths, leaving the worktree untouched
 * (`git reset HEAD -- <paths>`).
 *
 * A pathspec reset only rewrites those index entries, so unstaging never
 * touches the files on disk or any other staged change. `HEAD` resolves even
 * on an unborn branch — verified against git 2.55: unstaging the first ever
 * `git add` in a repository with no commits returns the file to untracked
 * rather than failing.
 */
export async function unstageFiles(
  git: SimpleGit,
  input: ActionInput<"unstageFiles">,
  record?: GitCommandRecorder
): Promise<void> {
  requirePaths(input.filePaths);
  await runGitRaw(git, {
    label: "stage.reset",
    kind: "action",
    args: ["reset", "HEAD", "--", ...input.filePaths],
    repo: input.repo ?? null,
    record
  });
}
