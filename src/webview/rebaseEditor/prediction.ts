/**
 * Debounced conflict prediction status line and file-list popover for the
 * interactive rebase editor (F2-08).
 *
 * Kept in its own module beside `protections.ts` and `groups.ts` so prediction
 * timers, stale-response tracking and the body-mounted popover stay isolated
 * from row editing in `model.ts` and `view.ts`. Every path from Git is placed
 * via `textContent`; only the static octicon SVG goes through `innerHTML`.
 */

import type { GitRebasePredictionEntry, GitRebasePredictionResult } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import { type OcticonName, octicon } from "@/octicons";

import type { RebaseEditorState } from "./model";

/** Delay after the last todo edit before querying the backend for a prediction. */
export const REBASE_PREDICTION_DEBOUNCE_MS = 250;
const POPOVER_CLOSE_DELAY_MS = 200;
const POPOVER_EDGE_GAP_PX = 6;
const POPOVER_ID = "rebasePredictionPopover";

export type RebasePredictionRequest = {
  readonly seq: number;
  readonly base: string | null;
  readonly entries: GitRebasePredictionEntry[];
};

export type RebasePredictionController = {
  /** Re-evaluates when the todo's order or actions changed; no-op on message/selection edits. */
  readonly notifyState: (state: RebaseEditorState) => void;
  /** Applies a host response if its sequence number still matches the latest request. */
  readonly applyResult: (seq: number, result: GitRebasePredictionResult) => void;
  readonly destroy: () => void;
};

type PredictionDisplay =
  | { readonly kind: "idle" }
  | { readonly kind: "checking" }
  | { readonly kind: "result"; readonly result: GitRebasePredictionResult };

type StatusPresentation = {
  readonly tone: "checking" | "clean" | "capped" | "conflict" | "unavailable" | "error";
  readonly icon: OcticonName;
  readonly text: string;
  readonly conflictFiles: readonly string[];
};

/**
 * Computes a signature for the todo aspects that affect tree replay (order and
 * actions). Selection moves, checkbox toggles, and commit message typing leave
 * this signature unchanged so they do not re-trigger Git probes.
 */
export function predictionTodoSignature(state: RebaseEditorState): string {
  return `${state.base ?? "__root__"}|${state.rows
    .map((row) => `${row.action}:${row.hash}`)
    .join(",")}`;
}

function conflictLineText(
  conflictHash: string | null,
  fileCount: number,
  shortHashLength: number
): string {
  const shortHash = conflictHash === null ? "" : abbrevCommit(conflictHash, shortHashLength);
  if (fileCount === 1) {
    return l10n.rebasePredictionConflictOne.replace("{0}", () => shortHash);
  }
  return l10n.rebasePredictionConflictMany
    .replace("{0}", () => shortHash)
    .replace("{1}", () => String(fileCount));
}

