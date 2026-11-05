import type { SimpleGit } from "simple-git";
import { loadWorktrees } from "@/backend/queries/worktrees";
import type { GitQueryError, GitWorktree, QueryResult } from "@/backend/types";
import { isGitRepository } from "@/backend/utils/git";
import { type GitCommandRecorder, runGitCommand, runGitRaw } from "@/backend/utils/gitRunner";
import { logBackendRoute } from "@/backend/utils/operationLog";
import { toGitQueryError } from "@/backend/utils/queryError";
import { isHiddenRemoteRef } from "@/backend/utils/remoteRefs";

type LoadBranchesInput = {
  showRemoteBranches: boolean;
  hiddenRemotes?: string[];
  hard: boolean;
  currentRepo: string;
  gitPath: string;
  recordGitCommand?: GitCommandRecorder;
};

type Upstreams = Record<string, string | null>;

const NUL = "\0";
const LOCAL_PREFIX = "refs/heads/";
const REMOTE_PREFIX = "refs/remotes/";

/**
 * The one place the branch read lists worktrees. The CLI's `loadWorktrees`
 * answers today; the engine's reader replaces this call when it lands. A
 * failure is logged and yields an empty list, so the branch read still succeeds.
 */
async function readWorktrees(git: SimpleGit, input: LoadBranchesInput): Promise<GitWorktree[]> {
  const result = await loadWorktrees(git, input.currentRepo, input.recordGitCommand);
  if (result.error === null) return result.value;
  logBackendRoute("loadBranches", "worktrees=unavailable");
  return [];
}

/** Full ref names shortened to the upstream's name; an empty upstream is null. */
function shortenUpstream(ref: string): string | null {
  if (ref.startsWith(REMOTE_PREFIX)) return ref.slice(REMOTE_PREFIX.length);
  if (ref.startsWith(LOCAL_PREFIX)) return ref.slice(LOCAL_PREFIX.length);
  return null;
}

/** Parses `for-each-ref --format=%(refname)%00%(upstream)` lines, one per local branch. */
function parseUpstreams(stdout: string): Upstreams {
  // Object.fromEntries makes own properties, so a branch named __proto__ stays a key.
  const entries: [string, string | null][] = [];
  for (const line of stdout.split("\n")) {
    if (line === "") continue;
    const [ref, upstream = ""] = line.split(NUL);
    if (!ref.startsWith(LOCAL_PREFIX)) continue;
    entries.push([ref.slice(LOCAL_PREFIX.length), shortenUpstream(upstream)]);
  }
  return Object.fromEntries(entries);
}

/** A failure is logged and yields no upstreams, so the branch read still succeeds. */
async function readUpstreams(git: SimpleGit, input: LoadBranchesInput): Promise<Upstreams> {
  try {
    const stdout = await runGitRaw(git, {
      label: "loadBranches.upstreams",
      args: ["for-each-ref", "--format=%(refname)%00%(upstream)", "refs/heads"],
      repo: input.currentRepo,
      record: input.recordGitCommand
    });
    return parseUpstreams(stdout);
  } catch {
    logBackendRoute("loadBranches", "upstreams=unavailable");
    return {};
  }
}

export async function loadBranches(
  git: SimpleGit,
  input: LoadBranchesInput
): Promise<QueryResult<"loadBranches">> {
  const { showRemoteBranches, hiddenRemotes, hard, currentRepo, gitPath } = input;

  let branches: string[];
  let head: string | null;
  let failure: GitQueryError | null;

  try {
    const summary = await runGitCommand(
      () => (showRemoteBranches ? git.branch() : git.branchLocal()),
      {
        label: showRemoteBranches ? "loadBranches.all" : "loadBranches.local",
        args: showRemoteBranches ? ["branch", "--list", "--all"] : ["branch", "--list"],
        repo: currentRepo,
        record: input.recordGitCommand
      }
    );
    head = summary.detached ? null : summary.current || null;
    const visibleBranches = summary.all.filter(
      (branch) => !isHiddenRemoteRef(branch, hiddenRemotes)
    );
    branches = head
      ? [head, ...visibleBranches.filter((branch) => branch !== head)]
      : visibleBranches;
    failure = null;
  } catch (error: unknown) {
    branches = [];
    head = null;
    failure = toGitQueryError(error, "Unable to load branches");
  }

  let worktrees: GitWorktree[] = [];
  let upstreams: Upstreams = {};
  if (failure === null) {
    [worktrees, upstreams] = await Promise.all([
      readWorktrees(git, input),
      readUpstreams(git, input)
    ]);
  }

  const isRepo = failure === null ? true : await isGitRepository(currentRepo, gitPath);

  return { branches, head, hard, isRepo, error: failure, worktrees, upstreams };
}
