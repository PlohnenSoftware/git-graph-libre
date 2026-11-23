import * as vscode from "vscode";

import { DEFAULT_REFLOG_PAGE_SIZE, MAX_REFLOG_PAGE_SIZE } from "@/backend/queries/reflog";
import { buildExtensionUri } from "@/backend/utils/path";
import { config } from "@/config";
import type { RepoManager } from "@/extension/repoManager";
import * as l10n from "@/l10n";
import {
  defaultReflogQuery,
  defaultRefOptions,
  normalizeReflogQuery,
  REFLOG_ACTION_KINDS,
  REFLOG_SUB_ACTIONS,
  type ReflogDataMessage,
  type ReflogDisplay,
  type ReflogLabels,
  type ReflogLoadingMessage,
  type ReflogPage,
  type ReflogQuery,
  type ReflogRefOption,
  type ReflogSource,
  type ReflogWebviewMessage,
  reflogQueriesEqual
} from "@/reflogTabTypes";
import { RepoFileWatcher } from "@/repoFileWatcher";
import type { TelemetryReporter } from "@/telemetry";
import { createTabOpenReporter, TAB_FEATURE_REFLOG } from "@/telemetry/tabOpen";

import { buildReflogTabHtml } from "./reflogTabHtml";

/** The file watcher's part the panel uses; tests substitute their own. */
export type ReflogWatcher = Pick<RepoFileWatcher, "start" | "stop">;

export type ReflogTabDeps = {
  extensionPath: string;
  outputChannel: Pick<vscode.OutputChannel, "appendLine">;
  /** Reports each open's outcome, once (T1); see `src/telemetry/tabOpen.ts`. */
  telemetry?: Pick<TelemetryReporter, "logFeature">;
  /** Creates the repository watcher; defaults to the graph's `RepoFileWatcher`. */
  createWatcher?: (onRefresh: () => void) => ReflogWatcher;
  /** Display language for the webview's relative times; defaults to the editor's. */
  locale?: string;
  /**
   * The repository manager's removal hook (F1-08): the tab closes when
   * its repository leaves the list. Absent in tests that do not remove
   * repositories; the tab then simply outlives the removal.
   */
  repoManager?: Pick<RepoManager, "registerRepoRemovedCallback" | "deregisterRepoRemovedCallback">;
};

// One tab at a time, reused like the GGL Diff tab.
let current: ReturnType<typeof createReflogTab> | undefined;

/**
 * Open the Reflog tab for `repo`, or reveal and retarget the one already
 * open. The first page loads now, alongside the webview's start-up, and is
 * posted once both are done.
 */
export function openReflogTab(repo: string, source: ReflogSource, deps: ReflogTabDeps): void {
  current ??= createReflogTab(deps);
  current(repo, source);
}

function folderName(repo: string): string {
  return repo.split("/").at(-1) || repo;
}

function failedPage(error: unknown): ReflogPage {
  return {
    rows: [],
    state: null,
    hasMore: false,
    ref: null,
    error: error instanceof Error ? error.message : String(error),
    searchCapped: false
  };
}

