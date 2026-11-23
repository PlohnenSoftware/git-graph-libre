import type { TodoAction } from "@/backend/rebase/todo";
import type { RebasePreflightReason } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import { octicon } from "@/octicons";
import { escapeHtml } from "@/webview/utils/html";

import { applyRebaseKeyCommand, interpretRebaseEditorKey, trapFocusInContainer } from "./keyboard";
import {
  allowedActionsForRow,
  canStartInteractiveRebase,
  countDroppedCommits,
  getMergeCommits,
  getPublishedCommits,
  type InteractiveRebaseStartPayload,
  isRebaseStateModified,
  moveRebaseRowBy,
  type RebaseEditorRow,
  type RebaseEditorState,
  resetRebaseEditorState,
  selectRebaseRow,
  setRebaseRowAction,
  toInteractiveRebasePayload
} from "./model";

export type RebaseEditorCallbacks = {
  readonly onStart: (payload: InteractiveRebaseStartPayload) => void;
  readonly onCancel: () => void;
  readonly onStateChange?: (state: RebaseEditorState) => void;
};

export type RebaseEditorViewOptions = {
  readonly shortHashLength: number;
};

export type RebaseEditorController = {
  getState: () => RebaseEditorState;
  destroy: () => void;
};

function actionLabel(action: TodoAction): string {
  if (action === "drop") return l10n.rebaseActionDrop;
  return l10n.rebaseActionPick;
}

function preflightReasonMessage(reason: RebasePreflightReason): string {
  switch (reason) {
    case "inProgress":
      return l10n.rebasePreflightInProgress;
    case "dirty":
      return l10n.rebasePreflightDirty;
    case "alreadyUsedElsewhere":
      return l10n.rebasePreflightUsedElsewhere;
    case "emptyRange":
      return l10n.rebasePreflightEmpty;
    case "readFailed":
      return l10n.unableToLoadRebaseRange;
  }
}

function formatHashList(rows: readonly RebaseEditorRow[], shortHashLength: number): string {
  return rows.map((row) => abbrevCommit(row.hash, shortHashLength)).join(", ");
}

function renderSubheaderHtml(state: RebaseEditorState): string {
  const baseText =
    state.base === null
      ? `<b><i>${escapeHtml(l10n.rebaseEditorRoot)}</i></b>`
      : `<b><i>${escapeHtml(state.baseLabel)}</i></b>`;
  const targetLine =
    state.detached || state.branch === null
      ? l10n.rebaseEditorDetachedOnto.replace("{0}", () => baseText)
      : l10n.rebaseEditorBranchOnto
          .replace("{0}", () => `<b><i>${escapeHtml(state.branch ?? "")}</i></b>`)
          .replace("{1}", () => baseText);
  const count = state.rows.length;
  const countText =
    count === 1
      ? l10n.rebaseEditorCountOne
      : l10n.rebaseEditorCountMany.replace("{0}", String(count));

  return (
    '<div class="rebaseEditorSubheader">' +
    `<span class="rebaseEditorTarget">${targetLine}</span>` +
    `<span class="rebaseEditorCount">${escapeHtml(countText)}</span>` +
    `<span class="rebaseEditorShortcutHint">${escapeHtml(l10n.rebaseEditorShortcutHint)}</span>` +
    "</div>"
  );
}

