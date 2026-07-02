import * as path from "node:path";

import * as vscode from "vscode";

import type { AvatarManager } from "@/avatarManager";
import { checkoutBranch, createBranch, deleteBranch, renameBranch } from "@/backend/actions/branch";
import {
  deleteRemoteBranch,
  fetchIntoLocalBranch,
  pullBranch,
  pushBranch,
  updateBranchFromUpstream
} from "@/backend/actions/branchRemote";
import {
  checkoutCommit,
  cherrypickCommit,
  dropCommit,
  dropCommitSelection,
  editHeadCommitMessage,
  resetToCommit,
  revertCommit,
  squashCommitSelection,
  undoLastCommit
} from "@/backend/actions/commit";
import { resetFileToRevision } from "@/backend/actions/file";
import { mergeBranch, mergeCommit } from "@/backend/actions/merge";
import { rebaseCurrentBranch } from "@/backend/actions/rebase";
import {
  addRemote,
  deleteRemote,
  editRemote,
  fetchRemotes,
  pruneRemote
} from "@/backend/actions/remote";
import {
  applyStash,
  branchFromStash,
  cleanUntrackedFiles,
  dropStash,
  popStash,
  pushStash,
  resetUncommittedChanges
} from "@/backend/actions/stash";
import { addTag, deleteTag, pushTag } from "@/backend/actions/tag";
import { deleteUserDetails, editUserDetails } from "@/backend/actions/userConfig";
import type { GitClient } from "@/backend/gitClient";
import { commitDetails } from "@/backend/queries/commitDetails";
import { loadBranches } from "@/backend/queries/loadBranches";
import { loadCommits } from "@/backend/queries/loadCommits";
import { loadRepoInfo } from "@/backend/queries/loadRepoInfo";
import { searchCommits } from "@/backend/queries/searchCommits";
import type { GitFileChangeType } from "@/backend/types";
import { formatGitCommandRecord } from "@/backend/utils/gitCommandLog";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { abbrevCommit } from "@/backend/utils/string";
import type { Config } from "@/config";
import { encodeDiffDocUri } from "@/diffDocProvider";
import { copyToClipboard } from "@/extension/utils/clipboard";
import type { ExtensionState } from "@/extensionState";
import * as l10n from "@/l10n";
import type { RepoFileWatcher } from "@/repoFileWatcher";
import type { GitRepoState, RequestMessage, ResponseMessage } from "@/types";

import { buildPullRequestUrl } from "./pullRequest";
import { exportRepoConfigFile, importRepoConfigFile } from "./repoConfigFile";
import type { RepoManager } from "./repoManager";
import type { WebviewBridge } from "./webviewBridge";

function formatWebviewDiagnostic(msg: Extract<RequestMessage, { command: "webviewDiagnostic" }>) {
  const parts = [`[webview] ${msg.stage}`];
  if (msg.repo !== undefined) parts.push(`repo=${JSON.stringify(msg.repo)}`);
  if (msg.repoCount !== undefined) parts.push(`repos=${msg.repoCount}`);
  if (msg.requestId !== undefined && msg.requestId !== null) parts.push(`request=${msg.requestId}`);
  if (msg.message !== undefined) parts.push(`message=${JSON.stringify(msg.message)}`);
  return parts.join(" ");
}

async function viewDiff(
  repo: string,
  commitHash: string,
  oldFilePath: string,
  newFilePath: string,
  type: GitFileChangeType,
  shortHashLength: number
): Promise<boolean> {
  const abbrevHash = abbrevCommit(commitHash, shortHashLength);
  const pathComponents = newFilePath.split("/");
  const fileName = pathComponents.at(-1);
  const title = `${fileName} (${formatDiffTitle(type, abbrevHash)})`;
  try {
    await vscode.commands.executeCommand(
      "vscode.diff",
      encodeDiffDocUri(repo, oldFilePath, `${commitHash}^`),
      encodeDiffDocUri(repo, newFilePath, commitHash),
      title,
      { preview: true }
    );
    return true;
  } catch {
    return false;
  }
}

function formatDiffTitle(type: GitFileChangeType, abbrevHash: string) {
  if (type === "A") return l10n.t("diff.addedIn", abbrevHash);
  if (type === "D") return l10n.t("diff.deletedIn", abbrevHash);
  return `${abbrevHash}^ ↔ ${abbrevHash}`;
}

function resolveRepoFilePath(repo: string, filePath: string): string | null {
  const repoRoot = path.resolve(repo);
  const absolutePath = path.resolve(repoRoot, filePath);
  const relativePath = path.relative(repoRoot, absolutePath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }
  return absolutePath;
}

function resolveRepoRelativeFilePath(repo: string, filePath: string): string | null {
  const absolutePath = resolveRepoFilePath(repo, filePath);
  if (absolutePath === null) return null;
  return path.relative(path.resolve(repo), absolutePath).split(path.sep).join("/");
}

