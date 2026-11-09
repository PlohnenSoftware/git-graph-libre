import type {
  ReflogDataMessage,
  ReflogDisplay,
  ReflogLabels,
  ReflogLoadingMessage,
  ReflogRow
} from "@/reflogTabTypes";
import { formatRelativeDate, pad2 } from "@/webview/utils/date";

/**
 * Everything the Reflog tab draws, as one value the messages update. The
 * request id is the newest reply applied: a slower older reply (a page that
 * a watcher refresh overtook) carries a smaller one and is dropped, so it
 * can never overwrite newer rows.
 */
export type ReflogViewState = {
  /** True until the first page (or its error) has been applied. */
  loading: boolean;
  /** True between a "Load more" click and its reply. */
  loadingMore: boolean;
  requestId: number;
  repo: string;
  ref: string | null;
  locale: string;
  labels: ReflogLabels | null;
  /** The graph's display settings from the newest applied message. */
  display: ReflogDisplay;
  rows: ReflogRow[];
  /** F1-01's split for the loaded reflog; null before data and on an error. */
  reflogState: "entries" | "empty" | "none" | null;
  error: string | null;
  hasMore: boolean;
};

/**
 * The display settings before the first message lands: the manifest
 * defaults. Nothing renders until the labels arrive, so these never
 * reach the screen on their own.
 */
export function defaultReflogDisplay(): ReflogDisplay {
  return {
    shortHashLength: 8,
    dateFormat: "Date & Time",
    datePattern: "DD MM YYYY",
    needMonthName: false,
    months: []
  };
}

export function initialReflogState(): ReflogViewState {
  return {
    loading: true,
    loadingMore: false,
    requestId: 0,
    repo: "",
    ref: null,
    locale: "en",
    labels: null,
    display: defaultReflogDisplay(),
    rows: [],
    reflogState: null,
    error: null,
    hasMore: false
  };
}

/** A load has started: take its text and language, keep any rows already shown. */
export function applyLoading(
  state: ReflogViewState,
  message: ReflogLoadingMessage
): ReflogViewState {
  if (message.requestId < state.requestId) return state;
  const sameRepo = message.repo === state.repo;
  return {
    ...state,
    // A refresh of the rows on screen keeps them; a new repository starts over.
    loading: !(sameRepo && state.rows.length > 0),
    repo: message.repo,
    rows: sameRepo ? state.rows : [],
    locale: message.locale,
    labels: message.labels,
    display: message.display,
    error: sameRepo ? state.error : null
  };
}

/** One page landed. Stale replies and an already-applied appended page are dropped. */
export function applyData(state: ReflogViewState, message: ReflogDataMessage): ReflogViewState {
  if (message.requestId < state.requestId) return state;
  if (message.requestId === state.requestId && message.append && !state.loading) return state;
  const { page } = message;
  return {
    loading: false,
    loadingMore: false,
    requestId: message.requestId,
    repo: message.repo,
    ref: page.ref ?? state.ref,
    locale: message.locale,
    labels: message.labels,
    display: message.display,
    // A failed "Load more" keeps the rows on screen; only its error is new.
    rows:
      message.append && page.error !== null
        ? state.rows
        : message.append
          ? [...state.rows, ...page.rows]
          : page.rows,
    reflogState: page.state ?? state.reflogState,
    error: page.error,
    hasMore: page.error === null ? page.hasMore : state.hasMore
  };
}

/** The "Load more" click, until its page (or a newer load's) lands. */
export function markLoadingMore(state: ReflogViewState): ReflogViewState {
  return state.hasMore && !state.loadingMore ? { ...state, loadingMore: true } : state;
}

/** The entry's selector, such as `HEAD@{3}`. */
export function selectorFor(row: ReflogRow, ref: string | null): string {
  return `${ref ?? "HEAD"}@{${row.index}}`;
}

/**
 * The badge an entry's state earns, or null for none. `reachable` needs no
 * marking, and an unknown state (null — the state read failed) must not be
 * guessed at, so both draw nothing.
 */
export function badgeFor(row: ReflogRow, labels: ReflogLabels): string | null {
  if (row.state === "reflogOnly") return labels.onlyInReflog;
  if (row.state === "missing") return labels.objectMissing;
  return null;
}

/** "5 minutes ago" in the editor's language, through the graph's own formatter. */
export function relativeTime(row: ReflogRow, now: Date, locale: string): string {
  return formatRelativeDate(new Date(row.time * 1000), now, locale);
}

/**
 * The entry's date in the graph's own shape (`getCommitDate` in the graph
 * webview): the bundle's date pattern with the bundle's month names, the
 * `dateFormat` setting choosing date-and-time, date only, or relative,
 * and the date-and-time shape always on hover. Formatted through the
 * shared date utilities, never a private `Intl` shape of this tab's.
 */
export function entryDate(
  row: ReflogRow,
  display: ReflogDisplay,
  now: Date,
  locale: string
): { value: string; title: string } {
  const date = new Date(row.time * 1000);
  const monthName = display.months[date.getMonth()];
  const dateStr = display.datePattern
    .replace("DD", String(date.getDate()))
    .replace(
      "MM",
      display.needMonthName && monthName !== undefined ? monthName : String(date.getMonth() + 1)
    )
    .replace("YYYY", String(date.getFullYear()));
  const timeStr = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  const title = `${dateStr} ${timeStr}`;
  switch (display.dateFormat) {
    case "Date Only":
      return { value: dateStr, title };
    case "Relative":
      return { value: formatRelativeDate(date, now, locale), title };
    default:
      return { value: title, title };
  }
}
