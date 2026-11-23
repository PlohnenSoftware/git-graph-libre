/**
 * Types shared by the extension host and the Reflog tab webview (F1-03),
 * mirroring the GGL Diff tab's split in `diffTabTypes.ts`. The read itself
 * is `loadReflog` in `src/backend/queries/reflog.ts` (F1-01/F1-02); these
 * types only carry one page of it across the webview boundary.
 */

import type { DateFormat } from "./types";

/** One reflog entry as the tab draws it: the F1-01 entry, classified, with its F1-02 state. */
export type ReflogRow = {
  /** The full commit hash the ref pointed at after the move. */
  hash: string;
  /** The `N` of `<ref>@{N}`. */
  index: number;
  /** When the entry was written, in Unix seconds. */
  time: number;
  /** The action kind `classifyReflogMessage` found, such as `commit` or `rebase`. */
  kind: string;
  /** The sub-action, such as `amend` or `pick`; null when the message names none. */
  sub: string | null;
  /** The reflog message exactly as Git wrote it. */
  message: string;
  /**
   * The entry's F1-02 state, or null when it is unknown (the state read
   * failed). Unknown and `reachable` both draw no badge.
   */
  state: "reachable" | "reflogOnly" | "missing" | null;
};

/**
 * The action kinds `classifyReflogMessage` (F1-01) can return today. The
 * set is open: a newer classifier may add kinds, and the tab shows any kind
 * it does not know with Git's raw word and a neutral marker (F1-04).
 */
export const REFLOG_ACTION_KINDS = [
  "commit",
  "checkout",
  "reset",
  "rebase",
  "merge",
  "pull",
  "fetch",
  "cherry-pick",
  "revert",
  "branch",
  "stash",
  "clone",
  "other"
] as const;

/**
 * The sub-actions Git writes in reflog subjects, as `classifyReflogMessage`
 * returns them (F1-01's verified subjects): `commit (initial|amend|merge)`,
 * `rebase (start|pick|squash|fixup|reword|edit|continue|abort|finish)` and
 * the same sequencer steps under `pull`, `merge` "fast-forward", `branch`
 * created/renamed/copied, and the stash's wip/named. Any other sub-action
 * shows Git's raw word on a neutral tag (F1-04).
 */
export const REFLOG_SUB_ACTIONS = [
  "initial",
  "amend",
  "merge",
  "start",
  "pick",
  "squash",
  "fixup",
  "reword",
  "edit",
  "continue",
  "abort",
  "finish",
  "fast-forward",
  "created",
  "renamed",
  "copied",
  "wip",
  "named"
] as const;

/**
 * How far a filtered read looks (F1-05, RQ7): a search or filter fetches
 * at most this many entries from Git — matches, when Git's own
 * `--grep-reflog` does the searching — instead of only the loaded page.
 * A constant, not a setting; the tab says when a read stopped there.
 */
export const REFLOG_SEARCH_CAP = 5000;

/** What the tab asks for: which reflog, and which of its entries (F1-05). */
export type ReflogQuery = {
  /** A picker ref: `HEAD`, a local branch's full ref, or `refs/stash`. */
  ref: string;
  /** Fixed, case-insensitive message search text; empty searches nothing out. */
  search: string;
  /** The action kinds to keep, from {@link REFLOG_ACTION_KINDS}; empty keeps every kind. */
  actions: string[];
  /** Keep only entries whose commit only the reflog still reaches (the F1-02 state). */
  onlyInReflog: boolean;
};

/** The unfiltered `HEAD` query the tab opens with. */
export function defaultReflogQuery(): ReflogQuery {
  return { ref: "HEAD", search: "", actions: [], onlyInReflog: false };
}

/** True when a query filters anything out, so its read goes up to the search cap. */
export function isReflogFiltered(query: ReflogQuery): boolean {
  return query.search !== "" || query.actions.length > 0 || query.onlyInReflog;
}

/** True when two queries ask for exactly the same entries. */
export function reflogQueriesEqual(left: ReflogQuery, right: ReflogQuery): boolean {
  return (
    left.ref === right.ref &&
    left.search === right.search &&
    left.onlyInReflog === right.onlyInReflog &&
    left.actions.length === right.actions.length &&
    left.actions.every((kind, index) => kind === right.actions[index])
  );
}

