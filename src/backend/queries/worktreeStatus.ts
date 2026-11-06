import type { SimpleGit } from "simple-git";

import { worktreeChanges } from "@/backend/actions/worktree";
import { loadWorktrees } from "@/backend/queries/worktrees";
import type { GitWorktree, QueryResult, WorktreeChangeStatus } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { mapSequential } from "@/backend/utils/sequential";

/** How long one worktree's read may take before its status says unknown. */
export const WORKTREE_STATUS_TIMEOUT_MS = 5000;

/** How many worktrees are read at the same time; the rest wait for a slot. */
export const WORKTREE_STATUS_CONCURRENCY = 3;

const UNKNOWN: WorktreeChangeStatus = { state: "unknown", count: 0, truncated: false };

/**
 * Turns W21's `worktreeChanges` answer into a status. A failed read, or one
 * that timed out (`null`), is unknown: an empty answer is only clean when the
 * read succeeded.
 */
function toStatus(result: QueryResult<"worktreeChanges"> | null): WorktreeChangeStatus {
  if (result?.error !== null) return UNKNOWN;
  if (result.files.length === 0 && !result.truncated) {
    return { state: "clean", count: 0, truncated: false };
  }
  return { state: "dirty", count: result.files.length, truncated: result.truncated };
}

/** Resolves to `null` when `work` has not settled after `ms`. The late result is ignored. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

/** Worktrees keyed by canonical path, so a path the webview sends matches however Git spelled it. */
async function listedByPath(worktrees: GitWorktree[]): Promise<Map<string, GitWorktree>> {
  const entries = await Promise.all(
    worktrees.map(async (worktree) => [await canonicalizePath(worktree.path), worktree] as const)
  );
  return new Map(entries);
}

/**
 * Reads one path. Only a worktree Git lists, that is not stale or bare, is
 * read: anything else has no folder to inspect, so it is unknown rather than
 * clean. The read itself is W21's `worktreeChanges`, which lists again.
 */
async function statusOf(
  git: SimpleGit,
  repo: string,
  path: string,
  listed: Map<string, GitWorktree>,
  options: ReadOptions
): Promise<WorktreeChangeStatus> {
  const target = listed.get(await canonicalizePath(path));
  if (target?.prunable !== null || target.bare) return UNKNOWN;
  const read = worktreeChanges(git, {
    repo,
    path: target.path,
    recordGitCommand: options.recordGitCommand
  });
  return toStatus(await withTimeout(read, options.timeoutMs ?? WORKTREE_STATUS_TIMEOUT_MS));
}

type ReadOptions = { recordGitCommand?: GitCommandRecorder; timeoutMs?: number };

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * The uncommitted-changes status of the given worktrees, read on demand when
 * the Worktrees popup opens (Y20 (a)). Reads run a few at a time, each with a
 * timeout, and nothing is read for a path Git does not list.
 */
export async function worktreeStatus(
  git: SimpleGit,
  input: {
    repo: string;
    paths: string[];
    recordGitCommand?: GitCommandRecorder;
    timeoutMs?: number;
  }
): Promise<QueryResult<"worktreeStatus">> {
  const listing = await loadWorktrees(git, input.repo, input.recordGitCommand);
  const listed: Map<string, GitWorktree> =
    listing.error === null ? await listedByPath(listing.value) : new Map();
  const paths = [...new Set(input.paths)];
  const rows = await mapSequential(chunked(paths, WORKTREE_STATUS_CONCURRENCY), (chunk) =>
    Promise.all(
      chunk.map(
        async (path) => [path, await statusOf(git, input.repo, path, listed, input)] as const
      )
    )
  );
  return { statuses: Object.fromEntries(rows.flat()) };
}
