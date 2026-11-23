import * as fs from "node:fs";
import * as path from "node:path";
import type { SimpleGit } from "simple-git";
import { loadWorktrees } from "@/backend/queries/worktrees";
import { evaluateRebasePreflight } from "@/backend/rebase/preflight";
import type {
  GitQueryError,
  GitRebaseOperation,
  GitRebaseRangeCommit,
  GitRebaseRangeResult,
  GitWorktree
} from "@/backend/types";
import { resolveGitDirs } from "@/backend/utils/gitDirs";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const NUL = "\0";
const UNIT_SEPARATOR = "\u001f";

/** A range longer than this is reported `tooLong`; F2-07 prompts, nothing refuses it. */
export const REBASE_RANGE_LENGTH_LIMIT = 500;

/**
 * The commit fields. The body comes last because it is free text, so a stray
 * separator inside it cannot shift the other fields.
 */
const RANGE_FORMAT = ["%H", "%P", "%an", "%ae", "%s", "%b"].join("%x1f");

const objectName = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to reject control characters in a revision name.
const controlCharacter = /[\u0000-\u001f\u007f]/;

export type RebaseRangeInput = {
  repo: string;
  /**
   * The exclusive start of the range, as any revision Git resolves to a
   * commit. `null` asks for the whole history up to `HEAD`, root included.
   */
  base: string | null;
  /**
   * The repository's worktrees, when the caller holds them already (W10).
   * Omitted, the query lists them itself; when neither works,
   * `alreadyUsedElsewhere` is `"unknown"`.
   */
  worktrees?: GitWorktree[];
  recordGitCommand?: GitCommandRecorder;
};

/** Thrown when the range output does not have the shape this query asked Git for. */
export class RebaseRangeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RebaseRangeFormatError";
    Object.setPrototypeOf(this, RebaseRangeFormatError.prototype);
  }
}

function queryError(message: string): GitQueryError {
  return { message, stderr: null, exitCode: null, task: null };
}

function failure(error: GitQueryError): GitRebaseRangeResult {
  return {
    commits: [],
    mergeCount: 0,
    dirty: false,
    hasUntracked: false,
    inProgress: false,
    inProgressKind: null,
    detached: false,
    branch: null,
    upstream: null,
    alreadyUsedElsewhere: "unknown",
    tooLong: false,
    autoSquash: null,
    preflight: evaluateRebasePreflight({
      commitCount: 0,
      dirty: false,
      inProgress: false,
      alreadyUsedElsewhere: "unknown",
      error
    }),
    error
  };
}

/** Why a revision name must not reach Git, or null when it may. */
function baseProblem(base: string): string | null {
  if (base === "") return "A base revision is required.";
  if (base.startsWith("-")) return "A base revision cannot start with a dash.";
  if (controlCharacter.test(base)) return "A base revision cannot contain control characters.";
  return null;
}

type Reader = (args: string[], label: string) => Promise<string>;

/** The reader's trimmed answer, or null when the read failed or answered empty. */
async function readTrimmedOrNull(
  read: Reader,
  args: string[],
  label: string
): Promise<string | null> {
  try {
    const value = (await read(args, label)).trim();
    return value === "" ? null : value;
  } catch {
    return null;
  }
}

/**
 * The full hash `revision` names as a commit, or null when it names none.
 * Resolving first means the later reads name one fixed pair of commits, and
 * nothing the caller wrote reaches Git as an option.
 */
function resolveCommit(read: Reader, revision: string, label: string): Promise<string | null> {
  return readTrimmedOrNull(
    read,
    ["rev-parse", "--verify", "--quiet", "--end-of-options", `${revision}^{commit}`],
    label
  );
}

/**
 * The checked-out branch's short name, and whether HEAD is detached.
 * `rev-parse --abbrev-ref HEAD` answers `HEAD` when detached and fails on a
 * branch with no commit yet; `symbolic-ref` separates those two (it names
 * the unborn branch and fails when detached).
 */
async function readBranch(read: Reader): Promise<{ branch: string | null; detached: boolean }> {
  const abbreviated = await readTrimmedOrNull(
    read,
    ["rev-parse", "--abbrev-ref", "HEAD"],
    "rebaseRange.branch"
  );
  if (abbreviated !== null && abbreviated !== "HEAD") {
    return { branch: abbreviated, detached: false };
  }
  const symbolic = await readTrimmedOrNull(
    read,
    ["symbolic-ref", "--quiet", "--short", "HEAD"],
    "rebaseRange.symbolic"
  );
  return symbolic === null
    ? { branch: null, detached: true }
    : { branch: symbolic, detached: false };
}

