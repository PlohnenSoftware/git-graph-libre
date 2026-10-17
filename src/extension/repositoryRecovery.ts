import * as vscode from "vscode";
import { closeEngineRepository } from "@/backend/engine/index";
import { normalizeGitError } from "@/backend/utils/gitRunner";
import { trustGitRepository } from "@/backend/utils/repositoryProbe";
import type { Config } from "@/config";
import * as l10n from "@/l10n";
import type { TelemetryReporter } from "@/telemetry";
import { FAILURE_SCREENS, type FailureScreen } from "@/types";
import { buildComponentStatus } from "./componentStatus";
import type { WebviewBridge } from "./webviewBridge";
import type { RepoSearch } from "./workspaceSearch";

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
  let trusting = false;
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
  bridge.onMessage("failureScreenShown", (msg) => {
    if (msg.screen === null) {
      shown = null;
      return;
    }
    if (!deps.visible()) return;
    if (!FAILURE_SCREENS.includes(msg.screen) || msg.screen === shown) return;
    shown = msg.screen;
    // Fixed category only: never paths, Git output or a caller-provided event name.
    const emptyState = shown === "noWorkspace" || shown === "noRepository";
    deps.telemetry?.logFeature(`view.${emptyState ? "empty" : "failure"}.${shown}`, emptyState);
  });
  bridge.onMessage("trustRepository", async (msg) => {
    if (trusting) return;
    trusting = true;
    let error: string | null = null;
    try {
      const known = deps.repoSearch
        .getDiagnostics()
        .repositories.some((repo) => repo.path === msg.repo && repo.state === "untrusted");
      if (!known)
        throw new Error("This directory is not a discovered repository awaiting Git trust.");
      const accept = l10n.t("startup.trust");
      const answer = await vscode.window.showWarningMessage(
        l10n.t("startup.trustConfirm", msg.repo),
        { modal: true },
        accept
      );
      if (answer === accept) {
        await trustGitRepository(msg.repo, deps.config.gitPath());
        closeEngineRepository(msg.repo);
        deps.outputChannel?.appendLine(`[repos] Git trust granted for ${JSON.stringify(msg.repo)}`);
      }
    } catch (error_) {
      error = normalizeGitError(error_).message;
      deps.outputChannel?.appendLine(`[repos] trust failed: ${error}`);
    } finally {
      trusting = false;
    }
    await refresh(error, true);
  });
  return {
    refresh,
    clearFailure: () => {
      shown = null;
    }
  };
}
