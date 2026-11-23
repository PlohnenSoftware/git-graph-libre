import path from "node:path";

import { simpleGit } from "simple-git";
import * as vscode from "vscode";

import { loadWorktrees } from "@/backend/queries/worktrees";
import type { GitWorktree } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import { formatGitCommandRecord } from "@/backend/utils/gitCommandLog";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { runGitRaw } from "@/backend/utils/gitRunner";
import { getPathFromStr } from "@/backend/utils/path";
import type { BlameOpenTarget } from "@/blameTabTypes";
import type { Config } from "@/config";
import type { DiffTabRequest } from "@/diffTabTypes";
import type { ExtensionState } from "@/extensionState";
import * as l10n from "@/l10n";
import type { TelemetryReporter } from "@/telemetry";
import {
  createTabOpenReporter,
  TAB_FEATURE_BLAME,
  TAB_FEATURE_DIFF,
  TAB_FEATURE_REFLOG
} from "@/telemetry/tabOpen";

import { createBlameSource } from "./blameTab/blameData";
import { openBlameTab as openBlamePanel } from "./blameTab/blameTabPanel";
import { buildComponentStatus } from "./componentStatus";
import {
  buildDiagnosticsReport,
  buildNewIssueUrl,
  type DiagnosticsFacts,
  type PathMode,
  readProcessFacts,
  readRepoRemotes
} from "./diagnosticsReport";
import { createScmDiffTabHandlers } from "./diffTab/scmCommands";
import { createReflogSource } from "./reflogTab/reflogData";
import { openReflogTab as openReflogPanel } from "./reflogTab/reflogTabPanel";
import type { RepoManager } from "./repoManager";
import { copyToClipboard } from "./utils/clipboard";
import type { Logger } from "./utils/logger";
import type { WebviewPanel } from "./webviewPanel";

type CommandApi = Pick<typeof vscode.commands, "registerCommand">;
type RepoQuickPickItem = vscode.QuickPickItem & {
  repo: string;
};
type WindowApi = {
  getActiveTextEditorUri(): { fsPath: string; scheme?: string } | undefined;
  /**
   * The active editor's 1-based cursor line, when one is open. Optional
   * so window fakes written before the Blame command stay valid; the
   * VS Code default below always provides it.
   */
  getActiveTextEditorLine?: () => number | undefined;
  showErrorMessage(message: string): Thenable<unknown>;
  showInformationMessage(message: string): Thenable<unknown>;
  showOpenDialog(
    options: vscode.OpenDialogOptions
  ): Thenable<readonly { fsPath: string }[] | undefined>;
  showQuickPick(
    items: readonly RepoQuickPickItem[],
    options: vscode.QuickPickOptions
  ): Thenable<RepoQuickPickItem | undefined>;
  showWarningMessage(message: string): Thenable<unknown>;
  /** Opens a file on disk in an editor tab. */
  openFile(filePath: string): Thenable<unknown>;
  /** A quick pick of labeled ids; undefined when dismissed. */
  showChoice(
    items: readonly { id: string; label: string }[],
    placeHolder: string
  ): Thenable<string | undefined>;
  /** Opens text in a new, unsaved Markdown editor. */
  openUntitledMarkdown(content: string): Thenable<unknown>;
};
/** The folder-level VS Code calls the worktree commands make; tests replace them. */
export type WorktreeFolderApi = {
  /** Paths of the folders in the open workspace. */
  workspaceFolderPaths(): string[];
  /** Appends a folder to the workspace; false when VS Code refuses. */
  addWorkspaceFolder(folderPath: string): boolean;
  /** Opens a folder in a new window, or in this one. */
  openFolder(folderPath: string, newWindow: boolean): Thenable<unknown>;
  /** Reveals a folder in the OS file manager. */
  revealInOS(folderPath: string): Thenable<unknown>;
};
type WorktreeRequest = { repo: string; path: string; newWindow: boolean };
type OutputChannel = Pick<vscode.OutputChannel, "appendLine" | "show">;
type LogAccess = Pick<Logger, "flush" | "logFilePath" | "recentLines">;