function createReflogTab(deps: ReflogTabDeps) {
  // `retainContextWhenHidden` keeps the document alive while its tab is in
  // the background, so a refresh is one message, never a document reload.
  const panel = vscode.window.createWebviewPanel(
    "git-graph-libre.reflogTab",
    l10n.t("reflog.title", ""),
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        buildExtensionUri(deps.extensionPath, "media"),
        buildExtensionUri(deps.extensionPath, "out")
      ]
    }
  );
  panel.webview.html = buildReflogTabHtml(panel.webview, deps.extensionPath);
  const reportOpen = createTabOpenReporter(deps.telemetry, TAB_FEATURE_REFLOG);

  let ready = false;
  let openPending = false;
  let disposed = false;
  let last: ReflogDataMessage | undefined;
  let pending: ReflogLoadingMessage | undefined;
  let latestRequest = 0;
  let repo = "";
  let source: ReflogSource | undefined;
  let loadedCount = 0;
  // The search, filters and picked ref every load answers (F1-05), and
  // the picker's options for the repository. A watcher or settings
  // refresh re-answers the same query; only the webview changes it.
  let query: ReflogQuery = defaultReflogQuery();
  let refOptions: ReflogRefOption[] = defaultRefOptions();
  let bareRepo = false;

  /** A refresh keeps the rows already loaded, up to one bounded read. */
  const refreshLimit = (): number =>
    Math.min(Math.max(loadedCount, DEFAULT_REFLOG_PAGE_SIZE), MAX_REFLOG_PAGE_SIZE);

  const load = async (append: boolean, limit = DEFAULT_REFLOG_PAGE_SIZE): Promise<void> => {
    if (source === undefined || repo === "") return;
    const activeSource = source;
    const activeRepo = repo;
    const activeQuery = query;
    const requestId = ++latestRequest;
    if (!append) {
      pending = {
        command: "reflogLoading",
        requestId,
        repo: activeRepo,
        query: activeQuery,
        refOptions,
        bare: bareRepo,
        locale: deps.locale ?? vscode.env.language,
        labels: readLabels(),
        display: readDisplay()
      };
      if (ready) void panel.webview.postMessage(pending);
    }
    const offset = append ? loadedCount : 0;
    // A fresh page also refreshes the picker's refs (a branch, the stash
    // or a worktree may have appeared); a "Load more" page keeps the
    // known list.
    const [page, freshRefs] = await Promise.all([
      activeSource.loadPage(activeRepo, offset, limit, activeQuery).catch(failedPage),
      append || activeSource.loadRefs === undefined
        ? null
        : activeSource.loadRefs(activeRepo).catch(() => null)
    ]);
    // A newer load (a watcher refresh, a retargeted tab) supersedes this
    // one: its reply is dropped here, and the webview drops by request id
    // anything that still slips through.
    if (disposed || requestId !== latestRequest) return;
    // The open's first settled load is the open's outcome (T1). Refreshes,
    // paging and query changes afterwards are use, not opening, and report
    // nothing; a load superseded before settling leaves the report to the
    // load that replaced it, which is what the open ends up showing.
    if (openPending && !append) {
      openPending = false;
      reportOpen(page.error === null);
    }
    pending = undefined;
    if (freshRefs !== null && freshRefs.options.length > 0) {
      refOptions = freshRefs.options;
      bareRepo = freshRefs.bare;
    }
    if (page.error === null) {
      loadedCount = append ? loadedCount + page.rows.length : page.rows.length;
    }
    last = {
      command: "reflogData",
      requestId,
      append,
      repo: activeRepo,
      query: activeQuery,
      refOptions,
      bare: bareRepo,
      locale: deps.locale ?? vscode.env.language,
      labels: readLabels(),
      display: readDisplay(),
      page
    };
    if (ready) void panel.webview.postMessage(last);
  };

  // The panel follows the repository the way the graph does: the same
  // watcher, its refresh arriving as fresh data over the retained document.
  const watcher = (deps.createWatcher ?? ((onRefresh) => new RepoFileWatcher(onRefresh)))(() => {
    deps.outputChannel.appendLine(`[reflogTab] refresh repo=${repo}`);
    void load(false, refreshLimit());
  });

  const show = (nextRepo: string, nextSource: ReflogSource): void => {
    // A kept query could name a branch the new repository does not have.
    if (nextRepo !== repo) {
      // The tab follows the switch: the old source lets go of any other
      // worktree it read (F1-08), and the query starts over.
      source?.releaseWorktrees?.();
      query = defaultReflogQuery();
      refOptions = defaultRefOptions();
      bareRepo = false;
    }
    repo = nextRepo;
    source = nextSource;
    loadedCount = 0;
    panel.title = l10n.t("reflog.title", folderName(repo));
    panel.reveal(vscode.ViewColumn.Active);
    watcher.start(repo);
    openPending = true;
    void load(false);
  };

  const received = panel.webview.onDidReceiveMessage((message: ReflogWebviewMessage) => {
    if (message.command === "ready") {
      // Also after a reload or a restore: the new document needs the data.
      ready = true;
      if (last !== undefined) void panel.webview.postMessage(last);
      else if (pending !== undefined) void panel.webview.postMessage(pending);
    } else if (message.command === "loadMore") {
      void load(true);
    } else if (message.command === "refresh") {
      void load(false, refreshLimit());
    } else if (message.command === "query") {
      // The webview is a boundary: only a picker-shaped query is acted
      // on, and asking for what is already shown reloads nothing.
      const next = normalizeReflogQuery(message.query);
      if (reflogQueriesEqual(next, query)) return;
      query = next;
      loadedCount = 0;
      void load(false);
    }
  });
  // The tab follows the graph's two display settings live: a change
  // reloads the rows on screen (the loaded pages are kept, as a watcher
  // refresh keeps them) with the settings read fresh.
  const settings = vscode.workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration("git-graph-libre.shortHashLength") ||
      event.affectsConfiguration("git-graph-libre.dateFormat")
    ) {
      void load(false, refreshLimit());
    }
  });
  // The tab closes with its repository (F1-08): a removal drops the
  // repository from every surface, this one included. Disposing runs
  // the cleanup below, so no handle the reads opened outlives it.
  deps.repoManager?.registerRepoRemovedCallback((removed) => {
    if (removed === repo && !disposed) panel.dispose();
  });
  panel.onDidDispose(() => {
    disposed = true;
    received.dispose();
    settings.dispose();
    watcher.stop();
    deps.repoManager?.deregisterRepoRemovedCallback();
    source?.releaseWorktrees?.();
    if (current === show) current = undefined;
  });
  return show;
}

