import { describe, expect, it } from "vitest";

import type { GitRebaseRangeCommit, GitRebaseRangeResult } from "@/backend/types";
import {
  allowedActionsForRow,
  applyRebaseKeyCommand,
  canActionBeFirstEntry,
  canStartInteractiveRebase,
  combinedGroupMessage,
  countDroppedCommits,
  createRebaseEditorState,
  getMergeCommits,
  getPublishedCommits,
  guardFirstEntryRows,
  hasEmptyRebaseMessage,
  interpretRebaseEditorKey,
  isRebaseStateModified,
  messageEditorsFor,
  moveRebaseRow,
  moveRebaseRowBy,
  originalMessageOf,
  REBASE_EDITOR_ACTIONS,
  resetRebaseEditorState,
  selectRebaseRow,
  setPublishedAcked,
  setRebaseRowAction,
  setRebaseRowMessage,
  toInteractiveRebasePayload
} from "@/webview/rebaseEditor";

const HASH_1 = "1111111111111111111111111111111111111111";
const HASH_2 = "2222222222222222222222222222222222222222";
const HASH_3 = "3333333333333333333333333333333333333333";
const BASE_HASH = "0000000000000000000000000000000000000000";

function makeCommit(
  hash: string,
  subject: string,
  overrides: Partial<GitRebaseRangeCommit> = {}
): GitRebaseRangeCommit {
  return {
    hash,
    subject,
    body: "",
    author: "Alice",
    email: "alice@example.test",
    parents: [BASE_HASH],
    isMerge: false,
    isPublished: false,
    ...overrides
  };
}

function makeRange(overrides: Partial<GitRebaseRangeResult> = {}): GitRebaseRangeResult {
  const commits = overrides.commits ?? [
    makeCommit(HASH_1, "First commit"),
    makeCommit(HASH_2, "Second commit"),
    makeCommit(HASH_3, "Third commit")
  ];
  return {
    commits,
    mergeCount: commits.filter((c) => c.isMerge).length,
    dirty: false,
    hasUntracked: false,
    inProgress: false,
    inProgressKind: null,
    detached: false,
    branch: "feature/editor",
    upstream: "origin/feature/editor",
    alreadyUsedElsewhere: false,
    tooLong: false,
    preflight: { canStart: true, reasons: [] },
    error: null,
    ...overrides
  };
}

