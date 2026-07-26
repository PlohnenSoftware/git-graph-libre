import type { SimpleGit } from "simple-git";

import type { DateType, QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

import { fetchCommitInfo } from "./commitInfo";
import { parseDiffFileChanges, splitNulTerminatedFields } from "./diffFileChanges";

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

export async function commitDetails(
  git: SimpleGit,
  input: CommitDetailsInput
): Promise<QueryResult<"commitDetails">> {
  try {
    const repo = input.repo ?? null;
    const record = input.recordGitCommand;
    const [details, nameStatusLines, numStatLines] = await Promise.all([
      fetchCommitInfo(git, input.commitHash, repo, record),
      fetchNameStatus(git, input.commitHash, repo, record),
      fetchNumStat(git, input.commitHash, repo, record)
    ]);

    details.fileChanges = parseDiffFileChanges(nameStatusLines, numStatLines);

    return { commitDetails: details, error: null };
  } catch (error: unknown) {
    return { commitDetails: null, error: toGitQueryError(error, "Unable to load commit details") };
  }
}
