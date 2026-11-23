import { abbrevCommit } from "@/backend/utils/string";
import {
  isReflogFiltered,
  REFLOG_ACTION_KINDS,
  REFLOG_SEARCH_CAP,
  type ReflogLabels,
  type ReflogQuery,
  type ReflogRefOption,
  type ReflogRow,
  refOptionMatchesQuery,
  repoRefOption
} from "@/reflogTabTypes";

import { kindClass, kindLabel, subIntentClass, subLabel } from "./actionStyle";
import { MIN_COLUMN_WIDTH, resizeColumnWidths } from "./columnResize";
import { badgeFor, entryDate, type ReflogViewState, selectorFor } from "./rowModel";

export type ReflogViewCallbacks = {
  onLoadMore: () => void;
  /** A column drag ended with these widths; the caller keeps them per repo. */
  onColumnWidthsChange?: (widths: number[]) => void;
  /**
   * A filter control changed the query. `search` is one keystroke in the
   * search box (the caller debounces it); `instant` acts at once.
   */
  onQueryChange?: (query: ReflogQuery, mode: "search" | "instant") => void;
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

/** The picked option, or null when a fresh listing no longer holds it. */
function selectedOption(state: ReflogViewState): ReflogRefOption | null {
  return (
    state.refOptions.find((refOption) => refOptionMatchesQuery(refOption, state.query)) ?? null
  );
}

/**
 * Whose `HEAD` the header names (F1-08): another worktree's `HEAD` always
 * names its worktree, and this worktree's does too once the repository
 * has linked worktrees to tell apart. Both take the graph's own
 * "HEAD of worktree {0}" words. A single-worktree repository's `HEAD`
 * and every branch or stash ref read as before.
 */
function headerRefText(state: ReflogViewState, labels: ReflogLabels): string {
  const { query } = state;
  if (query.ref !== "HEAD") return state.ref ?? query.ref;
  if (query.worktreePath !== null) {
    const name = selectedOption(state)?.worktreeName ?? folderName(query.worktreePath);
    return labels.worktreeHead.replace("{0}", () => name);
  }
  const hasOtherWorktrees = state.refOptions.some((refOption) => refOption.worktreePath !== null);
  return hasOtherWorktrees
    ? labels.worktreeHead.replace("{0}", () => folderName(state.repo))
    : "HEAD";
}

function header(state: ReflogViewState, labels: ReflogLabels): HTMLElement {
  const bar = element("header", "reflog-header");
  const ref = element("span", "reflog-ref", headerRefText(state, labels));
  // The full path settles which folder a worktree name means.
  ref.title = state.query.worktreePath ?? state.ref ?? state.query.ref;
  bar.append(ref);
  const repo = element("span", "reflog-repo", folderName(state.repo));
  repo.title = state.repo;
  bar.append(repo);
  return bar;
}

/**
 * How a picker option reads. A branch is its short name and the stash is
 * worded as the action; another worktree's `HEAD` takes the graph's
 * words, with a locked or missing worktree marked in them too, joined
 * the way the graph joins a worktree checkout's parts.
 */
function refLabel(refOption: ReflogRefOption, labels: ReflogLabels): string {
  if (refOption.worktreePath !== null) {
    const name = refOption.worktreeName ?? folderName(refOption.worktreePath);
    const parts = [labels.worktreeHead.replace("{0}", () => name)];
    if (refOption.locked !== null) {
      const { reason } = refOption.locked;
      parts.push(
        reason === ""
          ? labels.worktreeLockedNoReason
          : labels.worktreeLocked.replace("{0}", () => reason)
      );
    }
    if (refOption.prunable !== null) parts.push(labels.worktreeMissing);
    return parts.join(", ");
  }
  if (refOption.ref === "refs/stash") return `${labels.actions.stash ?? "Stash"} (refs/stash)`;
  if (refOption.ref.startsWith("refs/heads/")) return refOption.ref.slice("refs/heads/".length);
  return refOption.ref;
}

function option(value: string, text: string, title?: string): HTMLOptionElement {
  const node = element("option", "", text);
  node.value = value;
  if (title !== undefined) node.title = title;
  return node;
}

/**
 * The filter row (F1-05): the ref picker, the message search, the
 * action filter and the "only in the reflog" toggle. Every change
 * rebuilds the query from the controls' live values, so the row can
 * re-render under the user without a control reading stale state.
 */
function controls(
  state: ReflogViewState,
  labels: ReflogLabels,
  callbacks: ReflogViewCallbacks
): HTMLElement {
  const bar = element("div", "reflog-controls");

  const refSelect = element("select", "reflog-control reflog-ref-picker");
  refSelect.id = "reflogRefPicker";
  refSelect.setAttribute("aria-label", labels.filterRef);
  refSelect.title = labels.filterRef;
  // The picked option stays pickable even when a fresh listing lost it
  // (its branch was deleted, its worktree removed): its read then says
  // so, honestly. Values are indexes into this list, so two `HEAD`
  // options — this worktree's and another's — stay apart.
  const picked: ReflogRefOption =
    state.query.worktreePath === null
      ? repoRefOption(state.query.ref)
      : {
          ref: "HEAD",
          worktreePath: state.query.worktreePath,
          worktreeName: folderName(state.query.worktreePath),
          locked: null,
          prunable: null
        };
  const options = state.refOptions.some((candidate) =>
    refOptionMatchesQuery(candidate, state.query)
  )
    ? state.refOptions
    : [...state.refOptions, picked];
  options.forEach((candidate, index) => {
    refSelect.append(
      option(String(index), refLabel(candidate, labels), candidate.worktreePath ?? candidate.ref)
    );
  });
  refSelect.value = String(
    Math.max(
      0,
      options.findIndex((candidate) => refOptionMatchesQuery(candidate, state.query))
    )
  );

  const search = element("input", "reflog-control reflog-search");
  search.id = "reflogSearch";
  search.type = "search";
  search.value = state.query.search;
  search.placeholder = labels.searchPlaceholder;
  search.setAttribute("aria-label", labels.searchPlaceholder);

  const actionSelect = element("select", "reflog-control reflog-action-filter");
  actionSelect.id = "reflogActionFilter";
  actionSelect.setAttribute("aria-label", labels.columnAction);
  actionSelect.title = labels.columnAction;
  actionSelect.append(option("", labels.filterAllActions));
  for (const kind of REFLOG_ACTION_KINDS) {
    actionSelect.append(option(kind, kindLabel(kind, labels), kind));
  }
  actionSelect.value = state.query.actions[0] ?? "";

  const onlyLabel = element("label", "reflog-only-toggle");
  const only = element("input", "reflog-only-checkbox");
  only.id = "reflogOnlyFilter";
  only.type = "checkbox";
  only.checked = state.query.onlyInReflog;
  onlyLabel.append(only, labels.onlyInReflog);

  const current = (): ReflogQuery => ({
    ref: options[Number(refSelect.value)]?.ref ?? "HEAD",
    worktreePath: options[Number(refSelect.value)]?.worktreePath ?? null,
    search: search.value.trim(),
    actions: actionSelect.value === "" ? [] : [actionSelect.value],
    onlyInReflog: only.checked
  });
  refSelect.addEventListener("change", () => callbacks.onQueryChange?.(current(), "instant"));
  actionSelect.addEventListener("change", () => callbacks.onQueryChange?.(current(), "instant"));
  only.addEventListener("change", () => callbacks.onQueryChange?.(current(), "instant"));
  search.addEventListener("input", () => callbacks.onQueryChange?.(current(), "search"));
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || search.value === "") return;
    search.value = "";
    callbacks.onQueryChange?.(current(), "instant");
  });

  bar.append(refSelect, search, actionSelect, onlyLabel);
  return bar;
}

