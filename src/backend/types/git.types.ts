/* Git Data Model Types */

export type GitRef = {
  hash: string;
  name: string;
  type: "head" | "tag" | "remote";
};

export type GitRefData = {
  head: string | null;
  refs: GitRef[];
};

export type GitCommitNode = {
  hash: string;
  parentHashes: string[];
  author: string;
  email: string;
  date: number;
  message: string;
  refs: GitRef[];
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
};

export type GitCommitDetails = {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  date: number;
  committer: string;
  body: string;
  fileChanges: GitFileChange[];
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
};

export type GitRepoConfig = {
  userName: string | null;
  userEmail: string | null;
};

export type GitRepoInfo = {
  isRepo: boolean;
  head: string | null;
  headCommit: string | null;
  remotes: GitRemote[];
  stashes: GitStash[];
  stashCount: number;
  config: GitRepoConfig;
};

export type GitFileChangeType = "A" | "M" | "D" | "R";
export type DateType = "Author Date" | "Commit Date";
export type GitResetMode = "soft" | "mixed" | "hard";
