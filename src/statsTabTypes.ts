/**
 * Types shared by the extension host and the Statistics tab webview
 * (F3-02), mirroring the Reflog tab's split in `reflogTabTypes.ts`. The
 * reads themselves are `readAuthorStats` and `readActivityHeatmap` in
 * `src/backend/engine/stats.ts` (F3-01); these types only carry their
 * project-owned results across the webview boundary.
 */

import type {
  StatsActivityCell,
  StatsAuthor,
  StatsUnavailableReason
} from "./backend/types/stats.types";

export type { StatsActivityCell, StatsAuthor, StatsUnavailableReason };

/** One Statistics load: both reads' values, or the reason there are none. */
export type StatsLoadResult =
  | { state: "ok"; authors: StatsAuthor[]; cells: StatsActivityCell[] }
  | { state: "unavailable"; reason: StatsUnavailableReason };

/** Where the tab's data comes from; the extension host implements it. */
export type StatsSource = {
  load(repo: string): Promise<StatsLoadResult>;
};

/**
 * The tab's localized text. `title` keeps its `{0}` (the repository's
 * folder name); the cell titles keep theirs (weekday, hour, count).
 * `weekdays` and `weekdaysShort` run Sunday first, as the engine's
 * `weekday` numbers do. `unavailableReasons` is keyed by
 * {@link StatsUnavailableReason}.
 */
export type StatsLabels = {
  title: string;
  loading: string;
  empty: string;
  refresh: string;
  contributors: string;
  activity: string;
  activityNote: string;
  less: string;
  more: string;
  cellNone: string;
  cellOne: string;
  cellMany: string;
  unavailable: string;
  unavailableReasons: Readonly<Record<string, string>>;
  weekdays: string[];
  weekdaysShort: string[];
};

/**
 * Extension host to webview: one load's result, with the text to draw
 * it. Replies carry the `requestId` of the load that produced them, so
 * the webview can drop a slow older reply instead of letting it
 * overwrite a newer one.
 */
export type StatsDataMessage = {
  command: "statsData";
  requestId: number;
  repo: string;
  /** The VS Code display language, for the webview's number formats. */
  locale: string;
  labels: StatsLabels;
  result: StatsLoadResult;
};

/**
 * Extension host to webview: a load has started. Carries the labels and
 * locale on their own so the tab can say it is loading (in the user's
 * language) before the first result lands.
 */
export type StatsLoadingMessage = {
  command: "statsLoading";
  requestId: number;
  repo: string;
  locale: string;
  labels: StatsLabels;
};

/** Every message the extension host posts to the Statistics tab. */
export type StatsHostMessage = StatsDataMessage | StatsLoadingMessage;

/** Webview to extension host. */
export type StatsWebviewMessage = { command: "ready" } | { command: "refresh" };
