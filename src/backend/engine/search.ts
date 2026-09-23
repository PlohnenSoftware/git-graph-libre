/**
 * The Find dialogue's search, through the engine.
 *
 * The CLI answers this with four `git log` runs at once — a literal
 * `--fixed-strings --grep`, an `--author`, a hash lookup, and one unbounded
 * walk that numbers every commit — then merges them by that numbering. The
 * engine does the same three matches in a single walk.
 *
 * ### Why this is not the engine's own `search_history`
 *
 * The engine ships a search already, and wiring *that* one would have changed
 * what users see: it matches a **regular expression** against messages only,
 * across every ref, ignoring the author filter, and numbers nothing. Slice
 * 16.7 declined it for exactly that reason. `search_commits` was added to the
 * engine instead, reproducing this project's semantics; the regex one is left
 * where it is, unused.
 *
 * ### Declines
 *
 * `--glob=` patterns (`customBranchGlobPatterns`) are not understood by the
 * engine's tip resolution, the same decline `loadCommits` makes.
 */

import type { DateType, GitCommitSearchResult } from "@/backend/types";
import { selectedLogRefs, uniqueNonEmpty } from "@/backend/utils/logFilters";
import { normalizeHiddenRemotes } from "@/backend/utils/remoteRefs";

/** The route fields the engine decision, options and mapping need. */
export type EngineSearchInput = {
  query: string;
  maxResults: number;
  showRemoteBranches: boolean;
  hiddenRemotes?: string[];
  showTags?: boolean;
  branches?: string[] | null;
  authors?: string[] | null;
  tags?: string[] | null;
  dateType: DateType;
};

/**
 * The ref selection both backends search: null is "what the view is showing",
 * an array is an explicit choice from the dropdowns. Single source of truth —
 * the CLI builds its `refArgs` from exactly this, so the decline below sees
 * the same selection.
 */
export function engineSearchRefs(input: EngineSearchInput): string[] | null {
  return selectedLogRefs({ branches: input.branches, tags: input.tags });
}

/**
 * Whether the engine may serve this search. Every false is a *decline*, not a
 * bug: the caller routes those searches straight to the CLI, unchanged.
 */
export function shouldServeSearchFromEngine(input: EngineSearchInput): boolean {
  // `--glob=` is not understood by the engine's tip resolution.
  return !engineSearchRefs(input)?.some((ref) => ref.startsWith("--glob="));
}

/**
 * The `search_commits` options JSON. `maxResults` arrives already clamped by
 * the caller, because the CLI clamps it before building its `--max-count` and
 * both backends must page identically.
 */
export function buildSearchOptions(input: EngineSearchInput, maxResults: number): string {
  return JSON.stringify({
    query: input.query,
    maxResults,
    branches: engineSearchRefs(input),
    authors: uniqueNonEmpty(input.authors),
    showTags: input.showTags !== false,
    showRemoteBranches: input.showRemoteBranches,
    hideRemotes: normalizeHiddenRemotes(input.hiddenRemotes),
    useAuthorDate: input.dateType === "Author Date"
  });
}

/** One hit as the engine encodes it. */
type EngineSearchResult = {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  date: number;
  message: string;
  loadCount: number;
};

function isEngineSearchResult(value: unknown): value is EngineSearchResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.hash === "string" &&
    Array.isArray(candidate.parents) &&
    candidate.parents.every((parent): parent is string => typeof parent === "string") &&
    typeof candidate.author === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.date === "number" &&
    typeof candidate.message === "string" &&
    typeof candidate.loadCount === "number"
  );
}

/**
 * Decode the payload, or null when it is not the shape this version expects —
 * a skewed addon declines into the CLI rather than throwing into the view.
 */
export function parseEngineSearchResults(payload: string): EngineSearchResult[] | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!Array.isArray(decoded) || !decoded.every(isEngineSearchResult)) return null;
  return decoded;
}

/**
 * Into this project's own type. The engine calls the field `parents` and this
 * project calls it `parentHashes`; mapping here is what keeps the seam
 * independent of the engine's wire shape.
 */
export function mapEngineSearchResults(results: EngineSearchResult[]): GitCommitSearchResult[] {
  return results.map((result) => ({
    hash: result.hash,
    parentHashes: result.parents,
    author: result.author,
    email: result.email,
    date: result.date,
    message: result.message,
    loadCount: result.loadCount
  }));
}
