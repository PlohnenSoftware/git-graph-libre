import * as vscode from "vscode";

import { getPathFromUri } from "@/backend/utils/path";
import { searchDirectoryForRepos as searchDirectoryForReposUtil } from "@/backend/utils/repoSearch";
import type { Config } from "@/config";

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

  async function searchDirectoryForRepos(directory: string, maxDepth: number): Promise<boolean> {
    const found = await searchDirectoryForReposUtil(
      directory,
      maxDepth,
      config.gitPath(),
      Object.keys(repoManager.getRepos())
    );
    for (const repo of found) {
      repoManager.addRepo(repo);
    }
    return found.length > 0;
  }

  async function searchWorkspaceForRepos() {
    const gitBinary = config.gitPath();
    const rootFolders = vscode.workspace.workspaceFolders;
    let changes = false;
    if (rootFolders !== undefined) {
      for (const folder of rootFolders) {
        const path = getPathFromUri(folder.uri);
        if (await searchDirectoryForRepos(path, maxDepthOfRepoSearch)) changes = true;
      }
    }
    if (changes) repoManager.sendRepos();
    // Name the binary and the depth on every scan: when a scan comes back
    // empty because `git.path` points at something unusable, this line is
    // the diagnosis. Repository paths stay out of the log.
    const total = Object.keys(repoManager.getRepos()).length;
    const context = `(git: "${gitBinary}", depth: ${maxDepthOfRepoSearch})`;
    if (scanLogLevel(total) === "warn") {
      logger?.warn(
        `[repos] workspace scan found no repositories ${context}; ` +
          `if this is unexpected, check the "git.path" setting`
      );
    } else {
      const noun = total === 1 ? "repository" : "repositories";
      logger?.log(`[repos] workspace scan complete: ${total} ${noun} ${context}`);
    }
  }

  return {
    searchDirectoryForRepos,
    searchWorkspaceForRepos,
    maxDepthChanged() {
      const newDepth = config.maxDepthOfRepoSearch();
      if (newDepth > maxDepthOfRepoSearch) {
        maxDepthOfRepoSearch = newDepth;
        searchWorkspaceForRepos();
      } else {
        maxDepthOfRepoSearch = newDepth;
      }
    }
  };
}

export type RepoSearch = ReturnType<typeof createRepoSearch>;
