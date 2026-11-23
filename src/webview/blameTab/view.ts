import type { GitBlameCommit } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import type { BlameHotspotMode } from "@/blameHotspot";
import type { BlameHunkView, BlameLabels } from "@/blameTabTypes";

import { clampGutterWidth, DEFAULT_GUTTER_WIDTH, resizeGutterWidth } from "./columnResize";
import { type BlameViewState, commitDate, heatAttribute, normalizeHotspotMode } from "./rowModel";

export type BlameViewCallbacks = {
  /** A gutter drag ended with this width; the caller keeps it per repo. */
  onGutterWidthChange?: (width: number) => void;
  /** The user picked a hotspot mode in the header; the caller keeps it and re-renders. */
  onHotspotModeChange?: (mode: BlameHotspotMode) => void;
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
  return repo.split("/").at(-1) || repo;
}

/** The revision badge's text and hover: the short hash, the asked revision, or the working tree. */
function revBadge(state: BlameViewState, labels: BlameLabels): { value: string; title: string } {
  if (state.resolvedRev !== null) {
    return {
      value: abbrevCommit(state.resolvedRev, state.display.shortHashLength),
      title: state.resolvedRev
    };
  }
  if (state.rev !== null) return { value: state.rev, title: state.rev };
  return { value: labels.workingTree, title: labels.workingTree };
}

function header(
  state: BlameViewState,
  labels: BlameLabels,
  callbacks: BlameViewCallbacks
): HTMLElement {
  const bar = element("header", "blame-header");
  const repo = element("span", "blame-repo", folderName(state.repo));
  repo.title = state.repo;
  const path = element("span", "blame-path", state.filePath);
  path.title = state.filePath;
  const badge = revBadge(state, labels);
  const rev = element("span", "blame-rev", badge.value);
  rev.title = badge.title;
  const count = element(
    "span",
    "blame-line-count",
    labels.lineCount.replace("{0}", state.totalLines.toLocaleString(state.locale))
  );
  bar.append(repo, path, rev, count);
  if (state.blameState === "lines") bar.append(heatControls(state, labels, callbacks));
  return bar;
}

function messageBlock(className: string, text: string, role?: string): HTMLElement {
  const block = element("p", className, text);
  if (role !== undefined) block.setAttribute("role", role);
  return block;
}

/** The word for a non-line state, each one distinct from an error. */
function stateBlock(state: BlameViewState, labels: BlameLabels): HTMLElement | null {
  switch (state.blameState) {
    case "empty":
      return messageBlock("blame-message blame-empty", labels.empty);
    case "binary":
      return messageBlock("blame-message blame-binary", labels.binary);
    case "tooLarge":
      return messageBlock("blame-message blame-too-large", labels.tooLarge);
    case "untracked":
      return messageBlock("blame-message blame-untracked", labels.untracked);
    case "unborn":
      return messageBlock("blame-message blame-unborn", labels.unborn);
    default:
      return null;
  }
}

function gutterElement(
  hunk: BlameHunkView,
  commit: GitBlameCommit | undefined,
  state: BlameViewState,
  labels: BlameLabels,
  now: Date
): HTMLElement {
  const gutter = element("div", "blame-gutter");
  const uncommitted = commit?.uncommitted === true || hunk.heat.uncommitted;
  if (uncommitted) {
    // No fake hash and no date: the all-zero OID is not a commit.
    gutter.append(element("div", "blame-summary blame-uncommitted", labels.uncommitted));
  } else if (commit !== undefined) {
    const summary = element("div", "blame-summary", commit.summary);
    summary.title = commit.summary;
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
    gutter.append(summary, meta);
  } else {
    // A hunk whose commit the payload does not carry: the hash is all
    // that can honestly be shown for it.
    const hash = element(
      "code",
      "blame-hash",
      abbrevCommit(hunk.commitHash, state.display.shortHashLength)
    );
    hash.title = hunk.commitHash;
    gutter.append(hash);
  }
  const handle = element("span", "blame-gutter-resize");
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", labels.resizeGutter);
  handle.title = labels.resizeGutter;
  gutter.append(handle);
  return gutter;
}

function hunkElement(
  hunk: BlameHunkView,
  state: BlameViewState,
  labels: BlameLabels,
  now: Date
): HTMLElement {
  const band = element("section", "blame-hunk");
  // One keyboard stop per hunk: focusing it marks the commit's other hunks.
  band.tabIndex = 0;
  band.dataset.commit = hunk.commitHash;
  band.dataset.heat = heatAttribute(hunk);
  band.dataset.startLine = String(hunk.startLine);
  const source = element("div", "blame-source");
  for (const line of hunk.lines) {
    const row = element("div", "blame-line");
    row.dataset.line = String(line.finalLine);
    if (state.targetLine === line.finalLine) row.classList.add("blame-target-line");
    const number = element("span", "blame-line-number", String(line.finalLine));
    const text = element("span", "blame-line-text", line.content);
    row.append(number, text);
    source.append(row);
  }
  band.append(gutterElement(hunk, state.commits[hunk.commitHash], state, labels, now), source);
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
  for (const hunk of state.hunks) body.append(hunkElement(hunk, state, labels, now));
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

/**
 * Draws the tab from its state: a sticky header naming the repository,
 * the file, its revision and its line count, then the loading word, one
 * of the distinct non-line states, an error of its own, or the grouped
 * hunks. After drawing lines, the target line is scrolled into view.
 */
export function createBlameView(root: HTMLElement, callbacks: BlameViewCallbacks) {
  root.classList.add("ggl-blame");
  return {
    render(state: BlameViewState, now: Date = new Date()): void {
      const { labels } = state;
      if (labels === null) {
        root.replaceChildren();
        return;
      }
      root.style.setProperty("--blame-font-size", `${state.typography.fontSize}px`);
      root.style.setProperty("--blame-line-height", `${state.typography.lineHeight}px`);
      root.style.setProperty("tab-size", `${state.typography.tabSize}`);
      const children: HTMLElement[] = [header(state, labels, callbacks)];
      if (state.loading) {
        children.push(messageBlock("blame-message blame-loading", labels.loading, "status"));
      } else if (state.error !== null) {
        children.push(
          messageBlock(
            "blame-message blame-error",
            labels.loadError.replace("{0}", state.error),
            "alert"
          )
        );
      } else if (state.blameState === "lines") {
        children.push(bodyElement(state, labels, now, callbacks));
      } else {
        const block = stateBlock(state, labels);
        if (block !== null) children.push(block);
      }
      root.replaceChildren(...children);
      if (state.blameState === "lines" && state.targetLine !== null) {
        const target = root.querySelector<HTMLElement>(
          `.blame-line[data-line="${state.targetLine}"]`
        );
        if (target !== null && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ block: "center" });
        }
      }
    }
  };
}
