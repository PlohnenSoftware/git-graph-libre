import type { GitBlameCommit } from "@/backend/types";
import { type BlameHotspotMode, scoreBlameHunks } from "@/blameHotspot";
import type {
  BlameDataMessage,
  BlameDisplay,
  BlameHunkView,
  BlameLabels,
  BlameLoadingMessage,
  BlameNavigationState,
  BlameOptions,
  BlameRepoChangedMessage,
  BlameRepoMeta,
  BlameTabState,
  BlameTypography
} from "@/blameTabTypes";
import { formatRelativeDate, pad2 } from "@/webview/utils/date";

const HOTSPOT_MODES: readonly BlameHotspotMode[] = ["age", "calendar", "churn", "off"];
const DEFAULT_REPO_META: BlameRepoMeta = { linkedWorktree: false, bare: false };

/** One in-tab Find / Author filter match (F4-05). */
export type BlameFindMatch = {
  /** Index of the matching hunk in `state.hunks`. */
  hunkIndex: number;
  /** 1-based `finalLine` in the blamed file to highlight and scroll to. */
  line: number;
  /** Whether the match came from a source line or the hunk's commit metadata. */
  kind: "line" | "hunk";
};

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
  /** F4-01's state (or `bareWorkingTree`) for the blamed file; null before data and on an error. */
  blameState: BlameTabState | null;
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
  /**
   * The hotspot mode the heat is drawn with. The user picks it in the
   * header; it is saved in the webview state and every hunk's heat is
   * recomputed from it here, never by a new `git blame`.
   */
  hotspotMode: BlameHotspotMode;
  /** True when the blamed text came from an unsaved dirty editor buffer (BQ6). */
  unsavedBuffer: boolean;
  /** Repository layout metadata for linked worktree and bare repository display. */
  repoMeta: BlameRepoMeta;
  /** True when the repository changed while a pinned historical commit is shown. */
  repoChanged: boolean;
  /** True when the latest render came from a live refresh that should keep scroll position. */
  preserveScroll: boolean;
  /** Back/Forward/Latest navigation stack state from the extension host (F4-05). */
  navigation: BlameNavigationState;
  /** Header blame option toggles (`-w`, `-M`, `-C`, `.git-blame-ignore-revs`) (F4-05). */
  options: BlameOptions;
  /** Session-ignored commit hashes passed as `--ignore-rev` (F4-05). */
  ignoreRevs: string[];
  /** True when `.git-blame-ignore-revs` exists at the repository root (F4-05). */
  hasIgnoreRevsFile: boolean;
  /** The `--ignore-revs-file` path used for the current read, or null (F4-05). */
  ignoreRevsFileUsed: string | null;
  /** True when the in-tab Find / Author filter bar is open (F4-05). */
  findOpen: boolean;
  /** Current query text in the Find / Author filter bar (F4-05). */
  findQuery: string;
  /** All current Find / Author matches in document order (F4-05). */
  findMatches: BlameFindMatch[];
  /** 0-based index into `findMatches`, or -1 when there are no matches (F4-05). */
  findActiveIndex: number;
};

/** The saved hotspot mode, or `age` (the default) for anything unknown. */
export function normalizeHotspotMode(value: unknown): BlameHotspotMode {
  return HOTSPOT_MODES.find((mode) => mode === value) ?? "age";
}

/** Whole seconds since the epoch, the clock the calendar mode ages against. */
function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Hunks with their heat recomputed for `mode` by the shared scoring model
 * (`src/blameHotspot.ts`). Every field but `heat` is kept as it arrived.
 */
export function scoreHunks(
  hunks: readonly BlameHunkView[],
  commits: Record<string, GitBlameCommit>,
  mode: BlameHotspotMode,
  nowSeconds: number
): BlameHunkView[] {
  const heats = scoreBlameHunks(hunks, commits, mode, nowSeconds);
  return hunks.map((hunk, index) => ({ ...hunk, heat: heats[index] }));
}

/** The user chose a hotspot mode: the same hunks, re-scored. No host round-trip. */
export function applyHotspotMode(
  state: BlameViewState,
  mode: BlameHotspotMode,
  nowSeconds: number = nowInSeconds()
): BlameViewState {
  return {
    ...state,
    hotspotMode: mode,
    hunks: scoreHunks(state.hunks, state.commits, mode, nowSeconds),
    preserveScroll: true
  };
}

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

