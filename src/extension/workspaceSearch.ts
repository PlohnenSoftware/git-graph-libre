import * as vscode from "vscode";

import { getPathFromUri } from "@/backend/utils/path";
import { searchDirectoryForRepos as searchDirectoryForReposUtil } from "@/backend/utils/repoSearch";
import type { Config } from "@/config";
import { inspectRepository } from "@/backend/utils/repositoryProbe";
import { traceRequest } from "@/backend/utils/operationLog";
import type { RepositoryProbe } from "@/types";

import type { RepoManager } from "./repoManager";
import type { Logger } from "./utils/logger";

export type ScanLogger = Pick<Logger, "log" | "warn">;

/**
 * Which log level a workspace scan summary deserves. An empty scan is worth
 * a warning rather than silence: with no repositories found the usual cause
 * a user can act on is a wrong `git.path`, so the summary names the binary
 * and the warning is what makes it visible.
 */
export function scanLogLevel(totalRepos: number): "log" | "warn" {
  return totalRepos === 0 ? "warn" : "log";
}

export function createRepoSearch(repoManager: RepoManager, config: Config, logger?: ScanLogger) {
  let maxDepthOfRepoSearch = config.maxDepthOfRepoSearch();

  let diagnostics = new Map<string, RepositoryProbe>();
  let inFlight: Promise<void> | null = null;

  async function probe(directory: string): Promise<boolean> {
    const result = await inspectRepository(directory, {
      gitPath: config.gitPath(), useEngine: config.backend() === "auto"
    });
    diagnostics.set(directory, result);
    logger?.log(`[repos] probe path=${JSON.stringify(directory)} state=${result.state} repository=${result.repository} via=${result.detectedBy ?? "unknown"}${result.detail ? ` detail=${JSON.stringify(result.detail)}` : ""}`);
    // Known but blocked roots stop recursion, and remain visible in diagnostics.
    return result.state === "ready" || result.state === "untrusted" || result.repository === true;
  }

  async function searchDirectoryForRepos(directory: string, maxDepth: number): Promise<boolean> {
    const found = await searchDirectoryForReposUtil(
      directory, maxDepth, config.gitPath(), [], probe
    );
    let changed = false;
    for (const repo of found) {
      if (diagnostics.get(repo)?.state !== "ready") continue;
      repoManager.addRepo(repo);
      changed = true;
    }
    return changed;
  }

  async function scanWorkspace(): Promise<void> {
    diagnostics = new Map();
    const roots = (vscode.workspace.workspaceFolders ?? []).map(folder => getPathFromUri(folder.uri));
    for (const repo of Object.keys(repoManager.getKnownRepos())) {
      await probe(repo);
      const state = diagnostics.get(repo)?.state;
      if (state === "notRepository") repoManager.removeRepo(repo);
      else if (state !== "ready") repoManager.setRepoUnavailable(repo);
      else repoManager.addRepo(repo);
    }
    for (const root of roots) await searchDirectoryForRepos(root, maxDepthOfRepoSearch);
    // Always publish completion, including an empty result: a failure screen
    // needs updated evidence just as much as a graph needs a repository list.
    repoManager.sendRepos();
    const total = Object.keys(repoManager.getRepos()).length;
    const message = `[repos] workspace scan complete: ${total} ${total === 1 ? "repository" : "repositories"} (git: "${config.gitPath()}", depth: ${maxDepthOfRepoSearch})`;
    if (total === 0) logger?.warn(message);
    else logger?.log(message);
  }

  function searchWorkspaceForRepos(force = false): Promise<void> {
    if (inFlight) return force ? inFlight.then(() => searchWorkspaceForRepos()) : inFlight;
    inFlight = traceRequest("discoverRepositories", null, scanWorkspace).finally(() => { inFlight = null; });
    return inFlight;
  }

  return {
    getDiagnostics() {
      const roots = (vscode.workspace.workspaceFolders ?? []).map(folder => getPathFromUri(folder.uri));
      return {
        roots,
        repositories: [...diagnostics.values()].filter(result =>
          roots.includes(result.path) || result.state === "untrusted" || result.repository === true ||
          (result.state === "error" && result.repository !== false)
        )
      };
    },
    searchDirectoryForRepos,
    searchWorkspaceForRepos,
    maxDepthChanged() {
      const newDepth = config.maxDepthOfRepoSearch();
      if (newDepth > maxDepthOfRepoSearch) {
        maxDepthOfRepoSearch = newDepth;
        void searchWorkspaceForRepos();
      } else {
        maxDepthOfRepoSearch = newDepth;
      }
    }
  };
}

export type RepoSearch = ReturnType<typeof createRepoSearch>;
