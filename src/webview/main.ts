import type {
  GitCommandStatus,
  GitCommitDetails,
  GitCommitNode,
  GitCommitSearchResult,
  GitFileChangeType,
  GitQueryError,
  GitResetMode
} from "@/backend/types";
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
import { Dropdown } from "./dropdown";
import { Graph } from "./graph";
import { resolveGlobalShortcut } from "./keyboardShortcuts";
import { setStatusStrip } from "./statusStrip";
import { getMonth, pad2 } from "./utils/date";
import { addListenerToClass, blinkHeadRow, insertAfter } from "./utils/dom";
import { arraysEqual, ELLIPSIS, refInvalid } from "./utils/git";
import { escapeHtml, unescapeHtml } from "./utils/html";
import { svgIcons } from "./utils/icons";
import { getVSCodeStyle, sendMessage, vscode } from "./utils/vscode";

const searchHistoryMaxResults = 50;

const HIDEABLE_COLUMNS = ["date", "author", "commit"] as const;
type HideableColumn = (typeof HIDEABLE_COLUMNS)[number];
const COLUMN_HIDE_CLASSES: Record<HideableColumn, string> = {
  date: "hideDateCol",
  author: "hideAuthorCol",
  commit: "hideCommitCol"
};

function isHideableColumn(value: string): value is HideableColumn {
  return (HIDEABLE_COLUMNS as readonly string[]).includes(value);
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

class GitGraphView {
  private gitRepos: GG.GitRepoSet;
  private gitBranches: string[] = [];
  private gitBranchHead: string | null = null;
  private commits: GitCommitNode[] = [];
  private commitHead: string | null = null;
  private commitLookup: { [hash: string]: number } = {};
  private avatars: AvatarImageCollection = {};
  private currentBranch: string | null = null;
  private currentRepo: string = "";

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
  private readonly showRemoteBranchesElem: HTMLInputElement;
  private readonly scrollShadowElem: HTMLElement;
  private readonly findControlElem: HTMLElement;
  private readonly findInputElem: HTMLInputElement;
  private readonly findMatchCountElem: HTMLElement;
  private readonly findPreviousBtn: HTMLButtonElement;
  private readonly findNextBtn: HTMLButtonElement;
  private readonly findClearBtn: HTMLButtonElement;
  private readonly findSearchHistoryBtn: HTMLButtonElement;
  private findQuery = "";
  private findMatches: number[] = [];
  private activeFindMatchIndex = -1;
  private activeSearchCommitsRequestId: number | null = null;
  private activeSearchQuery: string | null = null;
  private pendingFocusCommitHash: string | null = null;

  private loadBranchesCallback: ((changes: boolean, isRepo: boolean) => void) | null = null;
  private loadCommitsCallback: ((changes: boolean) => void) | null = null;
  private nextRequestId = 1;
  private activeLoadBranchesRequestId: number | null = null;
  private activeLoadCommitsRequestId: number | null = null;

  constructor(
    repos: GG.GitRepoSet,
    lastActiveRepo: string | null,
    config: Config,
    prevState: WebViewState | null
  ) {
    this.gitRepos = repos;
    this.config = config;
    this.maxCommits = config.initialLoadCommits;
    this.graph = new Graph("commitGraph", this.config);
    this.tableElem = requireElement("commitTable");
    this.footerElem = requireElement("footer");
    this.repoDropdown = new Dropdown("repoSelect", true, l10n.repo, (value) => {
      this.currentRepo = value;
      this.maxCommits = this.config.initialLoadCommits;
      this.expandedCommit = null;
      this.currentBranch = null;
      this.saveState();
      sendMessage({ command: "selectRepo", repo: value });
      this.refresh(true);
    });
    this.branchDropdown = new Dropdown("branchSelect", false, l10n.branch, (value) => {
      this.currentBranch = value;
      this.maxCommits = this.config.initialLoadCommits;
      this.expandedCommit = null;
      this.saveState();
      this.renderShowLoading();
      this.requestLoadCommits(true, () => {});
    });
    this.showRemoteBranchesElem = requireElement<HTMLInputElement>("showRemoteBranchesCheckbox");
    this.showRemoteBranchesElem.addEventListener("change", () => {
      this.showRemoteBranches = this.showRemoteBranchesElem.checked;
      this.saveState();
      this.refresh(true);
    });
    this.scrollShadowElem = requireElement("scrollShadow");
    this.findControlElem = requireElement("findControl");
    this.findInputElem = requireElement<HTMLInputElement>("findInput");
    this.findMatchCountElem = requireElement("findMatchCount");
    this.findPreviousBtn = requireElement<HTMLButtonElement>("findPreviousBtn");
    this.findNextBtn = requireElement<HTMLButtonElement>("findNextBtn");
    this.findClearBtn = requireElement<HTMLButtonElement>("findClearBtn");
    this.findSearchHistoryBtn = requireElement<HTMLButtonElement>("findSearchHistoryBtn");
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
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
      this.refresh(true);
    });
    document.getElementById("blinkHeadBtn")?.addEventListener("click", () => {
      this.jumpToHead();
    });
    this.observeWindowSizeChanges();
    this.observeWebviewStyleChanges();
    this.observeWebviewScroll();
    document.addEventListener("keydown", (event) => {
      this.handleGlobalKeyboardShortcut(event);
    });

    this.renderShowLoading();
    if (prevState) {
      this.currentBranch = prevState.currentBranch;
      this.showRemoteBranches = prevState.showRemoteBranches;
      this.showRemoteBranchesElem.checked = this.showRemoteBranches;
      for (const column of prevState.hiddenColumns ?? []) {
        if (isHideableColumn(column)) this.hiddenColumns.add(column);
      }
      if (typeof this.gitRepos[prevState.currentRepo] !== "undefined") {
        this.currentRepo = prevState.currentRepo;
        this.maxCommits = prevState.maxCommits;
        this.expandedCommit = prevState.expandedCommit;
        if (this.expandedCommit !== null) {
          this.expandedCommit.detailsHeight = clampCommitDetailsHeight(
            this.expandedCommit.detailsHeight
          );
          this.expandedCommit.summaryOpen = this.expandedCommit.summaryOpen !== false;
          this.expandedCommit.filesOpen = this.expandedCommit.filesOpen !== false;
        }
        this.avatars = prevState.avatars;
        this.loadBranches(null, prevState.gitBranches, prevState.gitBranchHead, true, true);
        this.loadCommits(
          null,
          prevState.commits,
          prevState.commitHead,
          prevState.moreCommitsAvailable,
          true
        );
      }
    }
    this.loadRepos(this.gitRepos, lastActiveRepo);
    this.requestLoadBranchesAndCommits(false);
  }

  /* Loading Data */
  public loadRepos(repos: GG.GitRepoSet, lastActiveRepo: string | null) {
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
    for (let i = 0; i < repoPaths.length; i++) {
      const repoComps = repoPaths[i].split("/");
      options.push({ name: repoComps[repoComps.length - 1], value: repoPaths[i] });
    }
    const repoControl = document.getElementById("repoControl");
    if (repoControl !== null) {
      repoControl.style.display = repoPaths.length > 1 ? "inline" : "none";
    }
    this.repoDropdown.setOptions(options, this.currentRepo);

    if (changedRepo) {
      this.refresh(true);
    }
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
    if (
      this.currentBranch === null ||
      (this.currentBranch !== "" && this.gitBranches.indexOf(this.currentBranch) === -1)
    ) {
      this.currentBranch =
        this.config.showCurrentBranchByDefault && this.gitBranchHead !== null
          ? this.gitBranchHead
          : "";
    }
    this.saveState();

    this.branchDropdown.setOptions(this.getBranchDropdownOptions(), this.currentBranch);

    this.triggerLoadBranchesCallback(true, isRepo);
  }
  private getBranchDropdownOptions() {
    const options = [{ name: l10n.showAll, value: "" }];
    for (const branch of this.gitBranches) {
      options.push({
        name: branch.startsWith("remotes/") ? branch.substring(8) : branch,
        value: branch
      });
    }
    return options;
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
      arraysEqual(a.parentHashes, b.parentHashes, (pa, pb) => pa === pb)
    );
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
    for (let i = 0; i < avatarsElems.length; i++) {
      if (avatarsElems[i].dataset.email === escapedEmail) {
        avatarsElems[i].innerHTML = `<img class="avatarImg" src="${image}">`;
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
      showRemoteBranches: this.showRemoteBranches,
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
      branchName: this.currentBranch !== null ? this.currentBranch : "",
      maxCommits: this.maxCommits,
      showRemoteBranches: this.showRemoteBranches,
      hard: hard
    });
  }
  private requestLoadBranchesAndCommits(hard: boolean) {
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
    for (let i = 0; i < emails.length; i++) {
      sendMessage({
        command: "fetchAvatar",
        repo: this.currentRepo,
        email: emails[i],
        commits: avatars[emails[i]]
      });
    }
  }

  /* Find */
  private showFindWidget() {
    this.findControlElem.hidden = false;
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
      showRemoteBranches: this.showRemoteBranches
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
    this.currentBranch = "";
    this.branchDropdown.setOptions(this.getBranchDropdownOptions(), "");
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
    if (typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "center" });
    row.focus();
    blinkHeadRow(hash);
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
    this.revealCommit(this.commitHead);
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
      commits: this.commits,
      commitHead: this.commitHead,
      avatars: this.avatars,
      currentBranch: this.currentBranch,
      currentRepo: this.currentRepo,
      moreCommitsAvailable: this.moreCommitsAvailable,
      maxCommits: this.maxCommits,
      showRemoteBranches: this.showRemoteBranches,
      expandedCommit: this.expandedCommit,
      hiddenColumns: [...this.hiddenColumns]
    });
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
  private renderTable() {
    let html = this.renderTableHeader();
    const currentHash = this.getCurrentDisplayHash();
    const findMatchIndexes = new Set(this.findMatches);
    const activeFindCommitIndex = this.findMatches[this.activeFindMatchIndex] ?? -1;
    for (let i = 0; i < this.commits.length; i++) {
      html += this.renderCommitRow(i, currentHash, findMatchIndexes, activeFindCommitIndex);
    }
    if (this.commits.length === 0) {
      html += `<tr class="emptyGraphRow"><td colspan="5">${l10n.emptyGraph}</td></tr>`;
    }
    this.tableElem.innerHTML = `<table>${html}</table>`;
    this.renderLoadMoreFooter();
    this.makeTableResizable();
    this.restoreExpandedCommit();

    this.registerCommitContextMenuListener();
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
      showContextMenu(<MouseEvent>e, this.buildCommitContextMenu(hash, sourceElem), sourceElem);
    });
  }
  private buildCommitContextMenu(hash: string, sourceElem: HTMLElement): ContextMenuElement[] {
    return [
      {
        title: l10n.addTag + ELLIPSIS,
        onClick: () => this.showAddTagDialog(hash, sourceElem)
      },
      {
        title: l10n.createBranch + ELLIPSIS,
        onClick: () => this.showCreateBranchDialog(hash, sourceElem)
      },
      null,
      {
        title: l10n.checkout + ELLIPSIS,
        onClick: () => this.showCheckoutCommitDialog(hash, sourceElem)
      },
      {
        title: l10n.cherryPick + ELLIPSIS,
        onClick: () =>
          this.showParentCommitActionDialog(
            hash,
            sourceElem,
            "cherrypickCommit",
            l10n.dialogCherryPickConfirm,
            l10n.dialogYesCherryPick
          )
      },
      {
        title: l10n.revert + ELLIPSIS,
        onClick: () =>
          this.showParentCommitActionDialog(
            hash,
            sourceElem,
            "revertCommit",
            l10n.dialogRevertConfirm,
            l10n.dialogYesRevert
          )
      },
      null,
      {
        title: l10n.merge + ELLIPSIS,
        onClick: () => this.showMergeCommitDialog(hash)
      },
      {
        title: l10n.reset + ELLIPSIS,
        onClick: () => this.showResetCommitDialog(hash, sourceElem)
      },
      null,
      {
        title: l10n.copyCommitHash,
        onClick: () => {
          sendMessage({ command: "copyToClipboard", type: "Commit Hash", data: hash });
        }
      }
    ];
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
  private showMergeCommitDialog(hash: string) {
    showCheckboxDialog(
      l10n.dialogMergeConfirm
        .replace("{0}", `<b><i>${this.displayHash(hash)}</i></b>`)
        .replace("{1}", `<b>${l10n.labelCurrentBranch}</b>`),
      l10n.dialogMergeNoFastForward,
      true,
      l10n.dialogYesMerge,
      (createNewCommit) => {
        sendMessage({
          command: "mergeCommit",
          repo: this.currentRepo,
          commitHash: hash,
          createNewCommit
        });
      },
      null
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
      const sourceElem = closestHTMLElement(e.target, ".commit");
      const hash = sourceElem?.dataset.hash;
      if (sourceElem === null || hash === undefined) return;
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
    const copyType = isTag ? "Tag Name" : "Branch Name";
    const copyTitle = isTag ? l10n.copyTagName : l10n.copyBranchName;
    menu.push(null, {
      title: copyTitle,
      onClick: () => {
        sendMessage({ command: "copyToClipboard", type: copyType, data: refName });
      }
    });
    return menu;
  }
  private buildTagContextMenu(refName: string): ContextMenuElement[] {
    return [
      {
        title: l10n.deleteTag + ELLIPSIS,
        onClick: () => this.showDeleteTagDialog(refName)
      },
      {
        title: l10n.pushTag + ELLIPSIS,
        onClick: () => this.showPushTagDialog(refName)
      }
    ];
  }
  private buildBranchContextMenu(sourceElem: HTMLElement, refName: string): ContextMenuElement[] {
    if (!sourceElem.classList.contains("head")) {
      return [
        {
          title: l10n.checkoutBranch + ELLIPSIS,
          onClick: () => this.checkoutBranchAction(sourceElem, refName)
        }
      ];
    }

    const menu: ContextMenuElement[] = [];
    if (this.gitBranchHead !== refName) {
      menu.push({
        title: l10n.checkoutBranch,
        onClick: () => this.checkoutBranchAction(sourceElem, refName)
      });
    }
    menu.push({
      title: l10n.renameBranch + ELLIPSIS,
      onClick: () => this.showRenameBranchDialog(refName)
    });
    if (this.gitBranchHead !== refName) {
      menu.push(
        {
          title: l10n.deleteBranch + ELLIPSIS,
          onClick: () => this.showDeleteBranchDialog(refName)
        },
        {
          title: l10n.merge + ELLIPSIS,
          onClick: () => this.showMergeBranchDialog(refName)
        }
      );
    }
    return menu;
  }
  private showDeleteTagDialog(refName: string) {
    showConfirmationDialog(
      l10n.dialogDeleteConfirm
        .replace("{0}", l10n.labelTag)
        .replace("{1}", `<b><i>${escapeHtml(refName)}</i></b>`),
      () => {
        sendMessage({ command: "deleteTag", repo: this.currentRepo, tagName: refName });
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
    showCheckboxDialog(
      l10n.dialogDeleteConfirm
        .replace("{0}", l10n.labelBranch)
        .replace("{1}", `<b><i>${escapeHtml(refName)}</i></b>`),
      l10n.dialogDeleteForceDelete,
      false,
      l10n.deleteBranch,
      (forceDelete) => {
        sendMessage({
          command: "deleteBranch",
          repo: this.currentRepo,
          branchName: refName,
          forceDelete
        });
      },
      null
    );
  }
  private showMergeBranchDialog(refName: string) {
    showCheckboxDialog(
      l10n.dialogMergeConfirm
        .replace("{0}", `<b><i>${escapeHtml(refName)}</i></b>`)
        .replace("{1}", l10n.labelCurrentBranch),
      l10n.dialogMergeNoFastForward,
      true,
      l10n.dialogYesMerge,
      (createNewCommit) => {
        sendMessage({
          command: "mergeBranch",
          repo: this.currentRepo,
          branchName: refName,
          createNewCommit
        });
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
    return `<tr id="tableColHeaders"><th id="tableHeaderGraphCol" class="tableColHeader">${l10n.graph}</th><th class="tableColHeader">${l10n.description}</th><th class="tableColHeader">${l10n.date}</th><th class="tableColHeader">${l10n.author}</th><th class="tableColHeader">${l10n.commit}</th></tr>`;
  }
  private getCurrentDisplayHash() {
    return this.commits.length > 0 && this.commits[0].hash === "*" ? "*" : this.commitHead;
  }
  private renderCommitRow(
    index: number,
    currentHash: string | null,
    findMatchIndexes: Set<number>,
    activeFindCommitIndex: number
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
      activeFindCommitIndex
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
      "</td></tr>"
    );
  }
  private renderCommitRowAttributes(
    commit: GitCommitNode,
    index: number,
    isHeadCommit: boolean,
    findMatchIndexes: Set<number>,
    activeFindCommitIndex: number
  ) {
    if (commit.hash === "*") return 'class="unsavedChanges"';

    const currentAttribute = isHeadCommit ? ' aria-current="true"' : "";
    const rowClasses = ["commit"];
    if (commit.parentHashes.length > 1) rowClasses.push("mergeCommit");
    if (findMatchIndexes.has(index)) rowClasses.push("findMatch");
    if (activeFindCommitIndex === index) rowClasses.push("findMatchActive");
    return `class="${rowClasses.join(" ")}" tabindex="0" aria-selected="false"${currentAttribute} data-hash="${commit.hash}"`;
  }
  private renderCommitRefs(commit: GitCommitNode) {
    let refs = "";
    for (const ref of commit.refs) {
      const refName = escapeHtml(ref.name);
      const refActive = ref.type === "head" && ref.name === this.gitBranchHead;
      const refHtml =
        `<span class="gitRef ${ref.type}${refActive ? " active" : ""}" data-name="${refName}">` +
        (ref.type === "tag" ? svgIcons.tag : svgIcons.branch) +
        refName +
        "</span>";
      refs = refActive ? refHtml + refs : refs + refHtml;
    }
    return refs;
  }
  private renderCommitAvatar(commit: GitCommitNode) {
    if (!this.config.fetchAvatars) return "";

    const avatarImage = this.avatars[commit.email];
    const imageHtml =
      typeof avatarImage === "string" ? `<img class="avatarImg" src="${avatarImage}">` : "";
    return `<span class="avatar" data-email="${escapeHtml(commit.email)}">${imageHtml}</span>`;
  }
  private renderLoadMoreFooter() {
    this.footerElem.innerHTML = this.moreCommitsAvailable
      ? `<div id="loadMoreCommitsBtn" class="roundedBtn">${l10n.loadMore}</div>`
      : "";

    const loadMoreCommitsBtn = document.getElementById("loadMoreCommitsBtn");
    loadMoreCommitsBtn?.addEventListener("click", () => this.loadMoreCommits(loadMoreCommitsBtn));
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
    for (let i = 0; i < elems.length; i++) {
      const elem = elems[i];
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
      '</td><td title="* <>">*</td><td title="*">*</td>';
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
        ? `<p class="errorReason">${escapeHtml(reason).split("\n").join("<br>")}</p>`
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
        refNameComps[refNameComps.length - 1],
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
  private setTableLayout(layout: "fixedLayout" | "autoLayout") {
    const classes: string[] = [layout];
    for (const column of HIDEABLE_COLUMNS) {
      if (this.hiddenColumns.has(column)) classes.push(COLUMN_HIDE_CLASSES[column]);
    }
    this.tableElem.className = classes.join(" ");
  }
  private toggleColumnVisibility(column: HideableColumn) {
    if (this.hiddenColumns.has(column)) {
      this.hiddenColumns.delete(column);
    } else {
      this.hiddenColumns.add(column);
    }
    this.saveState();
    this.renderTable();
    this.renderGraph();
  }
  private buildColumnVisibilityMenu(): ContextMenuElement[] {
    const labels: Record<HideableColumn, string> = {
      date: l10n.date,
      author: l10n.author,
      commit: l10n.commit
    };
    return HIDEABLE_COLUMNS.map((column) => ({
      title: `${this.hiddenColumns.has(column) ? "" : "✓ "}${labels[column]}`,
      onClick: () => this.toggleColumnVisibility(column)
    }));
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

    const makeTableFixedLayout = () => {
      if (columnWidths !== null) {
        cols[0].style.width = `${columnWidths[0]}px`;
        cols[0].style.padding = "";
        cols[2].style.width = `${columnWidths[1]}px`;
        cols[3].style.width = `${columnWidths[2]}px`;
        cols[4].style.width = `${columnWidths[3]}px`;
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
          cols[4].clientWidth - 24
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
  private observeWebviewStyleChanges() {
    let fontFamily = getVSCodeStyle("--vscode-editor-font-family");
    new MutationObserver(() => {
      const ff = getVSCodeStyle("--vscode-editor-font-family");
      if (ff !== fontFamily) {
        fontFamily = ff;
        this.repoDropdown.refresh();
        this.branchDropdown.refresh();
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  }
  private observeWebviewScroll() {
    let active = window.scrollY > 0;
    this.scrollShadowElem.className = active ? "active" : "";
    document.addEventListener("scroll", () => {
      if (active !== window.scrollY > 0) {
        active = window.scrollY > 0;
        this.scrollShadowElem.className = active ? "active" : "";
      }
      this.autoLoadMoreCommitsOnScroll();
    });
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
      sections: expandedCommit
    });
    insertAfter(newElem, sourceElem);
    this.updateCommitDetailsResizeHandle();

    this.renderGraph();

    const detailsHeight = this.getCommitDetailsRenderedHeight();
    if (this.config.autoCenterCommitDetailsView) {
      window.scrollTo(
        0,
        newElem.offsetTop +
          40 +
          (detailsHeight + this.config.graphRowHeight) / 2 -
          window.innerHeight / 2
      );
    } else if (newElem.offsetTop + 8 < window.pageYOffset) {
      window.scrollTo(0, newElem.offsetTop + 8);
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
      const oldFilePath = sourceElem.dataset.oldfilepath;
      const newFilePath = sourceElem.dataset.newfilepath;
      const type = sourceElem.dataset.type;
      if (oldFilePath === undefined || newFilePath === undefined || type === undefined) return;
      sendMessage({
        command: "viewDiff",
        repo: this.currentRepo,
        commitHash: this.expandedCommit.hash,
        oldFilePath: decodeURIComponent(oldFilePath),
        newFilePath: decodeURIComponent(newFilePath),
        type: <GitFileChangeType>type
      });
    });
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
    fetchAvatars: viewState.fetchAvatars,
    graphColors: viewState.graphColors,
    graphFontSize: viewState.graphFontSize,
    graphRowHeight: viewState.graphRowHeight,
    graphStyle: viewState.graphStyle,
    grid: { x: 16, y: viewState.graphRowHeight, offsetX: 8, offsetY: 12, expandY: 250 },
    initialLoadCommits: viewState.initialLoadCommits,
    loadMoreCommits: viewState.loadMoreCommits,
    showCurrentBranchByDefault: viewState.showCurrentBranchByDefault,
    shortHashLength: viewState.shortHashLength
  },
  vscode.getState()
);

/* Command Processing */
window.addEventListener("message", (event) => {
  if (event.origin !== globalThis.location.origin) return;

  const msg: GG.ResponseMessage = event.data;
  switch (msg.command) {
    case "addTag":
      refreshGraphOrDisplayError(msg.status, l10n.unableToAddTag);
      break;
    case "checkoutBranch":
      refreshGraphOrDisplayError(msg.status, l10n.unableToCheckoutBranch);
      break;
    case "checkoutCommit":
      refreshGraphOrDisplayError(msg.status, l10n.unableToCheckoutCommit);
      break;
    case "cherrypickCommit":
      refreshGraphOrDisplayError(msg.status, l10n.unableToCherryPick);
      break;
    case "commitDetails":
      if (msg.commitDetails === null) {
        gitGraph.hideCommitDetails();
        showErrorDialog(l10n.unableToLoadCommitDetails, formatQueryError(msg.error), null);
      } else {
        gitGraph.showCommitDetails(
          msg.commitDetails,
          generateGitFileTree(msg.commitDetails.fileChanges, {
            compactFolders: viewState.commitDetailsCompactFolders
          })
        );
      }
      break;
    case "copyToClipboard":
      if (msg.success === false) {
        const typeLabel: Record<string, string> = {
          "Commit Hash": l10n.typeCommitHash,
          "Tag Name": l10n.typeTagName,
          "Branch Name": l10n.typeBranchName,
          "File Path": l10n.typeFilePath
        };
        showErrorDialog(
          l10n.unableToCopyToClipboard.replace("{0}", typeLabel[msg.type] ?? msg.type),
          null,
          null
        );
      }
      break;
    case "createBranch":
      refreshGraphOrDisplayError(msg.status, l10n.unableToCreateBranch);
      break;
    case "deleteBranch":
      refreshGraphOrDisplayError(msg.status, l10n.unableToDeleteBranch);
      break;
    case "deleteTag":
      refreshGraphOrDisplayError(msg.status, l10n.unableToDeleteTag);
      break;
    case "fetchAvatar":
      gitGraph.loadAvatar(msg.email, msg.image);
      break;
    case "loadBranches":
      gitGraph.loadBranches(
        msg.requestId,
        msg.branches,
        msg.head,
        msg.hard,
        msg.isRepo,
        formatQueryError(msg.error)
      );
      break;
    case "loadCommits":
      gitGraph.loadCommits(
        msg.requestId,
        msg.commits,
        msg.head,
        msg.moreCommitsAvailable,
        msg.hard,
        formatQueryError(msg.error)
      );
      break;
    case "loadRepos":
      gitGraph.loadRepos(msg.repos, msg.lastActiveRepo);
      break;
    case "searchCommits":
      gitGraph.loadSearchCommitResults(msg.requestId, msg.results, formatQueryError(msg.error));
      break;
    case "startHistorySearch":
      gitGraph.startHistorySearch();
      break;
    case "mergeBranch":
      refreshGraphOrDisplayError(msg.status, l10n.unableToMergeBranch);
      break;
    case "mergeCommit":
      refreshGraphOrDisplayError(msg.status, l10n.unableToMergeCommit);
      break;
    case "pushTag":
      refreshGraphOrDisplayError(msg.status, l10n.unableToPushTag);
      break;
    case "renameBranch":
      refreshGraphOrDisplayError(msg.status, l10n.unableToRenameBranch);
      break;
    case "refresh":
      gitGraph.refresh(false);
      break;
    case "resetToCommit":
      refreshGraphOrDisplayError(msg.status, l10n.unableToReset);
      break;
    case "revertCommit":
      refreshGraphOrDisplayError(msg.status, l10n.unableToRevert);
      break;
    case "viewDiff":
      if (msg.success === false) showErrorDialog(l10n.unableToViewDiff, null, null);
      break;
    case "openFile":
      if (msg.success === false) showErrorDialog(l10n.unableToOpenFile, null, null);
      break;
  }
});
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
    case "Relative": {
      let diff = Math.round(Date.now() / 1000) - dateVal;
      let unit: string;
      let unitPlural: string;
      if (diff < 60) {
        unit = l10n.timeSecond;
        unitPlural = l10n.timeSeconds;
      } else if (diff < 3600) {
        unit = l10n.timeMinute;
        unitPlural = l10n.timeMinutes;
        diff /= 60;
      } else if (diff < 86400) {
        unit = l10n.timeHour;
        unitPlural = l10n.timeHours;
        diff /= 3600;
      } else if (diff < 604800) {
        unit = l10n.timeDay;
        unitPlural = l10n.timeDays;
        diff /= 86400;
      } else if (diff < 2629800) {
        unit = l10n.timeWeek;
        unitPlural = l10n.timeWeeks;
        diff /= 604800;
      } else if (diff < 31557600) {
        unit = l10n.timeMonth;
        unitPlural = l10n.timeMonths;
        diff /= 2629800;
      } else {
        unit = l10n.timeYear;
        unitPlural = l10n.timeYears;
        diff /= 31557600;
      }
      diff = Math.round(diff);
      value = `${diff} ${diff !== 1 ? unitPlural : unit} ${l10n.timeAgo}`;
      break;
    }
    default:
      value = `${dateStr} ${timeStr}`;
  }
  return { title: `${dateStr} ${timeStr}`, value: value };
}

/* Context Menu */
function showContextMenu(e: MouseEvent, items: ContextMenuElement[], sourceElem: HTMLElement) {
  let html = "",
    i: number,
    event = <MouseEvent>e;
  for (i = 0; i < items.length; i++) {
    html +=
      items[i] !== null
        ? `<li class="contextMenuItem" data-index="${i}">${items[i]?.title}</li>`
        : '<li class="contextMenuDivider"></li>';
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
    if (!(ev.target instanceof HTMLElement) || ev.target.dataset.index === undefined) return;
    items[Number.parseInt(ev.target.dataset.index, 10)]?.onClick();
  });

  contextMenuSource = sourceElem;
  contextMenuSource.classList.add("contextMenuActive");
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
        ? `<span class="errorReason">${escapeHtml(reason).split("\n").join("<br>")}</span>`
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
