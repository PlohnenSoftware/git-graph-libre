import * as vscode from "vscode";
import { closeEngineRepository } from "@/backend/engine/index";
import { normalizeGitError } from "@/backend/utils/gitRunner";
import { logApplication } from "@/backend/utils/operationLog";
import { safeDirectoryEntry, trustGitRepository } from "@/backend/utils/repositoryProbe";
import type { Config } from "@/config";
import * as l10n from "@/l10n";
import type { TelemetryReporter } from "@/telemetry";
import { FAILURE_SCREENS, type FailureScreen } from "@/types";
import { buildComponentStatus } from "./componentStatus";
import type { WebviewBridge } from "./webviewBridge";
import type { RepoSearch } from "./workspaceSearch";

type TrustDeps = {
  config: Pick<Config, "gitPath">;
  repoSearch: Pick<RepoSearch, "getDiagnostics">;
  outputChannel?: Pick<vscode.OutputChannel, "appendLine">;
  window?: Pick<typeof vscode.window, "showWarningMessage">;
};

/** One trust request at a time, whether it came from a graph tab or the palette. */
let trusting = false;

/**
 * Asks, then adds one discovered repository Git rejects for ownership to
 * Git's global safe.directory list. The dialog names the exact entry that
 * will be written (see `safeDirectoryEntry`). Returns the error to show, or
 * null when it was trusted, declined, or another request is already open.
 */
export async function confirmGitTrust(repo: string, deps: TrustDeps): Promise<string | null> {
  if (trusting) return null;
  trusting = true;
  try {
    const known = deps.repoSearch
      .getDiagnostics()
      .repositories.some((probe) => probe.path === repo && probe.state === "untrusted");
    if (!known)
      throw new Error("This directory is not a discovered repository awaiting Git trust.");
    const gitPath = deps.config.gitPath();
    const entry = await safeDirectoryEntry(repo, gitPath);
    const accept = l10n.t("startup.trust");
    const answer = await (deps.window ?? vscode.window).showWarningMessage(
      l10n.t("startup.trustConfirm", entry),
      { modal: true },
      accept
    );
    if (answer !== accept) return null;
    await trustGitRepository(repo, gitPath, entry);
    closeEngineRepository(repo);
    deps.outputChannel?.appendLine(`[repos] Git trust granted for ${JSON.stringify(entry)}`);
    return null;
  } catch (error_) {
    const error = normalizeGitError(error_).message;
    deps.outputChannel?.appendLine(`[repos] trust failed: ${error}`);
    return error;
  } finally {
    trusting = false;
  }
}

/**
 * The palette's way to the same trust request. In a workspace where another
 * repository opened, the graph is showing and a rejected one is simply
 * missing from its list — this is where it can still be trusted.
 */
export function createGitTrustCommand(
  deps: TrustDeps & {
    repoSearch: Pick<RepoSearch, "getDiagnostics" | "searchWorkspaceForRepos">;
    window?: Pick<
      typeof vscode.window,
      "showWarningMessage" | "showInformationMessage" | "showErrorMessage" | "showQuickPick"
    >;
  }
): () => Promise<void> {
  const window = deps.window ?? vscode.window;
  return async () => {
    const blocked = deps.repoSearch
      .getDiagnostics()
      .repositories.filter((probe) => probe.state === "untrusted")
      .map((probe) => probe.path);
    if (blocked.length === 0) {
      await window.showInformationMessage(l10n.t("command.trustRepository.none"));
      return;
    }
    const repo =
      blocked.length === 1
        ? blocked[0]
        : await window.showQuickPick(blocked, {
            placeHolder: l10n.t("command.trustRepository.placeholder")
          });
    if (repo === undefined) return;
    const error = await confirmGitTrust(repo, deps);
    await deps.repoSearch.searchWorkspaceForRepos(true);
    if (error !== null) await window.showErrorMessage(error);
  };
}

