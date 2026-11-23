import { abbrevCommit } from "@/backend/utils/string";
import type { ReflogLabels, ReflogLostCommit } from "@/reflogTabTypes";

import { entryDate, type ReflogViewState } from "./rowModel";

export type LostCommitsViewCallbacks = {
  onScanLostCommits?: () => void;
  onCancelLostCommitsScan?: () => void;
  onCloseLostCommits?: () => void;
  onCreateLostCommitBranch?: (hash: string) => void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function lostRow(
  commit: ReflogLostCommit,
  state: ReflogViewState,
  labels: ReflogLabels,
  now: Date,
  callbacks: LostCommitsViewCallbacks
): HTMLTableRowElement {
  const tr = el("tr", "reflog-lost-row");

  const hashCell = el("td", "reflog-cell");
  const code = el("code", "reflog-hash", abbrevCommit(commit.hash, state.display.shortHashLength));
  code.title = commit.hash;
  hashCell.append(code);

  const dateInfo = entryDate(commit, state.display, now, state.locale);
  const dateCell = el("td", "reflog-cell reflog-time", dateInfo.value);
  dateCell.title = dateInfo.title;

  const subjectText = commit.subject === "" ? "—" : commit.subject;
  const subjectCell = el("td", "reflog-cell reflog-lost-subject", subjectText);
  if (commit.subject !== "") subjectCell.title = commit.subject;

  const actionCell = el("td", "reflog-cell reflog-lost-actions");
  const createBtn = button("reflog-lost-action-btn", labels.lostCommits.createBranch, () => {
    callbacks.onCreateLostCommitBranch?.(commit.hash);
  });
  createBtn.dataset.hash = commit.hash;
  const busy = state.lostCommits.busyHash === commit.hash;
  createBtn.disabled = busy;
  createBtn.setAttribute("aria-busy", String(busy));
  actionCell.append(createBtn);

  tr.append(hashCell, dateCell, subjectCell, actionCell);
  return tr;
}

function resultsTable(
  state: ReflogViewState,
  labels: ReflogLabels,
  now: Date,
  callbacks: LostCommitsViewCallbacks
): HTMLElement {
  const scroll = el("div", "reflog-lost-scroll");
  const table = el("table", "reflog-table reflog-lost-table");
  const head = document.createElement("thead");
  const headRow = el("tr", "reflog-lost-head-row");
  for (const heading of [
    labels.columnCommit,
    labels.columnDate,
    labels.columnMessage,
    labels.columnAction
  ]) {
    headRow.append(el("th", "reflog-head-cell", heading));
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const commit of state.lostCommits.commits) {
    body.append(lostRow(commit, state, labels, now, callbacks));
  }
  table.append(head, body);
  scroll.append(table);
  return scroll;
}

/**
 * Renders the opt-in lost-commit scan panel (F1-07) when active (not `idle`).
 * Shows progress with Cancel while running, the GC disappearance warning,
 * empty/canceled/timeout/error messages, inline branch-creation feedback, and
 * a table of lost commits each with "Create Branch Here…".
 */
export function renderLostCommitsSection(
  state: ReflogViewState,
  labels: ReflogLabels,
  now: Date,
  callbacks: LostCommitsViewCallbacks
): HTMLElement | null {
  const { lostCommits } = state;
  if (lostCommits.status === "idle") return null;

  const section = el("section", "reflog-lost-panel");
  section.setAttribute("aria-label", labels.lostCommits.title);

  const headerBar = el("div", "reflog-lost-header");
  const titleWrap = el("div", "reflog-lost-title-wrap");
  titleWrap.append(el("h2", "reflog-lost-title", labels.lostCommits.title));
  if (lostCommits.status === "done") {
    titleWrap.append(el("span", "reflog-lost-count", String(lostCommits.commits.length)));
  }
  headerBar.append(titleWrap);

  const headerActions = el("div", "reflog-lost-header-actions");
  if (lostCommits.status === "scanning") {
    const cancelBtn = button("reflog-lost-btn", labels.lostCommits.cancel, () => {
      callbacks.onCancelLostCommitsScan?.();
    });
    cancelBtn.id = "reflogLostCancelBtn";
    headerActions.append(cancelBtn);
  } else {
    const rescanBtn = button("reflog-lost-btn", labels.lostCommits.rescan, () => {
      callbacks.onScanLostCommits?.();
    });
    rescanBtn.id = "reflogLostRescanBtn";
    const closeBtn = button("reflog-lost-btn", labels.lostCommits.close, () => {
      callbacks.onCloseLostCommits?.();
    });
    closeBtn.id = "reflogLostCloseBtn";
    headerActions.append(rescanBtn, closeBtn);
  }
  headerBar.append(headerActions);
  section.append(headerBar);

  if (lostCommits.feedback !== null) {
    const feedback = el(
      "p",
      `reflog-lost-feedback reflog-lost-feedback-${lostCommits.feedback.kind}`,
      lostCommits.feedback.message
    );
    feedback.setAttribute("role", lostCommits.feedback.kind === "error" ? "alert" : "status");
    section.append(feedback);
  }

  if (lostCommits.status === "scanning") {
    const progress = el("div", "reflog-lost-progress");
    progress.setAttribute("role", "status");
    const spinner = el("span", "reflog-lost-spinner");
    spinner.setAttribute("aria-hidden", "true");
    progress.append(spinner, el("span", "reflog-lost-progress-text", labels.lostCommits.scanning));
    section.append(progress);
    return section;
  }

  if (lostCommits.status === "canceled") {
    const note = el("p", "reflog-lost-status", labels.lostCommits.canceled);
    note.setAttribute("role", "status");
    section.append(note);
    return section;
  }

  if (lostCommits.status === "timedOut") {
    const note = el("p", "reflog-lost-error", labels.lostCommits.timedOut);
    note.setAttribute("role", "alert");
    section.append(note);
    return section;
  }

  if (lostCommits.status === "error") {
    const note = el(
      "p",
      "reflog-lost-error",
      labels.lostCommits.error.replace("{0}", () => lostCommits.error ?? "")
    );
    note.setAttribute("role", "alert");
    section.append(note);
    return section;
  }

  if (lostCommits.commits.length === 0) {
    const empty = el("p", "reflog-lost-status reflog-lost-empty", labels.lostCommits.empty);
    empty.setAttribute("role", "status");
    section.append(empty);
    return section;
  }

  const gcNote = el("p", "reflog-lost-gc-note", labels.lostCommits.gcNote);
  section.append(gcNote, resultsTable(state, labels, now, callbacks));
  return section;
}