function renderNoticesHtml(state: RebaseEditorState, shortHashLength: number): string {
  const notices: string[] = [];

  if (!state.preflight.canStart) {
    for (const reason of state.preflight.reasons) {
      notices.push(
        '<div class="rebaseEditorNotice rebaseEditorNotice-error" role="alert">' +
          `<span class="rebaseEditorNoticeIcon">${octicon("alert")}</span>` +
          `<span class="rebaseEditorNoticeText">${escapeHtml(preflightReasonMessage(reason))}</span>` +
          "</div>"
      );
    }
  }

  const published = getPublishedCommits(state);
  if (published.length > 0) {
    const hashes = formatHashList(published, shortHashLength);
    const text =
      published.length === 1
        ? l10n.rebasePublishedWarningOne.replace("{0}", () => hashes)
        : l10n.rebasePublishedWarningMany
            .replace("{0}", String(published.length))
            .replace("{1}", () => hashes);
    notices.push(
      '<div class="rebaseEditorNotice rebaseEditorNotice-warning" role="status">' +
        `<span class="rebaseEditorNoticeIcon">${octicon("alert")}</span>` +
        `<span class="rebaseEditorNoticeText">${escapeHtml(text)}</span>` +
        "</div>"
    );
  }

  const merges = getMergeCommits(state);
  if (merges.length > 0) {
    const hashes = formatHashList(merges, shortHashLength);
    const text =
      merges.length === 1
        ? l10n.rebaseMergeNoticeOne.replace("{0}", () => hashes)
        : l10n.rebaseMergeNoticeMany
            .replace("{0}", String(merges.length))
            .replace("{1}", () => hashes);
    notices.push(
      '<div class="rebaseEditorNotice rebaseEditorNotice-info" role="status">' +
        `<span class="rebaseEditorNoticeIcon">${octicon("info")}</span>` +
        `<span class="rebaseEditorNoticeText">${escapeHtml(text)}</span>` +
        "</div>"
    );
  }

  const dropped = countDroppedCommits(state);
  if (dropped > 0) {
    const text =
      dropped === 1
        ? l10n.rebaseDropNoticeOne
        : l10n.rebaseDropNoticeMany.replace("{0}", String(dropped));
    notices.push(
      '<div class="rebaseEditorNotice rebaseEditorNotice-drop" role="status">' +
        `<span class="rebaseEditorNoticeIcon">${octicon("info")}</span>` +
        `<span class="rebaseEditorNoticeText">${escapeHtml(text)}</span>` +
        "</div>"
    );
  }

  return notices.join("");
}

function renderRowHtml(
  row: RebaseEditorRow,
  index: number,
  total: number,
  selectedIndex: number,
  shortHashLength: number
): string {
  const shortHash = abbrevCommit(row.hash, shortHashLength);
  const selected = index === selectedIndex;
  const dropped = row.action === "drop";
  const classes = ["rebaseEditorRow", selected ? "selected" : "", dropped ? "isDropped" : ""]
    .filter((cls) => cls !== "")
    .join(" ");

  const optionsHtml = allowedActionsForRow(index)
    .map((action) => {
      const isSelected = row.action === action ? " selected" : "";
      return `<option value="${action}"${isSelected}>${escapeHtml(actionLabel(action))}</option>`;
    })
    .join("");

  const badges: string[] = [];
  if (row.isMerge) {
    badges.push(
      `<span class="rebaseEditorBadge rebaseEditorBadge-merge">${escapeHtml(l10n.rebaseBadgeMerge)}</span>`
    );
  }
  if (row.isPublished) {
    badges.push(
      `<span class="rebaseEditorBadge rebaseEditorBadge-published">${escapeHtml(l10n.rebaseBadgePublished)}</span>`
    );
  }

  const upDisabled = index === 0 ? " disabled" : "";
  const downDisabled = index === total - 1 ? " disabled" : "";
  const authorTooltip = row.email === "" ? row.author : `${row.author} <${row.email}>`;

  return (
    `<tr class="${classes}" data-hash="${escapeHtml(row.hash)}" data-index="${index}" data-action="${row.action}" tabindex="${selected ? "0" : "-1"}" aria-selected="${selected}">` +
    '<td class="rebaseEditorActionCell">' +
    `<select class="rebaseEditorActionSelect" data-index="${index}" aria-label="${escapeHtml(`${l10n.rebaseColumnAction} ${shortHash}`)}">${optionsHtml}</select>` +
    "</td>" +
    `<td class="rebaseEditorHashCell"><code class="rebaseEditorHash" title="${escapeHtml(row.hash)}">${escapeHtml(shortHash)}</code></td>` +
    '<td class="rebaseEditorSubjectCell">' +
    `<span class="rebaseEditorSubject">${escapeHtml(row.subject)}</span>` +
    badges.join("") +
    "</td>" +
    `<td class="rebaseEditorAuthorCell"><span class="rebaseEditorAuthor" title="${escapeHtml(authorTooltip)}">${escapeHtml(row.author)}</span></td>` +
    '<td class="rebaseEditorOrderCell">' +
    `<button type="button" class="rebaseEditorMoveBtn rebaseEditorMoveUp" data-index="${index}" aria-label="${escapeHtml(l10n.rebaseMoveUp)}" title="${escapeHtml(l10n.rebaseMoveUp)}"${upDisabled}>${octicon("arrow-up")}</button>` +
    `<button type="button" class="rebaseEditorMoveBtn rebaseEditorMoveDown" data-index="${index}" aria-label="${escapeHtml(l10n.rebaseMoveDown)}" title="${escapeHtml(l10n.rebaseMoveDown)}"${downDisabled}>${octicon("arrow-down")}</button>` +
    "</td>" +
    "</tr>"
  );
}

