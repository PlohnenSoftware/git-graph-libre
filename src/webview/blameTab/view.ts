import type { GitBlameCommit } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import type { BlameHotspotMode } from "@/blameHotspot";
import type {
  BlameCommitPopoverMessage,
  BlameHunkView,
  BlameLabels,
  BlameNavigateDirection,
  BlameOptions
} from "@/blameTabTypes";
import { octicon } from "@/octicons";
import { worktreeFolderName } from "../utils/git";
import { clampGutterWidth, DEFAULT_GUTTER_WIDTH, resizeGutterWidth } from "./columnResize";
import {
  type BlamePopoverContext,
  type BlamePopoverDiffRequest,
  createBlamePopover
} from "./popover";
import {
  applyFindQuery,
  type BlameViewState,
  closeFind,
  commitDate,
  heatAttribute,
  normalizeHotspotMode,
  openFind,
  stepFindMatch
} from "./rowModel";

export type BlameRewindTarget = {
  rev: string;
  filePath: string;
  targetLine: number | null;
};

export type BlameViewCallbacks = {
  /** A gutter drag ended with this width; the caller keeps it per repo. */
  onGutterWidthChange?: (width: number) => void;
  /** The user picked a hotspot mode in the header; the caller keeps it and re-renders. */
  onHotspotModeChange?: (mode: BlameHotspotMode) => void;
  /** The user clicked "Blame HEAD" from an unsaved dirty editor buffer (BQ6). */
  onBlameHead?: () => void;
  /** The user clicked "View latest" after the repository changed on a pinned commit. */
  onBlameLatest?: () => void;
  /** The user clicked "Open File" from an untracked or unborn notice state. */
  onOpenFile?: () => void;
  /** The user clicked "View blame prior to this change" on a hunk (F4-05). */
  onRewind?: (target: BlameRewindTarget) => void;
  /** The user clicked Back, Forward, or Latest in the header (F4-05). */
  onNavigate?: (direction: BlameNavigateDirection) => void;
  /** The user toggled `-w`, `-M`, `-C` or `.git-blame-ignore-revs` in the header (F4-05). */
  onOptionsChange?: (options: Partial<BlameOptions>, visibleLine: number | null) => void;
  /** The user requested ignoring a commit for this session (F4-05 / F4-06). */
  onIgnoreCommit?: (commitHash: string, visibleLine: number | null) => void;
  /** The user removed one session ignored commit chip, or cleared all (`null`) (F4-05). */
  onClearIgnoredCommit?: (commitHash: string | null, visibleLine: number | null) => void;
  /** Find state changed inside the view; the caller updates its stored state (F4-05). */
  onFindStateChange?: (state: BlameViewState) => void;
  /** The popover opened for a commit; fetch its full details by request id (F4-06). */
  onLoadCommitPopover?: (commitHash: string, requestId: number) => void;
  /** The user asked to reveal a hunk's commit in the graph (F4-06). */
  onShowCommitInGraph?: (commitHash: string) => void;
  /** The user asked for a hunk commit's file diff (F4-06). */
  onOpenCommitFileDiff?: (request: BlamePopoverDiffRequest) => void;
  /** The user clicked a line number or the popover's open-at-line action (F4-06). */
  onOpenFileAtLine?: (line: number) => void;
  /** The user asked to copy a commit's hash or full message (F4-06). */
  onCopyText?: (kind: "hash" | "message", commitHash: string) => void;
};

/** The ten heat steps, coldest first: the legend draws one swatch for each. */
const HEAT_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The selector's order, the way the header lists the modes. */
const HOTSPOT_MODE_ORDER: readonly BlameHotspotMode[] = ["age", "calendar", "churn", "off"];