/** The current branch's upstream in short form, or null when it tracks nothing. */
function readUpstream(read: Reader): Promise<string | null> {
  return readTrimmedOrNull(
    read,
    ["rev-parse", "--abbrev-ref", "@{upstream}"],
    "rebaseRange.upstream"
  );
}

/** Value of `rebase.autoSquash` from Git config, or null when unset. */
async function readAutoSquashConfig(read: Reader): Promise<boolean | null> {
  const value = await readTrimmedOrNull(
    read,
    ["config", "--bool", "--get", "rebase.autoSquash"],
    "rebaseRange.autoSquash"
  );
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/**
 * The commits in `upstream..HEAD` — everything the upstream does not reach
 * yet — or null when there is no upstream to compare against. One read
 * settles `isPublished` for the whole range.
 */
async function readUnpublished(
  read: Reader,
  upstream: string | null,
  headHash: string | null
): Promise<Set<string> | null> {
  if (upstream === null || headHash === null) return null;
  const upstreamHash = await resolveCommit(read, upstream, "rebaseRange.upstreamHash");
  if (upstreamHash === null) return null;
  const stdout = await read(
    ["rev-list", `${upstreamHash}..${headHash}`],
    "rebaseRange.unpublished"
  );
  return new Set(stdout.split("\n").filter((line) => line !== ""));
}

/**
 * What `git status --porcelain` says about starting a rebase: staged or
 * unstaged tracked changes are what Git refuses over (`dirty`); untracked
 * files alone never refuse one, so they are reported apart.
 */
export function parseDirtyState(stdout: string): { dirty: boolean; hasUntracked: boolean } {
  let dirty = false;
  let hasUntracked = false;
  for (const line of stdout.split("\n")) {
    if (line === "") continue;
    if (line.startsWith("??")) hasUntracked = true;
    else dirty = true;
  }
  return { dirty, hasUntracked };
}

async function readDirtyState(read: Reader): Promise<{ dirty: boolean; hasUntracked: boolean }> {
  return parseDirtyState(await read(["status", "--porcelain"], "rebaseRange.status"));
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * The operation in progress in one per-worktree git directory, read from the
 * state files Git keeps there. `REBASE_HEAD` is never evidence on its own:
 * it lingers after a successful rebase, so only the `rebase-merge` and
 * `rebase-apply` directories say a rebase is under way.
 */
function detectInProgress(gitDir: string): GitRebaseOperation | null {
  if (
    isDirectory(path.join(gitDir, "rebase-merge")) ||
    isDirectory(path.join(gitDir, "rebase-apply"))
  ) {
    return "rebase";
  }
  if (isFile(path.join(gitDir, "MERGE_HEAD"))) return "merge";
  if (isFile(path.join(gitDir, "CHERRY_PICK_HEAD"))) return "cherry-pick";
  if (isFile(path.join(gitDir, "REVERT_HEAD"))) return "revert";
  return null;
}

/** `%b` ends the body with a newline Git adds; the editor works on the text itself. */
function trimTrailingNewlines(value: string): string {
  let end = value.length;
  while (end > 0 && (value.charAt(end - 1) === "\n" || value.charAt(end - 1) === "\r")) {
    end -= 1;
  }
  return value.slice(0, end);
}

/**
 * Parses the range log (`-z`, so every record ends with a NUL) into range
 * commits, oldest first as Git printed them. `unpublished` is the set from
 * {@link readUnpublished}; a commit outside it is published, and with no set
 * (no upstream) nothing is.
 */
export function parseRebaseRangeRecords(
  stdout: string,
  unpublished: ReadonlySet<string> | null
): GitRebaseRangeCommit[] {
  const records = stdout.split(NUL);
  if (records.at(-1) === "") records.pop();
  return records.map((record) => {
    const fields = record.split(UNIT_SEPARATOR);
    if (fields.length < 6) throw new RebaseRangeFormatError("Range record has too few fields.");
    const [hash, parentsField, author, email, subject, ...body] = fields;
    const parents =
      parentsField === undefined || parentsField === "" ? [] : parentsField.split(" ");
    if (
      hash === undefined ||
      !objectName.test(hash) ||
      parents.some((parent) => !objectName.test(parent))
    ) {
      throw new RebaseRangeFormatError("Range record has an unexpected shape.");
    }
    return {
      hash,
      parents,
      author: author ?? "",
      email: email ?? "",
      subject: subject ?? "",
      body: trimTrailingNewlines(body.join(UNIT_SEPARATOR)),
      isMerge: parents.length > 1,
      isPublished: unpublished !== null && !unpublished.has(hash)
    };
  });
}

async function readCommits(
  read: Reader,
  baseHash: string | null,
  headHash: string,
  unpublished: ReadonlySet<string> | null
): Promise<GitRebaseRangeCommit[]> {
  const args = [
    "log",
    "-z",
    "--topo-order",
    "--reverse",
    "--no-show-signature",
    `--format=${RANGE_FORMAT}`,
    ...(baseHash === null ? ["--root"] : []),
    "--end-of-options",
    baseHash === null ? headHash : `${baseHash}..${headHash}`,
    "--"
  ];
  return parseRebaseRangeRecords(await read(args, "rebaseRange.log"), unpublished);
}

/**
 * Whether another worktree holds the checked-out branch. A detached HEAD
 * holds no branch, so it is `false`; a worktree list that cannot be read is
 * `"unknown"`, never a guessed `false`.
 */
async function readAlreadyUsedElsewhere(
  git: SimpleGit,
  input: RebaseRangeInput,
  branch: string | null
): Promise<boolean | "unknown"> {
  if (branch === null) return false;
  if (input.worktrees !== undefined) {
    return input.worktrees.some((worktree) => worktree.branch === branch && !worktree.isCurrent);
  }
  const listing = await loadWorktrees(git, input.repo, input.recordGitCommand);
  if (listing.error !== null) return "unknown";
  return listing.value.some((worktree) => worktree.branch === branch && !worktree.isCurrent);
}

/**
 * Reads everything an interactive rebase over `base..HEAD` needs to know
 * before it may start: the commits oldest first (`git log --topo-order
 * --reverse`, or the whole history with `--root` when `base` is null), each
 * commit's merge and published facts, and the branch, dirty, in-progress and
 * worktree facts Git itself would refuse on, finished by the preflight
 * answer over them. Read-only. A base that names no commit, or a read that
 * fails, is an `error` with an empty range — never a guessed answer. A
 * repository with no commit yet reads as an empty range on its unborn
 * branch.
 */
export async function loadRebaseRange(
  git: SimpleGit,
  input: RebaseRangeInput
): Promise<GitRebaseRangeResult> {
  if (input.base !== null) {
    const problem = baseProblem(input.base);
    if (problem !== null) return failure(queryError(problem));
  }
  const read: Reader = (args, label) =>
    runGitRaw(git, {
      label,
      kind: "query",
      args,
      repo: input.repo,
      record: input.recordGitCommand
    });

  try {
    const { branch, detached } = await readBranch(read);
    const headHash = await resolveCommit(read, "HEAD", "rebaseRange.head");
    let baseHash: string | null = null;
    if (input.base !== null) {
      baseHash = await resolveCommit(read, input.base, "rebaseRange.base");
      if (baseHash === null) {
        return failure(queryError(`"${input.base}" is not an existing commit.`));
      }
    }
    const { dirty, hasUntracked } = await readDirtyState(read);
    const inProgressKind = detectInProgress(resolveGitDirs(input.repo).gitDir);
    const upstream = await readUpstream(read);
    const unpublished = await readUnpublished(read, upstream, headHash);
    const commits =
      headHash === null ? [] : await readCommits(read, baseHash, headHash, unpublished);
    const alreadyUsedElsewhere = await readAlreadyUsedElsewhere(git, input, branch);
    const autoSquash = await readAutoSquashConfig(read);
    return {
      commits,
      mergeCount: commits.filter((commit) => commit.isMerge).length,
      dirty,
      hasUntracked,
      inProgress: inProgressKind !== null,
      inProgressKind,
      detached,
      branch,
      upstream,
      alreadyUsedElsewhere,
      tooLong: commits.length > REBASE_RANGE_LENGTH_LIMIT,
      autoSquash,
      preflight: evaluateRebasePreflight({
        commitCount: commits.length,
        dirty,
        inProgress: inProgressKind !== null,
        alreadyUsedElsewhere,
        error: null
      }),
      error: null
    };
  } catch (error: unknown) {
    if (error instanceof RebaseRangeFormatError) return failure(queryError(error.message));
    return failure(toGitQueryError(error, "Unable to read the rebase range"));
  }
}
