import path from "node:path";

import * as vscode from "vscode";

import { buildExtensionUri, getPathFromStr } from "@/backend/utils/path";
import type {
  BlameDataMessage,
  BlameDisplay,
  BlameLabels,
  BlameLoadingMessage,
  BlameOpenTarget,
  BlamePayload,
  BlameRepoMeta,
  BlameSource,
  BlameTypography,
  BlameWebviewMessage
} from "@/blameTabTypes";
import { config } from "@/config";
import * as l10n from "@/l10n";
import { RepoFileWatcher } from "@/repoFileWatcher";
import type { TelemetryReporter } from "@/telemetry";
import { createTabOpenReporter, TAB_FEATURE_BLAME } from "@/telemetry/tabOpen";

import { isBareCommonDir, worktreeGroupOf } from "../repoLayout";
import { buildBlameTabHtml } from "./blameTabHtml";

/** The file watcher's part the panel uses; tests substitute their own. */
export type BlameWatcher = Pick<RepoFileWatcher, "start" | "stop">;

export type BlameTabDeps = {
  extensionPath: string;
  outputChannel: Pick<vscode.OutputChannel, "appendLine">;
  /** Display language for the webview's relative times; defaults to the editor's. */
  locale?: string;
  /** Reports each open's outcome, once (T1b); see `src/telemetry/tabOpen.ts`. */
  telemetry?: Pick<TelemetryReporter, "logFeature">;
  /** Creates the repository watcher; defaults to the graph's `RepoFileWatcher`. */
  createWatcher?: (onRefresh: () => void) => BlameWatcher;
  /** Opens a working-tree file in VS Code's editor; defaults to `openTextDocument` + `showTextDocument`. */
  openFile?: (filePath: string) => Thenable<unknown>;
  /**
   * Reads whether an open editor holds unsaved changes for `fsPath`, so live
   * refreshes stay on the live buffer until the document is saved (BQ6).
   */
  readOpenDocument?: (fsPath: string) => { dirty: boolean; text: string } | null;
};

// One tab at a time, reused like the GGL Diff tab and the Reflog tab.
let current: ReturnType<typeof createBlameTab> | undefined;

/**
 * Open the Blame tab for `target`, or reveal and retarget the one already
 * open. The blame loads now, alongside the webview's start-up, and is
 * posted once both are done.
 */
export function openBlameTab(
  target: BlameOpenTarget,
  source: BlameSource,
  deps: BlameTabDeps
): void {
  current ??= createBlameTab(deps);
  current(target, source);
}

function fileName(filePath: string): string {
  return filePath.split("/").at(-1) || filePath;
}

function failedPayload(error: unknown): BlamePayload {
  return {
    state: null,
    commits: {},
    hunks: [],
    resolvedRev: null,
    totalLines: 0,
    error: error instanceof Error ? error.message : String(error)
  };
}

/** A target line the tab may act on: a whole 1-based line, or none. */
function normalizeTargetLine(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

/** Auto-refresh applies only to working-tree and HEAD blames, never pinned commits. */
function isAutoRefreshRev(rev: string | null): boolean {
  return rev === null || rev === "HEAD";
}

function readRepoMeta(repo: string): BlameRepoMeta {
  if (repo === "") return { linkedWorktree: false, bare: false };
  const bare = isBareCommonDir(repo);
  const linkedWorktree = !bare && worktreeGroupOf(repo).linked;
  return { linkedWorktree, bare };
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 1 && value[end - 1] === "/") end -= 1;
  return end === value.length ? value : value.slice(0, end);
}

function targetDiskPath(repo: string, filePath: string): string {
  return `${trimTrailingSlashes(getPathFromStr(repo))}/${filePath}`;
}