function modeLabel(mode: BlameHotspotMode, labels: BlameLabels): string {
  switch (mode) {
    case "calendar":
      return labels.heatCalendar;
    case "churn":
      return labels.heatChurn;
    case "off":
      return labels.heatOff;
    default:
      return labels.heatAge;
  }
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function folderName(repo: string): string {
  return worktreeFolderName(repo);
}

/** The 1-based line currently at the top of `.blame-scroll`, or `state.targetLine`. */
function currentVisibleLine(root: HTMLElement, state: BlameViewState): number | null {
  const scroll = root.querySelector<HTMLElement>(".blame-scroll");
  if (scroll !== null && scroll.scrollTop > 0 && state.typography.lineHeight > 0) {
    const estimated = Math.floor(scroll.scrollTop / state.typography.lineHeight) + 1;
    const cap = state.totalLines > 0 ? state.totalLines : estimated;
    return Math.max(1, Math.min(cap, estimated));
  }
  return state.targetLine;
}

/**
 * The heat legend and the mode selector, shown beside the header's
 * revision badge once lines are on screen. The swatches reuse the
 * `--ngg-blame-heat-N` tokens through `.blame-heat-swatch-N`; "Off"
 * draws no scale, only the selector that brings it back.
 */
function heatControls(
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks
): HTMLElement {
  const group = element("div", "blame-heat");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", labels.heatLegend);
  if (state.hotspotMode !== "off") {
    group.append(element("span", "blame-heat-end", labels.heatOlder));
    const scale = element("span", "blame-heat-scale");
    scale.setAttribute("aria-hidden", "true");
    for (const step of HEAT_STEPS) {
      scale.append(element("span", `blame-heat-swatch blame-heat-swatch-${step}`));
    }
    group.append(scale, element("span", "blame-heat-end", labels.heatNewer));
  }
  const select = element("select", "blame-heat-select");
  select.setAttribute("aria-label", labels.heatMode);
  select.title = labels.heatMode;
  for (const mode of HOTSPOT_MODE_ORDER) {
    const option = element("option", "", modeLabel(mode, labels));
    option.value = mode;
    option.selected = mode === state.hotspotMode;
    select.append(option);
  }
  select.addEventListener("change", () => {
    callbacks.onHotspotModeChange?.(normalizeHotspotMode(select.value));
  });
  group.append(select);
  return group;
}

function actionButton(className: string, label: string, onClick?: () => void): HTMLButtonElement {
  const button = element("button", `blame-action-btn ${className}`, label);
  button.type = "button";
  button.addEventListener("click", () => onClick?.());
  return button;
}

/** The revision badge's text and hover: unsaved buffer, short hash, asked revision, or working tree. */
function revBadge(state: BlameViewState, labels: BlameLabels): { value: string; title: string } {
  if (state.unsavedBuffer) {
    return {
      value: labels.unsavedBuffer,
      title:
        state.resolvedRev !== null
          ? `${labels.unsavedBuffer} (${state.resolvedRev})`
          : labels.unsavedBuffer
    };
  }
  if (state.resolvedRev !== null) {
    return {
      value: abbrevCommit(state.resolvedRev, state.display.shortHashLength),
      title: state.resolvedRev
    };
  }
  if (state.rev !== null) return { value: state.rev, title: state.rev };
  return { value: labels.workingTree, title: labels.workingTree };
}

function repoBadge(state: BlameViewState, labels: BlameLabels): HTMLElement | null {
  if (state.repoMeta.linkedWorktree) {
    const badge = element("span", "blame-worktree-badge", labels.worktree);
    badge.title = state.repo;
    return badge;
  }
  if (state.repoMeta.bare) {
    const badge = element("span", "blame-bare-badge", labels.bare);
    badge.title = state.repo;
    return badge;
  }
  return null;
}

/**
 * Header Back, Forward, and Latest navigation controls (F4-05), shown
 * whenever the navigation stack has entries (`backCount + forwardCount > 0`)
 * or a historical revision / renamed path is pinned (`rev !== null` or
 * `canLatest`).
 */
function navControls(
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks
): HTMLElement | null {
  const { navigation } = state;
  const showNav =
    navigation.backCount > 0 ||
    navigation.forwardCount > 0 ||
    state.rev !== null ||
    navigation.canLatest;
  if (!showNav) return null;

  const nav = element("div", "blame-nav");
  nav.setAttribute("role", "group");

  const back = element("button", "blame-nav-btn blame-nav-back");
  back.type = "button";
  back.disabled = navigation.backCount === 0;
  back.title = labels.navBack;
  back.setAttribute("aria-label", labels.navBack);
  back.innerHTML = octicon("arrow-left");
  back.append(element("span", "blame-nav-label", labels.navBack));
  back.addEventListener("click", () => callbacks.onNavigate?.("back"));

  const forward = element("button", "blame-nav-btn blame-nav-forward");
  forward.type = "button";
  forward.disabled = navigation.forwardCount === 0;
  forward.title = labels.navForward;
  forward.setAttribute("aria-label", labels.navForward);
  forward.innerHTML = octicon("arrow-right");
  forward.append(element("span", "blame-nav-label", labels.navForward));
  forward.addEventListener("click", () => callbacks.onNavigate?.("forward"));

  const latest = element("button", "blame-nav-btn blame-nav-latest", labels.navLatest);
  latest.type = "button";
  latest.disabled = !navigation.canLatest;
  latest.title = labels.navLatestTitle;
  latest.setAttribute("aria-label", labels.navLatest);
  latest.addEventListener("click", () => callbacks.onNavigate?.("latest"));

  nav.append(back, forward, latest);
  return nav;
}

function optionToggleButton(
  className: string,
  optionKey: keyof BlameOptions,
  shortText: string,
  fullLabel: string,
  active: boolean,
  onToggle: () => void
): HTMLButtonElement {
  const btn = element(
    "button",
    active ? `blame-option-toggle ${className} is-active` : `blame-option-toggle ${className}`,
    shortText
  );
  btn.type = "button";
  btn.dataset.option = optionKey;
  btn.title = fullLabel;
  btn.setAttribute("aria-label", fullLabel);
  btn.setAttribute("aria-pressed", String(active));
  btn.addEventListener("click", onToggle);
  return btn;
}

function ignoredCommitsGroup(
  root: HTMLElement,
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks
): HTMLElement {
  const list = element("div", "blame-ignored-commits");
  for (const hash of state.ignoreRevs) {
    const shortHash = abbrevCommit(hash, state.display.shortHashLength);
    const chip = element("span", "blame-chip blame-ignore-rev-chip");
    chip.dataset.ignoreRev = hash;
    chip.title = hash;
    chip.append(
      element("span", "blame-chip-text", labels.ignoringCommit.replace("{0}", shortHash))
    );
    const remove = element("button", "blame-chip-remove");
    remove.type = "button";
    const removeLabel = labels.removeIgnoredCommit.replace("{0}", shortHash);
    remove.title = removeLabel;
    remove.setAttribute("aria-label", removeLabel);
    remove.innerHTML = octicon("x");
    remove.addEventListener("click", () => {
      callbacks.onClearIgnoredCommit?.(hash, currentVisibleLine(root, state));
    });
    chip.append(remove);
    list.append(chip);
  }
  const clearAll = element("button", "blame-clear-ignored-btn", labels.clearIgnoredCommits);
  clearAll.type = "button";
  clearAll.title = labels.clearIgnoredCommits;
  clearAll.setAttribute("aria-label", labels.clearIgnoredCommits);
  clearAll.addEventListener("click", () => {
    callbacks.onClearIgnoredCommit?.(null, currentVisibleLine(root, state));
  });
  list.append(clearAll);
  return list;
}

/**
 * Header blame option toggles (`-w`, `-M`, `-C`), the `.git-blame-ignore-revs`
 * toggle chip (when the file exists at the repo root), removable session
 * `--ignore-rev` chips with "Clear all", and the in-tab Find toggle (F4-05).
 */
function optionControls(
  root: HTMLElement,
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks,
  onToggleFind: () => void
): HTMLElement {
  const group = element("div", "blame-options");
  const toggleOption = (patch: Partial<BlameOptions>) => {
    callbacks.onOptionsChange?.(patch, currentVisibleLine(root, state));
  };

  group.append(
    optionToggleButton(
      "blame-option-w",
      "ignoreWhitespace",
      "-w",
      labels.optionIgnoreWhitespace,
      state.options.ignoreWhitespace,
      () => toggleOption({ ignoreWhitespace: !state.options.ignoreWhitespace })
    ),
    optionToggleButton(
      "blame-option-m",
      "detectMoves",
      "-M",
      labels.optionDetectMoves,
      state.options.detectMoves,
      () => toggleOption({ detectMoves: !state.options.detectMoves })
    ),
    optionToggleButton(
      "blame-option-c",
      "detectCopies",
      "-C",
      labels.optionDetectCopies,
      state.options.detectCopies,
      () => toggleOption({ detectCopies: !state.options.detectCopies })
    )
  );

  if (state.hasIgnoreRevsFile) {
    const active = state.options.useIgnoreRevsFile;
    const text = active ? labels.ignoringRevsFile : labels.ignoreRevsFileOff;
    const chip = element(
      "button",
      active
        ? "blame-chip blame-ignore-revs-file-chip is-active"
        : "blame-chip blame-ignore-revs-file-chip",
      text
    );
    chip.type = "button";
    chip.dataset.option = "useIgnoreRevsFile";
    chip.title = text;
    chip.setAttribute("aria-label", text);
    chip.setAttribute("aria-pressed", String(active));
    chip.addEventListener("click", () => toggleOption({ useIgnoreRevsFile: !active }));
    group.append(chip);
  }

  if (state.ignoreRevs.length > 0) {
    group.append(ignoredCommitsGroup(root, state, labels, callbacks));
  }

  if (state.blameState === "lines") {
    const findBtn = element(
      "button",
      state.findOpen
        ? "blame-option-toggle blame-find-toggle is-active"
        : "blame-option-toggle blame-find-toggle"
    );
    findBtn.type = "button";
    findBtn.title = labels.findToggle;
    findBtn.setAttribute("aria-label", labels.findToggle);
    findBtn.setAttribute("aria-expanded", String(state.findOpen));
    findBtn.setAttribute("aria-pressed", String(state.findOpen));
    findBtn.innerHTML = octicon("search");
    findBtn.addEventListener("click", onToggleFind);
    group.append(findBtn);
  }

  return group;
}

function header(
  root: HTMLElement,
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks,
  onToggleFind: () => void
): HTMLElement {
  const bar = element("header", "blame-header");
  const repo = element("span", "blame-repo", folderName(state.repo));
  repo.title = state.repo;
  const kindBadge = repoBadge(state, labels);
  if (kindBadge !== null) bar.append(kindBadge);
  const path = element("span", "blame-path", state.filePath);
  path.title = state.filePath;
  bar.append(repo, path);

  const initialPath = state.navigation.initialFilePath;
  if (initialPath !== "" && state.filePath !== initialPath) {
    const renamed = element("span", "blame-rename-notice");
    renamed.dataset.initialPath = initialPath;
    renamed.title = `${state.filePath} → ${initialPath}`;
    const icon = element("span", "blame-rename-icon");
    icon.innerHTML = octicon("file-moved");
    const text = element(
      "span",
      "blame-rename-text",
      labels.renamedFrom.replace("{0}", initialPath)
    );
    renamed.append(icon, text);
    bar.append(renamed);
  }

  const badge = revBadge(state, labels);
  const rev = element(
    "span",
    state.unsavedBuffer ? "blame-rev blame-unsaved-pill" : "blame-rev",
    badge.value
  );
  rev.title = badge.title;
  const count = element(
    "span",
    "blame-line-count",
    labels.lineCount.replace("{0}", state.totalLines.toLocaleString(state.locale))
  );
  bar.append(rev);
  if (state.unsavedBuffer) {
    bar.append(actionButton("blame-head-btn", labels.blameHead, callbacks.onBlameHead));
  }
  if (state.repoChanged) {
    const notice = element("span", "blame-repo-changed");
    notice.setAttribute("role", "status");
    notice.append(
      element("span", "blame-repo-changed-text", labels.repoChanged),
      actionButton("blame-latest-btn", labels.viewLatest, callbacks.onBlameLatest)
    );
    bar.append(notice);
  }
  bar.append(count);

  const nav = navControls(state, labels, callbacks);
  if (nav !== null) bar.append(nav);

  const showOptions =
    state.blameState === "lines" ||
    state.hasIgnoreRevsFile ||
    state.ignoreRevs.length > 0 ||
    state.options.ignoreWhitespace ||
    state.options.detectMoves ||
    state.options.detectCopies;
  if (showOptions) {
    bar.append(optionControls(root, state, labels, callbacks, onToggleFind));
  }

  if (state.blameState === "lines") bar.append(heatControls(state, labels, callbacks));
  return bar;
}

function findBarElement(
  state: BlameViewState,
  labels: BlameLabels,
  onQuery: (query: string) => void,
  onStep: (delta: 1 | -1) => void,
  onClose: () => void
): HTMLElement {
  const bar = element("div", state.findOpen ? "blame-find-bar is-open" : "blame-find-bar");
  bar.setAttribute("role", "search");
  bar.hidden = !state.findOpen;

  const input = element("input", "blame-find-input");
  input.id = "blameFindInput";
  input.type = "search";
  input.value = state.findQuery;
  input.placeholder = labels.findPlaceholder;
  input.setAttribute("aria-label", labels.findPlaceholder);
  input.addEventListener("input", () => onQuery(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onStep(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  });

  const total = state.findMatches.length;
  const current = total > 0 && state.findActiveIndex >= 0 ? state.findActiveIndex + 1 : 0;
  const countText = labels.findCount.replace("{0}", String(current)).replace("{1}", String(total));
  const counter = element("span", "blame-find-count", countText);
  counter.setAttribute("aria-live", "polite");

  const prev = element("button", "blame-find-btn blame-find-prev");
  prev.type = "button";
  prev.disabled = total === 0;
  prev.title = labels.findPrev;
  prev.setAttribute("aria-label", labels.findPrev);
  prev.innerHTML = octicon("arrow-up");
  prev.addEventListener("click", () => onStep(-1));

  const next = element("button", "blame-find-btn blame-find-next");
  next.type = "button";
  next.disabled = total === 0;
  next.title = labels.findNext;
  next.setAttribute("aria-label", labels.findNext);
  next.innerHTML = octicon("arrow-down");
  next.addEventListener("click", () => onStep(1));

  const close = element("button", "blame-find-btn blame-find-close");
  close.type = "button";
  close.title = labels.findClose;
  close.setAttribute("aria-label", labels.findClose);
  close.innerHTML = octicon("x");
  close.addEventListener("click", onClose);

  bar.append(input, counter, prev, next, close);
  return bar;
}

function messageBlock(className: string, text: string, role?: string): HTMLElement {
  const block = element("p", className, text);
  if (role !== undefined) block.setAttribute("role", role);
  return block;
}

function noticeWithOpenFile(
  className: string,
  text: string,
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks
): HTMLElement {
  const notice = element("div", "blame-state-notice");
  notice.append(messageBlock(className, text));
  if (!state.repoMeta.bare) {
    notice.append(actionButton("blame-open-file-btn", labels.openFile, callbacks.onOpenFile));
  }
  return notice;
}

/** The word for a non-line state, each one distinct from an error. */
function stateBlock(
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks
): HTMLElement | null {
  switch (state.blameState) {
    case "empty":
      return messageBlock("blame-message blame-empty", labels.empty);
    case "binary":
      return messageBlock("blame-message blame-binary", labels.binary);
    case "tooLarge":
      return messageBlock("blame-message blame-too-large", labels.tooLarge);
    case "untracked":
      return noticeWithOpenFile(
        "blame-message blame-untracked",
        labels.untracked,
        state,
        labels,
        callbacks
      );
    case "unborn":
      return noticeWithOpenFile(
        "blame-message blame-unborn",
        labels.unborn,
        state,
        labels,
        callbacks
      );
    case "bareWorkingTree":
      return messageBlock("blame-message blame-bare-working-tree", labels.bareWorkingTree);
    default:
      return null;
  }
}

/**
 * Per-hunk "View blame prior to this change" rewind button (F4-05).
 * Enabled on committed hunks with `previous: { hash, path }` and
 * `boundary !== true`; disabled with the `"Initial commit for this file"`
 * tooltip on boundary or `previous === null` hunks.
 */
function rewindButton(
  hunk: BlameHunkView,
  commit: GitBlameCommit | undefined,
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks
): HTMLButtonElement {
  const canRewind = commit?.boundary !== true && hunk.previous !== null;
  if (canRewind && hunk.previous !== null) {
    const previous = hunk.previous;
    const shortPrev = abbrevCommit(previous.hash, state.display.shortHashLength);
    const tip =
      previous.path !== state.filePath
        ? labels.rewindToPath.replace("{0}", shortPrev).replace("{1}", previous.path)
        : labels.rewindTo.replace("{0}", shortPrev);
    const rewindBtn = element("button", "blame-rewind-btn");
    rewindBtn.type = "button";
    rewindBtn.title = tip;
    rewindBtn.setAttribute("aria-label", tip);
    rewindBtn.dataset.previousHash = previous.hash;
    rewindBtn.dataset.previousPath = previous.path;
    rewindBtn.dataset.origStartLine = String(hunk.origStartLine);
    rewindBtn.innerHTML = octicon("versions");
    rewindBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onRewind?.({
        rev: previous.hash,
        filePath: previous.path,
        targetLine: hunk.origStartLine
      });
    });
    return rewindBtn;
  }
  const btn = element("button", "blame-rewind-btn is-boundary");
  btn.type = "button";
  btn.disabled = true;
  btn.title = labels.initialCommit;
  btn.setAttribute("aria-label", labels.initialCommit);
  btn.innerHTML = octicon("versions");
  return btn;
}