/** How often an open tab rechecks repositories that are waiting for Git trust. */
const TRUST_RECHECK_MS = 5000;

export function registerRepositoryRecovery(
  bridge: WebviewBridge,
  deps: {
    config: Config;
    repoSearch: RepoSearch;
    visible: () => boolean;
    outputChannel?: Pick<vscode.OutputChannel, "appendLine"> &
      Partial<Pick<vscode.OutputChannel, "show">>;
    telemetry?: Pick<TelemetryReporter, "logFeature">;
  }
) {
  let shown: FailureScreen | null = null;
  // Trust granted outside VS Code's sight — a terminal inside the editor
  // changes no focus — must still reach an open graph whose list is missing
  // a rejected repository. The startup screen polls on its own; this covers
  // the graph, and costs nothing while no repository waits for trust.
  const recheck = setInterval(() => {
    if (!deps.visible()) return;
    const waiting = deps.repoSearch
      .getDiagnostics()
      .repositories.some((probe) => probe.state === "untrusted");
    if (waiting) void deps.repoSearch.searchWorkspaceForRepos();
  }, TRUST_RECHECK_MS);
  async function refresh(initialError: string | null = null, force = false) {
    let error = initialError;
    try {
      await deps.repoSearch.searchWorkspaceForRepos(force);
    } catch (error_) {
      error = normalizeGitError(error_).message;
    }
    bridge.post({
      command: "repositoryStatus",
      startup: {
        ...deps.repoSearch.getDiagnostics(),
        searchDepth: deps.config.maxDepthOfRepoSearch(),
        components: await buildComponentStatus({
          preference: deps.config.backend(),
          gitPath: deps.config.gitPath()
        }),
        error
      }
    });
  }
  bridge.onMessage("repositoryStatus", () => refresh());
  bridge.onMessage("setRepoSearchDepth", async (msg) => {
    let error: string | null = null;
    try {
      if (!Number.isInteger(msg.depth) || msg.depth < 0 || msg.depth > 20)
        throw new Error("Search depth must be an integer between 0 and 20.");
      await vscode.workspace
        .getConfiguration("git-graph-libre")
        .update("maxDepthOfRepoSearch", msg.depth, vscode.ConfigurationTarget.Workspace);
      deps.repoSearch.maxDepthChanged();
    } catch (error_) {
      error = normalizeGitError(error_).message;
    }
    await refresh(error, true);
  });
  bridge.onMessage("openGitSettings", async () => {
    await vscode.commands.executeCommand("workbench.action.openSettings", "git.path");
  });
  bridge.onMessage("showOutput", () => deps.outputChannel?.show?.(true));
  // Through the command, so the buttons and the Command Palette share one
  // implementation and one telemetry chokepoint.
  bridge.onMessage("openLogFile", async () => {
    await vscode.commands.executeCommand("git-graph-libre.openLogFile");
  });
  bridge.onMessage("copyRecentLog", async () => {
    await vscode.commands.executeCommand("git-graph-libre.copyRecentLog");
  });
  bridge.onMessage("failureScreenShown", (msg) => {
    if (msg.screen === null) {
      shown = null;
      return;
    }
    if (!deps.visible()) return;
    if (!FAILURE_SCREENS.includes(msg.screen) || msg.screen === shown) return;
    shown = msg.screen;
    // The user-visible end of the chain: which screen replaced the graph.
    logApplication("failureScreenShown", shown);
    // Fixed category only: never paths, Git output or a caller-provided event name.
    const emptyState = shown === "noWorkspace" || shown === "noRepository";
    deps.telemetry?.logFeature(`view.${emptyState ? "empty" : "failure"}.${shown}`, emptyState);
  });
  bridge.onMessage("trustRepository", async (msg) => {
    const error = await confirmGitTrust(msg.repo, deps);
    await refresh(error, true);
  });
  return {
    refresh,
    clearFailure: () => {
      shown = null;
    },
    dispose: () => clearInterval(recheck)
  };
}
