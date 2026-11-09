import type { SimpleGit } from "simple-git";

import type {
  GitQueryError,
  GitReflogEntry,
  GitReflogMessageClass,
  GitReflogMessageKind,
  GitReflogResult,
  GitReflogState
} from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
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
  /** Newer entries to skip, for paging. Defaults to 0. */
  offset?: number;
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

function pageArgs(
  fullRef: string,
  limit: number,
  offset: number,
  format: string,
  date: string | null = null
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

async function emptyState(read: Reader, fullRef: string, offset: number): Promise<GitReflogState> {
  if (offset > 0) {
    // The page lies past the end. The reflog still has entries when its newest one exists.
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
  const pageSize = Math.min(limit, MAX_REFLOG_PAGE_SIZE);

  const read: Reader = (args, label) =>
    runGitRaw(git, { label, kind: "query", args, repo, record });

  try {
    const fullRef = await resolveFullRef(read, ref);
    if (fullRef === null) {
      return failure(queryError(`"${ref}" is not an existing reference.`));
    }

    const [entryOutput, timeOutput] = await Promise.all([
      read(pageArgs(fullRef, pageSize, offset, ENTRY_FORMAT), "reflog.entries"),
      read(pageArgs(fullRef, pageSize, offset, TIME_FORMAT, "unix"), "reflog.times")
    ]);
    const fetched = parseReflogRecords(entryOutput, timeOutput);
    const entries = fetched.slice(0, pageSize);
    const hasMore = fetched.length > pageSize;
    const state: GitReflogState =
      entries.length > 0 ? "entries" : await emptyState(read, fullRef, offset);
    return { entries, state, hasMore, ref: fullRef, error: null };
  } catch (error: unknown) {
    if (error instanceof ReflogFormatError) return failure(queryError(error.message));
    return failure(toGitQueryError(error, "Unable to read the reflog"));
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