function gutterElement(
  hunk: BlameHunkView,
  commit: GitBlameCommit | undefined,
  state: BlameViewState,
  labels: BlameLabels,
  now: Date,
  callbacks: BlameViewCallbacks
): HTMLElement {
  const gutter = element("div", "blame-gutter");
  const uncommitted = commit?.uncommitted === true || hunk.heat.uncommitted;
  if (uncommitted) {
    // No fake hash, no date, and no rewind button: the all-zero OID is not a commit.
    const head = element(
      "button",
      "blame-summary blame-uncommitted blame-popover-trigger",
      labels.uncommitted
    );
    head.type = "button";
    head.title = labels.showCommitDetails;
    head.setAttribute("aria-haspopup", "dialog");
    gutter.append(head);
  } else if (commit !== undefined) {
    const head = element("div", "blame-gutter-head");
    const summary = element("button", "blame-summary blame-popover-trigger", commit.summary);
    summary.type = "button";
    summary.title = commit.summary;
    summary.setAttribute("aria-label", `${labels.showCommitDetails}: ${commit.summary}`);
    summary.setAttribute("aria-haspopup", "dialog");
    head.append(summary, rewindButton(hunk, commit, state, labels, callbacks));

    const meta = element("div", "blame-meta");
    const author = element("span", "blame-author", commit.author);
    author.title =
      commit.authorMail === "" ? commit.author : `${commit.author} <${commit.authorMail}>`;
    const hash = element(
      "code",
      "blame-hash",
      abbrevCommit(commit.hash, state.display.shortHashLength)
    );
    hash.title = commit.hash;
    hash.setAttribute("aria-label", `${labels.columnCommit} ${commit.hash}`);
    const shown = commitDate(commit, state.display, now, state.locale);
    const date = element("span", "blame-date", shown.value);
    date.title = shown.title;
    date.setAttribute("aria-label", `${labels.columnDate} ${shown.title}`);
    meta.append(author, hash, date);
    gutter.append(head, meta);
  } else {
    // A hunk whose commit the payload does not carry: the hash is all
    // that can honestly be shown for it.
    const head = element("div", "blame-gutter-head");
    const hash = element(
      "button",
      "blame-hash blame-popover-trigger",
      abbrevCommit(hunk.commitHash, state.display.shortHashLength)
    );
    hash.type = "button";
    hash.title = hunk.commitHash;
    hash.setAttribute("aria-label", `${labels.showCommitDetails}: ${hunk.commitHash}`);
    hash.setAttribute("aria-haspopup", "dialog");
    head.append(hash, rewindButton(hunk, undefined, state, labels, callbacks));
    gutter.append(head);
  }
  const handle = element("span", "blame-gutter-resize");
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", labels.resizeGutter);
  handle.title = labels.resizeGutter;
  gutter.append(handle);
  return gutter;
}