/** Lines "Copy Recent Log" puts on the clipboard. */
const COPIED_LOG_LINES = 200;
/** Log lines the diagnostics report may carry (the ring buffer holds more). */
const DIAGNOSTICS_LOG_LINES = 200;

type DiagnosticsChoice = "clipboard" | "documentFull" | "documentFolders" | "issue";

type RegisteredCommand = {
  id: string;
  handler: (...args: unknown[]) => unknown;
};

export type CommandManagerDeps = {
  commandApi?: CommandApi;
  windowApi?: WindowApi;
  extensionVersion: string;
  outputChannel: OutputChannel;
  /** The logger's file mirror and ring buffer (D61); the logs commands need both. */
  logAccess?: LogAccess;
  /** Writes text to the clipboard; defaults to VS Code's. */
  copyText?: (text: string) => Promise<boolean>;
  /** Opens a URL in the user's browser; defaults to VS Code's `env.openExternal`. */
  openExternal?: (url: string) => Thenable<boolean>;
  /** The folder calls the worktree commands make; defaults to VS Code's. */
  folderApi?: WorktreeFolderApi;
  /** Names of the `git-graph-libre.*` settings the user changed, never their values. */
  changedSettings?: () => string[];
  /** Replaces the fact gathering in tests. */
  collectDiagnosticsFacts?: () => Promise<DiagnosticsFacts>;
  config: Config;
  extensionState: ExtensionState;
  repoManager: RepoManager;
  avatarManager: {
    clearCache(): void;
  };
  openGraphView(targetRepo?: string): void;
  getCurrentPanel(): WebviewPanel | undefined;
  /** Trust a repository Git rejects for ownership; see `createGitTrustCommand`. */
  trustRepository?: () => Promise<void>;
  /** The extension's install path, for panels this manager opens itself. */
  extensionPath?: string;
  /**
   * Opens the Reflog tab for a repository (F1-03). Defaults to the reflog
   * panel fed by the engine-first source, assembled here like the graph
   * handler's route; tests replace it.
   */
  openReflogTab?: (repo: string) => void;
  /**
   * Opens the Blame tab for a file (F4-03). Defaults to the blame panel
   * fed by the CLI blame source, assembled here like the reflog route;
   * tests replace it.
   */
  openBlameTab?: (target: BlameOpenTarget) => void;
  /** Open the GGL Diff tab from Source Control (D46); wired in `extension.ts`. */
  openScmDiffTab?: (request: DiffTabRequest) => void;
  /**
   * Whether Git confirmed it accepts the repository (`RepoSearch.isVerified`):
   * the engine is offered only a verified repository. Absent means never
   * verified, so the CLI serves every reflog page.
   */
  isVerified?: (repo: string) => boolean;
  telemetry?: Pick<TelemetryReporter, "logFeature">;
};

function findKnownRepoForPath(repos: Record<string, unknown>, filePath: string): string | null {
  const normalizedPath = getPathFromStr(filePath);
  const repoPaths = Object.keys(repos).toSorted((a, b) => b.length - a.length);
  for (const repoPath of repoPaths) {
    if (normalizedPath === repoPath || normalizedPath.startsWith(`${repoPath}/`)) return repoPath;
  }
  return null;
}

async function resolveGitRoot(
  directory: string,
  gitPath: string,
  recordGitCommand?: GitCommandRecorder
): Promise<string | null> {
  try {
    const root = await runGitRaw(
      simpleGit({
        baseDir: directory,
        binary: gitPath,
        maxConcurrentProcesses: 1,
        trimmed: false
      }),
      {
        label: "resolve-git-root",
        repo: directory,
        args: ["rev-parse", "--show-toplevel"],
        record: recordGitCommand
      }
    );
    return getPathFromStr(root.trim());
  } catch {
    return null;
  }
}

async function promptForRepositoryFolder(windowApi: WindowApi): Promise<string | null> {
  const selected = await windowApi.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: l10n.t("command.addRepo.openLabel"),
    title: l10n.t("command.addRepo.title")
  });
  return selected?.[0] ? getPathFromStr(selected[0].fsPath) : null;
}

