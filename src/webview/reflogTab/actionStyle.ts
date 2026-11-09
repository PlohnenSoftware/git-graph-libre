import { REFLOG_ACTION_KINDS, type ReflogLabels } from "@/reflogTabTypes";

/**
 * How one reflog row's action and sub-action are marked and worded (F1-04).
 * Pure lookups over the open sets `classifyReflogMessage` returns: a kind
 * or sub-action this table does not know (a newer Git, another tool's
 * `GIT_REFLOG_ACTION`) falls back to the neutral marker and Git's raw
 * word, never to a guess. The colors live in `media/tokens.css` as
 * `--ngg-reflog-*` tokens; this module only names the classes.
 */

/** The intents a sub-action tag can carry; `neutral` is the fallback. */
export type ReflogSubIntent = "rewrite" | "combine" | "advance" | "abort" | "ref" | "neutral";

/**
 * Each known sub-action's intent, grouped by what the step does to
 * history:
 *
 * - `rewrite`: an existing commit is changed in place (its message or
 *   content).
 * - `combine`: several commits are folded into one.
 * - `advance`: a sequencer step, or the ref simply moving forward
 *   (the first commit, a merge commit, a fast-forward).
 * - `abort`: a run given up on, worth flagging on its own.
 * - `ref`: a branch's lifecycle.
 *
 * The stash's `wip`/`named` say how the entry was worded, not what it
 * did, so they carry no intent and stay neutral.
 */
export const REFLOG_SUB_INTENTS: Readonly<Record<string, ReflogSubIntent>> = {
  amend: "rewrite",
  reword: "rewrite",
  edit: "rewrite",
  squash: "combine",
  fixup: "combine",
  start: "advance",
  pick: "advance",
  continue: "advance",
  finish: "advance",
  "fast-forward": "advance",
  initial: "advance",
  merge: "advance",
  abort: "abort",
  created: "ref",
  renamed: "ref",
  copied: "ref"
};

const KNOWN_KINDS: ReadonlySet<string> = new Set(REFLOG_ACTION_KINDS);

function normalized(word: string): string {
  return word.trim().toLowerCase();
}

/**
 * The marker class for an action kind: `reflog-kind-<kind>` for a known
 * kind, `reflog-kind-other` (the neutral marker) for anything else.
 */
export function kindClass(kind: string): string {
  const known = normalized(kind);
  return `reflog-kind-${KNOWN_KINDS.has(known) ? known : "other"}`;
}

/**
 * The tag class for a sub-action: `reflog-sub-intent-<intent>`, with
 * `neutral` for a sub-action with no intent or none the table knows.
 * Callers draw no tag at all for a null sub-action.
 */
export function subIntentClass(sub: string): string {
  return `reflog-sub-intent-${REFLOG_SUB_INTENTS[normalized(sub)] ?? "neutral"}`;
}

/** The action's localized label, or Git's raw kind word when it is unknown. */
export function kindLabel(kind: string, labels: ReflogLabels): string {
  return labels.actions[normalized(kind)] ?? kind;
}

/** The sub-action's localized label, or Git's raw word when it is unknown. */
export function subLabel(sub: string, labels: ReflogLabels): string {
  return labels.subActions[normalized(sub)] ?? sub;
}
