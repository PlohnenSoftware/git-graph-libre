import * as fs from "node:fs";
import * as path from "node:path";
import type { SimpleGit } from "simple-git";
import type {
  GitOperationStateResult,
  GitRebaseOperation,
  GitRebaseState,
  GitRebaseStopReason
} from "@/backend/types";
import { resolveGitDirs } from "@/backend/utils/gitDirs";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const objectName = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const BRANCH_REF_PREFIX = "refs/heads/";

export type OperationStateInput = {
  repo: string;
  recordGitCommand?: GitCommandRecorder;
};

type Reader = (args: string[], label: string) => Promise<string>;

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

/**
 * The directory holding an in-progress rebase for one per-worktree git
 * directory, or null when none is under way. Only the `rebase-merge` and
 * `rebase-apply` directories are evidence: `REBASE_HEAD` lingers after a
 * successful rebase (verified on Git 2.56.1, the `a79f444` regression), so
 * it never decides this.
 */
export function rebaseStateDirOf(
  gitDir: string
): { dir: string; backend: "merge" | "apply" } | null {
  const mergeDir = path.join(gitDir, "rebase-merge");
  if (isDirectory(mergeDir)) return { dir: mergeDir, backend: "merge" };
  const applyDir = path.join(gitDir, "rebase-apply");
  if (isDirectory(applyDir)) return { dir: applyDir, backend: "apply" };
  return null;
}

/** A state file's trimmed content, or null when it is missing or empty. */
function readStateFile(stateDir: string, name: string): string | null {
  try {
    const value = fs.readFileSync(path.join(stateDir, name), "utf8").trim();
    return value === "" ? null : value;
  } catch {
    return null;
  }
}

/** A state file read as a full object name, or null when it holds none. */
function readObjectName(stateDir: string, name: string): string | null {
  const value = readStateFile(stateDir, name);
  return value !== null && objectName.test(value) ? value : null;
}

/** A state file read as a positive step count (`msgnum`, `end`, …), or null. */
function readStepCount(stateDir: string, name: string): number | null {
  const value = readStateFile(stateDir, name);
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === value ? parsed : null;
}

/**
 * The short branch name a `head-name` file records (`refs/heads/<name>`), or
 * null for anything else — a detached HEAD records the words `detached HEAD`
 * (verified on Git 2.56.1), which name no branch.
 */
function branchFromHeadName(headName: string | null): string | null {
  if (headName === null || !headName.startsWith(BRANCH_REF_PREFIX)) return null;
  const branch = headName.slice(BRANCH_REF_PREFIX.length);
  return branch === "" ? null : branch;
}

/**
 * The subject of the stopped commit, or null when Git cannot name it. The
 * hash comes from a state file, so it is validated as an object name before
 * it reaches Git at all. A failed read degrades to no subject: the banner
 * still has the state files to show.
 */
async function readSubject(read: Reader, hash: string | null): Promise<string | null> {
  if (hash === null) return null;
  try {
    const subject = (
      await read(["show", "-s", "--format=%s", "--end-of-options", hash], "operationState.subject")
    ).replace(/\r?\n$/, "");
    return subject === "" ? null : subject;
  } catch {
    return null;
  }
}

/** The unmerged paths, NUL-separated so no path needs quoting or parsing. */
async function readConflictFiles(read: Reader): Promise<string[]> {
  const stdout = await read(
    ["diff", "--name-only", "--diff-filter=U", "-z"],
    "operationState.unmerged"
  );
  return stdout.split("\0").filter((name) => name !== "");
}

function stopReasonOf(
  stateDir: string,
  backend: "merge" | "apply",
  conflictFiles: string[]
): GitRebaseStopReason {
  if (conflictFiles.length > 0) return "conflict";
  // The merge backend writes an `amend` file when it stops for an `edit`
  // (verified on Git 2.56.1: present at edit stops, absent at conflict and
  // failed-exec stops). `stopped-sha` alone is written for conflicts too,
  // so it cannot tell an edit stop from a resolved conflict.
  if (backend === "merge" && isFile(path.join(stateDir, "amend"))) return "edit";
  return "other";
}

async function readRebaseState(
  read: Reader,
  state: { dir: string; backend: "merge" | "apply" }
): Promise<{ rebase: GitRebaseState; conflictFiles: string[] }> {
  const { dir, backend } = state;
  const stoppedHash =
    backend === "merge"
      ? readObjectName(dir, "stopped-sha")
      : readObjectName(dir, "original-commit");
  const conflictFiles = await readConflictFiles(read);
  const rebase: GitRebaseState = {
    backend,
    stoppedHash,
    subject: await readSubject(read, stoppedHash),
    current: backend === "merge" ? readStepCount(dir, "msgnum") : readStepCount(dir, "next"),
    total: backend === "merge" ? readStepCount(dir, "end") : readStepCount(dir, "last"),
    branch: branchFromHeadName(readStateFile(dir, "head-name")),
    onto: readObjectName(dir, "onto"),
    stopReason: stopReasonOf(dir, backend, conflictFiles)
  };
  return { rebase, conflictFiles };
}

/**
 * The non-rebase operation one git directory records, in the same order the
 * range read checks them: a merge, a cherry-pick or a revert in progress.
 * Context for callers; the banner acts only on a rebase.
 */
function otherOperationOf(gitDir: string): GitRebaseOperation | null {
  if (isFile(path.join(gitDir, "MERGE_HEAD"))) return "merge";
  if (isFile(path.join(gitDir, "CHERRY_PICK_HEAD"))) return "cherry-pick";
  if (isFile(path.join(gitDir, "REVERT_HEAD"))) return "revert";
  return null;
}

function failure(error: GitOperationStateResult["error"]): GitOperationStateResult {
  return { kind: null, rebase: null, conflictFiles: [], error };
}

/**
 * Reads the operation in progress in `repo`'s own worktree from the state
 * files in its per-worktree git directory — never from Git's message text,
 * so the answer does not depend on the user's language. A rebase started
 * anywhere (the terminal mode, another tool, a plain shell) leaves the same
 * files and reads the same way. Read-only; the only Git processes are the
 * unmerged-path list and the stopped commit's subject, and they run only
 * while a rebase state directory exists. A failed read is an `error` with
 * no operation, never a guessed state.
 */
export async function loadOperationState(
  git: SimpleGit,
  input: OperationStateInput
): Promise<GitOperationStateResult> {
  const read: Reader = (args, label) =>
    runGitRaw(git, {
      label,
      kind: "query",
      args,
      repo: input.repo,
      record: input.recordGitCommand
    });
  try {
    const { gitDir } = resolveGitDirs(input.repo);
    const state = rebaseStateDirOf(gitDir);
    if (state === null) {
      return { kind: otherOperationOf(gitDir), rebase: null, conflictFiles: [], error: null };
    }
    const { rebase, conflictFiles } = await readRebaseState(read, state);
    return { kind: "rebase", rebase, conflictFiles, error: null };
  } catch (error: unknown) {
    return failure(toGitQueryError(error, "Unable to read the operation state"));
  }
}
