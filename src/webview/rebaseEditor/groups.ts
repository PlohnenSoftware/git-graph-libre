import { findSquashGroups, isSquashGroupTarget, type TodoAction } from "@/backend/rebase/todo";

import type { RebaseEditorRow } from "./model";

/**
 * Squash-group and message logic for the editor rows (F2-05), over the
 * backend's one group definition (`findSquashGroups`). A manually edited
 * message lives on its target row, so it is keyed by the target's hash:
 * reordering rows, or members joining and leaving the group, never moves
 * the edit to another commit.
 */

/** The commit's full original message: its subject plus its body. */
export function originalMessageOf(row: RebaseEditorRow): string {
  return row.body === "" ? row.subject : `${row.subject}\n\n${row.body}`;
}

/**
 * The default final message of a squash group: the target's message plus
 * its `squash` members' messages. `fixup` members contribute nothing,
 * as in Git. Unedited, this is only a preview: Git does the combining
 * itself and no message reaches the payload.
 */
export function combinedGroupMessage(
  rows: readonly RebaseEditorRow[],
  targetIndex: number,
  memberIndices: readonly number[]
): string {
  const parts = [originalMessageOf(rows[targetIndex] as RebaseEditorRow)];
  for (const index of memberIndices) {
    const member = rows[index] as RebaseEditorRow;
    if (member.action === "squash") {
      parts.push(originalMessageOf(member));
    } else if (member.action === "fixup" && member.fixupFlag === "-C") {
      parts.length = 0;
      parts.push(member.body === "" ? originalMessageOf(member) : member.body);
    }
  }
  return parts.join("\n\n");
}

/** One message the editor shows in a textarea, and where it belongs. */
export type RebaseMessageEditor = {
  /** The row the textarea renders after (a group's last member). */
  readonly afterIndex: number;
  /** The hash the edited text is stored under (the target's). */
  readonly targetHash: string;
  readonly kind: "reword" | "group";
  /** The text to show: the manual edit, or the default it starts from. */
  readonly text: string;
  readonly isEdited: boolean;
};

function carriesGroupMessage(action: TodoAction): boolean {
  return action === "pick" || action === "reword";
}

function editorForGroup(
  rows: readonly RebaseEditorRow[],
  targetIndex: number,
  memberIndices: readonly number[]
): RebaseMessageEditor | null {
  const target = rows[targetIndex] as RebaseEditorRow;
  if (memberIndices.length > 0 && carriesGroupMessage(target.action)) {
    const fallback = combinedGroupMessage(rows, targetIndex, memberIndices);
    return {
      afterIndex: memberIndices[memberIndices.length - 1] as number,
      targetHash: target.hash,
      kind: "group",
      text: target.message ?? fallback,
      isEdited: target.message !== undefined && target.message !== fallback
    };
  }
  if (memberIndices.length === 0 && target.action === "reword") {
    const fallback = originalMessageOf(target);
    return {
      afterIndex: targetIndex,
      targetHash: target.hash,
      kind: "reword",
      text: target.message ?? fallback,
      isEdited: target.message !== undefined && target.message !== fallback
    };
  }
  // An `edit` target's group message is amended by hand at the stop, so
  // it gets no textarea the run would silently ignore.
  return null;
}

/** Every textarea the rows need, in todo order. */
export function messageEditorsFor(rows: readonly RebaseEditorRow[]): RebaseMessageEditor[] {
  const editors: RebaseMessageEditor[] = [];
  for (const group of findSquashGroups(rows)) {
    const editor = editorForGroup(rows, group.targetIndex, group.memberIndices);
    if (editor !== null) editors.push(editor);
  }
  return editors;
}

/** The indices of rows that meld into an earlier target. */
export function groupMemberIndices(rows: readonly RebaseEditorRow[]): ReadonlySet<number> {
  const members = new Set<number>();
  for (const group of findSquashGroups(rows)) {
    for (const index of group.memberIndices) members.add(index);
  }
  return members;
}

/** Whether any row carries a typed message with no text in it. */
export function hasEmptyRebaseMessage(rows: readonly RebaseEditorRow[]): boolean {
  return rows.some((row) => row.message !== undefined && row.message.trim() === "");
}

/**
 * The messages the start payload carries, by target hash: only a message
 * that differs from what Git would produce on its own. An unchanged
 * reword and an unedited group carry none, so they run as plain `pick`
 * and Git's own combining, with no second amend.
 */
export function payloadMessagesByHash(
  rows: readonly RebaseEditorRow[]
): ReadonlyMap<string, string> {
  const messages = new Map<string, string>();
  for (const editor of messageEditorsFor(rows)) {
    if (editor.isEdited) messages.set(editor.targetHash, editor.text);
  }
  return messages;
}

function hasMembers(rows: readonly RebaseEditorRow[], index: number): boolean {
  return findSquashGroups(rows).some(
    (group) => group.targetIndex === index && group.memberIndices.length > 0
  );
}

/**
 * The message a row keeps when its action changes. Only a `reword`, and
 * a `pick` that heads a squash group, can carry one; every other action
 * drops it, so switching a reword back to `pick` restores the original
 * message instead of amending the commit anyway.
 */
export function messageAfterActionChange(
  rows: readonly RebaseEditorRow[],
  index: number,
  nextAction: TodoAction
): string | undefined {
  const row = rows[index] as RebaseEditorRow;
  if (nextAction === "reword") return row.message;
  if (nextAction === "pick" && hasMembers(rows, index)) return row.message;
  return undefined;
}

/** A row with a new action, and its message only when it keeps one. */
export function withActionAndMessage(
  row: RebaseEditorRow,
  action: TodoAction,
  message: string | undefined
): RebaseEditorRow {
  const { message: _dropped, fixupFlag: _droppedFlag, ...rest } = row;
  if (message === undefined) {
    return { ...rest, action };
  }
  return { ...rest, action, message };
}

/**
 * Turns every `squash`/`fixup` with no commit to meld into back to
 * `pick`, wherever a reorder left it. A `drop` creates no commit, so it
 * does not count as a target; the first-row case is the common one.
 */
export function guardSquashRows(rows: readonly RebaseEditorRow[]): readonly RebaseEditorRow[] {
  let hasTarget = false;
  let changed = false;
  const guarded = rows.map((row) => {
    if (isSquashGroupTarget(row.action)) {
      hasTarget = true;
      return row;
    }
    if ((row.action === "squash" || row.action === "fixup") && !hasTarget) {
      changed = true;
      hasTarget = true;
      return withActionAndMessage(row, "pick", undefined);
    }
    return row;
  });
  return changed ? guarded : rows;
}
