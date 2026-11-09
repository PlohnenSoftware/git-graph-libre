/**
 * Types shared by the extension host and the Reflog tab webview (F1-03),
 * mirroring the GGL Diff tab's split in `diffTabTypes.ts`. The read itself
 * is `loadReflog` in `src/backend/queries/reflog.ts` (F1-01/F1-02); these
 * types only carry one page of it across the webview boundary.
 */

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

/** The tab's localized text; `loadError` and `title` keep their `{0}`. */
export type ReflogLabels = {
  title: string;
  loading: string;
  loadMore: string;
  empty: string;
  loadError: string;
  onlyInReflog: string;
  objectMissing: string;
  columnIndex: string;
  columnAction: string;
  columnSubAction: string;
  columnMessage: string;
  columnHash: string;
  columnTime: string;
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
};

/** Where the tab's pages come from; the extension host implements it. */
export type ReflogSource = {
  loadPage(repo: string, offset: number, limit: number): Promise<ReflogPage>;
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
  /** The VS Code display language, for the webview's relative times. */
  locale: string;
  labels: ReflogLabels;
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
  locale: string;
  labels: ReflogLabels;
};

/** Every message the extension host posts to the Reflog tab. */
export type ReflogHostMessage = ReflogDataMessage | ReflogLoadingMessage;

/** Webview to extension host. */
export type ReflogWebviewMessage =
  | { command: "ready" }
  | { command: "loadMore" }
  | { command: "refresh" };
