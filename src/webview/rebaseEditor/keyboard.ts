import type { TodoAction } from "@/backend/rebase/todo";

import {
  canStartInteractiveRebase,
  moveRebaseRowBy,
  type RebaseEditorState,
  selectRebaseRow,
  setRebaseRowAction
} from "./model";

export type RebaseKeyInput = {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly targetTagName?: string;
};

export type RebaseKeyCommand =
  | { readonly type: "start" }
  | { readonly type: "move-row"; readonly delta: -1 | 1 }
  | { readonly type: "select-row"; readonly delta: -1 | 1 }
  | { readonly type: "set-action"; readonly action: TodoAction }
  | { readonly type: "trap-focus"; readonly reverse: boolean };

export type RebaseKeyTransition = {
  readonly state: RebaseEditorState;
  readonly startRequested: boolean;
};

const ACTION_SHORTCUTS: Readonly<Record<string, TodoAction>> = {
  p: "pick",
  d: "drop"
};

function isEditableControlTag(tagName: string | undefined): boolean {
  if (tagName === undefined) return false;
  const upper = tagName.toUpperCase();
  return upper === "SELECT" || upper === "INPUT" || upper === "TEXTAREA";
}

function interpretArrowKey(event: RebaseKeyInput): RebaseKeyCommand | null {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const delta: -1 | 1 = event.key === "ArrowUp" ? -1 : 1;
  if (event.shiftKey) {
    return { type: "move-row", delta };
  }
  if (isEditableControlTag(event.targetTagName)) return null;
  return { type: "select-row", delta };
}

export function interpretRebaseEditorKey(event: RebaseKeyInput): RebaseKeyCommand | null {
  if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return { type: "trap-focus", reverse: event.shiftKey };
  }
  if (
    event.key === "Enter" &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey
  ) {
    return { type: "start" };
  }

  const arrowCommand = interpretArrowKey(event);
  if (arrowCommand !== null) return arrowCommand;

  if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isEditableControlTag(event.targetTagName)) return null;

  const shortcutAction = ACTION_SHORTCUTS[event.key.toLowerCase()];
  return shortcutAction === undefined ? null : { type: "set-action", action: shortcutAction };
}

export function applyRebaseKeyCommand(
  state: RebaseEditorState,
  command: RebaseKeyCommand
): RebaseKeyTransition {
  switch (command.type) {
    case "start":
      return {
        state,
        startRequested: canStartInteractiveRebase(state)
      };
    case "move-row":
      return {
        state:
          state.selectedIndex >= 0
            ? moveRebaseRowBy(state, state.selectedIndex, command.delta)
            : state,
        startRequested: false
      };
    case "select-row":
      return {
        state:
          state.selectedIndex >= 0
            ? selectRebaseRow(state, state.selectedIndex + command.delta)
            : state,
        startRequested: false
      };
    case "set-action":
      return {
        state:
          state.selectedIndex >= 0
            ? setRebaseRowAction(state, state.selectedIndex, command.action)
            : state,
        startRequested: false
      };
    case "trap-focus":
      return {
        state,
        startRequested: false
      };
  }
}

const FOCUSABLE_SELECTOR = [
  "select:not(:disabled)",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])'
].join(", ");

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (elem) => !elem.hidden && elem.getAttribute("aria-disabled") !== "true"
  );
}

/**
 * Traps Tab / Shift+Tab focus within `container`. Returns the newly focused
 * element when wrapping occurred, or `null` when native Tab navigation should
 * proceed between interior elements.
 */
export function trapFocusInContainer(
  container: HTMLElement,
  reverse: boolean,
  activeElement: Element | null = document.activeElement
): HTMLElement | null {
  const focusables = getFocusableElements(container);
  if (focusables.length === 0) return null;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const currentIndex =
    activeElement instanceof HTMLElement ? focusables.indexOf(activeElement) : -1;

  if (currentIndex === -1) {
    const target = reverse ? last : first;
    target.focus();
    return target;
  }
  if (!reverse && currentIndex === focusables.length - 1) {
    first.focus();
    return first;
  }
  if (reverse && currentIndex === 0) {
    last.focus();
    return last;
  }
  return null;
}
