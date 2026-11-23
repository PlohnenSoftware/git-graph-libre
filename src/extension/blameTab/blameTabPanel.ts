import path from "node:path";

import * as vscode from "vscode";

import { buildExtensionUri, getPathFromStr } from "@/backend/utils/path";
import { abbrevCommit } from "@/backend/utils/string";
import type {
  BlameCommitPopoverMessage,
  BlameDataMessage,
  BlameDisplay,
  BlameLabels,
  BlameLoadingMessage,
  BlameOpenCommitFileDiffMessage,
  BlameOpenTarget,
  BlamePayload,
  BlameRepoMeta,
  BlameSource,
  BlameTypography,
  BlameWebviewMessage
} from "@/blameTabTypes";
import { config } from "@/config";
import { encodeDiffDocUri } from "@/diffDocProvider";
import type { DiffTabRequest } from "@/diffTabTypes";
import { tabIconPaths } from "@/extension/tabIcon";
import { copyToClipboard } from "@/extension/utils/clipboard";
import * as l10n from "@/l10n";
import { RepoFileWatcher } from "@/repoFileWatcher";
import type { TelemetryReporter } from "@/telemetry";
import { createTabOpenReporter, TAB_FEATURE_BLAME } from "@/telemetry/tabOpen";
import type { IssueLinkingConfig } from "@/types";

import { isBareCommonDir, worktreeGroupOf } from "../repoLayout";
import { showCommitInGraph } from "../webviewPanel";
import { createBlameNavigator, isBlameCommitHash, normalizeBlameTargetLine } from "./blameData";
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
  /** Reveals a commit in the graph (F4-06); defaults to `showCommitInGraph`. */
  showInGraph?: (repo: string, commitHash: string) => void;
  /** Opens the GGL Diff tab (F4-06); absent or unavailable falls back to `vscode.diff`. */
  openDiffTab?: (request: DiffTabRequest) => void;
  /** Whether the GGL Diff tab can be fed; defaults to true when `openDiffTab` is given. */
  isDiffTabAvailable?: () => boolean;
  /** Copies text to the clipboard (F4-06); defaults to the host clipboard helper. */
  copyText?: (text: string) => Promise<boolean>;
  /** The cached avatar data URI for an email, or null (F4-06); absent shows none. */
  avatarFor?: (email: string) => Promise<string | null>;
  /** The repository's issue-linking config the graph linkifies with (F4-06). */
  issueLinkingFor?: (repo: string) => IssueLinkingConfig | null;
  /** Opens a working-tree file at a 0-based line (F4-06); defaults to the editor. */
  openFileAtLine?: (filePath: string, line: number) => Thenable<unknown>;
  /** Opens a file at a revision at a 0-based line (F4-06); defaults to `DiffDocProvider`. */
  openRevisionAtLine?: (
    repo: string,
    filePath: string,
    rev: string,
    line: number
  ) => Thenable<unknown>;
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

/** The graph reveal route (F1-06's): an open graph first, else open it and retry. */
function defaultShowInGraph(repo: string, commitHash: string): void {
  if (showCommitInGraph(repo, commitHash)) return;
  void Promise.resolve(
    vscode.commands.executeCommand("git-graph-libre.view", { rootUri: { fsPath: repo } })
  ).then(() => {
    showCommitInGraph(repo, commitHash);
  });
}

async function defaultOpenFileAtLine(filePath: string, line: number): Promise<void> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(document, {
    preview: false,
    selection: new vscode.Range(line, 0, line, 0)
  });
}

