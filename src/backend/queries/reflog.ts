import type { SimpleGit } from "simple-git";

import type {
  GitQueryError,
  GitReflogEntry,
  GitReflogEntryState,
  GitReflogEntryStatesResult,
  GitReflogMessageClass,
  GitReflogMessageKind,
  GitReflogResult,
  GitReflogState
} from "@/backend/types";
import { type GitCommandRecorder, runGitRaw, runGitWithInput } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const NUL = "\0";
const UNIT_SEPARATOR = "\u001f";

/** Entries per page when the caller names no limit. */
export const DEFAULT_REFLOG_PAGE_SIZE = 200;
/** The largest page one read returns, whatever the caller asks for. */
export const MAX_REFLOG_PAGE_SIZE = 1000;

/**
 * The entry fields. The message comes last because it is free text (any tool
 * may write one), so a stray separator inside it cannot shift the other fields.
 * `%gd` carries the selector index here: with `--date` it carries the time
 * instead, and Git skips some entries when it numbers them, so the index
 * cannot be recovered from the position in the list.
 */
const ENTRY_FORMAT = ["%H", "%gd", "%gn", "%ge", "%gs"].join("%x1f");
/** Hash and selector again, read with `--date=unix` so the selector carries the entry's own time. */
const TIME_FORMAT = ["%H", "%gd"].join("%x1f");

const selectorNumber = /@\{(\d+)\}$/;
const objectName = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to reject control characters in a ref name.
const controlCharacter = /[\u0000-\u001f\u007f]/;

export type ReflogRequest = {
  /** A ref name such as `HEAD`, `main`, `refs/heads/main` or `refs/stash`. Defaults to `HEAD`. */
  ref?: string;
  /** Entries to return, newest first. Defaults to {@link DEFAULT_REFLOG_PAGE_SIZE}. */
  limit?: number;
  /** Newer entries to skip, for paging. Defaults to 0. With `grep`, matching entries are skipped. */
  offset?: number;
  /**
   * Only entries whose reflog message contains this text, as a fixed,
   * case-insensitive string (F1-05). It reaches Git solely as the value of
   * `--grep-reflog=` with `--fixed-strings`, never as an option of its own,
   * so text that looks like a flag or a pattern stays literal search text.
   * An empty string is no grep at all.
   */
  grep?: string;
};

function queryError(message: string): GitQueryError {
  return { message, stderr: null, exitCode: null, task: null };
}

function failure(error: GitQueryError): GitReflogResult {
  return { entries: [], state: null, hasMore: false, ref: null, error };
}

/** Why a ref name must not reach Git, or null when it may. */
function refProblem(ref: string): string | null {
  if (ref === "") return "A ref name is required.";
  if (ref.startsWith("-")) return "A ref name cannot start with a dash.";
  if (controlCharacter.test(ref)) return "A ref name cannot contain control characters.";
  return null;
}

function toCount(value: number | undefined, fallback: number, name: string): number | string {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0)
    return `The ${name} must be a whole number of 0 or more.`;
  return value;
}

/** Splits `-z` output into its records. Each record ends with a NUL. */
function splitRecords(stdout: string): string[] {
  const records = stdout.split(NUL);
  // The text after the last NUL is empty and carries no record.
  if (records.at(-1) === "") records.pop();
  return records;
}

type Selected = { hash: string; number: number };

function parseSelected(fields: string[], what: string): Selected {
  const [hash, selector] = fields;
  const match = selector === undefined ? null : selectorNumber.exec(selector);
  if (hash === undefined || !objectName.test(hash) || match?.[1] === undefined) {
    throw new ReflogFormatError(`Reflog ${what} record has an unexpected shape.`);
  }
  return { hash, number: Number(match[1]) };
}

/** Thrown when the reflog output does not have the shape this query asked Git for. */
export class ReflogFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReflogFormatError";
    Object.setPrototypeOf(this, ReflogFormatError.prototype);
  }
}

/**
 * Joins the two reads of one page: the first carries identity, message and
 * index, the second the entry time. They list the same entries in the same
 * order, so they pair by position; a different count or hash means the reflog
 * changed between the reads, which is reported rather than guessed at.
 */
