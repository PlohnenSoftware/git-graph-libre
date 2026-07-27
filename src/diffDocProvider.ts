import * as vscode from "vscode";

import type { GitInstance } from "./backend/gitClient";
import { getPathFromStr } from "./backend/utils/path";

export class DiffDocProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = "git-graph-libre";
  private readonly gitClient: GitInstance;
  private readonly onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly docs = new Map<string, DiffDocument>();
  private readonly subscriptions: vscode.Disposable;

  constructor(gitClient: GitInstance) {
    this.gitClient = gitClient;
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
    const document = this.docs.get(uri.toString());
    if (document) return document.value;

    const request = decodeDiffDocUri(uri);
    return this.gitClient()
      .cwd(request.repo)
      .show([`${request.commit}:${request.filePath}`])
      .catch(() => "")
      .then((data) => {
        const doc = new DiffDocument(data);
        this.docs.set(uri.toString(), doc);
        return doc.value;
      });
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
