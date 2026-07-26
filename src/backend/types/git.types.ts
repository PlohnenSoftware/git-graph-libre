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
  /** Undefined until signature verification has been requested for this commit. */
  signature?: GitCommitSignature | null;
};

export type GitLogEntry = {
  hash: string;
  parentHashes: string[];
  author: string;
  email: string;
  date: number;
  message: string;
  /** Undefined when the log query intentionally skipped signature verification. */
  signature?: GitCommitSignature | null;
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

export type GitFileChangeType = "A" | "M" | "D" | "R";
export type DateType = "Author Date" | "Commit Date";
export type GitResetMode = "soft" | "mixed" | "hard";
