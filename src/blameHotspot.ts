/**
 * Hotspot heat for the Blame view (F4-02): a pure scoring model that gives each
 * blame hunk a heat level from 0 (coldest, oldest) to 9 (hottest, newest).
 *
 * Every function here is pure and deterministic: no DOM, no `vscode`, no clock
 * (the calendar mode takes `nowSeconds` from its caller) and no mutation of the
 * hunks or commits it receives. The output array is index-aligned with `hunks`.
 *
 * Choices shared by every mode:
 * - An uncommitted hunk (`GitBlameCommit.uncommitted`) gets `level: null` and
 *   never takes part in a rank or a maximum. A hunk whose commit is missing from
 *   the map has no timestamp to score, so it is treated the same way.
 * - `commitHunkCount` and `commitLineCount` describe the commit's footprint in
 *   this file (every hunk naming its hash, uncommitted included). They are
 *   filled in for every mode, `off` too.
 */
import type { GitBlameCommit, GitBlameHunk } from "@/backend/types";

/** The number of heat steps: level 0 is the coldest, level 9 the hottest. */
export const BLAME_HEAT_BUCKETS = 10;

export type BlameHeatLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type BlameHotspotMode = "age" | "calendar" | "churn" | "off";

export type BlameHunkHeat = {
  /** Null when the mode is `off` or the hunk is uncommitted. */
  level: BlameHeatLevel | null;
  uncommitted: boolean;
  /** How many hunks in this file name the hunk's commit. */
  commitHunkCount: number;
  /** How many lines in this file the hunk's commit owns, summed over its hunks. */
  commitLineCount: number;
};

/** The neutral level for a file whose committed hunks share one timestamp. */
const NEUTRAL_LEVEL: BlameHeatLevel = 5;
const SECONDS_PER_DAY = 86_400;

