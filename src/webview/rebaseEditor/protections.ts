/**
 * Interactive rebase protections (F2-07): dirty-tree autostash choice,
 * published-commit acknowledgement checkbox (IQ5), branch-in-other-worktree
 * disabled state + Open Worktree affordance, in-progress rebase banner
 * pointer, and very-long-range confirmation prompt.
 *
 * Kept in its own module so F2-07 stays cohesive and avoids entangling
 * row-editing changes in `model.ts` and `view.ts`.
 */

import type { GitOperationStateResult, GitWorktree, RebasePreflightReason } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import { octicon } from "@/octicons";
import { escapeHtml } from "@/webview/utils/html";

import {
  countDroppedCommits,
  getMergeCommits,
  getPublishedCommits,
  type RebaseEditorRow,
  type RebaseEditorState
} from "./model";

const MAX_LISTED_PUBLISHED_COMMITS = 12;

export type InteractiveRebaseMenuInput = {
  readonly operationState: GitOperationStateResult | null;
  readonly currentBranch: string | null;
  readonly worktrees: readonly GitWorktree[];
};

export type InteractiveRebaseMenuState =
  | { readonly disabled: false }
  | { readonly disabled: true; readonly kind: "inProgress"; readonly reason: string }
  | {
      readonly disabled: true;
      readonly kind: "worktree";
      readonly reason: string;
      readonly worktreePath: string;
    };

export type ProtectionNoticesOptions = {
  readonly canOpenWorktree?: boolean;
};

/** Finds another (non-current) worktree that currently holds `branch`. */
export function findOtherWorktreeForBranch(
  worktrees: readonly GitWorktree[],
  branch: string | null
): GitWorktree | null {
  if (branch === null) return null;
  return worktrees.find((wt) => wt.branch === branch && !wt.isCurrent) ?? null;
}

/**
 * Decides whether the graph's "Interactive Rebase…" menu entry should be
 * disabled before opening the editor, and with what localized reason.
 */
export function evaluateInteractiveRebaseMenuState(
  input: InteractiveRebaseMenuInput
): InteractiveRebaseMenuState {
  if (input.operationState?.kind === "rebase") {
    return {
      disabled: true,
      kind: "inProgress",
      reason: l10n.rebaseMenuDisabledInProgress
    };
  }
  const otherWorktree = findOtherWorktreeForBranch(input.worktrees, input.currentBranch);
  if (otherWorktree !== null) {
    return {
      disabled: true,
      kind: "worktree",
      reason: l10n.rebaseMenuDisabledWorktree.replace("{0}", () => otherWorktree.path),
      worktreePath: otherWorktree.path
    };
  }
  return { disabled: false };
}

function formatHashList(rows: readonly RebaseEditorRow[], shortHashLength: number): string {
  return rows.map((row) => abbrevCommit(row.hash, shortHashLength)).join(", ");
}

function renderDirtyNoticeHtml(state: RebaseEditorState): string {
  const checkedAttr = state.autostash ? " checked" : "";
  const severityClass = state.autostash ? "rebaseEditorNotice-info" : "rebaseEditorNotice-error";
  const roleAttr = state.autostash ? 'role="status"' : 'role="alert"';
  const iconName = state.autostash ? "info" : "alert";

  return (
    `<div class="rebaseEditorNotice ${severityClass} rebaseEditorNotice-dirty" ${roleAttr}>` +
    `<span class="rebaseEditorNoticeIcon">${octicon(iconName)}</span>` +
    '<div class="rebaseEditorNoticeBody">' +
    `<div class="rebaseEditorNoticeText">${escapeHtml(l10n.rebasePreflightDirty)} ${escapeHtml(l10n.rebaseDirtyExplain)}</div>` +
    '<label class="checkRow rebaseEditorCheckRow">' +
    `<input type="checkbox" id="rebaseEditorAutostash" class="rebaseEditorCheckbox"${checkedAttr}>` +
    `<span>${escapeHtml(l10n.rebaseAutostashOption)}</span>` +
    "</label>" +
    "</div>" +
    "</div>"
  );
}

