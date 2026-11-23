import { effectiveRebasePreflight } from "@/backend/rebase/preflight";
import type { TodoAction, TodoEntry } from "@/backend/rebase/todo";
import type {
  GitRebaseOperation,
  GitRebasePreflight,
  GitRebaseRangeCommit,
  GitRebaseRangeResult
} from "@/backend/types";

import {
  guardSquashRows,
  hasEmptyRebaseMessage,
  messageAfterActionChange,
  payloadMessagesByHash,
  withActionAndMessage
} from "./groups";

/** Every action the editor offers, in todo order (all six since F2-05). */
export const REBASE_EDITOR_ACTIONS: readonly TodoAction[] = [
  "pick",
  "reword",
  "edit",
  "squash",
  "fixup",
  "drop"
];

/** The F2-04 name for {@link REBASE_EDITOR_ACTIONS}; kept for its callers. */
export const F2_04_REBASE_ACTIONS: readonly TodoAction[] = REBASE_EDITOR_ACTIONS;

const FIRST_ENTRY_FORBIDDEN_ACTIONS: ReadonlySet<TodoAction> = new Set<TodoAction>([
  "squash",
  "fixup"
]);

export type RebaseEditorRow = {
  readonly hash: string;
  readonly subject: string;
  readonly body: string;
  readonly author: string;
  readonly email: string;
  readonly parents: readonly string[];
  readonly isMerge: boolean;
  readonly isPublished: boolean;
  readonly action: TodoAction;
  readonly message?: string;
};

export type RebaseEditorState = {
  readonly base: string | null;
  readonly baseLabel: string;
  readonly branch: string | null;
  readonly detached: boolean;
  readonly upstream: string | null;
  readonly dirty: boolean;
  readonly inProgressKind: GitRebaseOperation | null;
  readonly tooLong: boolean;
  readonly preflight: GitRebasePreflight;
  readonly initialCommits: readonly GitRebaseRangeCommit[];
  readonly initialHashes: readonly string[];
  readonly rows: readonly RebaseEditorRow[];
  readonly selectedIndex: number;
  /** Published-commit acknowledgement checkbox gate (decision IQ5, F2-07). */
  readonly requirePublishedAck: boolean;
  readonly publishedAcked: boolean;
  /** Opt-in `--autostash` for a dirty working tree (F2-07). */
  readonly autostash: boolean;
  /** Path of another worktree holding the current branch, when known (F2-07). */
  readonly otherWorktreePath: string | null;
  /** Waiting for user confirmation before starting a very long range (F2-07). */
  readonly longRangeConfirmPending: boolean;
};

export type CreateRebaseEditorStateOptions = {
  readonly base: string | null;
  readonly baseLabel: string;
  readonly requirePublishedAck?: boolean;
  readonly otherWorktreePath?: string | null;
};

export type InteractiveRebaseStartPayload = {
  readonly base: string | null;
  readonly entries: TodoEntry[];
  readonly rangeHashes: string[];
  readonly autostash?: boolean;
};

export function canActionBeFirstEntry(action: TodoAction): boolean {
  return !FIRST_ENTRY_FORBIDDEN_ACTIONS.has(action);
}

export function allowedActionsForRow(
  rowIndex: number,
  availableActions: readonly TodoAction[] = F2_04_REBASE_ACTIONS
): TodoAction[] {
  if (rowIndex === 0) {
    return availableActions.filter(canActionBeFirstEntry);
  }
  return [...availableActions];
}

export function guardFirstEntryRows(rows: readonly RebaseEditorRow[]): readonly RebaseEditorRow[] {
  if (rows.length === 0 || canActionBeFirstEntry(rows[0].action)) {
    return rows;
  }
  const first: RebaseEditorRow = {
    ...rows[0],
    action: "pick"
  };
  return [first, ...rows.slice(1)];
}

function toInitialRow(commit: GitRebaseRangeCommit): RebaseEditorRow {
  return {
    hash: commit.hash,
    subject: commit.subject,
    body: commit.body,
    author: commit.author,
    email: commit.email,
    parents: [...commit.parents],
    isMerge: commit.isMerge,
    isPublished: commit.isPublished,
    action: "pick"
  };
}

export function createRebaseEditorState(
  range: GitRebaseRangeResult,
  options: CreateRebaseEditorStateOptions
): RebaseEditorState {
  const rows = range.commits.map(toInitialRow);
  return {
    base: options.base,
    baseLabel: options.baseLabel,
    branch: range.branch,
    detached: range.detached,
    upstream: range.upstream,
    dirty: range.dirty,
    inProgressKind: range.inProgressKind,
    tooLong: range.tooLong,
    preflight: range.preflight,
    initialCommits: [...range.commits],
    initialHashes: range.commits.map((commit) => commit.hash),
    rows,
    selectedIndex: rows.length > 0 ? 0 : -1,
    requirePublishedAck: options.requirePublishedAck ?? true,
    publishedAcked: false,
    autostash: false,
    otherWorktreePath: options.otherWorktreePath ?? null,
    longRangeConfirmPending: false
  };
}

export function selectRebaseRow(state: RebaseEditorState, index: number): RebaseEditorState {
  if (state.rows.length === 0) return state;
  const clamped = Math.max(0, Math.min(state.rows.length - 1, index));
  if (clamped === state.selectedIndex) return state;
  return {
    ...state,
    selectedIndex: clamped
  };
}

