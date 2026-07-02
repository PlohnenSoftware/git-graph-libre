import type { SimpleGit } from "simple-git";

import type { DateType, GitCommitDetails, GitFileChangeType, QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const eolRegex = /\r\n|\r|\n/g;
const gitFieldSeparatorFormat = "%x00";
const gitFieldSeparatorOutput = "\0";
const commitInfoFieldCount = 7;
const diffStatusRegex = /^[AMDR](?:\d+)?$/;
const objectHashRegex = /^[0-9a-f]{40,64}$/i;

type CommitDetailsInput = {
  commitHash: string;
  dateType: DateType;
  repo?: string | null;
  recordGitCommand?: GitCommandRecorder;
};

function toPath(str: string) {
  return str.replace(/\\/g, "/");
}

function splitNulTerminatedFields(stdout: string) {
  const fields = stdout.split(gitFieldSeparatorOutput);
  if (fields[fields.length - 1] === "") fields.pop();
  return fields;
}

function trimTrailingBlankLines(text: string) {
  const lines = text.split(eolRegex);
  let lastLine = lines.length - 1;
  while (lastLine >= 0 && lines[lastLine] === "") lastLine--;
  return lines.slice(0, lastLine + 1).join("\n");
}

function parseNumStatValue(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function splitNumStatSummary(summary: string) {
  const firstTab = summary.indexOf("\t");
  const secondTab = firstTab === -1 ? -1 : summary.indexOf("\t", firstTab + 1);
  if (firstTab === -1 || secondTab === -1) return null;
  return {
    additions: parseNumStatValue(summary.slice(0, firstTab)),
    deletions: parseNumStatValue(summary.slice(firstTab + 1, secondTab)),
    path: summary.slice(secondTab + 1)
  };
}

function addFileChangesFromNameStatus(details: GitCommitDetails, nameStatusLines: string[]) {
  const fileLookup: Record<string, number> = {};
  for (let i = 0; i < nameStatusLines.length; ) {
    if (objectHashRegex.test(nameStatusLines[i])) {
      i++;
      continue;
    }

    const status = nameStatusLines[i];
    if (!diffStatusRegex.test(status)) break;

    const oldPathField = nameStatusLines[i + 1];
    if (oldPathField === undefined) break;

    const isRename = status.startsWith("R");
    const newPathField = isRename ? nameStatusLines[i + 2] : oldPathField;
    if (newPathField === undefined) break;

    const newFilePath = toPath(newPathField);
    fileLookup[newFilePath] = details.fileChanges.length;
    details.fileChanges.push({
      oldFilePath: toPath(oldPathField),
      newFilePath,
      type: status[0] as GitFileChangeType,
      additions: null,
      deletions: null
    });
    i += isRename ? 3 : 2;
  }
  return fileLookup;
}

function getNumStatPath(summaryPath: string, numStatLines: string[], index: number) {
  if (summaryPath !== "") return { fileName: summaryPath, nextIndex: index + 1 };

  const renamedPath = numStatLines[index + 2];
  if (renamedPath === undefined) return null;
  return { fileName: renamedPath, nextIndex: index + 3 };
}

function applyNumStatFileChanges(
  details: GitCommitDetails,
  fileLookup: Record<string, number>,
  numStatLines: string[]
) {
  for (let i = 0; i < numStatLines.length; ) {
    if (objectHashRegex.test(numStatLines[i])) {
      i++;
      continue;
    }

    const summary = splitNumStatSummary(numStatLines[i]);
    if (summary === null) break;

    const pathResult = getNumStatPath(summary.path, numStatLines, i);
    if (pathResult === null) break;
    i = pathResult.nextIndex;

    const fileName = toPath(pathResult.fileName);
    const fileIndex = fileLookup[fileName];
    if (typeof fileIndex === "number") {
      details.fileChanges[fileIndex].additions = summary.additions;
      details.fileChanges[fileIndex].deletions = summary.deletions;
    }
  }
}

async function fetchCommitInfo(
  git: SimpleGit,
  commitHash: string,
  dateType: DateType,
  repo: string | null,
  record?: GitCommandRecorder
): Promise<GitCommitDetails> {
  const dateField = dateType === "Author Date" ? "%at" : "%ct";
  const format = ["%H", "%P", "%an", "%ae", dateField, "%cn", "%B"].join(gitFieldSeparatorFormat);
  const stdout = await runGitRaw(git, {
    label: "commitDetails.info",
    args: ["show", "--quiet", commitHash, `--format=${format}`],
    repo,
    record
  });
  const commitInfo = stdout.split(gitFieldSeparatorOutput);
  if (commitInfo.length < commitInfoFieldCount) throw new Error("Unexpected commit info format");

  return {
    hash: commitInfo[0],
    parents: commitInfo[1].split(" "),
    author: commitInfo[2],
    email: commitInfo[3],
    date: Number.parseInt(commitInfo[4], 10),
    committer: commitInfo[5],
    body: trimTrailingBlankLines(commitInfo.slice(6).join(gitFieldSeparatorOutput)),
    fileChanges: []
  };
}

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
      fetchCommitInfo(git, input.commitHash, input.dateType, repo, record),
      fetchNameStatus(git, input.commitHash, repo, record),
      fetchNumStat(git, input.commitHash, repo, record)
    ]);

    const fileLookup = addFileChangesFromNameStatus(details, nameStatusLines);
    applyNumStatFileChanges(details, fileLookup, numStatLines);

    return { commitDetails: details, error: null };
  } catch (error: unknown) {
    return { commitDetails: null, error: toGitQueryError(error, "Unable to load commit details") };
  }
}
