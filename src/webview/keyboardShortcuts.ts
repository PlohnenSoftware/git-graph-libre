export type GlobalShortcutAction =
  | { type: "closeCommitDetails" }
  | { type: "closeFind" }
  | { type: "commitDetailsNavigate"; delta: -1 | 1 }
  | { type: "findNavigate"; delta: -1 | 1 }
  | { type: "jumpToHead" }
  | { type: "refresh" }
  | { type: "showFind" };

export interface GlobalShortcutKeyEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

export interface GlobalShortcutContext {
  readonly isEditableTarget: boolean;
  readonly isDialogActive: boolean;
  readonly isContextMenuActive: boolean;
  readonly isFindWidgetVisible: boolean;
  readonly hasFindQuery: boolean;
  readonly isCommitDetailsOpen: boolean;
}

function resolveEscape(context: GlobalShortcutContext): GlobalShortcutAction | null {
  if (context.isFindWidgetVisible) return { type: "closeFind" };
  if (context.isCommitDetailsOpen) return { type: "closeCommitDetails" };
  return null;
}

function resolveCommitDetailsNavigate(
  key: string,
  context: GlobalShortcutContext
): GlobalShortcutAction | null {
  if (!context.isCommitDetailsOpen) return null;
  return { type: "commitDetailsNavigate", delta: key === "ArrowUp" ? -1 : 1 };
}

function resolveCtrlOrMetaShortcut(event: GlobalShortcutKeyEvent): GlobalShortcutAction | null {
  const key = event.key.toLowerCase();
  if (!event.altKey && key === "f") return { type: "showFind" };
  if (event.altKey || event.shiftKey) return null;
  if (key === "r") return { type: "refresh" };
  if (key === "h") return { type: "jumpToHead" };
  return null;
}

function resolvePlainKeyShortcut(
  event: GlobalShortcutKeyEvent,
  context: GlobalShortcutContext
): GlobalShortcutAction | null {
  if (event.key === "Escape") return resolveEscape(context);
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    return resolveCommitDetailsNavigate(event.key, context);
  }
  return null;
}

/**
 * Maps a webview-level keydown event to a graph shortcut action. Dialogs, the
 * context menu, and editable targets keep their own keyboard behavior, so any
 * event owned by those surfaces resolves to no action.
 */
export function resolveGlobalShortcut(
  event: GlobalShortcutKeyEvent,
  context: GlobalShortcutContext
): GlobalShortcutAction | null {
  if (context.isDialogActive || context.isContextMenuActive || context.isEditableTarget) {
    return null;
  }
  if (event.key === "F3" && context.hasFindQuery) {
    return { type: "findNavigate", delta: event.shiftKey ? -1 : 1 };
  }
  if (event.ctrlKey || event.metaKey) return resolveCtrlOrMetaShortcut(event);
  if (event.altKey || event.shiftKey) return null;
  return resolvePlainKeyShortcut(event, context);
}