type FindHighlights = {
  matchedHunks: Set<number>;
  matchedLines: Set<number>;
  activeHunkIndex: number;
  activeLine: number;
};

function buildFindHighlights(state: BlameViewState): FindHighlights {
  const matchedHunks = new Set<number>();
  const matchedLines = new Set<number>();
  for (const match of state.findMatches) {
    matchedHunks.add(match.hunkIndex);
    matchedLines.add(match.line);
  }
  const active = state.findActiveIndex >= 0 ? state.findMatches[state.findActiveIndex] : undefined;
  return {
    matchedHunks,
    matchedLines,
    activeHunkIndex: active?.hunkIndex ?? -1,
    activeLine: active?.line ?? -1
  };
}

function hunkElement(
  hunk: BlameHunkView,
  hunkIndex: number,
  state: BlameViewState,
  labels: BlameLabels,
  now: Date,
  highlights: FindHighlights,
  callbacks: BlameViewCallbacks
): HTMLElement {
  const band = element("section", "blame-hunk");
  // One keyboard stop per hunk: focusing it marks the commit's other hunks.
  band.tabIndex = 0;
  band.dataset.commit = hunk.commitHash;
  band.dataset.heat = heatAttribute(hunk);
  band.dataset.startLine = String(hunk.startLine);
  band.dataset.hunkIndex = String(hunkIndex);
  if (highlights.matchedHunks.has(hunkIndex)) band.classList.add("is-find-match");
  if (highlights.activeHunkIndex === hunkIndex) band.classList.add("is-find-active-hunk");

  const source = element("div", "blame-source");
  for (const line of hunk.lines) {
    const row = element("div", "blame-line");
    row.dataset.line = String(line.finalLine);
    if (state.targetLine === line.finalLine) row.classList.add("blame-target-line");
    if (highlights.matchedLines.has(line.finalLine)) row.classList.add("is-find-match");
    if (highlights.activeLine === line.finalLine) row.classList.add("is-find-active");
    const number = element("button", "blame-line-number", String(line.finalLine));
    number.type = "button";
    number.title = labels.openFileAtLine;
    number.setAttribute("aria-label", `${labels.openFileAtLine}: ${line.finalLine}`);
    const text = element("span", "blame-line-text", line.content);
    row.append(number, text);
    source.append(row);
  }
  band.append(
    gutterElement(hunk, state.commits[hunk.commitHash], state, labels, now, callbacks),
    source
  );
  return band;
}

