import type { GitResetMode } from "./git.types";

export type GitCommandStatus = string | null;
export const GIT_PUSH_BRANCH_MODES = ["normal", "force-with-lease", "force"] as const;
export type GitPushBranchMode = (typeof GIT_PUSH_BRANCH_MODES)[number];
export const GIT_CONFIG_SCOPES = ["local", "global"] as const;
export type GitConfigScope = (typeof GIT_CONFIG_SCOPES)[number];

type ActionPayloads = {
  addRemote: { name: string; fetchUrl: string; pushUrl: string | null; fetch: boolean };
  addTag: { tagName: string; commitHash: string } & (
    | { lightweight: true; message?: never }
    | { lightweight: false; message?: string }
  );
  applyStash: { selector: string; reinstateIndex: boolean };
  branchFromStash: { selector: string; branchName: string };
  checkoutBranch: { branchName: string; remoteBranch: string | null };
  /**
   * Switches to an existing local branch, then fast-forwards it to `target`
   * (the remote-tracking ref the user clicked) with `merge --ff-only`. Never
   * a merging pull: when the branches have diverged Git refuses, and the
   * branch stays checked out, unchanged.
   */
  checkoutAndFastForward: { branchName: string; target: string };
  checkoutCommit: { commitHash: string };
  cherrypickCommit: { commitHash: string; parentIndex: number; noCommit: boolean };
  cleanUntrackedFiles: { includeDirectories: boolean };
  createArchive: { ref: string };
  createBranch: { commitHash: string; branchName: string; checkout?: boolean };
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
  deleteTag: { tagName: string; deleteOnRemotes?: string[] };
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
  fetchTags: { remotes: string[]; pruneTags: boolean };
  dropCommit: { commitHash: string };
  dropCommitSelection: { commitHashes: string[] };
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
  mergeBranch: {
    branchName: string;
    createNewCommit: boolean;
    squash: boolean;
    noCommit: boolean;
    noVerify: boolean;
  };
  mergeCommit: {
    commitHash: string;
    createNewCommit: boolean;
    squash: boolean;
    noCommit: boolean;
    noVerify: boolean;
  };
  popStash: { selector: string; reinstateIndex: boolean };
  pruneRemote: { name: string };
  pullBranch: {
    branchName: string;
    remote: string;
    createNewCommit: boolean;
    squash: boolean;
    noCommit: boolean;
    noVerify: boolean;
  };
  pushAllTags: {
    remotes: string[];
    mode: GitPushBranchMode;
    noVerify: boolean;
  };
  pushBranch: {
    branchName: string;
    remotes: string[];
    setUpstream: boolean;
    mode: GitPushBranchMode;
    noVerify: boolean;
  };
  pushStash: { message: string; includeUntracked: boolean };
  pushTag: {
    tagName: string;
    remotes: string[];
    mode: GitPushBranchMode;
    noVerify: boolean;
  };
  renameBranch: { oldName: string; newName: string };
  resetUncommittedChanges: { resetMode: Exclude<GitResetMode, "soft"> };
  resetFileToRevision: { commitHash: string; filePath: string };
  resetToCommit: { commitHash: string; resetMode: GitResetMode };
  rebaseCurrentBranch: {
    target: string;
    targetType: "branch" | "commit";
    ignoreDate: boolean;
    interactive: boolean;
  };
  updateBranchFromUpstream: { branchName: string; force: boolean };
  revertCommit: { commitHash: string; parentIndex: number; noCommit: boolean };
  squashCommitSelection: { commitHashes: string[]; message: string; noVerify: boolean };
  stageFiles: { filePaths: string[] };
  unstageFiles: { filePaths: string[] };
  undoLastCommit: unknown;
  /**
   * Removes a linked worktree with plain `git worktree remove`. `force` is sent
   * only after the user confirmed the loss of its uncommitted and untracked
   * files; `unlock` unlocks a locked worktree first (it is never forced twice).
   * `deleteBranch` runs once the worktree is gone, for the Delete Branch dialog.
   */
  /**
   * Creates a linked worktree with `git worktree add`. Exactly one checkout
   * mode is sent: `branch` checks that branch out, `newBranch` creates it at
   * `startPoint` (which may be a remote branch, a commit or a tag), and
   * `detach` leaves a detached HEAD at `startPoint`. `lockReason` is null for
   * no lock, "" to lock without a reason, and text to lock with that reason.
   */
  addWorktree: {
    path: string;
    branch: string | null;
    newBranch: string | null;
    startPoint: string | null;
    detach: boolean;
    lockReason: string | null;
  };
  removeWorktree: {
    path: string;
    force: boolean;
    unlock: boolean;
    deleteBranch?: { branchName: string; forceDelete: boolean; deleteOnRemotes?: string[] };
  };
  /**
   * Opens a listed worktree in a new window or this one, adds it to the
   * workspace, reveals it in the OS file manager, or switches the graph to it.
   * The extension refuses a path Git no longer lists, and a stale entry.
   */
  openWorktree: { path: string; newWindow: boolean };
  addWorktreeToWorkspace: { path: string };
  revealWorktree: { path: string };
  switchGraphToWorktree: { path: string };
  pruneWorktrees: unknown;
  /** `path` is the stale entry; `newPath` is the folder it moved to, or null to ask the user. */
  repairWorktree: { path: string; newPath: string | null };
};

export type ActionRequest = {
  [K in keyof ActionPayloads]: { command: K; repo: string } & ActionPayloads[K];
}[keyof ActionPayloads];

export type ActionResponse = {
  [K in keyof ActionPayloads]: { command: K; status: GitCommandStatus };
}[keyof ActionPayloads];

export type ActionPayload<T extends keyof ActionPayloads> = ActionPayloads[T];
