import type { GitCommitDetails, GitCommitNode } from "./git.types";

export type GitQueryError = {
  message: string;
  stderr: string | null;
  exitCode: number | null;
  task: string | null;
};

type QueryPayloads = {
  commitDetails: {
    request: { repo: string; commitHash: string };
    response: { commitDetails: GitCommitDetails | null; error: GitQueryError | null };
  };
  loadBranches: {
    request: { showRemoteBranches: boolean; hard: boolean };
    response: {
      branches: string[];
      head: string | null;
      hard: boolean;
      isRepo: boolean;
      error: GitQueryError | null;
    };
  };
  loadCommits: {
    request: {
      repo: string;
      branchName: string;
      maxCommits: number;
      showRemoteBranches: boolean;
      hard: boolean;
    };
    response: {
      commits: GitCommitNode[];
      head: string | null;
      moreCommitsAvailable: boolean;
      hard: boolean;
      error: GitQueryError | null;
    };
  };
};

export type QueryRequest = {
  [K in keyof QueryPayloads]: { command: K } & QueryPayloads[K]["request"];
}[keyof QueryPayloads];

export type QueryResponse = {
  [K in keyof QueryPayloads]: { command: K } & QueryPayloads[K]["response"];
}[keyof QueryPayloads];

export type QueryResult<T extends keyof QueryPayloads> = QueryPayloads[T]["response"];
