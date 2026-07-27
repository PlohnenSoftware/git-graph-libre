import * as vscode from "vscode";

import { doesPathExist, getPathFromUri, isDirectory } from "@/backend/utils/path";
import type { Config } from "@/config";

import type { RepoManager } from "./repoManager";
import type { RepoSearch } from "./workspaceSearch";

type WorkspaceApi = Pick<
  typeof vscode.workspace,
  "createFileSystemWatcher" | "onDidChangeWorkspaceFolders" | "workspaceFolders"
>;

export function createRepoWatcher(
  repoManager: RepoManager,
  config: Config,
  repoSearch: RepoSearch,
  workspace: WorkspaceApi = vscode.workspace,
  debounceDelay = 1000
) {
  const folderWatchers: { [workspace: string]: vscode.FileSystemWatcher } = {};
  const createEventPaths: string[] = [];
  const changeEventPaths: string[] = [];
  let processCreateEventsTimeout: NodeJS.Timeout | null = null;
  let processChangeEventsTimeout: NodeJS.Timeout | null = null;

  async function processCreateEvents() {
    let changes = false;
    while (createEventPaths.length > 0) {
      const path = createEventPaths.shift();
      if (path === undefined) break;
      if (await isDirectory(path)) {
        if (await repoSearch.searchDirectoryForRepos(path, config.maxDepthOfRepoSearch()))
          changes = true;
      }
    }
    processCreateEventsTimeout = null;
    if (changes) repoManager.sendRepos();
  }

  async function processChangeEvents() {
    let changes = false;
    while (changeEventPaths.length > 0) {
      const path = changeEventPaths.shift();
      if (path === undefined) break;
      if (!(await doesPathExist(path))) {
        if (repoManager.removeReposWithinFolder(path)) changes = true;
      }
    }
    processChangeEventsTimeout = null;
    if (changes) repoManager.sendRepos();
  }

  async function onWatcherCreate(uri: vscode.Uri) {
    let path = getPathFromUri(uri);
    if (path.includes("/.git/")) return;
    if (path.endsWith("/.git")) path = path.slice(0, -5);
    if (createEventPaths.includes(path)) return;

    createEventPaths.push(path);
    if (processCreateEventsTimeout !== null) clearTimeout(processCreateEventsTimeout);
    processCreateEventsTimeout = setTimeout(() => processCreateEvents(), debounceDelay);
  }

  function onWatcherChange(uri: vscode.Uri) {
    let path = getPathFromUri(uri);
    if (path.includes("/.git/")) return;
    if (path.endsWith("/.git")) path = path.slice(0, -5);
    if (changeEventPaths.includes(path)) return;

    changeEventPaths.push(path);
    if (processChangeEventsTimeout !== null) clearTimeout(processChangeEventsTimeout);
    processChangeEventsTimeout = setTimeout(() => processChangeEvents(), debounceDelay);
  }

  function onWatcherDelete(uri: vscode.Uri) {
    let path = getPathFromUri(uri);
    if (path.includes("/.git/")) return;
    if (path.endsWith("/.git")) path = path.slice(0, -5);
    if (repoManager.removeReposWithinFolder(path)) repoManager.sendRepos();
  }

  function startWatchingFolder(path: string) {
    const watcher = workspace.createFileSystemWatcher(`${path}/**`);
    watcher.onDidCreate((uri) => onWatcherCreate(uri));
    watcher.onDidChange((uri) => onWatcherChange(uri));
    watcher.onDidDelete((uri) => onWatcherDelete(uri));
    folderWatchers[path] = watcher;
  }

  function stopWatchingFolder(path: string) {
    folderWatchers[path].dispose();
    delete folderWatchers[path];
  }

  async function handleAddedWorkspaceFolders(folders: readonly vscode.WorkspaceFolder[]) {
    let changes = false;
    for (const folder of folders) {
      const path = getPathFromUri(folder.uri);
      if (await repoSearch.searchDirectoryForRepos(path, config.maxDepthOfRepoSearch()))
        changes = true;
      startWatchingFolder(path);
    }
    if (changes) repoManager.sendRepos();
  }

  function handleRemovedWorkspaceFolders(folders: readonly vscode.WorkspaceFolder[]) {
    let changes = false;
    for (const folder of folders) {
      const path = getPathFromUri(folder.uri);
      if (repoManager.removeReposWithinFolder(path)) changes = true;
      stopWatchingFolder(path);
    }
    if (changes) repoManager.sendRepos();
  }

  const folderChangeHandler = workspace.onDidChangeWorkspaceFolders(async (e) => {
    if (e.added.length > 0) {
      await handleAddedWorkspaceFolders(e.added);
    }
    if (e.removed.length > 0) {
      handleRemovedWorkspaceFolders(e.removed);
    }
  });

  return {
    startWatching() {
      const rootFolders = workspace.workspaceFolders;
      if (rootFolders !== undefined) {
        for (const folder of rootFolders) {
          startWatchingFolder(getPathFromUri(folder.uri));
        }
      }
    },
    dispose() {
      folderChangeHandler.dispose();
      const folders = Object.keys(folderWatchers);
      for (const folder of folders) {
        stopWatchingFolder(folder);
      }
    }
  };
}

export type RepoWatcher = ReturnType<typeof createRepoWatcher>;
