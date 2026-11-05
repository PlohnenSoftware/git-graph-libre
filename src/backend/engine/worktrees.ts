/**
 * The worktree list through the engine or the CLI (release 1.10.0, slice W03).
 *
 * `git worktree list` costs a spawn, and the engine already reads everything
 * it prints: the admin directories, each worktree's HEAD and its lock. The
 * addon export is optional: a binary built before it loads without
 * `listWorktrees` and lands on exactly the CLI behavior, which is why the
 * engine version is not bumped. The engine declines (`Unsupported`) whenever
 * Git's answer could differ, such as a prunable worktree or an admin entry
 * with no `gitdir` file, and the CLI is the authority there.
 */

import type { SimpleGit } from "simple-git";
import { loadWorktrees, type WorktreeListResult } from "@/backend/queries/worktrees";
import type { GitWorktree } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { logBackendRoute } from "@/backend/utils/operationLog";
import type { EngineBackend } from "@/types";
import { type EngineAddon, loadEngineAddon } from "./addon";
import { isEngineFallbackError } from "./index";

/** The slice of the engine addon the worktree list needs. */
export type WorktreesAddon = Pick<EngineAddon, "listWorktrees">;

export type WorktreesDeps = {
  /** Read live on every call, so flipping the backend needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => WorktreesAddon | null;
  /** Whether Git confirmed it accepts the repository; see `RepoSearch.isVerified`. */
  isVerified?: (repo: string) => boolean;
};

const OPERATION = "listWorktrees";

/**
 * The repository's worktrees, main first: the engine when it may serve them,
 * `git worktree list` otherwise (`loadWorktrees`).
 */
export async function readWorktrees(
  git: SimpleGit,
  repo: string,
  deps: WorktreesDeps = {},
  record?: GitCommandRecorder
): Promise<WorktreeListResult> {
  const fromEngine = await readFromEngine(repo, deps);
  if (fromEngine !== null) return { value: fromEngine, error: null };
  return loadWorktrees(git, repo, record);
}

/**
 * The list from the engine, or null when the CLI must serve it: the git-cli
 * preference, an unverified repository, no loadable addon, an addon without
 * `listWorktrees`, a decline, any other engine throw, or a malformed payload.
 */
async function readFromEngine(repo: string, deps: WorktreesDeps): Promise<GitWorktree[] | null> {
  const viaCli = (reason: string) => {
    logBackendRoute(OPERATION, `backend=cli reason=${reason}`);
    return null;
  };
  const backend = deps.backend ?? (() => "git-cli");
  if (backend() !== "auto") return viaCli("setting");
  const isVerified = deps.isVerified ?? (() => false);
  if (!isVerified(repo)) return viaCli("unverified");
  const addon = (deps.addonProvider ?? (() => loadEngineAddon()))();
  if (addon === null) return viaCli("engineUnavailable");
  if (typeof addon.listWorktrees !== "function") return viaCli("noListWorktrees");
  let payload: string;
  try {
    payload = await addon.listWorktrees(repo);
  } catch (error: unknown) {
    return viaCli(isEngineFallbackError(error) ? "declined" : "engineThrew");
  }
  const entries = parseEngineWorktrees(payload);
  if (entries === null) return viaCli("malformedPayload");
  logBackendRoute(OPERATION, "backend=engine");
  return markCurrent(entries, repo);
}

type EngineWorktree = Omit<GitWorktree, "isCurrent" | "prunable">;

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function toEngineWorktree(value: unknown): EngineWorktree | null {
  if (typeof value !== "object" || value === null) return null;
  const { path, head, branch, detached, bare, isMain, locked } = value as Record<string, unknown>;
  if (!isString(path) || path === "") return null;
  if (!isNullableString(head) || !isNullableString(branch) || !isNullableString(locked)) {
    return null;
  }
  if (typeof detached !== "boolean" || typeof bare !== "boolean" || typeof isMain !== "boolean") {
    return null;
  }
  return {
    path,
    head,
    branch,
    detached,
    bare,
    isMain,
    locked: locked === null ? null : { reason: locked }
  };
}

/**
 * Strictly the engine's shape: a non-empty array whose first entry, and only
 * it, is the main worktree. Anything else is null, so the CLI answers.
 */
export function parseEngineWorktrees(payload: string): EngineWorktree[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const entries: EngineWorktree[] = [];
  for (const item of parsed) {
    const entry = toEngineWorktree(item);
    if (entry === null) return null;
    entries.push(entry);
  }
  return entries.every((entry, index) => entry.isMain === (index === 0)) ? entries : null;
}

/** Maps into `GitWorktree`, setting `isCurrent` as `loadWorktrees` does. */
async function markCurrent(entries: EngineWorktree[], repo: string): Promise<GitWorktree[]> {
  const currentPath = await canonicalizePath(repo);
  const canonicalPaths = await Promise.all(entries.map((entry) => canonicalizePath(entry.path)));
  return entries.map((entry, index) => ({
    ...entry,
    isCurrent: canonicalPaths[index] === currentPath,
    prunable: null
  }));
}
