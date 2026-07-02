import type { GitResetMode } from "./git.types";

export type GitCommandStatus = string | null;
export const GIT_PUSH_BRANCH_MODES = ["normal", "force-with-lease", "force"] as const;
export type GitPushBranchMode = (typeof GIT_PUSH_BRANCH_MODES)[number];

type ActionPayloads = {
  addTag: { tagName: string; commitHash: string; lightweight: boolean; message: string };
  checkoutBranch: { branchName: string; remoteBranch: string | null };
  checkoutCommit: { commitHash: string };
  cherrypickCommit: { commitHash: string; parentIndex: number };
  createBranch: { commitHash: string; branchName: string };
  deleteBranch: { branchName: string; forceDelete: boolean; deleteOnRemotes?: string[] };
  deleteRemoteBranch: { branchName: string; remote: string };
  deleteTag: { tagName: string };
  fetchIntoLocalBranch: {
    remote: string;
    remoteBranch: string;
    localBranch: string;
    force: boolean;
  };
  fetchRemotes: { prune: boolean; pruneTags: boolean };
  mergeBranch: { branchName: string; createNewCommit: boolean };
  mergeCommit: { commitHash: string; createNewCommit: boolean };
  pullBranch: { branchName: string; remote: string; createNewCommit: boolean; squash: boolean };
  pushBranch: {
    branchName: string;
    remotes: string[];
    setUpstream: boolean;
    mode: GitPushBranchMode;
  };
  pushTag: { tagName: string };
  renameBranch: { oldName: string; newName: string };
  resetToCommit: { commitHash: string; resetMode: GitResetMode };
  updateBranchFromUpstream: { branchName: string; force: boolean };
  revertCommit: { commitHash: string; parentIndex: number };
};

export type ActionRequest = {
  [K in keyof ActionPayloads]: { command: K; repo: string } & ActionPayloads[K];
}[keyof ActionPayloads];

export type ActionResponse = {
  [K in keyof ActionPayloads]: { command: K; status: GitCommandStatus };
}[keyof ActionPayloads];

export type ActionPayload<T extends keyof ActionPayloads> = ActionPayloads[T];
