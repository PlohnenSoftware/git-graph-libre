import * as vscode from "vscode";

import { getPathFromStr, getPathFromUri } from "./backend/utils/path";

const gitFileChangeRegex =
  /^\.git\/(config|index|HEAD|packed-refs|refs\/stash|refs\/heads\/.*|refs\/remotes\/.*|refs\/tags\/.*)$/;

type WatcherKind = "repo" | "git";

type WorkspaceApi = Pick<typeof vscode.workspace, "createFileSystemWatcher">;
type RelativePatternFactory = (base: string, pattern: string) => vscode.GlobPattern;

function createRelativePattern(base: string, pattern: string): vscode.GlobPattern {
  return new vscode.RelativePattern(base, pattern);
}

function normalizeRepoPath(repo: string) {
  const normalized = getPathFromStr(repo);
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function shouldRefreshRepoPath(relativePath: string) {
  return relativePath !== ".git" && !relativePath.startsWith(".git/");
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
    this.repo = normalizeRepoPath(repo);
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
    if (kind === "git" && !gitFileChangeRegex.test(relativePath)) return;
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
