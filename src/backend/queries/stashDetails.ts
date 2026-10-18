import type { SimpleGit } from "simple-git";

import type { GitFileChange } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

import { parseDiffFileChanges, splitNulTerminatedFields } from "./diffFileChanges";

export type StashFileChangesInput = {
  stashHash: string;
  baseHash: string;
  untrackedHash?: string | null;
  repo?: string | null;
  recordGitCommand?: GitCommandRecorder;
};

async function fetchDiffFileChanges(
  git: SimpleGit,
  optionArgs: string[],
  treeArgs: string[],
  labelPrefix: string,
  repo: string | null,
  record?: GitCommandRecorder
): Promise<GitFileChange[]> {
  const [nameStatusStdout, numStatStdout] = await Promise.all([
    runGitRaw(git, {
      label: `${labelPrefix}.nameStatus`,
      args: [...optionArgs, "--name-status", ...treeArgs],
      repo,
      record
    }),
    runGitRaw(git, {
      label: `${labelPrefix}.numStat`,
      args: [...optionArgs, "--numstat", ...treeArgs],
      repo,
      record
    })
  ]);
  return parseDiffFileChanges(
    splitNulTerminatedFields(nameStatusStdout),
    splitNulTerminatedFields(numStatStdout)
  );
}

/**
 * Lists a stash's files the way `git stash show --include-untracked` does:
 * the base-to-stash changes, then the untracked files recorded in the
 * stash's third parent (a root commit, so its entries are all added). This
 * matches the engine's `stash_details` order.
 */
export async function stashFileChanges(
  git: SimpleGit,
  input: StashFileChangesInput
): Promise<GitFileChange[]> {
  const repo = input.repo ?? null;
  const record = input.recordGitCommand;
  const baseChanges = await fetchDiffFileChanges(
    git,
    ["diff-tree", "-z", "-r", "--root", "--find-renames", "--diff-filter=AMDR"],
    [input.baseHash, input.stashHash],
    "stashDetails",
    repo,
    record
  );
  if (!input.untrackedHash) return baseChanges;

  const untrackedChanges = await fetchDiffFileChanges(
    git,
    ["diff-tree", "-z", "-r", "--root"],
    [input.untrackedHash],
    "stashDetails.untracked",
    repo,
    record
  );
  for (const change of untrackedChanges) change.untracked = true;
  return [...baseChanges, ...untrackedChanges];
}
