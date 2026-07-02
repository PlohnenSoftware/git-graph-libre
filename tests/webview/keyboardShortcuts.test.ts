import { describe, expect, it } from "vitest";

import {
  type GlobalShortcutContext,
  type GlobalShortcutKeyEvent,
  resolveGlobalShortcut
} from "@/webview/keyboardShortcuts";

function keyEvent(overrides: Partial<GlobalShortcutKeyEvent> & { key: string }) {
  return {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides
  };
}

function context(overrides: Partial<GlobalShortcutContext> = {}): GlobalShortcutContext {
  return {
    isEditableTarget: false,
    isDialogActive: false,
    isContextMenuActive: false,
    isFindWidgetVisible: false,
    hasFindQuery: false,
    isCommitDetailsOpen: false,
    ...overrides
  };
}

describe("resolveGlobalShortcut", () => {
  it("opens find with Ctrl/Cmd+F", () => {
    expect(resolveGlobalShortcut(keyEvent({ key: "f", ctrlKey: true }), context())).toEqual({
      type: "showFind"
    });
    expect(resolveGlobalShortcut(keyEvent({ key: "F", metaKey: true }), context())).toEqual({
      type: "showFind"
    });
    expect(
      resolveGlobalShortcut(keyEvent({ key: "f", ctrlKey: true, altKey: true }), context())
    ).toBeNull();
    expect(resolveGlobalShortcut(keyEvent({ key: "f" }), context())).toBeNull();
  });

  it("navigates find matches with F3 only while a query exists", () => {
    const findable = context({ hasFindQuery: true });

    expect(resolveGlobalShortcut(keyEvent({ key: "F3" }), findable)).toEqual({
      type: "findNavigate",
      delta: 1
    });
    expect(resolveGlobalShortcut(keyEvent({ key: "F3", shiftKey: true }), findable)).toEqual({
      type: "findNavigate",
      delta: -1
    });
    expect(resolveGlobalShortcut(keyEvent({ key: "F3" }), context())).toBeNull();
  });

  it("refreshes with Ctrl/Cmd+R and jumps to HEAD with Ctrl/Cmd+H", () => {
    expect(resolveGlobalShortcut(keyEvent({ key: "r", ctrlKey: true }), context())).toEqual({
      type: "refresh"
    });
    expect(resolveGlobalShortcut(keyEvent({ key: "R", metaKey: true }), context())).toEqual({
      type: "refresh"
    });
    expect(resolveGlobalShortcut(keyEvent({ key: "h", ctrlKey: true }), context())).toEqual({
      type: "jumpToHead"
    });
    expect(
      resolveGlobalShortcut(keyEvent({ key: "r", ctrlKey: true, shiftKey: true }), context())
    ).toBeNull();
    expect(
      resolveGlobalShortcut(keyEvent({ key: "h", ctrlKey: true, altKey: true }), context())
    ).toBeNull();
    expect(resolveGlobalShortcut(keyEvent({ key: "r" }), context())).toBeNull();
    expect(resolveGlobalShortcut(keyEvent({ key: "h" }), context())).toBeNull();
  });

  it("closes the find widget before commit details on Escape", () => {
    expect(
      resolveGlobalShortcut(
        keyEvent({ key: "Escape" }),
        context({ isFindWidgetVisible: true, isCommitDetailsOpen: true })
      )
    ).toEqual({ type: "closeFind" });
    expect(
      resolveGlobalShortcut(keyEvent({ key: "Escape" }), context({ isCommitDetailsOpen: true }))
    ).toEqual({ type: "closeCommitDetails" });
    expect(resolveGlobalShortcut(keyEvent({ key: "Escape" }), context())).toBeNull();
    expect(
      resolveGlobalShortcut(
        keyEvent({ key: "Escape", shiftKey: true }),
        context({ isFindWidgetVisible: true })
      )
    ).toBeNull();
  });

  it("navigates commit details with plain arrow keys only while details are open", () => {
    const detailsOpen = context({ isCommitDetailsOpen: true });

    expect(resolveGlobalShortcut(keyEvent({ key: "ArrowDown" }), detailsOpen)).toEqual({
      type: "commitDetailsNavigate",
      delta: 1
    });
    expect(resolveGlobalShortcut(keyEvent({ key: "ArrowUp" }), detailsOpen)).toEqual({
      type: "commitDetailsNavigate",
      delta: -1
    });
    expect(resolveGlobalShortcut(keyEvent({ key: "ArrowDown" }), context())).toBeNull();
    expect(
      resolveGlobalShortcut(keyEvent({ key: "ArrowDown", ctrlKey: true }), detailsOpen)
    ).toBeNull();
    expect(
      resolveGlobalShortcut(keyEvent({ key: "ArrowUp", shiftKey: true }), detailsOpen)
    ).toBeNull();
  });

  it("stays inert for dialogs, the context menu, and editable targets", () => {
    const events = [
      keyEvent({ key: "f", ctrlKey: true }),
      keyEvent({ key: "F3" }),
      keyEvent({ key: "r", ctrlKey: true }),
      keyEvent({ key: "h", ctrlKey: true }),
      keyEvent({ key: "Escape" }),
      keyEvent({ key: "ArrowDown" })
    ];
    const busyOverrides = {
      isFindWidgetVisible: true,
      hasFindQuery: true,
      isCommitDetailsOpen: true
    };
    const busyContexts = [
      context({ ...busyOverrides, isDialogActive: true }),
      context({ ...busyOverrides, isContextMenuActive: true }),
      context({ ...busyOverrides, isEditableTarget: true })
    ];

    for (const busyContext of busyContexts) {
      for (const event of events) {
        expect(resolveGlobalShortcut(event, busyContext)).toBeNull();
      }
    }
  });
});
