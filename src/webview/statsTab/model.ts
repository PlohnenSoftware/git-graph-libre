import type {
  StatsActivityCell,
  StatsAuthor,
  StatsDataMessage,
  StatsLabels,
  StatsLoadingMessage,
  StatsLoadResult
} from "@/statsTabTypes";

/**
 * The Statistics tab's view state and its pure shaping (F3-02): ranking
 * the contributors, laying the sparse engine cells out as the full
 * 7 by 24 grid, and folding a cell's count into one of the legend's
 * five steps. Nothing here touches the DOM, so every rule is unit
 * tested without a document.
 */

export type StatsViewState = {
  repo: string;
  locale: string;
  labels: StatsLabels | null;
  loading: boolean;
  result: StatsLoadResult | null;
  /** The newest load answered so far; older replies are dropped. */
  requestId: number;
};

export function initialStatsState(): StatsViewState {
  return { repo: "", locale: "en", labels: null, loading: false, result: null, requestId: 0 };
}

/** A load started: keep any result on screen behind the loading word. */
export function applyLoading(state: StatsViewState, message: StatsLoadingMessage): StatsViewState {
  if (message.requestId < state.requestId) return state;
  return {
    repo: message.repo,
    locale: message.locale,
    labels: message.labels,
    loading: true,
    result: message.repo === state.repo ? state.result : null,
    requestId: message.requestId
  };
}

/** A load answered. A reply older than the newest one seen is dropped. */
export function applyData(state: StatsViewState, message: StatsDataMessage): StatsViewState {
  if (message.requestId < state.requestId) return state;
  return {
    repo: message.repo,
    locale: message.locale,
    labels: message.labels,
    loading: false,
    result: message.result,
    requestId: message.requestId
  };
}

/** One contributor row: the author, with its share of every commit. */
export type RankedAuthor = StatsAuthor & {
  /** The author's share of all counted commits, 0 to 1. */
  share: number;
  /** The bar's length against the top author, 0 to 1. */
  relative: number;
};

/**
 * The contributors ranked by commit count, largest first; ties read in
 * name then email order so the list is stable between loads. Authors
 * with no commits cannot appear (the engine counts commits), but a
 * zero total still yields zero shares rather than a NaN.
 */
export function rankAuthors(authors: readonly StatsAuthor[]): RankedAuthor[] {
  const total = authors.reduce((sum, author) => sum + author.commits, 0);
  const top = authors.reduce((max, author) => Math.max(max, author.commits), 0);
  return authors
    .map((author) => ({
      ...author,
      share: total > 0 ? author.commits / total : 0,
      relative: top > 0 ? author.commits / top : 0
    }))
    .toSorted(
      (a, b) =>
        b.commits - a.commits || a.name.localeCompare(b.name) || a.email.localeCompare(b.email)
    );
}

/** The activity grid: 7 weekday rows (Sunday first) of 24 hour counts. */
export type HeatmapGrid = {
  counts: number[][];
  /** The busiest cell's count, the top of the color ramp. */
  max: number;
};

/** The sparse engine cells (non-zero only) as the full grid. */
export function buildHeatmapGrid(cells: readonly StatsActivityCell[]): HeatmapGrid {
  const counts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let max = 0;
  for (const cell of cells) {
    const row = counts[cell.weekday];
    if (row === undefined) continue;
    row[cell.hour] = (row[cell.hour] ?? 0) + cell.count;
    max = Math.max(max, row[cell.hour] ?? 0);
  }
  return { counts, max };
}

/** How many steps the legend shows, the empty cell included. */
export const HEAT_LEVELS = 5;

/**
 * A cell's step on the ramp: 0 for no commits, then the count's share
 * of the busiest cell spread over the remaining steps, so the busiest
 * cell always takes the top step and any commit at all shows.
 */
export function heatLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(HEAT_LEVELS - 1, Math.max(1, Math.ceil((count / max) * (HEAT_LEVELS - 1))));
}
