import type {
  GitCommitDetails,
  GitCommitNode,
  GitCommitSearchResult,
  GitCommitSignature,
  GitRepoInfo,
  GitTagDetails,
  GitUncommittedChanges
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
};

type LoadCommitsResult = {
  commits: GitCommitNode[];
  head: string | null;
  moreCommitsAvailable: boolean;
  hard: boolean;
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

type QueryPayloads = {
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