function getFileName(filePath: string) {
  return filePath.split("/").at(-1) ?? filePath;
}

async function viewFileAtRevision(
  repo: string,
  commitHash: string,
  filePath: string
): Promise<boolean> {
  const repoRelativePath = resolveRepoRelativeFilePath(repo, filePath);
  if (commitHash.trim() === "" || repoRelativePath === null) return false;

  try {
    const document = await vscode.workspace.openTextDocument(
      encodeDiffDocUri(repo, repoRelativePath, commitHash)
    );
    await vscode.window.showTextDocument(document, { preview: true });
    return true;
  } catch {
    return false;
  }
}

async function compareFileWithWorkingTree(
  repo: string,
  commitHash: string,
  filePath: string,
  shortHashLength: number
): Promise<boolean> {
  const repoRelativePath = resolveRepoRelativeFilePath(repo, filePath);
  const absolutePath = resolveRepoFilePath(repo, filePath);
  if (commitHash.trim() === "" || repoRelativePath === null || absolutePath === null) return false;

  const abbrevHash = abbrevCommit(commitHash, shortHashLength);
  const title = `${getFileName(repoRelativePath)} (${abbrevHash} ↔ ${l10n.t("diff.workingTree")})`;

  try {
    await vscode.commands.executeCommand(
      "vscode.diff",
      encodeDiffDocUri(repo, repoRelativePath, commitHash),
      vscode.Uri.file(absolutePath),
      title,
      { preview: true }
    );
    return true;
  } catch {
    return false;
  }
}

async function openFile(repo: string, filePath: string): Promise<boolean> {
  const absolutePath = resolveRepoFilePath(repo, filePath);
  if (absolutePath === null) return false;

  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
    await vscode.window.showTextDocument(document, { preview: true });
    return true;
  } catch {
    return false;
  }
}

async function openSourceControl(): Promise<boolean> {
  try {
    await vscode.commands.executeCommand("workbench.view.scm");
    return true;
  } catch {
    return false;
  }
}