function resolveTargetFsPath(repo: string, filePath: string): string | null {
  if (repo === "" || filePath === "" || filePath.includes("\0")) return null;
  const root = path.resolve(repo);
  const resolved = path.resolve(repo, ...filePath.split("/"));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

function defaultCreateWatcher(onRefresh: () => void): BlameWatcher {
  if (typeof vscode.workspace.createFileSystemWatcher !== "function") {
    return { start: () => {}, stop: () => {} };
  }
  return new RepoFileWatcher(onRefresh);
}

async function defaultOpenFile(filePath: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(document, { preview: false });
}

function defaultReadOpenDocument(fsPath: string): { dirty: boolean; text: string } | null {
  const normalized = getPathFromStr(fsPath);
  const docs = vscode.workspace.textDocuments ?? [];
  const doc = docs.find(
    (entry) => entry.uri.scheme === "file" && getPathFromStr(entry.uri.fsPath) === normalized
  );
  if (doc === undefined) return null;
  return { dirty: doc.isDirty, text: doc.isDirty ? doc.getText() : "" };
}

function createBlameTab(deps: BlameTabDeps) {
  // `retainContextWhenHidden` keeps the document alive while its tab is in
  // the background, so a refresh is one message, never a document reload.
  const panel = vscode.window.createWebviewPanel(
    "git-graph-libre.blameTab",
    l10n.t("blame.title", ""),
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
  panel.webview.html = buildBlameTabHtml(panel.webview, deps.extensionPath);
  const reportOpen = createTabOpenReporter(deps.telemetry, TAB_FEATURE_BLAME);
  const readOpenDocument = deps.readOpenDocument ?? defaultReadOpenDocument;

  let ready = false;
  let disposed = false;
  let last: BlameDataMessage | undefined;
  let pending: BlameLoadingMessage | undefined;
  let latestRequest = 0;
  // Set by each open (`show`) and cleared once the open's outcome is sent,
  // so one open reports exactly once, whichever load settles it.
  let opening = false;
  let repoMeta: BlameRepoMeta = { linkedWorktree: false, bare: false };
  let repoChanged = false;
  let watchedRepo = "";
  let target: Required<Pick<BlameOpenTarget, "repo" | "filePath">> & {
    rev: string | null;
    targetLine: number | null;
    contents: string | undefined;
  } = { repo: "", filePath: "", rev: null, targetLine: null, contents: undefined };
  let source: BlameSource | undefined;

  const echo = (): Omit<BlameDataMessage, "command" | "requestId" | "payload"> => ({
    repo: target.repo,
    filePath: target.filePath,
    rev: target.rev,
    targetLine: target.targetLine,
    locale: deps.locale ?? vscode.env.language,
    labels: readLabels(),
    display: readDisplay(),
    typography: readTypography(),
    unsavedBuffer: target.contents !== undefined,
    repoMeta,
    repoChanged
  });

  const syncOpenContents = (): void => {
    if (target.rev !== null || repoMeta.bare || target.repo === "" || target.filePath === "") {
      return;
    }
    const open = readOpenDocument(targetDiskPath(target.repo, target.filePath));
    if (open !== null) {
      target = { ...target, contents: open.dirty ? open.text : undefined };
    }
  };

  const load = async (preserveScroll = false): Promise<void> => {
    if (source === undefined || target.repo === "" || target.filePath === "") return;
    const activeSource = source;
    const activeTarget = target;
    const requestId = ++latestRequest;
    if (!preserveScroll) {
      pending = { command: "blameLoading", requestId, ...echo() };
      if (ready) void panel.webview.postMessage(pending);
    }
    const loadOptions =
      activeTarget.contents !== undefined ? { contents: activeTarget.contents } : undefined;
    const payload = await activeSource
      .load(activeTarget.repo, activeTarget.filePath, activeTarget.rev, loadOptions)
      .catch(failedPayload);
    // A newer load (a retargeted tab, a settings refresh) supersedes this
    // one: its reply is dropped here, and the webview drops by request id
    // anything that still slips through.
    if (disposed || requestId !== latestRequest) return;
    pending = undefined;
    last = { command: "blameData", requestId, ...echo(), preserveScroll, payload };
    if (ready) void panel.webview.postMessage(last);
    // The open's outcome is the first settled load after it (T1b). A refresh
    // or a settings reload after that reports nothing.
    if (opening) {
      opening = false;
      reportOpen(payload.error === null);
    }
  };

  // Follow repository changes live for working-tree and HEAD blames, while
  // keeping pinned historical commits undisturbed until the user asks.
  const watcher = (deps.createWatcher ?? defaultCreateWatcher)(() => {
    if (disposed || source === undefined || target.repo === "" || target.filePath === "") return;
    if (isAutoRefreshRev(target.rev)) {
      deps.outputChannel.appendLine(`[blameTab] refresh repo=${target.repo}`);
      syncOpenContents();
      void load(true);
      return;
    }
    repoChanged = true;
    if (last !== undefined) last = { ...last, repoChanged: true };
    if (ready) void panel.webview.postMessage({ command: "blameRepoChanged", repo: target.repo });
  });

  const show = (next: BlameOpenTarget, nextSource: BlameSource): void => {
    repoMeta = readRepoMeta(next.repo);
    repoChanged = false;
    target = {
      repo: next.repo,
      filePath: next.filePath,
      rev: next.rev ?? null,
      targetLine: normalizeTargetLine(next.targetLine),
      contents: next.contents
    };
    source = nextSource;
    // The next settled load is this open's outcome.
    opening = true;
    panel.title = l10n.t("blame.title", fileName(target.filePath));
    panel.reveal(vscode.ViewColumn.Active);
    if (watchedRepo !== target.repo) {
      watchedRepo = target.repo;
      watcher.start(target.repo);
    }
    void load(false);
  };

  const openTargetFile = (): void => {
    if (repoMeta.bare) return;
    const fsPath = resolveTargetFsPath(target.repo, target.filePath);
    if (fsPath === null) return;
    const opener = deps.openFile ?? defaultOpenFile;
    void Promise.resolve(opener(fsPath)).catch((error: unknown) => {
      deps.outputChannel.appendLine(`[blameTab] openFile failed: ${String(error)}`);
    });
  };

  const received = panel.webview.onDidReceiveMessage((message: BlameWebviewMessage) => {
    if (message.command === "ready") {
      // Also after a reload or a restore: the new document needs the data.
      ready = true;
      if (last !== undefined) void panel.webview.postMessage(last);
      else if (pending !== undefined) void panel.webview.postMessage(pending);
    } else if (message.command === "refresh") {
      repoChanged = false;
      syncOpenContents();
      void load(true);
    } else if (message.command === "blameHead") {
      target = { ...target, rev: "HEAD", contents: undefined };
      repoChanged = false;
      void load(true);
    } else if (message.command === "blameLatest") {
      target = { ...target, rev: repoMeta.bare ? "HEAD" : null, contents: undefined };
      repoChanged = false;
      syncOpenContents();
      void load(true);
    } else if (message.command === "openFile") {
      openTargetFile();
    }
  });
  // Saving the blamed file clears the unsaved-buffer pill and refreshes onto
  // the saved working tree without touching pinned historical revisions.
  const saved = vscode.workspace.onDidSaveTextDocument?.((document) => {
    if (
      disposed ||
      target.rev !== null ||
      document.uri.scheme !== "file" ||
      target.repo === "" ||
      target.filePath === ""
    ) {
      return;
    }
    if (getPathFromStr(document.uri.fsPath) !== targetDiskPath(target.repo, target.filePath)) {
      return;
    }
    target = { ...target, contents: undefined };
    void load(true);
  });
  // The tab follows the graph's display settings and the editor's
  // typography live: a change reloads the file on screen with the
  // settings read fresh, over the retained document.
  const settings = vscode.workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration("git-graph-libre.shortHashLength") ||
      event.affectsConfiguration("git-graph-libre.dateFormat") ||
      event.affectsConfiguration("editor.fontSize") ||
      event.affectsConfiguration("editor.lineHeight") ||
      event.affectsConfiguration("editor.tabSize")
    ) {
      void load(true);
    }
  });
  panel.onDidDispose(() => {
    disposed = true;
    received.dispose();
    settings.dispose();
    saved?.dispose();
    watcher.stop();
    if (current === show) current = undefined;
  });
  return show;
}

