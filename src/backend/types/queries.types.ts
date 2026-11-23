import type {
  GitCommitDetails,
  GitCommitNode,
  GitCommitSearchResult,
  GitCommitSignature,
  GitRepoInfo,
  GitTagDetails,
  GitUncommittedChanges,
  GitWorktree
} from "./git.types";

export const COMMIT_ORDERINGS = ["date", "author-date", "topo"] as const;
export type CommitOrdering = (typeof COMMIT_ORDERINGS)[number];

export type GitQueryError = {
  message: string;
  stderr: string | null;
  exitCode: number | null;
  task: string | null;
};

type CommitDetailsResult = {
  commitDetails: GitCommitDetails | null;
  error: GitQueryError | null;
};

type LoadBranchesResult = {
  branches: string[];
  head: string | null;
  hard: boolean;
  isRepo: boolean;
  error: GitQueryError | null;
  /** Every worktree, in Git's order. Empty when the list could not be read (logged, never an error). */
  worktrees: GitWorktree[];
  /** Local branch to the short name of its upstream, or null when it tracks nothing. */
  upstreams: Record<string, string | null>;
};

type LoadCommitsResult = {
  commits: GitCommitNode[];
  head: string | null;
  moreCommitsAvailable: boolean;
  hard: boolean;
  error: GitQueryError | null;
};

type BranchPushDefaultsResult = {
  /** The remote the branch's upstream tracks, or null when it has no upstream. */
  upstreamRemote: string | null;
  /** The remote plain `git push` uses for the branch, or null when Git names none. */
  pushRemote: string | null;
  error: GitQueryError | null;
};

type CommitSignaturesResult = {
  /** Keyed by commit hash: the signature, or null for an unsigned commit. */
  signatures: Record<string, GitCommitSignature | null>;
  error: GitQueryError | null;
};

type LoadRepoInfoResult = {
  repoInfo: GitRepoInfo;
  error: GitQueryError | null;
};

type SearchCommitsResult = {
  results: GitCommitSearchResult[];
  error: GitQueryError | null;
};

type TagDetailsResult = {
  tagName: string;
  tagDetails: GitTagDetails | null;
  error: GitQueryError | null;
};

type UncommittedDetailsResult = {
  changes: GitUncommittedChanges | null;
  error: GitQueryError | null;
};

type WorktreeChangesResult = {
  /** The worktree that was read, as listed by Git. */
  path: string;
  /** Uncommitted and untracked paths, at most `MAX_WORKTREE_CHANGES` in the worktree actions. */
  files: string[];
  /** True when the worktree has more changes than `files` lists. */
  truncated: boolean;
  error: GitQueryError | null;
};

/**
 * Whether a linked worktree has uncommitted or untracked files: `unknown` when
 * the read failed or timed out, which is never shown as `clean`.
 */
export type WorktreeChangeStatus = {
  state: "clean" | "dirty" | "unknown";
  /** The changed paths counted, at most the worktree actions' path limit; zero unless dirty. */
  count: number;
  /** True when the worktree has more changes than `count` counts. */
  truncated: boolean;
};

