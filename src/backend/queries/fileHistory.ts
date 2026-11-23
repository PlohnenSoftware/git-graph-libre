import type { SimpleGit } from "simple-git";

import type {
  DateType,
  GitFileHistoryEntry,
  GitFileHistoryRequest,
  GitFileHistoryResult,
  GitLogEntry,
  GitQueryError
} from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const NUL = "\0";
const UNIT_SEPARATOR = "\u001f";
const EOL_REGEX = /\r\n|\r|\n/;
const OBJECT_NAME = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/**
 * Default commits returned by one file-history read. Chosen to match the
 * existing search results list (`defaultMaxResults` in `searchCommits.ts` and
 * `searchHistoryMaxResults` in `src/webview/main.ts`).
 */
export const DEFAULT_FILE_HISTORY_LIMIT = 50;

/**
 * Upper bound on commits returned by one file-history read, matching
 * `maxResultsLimit` in `searchCommits.ts`.
 */
export const MAX_FILE_HISTORY_LIMIT = 200;

/**
 * Whether `--follow` is enabled when the caller omits `follow`. On by default
 * so renamed files retain their earlier commits; callers may pass `follow: false`
 * for exact-path history across all refs.
 */
export const DEFAULT_FILE_HISTORY_FOLLOW = true;

/** Thrown when `git log` output does not match the format this query requested. */
export class FileHistoryFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileHistoryFormatError";
    Object.setPrototypeOf(this, FileHistoryFormatError.prototype);
  }
}

function queryError(message: string): GitQueryError {
  return { message, stderr: null, exitCode: null, task: null };
}

function failure(error: GitQueryError, filePath: string | null = null): GitFileHistoryResult {
  return { commits: [], hasMore: false, filePath, error };
}

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Validates and normalizes a repository-relative file path before it reaches
 * Git. Mirrors the reflog and blame guards: refuses empty paths, control
 * characters (including NUL), absolute paths, any traversal that escapes the
 * repository, and any path starting with `-` (raw or normalized).
 */
export function normalizeFileHistoryPath(filePath: string): { path: string } | { problem: string } {
  if (typeof filePath !== "string" || filePath === "") {
    return { problem: "A file path is required." };
  }
  if (hasControlCharacter(filePath)) {
    return { problem: "The file path cannot contain control characters." };
  }
  if (filePath.startsWith("-")) {
    return { problem: "The file path cannot start with a dash." };
  }
  if (filePath.startsWith("/") || filePath.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(filePath)) {
    return { problem: "The file path must be relative to the repository root." };
  }

  const segments: string[] = [];
  for (const segment of filePath.split(/[\\/]/)) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) {
        return { problem: "The file path must stay inside the repository." };
      }
      segments.pop();
    } else {
      segments.push(segment);
    }
  }

  if (segments.length === 0) {
    return { problem: "The file path must name a file inside the repository." };
  }
  const normalized = segments.join("/");
  if (normalized.startsWith("-")) {
    return { problem: "The file path cannot start with a dash." };
  }
  return { path: normalized };
}

function validateLimit(value: number | undefined): number | string {
  if (value === undefined) return DEFAULT_FILE_HISTORY_LIMIT;
  if (!Number.isInteger(value) || value < 1) {
    return "The limit must be a whole number of 1 or more.";
  }
  return Math.min(value, MAX_FILE_HISTORY_LIMIT);
}

function logFormat(dateType: DateType): string {
  const dateField = dateType === "Author Date" ? "%at" : "%ct";
  // Subject comes last so a unit separator inside a subject cannot shift earlier fields.
  return ["%H", "%P", "%an", "%ae", dateField, "%s"].join("%x1f");
}

/**
 * Parses NUL-terminated `git log -z --format=<fields>` records into log entries.
 * Pure; throws {@link FileHistoryFormatError} on a malformed record rather than
 * silently returning corrupted commit data.
 */
