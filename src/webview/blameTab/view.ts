import type { GitBlameCommit } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import type { BlameHunkView, BlameLabels } from "@/blameTabTypes";

import { clampGutterWidth, DEFAULT_GUTTER_WIDTH, resizeGutterWidth } from "./columnResize";
import { type BlameViewState, commitDate, heatAttribute } from "./rowModel";

export type BlameViewCallbacks = {
  /** A gutter drag ended with this width; the caller keeps it per repo. */
  onGutterWidthChange?: (width: number) => void;
};

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

function header(state: BlameViewState, labels: BlameLabels): HTMLElement {
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
  return scroll;
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
      const children: HTMLElement[] = [header(state, labels)];
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
