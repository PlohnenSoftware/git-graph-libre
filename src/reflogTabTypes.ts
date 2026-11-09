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

/** Webview to extension host. */
export type ReflogWebviewMessage =
  | { command: "ready" }
  | { command: "loadMore" }
  | { command: "refresh" };