function hasControlCharacter(text: string): boolean {
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** A picker ref is `HEAD`, the stash, or a local branch's full name — nothing else. */
function pickerRef(value: unknown): string {
  if (typeof value !== "string" || hasControlCharacter(value)) return "HEAD";
  if (value === "HEAD" || value === "refs/stash") return value;
  // A full branch name never starts with a dash, so it can never be read
  // as an option; the backend read refuses dash-led refs on top of this.
  if (value.startsWith("refs/heads/") && value.length > "refs/heads/".length) return value;
  return "HEAD";
}

/**
 * A query the tab may act on, whatever arrived over the webview boundary:
 * the ref is one the picker can name, the kinds are the known ones, and
 * every field has its own type. Anything else falls back field by field,
 * so a malformed message can never aim the backend at an arbitrary ref.
 */
export function normalizeReflogQuery(value: unknown): ReflogQuery {
  if (typeof value !== "object" || value === null) return defaultReflogQuery();
  const { ref, search, actions, onlyInReflog } = value as Record<string, unknown>;
  return {
    ref: pickerRef(ref),
    search: typeof search === "string" ? search.trim() : "",
    actions: Array.isArray(actions)
      ? REFLOG_ACTION_KINDS.filter((kind) => actions.includes(kind))
      : [],
    onlyInReflog: onlyInReflog === true
  };
}

/**
 * The graph's display settings, carried to this tab the way the graph's
 * boot config carries them (`webviewHtml.ts`): read live through the
 * `config` accessors on every load, so a settings change restyles both
 * surfaces alike (F1-04F).
 */
export type ReflogDisplay = {
  /** The `shortHashLength` setting, already clamped by its accessor. */
  shortHashLength: number;
  /** The `dateFormat` setting: which shape the date column takes. */
  dateFormat: DateFormat;
  /** The bundle's `time.dateformat` pattern (`DD MM YYYY` in English). */
  datePattern: string;
  /** The bundle's `time.needFormatMonth`: true when `MM` is a month name. */
  needMonthName: boolean;
  /** The bundle's twelve `month.*` names, January first. */
  months: string[];
};

/** The tab's localized text; `loadError`, `searchCapped` and `title` keep their `{0}`. */
export type ReflogLabels = {
  title: string;
  loading: string;
  loadMore: string;
  empty: string;
  loadError: string;
  searchPlaceholder: string;
  filterRef: string;
  filterAllActions: string;
  noMatches: string;
  searchCapped: string;
  onlyInReflog: string;
  objectMissing: string;
  columnIndex: string;
  columnAction: string;
  columnSubAction: string;
  columnMessage: string;
  /** The graph's own `ui.commit` word, shared with its Commit column. */
  columnCommit: string;
  /** The graph's own `ui.date` word, shared with its Date column. */
  columnDate: string;
  columnState: string;
  /** Localized label per known action kind, keyed by {@link REFLOG_ACTION_KINDS}. */
  actions: Readonly<Record<string, string>>;
  /** Localized label per known sub-action, keyed by {@link REFLOG_SUB_ACTIONS}. */
  subActions: Readonly<Record<string, string>>;
};

/** One page of the reflog, newest first, as `loadReflog` returned it. */
export type ReflogPage = {
  rows: ReflogRow[];
  /** `entries`, `empty` or `none` (F1-01's split); null exactly when `error` is set. */
  state: "entries" | "empty" | "none" | null;
  /** True when older entries exist beyond this page. */
  hasMore: boolean;
  /** The ref's full name, such as `HEAD`; null on an error. */
  ref: string | null;
  /** The read failure's message; null when the read worked. */
  error: string | null;
  /**
   * True when a filtered read stopped at {@link REFLOG_SEARCH_CAP} while
   * more fetched entries remained, so older matches may be missing.
   */
  searchCapped: boolean;
};

/** Where the tab's pages come from; the extension host implements it. */
export type ReflogSource = {
  loadPage(repo: string, offset: number, limit: number, query?: ReflogQuery): Promise<ReflogPage>;
  /** The picker's refs for a repository; without one the tab offers only `HEAD`. */
  loadRefs?(repo: string): Promise<string[]>;
};

/**
 * Extension host to webview: one page, with the text to draw it. Replies
 * carry the `requestId` of the load that produced them, so the webview can
 * drop a slow older reply instead of letting it overwrite a newer one.
 */
export type ReflogDataMessage = {
  command: "reflogData";
  requestId: number;
  /** True for a "Load more" page, which extends the rows already shown. */
  append: boolean;
  repo: string;
  /** The query this page answers, and the picker's refs for the repository. */
  query: ReflogQuery;
  refs: string[];
  /** The VS Code display language, for the webview's relative times. */
  locale: string;
  labels: ReflogLabels;
  /** The graph's display settings, read live for this load. */
  display: ReflogDisplay;
  page: ReflogPage;
};

/**
 * Extension host to webview: a load has started. Carries the labels and
 * locale on their own so the tab can say it is loading (in the user's
 * language) before the first page lands.
 */
export type ReflogLoadingMessage = {
  command: "reflogLoading";
  requestId: number;
  repo: string;
  /** The query the started load answers, and the picker's refs known so far. */
  query: ReflogQuery;
  refs: string[];
  locale: string;
  labels: ReflogLabels;
  /** The graph's display settings, read live for this load. */
  display: ReflogDisplay;
};

/** Every message the extension host posts to the Reflog tab. */
export type ReflogHostMessage = ReflogDataMessage | ReflogLoadingMessage;

/** Webview to extension host. */
export type ReflogWebviewMessage =
  | { command: "ready" }
  | { command: "loadMore" }
  | { command: "refresh" }
  | { command: "query"; query: ReflogQuery };