export function parseReflogRecords(entryOutput: string, timeOutput: string): GitReflogEntry[] {
  const entryRecords = splitRecords(entryOutput);
  const timeRecords = splitRecords(timeOutput);
  if (entryRecords.length !== timeRecords.length) {
    throw new ReflogFormatError("The reflog changed while it was being read.");
  }

  return entryRecords.map((record, position) => {
    const fields = record.split(UNIT_SEPARATOR);
    if (fields.length < 5) throw new ReflogFormatError("Reflog record has too few fields.");
    const [, , name, email, ...message] = fields;
    const entry = parseSelected(fields, "entry");
    const time = parseSelected((timeRecords[position] ?? "").split(UNIT_SEPARATOR), "time");
    if (time.hash !== entry.hash) {
      throw new ReflogFormatError("The reflog changed while it was being read.");
    }
    return {
      hash: entry.hash,
      index: entry.number,
      time: time.number,
      name: name ?? "",
      email: email ?? "",
      message: message.join(UNIT_SEPARATOR)
    };
  });
}

type Reader = (args: string[], label: string) => Promise<string>;

/**
 * The ref's full name, or null when it names no reference (a missing name, a
 * commit hash or a revision expression). `HEAD` stays `HEAD`: Git would
 * otherwise resolve it to the branch it points at, and the two logs differ.
 */
async function resolveFullRef(read: Reader, ref: string): Promise<string | null> {
  if (ref === "HEAD") return "HEAD";
  const stdout = await read(
    ["rev-parse", "--verify", "--quiet", "--symbolic-full-name", "--end-of-options", ref],
    "reflog.resolve"
  );
  const full = stdout.trim();
  return full === "" ? null : full;
}

/** True when `HEAD` points at a commit, false on a repository with no commit yet. */
async function headExists(read: Reader): Promise<boolean> {
  const stdout = await read(["rev-parse", "--verify", "--quiet", "HEAD"], "reflog.head");
  return stdout.trim() !== "";
}

function pageArgs(
  fullRef: string,
  limit: number,
  offset: number,
  format: string,
  date: string | null = null,
  grep = ""
): string[] {
  return [
    "log",
    "-g",
    "-z",
    "--no-show-signature",
    ...(date === null ? [] : [`--date=${date}`]),
    `--format=${format}`,
    `--max-count=${limit + 1}`,
    `--skip=${offset}`,
    // The graph's commit search spells a literal search the same way
    // (`searchCommits`): the user text is the `--grep-reflog=` value and
    // nothing else, fixed and case-insensitive, so it can never turn
    // into an option or a pattern of its own.
    ...(grep === "" ? [] : ["--regexp-ignore-case", "--fixed-strings", `--grep-reflog=${grep}`]),
    "--end-of-options",
    fullRef,
    "--"
  ];
}

/**
 * `git reflog exists` reports through its exit status, which the shared
 * runner cannot see, so the list of refs that have a reflog stands in for it.
 * It needs Git 2.46. On an older Git the list is unavailable and the answer
 * is `null`, meaning unknown.
 */
async function hasReflogFile(read: Reader, fullRef: string): Promise<boolean | null> {
  try {
    const stdout = await read(["reflog", "list"], "reflog.list");
    return stdout.split("\n").includes(fullRef);
  } catch {
    return null;
  }
}

async function emptyState(
  read: Reader,
  fullRef: string,
  offset: number,
  hasGrep = false
): Promise<GitReflogState> {
  if (offset > 0 || hasGrep) {
    // The page lies past the end, or nothing matched the grep. The
    // reflog still has entries when its newest one exists (the probe
    // itself reads without the grep).
    const newest = await read(pageArgs(fullRef, 0, 0, TIME_FORMAT), "reflog.probe");
    if (splitRecords(newest).length > 0) return "entries";
  }
  // A reflog file that holds no entries (all expired) is "empty"; no file at
  // all is "none". An unknown answer (old Git) reads as "empty".
  return (await hasReflogFile(read, fullRef)) === false ? "none" : "empty";
}

/**
 * Lists one ref's reflog newest first, one page at a time. Read-only.
 *
 * `state` tells three cases apart that a bare empty list would blur:
 * `entries` (the page holds entries, or lies past the end of a reflog that
 * has some), `empty` (a reflog exists but holds nothing, for example after
 * every entry expired) and `none` (the ref keeps no reflog, such as a tag,
 * a bare repository's branch, or any ref under `core.logAllRefUpdates=false`).
 * A read that fails, or a ref that does not exist, is an `error` and never an
 * empty list.
 *
 * With a `grep`, Git itself filters the reflog messages before the page
 * is cut (`--grep-reflog` with `--fixed-strings` and
 * `--regexp-ignore-case`, verified with `-g`, `-z`, `--max-count` and
 * `--skip` on Git 2.56), so `limit` and `offset` page over the matches,
 * however far back in the reflog they lie.
 */