function renderTableRowsHtml(state: RebaseEditorState, shortHashLength: number): string {
  return state.rows
    .map((row, index) =>
      renderRowHtml(row, index, state.rows.length, state.selectedIndex, shortHashLength)
    )
    .join("");
}

function renderDialogShellHtml(state: RebaseEditorState, shortHashLength: number): string {
  const canStart = canStartInteractiveRebase(state);
  const modified = isRebaseStateModified(state);
  const startDisabledAttr = canStart ? "" : ' disabled aria-disabled="true"';
  const resetDisabledAttr = modified ? "" : " disabled";

  return (
    '<div class="dialogContent rebaseEditorContent">' +
    '<div class="rebaseEditorHeader">' +
    `<div class="dialogTitle rebaseEditorTitle">${escapeHtml(l10n.rebaseEditorTitle)}</div>` +
    renderSubheaderHtml(state) +
    "</div>" +
    `<div class="rebaseEditorNotices" id="rebaseEditorNotices" aria-live="polite">${renderNoticesHtml(state, shortHashLength)}</div>` +
    '<div class="rebaseEditorBody" id="rebaseEditorBody">' +
    `<table class="rebaseEditorTable" aria-label="${escapeHtml(l10n.rebaseEditorTitle)}">` +
    "<thead><tr>" +
    `<th scope="col" class="rebaseEditorColAction">${escapeHtml(l10n.rebaseColumnAction)}</th>` +
    `<th scope="col" class="rebaseEditorColHash">${escapeHtml(l10n.rebaseColumnCommit)}</th>` +
    `<th scope="col" class="rebaseEditorColSubject">${escapeHtml(l10n.rebaseColumnSubject)}</th>` +
    `<th scope="col" class="rebaseEditorColAuthor">${escapeHtml(l10n.rebaseColumnAuthor)}</th>` +
    `<th scope="col" class="rebaseEditorColOrder">${escapeHtml(l10n.rebaseColumnOrder)}</th>` +
    "</tr></thead>" +
    `<tbody id="rebaseEditorTbody">${renderTableRowsHtml(state, shortHashLength)}</tbody>` +
    "</table>" +
    "</div>" +
    "</div>" +
    '<div class="dialogActions rebaseEditorActions">' +
    `<button type="button" id="rebaseEditorReset" class="dialogBtn"${resetDisabledAttr}>${escapeHtml(l10n.rebaseReset)}</button>` +
    `<button type="button" id="dialogAction" class="dialogBtn dialogBtnPrimary"${startDisabledAttr}>${escapeHtml(l10n.rebaseStart)}</button>` +
    `<button type="button" id="dialogDismiss" class="dialogBtn">${escapeHtml(l10n.dialogCancel)}</button>` +
    "</div>"
  );
}

function syncDialogInteractiveState(
  dialog: HTMLElement,
  state: RebaseEditorState,
  shortHashLength: number
) {
  const canStart = canStartInteractiveRebase(state);
  const modified = isRebaseStateModified(state);
  dialog.className = canStart ? "active rebaseEditorDialog" : "active rebaseEditorDialog noInput";

  const notices = dialog.querySelector<HTMLElement>("#rebaseEditorNotices");
  if (notices !== null) {
    notices.innerHTML = renderNoticesHtml(state, shortHashLength);
  }

  const tbody = dialog.querySelector<HTMLElement>("#rebaseEditorTbody");
  const body = dialog.querySelector<HTMLElement>("#rebaseEditorBody");
  const savedScrollTop = body?.scrollTop ?? 0;
  if (tbody !== null) {
    tbody.innerHTML = renderTableRowsHtml(state, shortHashLength);
  }
  if (body !== null) {
    body.scrollTop = savedScrollTop;
  }

  const startBtn = dialog.querySelector<HTMLButtonElement>("#dialogAction");
  if (startBtn !== null) {
    startBtn.disabled = !canStart;
    if (canStart) startBtn.removeAttribute("aria-disabled");
    else startBtn.setAttribute("aria-disabled", "true");
  }

  const resetBtn = dialog.querySelector<HTMLButtonElement>("#rebaseEditorReset");
  if (resetBtn !== null) {
    resetBtn.disabled = !modified;
  }
}

