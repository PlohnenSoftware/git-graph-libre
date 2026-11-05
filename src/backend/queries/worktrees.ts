import type { SimpleGit } from "simple-git";

import type { GitQueryError, GitWorktree } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const NUL = "\0";
const branchPrefix = "refs/heads/";

/** Thrown when `git worktree list --porcelain -z` output does not have the shape Git documents. */
export class WorktreeListFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorktreeListFormatError";
    Object.setPrototypeOf(this, WorktreeListFormatError.prototype);
  }
}

export type WorktreeListResult = {
  value: GitWorktree[];
  error: GitQueryError | null;
};

/**
 * Splits the NUL-separated output into records. Each field ends with a NUL,
 * and an empty field ends its record. A trailing field with no terminator is
 * a truncated record and is rejected rather than guessed at.
 */
function splitRecords(stdout: string): string[][] {
  const fields = stdout.split(NUL);
  // The text after the last NUL is empty and carries no field.
  if (fields.at(-1) === "") fields.pop();

  const records: string[][] = [];
  let current: string[] = [];
  for (const field of fields) {
    if (field === "") {
      records.push(current);
      current = [];
    } else {
      current.push(field);
    }
  }
  if (current.length > 0) {
    throw new WorktreeListFormatError("Worktree record is missing its terminating empty field.");
  }
  return records;
}

function splitKeyValue(field: string): { key: string; value: string | null } {
  const space = field.indexOf(" ");
  if (space === -1) return { key: field, value: null };
  return { key: field.slice(0, space), value: field.slice(space + 1) };
}

function toWorktree(fields: string[], isMain: boolean): GitWorktree {
  let path: string | null = null;
  let head: string | null = null;
  let branch: string | null = null;
  let detached = false;
  let bare = false;
  let locked: GitWorktree["locked"] = null;
  let prunable: GitWorktree["prunable"] = null;

  for (const field of fields) {
    const { key, value } = splitKeyValue(field);
    switch (key) {
      case "worktree":
        path = value ?? "";
        break;
      case "HEAD":
        head = value;
        break;
      case "branch":
        branch = value?.startsWith(branchPrefix) ? value.slice(branchPrefix.length) : value;
        break;
      case "detached":
        detached = true;
        break;
      case "bare":
        bare = true;
        break;
      case "locked":
        locked = { reason: value ?? "" };
        break;
      case "prunable":
        prunable = { reason: value ?? "" };
        break;
      default:
        // Fields from a newer Git are ignored, so this parser keeps working.
        break;
    }
  }

  if (path === null || path === "") {
    throw new WorktreeListFormatError("Worktree record has no worktree path.");
  }

  return {
    path,
    head,
    branch,
    detached,
    bare,
    isMain,
    isCurrent: false,
    locked,
    prunable
  };
}

/**
 * Parses `git worktree list --porcelain -z` output. Pure: it never touches
 * the file system, so `isCurrent` is always false here; {@link loadWorktrees}
 * sets it by comparing canonical paths.
 */
export function parseWorktreeList(stdout: string): GitWorktree[] {
  return splitRecords(stdout).map((fields, index) => toWorktree(fields, index === 0));
}

/**
 * Lists the repository's worktrees in Git's own order (main first, then the
 * linked worktrees by path). `isCurrent` marks the worktree the repository
 * was asked about, compared by canonical path so symlinks and Windows drive
 * letters do not split one worktree in two.
 */
export async function loadWorktrees(
  git: SimpleGit,
  repo: string,
  record?: GitCommandRecorder
): Promise<WorktreeListResult> {
  let worktrees: GitWorktree[];
  try {
    const stdout = await runGitRaw(git, {
      label: "worktrees.list",
      kind: "query",
      args: ["worktree", "list", "--porcelain", "-z"],
      repo,
      record
    });
    worktrees = parseWorktreeList(stdout);
  } catch (error: unknown) {
    if (error instanceof WorktreeListFormatError) {
      return {
        value: [],
        error: { message: error.message, stderr: null, exitCode: null, task: null }
      };
    }
    return { value: [], error: toGitQueryError(error, "Unable to list worktrees") };
  }

  const currentPath = await canonicalizePath(repo);
  const canonicalPaths = await Promise.all(
    worktrees.map((worktree) => canonicalizePath(worktree.path))
  );
  return {
    value: worktrees.map((worktree, index) => ({
      ...worktree,
      isCurrent: canonicalPaths[index] === currentPath
    })),
    error: null
  };
}