export async function loadReflog(
  git: SimpleGit,
  repo: string,
  request: ReflogRequest = {},
  record?: GitCommandRecorder
): Promise<GitReflogResult> {
  const ref = request.ref ?? "HEAD";
  const problem = refProblem(ref);
  if (problem !== null) return failure(queryError(problem));
  const limit = toCount(request.limit, DEFAULT_REFLOG_PAGE_SIZE, "limit");
  const offset = toCount(request.offset, 0, "offset");
  if (typeof limit === "string") return failure(queryError(limit));
  if (typeof offset === "string") return failure(queryError(offset));
  if (limit < 1) return failure(queryError("The limit must be at least 1."));
  const grep = request.grep ?? "";
  if (typeof grep !== "string" || grep.includes(NUL)) {
    return failure(queryError("The search text cannot contain a NUL character."));
  }
  const pageSize = Math.min(limit, MAX_REFLOG_PAGE_SIZE);

  const read: Reader = (args, label) =>
    runGitRaw(git, { label, kind: "query", args, repo, record });

  try {
    const fullRef = await resolveFullRef(read, ref);
    if (fullRef === null) {
      return failure(queryError(`"${ref}" is not an existing reference.`));
    }

    if (fullRef === "HEAD" && !(await headExists(read))) {
      // A repository with no commit yet has no `HEAD` to read, and keeps no reflog for it.
      return { entries: [], state: "none", hasMore: false, ref: fullRef, error: null };
    }

    const [entryOutput, timeOutput] = await Promise.all([
      read(pageArgs(fullRef, pageSize, offset, ENTRY_FORMAT, null, grep), "reflog.entries"),
      read(pageArgs(fullRef, pageSize, offset, TIME_FORMAT, "unix", grep), "reflog.times")
    ]);
    const fetched = parseReflogRecords(entryOutput, timeOutput);
    const entries = fetched.slice(0, pageSize);
    const hasMore = fetched.length > pageSize;
    const state: GitReflogState =
      entries.length > 0 ? "entries" : await emptyState(read, fullRef, offset, grep !== "");
    return { entries, state, hasMore, ref: fullRef, error: null };
  } catch (error: unknown) {
    if (error instanceof ReflogFormatError) return failure(queryError(error.message));
    return failure(toGitQueryError(error, "Unable to read the reflog"));
  }
}

export type GitReflogRefsResult = {
  /** `HEAD`, then every local branch's full ref, then `refs/stash` when it exists. */
  refs: string[];
  error: GitQueryError | null;
};

/**
 * The picker's refs out of one `for-each-ref` listing (F1-05): `HEAD`
 * first, the local branches in Git's order, and the stash last — only
 * when `refs/stash` exists, since a repository with no stash has no such
 * ref to pick. Remote-tracking refs never appear (RQ8); the other
 * worktrees' HEADs are F1-08's.
 */
export function parseReflogRefs(stdout: string): string[] {
  const listed = stdout.split("\n").filter((line) => line !== "");
  const branches = listed.filter((ref) => ref.startsWith("refs/heads/"));
  return ["HEAD", ...branches, ...(listed.includes("refs/stash") ? ["refs/stash"] : [])];
}

/**
 * The refs the Reflog tab's picker offers for one repository. Read-only.
 * A failed read still offers `HEAD` beside its error, so the tab keeps
 * working on the default ref.
 */
export async function loadReflogRefs(
  git: SimpleGit,
  repo: string,
  record?: GitCommandRecorder
): Promise<GitReflogRefsResult> {
  try {
    const stdout = await runGitRaw(git, {
      label: "reflog.refs",
      kind: "query",
      args: ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/stash"],
      repo,
      record
    });
    return { refs: parseReflogRefs(stdout), error: null };
  } catch (error: unknown) {
    return { refs: ["HEAD"], error: toGitQueryError(error, "Unable to list reflog refs") };
  }
}

