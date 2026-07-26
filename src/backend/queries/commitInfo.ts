import type { SimpleGit } from "simple-git";

import type { GitCommitDetails } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

const eolRegex = /\r\n|\r|\n/g;
const gitFieldSeparatorFormat = "%x00";
const gitFieldSeparatorOutput = "\0";
const commitInfoFieldCount = 9;

function trimTrailingBlankLines(text: string) {
  const lines = text.split(eolRegex);
  let lastLine = lines.length - 1;
  while (lastLine >= 0 && lines[lastLine] === "") lastLine--;
  return lines.slice(0, lastLine + 1).join("\n");
}

export async function fetchCommitInfo(
  git: SimpleGit,
  commitHash: string,
  repo: string | null,
  record?: GitCommandRecorder
): Promise<GitCommitDetails> {
  const format = ["%H", "%P", "%an", "%ae", "%at", "%cn", "%ce", "%ct", "%B"].join(
    gitFieldSeparatorFormat
  );
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
    authorDate: Number.parseInt(commitInfo[4], 10),
    committer: commitInfo[5],
    committerEmail: commitInfo[6],
    committerDate: Number.parseInt(commitInfo[7], 10),
    body: trimTrailingBlankLines(commitInfo.slice(8).join(gitFieldSeparatorOutput)),
    fileChanges: []
  };
}
