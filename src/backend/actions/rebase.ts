import * as fs from "node:fs";
import * as path from "node:path";
import type { SimpleGit } from "simple-git";

import { loadOperationState, rebaseStateDirOf } from "@/backend/queries/operationState";
import type { ActionPayload } from "@/backend/types";
import { resolveGitDirs } from "@/backend/utils/gitDirs";
import {
  GitCommandError,
  type GitCommandRecorder,
  runGitRaw,
  runGitWithEnv
} from "@/backend/utils/gitRunner";

type RebaseCurrentBranchInput = ActionPayload<"rebaseCurrentBranch"> & {
  repo?: string | null;
};

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

export async function rebaseCurrentBranch(
  git: SimpleGit,
  input: RebaseCurrentBranchInput,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.target, "Rebase target");
  const args = ["rebase"];
  if (input.ignoreDate) args.push("--ignore-date");
  args.push(input.target);

  await runGitRaw(git, {
    label: `rebase.${input.targetType}`,
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}

/**
 * Input for the in-progress controls (F2-03). The webview sends no payload
 * beyond the repository; `binary` is threaded in by the handler like the
 * interactive handoff's, because `--continue` needs `GIT_EDITOR` on its own
 * process (see `runGitWithEnv`).
 */
export type RebaseControlInput = {
  repo?: string | null;
  binary: string;
};

/**
 * Removes the prepared-message directory an interactive rebase left under
 * the git dir (`ggl-rebase/`, F2-01b). Only ever called once Git's own state
 * directory is gone: while a rebase is paused, its remaining `exec` lines
 * still name those files.
 */
function removePreparedMessages(gitDir: string): void {
  fs.rmSync(path.join(gitDir, "ggl-rebase"), { recursive: true, force: true });
}

/**
 * Runs one `git rebase --continue` / `--skip` / `--abort`. A continue or
 * skip that stops again (the next conflict, the next `edit`) is a pause,
 * not a failure: Git exits non-zero with its state directory left, and the
 * banner re-reads that state. Only a non-zero exit with no state left, and
 * any failed abort, throw Git's own words. When the run ends the rebase —
 * finished, skipped to the end, or aborted — the prepared messages go with
 * it.
 */
async function runRebaseControl(
  git: SimpleGit,
  input: RebaseControlInput,
  control: { flag: "--continue" | "--skip" | "--abort"; label: string; fallback: string },
  record?: GitCommandRecorder
): Promise<void> {
  const repo = input.repo ?? "";
  requireValue(repo, "Repository");
  requireValue(input.binary, "Git binary");

  if (control.flag === "--continue") {
    // IQ9: never continue over unmerged paths, and never stage anything
    // silently. The state read is the same one the banner blocks on; a
    // failed read leaves the decision to Git rather than guessing.
    const state = await loadOperationState(git, { repo, recordGitCommand: record });
    if (state.error === null && state.kind === "rebase" && state.conflictFiles.length > 0) {
      throw new Error(
        "Unmerged paths remain. Resolve the conflicts and stage the files before continuing."
      );
    }
  }

  const { gitDir } = resolveGitDirs(path.resolve(repo));
  let exitCode: number | null = 0;
  let stderr = "";
  try {
    await runGitWithEnv(git, {
      label: control.label,
      kind: "action",
      args: ["rebase", control.flag],
      repo,
      binary: input.binary,
      env: { GIT_EDITOR: "true", LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
      record
    });
  } catch (error: unknown) {
    if (!(error instanceof GitCommandError)) throw error;
    exitCode = error.record.error?.exitCode ?? null;
    stderr = error.record.error?.stderr ?? error.message;
  }

  const stillPaused = rebaseStateDirOf(gitDir) !== null;
  if (!stillPaused) removePreparedMessages(gitDir);
  if (exitCode === 0) return;
  if (stillPaused && control.flag !== "--abort") return;
  throw new Error(stderr.trim() === "" ? control.fallback : stderr);
}

/** Continues the repository's in-progress rebase. Blocked while unmerged paths remain (IQ9). */
export function continueRebase(
  git: SimpleGit,
  input: RebaseControlInput,
  record?: GitCommandRecorder
): Promise<void> {
  return runRebaseControl(
    git,
    input,
    {
      flag: "--continue",
      label: "rebase.continue",
      fallback: "The rebase could not be continued."
    },
    record
  );
}

/** Skips the commit the repository's in-progress rebase stopped on. */
export function skipRebase(
  git: SimpleGit,
  input: RebaseControlInput,
  record?: GitCommandRecorder
): Promise<void> {
  return runRebaseControl(
    git,
    input,
    { flag: "--skip", label: "rebase.skip", fallback: "The commit could not be skipped." },
    record
  );
}

/** Aborts the repository's in-progress rebase, restoring the branch to its pre-rebase tip. */
export function abortRebase(
  git: SimpleGit,
  input: RebaseControlInput,
  record?: GitCommandRecorder
): Promise<void> {
  return runRebaseControl(
    git,
    input,
    { flag: "--abort", label: "rebase.abort", fallback: "The rebase could not be aborted." },
    record
  );
}