/**
 * The graph's display settings for one load, through the same validated
 * `config` accessors and bundle keys the graph's boot config reads
 * (`webviewHtml.ts`, `webviewL10n.ts`).
 */
function readDisplay(): BlameDisplay {
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

/**
 * The editor typography for one load, read the way the GGL Diff tab
 * reads it (`diffTabPanel.ts`): `editor.fontSize`, `editor.lineHeight`
 * resolved to pixels, and `editor.tabSize`.
 */
function readTypography(): BlameTypography {
  const editor = vscode.workspace.getConfiguration("editor");
  const count = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  const editorCount = (key: string, fallback: number): number => count(editor.get(key), fallback);
  const fontSize = Math.max(1, editorCount("fontSize", 14));
  return {
    fontSize,
    lineHeight: lineHeightInPixels(editorCount("lineHeight", 0), fontSize),
    tabSize: Math.max(1, Math.floor(editorCount("tabSize", 4)))
  };
}

/**
 * `editor.lineHeight` in pixels, by the GGL Diff tab's rule
 * (`diffTabPanel.ts`): 0 derives it from the font size at × 1.5, values
 * below 8 multiply the font size, and a line is never under 8 pixels.
 */
function lineHeightInPixels(lineHeight: number, fontSize: number): number {
  let pixels = lineHeight;
  if (lineHeight === 0) {
    pixels = fontSize * 1.5;
  } else if (lineHeight < 8) {
    pixels = lineHeight * fontSize;
  }
  return Math.max(8, Math.round(pixels));
}

function readLabels(): BlameLabels {
  return {
    title: l10n.t("blame.title"),
    loading: l10n.t("blame.loading"),
    empty: l10n.t("blame.empty"),
    binary: l10n.t("blame.binary"),
    tooLarge: l10n.t("blame.tooLarge"),
    untracked: l10n.t("blame.untracked"),
    unborn: l10n.t("blame.unborn"),
    loadError: l10n.t("blame.loadError"),
    workingTree: l10n.t("blame.workingTree"),
    uncommitted: l10n.t("blame.uncommitted"),
    lineCount: l10n.t("blame.lineCount"),
    resizeGutter: l10n.t("blame.resizeGutter"),
    columnCommit: l10n.t("ui.commit"),
    columnDate: l10n.t("ui.date"),
    heatMode: l10n.t("blame.heatMode"),
    heatLegend: l10n.t("blame.heatLegend"),
    heatOlder: l10n.t("blame.heatOlder"),
    heatNewer: l10n.t("blame.heatNewer"),
    heatAge: l10n.t("blame.heatAge"),
    heatCalendar: l10n.t("blame.heatCalendar"),
    heatChurn: l10n.t("blame.heatChurn"),
    heatOff: l10n.t("blame.heatOff"),
    unsavedBuffer: l10n.t("blame.unsavedBuffer"),
    blameHead: l10n.t("blame.blameHead"),
    worktree: l10n.t("blame.worktree"),
    bare: l10n.t("ui.worktreeBadgeBare"),
    bareWorkingTree: l10n.t("blame.bareWorkingTree"),
    openFile: l10n.t("action.openFile"),
    repoChanged: l10n.t("blame.repoChanged"),
    viewLatest: l10n.t("blame.viewLatest")
  };
}
