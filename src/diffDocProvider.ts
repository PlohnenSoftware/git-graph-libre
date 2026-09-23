import * as vscode from "vscode";

import { loadEngineAddon, type EngineAddon } from "./backend/engine/addon";
import { parseEngineCommitFile } from "./backend/engine/details";
import type { GitInstance } from "./backend/gitClient";
import { getPathFromStr } from "./backend/utils/path";
import type { EngineBackend } from "./types";

/** The slice of the engine addon file content reads need. */
export type FileContentAddon = Pick<EngineAddon, "loadCommitFile">;

export type DiffDocProviderDeps = {
  /** Read live on every load, so flipping the backend needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => FileContentAddon | null;
};

export class DiffDocProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = "git-graph-libre";
  private readonly gitClient: GitInstance;
  private readonly backend: () => EngineBackend;
  private readonly addonProvider: () => FileContentAddon | null;
  private readonly onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly docs = new Map<string, DiffDocument>();
  private readonly subscriptions: vscode.Disposable;

  constructor(gitClient: GitInstance, deps: DiffDocProviderDeps = {}) {
    this.gitClient = gitClient;
    this.backend = deps.backend ?? (() => "git-cli");
    this.addonProvider = deps.addonProvider ?? (() => loadEngineAddon());
    this.subscriptions = vscode.workspace.onDidCloseTextDocument((doc) =>
      this.docs.delete(doc.uri.toString())
    );
  }

  public dispose() {
    this.subscriptions.dispose();
    this.docs.clear();
    this.onDidChangeEventEmitter.dispose();
  }

  get onDidChange() {
    return this.onDidChangeEventEmitter.event;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
    const key = uri.toString();
    const document = this.docs.get(key);
    if (document) return document.value;

    const request = decodeDiffDocUri(uri);
    return this.readFromEngine(request).then((engineText) => {
      if (engineText !== null) {
        const doc = new DiffDocument(engineText);
        this.docs.set(key, doc);
        return doc.value;
      }
      return this.gitClient()
        .cwd(request.repo)
        .show([`${request.commit}:${request.filePath}`])
        .catch(() => "")
        .then((data) => {
          const doc = new DiffDocument(data);
          this.docs.set(key, doc);
          return doc.value;
        });
    });
  }

  /**
   * One file's text from the engine, or null when the CLI must serve it:
   * the git-cli preference, no loadable addon, any engine throw, a
   * malformed payload, or the binary marker (the CLI's byte-identical
   * binary presentation, not an empty document).
   */
  private async readFromEngine(request: {
    repo: string;
    commit: string;
    filePath: string;
  }): Promise<string | null> {
    if (this.backend() !== "auto") return null;
    const addon = this.addonProvider();
    if (addon === null) return null;
    try {
      const file = parseEngineCommitFile(
        await addon.loadCommitFile(request.repo, request.commit, request.filePath)
      );
      if (file === null || file.binary || file.contents === null) return null;
      return file.contents;
    } catch {
      return null;
    }
  }
}

class DiffDocument {
  private readonly body: string;

  constructor(body: string) {
    this.body = body;
  }

  get value() {
    return this.body;
  }
}

export function encodeDiffDocUri(repo: string, path: string, commit: string): vscode.Uri {
  return vscode.Uri.parse(
    DiffDocProvider.scheme +
      ":" +
      getPathFromStr(path) +
      "?commit=" +
      encodeURIComponent(commit) +
      "&repo=" +
      encodeURIComponent(repo)
  );
}

export function decodeDiffDocUri(uri: vscode.Uri) {
  const queryArgs = decodeUriQueryArgs(uri.query);
  return { filePath: uri.path, commit: queryArgs.commit, repo: queryArgs.repo };
}

function decodeUriQueryArgs(query: string) {
  const queryComps = query.split("&");
  const queryArgs: { [key: string]: string } = {};
  for (const queryComp of queryComps) {
    const pair = queryComp.split("=");
    queryArgs[pair[0]] = decodeURIComponent(pair[1]);
  }
  return queryArgs;
}