/**
 * The graph's display settings for one load, through the same validated
 * `config` accessors and bundle keys the graph's boot config reads
 * (`webviewHtml.ts`, `webviewL10n.ts`).
 */
function readDisplay(): ReflogDisplay {
  return {
    shortHashLength: config.shortHashLength(),
    dateFormat: config.dateFormat(),
    datePattern: l10n.t("time.dateformat"),
    needMonthName: l10n.t("time.needFormatMonth") === "true",
    months: [
      l10n.t("month.jan"),
      l10n.t("month.feb"),
      l10n.t("month.mar"),
      l10n.t("month.apr"),
      l10n.t("month.may"),
      l10n.t("month.jun"),
      l10n.t("month.jul"),
      l10n.t("month.aug"),
      l10n.t("month.sep"),
      l10n.t("month.oct"),
      l10n.t("month.nov"),
      l10n.t("month.dec")
    ]
  };
}

function readLabels(): ReflogLabels {
  return {
    title: l10n.t("reflog.title"),
    loading: l10n.t("reflog.loading"),
    loadMore: l10n.t("reflog.loadMore"),
    empty: l10n.t("reflog.empty"),
    loadError: l10n.t("reflog.loadError"),
    searchPlaceholder: l10n.t("reflog.searchPlaceholder"),
    filterRef: l10n.t("reflog.filter.ref"),
    filterAllActions: l10n.t("reflog.filter.allActions"),
    noMatches: l10n.t("reflog.noMatches"),
    searchCapped: l10n.t("reflog.searchCapped"),
    onlyInReflog: l10n.t("reflog.onlyInReflog"),
    objectMissing: l10n.t("reflog.objectMissing"),
    bareHeadNote: l10n.t("reflog.bareHeadNote"),
    worktreeHead: l10n.t("ui.worktreeHead"),
    worktreeLocked: l10n.t("ui.worktreeLocked"),
    worktreeLockedNoReason: l10n.t("ui.worktreeLockedNoReason"),
    worktreeMissing: l10n.t("ui.worktreeMissing"),
    columnIndex: l10n.t("reflog.column.index"),
    columnAction: l10n.t("reflog.column.action"),
    columnSubAction: l10n.t("reflog.column.subAction"),
    columnMessage: l10n.t("reflog.column.message"),
    columnCommit: l10n.t("ui.commit"),
    columnDate: l10n.t("ui.date"),
    columnState: l10n.t("reflog.column.state"),
    actions: Object.fromEntries(
      REFLOG_ACTION_KINDS.map((kind) => [kind, l10n.t(`reflog.action.${kind}`)])
    ),
    subActions: Object.fromEntries(
      REFLOG_SUB_ACTIONS.map((sub) => [sub, l10n.t(`reflog.sub.${sub}`)])
    )
  };
}
