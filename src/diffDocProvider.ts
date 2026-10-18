import * as vscode from "vscode";

import { type EngineAddon, loadEngineAddon } from "./backend/engine/addon";
import { parseEngineCommitFile } from "./backend/engine/details";
import type { GitInstance } from "./backend/gitClient";
import { runGitCommand } from "./backend/utils/gitRunner";
import { logBackendRoute } from "./backend/utils/operationLog";
import { getPathFromStr } from "./backend/utils/path";
import type { EngineBackend } from "./types";

/** The slice of the engine addon file content reads need. */
export type FileContentAddon = Pick<EngineAddon, "loadCommitFile">;

type DiffDocRequest = { repo: string; commit: string; filePath: string };

export type DiffDocProviderDeps = {
  /** Read live on every load, so flipping the backend needs no reload. */
  backend?: () => EngineBackend;
  addonProvider?: () => FileContentAddon | null;
  /** Whether Git confirmed it accepts the repository; see `RepoSearch.isVerified`. */
  isVerified?: (repo: string) => boolean;
};

export class DiffDocProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = "git-graph-libre";
  private readonly gitClient: GitInstance;
  private readonly backend: () => EngineBackend;
  private readonly addonProvider: () => FileContentAddon | null;
  private readonly isVerified: (repo: string) => boolean;
  private readonly onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly docs = new Map<string, DiffDocument>();
  private readonly subscriptions: vscode.Disposable;

  constructor(gitClient: GitInstance, deps: DiffDocProviderDeps = {}) {
    this.gitClient = gitClient;
    this.backend = deps.backend ?? (() => "git-cli");
    this.addonProvider = deps.addonProvider ?? (() => loadEngineAddon());
    this.isVerified = deps.isVerified ?? (() => false);
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

    return this.loadDocument(key, decodeDiffDocUri(uri));
  }

  private async loadDocument(key: string, request: DiffDocRequest): Promise<string> {
    const text = (await this.readFromEngine(request)) ?? (await this.readFromCli(request));
    const doc = new DiffDocument(text);
    this.docs.set(key, doc);
    return doc.value;
  }

  /** The file through `git show`; an unreadable revision is an empty document. */
  private readFromCli(request: DiffDocRequest): Promise<string> {
    const object = `${request.commit}:${request.filePath}`;
    return runGitCommand(() => this.gitClient().cwd(request.repo).show([object]), {
      label: "diffDoc.show",
      repo: request.repo,
      args: ["show", object]
    }).catch(() => "");
  }

  /**
   * One file's text from the engine, or null when the CLI must serve it:
   * the git-cli preference, no loadable addon, any engine throw, a
   * malformed payload, or the binary marker (the CLI's byte-identical
   * binary presentation, not an empty document).
   */
  private async readFromEngine(request: DiffDocRequest): Promise<string | null> {
    const viaCli = (reason: string) => {
      logBackendRoute("loadCommitFile", `backend=cli reason=${reason}`);
      return null;
    };
    if (this.backend() !== "auto") return viaCli("setting");
    if (!this.isVerified(request.repo)) return viaCli("unverified");
    const addon = this.addonProvider();
    if (addon === null) return viaCli("engineUnavailable");
    try {
      const file = parseEngineCommitFile(
        await addon.loadCommitFile(request.repo, request.commit, request.filePath)
      );
      if (file === null) return viaCli("malformedPayload");
      if (file.binary || file.contents === null) return viaCli("binaryFile");
      logBackendRoute("loadCommitFile", "backend=engine");
      return file.contents;
    } catch {
      return viaCli("engineThrew");
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
  const query = `commit=${encodeURIComponent(commit)}&repo=${encodeURIComponent(repo)}`;
  return vscode.Uri.parse(`${DiffDocProvider.scheme}:${getPathFromStr(path)}?${query}`);
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