function blockerMessage(reason: RebasePreflightReason, state: RebaseEditorState): string {
  switch (reason) {
    case "inProgress":
      return state.inProgressKind === "rebase"
        ? l10n.rebasePreflightRebaseInProgress
        : l10n.rebasePreflightInProgress;
    case "dirty":
      return l10n.rebasePreflightDirty;
    case "alreadyUsedElsewhere":
      return state.otherWorktreePath === null
        ? l10n.rebasePreflightUsedElsewhere
        : l10n.rebaseUsedElsewhereAt.replace("{0}", () => state.otherWorktreePath as string);
    case "emptyRange":
      return l10n.rebasePreflightEmpty;
    case "readFailed":
      return l10n.unableToLoadRebaseRange;
  }
}

function renderBlockerNoticeHtml(
  reason: RebasePreflightReason,
  state: RebaseEditorState,
  canOpenWorktree: boolean
): string {
  const showOpenWorktree =
    reason === "alreadyUsedElsewhere" && state.otherWorktreePath !== null && canOpenWorktree;
  const openBtnHtml = showOpenWorktree
    ? `<div class="rebaseEditorInlineActions"><button type="button" id="rebaseEditorOpenWorktree" class="dialogBtn rebaseEditorInlineBtn">${escapeHtml(`${l10n.openWorktree}…`)}</button></div>`
    : "";

  return (
    `<div class="rebaseEditorNotice rebaseEditorNotice-error" role="alert" data-reason="${reason}">` +
    `<span class="rebaseEditorNoticeIcon">${octicon("alert")}</span>` +
    '<div class="rebaseEditorNoticeBody">' +
    `<div class="rebaseEditorNoticeText">${escapeHtml(blockerMessage(reason, state))}</div>` +
    openBtnHtml +
    "</div>" +
    "</div>"
  );
}

function renderPublishedListHtml(
  published: readonly RebaseEditorRow[],
  shortHashLength: number
): string {
  const visible = published.slice(0, MAX_LISTED_PUBLISHED_COMMITS);
  const items = visible
    .map((row) => {
      const shortHash = abbrevCommit(row.hash, shortHashLength);
      return (
        '<li class="rebaseEditorPublishedItem">' +
        `<code class="rebaseEditorHash">${escapeHtml(shortHash)}</code> ` +
        `<span class="rebaseEditorPublishedSubject">${escapeHtml(row.subject)}</span>` +
        "</li>"
      );
    })
    .join("");
  const remaining = published.length - visible.length;
  const moreItem =
    remaining > 0
      ? `<li class="rebaseEditorPublishedMore">${escapeHtml(l10n.rebasePublishedMore.replace("{0}", String(remaining)))}</li>`
      : "";
  return `<ul class="rebaseEditorPublishedList">${items}${moreItem}</ul>`;
}

function renderPublishedNoticeHtml(state: RebaseEditorState, shortHashLength: number): string {
  const published = getPublishedCommits(state);
  if (published.length === 0) return "";
  const hashes = formatHashList(published, shortHashLength);
  const text =
    published.length === 1
      ? l10n.rebasePublishedWarningOne.replace("{0}", () => hashes)
      : l10n.rebasePublishedWarningMany
          .replace("{0}", String(published.length))
          .replace("{1}", () => hashes);
  const ackHtml = state.requirePublishedAck
    ? '<label class="checkRow rebaseEditorCheckRow">' +
      `<input type="checkbox" id="rebaseEditorPublishedAck" class="rebaseEditorCheckbox"${state.publishedAcked ? " checked" : ""}>` +
      `<span>${escapeHtml(l10n.rebasePublishedAck)}</span>` +
      "</label>"
    : "";

  return (
    '<div class="rebaseEditorNotice rebaseEditorNotice-warning rebaseEditorNotice-published" role="status">' +
    `<span class="rebaseEditorNoticeIcon">${octicon("alert")}</span>` +
    '<div class="rebaseEditorNoticeBody">' +
    `<div class="rebaseEditorNoticeText">${escapeHtml(text)}</div>` +
    renderPublishedListHtml(published, shortHashLength) +
    ackHtml +
    "</div>" +
    "</div>"
  );
}

