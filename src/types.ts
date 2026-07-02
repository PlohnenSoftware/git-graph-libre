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
export type GitRepoState = {
  columnWidths: number[] | null;
  commitOrdering?: CommitOrdering;
  displayName?: string | null;
  hiddenRemotes?: string[];
  includeReflog?: RepoBooleanOverride;
  onlyFollowFirstParent?: RepoBooleanOverride;
  showRemoteBranches?: RepoBooleanOverride;
  showStashes?: RepoBooleanOverride;
  showTags?: RepoBooleanOverride;
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
  initialLoadCommits: number;
  lastActiveRepo: string | null;
  loadMoreCommits: number;
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
  | RequestOpenFile
  | RequestOpenSourceControl;

export type ResponseMessage =
  | ActionResponse
  | QueryResponse
  | ResponseFetchAvatar
  | ResponseLoadRepos
  | ResponseCopyToClipboard
  | ResponseViewDiff
  | ResponseOpenFile
  | ResponseOpenSourceControl
  | ResponseRefresh
  | ResponseStartHistorySearch;
