import { readdir, stat } from "node:fs/promises";

import type { SimpleGit } from "simple-git";

import { deleteBranch } from "@/backend/actions/branch";
import { loadWorktrees } from "@/backend/queries/worktrees";
import type { ActionPayload, GitWorktree, QueryResult } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

/** The most paths `worktreeChanges` names; the confirmation says when there are more. */
export const MAX_WORKTREE_CHANGES = 20;

type RepoInput = { repo?: string | null };

/**
 * `@/l10n` needs the `vscode` module, which a backend module that only runs Git
 * must not require when it is first imported, so it loads on the failure path.
 */
async function fail(key: string, ...args: string[]): Promise<never> {
  const { t } = await import("@/l10n");
  throw new Error(t(key, ...args));
}

/**
 * The worktrees `git worktree prune` would remove: those whose folder is gone
 * and that are not locked (Git never prunes a locked entry). Decided from the
 * worktree list, never from Git's translated `prune -n -v` text.
 */
export function prunableWorktrees(worktrees: GitWorktree[]): GitWorktree[] {
  return worktrees.filter((worktree) => worktree.prunable !== null && worktree.locked === null);
}

async function listWorktrees(
  git: SimpleGit,
  repo: string | null | undefined,
  record?: GitCommandRecorder
): Promise<GitWorktree[]> {
  const result = await loadWorktrees(git, repo ?? "", record);
  if (result.error !== null) throw new Error(result.error.message);
  return result.value;
}

async function findWorktree(worktrees: GitWorktree[], path: string): Promise<GitWorktree | null> {
  const wanted = await canonicalizePath(path);
  const paths = await Promise.all(worktrees.map((worktree) => canonicalizePath(worktree.path)));
  const index = paths.indexOf(wanted);
  return index === -1 ? null : worktrees[index];
}

/**
 * Refuses what must never be removed from here (the main worktree, and the one
 * this graph shows), and a locked worktree unless the caller asked to unlock it.
 */
async function assertRemovable(target: GitWorktree, unlock: boolean): Promise<void> {
  if (target.isMain) await fail("error.worktreeIsMain", target.path);
  if (target.isCurrent) await fail("error.worktreeIsCurrent", target.path);
  if (target.locked === null || unlock) return;
  if (target.locked.reason === "") await fail("error.worktreeLocked", target.path);
  await fail("error.worktreeLockedReason", target.path, target.locked.reason);
}

/** An empty string from a dialog field means "not given", never a ref name. */
function nonEmpty(value: string | null): string | null {
  return value === null || value === "" ? null : value;
}

/**
 * Refuses a creation the worktree list already rules out, before Git runs:
 * the branch that would be checked out is held by another worktree, the
 * folder is already a worktree, or it exists and is not empty (Git allows an
 * existing empty folder). Nothing here reads Git's translated messages.
 */
async function assertCreatable(
  worktrees: GitWorktree[],
  input: ActionPayload<"addWorktree">
): Promise<void> {
  for (const branch of [input.branch, input.newBranch]) {
    if (branch === null) continue;
    const holder = worktrees.find((worktree) => worktree.branch === branch);
    if (holder !== undefined) await fail("error.worktreeBranchInUse", branch, holder.path);
  }
  if ((await findWorktree(worktrees, input.path)) !== null) {
    await fail("error.worktreePathListed", input.path);
  }
  const existing = await stat(input.path).catch(() => null);
  if (existing === null) return;
  if (!existing.isDirectory() || (await readdir(input.path)).length > 0) {
    await fail("error.worktreePathExists", input.path);
  }
}

/**
 * Creates a linked worktree with `git worktree add` on the CLI (the engine
 * never writes) and returns its path as Git lists it afterwards. Every value
 * is a separate argument; `--` ends the options before the folder, so a
 * folder or start point that starts with "-" stays a positional argument. A
 * new branch started from a remote branch tracks it, as Git sets that up.
 */
export async function addWorktree(
  git: SimpleGit,
  input: ActionPayload<"addWorktree"> & RepoInput,
  record?: GitCommandRecorder
): Promise<string> {
  const repo = input.repo ?? null;
  const path = input.path.trim();
  if (path === "") return fail("error.worktreePathRequired");
  const request = {
    ...input,
    path,
    branch: nonEmpty(input.branch),
    newBranch: nonEmpty(input.newBranch),
    startPoint: nonEmpty(input.startPoint)
  };
  await assertCreatable(await listWorktrees(git, repo, record), request);

  const args = ["worktree", "add"];
  if (request.lockReason !== null) {
    args.push("--lock");
    if (request.lockReason !== "") args.push("--reason", request.lockReason);
  }
  if (request.newBranch !== null) args.push("-b", request.newBranch);
  if (request.detach) args.push("--detach");
  args.push("--", request.path);
  const startPoint = request.startPoint ?? request.branch;
  if (startPoint !== null) args.push(startPoint);
  await runGitRaw(git, { label: "worktree.add", kind: "action", args, repo, record });

  const created = await findWorktree(await listWorktrees(git, repo, record), request.path);
  if (created === null) return fail("error.worktreeNotListed", request.path);
  return created.path;
}

