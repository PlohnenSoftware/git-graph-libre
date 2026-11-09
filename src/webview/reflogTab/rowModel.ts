import type {
  ReflogDataMessage,
  ReflogLabels,
  ReflogLoadingMessage,
  ReflogRow
} from "@/reflogTabTypes";
import { formatRelativeDate } from "@/webview/utils/date";

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
  rows: ReflogRow[];
  /** F1-01's split for the loaded reflog; null before data and on an error. */
  reflogState: "entries" | "empty" | "none" | null;
  error: string | null;
  hasMore: boolean;
};

export function initialReflogState(): ReflogViewState {
  return {
    loading: true,
    loadingMore: false,
    requestId: 0,
    repo: "",
    ref: null,
    locale: "en",
    labels: null,
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

/** The hash as the tab shows it; the full hash stays on the row for its tooltip. */
export function shortHash(hash: string): string {
  return hash.slice(0, 7);
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

const fullDateFormatters = new Map<string, Intl.DateTimeFormat>();

/** The entry's full local date and time, for the time cell's tooltip. */
export function fullDate(row: ReflogRow, locale: string): string {
  let formatter = fullDateFormatters.get(locale);
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" });
    } catch {
      formatter = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium"
      });
    }
    fullDateFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(row.time * 1000));
}
