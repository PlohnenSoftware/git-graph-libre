import type { ReflogLabels, ReflogRow } from "@/reflogTabTypes";

import { kindClass, kindLabel, subIntentClass, subLabel } from "./actionStyle";
import {
  badgeFor,
  fullDate,
  type ReflogViewState,
  relativeTime,
  selectorFor,
  shortHash
} from "./rowModel";

export type ReflogViewCallbacks = {
  onLoadMore: () => void;
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
    const tag = element("span", `reflog-sub reflog-sub-tag ${subIntentClass(row.sub)}`, subLabel(row.sub, labels));
    tag.title = row.sub;
    sub.append(tag);
  }
  const message = element("td", "reflog-cell reflog-message", row.message);
  message.title = row.message;
  const hash = element("td", "reflog-cell");
  const code = element("code", "reflog-hash", shortHash(row.hash));
  code.title = row.hash;
  hash.append(code);
  const time = element("td", "reflog-cell reflog-time", relativeTime(row, now, state.locale));
  time.title = fullDate(row, state.locale);
  tr.append(index, action, sub, message, hash, time, badgeCell(row, labels));
  return tr;
}

function table(state: ReflogViewState, labels: ReflogLabels, now: Date): HTMLElement {
  const scroll = element("div", "reflog-scroll");
  const tableNode = element("table", "reflog-table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const text of [
    labels.columnIndex,
    labels.columnAction,
    labels.columnSubAction,
    labels.columnMessage,
    labels.columnHash,
    labels.columnTime,
    labels.columnState
  ]) {
    headRow.append(element("th", "reflog-head-cell", text));
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const row of state.rows) body.append(rowElement(row, state, labels, now));
  tableNode.append(head, body);
  scroll.append(tableNode);
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
        children.push(table(state, labels, now));
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