function bodyElement(
  state: BlameViewState,
  labels: BlameLabels,
  now: Date,
  callbacks: BlameViewCallbacks
): HTMLElement {
  const scroll = element("div", "blame-scroll");
  const body = element("div", "blame-body");
  const highlights = buildFindHighlights(state);
  state.hunks.forEach((hunk, hunkIndex) => {
    body.append(hunkElement(hunk, hunkIndex, state, labels, now, highlights, callbacks));
  });
  scroll.append(body);

  // Dragging any gutter's right edge restyles this body alone (as the
  // reflog drag restyles its table): hunks are never rebuilt by a resize.
  let width = clampGutterWidth(state.gutterWidth ?? DEFAULT_GUTTER_WIDTH);
  const applyWidth = () => {
    body.style.setProperty("--blame-gutter-width", `${width}px`);
  };
  applyWidth();
  let dragging = false;
  let mouseX = 0;
  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    body.classList.remove("resizing");
    callbacks.onGutterWidthChange?.(width);
  };
  body.addEventListener("mousedown", (event) => {
    const handle =
      event.target instanceof HTMLElement ? event.target.closest(".blame-gutter-resize") : null;
    if (!(handle instanceof HTMLElement)) return;
    dragging = true;
    mouseX = event.clientX;
    body.classList.add("resizing");
  });
  body.addEventListener("mousemove", (event) => {
    if (!dragging) return;
    width = resizeGutterWidth(width, event.clientX - mouseX);
    mouseX = event.clientX;
    applyWidth();
  });
  body.addEventListener("mouseup", stopDragging);
  body.addEventListener("mouseleave", stopDragging);
  bindSameCommitHighlight(body);
  return scroll;
}

