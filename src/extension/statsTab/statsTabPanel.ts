import * as vscode from "vscode";

import { buildExtensionUri } from "@/backend/utils/path";
import * as l10n from "@/l10n";
import { RepoFileWatcher } from "@/repoFileWatcher";
import type {
  StatsDataMessage,
  StatsLabels,
  StatsLoadingMessage,
  StatsLoadResult,
  StatsSource,
  StatsWebviewMessage
} from "@/statsTabTypes";

import { buildStatsTabHtml } from "./statsTabHtml";

/** The file watcher's part the panel uses; tests substitute their own. */
export type StatsWatcher = Pick<RepoFileWatcher, "start" | "stop">;

export type StatsTabDeps = {
  extensionPath: string;
  outputChannel: Pick<vscode.OutputChannel, "appendLine">;
  /** Creates the repository watcher; defaults to the graph's `RepoFileWatcher`. */
  createWatcher?: (onRefresh: () => void) => StatsWatcher;
  /** Display language for the webview's numbers; defaults to the editor's. */
  locale?: string;
};

// One tab at a time, reused like the Reflog tab.
let current: ReturnType<typeof createStatsTab> | undefined;

/**
 * Open the Statistics tab for `repo`, or reveal and retarget the one
 * already open. The first load starts now, alongside the webview's
 * start-up, and is posted once both are done.
 */
export function openStatsTab(repo: string, source: StatsSource, deps: StatsTabDeps): void {
  current ??= createStatsTab(deps);
  current(repo, source);
}

function folderName(repo: string): string {
  return repo.split("/").at(-1) || repo;
}

/** A failed load is the `failed` unavailable answer, never an exception. */
function failedResult(): StatsLoadResult {
  return { state: "unavailable", reason: "failed" };
}

function createStatsTab(deps: StatsTabDeps) {
  // `retainContextWhenHidden` keeps the document alive while its tab is
  // in the background, so a refresh is one message, never a reload.
  const panel = vscode.window.createWebviewPanel(
    "git-graph-libre.statsTab",
    l10n.t("stats.title", ""),
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
  panel.webview.html = buildStatsTabHtml(panel.webview, deps.extensionPath);

  let ready = false;
  let disposed = false;
  let last: StatsDataMessage | undefined;
  let pending: StatsLoadingMessage | undefined;
  let latestRequest = 0;
  let repo = "";
  let source: StatsSource | undefined;
  // Each repository's last successful result (TQ6's cache; the engine
  // always reads every ref, so the repository is the ref set). Showing
  // the tab again serves it instead of reading afresh (TQ7); the
  // watcher below drops it when the repository changes, and the
  // webview's Refresh drops it on request. An unavailable answer is
  // never cached, so fixing the cause is picked up on the next open.
  const cache = new Map<string, StatsLoadResult>();

  const post = (): void => {
    if (!ready) return;
    if (last !== undefined) void panel.webview.postMessage(last);
    else if (pending !== undefined) void panel.webview.postMessage(pending);
  };

  const load = async (): Promise<void> => {
    if (source === undefined || repo === "") return;
    const activeSource = source;
    const activeRepo = repo;
    const requestId = ++latestRequest;
    pending = {
      command: "statsLoading",
      requestId,
      repo: activeRepo,
      locale: deps.locale ?? vscode.env.language,
      labels: readLabels()
    };
    post();
    const result = await activeSource.load(activeRepo).catch(failedResult);
    // A newer load (a watcher refresh, a retargeted tab) supersedes
    // this one: its reply is dropped here, and the webview drops by
    // request id anything that still slips through.
    if (disposed || requestId !== latestRequest) return;
    pending = undefined;
    if (result.state === "ok") cache.set(activeRepo, result);
    last = {
      command: "statsData",
      requestId,
      repo: activeRepo,
      locale: deps.locale ?? vscode.env.language,
      labels: readLabels(),
      result
    };
    post();
  };

  /** Serve a cached result as a fresh reply, with today's labels. */
  const serveCached = (result: StatsLoadResult): void => {
    const requestId = ++latestRequest;
    pending = undefined;
    last = {
      command: "statsData",
      requestId,
      repo,
      locale: deps.locale ?? vscode.env.language,
      labels: readLabels(),
      result
    };
    post();
  };

  // The panel follows the repository the way the graph does: the same
  // watcher, its refresh arriving as fresh data over the retained
  // document. A change invalidates the cache first (TQ7).
  const watcher = (deps.createWatcher ?? ((onRefresh) => new RepoFileWatcher(onRefresh)))(() => {
    deps.outputChannel.appendLine(`[statsTab] refresh repo=${repo}`);
    cache.delete(repo);
    void load();
  });

  const show = (nextRepo: string, nextSource: StatsSource): void => {
    repo = nextRepo;
    source = nextSource;
    panel.title = l10n.t("stats.title", folderName(repo));
    panel.reveal(vscode.ViewColumn.Active);
    watcher.start(repo);
    const cached = cache.get(repo);
    if (cached !== undefined) serveCached(cached);
    else void load();
  };

  const received = panel.webview.onDidReceiveMessage((message: StatsWebviewMessage) => {
    if (message.command === "ready") {
      // Also after a reload or a restore: the new document needs the data.
      ready = true;
      post();
    } else if (message.command === "refresh") {
      cache.delete(repo);
      void load();
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

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function readLabels(): StatsLabels {
  return {
    title: l10n.t("stats.title"),
    loading: l10n.t("stats.loading"),
    empty: l10n.t("stats.empty"),
    refresh: l10n.t("ui.refresh"),
    contributors: l10n.t("stats.contributors"),
    activity: l10n.t("stats.activity"),
    activityNote: l10n.t("stats.activityNote"),
    less: l10n.t("stats.less"),
    more: l10n.t("stats.more"),
    cellNone: l10n.t("stats.cellNone"),
    cellOne: l10n.t("stats.cellOne"),
    cellMany: l10n.t("stats.cellMany"),
    unavailable: l10n.t("stats.unavailable"),
    unavailableReasons: {
      noAddon: l10n.t("stats.unavailable.noAddon"),
      backendCli: l10n.t("stats.unavailable.backendCli"),
      notVerified: l10n.t("stats.unavailable.notVerified"),
      failed: l10n.t("stats.unavailable.failed")
    },
    weekdays: WEEKDAY_KEYS.map((day) => l10n.t(`stats.weekday.${day}`)),
    weekdaysShort: WEEKDAY_KEYS.map((day) => l10n.t(`stats.weekdayShort.${day}`))
  };
}
