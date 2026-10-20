import path from "node:path";

import { simpleGit } from "simple-git";
import * as vscode from "vscode";

import { formatGitCommandRecord } from "@/backend/utils/gitCommandLog";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { runGitRaw } from "@/backend/utils/gitRunner";
import { getPathFromStr } from "@/backend/utils/path";
import type { Config } from "@/config";
import type { DiffTabRequest } from "@/diffTabTypes";
import type { ExtensionState } from "@/extensionState";
import * as l10n from "@/l10n";
import type { TelemetryReporter } from "@/telemetry";

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
import type { RepoManager } from "./repoManager";
import { copyToClipboard } from "./utils/clipboard";
import type { Logger } from "./utils/logger";
import type { WebviewPanel } from "./webviewPanel";

type CommandApi = Pick<typeof vscode.commands, "registerCommand">;
type RepoQuickPickItem = vscode.QuickPickItem & {
  repo: string;
};
type WindowApi = {
  getActiveTextEditorUri(): { fsPath: string } | undefined;
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
  /** Open the GGL Diff tab from Source Control (D46); wired in `extension.ts`. */
  openScmDiffTab?: (request: DiffTabRequest) => void;
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

function createVsCodeWindowApi(): WindowApi {
  return {
    getActiveTextEditorUri: () => vscode.window.activeTextEditor?.document.uri,
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
  const disposables: vscode.Disposable[] = [];
  const registeredCommands: RegisteredCommand[] = [];
  const recordGitCommand: GitCommandRecorder = (record) => {
    deps.outputChannel.appendLine(formatGitCommandRecord(record));
  };

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
    for (const { id, handler } of createScmDiffTabHandlers({
      getRepos: () => deps.repoManager.getRepos(),
      openDiff: (request) => deps.openScmDiffTab?.(request),
      showWarning: (message) => windowApi.showWarningMessage(message)
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