/**
 * Hovering or keyboard-focusing a hunk marks every hunk in the file that
 * names the same commit (`is-same-commit`), so a commit's footprint shows
 * across non-adjacent lines. One marked commit at a time; leaving the body
 * or the focused hunk clears it.
 */
function bindSameCommitHighlight(body: HTMLElement): void {
  let marked: string | null = null;
  const bandOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(".blame-hunk") : null;
  const mark = (commitHash: string | null): void => {
    if (commitHash === marked) return;
    marked = commitHash;
    for (const band of body.querySelectorAll<HTMLElement>(".blame-hunk")) {
      band.classList.toggle(
        "is-same-commit",
        commitHash !== null && band.dataset.commit === commitHash
      );
    }
  };
  const enter = (event: Event) => mark(bandOf(event.target)?.dataset.commit ?? null);
  body.addEventListener("mouseover", enter);
  body.addEventListener("focusin", enter);
  // Focus moving between two hunks re-marks on the new one's focusin.
  body.addEventListener("focusout", (event) => {
    if (bandOf(event.relatedTarget) === null) mark(null);
  });
  body.addEventListener("mouseleave", () => mark(null));
}

function sameHunk(prev: BlameHunkView, next: BlameHunkView): boolean {
  if (
    prev.commitHash !== next.commitHash ||
    prev.startLine !== next.startLine ||
    prev.lineCount !== next.lineCount ||
    prev.heat.level !== next.heat.level ||
    prev.heat.uncommitted !== next.heat.uncommitted
  ) {
    return false;
  }
  for (let index = 0; index < prev.lines.length; index += 1) {
    if (
      prev.lines[index].finalLine !== next.lines[index].finalLine ||
      prev.lines[index].content !== next.lines[index].content
    ) {
      return false;
    }
  }
  return true;
}

function sameRenderedMeta(prev: BlameViewState, next: BlameViewState): boolean {
  return (
    prev.loading === next.loading &&
    prev.error === next.error &&
    prev.blameState === "lines" &&
    next.blameState === "lines" &&
    prev.repo === next.repo &&
    prev.filePath === next.filePath &&
    prev.rev === next.rev &&
    prev.targetLine === next.targetLine &&
    prev.locale === next.locale &&
    prev.hotspotMode === next.hotspotMode &&
    prev.gutterWidth === next.gutterWidth &&
    prev.display.shortHashLength === next.display.shortHashLength &&
    prev.display.dateFormat === next.display.dateFormat &&
    prev.display.dateFormat !== "Relative" &&
    prev.totalLines === next.totalLines &&
    prev.hunks.length === next.hunks.length &&
    prev.findOpen === next.findOpen &&
    prev.findQuery === next.findQuery &&
    prev.findActiveIndex === next.findActiveIndex
  );
}