type QueryPayloads = {
  worktreeStatus: {
    request: { requestId: number; repo: string; paths: string[] };
    result: { statuses: Record<string, WorktreeChangeStatus> };
    /** Keyed by each requested path as it was sent; `repo` lets the webview drop an answer for another repository. */
    response: { requestId: number; repo: string } & {
      statuses: Record<string, WorktreeChangeStatus>;
    };
  };
  worktreeChanges: {
    request: { requestId: number; repo: string; path: string };
    result: WorktreeChangesResult;
    response: { requestId: number } & WorktreeChangesResult;
  };
  remoteTags: {
    request: { requestId: number; repo: string };
    result: {
      tags: Record<string, { hash: string; remotes: string[] }>;
      unavailableRemotes: string[];
      error: GitQueryError | null;
    };
    response: { requestId: number; repo: string } & QueryPayloads["remoteTags"]["result"];
  };
  branchPushDefaults: {
    request: { requestId: number; repo: string; branch: string };
    result: BranchPushDefaultsResult;
    response: { requestId: number } & BranchPushDefaultsResult;
  };
  commitDetails: {
    request: { repo: string; commitHash: string };
    result: CommitDetailsResult;
    response: CommitDetailsResult;
  };
  commitSignatures: {
    request: { requestId: number; repo: string; hashes: string[] };
    result: CommitSignaturesResult;
    /** `repo` comes back so an answer for a repository no longer shown is dropped. */
    response: { requestId: number; repo: string } & CommitSignaturesResult;
  };
  commitComparison: {
    request: { repo: string; commitHash: string; baseRef: string; compareRef: string };
    result: CommitDetailsResult;
    response: CommitDetailsResult;
  };
  loadBranches: {
    request: {
      requestId: number;
      showRemoteBranches: boolean;
      hiddenRemotes?: string[];
      hard: boolean;
    };
    result: LoadBranchesResult;
    response: { requestId: number } & LoadBranchesResult;
  };
  loadCommits: {
    request: {
      requestId: number;
      repo: string;
      branchName: string;
      branches?: string[] | null;
      authors?: string[] | null;
      tags?: string[] | null;
      maxCommits: number;
      showRemoteBranches: boolean;
      hiddenRemotes?: string[];
      showTags: boolean;
      includeReflog: boolean;
      includeUnreachableCommits: boolean;
      onlyFollowFirstParent: boolean;
      commitOrdering: CommitOrdering;
      showStashes?: boolean;
      hard: boolean;
      /** Serve this one load with the Git CLI whatever the backend setting says. */
      forceCli?: boolean;
    };
    result: LoadCommitsResult;
    response: { requestId: number } & LoadCommitsResult;
  };
  loadRepoInfo: {
    request: { requestId: number; repo: string; showStashes: boolean; forceCli?: boolean };
    result: LoadRepoInfoResult;
    response: { requestId: number } & LoadRepoInfoResult;
  };
  searchCommits: {
    request: {
      requestId: number;
      repo: string;
      query: string;
      maxResults: number;
      showRemoteBranches: boolean;
      hiddenRemotes?: string[];
      showTags: boolean;
      branches?: string[] | null;
      authors?: string[] | null;
      tags?: string[] | null;
    };
    result: SearchCommitsResult;
    response: { requestId: number } & SearchCommitsResult;
  };
  tagDetails: {
    request: { repo: string; tagName: string };
    result: TagDetailsResult;
    response: TagDetailsResult;
  };
  uncommittedDetails: {
    request: { repo: string };
    result: UncommittedDetailsResult;
    response: UncommittedDetailsResult;
  };
};

export type QueryRequest = {
  [K in keyof QueryPayloads]: { command: K } & QueryPayloads[K]["request"];
}[keyof QueryPayloads];

export type QueryResponse = {
  [K in keyof QueryPayloads]: { command: K } & QueryPayloads[K]["response"];
}[keyof QueryPayloads];

export type QueryResult<T extends keyof QueryPayloads> = QueryPayloads[T]["result"];

/** One reflog entry: the move a ref made, as Git recorded it. */
export type GitReflogEntry = {
  /** The commit the ref pointed at after the move. */
  hash: string;
  /** The `N` of `<ref>@{N}`. Git skips some entries when it numbers them, so these can have gaps. */
  index: number;
  /** When the entry was written, in Unix seconds. This is not the commit's own date. */
  time: number;
  /** Who made the entry (the committer identity Git used at the time). */
  name: string;
  email: string;
  /** The message exactly as Git wrote it, for example `commit: fix typo`. */
  message: string;
};

/**
 * What a reflog holds: `entries` (the page has entries, or lies past the end
 * of a reflog that has some), `empty` (a reflog exists but holds nothing) or
 * `none` (the ref keeps no reflog).
 */
export type GitReflogState = "entries" | "empty" | "none";

export type GitReflogResult = {
  /** The requested page, newest first. Empty on an error. */
  entries: GitReflogEntry[];
  /** Null exactly when `error` is set. */
  state: GitReflogState | null;
  /** True when older entries exist beyond this page. */
  hasMore: boolean;
  /** The ref's full name, such as `refs/heads/main`, or `HEAD`. Null on an error. */
  ref: string | null;
  error: GitQueryError | null;
};

/**
 * Whether the commit a reflog entry points at can still be reached without
 * the reflog: `reachable` from a branch, tag or remote-tracking ref,
 * `reflogOnly` when the object exists but only reflogs reach it, or
 * `missing` when the object no longer exists.
 */
export type GitReflogEntryState = "reachable" | "reflogOnly" | "missing";

export type GitReflogEntryStatesResult = {
  /**
   * The known state of each requested commit, by hash. A hash with no entry
   * is unknown: the read failed, or the name was not a commit's full hash.
   * Empty whenever `error` is set.
   */
  states: Record<string, GitReflogEntryState>;
  error: GitQueryError | null;
};

/** The kinds `classifyReflogMessage` knows. The set is open: treat any other value as `other`. */
export type GitReflogMessageKind =
  | "commit"
  | "checkout"
  | "reset"
  | "rebase"
  | "merge"
  | "pull"
  | "fetch"
  | "cherry-pick"
  | "revert"
  | "branch"
  | "stash"
  | "clone"
  | "other";

export type GitReflogMessageClass = {
  kind: GitReflogMessageKind;
  /** The detail, such as `pick` for `rebase (pick)` or `amend` for `commit (amend)`; null when none. */
  sub: string | null;
  /** The message, unchanged. */
  raw: string;
};
