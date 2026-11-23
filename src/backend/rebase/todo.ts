/**
 * The pure todo model for interactive rebase: the entry types, the rules a
 * todo must pass before Git runs it, and the todo text Git reads. No Git, no
 * I/O, no VS Code. The runner (F2-01b) writes what this module serializes.
 */

/** The actions a todo line may name. `reword` is editor-only: it serializes as `pick`. */
export type TodoAction = "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";

/** One todo line. `message` is carried for the editor and is not part of the todo text. */
export type TodoEntry = {
  readonly action: TodoAction;
  readonly hash: string;
  readonly message?: string;
};

/** How a rebase run ended, shared with the runner so both sides use one type. */
export type TodoRunOutcome =
  | "completed"
  | "paused-edit"
  | "paused-conflict"
  | "invalid-todo"
  | "failed";

/** The first rule a todo broke, with the data the caller needs to explain it. */
export type TodoRejection =
  | { readonly reason: "base-is-option" }
  | { readonly reason: "empty" }
  | { readonly reason: "bad-hash"; readonly hash: string }
  | { readonly reason: "duplicate-hash"; readonly hash: string }
  | { readonly reason: "first-entry-squash"; readonly action: "squash" | "fixup" }
  | {
      readonly reason: "range-mismatch";
      readonly missing: readonly string[];
      readonly extra: readonly string[];
    };

export type TodoValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly rejection: TodoRejection };

/** A full object name: SHA-1 (40 digits) or SHA-256 (64 digits), either letter case. */
const FULL_HASH = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

/** The todo word for each action. `reword` has none in a todo, so it is a `pick`. */
const TODO_WORD: Readonly<Record<TodoAction, string>> = {
  pick: "pick",
  reword: "pick",
  edit: "edit",
  squash: "squash",
  fixup: "fixup",
  drop: "drop"
};

function findBaseProblem(base: string): TodoRejection | null {
  return base.startsWith("-") ? { reason: "base-is-option" } : null;
}

function findEmpty(entries: readonly TodoEntry[]): TodoRejection | null {
  return entries.length === 0 ? { reason: "empty" } : null;
}

function findBadHash(entries: readonly TodoEntry[]): TodoRejection | null {
  const bad = entries.find((entry) => !FULL_HASH.test(entry.hash));
  return bad ? { reason: "bad-hash", hash: bad.hash } : null;
}

function findDuplicate(entries: readonly TodoEntry[]): TodoRejection | null {
  const seen = new Set<string>();
  for (const { hash } of entries) {
    const key = hash.toLowerCase();
    if (seen.has(key)) return { reason: "duplicate-hash", hash };
    seen.add(key);
  }
  return null;
}

function findSquashFirst(entries: readonly TodoEntry[]): TodoRejection | null {
  const first = entries[0];
  if (first?.action === "squash" || first?.action === "fixup") {
    return { reason: "first-entry-squash", action: first.action };
  }
  return null;
}

function findRangeMismatch(
  entries: readonly TodoEntry[],
  rangeHashes: readonly string[]
): TodoRejection | null {
  const inTodo = new Set(entries.map((entry) => entry.hash.toLowerCase()));
  const inRange = new Set(rangeHashes.map((hash) => hash.toLowerCase()));
  const missing = rangeHashes.filter((hash) => !inTodo.has(hash.toLowerCase()));
  const extra = entries
    .map((entry) => entry.hash)
    .filter((hash) => !inRange.has(hash.toLowerCase()));
  if (missing.length === 0 && extra.length === 0) return null;
  return { reason: "range-mismatch", missing, extra };
}

/** The first failed rule, checked in the order the rules are listed in the slice. */
function firstRejection(
  entries: readonly TodoEntry[],
  rangeHashes: readonly string[],
  base: string
): TodoRejection | null {
  return (
    findBaseProblem(base) ??
    findEmpty(entries) ??
    findBadHash(entries) ??
    findDuplicate(entries) ??
    findSquashFirst(entries) ??
    findRangeMismatch(entries, rangeHashes)
  );
}

/**
 * Checks a todo against the rules Git would otherwise fail on too late.
 * `rangeHashes` are the full hashes of the commits the rebase covers. The
 * first failed rule is returned, and nothing is mutated.
 */
export function validateTodo(
  entries: readonly TodoEntry[],
  rangeHashes: readonly string[],
  base: string
): TodoValidation {
  const rejection = firstRejection(entries, rangeHashes, base);
  return rejection ? { ok: false, rejection } : { ok: true };
}

/**
 * The todo text Git reads: one `<action> <full hash>` line per entry, in
 * order, each ending in `\n`. Hashes are written in lower case. Call
 * {@link validateTodo} first; this function does not check its input.
 */
export function serializeTodo(entries: readonly TodoEntry[]): string {
  return entries
    .map((entry) => `${TODO_WORD[entry.action]} ${entry.hash.toLowerCase()}\n`)
    .join("");
}