function renderLongRangeNoticeHtml(state: RebaseEditorState): string {
  if (!state.tooLong) return "";
  const text = l10n.rebaseTooLongNotice.replace("{0}", () => String(state.rows.length));
  return (
    '<div class="rebaseEditorNotice rebaseEditorNotice-warning rebaseEditorNotice-tooLong" role="status">' +
    `<span class="rebaseEditorNoticeIcon">${octicon("alert")}</span>` +
    `<span class="rebaseEditorNoticeText">${escapeHtml(text)}</span>` +
    "</div>"
  );
}

function renderMergeNoticeHtml(state: RebaseEditorState, shortHashLength: number): string {
  const merges = getMergeCommits(state);
  if (merges.length === 0) return "";
  const hashes = formatHashList(merges, shortHashLength);
  const text =
    merges.length === 1
      ? l10n.rebaseMergeNoticeOne.replace("{0}", () => hashes)
      : l10n.rebaseMergeNoticeMany
          .replace("{0}", String(merges.length))
          .replace("{1}", () => hashes);
  return (
    '<div class="rebaseEditorNotice rebaseEditorNotice-info" role="status">' +
    `<span class="rebaseEditorNoticeIcon">${octicon("info")}</span>` +
    `<span class="rebaseEditorNoticeText">${escapeHtml(text)}</span>` +
    "</div>"
  );
}

function renderDropNoticeHtml(state: RebaseEditorState): string {
  const dropped = countDroppedCommits(state);
  if (dropped === 0) return "";
  const text =
    dropped === 1
      ? l10n.rebaseDropNoticeOne
      : l10n.rebaseDropNoticeMany.replace("{0}", String(dropped));
  return (
    '<div class="rebaseEditorNotice rebaseEditorNotice-drop" role="status">' +
    `<span class="rebaseEditorNoticeIcon">${octicon("info")}</span>` +
    `<span class="rebaseEditorNoticeText">${escapeHtml(text)}</span>` +
    "</div>"
  );
}

/** Renders all protection, warning and informational notices for the editor dialog. */
export function renderProtectionNoticesHtml(
  state: RebaseEditorState,
  shortHashLength: number,
  options: ProtectionNoticesOptions = {}
): string {
  const notices: string[] = [];
  const canOpenWorktree = options.canOpenWorktree === true;

  for (const reason of state.preflight.reasons) {
    if (reason === "dirty") {
      notices.push(renderDirtyNoticeHtml(state));
    } else {
      notices.push(renderBlockerNoticeHtml(reason, state, canOpenWorktree));
    }
  }

  const published = renderPublishedNoticeHtml(state, shortHashLength);
  if (published !== "") notices.push(published);

  const tooLong = renderLongRangeNoticeHtml(state);
  if (tooLong !== "") notices.push(tooLong);

  const merges = renderMergeNoticeHtml(state, shortHashLength);
  if (merges !== "") notices.push(merges);

  const drops = renderDropNoticeHtml(state);
  if (drops !== "") notices.push(drops);

  return notices.join("");
}

/**
 * Renders the inline confirmation prompt shown before starting a very long
 * rebase range (`state.tooLong`). Empty until Start is requested.
 */
export function renderLongRangeConfirmHtml(state: RebaseEditorState): string {
  if (!state.longRangeConfirmPending) return "";
  const confirmText = l10n.rebaseTooLongConfirm.replace("{0}", () => String(state.rows.length));
  return (
    `<div class="rebaseEditorLongRangePrompt" id="rebaseEditorLongRangePrompt" role="alertdialog" aria-label="${escapeHtml(confirmText)}">` +
    `<span class="rebaseEditorNoticeIcon">${octicon("alert")}</span>` +
    `<span class="rebaseEditorNoticeText">${escapeHtml(confirmText)}</span>` +
    '<div class="rebaseEditorLongRangeActions">' +
    `<button type="button" id="rebaseEditorConfirmLongRange" class="dialogBtn dialogBtnPrimary">${escapeHtml(l10n.rebaseTooLongConfirmAction)}</button>` +
    `<button type="button" id="rebaseEditorCancelLongRange" class="dialogBtn">${escapeHtml(l10n.dialogCancel)}</button>` +
    "</div>" +
    "</div>"
  );
}
