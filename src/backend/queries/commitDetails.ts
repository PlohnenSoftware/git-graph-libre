import type { SimpleGit } from "simple-git";

import type { DateType, GitFileChange, QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

import { fetchCommitInfo } from "./commitInfo";
import { parseDiffFileChanges, splitNulTerminatedFields } from "./diffFileChanges";
import { stashFileChanges } from "./stashDetails";
import { loadStashes } from "./stashes";

type CommitDetailsInput = {
  commitHash: string;
  dateType: DateType;
  repo?: string | null;
  recordGitCommand?: GitCommandRecorder;
};

async function fetchNameStatus(
  git: SimpleGit,
  commitHash: string,
  repo: string | null,
  record?: GitCommandRecorder
): Promise<string[]> {
  const args = [
    "diff-tree",
    "--name-status",
    "-z",
    "-r",
    "-m",
    "--root",
    "--find-renames",
    "--diff-filter=AMDR",
    commitHash
  ];
  const stdout = await runGitRaw(git, {
    label: "commitDetails.nameStatus",
    args,
    repo,
    record
  });
  return splitNulTerminatedFields(stdout);
}

async function fetchNumStat(
  git: SimpleGit,
  commitHash: string,
  repo: string | null,
  record?: GitCommandRecorder
): Promise<string[]> {
  const args = [
    "diff-tree",
    "--numstat",
    "-z",
    "-r",
    "-m",
    "--root",
    "--find-renames",
    "--diff-filter=AMDR",
    commitHash
  ];
  const stdout = await runGitRaw(git, {
    label: "commitDetails.numStat",
    args,
    repo,
    record
  });
  return splitNulTerminatedFields(stdout);
}

async function fetchFileChanges(
  git: SimpleGit,
  input: CommitDetailsInput,
  details: { hash: string; parents: string[] },
  repo: string | null,
  record?: GitCommandRecorder
): Promise<GitFileChange[]> {
  // A stash commit carries two or three parents, and `diff-tree -m` would
  // list one section per parent. When the hash is a known stash, list its
  // files like `git stash show --include-untracked` instead; non-stash
  // merges keep the `-m` queries unchanged.
  if (details.parents.length >= 2) {
    const stashes = await loadStashes(git, { repo, record }, "commitDetails.stashes");
    const stash = stashes.value.find((entry) => entry.hash === details.hash);
    const baseHash = stash?.sourceHash ?? details.parents[0];
    if (stash !== undefined && baseHash !== undefined) {
      return stashFileChanges(git, {
        stashHash: details.hash,
        baseHash,
        untrackedHash: details.parents[2] ?? null,
        repo,
        recordGitCommand: record
      });
    }
  }

  const [nameStatusLines, numStatLines] = await Promise.all([
    fetchNameStatus(git, input.commitHash, repo, record),
    fetchNumStat(git, input.commitHash, repo, record)
  ]);
  return parseDiffFileChanges(nameStatusLines, numStatLines);
}

export async function commitDetails(
  git: SimpleGit,
  input: CommitDetailsInput
): Promise<QueryResult<"commitDetails">> {
  try {
    const repo = input.repo ?? null;
    const record = input.recordGitCommand;
    const details = await fetchCommitInfo(git, input.commitHash, repo, record);

    details.fileChanges = await fetchFileChanges(git, input, details, repo, record);

    return { commitDetails: details, error: null };
  } catch (error: unknown) {
    return { commitDetails: null, error: toGitQueryError(error, "Unable to load commit details") };
  }
}
