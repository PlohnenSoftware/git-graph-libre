import type { SimpleGit } from "simple-git";

import type { QueryResult } from "@/backend/types";
import type { GitUncommittedChanges, GitUncommittedFile } from "@/backend/types/git.types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

type UncommittedDetailsInput = {
  repo?: string | null;
  recordGitCommand?: GitCommandRecorder;
};

/**
 * The `XY` pairs that mean a conflict rather than a staged change. Git uses
 * `U` on either side for most of them, but `AA` and `DD` carry no `U` at all,
 * so the pair has to be matched as a whole.
 */
const UNMERGED_PAIRS = new Set(["UU", "AA", "DD", "AU", "UA", "DU", "UD"]);

/**
 * Split `git status --porcelain=v1 -z` output into staged and unstaged files.
 *
 * Each entry is `XY PATH` NUL-terminated, except renames and copies which
 * carry the new path first and the old path as an extra NUL field
 * (`R  new\0old\0`). A file with both a staged and an unstaged change (e.g.
 * `MM`) appears in both lists. Unmerged entries (`UU`, `AA`, `DD`, `AU`,
 * `UA`, `DU`, `UD`) are listed as unstaged only.
 *
 * `-z` is what makes this parseable at all: paths arrive verbatim, so a name
 * containing a space, a quote, or a newline needs no unquoting and cannot
 * split one entry into two.
 */
export function parseStatusEntries(stdout: string): GitUncommittedChanges {
  const staged: GitUncommittedFile[] = [];
  const unstaged: GitUncommittedFile[] = [];
  const fields = stdout.split("\0");
  let index = 0;
  while (index < fields.length) {
    const field = fields[index];
    index += 1;
    if (field.length < 4) continue;
    const indexKind = field[0];
    const worktreeKind = field[1];
    const path = field.slice(3);
    let oldPath: string | null = null;
    if (
      (indexKind === "R" || indexKind === "C" || worktreeKind === "R" || worktreeKind === "C") &&
      index < fields.length
    ) {
      oldPath = fields[index];
      index += 1;
    }
    if (path === "") continue;
    const unmerged = UNMERGED_PAIRS.has(indexKind + worktreeKind);
    const hasStaged =
      !unmerged && indexKind !== " " && indexKind !== "?" && indexKind !== "!" && indexKind !== "U";
    const hasUnstaged = unmerged || (worktreeKind !== " " && worktreeKind !== "!");
    if (hasStaged) {
      staged.push({ path, oldPath, stagedKind: indexKind, unstagedKind: null });
    }
    if (hasUnstaged) {
      unstaged.push({ path, oldPath, stagedKind: null, unstagedKind: worktreeKind });
    }
  }
  const byPath = (a: GitUncommittedFile, b: GitUncommittedFile) => a.path.localeCompare(b.path);
  staged.sort(byPath);
  unstaged.sort(byPath);
  return { staged, unstaged };
}

/**
 * Read the staged and unstaged file lists behind the uncommitted-changes row.
 *
 * `--untracked-files=normal` deliberately keeps git's directory collapsing: a
 * wholly untracked folder arrives as one `sub/` entry instead of one row per
 * file, and staging that row stages the folder. `all` would flatten a fresh
 * source tree into hundreds of rows for no extra choice.
 */
export async function uncommittedDetails(
  git: SimpleGit,
  input: UncommittedDetailsInput
): Promise<QueryResult<"uncommittedDetails">> {
  try {
    const stdout = await runGitRaw(git, {
      label: "uncommittedDetails.status",
      args: ["status", "--porcelain=v1", "-z", "--untracked-files=normal"],
      repo: input.repo ?? null,
      record: input.recordGitCommand
    });
    return { changes: parseStatusEntries(stdout), error: null };
  } catch (error: unknown) {
    return { changes: null, error: toGitQueryError(error, "Unable to load uncommitted changes") };
  }
}