function focusSelectedRow(
  dialog: HTMLElement,
  selectedIndex: number,
  focusTarget: "row" | "select" = "row"
) {
  if (selectedIndex < 0) return;
  const selector =
    focusTarget === "select"
      ? `.rebaseEditorActionSelect[data-index="${selectedIndex}"]`
      : `.rebaseEditorRow[data-index="${selectedIndex}"]`;
  const elem = dialog.querySelector<HTMLElement>(selector);
  elem?.focus();
}

export function openRebaseEditorDialog(
  dialog: HTMLElement,
  dialogBacking: HTMLElement,
  initialState: RebaseEditorState,
  options: RebaseEditorViewOptions,
  callbacks: RebaseEditorCallbacks
): RebaseEditorController {
  let state = initialState;

  dialogBacking.className = "active";
  dialog.className = canStartInteractiveRebase(state)
    ? "active rebaseEditorDialog"
    : "active rebaseEditorDialog noInput";
  dialog.innerHTML = renderDialogShellHtml(state, options.shortHashLength);

  const updateState = (nextState: RebaseEditorState, focusTarget?: "row" | "select") => {
    if (nextState === state) return;
    state = nextState;
    syncDialogInteractiveState(dialog, state, options.shortHashLength);
    callbacks.onStateChange?.(state);
    if (focusTarget !== undefined) {
      focusSelectedRow(dialog, state.selectedIndex, focusTarget);
    }
  };

  const triggerStart = () => {
    if (!canStartInteractiveRebase(state)) return;
    callbacks.onStart(toInteractiveRebasePayload(state));
  };

  const onChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!target.classList.contains("rebaseEditorActionSelect")) return;
    const index = Number.parseInt(target.dataset.index ?? "-1", 10);
    updateState(setRebaseRowAction(state, index, target.value as TodoAction), "select");
  };

  const onClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target === null) return;

    const moveUpBtn = target.closest<HTMLButtonElement>(".rebaseEditorMoveUp");
    if (moveUpBtn !== null && !moveUpBtn.disabled) {
      const index = Number.parseInt(moveUpBtn.dataset.index ?? "-1", 10);
      updateState(moveRebaseRowBy(state, index, -1), "row");
      return;
    }

    const moveDownBtn = target.closest<HTMLButtonElement>(".rebaseEditorMoveDown");
    if (moveDownBtn !== null && !moveDownBtn.disabled) {
      const index = Number.parseInt(moveDownBtn.dataset.index ?? "-1", 10);
      updateState(moveRebaseRowBy(state, index, 1), "row");
      return;
    }

    if (target.closest("#rebaseEditorReset") !== null) {
      updateState(resetRebaseEditorState(state), "row");
      return;
    }

    if (target.closest("#dialogAction") !== null) {
      triggerStart();
      return;
    }

    if (target.closest("#dialogDismiss") !== null) {
      destroy();
      callbacks.onCancel();
      return;
    }

    const rowElem = target.closest<HTMLElement>(".rebaseEditorRow");
    if (rowElem !== null && !(target instanceof HTMLSelectElement)) {
      const index = Number.parseInt(rowElem.dataset.index ?? "-1", 10);
      updateState(selectRebaseRow(state, index), "row");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!dialog.classList.contains("rebaseEditorDialog")) return;
    const targetTag = event.target instanceof Element ? event.target.tagName : undefined;
    const command = interpretRebaseEditorKey({
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      targetTagName: targetTag
    });
    if (command === null) return;

    if (command.type === "trap-focus") {
      const wrapped = trapFocusInContainer(dialog, command.reverse, document.activeElement);
      if (wrapped !== null) {
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const transition = applyRebaseKeyCommand(state, command);
    updateState(transition.state, "row");
    if (transition.startRequested) {
      triggerStart();
    }
  };

  const destroy = () => {
    dialog.removeEventListener("change", onChange);
    dialog.removeEventListener("click", onClick);
    dialog.removeEventListener("keydown", onKeyDown);
  };

  dialog.addEventListener("change", onChange);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("keydown", onKeyDown);

  focusSelectedRow(dialog, state.selectedIndex, "row");

  return {
    getState: () => state,
    destroy
  };
}
