import type { SimpleGit } from "simple-git";

import type { DateType, GitCommitDetails } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

const eolRegex = /\r\n|\r|\n/g;
const gitFieldSeparatorFormat = "%x00";
const gitFieldSeparatorOutput = "\0";
const commitInfoFieldCount = 7;

function trimTrailingBlankLines(text: string) {
  const lines = text.split(eolRegex);
  let lastLine = lines.length - 1;
  while (lastLine >= 0 && lines[lastLine] === "") lastLine--;
  return lines.slice(0, lastLine + 1).join("\n");
}

export async function fetchCommitInfo(
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
    parents: commitInfo[1] === "" ? [] : commitInfo[1].split(" "),
    author: commitInfo[2],
    email: commitInfo[3],
    date: Number.parseInt(commitInfo[4], 10),
    committer: commitInfo[5],
    body: trimTrailingBlankLines(commitInfo.slice(6).join(gitFieldSeparatorOutput)),
    fileChanges: []
  };
}
