/**
 * Commit details, comparison and file content through the engine (Phase 16,
 * slice 16.6).
 *
 * Subslice 16.6a: wire shapes and mapping. The engine reports file lists as
 * statuses only and settles `+N/-M` separately through `load_line_counts`
 * (each count reads two blobs); this project renders counts eagerly, so the
 * reader fills the whole list in one call rather than adopting the deferred
 * shape — measured at 7.8ms versus 7.5ms for the CLI's three spawns on a
 * 200-file commit, and 1.1ms versus 4.3ms on a two-file one (see the slice
 * record). Nothing here reimplements a CLI parse: bodies go through the
 * CLI's own trailing-blank trim, and counts join by path exactly like the
 * CLI's numstat pass.
 */

import type { GitFileChange, GitFileChangeType } from "@/backend/types";
import { trimTrailingBlankLines } from "@/backend/queries/commitInfo";

/** One file change as the engine encodes it. Counts stay null until filled. */
export type EngineFileChange = {
  oldFilePath: string;
  newFilePath: string;
  type: string;
  additions: number | null;
  deletions: number | null;
};

/** `load_commit_details` decoded. The signature record is carried, not mapped. */
export type EngineCommitDetails = {
  hash: string;
  parents: string[];
  author: string;
  authorEmail: string;
  authorDate: number;
  committer: string;
  committerEmail: string;
  committerDate: number;
  body: string;
  fileChanges: EngineFileChange[];
};

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string");
}

const engineFileKinds = new Set(["A", "M", "D", "R", "U"]);

function isEngineFileChange(value: unknown): value is EngineFileChange {
  if (typeof value !== "object" || value === null) return false;
  const change = value as Record<string, unknown>;
  return (
    typeof change.oldFilePath === "string" &&
    typeof change.newFilePath === "string" &&
    typeof change.type === "string" &&
    engineFileKinds.has(change.type) &&
    (typeof change.additions === "number" || change.additions === null) &&
    (typeof change.deletions === "number" || change.deletions === null)
  );
}

/**
 * Decode and validate an engine details payload. Anything malformed is null —
 * never a partial page the caller would have to second-guess.
 */
export function parseEngineCommitDetails(text: string): EngineCommitDetails | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const details = parsed as Record<string, unknown>;
  if (
    typeof details.hash !== "string" ||
    !isStringList(details.parents) ||
    typeof details.author !== "string" ||
    typeof details.authorEmail !== "string" ||
    typeof details.authorDate !== "number" ||
    typeof details.committer !== "string" ||
    typeof details.committerEmail !== "string" ||
    typeof details.committerDate !== "number" ||
    typeof details.body !== "string" ||
    !Array.isArray(details.fileChanges) ||
    !(details.fileChanges as unknown[]).every(isEngineFileChange)
  ) {
    return null;
  }
  return {
    hash: details.hash as string,
    parents: details.parents as string[],
    author: details.author as string,
    authorEmail: details.authorEmail as string,
    authorDate: details.authorDate as number,
    committer: details.committer as string,
    committerEmail: details.committerEmail as string,
    committerDate: details.committerDate as number,
    body: trimTrailingBlankLines(details.body as string),
    fileChanges: details.fileChanges as EngineFileChange[]
  };
}

/**
 * Map one engine file change onto the project shape. Paths arrive in git's
 * internal forward-slash form from both backends, so no separator rewrite.
 * `Untracked` has no project counterpart: `git stash show` — the ground
 * truth for the only flow that produces it — lists those files as added.
 */
export function mapEngineFileChange(change: EngineFileChange): GitFileChange {
  return {
    oldFilePath: change.oldFilePath,
    newFilePath: change.newFilePath,
    type: (change.type === "U" ? "A" : change.type) as GitFileChangeType,
    additions: change.additions,
    deletions: change.deletions
  };
}

/** The `+N/-M` map `load_line_counts` returns, keyed by path. */
export type EngineLineCounts = Record<string, { additions: number | null; deletions: number | null }>;

function isEngineLineCounts(value: unknown): value is EngineLineCounts {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      (typeof (entry as { additions?: unknown }).additions === "number" ||
        (entry as { additions?: unknown }).additions === null) &&
      (typeof (entry as { deletions?: unknown }).deletions === "number" ||
        (entry as { deletions?: unknown }).deletions === null)
  );
}

export function parseEngineLineCounts(text: string): EngineLineCounts | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isEngineLineCounts(parsed)) return null;
  return parsed;
}

/**
 * The paths one `load_line_counts` call settles: every old and new path,
 * deduplicated. The engine keys renames by their tree location, so asking
 * for both sides keeps the lookup below exact without a second call.
 */
export function lineCountPaths(changes: GitFileChange[]): string[] {
  const paths = new Set<string>();
  for (const change of changes) {
    paths.add(change.oldFilePath);
    paths.add(change.newFilePath);
  }
  return [...paths];
}

/**
 * Join the counts onto the mapped changes, like the CLI's numstat pass:
 * new path first, old path as the rename fallback. Files the map does not
 * mention keep their nulls.
 */
export function applyLineCounts(changes: GitFileChange[], counts: EngineLineCounts): void {
  for (const change of changes) {
    const entry = counts[change.newFilePath] ?? counts[change.oldFilePath];
    if (entry === undefined) continue;
    change.additions = entry.additions;
    change.deletions = entry.deletions;
  }
}

/** One stash entry as `load_stashes` encodes it — the fields the details call needs. */
export type EngineStashEntry = {
  hash: string;
  baseHash: string;
  untrackedFilesHash: string | null;
  selector: string;
};

function isEngineStashEntry(value: unknown): value is EngineStashEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.hash === "string" &&
    typeof entry.baseHash === "string" &&
    (typeof entry.untrackedFilesHash === "string" || entry.untrackedFilesHash === null) &&
    typeof entry.selector === "string"
  );
}

export function parseEngineStashEntries(text: string): EngineStashEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !(parsed as unknown[]).every(isEngineStashEntry)) return null;
  return parsed as EngineStashEntry[];
}

export function findStashEntry(
  entries: EngineStashEntry[],
  hash: string
): EngineStashEntry | undefined {
  return entries.find((entry) => entry.hash === hash);
}

/** The `stash_json` argument `load_stash_details` takes. */
export function stashEntryPayload(entry: EngineStashEntry): string {
  return JSON.stringify({
    selector: entry.selector,
    baseHash: entry.baseHash,
    untrackedFilesHash: entry.untrackedFilesHash
  });
}
