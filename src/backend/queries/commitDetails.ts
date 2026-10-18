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

async function fetchDiffTree(
  git: SimpleGit,
  format: "--name-status" | "--numstat",
  label: "commitDetails.nameStatus" | "commitDetails.numStat",
  commitHash: string,
  firstParentOnly: boolean,
  repo: string | null,
  record?: GitCommandRecorder
): Promise<string[]> {
  // A merge is diffed against its first parent (`<hash>^1` against
  // `<hash>`), like the engine and like the left side `viewDiff` opens;
  // `-m` would list one section per parent instead. Single-parent and
  // root commits keep the one-commit query, `--root` included.
  const args = [
    "diff-tree",
    format,
    "-z",
    "-r",
    ...(firstParentOnly ? [] : ["-m", "--root"]),
    "--find-renames",
    "--diff-filter=AMDR",
    ...(firstParentOnly ? [`${commitHash}^1`, commitHash] : [commitHash])
  ];
  const stdout = await runGitRaw(git, {
    label,
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
  // files like `git stash show --include-untracked` instead. Any other
  // multi-parent commit is a merge, diffed against its first parent
  // only, so its file list agrees with the diffs `viewDiff` opens.
  let firstParentOnly = false;
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
    firstParentOnly = true;
  }

  const [nameStatusLines, numStatLines] = await Promise.all([
    fetchDiffTree(
      git,
      "--name-status",
      "commitDetails.nameStatus",
      input.commitHash,
      firstParentOnly,
      repo,
      record
    ),
    fetchDiffTree(
      git,
      "--numstat",
      "commitDetails.numStat",
      input.commitHash,
      firstParentOnly,
      repo,
      record
    )
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
