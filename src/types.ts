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
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
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
export type ContextMenuActionsVisibility = {
  branch: {
    checkout: boolean;
    rename: boolean;
    delete: boolean;
    merge: boolean;
    rebase: boolean;
    push: boolean;
    pull: boolean;
    viewIssue: boolean;
    createPullRequest: boolean;
    createArchive: boolean;
    compareWithHead: boolean;
    copyName: boolean;
  };
  commit: {
    addTag: boolean;
    createBranch: boolean;
    compareWithHead: boolean;
    checkout: boolean;
    cherryPick: boolean;
    revert: boolean;
    undoLastCommit: boolean;
    editMessage: boolean;
    drop: boolean;
    merge: boolean;
    rebase: boolean;
    reset: boolean;
    copyHash: boolean;
    copySubject: boolean;
    squashSelection: boolean;
    dropSelection: boolean;
  };
  commitDetailsViewFile: {
    viewDiff: boolean;
    viewFileAtRevision: boolean;
    compareWithWorkingTree: boolean;
    openFile: boolean;
    resetFileToRevision: boolean;
    copyAbsoluteFilePath: boolean;
    copyRelativeFilePath: boolean;
  };
  remoteBranch: {
    checkout: boolean;
    delete: boolean;
    fetchIntoLocalBranch: boolean;
    pull: boolean;
    viewIssue: boolean;
    createPullRequest: boolean;
    createArchive: boolean;
    compareWithHead: boolean;
    copyName: boolean;
  };
  stash: {
    apply: boolean;
    createBranch: boolean;
    pop: boolean;
    drop: boolean;
    copyName: boolean;
    copyHash: boolean;
  };
  tag: {
    viewDetails: boolean;
    delete: boolean;
    push: boolean;
    createArchive: boolean;
    compareWithHead: boolean;
    copyName: boolean;
  };
  uncommittedChanges: {
    stash: boolean;
    reset: boolean;
    clean: boolean;
    openSourceControlView: boolean;
  };
};
export type GitRepoState = {
  columnWidths: number[] | null;
  commitOrdering?: CommitOrdering;
  displayName?: string | null;
  hiddenRemotes?: string[];
  includeReflog?: RepoBooleanOverride;
  includeUnreachableCommits?: RepoBooleanOverride;
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

export type SettingsWidgetTab = "repository" | "extension";
export type ExtensionSettingType = "boolean" | "number" | "string" | "array" | "object";
export type ExtensionSettingScope = "default" | "global" | "workspace" | "workspaceFolder";
export type ExtensionSetting = {
  key: string;
  configKey: string;
  title: string;
  description: string;
  type: ExtensionSettingType;
  value: JsonValue;
  defaultValue: JsonValue;
  scope: ExtensionSettingScope;
  enum?: string[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
};

export type GitGraphViewState = {
  autoCenterCommitDetailsView: boolean;
  commitDetailsCompactFolders: boolean;
  commitDetailsFileViewMode: CommitDetailsFileViewMode;
  contextMenuActionsVisibility: ContextMenuActionsVisibility;
  dateFormat: DateFormat;
  fetchAvatars: boolean;
  showSignatureColumn: boolean;
  graphColors: string[];
  graphFontSize: number;
  graphRowHeight: number;
  graphStyle: GraphStyle;
  revealHighlightColor: string;
  customBranchGlobPatterns: CustomBranchGlobPattern[];
  initialLoadCommits: number;
  lastActiveRepo: string | null;
  loadMoreCommits: number;
  muteCommitsNotAncestorsOfHead: boolean;
  muteMergeCommits: boolean;
  onlyFollowFirstParent: boolean;
  repos: GitRepoSet;
  showCurrentBranchByDefault: boolean;
  showRemoteBranches: boolean;
  showStashes: boolean;
  showTags: boolean;
  includeReflog: boolean;
  includeUnreachableCommits: boolean;
  settingsWidgetTab?: SettingsWidgetTab;
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
  oldRef?: string;
  newRef?: string;
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

export type ResponseCreateArchive = {
  command: "createArchive";
  status: string | null;
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

export type RequestLoadExtensionSettings = {
  command: "loadExtensionSettings";
  requestId: number;
};
export type ResponseLoadExtensionSettings = {
  command: "loadExtensionSettings";
  requestId: number;
  settings: ExtensionSetting[];
  status: string | null;
};

export type RequestUpdateExtensionSetting = {
  command: "updateExtensionSetting";
  key: string;
  value: JsonValue;
  global: true;
};
export type ResponseUpdateExtensionSetting = {
  command: "updateExtensionSetting";
  key: string;
  status: string | null;
  settings: ExtensionSetting[];
};

export type RequestExportExtensionSettings = {
  command: "exportExtensionSettings";
};
export type ResponseExportExtensionSettings = {
  command: "exportExtensionSettings";
  status: string | null;
  exportedPath: string | null;
};

export type RequestImportExtensionSettings = {
  command: "importExtensionSettings";
};
export type ResponseImportExtensionSettings = {
  command: "importExtensionSettings";
  status: string | null;
  settings: ExtensionSetting[];
  importedKeys: string[];
  skippedKeys: string[];
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
  | RequestLoadExtensionSettings
  | RequestUpdateExtensionSetting
  | RequestExportExtensionSettings
  | RequestImportExtensionSettings
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
  | ResponseCreateArchive
  | ResponseImportRepoConfig
  | ResponseLoadExtensionSettings
  | ResponseUpdateExtensionSetting
  | ResponseExportExtensionSettings
  | ResponseImportExtensionSettings
  | ResponseRefresh
  | ResponseStartHistorySearch;
