import * as vscode from "vscode";

import { type GitDirs, resolveGitDirs } from "./backend/utils/gitDirs";
import { getPathFromStr, getPathFromUri } from "./backend/utils/path";

// Files in the git dir that holds this worktree's own HEAD and index.
const watchedGitDirFiles = new Set(["HEAD", "index"]);
// Files and ref folders in the common dir, shared by every worktree.
const watchedCommonFiles = new Set(["config", "packed-refs", "refs/stash"]);
const watchedCommonRefPrefixes = ["refs/heads/", "refs/remotes/", "refs/tags/"];
// Admin files of a linked worktree, below `worktrees/<id>/`.
const watchedWorktreeFiles = new Set(["HEAD", "locked", "gitdir"]);
const worktreesPrefix = "worktrees/";

type WatcherKind = "repo" | "gitDir" | "commonDir" | "sharedDir";
type ResolveGitDirs = (repo: string) => GitDirs;

type WorkspaceApi = Pick<typeof vscode.workspace, "createFileSystemWatcher">;
type RelativePatternFactory = (base: string, pattern: string) => vscode.GlobPattern;

function createRelativePattern(base: string, pattern: string): vscode.GlobPattern {
  return new vscode.RelativePattern(base, pattern);
}

function trimTrailingSlashes(path: string) {
  let end = path.length;
  while (end > 1 && path[end - 1] === "/") {
    end--;
  }
  return end === path.length ? path : path.slice(0, end);
}

function normalizeRepoPath(repo: string) {
  const normalized = getPathFromStr(repo);
  return trimTrailingSlashes(normalized);
}

function shouldRefreshRepoPath(relativePath: string) {
  return relativePath !== ".git" && !relativePath.startsWith(".git/");
}

function isWorktreeAdminPath(relativePath: string) {
  if (!relativePath.startsWith(worktreesPrefix)) return false;
  const parts = relativePath.slice(worktreesPrefix.length).split("/");
  // `worktrees/<id>` appearing or vanishing is a worktree added or removed.
  if (parts.length === 1) return parts[0] !== "";
  return parts.length === 2 && watchedWorktreeFiles.has(parts[1]);
}

function shouldRefreshCommonPath(relativePath: string) {
  return (
    watchedCommonFiles.has(relativePath) ||
    watchedCommonRefPrefixes.some((prefix) => relativePath.startsWith(prefix)) ||
    isWorktreeAdminPath(relativePath)
  );
}

function shouldRefreshGitPath(kind: Exclude<WatcherKind, "repo">, relativePath: string) {
  if (kind === "gitDir") return watchedGitDirFiles.has(relativePath);
  if (kind === "commonDir") return shouldRefreshCommonPath(relativePath);
  return watchedGitDirFiles.has(relativePath) || shouldRefreshCommonPath(relativePath);
}

export class RepoFileWatcher {
  private readonly bases = new Map<WatcherKind, string>();
  private readonly repoChangeCallback: () => void;
  private readonly workspace: WorkspaceApi;
  private readonly relativePattern: RelativePatternFactory;
  private readonly resolveDirs: ResolveGitDirs;
  private readonly debounceDelay: number;
  private readonly resumeDelay: number;
  private watchers: vscode.FileSystemWatcher[] = [];
  private refreshTimeout: NodeJS.Timeout | null = null;
  private muted: boolean = false;
  private resumeAt: number = 0;

  constructor(
    repoChangeCallback: () => void,
    workspace: WorkspaceApi = vscode.workspace,
    relativePattern: RelativePatternFactory = createRelativePattern,
    debounceDelay = 750,
    resumeDelay = 1500,
    resolveDirs: ResolveGitDirs = resolveGitDirs
  ) {
    this.repoChangeCallback = repoChangeCallback;
    this.workspace = workspace;
    this.relativePattern = relativePattern;
    this.resolveDirs = resolveDirs;
    this.debounceDelay = debounceDelay;
    this.resumeDelay = resumeDelay;
  }

  public start(repo: string) {
    this.stop();
    const normalized = normalizeRepoPath(repo);
    if (normalized === "") {
      // An empty repo path (no repositories left) has nothing to watch.
      return;
    }
    const dirs = this.resolveDirs(normalized);
    const gitDir = normalizeRepoPath(dirs.gitDir);
    const commonDir = normalizeRepoPath(dirs.commonDir);
    const repoWatcher = this.createWatcher(normalized, "**", "repo");
    // A linked worktree's own HEAD and index sit apart from the shared refs.
    const gitWatchers =
      gitDir === commonDir
        ? [this.createWatcher(gitDir, "**", "sharedDir")]
        : [
            this.createWatcher(gitDir, "**", "gitDir"),
            this.createWatcher(commonDir, "**", "commonDir")
          ];
    this.watchers.push(repoWatcher, ...gitWatchers);
  }

  public stop() {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
    this.bases.clear();
    if (this.refreshTimeout !== null) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  public mute() {
    this.muted = true;
  }

  public unmute() {
    this.muted = false;
    this.resumeAt = Date.now() + this.resumeDelay;
  }

  private createWatcher(base: string, pattern: string, kind: WatcherKind) {
    this.bases.set(kind, base);
    const watcher = this.workspace.createFileSystemWatcher(this.relativePattern(base, pattern));
    watcher.onDidCreate((uri) => this.refresh(uri, kind));
    watcher.onDidChange((uri) => this.refresh(uri, kind));
    watcher.onDidDelete((uri) => this.refresh(uri, kind));
    return watcher;
  }

  private relativePath(uri: vscode.Uri, kind: WatcherKind) {
    const base = this.bases.get(kind);
    if (base === undefined) return null;
    const path = getPathFromUri(uri);
    if (path === base) return "";

    const basePrefix = `${base}/`;
    if (!path.startsWith(basePrefix)) return null;
    return path.slice(basePrefix.length);
  }

  private refresh(uri: vscode.Uri, kind: WatcherKind) {
    if (this.muted) return;
    const relativePath = this.relativePath(uri, kind);
    if (relativePath === null) return;
    if (kind === "repo" && !shouldRefreshRepoPath(relativePath)) return;
    if (kind !== "repo" && !shouldRefreshGitPath(kind, relativePath)) return;
    if (Date.now() < this.resumeAt) return;

    if (this.refreshTimeout !== null) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(() => {
      this.refreshTimeout = null;
      this.repoChangeCallback();
    }, this.debounceDelay);
  }
}
