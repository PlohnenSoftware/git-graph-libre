import type { SimpleGit } from "simple-git";

import type { DateType, QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

import { fetchCommitInfo } from "./commitInfo";
import { parseDiffFileChanges, splitNulTerminatedFields } from "./diffFileChanges";

type CommitComparisonInput = {
  commitHash: string;
  baseRef: string;
  compareRef: string;
  dateType: DateType;
  repo?: string | null;
  recordGitCommand?: GitCommandRecorder;
};

function requireRef(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

async function fetchComparisonDiff(
  git: SimpleGit,
  arg: "--name-status" | "--numstat",
  input: CommitComparisonInput,
  repo: string | null,
  record?: GitCommandRecorder
): Promise<string[]> {
  const args = [
    "diff",
    arg,
    "-z",
    "--find-renames",
    "--diff-filter=AMDR",
    input.baseRef,
    input.compareRef
  ];
  const stdout = await runGitRaw(git, {
    label: arg === "--name-status" ? "commitComparison.nameStatus" : "commitComparison.numStat",
    args,
    repo,
    record
  });
  return splitNulTerminatedFields(stdout);
}

export async function commitComparison(
  git: SimpleGit,
  input: CommitComparisonInput
): Promise<QueryResult<"commitComparison">> {
  try {
    requireRef(input.commitHash, "Commit hash");
    requireRef(input.baseRef, "Base ref");
    requireRef(input.compareRef, "Compare ref");

    const repo = input.repo ?? null;
    const record = input.recordGitCommand;
    const [details, nameStatusLines, numStatLines] = await Promise.all([
      fetchCommitInfo(git, input.commitHash, input.dateType, repo, record),
      fetchComparisonDiff(git, "--name-status", input, repo, record),
      fetchComparisonDiff(git, "--numstat", input, repo, record)
    ]);

    details.fileChanges = parseDiffFileChanges(nameStatusLines, numStatLines);
    return { commitDetails: details, error: null };
  } catch (error: unknown) {
    return {
      commitDetails: null,
      error: toGitQueryError(error, "Unable to load commit comparison")
    };
  }
}
