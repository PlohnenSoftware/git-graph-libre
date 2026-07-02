import type { GitResetMode } from "./git.types";

export type GitCommandStatus = string | null;
export const GIT_PUSH_BRANCH_MODES = ["normal", "force-with-lease", "force"] as const;
export type GitPushBranchMode = (typeof GIT_PUSH_BRANCH_MODES)[number];
export const GIT_CONFIG_SCOPES = ["local", "global"] as const;
export type GitConfigScope = (typeof GIT_CONFIG_SCOPES)[number];

type ActionPayloads = {
  addRemote: { name: string; fetchUrl: string; pushUrl: string | null; fetch: boolean };
  addTag: { tagName: string; commitHash: string; lightweight: boolean; message: string };
  applyStash: { selector: string; reinstateIndex: boolean };
  branchFromStash: { selector: string; branchName: string };
  checkoutBranch: { branchName: string; remoteBranch: string | null };
  checkoutCommit: { commitHash: string };
  cherrypickCommit: { commitHash: string; parentIndex: number };
  cleanUntrackedFiles: { includeDirectories: boolean };
  createBranch: { commitHash: string; branchName: string };
  createPullRequest: {
    branchName: string;
    remoteName: string;
    remoteUrl: string;
    baseBranch: string;
    urlTemplate: string;
    pushBeforeCreate: boolean;
  };
  deleteBranch: { branchName: string; forceDelete: boolean; deleteOnRemotes?: string[] };
  deleteRemote: { name: string };
  deleteRemoteBranch: { branchName: string; remote: string };
  deleteTag: { tagName: string };
  deleteUserDetails: {
    scope: GitConfigScope;
    unsetName: boolean;
    unsetEmail: boolean;
  };
  dropStash: { selector: string };
  fetchIntoLocalBranch: {
    remote: string;
    remoteBranch: string;
    localBranch: string;
    force: boolean;
  };
  fetchRemotes: { remote?: string | null; prune: boolean; pruneTags: boolean };
  dropCommit: { commitHash: string };
  editHeadCommitMessage: { commitHash: string; message: string };
  editRemote: { oldName: string; name: string; fetchUrl: string; pushUrl: string | null };
  editUserDetails: {
    name: string;
    email: string;
    scope: GitConfigScope;
    clearLocalName: boolean;
    clearLocalEmail: boolean;
  };
  exportRepoConfig: unknown;
  mergeBranch: { branchName: string; createNewCommit: boolean; squash: boolean; noCommit: boolean };
  mergeCommit: { commitHash: string; createNewCommit: boolean; squash: boolean; noCommit: boolean };
  popStash: { selector: string; reinstateIndex: boolean };
  pruneRemote: { name: string };
  pullBranch: { branchName: string; remote: string; createNewCommit: boolean; squash: boolean };
  pushBranch: {
    branchName: string;
    remotes: string[];
    setUpstream: boolean;
    mode: GitPushBranchMode;
  };
  pushStash: { message: string; includeUntracked: boolean };
  pushTag: { tagName: string };
  renameBranch: { oldName: string; newName: string };
  resetUncommittedChanges: { resetMode: Exclude<GitResetMode, "soft"> };
  resetToCommit: { commitHash: string; resetMode: GitResetMode };
  rebaseCurrentBranch: {
    target: string;
    targetType: "branch" | "commit";
    ignoreDate: boolean;
    interactive: boolean;
  };
  updateBranchFromUpstream: { branchName: string; force: boolean };
  revertCommit: { commitHash: string; parentIndex: number };
  undoLastCommit: unknown;
};

export type ActionRequest = {
  [K in keyof ActionPayloads]: { command: K; repo: string } & ActionPayloads[K];
}[keyof ActionPayloads];

export type ActionResponse = {
  [K in keyof ActionPayloads]: { command: K; status: GitCommandStatus };
}[keyof ActionPayloads];

export type ActionPayload<T extends keyof ActionPayloads> = ActionPayloads[T];
