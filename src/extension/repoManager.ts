import * as vscode from "vscode";

import { isGitRepository } from "@/backend/utils/git";
import { getPathFromUri } from "@/backend/utils/path";
import { evalPromises } from "@/backend/utils/promise";
import type { Config } from "@/config";
import type { ExtensionState } from "@/extensionState";
import type { StatusBarItem } from "@/statusBarItem";
import type { GitRepoSet, GitRepoState } from "@/types";

function sortRepos(repos: GitRepoSet) {
  const repoPaths = Object.keys(repos).toSorted((a, b) => a.localeCompare(b));
  const sorted: GitRepoSet = {};
  for (const repoPath of repoPaths) {
    sorted[repoPath] = repos[repoPath];
  }
  return sorted;
}

export function createRepoManager(
  extensionState: ExtensionState,
  statusBarItem: StatusBarItem,
  config: Config
) {
  const repos = extensionState.getRepos();
  let viewCallback: ((repos: GitRepoSet, numRepos: number) => void) | null = null;

  function getRepos() {
    return sortRepos(repos);
  }

  function sendRepos() {
    const sorted = getRepos();
    const numRepos = Object.keys(sorted).length;
    statusBarItem.setNumRepos(numRepos);
    if (viewCallback !== null) viewCallback(sorted, numRepos);
  }

  function removeRepo(repo: string) {
    delete repos[repo];
    extensionState.saveRepos(repos);
  }

  function registerViewCallback(cb: (repos: GitRepoSet, numRepos: number) => void) {
    viewCallback = cb;
  }

  function deregisterViewCallback() {
    viewCallback = null;
  }

  function isDirectoryWithinRepos(path: string) {
    const repoPaths = Object.keys(repos);
    for (const repoPath of repoPaths) {
      if (path === repoPath || path.startsWith(`${repoPath}/`)) return true;
    }
    return false;
  }

  function addRepo(repo: string) {
    repos[repo] = { columnWidths: null };
    extensionState.saveRepos(repos);
  }

  function removeReposWithinFolder(path: string) {
    const pathFolder = `${path}/`;
    const repoPaths = Object.keys(repos);
    let changes = false;
    for (const repoPath of repoPaths) {
      if (repoPath === path || repoPath.startsWith(pathFolder)) {
        removeRepo(repoPath);
        changes = true;
      }
    }
    return changes;
  }

  function setRepoState(repo: string, state: GitRepoState) {
    repos[repo] = state;
    extensionState.saveRepos(repos);
  }

  function removeReposNotInWorkspace() {
    const rootsExact: string[] = [];
    const rootsFolder: string[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const repoPaths = Object.keys(repos);
    if (workspaceFolders !== undefined) {
      for (const folder of workspaceFolders) {
        const path = getPathFromUri(folder.uri);
        rootsExact.push(path);
        rootsFolder.push(`${path}/`);
      }
    }
    for (const repoPath of repoPaths) {
      if (
        !rootsExact.includes(repoPath) &&
        !rootsFolder.some((root) => repoPath.startsWith(root))
      ) {
        removeRepo(repoPath);
      }
    }
  }

  function checkReposExist() {
    return new Promise<boolean>((resolve) => {
      const repoPaths = Object.keys(repos);
      let changes = false;
      evalPromises(repoPaths, 3, (path) => isGitRepository(path, config.gitPath())).then(
        (results) => {
          for (let i = 0; i < repoPaths.length; i++) {
            if (!results[i]) {
              removeRepo(repoPaths[i]);
              changes = true;
            }
          }
          if (changes) sendRepos();
          resolve(changes);
        }
      );
    });
  }

  return {
    registerViewCallback,
    deregisterViewCallback,
    getRepos,
    isDirectoryWithinRepos,
    sendRepos,
    addRepo,
    removeRepo,
    removeReposWithinFolder,
    setRepoState,
    removeReposNotInWorkspace,
    checkReposExist
  };
}

export type RepoManager = ReturnType<typeof createRepoManager>;
