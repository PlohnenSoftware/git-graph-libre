import * as vscode from "vscode";

import { abbrevCommit } from "@/backend/utils/string";
import { config } from "@/config";
import { isValidCommitHash, isValidRecoveryBranchName } from "@/extension/reflogTab/reflogData";
import * as l10n from "@/l10n";
import type {
  ReflogLostCommit,
  ReflogLostCommitsFeedback,
  ReflogLostCommitsMessage,
  ReflogLostCommitsStatus,
  ReflogSource
} from "@/reflogTabTypes";

export type LostCommitsControllerDeps = {
  post: (message: ReflogLostCommitsMessage) => void;
  promptBranchName?: (options: vscode.InputBoxOptions) => Thenable<string | undefined>;
  onBranchCreated: () => void;
};

/**
 * Manages the opt-in lost-commit scan lifecycle and its "Create Branch Here…"
 * recovery action for one Reflog tab panel (F1-07). Keeps scan-id isolation,
 * AbortController cancellation, and cleanup on repository switch or disposal
 * separate from the main reflog paging loop.
 */
export function createLostCommitsController(deps: LostCommitsControllerDeps) {
  let scanId = 0;
  let currentRepo = "";
  let disposed = false;
  let abortController: AbortController | null = null;
  let last: ReflogLostCommitsMessage | null = null;

  const emit = (
    repo: string,
    status: ReflogLostCommitsStatus,
    commits: ReflogLostCommit[],
    error: string | null,
    busyHash: string | null,
    feedback: ReflogLostCommitsFeedback | null
  ) => {
    const message: ReflogLostCommitsMessage = {
      command: "reflogLostCommits",
      scanId,
      repo,
      status,
      commits,
      error,
      busyHash,
      feedback
    };
    last = message;
    if (!disposed) deps.post(message);
  };

  const abortInFlight = () => {
    if (abortController === null) return;
    const running = abortController;
    abortController = null;
    running.abort();
  };

  const prompt = (options: vscode.InputBoxOptions) =>
    deps.promptBranchName !== undefined
      ? deps.promptBranchName(options)
      : vscode.window.showInputBox(options);

  return {
    /** Replays the current lost-commit state when the webview signals ready. */
    postCurrent(): void {
      if (last !== null && !disposed) deps.post(last);
    },

    /** Resets when the panel switches to another repository, aborting any running scan. */
    reset(nextRepo: string): void {
      abortInFlight();
      currentRepo = nextRepo;
      scanId++;
      last = null;
    },

    /** Stops any running scan when the panel closes. */
    dispose(): void {
      disposed = true;
      abortInFlight();
    },

    async startScan(repo: string, source: ReflogSource | undefined): Promise<void> {
      if (disposed || repo === "" || source === undefined) return;
      abortInFlight();
      currentRepo = repo;
      const myScanId = ++scanId;

      if (source.scanLostCommits === undefined) {
        emit(repo, "error", [], "Lost-commit scanning is not available.", null, null);
        return;
      }

      const controller = new AbortController();
      abortController = controller;
      emit(repo, "scanning", [], null, null, null);

      const result = await source
        .scanLostCommits(repo, controller.signal)
        .catch((err: unknown) => ({
          commits: [],
          canceled: false,
          timedOut: false,
          error: err instanceof Error ? err.message : String(err)
        }));

      if (abortController === controller) abortController = null;
      if (disposed || myScanId !== scanId || currentRepo !== repo) return;

      if (result.canceled) {
        emit(repo, "canceled", [], null, null, null);
      } else if (result.timedOut) {
        emit(repo, "timedOut", [], result.error, null, null);
      } else if (result.error !== null) {
        emit(repo, "error", [], result.error, null, null);
      } else {
        emit(repo, "done", result.commits, null, null, null);
      }
    },

    cancelScan(repo: string): void {
      if (disposed || repo === "" || currentRepo !== repo) return;
      if (abortController === null && last?.status !== "scanning") return;
      abortInFlight();
      scanId++;
      emit(repo, "canceled", [], null, null, null);
    },

    close(repo: string): void {
      if (disposed || repo === "") return;
      abortInFlight();
      currentRepo = repo;
      scanId++;
      emit(repo, "idle", [], null, null, null);
    },

    async createBranchHere(
      repo: string,
      source: ReflogSource | undefined,
      rawHash: unknown
    ): Promise<void> {
      if (disposed || repo === "" || source?.createBranch === undefined) return;
      if (typeof rawHash !== "string" || !isValidCommitHash(rawHash)) return;
      if (last?.repo !== repo || last.status !== "done") return;
      if (!last.commits.some((commit) => commit.hash === rawHash)) return;

      const myScanId = scanId;
      const shortHash = abbrevCommit(rawHash, config.shortHashLength());
      const entered = await prompt({
        title: l10n.t("reflog.lostCommits.createBranch"),
        prompt: l10n.t("dialog.createBranch.title", shortHash),
        validateInput: (value) =>
          isValidRecoveryBranchName(value)
            ? undefined
            : l10n.t("reflog.lostCommits.invalidBranchName")
      });

      if (entered === undefined) return;
      const branchName = entered.trim();
      if (!isValidRecoveryBranchName(branchName)) return;
      if (disposed || myScanId !== scanId || currentRepo !== repo || last === null) return;

      const currentCommits = last.commits;
      emit(repo, "done", currentCommits, null, rawHash, null);

      const error = await source
        .createBranch(repo, rawHash, branchName)
        .catch((err: unknown) => (err instanceof Error ? err.message : String(err)));

      if (disposed || myScanId !== scanId || currentRepo !== repo) return;

      if (error !== null) {
        emit(repo, "done", currentCommits, null, null, {
          kind: "error",
          message: l10n.t("reflog.lostCommits.branchError", branchName, error)
        });
        return;
      }

      const remaining = currentCommits.filter((commit) => commit.hash !== rawHash);
      emit(repo, "done", remaining, null, null, {
        kind: "success",
        message: l10n.t("reflog.lostCommits.branchCreated", branchName, shortHash)
      });
      deps.onBranchCreated();
    }
  };
}
