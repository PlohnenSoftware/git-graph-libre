import * as vscode from "vscode";

import { DEFAULT_REFLOG_PAGE_SIZE, MAX_REFLOG_PAGE_SIZE } from "@/backend/queries/reflog";
import { buildExtensionUri } from "@/backend/utils/path";
import { config } from "@/config";
import type { RepoManager } from "@/extension/repoManager";
import { copyToClipboard } from "@/extension/utils/clipboard";
import { showCommitInGraph } from "@/extension/webviewPanel";
import * as l10n from "@/l10n";
import {
  defaultReflogQuery,
  defaultRefOptions,
  normalizeReflogQuery,
  normalizeReflogRecoveryAction,
  REFLOG_ACTION_KINDS,
  REFLOG_SUB_ACTIONS,
  type ReflogActionResultMessage,
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

import { createLostCommitsController } from "./lostCommitsController";
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
   * The repository manager's removal hook (F1-08) and per-repository
   * settings (F1-06 "Show in Graph"). Absent in tests that do not remove
   * repositories or inspect settings.
   */
  repoManager?: Pick<RepoManager, "registerRepoRemovedCallback" | "deregisterRepoRemovedCallback"> &
    Partial<Pick<RepoManager, "getRepos" | "setRepoState">>;
  /** Prompts for a branch name when recovering a lost commit (F1-07); defaults to `vscode.window.showInputBox`. */
  promptBranchName?: (options: vscode.InputBoxOptions) => Thenable<string | undefined>;
  /** Writes text to the clipboard (F1-06 "Copy Hash"); defaults to VS Code's. */
  copyText?: (text: string) => Promise<boolean>;
  /**
   * Reveals a commit in the graph tab (F1-06 "Show in Graph"); defaults
   * to the open graph panel.
   */
  showInGraph?: (repo: string, commitHash: string, enableIncludeReflog: boolean) => void;
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

  const displayRepoFor = (activeRepo: string, activeQuery: ReflogQuery): string =>
    activeQuery.worktreePath !== null &&
    deps.repoManager?.getRepos?.()[activeQuery.worktreePath] !== undefined
      ? activeQuery.worktreePath
      : activeRepo;

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
        display: readDisplay(displayRepoFor(activeRepo, activeQuery), deps)
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
      display: readDisplay(displayRepoFor(activeRepo, activeQuery), deps),
      page
    };
    if (ready) void panel.webview.postMessage(last);
  };

  const runRecoveryAction = async (raw: unknown): Promise<void> => {
    const action = normalizeReflogRecoveryAction(raw);
    if (action === null || source?.runAction === undefined || repo === "") return;
    const activeRepo = repo;
    const result = await source.runAction(activeRepo, action);
    if (disposed) return;
    if (ready) {
      const reply: ReflogActionResultMessage = {
        command: "reflogActionResult",
        action: action.kind,
        error: result.error
      };
      void panel.webview.postMessage(reply);
    }
    if (result.error === null && repo === activeRepo) {
      void load(false, refreshLimit());
    }
  };

  const copyCommitHash = async (rawHash: unknown): Promise<void> => {
    if (typeof rawHash !== "string" || !/^[0-9a-f]{4,64}$/i.test(rawHash)) return;
    const ok = await (deps.copyText ?? copyToClipboard)(rawHash);
    if (disposed || ok || !ready) return;
    const reply: ReflogActionResultMessage = {
      command: "reflogActionResult",
      action: "copyHash",
      error: l10n.t("error.unableToCopyToClipboard", l10n.t("type.commitHash"))
    };
    void panel.webview.postMessage(reply);
  };

  const revealInGraph = (rawHash: unknown, rawEnable: unknown): void => {
    if (repo === "" || typeof rawHash !== "string" || !/^[0-9a-f]{4,64}$/i.test(rawHash)) return;
    const enableIncludeReflog = rawEnable === true;
    const targetRepo = displayRepoFor(repo, query);
    if (enableIncludeReflog) {
      const existing = deps.repoManager?.getRepos?.()[targetRepo];
      if (existing !== undefined) {
        deps.repoManager?.setRepoState?.(targetRepo, { ...existing, includeReflog: "enabled" });
      }
      if (last !== undefined) {
        last = { ...last, display: readDisplay(targetRepo, deps) };
        if (ready) void panel.webview.postMessage(last);
      }
    }
    if (deps.showInGraph !== undefined) {
      deps.showInGraph(targetRepo, rawHash, enableIncludeReflog);
      return;
    }
    if (!showCommitInGraph(targetRepo, rawHash, enableIncludeReflog)) {
      void Promise.resolve(
        vscode.commands.executeCommand("git-graph-libre.view", {
          rootUri: { fsPath: targetRepo }
        })
      ).then(() => {
        showCommitInGraph(targetRepo, rawHash, enableIncludeReflog);
      });
    }
  };

  // The panel follows the repository the way the graph does: the same
  // watcher, its refresh arriving as fresh data over the retained document.
  const watcher = (deps.createWatcher ?? ((onRefresh) => new RepoFileWatcher(onRefresh)))(() => {
    deps.outputChannel.appendLine(`[reflogTab] refresh repo=${repo}`);
    void load(false, refreshLimit());
  });

  const lostCommits = createLostCommitsController({
    post: (message) => {
      if (ready) void panel.webview.postMessage(message);
    },
    promptBranchName: deps.promptBranchName,
    onBranchCreated: () => {
      void load(false, refreshLimit());
    }
  });

  const show = (nextRepo: string, nextSource: ReflogSource): void => {
    // A kept query could name a branch the new repository does not have.
    if (nextRepo !== repo) {
      // The tab follows the switch: the old source lets go of any other
      // worktree it read (F1-08), any in-flight lost-commit scan stops
      // (F1-07), and the query starts over.
      source?.releaseWorktrees?.();
      lostCommits.reset(nextRepo);
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
      lostCommits.postCurrent();
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
    } else if (message.command === "scanLostCommits") {
      void lostCommits.startScan(repo, source);
    } else if (message.command === "cancelLostCommitsScan") {
      lostCommits.cancelScan(repo);
    } else if (message.command === "closeLostCommits") {
      lostCommits.close(repo);
    } else if (message.command === "createLostCommitBranch") {
      void lostCommits.createBranchHere(repo, source, message.hash);
    } else if (message.command === "action") {
      void runRecoveryAction(message.action);
    } else if (message.command === "copyHash") {
      void copyCommitHash(message.hash);
    } else if (message.command === "showInGraph") {
      revealInGraph(message.hash, message.enableIncludeReflog);
    }
  });
  // The tab follows the graph's display settings and `includeReflog` live: a
  // change reloads the rows on screen (the loaded pages are kept, as a watcher
  // refresh keeps them) with the settings read fresh.
  const settings = vscode.workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration("git-graph-libre.shortHashLength") ||
      event.affectsConfiguration("git-graph-libre.dateFormat") ||
      event.affectsConfiguration("git-graph-libre.repository.includeReflog")
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
    lostCommits.dispose();
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
function readDisplay(activeRepo: string, deps: ReflogTabDeps): ReflogDisplay {
  const override = deps.repoManager?.getRepos?.()[activeRepo]?.includeReflog;
  const includeReflog =
    override === "enabled" ? true : override === "disabled" ? false : config.includeReflog();
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
    ],
    includeReflog
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
    ),
    lostCommits: {
      scan: l10n.t("reflog.lostCommits.scan"),
      rescan: l10n.t("reflog.lostCommits.rescan"),
      close: l10n.t("reflog.lostCommits.close"),
      cancel: l10n.t("dialog.cancel"),
      title: l10n.t("reflog.lostCommits.title"),
      scanning: l10n.t("reflog.lostCommits.scanning"),
      gcNote: l10n.t("reflog.lostCommits.gcNote"),
      empty: l10n.t("reflog.lostCommits.empty"),
      canceled: l10n.t("reflog.lostCommits.canceled"),
      timedOut: l10n.t("reflog.lostCommits.timedOut"),
      error: l10n.t("reflog.lostCommits.error"),
      createBranch: l10n.t("reflog.lostCommits.createBranch")
    },
    menuCreateBranch: l10n.t("reflog.menu.createBranch"),
    menuCreateTag: l10n.t("reflog.menu.createTag"),
    menuCheckoutDetached: l10n.t("reflog.menu.checkoutDetached"),
    menuCopyHash: l10n.t("reflog.menu.copyHash"),
    menuShowInGraph: l10n.t("reflog.menu.showInGraph"),
    menuResetBranch: l10n.t("reflog.menu.resetBranch"),
    menuMissingNote: l10n.t("reflog.menu.missingNote"),
    dialogCreateBranchTitle: l10n.t("dialog.createBranch.title"),
    dialogCreateBranchSubmit: l10n.t("dialog.createBranch.submit"),
    dialogAddTagTitle: l10n.t("dialog.addTag.title"),
    dialogAddTagName: l10n.t("dialog.addTag.name"),
    dialogAddTagType: l10n.t("dialog.addTag.type"),
    dialogAddTagMessage: l10n.t("dialog.addTag.message"),
    dialogAddTagTypeAnnotated: l10n.t("dialog.addTag.typeAnnotated"),
    dialogAddTagTypeLightweight: l10n.t("dialog.addTag.typeLightweight"),
    dialogAddTagLightweightNote: l10n.t("dialog.addTag.lightweightNote"),
    dialogAddTagOptional: l10n.t("dialog.addTag.optional"),
    dialogAddTagSubmit: l10n.t("dialog.addTag.submit"),
    dialogCheckoutConfirm: l10n.t("dialog.checkout.confirm"),
    dialogResetConfirm: l10n.t("dialog.reset.confirm"),
    labelCurrentBranch: l10n.t("label.currentBranch"),
    dialogResetSoft: l10n.t("dialog.reset.soft"),
    dialogResetMixed: l10n.t("dialog.reset.mixed"),
    dialogResetHard: l10n.t("dialog.reset.hard"),
    dialogYesReset: l10n.t("dialog.yesReset"),
    dialogResetHardConfirm: l10n.t("reflog.resetHard.confirm"),
    dialogShowInGraphConfirm: l10n.t("reflog.showInGraph.confirm"),
    dialogShowInGraphNote: l10n.t("reflog.showInGraph.note"),
    dialogShowInGraphSubmit: l10n.t("reflog.showInGraph.submit"),
    dialogYes: l10n.t("dialog.yes"),
    dialogCancel: l10n.t("dialog.cancel"),
    dialogDismiss: l10n.t("dialog.dismiss"),
    errorInvalidCharacters: l10n.t("error.invalidCharacters"),
    errorUnableToCreateBranch: l10n.t("error.unableToCreateBranch"),
    errorUnableToAddTag: l10n.t("error.unableToAddTag"),
    errorUnableToCheckoutCommit: l10n.t("error.unableToCheckoutCommit"),
    errorUnableToReset: l10n.t("error.unableToReset"),
    errorUnableToCopyToClipboard: l10n.t("error.unableToCopyToClipboard"),
    typeCommitHash: l10n.t("type.commitHash")
  };
}
