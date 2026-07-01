import path from "node:path";

import { simpleGit } from "simple-git";
import * as vscode from "vscode";

import { formatGitCommandRecord } from "@/backend/utils/gitCommandLog";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { runGitRaw } from "@/backend/utils/gitRunner";
import { getPathFromStr } from "@/backend/utils/path";
import type { Config } from "@/config";
import type { ExtensionState } from "@/extensionState";
import * as l10n from "@/l10n";

import type { RepoManager } from "./repoManager";
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
};
type OutputChannel = Pick<vscode.OutputChannel, "appendLine" | "show">;

type RegisteredCommand = {
  id: string;
  handler: (...args: unknown[]) => unknown;
};

export type CommandManagerDeps = {
  commandApi?: CommandApi;
  windowApi?: WindowApi;
  extensionVersion: string;
  outputChannel: OutputChannel;
  config: Config;
  extensionState: ExtensionState;
  repoManager: RepoManager;
  avatarManager: {
    clearCache(): void;
  };
  openGraphView(targetRepo?: string): void;
  getCurrentPanel(): WebviewPanel | undefined;
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
    showWarningMessage: (message) => vscode.window.showWarningMessage(message)
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

  function register(id: string, handler: (...args: unknown[]) => unknown) {
    registeredCommands.push({ id, handler });
    const disposable = commandApi.registerCommand(id, handler);
    disposables.push(disposable);
    return disposable;
  }

  function focusRepo(repo: string) {
    deps.extensionState.setLastActiveRepo(repo);
    deps.openGraphView(repo);
    deps.repoManager.sendRepos();
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

  async function showDiagnostics() {
    const repos = Object.keys(deps.repoManager.getRepos()).toSorted((left, right) =>
      left.localeCompare(right)
    );
    const lines = [
      l10n.t("command.diagnostics.header"),
      `extension=${deps.extensionVersion}`,
      `vscode=${vscode.version}`,
      `gitPath=${deps.config.gitPath()}`,
      `repos=${repos.length}`,
      `lastActiveRepo=${deps.extensionState.getLastActiveRepo() ?? "(none)"}`,
      `panelOpen=${deps.getCurrentPanel() ? "true" : "false"}`
    ];
    for (const repo of repos) lines.push(`repo=${repo}`);

    deps.outputChannel.appendLine(lines.join("\n"));
    deps.outputChannel.show(true);
    await windowApi.showInformationMessage(l10n.t("command.diagnostics.written"));
  }

  function registerAll() {
    register("git-graph-libre.view", () => deps.openGraphView());
    register("git-graph-libre.viewActiveEditorRepo", () => openActiveEditorRepo());
    register("git-graph-libre.addRepo", () => addRepository());
    register("git-graph-libre.removeRepo", () => removeRepository());
    register("git-graph-libre.showDiagnostics", () => showDiagnostics());
    register("git-graph-libre.clearAvatarCache", () => {
      deps.avatarManager.clearCache();
    });
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
