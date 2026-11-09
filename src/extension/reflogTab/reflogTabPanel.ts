import * as vscode from "vscode";

import { DEFAULT_REFLOG_PAGE_SIZE, MAX_REFLOG_PAGE_SIZE } from "@/backend/queries/reflog";
import { buildExtensionUri } from "@/backend/utils/path";
import * as l10n from "@/l10n";
import {
  REFLOG_ACTION_KINDS,
  REFLOG_SUB_ACTIONS,
  type ReflogDataMessage,
  type ReflogLabels,
  type ReflogLoadingMessage,
  type ReflogPage,
  type ReflogSource,
  type ReflogWebviewMessage
} from "@/reflogTabTypes";
import { RepoFileWatcher } from "@/repoFileWatcher";

import { buildReflogTabHtml } from "./reflogTabHtml";

/** The file watcher's part the panel uses; tests substitute their own. */
export type ReflogWatcher = Pick<RepoFileWatcher, "start" | "stop">;

export type ReflogTabDeps = {
  extensionPath: string;
  outputChannel: Pick<vscode.OutputChannel, "appendLine">;
  /** Creates the repository watcher; defaults to the graph's `RepoFileWatcher`. */
  createWatcher?: (onRefresh: () => void) => ReflogWatcher;
  /** Display language for the webview's relative times; defaults to the editor's. */
  locale?: string;
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
    error: error instanceof Error ? error.message : String(error)
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

  let ready = false;
  let disposed = false;
  let last: ReflogDataMessage | undefined;
  let pending: ReflogLoadingMessage | undefined;
  let latestRequest = 0;
  let repo = "";
  let source: ReflogSource | undefined;
  let loadedCount = 0;

  /** A refresh keeps the rows already loaded, up to one bounded read. */
  const refreshLimit = (): number =>
    Math.min(Math.max(loadedCount, DEFAULT_REFLOG_PAGE_SIZE), MAX_REFLOG_PAGE_SIZE);

  const load = async (append: boolean, limit = DEFAULT_REFLOG_PAGE_SIZE): Promise<void> => {
    if (source === undefined || repo === "") return;
    const requestId = ++latestRequest;
    if (!append) {
      pending = {
        command: "reflogLoading",
        requestId,
        repo,
        locale: deps.locale ?? vscode.env.language,
        labels: readLabels()
      };
      if (ready) void panel.webview.postMessage(pending);
    }
    const offset = append ? loadedCount : 0;
    const page = await source.loadPage(repo, offset, limit).catch(failedPage);
    // A newer load (a watcher refresh, a retargeted tab) supersedes this
    // one: its reply is dropped here, and the webview drops by request id
    // anything that still slips through.
    if (disposed || requestId !== latestRequest) return;
    pending = undefined;
    if (page.error === null) {
      loadedCount = append ? loadedCount + page.rows.length : page.rows.length;
    }
    last = {
      command: "reflogData",
      requestId,
      append,
      repo,
      locale: deps.locale ?? vscode.env.language,
      labels: readLabels(),
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
    repo = nextRepo;
    source = nextSource;
    loadedCount = 0;
    panel.title = l10n.t("reflog.title", folderName(repo));
    panel.reveal(vscode.ViewColumn.Active);
    watcher.start(repo);
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
    }
  });
  panel.onDidDispose(() => {
    disposed = true;
    received.dispose();
    watcher.stop();
    if (current === show) current = undefined;
  });
  return show;
}

function readLabels(): ReflogLabels {
  return {
    title: l10n.t("reflog.title"),
    loading: l10n.t("reflog.loading"),
    loadMore: l10n.t("reflog.loadMore"),
    empty: l10n.t("reflog.empty"),
    loadError: l10n.t("reflog.loadError"),
    onlyInReflog: l10n.t("reflog.onlyInReflog"),
    objectMissing: l10n.t("reflog.objectMissing"),
    columnIndex: l10n.t("reflog.column.index"),
    columnAction: l10n.t("reflog.column.action"),
    columnSubAction: l10n.t("reflog.column.subAction"),
    columnMessage: l10n.t("reflog.column.message"),
    columnHash: l10n.t("reflog.column.hash"),
    columnTime: l10n.t("reflog.column.time"),
    columnState: l10n.t("reflog.column.state"),
    actions: Object.fromEntries(
      REFLOG_ACTION_KINDS.map((kind) => [kind, l10n.t(`reflog.action.${kind}`)])
    ),
    subActions: Object.fromEntries(
      REFLOG_SUB_ACTIONS.map((sub) => [sub, l10n.t(`reflog.sub.${sub}`)])
    )
  };
}
