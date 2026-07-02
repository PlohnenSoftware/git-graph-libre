import type { SimpleGit } from "simple-git";

import type { DateType, GitCommitSearchResult, GitLogEntry, QueryResult } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const eolRegex = /\r\n|\r|\n/g;
const gitLogFormatFieldSeparator = "%x00";
const gitLogOutputFieldSeparator = "\0";
const gitLogFieldCount = 6;
const defaultMaxResults = 50;
const maxResultsLimit = 200;
const hashLikeRegex = /^[0-9a-f]{4,40}$/i;

type SearchCommitsInput = {
  query: string;
  maxResults: number;
  showRemoteBranches: boolean;
  dateType: DateType;
  repo?: string | null;
  recordGitCommand?: GitCommandRecorder;
};

type GitQueryContext = {
  repo: string | null;
  record?: GitCommandRecorder;
};

function normalizeMaxResults(maxResults: number): number {
  if (!Number.isFinite(maxResults) || maxResults < 1) return defaultMaxResults;
  return Math.min(Math.floor(maxResults), maxResultsLimit);
}

function refArgs(showRemoteBranches: boolean): string[] {
  const args = ["--branches", "--tags"];
  if (showRemoteBranches) args.push("--remotes");
  return args;
}

function logFormat(dateType: DateType): string {
  const dateField = dateType === "Author Date" ? "%at" : "%ct";
  return ["%H", "%P", "%an", "%ae", dateField, "%s"].join(gitLogFormatFieldSeparator);
}

function parseLogEntries(stdout: string): GitLogEntry[] {
  const fields = stdout.split(gitLogOutputFieldSeparator);
  if (fields.at(-1) === "") fields.pop();

  const commits: GitLogEntry[] = [];
  for (let i = 0; i + gitLogFieldCount - 1 < fields.length; i += gitLogFieldCount) {
    const parentField = fields[i + 1];
    commits.push({
      hash: fields[i],
      parentHashes: parentField === "" ? [] : parentField.split(" "),
      author: fields[i + 2],
      email: fields[i + 3],
      date: Number.parseInt(fields[i + 4], 10),
      message: fields[i + 5]
    });
  }
  return commits;
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, String.raw`\$&`);
}

async function runSearchLog(
  git: SimpleGit,
  label: string,
  searchArgs: string[],
  input: SearchCommitsInput,
  context: GitQueryContext
): Promise<GitLogEntry[]> {
  const stdout = await runGitRaw(git, {
    label,
    args: [
      "log",
      "-z",
      `--max-count=${normalizeMaxResults(input.maxResults)}`,
      `--format=${logFormat(input.dateType)}`,
      "--date-order",
      ...searchArgs,
      ...refArgs(input.showRemoteBranches)
    ],
    repo: context.repo,
    record: context.record
  });
  return parseLogEntries(stdout);
}

async function hashSearch(
  git: SimpleGit,
  query: string,
  input: SearchCommitsInput,
  context: GitQueryContext
): Promise<GitLogEntry[]> {
  if (!hashLikeRegex.test(query)) return [];

  try {
    const stdout = await runGitRaw(git, {
      label: "searchCommits.hash",
      args: [
        "log",
        "-z",
        "--max-count=1",
        `--format=${logFormat(input.dateType)}`,
        `${query}^{commit}`,
        "--"
      ],
      repo: context.repo,
      record: context.record
    });
    return parseLogEntries(stdout);
  } catch {
    return [];
  }
}

async function loadPositions(
  git: SimpleGit,
  showRemoteBranches: boolean,
  context: GitQueryContext
): Promise<Map<string, number>> {
  const stdout = await runGitRaw(git, {
    label: "searchCommits.positions",
    args: ["log", "--format=%H", "--date-order", ...refArgs(showRemoteBranches)],
    repo: context.repo,
    record: context.record
  });
  const positions = new Map<string, number>();
  let index = 0;
  for (const line of stdout.split(eolRegex)) {
    if (line === "") continue;
    index += 1;
    if (!positions.has(line)) positions.set(line, index);
  }
  return positions;
}

function mergeSearchResults(
  entries: GitLogEntry[],
  positions: Map<string, number>,
  maxResults: number
): GitCommitSearchResult[] {
  const byHash = new Map<string, GitCommitSearchResult>();
  for (const entry of entries) {
    const loadCount = positions.get(entry.hash);
    if (loadCount === undefined || byHash.has(entry.hash)) continue;
    byHash.set(entry.hash, { ...entry, loadCount });
  }
  return [...byHash.values()]
    .toSorted((left, right) => left.loadCount - right.loadCount)
    .slice(0, maxResults);
}

export async function searchCommits(
  git: SimpleGit,
  input: SearchCommitsInput
): Promise<QueryResult<"searchCommits">> {
  const query = input.query.trim();
  const maxResults = normalizeMaxResults(input.maxResults);
  if (query === "") return { results: [], error: null };

  const context = { repo: input.repo ?? null, record: input.recordGitCommand };

  try {
    const [messageMatches, authorMatches, hashMatches, positions] = await Promise.all([
      runSearchLog(
        git,
        "searchCommits.message",
        ["--regexp-ignore-case", "--fixed-strings", `--grep=${query}`],
        input,
        context
      ),
      runSearchLog(
        git,
        "searchCommits.author",
        ["--regexp-ignore-case", `--author=${escapeRegExp(query)}`],
        input,
        context
      ),
      hashSearch(git, query, input, context),
      loadPositions(git, input.showRemoteBranches, context)
    ]);

    return {
      results: mergeSearchResults(
        [...hashMatches, ...messageMatches, ...authorMatches],
        positions,
        maxResults
      ),
      error: null
    };
  } catch (error: unknown) {
    return { results: [], error: toGitQueryError(error, "Unable to search commits") };
  }
}
