import type { GitCommitDetails, GitCommitNode, GitRemote, GitStash } from "@/backend/types";
import * as GG from "@/types";

declare global {
  function acquireVsCodeApi(): {
    getState(): WebViewState | null | undefined;
    postMessage(message: GG.RequestMessage): void;
    setState(state: WebViewState): void;
  };

  const viewState: GG.GitGraphViewState;

  interface Config {
    autoCenterCommitDetailsView: boolean;
    commitDetailsCompactFolders: boolean;
    commitDetailsFileViewMode: GG.CommitDetailsFileViewMode;
    fetchAvatars: boolean;
    graphColors: string[];
    graphFontSize: number;
    graphRowHeight: number;
    graphStyle: "rounded" | "angular";
    customBranchGlobPatterns: GG.CustomBranchGlobPattern[];
    grid: { x: number; y: number; offsetX: number; offsetY: number; expandY: number };
    includeReflog: boolean;
    initialLoadCommits: number;
    loadMoreCommits: number;
    muteCommitsNotAncestorsOfHead: boolean;
    onlyFollowFirstParent: boolean;
    showCurrentBranchByDefault: boolean;
    showRemoteBranches: boolean;
    showStashes: boolean;
    showTags: boolean;
    shortHashLength: number;
  }

  interface ContextMenuItem {
    title: string;
    onClick: () => void;
  }

  type ContextMenuElement = ContextMenuItem | null;

  interface DialogTextInput {
    type: "text";
    name: string;
    default: string;
    placeholder: string | null;
  }
  interface DialogTextRefInput {
    type: "text-ref";
    name: string;
    default: string;
  }
  interface DialogTextareaInput {
    type: "textarea";
    name: string;
    default: string;
    placeholder: string | null;
  }
  interface DialogSelectInput {
    type: "select";
    name: string;
    options: { name: string; value: string }[];
    default: string;
  }
  interface DialogCheckboxInput {
    type: "checkbox";
    name: string;
    value: boolean;
  }
  type DialogInput =
    | DialogTextInput
    | DialogTextRefInput
    | DialogTextareaInput
    | DialogSelectInput
    | DialogCheckboxInput;
  type DialogInputValue = string | boolean;

  interface ExpandedCommit {
    id: number;
    hash: string;
    srcElem: HTMLElement | null;
    commitDetails: GitCommitDetails | null;
    fileTree: GitFolder | null;
    comparison: { baseRef: string; compareRef: string } | null;
    detailsHeight: number;
    summaryOpen: boolean;
    filesOpen: boolean;
  }

  interface GitFile {
    type: "file";
    name: string;
    index: number;
  }

  interface GitFolder {
    type: "folder";
    name: string;
    folderPath: string;
    contents: GitFolderContents;
    open: boolean;
  }

  type GitFolderOrFile = GitFolder | GitFile;
  type GitFolderContents = { [name: string]: GitFolderOrFile };

  interface Point {
    x: number;
    y: number;
  }
  interface Line {
    p1: Point;
    p2: Point;
    lockedFirst: boolean; // TRUE => The line is locked to p1, FALSE => The line is locked to p2
  }

  interface Pixel {
    x: number;
    y: number;
  }
  interface PlacedLine {
    p1: Pixel;
    p2: Pixel;
    isCommitted: boolean;
    lockedFirst: boolean; // TRUE => The line is locked to p1, FALSE => The line is locked to p2
  }

  type AvatarImageCollection = { [email: string]: string };

  interface WebViewState {
    gitRepos: GG.GitRepoSet;
    gitBranches: string[];
    gitBranchHead: string | null;
    gitAuthors?: string[];
    gitTags?: string[];
    gitRemotes?: GitRemote[];
    gitStashes?: GitStash[];
    settingsWidgetOpen?: boolean;
    commits: GitCommitNode[];
    commitHead: string | null;
    avatars: AvatarImageCollection;
    currentBranch: string | null;
    currentBranches?: string[] | null;
    currentAuthors?: string[] | null;
    currentTags?: string[] | null;
    currentRepo: string;
    moreCommitsAvailable: boolean;
    maxCommits: number;
    showRemoteBranches: boolean;
    expandedCommit: ExpandedCommit | null;
    hiddenColumns?: string[];
    commitOrdering?: string;
  }
}

export as namespace GG;
export = GG;