function describePrediction(
  display: PredictionDisplay,
  shortHashLength: number
): StatusPresentation | null {
  if (display.kind === "idle") return null;
  if (display.kind === "checking") {
    return {
      tone: "checking",
      icon: "sync",
      text: l10n.rebasePredictionChecking,
      conflictFiles: []
    };
  }
  const { result } = display;
  switch (result.status) {
    case "clean":
      return {
        tone: "clean",
        icon: "check",
        text: l10n.rebasePredictionClean,
        conflictFiles: []
      };
    case "capped":
      return {
        tone: "capped",
        icon: "info",
        text: l10n.rebasePredictionCapped
          .replace("{0}", () => String(result.probedCount))
          .replace("{1}", () => String(result.totalSteps)),
        conflictFiles: []
      };
    case "conflict":
      return {
        tone: "conflict",
        icon: "alert",
        text: conflictLineText(result.conflictHash, result.conflictFiles.length, shortHashLength),
        conflictFiles: result.conflictFiles
      };
    case "unavailable":
      return {
        tone: "unavailable",
        icon: "info",
        text: l10n.rebasePredictionUnavailable,
        conflictFiles: []
      };
    case "error":
      return {
        tone: "error",
        icon: "info",
        text: l10n.rebasePredictionFailed,
        conflictFiles: []
      };
  }
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const popoverWidth = popover.offsetWidth;
  const popoverHeight = popover.offsetHeight;
  const maxLeft = Math.max(
    POPOVER_EDGE_GAP_PX,
    window.innerWidth - popoverWidth - POPOVER_EDGE_GAP_PX
  );
  const left = Math.max(POPOVER_EDGE_GAP_PX, Math.min(rect.left, maxLeft));

  const spaceAbove = rect.top - POPOVER_EDGE_GAP_PX;
  const placeAbove =
    popoverHeight > 0 ? spaceAbove >= popoverHeight + POPOVER_EDGE_GAP_PX : spaceAbove >= 120;
  const top = placeAbove
    ? Math.max(POPOVER_EDGE_GAP_PX, rect.top - popoverHeight - POPOVER_EDGE_GAP_PX)
    : Math.min(
        window.innerHeight - popoverHeight - POPOVER_EDGE_GAP_PX,
        rect.bottom + POPOVER_EDGE_GAP_PX
      );

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(Math.max(POPOVER_EDGE_GAP_PX, top))}px`;
}

function renderPopoverContent(popover: HTMLElement, files: readonly string[]): void {
  const title = document.createElement("div");
  title.className = "rebasePredictionPopoverTitle";
  title.textContent = l10n.rebasePredictionFilesTitle;

  const list = document.createElement("ul");
  list.className = "rebasePredictionFileList";
  for (const filePath of files) {
    const item = document.createElement("li");
    item.className = "rebasePredictionFileItem";
    item.textContent = filePath;
    list.appendChild(item);
  }
  popover.replaceChildren(title, list);
}

export type CreateRebasePredictionOptions = {
  readonly slot: HTMLElement;
  readonly shortHashLength: number;
  readonly onPredict?: (request: RebasePredictionRequest) => void;
  readonly debounceMs?: number;
};

/**
 * Creates the debounced prediction controller for one open rebase editor.
 * When `onPredict` is omitted the slot stays empty and no timers are created.
 */
export function createRebasePredictionController(
  options: CreateRebasePredictionOptions
): RebasePredictionController {
  const debounceMs = options.debounceMs ?? REBASE_PREDICTION_DEBOUNCE_MS;
  let destroyed = false;
  let latestSeq = 0;
  let lastSignature: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let display: PredictionDisplay = { kind: "idle" };
  let popoverPinned = false;
  let pointerOverPopover = false;
  let currentTrigger: HTMLButtonElement | null = null;
  let currentFiles: readonly string[] = [];

  const cancelDebounce = () => {
    if (debounceTimer === null) return;
    clearTimeout(debounceTimer);
    debounceTimer = null;
  };

  const cancelClose = () => {
    if (closeTimer === null) return;
    clearTimeout(closeTimer);
    closeTimer = null;
  };

  const getPopover = (): HTMLElement | null => document.getElementById(POPOVER_ID);

  const isPopoverOpen = (): boolean => {
    const popover = getPopover();
    return popover !== null && !popover.hidden;
  };

  const closePopover = () => {
    cancelClose();
    popoverPinned = false;
    pointerOverPopover = false;
    const popover = getPopover();
    if (popover !== null) popover.hidden = true;
    if (currentTrigger !== null) {
      currentTrigger.setAttribute("aria-expanded", "false");
    }
  };

  const scheduleClose = () => {
    if (popoverPinned) return;
    cancelClose();
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (!pointerOverPopover && !popoverPinned) closePopover();
    }, POPOVER_CLOSE_DELAY_MS);
  };

  const ensurePopover = (): HTMLElement => {
    const existing = getPopover();
    if (existing !== null) return existing;
    const popover = document.createElement("div");
    popover.id = POPOVER_ID;
    popover.className = "rebasePredictionPopover";
    popover.setAttribute("role", "region");
    popover.setAttribute("aria-label", l10n.rebasePredictionFilesTitle);
    popover.hidden = true;
    popover.addEventListener("mouseenter", () => {
      pointerOverPopover = true;
      cancelClose();
    });
    popover.addEventListener("mouseleave", () => {
      pointerOverPopover = false;
      scheduleClose();
    });
    document.body.appendChild(popover);
    return popover;
  };

  const openPopover = (trigger: HTMLButtonElement, pinned: boolean) => {
    if (currentFiles.length === 0) return;
    cancelClose();
    if (pinned) popoverPinned = true;
    const popover = ensurePopover();
    renderPopoverContent(popover, currentFiles);
    popover.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    positionPopover(popover, trigger);
  };

  const onDocumentMouseDown = (event: MouseEvent) => {
    if (!isPopoverOpen()) return;
    const target = event.target instanceof Node ? event.target : null;
    if (target === null) return;
    if (currentTrigger?.contains(target) || getPopover()?.contains(target)) return;
    closePopover();
  };

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !isPopoverOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    closePopover();
    currentTrigger?.focus();
  };

  const bindTriggerEvents = (trigger: HTMLButtonElement) => {
    trigger.addEventListener("click", () => {
      if (isPopoverOpen() && popoverPinned) {
        closePopover();
        return;
      }
      openPopover(trigger, true);
    });
    trigger.addEventListener("mouseenter", () => {
      cancelClose();
      openPopover(trigger, false);
    });
    trigger.addEventListener("mouseleave", () => {
      scheduleClose();
    });
  };

  const renderSlot = () => {
    closePopover();
    currentTrigger = null;
    currentFiles = [];
    const presentation = describePrediction(display, options.shortHashLength);
    if (presentation === null) {
      options.slot.replaceChildren();
      return;
    }

    const bar = document.createElement("div");
    bar.className = `rebasePredictionStatus rebasePredictionStatus-${presentation.tone}`;
    bar.dataset.status = presentation.tone;
    bar.setAttribute("role", "status");

    const icon = document.createElement("span");
    icon.className = "rebasePredictionIcon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = octicon(presentation.icon);
    bar.appendChild(icon);

    if (presentation.tone === "conflict" && presentation.conflictFiles.length > 0) {
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.id = "rebasePredictionTrigger";
      trigger.className = "rebasePredictionTrigger";
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", POPOVER_ID);
      trigger.textContent = presentation.text;
      currentTrigger = trigger;
      currentFiles = presentation.conflictFiles;
      bindTriggerEvents(trigger);
      bar.appendChild(trigger);
    } else {
      const text = document.createElement("span");
      text.className = "rebasePredictionText";
      text.textContent = presentation.text;
      bar.appendChild(text);
    }

    options.slot.replaceChildren(bar);
  };

  const notifyState = (state: RebaseEditorState) => {
    if (destroyed || options.onPredict === undefined) return;
    if (state.rows.length === 0) {
      cancelDebounce();
      lastSignature = null;
      latestSeq += 1;
      display = { kind: "idle" };
      renderSlot();
      return;
    }
    const signature = predictionTodoSignature(state);
    if (signature === lastSignature) return;
    lastSignature = signature;

    cancelDebounce();
    latestSeq += 1;
    const seq = latestSeq;
    const base = state.base;
    const entries: GitRebasePredictionEntry[] = state.rows.map((row) => ({
      action: row.action,
      hash: row.hash
    }));

    display = { kind: "checking" };
    renderSlot();

    const onPredict = options.onPredict;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (destroyed || seq !== latestSeq) return;
      onPredict({ seq, base, entries });
    }, debounceMs);
  };

  const applyResult = (seq: number, result: GitRebasePredictionResult) => {
    if (destroyed || seq !== latestSeq) return;
    display = { kind: "result", result };
    renderSlot();
  };

  const destroy = () => {
    destroyed = true;
    cancelDebounce();
    closePopover();
    getPopover()?.remove();
    document.removeEventListener("mousedown", onDocumentMouseDown);
    document.removeEventListener("keydown", onDocumentKeyDown, true);
  };

  document.addEventListener("mousedown", onDocumentMouseDown);
  document.addEventListener("keydown", onDocumentKeyDown, true);

  return {
    notifyState,
    applyResult,
    destroy
  };
}
