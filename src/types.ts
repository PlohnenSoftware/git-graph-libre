import type {
  ActionRequest,
  ActionResponse,
  CommitOrdering,
  GitFileChangeType,
  QueryRequest,
  QueryResponse
} from "@/backend/types";

export type GitRepoSet = { [repo: string]: GitRepoState };
export type RepoBooleanOverride = "default" | "enabled" | "disabled";
export type IssueLinkingConfig = {
  pattern: string;
  urlTemplate: string;
};
export type PullRequestCreationConfig = {
  remoteName: string;
  baseBranch: string;
  urlTemplate: string;
  pushBeforeCreate: boolean;
};
export type GitRepoState = {
  columnWidths: number[] | null;
  commitOrdering?: CommitOrdering;
  displayName?: string | null;
  hiddenRemotes?: string[];
  includeReflog?: RepoBooleanOverride;
  issueLinking?: IssueLinkingConfig | null;
  lastConfigImportAt?: number;
  onlyFollowFirstParent?: RepoBooleanOverride;
  pullRequest?: PullRequestCreationConfig | null;
  showRemoteBranches?: RepoBooleanOverride;
  showStashes?: RepoBooleanOverride;
  showTags?: RepoBooleanOverride;
};

export type CustomBranchGlobPattern = {
  name: string;
  glob: string;
};

export type GitGraphViewState = {
  autoCenterCommitDetailsView: boolean;
  commitDetailsCompactFolders: boolean;
  commitDetailsFileViewMode: CommitDetailsFileViewMode;
  dateFormat: DateFormat;
  fetchAvatars: boolean;
  graphColors: string[];
  graphFontSize: number;
  graphRowHeight: number;
  graphStyle: GraphStyle;
  customBranchGlobPatterns: CustomBranchGlobPattern[];
  initialLoadCommits: number;
  lastActiveRepo: string | null;
  loadMoreCommits: number;
  muteCommitsNotAncestorsOfHead: boolean;
  onlyFollowFirstParent: boolean;
  repos: GitRepoSet;
  showCurrentBranchByDefault: boolean;
  showRemoteBranches: boolean;
  showStashes: boolean;
  showTags: boolean;
  includeReflog: boolean;
  shortHashLength: number;
};

export type Avatar = {
  image: string;
  timestamp: number;
  identicon: boolean;
};
export type AvatarCache = { [email: string]: Avatar };

export type DateFormat = "Date & Time" | "Date Only" | "Relative";
export type CommitDetailsFileViewMode = "tree" | "list";
export type GraphStyle = "rounded" | "angular";

/* Infrastructure Request / Response Messages */

export type RequestFetchAvatar = {
  command: "fetchAvatar";
  repo: string;
  email: string;
  commits: string[];
};
export type ResponseFetchAvatar = {
  command: "fetchAvatar";
  email: string;
  image: string;
};

export type RequestSelectRepo = {
  command: "selectRepo";
  repo: string;
};

export type RequestLoadRepos = {
  command: "loadRepos";
  check: boolean;
};
export type ResponseLoadRepos = {
  command: "loadRepos";
  repos: GitRepoSet;
  lastActiveRepo: string | null;
};

export type RequestSaveRepoState = {
  command: "saveRepoState";
  repo: string;
  state: GitRepoState;
};

export type RequestCopyToClipboard = {
  command: "copyToClipboard";
  type: string;
  data: string;
};
export type ResponseCopyToClipboard = {
  command: "copyToClipboard";
  type: string;
  success: boolean;
};

export type RequestViewDiff = {
  command: "viewDiff";
  repo: string;
  commitHash: string;
  oldFilePath: string;
  newFilePath: string;
  type: GitFileChangeType;
};
export type ResponseViewDiff = {
  command: "viewDiff";
  success: boolean;
};

export type RequestViewFileAtRevision = {
  command: "viewFileAtRevision";
  repo: string;
  commitHash: string;
  filePath: string;
};
export type ResponseViewFileAtRevision = {
  command: "viewFileAtRevision";
  success: boolean;
};

export type RequestCompareFileWithWorkingTree = {
  command: "compareFileWithWorkingTree";
  repo: string;
  commitHash: string;
  filePath: string;
};
export type ResponseCompareFileWithWorkingTree = {
  command: "compareFileWithWorkingTree";
  success: boolean;
};

export type RequestOpenFile = {
  command: "openFile";
  repo: string;
  filePath: string;
};
export type ResponseOpenFile = {
  command: "openFile";
  success: boolean;
};

export type RequestOpenSourceControl = {
  command: "openSourceControl";
};
export type ResponseOpenSourceControl = {
  command: "openSourceControl";
  success: boolean;
};

export type RequestOpenExternalUrl = {
  command: "openExternalUrl";
  url: string;
};
export type ResponseOpenExternalUrl = {
  command: "openExternalUrl";
  success: boolean;
};

export type RequestImportRepoConfig = {
  command: "importRepoConfig";
  repo: string;
};
export type ResponseImportRepoConfig = {
  command: "importRepoConfig";
  repo: string;
  status: string | null;
  state: GitRepoState | null;
};

export type RequestWebviewDiagnostic = {
  command: "webviewDiagnostic";
  stage: string;
  message?: string;
  repo?: string;
  repoCount?: number;
  requestId?: number | null;
};

export type ResponseRefresh = {
  command: "refresh";
};

export type ResponseStartHistorySearch = {
  command: "startHistorySearch";
};

export type RequestMessage =
  | ActionRequest
  | QueryRequest
  | RequestFetchAvatar
  | RequestSelectRepo
  | RequestLoadRepos
  | RequestSaveRepoState
  | RequestCopyToClipboard
  | RequestViewDiff
  | RequestViewFileAtRevision
  | RequestCompareFileWithWorkingTree
  | RequestOpenFile
  | RequestOpenSourceControl
  | RequestOpenExternalUrl
  | RequestImportRepoConfig
  | RequestWebviewDiagnostic;

export type ResponseMessage =
  | ActionResponse
  | QueryResponse
  | ResponseFetchAvatar
  | ResponseLoadRepos
  | ResponseCopyToClipboard
  | ResponseViewDiff
  | ResponseViewFileAtRevision
  | ResponseCompareFileWithWorkingTree
  | ResponseOpenFile
  | ResponseOpenSourceControl
  | ResponseOpenExternalUrl
  | ResponseImportRepoConfig
  | ResponseRefresh
  | ResponseStartHistorySearch;