/**
 * Hashes per Git call while reading entry states. The hashes ride on the
 * `rev-list` command line, and Windows caps a command line at 32,767
 * characters; 200 full hashes stay far below that.
 */
const HASHES_PER_RUN = 200;

function entryStatesFailure(error: GitQueryError): GitReflogEntryStatesResult {
  return { states: {}, error };
}

function hashChunks(hashes: string[]): string[][] {
  const chunks: string[][] = [];
  for (let start = 0; start < hashes.length; start += HASHES_PER_RUN) {
    chunks.push(hashes.slice(start, start + HASHES_PER_RUN));
  }
  return chunks;
}

function outputLines(stdout: string): string[] {
  const lines = stdout.split(/\r\n|\r|\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/**
 * The object kind Git reports for each hash (`commit`, `tree`, …), or
 * `missing`. `cat-file --batch-check` answers in input order, one line per
 * hash, and still exits 0 when an object is missing.
 */
function parseBatchCheck(stdout: string, hashes: readonly string[]): Map<string, string> {
  const lines = outputLines(stdout);
  if (lines.length !== hashes.length) {
    throw new ReflogFormatError("Reflog object check has an unexpected shape.");
  }
  const kinds = new Map<string, string>();
  for (const [position, hash] of hashes.entries()) {
    const fields = (lines[position] ?? "").split(" ");
    if (fields[0] !== hash || fields[1] === undefined || fields[1] === "") {
      throw new ReflogFormatError("Reflog object check has an unexpected shape.");
    }
    kinds.set(hash, fields[1]);
  }
  return kinds;
}

/** The chunk's hashes Git printed as unreachable, each still a full hash from the chunk. */
function parseUnreachable(stdout: string, hashes: readonly string[]): Set<string> {
  const asked = new Set(hashes);
  const unreachable = new Set<string>();
  for (const line of outputLines(stdout)) {
    if (!asked.has(line)) {
      throw new ReflogFormatError("Reflog reachability check has an unexpected shape.");
    }
    unreachable.add(line);
  }
  return unreachable;
}

async function readObjectKinds(
  git: SimpleGit,
  repo: string,
  hashes: string[],
  gitPath: string,
  record?: GitCommandRecorder
): Promise<Map<string, string>> {
  const stdout = await runGitWithInput(git, {
    label: "reflog.states.existence",
    kind: "query",
    args: ["cat-file", "--batch-check"],
    input: `${hashes.join("\n")}\n`,
    binary: gitPath,
    repo,
    record
  });
  return parseBatchCheck(stdout, hashes);
}

async function readUnreachable(
  git: SimpleGit,
  repo: string,
  hashes: string[],
  record?: GitCommandRecorder
): Promise<Set<string>> {
  const stdout = await runGitRaw(git, {
    label: "reflog.states.reachability",
    kind: "query",
    args: [
      "rev-list",
      "--no-walk=unsorted",
      ...hashes,
      "--not",
      "--branches",
      "--tags",
      "--remotes",
      "--"
    ],
    repo,
    record
  });
  return parseUnreachable(stdout, hashes);
}

/**
 * The state of each commit on one reflog page: `reachable` from a branch,
 * tag or remote-tracking ref, `reflogOnly`, or `missing`. Read-only, and
 * separate from {@link loadReflog} the way `commitSignatures` is separate
 * from the graph load, so a page can show before its states arrive.
 *
 * Existence comes first, from one `git cat-file --batch-check` over the
 * page's hashes on stdin (the resolved Git binary `gitPath` feeds them,
 * as in `commitSignatures`): `rev-list` refuses a missing positive hash
 * outright, so only hashes Git calls a commit go on to the reachability
 * read. That read is one `git rev-list --no-walk=unsorted` per chunk with
 * the hashes as positive revs and `--not --branches --tags --remotes`: Git
 * prints exactly the given commits no such ref reaches. `HEAD` is not in
 * that set, so a commit only a detached `HEAD` points at is `reflogOnly`.
 *
 * Names that are not full object hashes never reach Git, and an existing
 * object that is not a commit gets no state (a reflog entry's hash is a
 * commit's). Any failure leaves every state unknown — `states` empty and
 * `error` set — rather than guessing, and the entries themselves are the
 * caller's, untouched either way.
 */
export async function loadReflogEntryStates(
  git: SimpleGit,
  repo: string,
  hashes: readonly string[],
  gitPath?: string,
  record?: GitCommandRecorder
): Promise<GitReflogEntryStatesResult> {
  const unique = [...new Set(hashes)].filter((hash) => objectName.test(hash));
  if (unique.length === 0) return { states: {}, error: null };
  if (gitPath === undefined || gitPath === "") {
    return entryStatesFailure(
      queryError("A Git binary path is required to read reflog entry states.")
    );
  }

  try {
    const kindChunks = await Promise.all(
      hashChunks(unique).map((chunk) => readObjectKinds(git, repo, chunk, gitPath, record))
    );
    const kinds = new Map(kindChunks.flatMap((chunk) => [...chunk]));
    const commits = unique.filter((hash) => kinds.get(hash) === "commit");
    const unreachableChunks = await Promise.all(
      hashChunks(commits).map((chunk) => readUnreachable(git, repo, chunk, record))
    );
    const unreachable = new Set(unreachableChunks.flatMap((chunk) => [...chunk]));

    const states: Record<string, GitReflogEntryState> = {};
    for (const hash of unique) {
      const kind = kinds.get(hash);
      if (kind === "missing") states[hash] = "missing";
      else if (kind === "commit") states[hash] = unreachable.has(hash) ? "reflogOnly" : "reachable";
    }
    return { states, error: null };
  } catch (error: unknown) {
    if (error instanceof ReflogFormatError) return entryStatesFailure(queryError(error.message));
    return entryStatesFailure(toGitQueryError(error, "Unable to read reflog entry states"));
  }
}

const other: GitReflogMessageClass = { kind: "other", sub: null, raw: "" };

/** The text inside the first `(...)` that directly follows the subject's verb, or null. */
function parenthetical(rest: string): string | null {
  const match = /^[^:(]*?\(([^)]*)\)/.exec(rest);
  return match?.[1] ?? null;
}

function classifyKnown(message: string): { kind: GitReflogMessageKind; sub: string | null } | null {
  // Git writes `<verb>[ args][ (detail)]: text`. Args come from the user's own
  // command line (`pull -q --rebase`), so only the verb is matched strictly.
  const verb = /^([A-Za-z][A-Za-z-]*)(?=[\s:(]|$)/.exec(message)?.[1];
  const rest = verb === undefined ? "" : message.slice(verb.length);
  switch (verb?.toLowerCase()) {
    case "commit":
      return { kind: "commit", sub: parenthetical(rest) };
    case "checkout":
      return { kind: "checkout", sub: null };
    case "reset":
      return { kind: "reset", sub: null };
    case "rebase":
      return { kind: "rebase", sub: parenthetical(rest) };
    case "merge":
      return { kind: "merge", sub: /:\s*fast-forward/i.test(rest) ? "fast-forward" : null };
    case "pull":
      return { kind: "pull", sub: parenthetical(rest) };
    case "fetch":
      return { kind: "fetch", sub: null };
    case "cherry-pick":
      return { kind: "cherry-pick", sub: parenthetical(rest) };
    case "revert":
      return { kind: "revert", sub: parenthetical(rest) };
    case "branch": {
      // `branch: Created from ...` and `Branch: renamed ...` / `Branch: copied ...`.
      const action = /^:\s*(\w+)/.exec(rest)?.[1]?.toLowerCase();
      return { kind: "branch", sub: action ?? null };
    }
    case "clone":
      return { kind: "clone", sub: null };
    default:
      return null;
  }
}

/**
 * Sorts a reflog message into a kind and a sub-kind. Pure and total: any
 * string, including an empty one or text another tool wrote, gives a result
 * (`other` when nothing matches) and `raw` always carries the message
 * unchanged. The kinds are an open set, so a caller treats an unknown one as
 * `other`. Git writes `rebase (pick)` today and wrote `rebase -i (pick)`
 * before; both give the same result.
 */
export function classifyReflogMessage(message: string): GitReflogMessageClass {
  try {
    const raw = typeof message === "string" ? message : "";
    const stash = /^(WIP on|On) \S+: /.exec(raw);
    if (stash !== null) return { kind: "stash", sub: stash[1] === "WIP on" ? "wip" : "named", raw };
    const known = classifyKnown(raw);
    return known === null ? { ...other, raw } : { ...known, raw };
  } catch {
    return { ...other, raw: typeof message === "string" ? message : "" };
  }
}