function messageBlock(className: string, text: string, role?: string): HTMLElement {
  const block = element("p", className, text);
  if (role !== undefined) block.setAttribute("role", role);
  return block;
}

function emptyBlock(state: ReflogViewState, labels: ReflogLabels): HTMLElement {
  // A bare repository's missing `HEAD` reflog has its own story
  // (F1-08): Git keeps none there by default, and the branches
  // above are where its reflogs live. It is told only for that
  // exact case — a bare `HEAD` that does keep entries, and every
  // branch, read as anywhere else.
  if (
    state.bare &&
    state.query.ref === "HEAD" &&
    state.query.worktreePath === null &&
    state.reflogState === "none"
  ) {
    return messageBlock("reflog-message reflog-empty reflog-bare-note", labels.bareHeadNote);
  }
  // A filter that matched nothing in a reflog that has entries is
  // not the empty-reflog story; one for a ref with no reflog is.
  if (isReflogFiltered(state.query) && state.reflogState !== "none") {
    return messageBlock("reflog-message reflog-empty reflog-no-matches", labels.noMatches);
  }
  return messageBlock("reflog-message reflog-empty", labels.empty);
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
  // Rendering replaces the whole document, controls included, so the
  // focused control (and a not-yet-sent search text) is carried across
  // a render by its id, or typing would lose its place on every reply.
  let lastRepo = "";
  return {
    render(state: ReflogViewState, now: Date = new Date()): void {
      const { labels } = state;
      if (labels === null) {
        lastRepo = state.repo;
        root.replaceChildren();
        return;
      }
      const active = root.ownerDocument.activeElement;
      const focused =
        active instanceof HTMLElement && root.contains(active) && active.id !== ""
          ? {
              id: active.id,
              value: active instanceof HTMLInputElement ? active.value : undefined,
              selectionStart: active instanceof HTMLInputElement ? active.selectionStart : null,
              selectionEnd: active instanceof HTMLInputElement ? active.selectionEnd : null
            }
          : null;
      const sameRepo = state.repo === lastRepo;

      const children: HTMLElement[] = [header(state, labels), controls(state, labels, callbacks)];
      if (state.searchCapped && !state.loading) {
        children.push(
          messageBlock(
            "reflog-cap-note",
            labels.searchCapped.replace("{0}", REFLOG_SEARCH_CAP.toLocaleString(state.locale)),
            "status"
          )
        );
      }
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
        children.push(emptyBlock(state, labels));
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
      lastRepo = state.repo;
      if (focused !== null) {
        const next = root.querySelector<HTMLElement>(`#${focused.id}`);
        if (next !== null) {
          // Text typed while a debounced search had not been sent yet
          // is newer than the state this render answers; keep it (the
          // pending search will ask for it), but only here, never
          // across a repository change.
          if (
            sameRepo &&
            focused.id === "reflogSearch" &&
            focused.value !== undefined &&
            next instanceof HTMLInputElement &&
            focused.value.trim() !== state.query.search
          ) {
            next.value = focused.value;
          }
          next.focus();
          if (next instanceof HTMLInputElement && focused.selectionStart !== null) {
            try {
              next.setSelectionRange(focused.selectionStart, focused.selectionEnd);
            } catch {
              // A search input has a selectable range; a control whose
              // type cannot select ignores the carried range.
            }
          }
        }
      }
    }
  };
}
