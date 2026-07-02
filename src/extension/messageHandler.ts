import * as path from "node:path";

import * as vscode from "vscode";

import type { AvatarManager } from "@/avatarManager";
import { checkoutBranch, createBranch, deleteBranch, renameBranch } from "@/backend/actions/branch";
import {
  checkoutCommit,
  cherrypickCommit,
  resetToCommit,
  revertCommit
} from "@/backend/actions/commit";
import { mergeBranch, mergeCommit } from "@/backend/actions/merge";
import { addTag, deleteTag, pushTag } from "@/backend/actions/tag";
import type { GitClient } from "@/backend/gitClient";
import { commitDetails } from "@/backend/queries/commitDetails";
import { loadBranches } from "@/backend/queries/loadBranches";
import { loadCommits } from "@/backend/queries/loadCommits";
import { loadRepoInfo } from "@/backend/queries/loadRepoInfo";
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
import type { RequestMessage, ResponseMessage } from "@/types";

import type { RepoManager } from "./repoManager";
import type { WebviewBridge } from "./webviewBridge";

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
  const title =
    pathComponents[pathComponents.length - 1] +
    " (" +
    (type === "A"
      ? l10n.t("diff.addedIn", abbrevHash)
      : type === "D"
        ? l10n.t("diff.deletedIn", abbrevHash)
        : `${abbrevHash}^ ↔ ${abbrevHash}`) +
    ")";
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

function resolveRepoFilePath(repo: string, filePath: string): string | null {
  const repoRoot = path.resolve(repo);
  const absolutePath = path.resolve(repoRoot, filePath);
  const relativePath = path.relative(repoRoot, absolutePath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }
  return absolutePath;
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

  // --- Action handlers ---

  registerAction("addTag", (msg) => addTag(gitClient.getInstance(), msg));
  registerAction("deleteTag", (msg) => deleteTag(gitClient.getInstance(), msg));
  registerAction("pushTag", (msg) => pushTag(gitClient.getInstance(), msg));
  registerAction("createBranch", (msg) => createBranch(gitClient.getInstance(), msg));
  registerAction("deleteBranch", (msg) => deleteBranch(gitClient.getInstance(), msg));
  registerAction("renameBranch", (msg) => renameBranch(gitClient.getInstance(), msg));
  registerAction("checkoutBranch", (msg) => checkoutBranch(gitClient.getInstance(), msg));
  registerAction("checkoutCommit", (msg) => checkoutCommit(gitClient.getInstance(), msg));
  registerAction("cherrypickCommit", (msg) => cherrypickCommit(gitClient.getInstance(), msg));
  registerAction("revertCommit", (msg) => revertCommit(gitClient.getInstance(), msg));
  registerAction("resetToCommit", (msg) => resetToCommit(gitClient.getInstance(), msg));
  registerAction("mergeBranch", (msg) => mergeBranch(gitClient.getInstance(), msg));
  registerAction("mergeCommit", (msg) => mergeCommit(gitClient.getInstance(), msg));

  // --- Query handlers ---

  bridge.onMessage("loadCommits", async (msg) => {
    bridge.post({
      command: "loadCommits",
      requestId: msg.requestId,
      ...(await loadCommits(gitClient.getInstance(), {
        branchName: msg.branchName,
        maxCommits: msg.maxCommits,
        showRemoteBranches: msg.showRemoteBranches,
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

  bridge.onMessage("openFile", async (msg) => {
    bridge.post({
      command: "openFile",
      success: await openFile(msg.repo, msg.filePath)
    });
  });

  return {
    onPanelShown: () => {
      currentRepo = null;
    }
  };
}
