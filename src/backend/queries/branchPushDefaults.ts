import type { SimpleGit } from "simple-git";

import type { QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

type BranchPushDefaultsInput = {
  repo: string;
  branch: string;
  recordGitCommand?: GitCommandRecorder;
};

const FIELD_SEPARATOR = "\u0000";
const FORMAT = ["%(refname)", "%(upstream:remotename)", "%(push:remotename)"].join("%00");

function nullIfEmpty(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

/**
 * Reads the remote that a branch's upstream tracks and the remote that a plain
 * `git push` would use (`branch.<b>.pushRemote`, then `remote.pushDefault`, then
 * the upstream). `for-each-ref` matches a pattern on whole path segments, so
 * `refs/heads/feat` also lists `refs/heads/feat/x`: the row is matched on its
 * full refname.
 */
export async function branchPushDefaults(
  git: SimpleGit,
  input: BranchPushDefaultsInput
): Promise<QueryResult<"branchPushDefaults">> {
  const refname = `refs/heads/${input.branch}`;
  try {
    const stdout = await runGitRaw(git, {
      label: "branchPushDefaults.read",
      args: ["for-each-ref", `--format=${FORMAT}`, refname],
      repo: input.repo,
      record: input.recordGitCommand
    });
    const row = stdout
      .split("\n")
      .map((line) => line.split(FIELD_SEPARATOR))
      .find((fields) => fields[0] === refname);
    return {
      upstreamRemote: nullIfEmpty(row?.[1]),
      pushRemote: nullIfEmpty(row?.[2]),
      error: null
    };
  } catch (error: unknown) {
    return {
      upstreamRemote: null,
      pushRemote: null,
      error: toGitQueryError(error, `Unable to read the push defaults of ${input.branch}.`)
    };
  }
}