/** Default navigation state when no history entries are on the stack. */
export function defaultBlameNavigation(
  filePath = "",
  rev: string | null = null
): BlameNavigationState {
  return {
    backCount: 0,
    forwardCount: 0,
    canLatest: rev !== null,
    initialFilePath: filePath
  };
}

/** Default blame options (`BQ5`): plain blame, `.git-blame-ignore-revs` enabled when present. */
export function defaultBlameOptions(): BlameOptions {
  return {
    ignoreWhitespace: false,
    detectMoves: false,
    detectCopies: false,
    useIgnoreRevsFile: true
  };
}

export function initialBlameState(hotspotMode: BlameHotspotMode = "age"): BlameViewState {
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
    gutterWidth: null,
    hotspotMode,
    unsavedBuffer: false,
    repoMeta: DEFAULT_REPO_META,
    repoChanged: false,
    preserveScroll: false,
    navigation: defaultBlameNavigation(),
    options: defaultBlameOptions(),
    ignoreRevs: [],
    hasIgnoreRevsFile: false,
    ignoreRevsFileUsed: null,
    findOpen: false,
    findQuery: "",
    findMatches: [],
    findActiveIndex: -1
  };
}

function hunkMetaMatches(
  hunk: BlameHunkView,
  commit: GitBlameCommit | undefined,
  needle: string
): boolean {
  const uncommitted = commit?.uncommitted === true || hunk.heat.uncommitted;
  if (uncommitted) return false;
  if (hunk.commitHash.toLowerCase().includes(needle)) return true;
  if (commit === undefined) return false;
  return (
    commit.author.toLowerCase().includes(needle) || commit.summary.toLowerCase().includes(needle)
  );
}

/**
 * Computes all in-tab Find / Author filter matches across source line
 * text, author name, commit summary, and commit hash (case-insensitive
 * substring). Each matching source line produces a line match; a hunk
 * whose commit metadata matches without any source line match in that
 * hunk produces a single hunk match anchored at `hunk.startLine`.
 */
export function computeFindMatches(
  hunks: readonly BlameHunkView[],
  commits: Record<string, GitBlameCommit>,
  query: string
): BlameFindMatch[] {
  if (query === "") return [];
  const needle = query.toLowerCase();
  const matches: BlameFindMatch[] = [];
  hunks.forEach((hunk, hunkIndex) => {
    let lineMatched = false;
    for (const line of hunk.lines) {
      if (line.content.toLowerCase().includes(needle)) {
        matches.push({ hunkIndex, line: line.finalLine, kind: "line" });
        lineMatched = true;
      }
    }
    if (!lineMatched && hunkMetaMatches(hunk, commits[hunk.commitHash], needle)) {
      matches.push({ hunkIndex, line: hunk.startLine, kind: "hunk" });
    }
  });
  return matches;
}

/** Opens the Find / Author filter bar, keeping any existing query and matches. */
export function openFind(state: BlameViewState): BlameViewState {
  if (state.findOpen) return state;
  return { ...state, findOpen: true };
}

/** Clears the Find / Author filter query and closes the find bar. */
export function closeFind(state: BlameViewState): BlameViewState {
  if (!state.findOpen && state.findQuery === "" && state.findMatches.length === 0) return state;
  return {
    ...state,
    findOpen: false,
    findQuery: "",
    findMatches: [],
    findActiveIndex: -1
  };
}

/** Updates the Find / Author filter query and recomputes matches. */
export function applyFindQuery(state: BlameViewState, query: string): BlameViewState {
  const findMatches = computeFindMatches(state.hunks, state.commits, query);
  return {
    ...state,
    findOpen: true,
    findQuery: query,
    findMatches,
    findActiveIndex: findMatches.length > 0 ? 0 : -1
  };
}

