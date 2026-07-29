import type {
  CommitOrdering,
  GitCommandStatus,
  GitCommitDetails,
  GitCommitNode,
  GitCommitSearchResult,
  GitFileChange,
  GitPushBranchMode,
  GitQueryError,
  GitRemote,
  GitRepoConfig,
  GitRepoInfo,
  GitResetMode,
  GitStash,
  GitTagDetails
} from "@/backend/types";
import { COMMIT_ORDERINGS, GIT_PUSH_BRANCH_MODES } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";

import {
  alterGitFileTree,
  COMMIT_DETAILS_COLLAPSED_HEIGHT,
  COMMIT_DETAILS_DEFAULT_HEIGHT,
  COMMIT_DETAILS_KEYBOARD_RESIZE_STEP,
  COMMIT_DETAILS_MAX_HEIGHT,
  COMMIT_DETAILS_MIN_HEIGHT,
  type CommitDetailsSection,
  clampCommitDetailsHeight,
  generateGitFileTree,
  renderCommitDetailsRowHtml
} from "./commitDetailsView";
import { findCommitIndexes, formatFindMatchCount } from "./commitFind";
import { Dropdown, type DropdownOption } from "./dropdown";
import { Graph } from "./graph";
import { resolveGlobalShortcut } from "./keyboardShortcuts";
import { groupCommitRefs, parseRemoteBranchName } from "./refLabels";
import {
  getRepoBasename,
  getRepoDisplayName,
  normalizeRepoBooleanOverride,
  type RepoBooleanSettingKey,
  renderSettingsWidget,
  resolveRepoBooleanOverride
} from "./settingsWidget";
import { setStatusStrip } from "./statusStrip";
import { formatRelativeDate, getMonth, pad2 } from "./utils/date";
import { addListenerToClass, insertAfter, startRevealHighlight } from "./utils/dom";
import { arraysEqual, ELLIPSIS, refInvalid } from "./utils/git";
import { escapeHtml, unescapeHtml } from "./utils/html";
import { svgIcons } from "./utils/icons";
import { extractIssueLinks } from "./utils/linkify";
import { rewritePaletteLightnessChroma, toOklch } from "./utils/oklchColor";
import { sendMessage, vscode } from "./utils/vscode";

const searchHistoryMaxResults = 50;
const FILTER_SHOW_ALL_VALUE = "";
const HEAD_REF_VALUE = "HEAD";
const diagnosticMessageMaxLength = 500;
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
  valid: { glyph: "✓", tone: "valid", label: l10n.signatureValid },
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

function truncateDiagnosticMessage(value: string) {
  return value.length > diagnosticMessageMaxLength
    ? `${value.slice(0, diagnosticMessageMaxLength)}...`
    : value;
}

function errorToDiagnosticMessage(error: unknown) {
  if (error instanceof Error) {
    return truncateDiagnosticMessage(error.stack ?? error.message);
  }
  return truncateDiagnosticMessage(String(error));
}

function trimRepoTrailingSeparators(repo: string) {
  const minimumLength =
    repo.length >= 3 && repo[1] === ":" && (repo[2] === "\\" || repo[2] === "/") ? 3 : 1;
  let end = repo.length;
  while (end > minimumLength && (repo[end - 1] === "/" || repo[end - 1] === "\\")) end -= 1;
  return repo.slice(0, end);
}

function postWebviewDiagnostic(
  stage: string,
  opts: Omit<GGL.RequestWebviewDiagnostic, "command" | "stage"> = {}
) {
  try {
    sendMessage({ command: "webviewDiagnostic", stage, ...opts });
  } catch {
    // Diagnostics must never make the graph fail to load.
  }
}

globalThis.addEventListener("error", (event) => {
  postWebviewDiagnostic("window.error", {
    message: truncateDiagnosticMessage(
      `${event.message} (${event.filename}:${event.lineno}:${event.colno})`
    )
  });
});

globalThis.addEventListener("unhandledrejection", (event) => {
  postWebviewDiagnostic("window.unhandledrejection", {
    message: errorToDiagnosticMessage(event.reason)
  });
});

function isHideableColumn(value: string): value is HideableColumn {
  return (HIDEABLE_COLUMNS as readonly string[]).includes(value);
}

function isCommitOrdering(value: string): value is CommitOrdering {
  return (COMMIT_ORDERINGS as readonly string[]).includes(value);
}

function isRepoBooleanSettingKey(value: string | undefined): value is RepoBooleanSettingKey {
  return value !== undefined && (REPO_BOOLEAN_SETTING_KEYS as readonly string[]).includes(value);
}

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

