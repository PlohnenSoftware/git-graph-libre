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
  /**
   * The other worktree whose `HEAD` reflog is shown (F1-08), as Git lists
   * its path; null reads in the tab's own repository. Only ever set with
   * `ref: "HEAD"`: branch and stash reflogs are shared by every worktree,
   * so reading them elsewhere would show the same entries. The data
   * source re-checks the path against `git worktree list` before reading
   * there, so this field alone can never aim a read at a random folder.
   */
  worktreePath: string | null;
  /** Fixed, case-insensitive message search text; empty searches nothing out. */
  search: string;
  /** The action kinds to keep, from {@link REFLOG_ACTION_KINDS}; empty keeps every kind. */
  actions: string[];
  /** Keep only entries whose commit only the reflog still reaches (the F1-02 state). */
  onlyInReflog: boolean;
};

/** The unfiltered `HEAD` query the tab opens with. */
export function defaultReflogQuery(): ReflogQuery {
  return { ref: "HEAD", worktreePath: null, search: "", actions: [], onlyInReflog: false };
}

/**
 * One entry of the ref picker (F1-08): a ref of the tab's repository, or
 * another worktree's `HEAD`. The worktree state rides along in Git's own
 * shapes (`GitWorktree`'s locked and prunable), so the picker can mark a
 * locked or missing worktree with the graph's words. A branch or stash
 * option always has a null worktree path, name, locked and prunable.
 */
export type ReflogRefOption = {
  /** The ref to read: `HEAD`, a local branch's full ref, or `refs/stash`. */
  ref: string;
  /** The worktree to read it in; null is the tab's own repository. */
  worktreePath: string | null;
  /** That worktree's folder name, for its picker and header wording. */
  worktreeName: string | null;
  /** Reason is "" when the worktree is locked without one. */
  locked: { reason: string } | null;
  /** Set when Git calls the worktree prunable: its folder moved or is gone. */
  prunable: { reason: string } | null;
};

/** A picker option for a ref of the tab's own repository. */
export function repoRefOption(ref: string): ReflogRefOption {
  return { ref, worktreePath: null, worktreeName: null, locked: null, prunable: null };
}

/** The picker's options before the first listing lands: just `HEAD`. */
export function defaultRefOptions(): ReflogRefOption[] {
  return [repoRefOption("HEAD")];
}

/** True when an option is the one a query asks for. */
export function refOptionMatchesQuery(option: ReflogRefOption, query: ReflogQuery): boolean {
  return option.ref === query.ref && option.worktreePath === query.worktreePath;
}

/** True when a query filters anything out, so its read goes up to the search cap. */
export function isReflogFiltered(query: ReflogQuery): boolean {
  return query.search !== "" || query.actions.length > 0 || query.onlyInReflog;
}

/** True when two queries ask for exactly the same entries. */
export function reflogQueriesEqual(left: ReflogQuery, right: ReflogQuery): boolean {
  return (
    left.ref === right.ref &&
    left.worktreePath === right.worktreePath &&
    left.search === right.search &&
    left.onlyInReflog === right.onlyInReflog &&
    left.actions.length === right.actions.length &&
    left.actions.every((kind, index) => kind === right.actions[index])
  );
}