async function openExternalUrl(url: string): Promise<boolean> {
  if (!isHttpUrl(url)) return false;
  try {
    return await vscode.env.openExternal(vscode.Uri.parse(url));
  } catch {
    return false;
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const shellSingleQuoteEscape = String.raw`'\''`;

function quoteTerminalArg(value: string) {
  return `'${value.replaceAll("'", shellSingleQuoteEscape)}'`;
}

function openInteractiveRebaseTerminal(
  msg: Extract<RequestMessage, { command: "rebaseCurrentBranch" }>
) {
  const targetLabel = msg.targetType === "commit" ? abbrevCommit(msg.target, 8) : msg.target;
  const terminal = vscode.window.createTerminal({
    name: `Git Graph Libre: Rebase on ${targetLabel}`,
    cwd: msg.repo
  });
  terminal.show();
  // The rebase target can be a branch/ref name, so quote it as one shell token
  // before sending the user-visible command to the VS Code terminal.
  terminal.sendText(`git rebase --interactive ${quoteTerminalArg(msg.target)}`);
}

export function registerMessageHandlers(
  bridge: WebviewBridge,
  deps: {
    config: Config;
    gitClient: GitClient;
    repoManager: RepoManager;
    extensionState: ExtensionState;
    avatarManager: AvatarManager;
    repoFileWatcher: RepoFileWatcher;
    outputChannel?: Pick<vscode.OutputChannel, "appendLine">;
  }
) {
  const {
    config,
    gitClient,
    repoManager,
    extensionState,
    avatarManager,
    repoFileWatcher,
    outputChannel
  } = deps;

  let currentRepo: string | null = null;
  const recordGitCommand: GitCommandRecorder | undefined = outputChannel
    ? (record) => {
        outputChannel.appendLine(formatGitCommandRecord(record));
        if (record.error?.stderr) outputChannel.appendLine(`  stderr: ${record.error.stderr}`);
      }
    : undefined;

  function registerAction<T extends RequestMessage["command"]>(
    command: T,
    handler: (msg: Extract<RequestMessage, { command: T }>) => Promise<void>
  ) {
    bridge.onMessage(command, async (msg) => {
      let status: string | null = null;
      try {
        await handler(msg);
      } catch (e: unknown) {
        status = e instanceof Error ? e.message : String(e);
      }
      bridge.post({ command, status } as ResponseMessage);
    });
  }

  function getKnownRepoState(repo: string): GitRepoState {
    const repoState = repoManager.getRepos()[repo];
    if (repoState === undefined) throw new Error("Unknown repository.");
    return repoState;
  }

  // --- Action handlers ---

  registerAction("addRemote", (msg) => addRemote(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("addTag", (msg) => addTag(gitClient.getInstance(), msg));
  registerAction("deleteTag", (msg) => deleteTag(gitClient.getInstance(), msg));
  registerAction("pushTag", (msg) => pushTag(gitClient.getInstance(), msg));
  registerAction("fetchRemotes", (msg) =>
    fetchRemotes(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("createBranch", (msg) => createBranch(gitClient.getInstance(), msg));
  registerAction("createPullRequest", async (msg) => {
    if (msg.pushBeforeCreate) {
      await pushBranch(
        gitClient.getInstance(),
        {
          repo: msg.repo,
          branchName: msg.branchName,
          remotes: [msg.remoteName],
          setUpstream: true,
          mode: "normal",
          noVerify: false
        },
        recordGitCommand
      );
    }
    const url = buildPullRequestUrl({
      branchName: msg.branchName,
      remoteName: msg.remoteName,
      remoteUrl: msg.remoteUrl,
      baseBranch: msg.baseBranch,
      urlTemplate: msg.urlTemplate
    });
    if (!(await openExternalUrl(url))) throw new Error("Unable to open pull request URL.");
  });
  registerAction("deleteBranch", (msg) =>
    deleteBranch(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("deleteRemote", (msg) =>
    deleteRemote(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("deleteRemoteBranch", (msg) =>
    deleteRemoteBranch(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("editRemote", (msg) => editRemote(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("fetchIntoLocalBranch", (msg) =>
    fetchIntoLocalBranch(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("pullBranch", (msg) => pullBranch(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("pruneRemote", (msg) =>
    pruneRemote(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("pushBranch", (msg) => pushBranch(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("updateBranchFromUpstream", (msg) =>
    updateBranchFromUpstream(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("renameBranch", (msg) => renameBranch(gitClient.getInstance(), msg));
  registerAction("checkoutBranch", (msg) => checkoutBranch(gitClient.getInstance(), msg));
  registerAction("checkoutCommit", (msg) =>
    checkoutCommit(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("cherrypickCommit", (msg) =>
    cherrypickCommit(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("dropCommit", (msg) => dropCommit(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("dropCommitSelection", (msg) =>
    dropCommitSelection(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("editHeadCommitMessage", (msg) =>
    editHeadCommitMessage(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("resetFileToRevision", (msg) =>
    resetFileToRevision(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("revertCommit", (msg) =>
    revertCommit(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("resetToCommit", (msg) =>
    resetToCommit(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("mergeBranch", (msg) =>
    mergeBranch(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("mergeCommit", (msg) =>
    mergeCommit(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("rebaseCurrentBranch", async (msg) => {
    if (msg.interactive) {
      openInteractiveRebaseTerminal(msg);
    } else {
      await rebaseCurrentBranch(gitClient.getInstance(), msg, recordGitCommand);
    }
  });
  registerAction("squashCommitSelection", (msg) =>
    squashCommitSelection(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("undoLastCommit", (msg) =>
    undoLastCommit(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("applyStash", (msg) => applyStash(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("branchFromStash", (msg) =>
    branchFromStash(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("dropStash", (msg) => dropStash(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("popStash", (msg) => popStash(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("pushStash", (msg) => pushStash(gitClient.getInstance(), msg, recordGitCommand));
  registerAction("resetUncommittedChanges", (msg) =>
    resetUncommittedChanges(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("cleanUntrackedFiles", (msg) =>
    cleanUntrackedFiles(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("editUserDetails", (msg) =>
    editUserDetails(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("deleteUserDetails", (msg) =>
    deleteUserDetails(gitClient.getInstance(), msg, recordGitCommand)
  );
  registerAction("exportRepoConfig", async (msg) => {
    const repoState = getKnownRepoState(msg.repo);
    repoFileWatcher.mute();
    try {
      await exportRepoConfigFile(msg.repo, repoState);
    } finally {
      repoFileWatcher.unmute();
    }
  });

  // --- Query handlers ---

  bridge.onMessage("loadCommits", async (msg) => {
    bridge.post({
      command: "loadCommits",
      requestId: msg.requestId,
      ...(await loadCommits(gitClient.getInstance(), {
        branchName: msg.branchName,
        branches: msg.branches,
        authors: msg.authors,
        tags: msg.tags,
        maxCommits: msg.maxCommits,
        showRemoteBranches: msg.showRemoteBranches,
        hiddenRemotes: msg.hiddenRemotes,
        showTags: msg.showTags,
        includeReflog: msg.includeReflog,
        onlyFollowFirstParent: msg.onlyFollowFirstParent,
        commitOrdering: msg.commitOrdering,
        hard: msg.hard,
        dateType: config.dateType(),
        showUncommittedChanges: config.showUncommittedChanges(),
        repo: msg.repo,
        recordGitCommand
      }))
    });
  });

  bridge.onMessage("loadBranches", async (msg) => {
    bridge.post({
      command: "loadBranches",
      requestId: msg.requestId,
      ...(await loadBranches(gitClient.getInstance(), {
        showRemoteBranches: msg.showRemoteBranches,
        hiddenRemotes: msg.hiddenRemotes,
        hard: msg.hard,
        currentRepo: currentRepo ?? "",
        gitPath: config.gitPath(),
        recordGitCommand
      }))
    });
  });

  bridge.onMessage("loadRepoInfo", async (msg) => {
    bridge.post({
      command: "loadRepoInfo",
      requestId: msg.requestId,
      ...(await loadRepoInfo(gitClient.getInstance(), {
        repo: msg.repo,
        showStashes: msg.showStashes,
        recordGitCommand
      }))
    });
  });

  bridge.onMessage("searchCommits", async (msg) => {
    bridge.post({
      command: "searchCommits",
      requestId: msg.requestId,
      ...(await searchCommits(gitClient.getInstance(), {
        query: msg.query,
        maxResults: msg.maxResults,
        showRemoteBranches: msg.showRemoteBranches,
        hiddenRemotes: msg.hiddenRemotes,
        showTags: msg.showTags,
        branches: msg.branches,
        authors: msg.authors,
        tags: msg.tags,
        dateType: config.dateType(),
        repo: msg.repo,
        recordGitCommand
      }))
    });
  });

  bridge.onMessage("commitDetails", async (msg) => {
    bridge.post({
      command: "commitDetails",
      ...(await commitDetails(gitClient.getInstance(), {
        commitHash: msg.commitHash,
        dateType: config.dateType(),
        repo: msg.repo,
        recordGitCommand
      }))
    });
  });

  // --- Infrastructure handlers ---

  bridge.onMessage("selectRepo", (msg) => {
    if (msg.repo === currentRepo) return;
    currentRepo = msg.repo;
    gitClient.setRepo(msg.repo);
    extensionState.setLastActiveRepo(msg.repo);
    repoFileWatcher.start(msg.repo);
  });

  bridge.onMessage("loadRepos", async (msg) => {
    if (!msg.check || !(await repoManager.checkReposExist())) {
      bridge.post({
        command: "loadRepos",
        repos: repoManager.getRepos(),
        lastActiveRepo: extensionState.getLastActiveRepo()
      });
    }
  });

  bridge.onMessage("webviewDiagnostic", (msg) => {
    outputChannel?.appendLine(formatWebviewDiagnostic(msg));
  });

  bridge.onMessage("importRepoConfig", async (msg) => {
    let status: string | null = null;
    let state: GitRepoState | null = null;
    try {
      state = await importRepoConfigFile(msg.repo, getKnownRepoState(msg.repo));
      repoManager.setRepoState(msg.repo, state);
    } catch (error: unknown) {
      status = error instanceof Error ? error.message : String(error);
    }
    bridge.post({ command: "importRepoConfig", repo: msg.repo, status, state });
  });

  bridge.onMessage("fetchAvatar", (msg) => {
    avatarManager.fetchAvatarImage(msg.email, msg.repo, msg.commits);
  });

  bridge.onMessage("saveRepoState", (msg) => {
    repoManager.setRepoState(msg.repo, msg.state);
  });

  bridge.onMessage("copyToClipboard", async (msg) => {
    bridge.post({
      command: "copyToClipboard",
      type: msg.type,
      success: await copyToClipboard(msg.data)
    });
  });

  bridge.onMessage("viewDiff", async (msg) => {
    bridge.post({
      command: "viewDiff",
      success: await viewDiff(
        msg.repo,
        msg.commitHash,
        msg.oldFilePath,
        msg.newFilePath,
        msg.type,
        config.shortHashLength()
      )
    });
  });

  bridge.onMessage("viewFileAtRevision", async (msg) => {
    bridge.post({
      command: "viewFileAtRevision",
      success: await viewFileAtRevision(msg.repo, msg.commitHash, msg.filePath)
    });
  });

  bridge.onMessage("compareFileWithWorkingTree", async (msg) => {
    bridge.post({
      command: "compareFileWithWorkingTree",
      success: await compareFileWithWorkingTree(
        msg.repo,
        msg.commitHash,
        msg.filePath,
        config.shortHashLength()
      )
    });
  });

  bridge.onMessage("openFile", async (msg) => {
    bridge.post({
      command: "openFile",
      success: await openFile(msg.repo, msg.filePath)
    });
  });

  bridge.onMessage("openSourceControl", async () => {
    bridge.post({
      command: "openSourceControl",
      success: await openSourceControl()
    });
  });

  bridge.onMessage("openExternalUrl", async (msg) => {
    bridge.post({
      command: "openExternalUrl",
      success: await openExternalUrl(msg.url)
    });
  });

  return {
    onPanelShown: () => {
      currentRepo = null;
    }
  };
}