export function parseFileHistoryRecords(stdout: string): GitLogEntry[] {
  if (stdout === "") return [];
  const records = stdout.split(NUL);
  if (records.at(-1) === "") records.pop();

  return records.map((record) => {
    const fields = record.split(UNIT_SEPARATOR);
    if (fields.length < 6) {
      throw new FileHistoryFormatError("File history record has too few fields.");
    }
    const [hash, parentField, author, email, dateText, ...subjectParts] = fields;
    if (hash === undefined || !OBJECT_NAME.test(hash)) {
      throw new FileHistoryFormatError("File history record has an unexpected commit hash.");
    }
    const date = Number(dateText);
    if (!Number.isSafeInteger(date)) {
      throw new FileHistoryFormatError("File history record has an invalid commit timestamp.");
    }
    return {
      hash,
      parentHashes: parentField === undefined || parentField === "" ? [] : parentField.split(" "),
      author: author ?? "",
      email: email ?? "",
      date,
      message: subjectParts.join(UNIT_SEPARATOR)
    };
  });
}

function buildLogArgs(
  filePath: string,
  limit: number,
  follow: boolean,
  dateType: DateType
): string[] {
  return [
    "log",
    "-z",
    "--no-show-signature",
    "--date-order",
    "--all",
    ...(follow ? ["--follow"] : []),
    `--max-count=${limit + 1}`,
    `--format=${logFormat(dateType)}`,
    "--end-of-options",
    "--",
    filePath
  ];
}

async function loadAllPositions(
  git: SimpleGit,
  repo: string,
  record?: GitCommandRecorder
): Promise<Map<string, number>> {
  const stdout = await runGitRaw(git, {
    label: "fileHistory.positions",
    kind: "query",
    args: ["log", "--format=%H", "--date-order", "--all", "--end-of-options", "--"],
    repo,
    record
  });
  const positions = new Map<string, number>();
  let index = 0;
  for (const line of stdout.split(EOL_REGEX)) {
    if (line === "") continue;
    index += 1;
    if (!positions.has(line)) positions.set(line, index);
  }
  return positions;
}

/**
 * Lists commits touching a single repository-relative path across all refs
 * (`git log --all -- <path>`), newest first, bounded by `limit`. Read-only.
 *
 * Validation runs before Git is spawned: dash-led paths, control characters,
 * absolute paths, and paths that escape the repository are refused without
 * running Git. Valid paths are passed after `--end-of-options` and `--`.
 *
 * An untracked file, a path with no commits, or an unborn repository returns
 * an empty commit list (`commits: []`, `error: null`), never an error. Genuine
 * Git failures (such as a non-repository directory) surface in `error`.
 */
export async function loadFileHistory(
  git: SimpleGit,
  repo: string,
  request: GitFileHistoryRequest,
  record?: GitCommandRecorder
): Promise<GitFileHistoryResult> {
  const normalized = normalizeFileHistoryPath(request.filePath);
  if ("problem" in normalized) return failure(queryError(normalized.problem));
  const filePath = normalized.path;

  const limit = validateLimit(request.limit);
  if (typeof limit === "string") return failure(queryError(limit));

  const follow = request.follow ?? DEFAULT_FILE_HISTORY_FOLLOW;
  const dateType = request.dateType ?? "Author Date";
  const includeLoadCount = request.includeLoadCount === true;

  try {
    const stdout = await runGitRaw(git, {
      label: "fileHistory.log",
      kind: "query",
      args: buildLogArgs(filePath, limit, follow, dateType),
      repo,
      record
    });
    const parsed = parseFileHistoryRecords(stdout);
    const hasMore = parsed.length > limit;
    const page = parsed.slice(0, limit);
    const positions =
      includeLoadCount && page.length > 0 ? await loadAllPositions(git, repo, record) : null;

    const commits: GitFileHistoryEntry[] = page.map((entry) => ({
      ...entry,
      loadCount: positions?.get(entry.hash) ?? null
    }));

    return { commits, hasMore, filePath, error: null };
  } catch (error: unknown) {
    if (error instanceof FileHistoryFormatError)
      return failure(queryError(error.message), filePath);
    return failure(toGitQueryError(error, "Unable to read file history"), filePath);
  }
}
