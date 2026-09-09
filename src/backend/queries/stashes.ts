import type { SimpleGit } from "simple-git";

import type { GitQueryError, GitStash } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const gitFieldSeparatorFormat = "%x00";
const gitFieldSeparatorOutput = "\0";
const stashFieldCount = 5;

type StashQueryContext = {
  repo: string | null;
  record?: GitCommandRecorder;
};

export type StashQueryResult = {
  value: GitStash[];
  error: GitQueryError | null;
};

function parseStashIndex(ref: string): number | null {
  const match = /^stash@\{(\d+)\}$/.exec(ref);
  if (match === null) return null;
  const index = Number.parseInt(match[1], 10);
  return Number.isNaN(index) ? null : index;
}

function parseStashes(stdout: string): GitStash[] {
  const fields = stdout.split(gitFieldSeparatorOutput);
  if (fields.at(-1) === "") fields.pop();
  const stashes: GitStash[] = [];
  for (let i = 0; i + stashFieldCount - 1 < fields.length; i += stashFieldCount) {
    const ref = fields[i];
    const index = parseStashIndex(ref);
    if (index === null) continue;

    const parsedDate = Number.parseInt(fields[i + 3], 10);
    // The parent list leads with the commit the stash was taken from; the
    // index and untracked commits behind it are deliberately not linked (see
    // the stash-row injection in loadCommits).
    const sourceHash = fields[i + 4].split(" ")[0];
    stashes.push({
      index,
      ref,
      hash: fields[i + 1],
      message: fields[i + 2],
      date: Number.isNaN(parsedDate) ? null : parsedDate,
      sourceHash: sourceHash === "" || sourceHash === undefined ? null : sourceHash
    });
  }
  return stashes;
}

/**
 * Loads the repository's stashes with each stash's base commit resolved.
 *
 * A repository with no stash answers with an empty list (exit 0), so callers
 * need no existence check first. Failures resolve to an empty list with a
 * typed error; commit loading treats that as "no stash rows" rather than a
 * failed graph.
 */
export async function loadStashes(
  git: SimpleGit,
  context: StashQueryContext,
  label: string
): Promise<StashQueryResult> {
  try {
    const stdout = await runGitRaw(git, {
      label,
      args: [
        "stash",
        "list",
        "-z",
        `--format=%gd${gitFieldSeparatorFormat}%H${gitFieldSeparatorFormat}%gs${gitFieldSeparatorFormat}%ct${gitFieldSeparatorFormat}%P`
      ],
      repo: context.repo,
      record: context.record
    });
    return { value: parseStashes(stdout), error: null };
  } catch (error: unknown) {
    return { value: [], error: toGitQueryError(error, "Unable to load repository stashes") };
  }
}
