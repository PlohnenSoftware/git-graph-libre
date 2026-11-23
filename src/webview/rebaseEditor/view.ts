import type { TodoAction } from "@/backend/rebase/todo";
import { abbrevCommit } from "@/backend/utils/string";
import { octicon } from "@/octicons";
import { escapeHtml } from "@/webview/utils/html";

import { applyRebaseKeyCommand, interpretRebaseEditorKey, trapFocusInContainer } from "./keyboard";
import {
  allowedActionsForRow,
  canStartInteractiveRebase,
  type InteractiveRebaseStartPayload,
  isRebaseStateModified,
  moveRebaseRowBy,
  type RebaseEditorRow,
  type RebaseEditorState,
  resetRebaseEditorState,
  selectRebaseRow,
  setAutostash,
  setLongRangeConfirmPending,
  setPublishedAcked,
  setRebaseRowAction,
  toInteractiveRebasePayload
} from "./model";
import { renderLongRangeConfirmHtml, renderProtectionNoticesHtml } from "./protections";

export type RebaseEditorCallbacks = {
  readonly onStart: (payload: InteractiveRebaseStartPayload) => void;
  readonly onCancel: () => void;
  readonly onStateChange?: (state: RebaseEditorState) => void;
  /** Opens the worktree holding the current branch (W31), when available. */
  readonly onOpenWorktree?: (worktreePath: string) => void;
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

function renderNoticesHtml(
  state: RebaseEditorState,
  shortHashLength: number,
  canOpenWorktree: boolean
): string {
  return renderProtectionNoticesHtml(state, shortHashLength, { canOpenWorktree });
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

function renderDialogShellHtml(
  state: RebaseEditorState,
  shortHashLength: number,
  canOpenWorktree: boolean
): string {
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
    `<div class="rebaseEditorNotices" id="rebaseEditorNotices" aria-live="polite">${renderNoticesHtml(state, shortHashLength, canOpenWorktree)}</div>` +
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
    `<div class="rebaseEditorLongRangeSlot" id="rebaseEditorLongRangeSlot">${renderLongRangeConfirmHtml(state)}</div>` +
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
  shortHashLength: number,
  canOpenWorktree: boolean
) {
  const canStart = canStartInteractiveRebase(state);
  const modified = isRebaseStateModified(state);
  dialog.className = canStart ? "active rebaseEditorDialog" : "active rebaseEditorDialog noInput";

  const notices = dialog.querySelector<HTMLElement>("#rebaseEditorNotices");
  if (notices !== null) {
    notices.innerHTML = renderNoticesHtml(state, shortHashLength, canOpenWorktree);
  }

  const longRangeSlot = dialog.querySelector<HTMLElement>("#rebaseEditorLongRangeSlot");
  if (longRangeSlot !== null) {
    longRangeSlot.innerHTML = renderLongRangeConfirmHtml(state);
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

type EditorFocusTarget = "row" | "select" | "autostash" | "publishedAck" | "longRangeConfirm";

function focusEditorTarget(
  dialog: HTMLElement,
  selectedIndex: number,
  focusTarget: EditorFocusTarget = "row"
) {
  if (focusTarget === "autostash") {
    dialog.querySelector<HTMLElement>("#rebaseEditorAutostash")?.focus();
    return;
  }
  if (focusTarget === "publishedAck") {
    dialog.querySelector<HTMLElement>("#rebaseEditorPublishedAck")?.focus();
    return;
  }
  if (focusTarget === "longRangeConfirm") {
    dialog.querySelector<HTMLElement>("#rebaseEditorConfirmLongRange")?.focus();
    return;
  }
  if (selectedIndex < 0) return;
  const selector =
    focusTarget === "select"
      ? `.rebaseEditorActionSelect[data-index="${selectedIndex}"]`
      : `.rebaseEditorRow[data-index="${selectedIndex}"]`;
  dialog.querySelector<HTMLElement>(selector)?.focus();
}

export function openRebaseEditorDialog(
  dialog: HTMLElement,
  dialogBacking: HTMLElement,
  initialState: RebaseEditorState,
  options: RebaseEditorViewOptions,
  callbacks: RebaseEditorCallbacks
): RebaseEditorController {
  let state = initialState;
  const canOpenWorktree = callbacks.onOpenWorktree !== undefined;

  dialogBacking.className = "active";
  dialog.className = canStartInteractiveRebase(state)
    ? "active rebaseEditorDialog"
    : "active rebaseEditorDialog noInput";
  dialog.innerHTML = renderDialogShellHtml(state, options.shortHashLength, canOpenWorktree);

  const updateState = (nextState: RebaseEditorState, focusTarget?: EditorFocusTarget) => {
    if (nextState === state) return;
    state = nextState;
    syncDialogInteractiveState(dialog, state, options.shortHashLength, canOpenWorktree);
    callbacks.onStateChange?.(state);
    if (focusTarget !== undefined) {
      focusEditorTarget(dialog, state.selectedIndex, focusTarget);
    }
  };

  const triggerStart = () => {
    if (!canStartInteractiveRebase(state)) return;
    if (state.tooLong && !state.longRangeConfirmPending) {
      updateState(setLongRangeConfirmPending(state, true), "longRangeConfirm");
      return;
    }
    callbacks.onStart(toInteractiveRebasePayload(state));
  };

  const onChange = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      if (target.id === "rebaseEditorAutostash") {
        updateState(setAutostash(state, target.checked), "autostash");
        return;
      }
      if (target.id === "rebaseEditorPublishedAck") {
        updateState(setPublishedAcked(state, target.checked), "publishedAck");
        return;
      }
    }
    if (!(target instanceof HTMLSelectElement)) return;
    if (!target.classList.contains("rebaseEditorActionSelect")) return;
    const index = Number.parseInt(target.dataset.index ?? "-1", 10);
    updateState(setRebaseRowAction(state, index, target.value as TodoAction), "select");
  };

  const handleProtectionClick = (target: Element): boolean => {
    if (target.closest("#rebaseEditorOpenWorktree") !== null) {
      if (state.otherWorktreePath !== null) {
        callbacks.onOpenWorktree?.(state.otherWorktreePath);
      }
      return true;
    }
    if (target.closest("#rebaseEditorConfirmLongRange") !== null) {
      if (canStartInteractiveRebase(state)) {
        callbacks.onStart(toInteractiveRebasePayload(state));
      }
      return true;
    }
    if (target.closest("#rebaseEditorCancelLongRange") !== null) {
      updateState(setLongRangeConfirmPending(state, false), "row");
      return true;
    }
    return false;
  };

  const onClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target === null) return;
    if (handleProtectionClick(target)) return;

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

  focusEditorTarget(dialog, state.selectedIndex, "row");

  return {
    getState: () => state,
    destroy
  };
}
