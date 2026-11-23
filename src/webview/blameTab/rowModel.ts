import type { GitBlameCommit, GitBlameState } from "@/backend/types";
import type {
  BlameDataMessage,
  BlameDisplay,
  BlameHunkView,
  BlameLabels,
  BlameLoadingMessage,
  BlameTypography
} from "@/blameTabTypes";
import { formatRelativeDate, pad2 } from "@/webview/utils/date";

/**
 * Everything the Blame tab draws, as one value the messages update. The
 * request id is the newest reply applied: a slower older reply (a blame a
 * retarget overtook) carries a smaller one and is dropped, so it can
 * never overwrite a newer file.
 */
export type BlameViewState = {
  /** True until the first blame (or its error) has been applied. */
  loading: boolean;
  requestId: number;
  repo: string;
  filePath: string;
  /** The requested revision, or null for the working tree. */
  rev: string | null;
  /** The 1-based line to highlight and scroll to, or null for none. */
  targetLine: number | null;
  locale: string;
  labels: BlameLabels | null;
  /** The graph's display settings from the newest applied message. */
  display: BlameDisplay;
  /** The editor typography from the newest applied message. */
  typography: BlameTypography;
  commits: Record<string, GitBlameCommit>;
  hunks: BlameHunkView[];
  /** F4-01's state for the blamed file; null before data and on an error. */
  blameState: GitBlameState | null;
  /** The commit OID the revision resolved to, or null for the working tree. */
  resolvedRev: string | null;
  totalLines: number;
  error: string | null;
  /**
   * The user's gutter width for this repository, or null while the
   * gutter still takes its default. Kept per repository by the tab's
   * saved webview state, the way the reflog tab keeps its widths.
   */
  gutterWidth: number | null;
};

/**
 * The display settings before the first message lands: the manifest
 * defaults. Nothing renders until the labels arrive, so these never
 * reach the screen on their own.
 */
export function defaultBlameDisplay(): BlameDisplay {
  return {
    shortHashLength: 8,
    dateFormat: "Date & Time",
    datePattern: "DD MM YYYY",
    needMonthName: false,
    months: []
  };
}

/** The typography before the first message lands: the editor defaults. */
export function defaultBlameTypography(): BlameTypography {
  return { fontSize: 14, lineHeight: 21, tabSize: 4 };
}

export function initialBlameState(): BlameViewState {
  return {
    loading: true,
    requestId: 0,
    repo: "",
    filePath: "",
    rev: null,
    targetLine: null,
    locale: "en",
    labels: null,
    display: defaultBlameDisplay(),
    typography: defaultBlameTypography(),
    commits: {},
    hunks: [],
    blameState: null,
    resolvedRev: null,
    totalLines: 0,
    error: null,
    gutterWidth: null
  };
}

/** True when a message answers the same file at the same revision as the state shows. */
function sameTarget(
  state: BlameViewState,
  message: BlameLoadingMessage | BlameDataMessage
): boolean {
  return (
    message.repo === state.repo && message.filePath === state.filePath && message.rev === state.rev
  );
}

/** A load has started: take its text and language, keep a same-target blame on screen. */
export function applyLoading(state: BlameViewState, message: BlameLoadingMessage): BlameViewState {
  if (message.requestId < state.requestId) return state;
  const keep = sameTarget(state, message);
  const sameRepo = message.repo === state.repo;
  return {
    ...state,
    loading: !(keep && state.blameState === "lines"),
    repo: message.repo,
    filePath: message.filePath,
    rev: message.rev,
    targetLine: message.targetLine,
    locale: message.locale,
    labels: message.labels,
    display: message.display,
    typography: message.typography,
    commits: keep ? state.commits : {},
    hunks: keep ? state.hunks : [],
    blameState: keep ? state.blameState : null,
    resolvedRev: keep ? state.resolvedRev : null,
    totalLines: keep ? state.totalLines : 0,
    error: keep ? state.error : null,
    // Widths are per repository: a new one starts from its own saved width.
    gutterWidth: sameRepo ? state.gutterWidth : null
  };
}

/** One blame landed. Stale replies are dropped. */
export function applyData(state: BlameViewState, message: BlameDataMessage): BlameViewState {
  if (message.requestId < state.requestId) return state;
  const { payload } = message;
  return {
    loading: false,
    requestId: message.requestId,
    repo: message.repo,
    filePath: message.filePath,
    rev: message.rev,
    targetLine: message.targetLine,
    locale: message.locale,
    labels: message.labels,
    display: message.display,
    typography: message.typography,
    commits: payload.commits,
    hunks: payload.hunks,
    blameState: payload.state,
    resolvedRev: payload.resolvedRev,
    totalLines: payload.totalLines,
    error: payload.error,
    // Same per-repository rule as a load start, for a page that lands
    // without one (a replayed page after a document rebuild).
    gutterWidth: message.repo === state.repo ? state.gutterWidth : null
  };
}

/**
 * The `data-heat` hook F4-04 styles: `0` (coldest) through `9` (hottest)
 * for a committed hunk, `uncommitted` for working-tree lines, and `none`
 * when the mode scored no level.
 */
export function heatAttribute(hunk: BlameHunkView): string {
  if (hunk.heat.uncommitted) return "uncommitted";
  return hunk.heat.level === null ? "none" : String(hunk.heat.level);
}

/**
 * A hunk commit's date in the graph's own shape (`entryDate` in the
 * reflog tab): the bundle's date pattern with the bundle's month names,
 * the `dateFormat` setting choosing date-and-time, date only, or
 * relative, and the date-and-time shape always on hover. Blame dates a
 * line by when its change was authored, so `authorTime` is the input.
 * Formatted through the shared date utilities, never a private shape.
 */
export function commitDate(
  commit: GitBlameCommit,
  display: BlameDisplay,
  now: Date,
  locale: string
): { value: string; title: string } {
  const date = new Date(commit.authorTime * 1000);
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