describe("rebaseEditor model", () => {
  it("initializes rows oldest-first with pick actions and unchanged state", () => {
    const state = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });

    expect(state.rows.map((r) => [r.hash, r.action])).toEqual([
      [HASH_1, "pick"],
      [HASH_2, "pick"],
      [HASH_3, "pick"]
    ]);
    expect(state.selectedIndex).toBe(0);
    expect(isRebaseStateModified(state)).toBe(false);
    expect(canStartInteractiveRebase(state)).toBe(false);
    expect(countDroppedCommits(state)).toBe(0);
  });

  it("handles an empty range with selectedIndex -1 and canStart false", () => {
    const state = createRebaseEditorState(
      makeRange({
        commits: [],
        preflight: { canStart: false, reasons: ["emptyRange"] }
      }),
      { base: BASE_HASH, baseLabel: "00000000" }
    );

    expect(state.selectedIndex).toBe(-1);
    expect(selectRebaseRow(state, 0)).toBe(state);
    expect(canStartInteractiveRebase(state)).toBe(false);
  });

  it("detects modifications when an action changes to drop and counts dropped commits", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });

    const withOneDrop = setRebaseRowAction(initial, 1, "drop");
    expect(withOneDrop.rows[1].action).toBe("drop");
    expect(withOneDrop.selectedIndex).toBe(1);
    expect(countDroppedCommits(withOneDrop)).toBe(1);
    expect(isRebaseStateModified(withOneDrop)).toBe(true);
    expect(canStartInteractiveRebase(withOneDrop)).toBe(true);

    const withTwoDrops = setRebaseRowAction(withOneDrop, 2, "drop");
    expect(countDroppedCommits(withTwoDrops)).toBe(2);

    const restored = setRebaseRowAction(setRebaseRowAction(withTwoDrops, 1, "pick"), 2, "pick");
    expect(countDroppedCommits(restored)).toBe(0);
    expect(isRebaseStateModified(restored)).toBe(false);
    expect(canStartInteractiveRebase(restored)).toBe(false);
  });

  it("moves and reorders rows up and down and clamps out-of-bounds moves", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });

    // Moving first row up or last row down is a no-op
    expect(moveRebaseRowBy(initial, 0, -1)).toBe(initial);
    expect(moveRebaseRowBy(initial, 2, 1)).toBe(initial);
    expect(moveRebaseRow(initial, -1, 1)).toBe(initial);
    expect(moveRebaseRow(initial, 0, 5)).toBe(initial);

    // Move row 0 down to index 1
    const movedDown = moveRebaseRowBy(initial, 0, 1);
    expect(movedDown.rows.map((r) => r.hash)).toEqual([HASH_2, HASH_1, HASH_3]);
    expect(movedDown.selectedIndex).toBe(1);
    expect(isRebaseStateModified(movedDown)).toBe(true);
    expect(canStartInteractiveRebase(movedDown)).toBe(true);

    // Move row 2 up to index 0
    const reordered = moveRebaseRow(movedDown, 2, 0);
    expect(reordered.rows.map((r) => r.hash)).toEqual([HASH_3, HASH_2, HASH_1]);
    expect(reordered.selectedIndex).toBe(0);

    // Reset restores original order and pick actions
    const reset = resetRebaseEditorState(reordered);
    expect(reset.rows.map((r) => r.hash)).toEqual([HASH_1, HASH_2, HASH_3]);
    expect(isRebaseStateModified(reset)).toBe(false);
  });

  it("enforces the first-entry guard against squash and fixup on direct set and reorder", () => {
    expect(canActionBeFirstEntry("pick")).toBe(true);
    expect(canActionBeFirstEntry("drop")).toBe(true);
    expect(canActionBeFirstEntry("reword")).toBe(true);
    expect(canActionBeFirstEntry("edit")).toBe(true);
    expect(canActionBeFirstEntry("squash")).toBe(false);
    expect(canActionBeFirstEntry("fixup")).toBe(false);

    expect(allowedActionsForRow(0, ["pick", "reword", "edit", "squash", "fixup", "drop"])).toEqual([
      "pick",
      "reword",
      "edit",
      "drop"
    ]);
    expect(allowedActionsForRow(1, ["pick", "reword", "edit", "squash", "fixup", "drop"])).toEqual([
      "pick",
      "reword",
      "edit",
      "squash",
      "fixup",
      "drop"
    ]);

    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });

    // Direct squash/fixup on index 0 is refused
    expect(setRebaseRowAction(initial, 0, "squash")).toBe(initial);
    expect(setRebaseRowAction(initial, 0, "fixup")).toBe(initial);

    // Setting squash on index 1 succeeds, then moving index 1 to index 0 normalizes it to pick
    const row1Squash = setRebaseRowAction(initial, 1, "squash");
    expect(row1Squash.rows[1].action).toBe("squash");
    const movedToFirst = moveRebaseRowBy(row1Squash, 1, -1);
    expect(movedToFirst.rows[0].hash).toBe(HASH_2);
    expect(movedToFirst.rows[0].action).toBe("pick");

    // Moving index 0 down when index 1 is fixup also normalizes the new first row to pick
    const row1Fixup = setRebaseRowAction(initial, 1, "fixup");
    const firstMovedDown = moveRebaseRowBy(row1Fixup, 0, 1);
    expect(firstMovedDown.rows[0].hash).toBe(HASH_2);
    expect(firstMovedDown.rows[0].action).toBe("pick");

    // guardFirstEntryRows leaves valid first entries untouched
    expect(guardFirstEntryRows(initial.rows)).toBe(initial.rows);
  });

  it("collects merge commits, published commits, preflight gates and published ack hooks", () => {
    const range = makeRange({
      commits: [
        makeCommit(HASH_1, "Published commit", { isPublished: true }),
        makeCommit(HASH_2, "Merge branch", {
          isMerge: true,
          parents: [HASH_1, HASH_3]
        }),
        makeCommit(HASH_3, "Local commit")
      ]
    });

    const state = createRebaseEditorState(range, {
      base: BASE_HASH,
      baseLabel: "00000000",
      requirePublishedAck: true
    });
    expect(getPublishedCommits(state).map((r) => r.hash)).toEqual([HASH_1]);
    expect(getMergeCommits(state).map((r) => r.hash)).toEqual([HASH_2]);

    const modified = setRebaseRowAction(state, 2, "drop");
    // Blocked until published acknowledgement is checked when requirePublishedAck is enabled
    expect(canStartInteractiveRebase(modified)).toBe(false);

    const acked = setPublishedAcked(modified, true);
    expect(canStartInteractiveRebase(acked)).toBe(true);

    // Blocked when preflight.canStart is false
    const dirtyState = createRebaseEditorState(
      makeRange({
        dirty: true,
        preflight: { canStart: false, reasons: ["dirty"] }
      }),
      { base: BASE_HASH, baseLabel: "00000000" }
    );
    const dirtyModified = setRebaseRowAction(dirtyState, 0, "drop");
    expect(canStartInteractiveRebase(dirtyModified)).toBe(false);
  });

  it("serializes the modified state into an interactiveRebase action payload", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });
    const modified = moveRebaseRowBy(setRebaseRowAction(initial, 1, "drop"), 2, -1);

    expect(toInteractiveRebasePayload(modified)).toEqual({
      base: BASE_HASH,
      rangeHashes: [HASH_1, HASH_2, HASH_3],
      entries: [
        { action: "pick", hash: HASH_1 },
        { action: "pick", hash: HASH_3 },
        { action: "drop", hash: HASH_2 }
      ]
    });
  });

  it("interprets keyboard shortcuts for navigation, reordering, pick/drop, focus trap and start", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });

    // ArrowDown selects row 1 when not in an editable control
    const downCmd = interpretRebaseEditorKey({
      key: "ArrowDown",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      targetTagName: "TR"
    });
    expect(downCmd).toEqual({ type: "select-row", delta: 1 });
    if (downCmd === null) throw new Error("Expected select-row command");
    const afterDown = applyRebaseKeyCommand(initial, downCmd).state;
    expect(afterDown.selectedIndex).toBe(1);

    // Plain ArrowDown inside a <select> is left to native option navigation
    expect(
      interpretRebaseEditorKey({
        key: "ArrowDown",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        targetTagName: "SELECT"
      })
    ).toBeNull();

    // Shift+ArrowUp moves the row even when focused on a <select>
    const moveUpCmd = interpretRebaseEditorKey({
      key: "ArrowUp",
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      targetTagName: "SELECT"
    });
    expect(moveUpCmd).toEqual({ type: "move-row", delta: -1 });
    if (moveUpCmd === null) throw new Error("Expected move-row command");
    const afterMoveUp = applyRebaseKeyCommand(afterDown, moveUpCmd).state;
    expect(afterMoveUp.rows.map((r) => r.hash)).toEqual([HASH_2, HASH_1, HASH_3]);
    expect(afterMoveUp.selectedIndex).toBe(0);

    // 'd' and 'p' set action on selected row
    const dropCmd = interpretRebaseEditorKey({
      key: "d",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      targetTagName: "TR"
    });
    expect(dropCmd).toEqual({ type: "set-action", action: "drop" });
    if (dropCmd === null) throw new Error("Expected set-action drop");
    const afterDrop = applyRebaseKeyCommand(afterMoveUp, dropCmd).state;
    expect(afterDrop.rows[0].action).toBe("drop");

    const pickCmd = interpretRebaseEditorKey({
      key: "p",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      targetTagName: "TR"
    });
    expect(pickCmd).toEqual({ type: "set-action", action: "pick" });
    if (pickCmd === null) throw new Error("Expected set-action pick");
    const afterPick = applyRebaseKeyCommand(afterDrop, pickCmd).state;
    expect(afterPick.rows[0].action).toBe("pick");

    // Ctrl+Enter or Cmd+Enter requests start only when state is startable
    const startCmd = interpretRebaseEditorKey({
      key: "Enter",
      shiftKey: false,
      ctrlKey: true,
      metaKey: false,
      altKey: false
    });
    expect(startCmd).toEqual({ type: "start" });
    if (startCmd === null) throw new Error("Expected start command");
    expect(applyRebaseKeyCommand(initial, startCmd).startRequested).toBe(false);
    expect(applyRebaseKeyCommand(afterPick, startCmd).startRequested).toBe(true);

    // Tab and Shift+Tab produce trap-focus commands
    expect(
      interpretRebaseEditorKey({
        key: "Tab",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false
      })
    ).toEqual({ type: "trap-focus", reverse: false });
    expect(
      interpretRebaseEditorKey({
        key: "Tab",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
        altKey: false
      })
    ).toEqual({ type: "trap-focus", reverse: true });
  });

  it("offers all six actions by default, with squash and fixup barred on the first row", () => {
    expect(REBASE_EDITOR_ACTIONS).toEqual(["pick", "reword", "edit", "squash", "fixup", "drop"]);
    expect(allowedActionsForRow(0)).toEqual(["pick", "reword", "edit", "drop"]);
    expect(allowedActionsForRow(1)).toEqual(["pick", "reword", "edit", "squash", "fixup", "drop"]);
  });

  it("pre-fills a reword with subject and body, and sends only an edited message", () => {
    const range = makeRange({
      commits: [
        makeCommit(HASH_1, "First subject", { body: "First body line." }),
        makeCommit(HASH_2, "Second commit"),
        makeCommit(HASH_3, "Third commit")
      ]
    });
    const initial = createRebaseEditorState(range, { base: BASE_HASH, baseLabel: "00000000" });
    expect(originalMessageOf(initial.rows[0])).toBe("First subject\n\nFirst body line.");

    const reworded = setRebaseRowAction(initial, 0, "reword");
    expect(messageEditorsFor(reworded.rows)).toEqual([
      {
        afterIndex: 0,
        targetHash: HASH_1,
        kind: "reword",
        text: "First subject\n\nFirst body line.",
        isEdited: false
      }
    ]);
    // An unchanged reword carries no message, so it runs as plain pick.
    expect(toInteractiveRebasePayload(reworded).entries[0]).toEqual({
      action: "reword",
      hash: HASH_1
    });

    const edited = setRebaseRowMessage(reworded, HASH_1, "New subject\n\nNew body.");
    expect(toInteractiveRebasePayload(edited).entries[0]).toEqual({
      action: "reword",
      hash: HASH_1,
      message: "New subject\n\nNew body."
    });
    expect(canStartInteractiveRebase(edited)).toBe(true);
  });

  it("refuses to start with an empty or whitespace-only message", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });
    const reworded = setRebaseRowAction(initial, 1, "reword");
    const emptied = setRebaseRowMessage(reworded, HASH_2, "");
    expect(hasEmptyRebaseMessage(emptied.rows)).toBe(true);
    expect(canStartInteractiveRebase(emptied)).toBe(false);
    const blanked = setRebaseRowMessage(reworded, HASH_2, "  \n ");
    expect(hasEmptyRebaseMessage(blanked.rows)).toBe(true);
    expect(canStartInteractiveRebase(blanked)).toBe(false);
  });

  it("shows one combined group message without its fixup members, keyed by target hash", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });
    const grouped = setRebaseRowAction(setRebaseRowAction(initial, 1, "squash"), 2, "fixup");
    expect(combinedGroupMessage(grouped.rows, 0, [1, 2])).toBe("First commit\n\nSecond commit");
    expect(messageEditorsFor(grouped.rows)).toEqual([
      {
        afterIndex: 2,
        targetHash: HASH_1,
        kind: "group",
        text: "First commit\n\nSecond commit",
        isEdited: false
      }
    ]);
    // Unedited, Git combines the messages itself; nothing is sent.
    expect(toInteractiveRebasePayload(grouped).entries).toEqual([
      { action: "pick", hash: HASH_1 },
      { action: "squash", hash: HASH_2 },
      { action: "fixup", hash: HASH_3 }
    ]);

    const edited = setRebaseRowMessage(grouped, HASH_1, "All three, combined");
    expect(toInteractiveRebasePayload(edited).entries[0]).toEqual({
      action: "pick",
      hash: HASH_1,
      message: "All three, combined"
    });
  });

  it("keeps a group's edited message on its target when rows are reordered around it", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });
    const grouped = setRebaseRowAction(initial, 1, "squash");
    const edited = setRebaseRowMessage(grouped, HASH_1, "First and second, combined");

    // Move the free commit ahead of the whole group.
    const moved = moveRebaseRow(edited, 2, 0);
    expect(moved.rows.map((r) => r.hash)).toEqual([HASH_3, HASH_1, HASH_2]);
    expect(messageEditorsFor(moved.rows)).toEqual([
      {
        afterIndex: 2,
        targetHash: HASH_1,
        kind: "group",
        text: "First and second, combined",
        isEdited: true
      }
    ]);
    expect(toInteractiveRebasePayload(moved).entries).toEqual([
      { action: "pick", hash: HASH_3 },
      { action: "pick", hash: HASH_1, message: "First and second, combined" },
      { action: "squash", hash: HASH_2 }
    ]);
  });

  it("carries an edited message for a fixup-only group on its target", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });
    const grouped = setRebaseRowAction(initial, 1, "fixup");
    expect(messageEditorsFor(grouped.rows)[0]?.text).toBe("First commit");
    const edited = setRebaseRowMessage(grouped, HASH_1, "First, with the fix folded in");
    expect(toInteractiveRebasePayload(edited).entries[0]).toEqual({
      action: "pick",
      hash: HASH_1,
      message: "First, with the fix folded in"
    });
  });

  it("drops a message when its row stops being able to carry one", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });
    const reworded = setRebaseRowMessage(setRebaseRowAction(initial, 1, "reword"), HASH_2, "New");
    const backToPick = setRebaseRowAction(reworded, 1, "pick");
    expect(backToPick.rows[1].message).toBeUndefined();
    expect(messageEditorsFor(backToPick.rows)).toEqual([]);

    // An edit target amends by hand at the stop: no group textarea.
    const grouped = setRebaseRowAction(initial, 1, "squash");
    const editedGroup = setRebaseRowMessage(grouped, HASH_1, "Combined");
    const editTarget = setRebaseRowAction(editedGroup, 0, "edit");
    expect(editTarget.rows[0].message).toBeUndefined();
    expect(messageEditorsFor(editTarget.rows)).toEqual([]);
    expect(toInteractiveRebasePayload(editTarget).entries[0]).toEqual({
      action: "edit",
      hash: HASH_1
    });
  });

  it("normalizes a squash left without a target by a drop back to pick", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });
    const droppedFirst = setRebaseRowAction(initial, 0, "drop");
    const attempted = setRebaseRowAction(droppedFirst, 1, "squash");
    expect(attempted.rows[1].action).toBe("pick");
    expect(canStartInteractiveRebase(attempted)).toBe(true);
  });

  it("maps the r, e, s and f keys to reword, edit, squash and fixup", () => {
    const initial = createRebaseEditorState(makeRange(), {
      base: BASE_HASH,
      baseLabel: "00000000"
    });
    const keyInput = (key: string) => ({
      key,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      targetTagName: "TR"
    });
    expect(interpretRebaseEditorKey(keyInput("r"))).toEqual({
      type: "set-action",
      action: "reword"
    });
    expect(interpretRebaseEditorKey(keyInput("e"))).toEqual({
      type: "set-action",
      action: "edit"
    });
    expect(interpretRebaseEditorKey(keyInput("s"))).toEqual({
      type: "set-action",
      action: "squash"
    });
    expect(interpretRebaseEditorKey(keyInput("f"))).toEqual({
      type: "set-action",
      action: "fixup"
    });

    // "s" on the first row is refused like the select refuses it.
    const squashCmd = interpretRebaseEditorKey(keyInput("s"));
    if (squashCmd === null) throw new Error("Expected set-action squash");
    expect(applyRebaseKeyCommand(initial, squashCmd).state.rows[0].action).toBe("pick");
    const secondSelected = selectRebaseRow(initial, 1);
    expect(applyRebaseKeyCommand(secondSelected, squashCmd).state.rows[1].action).toBe("squash");
  });
});