function hasControlCharacter(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
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
 * The worktree a query may read `HEAD` in: a plain path, and only beside
 * `HEAD`. Membership in `git worktree list` is the data source's check;
 * this boundary keeps the shape, never the destination.
 */
function pickerWorktreePath(value: unknown, ref: string): string | null {
  if (ref !== "HEAD") return null;
  if (typeof value !== "string" || value === "" || hasControlCharacter(value)) return null;
  return value;
}

/**
 * A query the tab may act on, whatever arrived over the webview boundary:
 * the ref is one the picker can name, the kinds are the known ones, and
 * every field has its own type. Anything else falls back field by field,
 * so a malformed message can never aim the backend at an arbitrary ref.
 */
export function normalizeReflogQuery(value: unknown): ReflogQuery {
  if (typeof value !== "object" || value === null) return defaultReflogQuery();
  const { ref, worktreePath, search, actions, onlyInReflog } = value as Record<string, unknown>;
  const pickedRef = pickerRef(ref);
  return {
    ref: pickedRef,
    worktreePath: pickerWorktreePath(worktreePath, pickedRef),
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
  /** Why a bare repository has no `HEAD` reflog to show (F1-08). */
  bareHeadNote: string;
  /** The graph's own `ui.worktreeHead` words, "HEAD of worktree {0}" (F1-08). */
  worktreeHead: string;
  /** The graph's own `ui.worktreeLocked` words, "locked: {0}". */
  worktreeLocked: string;
  /** The graph's own `ui.worktreeLockedNoReason` word, "locked". */
  worktreeLockedNoReason: string;
  /** The graph's own `ui.worktreeMissing` words for a prunable worktree. */
  worktreeMissing: string;
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
  /** Localized text for the opt-in lost-commit scan (F1-07). */
  lostCommits: {
    scan: string;
    rescan: string;
    close: string;
    cancel: string;
    title: string;
    scanning: string;
    gcNote: string;
    empty: string;
    canceled: string;
    timedOut: string;
    error: string;
    createBranch: string;
  };
};

/** One unreachable commit discovered by the opt-in lost-commit scan (F1-07). */
export type ReflogLostCommit = {
  /** Full commit hash. */
  hash: string;
  /** Committer timestamp in Unix seconds. */
  time: number;
  /** First line of the commit message. */
  subject: string;
};

/** Outcome of one opt-in lost-commit scan (F1-07). */
export type ReflogLostCommitsResult = {
  commits: ReflogLostCommit[];
  canceled: boolean;
  timedOut: boolean;
  error: string | null;
};

/** Lifecycle state of the lost-commit scan section in the Reflog tab (F1-07). */
export type ReflogLostCommitsStatus =
  | "idle"
  | "scanning"
  | "done"
  | "canceled"
  | "timedOut"
  | "error";

/** Inline feedback from creating a branch on a lost commit (F1-07). */
export type ReflogLostCommitsFeedback = {
  kind: "success" | "error";
  message: string;
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

/** The picker's options for one repository, and whether that repository is bare (F1-08). */
export type ReflogRefs = {
  options: ReflogRefOption[];
  /** True when the tab's repository itself is bare, so its `HEAD` keeps no reflog by default. */
  bare: boolean;
};

/** Where the tab's pages come from; the extension host implements it. */
export type ReflogSource = {
  loadPage(repo: string, offset: number, limit: number, query?: ReflogQuery): Promise<ReflogPage>;
  /** The picker's options for a repository; without one the tab offers only `HEAD`. */
  loadRefs?(repo: string): Promise<ReflogRefs>;
  /**
   * Closes any engine handle a read in another worktree opened (F1-08,
   * Phase 16 rule 5). The panel calls it when it retargets or closes; the
   * tab's own repository stays the repository manager's to close.
   */
  releaseWorktrees?(): void;
  /** Opt-in read-only scan for commits reached by no ref and no reflog (F1-07). */
  scanLostCommits?(repo: string, signal?: AbortSignal): Promise<ReflogLostCommitsResult>;
  /** Creates a branch at `commitHash` without moving HEAD; returns null or an error message (F1-07). */
  createBranch?(repo: string, commitHash: string, branchName: string): Promise<string | null>;
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
  /** The query this page answers, and the picker's options for the repository. */
  query: ReflogQuery;
  refOptions: ReflogRefOption[];
  /** Whether the tab's repository itself is bare (F1-08). */
  bare: boolean;
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
  /** The query the started load answers, and the picker's options known so far. */
  query: ReflogQuery;
  refOptions: ReflogRefOption[];
  /** Whether the tab's repository itself is bare (F1-08). */
  bare: boolean;
  locale: string;
  labels: ReflogLabels;
  /** The graph's display settings, read live for this load. */
  display: ReflogDisplay;
};

/**
 * Extension host to webview: the lost-commit scan's current state (F1-07).
 * Carries `scanId` so a slow older scan reply can never overwrite a newer
 * scan or a repository switch.
 */
export type ReflogLostCommitsMessage = {
  command: "reflogLostCommits";
  scanId: number;
  repo: string;
  status: ReflogLostCommitsStatus;
  commits: ReflogLostCommit[];
  error: string | null;
  /** Commit hash currently creating a branch, or null. */
  busyHash: string | null;
  feedback: ReflogLostCommitsFeedback | null;
};

/** Every message the extension host posts to the Reflog tab. */
export type ReflogHostMessage = ReflogDataMessage | ReflogLoadingMessage | ReflogLostCommitsMessage;

/** Webview to extension host. */
export type ReflogWebviewMessage =
  | { command: "ready" }
  | { command: "loadMore" }
  | { command: "refresh" }
  | { command: "query"; query: ReflogQuery }
  | { command: "scanLostCommits" }
  | { command: "cancelLostCommitsScan" }
  | { command: "closeLostCommits" }
  | { command: "createLostCommitBranch"; hash: string };
