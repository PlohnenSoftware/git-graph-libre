import type { SimpleGit } from "simple-git";

import type { GitQueryError, QueryResult } from "@/backend/types";
import { isGitRepository } from "@/backend/utils/git";
import { runGitCommand, type GitCommandRecorder } from "@/backend/utils/gitRunner";
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

  const isRepo = failure === null ? true : await isGitRepository(currentRepo, gitPath);

  return { branches, head, hard, isRepo, error: isRepo ? failure : null };
}
