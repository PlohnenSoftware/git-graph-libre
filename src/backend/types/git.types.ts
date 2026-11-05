/* Git Data Model Types */

export type GitRef = {
  hash: string;
  name: string;
  type: "head" | "tag" | "remote";
  /**
   * Only set on `tag` refs. `true` when the tag is an annotated tag object that
   * carries a signature block. Lightweight tags have no tag object and can never
   * be signed, so they are always `false`. This flag reports only the presence of
   * a signature; use the `tagDetails` query to verify it.
   */
  signed?: boolean;
};

export type GitRefData = {
  head: string | null;
  refs: GitRef[];
};

export type GitCommitSignatureStatus =
  | "valid"
  | "valid-untrusted"
  | "bad"
  | "expired"
  | "expired-key"
  | "revoked-key"
  | "unverifiable"
  | "unknown";

export type GitCommitSignature = {
  status: GitCommitSignatureStatus;
  key: string | null;
  signer: string | null;
};

export type GitCommitNode = {
  hash: string;
  parentHashes: string[];
  author: string;
  email: string;
  date: number;
  message: string;
  refs: GitRef[];
  /**
   * Undefined until the webview has read it through the `commitSignatures`
   * query — the graph load never verifies signatures, so the page renders
   * without waiting for GPG. Null for an unsigned commit, and for stash rows,
   * which are never verified.
   */
  signature?: GitCommitSignature | null;
  /**
   * Present only on synthetic stash rows injected beside their base commit.
   * `ref` is the `stash@{n}` selector as resolved by the same load that built
   * the row; it is never cached across refreshes because selectors renumber
   * whenever a stash is dropped or popped.
   */
  stash?: { ref: string };
};

export type GitLogEntry = {
  hash: string;
  parentHashes: string[];
  author: string;
  email: string;
  date: number;
  message: string;
};

export type GitCommitSearchResult = GitLogEntry & {
  loadCount: number;
};

export type GitFileChange = {
  oldFilePath: string;
  newFilePath: string;
  type: GitFileChangeType;
  additions: number | null;
  deletions: number | null;
  /** Present only in a stash's untracked-files commit (its third parent). */
  untracked?: true;
};

export type GitUncommittedFile = {
  /** Repository-relative worktree path shown in the staged/unstaged lists. */
  path: string;
  /** Pre-rename path when the index entry is a rename or copy, otherwise null. */
  oldPath: string | null;
  /** Index (staged) status letter, or null when the file has no staged change. */
  stagedKind: string | null;
  /** Worktree (unstaged) status letter, or null when the file has no unstaged change. */
  unstagedKind: string | null;
};

export type GitUncommittedChanges = {
  staged: GitUncommittedFile[];
  unstaged: GitUncommittedFile[];
};

export type GitCommitDetails = {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  authorDate: number;
  committer: string;
  committerEmail: string;
  committerDate: number;
  body: string;
  fileChanges: GitFileChange[];
};

export type GitTagSignatureStatus = "valid" | "bad" | "failed" | "unknown";

export type GitTagSignature = {
  status: GitTagSignatureStatus;
  key: string | null;
  signer: string | null;
};

export type GitTagDetails = {
  tagName: string;
  type: "annotated" | "lightweight";
  objectHash: string;
  targetHash: string;
  targetType: string;
  taggerName: string | null;
  taggerEmail: string | null;
  taggerDate: number | null;
  subject: string;
  body: string;
  signature: GitTagSignature | null;
};

export type GitRemote = {
  name: string;
  fetchUrls: string[];
  pushUrls: string[];
};

export type GitStash = {
  index: number;
  ref: string;
  hash: string;
  message: string;
  date: number | null;
  /**
   * The commit the stash was taken from (parent 0 of the stash commit), used
   * to place the stash's graph row beside its base. Null when the base cannot
   * be resolved; such stashes render in the stash list only.
   */
  sourceHash: string | null;
};

/**
 * One worktree of a repository, as `git worktree list --porcelain -z` reports
 * it. Git is the authority: nothing here is inferred from the file system.
 */
export type GitWorktree = {
  /** Absolute path, as Git prints it. */
  path: string;
  /** Commit at HEAD; null only for a bare main repository. */
  head: string | null;
  /** Branch name with `refs/heads/` stripped; null when detached or bare. */
  branch: string | null;
  detached: boolean;
  bare: boolean;
  /** The first record Git lists. */
  isMain: boolean;
  /** The repository asked about, compared by canonical path. */
  isCurrent: boolean;
  /** Reason is "" when the worktree is locked without one. */
  locked: { reason: string } | null;
  /** Reason is "" when Git gives none. Prunable also means "moved by hand". */
  prunable: { reason: string } | null;
};

export type GitConfigValue = {
  local: string | null;
  global: string | null;
};

export type GitRepoConfig = {
  userName: GitConfigValue;
  userEmail: GitConfigValue;
};

export type GitRepoInfo = {
  isRepo: boolean;
  head: string | null;
  headCommit: string | null;
  authors: string[];
  tags: string[];
  remotes: GitRemote[];
  stashes: GitStash[];
  stashCount: number;
  config: GitRepoConfig;
};

export type GitFileChangeType = "A" | "M" | "D" | "R" | "T";
export type DateType = "Author Date" | "Commit Date";
export type GitResetMode = "soft" | "mixed" | "hard";