/** True when a live refresh produced the exact same hunk DOM as what is already on screen. */
function sameRenderedBody(prev: BlameViewState | null, next: BlameViewState): boolean {
  if (prev === null || !sameRenderedMeta(prev, next)) return false;
  for (let index = 0; index < prev.hunks.length; index += 1) {
    const prevHunk = prev.hunks[index];
    const nextHunk = next.hunks[index];
    if (!sameHunk(prevHunk, nextHunk)) return false;
    if (prev.commits[prevHunk.commitHash]?.summary !== next.commits[nextHunk.commitHash]?.summary) {
      return false;
    }
  }
  return true;
}

type FocusedSnapshot = {
  id: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};

function captureFocusedInput(root: HTMLElement): FocusedSnapshot | null {
  const active = root.ownerDocument.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active) || active.id === "") return null;
  if (active instanceof HTMLInputElement) {
    return {
      id: active.id,
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd
    };
  }
  return { id: active.id, selectionStart: null, selectionEnd: null };
}

function restoreFocusedInput(root: HTMLElement, focused: FocusedSnapshot | null): void {
  if (focused === null) return;
  const next = root.querySelector<HTMLElement>(`#${focused.id}`);
  if (next === null) return;
  next.focus();
  if (next instanceof HTMLInputElement && focused.selectionStart !== null) {
    try {
      next.setSelectionRange(focused.selectionStart, focused.selectionEnd);
    } catch {
      // Non-selectable inputs ignore selection range restoration.
    }
  }
}

function scrollLineIntoView(root: HTMLElement, line: number | null): void {
  if (line === null || line < 1) return;
  const target = root.querySelector<HTMLElement>(`.blame-line[data-line="${line}"]`);
  if (target !== null && typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "center" });
  }
}

function contentElement(
  state: BlameViewState,
  labels: BlameLabels,
  now: Date,
  callbacks: BlameViewCallbacks
): HTMLElement | null {
  if (state.loading) {
    return messageBlock("blame-message blame-loading", labels.loading, "status");
  }
  if (state.error !== null) {
    return messageBlock(
      "blame-message blame-error",
      labels.loadError.replace("{0}", state.error),
      "alert"
    );
  }
  if (state.blameState === "lines") {
    return bodyElement(state, labels, now, callbacks);
  }
  return stateBlock(state, labels, callbacks);
}

function syncScrollPosition(
  root: HTMLElement,
  state: BlameViewState,
  sameTarget: boolean,
  prevScrollTop: number
): void {
  if (state.blameState !== "lines") return;
  const newScroll = root.querySelector<HTMLElement>(".blame-scroll");
  const preservedScroll =
    (sameTarget || state.preserveScroll) && prevScrollTop > 0 && newScroll !== null;
  if (preservedScroll) {
    newScroll.scrollTop = prevScrollTop;
  }
  const activeMatch =
    state.findActiveIndex >= 0 ? state.findMatches[state.findActiveIndex] : undefined;
  if (activeMatch !== undefined) {
    scrollLineIntoView(root, activeMatch.line);
  } else if (!preservedScroll && !state.preserveScroll && state.targetLine !== null) {
    scrollLineIntoView(root, state.targetLine);
  }
}

/**
 * Draws the tab from its state: a sticky header naming the repository,
 * the file, its revision, its line count, navigation stack controls, and
 * blame option toggles, an in-tab Find / Author filter bar, then the
 * loading word, one of the distinct non-line states, an error of its own,
 * or the grouped hunks. On an initial open, the target line is scrolled
 * into view; on a live refresh, the scroll position is preserved without
 * resetting an unchanged body DOM.
 */