/**
 * Removes a linked worktree and returns its path, so the caller can drop the
 * repository and engine handle for it. Plain `git worktree remove` runs unless
 * the user confirmed the loss of local files (`force`). A locked worktree is
 * unlocked first when asked, and is never forced with `-f -f`. A stale entry
 * (its folder is gone) goes with the same command. When `deleteBranch` is
 * given, the branch goes after the worktree that held it.
 */
export async function removeWorktree(
  git: SimpleGit,
  input: ActionPayload<"removeWorktree"> & RepoInput,
  record?: GitCommandRecorder
): Promise<string> {
  const repo = input.repo ?? null;
  const target = await findWorktree(await listWorktrees(git, repo, record), input.path);
  if (target === null) return fail("error.worktreeNotListed", input.path);
  await assertRemovable(target, input.unlock);

  if (target.locked !== null) {
    await runGitRaw(git, {
      label: "worktree.unlock",
      kind: "action",
      args: ["worktree", "unlock", "--", target.path],
      repo,
      record
    });
  }
  await runGitRaw(git, {
    label: "worktree.remove",
    kind: "action",
    args: ["worktree", "remove", ...(input.force ? ["--force"] : []), "--", target.path],
    repo,
    record
  });

  if (input.deleteBranch !== undefined) {
    await deleteBranch(git, { ...input.deleteBranch, repo }, record);
  }
  return target.path;
}

/** Prunes the stale entries and returns their paths, as they were listed before. */
export async function pruneWorktrees(
  git: SimpleGit,
  input: RepoInput,
  record?: GitCommandRecorder
): Promise<string[]> {
  const repo = input.repo ?? null;
  const stale = prunableWorktrees(await listWorktrees(git, repo, record));
  if (stale.length === 0) return [];

  await runGitRaw(git, {
    label: "worktree.prune",
    kind: "action",
    args: ["worktree", "prune"],
    repo,
    record
  });
  return stale.map((worktree) => worktree.path);
}

/**
 * Repairs a worktree that was moved by hand: Git is told the new folder, then
 * the list must no longer show the old path as stale, or the folder was not
 * that worktree and nothing was fixed.
 */
export async function repairWorktree(
  git: SimpleGit,
  input: ActionPayload<"repairWorktree"> & RepoInput,
  record?: GitCommandRecorder
): Promise<void> {
  const repo = input.repo ?? null;
  const newPath = input.newPath;
  if (newPath === null || newPath === "") {
    await fail("error.worktreeRepairNoFolder");
    return;
  }

  const before = await findWorktree(await listWorktrees(git, repo, record), input.path);
  if (before?.prunable == null) {
    await fail("error.worktreeNotStale", input.path);
    return;
  }

  await runGitRaw(git, {
    label: "worktree.repair",
    kind: "action",
    args: ["worktree", "repair", "--", newPath],
    repo,
    record
  });

  const after = await findWorktree(await listWorktrees(git, repo, record), input.path);
  if (after?.prunable != null) await fail("error.worktreeRepairFailed", input.path, newPath);
}

/**
 * Parses `git status --porcelain -z`: `XY <path>` entries, where a rename or a
 * copy is followed by a field naming its origin.
 */
function parseStatusPaths(stdout: string): string[] {
  const fields = stdout.split("\0").filter((field) => field !== "");
  const paths: string[] = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    paths.push(field.slice(3));
    if (field.startsWith("R") || field.startsWith("C") || field[1] === "R" || field[1] === "C")
      index++;
  }
  return paths;
}

/**
 * The uncommitted and untracked files a forced removal would delete, read from
 * the worktree itself with a bounded `git status`. Only a worktree Git lists is
 * read, and a stale entry has nothing on disk to lose.
 */
export async function worktreeChanges(
  git: SimpleGit,
  input: { repo: string; path: string; recordGitCommand?: GitCommandRecorder }
): Promise<QueryResult<"worktreeChanges">> {
  try {
    const target = await findWorktree(
      await listWorktrees(git, input.repo, input.recordGitCommand),
      input.path
    );
    if (target === null) {
      return { path: input.path, files: [], truncated: false, error: null };
    }
    if (target.prunable !== null) {
      return { path: target.path, files: [], truncated: false, error: null };
    }
    const stdout = await runGitRaw(git, {
      label: "worktree.changes",
      args: ["-C", target.path, "status", "--porcelain", "-z"],
      repo: input.repo,
      record: input.recordGitCommand
    });
    const paths = parseStatusPaths(stdout);
    return {
      path: target.path,
      files: paths.slice(0, MAX_WORKTREE_CHANGES),
      truncated: paths.length > MAX_WORKTREE_CHANGES,
      error: null
    };
  } catch (error: unknown) {
    return {
      path: input.path,
      files: [],
      truncated: false,
      error: toGitQueryError(error, "Unable to read the worktree's local changes.")
    };
  }
}