export function setRebaseRowAction(
  state: RebaseEditorState,
  index: number,
  action: TodoAction
): RebaseEditorState {
  if (index < 0 || index >= state.rows.length) return state;
  if (index === 0 && !canActionBeFirstEntry(action)) return state;
  const current = state.rows[index];
  if (current.action === action && state.selectedIndex === index) return state;

  const message = messageAfterActionChange(state.rows, index, action);
  const nextRows = state.rows.map((row, rowIndex) =>
    rowIndex === index ? withActionAndMessage(row, action, message) : row
  );
  return {
    ...state,
    rows: guardSquashRows(nextRows),
    selectedIndex: index,
    longRangeConfirmPending: false
  };
}

/**
 * Stores an edited message under its commit's hash, so reordering rows
 * afterwards keeps the edit on that commit. Selection does not move:
 * the message of a squash group belongs to its target, which may not be
 * the selected row.
 */
export function setRebaseRowMessage(
  state: RebaseEditorState,
  hash: string,
  message: string
): RebaseEditorState {
  const index = state.rows.findIndex((row) => row.hash === hash);
  if (index < 0) return state;
  if (state.rows[index]?.message === message) return state;
  return {
    ...state,
    rows: state.rows.map((row, rowIndex) => (rowIndex === index ? { ...row, message } : row)),
    longRangeConfirmPending: false
  };
}

export function moveRebaseRow(
  state: RebaseEditorState,
  fromIndex: number,
  toIndex: number
): RebaseEditorState {
  const count = state.rows.length;
  if (fromIndex < 0 || fromIndex >= count || toIndex < 0 || toIndex >= count) {
    return state;
  }
  if (fromIndex === toIndex) return state;

  const nextRows = [...state.rows];
  const [moved] = nextRows.splice(fromIndex, 1);
  nextRows.splice(toIndex, 0, moved);

  return {
    ...state,
    rows: guardSquashRows(nextRows),
    selectedIndex: toIndex,
    longRangeConfirmPending: false
  };
}

export function moveRebaseRowBy(
  state: RebaseEditorState,
  index: number,
  delta: -1 | 1
): RebaseEditorState {
  return moveRebaseRow(state, index, index + delta);
}

export function resetRebaseEditorState(state: RebaseEditorState): RebaseEditorState {
  const rows = state.initialCommits.map(toInitialRow);
  return {
    ...state,
    rows,
    selectedIndex: rows.length > 0 ? 0 : -1,
    publishedAcked: false,
    autostash: false,
    longRangeConfirmPending: false
  };
}

export function setPublishedAcked(state: RebaseEditorState, acked: boolean): RebaseEditorState {
  if (state.publishedAcked === acked) return state;
  return {
    ...state,
    publishedAcked: acked,
    longRangeConfirmPending: false
  };
}

export function setAutostash(state: RebaseEditorState, autostash: boolean): RebaseEditorState {
  if (state.autostash === autostash) return state;
  return {
    ...state,
    autostash,
    longRangeConfirmPending: false
  };
}

export function setLongRangeConfirmPending(
  state: RebaseEditorState,
  pending: boolean
): RebaseEditorState {
  if (state.longRangeConfirmPending === pending) return state;
  return {
    ...state,
    longRangeConfirmPending: pending
  };
}

export function isRebaseStateModified(state: RebaseEditorState): boolean {
  if (state.rows.length !== state.initialHashes.length) return true;
  for (let i = 0; i < state.rows.length; i++) {
    const row = state.rows[i];
    if (row.hash !== state.initialHashes[i]) return true;
    if (row.action !== "pick") return true;
    if (row.message !== undefined) return true;
  }
  return false;
}

export function countDroppedCommits(state: RebaseEditorState): number {
  let dropped = 0;
  for (const row of state.rows) {
    if (row.action === "drop") dropped++;
  }
  return dropped;
}

export function getMergeCommits(state: RebaseEditorState): readonly RebaseEditorRow[] {
  return state.rows.filter((row) => row.isMerge);
}

export function getPublishedCommits(state: RebaseEditorState): readonly RebaseEditorRow[] {
  return state.rows.filter((row) => row.isPublished);
}

export function canStartInteractiveRebase(state: RebaseEditorState): boolean {
  const preflight = effectiveRebasePreflight(state.preflight, { autostash: state.autostash });
  if (!preflight.canStart) return false;
  if (state.rows.length === 0) return false;
  if (!canActionBeFirstEntry(state.rows[0].action)) return false;
  if (hasEmptyRebaseMessage(state.rows)) return false;
  if (!isRebaseStateModified(state)) return false;
  if (state.requirePublishedAck && getPublishedCommits(state).length > 0 && !state.publishedAcked) {
    return false;
  }
  return true;
}

export function toInteractiveRebasePayload(
  state: RebaseEditorState
): InteractiveRebaseStartPayload {
  const messages = payloadMessagesByHash(state.rows);
  return {
    base: state.base,
    entries: state.rows.map((row) => ({
      action: row.action,
      hash: row.hash,
      ...(messages.has(row.hash) ? { message: messages.get(row.hash) as string } : {})
    })),
    rangeHashes: [...state.initialHashes],
    ...(state.autostash ? { autostash: true } : {})
  };
}