function formatRepoQuickPickItems(repos: Record<string, unknown>): RepoQuickPickItem[] {
  return Object.keys(repos)
    .toSorted((left, right) => left.localeCompare(right))
    .map((repoPath) => {
      const parts = repoPath.split("/");
      return {
        label: parts.at(-1) || repoPath,
        description: repoPath,
        repo: repoPath
      };
    });
}

function createVsCodeFolderApi(): WorktreeFolderApi {
  return {
    workspaceFolderPaths: () =>
      (vscode.workspace.workspaceFolders ?? []).map((folder) => getPathFromStr(folder.uri.fsPath)),
    addWorkspaceFolder: (folderPath) =>
      vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, {
        uri: vscode.Uri.file(folderPath),
        name: path.basename(folderPath)
      }),
    openFolder: (folderPath, newWindow) =>
      vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folderPath), {
        forceNewWindow: newWindow
      }),
    revealInOS: (folderPath) =>
      vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(folderPath))
  };
}

type BlameTargetUri = { fsPath: string; scheme?: string };

function extractUriLike(value: unknown): BlameTargetUri | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { fsPath?: unknown; scheme?: unknown };
  if (typeof record.fsPath !== "string" || record.fsPath === "") return null;
  if (record.scheme !== undefined && typeof record.scheme !== "string") return null;
  return { fsPath: record.fsPath, scheme: record.scheme };
}

function isFileScheme(uri: BlameTargetUri): boolean {
  return uri.scheme === undefined || uri.scheme === "file";
}

function extractBlameArgUri(arg: unknown): BlameTargetUri | null {
  if (typeof arg !== "object" || arg === null) return null;
  // SourceControlResourceState carries the clicked file on `resourceUri`.
  if ("resourceUri" in arg) {
    return extractUriLike((arg as { resourceUri?: unknown }).resourceUri);
  }
  return extractUriLike(arg);
}

/** Reads the `{ repo, path, newWindow }` a worktree command is sent, refusing any other shape. */
function parseWorktreeRequest(value: unknown): WorktreeRequest {
  const request = value as Partial<Record<keyof WorktreeRequest, unknown>> | null | undefined;
  if (typeof request?.repo !== "string" || typeof request.path !== "string") {
    throw new TypeError(l10n.t("command.worktree.badRequest"));
  }
  return { repo: request.repo, path: request.path, newWindow: request.newWindow === true };
}

function createVsCodeWindowApi(): WindowApi {
  return {
    getActiveTextEditorUri: () => vscode.window.activeTextEditor?.document.uri,
    getActiveTextEditorLine: () => {
      const editor = vscode.window.activeTextEditor;
      return editor === undefined ? undefined : editor.selection.active.line + 1;
    },
    showErrorMessage: (message) => vscode.window.showErrorMessage(message),
    showInformationMessage: (message) => vscode.window.showInformationMessage(message),
    showOpenDialog: (options) => vscode.window.showOpenDialog(options),
    showQuickPick: (items, options) =>
      vscode.window.showQuickPick<RepoQuickPickItem>(items, options),
    showWarningMessage: (message) => vscode.window.showWarningMessage(message),
    openFile: async (filePath) => {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      return vscode.window.showTextDocument(document, { preview: false });
    },
    showChoice: async (items, placeHolder) => {
      const picked = await vscode.window.showQuickPick(
        items.map((item) => ({ label: item.label, id: item.id })),
        { placeHolder }
      );
      return picked?.id;
    },
    openUntitledMarkdown: async (content) => {
      const document = await vscode.workspace.openTextDocument({ language: "markdown", content });
      return vscode.window.showTextDocument(document, { preview: false });
    }
  };
}

