import { abbrevCommit } from "@/backend/utils/string";
import type { ReflogLabels, ReflogRow } from "@/reflogTabTypes";

import { kindClass, kindLabel, subIntentClass, subLabel } from "./actionStyle";
import { MIN_COLUMN_WIDTH, resizeColumnWidths } from "./columnResize";
import { badgeFor, entryDate, type ReflogViewState, selectorFor } from "./rowModel";

export type ReflogViewCallbacks = {
  onLoadMore: () => void;
  /** A column drag ended with these widths; the caller keeps them per repo. */
  onColumnWidthsChange?: (widths: number[]) => void;
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

function header(state: ReflogViewState): HTMLElement {
  const bar = element("header", "reflog-header");
  bar.append(element("span", "reflog-ref", state.ref ?? "HEAD"));
  const repo = element("span", "reflog-repo", folderName(state.repo));
  repo.title = state.repo;
  bar.append(repo);
  return bar;
}

function messageBlock(className: string, text: string, role?: string): HTMLElement {
  const block = element("p", className, text);
  if (role !== undefined) block.setAttribute("role", role);
  return block;
}

function badgeCell(row: ReflogRow, labels: ReflogLabels): HTMLTableCellElement {
  const cell = element("td", "reflog-cell reflog-state-cell");
  const badge = badgeFor(row, labels);
  if (badge !== null) {
    cell.append(element("span", `reflog-badge reflog-badge-${row.state}`, badge));
  }
  return cell;
}

function rowElement(row: ReflogRow, state: ReflogViewState, labels: ReflogLabels, now: Date) {
  const tr = element("tr", "reflog-row");
  const index = element("td", "reflog-cell reflog-index", String(row.index));
  index.title = selectorFor(row, state.ref);
  const action = element("td", "reflog-cell");
  // The marker's color never carries the meaning alone: the localized
  // label sits beside it, and Git's raw kind word stays in the tooltip.
  const kind = element("span", "reflog-action");
  kind.dataset.kind = row.kind;
  kind.title = row.kind;
  const dot = element("span", `reflog-kind-dot ${kindClass(row.kind)}`);
  dot.setAttribute("aria-hidden", "true");
  kind.append(dot, kindLabel(row.kind, labels));
  action.append(kind);
  const sub = element("td", "reflog-cell");
  if (row.sub === null) {
    sub.append(element("span", "reflog-sub", "—"));
  } else {
    const tag = element(
      "span",
      `reflog-sub reflog-sub-tag ${subIntentClass(row.sub)}`,
      subLabel(row.sub, labels)
    );
    tag.title = row.sub;
    sub.append(tag);
  }
  const message = element("td", "reflog-cell reflog-message", row.message);
  message.title = row.message;
  const hash = element("td", "reflog-cell");
  const code = element(
    "code",
    "reflog-hash",
    abbrevCommit(row.hash, state.display.shortHashLength)
  );
  code.title = row.hash;
  hash.append(code);
  const dateCell = entryDate(row, state.display, now, state.locale);
  const time = element("td", "reflog-cell reflog-time", dateCell.value);
  time.title = dateCell.title;
  tr.append(index, action, sub, message, hash, time, badgeCell(row, labels));
  return tr;
}

function table(
  state: ReflogViewState,
  labels: ReflogLabels,
  now: Date,
  callbacks: ReflogViewCallbacks
): HTMLElement {
  const scroll = element("div", "reflog-scroll");
  const tableNode = element("table", "reflog-table");
  const columns = [
    labels.columnIndex,
    labels.columnAction,
    labels.columnSubAction,
    labels.columnMessage,
    labels.columnCommit,
    labels.columnDate,
    labels.columnState
  ];
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.className = "reflog-head-row";
  const headers: HTMLTableCellElement[] = [];
  columns.forEach((text, index) => {
    const cell = element("th", "reflog-head-cell", text);
    // The graph's `resizeCol` handles: one per column edge, named for the
    // column on its left, so every boundary can be dragged either way.
    if (index > 0) {
      const left = element("span", "resizeCol left");
      left.dataset.col = String(index - 1);
      cell.append(left);
    }
    if (index < columns.length - 1) {
      const right = element("span", "resizeCol right");
      right.dataset.col = String(index);
      cell.append(right);
    }
    headers.push(cell);
    headRow.append(cell);
  });
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const row of state.rows) body.append(rowElement(row, state, labels, now));
  tableNode.append(head, body);
  scroll.append(tableNode);

  let widths = state.columnWidths;
  const applyWidths = () => {
    if (widths === null) return;
    tableNode.classList.add("fixedLayout");
    // Widths are content widths on the header cells, as the graph sets
    // them; under fixed layout the first row sizes every column.
    headers.forEach((cell, index) => {
      cell.style.width = `${widths?.[index] ?? MIN_COLUMN_WIDTH}px`;
    });
  };
  applyWidths();

  // Dragging only restyles this table (as the graph's handler restyles its
  // headers): rows and loaded pages are never rebuilt by a resize.
  let dragCol = -1;
  let mouseX = 0;
  const stopResizing = () => {
    if (dragCol < 0 || widths === null) return;
    dragCol = -1;
    headRow.classList.remove("resizing");
    callbacks.onColumnWidthsChange?.([...widths]);
  };
  headRow.addEventListener("mousedown", (event) => {
    const handle = event.target instanceof HTMLElement ? event.target.closest(".resizeCol") : null;
    if (!(handle instanceof HTMLElement) || handle.dataset.col === undefined) return;
    dragCol = Number.parseInt(handle.dataset.col, 10);
    mouseX = event.clientX;
    if (widths === null) {
      // First drag, as in the graph: freeze the natural layout into fixed
      // widths (rendered width minus the header cells' 8px side padding).
      widths = headers.map((cell) => Math.max(cell.clientWidth - 16, MIN_COLUMN_WIDTH));
      applyWidths();
    }
    headRow.classList.add("resizing");
  });
  headRow.addEventListener("mousemove", (event) => {
    if (dragCol < 0 || widths === null) return;
    widths = resizeColumnWidths(widths, dragCol, event.clientX - mouseX);
    mouseX = event.clientX;
    applyWidths();
  });
  headRow.addEventListener("mouseup", stopResizing);
  headRow.addEventListener("mouseleave", stopResizing);
  return scroll;
}

