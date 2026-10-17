import * as vscode from "vscode";

import { closeEngineRepository } from "@/backend/engine/index";
import { getPathFromUri } from "@/backend/utils/path";
import { evalPromises } from "@/backend/utils/promise";
import { inspectRepository } from "@/backend/utils/repositoryProbe";
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
  const unavailable = new Set<string>();
  let viewCallback: ((repos: GitRepoSet, numRepos: number) => void) | null = null;

  function getRepos() {
    return sortRepos(
      Object.fromEntries(Object.entries(repos).filter(([repo]) => !unavailable.has(repo)))
    );
  }

  function sendRepos() {
    const sorted = getRepos();
    const numRepos = Object.keys(sorted).length;
    statusBarItem.setNumRepos(numRepos);
    if (viewCallback !== null) viewCallback(sorted, numRepos);
  }

  function removeRepo(repo: string) {
    delete repos[repo];
    unavailable.delete(repo);
    extensionState.saveRepos(repos);
    // Every removal path funnels through here, so the engine handle is
    // dropped in exactly one place. Best effort: removal must succeed
    // whether or not the engine cooperates.
    closeEngineRepository(repo);
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
    unavailable.delete(repo);
    if (repos[repo]) return;
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

  async function checkReposExist() {
    const repoPaths = Object.keys(repos);
    let changes = false;
    const results = await evalPromises(repoPaths, 3, (path) =>
      inspectRepository(path, { gitPath: config.gitPath(), useEngine: config.backend() === "auto" })
    );
    for (let i = 0; i < repoPaths.length; i++) {
      if (results[i].state === "notRepository") {
        removeRepo(repoPaths[i]);
        changes = true;
      } else if (results[i].state !== "ready") {
        // Only the transition closes the engine handle and counts as a
        // change; re-checks of an already-hidden repository (the startup
        // screen polls) must not re-close and re-publish every cycle.
        if (!unavailable.has(repoPaths[i])) {
          unavailable.add(repoPaths[i]);
          closeEngineRepository(repoPaths[i]);
          changes = true;
        }
      } else if (unavailable.delete(repoPaths[i])) {
        changes = true;
      }
    }
    if (changes) sendRepos();
    return changes;
  }

  return {
    registerViewCallback,
    deregisterViewCallback,
    getRepos,
    getKnownRepos: () => sortRepos(repos),
    setRepoUnavailable(repo: string) {
      if (unavailable.has(repo)) return;
      unavailable.add(repo);
      closeEngineRepository(repo);
    },
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