/** Index `n` holds level `n`, so a computed index maps to a typed level. */
const HEAT_LEVELS: readonly BlameHeatLevel[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Calendar bands, newest first. An age up to and including `maxAgeDays` takes
 * `level`; anything older than the last band is level 0.
 */
const CALENDAR_BANDS: readonly { maxAgeDays: number; level: BlameHeatLevel }[] = [
  { maxAgeDays: 1, level: 9 },
  { maxAgeDays: 2, level: 8 },
  { maxAgeDays: 7, level: 7 },
  { maxAgeDays: 14, level: 6 },
  { maxAgeDays: 30, level: 5 },
  { maxAgeDays: 90, level: 4 },
  { maxAgeDays: 180, level: 3 },
  { maxAgeDays: 365, level: 2 },
  { maxAgeDays: 730, level: 1 }
];

type Footprint = { hunks: number; lines: number };

/** The commit a hunk can be scored by, or null when it is uncommitted or unknown. */
function scorableCommit(
  hunk: GitBlameHunk,
  commits: Readonly<Record<string, GitBlameCommit>>
): GitBlameCommit | null {
  const commit = commits[hunk.commitHash];
  return commit && !commit.uncommitted ? commit : null;
}

/** Per commit hash, how many hunks and lines of this file it owns. */
function footprintOf(hunks: readonly GitBlameHunk[]): Map<string, Footprint> {
  const footprint = new Map<string, Footprint>();
  for (const hunk of hunks) {
    const seen = footprint.get(hunk.commitHash) ?? { hunks: 0, lines: 0 };
    footprint.set(hunk.commitHash, {
      hunks: seen.hunks + 1,
      lines: seen.lines + hunk.lineCount
    });
  }
  return footprint;
}

/** The distinct committed timestamps, oldest first, each with its rank. */
type TimeRanks = { count: number; rankOf: Map<number, number> };

/**
 * Ranks the distinct `authorTime` values of the committed hunks. Equal times
 * share one rank, so equal timestamps always score the same.
 */
function rankTimes(
  hunks: readonly GitBlameHunk[],
  commits: Readonly<Record<string, GitBlameCommit>>
): TimeRanks {
  const times = new Set<number>();
  for (const hunk of hunks) {
    const commit = scorableCommit(hunk, commits);
    if (commit) times.add(commit.authorTime);
  }
  const sorted = [...times].sort((a, b) => a - b);
  return { count: sorted.length, rankOf: new Map(sorted.map((time, rank) => [time, rank])) };
}

/** The rank of a committed hunk's timestamp, or null for an uncommitted hunk. */
function rankOfHunk(
  hunk: GitBlameHunk,
  commits: Readonly<Record<string, GitBlameCommit>>,
  ranks: TimeRanks
): number | null {
  const commit = scorableCommit(hunk, commits);
  if (!commit) return null;
  return ranks.rankOf.get(commit.authorTime) ?? null;
}

/** Clamps a computed step to the heat range and rounds it to a level. */
function levelAt(step: number): BlameHeatLevel {
  const index = Math.min(HEAT_LEVELS.length - 1, Math.max(0, Math.round(step)));
  return HEAT_LEVELS[index];
}

/**
 * Age mode for one committed rank: rank-quantile recency, so the oldest
 * timestamp is level 0 and the newest is level 9. A single distinct timestamp
 * is neutral, not NaN and not hottest.
 */
export function ageLevelForRank(rank: number, count: number): BlameHeatLevel {
  if (count <= 1) return NEUTRAL_LEVEL;
  return levelAt((rank / (count - 1)) * (HEAT_LEVELS.length - 1));
}

/**
 * Calendar mode for one timestamp: the age in seconds against the fixed bands.
 * A timestamp after `nowSeconds` (clock skew, or a future-dated commit) has age
 * 0 and so takes the hottest level.
 */
export function calendarLevelForTime(nowSeconds: number, authorTime: number): BlameHeatLevel {
  const age = Math.max(0, nowSeconds - authorTime);
  const band = CALENDAR_BANDS.find(({ maxAgeDays }) => age <= maxAgeDays * SECONDS_PER_DAY);
  return band ? band.level : 0;
}

function ageLevels(
  hunks: readonly GitBlameHunk[],
  commits: Readonly<Record<string, GitBlameCommit>>
): (BlameHeatLevel | null)[] {
  const ranks = rankTimes(hunks, commits);
  return hunks.map((hunk) => {
    const rank = rankOfHunk(hunk, commits, ranks);
    return rank === null ? null : ageLevelForRank(rank, ranks.count);
  });
}

function calendarLevels(
  hunks: readonly GitBlameHunk[],
  commits: Readonly<Record<string, GitBlameCommit>>,
  nowSeconds: number
): (BlameHeatLevel | null)[] {
  return hunks.map((hunk) => {
    const commit = scorableCommit(hunk, commits);
    return commit ? calendarLevelForTime(nowSeconds, commit.authorTime) : null;
  });
}

/**
 * Churn mode: a committed hunk's raw score is its recency fraction times the
 * number of hunks its commit owns in this file. The recency fraction is
 * `(rank + 1) / count`, so even the oldest committed time scores above zero,
 * and the newest scores 1. The raw scores are then scaled so the file's largest
 * is level 9, which keeps the result deterministic and monotonic in both recency
 * and hunk count. Scattered commits (many hunks) and recent commits rise together.
 */
function churnLevels(
  hunks: readonly GitBlameHunk[],
  commits: Readonly<Record<string, GitBlameCommit>>,
  footprint: ReadonlyMap<string, Footprint>
): (BlameHeatLevel | null)[] {
  const ranks = rankTimes(hunks, commits);
  const raw = hunks.map((hunk) => {
    const rank = rankOfHunk(hunk, commits, ranks);
    if (rank === null) return null;
    return ((rank + 1) / ranks.count) * (footprint.get(hunk.commitHash)?.hunks ?? 1);
  });
  let largest = 0;
  for (const value of raw) if (value !== null && value > largest) largest = value;
  const scale = largest > 0 ? largest : 1;
  return raw.map((value) => (value === null ? null : levelAt((value / scale) * 9)));
}

function levelsFor(
  mode: BlameHotspotMode,
  hunks: readonly GitBlameHunk[],
  commits: Readonly<Record<string, GitBlameCommit>>,
  footprint: ReadonlyMap<string, Footprint>,
  nowSeconds: number
): (BlameHeatLevel | null)[] {
  if (mode === "age") return ageLevels(hunks, commits);
  if (mode === "calendar") return calendarLevels(hunks, commits, nowSeconds);
  if (mode === "churn") return churnLevels(hunks, commits, footprint);
  return hunks.map(() => null);
}

/**
 * Scores every blame hunk in a file. `nowSeconds` is read only by `calendar`
 * mode; pass the current Unix time there, and any value otherwise.
 *
 * @returns one entry per hunk, in the same order, never mutating its inputs.
 */
export function scoreBlameHunks(
  hunks: readonly GitBlameHunk[],
  commits: Readonly<Record<string, GitBlameCommit>>,
  mode: BlameHotspotMode,
  nowSeconds: number
): BlameHunkHeat[] {
  const footprint = footprintOf(hunks);
  const levels = levelsFor(mode, hunks, commits, footprint, nowSeconds);
  return hunks.map((hunk, index) => {
    const owned = footprint.get(hunk.commitHash) ?? { hunks: 0, lines: 0 };
    return {
      level: levels[index],
      uncommitted: scorableCommit(hunk, commits) === null,
      commitHunkCount: owned.hunks,
      commitLineCount: owned.lines
    };
  });
}