/** Advances (`1`) or reverses (`-1`) the active Find match, wrapping at both ends. */
export function stepFindMatch(state: BlameViewState, delta: 1 | -1): BlameViewState {
  const count = state.findMatches.length;
  if (count === 0) return state;
  const current = Math.max(state.findActiveIndex, 0);
  const nextIndex = (current + delta + count) % count;
  return { ...state, findActiveIndex: nextIndex };
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

function emptyTargetFields() {
  return {
    commits: {} as Record<string, GitBlameCommit>,
    hunks: [] as BlameHunkView[],
    blameState: null as BlameTabState | null,
    resolvedRev: null as string | null,
    totalLines: 0,
    error: null as string | null,
    hasIgnoreRevsFile: false,
    ignoreRevsFileUsed: null as string | null,
    findMatches: [] as BlameFindMatch[],
    findActiveIndex: -1
  };
}

function repoScopedFields(state: BlameViewState, message: BlameLoadingMessage | BlameDataMessage) {
  const sameRepo = message.repo === state.repo;
  return {
    // Widths are per repository: a new one starts from its own saved width.
    gutterWidth: sameRepo ? state.gutterWidth : null,
    navigation: message.navigation ?? defaultBlameNavigation(message.filePath, message.rev),
    options: message.options ?? (sameRepo ? state.options : defaultBlameOptions()),
    ignoreRevs: message.ignoreRevs ?? (sameRepo ? state.ignoreRevs : []),
    findOpen: sameRepo ? state.findOpen : false,
    findQuery: sameRepo ? state.findQuery : ""
  };
}

/** A load has started: take its text and language, keep a same-target blame on screen. */
export function applyLoading(state: BlameViewState, message: BlameLoadingMessage): BlameViewState {
  if (message.requestId < state.requestId) return state;
  const keep = sameTarget(state, message);
  const retained = keep
    ? {
        commits: state.commits,
        hunks: state.hunks,
        blameState: state.blameState,
        resolvedRev: state.resolvedRev,
        totalLines: state.totalLines,
        error: state.error,
        hasIgnoreRevsFile: state.hasIgnoreRevsFile,
        ignoreRevsFileUsed: state.ignoreRevsFileUsed,
        findMatches: state.findMatches,
        findActiveIndex: state.findActiveIndex
      }
    : emptyTargetFields();
  return {
    ...state,
    ...retained,
    ...repoScopedFields(state, message),
    loading: !(keep && state.blameState === "lines"),
    repo: message.repo,
    filePath: message.filePath,
    rev: message.rev,
    targetLine: message.targetLine,
    locale: message.locale,
    labels: message.labels,
    display: message.display,
    typography: message.typography,
    unsavedBuffer: message.unsavedBuffer === true,
    repoMeta:
      message.repoMeta ?? (message.repo === state.repo ? state.repoMeta : DEFAULT_REPO_META),
    repoChanged: message.repoChanged === true,
    preserveScroll: false
  };
}

function nextFindActiveIndex(prevIndex: number, matchCount: number): number {
  if (matchCount === 0) return -1;
  return prevIndex >= 0 ? Math.min(prevIndex, matchCount - 1) : 0;
}

/** One blame landed. Stale replies are dropped. */
export function applyData(
  state: BlameViewState,
  message: BlameDataMessage,
  nowSeconds: number = nowInSeconds()
): BlameViewState {
  if (message.requestId < state.requestId) return state;
  const { payload } = message;
  const scoped = repoScopedFields(state, message);
  const hunks = scoreHunks(payload.hunks, payload.commits, state.hotspotMode, nowSeconds);
  const findMatches =
    scoped.findQuery !== "" ? computeFindMatches(hunks, payload.commits, scoped.findQuery) : [];
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
    // The host scores with `age`; the saved mode wins, so the drawn heat
    // is the one the user chose.
    hunks,
    blameState: payload.state,
    resolvedRev: payload.resolvedRev,
    totalLines: payload.totalLines,
    error: payload.error,
    ...scoped,
    hotspotMode: state.hotspotMode,
    unsavedBuffer: message.unsavedBuffer === true,
    repoMeta: message.repoMeta ?? DEFAULT_REPO_META,
    repoChanged: message.repoChanged === true,
    preserveScroll: message.preserveScroll === true,
    hasIgnoreRevsFile: payload.hasIgnoreRevsFile === true,
    ignoreRevsFileUsed: payload.ignoreRevsFileUsed ?? null,
    findMatches,
    findActiveIndex: nextFindActiveIndex(state.findActiveIndex, findMatches.length)
  };
}

/** Marks the pinned historical view as stale without disturbing its lines. */
export function applyRepoChanged(
  state: BlameViewState,
  message: BlameRepoChangedMessage
): BlameViewState {
  if (message.repo !== state.repo) return state;
  return { ...state, repoChanged: true, preserveScroll: true };
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