async function defaultOpenRevisionAtLine(
  repo: string,
  filePath: string,
  rev: string,
  line: number
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(encodeDiffDocUri(repo, filePath, rev));
  await vscode.window.showTextDocument(document, {
    preview: true,
    selection: new vscode.Range(line, 0, line, 0)
  });
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
  panel.iconPath = tabIconPaths(deps.extensionPath, config.tabIconColorTheme());
  panel.webview.html = buildBlameTabHtml(panel.webview, deps.extensionPath);
  const reportOpen = createTabOpenReporter(deps.telemetry, TAB_FEATURE_BLAME);
  const readOpenDocument = deps.readOpenDocument ?? defaultReadOpenDocument;
  const navigator = createBlameNavigator();

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
  // Unsaved editor text for the working-tree target (BQ6); only ever sent
  // while the navigator sits on the working tree (`rev === null`).
  let contents: string | undefined;
  let source: BlameSource | undefined;

  const echo = (): Omit<BlameDataMessage, "command" | "requestId" | "payload"> => {
    const snap = navigator.snapshot();
    return {
      repo: snap.repo,
      filePath: snap.filePath,
      rev: snap.rev,
      targetLine: snap.targetLine,
      locale: deps.locale ?? vscode.env.language,
      labels: readLabels(),
      display: readDisplay(),
      typography: readTypography(),
      unsavedBuffer: snap.rev === null && contents !== undefined,
      repoMeta,
      repoChanged,
      navigation: snap.navigation,
      options: snap.options,
      ignoreRevs: snap.ignoreRevs
    };
  };

  const syncOpenContents = (): void => {
    const snap = navigator.snapshot();
    if (snap.rev !== null || repoMeta.bare || snap.repo === "" || snap.filePath === "") {
      return;
    }
    const open = readOpenDocument(targetDiskPath(snap.repo, snap.filePath));
    if (open !== null) {
      contents = open.dirty ? open.text : undefined;
    }
  };

  // After a rewind or navigation the unsaved buffer only still applies on
  // the working tree; anywhere historical it is dropped, which also pins
  // the target so the watcher leaves it alone.
  const syncContentsForCurrent = (): void => {
    if (navigator.snapshot().rev === null) {
      syncOpenContents();
    } else {
      contents = undefined;
    }
    if (isAutoRefreshRev(navigator.snapshot().rev)) repoChanged = false;
  };

  const load = async (preserveScroll = false): Promise<void> => {
    const snap = navigator.snapshot();
    if (source === undefined || snap.repo === "" || snap.filePath === "") return;
    const activeSource = source;
    const requestId = ++latestRequest;
    panel.title = l10n.t("blame.title", fileName(snap.filePath));
    if (!preserveScroll) {
      pending = { command: "blameLoading", requestId, ...echo() };
      if (ready) void panel.webview.postMessage(pending);
    }
    const loadOptions = {
      ...snap.loadOptions,
      ...(snap.rev === null && contents !== undefined ? { contents } : {})
    };
    const payload = await activeSource
      .load(snap.repo, snap.filePath, snap.rev, loadOptions)
      .catch(failedPayload);
    // A newer load (a retargeted tab, a settings refresh) supersedes this
    // one: its reply is dropped here, and the webview drops by request id
    // anything that still slips through.
    if (disposed || requestId !== latestRequest) return;
    pending = undefined;
    last = { command: "blameData", requestId, ...echo(), preserveScroll, payload };
    if (ready) void panel.webview.postMessage(last);
    // The open's outcome is the first settled load after it (T1b). A refresh,
    // rewind, navigation or option change after that reports nothing.
    if (opening) {
      opening = false;
      reportOpen(payload.error === null);
    }
  };

  // Follow repository changes live for working-tree and HEAD blames, while
  // keeping pinned historical commits undisturbed until the user asks.
  const watcher = (deps.createWatcher ?? defaultCreateWatcher)(() => {
    const snap = navigator.snapshot();
    if (disposed || source === undefined || snap.repo === "" || snap.filePath === "") return;
    if (isAutoRefreshRev(snap.rev)) {
      deps.outputChannel.appendLine(`[blameTab] refresh repo=${snap.repo}`);
      syncOpenContents();
      void load(true);
      return;
    }
    repoChanged = true;
    if (last !== undefined) last = { ...last, repoChanged: true };
    if (ready) void panel.webview.postMessage({ command: "blameRepoChanged", repo: snap.repo });
  });

  const show = (next: BlameOpenTarget, nextSource: BlameSource): void => {
    repoMeta = readRepoMeta(next.repo);
    repoChanged = false;
    contents = next.contents;
    navigator.open(next);
    source = nextSource;
    // The next settled load is this open's outcome.
    opening = true;
    panel.title = l10n.t("blame.title", fileName(next.filePath));
    panel.reveal(vscode.ViewColumn.Active);
    if (watchedRepo !== next.repo) {
      watchedRepo = next.repo;
      watcher.start(next.repo);
    }
    void load(false);
  };

  const openTargetFile = (): void => {
    if (repoMeta.bare) return;
    const snap = navigator.snapshot();
    const fsPath = resolveTargetFsPath(snap.repo, snap.filePath);
    if (fsPath === null) return;
    const opener = deps.openFile ?? defaultOpenFile;
    void Promise.resolve(opener(fsPath)).catch((error: unknown) => {
      deps.outputChannel.appendLine(`[blameTab] openFile failed: ${String(error)}`);
    });
  };

  const logActionFailure = (action: string, error: unknown): void => {
    deps.outputChannel.appendLine(`[blameTab] ${action} failed: ${String(error)}`);
  };

  // The popover's details read (F4-06): the blame commit the webview
  // already shows covers author and dates; this adds the full message,
  // the cached avatar and the repo's issue-linking config.
  const replyCommitPopover = async (requestId: number, commitHash: string): Promise<void> => {
    const snap = navigator.snapshot();
    const base: Omit<BlameCommitPopoverMessage, "details" | "avatar" | "error"> = {
      command: "blameCommitPopover",
      requestId,
      commitHash,
      issueLinking: deps.issueLinkingFor?.(snap.repo) ?? null
    };
    if (
      !isBlameCommitHash(commitHash) ||
      snap.repo === "" ||
      source?.loadCommitPopover === undefined
    ) {
      if (!disposed) {
        void panel.webview.postMessage({
          ...base,
          details: null,
          avatar: null,
          error: `Not a commit hash: ${commitHash}`
        });
      }
      return;
    }
    const result = await source.loadCommitPopover(snap.repo, commitHash);
    if (disposed) return;
    const avatar =
      result.details === null
        ? null
        : await (deps.avatarFor?.(result.details.authorMail) ?? Promise.resolve(null)).catch(
            () => null
          );
    if (disposed) return;
    void panel.webview.postMessage({ ...base, ...result, avatar });
  };

  const revealInGraph = (commitHash: string): void => {
    const snap = navigator.snapshot();
    if (snap.repo === "" || !isBlameCommitHash(commitHash)) return;
    (deps.showInGraph ?? defaultShowInGraph)(snap.repo, commitHash);
  };

  // The diff title the commit details view uses for the same pair
  // (`diffTitleFor` in the message handler): hashes at the graph's own
  // length, "Added in …" when the commit created the file.
  const commitDiffTitle = (message: BlameOpenCommitFileDiffMessage): string => {
    const short = abbrevCommit(message.commitHash, config.shortHashLength());
    const sides =
      message.previousHash === null
        ? l10n.t("diff.addedIn", short)
        : `${abbrevCommit(message.previousHash, config.shortHashLength())} ↔ ${short}`;
    return `${fileName(message.filePath)} (${sides})`;
  };

  const openVscodeDiff = async (message: BlameOpenCommitFileDiffMessage): Promise<void> => {
    const snap = navigator.snapshot();
    await vscode.commands.executeCommand(
      "vscode.diff",
      encodeDiffDocUri(
        snap.repo,
        message.previousPath ?? message.filePath,
        message.previousHash ?? `${message.commitHash}^`
      ),
      encodeDiffDocUri(snap.repo, message.filePath, message.commitHash),
      commitDiffTitle(message),
      { preview: true }
    );
  };

  const openCommitDiff = (message: BlameOpenCommitFileDiffMessage): void => {
    const snap = navigator.snapshot();
    if (
      snap.repo === "" ||
      !isBlameCommitHash(message.commitHash) ||
      (message.previousHash !== null && !isBlameCommitHash(message.previousHash)) ||
      resolveTargetFsPath(snap.repo, message.filePath) === null ||
      (message.previousPath !== null &&
        resolveTargetFsPath(snap.repo, message.previousPath) === null)
    ) {
      return;
    }
    const diffTabAvailable =
      deps.openDiffTab !== undefined && (deps.isDiffTabAvailable?.() ?? true);
    if (!diffTabAvailable) {
      deps.outputChannel.appendLine("[blameTab] GGL Diff unavailable; falling back to vscode.diff");
      void openVscodeDiff(message).catch((error: unknown) => {
        logActionFailure("openCommitFileDiff", error);
      });
      return;
    }
    try {
      deps.openDiffTab?.({
        repo: snap.repo,
        left:
          message.previousHash === null
            ? { kind: "empty" }
            : {
                kind: "revision",
                ref: message.previousHash,
                path: message.previousPath ?? message.filePath
              },
        right: { kind: "revision", ref: message.commitHash, path: message.filePath },
        title: commitDiffTitle(message)
      });
    } catch (error: unknown) {
      logActionFailure("openCommitFileDiff", error);
    }
  };

  // Working-tree blames open the file on disk; a pinned revision opens
  // that revision's document, so the line the user clicked is the line
  // they land on either way (F4-06). Lines cross 1-based, open 0-based.
  const openAtLine = (rawLine: number): void => {
    const line = normalizeBlameTargetLine(rawLine);
    if (line === null) return;
    const snap = navigator.snapshot();
    if (snap.repo === "" || snap.filePath === "") return;
    if (snap.rev !== null) {
      const opener = deps.openRevisionAtLine ?? defaultOpenRevisionAtLine;
      void Promise.resolve(opener(snap.repo, snap.filePath, snap.rev, line - 1)).catch(
        (error: unknown) => {
          logActionFailure("openFileAtLine", error);
        }
      );
      return;
    }
    if (repoMeta.bare) return;
    const fsPath = resolveTargetFsPath(snap.repo, snap.filePath);
    if (fsPath === null) return;
    const opener = deps.openFileAtLine ?? defaultOpenFileAtLine;
    void Promise.resolve(opener(fsPath, line - 1)).catch((error: unknown) => {
      logActionFailure("openFileAtLine", error);
    });
  };

  const copyCommitText = async (kind: "hash" | "message", commitHash: string): Promise<void> => {
    const snap = navigator.snapshot();
    if (snap.repo === "" || !isBlameCommitHash(commitHash)) return;
    let text = commitHash;
    if (kind === "message") {
      if (source?.loadCommitPopover === undefined) return;
      const result = await source.loadCommitPopover(snap.repo, commitHash);
      if (result.details === null) {
        logActionFailure("copyText", result.error ?? "no commit details");
        return;
      }
      text = result.details.message;
    }
    const copied = await (deps.copyText ?? copyToClipboard)(text);
    if (!copied) logActionFailure("copyText", "clipboard write refused");
  };

  const handleMessage = (message: BlameWebviewMessage): void => {
    switch (message.command) {
      case "ready":
        // Also after a reload or a restore: the new document needs the data.
        ready = true;
        if (last !== undefined) void panel.webview.postMessage(last);
        else if (pending !== undefined) void panel.webview.postMessage(pending);
        return;
      case "refresh":
        repoChanged = false;
        syncOpenContents();
        void load(true);
        return;
      case "blameHead":
        if (navigator.blameHead()) {
          contents = undefined;
          repoChanged = false;
          void load(true);
        }
        return;
      case "blameLatest":
        if (repoMeta.bare) {
          navigator.blameHead();
        } else {
          navigator.navigate("latest");
        }
        contents = undefined;
        repoChanged = false;
        syncOpenContents();
        void load(true);
        return;
      case "openFile":
        openTargetFile();
        return;
      case "rewind":
        if (navigator.rewind(message)) {
          syncContentsForCurrent();
          void load();
        }
        return;
      case "navigate":
        if (navigator.navigate(message.direction)) {
          syncContentsForCurrent();
          void load();
        }
        return;
      case "setOptions":
        if (navigator.setOptions(message.options, message.targetLine)) void load();
        return;
      case "ignoreCommit":
        if (navigator.ignoreCommit(message.commitHash, message.targetLine)) void load();
        return;
      case "clearIgnoredCommit":
        if (navigator.clearIgnoredCommit(message.commitHash, message.targetLine)) void load();
        return;
      case "loadCommitPopover":
        void replyCommitPopover(message.requestId, message.commitHash);
        return;
      case "showCommitInGraph":
        revealInGraph(message.commitHash);
        return;
      case "openCommitFileDiff":
        openCommitDiff(message);
        return;
      case "openFileAtLine":
        openAtLine(message.line);
        return;
      case "copyText":
        void copyCommitText(message.kind, message.commitHash);
        return;
    }
  };

  const received = panel.webview.onDidReceiveMessage(handleMessage);
  // Saving the blamed file clears the unsaved-buffer pill and refreshes onto
  // the saved working tree without touching pinned historical revisions.
  const saved = vscode.workspace.onDidSaveTextDocument?.((document) => {
    const snap = navigator.snapshot();
    if (
      disposed ||
      snap.rev !== null ||
      document.uri.scheme !== "file" ||
      snap.repo === "" ||
      snap.filePath === ""
    ) {
      return;
    }
    if (getPathFromStr(document.uri.fsPath) !== targetDiskPath(snap.repo, snap.filePath)) {
      return;
    }
    contents = undefined;
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
    viewLatest: l10n.t("blame.viewLatest"),
    rewind: l10n.t("blame.rewind"),
    rewindTo: l10n.t("blame.rewindTo"),
    rewindToPath: l10n.t("blame.rewindToPath"),
    initialCommit: l10n.t("blame.initialCommit"),
    navBack: l10n.t("blame.navBack"),
    navForward: l10n.t("blame.navForward"),
    navLatest: l10n.t("blame.navLatest"),
    navLatestTitle: l10n.t("blame.navLatestTitle"),
    renamedFrom: l10n.t("blame.renamedFrom"),
    optionIgnoreWhitespace: l10n.t("blame.optionIgnoreWhitespace"),
    optionDetectMoves: l10n.t("blame.optionDetectMoves"),
    optionDetectCopies: l10n.t("blame.optionDetectCopies"),
    ignoringRevsFile: l10n.t("blame.ignoringRevsFile"),
    ignoreRevsFileOff: l10n.t("blame.ignoreRevsFileOff"),
    ignoringCommit: l10n.t("blame.ignoringCommit"),
    removeIgnoredCommit: l10n.t("blame.removeIgnoredCommit"),
    clearIgnoredCommits: l10n.t("blame.clearIgnoredCommits"),
    findToggle: l10n.t("blame.findToggle"),
    findPlaceholder: l10n.t("blame.findPlaceholder"),
    findCount: l10n.t("blame.findCount"),
    findPrev: l10n.t("blame.findPrev"),
    findNext: l10n.t("blame.findNext"),
    findClose: l10n.t("blame.findClose"),
    showCommitDetails: l10n.t("blame.showCommitDetails"),
    popoverClose: l10n.t("blame.popoverClose"),
    popoverLoadError: l10n.t("blame.popoverLoadError"),
    showCommitInGraph: l10n.t("blame.showCommitInGraph"),
    openInGglDiff: l10n.t("action.openInGglDiff"),
    ignoreCommitSession: l10n.t("blame.ignoreCommitSession"),
    copyCommitHash: l10n.t("action.copyCommitHash"),
    copyCommitMessage: l10n.t("blame.copyCommitMessage"),
    openFileAtLine: l10n.t("blame.openFileAtLine"),
    viewBlameAtHead: l10n.t("blame.viewBlameAtHead"),
    uncommittedExplanation: l10n.t("blame.uncommittedExplanation"),
    detailCommit: l10n.t("detail.commit"),
    detailAuthor: l10n.t("detail.author"),
    detailAuthorDate: l10n.t("detail.authorDate"),
    detailCommitter: l10n.t("detail.committer"),
    detailCommitterDate: l10n.t("detail.committerDate"),
    detailDate: l10n.t("detail.date")
  };
}
