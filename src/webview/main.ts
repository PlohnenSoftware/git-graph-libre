import type {
  CommitOrdering,
  GitCommandStatus,
  GitCommitDetails,
  GitCommitNode,
  GitCommitSearchResult,
  GitCommitSignature,
  GitFileChange,
  GitPushBranchMode,
  GitQueryError,
  GitRemote,
  GitRepoConfig,
  GitRepoInfo,
  GitResetMode,
  GitStash,
  GitTagDetails,
  GitUncommittedChanges,
  GitWorktree,
  QueryResult
} from "@/backend/types";
import { COMMIT_ORDERINGS, GIT_PUSH_BRANCH_MODES } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import { normalizeContextMenuActionsVisibility } from "@/contextMenuVisibility";
import { octicon } from "@/octicons";
import {
  alterGitFileTree,
  COMMIT_DETAILS_COLLAPSED_HEIGHT,
  COMMIT_DETAILS_DEFAULT_HEIGHT,
  COMMIT_DETAILS_KEYBOARD_RESIZE_STEP,
  COMMIT_DETAILS_MAX_HEIGHT,
  COMMIT_DETAILS_MIN_HEIGHT,
  type CommitComparisonDisplay,
  type CommitDetailsSection,
  clampCommitDetailsHeight,
  generateGitFileTree,
  renderCommitDetailsRowHtml
} from "./commitDetailsView";
import { findCommitIndexes, formatFindMatchCount } from "./commitFind";
import { applyComponentStatus, initComponentStatus } from "./componentStatus";
import { Dropdown, type DropdownOption } from "./dropdown";
import { createFailureScreenReporter } from "./failureScreen";
import { Graph } from "./graph";
import { resolveGlobalShortcut } from "./keyboardShortcuts";
import { groupCommitRefs, parseRemoteBranchName } from "./refLabels";
import { buildRepoOptions } from "./repoOptions";
import {
  getRepoBasename,
  normalizeRepoBooleanOverride,
  type RepoBooleanSettingKey,
  renderSettingsWidget,
  resolveRepoBooleanOverride
} from "./settingsWidget";
import { setStatusStrip, statusStripShows } from "./statusStrip";
import {
  getStagingDropAction,
  isUncommittedSection,
  renderUncommittedDetailsRowHtml,
  type UncommittedSection
} from "./uncommittedDetailsView";
import { formatRelativeDate, getMonth, pad2 } from "./utils/date";
import { addListenerToClass, insertAfter, startRevealHighlight } from "./utils/dom";
import { arraysEqual, ELLIPSIS, refInvalid, worktreeFolderName } from "./utils/git";
import { escapeHtml, unescapeHtml } from "./utils/html";
import { svgIcons } from "./utils/icons";
import { extractIssueLinks } from "./utils/linkify";
import { rewritePaletteLightnessChroma, toOklch } from "./utils/oklchColor";
import { sendMessage, vscode } from "./utils/vscode";
import {
  buildWorktreeListLabels,
  lifecycleRowActions,
  type WorktreeFooterAction,
  WorktreePopup,
  type WorktreeRowAction
} from "./worktreeList";

const searchHistoryMaxResults = 50;
const failureScreens = createFailureScreenReporter(sendMessage);
window.addEventListener("pagehide", () => failureScreens.dispose(), { once: true });
const FILTER_SHOW_ALL_VALUE = "";
const HEAD_REF_VALUE = "HEAD";
const REF_DROPDOWN_DISPLAY_CHARS = 40;
const AUTHOR_DROPDOWN_DISPLAY_CHARS = 30;
const DEFAULT_REVEAL_HIGHLIGHT_COLOR = "oklch(90% 0.25 150 / 0.42)";

const HIDEABLE_COLUMNS = ["date", "author", "commit", "signature"] as const;
type HideableColumn = (typeof HIDEABLE_COLUMNS)[number];
const COLUMN_HIDE_CLASSES: Record<HideableColumn, string> = {
  date: "hideDateCol",
  author: "hideAuthorCol",
  commit: "hideCommitCol",
  signature: "hideSignatureCol"
};
const COLUMN_VISIBILITY_STATE_VERSION = 1;
const SIGNATURE_COLUMN_DEFAULT_WIDTH = 64;
const SIGNATURE_COLUMN_SETTING_KEY = "git-graph-libre.columns.signature";
const COMMIT_SIGNATURE_PRESENTATIONS: Record<
  NonNullable<GitCommitNode["signature"]>["status"],
  { glyph: string; tone: string; label: string }
> = {
  valid: { glyph: svgIcons.verified, tone: "valid", label: l10n.signatureValid },
  "valid-untrusted": {
    glyph: "!",
    tone: "warning",
    label: l10n.signatureValidUntrusted
  },
  bad: { glyph: "×", tone: "invalid", label: l10n.signatureBad },
  expired: { glyph: "!", tone: "warning", label: l10n.signatureExpired },
  "expired-key": {
    glyph: "!",
    tone: "warning",
    label: l10n.signatureExpiredKey
  },
  "revoked-key": {
    glyph: "×",
    tone: "invalid",
    label: l10n.signatureRevokedKey
  },
  unverifiable: { glyph: "?", tone: "unknown", label: l10n.signatureUnverifiable },
  unknown: { glyph: "?", tone: "unknown", label: l10n.signatureUnknown }
};
const REPO_BOOLEAN_SETTING_KEYS: readonly RepoBooleanSettingKey[] = [
  "includeReflog",
  "includeUnreachableCommits",
  "onlyFollowFirstParent",
  "showRemoteBranches",
  "showStashes",
  "showTags"
];

function trimRepoTrailingSeparators(repo: string) {
  const minimumLength =
    repo.length >= 3 && repo[1] === ":" && (repo[2] === "\\" || repo[2] === "/") ? 3 : 1;
  let end = repo.length;
  while (end > minimumLength && (repo[end - 1] === "/" || repo[end - 1] === "\\")) end -= 1;
  return repo.slice(0, end);
}

function isHideableColumn(value: string): value is HideableColumn {
  return (HIDEABLE_COLUMNS as readonly string[]).includes(value);
}

function isCommitOrdering(value: string): value is CommitOrdering {
  return (COMMIT_ORDERINGS as readonly string[]).includes(value);
}

function isRepoBooleanSettingKey(value: string | undefined): value is RepoBooleanSettingKey {
  return value !== undefined && (REPO_BOOLEAN_SETTING_KEYS as readonly string[]).includes(value);
}

/**
 * How close two right-clicks on the version must be to open the hidden menu.
 * Matches the platform's usual double-click window closely enough that an
 * accidental pair is unlikely and a deliberate one never misses.
 */
const HIDDEN_MENU_CLICK_WINDOW_MS = 500;

/**
 * English by design, like the menu it heads — see `buildHiddenMenu()`.
 */
const HIDDEN_MENU_HEADER: ContextMenuHeader = {
  title: "Hidden menu",
  caption: "Temporary language, one-off reload · this tab only"
};

/** The hidden menu's one-off reload; English like the rest of the menu. */
const HIDDEN_MENU_RELOAD_WITH_CLI = "Reload once with Git CLI";

/** The startup screen's "Show diagnostics", reachable from a working graph too. */
const HIDDEN_MENU_SHOW_DIAGNOSTICS = "Show diagnostics";
const HIDDEN_MENU_OPEN_LOG_FILE = "Open log file";
const HIDDEN_MENU_COPY_RECENT_LOG = "Copy recent log";

function requireElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const elem = document.getElementById(id);
  if (elem === null) throw new Error(`Missing webview element #${id}`);
  return elem as T;
}

function closestHTMLElement(target: EventTarget | null, selector: string): HTMLElement | null {
  return target instanceof Element ? (target.closest(selector) as HTMLElement | null) : null;
}

function formatQueryError(error: GitQueryError | null): string | null {
  if (error === null) return null;

  const parts = [error.message];
  if (error.stderr !== null && error.stderr !== error.message) parts.push(error.stderr);
  if (error.task !== null) parts.push(`Git task: ${error.task}`);
  if (error.exitCode !== null) parts.push(`Exit code: ${error.exitCode}`);
  return parts.join("\n");
}

/**
 * The comparison-header label for a typed "Compare with…" ref: the text the
 * user picked, unless it is (a prefix of) the resolved hash — a raw hash
 * shows as its abbreviation instead.
 */
function compareWithLabel(ref: string, resolvedHash: string): string | undefined {
  const isHash =
    /^[0-9a-f]+$/i.test(ref) && resolvedHash.toLowerCase().startsWith(ref.toLowerCase());
  return isHash ? undefined : ref;
}

function createEmptyGitConfig(): GitRepoConfig {
  return {
    userName: { local: null, global: null },
    userEmail: { local: null, global: null }
  };
}

function normalizeFilterSelection(values: readonly string[] | null | undefined): string[] | null {
  if (values === null || values === undefined || values.includes(FILTER_SHOW_ALL_VALUE)) {
    return null;
  }

  const selected = values.filter((value, index) => value !== "" && values.indexOf(value) === index);
  return selected.length === 0 ? null : selected;
}

function normalizeCustomBranchGlobPattern(
  value: GGL.JsonValue
): GGL.CustomBranchGlobPattern | null {
  if (!isJsonObject(value)) return null;
  const name = value.name;
  const glob = value.glob;
  if (typeof name !== "string" || typeof glob !== "string") return null;
  const trimmedName = name.trim();
  const trimmedGlob = glob.trim();
  if (trimmedName === "" || trimmedGlob === "") return null;
  return {
    name: trimmedName,
    glob: trimmedGlob.startsWith("--glob=") ? trimmedGlob : `--glob=${trimmedGlob}`
  };
}

/** A known tag remote mode, else the default (`origin`): a stale boolean is not one. */
function parseTagRemotesMode(value: unknown): GGL.TagRemotesMode {
  return value === "off" || value === "all" || value === "origin" ? value : "origin";
}

function isJsonObject(value: GGL.JsonValue): value is { [key: string]: GGL.JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Maps each branch checked out in a worktree other than the current one to the
 * paths of those worktrees. A branch checked out twice (via
 * --ignore-other-worktrees) lists both; detached and bare worktrees have no branch.
 */
export function branchWorktreeMap(worktrees: GitWorktree[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const worktree of worktrees) {
    if (worktree.isCurrent || worktree.branch === null) continue;
    const paths = map.get(worktree.branch) ?? [];
    paths.push(worktree.path);
    map.set(worktree.branch, paths);
  }
  return map;
}

/**
 * Maps each commit another worktree sits on with a detached HEAD to those
 * worktrees, for the row marker (W12). The current worktree's own HEAD is
 * left out: it already carries the HEAD dot. A worktree on a branch is left
 * out too: its commit carries the branch badge. Two worktrees can share a
 * detached commit, so each hash lists every one of them.
 */
export function detachedWorktreeHeadMap(worktrees: GitWorktree[]): Map<string, GitWorktree[]> {
  const map = new Map<string, GitWorktree[]>();
  for (const worktree of worktrees) {
    if (worktree.isCurrent || !worktree.detached || worktree.head === null) continue;
    const holders = map.get(worktree.head) ?? [];
    holders.push(worktree);
    map.set(worktree.head, holders);
  }
  return map;
}

/**
 * The local branch a remote checkout would collide with, decided from the
 * branches and upstreams the webview already holds — never from Git's
 * translated "already exists" after the fact (W24, issue #45). A branch with
 * the name the checkout would create wins; otherwise the first local branch,
 * in branch-list order, that already tracks the clicked remote branch under
 * another name (the state W05's old suggested name left behind). Null when
 * the checkout can create its branch freely.
 */
export function existingLocalBranchForRemote(
  suggestedName: string,
  remoteRef: string,
  localBranches: readonly string[],
  upstreams: Record<string, string | null>
): string | null {
  if (localBranches.includes(suggestedName)) return suggestedName;
  for (const branch of localBranches) {
    if (upstreams[branch] === remoteRef) return branch;
  }
  return null;
}

/** A placeholder of the worktree folder template: `${repo}` or `${branch}`. */
const WORKTREE_PLACEHOLDER = /\$\{(repo|branch)\}/g;
const ABSOLUTE_FOLDER = /^(?:[/\\]|[A-Za-z]:[/\\])/;
/** The drive and root a path starts with; a `..` segment never climbs above them. */
const FOLDER_ROOT = /^(?:[A-Za-z]:)?[/\\]?/;

/**
 * The folder template text, trimmed (W22F). Empty means the default folder, and
 * so does anything that is not text, so a stale or hand-edited value is safe.
 * Mirrors `normalizeWorktreePathTemplate` in `src/config.ts`.
 */
export function normalizeWorktreePathTemplate(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The finish step's choices after a worktree is created (decision Y8). */
type WorktreeFinishChoice = "newWindow" | "workspace" | "switch" | "nothing";

/** A saved finish choice, else the first one offered: an older saved state has none (W22F). */
function normalizeWorktreeFinish(value: unknown): WorktreeFinishChoice {
  return value === "workspace" || value === "switch" || value === "nothing" ? value : "newWindow";
}

/** The parent folder of a repository path (null when it has none) and the folder's own name. */
function splitRepoPath(repoPath: string): { parent: string | null; repoName: string } {
  let end = repoPath.length;
  while (end > 0 && (repoPath[end - 1] === "/" || repoPath[end - 1] === "\\")) end -= 1;
  const trimmed = repoPath.slice(0, end);
  const lastSeparator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (lastSeparator === -1) return { parent: null, repoName: trimmed };
  return { parent: trimmed.slice(0, lastSeparator), repoName: trimmed.slice(lastSeparator + 1) };
}

/** The template with `${repo}` and `${branch}` filled in; any other `${...}` is left as written. */
function fillWorktreeTemplate(template: string, repoName: string, name: string): string {
  const values: Record<string, string> = { repo: repoName, branch: name };
  return template.replace(WORKTREE_PLACEHOLDER, (_match, key: string) => values[key] ?? "");
}

/**
 * Drops `.` segments and resolves `..` ones, so the dialog shows the folder Git
 * is given. A `..` at a root stays there; a relative path keeps the `..` it
 * cannot resolve.
 */
function resolveFolderSegments(folder: string, separator: string): string {
  const root = FOLDER_ROOT.exec(folder)?.[0] ?? "";
  const kept: string[] = [];
  for (const segment of folder.slice(root.length).split(/[/\\]/)) {
    if (segment === "" || segment === ".") continue;
    if (segment !== "..") kept.push(segment);
    else if (kept.length > 0 && kept.at(-1) !== "..") kept.pop();
    else if (root === "") kept.push(segment);
  }
  return root + kept.join(separator);
}

/**
 * The default folder for a new worktree (decision Y7): a `<repo>.worktrees`
 * folder beside the repository, holding one folder per checked-out name, so
 * `<parent>/<repo>.worktrees/<branch>`. A folder template (W22F) replaces that
 * folder: a relative template is taken from the repository's parent folder, an
 * absolute one is used as written. The separator follows the repository path's
 * own, and the name is used as given. The user edits the result in the dialog,
 * and the backend refuses a folder that cannot take a worktree.
 */
export function defaultWorktreePath(repoPath: string, name: string, template = ""): string {
  const separator = repoPath.includes("\\") ? "\\" : "/";
  const { parent, repoName } = splitRepoPath(repoPath);
  const folder =
    template === ""
      ? `${repoName}.worktrees${separator}${name}`
      : fillWorktreeTemplate(template, repoName, name);
  const absolute = template !== "" && ABSOLUTE_FOLDER.test(folder);
  const joined = parent === null || absolute ? folder : `${parent}${separator}${folder}`;
  return resolveFolderSegments(joined, separator);
}

/** What the Create Worktree dialog was opened from, and where it starts (W22). */
export type CreateWorktreeSource = {
  /** What the title and the checkout options name: a branch, remote branch, commit or tag. */
  label: string;
  /** The commit-ish a new branch or a detached HEAD starts from. */
  startPoint: string;
  /** The last path segment of the default folder. */
  folderName: string;
  /** An existing local branch the dialog may offer to check out, when one fits. */
  branch: string | null;
  /** The new branch name to pre-fill (a remote branch's parsed local name). */
  newBranchName: string;
  /** The checkout mode selected when the dialog opens. */
  mode: "branch" | "new" | "detach";
};

/** The worktrees other than the current one that have `branch` checked out (W11). */
export function otherWorktreesHoldingBranch(
  worktrees: readonly GitWorktree[],
  branch: string
): GitWorktree[] {
  return worktrees.filter((worktree) => !worktree.isCurrent && worktree.branch === branch);
}

export type WorktreeCheckoutStrings = {
  checkedOutInWorktree: string;
  worktreeLocked: string;
  worktreeLockedNoReason: string;
  worktreeMissing: string;
};

/**
 * "Checked out in worktree <folder> (<path>)", plus the locked or missing
 * state when Git reports one (W11). Shared by the badge tooltip and the
 * context-menu header so the two surfaces cannot drift apart.
 */
export function describeWorktreeCheckout(
  worktree: GitWorktree,
  strings: WorktreeCheckoutStrings
): string {
  const parts = [
    strings.checkedOutInWorktree
      .replace("{0}", () => worktreeFolderName(worktree.path))
      .replace("{1}", () => worktree.path)
  ];
  if (worktree.locked !== null) {
    const reason = worktree.locked.reason;
    parts.push(
      reason === ""
        ? strings.worktreeLockedNoReason
        : strings.worktreeLocked.replace("{0}", () => reason)
    );
  }
  if (worktree.prunable !== null) parts.push(strings.worktreeMissing);
  return parts.join(", ");
}

type DeleteBranchPart = {
  branchName: string;
  forceDelete: boolean;
  deleteOnRemotes?: string[];
};

/**
 * The question shown when a remote checkout meets an existing local branch:
 * the branch is held by another worktree, has the proposed name, or already
 * tracks the clicked remote branch under another name.
 */
function existingBranchMessage(
  existing: string,
  suggestedName: string,
  remoteRef: string,
  worktreePath: string | null
): string {
  const bold = (name: string) => `<b><i>${escapeHtml(name)}</i></b>`;
  if (worktreePath !== null) {
    return l10n.dialogOpenWorktreeMessage
      .replace("{0}", () => bold(existing))
      .replace("{1}", () => bold(worktreePath));
  }
  if (existing === suggestedName) {
    return l10n.dialogCheckoutRemoteExists.replace("{0}", () => bold(existing));
  }
  return l10n.dialogCheckoutRemoteTracks
    .replace("{0}", () => bold(existing))
    .replace("{1}", () => bold(remoteRef));
}

class GitGraphView {
  private gitRepos: GGL.GitRepoSet;
  /** How the repositories group into Git repositories, and the worktrees outside the workspace. */
  private repoLayout: GGL.RepoLayout | undefined = viewState.repoLayout;
  private gitBranches: string[] = [];
  private gitBranchHead: string | null = null;
  /** Every worktree of the current repository, from the last branch read; not persisted. */
  private gitWorktrees: GitWorktree[] = [];
  /** Local branch to its upstream's short name, or null when it tracks nothing. */
  private gitUpstreams: Record<string, string | null> = {};
  /** Derived from gitWorktrees: the branches checked out elsewhere, by path. */
  private gitBranchWorktrees = new Map<string, string[]>();
  /** Derived from gitWorktrees: commits another worktree's detached HEAD sits on. */
  private gitDetachedWorktreeHeads = new Map<string, GitWorktree[]>();
  private gitAuthors: string[] = [];
  private gitTags: string[] = [];
  private gitRemotes: GitRemote[] = [];
  private remoteTagsResult: QueryResult<"remoteTags"> | null = null;
  private remoteTagsRepo = "";
  private remoteTagsRequestId: number | null = null;
  /** A hard refresh keeps the shown snapshot and asks again; the reply replaces it. */
  private remoteTagsRevalidate = false;
  private gitStashes: GitStash[] = [];
  private gitConfig: GitRepoConfig = createEmptyGitConfig();
  private commits: GitCommitNode[] = [];
  private commitHead: string | null = null;
  private commitLookup: { [hash: string]: number } = {};
  /**
   * Signature status by commit hash, for `signaturesRepo` only. The graph load
   * never verifies signatures, so this is what fills the column: a commit
   * answered once keeps its status across refreshes and "Load More" pages
   * instead of going back to pending. The toolbar's refresh button empties it,
   * so newly imported or trusted keys are picked up on request.
   */
  private readonly signatures = new Map<string, GitCommitSignature | null>();
  private signaturesRepo = "";
  /** The hashes each unanswered `commitSignatures` request asked for. */
  private readonly signatureRequests = new Map<number, string[]>();
  /**
   * Set by the hidden menu's "Reload once with Git CLI": the next repository
   * info and commit loads ask the host to use the Git CLI whatever the backend
   * setting says. Cleared once the commit load has been asked for, so exactly
   * one reload is affected.
   */
  private forceCliOnce = false;
  private avatars: AvatarImageCollection = {};
  private currentBranch: string | null = null;
  private currentBranches: string[] | null = null;
  private currentAuthors: string[] | null = null;
  private currentTags: string[] | null = null;
  private currentRepo: string = "";
  private readonly selectedCommitHashes: Set<string> = new Set();
  private commitSelectionAnchorHash: string | null = null;

  private readonly graph: Graph;
  private readonly config: Config;
  private moreCommitsAvailable: boolean = false;
  private showRemoteBranches: boolean = true;
  private expandedCommit: ExpandedCommit | null = null;
  private uncommittedView: {
    srcElem: HTMLElement | null;
    stagedOpen: boolean;
    unstagedOpen: boolean;
    detailsHeight: number;
    /** Folder paths the user collapsed, per pane; folders default to open. */
    collapsedFolders: { staged: Set<string>; unstaged: Set<string> };
  } | null = null;
  private maxCommits: number;
  private readonly hiddenColumns: Set<HideableColumn> = new Set();

  private readonly tableElem: HTMLElement;
  private readonly footerElem: HTMLElement;
  private readonly graphContainerElem: HTMLElement;
  private readonly repoDropdown: Dropdown;
  private readonly branchDropdown: Dropdown;
  private readonly authorDropdown: Dropdown;
  private readonly tagDropdown: Dropdown;
  private readonly showRemoteBranchesElem: HTMLInputElement;
  private readonly topBarElem: HTMLElement;
  private readonly statusVersionElem: HTMLElement;
  /** Timestamp of the last right-click on the version, for the double-click. */
  private lastVersionContextMenu = 0;
  private readonly findControlElem: HTMLElement;
  private readonly findInputElem: HTMLInputElement;
  private readonly findMatchCountElem: HTMLElement;
  private readonly findPreviousBtn: HTMLButtonElement;
  private readonly findNextBtn: HTMLButtonElement;
  private readonly findClearBtn: HTMLButtonElement;
  private readonly findSearchHistoryBtn: HTMLButtonElement;
  private readonly fetchBtn: HTMLButtonElement;
  private readonly pushTagsBtn: HTMLButtonElement;
  private readonly branchControlElem: HTMLElement;
  private readonly authorControlElem: HTMLElement;
  private readonly tagControlElem: HTMLElement;
  private readonly showRemoteBranchesControlElem: HTMLElement;
  private readonly settingsBtn: HTMLButtonElement;
  private readonly settingsWidgetBackingElem: HTMLElement;
  private readonly settingsWidgetElem: HTMLElement;
  private readonly worktreePopup: WorktreePopup;
  private settingsWidgetOpen = false;
  private settingsWidgetTab: GGL.SettingsWidgetTab = "repository";
  private extensionSettings: GGL.ExtensionSetting[] | null = null;
  private findQuery = "";
  private findMatches: number[] = [];
  private activeFindMatchIndex = -1;
  private activeSearchCommitsRequestId: number | null = null;
  private activeSearchQuery: string | null = null;
  private pendingFocusCommitHash: string | null = null;

  private loadBranchesCallback: ((changes: boolean, isRepo: boolean) => void) | null = null;
  private loadCommitsCallback: ((changes: boolean) => void) | null = null;
  private nextRequestId = 1;
  private activeLoadRepoInfoRequestId: number | null = null;
  private activeLoadExtensionSettingsRequestId: number | null = null;
  private activeLoadBranchesRequestId: number | null = null;
  private activeLoadCommitsRequestId: number | null = null;
  /** The "Compare with…" submission still awaiting its `resolveRef` reply. */
  private pendingCompareWith: {
    requestId: number;
    sourceElem: HTMLElement;
    hash: string;
    ref: string;
    baseLabel?: string;
  } | null = null;
  /** The folder of the worktree being created, for the finish step (Y8) once Git answers. */
  private pendingCreatedWorktree: string | null = null;
  /**
   * The finish step (Y8) the user last picked after creating a worktree; the
   * dialog opens on it. It is kept in the view state, so it survives a reload.
   */
  private lastWorktreeFinish: WorktreeFinishChoice = "newWindow";
  /** A worktree removal waiting for the read of the local files a forced removal would delete. */
  private pendingWorktreeRemoval: {
    requestId: number;
    request: Extract<GGL.RequestMessage, { command: "removeWorktree" }>;
  } | null = null;
  /** The Worktrees popup's read of its worktrees' uncommitted changes, awaiting its answer. */
  private pendingWorktreeStatus: { requestId: number; repo: string } | null = null;
  /** The Push Branch dialog's submission still awaiting its `branchPushDefaults` reply. */
  private pendingPushBranchDialog: {
    requestId: number;
    refName: string;
    remoteNames: string[];
  } | null = null;

  constructor(
    repos: GGL.GitRepoSet,
    lastActiveRepo: string | null,
    config: Config,
    prevState: WebViewState | null
  ) {
    this.gitRepos = repos;
    this.config = config;
    if (!config.showSignatureColumn) this.hiddenColumns.add("signature");
    this.maxCommits = config.initialLoadCommits;
    this.graph = new Graph("commitGraph", this.config);
    this.tableElem = requireElement("commitTable");
    this.footerElem = requireElement("footer");
    this.graphContainerElem = requireElement("commitGraph");
    this.repoDropdown = new Dropdown("repoSelect", true, l10n.repo, (value) => {
      if (this.switchToOutsideWorktree(value)) return;
      this.currentRepo = value;
      this.maxCommits = this.config.initialLoadCommits;
      this.expandedCommit = null;
      this.currentBranch = null;
      this.currentBranches = null;
      this.currentAuthors = null;
      this.currentTags = null;
      this.gitAuthors = [];
      this.gitTags = [];
      this.gitRemotes = [];
      this.gitStashes = [];
      this.gitConfig = createEmptyGitConfig();
      this.gitWorktrees = [];
      this.gitUpstreams = {};
      this.gitBranchWorktrees = new Map();
      this.gitDetachedWorktreeHeads = new Map();
      this.worktreePopup.close();
      this.worktreePopup.update([]);
      this.closeSettingsWidget();
      this.syncRepoSettingsControls();
      this.updateRemoteActionsVisibility();
      this.saveState();
      sendMessage({ command: "selectRepo", repo: value });
      this.refresh(true);
    });
    this.branchDropdown = new Dropdown(
      "branchSelect",
      false,
      l10n.branches,
      (values) => {
        this.currentBranches = normalizeFilterSelection(values);
        this.currentBranch = this.currentBranches?.[0] ?? FILTER_SHOW_ALL_VALUE;
        this.maxCommits = this.config.initialLoadCommits;
        this.expandedCommit = null;
        this.saveState();
        this.renderShowLoading();
        this.requestLoadCommits(true, () => {});
      },
      true,
      { maxDisplayChars: REF_DROPDOWN_DISPLAY_CHARS, truncation: "ref" }
    );
    this.authorDropdown = new Dropdown(
      "authorSelect",
      false,
      l10n.authors,
      (values) => {
        this.currentAuthors = normalizeFilterSelection(values);
        this.maxCommits = this.config.initialLoadCommits;
        this.expandedCommit = null;
        this.saveState();
        this.renderShowLoading();
        this.requestLoadCommits(true, () => {});
      },
      true,
      { maxDisplayChars: AUTHOR_DROPDOWN_DISPLAY_CHARS, truncation: "middle" }
    );
    this.tagDropdown = new Dropdown(
      "tagSelect",
      false,
      l10n.tags,
      (values) => {
        this.currentTags = normalizeFilterSelection(values);
        this.maxCommits = this.config.initialLoadCommits;
        this.expandedCommit = null;
        this.saveState();
        this.renderShowLoading();
        this.requestLoadCommits(true, () => {});
      },
      true,
      { maxDisplayChars: REF_DROPDOWN_DISPLAY_CHARS, truncation: "ref" }
    );
    this.showRemoteBranchesElem = requireElement<HTMLInputElement>("showRemoteBranchesCheckbox");
    this.showRemoteBranchesElem.addEventListener("change", () => {
      this.setRepoBooleanSetting(
        "showRemoteBranches",
        this.showRemoteBranchesElem.checked ? "enabled" : "disabled"
      );
    });
    this.topBarElem = requireElement("topBar");
    this.statusVersionElem = requireElement("statusVersion");
    this.statusVersionElem.addEventListener("contextmenu", (e) => {
      // Always swallowed: the version is chrome, and the platform menu offers
      // nothing useful over it.
      e.preventDefault();
      const now = Date.now();
      const isSecondClick = now - this.lastVersionContextMenu < HIDDEN_MENU_CLICK_WINDOW_MS;
      this.lastVersionContextMenu = isSecondClick ? 0 : now;
      if (!isSecondClick) return;
      // Every other context menu does this too: the document-level dismisser
      // listens for contextmenu, and would close what this just opened.
      e.stopPropagation();
      showContextMenu(e, this.buildHiddenMenu(), this.statusVersionElem, HIDDEN_MENU_HEADER);
    });
    this.findControlElem = requireElement("findControl");
    this.findInputElem = requireElement<HTMLInputElement>("findInput");
    this.findMatchCountElem = requireElement("findMatchCount");
    this.findPreviousBtn = requireElement<HTMLButtonElement>("findPreviousBtn");
    this.findNextBtn = requireElement<HTMLButtonElement>("findNextBtn");
    this.findClearBtn = requireElement<HTMLButtonElement>("findClearBtn");
    this.findSearchHistoryBtn = requireElement<HTMLButtonElement>("findSearchHistoryBtn");
    this.fetchBtn = requireElement<HTMLButtonElement>("fetchBtn");
    this.pushTagsBtn = requireElement<HTMLButtonElement>("pushTagsBtn");
    this.branchControlElem = requireElement("branchControl");
    this.authorControlElem = requireElement("authorControl");
    this.tagControlElem = requireElement("tagControl");
    this.showRemoteBranchesControlElem = requireElement("showRemoteBranchesControl");
    this.settingsBtn = requireElement<HTMLButtonElement>("settingsBtn");
    this.settingsWidgetBackingElem = requireElement("settingsWidgetBacking");
    this.settingsWidgetElem = requireElement("settingsWidget");
    this.worktreePopup = new WorktreePopup(
      requireElement("worktreesBtn"),
      () => buildWorktreeListLabels(l10n),
      () => this.config.shortHashLength,
      {
        onRowAction: (action, worktree) => this.handleWorktreeRowAction(action, worktree),
        onFooterAction: (action) => this.handleWorktreeFooterAction(action),
        onOpen: (paths) => this.requestWorktreeStatus(paths)
      }
    );
    document.getElementById("findBtn")?.addEventListener("click", () => {
      this.showFindWidget();
    });
    this.findInputElem.addEventListener("input", () => {
      this.updateFindQuery(this.findInputElem.value);
    });
    this.findInputElem.addEventListener("keydown", (event) => {
      this.handleFindInputKeydown(event);
    });
    this.findPreviousBtn.addEventListener("click", () => {
      this.navigateFind(-1);
    });
    this.findNextBtn.addEventListener("click", () => {
      this.navigateFind(1);
    });
    this.findClearBtn.addEventListener("click", () => {
      this.clearFind();
    });
    this.findSearchHistoryBtn.addEventListener("click", () => {
      this.requestSearchCommits();
    });
    this.fetchBtn.addEventListener("click", () => {
      this.showFetchDialog();
    });
    this.pushTagsBtn.addEventListener("click", () => {
      this.showPushAllTagsDialog();
    });
    this.settingsBtn.addEventListener("click", () => {
      this.toggleSettingsWidget();
    });
    this.settingsWidgetBackingElem.addEventListener("click", () => {
      this.closeSettingsWidget();
    });
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
      this.forgetSignatures();
      this.refresh(true);
    });
    document.getElementById("blinkHeadBtn")?.addEventListener("click", () => {
      this.jumpToHead();
    });
    this.observeWindowSizeChanges();
    this.observeWebviewScroll();
    this.observeTopBarHeight();
    document.addEventListener("keydown", (event) => {
      this.handleGlobalKeyboardShortcut(event);
    });
    document.addEventListener("click", (event) => {
      this.handleExternalLinkClick(event);
    });

    this.renderShowLoading();
    this.restorePreviousState(prevState);
    this.loadRepos(this.gitRepos, lastActiveRepo);
    this.renderSettingsWidget();
    this.requestLoadBranchesAndCommits(false);
  }

  private restorePreviousState(prevState: WebViewState | null) {
    if (prevState === null) return;

    this.restorePreviousFilters(prevState);
    this.showRemoteBranches = prevState.showRemoteBranches;
    this.showRemoteBranchesElem.checked = this.showRemoteBranches;
    this.settingsWidgetOpen = prevState.settingsWidgetOpen === true;
    this.settingsWidgetTab = this.normalizeSettingsWidgetTab(prevState.settingsWidgetTab);
    this.lastWorktreeFinish = normalizeWorktreeFinish(prevState.worktreeFinish);
    this.restoreHiddenColumns(
      prevState.hiddenColumns ?? [],
      prevState.columnVisibilityVersion === COLUMN_VISIBILITY_STATE_VERSION
    );

    const repoState = this.gitRepos[prevState.currentRepo];
    if (repoState === undefined) return;

    this.restorePreviousRepoState(prevState, repoState);
  }

  private restorePreviousFilters(prevState: WebViewState) {
    this.currentBranch = prevState.currentBranch;
    this.currentBranches =
      prevState.currentBranches === undefined
        ? this.legacyCurrentBranchToFilter(prevState.currentBranch)
        : prevState.currentBranches;
    this.currentAuthors = prevState.currentAuthors ?? null;
    this.currentTags = prevState.currentTags ?? null;
  }

  private restoreHiddenColumns(columns: readonly string[], replaceDefaults: boolean) {
    if (replaceDefaults) this.hiddenColumns.clear();
    for (const column of columns) {
      if (isHideableColumn(column)) this.hiddenColumns.add(column);
    }
  }

  private restorePreviousRepoState(prevState: WebViewState, repoState: GGL.GitRepoState) {
    const savedOrdering = prevState.commitOrdering ?? "";
    if (isCommitOrdering(savedOrdering) && repoState.commitOrdering === undefined) {
      repoState.commitOrdering = savedOrdering;
    }

    this.currentRepo = prevState.currentRepo;
    this.maxCommits = prevState.maxCommits;
    this.restoreExpandedCommitState(prevState.expandedCommit);
    this.avatars = prevState.avatars;
    this.gitAuthors = prevState.gitAuthors ?? [];
    this.gitTags = prevState.gitTags ?? [];
    this.gitRemotes = prevState.gitRemotes ?? [];
    this.gitStashes = prevState.gitStashes ?? [];
    this.syncRepoSettingsControls();
    this.loadBranches(null, prevState.gitBranches, prevState.gitBranchHead, true, true, [], {});
    this.loadCommits(
      null,
      prevState.commits,
      prevState.commitHead,
      prevState.moreCommitsAvailable,
      true
    );
  }

  private restoreExpandedCommitState(expandedCommit: ExpandedCommit | null) {
    this.expandedCommit = expandedCommit;
    if (this.expandedCommit === null) return;

    this.expandedCommit.comparison ??= null;
    this.expandedCommit.detailsHeight = clampCommitDetailsHeight(this.expandedCommit.detailsHeight);
    this.expandedCommit.summaryOpen = this.expandedCommit.summaryOpen !== false;
    this.expandedCommit.filesOpen = this.expandedCommit.filesOpen !== false;
  }

  /* Loading Data */
  /**
   * An "outside workspace" entry is not a repository yet: choosing it asks the
   * host to add it and switch the graph, as the Worktrees popup's Switch Graph
   * does. The dropdown snaps back to the current repository until the host
   * answers with the new list.
   */
  private switchToOutsideWorktree(value: string): boolean {
    const entry = this.repoLayout?.outside.find((outside) => outside.path === value);
    if (entry === undefined || Object.hasOwn(this.gitRepos, value)) return false;
    sendMessage({ command: "switchGraphToWorktree", repo: entry.repo, path: entry.path });
    this.renderRepoDropdown();
    return true;
  }

  private renderRepoDropdown() {
    const options = buildRepoOptions(this.gitRepos, this.repoLayout, {
      detached: l10n.repoDetached,
      outsideWorkspace: l10n.repoOutsideWorkspace,
      bareRepository: l10n.repoBareRepository
    });
    const repoControl = document.getElementById("repoControl");
    if (repoControl !== null) repoControl.style.display = options.length > 1 ? "" : "none";
    this.repoDropdown.setOptions(options, this.currentRepo);
  }

  public loadRepos(
    repos: GGL.GitRepoSet,
    lastActiveRepo: string | null,
    layout: GGL.RepoLayout | undefined = this.repoLayout
  ) {
    this.gitRepos = repos;
    this.repoLayout = layout;
    this.saveState();

    const repoPaths = Object.keys(repos);
    let changedRepo = false;
    if (lastActiveRepo !== null && repos[lastActiveRepo] !== undefined) {
      changedRepo = this.currentRepo !== lastActiveRepo;
      this.currentRepo = lastActiveRepo;
      this.saveState();
    } else if (repos[this.currentRepo] === undefined) {
      this.currentRepo = repoPaths[0] ?? "";
      this.saveState();
      changedRepo = true;
    }

    this.renderRepoDropdown();
    this.syncRepoSettingsControls();
    this.renderSettingsWidget();

    if (changedRepo) {
      this.currentBranch = null;
      this.currentBranches = null;
      this.currentAuthors = null;
      this.currentTags = null;
      this.gitAuthors = [];
      this.gitTags = [];
      this.gitRemotes = [];
      this.gitStashes = [];
      this.gitConfig = createEmptyGitConfig();
      this.gitWorktrees = [];
      this.gitUpstreams = {};
      this.gitBranchWorktrees = new Map();
      this.gitDetachedWorktreeHeads = new Map();
      this.updateRemoteActionsVisibility();
      this.refresh(true);
    }
  }

  public loadRepoInfo(requestId: number, repoInfo: GitRepoInfo) {
    if (!this.acceptLoadRepoInfoResponse(requestId)) return;
    this.gitAuthors = repoInfo.isRepo ? repoInfo.authors : [];
    this.gitTags = repoInfo.isRepo ? repoInfo.tags : [];
    this.gitRemotes = repoInfo.isRepo ? repoInfo.remotes : [];
    this.gitStashes = repoInfo.isRepo ? repoInfo.stashes : [];
    this.gitConfig = repoInfo.isRepo ? repoInfo.config : createEmptyGitConfig();
    this.currentAuthors = this.keepAvailableSelections(this.currentAuthors, this.gitAuthors);
    this.currentTags = this.keepAvailableSelections(this.currentTags, this.gitTags);
    this.saveState();
    this.updateFilterDropdowns();
    this.updateRemoteActionsVisibility();
    this.renderSettingsWidget();
    this.renderStashSection();
    this.renderLoadMoreFooter();
  }

  private updateRemoteActionsVisibility() {
    const hasRemotes = this.currentRepo !== "" && this.gitRemotes.length > 0;
    this.fetchBtn.hidden = !hasRemotes;
    this.fetchBtn.disabled = !hasRemotes;
    this.pushTagsBtn.hidden = !hasRemotes;
    this.pushTagsBtn.disabled = !hasRemotes;
  }

  private updateNoCommitsControls() {
    const hide = this.isNoCommitsRepository();
    this.branchControlElem.hidden = hide;
    this.authorControlElem.hidden = hide;
    this.tagControlElem.hidden = hide;
    this.showRemoteBranchesControlElem.hidden = hide;
  }

  private acceptLoadRepoInfoResponse(requestId: number) {
    if (this.activeLoadRepoInfoRequestId !== requestId) return false;
    this.activeLoadRepoInfoRequestId = null;
    return true;
  }

  public loadBranches(
    requestId: number | null,
    branchOptions: string[],
    branchHead: string | null,
    hard: boolean,
    isRepo: boolean,
    worktrees: GitWorktree[],
    upstreams: Record<string, string | null>,
    errorReason: string | null = null
  ) {
    if (!this.acceptLoadBranchesResponse(requestId)) return;
    if (errorReason !== null) {
      this.renderShowError(l10n.unableToLoadGitGraph, errorReason);
      this.triggerLoadBranchesCallback(false, isRepo);
      return;
    }
    if (!isRepo) {
      // No guess at why: the error screen asks the host to rediscover, and the
      // startup screen then shows what Git and the engine actually observed.
      this.renderShowError(l10n.unableToLoadGitGraph, null);
      this.triggerLoadBranchesCallback(false, isRepo);
      return;
    }
    if (
      !hard &&
      arraysEqual(this.gitBranches, branchOptions, (a, b) => a === b) &&
      this.gitBranchHead === branchHead &&
      JSON.stringify(this.gitWorktrees) === JSON.stringify(worktrees) &&
      JSON.stringify(this.gitUpstreams) === JSON.stringify(upstreams)
    ) {
      this.triggerLoadBranchesCallback(false, isRepo);
      return;
    }

    this.gitBranches = branchOptions;
    this.gitBranchHead = branchHead;
    this.gitWorktrees = worktrees;
    this.gitUpstreams = upstreams;
    this.gitBranchWorktrees = branchWorktreeMap(worktrees);
    this.gitDetachedWorktreeHeads = detachedWorktreeHeadMap(worktrees);
    this.worktreePopup.update(worktrees);
    const defaultBranchAllowed = this.currentBranch === null || this.currentBranch !== "";
    this.currentBranches = this.keepAvailableSelections(
      this.currentBranches,
      this.availableBranchFilterValues()
    );
    if (
      this.currentBranches === null &&
      defaultBranchAllowed &&
      this.config.showCurrentBranchByDefault &&
      this.gitBranchHead !== null
    ) {
      this.currentBranches = [this.gitBranchHead];
    }
    this.currentBranch = this.currentBranches?.[0] ?? FILTER_SHOW_ALL_VALUE;
    this.saveState();

    this.updateFilterDropdowns();
    this.updateNoCommitsControls();

    this.triggerLoadBranchesCallback(true, isRepo);
  }

  private legacyCurrentBranchToFilter(branch: string | null): string[] | null {
    return branch === null || branch === FILTER_SHOW_ALL_VALUE ? null : [branch];
  }

  private keepAvailableSelections(
    selected: string[] | null,
    availableValues: readonly string[]
  ): string[] | null {
    if (selected === null) return null;
    const kept = selected.filter((value) => availableValues.includes(value));
    return kept.length === 0 ? null : kept;
  }

  private availableBranchFilterValues() {
    return this.getBranchDropdownOptions()
      .map((option) => option.value)
      .filter((value) => value !== FILTER_SHOW_ALL_VALUE);
  }

  private updateFilterDropdowns() {
    this.branchDropdown.setOptions(this.getBranchDropdownOptions(), this.currentBranches);
    this.authorDropdown.setOptions(this.getAuthorDropdownOptions(), this.currentAuthors);
    this.tagDropdown.setOptions(this.getTagDropdownOptions(), this.currentTags);
  }

  private getBranchDropdownOptions(): DropdownOption[] {
    const options: DropdownOption[] = [{ name: l10n.showAll, value: FILTER_SHOW_ALL_VALUE }];
    options.push({ name: l10n.head, value: HEAD_REF_VALUE });
    for (const pattern of this.config.customBranchGlobPatterns) {
      options.push({ name: l10n.globPattern.replace("{0}", pattern.name), value: pattern.glob });
    }
    for (const branch of this.gitBranches) {
      options.push({
        name: branch.startsWith("remotes/") ? branch.substring(8) : branch,
        value: branch
      });
    }
    return options;
  }

  private getAuthorDropdownOptions(): DropdownOption[] {
    return [
      { name: l10n.showAll, value: FILTER_SHOW_ALL_VALUE },
      ...this.gitAuthors.map((author) => ({ name: author, value: author }))
    ];
  }

  private getTagDropdownOptions(): DropdownOption[] {
    return [
      { name: l10n.showAll, value: FILTER_SHOW_ALL_VALUE },
      ...this.gitTags.map((tag) => ({ name: tag, value: tag }))
    ];
  }
  private triggerLoadBranchesCallback(changes: boolean, isRepo: boolean) {
    if (this.loadBranchesCallback !== null) {
      this.loadBranchesCallback(changes, isRepo);
      this.loadBranchesCallback = null;
    }
  }
  private acceptLoadBranchesResponse(requestId: number | null) {
    if (requestId === null) return true;
    if (this.activeLoadBranchesRequestId !== requestId) return false;
    this.activeLoadBranchesRequestId = null;
    return true;
  }

  public loadCommits(
    requestId: number | null,
    commits: GitCommitNode[],
    commitHead: string | null,
    moreAvailable: boolean,
    hard: boolean,
    errorReason: string | null = null
  ) {
    if (!this.acceptLoadCommitsResponse(requestId)) return;
    if (errorReason !== null) {
      this.pendingFocusCommitHash = null;
      this.renderShowError(l10n.unableToLoadGitGraph, errorReason);
      this.triggerLoadCommitsCallback(false);
      return;
    }
    failureScreens.show(null);
    // Before the comparison below, so a refresh of an unchanged page stays
    // unchanged rather than dropping every signature back to pending.
    const page = this.withKnownSignatures(commits);
    if (
      !hard &&
      this.isTableMounted() &&
      this.isCommitListUnchanged(page, commitHead, moreAvailable)
    ) {
      this.refreshUncommittedChangesCommit(page);
      this.triggerLoadCommitsCallback(false);
      this.requestMissingSignatures();
      this.requestRemoteTags();
      return;
    }

    const activeFindHash = this.getActiveFindHash();
    this.moreCommitsAvailable = moreAvailable;
    this.commits = page;
    this.commitHead = commitHead;
    // Before the rows are drawn: a tag the snapshot lacks then shows no status
    // while this request runs, rather than "unavailable".
    this.requestRemoteTags();
    if (this.commits.length > 0 && this.commits[0].hash === "*") {
      const match = /\((\d+)\)$/.exec(this.commits[0].message);
      const count = match ? match[1] : "?";
      this.commits[0].message = l10n.uncommittedChanges.replace("{0}", count);
    }
    this.commitLookup = {};
    this.saveState();

    const { expandedCommitVisible, avatarsNeeded } = this.rebuildCommitIndexes();
    this.keepVisibleCommitSelection();

    this.graph.loadCommits(this.commits, this.commitHead, this.commitLookup);

    if (this.expandedCommit !== null && !expandedCommitVisible) {
      this.expandedCommit = null;
      this.saveState();
    }
    this.render(activeFindHash);
    this.revealPendingFocusCommit();

    this.triggerLoadCommitsCallback(true);
    this.fetchAvatars(avatarsNeeded);
    this.requestMissingSignatures();
  }
  private forgetRemoteTags() {
    this.remoteTagsResult = null;
    this.remoteTagsRequestId = null;
    this.remoteTagsRevalidate = false;
  }
  /**
   * Keep the snapshot on screen and ask for a new one: a request still in
   * flight is dropped, so its late reply is ignored.
   */
  private revalidateRemoteTags() {
    this.remoteTagsRequestId = null;
    this.remoteTagsRevalidate = true;
  }
  private visibleTagRefs() {
    return this.commits.flatMap((commit) => commit.refs.filter((ref) => ref.type === "tag"));
  }
  /** Whether a tag on screen is missing from the snapshot, or points elsewhere now. */
  private isTagOutsideSnapshot(ref: GitCommitNode["refs"][number]) {
    return this.remoteTagsResult?.tags[ref.name]?.hash !== ref.hash;
  }
  private needsRemoteTags(tags: GitCommitNode["refs"]) {
    const result = this.remoteTagsResult;
    if (result === null || this.remoteTagsRevalidate) return true;
    // A failed read lists no tags at all, so it would flag every one of them.
    return result.error === null && tags.some((ref) => this.isTagOutsideSnapshot(ref));
  }
  private requestRemoteTags() {
    if (this.config.showTagRemotes === "off") return;
    if (this.remoteTagsRepo !== this.currentRepo) {
      this.remoteTagsRepo = this.currentRepo;
      this.forgetRemoteTags();
    }
    if (this.remoteTagsRequestId !== null || !this.getShowTags()) return;
    const tags = this.visibleTagRefs();
    if (tags.length === 0 || !this.needsRemoteTags(tags)) return;
    const requestId = this.createRequestId();
    this.remoteTagsRequestId = requestId;
    this.remoteTagsRevalidate = false;
    sendMessage({ command: "remoteTags", requestId, repo: this.currentRepo });
  }
  public loadRemoteTags(msg: Extract<GGL.ResponseMessage, { command: "remoteTags" }>) {
    if (this.config.showTagRemotes === "off") return;
    if (msg.repo !== this.currentRepo || msg.requestId !== this.remoteTagsRequestId) return;
    this.remoteTagsRequestId = null;
    this.remoteTagsResult = msg;
    if (this.isTableMounted()) this.patchTagCells();
  }
  /**
   * Redraw the ref badges of the rows that carry a tag, in place, as
   * `loadCommitSignatures` fills its cells: the rest of the table and the
   * graph are untouched by a remote tag reply.
   */
  private patchTagCells() {
    this.commits.forEach((commit, index) => {
      if (commit.stash !== undefined || !commit.refs.some((ref) => ref.type === "tag")) return;
      const cell = this.tableElem.querySelector(`tr.commit[data-id="${index}"] > td:nth-child(2)`);
      const message = cell?.querySelector(":scope > .commitMessage");
      if (!(cell instanceof HTMLElement) || !message) return;
      for (const node of Array.from(cell.children)) {
        if (node === message) break;
        if (!node.classList.contains("commitHeadDot")) node.remove();
      }
      message.insertAdjacentHTML("beforebegin", this.renderCommitRefs(commit));
      this.registerGitRefContextMenuListener(cell);
      this.registerGitRefActivationListeners(cell);
    });
  }
  /**
   * A freshly loaded page with the signatures already read for this
   * repository filled in. A copy: the message the page arrived in is not
   * this view's to change.
   */
  private withKnownSignatures(commits: GitCommitNode[]): GitCommitNode[] {
    this.syncSignaturesRepo();
    return commits.map((commit) => {
      if (commit.hash === "*" || commit.signature !== undefined) return commit;
      const known = this.signatures.get(commit.hash);
      return known === undefined ? commit : { ...commit, signature: known };
    });
  }
  private syncSignaturesRepo() {
    if (this.signaturesRepo === this.currentRepo) return;
    this.signaturesRepo = this.currentRepo;
    this.forgetSignatures();
  }
  private forgetSignatures() {
    this.signatures.clear();
    this.signatureRequests.clear();
  }
  /**
   * Ask for the signatures of the shown commits that have none yet. The page is
   * already on screen with those cells pending; verification is the slow part,
   * so it is the only part that waits. Nothing is asked while the column is
   * hidden, or for a commit an unanswered request already covers.
   */
  private requestMissingSignatures() {
    if (this.hiddenColumns.has("signature")) return;
    this.syncSignaturesRepo();
    const requested = new Set([...this.signatureRequests.values()].flat());
    const hashes = this.commits
      .filter(
        (commit) =>
          commit.hash !== "*" && commit.signature === undefined && !requested.has(commit.hash)
      )
      .map((commit) => commit.hash);
    if (hashes.length === 0) return;
    const requestId = this.createRequestId();
    this.signatureRequests.set(requestId, hashes);
    setStatusStrip("loading", l10n.signatureLoading);
    sendMessage({ command: "commitSignatures", requestId, repo: this.currentRepo, hashes });
  }
  /** Take a `commitSignatures` answer: record it, and fill the cells it covers in place. */
  public loadCommitSignatures(
    requestId: number,
    repo: string,
    signatures: Record<string, GitCommitSignature | null>,
    errorReason: string | null
  ) {
    const hashes = this.signatureRequests.get(requestId);
    // An answer for a repository no longer shown, or from before a refresh
    // emptied the cache, describes nothing on screen.
    if (hashes === undefined || repo !== this.signaturesRepo) return;
    this.signatureRequests.delete(requestId);
    const settled = this.signatureRequests.size === 0;
    if (errorReason !== null) {
      if (statusStripShows("loading", l10n.signatureLoading)) {
        setStatusStrip("error", l10n.unableToLoadSignatures);
      }
      return;
    }
    for (const hash of hashes) {
      const signature = signatures[hash];
      if (signature === undefined) continue;
      this.signatures.set(hash, signature);
      const index = this.commitLookup[hash];
      const commit = index === undefined ? undefined : this.commits[index];
      if (commit?.hash !== hash) continue;
      commit.signature = signature;
      const cell = this.tableElem.querySelector(`tr[data-id="${index}"] > td.signatureCol`);
      if (cell !== null) cell.innerHTML = this.renderCommitSignature(signature);
    }
    this.saveState();
    if (settled && statusStripShows("loading", l10n.signatureLoading)) {
      setStatusStrip("ready", l10n.statusReady);
    }
  }
  /**
   * Whether the commit table is on screen. The loading and error placeholders
   * replace it, so an unchanged list arriving after either must still render.
   */
  private isTableMounted() {
    return this.tableElem.firstElementChild instanceof HTMLTableElement;
  }
  private isCommitListUnchanged(
    commits: GitCommitNode[],
    commitHead: string | null,
    moreAvailable: boolean
  ) {
    return (
      this.moreCommitsAvailable === moreAvailable &&
      this.commitHead === commitHead &&
      arraysEqual(this.commits, commits, (a, b) => this.isSameCommitNode(a, b))
    );
  }
  private isSameCommitNode(a: GitCommitNode, b: GitCommitNode) {
    return (
      a.hash === b.hash &&
      arraysEqual(a.refs, b.refs, (ra, rb) => ra.name === rb.name && ra.type === rb.type) &&
      arraysEqual(a.parentHashes, b.parentHashes, (pa, pb) => pa === pb) &&
      this.isSameCommitSignature(a.signature, b.signature)
    );
  }
  private isSameCommitSignature(a: GitCommitNode["signature"], b: GitCommitNode["signature"]) {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return false;
    return a.status === b.status && a.signer === b.signer && a.key === b.key;
  }
  private refreshUncommittedChangesCommit(commits: GitCommitNode[]) {
    if (this.commits.length === 0 || this.commits[0].hash !== "*") return;

    this.commits[0] = commits[0];
    this.saveState();
    this.renderUncommitedChanges();
  }
  private rebuildCommitIndexes() {
    let expandedCommitVisible = false;
    const avatarsNeeded: { [email: string]: string[] } = {};

    for (let i = 0; i < this.commits.length; i++) {
      const commit = this.commits[i];
      this.commitLookup[commit.hash] = i;
      if (this.expandedCommit !== null && this.expandedCommit.hash === commit.hash) {
        expandedCommitVisible = true;
      }
      this.queueAvatarIfNeeded(commit, avatarsNeeded);
    }

    return { expandedCommitVisible, avatarsNeeded };
  }
  private queueAvatarIfNeeded(commit: GitCommitNode, avatarsNeeded: { [email: string]: string[] }) {
    if (
      !this.config.fetchAvatars ||
      typeof this.avatars[commit.email] === "string" ||
      commit.email === ""
    ) {
      return;
    }

    avatarsNeeded[commit.email] ??= [];
    avatarsNeeded[commit.email].push(commit.hash);
  }
  private triggerLoadCommitsCallback(changes: boolean) {
    if (this.loadCommitsCallback !== null) {
      this.loadCommitsCallback(changes);
      this.loadCommitsCallback = null;
    }
  }
  private acceptLoadCommitsResponse(requestId: number | null) {
    if (requestId === null) return true;
    if (this.activeLoadCommitsRequestId !== requestId) return false;
    this.activeLoadCommitsRequestId = null;
    return true;
  }

  public loadAvatar(email: string, image: string) {
    this.avatars[email] = image;
    this.saveState();
    const avatarsElems = document.getElementsByClassName("avatar") as HTMLCollectionOf<HTMLElement>,
      escapedEmail = escapeHtml(email);
    for (const avatarElem of avatarsElems) {
      if (avatarElem.dataset.email === escapedEmail) {
        avatarElem.innerHTML = `<img class="avatarImg" src="${image}">`;
      }
    }
  }

  /* Refresh */
  public refresh(hard: boolean) {
    if (hard) {
      this.revalidateRemoteTags();
      if (this.expandedCommit !== null) {
        this.expandedCommit = null;
        this.saveState();
      }
      this.renderShowLoading(l10n.statusRefreshingGraph);
    }
    this.requestLoadBranchesAndCommits(hard);
  }

  /* Requests */
  private requestLoadRepoInfo() {
    if (this.currentRepo === "") {
      this.gitRemotes = [];
      this.gitStashes = [];
      this.gitConfig = createEmptyGitConfig();
      this.updateRemoteActionsVisibility();
      this.renderSettingsWidget();
      this.renderStashSection();
      this.renderLoadMoreFooter();
      this.activeLoadRepoInfoRequestId = null;
      return;
    }

    const requestId = this.createRequestId();
    this.activeLoadRepoInfoRequestId = requestId;
    sendMessage({
      command: "loadRepoInfo",
      requestId,
      repo: this.currentRepo,
      showStashes: this.getShowStashes(),
      ...(this.forceCliOnce ? { forceCli: true } : {})
    });
  }
  private requestLoadExtensionSettings() {
    if (this.extensionSettings !== null || this.activeLoadExtensionSettingsRequestId !== null) {
      return;
    }

    const requestId = this.createRequestId();
    this.activeLoadExtensionSettingsRequestId = requestId;
    sendMessage({ command: "loadExtensionSettings", requestId });
  }
  public loadExtensionSettings(
    requestId: number,
    settings: GGL.ExtensionSetting[],
    status: string | null
  ) {
    if (this.activeLoadExtensionSettingsRequestId !== requestId) return;
    this.activeLoadExtensionSettingsRequestId = null;
    if (status !== null) {
      showErrorDialog(l10n.unableToLoadExtensionSettings, status, this.settingsWidgetElem);
      return;
    }

    this.extensionSettings = settings;
    this.renderSettingsWidget();
  }
  public acceptExtensionSettingsUpdate(
    settings: GGL.ExtensionSetting[],
    status: string | null,
    errorLabel: string,
    changedKeys: readonly string[]
  ) {
    if (status !== null) {
      setStatusStrip("error", errorLabel);
      showErrorDialog(errorLabel, status, this.settingsWidgetElem);
      return;
    }

    hideDialog();
    setStatusStrip("ready", l10n.statusReady);
    this.extensionSettings = settings;
    this.applyExtensionSettings(settings, changedKeys);
    this.renderSettingsWidget();
  }
  private requestLoadBranches(
    hard: boolean,
    loadedCallback: (changes: boolean, isRepo: boolean) => void
  ) {
    const requestId = this.createRequestId();
    this.activeLoadBranchesRequestId = requestId;
    this.activeLoadCommitsRequestId = null;
    this.loadBranchesCallback = loadedCallback;
    this.loadCommitsCallback = null;
    sendMessage({ command: "selectRepo", repo: this.currentRepo });
    sendMessage({
      command: "loadBranches",
      requestId,
      showRemoteBranches: this.getShowRemoteBranches(),
      hiddenRemotes: this.getHiddenRemotes(),
      hard: hard
    });
  }
  private requestLoadCommits(hard: boolean, loadedCallback: (changes: boolean) => void) {
    const requestId = this.createRequestId();
    this.activeLoadCommitsRequestId = requestId;
    this.loadCommitsCallback = loadedCallback;
    sendMessage({
      command: "loadCommits",
      requestId,
      repo: this.currentRepo,
      branchName: this.currentBranch ?? "",
      branches: this.currentBranches,
      authors: this.currentAuthors,
      tags: this.currentTags,
      maxCommits: this.maxCommits,
      showRemoteBranches: this.getShowRemoteBranches(),
      hiddenRemotes: this.getHiddenRemotes(),
      showTags: this.getShowTags(),
      includeReflog: this.getIncludeReflog(),
      includeUnreachableCommits: this.getIncludeUnreachableCommits(),
      onlyFollowFirstParent: this.getOnlyFollowFirstParent(),
      commitOrdering: this.getCommitOrdering(),
      showStashes: this.getShowStashes() && this.config.stashDisplay !== "table",
      hard: hard,
      ...(this.forceCliOnce ? { forceCli: true } : {})
    });
    this.forceCliOnce = false;
  }
  private requestLoadBranchesAndCommits(hard: boolean) {
    this.requestLoadRepoInfo();
    this.requestLoadBranches(hard, (branchChanges: boolean, isRepo: boolean) => {
      if (isRepo) {
        this.requestLoadCommits(hard, (commitChanges: boolean) => {
          if (!hard && (branchChanges || commitChanges)) {
            hideDialogAndContextMenu();
          }
        });
      }
    });
  }
  private createRequestId() {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    return requestId;
  }
  private fetchAvatars(avatars: { [email: string]: string[] }) {
    const emails = Object.keys(avatars);
    for (const email of emails) {
      sendMessage({
        command: "fetchAvatar",
        repo: this.currentRepo,
        email,
        commits: avatars[email]
      });
    }
  }

  /* Find */
  private showFindWidget() {
    this.findControlElem.hidden = false;
    this.publishTopBarHeight();
    this.updateFindUi();
    this.findInputElem.focus();
    this.findInputElem.select();
  }
  public startHistorySearch() {
    this.showFindWidget();
    if (this.findQuery.trim() !== "") this.requestSearchCommits();
  }

  private clearFind() {
    this.findInputElem.value = "";
    this.findQuery = "";
    this.findMatches = [];
    this.activeFindMatchIndex = -1;
    this.findControlElem.hidden = true;
    this.publishTopBarHeight();
    this.updateFindUi();
    this.renderTable();
    this.renderGraph();
  }
  private updateFindQuery(query: string) {
    this.findQuery = query;
    this.activeFindMatchIndex = -1;
    this.recomputeFindMatches(null);
    this.updateFindUi();
    this.renderTable();
    this.renderGraph();
    this.revealActiveFindMatch();
  }
  private recomputeFindMatches(preferredHash: string | null) {
    if (this.findQuery.trim() === "") {
      this.findMatches = [];
      this.activeFindMatchIndex = -1;
      return;
    }

    const previousActiveHash =
      preferredHash ??
      (this.activeFindMatchIndex >= 0
        ? this.commits[this.findMatches[this.activeFindMatchIndex]]?.hash
        : null);
    this.findMatches = findCommitIndexes(this.commits, this.findQuery, this.config.shortHashLength);
    if (this.findMatches.length === 0) {
      this.activeFindMatchIndex = -1;
      return;
    }

    const preferredIndex = this.findMatches.findIndex(
      (commitIndex) => this.commits[commitIndex].hash === previousActiveHash
    );
    if (preferredIndex >= 0) {
      this.activeFindMatchIndex = preferredIndex;
    } else if (this.activeFindMatchIndex >= 0) {
      this.activeFindMatchIndex = Math.min(this.activeFindMatchIndex, this.findMatches.length - 1);
    } else {
      this.activeFindMatchIndex = 0;
    }
  }
  private getActiveFindHash() {
    if (this.activeFindMatchIndex < 0) return null;
    return this.commits[this.findMatches[this.activeFindMatchIndex]]?.hash ?? null;
  }
  private navigateFind(delta: number) {
    if (this.findMatches.length === 0) return;
    this.activeFindMatchIndex =
      (this.activeFindMatchIndex + delta + this.findMatches.length) % this.findMatches.length;
    this.updateFindUi();
    this.renderTable();
    this.renderGraph();
    this.revealActiveFindMatch();
  }
  private updateFindUi() {
    const hasQuery = this.findQuery.trim() !== "";
    const hasMatches = this.findMatches.length > 0;
    this.findPreviousBtn.disabled = !hasMatches;
    this.findNextBtn.disabled = !hasMatches;
    this.findSearchHistoryBtn.disabled = !hasQuery || this.activeSearchCommitsRequestId !== null;
    this.findControlElem.classList.toggle("findNoResults", hasQuery && !hasMatches);
    if (hasQuery && hasMatches) {
      this.findMatchCountElem.textContent = formatFindMatchCount(
        l10n.findMatchCount,
        this.activeFindMatchIndex,
        this.findMatches.length
      );
    } else if (hasQuery) {
      this.findMatchCountElem.textContent = l10n.findNoResults;
    } else {
      this.findMatchCountElem.textContent = "";
    }
  }
  private revealActiveFindMatch() {
    const activeCommitIndex = this.findMatches[this.activeFindMatchIndex];
    if (activeCommitIndex === undefined) return;
    const row = document.querySelector<HTMLTableRowElement>(
      `tr.commit[data-id="${activeCommitIndex.toString()}"]`
    );
    if (typeof row?.scrollIntoView === "function") {
      row.scrollIntoView({ block: "center" });
    }
  }
  private requestSearchCommits() {
    const query = this.findQuery.trim();
    if (query === "" || this.activeSearchCommitsRequestId !== null || this.currentRepo === "") {
      return;
    }

    const requestId = this.createRequestId();
    this.activeSearchCommitsRequestId = requestId;
    this.activeSearchQuery = query;
    this.updateFindUi();
    setStatusStrip("loading", l10n.statusSearchingHistory);
    sendMessage({
      command: "searchCommits",
      requestId,
      repo: this.currentRepo,
      query,
      maxResults: searchHistoryMaxResults,
      showRemoteBranches: this.getShowRemoteBranches(),
      hiddenRemotes: this.getHiddenRemotes(),
      showTags: this.getShowTags(),
      branches: this.currentBranches,
      authors: this.currentAuthors,
      tags: this.currentTags
    });
  }
  public loadSearchCommitResults(
    requestId: number,
    results: GitCommitSearchResult[],
    errorReason: string | null
  ) {
    const query = this.acceptSearchCommitsResponse(requestId);
    if (query === null) return;

    setStatusStrip("ready", l10n.statusReady);
    if (errorReason !== null) {
      showErrorDialog(l10n.unableToSearchCommits, errorReason, null);
      return;
    }
    if (results.length === 0) {
      showErrorDialog(
        l10n.dialogSearchHistoryNoResults.replace("{0}", `<b>${escapeHtml(query)}</b>`),
        null,
        null
      );
      return;
    }

    showSelectDialog(
      l10n.dialogSearchHistoryResults.replace("{0}", `<b>${escapeHtml(query)}</b>`),
      results[0].hash,
      results.map((result) => ({
        name: `${this.displayHash(result.hash)} - ${result.message} (${result.author})`,
        value: result.hash
      })),
      l10n.dialogSearchHistoryOpen,
      (hash) => {
        const selected = results.find((result) => result.hash === hash);
        if (selected !== undefined) this.revealSearchResult(selected);
      },
      null
    );
  }
  private acceptSearchCommitsResponse(requestId: number) {
    if (this.activeSearchCommitsRequestId !== requestId) return null;
    const query = this.activeSearchQuery ?? this.findQuery.trim();
    this.activeSearchCommitsRequestId = null;
    this.activeSearchQuery = null;
    this.updateFindUi();
    return query;
  }
  private revealSearchResult(result: GitCommitSearchResult) {
    if (this.revealCommit(result.hash)) return;

    this.pendingFocusCommitHash = result.hash;
    this.currentBranch = FILTER_SHOW_ALL_VALUE;
    this.currentBranches = null;
    this.updateFilterDropdowns();
    this.maxCommits = Math.max(this.maxCommits, result.loadCount);
    this.hideCommitDetails();
    this.saveState();
    this.renderShowLoading();
    this.requestLoadCommits(true, () => {});
  }
  private revealPendingFocusCommit() {
    if (this.pendingFocusCommitHash === null) return;
    const hash = this.pendingFocusCommitHash;
    this.pendingFocusCommitHash = null;
    if (!this.revealCommit(hash)) showErrorDialog(l10n.unableToShowSearchResult, null, null);
  }
  private revealCommit(hash: string) {
    const row = this.findAnyRowByHash(hash);
    if (row === null) return false;
    if (typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    row.focus({ preventScroll: true });
    startRevealHighlight(row);
    return true;
  }
  private findCommitRow(hash: string) {
    const elems = document.getElementsByClassName("commit") as HTMLCollectionOf<HTMLElement>;
    for (const elem of Array.from(elems)) {
      if (elem.dataset.hash === hash) return elem;
    }
    return null;
  }
  private handleFindInputKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.navigateFind(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.clearFind();
    }
  }
  public handleGlobalKeyboardShortcut(event: KeyboardEvent) {
    if (
      event.key === "Escape" &&
      this.worktreePopup.isOpen() &&
      !isEditableTarget(event.target) &&
      !isDialogActive() &&
      !isContextMenuActive()
    ) {
      event.preventDefault();
      this.worktreePopup.close();
      return true;
    }
    if (
      event.key === "Escape" &&
      this.settingsWidgetOpen &&
      !isEditableTarget(event.target) &&
      !isDialogActive() &&
      !isContextMenuActive()
    ) {
      event.preventDefault();
      this.closeSettingsWidget();
      return true;
    }

    const action = resolveGlobalShortcut(event, {
      isEditableTarget: isEditableTarget(event.target),
      isDialogActive: isDialogActive(),
      isContextMenuActive: isContextMenuActive(),
      isFindWidgetVisible: !this.findControlElem.hidden,
      hasFindQuery: this.findQuery.trim() !== "",
      isCommitDetailsOpen: this.expandedCommit !== null
    });
    if (action === null) return false;

    event.preventDefault();
    switch (action.type) {
      case "closeCommitDetails":
        this.hideCommitDetails();
        break;
      case "closeFind":
        this.clearFind();
        break;
      case "commitDetailsNavigate":
        this.navigateCommitDetails(action.delta);
        break;
      case "findNavigate":
        this.navigateFind(action.delta);
        break;
      case "jumpToHead":
        this.jumpToHead();
        break;
      case "refresh":
        this.refresh(true);
        break;
      case "showFind":
        this.showFindWidget();
        break;
    }
    return true;
  }
  private jumpToHead() {
    if (this.commitHead === null) return;
    if (this.revealCommit(this.commitHead)) return;

    // The HEAD row is not rendered (excluded by the active filters), so clear
    // the filters and reveal it once the reloaded commits have been rendered.
    this.pendingFocusCommitHash = this.commitHead;
    this.currentBranch = FILTER_SHOW_ALL_VALUE;
    this.currentBranches = null;
    this.currentAuthors = null;
    this.currentTags = null;
    this.updateFilterDropdowns();
    this.hideCommitDetails();
    this.saveState();
    this.renderShowLoading();
    this.requestLoadCommits(true, () => {});
  }
  private showFetchDialog() {
    if (this.currentRepo === "" || this.gitRemotes.length === 0) return;

    showFormDialog(
      l10n.dialogFetchConfirm,
      [
        { type: "checkbox" as const, name: l10n.dialogFetchPrune, value: false },
        { type: "checkbox" as const, name: l10n.dialogFetchPruneTags, value: false },
        {
          type: "checkbox" as const,
          name: l10n.dialogFetchTags,
          value: this.config.fetchTagsByDefault
        }
      ],
      l10n.dialogFetchSubmit,
      (values) => {
        const prune = values[0] === "checked";
        const pruneTags = values[1] === "checked";
        const fetchTags = values[2] === "checked";
        if (pruneTags && !prune) {
          showErrorDialog(l10n.dialogFetchPruneTagsRequiresPrune, null, this.fetchBtn);
          return;
        }
        sendMessage({
          command: "fetchRemotes",
          repo: this.currentRepo,
          prune,
          pruneTags
        });
        if (fetchTags) {
          sendMessage({
            command: "fetchTags",
            repo: this.currentRepo,
            remotes: this.getRemoteNames(),
            pruneTags
          });
        }
        showActionRunningDialog(l10n.statusFetchingRemotes);
      },
      this.fetchBtn
    );
  }

  private navigateCommitDetails(delta: number) {
    if (this.expandedCommit === null) return;
    const targetId = (this.expandedCommit.id + delta).toString();
    const targetRow = document.querySelector<HTMLElement>(
      `tr.commit[data-id="${targetId}"],tr.stashGraphRow[data-id="${targetId}"]`
    );
    const hash = targetRow?.dataset.hash;
    if (targetRow === null || hash === undefined || hash === this.expandedCommit.hash) return;
    this.loadCommitDetails(targetRow);
    targetRow.focus();
  }

  /* State */
  /** The other worktrees that have `branch` checked out; W11 and W12 read their markers from here. */
  public worktreePathsFor(branch: string): string[] {
    return this.gitBranchWorktrees.get(branch) ?? [];
  }

  private saveState() {
    vscode.setState({
      gitRepos: this.gitRepos,
      gitBranches: this.gitBranches,
      gitBranchHead: this.gitBranchHead,
      gitRemotes: this.gitRemotes,
      gitStashes: this.gitStashes,
      gitAuthors: this.gitAuthors,
      gitTags: this.gitTags,
      commits: this.commits,
      commitHead: this.commitHead,
      avatars: this.avatars,
      currentBranch: this.currentBranch,
      currentBranches: this.currentBranches,
      currentAuthors: this.currentAuthors,
      currentTags: this.currentTags,
      currentRepo: this.currentRepo,
      moreCommitsAvailable: this.moreCommitsAvailable,
      maxCommits: this.maxCommits,
      showRemoteBranches: this.showRemoteBranches,
      expandedCommit: this.expandedCommit,
      hiddenColumns: [...this.hiddenColumns],
      columnVisibilityVersion: COLUMN_VISIBILITY_STATE_VERSION,
      settingsWidgetOpen: this.settingsWidgetOpen,
      settingsWidgetTab: this.settingsWidgetTab,
      worktreeFinish: this.lastWorktreeFinish
    });
  }

  private normalizeSettingsWidgetTab(
    tab: GGL.SettingsWidgetTab | undefined
  ): GGL.SettingsWidgetTab {
    if (tab === "extension" || tab === "contributors") return tab;
    return "repository";
  }

  private getCurrentRepoState(): GGL.GitRepoState | null {
    return this.gitRepos[this.currentRepo] ?? null;
  }

  private getHiddenRemotes() {
    const hiddenRemotes = this.getCurrentRepoState()?.hiddenRemotes ?? [];
    return [
      ...new Set(hiddenRemotes.map((remote) => remote.trim()).filter((remote) => remote !== ""))
    ];
  }

  private getRepoBooleanDefaults(): Record<RepoBooleanSettingKey, boolean> {
    return {
      includeReflog: this.config.includeReflog,
      includeUnreachableCommits: this.config.includeUnreachableCommits,
      onlyFollowFirstParent: this.config.onlyFollowFirstParent,
      showRemoteBranches: this.config.showRemoteBranches,
      showStashes: this.config.showStashes,
      showTags: this.config.showTags
    };
  }

  private getRepoBooleanSetting(key: RepoBooleanSettingKey) {
    const repoState = this.getCurrentRepoState();
    return resolveRepoBooleanOverride(repoState?.[key], this.getRepoBooleanDefaults()[key]);
  }

  private getShowRemoteBranches() {
    return this.getRepoBooleanSetting("showRemoteBranches");
  }

  private getShowStashes() {
    return this.getRepoBooleanSetting("showStashes");
  }

  private getShowTags() {
    return this.getRepoBooleanSetting("showTags");
  }

  private getIncludeReflog() {
    return this.getRepoBooleanSetting("includeReflog");
  }

  private getIncludeUnreachableCommits() {
    return this.getRepoBooleanSetting("includeUnreachableCommits");
  }

  private getOnlyFollowFirstParent() {
    return this.getRepoBooleanSetting("onlyFollowFirstParent");
  }

  private syncRepoSettingsControls() {
    this.showRemoteBranches = this.getShowRemoteBranches();
    this.showRemoteBranchesElem.checked = this.showRemoteBranches;
  }

  private applyExtensionSettings(settings: GGL.ExtensionSetting[], changedKeys: readonly string[]) {
    const beforeRemoteBranches = this.getShowRemoteBranches();
    const beforeStashes = this.getShowStashes();
    const beforeStashDisplay = this.config.stashDisplay;
    const beforeTags = this.getShowTags();
    const beforeIncludeReflog = this.getIncludeReflog();
    const beforeIncludeUnreachable = this.getIncludeUnreachableCommits();
    const beforeFirstParent = this.getOnlyFollowFirstParent();
    const beforeTagRemotes = this.config.showTagRemotes;
    let reloadHistory = false;

    for (const setting of settings) {
      reloadHistory = this.applyExtensionSetting(setting) || reloadHistory;
    }

    if (changedKeys.includes(SIGNATURE_COLUMN_SETTING_KEY)) {
      const wasHidden = this.hiddenColumns.has("signature");
      if (this.config.showSignatureColumn) {
        this.hiddenColumns.delete("signature");
      } else {
        this.hiddenColumns.add("signature");
      }
      const isHidden = this.hiddenColumns.has("signature");
      if (wasHidden !== isHidden) this.saveState();
      if (wasHidden && !isHidden) reloadHistory = true;
    }

    this.syncGraphColorStyles();
    this.syncRepoSettingsControls();
    this.updateFilterDropdowns();

    const repoFilterDefaultsChanged =
      beforeRemoteBranches !== this.getShowRemoteBranches() ||
      beforeStashes !== this.getShowStashes() ||
      beforeStashDisplay !== this.config.stashDisplay ||
      beforeTags !== this.getShowTags() ||
      beforeIncludeReflog !== this.getIncludeReflog() ||
      beforeIncludeUnreachable !== this.getIncludeUnreachableCommits() ||
      beforeFirstParent !== this.getOnlyFollowFirstParent();
    reloadHistory = reloadHistory || repoFilterDefaultsChanged;

    // Off drops what is shown, so the next render is the plain badge; on asks
    // as an explicit Refresh would, once the rows are drawn.
    const tagRemotesChanged = beforeTagRemotes !== this.config.showTagRemotes;
    if (tagRemotesChanged) this.forgetRemoteTags();
    this.renderTable();
    this.renderGraph();
    if (tagRemotesChanged && this.config.showTagRemotes !== "off") this.revalidateRemoteTags();
    if (reloadHistory) {
      this.maxCommits = this.config.initialLoadCommits;
      this.renderShowLoading();
      this.requestLoadBranchesAndCommits(true);
    } else {
      this.requestRemoteTags();
    }
  }

  private applyExtensionSetting(setting: GGL.ExtensionSetting) {
    const value = setting.value;
    if (setting.configKey === "dateType") return true;
    if (setting.configKey === "showUncommittedChanges") return typeof value === "boolean";
    if (setting.configKey === "repository.worktreePathTemplate") {
      // Raw echo: text is trimmed, anything else is the default folder.
      this.config.worktreePathTemplate = normalizeWorktreePathTemplate(value);
      return false;
    }
    if (setting.configKey === "repository.showTagRemotes") {
      // Raw echo: anything but a known mode, a stale boolean included, is the default.
      this.config.showTagRemotes = parseTagRemotesMode(value);
      return false;
    }
    if (this.applyBooleanExtensionSetting(setting.configKey, value)) return false;
    if (this.applyNumberExtensionSetting(setting.configKey, value)) return false;
    if (this.applyStringExtensionSetting(setting.configKey, value)) return false;
    this.applyStructuredExtensionSetting(setting.configKey, value);
    return false;
  }

  private applyBooleanExtensionSetting(configKey: string, value: GGL.JsonValue) {
    if (typeof value !== "boolean") return false;
    switch (configKey) {
      case "autoCenterCommitDetailsView":
        this.config.autoCenterCommitDetailsView = value;
        return true;
      case "commitDetails.compactFolders":
        this.config.commitDetailsCompactFolders = value;
        viewState.commitDetailsCompactFolders = value;
        return true;
      case "fetchAvatars":
        this.config.fetchAvatars = value;
        return true;
      case "columns.signature":
        this.config.showSignatureColumn = value;
        viewState.showSignatureColumn = value;
        return true;
      case "repository.includeReflog":
        this.config.includeReflog = value;
        return true;
      case "repository.includeUnreachableCommits":
        this.config.includeUnreachableCommits = value;
        return true;
      case "repository.muteCommitsNotAncestorsOfHead":
        this.config.muteCommitsNotAncestorsOfHead = value;
        return true;
      case "repository.muteMergeCommits":
        this.config.muteMergeCommits = value;
        return true;
      case "repository.boldCheckedOutCommit":
        this.config.boldCheckedOutCommit = value;
        return true;
      case "repository.fetchTagsByDefault":
        this.config.fetchTagsByDefault = value;
        return true;
      case "dialog.merge.noFastForward":
        this.config.mergeNoFastForward = value;
        return true;
      case "dialog.pullBranch.noFastForward":
        this.config.pullBranchNoFastForward = value;
        return true;
      case "dialog.createBranch.checkout":
        this.config.createBranchCheckout = value;
        return true;
      case "repository.onlyFollowFirstParent":
        this.config.onlyFollowFirstParent = value;
        return true;
      case "repository.showRemoteBranches":
        this.config.showRemoteBranches = value;
        return true;
      case "repository.showStashes":
        this.config.showStashes = value;
        return true;
      case "repository.showTags":
        this.config.showTags = value;
        return true;
      case "showCurrentBranchByDefault":
        this.config.showCurrentBranchByDefault = value;
        return true;
    }
    return false;
  }

  private applyNumberExtensionSetting(configKey: string, value: GGL.JsonValue) {
    if (typeof value !== "number") return false;
    switch (configKey) {
      case "graph.fontSize":
        this.applyGraphFontSize(value);
        return true;
      case "graph.rowHeight":
        this.applyGraphRowHeight(value);
        return true;
      case "initialLoadCommits":
        this.config.initialLoadCommits = value;
        return true;
      case "loadMoreCommits":
        this.config.loadMoreCommits = value;
        return true;
      case "shortHashLength":
        this.config.shortHashLength = value;
        return true;
    }
    return false;
  }

  private applyStringExtensionSetting(configKey: string, value: GGL.JsonValue) {
    if (typeof value !== "string") return false;
    switch (configKey) {
      case "uncommittedChanges.fileViewMode":
        if (value === "tree" || value === "list") this.config.uncommittedFileViewMode = value;
        break;
      case "commitDetails.fileViewMode":
        if (value === "tree" || value === "list") this.config.commitDetailsFileViewMode = value;
        return true;
      case "repository.stashDisplay":
        if (value === "table" || value === "graph" || value === "both") {
          this.config.stashDisplay = value;
        }
        return true;
      case "dateFormat":
        if (value === "Date & Time" || value === "Date Only" || value === "Relative") {
          viewState.dateFormat = value;
        }
        return true;
      case "graphStyle":
        if (value === "rounded" || value === "angular") this.config.graphStyle = value;
        return true;
      case "revealHighlightColor":
        this.applyRevealHighlightColor(value);
        return true;
    }
    return false;
  }

  private applyStructuredExtensionSetting(configKey: string, value: GGL.JsonValue) {
    if (configKey === "contextMenuActionsVisibility" && isJsonObject(value)) {
      // Normalize, exactly as `config.contextMenuActionsVisibility()` does for
      // the value baked into the boot view state. The host echoes back what is
      // *stored*, which is the manifest default `{}` until the user sets
      // something and can be partial after that; assigning it straight through
      // left `this.config.contextMenuActionsVisibility[group]` undefined, and
      // `isContextMenuActionVisible()` then threw for every group — one
      // settings-hub change killed every context menu in the graph until the
      // view was reloaded.
      this.config.contextMenuActionsVisibility = normalizeContextMenuActionsVisibility(value);
    } else if (configKey === "customBranchGlobPatterns" && Array.isArray(value)) {
      this.config.customBranchGlobPatterns = value
        .map(normalizeCustomBranchGlobPattern)
        .filter((pattern): pattern is GGL.CustomBranchGlobPattern => pattern !== null);
    } else if (configKey === "graphColors" && Array.isArray(value)) {
      this.config.graphColors = value.filter((color): color is string => typeof color === "string");
    }
  }

  private applyGraphFontSize(value: number) {
    this.config.graphFontSize = value;
    document.body.style.setProperty("--git-graph-font-size", `${value}px`);
  }

  private applyGraphRowHeight(value: number) {
    this.config.graphRowHeight = value;
    this.config.grid.y = value;
    document.body.style.setProperty("--git-graph-row-height", `${value}px`);
  }

  private applyRevealHighlightColor(value: string) {
    const color = toOklch(value) === null ? DEFAULT_REVEAL_HIGHLIGHT_COLOR : value;
    this.config.revealHighlightColor = color;
    document.body.style.setProperty("--ngg-reveal-highlight", color);
  }

  private syncGraphColorStyles() {
    for (let i = 0; i < this.config.graphColors.length; i++) {
      document.body.style.setProperty(`--git-graph-color${i}`, this.config.graphColors[i]);
    }

    let style = document.getElementById("graphColorStyle");
    if (style === null) {
      style = document.createElement("style");
      style.id = "graphColorStyle";
      document.head.appendChild(style);
    }
    style.textContent = this.config.graphColors
      .map(
        (_color, index) =>
          `[data-color="${index}"]{--git-graph-color:var(--git-graph-color${index});}`
      )
      .join(" ");
  }

  private saveCurrentRepoState(repoState: GGL.GitRepoState) {
    this.saveState();
    sendMessage({
      command: "saveRepoState",
      repo: this.currentRepo,
      state: repoState
    });
  }

  private setRepoBooleanSetting(key: RepoBooleanSettingKey, value: GGL.RepoBooleanOverride) {
    const repoState = this.getCurrentRepoState();
    if (repoState === null) return;

    if (value === "default") {
      delete repoState[key];
    } else {
      repoState[key] = value;
    }
    this.maxCommits = this.config.initialLoadCommits;
    this.expandedCommit = null;
    this.syncRepoSettingsControls();
    this.saveCurrentRepoState(repoState);
    this.renderSettingsWidget();
    this.renderShowLoading();
    this.requestLoadBranchesAndCommits(true);
  }

  private toggleSettingsWidget() {
    if (this.settingsWidgetOpen) {
      this.closeSettingsWidget();
    } else {
      this.openSettingsWidget();
    }
  }

  private openSettingsWidget() {
    this.settingsWidgetOpen = true;
    this.saveState();
    this.renderSettingsWidget();
  }

  private closeSettingsWidget() {
    if (!this.settingsWidgetOpen) return;
    this.settingsWidgetOpen = false;
    this.saveState();
    this.renderSettingsWidget();
  }

  private renderSettingsWidget() {
    const repoState = this.getCurrentRepoState();
    const shouldShow = this.settingsWidgetOpen && this.currentRepo !== "" && repoState !== null;
    this.settingsBtn.classList.toggle("active", shouldShow);
    this.settingsBtn.setAttribute("aria-pressed", shouldShow.toString());

    if (!shouldShow || repoState === null) {
      this.settingsWidgetBackingElem.hidden = true;
      this.settingsWidgetElem.hidden = true;
      this.settingsWidgetElem.classList.remove("active");
      this.settingsWidgetElem.innerHTML = "";
      return;
    }

    this.settingsWidgetBackingElem.hidden = false;
    this.settingsWidgetElem.hidden = false;
    this.settingsWidgetElem.classList.add("active");
    this.settingsWidgetElem.innerHTML = renderSettingsWidget({
      repo: this.currentRepo,
      repoState,
      config: this.gitConfig,
      remotes: this.gitRemotes,
      hasLinkedWorktrees: this.gitWorktrees.length > 1,
      defaults: this.getRepoBooleanDefaults(),
      activeTab: this.settingsWidgetTab,
      extensionSettings: this.extensionSettings,
      labels: {
        title: l10n.settings,
        close: l10n.settingsClose,
        repositoryTab: l10n.settingsRepositoryTab,
        extensionTab: l10n.settingsExtensionTab,
        contributorsTab: l10n.settingsContributorsTab,
        contributorsThanks: l10n.settingsContributorsThanks,
        contributorsEraLibre: l10n.settingsContributorsEraLibre,
        contributorsEraFork: l10n.settingsContributorsEraFork,
        contributorsEraOriginal: l10n.settingsContributorsEraOriginal,
        contributorsEraEngine: l10n.settingsContributorsEraEngine,
        contributorsEraLibreLicense: l10n.settingsContributorsEraLibreLicense,
        contributorsEraForkLicense: l10n.settingsContributorsEraForkLicense,
        contributorsEraOriginalLicense: l10n.settingsContributorsEraOriginalLicense,
        contributorsEraEngineLicense: l10n.settingsContributorsEraEngineLicense,
        contributorsMitNote: l10n.settingsContributorsMitNote,
        contributorsAgents: l10n.settingsContributorsAgents,
        contributorsAgentsNote: l10n.settingsContributorsAgentsNote,
        general: l10n.settingsGeneral,
        repositoryName: l10n.settingsRepositoryName,
        repositoryWorktreesNote: l10n.settingsRepositoryWorktreesNote,
        edit: l10n.settingsEdit,
        clear: l10n.settingsClear,
        showRemoteBranches: l10n.settingsShowRemoteBranches,
        showStashes: l10n.settingsShowStashes,
        showTags: l10n.settingsShowTags,
        includeReflog: l10n.settingsIncludeReflog,
        includeUnreachableCommits: l10n.settingsIncludeUnreachableCommits,
        onlyFollowFirstParent: l10n.settingsOnlyFollowFirstParent,
        defaultOn: l10n.settingsDefaultOn,
        defaultOff: l10n.settingsDefaultOff,
        enabled: l10n.settingsEnabled,
        disabled: l10n.settingsDisabled,
        userDetails: l10n.settingsUserDetails,
        userName: l10n.settingsUserName,
        userEmail: l10n.settingsUserEmail,
        local: l10n.settingsLocal,
        global: l10n.settingsGlobal,
        notSet: l10n.settingsNotSet,
        addUserDetails: l10n.settingsAddUserDetails,
        editUserDetails: l10n.settingsEditUserDetails,
        removeUserDetails: l10n.settingsRemoveUserDetails,
        remoteConfiguration: l10n.settingsRemoteConfiguration,
        remoteFetchUrl: l10n.settingsRemoteFetchUrl,
        remotePushUrl: l10n.settingsRemotePushUrl,
        remoteHidden: l10n.settingsRemoteHidden,
        remoteVisible: l10n.settingsRemoteVisible,
        addRemote: l10n.settingsAddRemote,
        editRemote: l10n.settingsEditRemote,
        deleteRemote: l10n.settingsDeleteRemote,
        fetchRemote: l10n.settingsFetchRemote,
        pruneRemote: l10n.settingsPruneRemote,
        hideRemote: l10n.settingsHideRemote,
        showRemote: l10n.settingsShowRemote,
        noRemotes: l10n.settingsNoRemotes,
        issueLinking: l10n.settingsIssueLinking,
        issuePattern: l10n.settingsIssuePattern,
        issueUrlTemplate: l10n.settingsIssueUrlTemplate,
        noIssueLinking: l10n.settingsNoIssueLinking,
        addIssueLinking: l10n.settingsAddIssueLinking,
        removeIssueLinking: l10n.settingsRemoveIssueLinking,
        pullRequestCreation: l10n.settingsPullRequestCreation,
        pullRequestRemote: l10n.settingsPullRequestRemote,
        pullRequestBaseBranch: l10n.settingsPullRequestBaseBranch,
        pullRequestUrlTemplate: l10n.settingsPullRequestUrlTemplate,
        pullRequestPushBeforeCreate: l10n.settingsPullRequestPushBeforeCreate,
        noPullRequestCreation: l10n.settingsNoPullRequestCreation,
        configurePullRequest: l10n.settingsConfigurePullRequest,
        removePullRequest: l10n.settingsRemovePullRequest,
        repositoryConfiguration: l10n.settingsRepositoryConfiguration,
        exportRepositoryConfiguration: l10n.settingsExportRepositoryConfiguration,
        importRepositoryConfiguration: l10n.settingsImportRepositoryConfiguration,
        extensionSettings: l10n.settingsExtensionSettings,
        extensionSettingsLoading: l10n.settingsExtensionSettingsLoading,
        extensionScopeDefault: l10n.settingsExtensionScopeDefault,
        extensionScopeGlobal: l10n.settingsExtensionScopeGlobal,
        extensionScopeWorkspace: l10n.settingsExtensionScopeWorkspace,
        extensionScopeWorkspaceFolder: l10n.settingsExtensionScopeWorkspaceFolder,
        extensionJsonEdit: l10n.settingsExtensionJsonEdit,
        extensionGraphColors: l10n.settingsExtensionGraphColors,
        extensionGraphColorsPreview: l10n.settingsExtensionGraphColorsPreview,
        extensionGraphColorsLightness: l10n.settingsExtensionGraphColorsLightness,
        extensionGraphColorsChroma: l10n.settingsExtensionGraphColorsChroma,
        exportExtensionSettings: l10n.settingsExportExtensionSettings,
        importExtensionSettings: l10n.settingsImportExtensionSettings
      }
    });
    this.settingsWidgetElem.focus({ preventScroll: true });
    this.bindSettingsWidget();
    if (this.settingsWidgetTab === "extension") this.requestLoadExtensionSettings();
  }

  private bindSettingsWidget() {
    document.getElementById("settingsCloseBtn")?.addEventListener("click", () => {
      this.closeSettingsWidget();
    });
    this.bindSettingsTabs();
    document.getElementById("settingsEditRepoName")?.addEventListener("click", () => {
      this.showRepoNameDialog();
    });
    document.getElementById("settingsClearRepoName")?.addEventListener("click", () => {
      this.clearRepoName();
    });
    document.getElementById("settingsEditUserDetails")?.addEventListener("click", () => {
      this.showUserDetailsDialog();
    });
    document.getElementById("settingsRemoveUserDetails")?.addEventListener("click", () => {
      this.showRemoveUserDetailsDialog();
    });
    document.getElementById("settingsAddRemote")?.addEventListener("click", () => {
      this.showAddRemoteDialog();
    });
    document.getElementById("settingsEditIssueLinking")?.addEventListener("click", () => {
      this.showIssueLinkingDialog();
    });
    document.getElementById("settingsRemoveIssueLinking")?.addEventListener("click", () => {
      this.removeIssueLinking();
    });
    document.getElementById("settingsEditPullRequest")?.addEventListener("click", () => {
      this.showPullRequestSettingsDialog();
    });
    document.getElementById("settingsRemovePullRequest")?.addEventListener("click", () => {
      this.removePullRequestSettings();
    });
    document.getElementById("settingsExportRepoConfig")?.addEventListener("click", () => {
      this.showExportRepoConfigDialog();
    });
    document.getElementById("settingsImportRepoConfig")?.addEventListener("click", () => {
      this.showImportRepoConfigDialog();
    });
    document.getElementById("settingsExportExtensionSettings")?.addEventListener("click", () => {
      this.exportExtensionSettings();
    });
    document.getElementById("settingsImportExtensionSettings")?.addEventListener("click", () => {
      this.importExtensionSettings();
    });
    this.bindExtensionSettingEditors();
    this.settingsWidgetElem
      .querySelectorAll<HTMLButtonElement>(".settingsToggleRemoteVisibility")
      .forEach((button) => {
        button.addEventListener("click", () => {
          this.toggleRemoteVisibility(button.dataset.remote);
        });
      });
    this.settingsWidgetElem
      .querySelectorAll<HTMLButtonElement>(".settingsFetchRemote")
      .forEach((button) => {
        button.addEventListener("click", () => {
          this.showFetchRemoteDialog(button.dataset.remote, button);
        });
      });
    this.settingsWidgetElem
      .querySelectorAll<HTMLButtonElement>(".settingsPruneRemote")
      .forEach((button) => {
        button.addEventListener("click", () => {
          this.showPruneRemoteDialog(button.dataset.remote, button);
        });
      });
    this.settingsWidgetElem
      .querySelectorAll<HTMLButtonElement>(".settingsEditRemote")
      .forEach((button) => {
        button.addEventListener("click", () => {
          this.showEditRemoteDialog(button.dataset.remote, button);
        });
      });
    this.settingsWidgetElem
      .querySelectorAll<HTMLButtonElement>(".settingsDeleteRemote")
      .forEach((button) => {
        button.addEventListener("click", () => {
          this.showDeleteRemoteDialog(button.dataset.remote, button);
        });
      });
    this.settingsWidgetElem
      .querySelectorAll<HTMLSelectElement>(".settingsOverrideSelect")
      .forEach((select) => {
        select.addEventListener("change", () => {
          if (!isRepoBooleanSettingKey(select.dataset.setting)) return;
          this.setRepoBooleanSetting(
            select.dataset.setting,
            normalizeRepoBooleanOverride(select.value)
          );
        });
      });
  }

  private bindSettingsTabs() {
    const tabs = Array.from(
      this.settingsWidgetElem.querySelectorAll<HTMLButtonElement>(".settingsTab")
    );
    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        this.selectSettingsTab(
          this.normalizeSettingsWidgetTab(
            tab.dataset.settingsTab as GGL.SettingsWidgetTab | undefined
          )
        );
      });
      tab.addEventListener("keydown", (event: KeyboardEvent) => {
        this.handleSettingsTabKeydown(event, tabs, tab);
      });
    }
  }

  private handleSettingsTabKeydown(
    event: KeyboardEvent,
    tabs: HTMLButtonElement[],
    tab: HTMLButtonElement
  ) {
    const index = tabs.indexOf(tab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    this.selectSettingsTab(
      this.normalizeSettingsWidgetTab(
        nextTab.dataset.settingsTab as GGL.SettingsWidgetTab | undefined
      )
    );
    nextTab.focus();
  }

  private selectSettingsTab(tab: GGL.SettingsWidgetTab) {
    if (this.settingsWidgetTab === tab) return;
    this.settingsWidgetTab = tab;
    this.saveState();
    this.renderSettingsWidget();
  }

  private bindExtensionSettingEditors() {
    this.settingsWidgetElem
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(".settingsExtensionInput")
      .forEach((input) => {
        input.addEventListener("change", () => {
          this.updateExtensionSetting(input.dataset.settingKey, this.extensionInputValue(input));
        });
      });
    this.settingsWidgetElem
      .querySelectorAll<HTMLButtonElement>(".settingsEditJsonSetting")
      .forEach((button) => {
        button.addEventListener("click", () => {
          this.showJsonSettingDialog(button.dataset.settingKey, button);
        });
      });
    this.settingsWidgetElem
      .querySelectorAll<HTMLInputElement>(".settingsPaletteSlider")
      .forEach((slider) => {
        slider.addEventListener("input", () => {
          this.updateGraphColorPalette(slider);
        });
      });
  }

  private extensionInputValue(input: HTMLInputElement | HTMLSelectElement): GGL.JsonValue {
    const type = input.dataset.settingType;
    if (type === "boolean") return input instanceof HTMLInputElement && input.checked;
    if (type === "number") return Number(input.value);
    return input.value;
  }

  private updateExtensionSetting(key: string | undefined, value: GGL.JsonValue) {
    if (key === undefined) return;
    sendMessage({ command: "updateExtensionSetting", key, value, global: true });
    setStatusStrip("action", `${l10n.statusUpdatingExtensionSetting}...`);
  }

  private showJsonSettingDialog(key: string | undefined, sourceElem: HTMLElement) {
    const setting = this.findExtensionSetting(key);
    if (setting === null) return;

    showFormDialog(
      setting.title,
      [
        {
          type: "textarea",
          name: "",
          default: JSON.stringify(setting.value, null, 2),
          placeholder: null
        }
      ],
      l10n.settingsExtensionJsonEdit,
      (values) => {
        try {
          this.updateExtensionSetting(setting.key, JSON.parse(values[0]) as GGL.JsonValue);
        } catch (error) {
          showErrorDialog(
            l10n.settingsExtensionJsonInvalid,
            error instanceof Error ? error.message : String(error),
            sourceElem
          );
        }
      },
      sourceElem
    );
  }

  private updateGraphColorPalette(slider: HTMLInputElement) {
    const setting = this.findExtensionSetting(slider.dataset.settingKey);
    if (setting === null || !Array.isArray(setting.value)) return;

    const colors = setting.value.filter((value): value is string => typeof value === "string");
    const lightnessSlider = this.settingsWidgetElem.querySelector<HTMLInputElement>(
      '.settingsPaletteSlider[data-channel="lightness"]'
    );
    const chromaSlider = this.settingsWidgetElem.querySelector<HTMLInputElement>(
      '.settingsPaletteSlider[data-channel="chroma"]'
    );
    const lightness = Number(lightnessSlider?.value ?? 63);
    const chroma = Number(chromaSlider?.value ?? 0.2);
    this.updateExtensionSetting(
      setting.key,
      rewritePaletteLightnessChroma(colors, lightness, chroma)
    );
  }

  private findExtensionSetting(key: string | undefined) {
    if (key === undefined || this.extensionSettings === null) return null;
    return this.extensionSettings.find((setting) => setting.key === key) ?? null;
  }

  private exportExtensionSettings() {
    sendMessage({ command: "exportExtensionSettings" });
    showActionRunningDialog(l10n.statusExportingExtensionSettings);
  }

  private importExtensionSettings() {
    sendMessage({ command: "importExtensionSettings" });
    showActionRunningDialog(l10n.statusImportingExtensionSettings);
  }

  private handleExternalLinkClick(event: MouseEvent) {
    const link = closestHTMLElement(event.target, "a.externalLink");
    const url = link?.getAttribute("href");
    if (url === null || url === undefined || url === "") return;

    event.preventDefault();
    event.stopPropagation();
    sendMessage({ command: "openExternalUrl", url });
  }

  private showRepoNameDialog() {
    const repoState = this.getCurrentRepoState();
    if (repoState === null) return;

    showFormDialog(
      l10n.dialogRepoNameTitle,
      [
        {
          type: "text",
          name: l10n.dialogRepoNameName,
          default: repoState.displayName ?? "",
          placeholder: getRepoBasename(this.currentRepo)
        }
      ],
      l10n.dialogRepoNameSubmit,
      (values) => {
        repoState.displayName = values[0].trim() || null;
        this.saveCurrentRepoState(repoState);
        this.loadRepos(this.gitRepos, this.currentRepo);
      },
      this.settingsWidgetElem
    );
  }

  private clearRepoName() {
    const repoState = this.getCurrentRepoState();
    if (repoState === null) return;

    repoState.displayName = null;
    this.saveCurrentRepoState(repoState);
    this.loadRepos(this.gitRepos, this.currentRepo);
  }

  private showUserDetailsDialog() {
    const defaultName = this.gitConfig.userName.local ?? this.gitConfig.userName.global ?? "";
    const defaultEmail = this.gitConfig.userEmail.local ?? this.gitConfig.userEmail.global ?? "";
    const useGlobal =
      this.gitConfig.userName.local === null &&
      this.gitConfig.userEmail.local === null &&
      (this.gitConfig.userName.global !== null || this.gitConfig.userEmail.global !== null);

    showFormDialog(
      l10n.dialogUserDetailsTitle,
      [
        {
          type: "text",
          name: l10n.dialogUserDetailsName,
          default: defaultName,
          placeholder: null
        },
        {
          type: "text",
          name: l10n.dialogUserDetailsEmail,
          default: defaultEmail,
          placeholder: null
        },
        { type: "checkbox", name: l10n.dialogUserDetailsUseGlobal, value: useGlobal }
      ],
      l10n.dialogUserDetailsSubmit,
      (values) => {
        const name = values[0].trim();
        const email = values[1].trim();
        if (name === "" || email === "") {
          showErrorDialog(l10n.dialogUserDetailsEmpty, null, this.settingsWidgetElem);
          return;
        }

        const scope = values[2] === "checked" ? "global" : "local";
        sendMessage({
          command: "editUserDetails",
          repo: this.currentRepo,
          name,
          email,
          scope,
          clearLocalName: scope === "global" && this.gitConfig.userName.local !== null,
          clearLocalEmail: scope === "global" && this.gitConfig.userEmail.local !== null
        });
        showActionRunningDialog(l10n.statusUpdatingUserDetails);
      },
      this.settingsWidgetElem
    );
  }

  private showRemoveUserDetailsDialog() {
    const scopeOptions: { name: string; value: "local" | "global" }[] = [];
    const hasLocal =
      this.gitConfig.userName.local !== null || this.gitConfig.userEmail.local !== null;
    const hasGlobal =
      this.gitConfig.userName.global !== null || this.gitConfig.userEmail.global !== null;
    if (hasLocal) scopeOptions.push({ name: l10n.settingsLocal, value: "local" });
    if (hasGlobal) scopeOptions.push({ name: l10n.settingsGlobal, value: "global" });
    if (scopeOptions.length === 0) return;

    showFormDialog(
      l10n.dialogUserDetailsRemoveConfirm,
      [
        {
          type: "select",
          name: "",
          options: scopeOptions,
          default: scopeOptions[0].value
        }
      ],
      l10n.settingsRemoveUserDetails,
      (values) => {
        const scope = values[0] === "global" ? "global" : "local";
        sendMessage({
          command: "deleteUserDetails",
          repo: this.currentRepo,
          scope,
          unsetName:
            scope === "local"
              ? this.gitConfig.userName.local !== null
              : this.gitConfig.userName.global !== null,
          unsetEmail:
            scope === "local"
              ? this.gitConfig.userEmail.local !== null
              : this.gitConfig.userEmail.global !== null
        });
        showActionRunningDialog(l10n.statusRemovingUserDetails);
      },
      this.settingsWidgetElem
    );
  }

  private getRemoteByName(remoteName: string | undefined) {
    if (remoteName === undefined) return null;
    return this.gitRemotes.find((remote) => remote.name === remoteName) ?? null;
  }

  private firstRemoteUrl(urls: string[]) {
    return urls[0] ?? "";
  }

  private toggleRemoteVisibility(remoteName: string | undefined) {
    const remote = this.getRemoteByName(remoteName);
    const repoState = this.getCurrentRepoState();
    if (remote === null || repoState === null) return;

    const hiddenRemotes = new Set(this.getHiddenRemotes());
    if (hiddenRemotes.has(remote.name)) {
      hiddenRemotes.delete(remote.name);
    } else {
      hiddenRemotes.add(remote.name);
    }

    const nextHiddenRemotes = [...hiddenRemotes];
    if (nextHiddenRemotes.length === 0) {
      delete repoState.hiddenRemotes;
    } else {
      repoState.hiddenRemotes = nextHiddenRemotes;
    }

    this.maxCommits = this.config.initialLoadCommits;
    this.expandedCommit = null;
    this.saveCurrentRepoState(repoState);
    this.renderSettingsWidget();
    this.renderShowLoading();
    this.requestLoadBranchesAndCommits(true);
  }

  private showAddRemoteDialog() {
    showFormDialog(
      l10n.dialogAddRemoteTitle,
      [
        { type: "text-ref", name: l10n.dialogRemoteName, default: "" },
        {
          type: "text",
          name: l10n.dialogRemoteFetchUrl,
          default: "",
          placeholder: null
        },
        {
          type: "text",
          name: l10n.dialogRemotePushUrl,
          default: "",
          placeholder: l10n.dialogAddTagOptional
        },
        { type: "checkbox", name: l10n.dialogAddRemoteFetch, value: false }
      ],
      l10n.dialogAddRemoteSubmit,
      (values) => {
        const name = values[0].trim();
        const fetchUrl = values[1].trim();
        if (name === "" || fetchUrl === "") {
          showErrorDialog(l10n.dialogRemoteRequired, null, this.settingsWidgetElem);
          return;
        }
        sendMessage({
          command: "addRemote",
          repo: this.currentRepo,
          name,
          fetchUrl,
          pushUrl: values[2].trim() || null,
          fetch: values[3] === "checked"
        });
        showActionRunningDialog(l10n.statusAddingRemote);
      },
      this.settingsWidgetElem
    );
  }

  private showEditRemoteDialog(remoteName: string | undefined, sourceElem: HTMLElement) {
    const remote = this.getRemoteByName(remoteName);
    if (remote === null) return;

    showFormDialog(
      l10n.dialogEditRemoteTitle.replace("{0}", remote.name),
      [
        { type: "text-ref", name: l10n.dialogRemoteName, default: remote.name },
        {
          type: "text",
          name: l10n.dialogRemoteFetchUrl,
          default: this.firstRemoteUrl(remote.fetchUrls),
          placeholder: null
        },
        {
          type: "text",
          name: l10n.dialogRemotePushUrl,
          default: this.firstRemoteUrl(remote.pushUrls),
          placeholder: l10n.dialogAddTagOptional
        }
      ],
      l10n.dialogEditRemoteSubmit,
      (values) => {
        const name = values[0].trim();
        const fetchUrl = values[1].trim();
        if (name === "" || fetchUrl === "") {
          showErrorDialog(l10n.dialogRemoteRequired, null, sourceElem);
          return;
        }
        sendMessage({
          command: "editRemote",
          repo: this.currentRepo,
          oldName: remote.name,
          name,
          fetchUrl,
          pushUrl: values[2].trim() || null
        });
        showActionRunningDialog(l10n.statusEditingRemote);
      },
      sourceElem
    );
  }

  private showDeleteRemoteDialog(remoteName: string | undefined, sourceElem: HTMLElement) {
    const remote = this.getRemoteByName(remoteName);
    if (remote === null) return;

    showConfirmationDialog(
      l10n.dialogDeleteRemoteConfirm.replace("{0}", remote.name),
      () => {
        sendMessage({
          command: "deleteRemote",
          repo: this.currentRepo,
          name: remote.name
        });
        showActionRunningDialog(l10n.statusDeletingRemote);
      },
      sourceElem
    );
  }

  private showPruneRemoteDialog(remoteName: string | undefined, sourceElem: HTMLElement) {
    const remote = this.getRemoteByName(remoteName);
    if (remote === null) return;

    showConfirmationDialog(
      l10n.dialogPruneRemoteConfirm.replace("{0}", remote.name),
      () => {
        sendMessage({
          command: "pruneRemote",
          repo: this.currentRepo,
          name: remote.name
        });
        showActionRunningDialog(l10n.statusPruningRemote);
      },
      sourceElem
    );
  }

  private showFetchRemoteDialog(remoteName: string | undefined, sourceElem: HTMLElement) {
    const remote = this.getRemoteByName(remoteName);
    if (remote === null) return;

    showFormDialog(
      l10n.dialogFetchRemoteConfirm.replace("{0}", remote.name),
      [
        { type: "checkbox" as const, name: l10n.dialogFetchPrune, value: false },
        { type: "checkbox" as const, name: l10n.dialogFetchPruneTags, value: false }
      ],
      l10n.dialogFetchSubmit,
      (values) => {
        const prune = values[0] === "checked";
        const pruneTags = values[1] === "checked";
        if (pruneTags && !prune) {
          showErrorDialog(l10n.dialogFetchPruneTagsRequiresPrune, null, sourceElem);
          return;
        }
        sendMessage({
          command: "fetchRemotes",
          repo: this.currentRepo,
          remote: remote.name,
          prune,
          pruneTags
        });
        showActionRunningDialog(l10n.statusFetchingRemotes);
      },
      sourceElem
    );
  }

  private showFetchTagsDialog() {
    const remoteNames = this.getRemoteNames();
    if (remoteNames.length === 0) return;

    // Fetching is read-only, so every remote is offered preselected: unlike
    // branches, `refs/tags` has no per-remote tracking refs, so the webview
    // cannot know which remotes carry which tags.
    const remoteInputs: DialogInput[] = remoteNames.map((remote) => ({
      type: "checkbox" as const,
      name: l10n.dialogFetchTagsRemote.replace("{0}", remote),
      value: true
    }));
    const inputs: DialogInput[] = [
      ...remoteInputs,
      { type: "checkbox", name: l10n.dialogFetchPruneTags, value: false }
    ];

    showFormDialog(
      l10n.dialogFetchTagsConfirm,
      inputs,
      l10n.dialogFetchTagsSubmit,
      (values) => {
        const selectedRemotes = remoteNames.filter((_, index) => values[index] === "checked");
        if (selectedRemotes.length === 0) {
          showErrorDialog(l10n.dialogPushBranchNoRemoteSelected, null, null);
          return;
        }

        sendMessage({
          command: "fetchTags",
          repo: this.currentRepo,
          remotes: selectedRemotes,
          pruneTags: values[remoteNames.length] === "checked"
        });
        showActionRunningDialog(l10n.statusFetchingTags);
      },
      null
    );
  }

  private showIssueLinkingDialog() {
    const repoState = this.getCurrentRepoState();
    if (repoState === null) return;
    const current = repoState.issueLinking ?? null;

    showFormDialog(
      l10n.dialogIssueLinkingTitle,
      [
        {
          type: "text",
          name: l10n.dialogIssueLinkingPattern,
          default: current?.pattern ?? String.raw`#(\d+)`,
          placeholder: null
        },
        {
          type: "text",
          name: l10n.dialogIssueLinkingUrlTemplate,
          default: current?.urlTemplate ?? "https://example.test/issues/$1",
          placeholder: null
        }
      ],
      l10n.dialogIssueLinkingSubmit,
      (values) => {
        const pattern = values[0].trim();
        const urlTemplate = values[1].trim();
        const validationError = this.validateIssueLinking(pattern, urlTemplate);
        if (validationError !== null) {
          showErrorDialog(validationError, null, this.settingsWidgetElem);
          return;
        }
        repoState.issueLinking = { pattern, urlTemplate };
        this.saveCurrentRepoState(repoState);
        this.renderSettingsWidget();
        this.renderTable();
        this.renderGraph();
      },
      this.settingsWidgetElem
    );
  }

  private validateIssueLinking(pattern: string, urlTemplate: string) {
    if (pattern === "" || urlTemplate === "") return l10n.dialogIssueLinkingRequired;
    if (!/\$[1-9]\d*/.test(urlTemplate)) return l10n.dialogIssueLinkingMissingPlaceholder;
    try {
      const regexp = new RegExp(pattern);
      const sampleMatch = regexp.exec("#123");
      const sampleUrl = urlTemplate.replace(/\$[1-9]\d*/g, sampleMatch?.[1] ?? "123");
      this.assertHttpUrl(sampleUrl);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private removeIssueLinking() {
    const repoState = this.getCurrentRepoState();
    if (repoState === null) return;

    repoState.issueLinking = null;
    this.saveCurrentRepoState(repoState);
    this.renderSettingsWidget();
    this.renderTable();
    this.renderGraph();
  }

  private showPullRequestSettingsDialog() {
    const repoState = this.getCurrentRepoState();
    if (repoState === null) return;
    const remoteNames = this.getRemoteNames();
    if (remoteNames.length === 0) {
      showErrorDialog(l10n.dialogPullRequestNoRemotes, null, this.settingsWidgetElem);
      return;
    }

    const current = repoState.pullRequest;
    const defaultRemote = current?.remoteName ?? this.defaultPushRemoteName(remoteNames);
    const remoteDefault = remoteNames.includes(defaultRemote) ? defaultRemote : remoteNames[0];
    showFormDialog(
      l10n.dialogPullRequestTitle,
      [
        {
          type: "select",
          name: l10n.dialogPullRequestRemote,
          default: remoteDefault,
          options: remoteNames.map((remote) => ({ name: remote, value: remote }))
        },
        {
          type: "text",
          name: l10n.dialogPullRequestBaseBranch,
          default: current?.baseBranch ?? "main",
          placeholder: null
        },
        {
          type: "text",
          name: l10n.dialogPullRequestUrlTemplate,
          default:
            current?.urlTemplate ??
            "https://{host}/{owner}/{repo}/compare/{baseBranch}...{sourceBranch}?expand=1",
          placeholder: null
        },
        {
          type: "checkbox",
          name: l10n.dialogPullRequestPushBeforeCreate,
          value: current?.pushBeforeCreate ?? true
        }
      ],
      l10n.dialogPullRequestSubmit,
      (values) => {
        const remoteName = values[0];
        const baseBranch = values[1].trim();
        const urlTemplate = values[2].trim();
        const validationError = this.validatePullRequestSettings(
          remoteName,
          baseBranch,
          urlTemplate
        );
        if (validationError !== null) {
          showErrorDialog(validationError, null, this.settingsWidgetElem);
          return;
        }

        repoState.pullRequest = {
          remoteName,
          baseBranch,
          urlTemplate,
          pushBeforeCreate: values[3] === "checked"
        };
        this.saveCurrentRepoState(repoState);
        this.renderSettingsWidget();
        this.renderTable();
        this.renderGraph();
      },
      this.settingsWidgetElem
    );
  }

  private validatePullRequestSettings(remoteName: string, baseBranch: string, urlTemplate: string) {
    if (remoteName === "" || baseBranch === "" || urlTemplate === "") {
      return l10n.dialogPullRequestRequired;
    }
    try {
      this.assertHttpUrl(this.previewPullRequestUrl(urlTemplate, "feature/topic", baseBranch));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private previewPullRequestUrl(urlTemplate: string, branchName: string, baseBranch: string) {
    const replacements: Record<string, string> = {
      base: baseBranch,
      baseBranch,
      branch: branchName,
      host: "example.test",
      owner: "owner",
      remoteName: "origin",
      remoteUrl: "https://example.test/owner/repo.git",
      repo: "repo",
      repository: "repo",
      sourceBranch: branchName
    };
    return urlTemplate.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key: string) =>
      encodeURIComponent(replacements[key] ?? match)
    );
  }

  private assertHttpUrl(value: string) {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(l10n.dialogUrlMustBeHttp);
    }
  }

  private removePullRequestSettings() {
    const repoState = this.getCurrentRepoState();
    if (repoState === null) return;

    repoState.pullRequest = null;
    this.saveCurrentRepoState(repoState);
    this.renderSettingsWidget();
    this.renderTable();
    this.renderGraph();
  }

  private showExportRepoConfigDialog() {
    showConfirmationDialog(
      l10n.dialogExportRepoConfigConfirm,
      () => {
        sendMessage({ command: "exportRepoConfig", repo: this.currentRepo });
        showActionRunningDialog(l10n.statusExportingRepoConfig);
      },
      this.settingsWidgetElem
    );
  }

  private showImportRepoConfigDialog() {
    showConfirmationDialog(
      l10n.dialogImportRepoConfigConfirm,
      () => {
        sendMessage({ command: "importRepoConfig", repo: this.currentRepo });
        showActionRunningDialog(l10n.statusImportingRepoConfig);
      },
      this.settingsWidgetElem
    );
  }

  public replaceRepoState(repo: string, state: GGL.GitRepoState) {
    this.gitRepos[repo] = state;
    this.syncRepoSettingsControls();
    this.saveState();
    this.renderSettingsWidget();
  }

  /* Renderers */
  private render(preferredFindHash: string | null = null) {
    document.body.classList.remove("unableToLoad");
    setStatusStrip("ready", l10n.statusReady);
    this.recomputeFindMatches(preferredFindHash);
    this.updateFindUi();
    this.updateNoCommitsControls();
    this.renderTable();
    this.renderGraph();
  }
  private renderGraph() {
    // The stash section (when present) sits in normal flow above the table
    // and pushes its rows down while the overlay canvas stays pinned at the
    // content top. Re-pin the canvas to the table's top edge on every render
    // so dots stay on their rows across show/hide and count changes.
    this.graphContainerElem.style.top = `${this.tableElem.offsetTop}px`;
    const colHeadersElem = document.getElementById("tableColHeaders");
    if (colHeadersElem === null) return;
    const headerHeight = colHeadersElem.clientHeight + 1;
    const detailsElem = document.getElementById("commitDetails");
    const expandAt = this.expandedRowId(detailsElem);
    const tableHeight = this.tableElem.children[0]?.clientHeight ?? 0;
    this.config.grid.expandY =
      detailsElem !== null
        ? detailsElem.getBoundingClientRect().height || this.getCommitDetailsRenderedHeight()
        : this.config.grid.expandY;
    const expandedHeight = expandAt === null ? 0 : this.config.grid.expandY;
    const renderedRowHeight =
      this.commits.length > 0
        ? (tableHeight - headerHeight - expandedHeight) / this.commits.length
        : this.config.graphRowHeight;
    this.config.grid.y = renderedRowHeight > 0 ? renderedRowHeight : this.config.graphRowHeight;
    this.config.grid.offsetY = headerHeight + this.config.grid.y / 2;
    this.graph.render(expandAt);
  }
  /**
   * Row index the graph must open its gap after: the row `#commitDetails` is
   * attached to, which is always the row directly above it.
   *
   * Read from the DOM rather than from `expandedCommit`, because the
   * uncommitted staging panel is the same `#commitDetails` row hung off the
   * uncommitted row and has no `ExpandedCommit` of its own. Keying off
   * `expandedCommit` alone meant the panel's height stayed in the measured
   * table height while no gap was inserted, so every row height was inflated
   * by a share of it and the dots drifted off their rows.
   */
  private expandedRowId(detailsElem: HTMLElement | null): number | null {
    const sourceRow = detailsElem?.previousElementSibling;
    const id = sourceRow instanceof HTMLElement ? sourceRow.dataset.id : undefined;
    if (id === undefined) return null;
    const parsed = Number.parseInt(id, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  private displayHash(hash: string) {
    return abbrevCommit(hash, this.config.shortHashLength);
  }
  private trimTrailingLineFeeds(message: string) {
    let end = message.length;
    while (end > 0 && message.codePointAt(end - 1) === 10) end -= 1;
    return message.slice(0, end);
  }
  private normalizeCommitMessage(message: string) {
    // Commit messages are user-controlled, so keep normalization regex-free and
    // avoid regex backtracking hotspots over unbounded text.
    return this.trimTrailingLineFeeds(message.replaceAll("\r\n", "\n"));
  }
  private isNoCommitsRepository() {
    // A repository genuinely has no commits only when nothing is loaded, HEAD
    // resolved to no commit, and no branch refs exist. Filters can empty the
    // commit list but never the HEAD hash or the branch list, so a
    // filtered-to-nothing view keeps the generic emptyGraph row; the one other
    // null-HEAD case (an unborn orphan branch in a repo with other branches)
    // is excluded by the branch list being non-empty.
    return this.commits.length === 0 && this.commitHead === null && this.gitBranches.length === 0;
  }
  private renderNoCommitsRow() {
    return (
      `<tr class="noCommitsRow"><td colspan="6"><div class="noCommitsView">${svgIcons.noCommits}` +
      `<div class="noCommitsHeading">${l10n.noCommits}</div>` +
      `<div class="noCommitsHint">${l10n.createFirstCommit}</div>` +
      `</div></td></tr>`
    );
  }
  private renderTable() {
    let html = this.renderTableHeader();
    const currentHash = this.getCurrentDisplayHash();
    const findMatchIndexes = new Set(this.findMatches);
    const activeFindCommitIndex = this.findMatches[this.activeFindMatchIndex] ?? -1;
    const mutedHeadNonAncestors = this.mutedCommitHashesNotInHeadAncestry();
    for (let i = 0; i < this.commits.length; i++) {
      html += this.renderCommitRow(
        i,
        currentHash,
        findMatchIndexes,
        activeFindCommitIndex,
        mutedHeadNonAncestors
      );
    }
    if (this.commits.length === 0) {
      // The uncommitted-changes row is part of the commit list, so whenever it
      // exists the loop above renders it and this empty-table branch is
      // skipped; the dedicated view never replaces a rendered row.
      html += this.isNoCommitsRepository()
        ? this.renderNoCommitsRow()
        : `<tr class="emptyGraphRow"><td colspan="6">${l10n.emptyGraph}</td></tr>`;
    }
    this.tableElem.innerHTML = `<table>${html}</table>`;
    this.renderStashSection();
    this.renderLoadMoreFooter();
    this.makeTableResizable();
    this.restoreExpandedCommit();
    this.restoreUncommittedDetails();

    this.registerCommitContextMenuListener();
    this.registerUncommittedChangesContextMenuListener();
    this.registerStashGraphRowListeners();
    this.registerCommitActivationListeners();
    this.registerUncommittedActivationListeners();
    this.registerGitRefContextMenuListener();
    this.registerGitRefActivationListeners();
    this.registerColumnHeaderMenuListener();
  }
  private registerCommitContextMenuListener() {
    addListenerToClass("commit", "contextmenu", (e: Event) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".commit");
      const hash = sourceElem?.dataset.hash;
      if (sourceElem === null || hash === undefined) return;
      this.prepareCommitContextSelection(hash, sourceElem);
      showContextMenu(e as MouseEvent, this.buildCommitContextMenu(hash, sourceElem), sourceElem);
    });
  }
  private registerUncommittedChangesContextMenuListener() {
    addListenerToClass("unsavedChanges", "contextmenu", (e: Event) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".unsavedChanges");
      if (sourceElem === null) return;
      showContextMenu(
        e as MouseEvent,
        this.buildUncommittedChangesContextMenu(sourceElem),
        sourceElem
      );
    });
  }
  private isContextMenuActionVisible(
    group: keyof GGL.ContextMenuActionsVisibility,
    action: string
  ) {
    return (
      (this.config.contextMenuActionsVisibility[group] as Record<string, boolean>)[action] !== false
    );
  }
  private visibleContextMenuItem(
    group: keyof GGL.ContextMenuActionsVisibility,
    action: string,
    item: ContextMenuItem
  ): ContextMenuElement {
    return this.isContextMenuActionVisible(group, action) ? item : null;
  }
  private buildUncommittedChangesContextMenu(sourceElem: HTMLElement): ContextMenuElement[] {
    return [
      {
        // View option rather than a git action, so it sits with the other
        // checked view toggles and is not gated on action visibility.
        title: l10n.detailViewAsTree,
        checked: this.config.uncommittedFileViewMode === "tree",
        onClick: () => this.toggleUncommittedFileViewMode()
      },
      null,
      this.visibleContextMenuItem("uncommittedChanges", "stash", {
        title: l10n.stashUncommittedChanges + ELLIPSIS,
        onClick: () => this.showStashUncommittedChangesDialog(sourceElem)
      }),
      null,
      this.visibleContextMenuItem("uncommittedChanges", "reset", {
        title: l10n.resetUncommittedChanges + ELLIPSIS,
        onClick: () => this.showResetUncommittedChangesDialog(sourceElem)
      }),
      this.visibleContextMenuItem("uncommittedChanges", "clean", {
        title: l10n.cleanUntrackedFiles + ELLIPSIS,
        onClick: () => this.showCleanUntrackedFilesDialog(sourceElem)
      }),
      null,
      this.visibleContextMenuItem("uncommittedChanges", "openSourceControlView", {
        title: l10n.openSourceControl,
        onClick: () => {
          sendMessage({ command: "openSourceControl" });
        }
      })
    ];
  }
  private showStashUncommittedChangesDialog(sourceElem: HTMLElement) {
    showFormDialog(
      l10n.dialogStashChangesConfirm,
      [
        {
          type: "text",
          name: l10n.dialogStashChangesMessage,
          default: "",
          placeholder: l10n.dialogAddTagOptional
        },
        { type: "checkbox", name: l10n.dialogStashChangesIncludeUntracked, value: true }
      ],
      l10n.dialogStashChangesSubmit,
      (values) => {
        sendMessage({
          command: "pushStash",
          repo: this.currentRepo,
          message: values[0],
          includeUntracked: values[1] === "checked"
        });
        showActionRunningDialog(l10n.statusStashingChanges);
      },
      sourceElem
    );
  }
  private showResetUncommittedChangesDialog(sourceElem: HTMLElement) {
    showSelectDialog(
      l10n.dialogResetUncommittedConfirm,
      "mixed",
      [
        { name: l10n.dialogResetMixed, value: "mixed" },
        { name: l10n.dialogResetHard, value: "hard" }
      ],
      l10n.dialogResetUncommittedSubmit,
      (mode) => {
        sendMessage({
          command: "resetUncommittedChanges",
          repo: this.currentRepo,
          resetMode: mode as Exclude<GitResetMode, "soft">
        });
        showActionRunningDialog(l10n.statusResettingChanges);
      },
      sourceElem
    );
  }
  private showCleanUntrackedFilesDialog(sourceElem: HTMLElement) {
    showCheckboxDialog(
      l10n.dialogCleanUntrackedConfirm,
      l10n.dialogCleanUntrackedDirectories,
      false,
      l10n.dialogCleanUntrackedSubmit,
      (includeDirectories) => {
        sendMessage({
          command: "cleanUntrackedFiles",
          repo: this.currentRepo,
          includeDirectories
        });
        showActionRunningDialog(l10n.statusCleaningUntracked);
      },
      sourceElem
    );
  }
  /**
   * The language switcher behind a double right-click on the version.
   *
   * English regardless of the active language, by design: its whole purpose is
   * to be usable when the interface is in a language the reader cannot
   * navigate — translating it would put the escape hatch behind the same door
   * it exists to open.
   */
  private buildHiddenMenu(): ContextMenuElement[] {
    const languages: ContextMenuElement[] = viewState.languages.map((language) => ({
      title: language.label,
      checked: language.id === viewState.language,
      onClick: () => {
        sendMessage({ command: "setTemporaryLanguage", language: language.id });
      }
    }));
    return [
      ...languages,
      null,
      {
        // One full reload — repository info, branches, commits — served by
        // the Git CLI whatever the backend setting says, for when the engine's
        // answer is in doubt. The setting itself is left alone.
        title: HIDDEN_MENU_RELOAD_WITH_CLI,
        onClick: () => {
          this.forceCliOnce = true;
          this.refresh(true);
        }
      },
      {
        // Opens the extension's output channel — Git commands, engine calls
        // and routing per request — exactly as the startup screen's button.
        title: HIDDEN_MENU_SHOW_DIAGNOSTICS,
        onClick: () => sendMessage({ command: "showOutput" })
      },
      {
        title: HIDDEN_MENU_OPEN_LOG_FILE,
        onClick: () => sendMessage({ command: "openLogFile" })
      },
      {
        title: HIDDEN_MENU_COPY_RECENT_LOG,
        onClick: () => sendMessage({ command: "copyRecentLog" })
      }
    ];
  }
  private buildCommitContextMenu(hash: string, sourceElem: HTMLElement): ContextMenuElement[] {
    if (this.shouldShowSelectedCommitContextMenu(hash)) {
      return this.buildSelectedCommitContextMenu(hash, sourceElem);
    }

    const commitIndex = this.commitLookup[hash];
    const commit = typeof commitIndex === "number" ? this.commits[commitIndex] : null;
    const isHeadCommit = hash === this.commitHead;
    // Drop runs `git rebase --onto <hash>^ <hash>`, so the commit must have a
    // parent: `<root>^` is not a valid revision. Root commits are therefore
    // excluded from Drop, and merges are excluded because rebase replays both
    // merged sides linearized.
    const canDropCommit = commit !== null && commit.parentHashes.length === 1;
    const menu = this.buildCommitCreateMenuItems(hash, sourceElem);
    const compareWithHeadItem = this.buildCompareWithHeadMenuItem(hash, sourceElem);
    if (compareWithHeadItem !== null) menu.push(compareWithHeadItem);
    const compareWithItem = this.buildCompareWithMenuItem(hash, sourceElem);
    if (compareWithItem !== null) menu.push(compareWithItem);
    const compareWithWorkingTreeItem = this.buildCompareWithWorkingTreeMenuItem(hash, sourceElem);
    if (compareWithWorkingTreeItem !== null) menu.push(compareWithWorkingTreeItem);
    menu.push(...this.buildCommitChangeMenuItems(hash, sourceElem));
    this.appendHeadCommitMenuItems(menu, hash, sourceElem, { isHeadCommit, canDropCommit });
    menu.push(...this.buildCommitIntegrationMenuItems(hash, sourceElem));
    this.appendCommitSubjectMenuItem(menu, commit);
    return menu;
  }
  private buildCommitCreateMenuItems(hash: string, sourceElem: HTMLElement): ContextMenuElement[] {
    return [
      this.visibleContextMenuItem("commit", "addTag", {
        title: l10n.addTag + ELLIPSIS,
        onClick: () => this.showAddTagDialog(hash, sourceElem)
      }),
      this.visibleContextMenuItem("commit", "createBranch", {
        title: l10n.createBranch + ELLIPSIS,
        onClick: () => this.showCreateBranchDialog(hash, sourceElem)
      }),
      this.visibleContextMenuItem("commit", "createWorktree", {
        title: l10n.createWorktree + ELLIPSIS,
        onClick: () =>
          this.showCreateWorktreeDialog(
            {
              label: this.displayHash(hash),
              startPoint: hash,
              folderName: this.displayHash(hash),
              branch: null,
              newBranchName: "",
              mode: "detach"
            },
            sourceElem
          )
      })
    ];
  }
  private buildCommitChangeMenuItems(hash: string, sourceElem: HTMLElement): ContextMenuElement[] {
    return [
      null,
      this.visibleContextMenuItem("commit", "checkout", {
        title: l10n.checkout + ELLIPSIS,
        onClick: () => this.showCheckoutCommitDialog(hash, sourceElem)
      }),
      this.visibleContextMenuItem("commit", "cherryPick", {
        title: l10n.cherryPick + ELLIPSIS,
        onClick: () =>
          this.showNoCommitParentDialog(
            hash,
            sourceElem,
            "cherrypickCommit",
            l10n.dialogCherryPickConfirm,
            l10n.dialogYesCherryPick,
            l10n.dialogCherryPickNoCommit
          )
      }),
      this.visibleContextMenuItem("commit", "revert", {
        title: l10n.revert + ELLIPSIS,
        onClick: () =>
          this.showNoCommitParentDialog(
            hash,
            sourceElem,
            "revertCommit",
            l10n.dialogRevertConfirm,
            l10n.dialogYesRevert,
            l10n.dialogRevertNoCommit
          )
      })
    ];
  }
  private appendHeadCommitMenuItems(
    menu: ContextMenuElement[],
    hash: string,
    sourceElem: HTMLElement,
    state: { isHeadCommit: boolean; canDropCommit: boolean }
  ) {
    const items: ContextMenuItem[] = [];
    if (state.isHeadCommit && this.isContextMenuActionVisible("commit", "undoLastCommit")) {
      items.push({
        title: l10n.undoLastCommit + ELLIPSIS,
        onClick: () => this.showUndoLastCommitDialog(sourceElem)
      });
    }
    if (state.isHeadCommit && this.isContextMenuActionVisible("commit", "editMessage")) {
      items.push({
        title: l10n.editMessage + ELLIPSIS,
        onClick: () => this.showEditHeadCommitMessageDialog(hash, sourceElem)
      });
    }
    if (state.canDropCommit && this.isContextMenuActionVisible("commit", "drop")) {
      items.push({
        title: l10n.dropCommit + ELLIPSIS,
        onClick: () => this.showDropCommitDialog(hash, sourceElem)
      });
    }
    if (items.length > 0) menu.push(null, ...items);
  }
  private buildCommitIntegrationMenuItems(
    hash: string,
    sourceElem: HTMLElement
  ): ContextMenuElement[] {
    return [
      null,
      this.visibleContextMenuItem("commit", "merge", {
        title: l10n.merge + ELLIPSIS,
        onClick: () => this.showMergeCommitDialog(hash, sourceElem)
      }),
      this.visibleContextMenuItem("commit", "rebase", {
        title: l10n.rebase + ELLIPSIS,
        onClick: () => this.showRebaseDialog(hash, this.displayHash(hash), "commit", sourceElem)
      }),
      this.visibleContextMenuItem("commit", "reset", {
        title: l10n.reset + ELLIPSIS,
        onClick: () => this.showResetCommitDialog(hash, sourceElem)
      }),
      null,
      this.visibleContextMenuItem("commit", "copyHash", {
        title: l10n.copyCommitHash,
        onClick: () => {
          sendMessage({ command: "copyToClipboard", type: "Commit Hash", data: hash });
        }
      })
    ];
  }
  private appendCommitSubjectMenuItem(menu: ContextMenuElement[], commit: GitCommitNode | null) {
    if (commit === null || !this.isContextMenuActionVisible("commit", "copySubject")) return;
    menu.push({
      title: l10n.copyCommitSubject,
      onClick: () => {
        sendMessage({ command: "copyToClipboard", type: "Commit Subject", data: commit.message });
      }
    });
  }
  private buildSelectedCommitContextMenu(
    hash: string,
    sourceElem: HTMLElement
  ): ContextMenuElement[] {
    const menu: ContextMenuElement[] = [];
    // getSelectedCommits orders by graph row, newest first, regardless of
    // which row was selected first or which branch the commits belong to.
    const selectedCommits = this.getSelectedCommits();
    if (selectedCommits.length === 2 && !selectedCommits.includes("*")) {
      const [compareRef, baseRef] = selectedCommits;
      menu.push(
        this.visibleContextMenuItem("commit", "compareSelection", {
          title: l10n.compareSelection,
          onClick: () => this.loadCommitComparison(sourceElem, hash, baseRef, compareRef)
        })
      );
    }
    if (selectedCommits.length < 2 || !this.selectedCommitsAreLoadedHeadChain(selectedCommits)) {
      return menu;
    }

    const oldestHash = selectedCommits.at(-1);
    const oldestCommit =
      oldestHash === undefined ? undefined : this.commits[this.commitLookup[oldestHash]];
    if (
      oldestCommit !== undefined &&
      oldestCommit.parentHashes.length > 0 &&
      this.isContextMenuActionVisible("commit", "squashSelection")
    ) {
      menu.push({
        title: l10n.squashSelection + ELLIPSIS,
        onClick: () => this.showSquashSelectedCommitsDialog(selectedCommits, sourceElem)
      });
    }
    if (this.isContextMenuActionVisible("commit", "dropSelection")) {
      menu.push({
        title: l10n.dropSelection + ELLIPSIS,
        onClick: () => this.showDropSelectedCommitsDialog(selectedCommits, sourceElem)
      });
    }
    return menu;
  }
  private shouldShowSelectedCommitContextMenu(hash: string) {
    return this.selectedCommitHashes.size > 1 && this.selectedCommitHashes.has(hash);
  }
  private prepareCommitContextSelection(hash: string, sourceElem: HTMLElement) {
    if (this.shouldShowSelectedCommitContextMenu(hash)) return;
    this.clearCommitSelection();
    this.setCommitSelected(hash, true, sourceElem);
    this.commitSelectionAnchorHash = hash;
  }
  private getSelectedCommits() {
    return [...this.selectedCommitHashes].sort(
      (a, b) =>
        (this.commitLookup[a] ?? Number.MAX_SAFE_INTEGER) -
        (this.commitLookup[b] ?? Number.MAX_SAFE_INTEGER)
    );
  }
  private selectedCommitsAreLoadedHeadChain(selectedCommits: readonly string[]) {
    if (selectedCommits.length < 2 || selectedCommits[0] !== this.commitHead) return false;
    for (let i = 0; i < selectedCommits.length - 1; i++) {
      const currentCommit = this.commits[this.commitLookup[selectedCommits[i]]];
      if (currentCommit?.parentHashes[0] !== selectedCommits[i + 1]) {
        return false;
      }
    }
    return true;
  }
  private setCommitSelected(hash: string, selected: boolean, row?: HTMLElement | null) {
    const rowElem = row ?? this.findCommitRow(hash);
    if (selected) {
      this.selectedCommitHashes.add(hash);
      rowElem?.classList.add("commitSelected");
      rowElem?.setAttribute("aria-selected", "true");
    } else {
      this.selectedCommitHashes.delete(hash);
      rowElem?.classList.remove("commitSelected");
      rowElem?.setAttribute("aria-selected", "false");
    }
  }
  private clearCommitSelection() {
    for (const hash of this.selectedCommitHashes) {
      this.setCommitSelected(hash, false);
    }
    this.selectedCommitHashes.clear();
  }
  private keepVisibleCommitSelection() {
    for (const hash of this.selectedCommitHashes) {
      if (typeof this.commitLookup[hash] !== "number") this.selectedCommitHashes.delete(hash);
    }
    if (
      this.commitSelectionAnchorHash !== null &&
      typeof this.commitLookup[this.commitSelectionAnchorHash] !== "number"
    ) {
      this.commitSelectionAnchorHash = null;
    }
  }
  private toggleCommitSelection(hash: string, sourceElem: HTMLElement) {
    this.setCommitSelected(hash, !this.selectedCommitHashes.has(hash), sourceElem);
    this.commitSelectionAnchorHash = hash;
  }
  private selectCommitRange(anchorHash: string, targetHash: string) {
    const anchorIndex = this.commitLookup[anchorHash];
    const targetIndex = this.commitLookup[targetHash];
    if (typeof anchorIndex !== "number" || typeof targetIndex !== "number") return;

    this.clearCommitSelection();
    const first = Math.min(anchorIndex, targetIndex);
    const last = Math.max(anchorIndex, targetIndex);
    for (let index = first; index <= last; index++) {
      const commit = this.commits[index];
      // Stash rows between the endpoints stay out of the selection: they have
      // their own menu and no compare semantics.
      if (commit.hash !== "*" && commit.stash === undefined) {
        this.setCommitSelected(commit.hash, true);
      }
    }
  }
  private selectedCommitListHtml(selectedCommits: readonly string[]) {
    return selectedCommits
      .map((hash) => {
        const commit = this.commits[this.commitLookup[hash]];
        const message = commit === undefined ? "" : ` - ${escapeHtml(commit.message)}`;
        return `<b>${this.displayHash(hash)}</b>${message}`;
      })
      .join("<br>");
  }
  private showAddTagDialog(hash: string, sourceElem: HTMLElement) {
    showFormDialog(
      l10n.dialogAddTagTitle.replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`),
      [
        { type: "text-ref" as const, name: l10n.dialogAddTagName, default: "" },
        {
          type: "select" as const,
          name: l10n.dialogAddTagType,
          default: "annotated",
          options: [
            { name: l10n.dialogAddTagTypeAnnotated, value: "annotated" },
            { name: l10n.dialogAddTagTypeLightweight, value: "lightweight" }
          ]
        },
        {
          type: "text" as const,
          name: `${l10n.dialogAddTagMessage} (${l10n.dialogAddTagOptional})`,
          default: "",
          placeholder: null,
          dependsOn: { input: 1, value: "annotated" }
        },
        {
          type: "note" as const,
          text: l10n.dialogAddTagLightweightNote,
          dependsOn: { input: 1, value: "lightweight" }
        }
      ],
      l10n.dialogAddTagSubmit,
      (values) => {
        const lightweight = values[1] === "lightweight";
        const tag = {
          command: "addTag",
          repo: this.currentRepo,
          tagName: values[0],
          commitHash: hash
        } as const;
        if (lightweight) sendMessage({ ...tag, lightweight: true });
        else sendMessage({ ...tag, lightweight: false, message: values[2] });
      },
      sourceElem
    );
  }
  private showCreateBranchDialog(hash: string, sourceElem: HTMLElement) {
    showFormDialog(
      l10n.dialogCreateBranchTitle.replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`),
      [
        { type: "text-ref", name: "", default: "" },
        {
          type: "checkbox",
          name: l10n.dialogCreateBranchCheckout,
          value: this.config.createBranchCheckout
        }
      ],
      l10n.dialogCreateBranchSubmit,
      (values) => {
        sendMessage({
          command: "createBranch",
          repo: this.currentRepo,
          branchName: values[0],
          commitHash: hash,
          checkout: values[1] === "checked"
        });
      },
      sourceElem
    );
  }
  private showCheckoutCommitDialog(hash: string, sourceElem: HTMLElement) {
    showConfirmationDialog(
      l10n.dialogCheckoutConfirm.replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`),
      () => {
        sendMessage({
          command: "checkoutCommit",
          repo: this.currentRepo,
          commitHash: hash
        });
      },
      sourceElem
    );
  }
  private showNoCommitParentDialog(
    hash: string,
    sourceElem: HTMLElement,
    command: "cherrypickCommit" | "revertCommit",
    titleTemplate: string,
    actionName: string,
    noCommitLabel: string
  ) {
    const title = titleTemplate.replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`);
    const parentHashes = this.commits[this.commitLookup[hash]].parentHashes;
    const noCommit = { type: "checkbox" as const, name: noCommitLabel, value: false };
    // Root commits (zero parents) take the same path as single-parent commits:
    // parentIndex 0 sends no `-m` mainline flag. Only merges need the parent list.
    if (parentHashes.length < 2) {
      showFormDialog(
        title,
        [noCommit],
        actionName,
        (values) => this.sendNoCommitParentAction(command, hash, 0, values[0] === "checked"),
        sourceElem
      );
      return;
    }

    showFormDialog(
      title,
      [
        {
          type: "select",
          name: "",
          options: this.buildParentCommitOptions(parentHashes),
          default: "1"
        },
        noCommit
      ],
      actionName,
      (values) =>
        this.sendNoCommitParentAction(
          command,
          hash,
          Number.parseInt(values[0], 10),
          values[1] === "checked"
        ),
      sourceElem
    );
  }
  private sendNoCommitParentAction(
    command: "cherrypickCommit" | "revertCommit",
    hash: string,
    parentIndex: number,
    noCommit: boolean
  ) {
    sendMessage({
      command,
      repo: this.currentRepo,
      commitHash: hash,
      parentIndex,
      noCommit
    });
  }
  private buildParentCommitOptions(parentHashes: string[]) {
    return parentHashes.map((parentHash, index) => ({
      name:
        this.displayHash(parentHash) +
        (typeof this.commitLookup[parentHash] === "number"
          ? `: ${this.commits[this.commitLookup[parentHash]].message}`
          : ""),
      value: (index + 1).toString()
    }));
  }
  private showMergeCommitDialog(hash: string, sourceElem: HTMLElement) {
    showFormDialog(
      l10n.dialogMergeConfirm
        .replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`)
        .replace("{1}", `<b>${l10n.labelCurrentBranch}</b>`),
      [
        {
          type: "checkbox",
          name: l10n.dialogMergeNoFastForward,
          value: this.config.mergeNoFastForward
        },
        { type: "checkbox", name: l10n.dialogMergeSquash, value: false },
        { type: "checkbox", name: l10n.dialogMergeNoCommit, value: false },
        { type: "checkbox", name: l10n.dialogBypassGitHooks, value: false }
      ],
      l10n.dialogYesMerge,
      (values) => {
        sendMessage({
          command: "mergeCommit",
          repo: this.currentRepo,
          commitHash: hash,
          createNewCommit: values[0] === "checked",
          squash: values[1] === "checked",
          noCommit: values[2] === "checked",
          noVerify: values[3] === "checked"
        });
        showActionRunningDialog(l10n.statusMergingCommit);
      },
      sourceElem
    );
  }
  private showRebaseDialog(
    target: string,
    targetLabel: string,
    targetType: "branch" | "commit",
    sourceElem: HTMLElement
  ) {
    showFormDialog(
      l10n.dialogRebaseConfirm
        .replace("{0}", `<b>${l10n.labelCurrentBranch}</b>`)
        .replace("{1}", `<b><i>${escapeHtml(targetLabel)}</i></b>`),
      [
        { type: "checkbox", name: l10n.dialogRebaseInteractive, value: false },
        { type: "checkbox", name: l10n.dialogRebaseIgnoreDate, value: true }
      ],
      l10n.dialogRebaseSubmit,
      (values) => {
        const interactive = values[0] === "checked";
        sendMessage({
          command: "rebaseCurrentBranch",
          repo: this.currentRepo,
          target,
          targetType,
          interactive,
          ignoreDate: values[1] === "checked"
        });
        showActionRunningDialog(
          interactive ? l10n.statusLaunchingInteractiveRebase : l10n.statusRebasing
        );
      },
      sourceElem
    );
  }
  private showDropCommitDialog(hash: string, sourceElem: HTMLElement) {
    showConfirmationDialog(
      l10n.dialogDropCommitConfirm.replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`),
      () => {
        sendMessage({
          command: "dropCommit",
          repo: this.currentRepo,
          commitHash: hash
        });
        showActionRunningDialog(l10n.statusDroppingCommit);
      },
      sourceElem
    );
  }
  private showSquashSelectedCommitsDialog(
    selectedCommits: readonly string[],
    sourceElem: HTMLElement
  ) {
    const newestCommit = this.commits[this.commitLookup[selectedCommits[0]]];
    showFormDialog(
      l10n.dialogSquashSelectionConfirm
        .replace("{0}", String(selectedCommits.length))
        .replace("{1}", this.selectedCommitListHtml(selectedCommits)),
      [
        {
          type: "textarea",
          name: l10n.dialogSquashSelectionMessage,
          default: newestCommit?.message ?? "",
          placeholder: null
        },
        { type: "checkbox", name: l10n.dialogBypassGitHooks, value: false }
      ],
      l10n.dialogSquashSelectionSubmit,
      (values) => {
        const message = this.normalizeCommitMessage(values[0]);
        if (message.trim() === "") {
          showErrorDialog(l10n.dialogSquashSelectionEmpty, null, sourceElem);
          return;
        }
        sendMessage({
          command: "squashCommitSelection",
          repo: this.currentRepo,
          commitHashes: [...selectedCommits],
          message,
          noVerify: values[1] === "checked"
        });
        this.clearCommitSelection();
        showActionRunningDialog(l10n.statusSquashingSelection);
      },
      sourceElem
    );
  }
  private showDropSelectedCommitsDialog(
    selectedCommits: readonly string[],
    sourceElem: HTMLElement
  ) {
    showConfirmationDialog(
      l10n.dialogDropSelectionConfirm
        .replace("{0}", String(selectedCommits.length))
        .replace("{1}", this.selectedCommitListHtml(selectedCommits)),
      () => {
        sendMessage({
          command: "dropCommitSelection",
          repo: this.currentRepo,
          commitHashes: [...selectedCommits]
        });
        this.clearCommitSelection();
        showActionRunningDialog(l10n.statusDroppingSelection);
      },
      sourceElem
    );
  }
  private showUndoLastCommitDialog(sourceElem: HTMLElement) {
    showConfirmationDialog(
      l10n.dialogUndoLastCommitConfirm,
      () => {
        sendMessage({
          command: "undoLastCommit",
          repo: this.currentRepo
        });
        showActionRunningDialog(l10n.statusUndoingLastCommit);
      },
      sourceElem
    );
  }
  private showEditHeadCommitMessageDialog(hash: string, sourceElem: HTMLElement) {
    const commit = this.commits[this.commitLookup[hash]];
    showFormDialog(
      l10n.dialogEditMessageTitle.replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`),
      [
        {
          type: "textarea",
          name: l10n.dialogEditMessageMessage,
          default: commit?.message ?? "",
          placeholder: null
        }
      ],
      l10n.dialogEditMessageSubmit,
      (values) => {
        const message = this.normalizeCommitMessage(values[0]);
        if (message.trim() === "") {
          showErrorDialog(l10n.dialogEditMessageEmpty, null, sourceElem);
          return;
        }
        if (commit !== undefined && message === this.normalizeCommitMessage(commit.message)) return;

        sendMessage({
          command: "editHeadCommitMessage",
          repo: this.currentRepo,
          commitHash: hash,
          message
        });
        showActionRunningDialog(l10n.statusEditingMessage);
      },
      sourceElem
    );
  }
  private showResetCommitDialog(hash: string, sourceElem: HTMLElement) {
    showSelectDialog(
      l10n.dialogResetConfirm
        .replace("{0}", `<b>${l10n.labelCurrentBranch}</b>`)
        .replace("{1}", `<b><i>${this.displayHash(hash)}</i></b>`),
      "mixed",
      [
        { name: l10n.dialogResetSoft, value: "soft" },
        { name: l10n.dialogResetMixed, value: "mixed" },
        { name: l10n.dialogResetHard, value: "hard" }
      ],
      l10n.dialogYesReset,
      (mode) => {
        sendMessage({
          command: "resetToCommit",
          repo: this.currentRepo,
          commitHash: hash,
          resetMode: mode as GitResetMode
        });
      },
      sourceElem
    );
  }
  private registerCommitActivationListeners() {
    addListenerToClass("commit", "click", (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const sourceElem = closestHTMLElement(e.target, ".commit");
      const hash = sourceElem?.dataset.hash;
      if (sourceElem === null || hash === undefined) return;
      if (mouseEvent.shiftKey && this.commitSelectionAnchorHash !== null) {
        mouseEvent.preventDefault();
        this.selectCommitRange(this.commitSelectionAnchorHash, hash);
        return;
      }
      if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
        mouseEvent.preventDefault();
        this.toggleCommitSelection(hash, sourceElem);
        return;
      }
      this.clearCommitSelection();
      this.commitSelectionAnchorHash = hash;
      this.toggleCommitDetails(sourceElem, hash);
    });
    addListenerToClass("commit", "keydown", (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
      const sourceElem = closestHTMLElement(e.target, ".commit");
      const hash = sourceElem?.dataset.hash;
      if (sourceElem === null || hash === undefined) return;
      keyboardEvent.preventDefault();
      this.toggleCommitDetails(sourceElem, hash);
    });
  }
  private registerGitRefContextMenuListener(root: Document | Element = document) {
    addListenerToClass(
      "gitRef",
      "contextmenu",
      (e: Event) => {
        e.stopPropagation();
        const sourceElem = closestHTMLElement(e.target, ".gitRef");
        const rawRefName = sourceElem?.dataset.name;
        if (sourceElem === null || rawRefName === undefined) return;

        const refName = unescapeHtml(rawRefName);
        showContextMenu(
          e as MouseEvent,
          this.buildGitRefContextMenu(sourceElem, refName),
          sourceElem,
          this.branchWorktreeMenuHeader(sourceElem, refName)
        );
      },
      root
    );
  }
  private buildGitRefContextMenu(sourceElem: HTMLElement, refName: string) {
    if (sourceElem.classList.contains("stash")) {
      const row = closestHTMLElement(sourceElem, ".stashGraphRow");
      const hash = row?.dataset.hash;
      return hash === undefined ? [] : this.buildStashContextMenu(refName, hash, sourceElem);
    }
    const isTag = sourceElem.classList.contains("tag");
    const menu = isTag
      ? this.buildTagContextMenu(refName)
      : this.buildBranchContextMenu(sourceElem, refName);
    const refCommitHash = this.getCommitHashForElement(sourceElem);
    const compareWithHeadItem =
      refCommitHash === null
        ? null
        : this.buildCompareWithHeadMenuItem(refCommitHash, sourceElem, refName);
    if (compareWithHeadItem !== null) menu.push(compareWithHeadItem);
    const compareWithItem =
      refCommitHash === null
        ? null
        : this.buildCompareWithMenuItem(refCommitHash, sourceElem, refName);
    if (compareWithItem !== null) menu.push(compareWithItem);
    const copyType = isTag ? "Tag Name" : "Branch Name";
    const copyTitle = isTag ? l10n.copyTagName : l10n.copyBranchName;
    const copyGroup = this.contextMenuCopyGroupForRef(sourceElem, isTag);
    if (this.isContextMenuActionVisible(copyGroup, "copyName")) {
      menu.push(null, {
        title: copyTitle,
        onClick: () => {
          sendMessage({ command: "copyToClipboard", type: copyType, data: refName });
        }
      });
    }
    return menu;
  }
  private buildCompareWithHeadMenuItem(
    hash: string,
    sourceElem: HTMLElement,
    refName?: string
  ): ContextMenuElement {
    if (!this.canCompareWithHead(hash)) return null;
    const group = this.contextMenuGroupForRef(sourceElem);
    if (!this.isContextMenuActionVisible(group, "compareWithHead")) return null;
    return {
      title: l10n.compareWithHead,
      onClick: () => this.loadCommitComparisonWithHead(sourceElem, hash, refName)
    };
  }
  private canCompareWithHead(hash: string) {
    return this.commitHead !== null && hash !== "*" && hash !== this.commitHead;
  }
  private buildCompareWithWorkingTreeMenuItem(
    hash: string,
    sourceElem: HTMLElement
  ): ContextMenuElement {
    if (hash === "*") return null;
    if (!this.isContextMenuActionVisible("commit", "compareWithWorkingTree")) return null;
    return {
      title: l10n.compareWithWorkingTree,
      onClick: () => this.loadCommitComparisonWithWorkingTree(sourceElem, hash)
    };
  }
  private buildCompareWithMenuItem(
    hash: string,
    sourceElem: HTMLElement,
    refName?: string
  ): ContextMenuElement {
    if (hash === "*") return null;
    const group = this.contextMenuGroupForRef(sourceElem);
    if (!this.isContextMenuActionVisible(group, "compareWith")) return null;
    return {
      title: l10n.compareWith + ELLIPSIS,
      onClick: () => this.showCompareWithDialog(hash, sourceElem, refName)
    };
  }
  private showCompareWithDialog(hash: string, sourceElem: HTMLElement, baseLabel?: string) {
    const base = escapeHtml(baseLabel ?? this.displayHash(hash));
    showFormDialog(
      l10n.dialogCompareWithTitle.replace("{0}", `<b><i>${base}</i></b>`),
      [
        {
          type: "text",
          name: "",
          default: "",
          placeholder: l10n.dialogCompareWithPlaceholder,
          required: true
        }
      ],
      l10n.compareWith,
      (values) => this.requestCompareWithResolution(hash, sourceElem, values[0], baseLabel),
      sourceElem
    );
    this.attachCompareWithSuggestions();
  }
  // No DialogInput type offers suggestions, so the dialog's plain text input
  // gains a native <datalist> once it is in the DOM: HEAD first, then the
  // loaded local branches, remote branches and tags. Free text (a SHA or an
  // expression like HEAD~2) stays typeable beside the suggestions.
  private attachCompareWithSuggestions() {
    const input = document.getElementById("dialogInput0") as HTMLInputElement | null;
    if (input === null) return;
    const list = document.createElement("datalist");
    list.id = "compareWithSuggestions";
    for (const suggestion of this.compareWithSuggestions()) {
      const option = document.createElement("option");
      option.value = suggestion;
      list.append(option);
    }
    input.setAttribute("list", list.id);
    input.after(list);
    input.focus();
  }
  private compareWithSuggestions(): string[] {
    const localBranches = this.gitBranches.filter((branch) => !branch.startsWith("remotes/"));
    const remoteBranches = this.gitBranches
      .filter((branch) => branch.startsWith("remotes/"))
      .map((branch) => branch.substring(8));
    return [...new Set(["HEAD", ...localBranches, ...remoteBranches, ...this.gitTags])];
  }
  private requestCompareWithResolution(
    hash: string,
    sourceElem: HTMLElement,
    enteredRef: string,
    baseLabel?: string
  ) {
    const ref = enteredRef.trim();
    if (ref === "") return;
    const requestId = this.createRequestId();
    this.pendingCompareWith = { requestId, sourceElem, hash, ref, baseLabel };
    sendMessage({ command: "resolveRef", repo: this.currentRepo, ref, requestId });
  }
  public loadResolvedComparison(
    requestId: number,
    resolvedHash: string | null,
    errorReason: string | null
  ) {
    const pending = this.pendingCompareWith;
    if (pending?.requestId !== requestId) return;
    this.pendingCompareWith = null;
    if (resolvedHash === null) {
      showErrorDialog(l10n.unableToResolveRef, errorReason, null);
      return;
    }
    // The graph may have re-rendered while Git resolved the ref; prefer the
    // live row for the clicked commit over the element captured at submit.
    const sourceElem =
      document.querySelector<HTMLElement>(`tr.commit[data-hash="${pending.hash}"]`) ??
      pending.sourceElem;
    this.loadCommitComparison(sourceElem, pending.hash, pending.hash, resolvedHash, {
      baseLabel: pending.baseLabel,
      compareLabel: compareWithLabel(pending.ref, resolvedHash)
    });
  }
  private contextMenuCopyGroupForRef(
    sourceElem: HTMLElement,
    isTag: boolean
  ): keyof GGL.ContextMenuActionsVisibility {
    if (isTag) return "tag";
    if (sourceElem.classList.contains("remote")) return "remoteBranch";
    return "branch";
  }
  private contextMenuGroupForRef(sourceElem: HTMLElement): keyof GGL.ContextMenuActionsVisibility {
    if (sourceElem.classList.contains("tag")) return "tag";
    if (sourceElem.classList.contains("remote")) return "remoteBranch";
    if (sourceElem.classList.contains("head")) return "branch";
    return "commit";
  }
  private getCommitHashForElement(sourceElem: HTMLElement): string | null {
    const row = closestHTMLElement(sourceElem, "tr.commit");
    return row?.dataset.hash ?? null;
  }
  private getCommitRowForElement(sourceElem: HTMLElement): HTMLTableRowElement | null {
    return closestHTMLElement(sourceElem, "tr.commit") as HTMLTableRowElement | null;
  }
  private buildTagContextMenu(refName: string): ContextMenuElement[] {
    return [
      this.isContextMenuActionVisible("tag", "viewDetails")
        ? {
            title: l10n.viewTagDetails + ELLIPSIS,
            onClick: () => this.loadTagDetails(refName)
          }
        : null,
      this.isContextMenuActionVisible("tag", "delete")
        ? {
            title: l10n.deleteTag + ELLIPSIS,
            onClick: () => this.showDeleteTagDialog(refName)
          }
        : null,
      this.isContextMenuActionVisible("tag", "push")
        ? {
            title: l10n.pushTag + ELLIPSIS,
            onClick: () => this.showPushTagDialog(refName)
          }
        : null,
      this.isContextMenuActionVisible("tag", "fetchTags")
        ? {
            title: l10n.fetchTags + ELLIPSIS,
            onClick: () => this.showFetchTagsDialog()
          }
        : null,
      this.isContextMenuActionVisible("tag", "createArchive")
        ? {
            title: l10n.createArchive,
            onClick: () => this.createArchiveAction(refName)
          }
        : null,
      this.isContextMenuActionVisible("tag", "createWorktree")
        ? {
            title: l10n.createWorktree + ELLIPSIS,
            onClick: () =>
              this.showCreateWorktreeDialog(
                {
                  label: refName,
                  startPoint: refName,
                  folderName: refName,
                  branch: null,
                  newBranchName: "",
                  mode: "detach"
                },
                null
              )
          }
        : null
    ];
  }
  private loadTagDetails(refName: string) {
    sendMessage({ command: "tagDetails", repo: this.currentRepo, tagName: refName });
    showActionRunningDialog(l10n.statusLoadingTagDetails);
  }
  private buildBranchContextMenu(sourceElem: HTMLElement, refName: string): ContextMenuElement[] {
    if (sourceElem.classList.contains("remote")) {
      return this.buildRemoteBranchContextMenu(sourceElem, refName);
    }

    if (!sourceElem.classList.contains("head")) {
      return this.buildDetachedBranchContextMenu(sourceElem, refName);
    }

    const menu: ContextMenuElement[] = [];
    this.appendBranchCheckoutItem(menu, sourceElem, refName);
    menu.push(
      this.visibleContextMenuItem("branch", "createWorktree", {
        title: l10n.createWorktree + ELLIPSIS,
        onClick: () =>
          this.showCreateWorktreeDialog(
            {
              label: refName,
              startPoint: refName,
              folderName: refName,
              // The current branch is checked out here, so only a new branch
              // or a detached HEAD can start from it in another worktree.
              branch: this.gitBranchHead === refName ? null : refName,
              newBranchName: "",
              mode: this.gitBranchHead === refName ? "new" : "branch"
            },
            sourceElem
          )
      })
    );
    menu.push(...this.buildBranchMetadataItems(refName, sourceElem));
    this.appendBranchRemoteItems(menu, refName);
    this.appendBranchMutationItems(menu, sourceElem, refName);
    this.appendWorktreeMaintenanceItems(menu, refName);
    this.appendWorktreeLifecycleItems(menu, refName);
    this.appendBranchArchiveItem(menu, refName);
    this.appendBranchPullRequestItem(menu, refName, sourceElem);
    return menu;
  }
  private buildDetachedBranchContextMenu(
    sourceElem: HTMLElement,
    refName: string
  ): ContextMenuElement[] {
    return [
      this.visibleContextMenuItem("branch", "checkout", {
        title: l10n.checkoutBranch + ELLIPSIS,
        onClick: () => this.checkoutBranchAction(sourceElem, refName)
      })
    ];
  }
  private appendBranchCheckoutItem(
    menu: ContextMenuElement[],
    sourceElem: HTMLElement,
    refName: string
  ) {
    if (this.gitBranchHead === refName) return;
    if (!this.isContextMenuActionVisible("branch", "checkout")) return;

    // Git refuses to switch to a branch another worktree has checked out, so
    // the way to work on it is that worktree.
    if (this.otherWorktreePath(refName) !== null) {
      menu.push(this.buildOpenWorktreeMenuItem(refName));
      return;
    }
    menu.push({
      title: l10n.checkoutBranch,
      onClick: () => this.checkoutBranchAction(sourceElem, refName)
    });
  }
  /** The branch's other worktree, or null when no other worktree has it checked out. */
  private otherWorktreePath(branchName: string): string | null {
    return this.worktreePathsFor(branchName)[0] ?? null;
  }
  private buildOpenWorktreeMenuItem(branchName: string): ContextMenuItem {
    return {
      title: l10n.openWorktree + ELLIPSIS,
      onClick: () => this.openWorktreeAction(branchName)
    };
  }
  /**
   * The one place "Open Worktree…" goes through (W31). The branch cannot be
   * checked out here, so the worktree that has it opens in a new window. The
   * extension lists the worktrees again before acting, so a worktree removed
   * since this graph loaded is refused instead of opened.
   */
  private openWorktreeAction(branchName: string) {
    const worktreePath = this.otherWorktreePath(branchName);
    if (worktreePath === null) return;

    showFormDialog(
      l10n.dialogOpenWorktreeMessage
        .replace("{0}", `<b><i>${escapeHtml(branchName)}</i></b>`)
        .replace("{1}", `<b><i>${escapeHtml(worktreePath)}</i></b>`),
      [],
      l10n.dialogOpenWorktreeSubmit,
      () =>
        sendMessage({
          command: "openWorktree",
          repo: this.currentRepo,
          path: worktreePath,
          newWindow: true
        }),
      null
    );
  }
  /**
   * "Create Worktree…" (W22), one dialog for every entry point. A branch
   * another worktree already has checked out is refused here, from the
   * worktree list, offering that worktree instead — never from a Git error
   * after the fact. The backend repeats every refusal before Git runs.
   */
  private showCreateWorktreeDialog(source: CreateWorktreeSource, sourceElem: HTMLElement | null) {
    if (
      source.branch !== null &&
      otherWorktreesHoldingBranch(this.gitWorktrees, source.branch).length > 0
    ) {
      this.openWorktreeAction(source.branch);
      return;
    }

    const options: { name: string; value: string }[] = [];
    if (source.branch !== null) {
      const branch = source.branch;
      options.push({
        name: l10n.dialogCreateWorktreeCheckoutBranch.replace("{0}", () => branch),
        value: "branch"
      });
    }
    options.push(
      {
        name: l10n.dialogCreateWorktreeNewBranchFrom.replace("{0}", () => source.label),
        value: "new"
      },
      {
        name: l10n.dialogCreateWorktreeDetachedAt.replace("{0}", () => source.label),
        value: "detach"
      }
    );
    const mode = source.branch === null && source.mode === "branch" ? "new" : source.mode;

    showFormDialog(
      l10n.dialogCreateWorktreeTitle.replace(
        "{0}",
        () => `<b><i>${escapeHtml(source.label)}</i></b>`
      ),
      [
        {
          type: "folder",
          name: l10n.dialogCreateWorktreeFolder,
          default: defaultWorktreePath(
            this.currentRepo,
            source.folderName,
            this.config.worktreePathTemplate
          ),
          required: true
        },
        { type: "select", name: l10n.dialogCreateWorktreeCheckout, options, default: mode },
        {
          type: "text-ref",
          name: l10n.dialogCreateWorktreeNewBranch,
          default: source.newBranchName,
          dependsOn: { input: 1, value: "new" }
        },
        { type: "checkbox", name: l10n.dialogCreateWorktreeLock, value: false },
        {
          type: "text",
          name: l10n.dialogCreateWorktreeLockReason,
          default: "",
          placeholder: l10n.dialogAddTagOptional
        }
      ],
      l10n.dialogCreateWorktreeSubmit,
      (values) => this.submitCreateWorktree(source, values),
      sourceElem
    );
  }
  private submitCreateWorktree(source: CreateWorktreeSource, values: string[]) {
    const path = values[0].trim();
    const mode = values[1];
    this.pendingCreatedWorktree = path;
    sendMessage({
      command: "addWorktree",
      repo: this.currentRepo,
      path,
      branch: mode === "branch" ? source.branch : null,
      newBranch: mode === "new" ? values[2].trim() : null,
      startPoint: mode === "branch" ? null : source.startPoint,
      detach: mode === "detach",
      lockReason: values[3] === "checked" ? values[4].trim() : null
    });
    showActionRunningDialog(l10n.statusCreatingWorktree);
  }
  /**
   * The `addWorktree` reply: on success the graph refreshes and the finish
   * step (decision Y8) asks what happens with the new worktree, opening on
   * the choice made last time.
   */
  public finishCreateWorktree(status: GitCommandStatus) {
    const path = this.pendingCreatedWorktree;
    this.pendingCreatedWorktree = null;
    if (status !== null || path === null) {
      refreshGraphOrDisplayError(status, l10n.unableToCreateWorktree);
      return;
    }

    this.refresh(true);
    showSelectDialog(
      l10n.dialogWorktreeCreatedMessage.replace("{0}", () => `<b><i>${escapeHtml(path)}</i></b>`),
      this.lastWorktreeFinish,
      [
        { name: l10n.dialogWorktreeCreatedOpenNewWindow, value: "newWindow" },
        { name: l10n.dialogWorktreeCreatedAddToWorkspace, value: "workspace" },
        { name: l10n.dialogWorktreeCreatedSwitchGraph, value: "switch" },
        { name: l10n.dialogWorktreeCreatedNothing, value: "nothing" }
      ],
      l10n.dialogWorktreeCreatedSubmit,
      (value) => {
        this.lastWorktreeFinish = normalizeWorktreeFinish(value);
        this.saveState();
        this.applyWorktreeFinish(path, this.lastWorktreeFinish);
      },
      null
    );
  }
  private applyWorktreeFinish(path: string, choice: WorktreeFinishChoice) {
    if (choice === "newWindow") {
      sendMessage({ command: "openWorktree", repo: this.currentRepo, path, newWindow: true });
    } else if (choice === "workspace") {
      sendMessage({ command: "addWorktreeToWorkspace", repo: this.currentRepo, path });
    } else if (choice === "switch") {
      sendMessage({ command: "switchGraphToWorktree", repo: this.currentRepo, path });
    }
  }
  /**
   * Locked menu items are not supported, so the actions Git refuses for a branch
   * another worktree has checked out are left out, and this header says why.
   */
  private branchWorktreeMenuHeader(
    sourceElem: HTMLElement,
    refName: string
  ): ContextMenuHeader | undefined {
    const branchName = this.localBranchOfRef(sourceElem, refName);
    const holders =
      branchName === null ? [] : otherWorktreesHoldingBranch(this.gitWorktrees, branchName);
    if (holders.length === 0) return undefined;

    const where = holders.map((worktree) => describeWorktreeCheckout(worktree, l10n)).join("; ");
    return {
      title: l10n.branchInWorktreeTitle,
      caption: l10n.branchInWorktreeCaption.replace("{0}", () => where)
    };
  }
  /** The local branch a branch or remote-branch label stands for; null for tags, stashes and detached labels. */
  private localBranchOfRef(sourceElem: HTMLElement, refName: string): string | null {
    if (sourceElem.classList.contains("head")) return refName;
    if (!sourceElem.classList.contains("remote")) return null;

    const remoteBranch = parseRemoteBranchName(refName, this.getRemoteNames());
    return remoteBranch !== null && this.hasLocalBranch(remoteBranch.branchName)
      ? remoteBranch.branchName
      : null;
  }
  private buildBranchMetadataItems(refName: string, sourceElem: HTMLElement): ContextMenuElement[] {
    return [
      ...this.buildIssueContextMenuItems(refName, sourceElem),
      this.visibleContextMenuItem("branch", "rename", {
        title: l10n.renameBranch + ELLIPSIS,
        onClick: () => this.showRenameBranchDialog(refName)
      })
    ];
  }
  private appendBranchRemoteItems(menu: ContextMenuElement[], refName: string) {
    if (this.gitRemotes.length === 0) return;

    menu.push(
      this.visibleContextMenuItem("branch", "push", {
        title: l10n.pushBranch + ELLIPSIS,
        onClick: () => this.showPushBranchDialog(refName)
      }),
      // Updating from upstream fetches into the branch, which Git refuses while
      // another worktree has it checked out.
      this.otherWorktreePath(refName) === null
        ? this.visibleContextMenuItem("branch", "pull", {
            title: l10n.pullBranch + ELLIPSIS,
            onClick: () => this.showUpdateBranchFromUpstreamDialog(refName)
          })
        : null
    );
  }
  private appendBranchMutationItems(
    menu: ContextMenuElement[],
    sourceElem: HTMLElement,
    refName: string
  ) {
    if (this.gitBranchHead === refName) return;

    menu.push(
      this.visibleContextMenuItem("branch", "delete", {
        title: l10n.deleteBranch + ELLIPSIS,
        onClick: () => this.showDeleteBranchDialog(refName)
      }),
      this.visibleContextMenuItem("branch", "merge", {
        title: l10n.merge + ELLIPSIS,
        onClick: () => this.showMergeBranchDialog(refName)
      }),
      this.visibleContextMenuItem("branch", "rebase", {
        title: l10n.rebase + ELLIPSIS,
        onClick: () => this.showRebaseDialog(refName, refName, "branch", sourceElem)
      })
    );
  }
  private appendBranchArchiveItem(menu: ContextMenuElement[], refName: string) {
    if (!this.isContextMenuActionVisible("branch", "createArchive")) return;

    menu.push({
      title: l10n.createArchive,
      onClick: () => this.createArchiveAction(refName)
    });
  }
  private appendBranchPullRequestItem(
    menu: ContextMenuElement[],
    refName: string,
    sourceElem: HTMLElement
  ) {
    const pullRequestItem = this.buildCreatePullRequestMenuItem(refName, null, sourceElem);
    if (pullRequestItem !== null) menu.push(null, pullRequestItem);
  }
  private buildRemoteBranchContextMenu(
    sourceElem: HTMLElement,
    refName: string
  ): ContextMenuElement[] {
    const remoteBranch = parseRemoteBranchName(refName, this.getRemoteNames());
    const menu: ContextMenuElement[] = [
      this.buildRemoteCheckoutItem(sourceElem, refName, remoteBranch?.branchName ?? null)
    ];
    if (remoteBranch === null) return menu;

    const { remote, branchName } = remoteBranch;
    const remoteActions: ContextMenuElement[] = [
      ...this.buildIssueContextMenuItems(refName, sourceElem),
      this.isContextMenuActionVisible("remoteBranch", "delete")
        ? {
            title: l10n.deleteRemoteBranch + ELLIPSIS,
            onClick: () => this.showDeleteRemoteBranchDialog(remote, branchName, refName)
          }
        : null,
      this.isContextMenuActionVisible("remoteBranch", "merge")
        ? {
            title: l10n.merge + ELLIPSIS,
            onClick: () => this.showMergeBranchDialog(refName)
          }
        : null,
      ...(this.hasLocalBranch(branchName) &&
      this.gitBranchHead !== branchName &&
      this.otherWorktreePath(branchName) === null &&
      this.isContextMenuActionVisible("remoteBranch", "fetchIntoLocalBranch")
        ? [
            {
              title: l10n.fetchIntoLocalBranch + ELLIPSIS,
              onClick: () => this.showFetchIntoLocalBranchDialog(remote, branchName, refName)
            }
          ]
        : []),
      this.isContextMenuActionVisible("remoteBranch", "pull")
        ? {
            title: l10n.pullBranch + ELLIPSIS,
            onClick: () => this.showPullBranchDialog(remote, branchName, refName)
          }
        : null,
      this.isContextMenuActionVisible("remoteBranch", "createArchive")
        ? {
            title: l10n.createArchive,
            onClick: () => this.createArchiveAction(refName)
          }
        : null,
      this.isContextMenuActionVisible("remoteBranch", "createWorktree")
        ? {
            title: l10n.createWorktree + ELLIPSIS,
            onClick: () =>
              this.showCreateWorktreeDialog(
                {
                  label: refName,
                  startPoint: refName,
                  folderName: branchName,
                  branch:
                    this.hasLocalBranch(branchName) && this.gitBranchHead !== branchName
                      ? branchName
                      : null,
                  newBranchName: branchName,
                  mode:
                    this.hasLocalBranch(branchName) && this.gitBranchHead !== branchName
                      ? "branch"
                      : "new"
                },
                sourceElem
              )
          }
        : null
    ];
    menu.push(...remoteActions);
    const pullRequestItem = this.buildCreatePullRequestMenuItem(branchName, remote, sourceElem);
    if (pullRequestItem !== null) {
      menu.push(null, pullRequestItem);
    }
    return menu;
  }
  /** Checkout of a remote branch, or "Open Worktree…" when its local branch is held by another worktree. */
  private buildRemoteCheckoutItem(
    sourceElem: HTMLElement,
    refName: string,
    localName: string | null
  ): ContextMenuElement {
    if (!this.isContextMenuActionVisible("remoteBranch", "checkout")) return null;
    if (localName !== null && this.otherWorktreePath(localName) !== null) {
      return this.buildOpenWorktreeMenuItem(localName);
    }
    return {
      title: l10n.checkoutBranch + ELLIPSIS,
      onClick: () => this.checkoutBranchAction(sourceElem, refName)
    };
  }
  private buildIssueContextMenuItems(
    refName: string,
    sourceElem: HTMLElement
  ): ContextMenuElement[] {
    const issueLinks = extractIssueLinks(refName, this.getCurrentRepoState()?.issueLinking ?? null);
    if (issueLinks.length === 0) return [];
    const group = sourceElem.classList.contains("remote") ? "remoteBranch" : "branch";
    if (!this.isContextMenuActionVisible(group, "viewIssue")) return [];

    return [
      null,
      {
        title: issueLinks.length > 1 ? l10n.viewIssue + ELLIPSIS : l10n.viewIssue,
        onClick: () => {
          if (issueLinks.length === 1) {
            sendMessage({ command: "openExternalUrl", url: issueLinks[0].url });
            return;
          }

          showSelectDialog(
            l10n.dialogViewIssueSelect,
            "0",
            issueLinks.map((link, index) => ({ name: link.displayText, value: String(index) })),
            l10n.viewIssue,
            (value) => {
              const link = issueLinks[Number.parseInt(value, 10)];
              if (link !== undefined) sendMessage({ command: "openExternalUrl", url: link.url });
            },
            sourceElem
          );
        }
      }
    ];
  }
  private buildCreatePullRequestMenuItem(
    branchName: string,
    remoteName: string | null,
    sourceElem: HTMLElement
  ): ContextMenuElement | null {
    const repoState = this.getCurrentRepoState();
    const config = repoState?.pullRequest ?? null;
    if (config === null) return null;
    const group = remoteName === null ? "branch" : "remoteBranch";
    if (!this.isContextMenuActionVisible(group, "createPullRequest")) return null;
    const remote = this.getRemoteByName(remoteName ?? config.remoteName);
    if (remote === null) return null;

    return {
      title: l10n.createPullRequest + ELLIPSIS,
      onClick: () => {
        showCheckboxDialog(
          l10n.dialogCreatePullRequestConfirm.replace(
            "{0}",
            `<b><i>${escapeHtml(branchName)}</i></b>`
          ),
          l10n.dialogCreatePullRequestPush,
          remoteName === null && config.pushBeforeCreate,
          l10n.dialogCreatePullRequestSubmit,
          (pushBeforeCreate) => {
            this.sendCreatePullRequest(branchName, remote.name, pushBeforeCreate, sourceElem);
          },
          sourceElem
        );
      }
    };
  }
  private sendCreatePullRequest(
    branchName: string,
    remoteName: string,
    pushBeforeCreate: boolean,
    sourceElem: HTMLElement
  ) {
    const repoState = this.getCurrentRepoState();
    const config = repoState?.pullRequest ?? null;
    const remote = this.getRemoteByName(remoteName);
    if (config === null || remote === null) return;

    const remoteUrl = this.firstRemoteUrl(remote.fetchUrls) || this.firstRemoteUrl(remote.pushUrls);
    if (remoteUrl === "") {
      showErrorDialog(l10n.dialogPullRequestRemoteUrlRequired, null, sourceElem);
      return;
    }

    sendMessage({
      command: "createPullRequest",
      repo: this.currentRepo,
      branchName,
      remoteName: remote.name,
      remoteUrl,
      baseBranch: config.baseBranch,
      urlTemplate: config.urlTemplate,
      pushBeforeCreate
    });
    showActionRunningDialog(l10n.statusCreatingPullRequest);
  }
  private showDeleteTagDialog(refName: string) {
    const remoteNames = this.getRemoteNames();
    const message = l10n.dialogDeleteConfirm
      .replace("{0}", l10n.labelTag)
      .replace("{1}", `<b><i>${escapeHtml(refName)}</i></b>`);
    if (remoteNames.length === 0) {
      showConfirmationDialog(
        message,
        () => {
          sendMessage({ command: "deleteTag", repo: this.currentRepo, tagName: refName });
          showActionRunningDialog(l10n.statusDeletingTag);
        },
        null
      );
      return;
    }

    // `refs/tags` has no per-remote tracking refs, so the webview cannot know
    // which remotes hold the tag. Offer every remote, default to none, and let
    // the backend treat an already-absent remote tag as success.
    const inputs: DialogInput[] = remoteNames.map((remote) => ({
      type: "checkbox" as const,
      name: l10n.dialogDeleteTagOnRemote.replace("{0}", remote),
      value: false
    }));

    showFormDialog(
      message,
      inputs,
      l10n.deleteTag,
      (values) => {
        const request: Extract<GGL.RequestMessage, { command: "deleteTag" }> = {
          command: "deleteTag",
          repo: this.currentRepo,
          tagName: refName
        };
        const selectedRemotes = remoteNames.filter((_, index) => values[index] === "checked");
        if (selectedRemotes.length > 0) request.deleteOnRemotes = selectedRemotes;
        sendMessage(request);
        showActionRunningDialog(l10n.statusDeletingTag);
      },
      null
    );
  }
  private showPushTagDialog(refName: string) {
    const remoteNames = this.getRemoteNames();
    if (remoteNames.length === 0) return;

    const pushTagInputs: DialogInput[] = [
      ...this.remoteCheckboxInputs(remoteNames),
      ...this.pushOptionInputs()
    ];
    showFormDialog(
      l10n.dialogPushTagConfirm.replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`),
      pushTagInputs,
      l10n.pushTag,
      (values) => {
        const { remotes, noVerify, mode } = this.parsePushDialogValues(
          remoteNames,
          pushTagInputs,
          values
        );
        if (remotes.length === 0) {
          showErrorDialog(l10n.dialogPushBranchNoRemoteSelected, null, null);
          return;
        }

        sendMessage({
          command: "pushTag",
          repo: this.currentRepo,
          tagName: refName,
          remotes,
          noVerify,
          mode
        });
        showActionRunningDialog(l10n.pushingTag);
      },
      null
    );
  }
  private showPushAllTagsDialog() {
    const remoteNames = this.getRemoteNames();
    if (remoteNames.length === 0) return;

    const pushAllTagsInputs: DialogInput[] = [
      ...this.remoteCheckboxInputs(remoteNames),
      ...this.pushOptionInputs()
    ];
    showFormDialog(
      l10n.dialogPushAllTagsConfirm,
      pushAllTagsInputs,
      l10n.dialogPushAllTagsSubmit,
      (values) => {
        const { remotes, noVerify, mode } = this.parsePushDialogValues(
          remoteNames,
          pushAllTagsInputs,
          values
        );
        if (remotes.length === 0) {
          showErrorDialog(l10n.dialogPushBranchNoRemoteSelected, null, null);
          return;
        }

        sendMessage({
          command: "pushAllTags",
          repo: this.currentRepo,
          remotes,
          noVerify,
          mode
        });
        showActionRunningDialog(l10n.statusPushingAllTags);
      },
      this.pushTagsBtn
    );
  }
  /**
   * One remote checkbox per remote, followed by the shared bypass-hooks and
   * push-mode options — the same construction for branch, tag, and all-tags
   * pushes.
   */
  /**
   * The remote checkboxes for a push or fetch dialog, under a "Remotes"
   * heading.
   *
   * The heading is not decoration. Cloning a fork with the `gh` CLI creates a
   * remote literally named `upstream`, so a bare "Push to upstream" row sits
   * next to "Set upstream" — which is `git push -u`, a different concept
   * pointing at a different repository. Labelling the group is what tells the
   * two apart.
   */
  private remoteCheckboxInputs(
    remoteNames: string[],
    defaultRemote = this.defaultPushRemoteName(remoteNames)
  ): DialogInput[] {
    return [
      { type: "group" as const, name: l10n.dialogRemotes },
      ...remoteNames.map((remote) => ({
        type: "checkbox" as const,
        name: l10n.dialogPushBranchRemote.replace("{0}", remote),
        value: remote === defaultRemote,
        grouped: true
      }))
    ];
  }
  private pushOptionInputs(): DialogInput[] {
    return [
      { type: "checkbox", name: l10n.dialogBypassGitHooks, value: false },
      {
        type: "select",
        name: l10n.dialogPushBranchMode,
        default: "normal",
        options: GIT_PUSH_BRANCH_MODES.map((mode) => ({
          name: this.pushBranchModeLabel(mode),
          value: mode
        }))
      }
    ];
  }
  /** `optionsOffset` is the bypass-hooks input index within `values`. */
  /**
   * Read a push dialog's values back.
   *
   * Positions are derived from the input *types*, never counted by hand: the
   * forms carry value-less rows (a "Remotes" heading, and notes elsewhere),
   * and an off-by-one here would silently push to the wrong remote. The two
   * stable facts are that the remote checkboxes come first and that
   * `pushOptionInputs()` is appended last, so bypass-hooks is the final
   * checkbox and the mode is the only select.
   */
  private parsePushDialogValues(
    remoteNames: string[],
    inputs: readonly DialogInput[],
    values: string[]
  ) {
    const indicesOfType = (type: DialogInput["type"]) =>
      inputs.flatMap((input, index) => (input.type === type ? [index] : []));
    const checkboxes = indicesOfType("checkbox");
    const selects = indicesOfType("select");
    return {
      remotes: remoteNames.filter((_, i) => values[checkboxes[i]] === "checked"),
      noVerify: values[checkboxes.at(-1) ?? -1] === "checked",
      mode: values[selects[0] ?? -1] as GitPushBranchMode,
      /** The checkbox directly after the remotes, where a dialog has one. */
      afterRemotes: values[checkboxes[remoteNames.length] ?? -1] === "checked"
    };
  }
  public showTagDetails(details: GitTagDetails) {
    const tagType =
      details.type === "annotated" ? l10n.tagDetailsTypeAnnotated : l10n.tagDetailsTypeLightweight;
    const target = `${details.targetType} ${abbrevCommit(
      details.targetHash,
      this.config.shortHashLength
    )}`;
    const tagger = this.formatTagger(details);
    const date =
      details.taggerDate === null
        ? l10n.tagDetailsNotAvailable
        : getCommitDate(details.taggerDate).title;
    const message = [details.subject, details.body]
      .filter((part) => part.trim() !== "")
      .join("\n\n");
    const signature = this.formatTagSignature(details);
    const messageHtml = message === "" ? null : escapeHtml(message).replaceAll("\n", "<br>");

    const html = [
      `<div class="dialogTitle tagDetailsTitle"><b>${l10n.tagDetailsTitle.replace("{0}", escapeHtml(details.tagName))}</b></div>`,
      `<dl class="tagDetailsFields">`,
      this.tagDetailRow(l10n.tagDetailsType, escapeHtml(tagType)),
      this.tagDetailRow(
        l10n.tagDetailsObject,
        escapeHtml(abbrevCommit(details.objectHash, this.config.shortHashLength))
      ),
      this.tagDetailRow(l10n.tagDetailsTarget, escapeHtml(target)),
      this.tagDetailRow(l10n.tagDetailsTagger, tagger),
      this.tagDetailRow(l10n.tagDetailsDate, escapeHtml(date)),
      this.tagDetailRow(l10n.tagDetailsSignature, signature),
      `<dt class="tagDetailsMessageLabel">${l10n.tagDetailsMessage}</dt>`,
      `<dd class="tagDetailsMessage">${messageHtml ?? escapeHtml(l10n.tagDetailsNoMessage)}</dd>`,
      `</dl>`,
      `<div class="tagDetailsActions">`,
      this.tagDetailsCopyButton("tagDetailsCopyName", svgIcons.copy, l10n.copyTagName),
      this.tagDetailsCopyButton("tagDetailsCopyHash", svgIcons.copy, l10n.copyTagHash),
      this.tagDetailsCopyButton("tagDetailsCopyMessage", svgIcons.copy, l10n.copyTagMessage),
      `</div>`
    ].join("");

    showDialog(html, null, l10n.dialogDismiss, null, null);
    dialog.classList.add("tagDetails");
    this.bindTagDetailsActions(details.tagName, details.objectHash, message);
    setStatusStrip("ready", l10n.statusReady);
  }

  private tagDetailRow(label: string, valueHtml: string): string {
    return `<dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd>`;
  }

  private tagDetailsCopyButton(id: string, icon: string, label: string): string {
    return `<div id="${id}" class="dialogBtn tagDetailsAction" role="button" tabindex="0">${icon}${escapeHtml(label)}</div>`;
  }

  private bindTagDetailsActions(tagName: string, objectHash: string, message: string): void {
    const bind = (id: string, type: string, data: string) => {
      const btn = document.getElementById(id);
      if (btn === null) return;
      const handler = () => {
        hideDialog();
        sendMessage({ command: "copyToClipboard", type, data });
      };
      btn.addEventListener("click", handler);
    };
    bind("tagDetailsCopyName", "Tag Name", tagName);
    bind("tagDetailsCopyHash", "Tag Hash", objectHash);
    bind("tagDetailsCopyMessage", "Tag Message", message);
  }
  private formatTagger(details: GitTagDetails) {
    if (details.taggerName === null && details.taggerEmail === null) {
      return escapeHtml(l10n.tagDetailsNotAvailable);
    }
    const name = escapeHtml(details.taggerName ?? l10n.tagDetailsNotAvailable);
    if (details.taggerEmail === null) return name;
    const email = escapeHtml(details.taggerEmail);
    return `${name} &lt;<a href="mailto:${email}" tabindex="-1">${email}</a>&gt;`;
  }
  /** Returns escaped HTML: the status word carries the same color family as the signed-tag badge. */
  private formatTagSignature(details: GitTagDetails) {
    if (details.signature === null) {
      return `<span class="tagSignature-unsigned">${escapeHtml(l10n.tagDetailsSignatureUnsigned)}</span>`;
    }
    const statusLabels: Record<NonNullable<GitTagDetails["signature"]>["status"], string> = {
      valid: l10n.tagDetailsSignatureValid,
      bad: l10n.tagDetailsSignatureBad,
      failed: l10n.tagDetailsSignatureFailed,
      unknown: l10n.tagDetailsSignatureUnknown
    };
    const { status, signer, key } = details.signature;
    const parts = [
      `<span class="tagSignature-${status}">${escapeHtml(statusLabels[status])}</span>`
    ];
    if (signer !== null) parts.push(escapeHtml(signer));
    if (key !== null) parts.push(escapeHtml(key));
    return parts.join(" · ");
  }
  private showRenameBranchDialog(refName: string) {
    // Git allows the rename and moves the other worktree's HEAD along; say so.
    const worktreePath = this.otherWorktreePath(refName);
    const inputs: DialogInput[] = [{ type: "text-ref", name: "", default: refName }];
    if (worktreePath !== null) {
      inputs.push({
        type: "note",
        text: l10n.dialogRenameBranchWorktreeNote.replace("{0}", worktreePath)
      });
    }
    showFormDialog(
      l10n.dialogRenameBranchTitle.replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`),
      inputs,
      l10n.dialogRenameBranchSubmit,
      ([newName]) => {
        sendMessage({
          command: "renameBranch",
          repo: this.currentRepo,
          oldName: refName,
          newName
        });
      },
      null
    );
  }
  private showDeleteBranchDialog(refName: string) {
    const worktreePath = this.otherWorktreePath(refName);
    const holder = worktreePath === null ? null : this.worktreeAtPath(worktreePath);
    if (worktreePath !== null && (holder === null || holder.isMain)) {
      // The main worktree cannot be removed, so the branch stays until it
      // switches to another one.
      showErrorDialog(
        l10n.dialogDeleteBranchInWorktree
          .replace("{0}", escapeHtml(refName))
          .replace("{1}", escapeHtml(worktreePath)),
        null,
        null
      );
      return;
    }
    const deleteOnRemotes = this.getRemotesWithBranch(refName);
    const confirm = l10n.dialogDeleteConfirm
      .replace("{0}", l10n.labelBranch)
      .replace("{1}", `<b><i>${escapeHtml(refName)}</i></b>`);
    showFormDialog(
      holder === null
        ? confirm
        : `${this.worktreeHoldsBranchMessage(refName, holder)}<br><br>${confirm}`,
      this.deleteBranchInputs(holder, deleteOnRemotes),
      l10n.deleteBranch,
      (values) => this.submitDeleteBranch(refName, holder, deleteOnRemotes, values),
      null
    );
  }
  /** The dialog's checkboxes: the worktree removal first, when a worktree holds the branch. */
  private deleteBranchInputs(holder: GitWorktree | null, deleteOnRemotes: string[]): DialogInput[] {
    const inputs: DialogInput[] = [];
    if (holder !== null) {
      inputs.push({
        type: "checkbox",
        name: l10n.dialogDeleteBranchRemoveWorktree.replace("{0}", escapeHtml(holder.path)),
        value: false
      });
    }
    inputs.push({ type: "checkbox", name: l10n.dialogDeleteForceDelete, value: false });
    if (deleteOnRemotes.length > 0) {
      inputs.push({
        type: "checkbox",
        name: l10n.dialogDeleteOnRemotes.replace("{0}", deleteOnRemotes.join(", ")),
        value: false
      });
    }
    return inputs;
  }
  private submitDeleteBranch(
    refName: string,
    holder: GitWorktree | null,
    deleteOnRemotes: string[],
    values: string[]
  ) {
    const forceIndex = holder === null ? 0 : 1;
    const deleteBranch: DeleteBranchPart = {
      branchName: refName,
      forceDelete: values[forceIndex] === "checked"
    };
    if (deleteOnRemotes.length > 0 && values[forceIndex + 1] === "checked") {
      deleteBranch.deleteOnRemotes = deleteOnRemotes;
    }
    if (holder === null) {
      sendMessage({ command: "deleteBranch", repo: this.currentRepo, ...deleteBranch });
      showActionRunningDialog(l10n.statusDeletingBranch);
    } else if (values[0] === "checked") {
      // Left unticked, the dialog only explained, and nothing is sent.
      this.removeWorktreeAction(holder, deleteBranch);
    }
  }
  private worktreeAtPath(path: string): GitWorktree | null {
    return this.gitWorktrees.find((worktree) => worktree.path === path) ?? null;
  }
  /** Why Git keeps the branch, and what removing the worktree does, for each kind of worktree. */
  private worktreeHoldsBranchMessage(refName: string, holder: GitWorktree): string {
    const notes = [
      l10n.dialogDeleteBranchRemovable
        .replace("{0}", escapeHtml(refName))
        .replace("{1}", escapeHtml(holder.path))
    ];
    if (holder.prunable !== null) notes.push(l10n.dialogDeleteBranchStaleNote);
    if (holder.locked !== null) {
      notes.push(
        l10n.dialogDeleteBranchLockedNote.replace("{0}", escapeHtml(holder.locked.reason))
      );
    }
    return notes.join(" ");
  }
  /**
   * Removes a worktree. A worktree with files on disk is read first: Git's own
   * refusal is the last guard, but only a second confirmation that lists what
   * would be lost sends `--force`. A stale entry has nothing on disk to lose.
   */
  private removeWorktreeAction(holder: GitWorktree, deleteBranch?: DeleteBranchPart) {
    const request: Extract<GGL.RequestMessage, { command: "removeWorktree" }> = {
      command: "removeWorktree",
      repo: this.currentRepo,
      path: holder.path,
      force: false,
      unlock: holder.locked !== null
    };
    if (deleteBranch !== undefined) request.deleteBranch = deleteBranch;
    if (holder.prunable !== null) {
      this.sendRemoveWorktree(request);
      return;
    }
    const requestId = this.createRequestId();
    this.pendingWorktreeRemoval = { requestId, request };
    sendMessage({
      command: "worktreeChanges",
      repo: this.currentRepo,
      path: holder.path,
      requestId
    });
    showActionRunningDialog(l10n.statusCheckingWorktree);
  }
  private sendRemoveWorktree(request: Extract<GGL.RequestMessage, { command: "removeWorktree" }>) {
    sendMessage(request);
    showActionRunningDialog(l10n.statusRemovingWorktree);
  }
  /** Asks for the uncommitted changes of the popup's worktrees, when it opens. */
  private requestWorktreeStatus(paths: string[]) {
    const requestId = this.createRequestId();
    this.pendingWorktreeStatus = { requestId, repo: this.currentRepo };
    sendMessage({ command: "worktreeStatus", repo: this.currentRepo, paths, requestId });
  }
  public loadWorktreeStatus(msg: Extract<GGL.ResponseMessage, { command: "worktreeStatus" }>) {
    const pending = this.pendingWorktreeStatus;
    if (pending?.requestId !== msg.requestId || pending.repo !== msg.repo) return;
    this.pendingWorktreeStatus = null;
    this.worktreePopup.setChanges(msg.statuses);
  }
  public loadWorktreeChanges(msg: Extract<GGL.ResponseMessage, { command: "worktreeChanges" }>) {
    const pending = this.pendingWorktreeRemoval;
    if (pending?.requestId !== msg.requestId) return;
    this.pendingWorktreeRemoval = null;
    // A failed read still removes without force: Git refuses a worktree with
    // local changes, so nothing is deleted unconfirmed.
    if (msg.error !== null || msg.files.length === 0) {
      this.sendRemoveWorktree(pending.request);
      return;
    }
    hideDialog();
    const files = msg.files.map((file) => `<li>${escapeHtml(file)}</li>`).join("");
    const more = msg.truncated ? `<p>${l10n.dialogRemoveWorktreeMoreFiles}</p>` : "";
    const target = `<b><i>${escapeHtml(msg.path)}</i></b>`;
    const question = l10n.dialogRemoveWorktreeForce.replace("{0}", () => target);
    showFormDialog(
      `${question}<ul>${files}</ul>${more}`,
      [],
      l10n.dialogRemoveWorktreeForceSubmit,
      () => this.sendRemoveWorktree({ ...pending.request, force: true }),
      null
    );
  }
  /** A button of the Worktrees popup's row (W30): each goes through the flow that owns it. */
  private handleWorktreeRowAction(action: WorktreeRowAction, worktree: GitWorktree) {
    const base = { repo: this.currentRepo, path: worktree.path };
    switch (action) {
      case "openNewWindow":
        sendMessage({ command: "openWorktree", ...base, newWindow: true });
        break;
      case "openHere":
        sendMessage({ command: "openWorktree", ...base, newWindow: false });
        break;
      case "switchGraph":
        sendMessage({ command: "switchGraphToWorktree", ...base });
        break;
      case "copyPath":
        sendMessage({ command: "copyToClipboard", type: "Worktree Path", data: worktree.path });
        break;
      case "lock":
        this.lockWorktreeAction(worktree);
        break;
      case "unlock":
        sendMessage({ command: "unlockWorktree", ...base });
        break;
      case "move":
        this.moveWorktreeAction(worktree);
        break;
      case "repair":
        sendMessage({ command: "repairWorktree", ...base, newPath: null });
        break;
      case "removeStale":
        this.removeWorktreeAction(worktree);
        break;
      case "remove":
        this.confirmRemoveWorktree(worktree);
        break;
    }
  }
  /** Removing a worktree with files asks first; W21's flow then reads its local changes. */
  private confirmRemoveWorktree(worktree: GitWorktree) {
    const message = l10n.dialogRemoveWorktreeConfirm.replace(
      "{0}",
      () => `<b><i>${escapeHtml(worktree.path)}</i></b>`
    );
    showConfirmationDialog(
      `${message} ${this.removeLockedNote(worktree)}`.trim(),
      () => this.removeWorktreeAction(worktree),
      null
    );
  }
  /** What the removal says about a lock: it is lifted first, never forced. */
  private removeLockedNote(worktree: GitWorktree): string {
    if (worktree.locked === null) return "";
    const reason = worktree.locked.reason;
    if (reason === "") return l10n.dialogRemoveWorktreeLockedNote;
    return l10n.dialogDeleteBranchLockedNote.replace("{0}", () => escapeHtml(reason));
  }
  /**
   * Lock Worktree… (W23): an optional reason, which Git records and the list
   * shows. An empty reason locks without one.
   */
  private lockWorktreeAction(worktree: GitWorktree) {
    showFormDialog(
      l10n.dialogLockWorktreeMessage.replace(
        "{0}",
        () => `<b><i>${escapeHtml(worktree.path)}</i></b>`
      ),
      [
        {
          type: "text",
          name: l10n.dialogCreateWorktreeLockReason,
          default: "",
          placeholder: l10n.dialogAddTagOptional
        }
      ],
      l10n.dialogLockWorktreeSubmit,
      (values) => {
        sendMessage({
          command: "lockWorktree",
          repo: this.currentRepo,
          path: worktree.path,
          reason: values[0].trim()
        });
      },
      null
    );
  }
  /**
   * Move Worktree… (W23): the new folder must not exist yet, and Git moves the
   * folder and its record. A locked worktree is never moved from here: the
   * dialog says why and offers the Unlock that comes first.
   */
  private moveWorktreeAction(worktree: GitWorktree) {
    if (worktree.locked !== null) {
      this.offerUnlockBeforeMove(worktree);
      return;
    }
    showFormDialog(
      l10n.dialogMoveWorktreeMessage.replace(
        "{0}",
        () => `<b><i>${escapeHtml(worktree.path)}</i></b>`
      ),
      [
        {
          type: "text",
          name: l10n.dialogMoveWorktreeFolder,
          default: "",
          placeholder: null,
          required: true
        }
      ],
      l10n.dialogMoveWorktreeSubmit,
      (values) => {
        sendMessage({
          command: "moveWorktree",
          repo: this.currentRepo,
          path: worktree.path,
          newPath: values[0].trim()
        });
      },
      null
    );
  }
  private offerUnlockBeforeMove(worktree: GitWorktree) {
    const reason = worktree.locked?.reason ?? "";
    const target = `<b><i>${escapeHtml(worktree.path)}</i></b>`;
    const message =
      reason === ""
        ? l10n.dialogMoveWorktreeLockedNoReason.replace("{0}", () => target)
        : l10n.dialogMoveWorktreeLocked
            .replace("{1}", () => escapeHtml(reason))
            .replace("{0}", () => target);
    showFormDialog(
      message,
      [],
      l10n.worktreeUnlock,
      () => sendMessage({ command: "unlockWorktree", repo: this.currentRepo, path: worktree.path }),
      null
    );
  }
  /** The branch's worktree gets the Lock, Unlock and Move items the popup's row offers (W23). */
  private appendWorktreeLifecycleItems(menu: ContextMenuElement[], refName: string) {
    const holder = this.worktreePathsFor(refName)
      .map((path) => this.worktreeAtPath(path))
      .find((worktree): worktree is GitWorktree => worktree !== null && worktree.prunable === null);
    if (holder === undefined) return;
    const items = lifecycleRowActions(holder).map((action) => ({
      title: this.worktreeLifecycleTitle(action),
      onClick: () => this.handleWorktreeRowAction(action, holder)
    }));
    menu.push(null, ...items);
  }
  private worktreeLifecycleTitle(action: WorktreeRowAction): string {
    if (action === "lock") return l10n.worktreeLock + ELLIPSIS;
    if (action === "move") return l10n.worktreeMove + ELLIPSIS;
    return l10n.worktreeUnlock;
  }
  /** The popup's footer: Create Worktree… from HEAD (W22) and Prune Stale Worktrees… (W21). */
  private handleWorktreeFooterAction(action: WorktreeFooterAction) {
    if (action === "prune") {
      this.showPruneWorktreesDialog();
      return;
    }
    const onBranch = this.gitBranchHead !== null;
    this.showCreateWorktreeDialog(
      {
        label: "HEAD",
        startPoint: "HEAD",
        folderName: this.gitBranchHead ?? "head",
        branch: null,
        newBranchName: "",
        mode: onBranch ? "new" : "detach"
      },
      null
    );
  }
  /** The entries `git worktree prune` removes: folder gone, not locked. */
  private staleWorktrees(): GitWorktree[] {
    return this.gitWorktrees.filter(
      (worktree) => worktree.prunable !== null && worktree.locked === null
    );
  }
  /**
   * The Command Palette's Prune Stale Worktrees (W31) opens the same preview
   * as the branch menu, but says so when there is nothing stale: the menu
   * only offers the item when a stale entry exists, the palette cannot know.
   */
  public showPruneWorktrees() {
    if (this.staleWorktrees().length === 0) {
      showErrorDialog(l10n.dialogPruneWorktreesNone, null, null);
      return;
    }
    this.showPruneWorktreesDialog();
  }
  private showPruneWorktreesDialog() {
    const stale = this.staleWorktrees();
    if (stale.length === 0) return;

    const entries = stale.map((worktree) => `<li>${escapeHtml(worktree.path)}</li>`).join("");
    showFormDialog(
      `${l10n.dialogPruneWorktreesMessage}<ul>${entries}</ul>`,
      [],
      l10n.dialogPruneWorktreesSubmit,
      () => {
        sendMessage({ command: "pruneWorktrees", repo: this.currentRepo });
        showActionRunningDialog(l10n.statusPruningWorktrees);
      },
      null
    );
  }
  /** Stale worktree actions for a branch, and Prune Stale Worktrees when any entry is stale. */
  private appendWorktreeMaintenanceItems(menu: ContextMenuElement[], refName: string) {
    const holder = this.worktreePathsFor(refName)
      .map((path) => this.worktreeAtPath(path))
      .find((worktree) => worktree?.prunable != null);
    const items: ContextMenuElement[] = [];
    if (holder !== undefined && holder !== null) {
      items.push(
        {
          title: l10n.removeStaleWorktree,
          onClick: () => this.removeWorktreeAction(holder)
        },
        {
          title: l10n.repairWorktree + ELLIPSIS,
          onClick: () => {
            sendMessage({
              command: "repairWorktree",
              repo: this.currentRepo,
              path: holder.path,
              newPath: null
            });
          }
        }
      );
    }
    if (this.staleWorktrees().length > 0) {
      items.push({
        title: l10n.pruneWorktrees + ELLIPSIS,
        onClick: () => this.showPruneWorktreesDialog()
      });
    }
    if (items.length > 0) menu.push(null, ...items);
  }
  private showPushBranchDialog(refName: string) {
    const remoteNames = this.getRemoteNames();
    if (remoteNames.length === 0) return;

    // The defaults depend on what Git knows about the branch, so the dialog opens
    // when that answer arrives (see loadBranchPushDefaults).
    const requestId = this.createRequestId();
    this.pendingPushBranchDialog = { requestId, refName, remoteNames };
    sendMessage({
      command: "branchPushDefaults",
      repo: this.currentRepo,
      branch: refName,
      requestId
    });
  }
  /**
   * Opens the Push Branch dialog from the branch's upstream and push remote. A
   * failed read arrives as two nulls, which keeps today's defaults: the
   * `origin` remote, and Set upstream checked.
   */
  public loadBranchPushDefaults(
    requestId: number,
    defaults: { upstreamRemote: string | null; pushRemote: string | null }
  ) {
    const pending = this.pendingPushBranchDialog;
    if (pending?.requestId !== requestId) return;
    this.pendingPushBranchDialog = null;
    this.openPushBranchDialog(pending.refName, pending.remoteNames, defaults);
  }
  private openPushBranchDialog(
    refName: string,
    remoteNames: string[],
    defaults: { upstreamRemote: string | null; pushRemote: string | null }
  ) {
    const defaultRemote = this.pushBranchDefaultRemote(remoteNames, defaults);
    const inputs: DialogInput[] = [
      ...this.remoteCheckboxInputs(remoteNames, defaultRemote),
      // Git's `-u` changes tracking, so it is pre-checked only for a branch that
      // has no upstream yet: a first push is when tracking is usually wanted.
      {
        type: "checkbox",
        name: l10n.dialogPushBranchSetUpstream,
        value: defaults.upstreamRemote === null
      },
      ...this.pushOptionInputs()
    ];

    showFormDialog(
      l10n.dialogPushBranchConfirm.replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`),
      inputs,
      l10n.dialogPushBranchSubmit,
      (values) => {
        const { remotes, noVerify, mode, afterRemotes } = this.parsePushDialogValues(
          remoteNames,
          inputs,
          values
        );
        if (remotes.length === 0) {
          showErrorDialog(l10n.dialogPushBranchNoRemoteSelected, null, null);
          return;
        }

        sendMessage({
          command: "pushBranch",
          repo: this.currentRepo,
          branchName: refName,
          // The backend sets upstream on the first remote only.
          remotes: afterRemotes ? this.remotesUpstreamFirst(remotes, defaultRemote) : remotes,
          setUpstream: afterRemotes,
          noVerify,
          mode
        });
        showActionRunningDialog(l10n.statusPushingBranch);
      },
      null
    );
  }
  private showUpdateBranchFromUpstreamDialog(refName: string) {
    if (this.otherWorktreePath(refName) !== null) {
      this.openWorktreeAction(refName);
      return;
    }
    showFormDialog(
      l10n.dialogUpdateBranchFromUpstreamConfirm.replace(
        "{0}",
        `<b><i>${escapeHtml(refName)}</i></b>`
      ),
      [{ type: "checkbox", name: l10n.dialogUpdateBranchForce, value: false }],
      l10n.dialogUpdateBranchSubmit,
      (values) => {
        sendMessage({
          command: "updateBranchFromUpstream",
          repo: this.currentRepo,
          branchName: refName,
          force: values[0] === "checked"
        });
        showActionRunningDialog(l10n.statusUpdatingBranch);
      },
      null
    );
  }
  private showDeleteRemoteBranchDialog(remote: string, branchName: string, refName: string) {
    showConfirmationDialog(
      l10n.dialogDeleteRemoteBranchConfirm.replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`),
      () => {
        sendMessage({
          command: "deleteRemoteBranch",
          repo: this.currentRepo,
          branchName,
          remote
        });
        showActionRunningDialog(l10n.statusDeletingRemoteBranch);
      },
      null
    );
  }
  private showFetchIntoLocalBranchDialog(remote: string, branchName: string, refName: string) {
    if (!this.hasLocalBranch(branchName) || this.gitBranchHead === branchName) {
      showErrorDialog(l10n.dialogFetchIntoLocalBranchUnavailable, null, null);
      return;
    }
    if (this.otherWorktreePath(branchName) !== null) {
      this.openWorktreeAction(branchName);
      return;
    }

    showFormDialog(
      l10n.dialogFetchIntoLocalBranchConfirm
        .replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`)
        .replace("{1}", `<b><i>${escapeHtml(branchName)}</i></b>`),
      [{ type: "checkbox", name: l10n.dialogFetchIntoLocalBranchForce, value: false }],
      l10n.dialogFetchIntoLocalBranchSubmit,
      (values) => {
        sendMessage({
          command: "fetchIntoLocalBranch",
          repo: this.currentRepo,
          remote,
          remoteBranch: branchName,
          localBranch: branchName,
          force: values[0] === "checked"
        });
        showActionRunningDialog(l10n.statusFetchingBranch);
      },
      null
    );
  }
  private showPullBranchDialog(remote: string, branchName: string, refName: string) {
    showFormDialog(
      l10n.dialogPullBranchConfirm.replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`),
      [
        {
          type: "checkbox",
          name: l10n.dialogPullBranchNoFastForward,
          value: this.config.pullBranchNoFastForward
        },
        { type: "checkbox", name: l10n.dialogPullBranchSquash, value: false },
        { type: "checkbox", name: l10n.dialogPullBranchNoCommit, value: false },
        { type: "checkbox", name: l10n.dialogBypassGitHooks, value: false }
      ],
      l10n.dialogPullBranchSubmit,
      (values) => {
        sendMessage({
          command: "pullBranch",
          repo: this.currentRepo,
          remote,
          branchName,
          createNewCommit: values[0] === "checked",
          squash: values[1] === "checked",
          noCommit: values[2] === "checked",
          noVerify: values[3] === "checked"
        });
        showActionRunningDialog(l10n.statusPullingBranch);
      },
      null
    );
  }
  private getRemoteNames() {
    return this.gitRemotes.map((remote) => remote.name);
  }
  private defaultPushRemoteName(remoteNames: string[]) {
    return remoteNames.includes("origin") ? "origin" : remoteNames[0];
  }
  /**
   * The remote a Push Branch dialog pre-checks: Git's push remote, then the
   * upstream's remote, when each is one of the repository's remotes, then the
   * usual `origin`-or-first.
   */
  private pushBranchDefaultRemote(
    remoteNames: string[],
    defaults: { upstreamRemote: string | null; pushRemote: string | null }
  ) {
    const known = [defaults.pushRemote, defaults.upstreamRemote].find(
      (remote) => remote !== null && remoteNames.includes(remote)
    );
    return known ?? this.defaultPushRemoteName(remoteNames);
  }
  /**
   * Lists the checked remotes with the one that takes `--set-upstream` first:
   * the pre-checked remote while it stays checked, otherwise the first checked.
   */
  private remotesUpstreamFirst(remotes: string[], defaultRemote: string) {
    const target = remotes.includes(defaultRemote) ? defaultRemote : remotes[0];
    return [target, ...remotes.filter((remote) => remote !== target)];
  }
  private pushBranchModeLabel(mode: GitPushBranchMode) {
    if (mode === "force-with-lease") return l10n.dialogPushBranchModeForceWithLease;
    if (mode === "force") return l10n.dialogPushBranchModeForce;
    return l10n.dialogPushBranchModeNormal;
  }
  private hasLocalBranch(branchName: string) {
    return this.gitBranches.includes(branchName);
  }
  private getRemotesWithBranch(branchName: string) {
    return this.getRemoteNames().filter((remote) =>
      this.gitBranches.includes(`remotes/${remote}/${branchName}`)
    );
  }
  private showMergeBranchDialog(refName: string) {
    showFormDialog(
      l10n.dialogMergeConfirm
        .replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`)
        .replace("{1}", l10n.labelCurrentBranch),
      [
        {
          type: "checkbox",
          name: l10n.dialogMergeNoFastForward,
          value: this.config.mergeNoFastForward
        },
        { type: "checkbox", name: l10n.dialogMergeSquash, value: false },
        { type: "checkbox", name: l10n.dialogMergeNoCommit, value: false },
        { type: "checkbox", name: l10n.dialogBypassGitHooks, value: false }
      ],
      l10n.dialogYesMerge,
      (values) => {
        sendMessage({
          command: "mergeBranch",
          repo: this.currentRepo,
          branchName: refName,
          createNewCommit: values[0] === "checked",
          squash: values[1] === "checked",
          noCommit: values[2] === "checked",
          noVerify: values[3] === "checked"
        });
        showActionRunningDialog(l10n.statusMergingBranch);
      },
      null
    );
  }
  private registerGitRefActivationListeners(root: Document | Element = document) {
    addListenerToClass(
      "gitRef",
      "click",
      (e: Event) => {
        if (closestHTMLElement(e.target, ".gitRef")?.classList.contains("stash")) return;
        e.stopPropagation();
      },
      root
    );
    addListenerToClass(
      "gitRef",
      "dblclick",
      (e: Event) => {
        e.stopPropagation();
        hideDialogAndContextMenu();
        const sourceElem = closestHTMLElement(e.target, ".gitRef");
        const refName = sourceElem?.dataset.name;
        if (sourceElem === null || refName === undefined) return;
        if (sourceElem.classList.contains("stash")) return;
        this.checkoutBranchAction(sourceElem, unescapeHtml(refName));
      },
      root
    );
  }
  private renderTableHeader() {
    return `<tr id="tableColHeaders"><th id="tableHeaderGraphCol" class="tableColHeader">${l10n.graph}</th><th class="tableColHeader">${l10n.description}</th><th class="tableColHeader">${l10n.date}</th><th class="tableColHeader">${l10n.author}</th><th class="tableColHeader">${l10n.commit}</th><th class="tableColHeader signatureCol">${l10n.signature}</th></tr>`;
  }
  private getCurrentDisplayHash() {
    return this.commits.length > 0 && this.commits[0].hash === "*" ? "*" : this.commitHead;
  }
  private renderCommitRow(
    index: number,
    currentHash: string | null,
    findMatchIndexes: Set<number>,
    activeFindCommitIndex: number,
    mutedHeadNonAncestors: Set<string>
  ) {
    const commit = this.commits[index];
    if (commit.stash !== undefined) {
      return this.renderStashGraphRow(
        index,
        commit,
        findMatchIndexes,
        activeFindCommitIndex,
        mutedHeadNonAncestors.has(commit.hash)
      );
    }
    const message = escapeHtml(commit.message);
    const date = getCommitDate(commit.date);
    const isHeadCommit = commit.hash === this.commitHead;
    const rowAttributes = this.renderCommitRowAttributes(
      commit,
      index,
      isHeadCommit,
      findMatchIndexes,
      activeFindCommitIndex,
      mutedHeadNonAncestors.has(commit.hash)
    );
    // The wrapper span is unconditional — the mute styling keys off it. Only the
    // bold weight is opt-in, and it is scoped to the commit message: ref labels
    // keep regular weight whatever this setting says.
    const boldMessage = this.config.boldCheckedOutCommit && commit.hash === currentHash;
    const commitMessage = `<span class="commitMessage">${
      boldMessage ? `<b>${message}</b>` : message
    }</span>`;
    const authorTitle = escapeHtml(`${commit.author} <${commit.email}>`);
    const headDot = isHeadCommit ? '<span class="commitHeadDot"></span>' : "";

    return (
      `<tr ${rowAttributes}` +
      ` data-id="${index}" data-color="${this.graph.getVertexColor(index)}"><td></td><td>` +
      `${headDot}${this.renderCommitRefs(commit)}${this.renderWorktreeHeadRefs(commit)}${commitMessage}` +
      `</td><td title="${date.title}">${date.value}` +
      `</td><td title="${authorTitle}">${this.renderCommitAvatar(commit)}${escapeHtml(commit.author)}` +
      `</td><td title="${escapeHtml(commit.hash)}">${this.displayHash(commit.hash)}` +
      `</td>${this.renderCommitSignatureCell(commit)}</tr>`
    );
  }
  private renderStashGraphRow(
    index: number,
    commit: GitCommitNode,
    findMatchIndexes: Set<number>,
    activeFindCommitIndex: number,
    mutedByHeadAncestry: boolean
  ) {
    // Stash rows are ordinary table rows for layout and find, but they stay
    // out of the commit selection entirely: no "commit" class (so the commit
    // context menu, ctrl+click selection, and compare never attach), a
    // read-only details open on click, and the shared stash menu on
    // right-click. The durable identity is the stash hash; the selector in
    // data-stash-ref is re-resolved by every load, never cached.
    const selector = commit.stash?.ref ?? "";
    const rowClasses = ["stashGraphRow"];
    if (mutedByHeadAncestry) rowClasses.push("mutedCommit");
    if (findMatchIndexes.has(index)) rowClasses.push("findMatch");
    if (activeFindCommitIndex === index) rowClasses.push("findMatchActive");
    const date = getCommitDate(commit.date);
    const escapedHash = escapeHtml(commit.hash);
    const escapedSelector = escapeHtml(selector);
    return (
      `<tr class="${rowClasses.join(" ")}" tabindex="0" aria-selected="false"` +
      ` data-id="${index}" data-hash="${escapedHash}"` +
      ` data-stash-ref="${escapedSelector}" data-stash-hash="${escapedHash}"` +
      ` data-color="${this.graph.getVertexColor(index)}"><td></td><td>` +
      `<span class="gitRef stash" data-name="${escapedSelector}" title="${escapedSelector}" aria-label="${escapedSelector}">${svgIcons.stash}${escapeHtml(selector.replace(/^stash/, ""))}</span>` +
      `<span class="commitMessage">${escapeHtml(commit.message)}</span>` +
      `</td><td title="${date.title}">${date.value}` +
      `</td><td></td><td title="${escapedHash}">${this.displayHash(commit.hash)}` +
      `</td>${this.renderCommitSignatureCell(commit)}</tr>`
    );
  }
  private renderCommitSignatureCell(commit: GitCommitNode) {
    const signature = commit.hash === "*" ? null : commit.signature;
    return `<td class="signatureCol">${this.renderCommitSignature(signature)}</td>`;
  }
  private renderCommitSignature(signature: GitCommitNode["signature"]) {
    if (signature === undefined) {
      return this.renderCommitSignatureStatus("…", "pending", l10n.signatureLoading);
    }
    if (signature === null) {
      return this.renderCommitSignatureStatus("—", "unsigned", l10n.signatureUnsigned);
    }

    const status = COMMIT_SIGNATURE_PRESENTATIONS[signature.status];
    const details = [status.label];
    if (signature.signer !== null) {
      details.push(l10n.signatureSigner.replace("{0}", signature.signer));
    }
    if (signature.key !== null) details.push(l10n.signatureKey.replace("{0}", signature.key));
    return this.renderCommitSignatureStatus(
      status.glyph,
      status.tone,
      details.join("\n"),
      details.join(". ")
    );
  }
  private renderCommitSignatureStatus(
    glyph: string,
    tone: string,
    title: string,
    ariaLabel = title
  ) {
    return `<span class="commitSignature commitSignature-${tone}" role="img" aria-label="${escapeHtml(ariaLabel)}" title="${escapeHtml(title)}">${glyph}</span>`;
  }
  private renderCommitRowAttributes(
    commit: GitCommitNode,
    index: number,
    isHeadCommit: boolean,
    findMatchIndexes: Set<number>,
    activeFindCommitIndex: number,
    mutedByHeadAncestry: boolean
  ) {
    if (commit.hash === "*") {
      return 'class="unsavedChanges" tabindex="0" aria-selected="false" data-hash="*"';
    }

    const currentAttribute = isHeadCommit ? ' aria-current="true"' : "";
    const selectedAttribute = this.selectedCommitHashes.has(commit.hash) ? "true" : "false";
    const rowClasses = ["commit"];
    const isMergeCommit = commit.parentHashes.length > 1;
    if (isMergeCommit) rowClasses.push("mergeCommit");
    if ((isMergeCommit && this.config.muteMergeCommits) || mutedByHeadAncestry) {
      rowClasses.push("mutedCommit");
    }
    if (this.selectedCommitHashes.has(commit.hash)) rowClasses.push("commitSelected");
    if (findMatchIndexes.has(index)) rowClasses.push("findMatch");
    if (activeFindCommitIndex === index) rowClasses.push("findMatchActive");
    return `class="${rowClasses.join(" ")}" tabindex="0" aria-selected="${selectedAttribute}"${currentAttribute} data-hash="${commit.hash}"`;
  }
  private mutedCommitHashesNotInHeadAncestry() {
    const muted = new Set<string>();
    if (!this.config.muteCommitsNotAncestorsOfHead || this.commitHead === null) return muted;
    if (typeof this.commitLookup[this.commitHead] !== "number") return muted;

    const ancestors = new Set<string>();
    const stack = [this.commitHead];
    while (stack.length > 0) {
      const hash = stack.pop();
      if (hash === undefined || ancestors.has(hash)) continue;
      const commit = this.commits[this.commitLookup[hash]];
      if (commit === undefined) continue;
      ancestors.add(hash);
      stack.push(
        ...commit.parentHashes.filter(
          (parentHash) => typeof this.commitLookup[parentHash] === "number"
        )
      );
    }

    for (const commit of this.commits) {
      if (commit.hash !== "*" && !ancestors.has(commit.hash)) muted.add(commit.hash);
    }
    return muted;
  }
  private renderCommitRefs(commit: GitCommitNode) {
    const items = groupCommitRefs(commit.refs, this.getRemoteNames());
    const activeIndex = items.findIndex((item) => {
      const ref = item.kind === "branch-group" ? item.local : item.ref;
      return ref.type === "head" && ref.name === this.gitBranchHead;
    });
    if (activeIndex > 0) items.unshift(items.splice(activeIndex, 1)[0]);

    return items
      .map((item) => {
        if (item.kind === "ref") return this.renderCommitRef(item.ref, item.ref.name, "");
        const active = item.local.name === this.gitBranchHead;
        const label = [item.local.name, ...item.remotes.map(({ ref }) => ref.name)].join(", ");
        const primary = this.renderCommitRef(item.local, item.local.name, " gitRefPrimary");
        const aliases = item.remotes
          .map(({ ref, remote }) => this.renderCommitRef(ref, remote, " gitRefAlias"))
          .join("");
        return (
          `<span class="gitRefGroup${active ? " active" : ""}" role="group" aria-label="${escapeHtml(label)}">` +
          `${primary}${aliases}</span>`
        );
      })
      .join("");
  }
  /**
   * The "HEAD of worktree <folder>" marker (W12) for every other worktree
   * sitting on this commit with a detached HEAD. Deliberately not a
   * `.gitRef`: no ref context menu or double-click checkout may attach to
   * it. The tooltip names the worktree's full path.
   */
  private renderWorktreeHeadRefs(commit: GitCommitNode) {
    const holders = this.gitDetachedWorktreeHeads.get(commit.hash) ?? [];
    return holders
      .map((worktree) => {
        const label = l10n.worktreeHead.replace("{0}", () => worktreeFolderName(worktree.path));
        return (
          `<span class="worktreeHeadRef" title="${escapeHtml(worktree.path)}">` +
          `${svgIcons.closedFolder}${escapeHtml(label)}</span>`
        );
      })
      .join("");
  }
  private renderCommitRef(ref: GitCommitNode["refs"][number], label: string, extraClass: string) {
    const refName = escapeHtml(ref.name);
    const refActive = ref.type === "head" && ref.name === this.gitBranchHead;
    const signed = ref.type === "tag" && ref.signed === true;
    const remoteTag = ref.type === "tag" ? this.getTagRemoteStatus(ref) : null;
    const holders =
      ref.type === "head" ? otherWorktreesHoldingBranch(this.gitWorktrees, ref.name) : [];
    const worktreeText = holders
      .map((worktree) => describeWorktreeCheckout(worktree, l10n))
      .join("; ");
    const title = escapeHtml(
      [ref.name, signed ? l10n.signedTagTooltip : "", worktreeText, remoteTag?.status]
        .filter(Boolean)
        .join(" — ")
    );
    const badge = signed ? `<span class="gitRefSignedBadge">${svgIcons.verified}</span>` : "";
    const worktreeBadge =
      holders.length > 0
        ? `<span class="gitRefWorktreeBadge">${octicon("file-directory", "worktreeIcon")}</span>`
        : "";
    const primary =
      `<span class="gitRef ${ref.type}${refActive ? " active" : ""}${signed ? " signed" : ""}${holders.length > 0 ? " inWorktree" : ""}${extraClass}" data-name="${refName}" title="${title}">` +
      `${this.refIcon(ref.type)}${badge}${worktreeBadge}${escapeHtml(label)}</span>`;
    if (!remoteTag?.remotes.length) return primary;
    const aliases = remoteTag.remotes
      .map(
        (remote) =>
          `<span class="gitRef tag gitRefAlias" data-name="${refName}" title="${title}">${escapeHtml(remote)}</span>`
      )
      .join("");
    return `<span class="gitRefGroup" role="group" aria-label="${title}">${primary}${aliases}</span>`;
  }
  private getTagRemoteStatus(ref: GitCommitNode["refs"][number]) {
    // No remotes, nothing to be "not found on": show no status at all.
    const mode = this.config.showTagRemotes;
    if (mode === "off" || this.gitRemotes.length === 0) return null;
    if (mode === "origin") return this.getOriginTagStatus(ref);
    const result = this.remoteTagsRepo === this.currentRepo ? this.remoteTagsResult : null;
    if (result === null) return null;
    const tag = result.tags[ref.name];
    const known = tag?.hash === ref.hash;
    // A tag the snapshot predates waits for the reply already on its way.
    if (!known && result.error === null && this.remoteTagsRequestId !== null) return null;
    const remotes = known ? tag.remotes : [];
    const unavailable = result.error !== null || result.unavailableRemotes.length > 0 || !known;
    let status = unavailable ? l10n.tagRemotesUnavailable : l10n.tagNotOnRemotes;
    if (remotes.length > 0) {
      // A replacer function: `$&` and friends in a remote's name stay literal.
      status = l10n.tagOnRemotes.replace("{0}", () => remotes.join(", "));
      if (unavailable) status += `. ${l10n.tagRemotesUnavailable}`;
    }
    return { remotes, status };
  }
  /** The single-segment status of the `origin` mode; none without an `origin` remote. */
  private getOriginTagStatus(ref: GitCommitNode["refs"][number]) {
    if (!this.gitRemotes.some((remote) => remote.name === "origin")) return null;
    const result = this.remoteTagsRepo === this.currentRepo ? this.remoteTagsResult : null;
    if (result === null) return null;
    const tag = result.tags[ref.name];
    const known = tag?.hash === ref.hash;
    if (!known && result.error === null && this.remoteTagsRequestId !== null) return null;
    const onOrigin = known && tag.remotes.includes("origin");
    const unavailable = result.error !== null || result.unavailableRemotes.length > 0 || !known;
    if (onOrigin) return { remotes: ["origin"], status: l10n.tagOnOrigin };
    return { remotes: [], status: unavailable ? l10n.tagOriginUnavailable : l10n.tagNotOnOrigin };
  }
  private refIcon(type: GitCommitNode["refs"][number]["type"]) {
    return type === "tag" ? svgIcons.tag : svgIcons.branch;
  }
  private renderCommitAvatar(commit: GitCommitNode) {
    if (!this.config.fetchAvatars) return "";

    const avatarImage = this.avatars[commit.email];
    const imageHtml =
      typeof avatarImage === "string" ? `<img class="avatarImg" src="${avatarImage}">` : "";
    return `<span class="avatar" data-email="${escapeHtml(commit.email)}">${imageHtml}</span>`;
  }
  private renderLoadMoreFooter() {
    const loadMoreHtml = this.moreCommitsAvailable
      ? `<div id="loadMoreCommitsBtn" class="roundedBtn">${l10n.loadMore}</div>`
      : "";
    this.footerElem.innerHTML = loadMoreHtml;

    const loadMoreCommitsBtn = document.getElementById("loadMoreCommitsBtn");
    loadMoreCommitsBtn?.addEventListener("click", () => this.loadMoreCommits(loadMoreCommitsBtn));
  }
  private renderStashSection() {
    // The stash list mounts inside #topBar, between the status strip and the
    // toolbar. It folds away on scroll (CSS, `#topBar.scrolled`), so the
    // toolbar and the table's column headers keep that space.
    //
    // #topBar is measured into --ngg-sticky-top, which the sticky table
    // header offsets itself by. A list that appears, disappears, or changes
    // height therefore changes that offset, and the ResizeObserver on #topBar
    // only reacts on a later frame — long enough for the header to visibly
    // detach. Every path through here publishes the height synchronously
    // instead, the same fix the find widget needed (Phase 12).
    const slot = document.getElementById("stashListSlot");
    if (slot === null) return;
    const stashHtml = this.renderStashList();
    if (slot.innerHTML === stashHtml) return;

    slot.innerHTML = stashHtml;
    this.publishTopBarHeight();
    if (stashHtml === "") return;

    this.registerStashContextMenuListener();
    this.registerStashActivationListeners();
  }
  private clearStashSection() {
    const slot = document.getElementById("stashListSlot");
    if (slot === null || slot.innerHTML === "") return;
    slot.innerHTML = "";
    this.publishTopBarHeight();
  }
  private renderStashList() {
    if (
      !this.getShowStashes() ||
      this.config.stashDisplay === "graph" ||
      this.gitStashes.length === 0
    )
      return "";

    const rows = this.gitStashes
      .map((stash) => {
        const date = stash.date === null ? null : getCommitDate(stash.date);
        const dateHtml =
          date === null ? "" : `<span class="stashDate" title="${date.title}">${date.value}</span>`;
        return (
          `<div class="stashRow" tabindex="0" data-stash-ref="${escapeHtml(
            stash.ref
          )}" data-stash-hash="${escapeHtml(stash.hash)}">` +
          `<span class="stashRef">${escapeHtml(stash.ref)}</span>` +
          `<span class="stashMessage">${escapeHtml(stash.message)}</span>` +
          `${dateHtml}</div>`
        );
      })
      .join("");

    return `<section id="stashList" aria-label="${l10n.labelStashes}"><div class="stashListHeader">${l10n.labelStashes}</div>${rows}</section>`;
  }
  private registerStashContextMenuListener() {
    addListenerToClass("stashRow", "contextmenu", (e: Event) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".stashRow");
      const selector = sourceElem?.dataset.stashRef;
      const hash = sourceElem?.dataset.stashHash;
      if (sourceElem === null || selector === undefined || hash === undefined) return;
      showContextMenu(
        e as MouseEvent,
        this.buildStashContextMenu(unescapeHtml(selector), unescapeHtml(hash), sourceElem),
        sourceElem
      );
    });
  }
  private registerStashActivationListeners() {
    addListenerToClass("stashRow", "keydown", (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
      keyboardEvent.preventDefault();
      const sourceElem = closestHTMLElement(e.target, ".stashRow");
      sourceElem?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });
  }
  private buildStashContextMenu(
    selector: string,
    hash: string,
    sourceElem: HTMLElement
  ): ContextMenuElement[] {
    return [
      this.isContextMenuActionVisible("stash", "apply")
        ? {
            title: l10n.applyStash + ELLIPSIS,
            onClick: () => this.showApplyStashDialog(selector, sourceElem)
          }
        : null,
      this.isContextMenuActionVisible("stash", "createBranch")
        ? {
            title: l10n.branchFromStash + ELLIPSIS,
            onClick: () => this.showBranchFromStashDialog(selector, sourceElem)
          }
        : null,
      this.isContextMenuActionVisible("stash", "pop")
        ? {
            title: l10n.popStash + ELLIPSIS,
            onClick: () => this.showPopStashDialog(selector, sourceElem)
          }
        : null,
      this.isContextMenuActionVisible("stash", "drop")
        ? {
            title: l10n.dropStash + ELLIPSIS,
            onClick: () => this.showDropStashDialog(selector, sourceElem)
          }
        : null,
      null,
      this.isContextMenuActionVisible("stash", "copyName")
        ? {
            title: l10n.copyStashName,
            onClick: () => {
              sendMessage({ command: "copyToClipboard", type: "Stash Name", data: selector });
            }
          }
        : null,
      this.isContextMenuActionVisible("stash", "copyHash")
        ? {
            title: l10n.copyStashHash,
            onClick: () => {
              sendMessage({ command: "copyToClipboard", type: "Stash Hash", data: hash });
            }
          }
        : null
    ];
  }
  private showApplyStashDialog(selector: string, sourceElem: HTMLElement) {
    this.showStashIndexDialog(
      l10n.dialogApplyStashConfirm,
      selector,
      l10n.dialogApplyStashSubmit,
      "applyStash",
      l10n.statusApplyingStash,
      sourceElem
    );
  }
  private showPopStashDialog(selector: string, sourceElem: HTMLElement) {
    this.showStashIndexDialog(
      l10n.dialogPopStashConfirm,
      selector,
      l10n.dialogPopStashSubmit,
      "popStash",
      l10n.statusPoppingStash,
      sourceElem
    );
  }
  private showStashIndexDialog(
    titleTemplate: string,
    selector: string,
    actionName: string,
    command: "applyStash" | "popStash",
    statusText: string,
    sourceElem: HTMLElement
  ) {
    showFormDialog(
      titleTemplate.replace("{0}", `<b><i>${escapeHtml(selector)}</i></b>`),
      [{ type: "checkbox", name: l10n.dialogStashReinstateIndex, value: false }],
      actionName,
      (values) => {
        sendMessage({
          command,
          repo: this.currentRepo,
          selector,
          reinstateIndex: values[0] === "checked"
        });
        showActionRunningDialog(statusText);
      },
      sourceElem
    );
  }
  /**
   * Branch from a stash. This carries the same "Check out" checkbox as the
   * other create-branch dialogs, locked on: `git stash branch` creates *and*
   * checks out the new branch with no way to opt out (verified against git
   * 2.55). Showing the real control in its forced state, with the reason on
   * hover, beats both a silently missing checkbox and a paragraph of prose —
   * the user sees the same row in the same place and learns why it will not
   * move. This is the standing pattern for any forced setting; see the
   * locked-control rule in the styling guide.
   */
  private showBranchFromStashDialog(selector: string, sourceElem: HTMLElement) {
    showFormDialog(
      l10n.dialogBranchFromStashTitle.replace("{0}", `<b><i>${escapeHtml(selector)}</i></b>`),
      [
        { type: "text-ref", name: "", default: "" },
        {
          type: "checkbox" as const,
          name: l10n.dialogCreateBranchCheckout,
          value: true,
          lock: { reason: l10n.dialogBranchFromStashCheckoutLocked }
        }
      ],
      l10n.dialogBranchFromStashSubmit,
      (values) => {
        sendMessage({
          command: "branchFromStash",
          repo: this.currentRepo,
          selector,
          branchName: values[0]
        });
        showActionRunningDialog(l10n.statusCreatingBranch);
      },
      sourceElem
    );
  }
  private showDropStashDialog(selector: string, sourceElem: HTMLElement) {
    showConfirmationDialog(
      l10n.dialogDropStashConfirm.replace("{0}", `<b><i>${escapeHtml(selector)}</i></b>`),
      () => {
        sendMessage({
          command: "dropStash",
          repo: this.currentRepo,
          selector
        });
        showActionRunningDialog(l10n.statusDroppingStash);
      },
      sourceElem
    );
  }
  private loadMoreCommits(loadMoreCommitsBtn: HTMLElement, keepCommitDetails = false) {
    if (loadMoreCommitsBtn.parentElement === null) return;

    loadMoreCommitsBtn.parentElement.innerHTML = `<h2 id="loadingHeader">${svgIcons.loading}${l10n.loading}</h2>`;
    setStatusStrip("loading", l10n.statusLoadingMore);
    this.maxCommits += this.config.loadMoreCommits;
    if (!keepCommitDetails) this.hideCommitDetails();
    this.saveState();
    this.requestLoadCommits(true, () => {});
  }
  private restoreExpandedCommit() {
    if (this.expandedCommit === null) return;

    const elem = this.findExpandedCommitElement(this.expandedCommit.hash);
    if (elem === null) {
      this.expandedCommit = null;
      this.saveState();
      return;
    }

    const id = elem.dataset.id;
    if (id === undefined) return;
    this.expandedCommit.id = Number.parseInt(id, 10);
    this.expandedCommit.srcElem = elem;
    this.saveState();
    if (this.expandedCommit.commitDetails !== null && this.expandedCommit.fileTree !== null) {
      this.showCommitDetails(this.expandedCommit.commitDetails, this.expandedCommit.fileTree);
      return;
    }
    this.loadCommitDetails(elem);
  }
  private registerStashGraphRowListeners() {
    addListenerToClass("stashGraphRow", "click", (e: Event) => {
      const row = closestHTMLElement(e.target, ".stashGraphRow");
      const hash = row?.dataset.hash;
      if (row === null || hash === undefined) return;
      this.clearCommitSelection();
      this.toggleCommitDetails(row, hash);
    });
    addListenerToClass("stashGraphRow", "keydown", (e: Event) => {
      if (!(e instanceof KeyboardEvent) || (e.key !== "Enter" && e.key !== " ")) return;
      const row = closestHTMLElement(e.target, ".stashGraphRow");
      const hash = row?.dataset.hash;
      if (row === null || hash === undefined) return;
      e.preventDefault();
      this.clearCommitSelection();
      this.toggleCommitDetails(row, hash);
    });
    addListenerToClass("stashGraphRow", "contextmenu", (e: Event) => {
      e.stopPropagation();
      const row = closestHTMLElement(e.target, ".stashGraphRow");
      const selector = row?.dataset.stashRef;
      const hash = row?.dataset.hash;
      if (row === null || selector === undefined || hash === undefined) return;
      showContextMenu(e as MouseEvent, this.buildStashContextMenu(selector, hash, row), row);
    });
  }
  /**
   * Finds a rendered row by commit hash, including stash graph rows. Commit
   * selection and compare keep using the commit-only lookup; only reveal,
   * find navigation, details keyboard stepping, and details restore reach
   * stash rows through here.
   */
  private findAnyRowByHash(hash: string): HTMLElement | null {
    const commitRow = this.findCommitRow(hash);
    if (commitRow !== null) return commitRow;
    const stashRows = document.getElementsByClassName(
      "stashGraphRow"
    ) as HTMLCollectionOf<HTMLElement>;
    for (const row of stashRows) {
      if (hash === row.dataset.hash) return row;
    }
    return null;
  }
  private findExpandedCommitElement(hash: string) {
    return this.findAnyRowByHash(hash);
  }
  private renderUncommitedChanges() {
    const date = getCommitDate(this.commits[0].date);
    document.getElementsByClassName("unsavedChanges")[0].innerHTML =
      `<td></td><td><b>${escapeHtml(this.commits[0].message)}</b></td>` +
      `<td title="${date.title}">${date.value}</td><td title="* <>">*</td><td title="*">*</td>` +
      `<td class="signatureCol">${this.renderCommitSignature(null)}</td>`;
  }
  private renderShowLoading(message = l10n.statusLoadingGraph) {
    hideDialogAndContextMenu();
    document.body.classList.remove("unableToLoad");
    this.graph.clear();
    setStatusStrip("loading", message);
    this.tableElem.innerHTML = `<h2 id="loadingHeader">${svgIcons.loading}${l10n.loading}</h2>`;
    this.footerElem.innerHTML = "";
    // The stash list lives in #topBar, so clearing the table or footer does
    // not remove it; clear its slot and republish the sticky offset.
    this.clearStashSection();
  }
  private renderShowError(message: string, reason: string | null) {
    hideDialogAndContextMenu();
    document.body.classList.add("unableToLoad");
    this.graph.clear();
    setStatusStrip("error", l10n.statusError);
    this.tableElem.innerHTML =
      `<h2>${escapeHtml(message)}</h2>` +
      (reason !== null
        ? `<p class="errorReason">${escapeHtml(reason).replaceAll("\n", "<br>")}</p>`
        : "");
    this.footerElem.innerHTML = "";
    // Same as the loading path: the list is outside the table and footer.
    this.clearStashSection();
    failureScreens.show("graphLoadError");
    // Trust, the Git binary or the repository may have changed since the
    // graph opened. Reclassify the failure so startup recovery can take over.
    sendMessage({ command: "loadRepos", check: true });
  }
  private checkoutBranchAction(sourceElem: HTMLElement, refName: string) {
    if (sourceElem.classList.contains("head")) {
      sendMessage({
        command: "checkoutBranch",
        repo: this.currentRepo,
        branchName: refName,
        remoteBranch: null
      });
    } else if (sourceElem.classList.contains("remote")) {
      const remoteNames = this.getRemoteNames();
      const parsedRemote = parseRemoteBranchName(refName, remoteNames);
      // parseRemoteBranchName guesses the first segment as the remote when no
      // known remote matches, so only trust a parse whose remote is known.
      const suggestedName =
        parsedRemote !== null && remoteNames.includes(parsedRemote.remote)
          ? parsedRemote.branchName
          : refName;
      // Before `git checkout -b` can fail with "already exists", an existing
      // local branch — the suggested name, or one tracking this remote branch
      // under another name — gets the choice dialog instead (W24).
      const existing = existingLocalBranchForRemote(
        suggestedName,
        refName,
        this.gitBranches,
        this.gitUpstreams
      );
      if (existing !== null) {
        this.showExistingLocalBranchDialog(existing, refName, suggestedName, null);
        return;
      }
      const sourceName = sourceElem.dataset.name ?? refName;
      showRefInputDialog(
        l10n.dialogCreateBranchTitle.replace("{0}", `<b><i>${escapeHtml(sourceName)}</i></b>`),
        suggestedName,
        l10n.checkoutBranch,
        (newBranch) => {
          // A name edited to one that exists never reaches Git either: it
          // gets the same choices as a collision found up front.
          if (this.hasLocalBranch(newBranch)) {
            this.showExistingLocalBranchDialog(newBranch, refName, suggestedName, null);
            return;
          }
          sendMessage({
            command: "checkoutBranch",
            repo: this.currentRepo,
            branchName: newBranch,
            remoteBranch: refName
          });
        },
        null
      );
      this.bindTakenBranchNameValidation(0);
    }
  }
  /**
   * The choices for checking out a remote branch whose local branch already
   * exists (W24, decision Y14): switch to it, switch and fast-forward it to
   * the clicked remote-tracking ref (`--ff-only`, never a merge), or create a
   * branch with another name. A branch another worktree has checked out
   * cannot be switched to here, so its choices are that worktree (W31) or
   * another name. Decided from the branch, upstream and worktree data
   * already in the webview, never from Git's translated messages.
   */
  private showExistingLocalBranchDialog(
    existing: string,
    remoteRef: string,
    suggestedName: string,
    sourceElem: HTMLElement | null
  ) {
    const worktreePath = this.otherWorktreePath(existing);
    const message = existingBranchMessage(existing, suggestedName, remoteRef, worktreePath);
    const createOther: DialogChoice = {
      label: l10n.dialogCheckoutRemoteCreateOther,
      onClick: () =>
        this.showCheckoutRemoteOtherNameDialog(existing, remoteRef, suggestedName, sourceElem)
    };
    const choices: DialogChoice[] =
      worktreePath !== null
        ? [
            {
              label: l10n.dialogOpenWorktreeSubmit,
              primary: true,
              onClick: () => {
                sendMessage({
                  command: "openWorktree",
                  repo: this.currentRepo,
                  path: worktreePath,
                  newWindow: true
                });
              }
            },
            createOther
          ]
        : [
            {
              label: l10n.dialogCheckoutRemoteSwitch.replace("{0}", () => existing),
              primary: true,
              onClick: () => {
                sendMessage({
                  command: "checkoutBranch",
                  repo: this.currentRepo,
                  branchName: existing,
                  remoteBranch: null
                });
              }
            },
            {
              label: l10n.dialogCheckoutRemoteSwitchAndFastForward
                .replace("{0}", () => existing)
                .replace("{1}", () => remoteRef),
              onClick: () => {
                sendMessage({
                  command: "checkoutAndFastForward",
                  repo: this.currentRepo,
                  branchName: existing,
                  target: remoteRef
                });
              }
            },
            createOther
          ];
    showChoiceDialog(message, choices, sourceElem);
  }
  /**
   * "Create a branch with another name" from the choice dialog above: the
   * same name prompt as a collision-free remote checkout, with the same
   * inline block on a taken name. The suggested name is the collision
   * itself in the same-name case, so only a tracking branch leaves it free
   * to offer as the default.
   */
  private showCheckoutRemoteOtherNameDialog(
    existing: string,
    remoteRef: string,
    suggestedName: string,
    sourceElem: HTMLElement | null
  ) {
    showRefInputDialog(
      l10n.dialogCreateBranchTitle.replace("{0}", `<b><i>${escapeHtml(remoteRef)}</i></b>`),
      existing === suggestedName ? "" : suggestedName,
      l10n.checkoutBranch,
      (newBranch) => {
        if (this.hasLocalBranch(newBranch)) {
          this.showExistingLocalBranchDialog(newBranch, remoteRef, suggestedName, sourceElem);
          return;
        }
        sendMessage({
          command: "checkoutBranch",
          repo: this.currentRepo,
          branchName: newBranch,
          remoteBranch: remoteRef
        });
      },
      sourceElem
    );
    this.bindTakenBranchNameValidation(0);
  }
  /**
   * Inline validation that a name about to be created is free: a taken name
   * puts the dialog in the same `inputInvalid` state as invalid characters,
   * which is what blocks its submit button, with the reason as the button's
   * title. Runs after the form's own state refresh on the same events, so a
   * free name keeps whatever state that refresh chose.
   */
  private bindTakenBranchNameValidation(inputIndex: number) {
    const input = document.getElementById(`dialogInput${inputIndex}`) as HTMLInputElement | null;
    if (input === null) return;
    const validate = () => {
      const name = input.value;
      const action = document.getElementById("dialogAction");
      if (name !== "" && this.hasLocalBranch(name)) {
        dialog.className = "active inputInvalid";
        if (action !== null) action.title = l10n.branchNameTaken.replace("{0}", () => name);
        return;
      }
      // Pasted or picked input fires no keyup, so the form's own refresh may
      // not have run: recompute the same three states it would.
      if (name === "") {
        dialog.className = "active noInput";
      } else if (refInvalid.exec(name) !== null) {
        dialog.className = "active inputInvalid";
        if (action !== null)
          action.title = l10n.invalidCharacters.replace("{0}", l10n.checkoutBranch);
      } else {
        dialog.className = "active";
        if (action !== null) action.title = "";
      }
    };
    input.addEventListener("keyup", validate);
    input.addEventListener("input", validate);
    validate();
  }
  private createArchiveAction(refName: string) {
    sendMessage({
      command: "createArchive",
      repo: this.currentRepo,
      ref: refName
    });
    showActionRunningDialog(l10n.statusCreatingArchive);
  }
  private setTableLayout(layout: "fixedLayout" | "autoLayout") {
    const classes: string[] = [layout];
    for (const column of HIDEABLE_COLUMNS) {
      if (this.hiddenColumns.has(column)) classes.push(COLUMN_HIDE_CLASSES[column]);
    }
    this.tableElem.className = classes.join(" ");
  }
  private toggleColumnVisibility(column: HideableColumn) {
    const wasHidden = this.hiddenColumns.has(column);
    if (wasHidden) {
      this.hiddenColumns.delete(column);
    } else {
      this.hiddenColumns.add(column);
    }
    this.saveState();
    this.renderTable();
    this.renderGraph();
    // Showing the column reads just the missing signatures; the page itself
    // is already loaded and stays on screen while they arrive.
    if (column === "signature" && wasHidden) this.requestMissingSignatures();
  }
  private buildColumnVisibilityMenu(): ContextMenuElement[] {
    const commitOrdering = this.getCommitOrdering();
    const labels: Record<HideableColumn, string> = {
      date: l10n.date,
      author: l10n.author,
      commit: l10n.commit,
      signature: l10n.signature
    };
    const orderingLabels: Record<CommitOrdering, string> = {
      date: l10n.orderCommitDate,
      "author-date": l10n.orderAuthorDate,
      topo: l10n.orderTopological
    };
    const columnItems: ContextMenuElement[] = HIDEABLE_COLUMNS.map((column) => ({
      title: `${this.hiddenColumns.has(column) ? "" : "✓ "}${labels[column]}`,
      onClick: () => this.toggleColumnVisibility(column)
    }));
    const orderingItems: ContextMenuElement[] = COMMIT_ORDERINGS.map((ordering) => ({
      title: `${commitOrdering === ordering ? "✓ " : ""}${orderingLabels[ordering]}`,
      onClick: () => this.setCommitOrdering(ordering)
    }));
    return [
      ...columnItems,
      null,
      ...orderingItems,
      null,
      {
        title: l10n.settingsIncludeUnreachableCommits,
        checked: this.getIncludeUnreachableCommits(),
        onClick: () => this.toggleIncludeUnreachableCommits()
      }
    ];
  }
  private toggleIncludeUnreachableCommits() {
    const nextEnabled = !this.getIncludeUnreachableCommits();
    let nextValue: GGL.RepoBooleanOverride = "default";
    if (nextEnabled !== this.config.includeUnreachableCommits) {
      nextValue = nextEnabled ? "enabled" : "disabled";
    }
    this.setRepoBooleanSetting("includeUnreachableCommits", nextValue);
  }
  private getCommitOrdering(): CommitOrdering {
    return this.gitRepos[this.currentRepo]?.commitOrdering ?? "date";
  }
  private setCommitOrdering(ordering: CommitOrdering) {
    const repoState = this.gitRepos[this.currentRepo];
    if (repoState === undefined || this.getCommitOrdering() === ordering) return;
    repoState.commitOrdering = ordering;
    this.maxCommits = this.config.initialLoadCommits;
    this.saveState();
    sendMessage({
      command: "saveRepoState",
      repo: this.currentRepo,
      state: repoState
    });
    this.renderShowLoading();
    this.requestLoadCommits(true, () => {});
  }
  private registerColumnHeaderMenuListener() {
    addListenerToClass("tableColHeader", "contextmenu", (e: Event) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".tableColHeader");
      if (sourceElem === null) return;
      showContextMenu(e as MouseEvent, this.buildColumnVisibilityMenu(), sourceElem);
    });
  }
  private makeTableResizable() {
    const colHeadersElem = requireElement("tableColHeaders"),
      cols = document.getElementsByClassName("tableColHeader") as HTMLCollectionOf<HTMLElement>;
    let columnWidths = this.gitRepos[this.currentRepo].columnWidths,
      mouseX = -1,
      col = -1;

    if (columnWidths !== null && columnWidths.length !== 5) {
      const fallbackWidths = [64, 120, 124, 72, SIGNATURE_COLUMN_DEFAULT_WIDTH];
      columnWidths = fallbackWidths.map((fallback, index) =>
        Math.max(columnWidths?.[index] ?? fallback, 40)
      );
      this.gitRepos[this.currentRepo].columnWidths = columnWidths;
    }

    const makeTableFixedLayout = () => {
      if (columnWidths !== null) {
        cols[0].style.width = `${columnWidths[0]}px`;
        cols[0].style.padding = "";
        cols[2].style.width = `${columnWidths[1]}px`;
        cols[3].style.width = `${columnWidths[2]}px`;
        cols[4].style.width = `${columnWidths[3]}px`;
        cols[5].style.width = `${columnWidths[4]}px`;
        this.setTableLayout("fixedLayout");
        this.graph.limitMaxWidth(columnWidths[0] + 16);
      }
    };
    const stopResizing = () => {
      if (col > -1 && columnWidths !== null) {
        col = -1;
        mouseX = -1;
        colHeadersElem.classList.remove("resizing");
        this.gitRepos[this.currentRepo].columnWidths = columnWidths;
        sendMessage({
          command: "saveRepoState",
          repo: this.currentRepo,
          state: this.gitRepos[this.currentRepo]
        });
      }
    };

    for (let i = 0; i < cols.length; i++) {
      cols[i].innerHTML +=
        (i > 0 ? `<span class="resizeCol left" data-col="${i - 1}"></span>` : "") +
        (i < cols.length - 1 ? `<span class="resizeCol right" data-col="${i}"></span>` : "");
    }
    if (columnWidths !== null) {
      makeTableFixedLayout();
    } else {
      this.setTableLayout("autoLayout");
      this.graph.limitMaxWidth(-1);
      const padding = Math.round(
        (Math.max(this.graph.getWidth() + 16, 64) - (cols[0].offsetWidth - 24)) / 2
      );
      cols[0].style.padding = `0 ${padding}px`;
    }

    addListenerToClass("resizeCol", "mousedown", (e) => {
      if (!(e.target instanceof HTMLElement) || e.target.dataset.col === undefined) return;
      col = Number.parseInt(e.target.dataset.col, 10);
      mouseX = (e as MouseEvent).clientX;
      if (columnWidths === null) {
        columnWidths = [
          cols[0].clientWidth - 24,
          cols[2].clientWidth - 24,
          cols[3].clientWidth - 24,
          cols[4].clientWidth - 24,
          Math.max(cols[5].clientWidth - 24, SIGNATURE_COLUMN_DEFAULT_WIDTH)
        ];
        makeTableFixedLayout();
      }
      colHeadersElem.classList.add("resizing");
    });
    colHeadersElem.addEventListener("mousemove", (e) => {
      if (col > -1 && columnWidths !== null) {
        this.resizeTableColumn(col, e.clientX - mouseX, columnWidths, cols);
        mouseX = e.clientX;
      }
    });
    colHeadersElem.addEventListener("mouseup", stopResizing);
    colHeadersElem.addEventListener("mouseleave", stopResizing);
  }
  private resizeTableColumn(
    col: number,
    requestedDelta: number,
    columnWidths: number[],
    cols: HTMLCollectionOf<HTMLElement>
  ) {
    const mouseDeltaX = this.clampTableResizeDelta(col, requestedDelta, columnWidths, cols);
    if (col === 0) {
      columnWidths[0] += mouseDeltaX;
      cols[0].style.width = `${columnWidths[0]}px`;
      this.graph.limitMaxWidth(columnWidths[0] + 16);
      return;
    }
    if (col === 1) {
      columnWidths[1] -= mouseDeltaX;
      cols[2].style.width = `${columnWidths[1]}px`;
      return;
    }

    columnWidths[col - 1] += mouseDeltaX;
    columnWidths[col] -= mouseDeltaX;
    cols[col].style.width = `${columnWidths[col - 1]}px`;
    cols[col + 1].style.width = `${columnWidths[col]}px`;
  }
  private clampTableResizeDelta(
    col: number,
    requestedDelta: number,
    columnWidths: number[],
    cols: HTMLCollectionOf<HTMLElement>
  ) {
    let mouseDeltaX = requestedDelta;
    if (col === 0) {
      if (columnWidths[0] + mouseDeltaX < 40) mouseDeltaX = -columnWidths[0] + 40;
      if (cols[1].clientWidth - mouseDeltaX < 64) mouseDeltaX = cols[1].clientWidth - 64;
      return mouseDeltaX;
    }
    if (col === 1) {
      if (cols[1].clientWidth + mouseDeltaX < 64) mouseDeltaX = -cols[1].clientWidth + 64;
      if (columnWidths[1] - mouseDeltaX < 40) mouseDeltaX = columnWidths[1] - 40;
      return mouseDeltaX;
    }

    if (columnWidths[col - 1] + mouseDeltaX < 40) mouseDeltaX = -columnWidths[col - 1] + 40;
    if (columnWidths[col] - mouseDeltaX < 40) mouseDeltaX = columnWidths[col] - 40;
    return mouseDeltaX;
  }

  /* Observers */
  private observeWindowSizeChanges() {
    let windowWidth = window.outerWidth,
      windowHeight = window.outerHeight;
    window.addEventListener("resize", () => {
      if (windowWidth === window.outerWidth && windowHeight === window.outerHeight) {
        this.renderGraph();
      } else {
        windowWidth = window.outerWidth;
        windowHeight = window.outerHeight;
      }
    });
  }
  private observeWebviewScroll() {
    let active = window.scrollY > 0;
    this.topBarElem.classList.toggle("scrolled", active);
    document.addEventListener("scroll", () => {
      if (active !== window.scrollY > 0) {
        active = window.scrollY > 0;
        this.topBarElem.classList.toggle("scrolled", active);
        // Publish in the same frame as the class change so the sticky table
        // header and the top bar move together without a seam.
        this.publishTopBarHeight();
      }
      this.autoLoadMoreCommitsOnScroll();
    });
  }
  private publishTopBarHeight() {
    document.documentElement.style.setProperty(
      "--ngg-sticky-top",
      `${this.topBarElem.offsetHeight}px`
    );
  }
  private observeTopBarHeight() {
    this.publishTopBarHeight();
    // Covers toolbar wrap/unwrap on window resizes and font-size changes.
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(() => this.publishTopBarHeight()).observe(this.topBarElem);
    } else {
      window.addEventListener("resize", () => this.publishTopBarHeight());
    }
  }
  private getStickyOverlayHeight() {
    const colHeadersElem = document.getElementById("tableColHeaders");
    return this.topBarElem.offsetHeight + (colHeadersElem?.clientHeight ?? 0);
  }
  private autoLoadMoreCommitsOnScroll() {
    if (!this.moreCommitsAvailable) return;
    const loadMoreCommitsBtn = document.getElementById("loadMoreCommitsBtn");
    if (loadMoreCommitsBtn === null) return;
    if (window.innerHeight + window.scrollY < document.body.scrollHeight - 96) return;
    this.loadMoreCommits(loadMoreCommitsBtn, true);
  }

  /* Commit Details */
  private toggleCommitDetails(sourceElem: HTMLElement, hash: string) {
    if (this.expandedCommit !== null && this.expandedCommit.hash === hash) {
      this.hideCommitDetails();
    } else {
      this.loadCommitDetails(sourceElem);
    }
  }
  private loadCommitDetails(sourceElem: HTMLElement) {
    const id = sourceElem.dataset.id;
    const hash = sourceElem.dataset.hash;
    if (id === undefined || hash === undefined) return;

    this.hideCommitDetails();
    this.hideUncommittedDetails();
    this.expandedCommit = {
      id: Number.parseInt(id, 10),
      hash: hash,
      srcElem: sourceElem,
      commitDetails: null,
      fileTree: null,
      comparison: null,
      detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT,
      summaryOpen: true,
      filesOpen: true
    };
    this.saveState();
    sendMessage({
      command: "commitDetails",
      repo: this.currentRepo,
      commitHash: hash
    });
  }
  private loadCommitComparisonWithHead(sourceElem: HTMLElement, hash: string, baseLabel?: string) {
    if (this.canCompareWithHead(hash)) {
      this.loadCommitComparison(sourceElem, hash, hash, "HEAD", {
        baseLabel,
        compareLabel: "HEAD"
      });
    }
  }
  private loadCommitComparisonWithWorkingTree(sourceElem: HTMLElement, hash: string) {
    // "*" is the uncommitted sentinel; as a compare ref it names the
    // working tree, whose header label the comparison then shows.
    this.loadCommitComparison(sourceElem, hash, hash, "*", {
      compareLabel: l10n.workingTree
    });
  }
  private loadCommitComparison(
    sourceElem: HTMLElement,
    hash: string,
    baseRef: string,
    compareRef: string,
    labels: Pick<CommitComparison, "baseLabel" | "compareLabel"> = {}
  ) {
    const row = this.getCommitRowForElement(sourceElem);
    const id = row?.dataset.id;
    if (row === null || id === undefined) return;

    this.hideCommitDetails();
    this.hideUncommittedDetails();
    this.expandedCommit = {
      id: Number.parseInt(id, 10),
      hash,
      srcElem: row,
      commitDetails: null,
      fileTree: null,
      comparison: { baseRef, compareRef, ...labels },
      detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT,
      summaryOpen: true,
      filesOpen: true
    };
    this.saveState();
    sendMessage({
      command: "commitComparison",
      repo: this.currentRepo,
      commitHash: hash,
      baseRef,
      compareRef
    });
  }
  public hideCommitDetails() {
    if (this.expandedCommit !== null) {
      const elem = document.getElementById("commitDetails");
      if (typeof elem === "object" && elem !== null) elem.remove();
      if (typeof this.expandedCommit.srcElem === "object" && this.expandedCommit.srcElem !== null) {
        this.expandedCommit.srcElem.classList.remove("commitDetailsOpen");
        this.expandedCommit.srcElem.setAttribute("aria-selected", "false");
      }
      this.expandedCommit = null;
      this.saveState();
      this.renderGraph();
    }
  }
  /* Uncommitted Details */
  /*
   * The staging panel is the commit details row wearing a different face: it
   * is inserted as the same `#commitDetails` element with an extra
   * `uncommittedDetails` class, and its two panes take the summary and files
   * pane ids. That reuse is deliberate — collapse styling, the resize handle,
   * the height clamp and the graph's row-height math all key off those ids,
   * so the panel inherits them instead of duplicating them. The consequence
   * to respect: only one of the two panels can be open at a time, which is
   * why every entry point hides the other one first.
   */
  private registerUncommittedActivationListeners() {
    addListenerToClass("unsavedChanges", "click", (e: Event) => {
      const sourceElem = closestHTMLElement(e.target, ".unsavedChanges");
      if (sourceElem === null) return;
      this.toggleUncommittedDetails(sourceElem);
    });
    addListenerToClass("unsavedChanges", "keydown", (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
      const sourceElem = closestHTMLElement(e.target, ".unsavedChanges");
      if (sourceElem === null) return;
      keyboardEvent.preventDefault();
      this.toggleUncommittedDetails(sourceElem);
    });
  }
  private toggleUncommittedDetails(sourceElem: HTMLElement) {
    if (this.uncommittedView !== null) {
      this.hideUncommittedDetails();
    } else {
      this.loadUncommittedDetails(sourceElem);
    }
  }
  private loadUncommittedDetails(sourceElem: HTMLElement) {
    this.hideCommitDetails();
    this.hideUncommittedDetails();
    this.uncommittedView = {
      srcElem: sourceElem,
      stagedOpen: true,
      unstagedOpen: true,
      detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT,
      collapsedFolders: { staged: new Set(), unstaged: new Set() }
    };
    sendMessage({ command: "uncommittedDetails", repo: this.currentRepo });
  }
  public hideUncommittedDetails() {
    if (this.uncommittedView === null) return;
    const elem = document.getElementById("commitDetails");
    if (typeof elem === "object" && elem !== null) elem.remove();
    if (typeof this.uncommittedView.srcElem === "object" && this.uncommittedView.srcElem !== null) {
      this.uncommittedView.srcElem.classList.remove("commitDetailsOpen");
      this.uncommittedView.srcElem.setAttribute("aria-selected", "false");
    }
    this.uncommittedView = null;
    this.renderGraph();
  }
  public showUncommittedDetails(changes: GitUncommittedChanges) {
    const view = this.uncommittedView;
    if (view === null) return;
    const row = document.querySelector("tr.unsavedChanges") as HTMLElement | null;
    if (row === null) {
      view.srcElem = null;
      return;
    }
    view.srcElem = row;
    const elem = document.getElementById("commitDetails");
    if (typeof elem === "object" && elem !== null) elem.remove();

    row.classList.add("commitDetailsOpen");
    row.setAttribute("aria-selected", "true");

    const newElem = document.createElement("tr");
    newElem.id = "commitDetails";
    newElem.classList.add("uncommittedDetails");
    newElem.classList.toggle("summaryCollapsed", !view.stagedOpen);
    newElem.classList.toggle("filesCollapsed", !view.unstagedOpen);
    newElem.innerHTML = renderUncommittedDetailsRowHtml({
      changes,
      l10n,
      sections: {
        stagedOpen: view.stagedOpen,
        unstagedOpen: view.unstagedOpen,
        collapsedFolders: {
          staged: [...view.collapsedFolders.staged],
          unstaged: [...view.collapsedFolders.unstaged]
        }
      },
      detailsHeight: view.detailsHeight,
      compactFolders: this.config.commitDetailsCompactFolders,
      fileViewMode: this.config.uncommittedFileViewMode
    });
    insertAfter(newElem, row);
    this.applyCommitDetailsHeight(newElem);
    this.registerUncommittedPanelListeners(newElem);
    this.renderGraph();
    document
      .getElementById("commitDetailsResizeHandle")
      ?.addEventListener("mousedown", (e) => this.startCommitDetailsResize(e));
    document
      .getElementById("commitDetailsResizeHandle")
      ?.addEventListener("keydown", (e) => this.resizeCommitDetailsFromKeyboard(e));
  }
  /**
   * Re-open the panel after the table was rebuilt, keeping its pane and height
   * state. Every render replaces the rows, and a staging action is followed by
   * a refresh, so this is also what makes the panes show the result of the
   * `git add`/`git reset` that was just run: the data is re-queried rather
   * than patched in place. The row can be gone entirely (the working tree came
   * out clean), and then the panel is simply closed.
   */
  private restoreUncommittedDetails() {
    if (this.uncommittedView === null) return;
    if (document.querySelector("tr.unsavedChanges") === null) {
      this.uncommittedView = null;
      return;
    }
    sendMessage({ command: "uncommittedDetails", repo: this.currentRepo });
  }
  private registerUncommittedPanelListeners(panel: HTMLElement) {
    this.registerUncommittedFolderListeners(panel);
    panel.querySelectorAll(".uncommittedToggle").forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        const section = (e.currentTarget as HTMLElement).dataset.section;
        if (!isUncommittedSection(section) || this.uncommittedView === null) return;
        const open =
          section === "staged"
            ? this.uncommittedView.stagedOpen
            : this.uncommittedView.unstagedOpen;
        this.setUncommittedSectionOpen(section, !open);
      });
    });
    panel.querySelectorAll(".uncommittedFile").forEach((item) => {
      item.addEventListener("dragstart", (e) => this.startUncommittedFileDrag(e));
    });
    panel.querySelectorAll(".uncommittedMoveFile").forEach((button) => {
      button.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        const section = target.dataset.section;
        const filePath = target.dataset.filepath;
        if (!isUncommittedSection(section) || filePath === undefined) return;
        this.moveUncommittedPaths(section, section === "staged" ? "unstaged" : "staged", [
          filePath
        ]);
      });
    });
    panel.querySelectorAll(".uncommittedPane").forEach((zone) => {
      zone.addEventListener("dragover", (e) => this.allowUncommittedFileDrop(e));
      zone.addEventListener("dragleave", (e) => {
        const zoneElem = e.currentTarget as HTMLElement;
        const next = (e as DragEvent).relatedTarget;
        if (next instanceof Node && zoneElem.contains(next)) return;
        zoneElem.classList.remove("dropTarget");
      });
      zone.addEventListener("drop", (e) => this.dropUncommittedFile(e));
    });
  }
  private setUncommittedSectionOpen(section: UncommittedSection, open: boolean) {
    if (this.uncommittedView === null) return;
    if (section === "staged") {
      this.uncommittedView.stagedOpen = open;
    } else {
      this.uncommittedView.unstagedOpen = open;
    }
    const elem = document.getElementById("commitDetails");
    if (elem === null) return;
    elem.classList.toggle("summaryCollapsed", !this.uncommittedView.stagedOpen);
    elem.classList.toggle("filesCollapsed", !this.uncommittedView.unstagedOpen);
    this.updateUncommittedToggle("staged", this.uncommittedView.stagedOpen);
    this.updateUncommittedToggle("unstaged", this.uncommittedView.unstagedOpen);
    this.renderGraph();
  }
  private updateUncommittedToggle(section: UncommittedSection, open: boolean) {
    const toggle = document.getElementById(
      section === "staged" ? "uncommittedStagedToggle" : "uncommittedUnstagedToggle"
    ) as HTMLButtonElement | null;
    const body = document.getElementById(
      section === "staged" ? "commitDetailsSummaryBody" : "commitDetailsFilesBody"
    );
    if (toggle === null || body === null) return;
    const label = getSectionToggleLabel(
      open,
      section === "staged" ? l10n.detailCollapseStaged : l10n.detailCollapseUnstaged,
      section === "staged" ? l10n.detailExpandStaged : l10n.detailExpandUnstaged
    );
    toggle.setAttribute("aria-expanded", open.toString());
    toggle.setAttribute("aria-label", label);
    toggle.querySelector(".commitDetailsToggleGlyph")?.replaceChildren(open ? "-" : "+");
    body.classList.toggle("hidden", !open);
  }
  /**
   * Folder rows in the staging panes: draggable as a whole subtree, and
   * collapsible. Collapse state is keyed by folder path in the view state
   * rather than held in the DOM, because every staging action re-queries and
   * re-renders the panel — DOM-held state would reopen every folder on each
   * drop.
   */
  private registerUncommittedFolderListeners(panel: HTMLElement) {
    panel.querySelectorAll(".uncommittedFolder").forEach((folder) => {
      folder.addEventListener("dragstart", (e) => {
        // A file row inside this folder is also draggable; let its own
        // handler win rather than dragging the whole subtree.
        if (e.target !== e.currentTarget) return;
        this.startUncommittedFileDrag(e);
      });
    });
    panel.querySelectorAll(".uncommittedFolderHeader").forEach((header) => {
      header.addEventListener("click", (e) => this.toggleUncommittedFolder(e));
      header.addEventListener("keydown", (e) => {
        const key = (e as KeyboardEvent).key;
        if (key !== "Enter" && key !== " ") return;
        e.preventDefault();
        this.toggleUncommittedFolder(e);
      });
    });
  }
  /**
   * Flip the staging panel between the folder tree and the flat path list.
   * The choice is a global setting rather than view state, so it survives a
   * reload and shows up in the settings hub; the echo back through
   * `applyExtensionSettings()` is what re-renders the open panel.
   */
  private toggleUncommittedFileViewMode() {
    const next = this.config.uncommittedFileViewMode === "tree" ? "list" : "tree";
    this.config.uncommittedFileViewMode = next;
    this.updateExtensionSetting("uncommittedChanges.fileViewMode", next);
    if (this.uncommittedView !== null) {
      sendMessage({ command: "uncommittedDetails", repo: this.currentRepo });
    }
  }
  private toggleUncommittedFolder(e: Event) {
    e.stopPropagation();
    const row = closestHTMLElement(e.target, ".uncommittedFolder");
    const view = this.uncommittedView;
    if (row === null || view === null) return;
    const section = row.dataset.section;
    const encoded = row.dataset.folderpath;
    if (!isUncommittedSection(section) || encoded === undefined) return;

    const path = decodeURIComponent(encoded);
    const collapsed = view.collapsedFolders[section];
    const open = !collapsed.has(path);
    if (open) collapsed.add(path);
    else collapsed.delete(path);

    // Toggle in place: re-rendering the panel would need another round trip
    // for the change list, and the row heights feed the graph's expansion.
    row.classList.toggle("closed", open);
    row.querySelector(".uncommittedFolderHeader")?.setAttribute("aria-expanded", String(!open));
    const glyph = row.querySelector(".uncommittedFolderGlyph");
    if (glyph !== null) glyph.textContent = open ? "+" : "-";
    row.querySelector(".gitFolderContents")?.classList.toggle("hidden", open);
    this.renderGraph();
  }
  /**
   * Start a file drag, carrying `"<section> <uri-encoded path>"` as the drag
   * payload. The space separator is safe only because the path is
   * percent-encoded by the renderer — a real worktree path may contain spaces
   * (or a newline), and `dropUncommittedFile()` splits on a space. Encode both
   * ends together if this payload ever changes shape.
   */
  private startUncommittedFileDrag(e: Event) {
    const item = e.currentTarget as HTMLElement;
    const transfer = (e as DragEvent).dataTransfer;
    if (transfer === null) return;
    if (item.dataset.filepath === undefined && item.dataset.paths === undefined) return;
    transfer.effectAllowed = "move";
    // A folder row carries its whole subtree; a file row carries one path.
    const paths = item.dataset.paths ?? item.dataset.filepath ?? "";
    transfer.setData("text/plain", `${item.dataset.section ?? ""} ${paths}`);
    item.classList.add("dragging");
    item.addEventListener(
      "dragend",
      () => {
        item.classList.remove("dragging");
        item
          .closest("#commitDetails")
          ?.querySelectorAll(".dropTarget")
          .forEach((zone) => {
            zone.classList.remove("dropTarget");
          });
      },
      { once: true }
    );
  }
  private allowUncommittedFileDrop(e: Event) {
    e.preventDefault();
    const transfer = (e as DragEvent).dataTransfer;
    if (transfer !== null) transfer.dropEffect = "move";
    (e.currentTarget as HTMLElement).classList.add("dropTarget");
  }
  /**
   * Handle a drop on a pane. The dragged payload decides the source section,
   * so a drag that started outside the panel (or any text dropped in from
   * elsewhere) fails the two-field check and is ignored rather than turned
   * into a git command.
   */
  private dropUncommittedFile(e: Event) {
    e.preventDefault();
    const zone = e.currentTarget as HTMLElement;
    zone.classList.remove("dropTarget");
    const transfer = (e as DragEvent).dataTransfer;
    const target = zone.dataset.section;
    if (transfer === null || !isUncommittedSection(target)) return;
    const payload = transfer.getData("text/plain").split(" ");
    // `<section> <path>...`: one path for a file, every descendant for a
    // folder. Anything shorter than two fields, or with an unknown section,
    // is text dropped in from outside the panel and is ignored.
    if (payload.length < 2 || !isUncommittedSection(payload[0])) return;
    this.moveUncommittedPaths(payload[0], target, payload.slice(1));
  }
  private moveUncommittedPaths(
    source: UncommittedSection,
    target: UncommittedSection,
    encodedPaths: readonly string[]
  ) {
    const action = getStagingDropAction(source, target);
    if (action === null) return;
    const filePaths = encodedPaths
      .filter((encoded) => encoded !== "")
      .map((encoded) => decodeURIComponent(encoded));
    if (filePaths.length === 0) return;
    sendMessage({
      command: action,
      repo: this.currentRepo,
      filePaths
    });
    showActionRunningDialog(
      action === "stageFiles" ? l10n.statusStagingFiles : l10n.statusUnstagingFiles
    );
  }
  public showCommitDetails(commitDetails: GitCommitDetails, fileTree: GitFolder) {
    const expandedCommit = this.expandedCommit;
    const expandedRow = expandedCommit?.srcElem;
    if (
      expandedRow === null ||
      expandedRow === undefined ||
      expandedCommit?.hash !== commitDetails.hash
    )
      return;
    const elem = document.getElementById("commitDetails");
    if (typeof elem === "object" && elem !== null) elem.remove();

    expandedCommit.commitDetails = commitDetails;
    expandedCommit.fileTree = fileTree;
    expandedRow.classList.add("commitDetailsOpen");
    expandedRow.setAttribute("aria-selected", "true");
    this.saveState();

    const newElem = document.createElement("tr");
    newElem.id = "commitDetails";
    const rowColor = expandedRow.dataset.color;
    if (rowColor !== undefined) newElem.dataset.color = rowColor;
    this.applyCommitDetailsSectionClasses(newElem);
    this.applyCommitDetailsHeight(newElem);
    newElem.innerHTML = renderCommitDetailsRowHtml({
      commitDetails,
      fileTree,
      avatars: this.avatars,
      fileView: {
        mode: this.config.commitDetailsFileViewMode
      },
      l10n,
      sections: expandedCommit,
      issueLinking: this.getCurrentRepoState()?.issueLinking ?? null,
      comparison: this.comparisonDisplayLabels(expandedCommit.comparison)
    });
    insertAfter(newElem, expandedRow);
    this.updateCommitDetailsResizeHandle();

    this.renderGraph();

    const detailsHeight = this.getCommitDetailsRenderedHeight();
    // The top bar and column headers overlay the top of the viewport, so the
    // usable region starts below the sticky overlay.
    const stickyOverlay = this.getStickyOverlayHeight();
    if (this.config.autoCenterCommitDetailsView) {
      window.scrollTo(
        0,
        newElem.offsetTop +
          40 +
          (detailsHeight + this.config.graphRowHeight) / 2 -
          (window.innerHeight + stickyOverlay) / 2
      );
    } else if (newElem.offsetTop - stickyOverlay - 8 < window.pageYOffset) {
      window.scrollTo(0, newElem.offsetTop - stickyOverlay - 8);
    } else if (newElem.offsetTop + detailsHeight - window.innerHeight + 48 > window.pageYOffset) {
      window.scrollTo(0, newElem.offsetTop + detailsHeight - window.innerHeight + 48);
    }

    document
      .getElementById("commitDetailsResizeHandle")
      ?.addEventListener("mousedown", (e) => this.startCommitDetailsResize(e));
    document
      .getElementById("commitDetailsResizeHandle")
      ?.addEventListener("keydown", (e) => this.resizeCommitDetailsFromKeyboard(e));
    addListenerToClass("commitDetailsToggle", "click", (e) => {
      const sourceElem = closestHTMLElement(e.target, ".commitDetailsToggle");
      const section = sourceElem?.dataset.section;
      if (sourceElem === null || this.expandedCommit === null || !isCommitDetailsSection(section)) {
        return;
      }

      const open = sourceElem.getAttribute("aria-expanded") !== "true";
      this.setCommitDetailsSectionOpen(section, open);
    });
    addListenerToClass("commitDetailsComparisonSwapButton", "click", () => {
      this.swapCommitComparison();
    });
    addListenerToClass("commitDetailsComparisonExternalDiff", "click", () => {
      this.openComparisonInExternalDiffTool();
    });
    addListenerToClass("gitFolder", "click", (e) => {
      const sourceElem = closestHTMLElement(e.target, ".gitFolder");
      const parent = sourceElem?.parentElement;
      const folderPath = sourceElem?.dataset.folderpath;
      if (
        sourceElem === null ||
        parent === null ||
        parent === undefined ||
        folderPath === undefined ||
        this.expandedCommit?.fileTree === null ||
        this.expandedCommit === null
      ) {
        return;
      }
      parent.classList.toggle("closed");
      const isOpen = !parent.classList.contains("closed");
      parent.children[0].children[0].innerHTML = isOpen
        ? svgIcons.openFolder
        : svgIcons.closedFolder;
      parent.children[1].classList.toggle("hidden");
      alterGitFileTree(this.expandedCommit.fileTree, decodeURIComponent(folderPath), isOpen);
      this.saveState();
    });
    addListenerToClass("gitFileCopyPath", "click", (e) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".gitFileCopyPath");
      const filePath = sourceElem?.dataset.filepath;
      if (filePath === undefined) return;
      sendMessage({
        command: "copyToClipboard",
        type: "File Path",
        data: decodeURIComponent(filePath)
      });
    });
    addListenerToClass("gitFileOpenFile", "click", (e) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".gitFileOpenFile");
      const filePath = sourceElem?.dataset.filepath;
      if (filePath === undefined) return;
      sendMessage({
        command: "openFile",
        repo: this.currentRepo,
        filePath: decodeURIComponent(filePath)
      });
    });
    addListenerToClass("gitFile", "click", (e) => {
      const sourceElem = closestHTMLElement(e.target, ".gitFile");
      if (this.expandedCommit === null || !sourceElem?.classList.contains("gitDiffPossible")) {
        return;
      }
      const fileChange = this.getExpandedCommitFileChange(sourceElem.dataset.fileindex);
      if (fileChange !== null) this.viewGitFileDiff(fileChange);
    });
    addListenerToClass("gitFile", "contextmenu", (e) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".gitFile");
      const fileChange = this.getExpandedCommitFileChange(sourceElem?.dataset.fileindex);
      if (sourceElem === null || fileChange === null) return;
      showContextMenu(
        e as MouseEvent,
        this.buildGitFileContextMenu(fileChange, sourceElem),
        sourceElem
      );
    });
  }

  private getExpandedCommitFileChange(index: string | undefined): GitFileChange | null {
    const commitDetails = this.expandedCommit?.commitDetails;
    if (commitDetails === null || commitDetails === undefined || index === undefined) return null;
    const fileIndex = Number.parseInt(index, 10);
    if (!Number.isInteger(fileIndex)) return null;
    return commitDetails.fileChanges[fileIndex] ?? null;
  }

  // Null counts mean a binary file: no diff of either kind, as for a plain
  // click (`gitDiffPossible` in the details view).
  private pushFileDiffItems(menu: ContextMenuElement[], fileChange: GitFileChange) {
    if (fileChange.additions === null || fileChange.deletions === null) return;
    if (this.isContextMenuActionVisible("commitDetailsViewFile", "viewDiff")) {
      menu.push({
        title: l10n.viewFileDiff,
        onClick: () => this.viewGitFileDiff(fileChange)
      });
    }
    if (this.isContextMenuActionVisible("commitDetailsViewFile", "openDiffTab")) {
      menu.push({
        title: l10n.openInGglDiff,
        onClick: () => this.openGitFileInDiffTab(fileChange)
      });
    }
  }

  private buildGitFileContextMenu(
    fileChange: GitFileChange,
    sourceElem: HTMLElement
  ): ContextMenuElement[] {
    const menu: ContextMenuElement[] = [];
    const revisionFileExists = this.gitFileExistsAtRevision(fileChange);

    this.pushFileDiffItems(menu, fileChange);

    if (revisionFileExists) {
      menu.push(
        this.isContextMenuActionVisible("commitDetailsViewFile", "viewFileAtRevision")
          ? {
              title: l10n.viewFileAtRevision,
              onClick: () => this.viewGitFileAtRevision(fileChange)
            }
          : null,
        this.isContextMenuActionVisible("commitDetailsViewFile", "compareWithWorkingTree")
          ? {
              title: l10n.compareFileWithWorkingTree,
              onClick: () => this.compareGitFileWithWorkingTree(fileChange)
            }
          : null
      );
    }

    if (
      fileChange.type !== "D" &&
      this.isContextMenuActionVisible("commitDetailsViewFile", "openFile")
    ) {
      menu.push({
        title: l10n.openFile,
        onClick: () => this.openWorkingFile(fileChange.newFilePath)
      });
    }

    if (
      revisionFileExists &&
      this.isContextMenuActionVisible("commitDetailsViewFile", "resetFileToRevision")
    ) {
      menu.push(null, {
        title: l10n.resetFileToRevision + ELLIPSIS,
        onClick: () => this.showResetFileToRevisionDialog(fileChange, sourceElem)
      });
    }

    if (menu.length > 0) menu.push(null);
    menu.push(
      this.isContextMenuActionVisible("commitDetailsViewFile", "copyAbsoluteFilePath")
        ? {
            title: l10n.copyAbsoluteFilePath,
            onClick: () =>
              this.copyFilePathToClipboard(this.absoluteFilePathForRepo(fileChange.newFilePath))
          }
        : null,
      this.isContextMenuActionVisible("commitDetailsViewFile", "copyRelativeFilePath")
        ? {
            title: l10n.copyRelativeFilePath,
            onClick: () => this.copyFilePathToClipboard(fileChange.newFilePath)
          }
        : null
    );

    return menu;
  }

  private gitFileExistsAtRevision(fileChange: GitFileChange) {
    if (this.expandedCommit?.comparison !== null && this.expandedCommit?.comparison !== undefined) {
      return this.expandedCommit.hash !== "*";
    }
    return (
      this.expandedCommit !== null && this.expandedCommit.hash !== "*" && fileChange.type !== "D"
    );
  }

  private swapCommitComparison() {
    const expanded = this.expandedCommit;
    const comparison = expanded?.comparison;
    const srcElem = expanded?.srcElem;
    if (
      expanded === null ||
      comparison === null ||
      comparison === undefined ||
      srcElem === null ||
      srcElem === undefined
    ) {
      return;
    }
    const {
      baseRef: swappedCompareRef,
      compareRef: swappedBaseRef,
      baseLabel: swappedCompareLabel,
      compareLabel: swappedBaseLabel
    } = comparison;
    this.loadCommitComparison(srcElem, expanded.hash, swappedBaseRef, swappedCompareRef, {
      baseLabel: swappedBaseLabel,
      compareLabel: swappedCompareLabel
    });
  }

  private openComparisonInExternalDiffTool() {
    const comparison = this.expandedCommit?.comparison;
    if (comparison === null || comparison === undefined) return;
    // The refs, never their labels: a label is display text (a picked name
    // or "Working Tree"), while the backend resolves refs to hashes.
    sendMessage({
      command: "openExternalDirDiff",
      repo: this.currentRepo,
      baseRef: comparison.baseRef,
      compareRef: comparison.compareRef
    });
  }

  private comparisonDisplayLabels(
    comparison: CommitComparison | null
  ): CommitComparisonDisplay | null {
    if (comparison === null) return null;
    return {
      base: comparison.baseLabel ?? this.displayHash(comparison.baseRef),
      compare: comparison.compareLabel ?? this.displayHash(comparison.compareRef)
    };
  }

  private getExpandedFileRevision(fileChange: GitFileChange): string | null {
    if (this.expandedCommit === null) return null;
    if (this.expandedCommit.comparison === null) return this.expandedCommit.hash;
    return fileChange.type === "D"
      ? this.expandedCommit.comparison.baseRef
      : this.expandedCommit.comparison.compareRef;
  }

  private viewGitFileDiff(fileChange: GitFileChange) {
    this.sendFileDiffMessage("viewDiff", fileChange);
  }

  private openGitFileInDiffTab(fileChange: GitFileChange) {
    this.sendFileDiffMessage("openDiffTab", fileChange);
  }

  // One builder for both diff surfaces, so "Open in GGL Diff" always opens
  // the same two revisions "View Diff" would (comparison labels as refs,
  // "*" for the working tree, "<hash>^3" for a stashed untracked file).
  private sendFileDiffMessage(command: "viewDiff" | "openDiffTab", fileChange: GitFileChange) {
    if (this.expandedCommit === null) return;
    const comparison = this.expandedCommit.comparison;
    const hash = this.expandedCommit.hash;
    // A stashed untracked file lives only in the stash's third parent, so
    // its new side reads from there instead of the stash commit itself.
    const untrackedRefs =
      comparison === null && fileChange.untracked === true
        ? { oldRef: `${hash}^`, newRef: `${hash}^3` }
        : null;
    sendMessage({
      command,
      repo: this.currentRepo,
      commitHash: hash,
      ...(comparison === null
        ? (untrackedRefs ?? {})
        : {
            // A label is the ref name the user picked, so it resolves to the
            // same side (as `HEAD` already does) and names the diff title.
            // The working tree's label is display text, not a ref, so its
            // "*" side travels as itself and the handler titles it.
            oldRef: comparison.baseRef === "*" ? "*" : (comparison.baseLabel ?? comparison.baseRef),
            newRef:
              comparison.compareRef === "*"
                ? "*"
                : (comparison.compareLabel ?? comparison.compareRef)
          }),
      oldFilePath: fileChange.oldFilePath,
      newFilePath: fileChange.newFilePath,
      type: fileChange.type
    });
  }

  private viewGitFileAtRevision(fileChange: GitFileChange) {
    const revision = this.getExpandedFileRevision(fileChange);
    if (revision === null || this.expandedCommit === null) return;
    const commitHash =
      fileChange.untracked === true && this.expandedCommit.comparison === null
        ? `${this.expandedCommit.hash}^3`
        : revision;
    sendMessage({
      command: "viewFileAtRevision",
      repo: this.currentRepo,
      commitHash,
      filePath: fileChange.newFilePath
    });
  }

  private compareGitFileWithWorkingTree(fileChange: GitFileChange) {
    const commitHash = this.getExpandedFileRevision(fileChange);
    if (commitHash === null) return;
    sendMessage({
      command: "compareFileWithWorkingTree",
      repo: this.currentRepo,
      commitHash,
      filePath: fileChange.newFilePath
    });
  }

  private openWorkingFile(filePath: string) {
    sendMessage({
      command: "openFile",
      repo: this.currentRepo,
      filePath
    });
  }

  private showResetFileToRevisionDialog(fileChange: GitFileChange, sourceElem: HTMLElement) {
    const commitHash = this.getExpandedFileRevision(fileChange);
    if (commitHash === null) return;
    const filePath = fileChange.newFilePath;
    showConfirmationDialog(
      l10n.dialogResetFileToRevisionConfirm
        .replace("{0}", escapeHtml(filePath))
        .replace("{1}", abbrevCommit(commitHash, this.config.shortHashLength)),
      () => {
        sendMessage({
          command: "resetFileToRevision",
          repo: this.currentRepo,
          commitHash,
          filePath
        });
        showActionRunningDialog(l10n.statusResettingFileToRevision);
      },
      sourceElem
    );
  }

  private copyFilePathToClipboard(filePath: string) {
    sendMessage({
      command: "copyToClipboard",
      type: "File Path",
      data: filePath
    });
  }

  private absoluteFilePathForRepo(filePath: string) {
    const separator =
      this.currentRepo.includes("\\") && !this.currentRepo.includes("/") ? "\\" : "/";
    return `${trimRepoTrailingSeparators(this.currentRepo)}${separator}${filePath
      .split("/")
      .join(separator)}`;
  }

  private setCommitDetailsSectionOpen(section: CommitDetailsSection, open: boolean) {
    if (this.expandedCommit === null) return;
    if (section === "summary") {
      this.expandedCommit.summaryOpen = open;
    } else {
      this.expandedCommit.filesOpen = open;
    }

    const elem = document.getElementById("commitDetails");
    if (elem !== null) {
      this.applyCommitDetailsSectionClasses(elem);
      this.applyCommitDetailsHeight(elem);
      this.updateCommitDetailsToggle("summary", this.expandedCommit.summaryOpen);
      this.updateCommitDetailsToggle("files", this.expandedCommit.filesOpen);
    }
    this.saveState();
    this.renderGraph();
  }

  private applyCommitDetailsSectionClasses(elem: HTMLElement) {
    if (this.expandedCommit === null) return;
    elem.classList.toggle("summaryCollapsed", !this.expandedCommit.summaryOpen);
    elem.classList.toggle("filesCollapsed", !this.expandedCommit.filesOpen);
  }

  /**
   * Whichever details panel is open owns the shared height, so the resize
   * handle drives one of them without caring which. At most one is ever open
   * (see the uncommitted-details note above), so the `??` is a selection, not
   * a precedence rule.
   */
  private detailsHeightOwner(): { detailsHeight: number } | null {
    return this.expandedCommit ?? this.uncommittedView;
  }

  private getCommitDetailsRenderedHeight() {
    const owner = this.detailsHeightOwner();
    if (owner === null) return COMMIT_DETAILS_DEFAULT_HEIGHT;
    if (this.expandedCommit !== null) {
      if (!this.expandedCommit.summaryOpen && !this.expandedCommit.filesOpen) {
        return COMMIT_DETAILS_COLLAPSED_HEIGHT;
      }
    } else if (
      this.uncommittedView !== null &&
      !this.uncommittedView.stagedOpen &&
      !this.uncommittedView.unstagedOpen
    ) {
      return COMMIT_DETAILS_COLLAPSED_HEIGHT;
    }
    return clampCommitDetailsHeight(owner.detailsHeight);
  }

  private applyCommitDetailsHeight(elem: HTMLElement) {
    elem.style.height = `${this.getCommitDetailsRenderedHeight()}px`;
    this.updateCommitDetailsResizeHandle();
  }

  private updateCommitDetailsResizeHandle() {
    const owner = this.detailsHeightOwner();
    if (owner === null) return;
    document
      .getElementById("commitDetailsResizeHandle")
      ?.setAttribute("aria-valuenow", clampCommitDetailsHeight(owner.detailsHeight).toString());
  }

  private setCommitDetailsHeight(height: number, save = true) {
    const owner = this.detailsHeightOwner();
    if (owner === null) return;
    owner.detailsHeight = clampCommitDetailsHeight(height);
    const elem = document.getElementById("commitDetails");
    if (elem !== null) this.applyCommitDetailsHeight(elem);
    if (save) this.saveState();
    this.renderGraph();
  }

  private startCommitDetailsResize(event: MouseEvent) {
    const owner = this.detailsHeightOwner();
    if (event.button !== 0 || owner === null) return;
    const startY = event.clientY;
    const startHeight = clampCommitDetailsHeight(owner.detailsHeight);
    const resize = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      this.setCommitDetailsHeight(startHeight + moveEvent.clientY - startY, false);
    };
    const stop = () => {
      document.body.classList.remove("commitDetailsResizing");
      document.removeEventListener("mousemove", resize);
      if (this.detailsHeightOwner() !== null) this.saveState();
    };

    event.preventDefault();
    document.body.classList.add("commitDetailsResizing");
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stop, { once: true });
  }

  private resizeCommitDetailsFromKeyboard(event: KeyboardEvent) {
    const owner = this.detailsHeightOwner();
    if (owner === null) return;
    const currentHeight = clampCommitDetailsHeight(owner.detailsHeight);
    let nextHeight: number;
    switch (event.key) {
      case "ArrowDown":
        nextHeight = currentHeight + COMMIT_DETAILS_KEYBOARD_RESIZE_STEP;
        break;
      case "ArrowUp":
        nextHeight = currentHeight - COMMIT_DETAILS_KEYBOARD_RESIZE_STEP;
        break;
      case "PageDown":
        nextHeight = currentHeight + COMMIT_DETAILS_KEYBOARD_RESIZE_STEP * 5;
        break;
      case "PageUp":
        nextHeight = currentHeight - COMMIT_DETAILS_KEYBOARD_RESIZE_STEP * 5;
        break;
      case "End":
        nextHeight = COMMIT_DETAILS_MAX_HEIGHT;
        break;
      case "Home":
        nextHeight = COMMIT_DETAILS_MIN_HEIGHT;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.setCommitDetailsHeight(nextHeight);
  }

  private updateCommitDetailsToggle(section: CommitDetailsSection, open: boolean) {
    const capitalizedSection = section === "summary" ? "Summary" : "Files";
    const toggle = document.getElementById(
      `commitDetails${capitalizedSection}Toggle`
    ) as HTMLButtonElement | null;
    const body = document.getElementById(`commitDetails${capitalizedSection}Body`);
    if (toggle === null || body === null) return;

    const label =
      section === "summary"
        ? getSectionToggleLabel(open, l10n.detailCollapseSummary, l10n.detailExpandSummary)
        : getSectionToggleLabel(open, l10n.detailCollapseFiles, l10n.detailExpandFiles);
    toggle.setAttribute("aria-expanded", open.toString());
    toggle.setAttribute("aria-label", label);
    toggle.querySelector(".commitDetailsToggleGlyph")?.replaceChildren(open ? "-" : "+");
    body.classList.toggle("hidden", !open);
  }
}

function isCommitDetailsSection(section: string | undefined): section is CommitDetailsSection {
  return section === "summary" || section === "files";
}

function getSectionToggleLabel(open: boolean, collapseLabel: string, expandLabel: string): string {
  return open ? collapseLabel : expandLabel;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isDialogActive(): boolean {
  return dialog.classList.contains("active");
}

function isContextMenuActive(): boolean {
  return contextMenu.classList.contains("active");
}

const contextMenu = requireElement("contextMenu");
let contextMenuSource: HTMLElement | null = null;
const dialog = requireElement("dialog");
const dialogBacking = requireElement("dialogBacking");
let dialogMenuSource: HTMLElement | null = null;
const restoredState = vscode.getState();
const gitGraph = new GitGraphView(
  viewState.repos,
  viewState.lastActiveRepo,
  {
    autoCenterCommitDetailsView: viewState.autoCenterCommitDetailsView,
    commitDetailsCompactFolders: viewState.commitDetailsCompactFolders,
    commitDetailsFileViewMode: viewState.commitDetailsFileViewMode,
    uncommittedFileViewMode: viewState.uncommittedFileViewMode,
    contextMenuActionsVisibility: viewState.contextMenuActionsVisibility,
    fetchAvatars: viewState.fetchAvatars,
    showSignatureColumn: viewState.showSignatureColumn,
    graphColors: viewState.graphColors,
    customBranchGlobPatterns: viewState.customBranchGlobPatterns,
    graphFontSize: viewState.graphFontSize,
    graphRowHeight: viewState.graphRowHeight,
    graphStyle: viewState.graphStyle,
    revealHighlightColor: viewState.revealHighlightColor,
    grid: { x: 16, y: viewState.graphRowHeight, offsetX: 8, offsetY: 12, expandY: 250 },
    includeReflog: viewState.includeReflog,
    includeUnreachableCommits: viewState.includeUnreachableCommits,
    initialLoadCommits: viewState.initialLoadCommits,
    loadMoreCommits: viewState.loadMoreCommits,
    muteCommitsNotAncestorsOfHead: viewState.muteCommitsNotAncestorsOfHead,
    muteMergeCommits: viewState.muteMergeCommits,
    boldCheckedOutCommit: viewState.boldCheckedOutCommit,
    fetchTagsByDefault: viewState.fetchTagsByDefault,
    showTagRemotes: parseTagRemotesMode(viewState.showTagRemotes),
    worktreePathTemplate: normalizeWorktreePathTemplate(viewState.worktreePathTemplate),
    mergeNoFastForward: viewState.mergeNoFastForward,
    pullBranchNoFastForward: viewState.pullBranchNoFastForward,
    createBranchCheckout: viewState.createBranchCheckout,
    onlyFollowFirstParent: viewState.onlyFollowFirstParent,
    showCurrentBranchByDefault: viewState.showCurrentBranchByDefault,
    showRemoteBranches: viewState.showRemoteBranches,
    showStashes: viewState.showStashes,
    stashDisplay: viewState.stashDisplay ?? "both",
    showTags: viewState.showTags,
    shortHashLength: viewState.shortHashLength
  },
  restoredState && "gitRepos" in restoredState ? restoredState : null
);
const actionErrorLabels = {
  addRemote: l10n.unableToAddRemote,
  addTag: l10n.unableToAddTag,
  applyStash: l10n.unableToApplyStash,
  branchFromStash: l10n.unableToBranchFromStash,
  checkoutBranch: l10n.unableToCheckoutBranch,
  checkoutAndFastForward: l10n.unableToCheckoutAndFastForward,
  checkoutCommit: l10n.unableToCheckoutCommit,
  cherrypickCommit: l10n.unableToCherryPick,
  cleanUntrackedFiles: l10n.unableToCleanUntracked,
  createBranch: l10n.unableToCreateBranch,
  createPullRequest: l10n.unableToCreatePullRequest,
  deleteBranch: l10n.unableToDeleteBranch,
  pruneWorktrees: l10n.unableToPruneWorktrees,
  lockWorktree: l10n.unableToLockWorktree,
  unlockWorktree: l10n.unableToUnlockWorktree,
  moveWorktree: l10n.unableToMoveWorktree,
  removeWorktree: l10n.unableToRemoveWorktree,
  repairWorktree: l10n.unableToRepairWorktree,
  openWorktree: l10n.unableToOpenWorktree,
  addWorktreeToWorkspace: l10n.unableToAddWorktreeToWorkspace,
  revealWorktree: l10n.unableToRevealWorktree,
  switchGraphToWorktree: l10n.unableToSwitchGraphToWorktree,
  deleteRemote: l10n.unableToDeleteRemote,
  deleteRemoteBranch: l10n.unableToDeleteRemoteBranch,
  deleteTag: l10n.unableToDeleteTag,
  deleteUserDetails: l10n.unableToDeleteUserDetails,
  dropCommit: l10n.unableToDropCommit,
  dropCommitSelection: l10n.unableToDropSelection,
  dropStash: l10n.unableToDropStash,
  editHeadCommitMessage: l10n.unableToEditMessage,
  editRemote: l10n.unableToEditRemote,
  editUserDetails: l10n.unableToEditUserDetails,
  exportRepoConfig: l10n.unableToExportRepoConfig,
  fetchIntoLocalBranch: l10n.unableToFetchBranch,
  fetchRemotes: l10n.unableToFetch,
  fetchTags: l10n.unableToFetchTags,
  mergeBranch: l10n.unableToMergeBranch,
  mergeCommit: l10n.unableToMergeCommit,
  popStash: l10n.unableToPopStash,
  pullBranch: l10n.unableToPullBranch,
  pruneRemote: l10n.unableToPruneRemote,
  pushBranch: l10n.unableToPushBranch,
  pushStash: l10n.unableToPushStash,
  pushTag: l10n.unableToPushTag,
  pushAllTags: l10n.unableToPushAllTags,
  renameBranch: l10n.unableToRenameBranch,
  resetFileToRevision: l10n.unableToResetFileToRevision,
  resetUncommittedChanges: l10n.unableToResetUncommitted,
  stageFiles: l10n.unableToStageFiles,
  resetToCommit: l10n.unableToReset,
  rebaseCurrentBranch: l10n.unableToRebase,
  revertCommit: l10n.unableToRevert,
  squashCommitSelection: l10n.unableToSquashSelection,
  undoLastCommit: l10n.unableToUndoLastCommit,
  unstageFiles: l10n.unableToUnstageFiles,
  updateBranchFromUpstream: l10n.unableToUpdateBranch
} satisfies Partial<Record<GGL.ResponseMessage["command"], string>>;

function handleActionResponse(msg: GGL.ResponseMessage) {
  if (msg.command === "addWorktree") {
    gitGraph.finishCreateWorktree(msg.status);
    return true;
  }
  if (msg.command === "importRepoConfig") {
    if (msg.status === null && msg.state !== null) gitGraph.replaceRepoState(msg.repo, msg.state);
    refreshGraphOrDisplayError(msg.status, l10n.unableToImportRepoConfig);
    return true;
  }
  if (msg.command === "updateExtensionSetting") {
    gitGraph.acceptExtensionSettingsUpdate(
      msg.settings,
      msg.status,
      l10n.unableToUpdateExtensionSetting,
      [msg.key]
    );
    return true;
  }
  if (msg.command === "exportExtensionSettings") {
    handleExtensionSettingsFileResponse(msg.status, l10n.unableToExportExtensionSettings);
    return true;
  }
  if (msg.command === "importExtensionSettings") {
    gitGraph.acceptExtensionSettingsUpdate(
      msg.settings,
      msg.status,
      l10n.unableToImportExtensionSettings,
      msg.importedKeys
    );
    return true;
  }

  const errorLabel = actionErrorLabels[msg.command as keyof typeof actionErrorLabels];
  if (errorLabel === undefined || !("status" in msg)) return false;
  refreshGraphOrDisplayError(msg.status, errorLabel);
  return true;
}

/* Command Processing */
type ResponseHandlerMap = {
  [Command in GGL.ResponseMessage["command"]]?: (
    msg: Extract<GGL.ResponseMessage, { command: Command }>
  ) => void;
};

const responseHandlers: ResponseHandlerMap = {
  remoteTags: (msg) => gitGraph.loadRemoteTags(msg),
  worktreeChanges: (msg) => gitGraph.loadWorktreeChanges(msg),
  worktreeStatus: (msg) => gitGraph.loadWorktreeStatus(msg),
  branchPushDefaults: (msg) =>
    gitGraph.loadBranchPushDefaults(msg.requestId, {
      upstreamRemote: msg.upstreamRemote,
      pushRemote: msg.pushRemote
    }),
  commitComparison: handleCommitComparisonResponse,
  commitDetails: handleCommitDetailsResponse,
  commitSignatures: (msg) =>
    gitGraph.loadCommitSignatures(
      msg.requestId,
      msg.repo,
      msg.signatures,
      msg.error === null ? null : formatQueryError(msg.error)
    ),
  componentStatus: (msg) => applyComponentStatus(msg.components),
  copyToClipboard: handleCopyToClipboardResponse,
  createArchive: handleCreateArchiveResponse,
  fetchAvatar: (msg) => gitGraph.loadAvatar(msg.email, msg.image),
  loadBranches: (msg) =>
    gitGraph.loadBranches(
      msg.requestId,
      msg.branches,
      msg.head,
      msg.hard,
      msg.isRepo,
      msg.worktrees,
      msg.upstreams,
      formatQueryError(msg.error)
    ),
  loadCommits: (msg) =>
    gitGraph.loadCommits(
      msg.requestId,
      msg.commits,
      msg.head,
      msg.moreCommitsAvailable,
      msg.hard,
      formatQueryError(msg.error)
    ),
  loadRepoInfo: (msg) => gitGraph.loadRepoInfo(msg.requestId, msg.repoInfo),
  loadExtensionSettings: (msg) =>
    gitGraph.loadExtensionSettings(msg.requestId, msg.settings, msg.status),
  loadRepos: (msg) => gitGraph.loadRepos(msg.repos, msg.lastActiveRepo, msg.layout),
  compareFileWithWorkingTree: (msg) =>
    handleSuccessFlagResponse(msg, l10n.unableToCompareFileWithWorkingTree),
  openExternalDirDiff: handleExternalDirDiffResponse,
  openExternalUrl: (msg) => handleSuccessFlagResponse(msg, l10n.unableToOpenExternalUrl),
  openFile: (msg) => handleSuccessFlagResponse(msg, l10n.unableToOpenFile),
  openSourceControl: (msg) => handleSuccessFlagResponse(msg, l10n.unableToOpenSourceControl),
  refresh: () => gitGraph.refresh(false),
  pickFolder: (msg) => finishFolderPick(msg),
  resolveRef: (msg) =>
    gitGraph.loadResolvedComparison(msg.requestId, msg.hash, formatQueryError(msg.error)),
  searchCommits: (msg) =>
    gitGraph.loadSearchCommitResults(msg.requestId, msg.results, formatQueryError(msg.error)),
  startHistorySearch: () => gitGraph.startHistorySearch(),
  showPruneWorktrees: () => gitGraph.showPruneWorktrees(),
  tagDetails: handleTagDetailsResponse,
  uncommittedDetails: handleUncommittedDetailsResponse,
  openDiffTab: (msg) => handleSuccessFlagResponse(msg, l10n.unableToViewDiff),
  viewDiff: (msg) => handleSuccessFlagResponse(msg, l10n.unableToViewDiff),
  viewFileAtRevision: (msg) => handleSuccessFlagResponse(msg, l10n.unableToViewFileAtRevision)
};

window.addEventListener("message", handleMessageEvent);
initComponentStatus(() => sendMessage({ command: "componentStatus" }));

function handleMessageEvent(event: MessageEvent) {
  if (event.origin !== globalThis.location.origin) return;
  handleResponseMessage(event.data as GGL.ResponseMessage);
}

function handleResponseMessage(msg: GGL.ResponseMessage) {
  if (handleActionResponse(msg)) return;
  const handler = responseHandlers[msg.command] as ((msg: GGL.ResponseMessage) => void) | undefined;
  handler?.(msg);
}

function handleCommitDetailsResponse(
  msg: Extract<GGL.ResponseMessage, { command: "commitDetails" }>
) {
  if (msg.commitDetails === null) {
    gitGraph.hideCommitDetails();
    showErrorDialog(l10n.unableToLoadCommitDetails, formatQueryError(msg.error), null);
    return;
  }

  gitGraph.showCommitDetails(
    msg.commitDetails,
    generateGitFileTree(msg.commitDetails.fileChanges, {
      compactFolders: viewState.commitDetailsCompactFolders
    })
  );
}

function handleUncommittedDetailsResponse(
  msg: Extract<GGL.ResponseMessage, { command: "uncommittedDetails" }>
) {
  if (msg.changes === null) {
    gitGraph.hideUncommittedDetails();
    showErrorDialog(l10n.unableToLoadUncommittedDetails, formatQueryError(msg.error), null);
    return;
  }

  gitGraph.showUncommittedDetails(msg.changes);
}

function handleCommitComparisonResponse(
  msg: Extract<GGL.ResponseMessage, { command: "commitComparison" }>
) {
  if (msg.commitDetails === null) {
    gitGraph.hideCommitDetails();
    showErrorDialog(l10n.unableToLoadCommitComparison, formatQueryError(msg.error), null);
    return;
  }

  gitGraph.showCommitDetails(
    msg.commitDetails,
    generateGitFileTree(msg.commitDetails.fileChanges, {
      compactFolders: viewState.commitDetailsCompactFolders
    })
  );
}

function handleTagDetailsResponse(msg: Extract<GGL.ResponseMessage, { command: "tagDetails" }>) {
  if (msg.tagDetails === null) {
    showErrorDialog(l10n.unableToLoadTagDetails, formatQueryError(msg.error), null);
    setStatusStrip("error", l10n.unableToLoadTagDetails);
    return;
  }

  gitGraph.showTagDetails(msg.tagDetails);
}

function handleCopyToClipboardResponse(
  msg: Extract<GGL.ResponseMessage, { command: "copyToClipboard" }>
) {
  if (msg.success !== false) return;
  const typeLabel: Record<string, string> = {
    "Commit Hash": l10n.typeCommitHash,
    "Commit Subject": l10n.typeCommitSubject,
    "Tag Name": l10n.typeTagName,
    "Tag Hash": l10n.typeTagHash,
    "Tag Message": l10n.typeTagMessage,
    "Branch Name": l10n.typeBranchName,
    "Stash Name": l10n.typeStashName,
    "Stash Hash": l10n.typeStashHash,
    "File Path": l10n.typeFilePath
  };
  showErrorDialog(
    l10n.unableToCopyToClipboard.replace("{0}", typeLabel[msg.type] ?? msg.type),
    null,
    null
  );
}

function handleCreateArchiveResponse(
  msg: Extract<GGL.ResponseMessage, { command: "createArchive" }>
) {
  if (msg.status === null) {
    hideDialog();
    setStatusStrip("ready", l10n.statusReady);
    return;
  }

  showErrorDialog(l10n.unableToCreateArchive, msg.status, null);
  setStatusStrip("error", l10n.unableToCreateArchive);
}

function handleExternalDirDiffResponse(
  msg: Extract<GGL.ResponseMessage, { command: "openExternalDirDiff" }>
) {
  if (!msg.configured) {
    showDialog(
      dialogTitleHtml(escapeHtml(l10n.externalDiffToolNotConfigured)),
      null,
      l10n.dialogDismiss,
      null,
      null
    );
  } else if (msg.success === false) {
    showErrorDialog(l10n.unableToOpenExternalDiffTool, null, null);
  }
}
function handleSuccessFlagResponse(msg: { success: boolean }, errorMessage: string) {
  if (msg.success === false) showErrorDialog(errorMessage, null, null);
}
function handleExtensionSettingsFileResponse(status: string | null, errorMessage: string) {
  if (status === null) {
    hideDialog();
    setStatusStrip("ready", l10n.statusReady);
    return;
  }

  setStatusStrip("error", errorMessage);
  showErrorDialog(errorMessage, status, null);
}
function refreshGraphOrDisplayError(status: GitCommandStatus, errorMessage: string) {
  if (status === null) {
    gitGraph.refresh(true);
  } else {
    setStatusStrip("error", errorMessage);
    showErrorDialog(errorMessage, status, null);
  }
}

/* Dates */
function getCommitDate(dateVal: number) {
  const date = new Date(dateVal * 1000);
  let value: string;

  const dateStr = l10n.timeDateFormat
    .replace("DD", String(date.getDate()))
    .replace(
      "MM",
      l10n.timeNeedFormatMonth === "true"
        ? getMonth()[date.getMonth()]
        : String(date.getMonth() + 1)
    )
    .replace("YYYY", String(date.getFullYear()));
  const timeStr = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  switch (viewState.dateFormat) {
    case "Date Only":
      value = dateStr;
      break;
    case "Relative":
      value = formatRelativeDate(date, new Date(), l10n.locale);
      break;
    default:
      value = `${dateStr} ${timeStr}`;
  }
  return { title: `${dateStr} ${timeStr}`, value: value };
}

/* Context Menu */

/**
 * Presentational only: the header carries no `data-index`, so the click
 * handler in `showContextMenu()` can never match it.
 */
function renderContextMenuHeader(header: ContextMenuHeader | undefined): string {
  if (header === undefined) return "";
  const caption =
    header.caption === undefined
      ? ""
      : `<span class="contextMenuHeaderCaption">${escapeHtml(header.caption)}</span>`;
  return (
    `<li class="contextMenuHeader" role="presentation">` +
    `<span class="contextMenuHeaderTitle">${escapeHtml(header.title)}</span>${caption}</li>`
  );
}

function renderContextMenuItem(item: ContextMenuItem, index: number): string {
  const isCheckbox = item.checked !== undefined;
  const checkboxClass = isCheckbox ? " contextMenuItemCheckbox" : "";
  const checkboxAttributes = isCheckbox
    ? ` role="menuitemcheckbox" aria-checked="${item.checked === true}"`
    : ' role="menuitem"';
  const checkmark = item.checked === true ? "✓" : "";
  const checkbox = isCheckbox
    ? `<span class="contextMenuCheck" aria-hidden="true">${checkmark}</span>`
    : "";
  return `<li class="contextMenuItem${checkboxClass}" data-index="${index}"${checkboxAttributes}>${checkbox}${item.title}</li>`;
}

function renderContextMenuItems(visibleItems: ContextMenuElement[]): string {
  return visibleItems
    .map((item, index) =>
      item === null
        ? '<li class="contextMenuDivider" role="separator"></li>'
        : renderContextMenuItem(item, index)
    )
    .join("");
}

function showContextMenu(
  event: MouseEvent,
  items: ContextMenuElement[],
  sourceElem: HTMLElement,
  header?: ContextMenuHeader
) {
  event.preventDefault();
  const visibleItems = normalizeContextMenuItems(items);
  if (visibleItems.length === 0) {
    hideContextMenu();
    return;
  }

  const html = renderContextMenuHeader(header) + renderContextMenuItems(visibleItems);

  hideContextMenuListener();
  contextMenu.style.opacity = "0";
  contextMenu.className = "active";
  contextMenu.style.maxHeight = `${window.innerHeight}px`;
  contextMenu.innerHTML = html;
  const bounds = contextMenu.getBoundingClientRect();
  contextMenu.style.left = `${
    event.pageX - window.pageXOffset + bounds.width < window.innerWidth
      ? event.pageX - 2
      : event.pageX - bounds.width + 2
  }px`;
  const clientY = event.pageY - window.pageYOffset;
  const preferredTop =
    clientY - 2 + bounds.height < window.innerHeight ? clientY - 2 : clientY - bounds.height + 2;
  contextMenu.style.top = `${Math.max(0, preferredTop) + window.pageYOffset}px`;
  contextMenu.style.opacity = "1";

  addListenerToClass("contextMenuItem", "click", (ev) => {
    ev.stopPropagation();
    hideContextMenu();
    if (
      !(ev.currentTarget instanceof HTMLElement) ||
      ev.currentTarget.dataset.index === undefined
    ) {
      return;
    }
    visibleItems[Number.parseInt(ev.currentTarget.dataset.index, 10)]?.onClick();
  });

  contextMenuSource = sourceElem;
  contextMenuSource.classList.add("contextMenuActive");
}
function normalizeContextMenuItems(items: ContextMenuElement[]) {
  const visibleItems: ContextMenuElement[] = [];
  let dividerPending = false;

  for (const item of items) {
    if (item === null) {
      dividerPending = visibleItems.length > 0;
      continue;
    }

    if (dividerPending) {
      visibleItems.push(null);
      dividerPending = false;
    }
    visibleItems.push(item);
  }

  return visibleItems;
}
function hideContextMenu() {
  contextMenu.className = "";
  contextMenu.innerHTML = "";
  contextMenu.style.left = "0px";
  contextMenu.style.top = "0px";
  contextMenu.style.maxHeight = "";
  if (contextMenuSource !== null) {
    contextMenuSource.classList.remove("contextMenuActive");
    contextMenuSource = null;
  }
}

/* Dialogs */
/**
 * Wrap a dialog's opening line as its title.
 *
 * Every popup goes through this, so the step in size and the space below it
 * are identical in all of them. The bottom margin is applied by CSS only when
 * something follows, so a message-only dialog does not carry a trailing gap.
 */
function dialogTitleHtml(inner: string): string {
  return `<div class="dialogTitle">${inner}</div>`;
}
function showConfirmationDialog(
  message: string,
  confirmed: () => void,
  sourceElem: HTMLElement | null
) {
  showDialog(
    dialogTitleHtml(message),
    l10n.dialogYes,
    l10n.dialogCancel,
    () => {
      hideDialog();
      confirmed();
    },
    sourceElem
  );
}
function showRefInputDialog(
  message: string,
  defaultValue: string,
  actionName: string,
  actioned: (value: string) => void,
  sourceElem: HTMLElement | null
) {
  showFormDialog(
    message,
    [{ type: "text-ref", name: "", default: defaultValue }],
    actionName,
    (values) => actioned(values[0]),
    sourceElem
  );
}
function showCheckboxDialog(
  message: string,
  checkboxLabel: string,
  checkboxValue: boolean,
  actionName: string,
  actioned: (value: boolean) => void,
  sourceElem: HTMLElement | null
) {
  showFormDialog(
    message,
    [{ type: "checkbox", name: checkboxLabel, value: checkboxValue }],
    actionName,
    (values) => actioned(values[0] === "checked"),
    sourceElem
  );
}
function showSelectDialog(
  message: string,
  defaultValue: string,
  options: { name: string; value: string }[],
  actionName: string,
  actioned: (value: string) => void,
  sourceElem: HTMLElement | null
) {
  showFormDialog(
    message,
    [{ type: "select", name: "", options: options, default: defaultValue }],
    actionName,
    (values) => actioned(values[0]),
    sourceElem
  );
}
/**
 * A dialog whose whole content is a short list of actions, one button each.
 *
 * The choices sit in a horizontal row that wraps when a label — a branch
 * name, say — is too long to share it, and each button takes its action in
 * one click. The alternative, a `<select>` of long sentences above a
 * generic submit button, put the options in an operating-system dropdown
 * that overflowed the dialog and repeated the selected value above itself.
 */
function showChoiceDialog(
  message: string,
  choices: DialogChoice[],
  sourceElem: HTMLElement | null
) {
  const buttons = choices
    .map(
      (choice, index) =>
        `<div id="dialogChoice${index}" class="dialogBtn dialogChoice${
          choice.primary === true ? " dialogBtnPrimary" : ""
        }" role="button" tabindex="0">${escapeHtml(choice.label)}</div>`
    )
    .join("");
  showDialog(
    `${dialogTitleHtml(message)}<div class="dialogChoices">${buttons}</div>`,
    null,
    l10n.dialogCancel,
    null,
    sourceElem
  );
  dialog.classList.add("choiceDialog");
  // A dismiss-only dialog promotes its dismiss button to primary; here the
  // choices are the actions, so Cancel stays a secondary button.
  document.getElementById("dialogDismiss")?.classList.remove("dialogBtnPrimary");
  for (const [index, choice] of choices.entries()) {
    const button = document.getElementById(`dialogChoice${index}`);
    if (button === null) continue;
    const run = () => {
      hideDialog();
      choice.onClick();
    };
    button.addEventListener("click", run);
    button.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      // The document-level Enter handler confirms whatever dialog is open;
      // a choice may open a dialog of its own, which must not be confirmed
      // by the same keypress.
      e.stopPropagation();
      run();
    });
  }
  document.getElementById("dialogChoice0")?.focus();
}
function showFormDialog(
  message: string,
  inputs: DialogInput[],
  actionName: string,
  actioned: (values: string[]) => void,
  sourceElem: HTMLElement | null
) {
  const { html, textRefInput } = renderDialogForm(message, inputs);
  showDialog(
    html,
    actionName,
    l10n.dialogCancel,
    () => {
      if (dialog.className === "active noInput" || dialog.className === "active inputInvalid")
        return;
      const values = getDialogFormValues(inputs);
      hideDialog();
      actioned(values);
    },
    sourceElem
  );

  if (
    textRefInput > -1 ||
    inputs.some((input) => input.dependsOn !== undefined || isRequiredDialogInput(input))
  ) {
    bindFormDialogInputs(inputs, textRefInput, actionName);
  }
  bindLockedDialogInputs(inputs);
  bindFolderDialogInputs(inputs);
}
/** The folder field a Browse click is filling, until the picker answers (W22F). */
let pendingFolderPick: { requestId: number; field: HTMLInputElement } | null = null;
let folderPickRequests = 0;
/** Wires each folder field's Browse button to the folder picker (W22F). */
function bindFolderDialogInputs(inputs: DialogInput[]) {
  for (const [index, input] of inputs.entries()) {
    if (input.type !== "folder") continue;
    document
      .getElementById(`dialogBrowse${index}`)
      ?.addEventListener("click", () => requestFolderPick(index));
  }
}
function requestFolderPick(index: number) {
  const field = document.getElementById(`dialogInput${index}`) as HTMLInputElement | null;
  if (field === null) return;
  folderPickRequests += 1;
  pendingFolderPick = { requestId: folderPickRequests, field };
  sendMessage({ command: "pickFolder", requestId: folderPickRequests });
}
/** The picker's answer: a picked folder fills the field, and a cancelled picker changes nothing. */
function finishFolderPick(msg: Extract<GGL.ResponseMessage, { command: "pickFolder" }>) {
  const pending = pendingFolderPick;
  if (pending?.requestId !== msg.requestId) return;
  pendingFolderPick = null;
  if (msg.path === null || !pending.field.isConnected) return;
  pending.field.value = msg.path;
  // An input event re-runs the dialog's own check, which unblocks the action.
  pending.field.dispatchEvent(new Event("input"));
}
/**
 * Hold locked checkboxes at their forced value.
 *
 * `disabled` would be the obvious way and is the wrong one: it drops the
 * control out of the tab order and greys it, so the value it is reporting
 * becomes hard to read and impossible to reach — exactly when the user most
 * wants to know why it cannot move. The control stays enabled and the change
 * is refused instead, which keeps it focusable, full-contrast, and able to
 * surface its own explanation on focus.
 */
function bindLockedDialogInputs(inputs: DialogInput[]) {
  for (const [index, input] of inputs.entries()) {
    if (input.type !== "checkbox" || input.lock === undefined) continue;
    const elem = document.getElementById(`dialogInput${index}`) as HTMLInputElement | null;
    if (elem === null) continue;
    const forced = input.value;
    // `preventDefault()` is what refuses the toggle, and in a browser it is
    // enough on its own. The re-assert is not redundant belt-and-braces: a
    // checkbox is flipped by the pre-click activation steps *before* any
    // listener runs, and the revert that undoes it runs *after* them — so
    // assigning `checked` inside the handler is overwritten by that revert.
    // Restoring on a microtask lands after the activation steps finish, which
    // holds the control whatever an engine does in between (jsdom, for one,
    // reverts to the post-toggle value rather than the original).
    elem.addEventListener("click", (e) => {
      e.preventDefault();
      queueMicrotask(() => {
        elem.checked = forced;
      });
    });
    elem.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") e.preventDefault();
    });
  }
}
function renderDialogForm(message: string, inputs: DialogInput[]) {
  const multiElementForm = inputs.length > 1;
  let textRefInput = -1;
  let html = `${dialogTitleHtml(message)}<table class="dialogForm ${multiElementForm ? "multi" : "single"}">`;
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].type === "text-ref") textRefInput = i;
    html += renderDialogInputRow(inputs[i], i, multiElementForm, inputs);
  }
  return { html: `${html}</table>`, textRefInput };
}
function renderDialogInputRow(
  input: DialogInput,
  index: number,
  multiElementForm: boolean,
  inputs: DialogInput[]
) {
  const hidden = isDialogInputVisible(inputs, input) ? "" : " hidden";
  if (input.type === "note") {
    return `<tr id="dialogInputRow${index}"${hidden}><td colspan="2" class="dialogFormNoteCell"><span class="dialogFormNote">${escapeHtml(input.text)}</span></td></tr>`;
  }
  if (input.type === "group") {
    return `<tr id="dialogInputRow${index}"${hidden}><td colspan="2" class="dialogFormGroupCell"><span class="dialogFormGroup">${escapeHtml(input.name)}</span></td></tr>`;
  }
  // A checkbox names itself: its text belongs in the <label> beside the box,
  // never in the form's label column. Splitting them puts the words far from
  // the control and leaves the label column to be squeezed by the input
  // column beside it, which wraps the text one word per line.
  if (input.type === "checkbox") {
    return `<tr id="dialogInputRow${index}"${hidden}><td colspan="2">${renderDialogInput(input, index, false)}</td></tr>`;
  }
  const labelCell = multiElementForm ? `<td>${input.name}</td>` : "";
  return `<tr id="dialogInputRow${index}"${hidden}>${labelCell}<td>${renderDialogInput(input, index, multiElementForm)}</td></tr>`;
}
function renderDialogInput(
  // Value-less rows are rendered by renderDialogInputRow and never reach here.
  input: Exclude<DialogInput, { type: "note" | "group" }>,
  index: number,
  multiElementForm: boolean
) {
  if (input.type === "select") return renderDialogSelectInput(input, index);
  if (input.type === "checkbox") return renderDialogCheckboxInput(input, index, multiElementForm);
  if (input.type === "textarea") return renderDialogTextareaInput(input, index);
  if (input.type === "folder") return renderDialogFolderInput(input, index);
  return renderDialogTextInput(input, index);
}
/** A folder field with its Browse button beside it; the picker's answer fills the field (W22F). */
function renderDialogFolderInput(input: Extract<DialogInput, { type: "folder" }>, index: number) {
  return `<span class="dialogFormFolder"><input id="dialogInput${index}" type="text" value="${escapeHtml(input.default)}"/><button id="dialogBrowse${index}" class="dialogBtn" type="button">${escapeHtml(l10n.dialogCreateWorktreeBrowse)}</button></span>`;
}
function renderDialogSelectInput(input: Extract<DialogInput, { type: "select" }>, index: number) {
  let html = `<select id="dialogInput${index}">`;
  for (const option of input.options) {
    const selected = option.value === input.default ? " selected" : "";
    html += `<option value="${option.value}"${selected}>${escapeHtml(option.name)}</option>`;
  }
  return `${html}</select>`;
}
function renderDialogCheckboxInput(
  input: Extract<DialogInput, { type: "checkbox" }>,
  index: number,
  multiElementForm: boolean
) {
  const checked = input.value ? " checked" : "";
  const label = multiElementForm ? "" : input.name;
  if (input.lock === undefined) {
    return `<span class="dialogFormCheckbox${input.grouped === true ? " grouped" : ""}"><label class="checkRow"><input id="dialogInput${index}" type="checkbox"${checked}/>${label}</label></span>`;
  }
  // Locked: the same control in its forced state. It keeps `checked` (so the
  // submitted value is the real one), stays focusable and full-contrast rather
  // than `disabled`, and is described by the hint so assistive tech gets the
  // reason a sighted user gets from the bubble.
  const hintId = `dialogInputLock${index}`;
  return [
    '<span class="dialogFormCheckbox locked">',
    `<label class="checkRow locked"><input id="dialogInput${index}" type="checkbox"${checked}`,
    ` aria-disabled="true" aria-describedby="${hintId}"/>`,
    `${label}<span class="dialogLockGlyph" aria-hidden="true">?</span></label>`,
    `<span class="dialogLockHint" id="${hintId}" role="tooltip">`,
    `${escapeHtml(input.lock.reason)}</span>`,
    "</span>"
  ].join("");
}
function renderDialogTextInput(
  input: Extract<DialogInput, { type: "text" | "text-ref" }>,
  index: number
) {
  let placeholder = "";
  if (input.type === "text" && input.placeholder !== null) {
    placeholder = ` placeholder="${escapeHtml(input.placeholder)}"`;
  }
  return `<input id="dialogInput${index}" type="text" value="${escapeHtml(input.default)}"${placeholder}/>`;
}
function renderDialogTextareaInput(
  input: Extract<DialogInput, { type: "textarea" }>,
  index: number
) {
  const placeholder =
    input.placeholder === null ? "" : ` placeholder="${escapeHtml(input.placeholder)}"`;
  return `<textarea id="dialogInput${index}"${placeholder}>${escapeHtml(input.default)}</textarea>`;
}
function getDialogFormValues(inputs: DialogInput[]) {
  const values: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    values.push(getDialogInputValue(inputs[i], i));
  }
  return values;
}
function getDialogInputValue(input: DialogInput, index: number) {
  const elem = document.getElementById(`dialogInput${index}`);
  if (elem === null) return getDialogInputFallbackValue(input);
  if (input.type === "select") return (elem as HTMLSelectElement).value;
  if (input.type === "checkbox")
    return (elem as HTMLInputElement).checked ? "checked" : "unchecked";
  if (input.type === "textarea") return (elem as HTMLTextAreaElement).value;
  return (elem as HTMLInputElement).value;
}
function getDialogInputFallbackValue(input: DialogInput) {
  // Inputs are addressable by id only once the dialog markup is in the DOM,
  // so pre-render checks (e.g. initial dependent-row visibility) read the
  // configured default instead of a live element.
  if (input.type === "checkbox") return input.value ? "checked" : "unchecked";
  if (input.type === "note" || input.type === "group") return "";
  return input.default;
}
function isDialogInputVisible(inputs: DialogInput[], input: DialogInput) {
  if (input.dependsOn === undefined) return true;
  const controller = inputs[input.dependsOn.input];
  if (controller?.type !== "select") return true;
  return getDialogInputValue(controller, input.dependsOn.input) === input.dependsOn.value;
}
function isRequiredDialogInput(input: DialogInput) {
  return (
    (input.type === "text" || input.type === "textarea" || input.type === "folder") &&
    input.required === true
  );
}
function getFormDialogInputState(inputs: DialogInput[]) {
  let noInput = false;
  let invalidInput = false;
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (!isDialogInputVisible(inputs, input)) continue;
    const value = getDialogInputValue(input, i);
    if (input.type === "text-ref") {
      if (value === "") noInput = true;
      else if (refInvalid.exec(value) !== null) invalidInput = true;
    } else if (isRequiredDialogInput(input) && value.trim() === "") {
      noInput = true;
    }
  }
  return { noInput, invalidInput };
}
function bindFormDialogInputs(inputs: DialogInput[], textRefInput: number, actionName: string) {
  const dialogAction = requireElement("dialogAction");
  const refreshActionState = () => {
    const { noInput, invalidInput } = getFormDialogInputState(inputs);
    const newClassName = getTextRefDialogClassName(noInput, invalidInput);
    if (dialog.className === newClassName) return;
    dialog.className = newClassName;
    dialogAction.title = invalidInput ? l10n.invalidCharacters.replace("{0}", actionName) : "";
  };

  if (textRefInput > -1) {
    const dialogInput = document.getElementById(
      `dialogInput${textRefInput}`
    ) as HTMLInputElement | null;
    if (dialogInput !== null) {
      if (dialogInput.value === "") dialog.className = "active noInput";
      dialogInput.focus();
      dialogInput.addEventListener("keyup", refreshActionState);
    }
  }
  bindDialogInputDependencies(inputs, refreshActionState);
  for (let i = 0; i < inputs.length; i++) {
    if (!isRequiredDialogInput(inputs[i])) continue;
    const elem = document.getElementById(`dialogInput${i}`);
    elem?.addEventListener("keyup", refreshActionState);
    // Picking a <datalist> suggestion or pasting with the mouse fires
    // `input` without any key, and must unblock the action the same way.
    elem?.addEventListener("input", refreshActionState);
  }
  refreshActionState();
}
function bindDialogInputDependencies(inputs: DialogInput[], refreshActionState: () => void) {
  const controllerIndexes = new Set<number>();
  for (const input of inputs) {
    if (input.dependsOn !== undefined) controllerIndexes.add(input.dependsOn.input);
  }
  for (const index of controllerIndexes) {
    document.getElementById(`dialogInput${index}`)?.addEventListener("change", () => {
      updateDependentDialogInputRows(inputs);
      refreshActionState();
    });
  }
}
function updateDependentDialogInputRows(inputs: DialogInput[]) {
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (input.dependsOn === undefined) continue;
    const row = document.getElementById(`dialogInputRow${i}`);
    if (row !== null) row.hidden = !isDialogInputVisible(inputs, input);
  }
}
function getTextRefDialogClassName(noInput: boolean, invalidInput: boolean) {
  if (noInput) return "active noInput";
  if (invalidInput) return "active inputInvalid";
  return "active";
}
function showErrorDialog(message: string, reason: string | null, sourceElem: HTMLElement | null) {
  showDialog(
    dialogTitleHtml(`<span class="dialogErrorIcon">${svgIcons.alert}</span>${message}`) +
      (reason !== null
        ? `<span class="errorReason">${escapeHtml(reason).replaceAll("\n", "<br>")}</span>`
        : ""),
    null,
    l10n.dialogDismiss,
    null,
    sourceElem
  );
}
function showActionRunningDialog(command: string) {
  setStatusStrip("action", `${command}...`);
  showDialog(
    dialogTitleHtml(`<span id="actionRunning">${svgIcons.loading}${command} ...</span>`),
    null,
    l10n.dialogDismiss,
    null,
    null
  );
}
function showDialog(
  html: string,
  actionName: string | null,
  dismissName: string,
  actioned: (() => void) | null,
  sourceElem: HTMLElement | null
) {
  dialogBacking.className = "active";
  dialog.className = "active";
  const dismissClass = actionName === null ? "dialogBtn dialogBtnPrimary" : "dialogBtn";
  const actionButton =
    actionName === null
      ? ""
      : `<div id="dialogAction" class="dialogBtn dialogBtnPrimary">${actionName}</div>`;
  dialog.innerHTML =
    `<div class="dialogContent">${html}</div>` +
    `<div class="dialogActions">${actionButton}` +
    `<div id="dialogDismiss" class="${dismissClass}">${dismissName}</div></div>`;
  if (actionName !== null && actioned !== null)
    document.getElementById("dialogAction")?.addEventListener("click", actioned);
  document.getElementById("dialogDismiss")?.addEventListener("click", hideDialog);

  dialogMenuSource = sourceElem;
  if (dialogMenuSource !== null) dialogMenuSource.classList.add("dialogActive");
}
function hideDialog() {
  dialogBacking.className = "";
  dialog.className = "";
  dialog.innerHTML = "";
  if (dialogMenuSource !== null) {
    dialogMenuSource.classList.remove("dialogActive");
    dialogMenuSource = null;
  }
}

function hideDialogAndContextMenu() {
  if (dialog.classList.contains("active")) hideDialog();
  if (contextMenu.classList.contains("active")) hideContextMenu();
}
function confirmDialog() {
  document.getElementById("dialogAction")?.click();
}

/* Global Listeners */
document.addEventListener("keyup", (e) => {
  if (e.key === "Escape") hideDialogAndContextMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (e.isComposing || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!dialog.classList.contains("active")) return;
  // Textareas keep Enter for line breaks; selects and buttons already
  // consume Enter natively, so confirming here would double-trigger.
  if (
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLSelectElement ||
    e.target instanceof HTMLButtonElement
  )
    return;
  confirmDialog();
});
document.addEventListener("click", hideContextMenuListener);
document.addEventListener("contextmenu", hideContextMenuListener);
document.addEventListener("mouseleave", hideContextMenuListener);
function hideContextMenuListener() {
  if (contextMenu.classList.contains("active")) hideContextMenu();
}
