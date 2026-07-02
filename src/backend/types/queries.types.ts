import type {
  GitCommitDetails,
  GitCommitNode,
  GitCommitSearchResult,
  GitRepoInfo
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

type LoadRepoInfoResult = {
  repoInfo: GitRepoInfo;
  error: GitQueryError | null;
};

type SearchCommitsResult = {
  results: GitCommitSearchResult[];
  error: GitQueryError | null;
};

type QueryPayloads = {
  commitDetails: {
    request: { repo: string; commitHash: string };
    result: CommitDetailsResult;
    response: CommitDetailsResult;
  };
  loadBranches: {
    request: { requestId: number; showRemoteBranches: boolean; hard: boolean };
    result: LoadBranchesResult;
    response: { requestId: number } & LoadBranchesResult;
  };
  loadCommits: {
    request: {
      requestId: number;
      repo: string;
      branchName: string;
      maxCommits: number;
      showRemoteBranches: boolean;
      showTags: boolean;
      includeReflog: boolean;
      onlyFollowFirstParent: boolean;
      commitOrdering: CommitOrdering;
      hard: boolean;
    };
    result: LoadCommitsResult;
    response: { requestId: number } & LoadCommitsResult;
  };
  loadRepoInfo: {
    request: { requestId: number; repo: string; showStashes: boolean };
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
      showTags: boolean;
    };
    result: SearchCommitsResult;
    response: { requestId: number } & SearchCommitsResult;
  };
};

export type QueryRequest = {
  [K in keyof QueryPayloads]: { command: K } & QueryPayloads[K]["request"];
}[keyof QueryPayloads];

export type QueryResponse = {
  [K in keyof QueryPayloads]: { command: K } & QueryPayloads[K]["response"];
}[keyof QueryPayloads];

export type QueryResult<T extends keyof QueryPayloads> = QueryPayloads[T]["result"];
