/**
 * Project-owned shapes for the Statistics view (history and statistics
 * slice F3-01). The engine's wire rows are mapped into these at the seam in
 * `src/backend/engine/stats.ts`; nothing above that seam sees the engine's
 * own names.
 */

/** One author's commit count across every ref, merges excluded. */
export type StatsAuthor = {
  name: string;
  email: string;
  commits: number;
};

/**
 * One non-zero cell of the commit activity grid: the count of commits made
 * in the author's local time at this weekday (0 is Sunday) and hour (0 to 23).
 */
export type StatsActivityCell = {
  weekday: number;
  hour: number;
  count: number;
};

/** Why a Statistics read did not answer from the engine. */
export type StatsUnavailableReason =
  /** No loadable engine addon, or an addon built without the export. */
  | "noAddon"
  /** The `backend` setting is `git-cli`; the engine is not consulted at all. */
  | "backendCli"
  /** Git has not confirmed the repository, so the engine is not consulted. */
  | "notVerified"
  /** The engine rejected the read, or its payload did not validate. */
  | "failed";

/** The outcome of one Statistics read: its value, or the reason there is none. */
export type StatsReadResult<T> =
  | { state: "ok"; value: T }
  | { state: "unavailable"; reason: StatsUnavailableReason };