function isJsonObject(value: GGL.JsonValue): value is { [key: string]: GGL.JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class GitGraphView {
  private gitRepos: GGL.GitRepoSet;
  private gitBranches: string[] = [];
  private gitBranchHead: string | null = null;
  private gitAuthors: string[] = [];
  private gitTags: string[] = [];
  private gitRemotes: GitRemote[] = [];
  private gitStashes: GitStash[] = [];
  private gitConfig: GitRepoConfig = createEmptyGitConfig();
  private commits: GitCommitNode[] = [];
  private commitHead: string | null = null;
  private commitLookup: { [hash: string]: number } = {};
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
  private maxCommits: number;
  private readonly hiddenColumns: Set<HideableColumn> = new Set();

  private readonly tableElem: HTMLElement;
  private readonly footerElem: HTMLElement;
  private readonly repoDropdown: Dropdown;
  private readonly branchDropdown: Dropdown;
  private readonly authorDropdown: Dropdown;
  private readonly tagDropdown: Dropdown;
  private readonly showRemoteBranchesElem: HTMLInputElement;
  private readonly topBarElem: HTMLElement;
  private readonly findControlElem: HTMLElement;
  private readonly findInputElem: HTMLInputElement;
  private readonly findMatchCountElem: HTMLElement;
  private readonly findPreviousBtn: HTMLButtonElement;
  private readonly findNextBtn: HTMLButtonElement;
  private readonly findClearBtn: HTMLButtonElement;
  private readonly findSearchHistoryBtn: HTMLButtonElement;
  private readonly fetchBtn: HTMLButtonElement;
  private readonly settingsBtn: HTMLButtonElement;
  private readonly settingsWidgetBackingElem: HTMLElement;
  private readonly settingsWidgetElem: HTMLElement;
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
    this.repoDropdown = new Dropdown("repoSelect", true, l10n.repo, (value) => {
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
      this.closeSettingsWidget();
      this.syncRepoSettingsControls();
      this.updateFetchButtonVisibility();
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
    this.findControlElem = requireElement("findControl");
    this.findInputElem = requireElement<HTMLInputElement>("findInput");
    this.findMatchCountElem = requireElement("findMatchCount");
    this.findPreviousBtn = requireElement<HTMLButtonElement>("findPreviousBtn");
    this.findNextBtn = requireElement<HTMLButtonElement>("findNextBtn");
    this.findClearBtn = requireElement<HTMLButtonElement>("findClearBtn");
    this.findSearchHistoryBtn = requireElement<HTMLButtonElement>("findSearchHistoryBtn");
    this.fetchBtn = requireElement<HTMLButtonElement>("fetchBtn");
    this.settingsBtn = requireElement<HTMLButtonElement>("settingsBtn");
    this.settingsWidgetBackingElem = requireElement("settingsWidgetBacking");
    this.settingsWidgetElem = requireElement("settingsWidget");
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
    this.settingsBtn.addEventListener("click", () => {
      this.toggleSettingsWidget();
    });
    this.settingsWidgetBackingElem.addEventListener("click", () => {
      this.closeSettingsWidget();
    });
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
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
    this.loadBranches(null, prevState.gitBranches, prevState.gitBranchHead, true, true);
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
  public loadRepos(repos: GGL.GitRepoSet, lastActiveRepo: string | null) {
    this.gitRepos = repos;
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

    const options: { name: string; value: string }[] = [];
    for (const repoPath of repoPaths) {
      options.push({ name: getRepoDisplayName(repoPath, repos[repoPath]), value: repoPath });
    }
    const repoControl = document.getElementById("repoControl");
    if (repoControl !== null) {
      repoControl.style.display = repoPaths.length > 1 ? "" : "none";
    }
    this.repoDropdown.setOptions(options, this.currentRepo);
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
      this.updateFetchButtonVisibility();
      this.refresh(true);
    }
  }

  public loadRepoInfo(requestId: number, repoInfo: GitRepoInfo, errorReason: string | null = null) {
    if (!this.acceptLoadRepoInfoResponse(requestId)) return;
    postWebviewDiagnostic("loadRepoInfo.response", {
      repo: this.currentRepo,
      requestId,
      message:
        errorReason ??
        `isRepo=${repoInfo.isRepo} remotes=${repoInfo.remotes.length} stashes=${repoInfo.stashes.length} authors=${repoInfo.authors.length} tags=${repoInfo.tags.length}`
    });

    this.gitAuthors = errorReason === null && repoInfo.isRepo ? repoInfo.authors : [];
    this.gitTags = errorReason === null && repoInfo.isRepo ? repoInfo.tags : [];
    this.gitRemotes = errorReason === null && repoInfo.isRepo ? repoInfo.remotes : [];
    this.gitStashes = errorReason === null && repoInfo.isRepo ? repoInfo.stashes : [];
    this.gitConfig = repoInfo.isRepo ? repoInfo.config : createEmptyGitConfig();
    this.currentAuthors = this.keepAvailableSelections(this.currentAuthors, this.gitAuthors);
    this.currentTags = this.keepAvailableSelections(this.currentTags, this.gitTags);
    this.saveState();
    this.updateFilterDropdowns();
    this.updateFetchButtonVisibility();
    this.renderSettingsWidget();
    this.renderLoadMoreFooter();
  }

  private updateFetchButtonVisibility() {
    const hasRemotes = this.currentRepo !== "" && this.gitRemotes.length > 0;
    this.fetchBtn.hidden = !hasRemotes;
    this.fetchBtn.disabled = !hasRemotes;
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
    errorReason: string | null = null
  ) {
    if (!this.acceptLoadBranchesResponse(requestId)) return;
    postWebviewDiagnostic("loadBranches.response", {
      repo: this.currentRepo,
      requestId,
      message:
        errorReason ?? `isRepo=${isRepo} branches=${branchOptions.length} head=${branchHead ?? ""}`
    });

    if (errorReason !== null) {
      this.renderShowError(l10n.unableToLoadGitGraph, errorReason);
      this.triggerLoadBranchesCallback(false, isRepo);
      return;
    }
    if (!isRepo) {
      this.renderShowError(l10n.unableToLoadGitGraph, l10n.noGitRepository);
      this.triggerLoadBranchesCallback(false, isRepo);
      return;
    }
    if (
      !hard &&
      arraysEqual(this.gitBranches, branchOptions, (a, b) => a === b) &&
      this.gitBranchHead === branchHead
    ) {
      this.triggerLoadBranchesCallback(false, isRepo);
      return;
    }

    this.gitBranches = branchOptions;
    this.gitBranchHead = branchHead;
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
    postWebviewDiagnostic("loadCommits.response", {
      repo: this.currentRepo,
      requestId,
      message:
        errorReason ?? `commits=${commits.length} head=${commitHead ?? ""} more=${moreAvailable}`
    });

    if (errorReason !== null) {
      this.pendingFocusCommitHash = null;
      this.renderShowError(l10n.unableToLoadGitGraph, errorReason);
      this.triggerLoadCommitsCallback(false);
      return;
    }
    if (!hard && this.isCommitListUnchanged(commits, commitHead, moreAvailable)) {
      this.refreshUncommittedChangesCommit(commits);
      this.triggerLoadCommitsCallback(false);
      return;
    }

    const activeFindHash = this.getActiveFindHash();
    this.moreCommitsAvailable = moreAvailable;
    this.commits = commits;
    this.commitHead = commitHead;
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
    const avatarsElems = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName("avatar"),
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
      this.updateFetchButtonVisibility();
      this.renderSettingsWidget();
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
      showStashes: this.getShowStashes()
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
      showSignature: !this.hiddenColumns.has("signature"),
      hard: hard
    });
  }
  private requestLoadBranchesAndCommits(hard: boolean) {
    postWebviewDiagnostic("load.start", {
      repo: this.currentRepo,
      repoCount: Object.keys(this.gitRepos).length
    });
    this.requestLoadRepoInfo();
    this.requestLoadBranches(hard, (branchChanges: boolean, isRepo: boolean) => {
      if (isRepo) {
        this.requestLoadCommits(hard, (commitChanges: boolean) => {
          if (!hard && (branchChanges || commitChanges)) {
            hideDialogAndContextMenu();
          }
        });
      } else {
        sendMessage({ command: "loadRepos", check: true });
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
    const row = this.findCommitRow(hash);
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
        { type: "checkbox" as const, name: l10n.dialogFetchPruneTags, value: false }
      ],
      l10n.dialogFetchSubmit,
      (values) => {
        const prune = values[0] === "checked";
        const pruneTags = values[1] === "checked";
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
        showActionRunningDialog(l10n.statusFetchingRemotes);
      },
      this.fetchBtn
    );
  }

  private navigateCommitDetails(delta: number) {
    if (this.expandedCommit === null) return;
    const targetRow = document.querySelector<HTMLElement>(
      `tr.commit[data-id="${(this.expandedCommit.id + delta).toString()}"]`
    );
    const hash = targetRow?.dataset.hash;
    if (targetRow === null || hash === undefined || hash === this.expandedCommit.hash) return;
    this.loadCommitDetails(targetRow);
    targetRow.focus();
  }

  /* State */
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
      settingsWidgetTab: this.settingsWidgetTab
    });
  }

  private normalizeSettingsWidgetTab(
    tab: GGL.SettingsWidgetTab | undefined
  ): GGL.SettingsWidgetTab {
    return tab === "extension" ? "extension" : "repository";
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
    const beforeTags = this.getShowTags();
    const beforeIncludeReflog = this.getIncludeReflog();
    const beforeIncludeUnreachable = this.getIncludeUnreachableCommits();
    const beforeFirstParent = this.getOnlyFollowFirstParent();
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
      beforeTags !== this.getShowTags() ||
      beforeIncludeReflog !== this.getIncludeReflog() ||
      beforeIncludeUnreachable !== this.getIncludeUnreachableCommits() ||
      beforeFirstParent !== this.getOnlyFollowFirstParent();
    reloadHistory = reloadHistory || repoFilterDefaultsChanged;

    this.renderTable();
    this.renderGraph();
    if (reloadHistory) {
      this.maxCommits = this.config.initialLoadCommits;
      this.renderShowLoading();
      this.requestLoadBranchesAndCommits(true);
    }
  }

  private applyExtensionSetting(setting: GGL.ExtensionSetting) {
    const value = setting.value;
    if (setting.configKey === "dateType") return true;
    if (setting.configKey === "showUncommittedChanges") return typeof value === "boolean";
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
      case "commitDetails.fileViewMode":
        if (value === "tree" || value === "list") this.config.commitDetailsFileViewMode = value;
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
      this.config.contextMenuActionsVisibility = value as GGL.ContextMenuActionsVisibility;
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
      defaults: this.getRepoBooleanDefaults(),
      activeTab: this.settingsWidgetTab,
      extensionSettings: this.extensionSettings,
      labels: {
        title: l10n.repositorySettings,
        close: l10n.settingsClose,
        repositoryTab: l10n.settingsRepositoryTab,
        extensionTab: l10n.settingsExtensionTab,
        general: l10n.settingsGeneral,
        repositoryName: l10n.settingsRepositoryName,
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
    this.renderTable();
    this.renderGraph();
  }
  private renderGraph() {
    const colHeadersElem = document.getElementById("tableColHeaders");
    if (colHeadersElem === null) return;
    const headerHeight = colHeadersElem.clientHeight + 1,
      expandedCommitElem =
        this.expandedCommit !== null ? document.getElementById("commitDetails") : null;
    const tableHeight = this.tableElem.children[0]?.clientHeight ?? 0;
    this.config.grid.expandY =
      expandedCommitElem !== null
        ? expandedCommitElem.getBoundingClientRect().height || this.getCommitDetailsRenderedHeight()
        : this.config.grid.expandY;
    const expandedHeight = this.expandedCommit === null ? 0 : this.config.grid.expandY;
    const renderedRowHeight =
      this.commits.length > 0
        ? (tableHeight - headerHeight - expandedHeight) / this.commits.length
        : this.config.graphRowHeight;
    this.config.grid.y = renderedRowHeight > 0 ? renderedRowHeight : this.config.graphRowHeight;
    this.config.grid.offsetY = headerHeight + this.config.grid.y / 2;
    this.graph.render(this.expandedCommit);
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
      html += `<tr class="emptyGraphRow"><td colspan="6">${l10n.emptyGraph}</td></tr>`;
    }
    this.tableElem.innerHTML = `<table>${html}</table>`;
    this.renderLoadMoreFooter();
    this.makeTableResizable();
    this.restoreExpandedCommit();

    this.registerCommitContextMenuListener();
    this.registerUncommittedChangesContextMenuListener();
    this.registerCommitActivationListeners();
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
      showContextMenu(<MouseEvent>e, this.buildCommitContextMenu(hash, sourceElem), sourceElem);
    });
  }
  private registerUncommittedChangesContextMenuListener() {
    addListenerToClass("unsavedChanges", "contextmenu", (e: Event) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".unsavedChanges");
      if (sourceElem === null) return;
      showContextMenu(
        <MouseEvent>e,
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
  private buildCommitContextMenu(hash: string, sourceElem: HTMLElement): ContextMenuElement[] {
    if (this.shouldShowSelectedCommitContextMenu(hash)) {
      return this.buildSelectedCommitContextMenu(sourceElem);
    }

    const commitIndex = this.commitLookup[hash];
    const commit = typeof commitIndex === "number" ? this.commits[commitIndex] : null;
    const isHeadCommit = hash === this.commitHead;
    const canDropCommit = commit !== null && commit.parentHashes.length === 1;
    const menu = this.buildCommitCreateMenuItems(hash, sourceElem);
    const compareWithHeadItem = this.buildCompareWithHeadMenuItem(hash, sourceElem);
    if (compareWithHeadItem !== null) menu.push(compareWithHeadItem);
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
          this.showParentCommitActionDialog(
            hash,
            sourceElem,
            "cherrypickCommit",
            l10n.dialogCherryPickConfirm,
            l10n.dialogYesCherryPick
          )
      }),
      this.visibleContextMenuItem("commit", "revert", {
        title: l10n.revert + ELLIPSIS,
        onClick: () =>
          this.showParentCommitActionDialog(
            hash,
            sourceElem,
            "revertCommit",
            l10n.dialogRevertConfirm,
            l10n.dialogYesRevert
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
  private buildSelectedCommitContextMenu(sourceElem: HTMLElement): ContextMenuElement[] {
    const menu: ContextMenuElement[] = [];
    const selectedCommits = this.getSelectedCommits();
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
      if (commit.hash !== "*") this.setCommitSelected(commit.hash, true);
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
          name: l10n.dialogAddTagMessage,
          default: "",
          placeholder: l10n.dialogAddTagOptional
        }
      ],
      l10n.dialogAddTagSubmit,
      (values) => {
        sendMessage({
          command: "addTag",
          repo: this.currentRepo,
          tagName: values[0],
          commitHash: hash,
          lightweight: values[1] === "lightweight",
          message: values[2]
        });
      },
      sourceElem
    );
  }
  private showCreateBranchDialog(hash: string, sourceElem: HTMLElement) {
    showRefInputDialog(
      l10n.dialogCreateBranchTitle.replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`),
      "",
      l10n.dialogCreateBranchSubmit,
      (name) => {
        sendMessage({
          command: "createBranch",
          repo: this.currentRepo,
          branchName: name,
          commitHash: hash
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
  private showParentCommitActionDialog(
    hash: string,
    sourceElem: HTMLElement,
    command: "cherrypickCommit" | "revertCommit",
    titleTemplate: string,
    actionName: string
  ) {
    const title = titleTemplate.replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`);
    const parentHashes = this.commits[this.commitLookup[hash]].parentHashes;
    if (parentHashes.length === 1) {
      showConfirmationDialog(
        title,
        () => this.sendParentCommitAction(command, hash, 0),
        sourceElem
      );
      return;
    }

    showSelectDialog(
      title,
      "1",
      this.buildParentCommitOptions(parentHashes),
      actionName,
      (parentIndex) => this.sendParentCommitAction(command, hash, Number.parseInt(parentIndex, 10)),
      sourceElem
    );
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
  private sendParentCommitAction(
    command: "cherrypickCommit" | "revertCommit",
    hash: string,
    parentIndex: number
  ) {
    sendMessage({
      command,
      repo: this.currentRepo,
      commitHash: hash,
      parentIndex
    });
  }
  private showMergeCommitDialog(hash: string, sourceElem: HTMLElement) {
    showFormDialog(
      l10n.dialogMergeConfirm
        .replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`)
        .replace("{1}", `<b>${l10n.labelCurrentBranch}</b>`),
      [
        { type: "checkbox", name: l10n.dialogMergeNoFastForward, value: true },
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
          resetMode: <GitResetMode>mode
        });
      },
      sourceElem
    );
  }
  private registerCommitActivationListeners() {
    addListenerToClass("commit", "click", (e: Event) => {
      const mouseEvent = <MouseEvent>e;
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
      const keyboardEvent = <KeyboardEvent>e;
      if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
      const sourceElem = closestHTMLElement(e.target, ".commit");
      const hash = sourceElem?.dataset.hash;
      if (sourceElem === null || hash === undefined) return;
      keyboardEvent.preventDefault();
      this.toggleCommitDetails(sourceElem, hash);
    });
  }
  private registerGitRefContextMenuListener() {
    addListenerToClass("gitRef", "contextmenu", (e: Event) => {
      e.stopPropagation();
      const sourceElem = closestHTMLElement(e.target, ".gitRef");
      const rawRefName = sourceElem?.dataset.name;
      if (sourceElem === null || rawRefName === undefined) return;

      const refName = unescapeHtml(rawRefName);
      showContextMenu(<MouseEvent>e, this.buildGitRefContextMenu(sourceElem, refName), sourceElem);
    });
  }
  private buildGitRefContextMenu(sourceElem: HTMLElement, refName: string) {
    const isTag = sourceElem.classList.contains("tag");
    const menu = isTag
      ? this.buildTagContextMenu(refName)
      : this.buildBranchContextMenu(sourceElem, refName);
    const refCommitHash = this.getCommitHashForElement(sourceElem);
    const compareWithHeadItem =
      refCommitHash === null ? null : this.buildCompareWithHeadMenuItem(refCommitHash, sourceElem);
    if (compareWithHeadItem !== null) menu.push(compareWithHeadItem);
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
  private buildCompareWithHeadMenuItem(hash: string, sourceElem: HTMLElement): ContextMenuElement {
    if (!this.canCompareWithHead(hash)) return null;
    const group = this.contextMenuGroupForRef(sourceElem);
    if (!this.isContextMenuActionVisible(group, "compareWithHead")) return null;
    return {
      title: l10n.compareWithHead,
      onClick: () => this.loadCommitComparisonWithHead(sourceElem, hash)
    };
  }
  private canCompareWithHead(hash: string) {
    return this.commitHead !== null && hash !== "*" && hash !== this.commitHead;
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
      this.isContextMenuActionVisible("tag", "createArchive")
        ? {
            title: l10n.createArchive,
            onClick: () => this.createArchiveAction(refName)
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
    menu.push(...this.buildBranchMetadataItems(refName, sourceElem));
    this.appendBranchRemoteItems(menu, refName);
    this.appendBranchMutationItems(menu, sourceElem, refName);
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

    menu.push({
      title: l10n.checkoutBranch,
      onClick: () => this.checkoutBranchAction(sourceElem, refName)
    });
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
      this.visibleContextMenuItem("branch", "pull", {
        title: l10n.pullBranch + ELLIPSIS,
        onClick: () => this.showUpdateBranchFromUpstreamDialog(refName)
      })
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
      this.isContextMenuActionVisible("remoteBranch", "checkout")
        ? {
            title: l10n.checkoutBranch + ELLIPSIS,
            onClick: () => this.checkoutBranchAction(sourceElem, refName)
          }
        : null
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
      ...(this.hasLocalBranch(branchName) &&
      this.gitBranchHead !== branchName &&
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
        : null
    ];
    menu.push(...remoteActions);
    const pullRequestItem = this.buildCreatePullRequestMenuItem(branchName, remote, sourceElem);
    if (pullRequestItem !== null) {
      menu.push(null, pullRequestItem);
    }
    return menu;
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
    showConfirmationDialog(
      l10n.dialogPushTagConfirm.replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`),
      () => {
        sendMessage({ command: "pushTag", repo: this.currentRepo, tagName: refName });
        showActionRunningDialog(l10n.pushingTag);
      },
      null
    );
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

    const html =
      `<div class="tagDetailsTitle"><b>${l10n.tagDetailsTitle.replace("{0}", escapeHtml(details.tagName))}</b></div>` +
      `<dl class="tagDetailsFields">` +
      this.tagDetailRow(l10n.tagDetailsType, escapeHtml(tagType)) +
      this.tagDetailRow(
        l10n.tagDetailsObject,
        escapeHtml(abbrevCommit(details.objectHash, this.config.shortHashLength))
      ) +
      this.tagDetailRow(l10n.tagDetailsTarget, escapeHtml(target)) +
      this.tagDetailRow(l10n.tagDetailsTagger, tagger) +
      this.tagDetailRow(l10n.tagDetailsDate, escapeHtml(date)) +
      this.tagDetailRow(l10n.tagDetailsSignature, signature) +
      `<dt class="tagDetailsMessageLabel">${l10n.tagDetailsMessage}</dt>` +
      `<dd class="tagDetailsMessage">${messageHtml ?? escapeHtml(l10n.tagDetailsNoMessage)}</dd>` +
      `</dl>` +
      `<div class="tagDetailsActions">` +
      this.tagDetailsCopyButton("tagDetailsCopyName", svgIcons.copy, l10n.copyTagName) +
      this.tagDetailsCopyButton("tagDetailsCopyHash", svgIcons.copy, l10n.copyTagHash) +
      this.tagDetailsCopyButton("tagDetailsCopyMessage", svgIcons.copy, l10n.copyTagMessage) +
      `</div>`;

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
    showRefInputDialog(
      l10n.dialogRenameBranchTitle.replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`),
      refName,
      l10n.dialogRenameBranchSubmit,
      (newName) => {
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
    const deleteOnRemotes = this.getRemotesWithBranch(refName);
    const inputs: DialogInput[] = [
      { type: "checkbox", name: l10n.dialogDeleteForceDelete, value: false }
    ];
    if (deleteOnRemotes.length > 0) {
      inputs.push({
        type: "checkbox",
        name: l10n.dialogDeleteOnRemotes.replace("{0}", deleteOnRemotes.join(", ")),
        value: false
      });
    }

    showFormDialog(
      l10n.dialogDeleteConfirm
        .replace("{0}", l10n.labelBranch)
        .replace("{1}", `<b><i>${escapeHtml(refName)}</i></b>`),
      inputs,
      l10n.deleteBranch,
      (values) => {
        const request: Extract<GGL.RequestMessage, { command: "deleteBranch" }> = {
          command: "deleteBranch",
          repo: this.currentRepo,
          branchName: refName,
          forceDelete: values[0] === "checked"
        };
        if (deleteOnRemotes.length > 0 && values[1] === "checked") {
          request.deleteOnRemotes = deleteOnRemotes;
        }
        sendMessage(request);
        showActionRunningDialog(l10n.statusDeletingBranch);
      },
      null
    );
  }
  private showPushBranchDialog(refName: string) {
    const remoteNames = this.getRemoteNames();
    if (remoteNames.length === 0) return;

    const defaultRemote = this.defaultPushRemoteName(remoteNames);
    const remoteInputs: DialogInput[] = remoteNames.map((remote) => ({
      type: "checkbox" as const,
      name: l10n.dialogPushBranchRemote.replace("{0}", remote),
      value: remote === defaultRemote
    }));
    const inputs: DialogInput[] = [
      ...remoteInputs,
      { type: "checkbox", name: l10n.dialogPushBranchSetUpstream, value: true },
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

    showFormDialog(
      l10n.dialogPushBranchConfirm.replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`),
      inputs,
      l10n.dialogPushBranchSubmit,
      (values) => {
        const selectedRemotes = remoteNames.filter((_, index) => values[index] === "checked");
        if (selectedRemotes.length === 0) {
          showErrorDialog(l10n.dialogPushBranchNoRemoteSelected, null, null);
          return;
        }

        sendMessage({
          command: "pushBranch",
          repo: this.currentRepo,
          branchName: refName,
          remotes: selectedRemotes,
          setUpstream: values[remoteNames.length] === "checked",
          noVerify: values[remoteNames.length + 1] === "checked",
          mode: values[remoteNames.length + 2] as GitPushBranchMode
        });
        showActionRunningDialog(l10n.statusPushingBranch);
      },
      null
    );
  }
  private showUpdateBranchFromUpstreamDialog(refName: string) {
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
        { type: "checkbox", name: l10n.dialogPullBranchNoFastForward, value: false },
        { type: "checkbox", name: l10n.dialogPullBranchSquash, value: false },
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
          noVerify: values[2] === "checked"
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
        { type: "checkbox", name: l10n.dialogMergeNoFastForward, value: true },
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
  private registerGitRefActivationListeners() {
    addListenerToClass("gitRef", "click", (e: Event) => e.stopPropagation());
    addListenerToClass("gitRef", "dblclick", (e: Event) => {
      e.stopPropagation();
      hideDialogAndContextMenu();
      const sourceElem = closestHTMLElement(e.target, ".gitRef");
      const refName = sourceElem?.dataset.name;
      if (sourceElem === null || refName === undefined) return;
      this.checkoutBranchAction(sourceElem, unescapeHtml(refName));
    });
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
    const commitMessage = commit.hash === currentHash ? `<b>${message}</b>` : message;
    const authorTitle = escapeHtml(`${commit.author} <${commit.email}>`);

    return (
      `<tr ${rowAttributes}` +
      ` data-id="${index}" data-color="${this.graph.getVertexColor(index)}"><td></td><td>` +
      (isHeadCommit ? '<span class="commitHeadDot"></span>' : "") +
      this.renderCommitRefs(commit) +
      commitMessage +
      `</td><td title="${date.title}">` +
      date.value +
      `</td><td title="${authorTitle}">` +
      this.renderCommitAvatar(commit) +
      escapeHtml(commit.author) +
      `</td><td title="${escapeHtml(commit.hash)}">` +
      this.displayHash(commit.hash) +
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
    if (commit.parentHashes.length > 1) rowClasses.push("mergeCommit");
    if (commit.parentHashes.length > 1 || mutedByHeadAncestry) rowClasses.push("mutedCommit");
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
        return (
          `<span class="gitRefGroup${active ? " active" : ""}" role="group" aria-label="${escapeHtml(label)}">` +
          this.renderCommitRef(item.local, item.local.name, " gitRefPrimary") +
          item.remotes
            .map(({ ref, remote }) => this.renderCommitRef(ref, remote, " gitRefAlias"))
            .join("") +
          "</span>"
        );
      })
      .join("");
  }
  private renderCommitRef(ref: GitCommitNode["refs"][number], label: string, extraClass: string) {
    const refName = escapeHtml(ref.name);
    const refActive = ref.type === "head" && ref.name === this.gitBranchHead;
    const signed = ref.type === "tag" && ref.signed === true;
    const title = escapeHtml(signed ? `${ref.name} — ${l10n.signedTagTooltip}` : ref.name);
    return (
      `<span class="gitRef ${ref.type}${refActive ? " active" : ""}${signed ? " signed" : ""}${extraClass}" data-name="${refName}" title="${title}">` +
      this.refIcon(ref.type, signed) +
      escapeHtml(label) +
      "</span>"
    );
  }
  private refIcon(type: GitCommitNode["refs"][number]["type"], signed: boolean) {
    if (type !== "tag") return svgIcons.branch;
    return signed ? svgIcons.signedTag : svgIcons.tag;
  }
  private renderCommitAvatar(commit: GitCommitNode) {
    if (!this.config.fetchAvatars) return "";

    const avatarImage = this.avatars[commit.email];
    const imageHtml =
      typeof avatarImage === "string" ? `<img class="avatarImg" src="${avatarImage}">` : "";
    return `<span class="avatar" data-email="${escapeHtml(commit.email)}">${imageHtml}</span>`;
  }
  private renderLoadMoreFooter() {
    const stashHtml = this.renderStashFooter();
    const loadMoreHtml = this.moreCommitsAvailable
      ? `<div id="loadMoreCommitsBtn" class="roundedBtn">${l10n.loadMore}</div>`
      : "";
    this.footerElem.innerHTML = stashHtml + loadMoreHtml;

    this.registerStashContextMenuListener();
    this.registerStashActivationListeners();

    const loadMoreCommitsBtn = document.getElementById("loadMoreCommitsBtn");
    loadMoreCommitsBtn?.addEventListener("click", () => this.loadMoreCommits(loadMoreCommitsBtn));
  }
  private renderStashFooter() {
    if (this.gitStashes.length === 0) return "";

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
          dateHtml +
          "</div>"
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
        <MouseEvent>e,
        this.buildStashContextMenu(unescapeHtml(selector), unescapeHtml(hash), sourceElem),
        sourceElem
      );
    });
  }
  private registerStashActivationListeners() {
    addListenerToClass("stashRow", "keydown", (e: Event) => {
      const keyboardEvent = <KeyboardEvent>e;
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
  private showBranchFromStashDialog(selector: string, sourceElem: HTMLElement) {
    showRefInputDialog(
      l10n.dialogBranchFromStashTitle.replace("{0}", `<b><i>${escapeHtml(selector)}</i></b>`),
      "",
      l10n.dialogBranchFromStashSubmit,
      (branchName) => {
        sendMessage({
          command: "branchFromStash",
          repo: this.currentRepo,
          selector,
          branchName
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
  private findExpandedCommitElement(hash: string) {
    const elems = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName("commit");
    for (const elem of elems) {
      if (hash === elem.dataset.hash) return elem;
    }
    return null;
  }
  private renderUncommitedChanges() {
    const date = getCommitDate(this.commits[0].date);
    document.getElementsByClassName("unsavedChanges")[0].innerHTML =
      "<td></td><td><b>" +
      escapeHtml(this.commits[0].message) +
      '</b></td><td title="' +
      date.title +
      '">' +
      date.value +
      '</td><td title="* <>">*</td><td title="*">*</td>' +
      `<td class="signatureCol">${this.renderCommitSignature(null)}</td>`;
  }
  private renderShowLoading(message = l10n.statusLoadingGraph) {
    hideDialogAndContextMenu();
    document.body.classList.remove("unableToLoad");
    this.graph.clear();
    setStatusStrip("loading", message);
    this.tableElem.innerHTML = `<h2 id="loadingHeader">${svgIcons.loading}${l10n.loading}</h2>`;
    this.footerElem.innerHTML = "";
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
      const refNameComps = refName.split("/");
      const sourceName = sourceElem.dataset.name ?? refName;
      showRefInputDialog(
        l10n.dialogCreateBranchTitle.replace("{0}", `<b><i>${escapeHtml(sourceName)}</i></b>`),
        refNameComps.at(-1) ?? refName,
        l10n.checkoutBranch,
        (newBranch) => {
          sendMessage({
            command: "checkoutBranch",
            repo: this.currentRepo,
            branchName: newBranch,
            remoteBranch: refName
          });
        },
        null
      );
    }
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
    if (
      column === "signature" &&
      wasHidden &&
      this.commits.some((commit) => commit.hash !== "*" && commit.signature === undefined)
    ) {
      setStatusStrip("loading", l10n.signatureLoading);
      this.requestLoadCommits(true, () => {});
    }
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
      showContextMenu(<MouseEvent>e, this.buildColumnVisibilityMenu(), sourceElem);
    });
  }
  private makeTableResizable() {
    const colHeadersElem = requireElement("tableColHeaders"),
      cols = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName("tableColHeader");
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
      cols[0].style.padding =
        "0 " +
        Math.round((Math.max(this.graph.getWidth() + 16, 64) - (cols[0].offsetWidth - 24)) / 2) +
        "px";
    }

    addListenerToClass("resizeCol", "mousedown", (e) => {
      if (!(e.target instanceof HTMLElement) || e.target.dataset.col === undefined) return;
      col = Number.parseInt(e.target.dataset.col, 10);
      mouseX = (<MouseEvent>e).clientX;
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
        const mouseEvent = <MouseEvent>e;
        this.resizeTableColumn(col, mouseEvent.clientX - mouseX, columnWidths, cols);
        mouseX = mouseEvent.clientX;
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
  private loadCommitComparisonWithHead(sourceElem: HTMLElement, hash: string) {
    if (!this.canCompareWithHead(hash)) return;
    const row = this.getCommitRowForElement(sourceElem);
    const id = row?.dataset.id;
    if (row === null || id === undefined || this.commitHead === null) return;

    this.hideCommitDetails();
    this.expandedCommit = {
      id: Number.parseInt(id, 10),
      hash,
      srcElem: row,
      commitDetails: null,
      fileTree: null,
      comparison: { baseRef: hash, compareRef: "HEAD" },
      detailsHeight: COMMIT_DETAILS_DEFAULT_HEIGHT,
      summaryOpen: true,
      filesOpen: true
    };
    this.saveState();
    sendMessage({
      command: "commitComparison",
      repo: this.currentRepo,
      commitHash: hash,
      baseRef: hash,
      compareRef: "HEAD"
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
  public showCommitDetails(commitDetails: GitCommitDetails, fileTree: GitFolder) {
    const expandedCommit = this.expandedCommit;
    const sourceElem = expandedCommit?.srcElem;
    if (
      sourceElem === null ||
      sourceElem === undefined ||
      expandedCommit?.hash !== commitDetails.hash
    )
      return;
    const elem = document.getElementById("commitDetails");
    if (typeof elem === "object" && elem !== null) elem.remove();

    expandedCommit.commitDetails = commitDetails;
    expandedCommit.fileTree = fileTree;
    sourceElem.classList.add("commitDetailsOpen");
    sourceElem.setAttribute("aria-selected", "true");
    this.saveState();

    const newElem = document.createElement("tr");
    newElem.id = "commitDetails";
    const rowColor = sourceElem.dataset.color;
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
      issueLinking: this.getCurrentRepoState()?.issueLinking ?? null
    });
    insertAfter(newElem, sourceElem);
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
        <MouseEvent>e,
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

  private buildGitFileContextMenu(
    fileChange: GitFileChange,
    sourceElem: HTMLElement
  ): ContextMenuElement[] {
    const menu: ContextMenuElement[] = [];
    const revisionFileExists = this.gitFileExistsAtRevision(fileChange);

    if (
      fileChange.additions !== null &&
      fileChange.deletions !== null &&
      this.isContextMenuActionVisible("commitDetailsViewFile", "viewDiff")
    ) {
      menu.push({
        title: l10n.viewFileDiff,
        onClick: () => this.viewGitFileDiff(fileChange)
      });
    }

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

  private getExpandedFileRevision(fileChange: GitFileChange): string | null {
    if (this.expandedCommit === null) return null;
    if (this.expandedCommit.comparison === null) return this.expandedCommit.hash;
    return fileChange.type === "D"
      ? this.expandedCommit.comparison.baseRef
      : this.expandedCommit.comparison.compareRef;
  }

  private viewGitFileDiff(fileChange: GitFileChange) {
    if (this.expandedCommit === null) return;
    const comparison = this.expandedCommit.comparison;
    sendMessage({
      command: "viewDiff",
      repo: this.currentRepo,
      commitHash: this.expandedCommit.hash,
      ...(comparison === null ? {} : { oldRef: comparison.baseRef, newRef: comparison.compareRef }),
      oldFilePath: fileChange.oldFilePath,
      newFilePath: fileChange.newFilePath,
      type: fileChange.type
    });
  }

  private viewGitFileAtRevision(fileChange: GitFileChange) {
    const commitHash = this.getExpandedFileRevision(fileChange);
    if (commitHash === null) return;
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

  private getCommitDetailsRenderedHeight() {
    if (this.expandedCommit === null) return COMMIT_DETAILS_DEFAULT_HEIGHT;
    if (!this.expandedCommit.summaryOpen && !this.expandedCommit.filesOpen) {
      return COMMIT_DETAILS_COLLAPSED_HEIGHT;
    }
    return clampCommitDetailsHeight(this.expandedCommit.detailsHeight);
  }

  private applyCommitDetailsHeight(elem: HTMLElement) {
    elem.style.height = `${this.getCommitDetailsRenderedHeight()}px`;
    this.updateCommitDetailsResizeHandle();
  }

  private updateCommitDetailsResizeHandle() {
    if (this.expandedCommit === null) return;
    document
      .getElementById("commitDetailsResizeHandle")
      ?.setAttribute(
        "aria-valuenow",
        clampCommitDetailsHeight(this.expandedCommit.detailsHeight).toString()
      );
  }

  private setCommitDetailsHeight(height: number, save = true) {
    if (this.expandedCommit === null) return;
    this.expandedCommit.detailsHeight = clampCommitDetailsHeight(height);
    const elem = document.getElementById("commitDetails");
    if (elem !== null) this.applyCommitDetailsHeight(elem);
    if (save) this.saveState();
    this.renderGraph();
  }

  private startCommitDetailsResize(event: MouseEvent) {
    if (event.button !== 0 || this.expandedCommit === null) return;
    const startY = event.clientY;
    const startHeight = clampCommitDetailsHeight(this.expandedCommit.detailsHeight);
    const resize = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      this.setCommitDetailsHeight(startHeight + moveEvent.clientY - startY, false);
    };
    const stop = () => {
      document.body.classList.remove("commitDetailsResizing");
      document.removeEventListener("mousemove", resize);
      if (this.expandedCommit !== null) this.saveState();
    };

    event.preventDefault();
    document.body.classList.add("commitDetailsResizing");
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stop, { once: true });
  }

  private resizeCommitDetailsFromKeyboard(event: KeyboardEvent) {
    if (this.expandedCommit === null) return;
    const currentHeight = clampCommitDetailsHeight(this.expandedCommit.detailsHeight);
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
const gitGraph = new GitGraphView(
  viewState.repos,
  viewState.lastActiveRepo,
  {
    autoCenterCommitDetailsView: viewState.autoCenterCommitDetailsView,
    commitDetailsCompactFolders: viewState.commitDetailsCompactFolders,
    commitDetailsFileViewMode: viewState.commitDetailsFileViewMode,
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
    onlyFollowFirstParent: viewState.onlyFollowFirstParent,
    showCurrentBranchByDefault: viewState.showCurrentBranchByDefault,
    showRemoteBranches: viewState.showRemoteBranches,
    showStashes: viewState.showStashes,
    showTags: viewState.showTags,
    shortHashLength: viewState.shortHashLength
  },
  vscode.getState() ?? null
);
postWebviewDiagnostic("boot.ready", {
  repo: viewState.lastActiveRepo ?? undefined,
  repoCount: Object.keys(viewState.repos).length
});

const actionErrorLabels = {
  addRemote: l10n.unableToAddRemote,
  addTag: l10n.unableToAddTag,
  applyStash: l10n.unableToApplyStash,
  branchFromStash: l10n.unableToBranchFromStash,
  checkoutBranch: l10n.unableToCheckoutBranch,
  checkoutCommit: l10n.unableToCheckoutCommit,
  cherrypickCommit: l10n.unableToCherryPick,
  cleanUntrackedFiles: l10n.unableToCleanUntracked,
  createBranch: l10n.unableToCreateBranch,
  createPullRequest: l10n.unableToCreatePullRequest,
  deleteBranch: l10n.unableToDeleteBranch,
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
  mergeBranch: l10n.unableToMergeBranch,
  mergeCommit: l10n.unableToMergeCommit,
  popStash: l10n.unableToPopStash,
  pullBranch: l10n.unableToPullBranch,
  pruneRemote: l10n.unableToPruneRemote,
  pushBranch: l10n.unableToPushBranch,
  pushStash: l10n.unableToPushStash,
  pushTag: l10n.unableToPushTag,
  renameBranch: l10n.unableToRenameBranch,
  resetFileToRevision: l10n.unableToResetFileToRevision,
  resetUncommittedChanges: l10n.unableToResetUncommitted,
  resetToCommit: l10n.unableToReset,
  rebaseCurrentBranch: l10n.unableToRebase,
  revertCommit: l10n.unableToRevert,
  squashCommitSelection: l10n.unableToSquashSelection,
  undoLastCommit: l10n.unableToUndoLastCommit,
  updateBranchFromUpstream: l10n.unableToUpdateBranch
} satisfies Partial<Record<GGL.ResponseMessage["command"], string>>;

function handleActionResponse(msg: GGL.ResponseMessage) {
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
  commitComparison: handleCommitComparisonResponse,
  commitDetails: handleCommitDetailsResponse,
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
  loadRepoInfo: (msg) =>
    gitGraph.loadRepoInfo(msg.requestId, msg.repoInfo, formatQueryError(msg.error)),
  loadExtensionSettings: (msg) =>
    gitGraph.loadExtensionSettings(msg.requestId, msg.settings, msg.status),
  loadRepos: (msg) => gitGraph.loadRepos(msg.repos, msg.lastActiveRepo),
  compareFileWithWorkingTree: (msg) =>
    handleSuccessFlagResponse(msg, l10n.unableToCompareFileWithWorkingTree),
  openExternalUrl: (msg) => handleSuccessFlagResponse(msg, l10n.unableToOpenExternalUrl),
  openFile: (msg) => handleSuccessFlagResponse(msg, l10n.unableToOpenFile),
  openSourceControl: (msg) => handleSuccessFlagResponse(msg, l10n.unableToOpenSourceControl),
  refresh: () => gitGraph.refresh(false),
  searchCommits: (msg) =>
    gitGraph.loadSearchCommitResults(msg.requestId, msg.results, formatQueryError(msg.error)),
  startHistorySearch: () => gitGraph.startHistorySearch(),
  tagDetails: handleTagDetailsResponse,
  viewDiff: (msg) => handleSuccessFlagResponse(msg, l10n.unableToViewDiff),
  viewFileAtRevision: (msg) => handleSuccessFlagResponse(msg, l10n.unableToViewFileAtRevision)
};

window.addEventListener("message", handleMessageEvent);

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
function showContextMenu(event: MouseEvent, items: ContextMenuElement[], sourceElem: HTMLElement) {
  event.preventDefault();
  const visibleItems = normalizeContextMenuItems(items);
  if (visibleItems.length === 0) {
    hideContextMenu();
    return;
  }

  let html = "";
  for (let i = 0; i < visibleItems.length; i++) {
    const item = visibleItems[i];
    if (item === null) {
      html += '<li class="contextMenuDivider" role="separator"></li>';
      continue;
    }

    const isCheckbox = item.checked !== undefined;
    const checkboxClass = isCheckbox ? " contextMenuItemCheckbox" : "";
    const checkboxAttributes = isCheckbox
      ? ` role="menuitemcheckbox" aria-checked="${item.checked === true}"`
      : ' role="menuitem"';
    const checkmark = item.checked === true ? "✓" : "";
    const checkbox = isCheckbox
      ? `<span class="contextMenuCheck" aria-hidden="true">${checkmark}</span>`
      : "";
    html += `<li class="contextMenuItem${checkboxClass}" data-index="${i}"${checkboxAttributes}>${checkbox}${item.title}</li>`;
  }

  hideContextMenuListener();
  contextMenu.style.opacity = "0";
  contextMenu.className = "active";
  contextMenu.innerHTML = html;
  const bounds = contextMenu.getBoundingClientRect();
  contextMenu.style.left = `${
    event.pageX - window.pageXOffset + bounds.width < window.innerWidth
      ? event.pageX - 2
      : event.pageX - bounds.width + 2
  }px`;
  contextMenu.style.top = `${
    event.pageY - window.pageYOffset + bounds.height < window.innerHeight
      ? event.pageY - 2
      : event.pageY - bounds.height + 2
  }px`;
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
  if (contextMenuSource !== null) {
    contextMenuSource.classList.remove("contextMenuActive");
    contextMenuSource = null;
  }
}

/* Dialogs */
function showConfirmationDialog(
  message: string,
  confirmed: () => void,
  sourceElem: HTMLElement | null
) {
  showDialog(
    message,
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

  if (textRefInput > -1) {
    bindTextRefDialogInput(textRefInput, actionName);
  }
}
function renderDialogForm(message: string, inputs: DialogInput[]) {
  const multiElementForm = inputs.length > 1;
  let textRefInput = -1;
  let html = `${message}<br><table class="dialogForm ${multiElementForm ? "multi" : "single"}">`;
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].type === "text-ref") textRefInput = i;
    html += renderDialogInputRow(inputs[i], i, multiElementForm);
  }
  return { html: `${html}</table>`, textRefInput };
}
function renderDialogInputRow(input: DialogInput, index: number, multiElementForm: boolean) {
  const labelCell = multiElementForm ? `<td>${input.name}</td>` : "";
  return `<tr>${labelCell}<td>${renderDialogInput(input, index, multiElementForm)}</td></tr>`;
}
function renderDialogInput(input: DialogInput, index: number, multiElementForm: boolean) {
  if (input.type === "select") return renderDialogSelectInput(input, index);
  if (input.type === "checkbox") return renderDialogCheckboxInput(input, index, multiElementForm);
  if (input.type === "textarea") return renderDialogTextareaInput(input, index);
  return renderDialogTextInput(input, index);
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
  return `<span class="dialogFormCheckbox"><label><input id="dialogInput${index}" type="checkbox"${checked}/>${label}</label></span>`;
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
  if (input.type === "select") return (<HTMLSelectElement>elem).value;
  if (input.type === "checkbox") return (<HTMLInputElement>elem).checked ? "checked" : "unchecked";
  if (input.type === "textarea") return (<HTMLTextAreaElement>elem).value;
  return (<HTMLInputElement>elem).value;
}
function bindTextRefDialogInput(textRefInput: number, actionName: string) {
  const dialogInput = <HTMLInputElement | null>(
    document.getElementById(`dialogInput${textRefInput}`)
  );
  const dialogAction = requireElement("dialogAction");
  if (dialogInput === null) return;
  if (dialogInput.value === "") dialog.className = "active noInput";
  dialogInput.focus();
  dialogInput.addEventListener("keyup", () => {
    const noInput = dialogInput.value === "";
    const invalidInput = refInvalid.exec(dialogInput.value) !== null;
    const newClassName = getTextRefDialogClassName(noInput, invalidInput);
    if (dialog.className !== newClassName) {
      dialog.className = newClassName;
      dialogAction.title = invalidInput ? l10n.invalidCharacters.replace("{0}", actionName) : "";
    }
  });
}
function getTextRefDialogClassName(noInput: boolean, invalidInput: boolean) {
  if (noInput) return "active noInput";
  if (invalidInput) return "active inputInvalid";
  return "active";
}
function showErrorDialog(message: string, reason: string | null, sourceElem: HTMLElement | null) {
  showDialog(
    `<span class="dialogErrorIcon">${svgIcons.alert}</span>` +
      message +
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
    `<span id="actionRunning">${svgIcons.loading}${command} ...</span>`,
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

/* Global Listeners */
document.addEventListener("keyup", (e) => {
  if (e.key === "Escape") hideDialogAndContextMenu();
});
document.addEventListener("click", hideContextMenuListener);
document.addEventListener("contextmenu", hideContextMenuListener);
document.addEventListener("mouseleave", hideContextMenuListener);
function hideContextMenuListener() {
  if (contextMenu.classList.contains("active")) hideContextMenu();
}