/**
 * Draws the tab from its state: a header naming the ref and repository,
 * then the loading, empty or error word, or the entries table. An error is
 * its own block, never the empty wording; with rows already shown it sits
 * under them (a failed "Load more") instead of replacing them.
 */
export function createReflogView(root: HTMLElement, callbacks: ReflogViewCallbacks) {
  root.classList.add("ggl-reflog");
  return {
    render(state: ReflogViewState, now: Date = new Date()): void {
      const { labels } = state;
      if (labels === null) {
        root.replaceChildren();
        return;
      }
      const children: HTMLElement[] = [header(state)];
      if (state.loading) {
        children.push(messageBlock("reflog-message reflog-loading", labels.loading, "status"));
      } else if (state.error !== null && state.rows.length === 0) {
        children.push(
          messageBlock(
            "reflog-message reflog-error",
            labels.loadError.replace("{0}", state.error),
            "alert"
          )
        );
      } else if (state.rows.length === 0) {
        children.push(messageBlock("reflog-message reflog-empty", labels.empty));
      } else {
        children.push(table(state, labels, now, callbacks));
        if (state.error !== null) {
          children.push(
            messageBlock(
              "reflog-message reflog-error",
              labels.loadError.replace("{0}", state.error),
              "alert"
            )
          );
        }
        if (state.hasMore) {
          const more = element("button", "reflog-load-more", labels.loadMore);
          more.type = "button";
          more.disabled = state.loadingMore;
          more.setAttribute("aria-busy", String(state.loadingMore));
          more.addEventListener("click", callbacks.onLoadMore);
          children.push(more);
        }
      }
      root.replaceChildren(...children);
    }
  };
}
