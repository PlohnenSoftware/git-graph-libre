import * as vscode from "vscode";

import { getPathFromStr, getPathFromUri } from "./backend/utils/path";

const watchedGitFiles = new Set([
  ".git/config",
  ".git/index",
  ".git/HEAD",
  ".git/packed-refs",
  ".git/refs/stash"
]);
const watchedGitRefPrefixes = [".git/refs/heads/", ".git/refs/remotes/", ".git/refs/tags/"];

type WatcherKind = "repo" | "git";

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

function shouldRefreshGitPath(relativePath: string) {
  return (
    watchedGitFiles.has(relativePath) ||
    watchedGitRefPrefixes.some((prefix) => relativePath.startsWith(prefix))
  );
}

export class RepoFileWatcher {
  private repo: string | null = null;
  private readonly repoChangeCallback: () => void;
  private readonly workspace: WorkspaceApi;
  private readonly relativePattern: RelativePatternFactory;
  private readonly debounceDelay: number;
  private readonly resumeDelay: number;
  private repoWatcher: vscode.FileSystemWatcher | null = null;
  private gitWatcher: vscode.FileSystemWatcher | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private muted: boolean = false;
  private resumeAt: number = 0;

  constructor(
    repoChangeCallback: () => void,
    workspace: WorkspaceApi = vscode.workspace,
    relativePattern: RelativePatternFactory = createRelativePattern,
    debounceDelay = 750,
    resumeDelay = 1500
  ) {
    this.repoChangeCallback = repoChangeCallback;
    this.workspace = workspace;
    this.relativePattern = relativePattern;
    this.debounceDelay = debounceDelay;
    this.resumeDelay = resumeDelay;
  }

  public start(repo: string) {
    this.stop();
    const normalized = normalizeRepoPath(repo);
    if (normalized === "") {
      // An empty repo path (no repositories left) has nothing to watch.
      this.repo = null;
      return;
    }
    this.repo = normalized;
    this.repoWatcher = this.createWatcher("**", "repo");
    this.gitWatcher = this.createWatcher(".git/**", "git");
  }

  public stop() {
    if (this.repoWatcher !== null) {
      this.repoWatcher.dispose();
      this.repoWatcher = null;
    }
    if (this.gitWatcher !== null) {
      this.gitWatcher.dispose();
      this.gitWatcher = null;
    }
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

  private createWatcher(pattern: string, kind: WatcherKind) {
    const repo = this.repo;
    if (repo === null) throw new Error("Cannot create repo watcher before repo is set");

    const watcher = this.workspace.createFileSystemWatcher(this.relativePattern(repo, pattern));
    watcher.onDidCreate((uri) => this.refresh(uri, kind));
    watcher.onDidChange((uri) => this.refresh(uri, kind));
    watcher.onDidDelete((uri) => this.refresh(uri, kind));
    return watcher;
  }

  private relativePath(uri: vscode.Uri) {
    if (this.repo === null) return null;
    const path = getPathFromUri(uri);
    if (path === this.repo) return "";

    const repoPrefix = `${this.repo}/`;
    if (!path.startsWith(repoPrefix)) return null;
    return path.slice(repoPrefix.length);
  }

  private refresh(uri: vscode.Uri, kind: WatcherKind) {
    if (this.muted) return;
    const relativePath = this.relativePath(uri);
    if (relativePath === null) return;
    if (kind === "repo" && !shouldRefreshRepoPath(relativePath)) return;
    if (kind === "git" && !shouldRefreshGitPath(relativePath)) return;
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