export function createBlameView(root: HTMLElement, callbacks: BlameViewCallbacks) {
  root.classList.add("ggl-blame");
  let lastState: BlameViewState | null = null;
  let lastNow: Date = new Date();
  let lastTargetKey = "";
  let renderedState: BlameViewState | null = null;
  let renderedScroll: HTMLElement | null = null;

  // The commit popover and hunk context menu (F4-06) live in their own
  // module on `body`; the view only maps hunk DOM back to state and
  // forwards their actions to the tab's callbacks.
  const popover = createBlamePopover(root.ownerDocument, {
    onLoadDetails: (commitHash, requestId) =>
      callbacks.onLoadCommitPopover?.(commitHash, requestId),
    onShowInGraph: (commitHash) => callbacks.onShowCommitInGraph?.(commitHash),
    onOpenDiff: (request) => callbacks.onOpenCommitFileDiff?.(request),
    onRewind: (target) => callbacks.onRewind?.(target),
    onIgnoreCommit: (commitHash) => {
      if (lastState !== null) {
        callbacks.onIgnoreCommit?.(commitHash, currentVisibleLine(root, lastState));
      }
    },
    onCopyText: (kind, commitHash) => callbacks.onCopyText?.(kind, commitHash),
    onOpenFileAtLine: (line) => callbacks.onOpenFileAtLine?.(line),
    onBlameHead: () => callbacks.onBlameHead?.()
  });

  const bandOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(".blame-hunk") : null;

  const lineOf = (target: EventTarget | null, band: HTMLElement): number => {
    const row = target instanceof Element ? target.closest<HTMLElement>(".blame-line") : null;
    const line = Number(row?.dataset.line);
    return Number.isInteger(line) && line >= 1 ? line : Number(band.dataset.startLine);
  };

  const contextFor = (band: HTMLElement, line: number): BlamePopoverContext | null => {
    if (lastState?.labels == null) return null;
    const hunk = lastState.hunks[Number(band.dataset.hunkIndex)];
    if (hunk === undefined) return null;
    return {
      commit: lastState.commits[hunk.commitHash],
      hunk,
      labels: lastState.labels,
      display: lastState.display,
      locale: lastState.locale,
      now: lastNow,
      line,
      ignored: lastState.ignoreRevs.includes(hunk.commitHash)
    };
  };

  root.addEventListener("click", (event) => {
    const band = bandOf(event.target);
    if (band === null || !(event.target instanceof Element)) return;
    if (event.target.closest(".blame-line-number") !== null) {
      callbacks.onOpenFileAtLine?.(lineOf(event.target, band));
      return;
    }
    const trigger = event.target.closest<HTMLElement>(".blame-popover-trigger");
    if (trigger !== null) {
      const context = contextFor(band, lineOf(event.target, band));
      if (context !== null) popover.open(trigger, context);
    }
  });
  root.addEventListener("contextmenu", (event) => {
    const band = bandOf(event.target);
    if (band === null) return;
    const context = contextFor(band, lineOf(event.target, band));
    if (context === null) return;
    event.preventDefault();
    popover.openContextMenu(event.clientX, event.clientY, band, context);
  });

  const updateFindState = (next: BlameViewState, focusFindInput = false): void => {
    lastState = next;
    callbacks.onFindStateChange?.(next);
    render(next, lastNow);
    if (focusFindInput) {
      const input = root.querySelector<HTMLInputElement>("#blameFindInput");
      input?.focus();
      if (input !== null && input.value !== "") input.select();
    }
  };

  const toggleFind = (): void => {
    if (lastState === null) return;
    if (lastState.findOpen) {
      updateFindState(closeFind(lastState));
    } else {
      updateFindState(openFind(lastState), true);
    }
  };

  const applyFind = (transform: (current: BlameViewState) => BlameViewState): void => {
    if (lastState !== null) updateFindState(transform(lastState));
  };

  globalThis.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!root.isConnected || lastState?.blameState !== "lines") return;
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === "f"
    ) {
      event.preventDefault();
      updateFindState(openFind(lastState), true);
    } else if (event.key === "Escape" && lastState.findOpen) {
      event.preventDefault();
      updateFindState(closeFind(lastState));
    }
  });

  function render(state: BlameViewState, now: Date = new Date()): void {
    lastState = state;
    lastNow = now;
    const { labels } = state;
    if (labels === null) {
      lastTargetKey = "";
      renderedState = null;
      renderedScroll = null;
      popover.close();
      root.replaceChildren();
      return;
    }

    const focused = captureFocusedInput(root);
    const targetKey = `${state.repo}\0${state.filePath}\0${state.rev ?? ""}`;
    const sameTarget = targetKey === lastTargetKey;
    // A popover belongs to the file it was opened over (F4-06).
    if (!sameTarget) popover.close();
    const prevScrollEl = root.querySelector<HTMLElement>(".blame-scroll");
    const prevScrollTop = sameTarget || state.preserveScroll ? (prevScrollEl?.scrollTop ?? 0) : 0;
    const prevScrollLeft = state.preserveScroll ? (prevScrollEl?.scrollLeft ?? 0) : 0;
    lastTargetKey = targetKey;

    root.style.setProperty("--blame-font-size", `${state.typography.fontSize}px`);
    root.style.setProperty("--blame-line-height", `${state.typography.lineHeight}px`);
    root.style.setProperty("tab-size", `${state.typography.tabSize}`);

    const nextHeader = header(root, state, labels, callbacks, toggleFind);

    // A live refresh of an unchanged blame keeps the body DOM (and its
    // scroll) exactly as it is; only the header is redrawn.
    if (
      state.preserveScroll &&
      renderedScroll !== null &&
      renderedScroll.parentElement === root &&
      sameRenderedBody(renderedState, state)
    ) {
      const currentHeader = root.querySelector("header.blame-header");
      if (currentHeader !== null) currentHeader.replaceWith(nextHeader);
      else root.prepend(nextHeader);
      renderedState = state;
      return;
    }

    const children: HTMLElement[] = [nextHeader];
    if (state.blameState === "lines" && !state.loading && state.error === null) {
      children.push(
        findBarElement(
          state,
          labels,
          (query) => applyFind((cur) => applyFindQuery(cur, query)),
          (delta) => applyFind((cur) => stepFindMatch(cur, delta)),
          () => applyFind(closeFind)
        )
      );
    }

    const content = contentElement(state, labels, now, callbacks);
    if (content !== null) children.push(content);
    renderedScroll =
      content !== null && state.blameState === "lines" && !state.loading && state.error === null
        ? content
        : null;

    root.replaceChildren(...children);
    renderedState = state;
    restoreFocusedInput(root, focused);
    syncScrollPosition(root, state, sameTarget, prevScrollTop);
    if (state.preserveScroll && renderedScroll !== null && prevScrollLeft > 0) {
      renderedScroll.scrollLeft = prevScrollLeft;
    }
  }

  return {
    render,
    /** A commit popover details reply landed (F4-06). */
    applyCommitPopover: (message: BlameCommitPopoverMessage): void => {
      popover.applyDetails(message);
    }
  };
}