export function createCommandManager(deps: CommandManagerDeps) {
  const commandApi = deps.commandApi ?? vscode.commands;
  const windowApi = deps.windowApi ?? createVsCodeWindowApi();
  const folderApi = deps.folderApi ?? createVsCodeFolderApi();
  const disposables: vscode.Disposable[] = [];
  const registeredCommands: RegisteredCommand[] = [];
  const recordGitCommand: GitCommandRecorder = (record) => {
    deps.outputChannel.appendLine(formatGitCommandRecord(record));
  };
  // Tab opens that never reach a panel report their failure here (T1);
  // every open that reaches one is reported by the panel itself.
  const reportReflogOpen = createTabOpenReporter(deps.telemetry, TAB_FEATURE_REFLOG);
  const reportDiffOpen = createTabOpenReporter(deps.telemetry, TAB_FEATURE_DIFF);
  const reportBlameOpen = createTabOpenReporter(deps.telemetry, TAB_FEATURE_BLAME);

  // Every palette command funnels through here, so this wrapper instruments
  // all of them at once. Only the command id and the outcome are sent — never
  // the arguments, which can carry file paths from editor-context invocations.
  function register(id: string, handler: (...args: unknown[]) => unknown) {
    const instrumented = async (...args: unknown[]) => {
      try {
        const result = await handler(...args);
        deps.telemetry?.logFeature(id, true);
        return result;
      } catch (error: unknown) {
        deps.telemetry?.logFeature(id, false);
        throw error;
      }
    };
    registeredCommands.push({ id, handler: instrumented });
    const disposable = commandApi.registerCommand(id, instrumented);
    disposables.push(disposable);
    return disposable;
  }

  function focusRepo(repo: string) {
    deps.extensionState.setLastActiveRepo(repo);
    deps.openGraphView(repo);
    deps.repoManager.sendRepos();
  }

  async function openSourceControlRepo(sourceControl: unknown) {
    const rootUri = (sourceControl as Partial<vscode.SourceControl> | null | undefined)?.rootUri;
    if (typeof rootUri?.fsPath !== "string" || rootUri.fsPath === "") {
      deps.openGraphView();
      return;
    }

    const repoPath = getPathFromStr(rootUri.fsPath);
    // A SourceControl supplies a root, so a known parent must not hide a
    // nested repository that has not been discovered yet.
    if (Object.hasOwn(deps.repoManager.getRepos(), repoPath)) {
      focusRepo(repoPath);
      return;
    }

    const resolvedRepo = await resolveGitRoot(repoPath, deps.config.gitPath(), recordGitCommand);
    if (resolvedRepo === null) {
      deps.openGraphView();
      return;
    }

    deps.repoManager.addRepo(resolvedRepo);
    focusRepo(resolvedRepo);
  }

  async function openActiveEditorRepo() {
    const activeUri = windowApi.getActiveTextEditorUri();
    if (!activeUri) {
      await windowApi.showWarningMessage(l10n.t("command.activeEditorRepo.noEditor"));
      return;
    }

    const activePath = getPathFromStr(activeUri.fsPath);
    const knownRepo = findKnownRepoForPath(deps.repoManager.getRepos(), activePath);
    if (knownRepo !== null) {
      focusRepo(knownRepo);
      return;
    }

    const resolvedRepo = await resolveGitRoot(
      path.dirname(activePath),
      deps.config.gitPath(),
      recordGitCommand
    );
    if (resolvedRepo === null) {
      await windowApi.showWarningMessage(l10n.t("command.activeEditorRepo.noRepo"));
      return;
    }

    deps.repoManager.addRepo(resolvedRepo);
    focusRepo(resolvedRepo);
  }

  async function addRepository() {
    const selectedPath = await promptForRepositoryFolder(windowApi);
    if (selectedPath === null) return;

    const resolvedRepo = await resolveGitRoot(
      selectedPath,
      deps.config.gitPath(),
      recordGitCommand
    );
    if (resolvedRepo === null) {
      await windowApi.showErrorMessage(l10n.t("command.addRepo.invalid", selectedPath));
      return;
    }

    deps.repoManager.addRepo(resolvedRepo);
    focusRepo(resolvedRepo);
  }

  async function removeRepository() {
    const items = formatRepoQuickPickItems(deps.repoManager.getRepos());
    if (items.length === 0) {
      await windowApi.showInformationMessage(l10n.t("command.removeRepo.none"));
      return;
    }

    const selected = await windowApi.showQuickPick(items, {
      canPickMany: false,
      placeHolder: l10n.t("command.removeRepo.placeholder")
    });
    if (!selected) return;

    deps.repoManager.removeRepo(selected.repo);
    if (deps.extensionState.getLastActiveRepo() === selected.repo) {
      const remainingRepos = Object.keys(deps.repoManager.getRepos()).toSorted((left, right) =>
        left.localeCompare(right)
      );
      deps.extensionState.setLastActiveRepo(remainingRepos[0] ?? null);
    }
    deps.repoManager.sendRepos();
  }

  async function collectFacts(): Promise<DiagnosticsFacts> {
    if (deps.collectDiagnosticsFacts) return deps.collectDiagnosticsFacts();
    const gitPath = deps.config.gitPath();
    const backend = deps.config.backend();
    const components = await buildComponentStatus({ preference: backend, gitPath });
    const repoPaths = Object.keys(deps.repoManager.getRepos()).toSorted((a, b) =>
      a.localeCompare(b)
    );
    const repos = await Promise.all(
      repoPaths.map(async (repo) => ({ path: repo, remotes: await readRepoRemotes(repo, gitPath) }))
    );
    return {
      ...readProcessFacts(),
      extensionVersion: deps.extensionVersion,
      hostVersion: vscode.version,
      appName: vscode.env?.appName,
      workspaceTrusted: vscode.workspace?.isTrusted,
      backend,
      git: components.git,
      engine: components.engine,
      graphLoad: components.graphLoad,
      changedSettings: deps.changedSettings?.(),
      repos,
      logLines: deps.logAccess?.recentLines(DIAGNOSTICS_LOG_LINES)
    };
  }

  async function showDiagnostics() {
    const report = buildDiagnosticsReport(await collectFacts(), { pathMode: "full" });
    deps.outputChannel.appendLine(`${l10n.t("command.diagnostics.header")}\n${report}`);
    deps.outputChannel.show(true);
    await windowApi.showInformationMessage(l10n.t("command.diagnostics.written"));
  }

  async function copyReportToClipboard(report: string, successKey: string) {
    const copied = await (deps.copyText ?? copyToClipboard)(report);
    if (copied) await windowApi.showInformationMessage(l10n.t(successKey));
    else await windowApi.showErrorMessage(l10n.t("command.copyDiagnostics.failed"));
  }

  async function openReportAsIssue(facts: DiagnosticsFacts) {
    const base = { pathMode: "folderNames", issueSkeleton: true } as const;
    const full = buildDiagnosticsReport(facts, base);
    // Degrade in steps: whole report, then without the log tail, then clipboard.
    const url =
      buildNewIssueUrl(full) ??
      buildNewIssueUrl(buildDiagnosticsReport(facts, { ...base, includeLogTail: false }));
    if (url === null) {
      await copyReportToClipboard(full, "command.copyDiagnostics.issueTooLong");
      return;
    }
    const opener =
      deps.openExternal ?? ((target) => vscode.env.openExternal(vscode.Uri.parse(target)));
    await opener(url);
  }

  async function deliverReport(choice: DiagnosticsChoice, facts: DiagnosticsFacts) {
    const modes: Record<Exclude<DiagnosticsChoice, "issue">, PathMode> = {
      clipboard: "full",
      documentFull: "full",
      documentFolders: "folderNames"
    };
    if (choice === "issue") {
      await openReportAsIssue(facts);
      return;
    }
    const report = buildDiagnosticsReport(facts, { pathMode: modes[choice] });
    if (choice === "clipboard") {
      await copyReportToClipboard(report, "command.copyDiagnostics.copied");
    } else {
      await windowApi.openUntitledMarkdown(report);
    }
  }

  async function copyDiagnostics() {
    const picked = await windowApi.showChoice(
      [
        { id: "clipboard", label: l10n.t("command.copyDiagnostics.clipboard") },
        { id: "documentFull", label: l10n.t("command.copyDiagnostics.documentFull") },
        { id: "documentFolders", label: l10n.t("command.copyDiagnostics.documentFolders") },
        { id: "issue", label: l10n.t("command.copyDiagnostics.issue") }
      ],
      l10n.t("command.copyDiagnostics.placeholder")
    );
    if (picked === undefined) return;
    await deliverReport(picked as DiagnosticsChoice, await collectFacts());
  }

  async function openLogFile() {
    await deps.logAccess?.flush();
    const filePath = deps.logAccess?.logFilePath();
    if (filePath === undefined) {
      deps.outputChannel.show(true);
      await windowApi.showWarningMessage(l10n.t("command.openLogFile.unavailable"));
      return;
    }
    await windowApi.openFile(filePath);
  }

  async function copyRecentLog() {
    const lines = deps.logAccess?.recentLines(COPIED_LOG_LINES) ?? [];
    if (lines.length === 0) {
      await windowApi.showWarningMessage(l10n.t("command.copyRecentLog.empty"));
      return;
    }
    const copied = await (deps.copyText ?? copyToClipboard)(lines.join("\n"));
    if (copied) {
      await windowApi.showInformationMessage(l10n.t("command.copyRecentLog.copied", lines.length));
    } else {
      await windowApi.showErrorMessage(l10n.t("command.copyRecentLog.failed"));
    }
  }

  function startHistorySearch() {
    deps.openGraphView();
    deps.getCurrentPanel()?.startHistorySearch();
  }

  /**
   * The worktree a request names, as Git lists it now. A path Git no longer
   * lists is refused, and so is a stale entry: its folder is gone, so Repair
   * or Prune fits, not opening it.
   */
  async function listedWorktree(request: WorktreeRequest): Promise<GitWorktree> {
    const git = simpleGit({
      baseDir: request.repo,
      binary: deps.config.gitPath(),
      maxConcurrentProcesses: 1,
      trimmed: false
    });
    const result = await loadWorktrees(git, request.repo, recordGitCommand);
    if (result.error !== null) throw new Error(result.error.message);

    const wanted = await canonicalizePath(request.path);
    const listed = await Promise.all(
      result.value.map((worktree) => canonicalizePath(worktree.path))
    );
    const index = listed.indexOf(wanted);
    if (index === -1) throw new Error(l10n.t("command.worktree.notListed", request.path));
    const target = result.value[index];
    if (target.prunable !== null) throw new Error(l10n.t("command.worktree.stale", target.path));
    return target;
  }

  async function openWorktreeFolder(value: unknown) {
    const request = parseWorktreeRequest(value);
    const target = await listedWorktree(request);
    await folderApi.openFolder(target.path, request.newWindow);
  }

  async function addWorktreeToWorkspace(value: unknown) {
    const target = await listedWorktree(parseWorktreeRequest(value));
    const open = await Promise.all(folderApi.workspaceFolderPaths().map(canonicalizePath));
    if (open.includes(await canonicalizePath(target.path))) {
      await windowApi.showInformationMessage(
        l10n.t("command.worktree.alreadyInWorkspace", target.path)
      );
      return;
    }
    if (!folderApi.addWorkspaceFolder(target.path)) {
      throw new Error(l10n.t("command.worktree.addFailed", target.path));
    }
  }

  async function revealWorktree(value: unknown) {
    const target = await listedWorktree(parseWorktreeRequest(value));
    await folderApi.revealInOS(target.path);
  }

  /** Focuses the worktree's repository, adding it to the list first when it is not there. */
  async function switchGraphToWorktree(value: unknown) {
    const target = await listedWorktree(parseWorktreeRequest(value));
    const repoPath = getPathFromStr(target.path);
    if (Object.hasOwn(deps.repoManager.getRepos(), repoPath)) {
      focusRepo(repoPath);
      return;
    }

    const resolvedRepo = await resolveGitRoot(repoPath, deps.config.gitPath(), recordGitCommand);
    if (resolvedRepo === null) throw new Error(l10n.t("command.addRepo.invalid", target.path));
    deps.repoManager.addRepo(resolvedRepo);
    focusRepo(resolvedRepo);
  }

  /** Opens the same preview the branch menu opens, for the graph's repository. */
  async function pruneStaleWorktrees() {
    const panel = deps.getCurrentPanel();
    if (panel === undefined) {
      await windowApi.showInformationMessage(l10n.t("command.pruneStaleWorktrees.noGraph"));
      return;
    }
    panel.showPruneWorktrees();
  }

  function openReflog(repo: string) {
    if (deps.openReflogTab !== undefined) {
      deps.openReflogTab(repo);
      return;
    }
    openReflogPanel(
      repo,
      createReflogSource({
        createGit: (root) =>
          simpleGit({
            baseDir: root,
            binary: deps.config.gitPath(),
            maxConcurrentProcesses: 6,
            trimmed: false
          }),
        gitPath: () => deps.config.gitPath(),
        record: recordGitCommand,
        backend: deps.config.backend,
        isVerified: deps.isVerified
      }),
      {
        extensionPath:
          deps.extensionPath ??
          vscode.extensions?.getExtension("PlohnenSoftware.git-graph-libre")?.extensionPath ??
          process.cwd(),
        outputChannel: deps.outputChannel,
        telemetry: deps.telemetry,
        repoManager: deps.repoManager
      }
    );
  }

  /**
   * "Show Reflog" for the selected repository: the one named by the caller,
   * else the graph's last active one, else the only known one; with several
   * and no selection the user picks, and with none there is only the word.
   */
  async function showReflog(requested?: unknown) {
    const repos = deps.repoManager.getRepos();
    const repoPaths = Object.keys(repos);
    if (repoPaths.length === 0) {
      // A failed open: there is no repository a tab could show (T1).
      reportReflogOpen(false);
      await windowApi.showInformationMessage(l10n.t("command.showReflog.noRepo"));
      return;
    }
    let repo: string | undefined;
    if (typeof requested === "string" && Object.hasOwn(repos, requested)) repo = requested;
    if (repo === undefined) {
      const lastActive = deps.extensionState.getLastActiveRepo();
      if (lastActive !== null && Object.hasOwn(repos, lastActive)) repo = lastActive;
    }
    if (repo === undefined && repoPaths.length === 1) repo = repoPaths[0];
    if (repo === undefined) {
      const selected = await windowApi.showQuickPick(formatRepoQuickPickItems(repos), {
        canPickMany: false,
        placeHolder: l10n.t("command.showReflog.placeholder")
      });
      if (!selected) return;
      repo = selected.repo;
    }
    openReflog(repo);
  }

  function openBlame(target: BlameOpenTarget) {
    if (deps.openBlameTab !== undefined) {
      deps.openBlameTab(target);
      return;
    }
    openBlamePanel(
      target,
      createBlameSource({
        createGit: (root) =>
          simpleGit({
            baseDir: root,
            binary: deps.config.gitPath(),
            maxConcurrentProcesses: 6,
            trimmed: false
          }),
        gitPath: () => deps.config.gitPath(),
        record: recordGitCommand
      }),
      {
        extensionPath:
          deps.extensionPath ??
          vscode.extensions?.getExtension("PlohnenSoftware.git-graph-libre")?.extensionPath ??
          process.cwd(),
        outputChannel: deps.outputChannel,
        telemetry: deps.telemetry
      }
    );
  }

  /**
   * "Show Blame" from the Command Palette, Editor context menu (`Uri`),
   * Explorer context menu (`Uri`), or Source Control context menu
   * (`SourceControlResourceState`). Resolves the repository like
   * `viewActiveEditorRepo` (longest known root, with `resolveGitRoot`
   * fallback), and lands on the active editor's cursor line whenever the
   * blamed file matches the active editor.
   */
  async function showBlame(target?: unknown) {
    const hasExplicitTarget = target !== undefined && target !== null;
    const activeUri = windowApi.getActiveTextEditorUri();
    const resolvedUri = hasExplicitTarget ? extractBlameArgUri(target) : extractUriLike(activeUri);
    if (resolvedUri === null || !isFileScheme(resolvedUri)) {
      // A failed open: no file to blame, so the tab never reaches its panel (T1b).
      reportBlameOpen(false);
      await windowApi.showWarningMessage(l10n.t("command.showBlame.noEditor"));
      return;
    }

    const noRepoKey = hasExplicitTarget
      ? "command.showBlame.fileNoRepo"
      : "command.showBlame.noRepo";
    const targetPath = getPathFromStr(resolvedUri.fsPath);
    let repo = findKnownRepoForPath(deps.repoManager.getRepos(), targetPath);
    if (repo === null) {
      const resolvedRepo = await resolveGitRoot(
        path.dirname(targetPath),
        deps.config.gitPath(),
        recordGitCommand
      );
      if (resolvedRepo === null) {
        reportBlameOpen(false);
        await windowApi.showWarningMessage(l10n.t(noRepoKey));
        return;
      }
      deps.repoManager.addRepo(resolvedRepo);
      repo = resolvedRepo;
    }

    const filePath = targetPath.startsWith(`${repo}/`) ? targetPath.slice(repo.length + 1) : "";
    if (filePath === "") {
      reportBlameOpen(false);
      await windowApi.showWarningMessage(l10n.t(noRepoKey));
      return;
    }

    const activeTarget = extractUriLike(activeUri);
    const matchesActiveEditor =
      !hasExplicitTarget ||
      (activeTarget !== null &&
        isFileScheme(activeTarget) &&
        getPathFromStr(activeTarget.fsPath) === targetPath);
    const targetLine = matchesActiveEditor ? (windowApi.getActiveTextEditorLine?.() ?? null) : null;
    openBlame({ repo, filePath, targetLine });
  }

  function registerAll() {
    register("git-graph-libre.view", (sourceControl) => openSourceControlRepo(sourceControl));
    register("git-graph-libre.searchCommits", () => startHistorySearch());
    register("git-graph-libre.viewActiveEditorRepo", () => openActiveEditorRepo());
    register("git-graph-libre.addRepo", () => addRepository());
    register("git-graph-libre.removeRepo", () => removeRepository());
    register("git-graph-libre.showDiagnostics", () => showDiagnostics());
    register("git-graph-libre.copyDiagnostics", () => copyDiagnostics());
    register("git-graph-libre.openLogFile", () => openLogFile());
    register("git-graph-libre.copyRecentLog", () => copyRecentLog());
    register("git-graph-libre.trustRepository", () => deps.trustRepository?.());
    register("git-graph-libre.clearAvatarCache", () => {
      deps.avatarManager.clearCache();
    });
    // The graph's worktree actions send these; the manifest hides them from the palette.
    register("git-graph-libre.openWorktree", (request) => openWorktreeFolder(request));
    register("git-graph-libre.addWorktreeToWorkspace", (request) =>
      addWorktreeToWorkspace(request)
    );
    register("git-graph-libre.revealWorktree", (request) => revealWorktree(request));
    register("git-graph-libre.switchGraphToWorktree", (request) => switchGraphToWorktree(request));
    register("git-graph-libre.pruneStaleWorktrees", () => pruneStaleWorktrees());
    register("git-graph-libre.showReflog", (repo) => showReflog(repo));
    register("git-graph-libre.showBlame", (target) => showBlame(target));
    for (const { id, handler } of createScmDiffTabHandlers({
      getRepos: () => deps.repoManager.getRepos(),
      openDiff: (request) => deps.openScmDiffTab?.(request),
      showWarning: (message) => windowApi.showWarningMessage(message),
      reportOpenFailure: () => reportDiffOpen(false)
    })) {
      register(id, handler);
    }
    return disposables;
  }

  function dispose() {
    while (disposables.length) disposables.pop()?.dispose();
  }

  return {
    registerAll,
    dispose,
    getRegisteredCommands: () => registeredCommands.slice()
  };
}

export type CommandManager = ReturnType<typeof createCommandManager>;
