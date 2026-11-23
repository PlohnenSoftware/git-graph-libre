import type { GitQueryError, GitRebasePreflight, RebasePreflightReason } from "@/backend/types";

/** The facts the preflight decides on, as the range read reports them. */
export type RebasePreflightFacts = {
  /** How many commits the range holds. */
  commitCount: number;
  /** Staged or unstaged tracked changes; untracked files alone are not dirty. */
  dirty: boolean;
  /** A rebase, merge, cherry-pick or revert is already in progress. */
  inProgress: boolean;
  /** The branch is checked out in another worktree; `"unknown"` when that could not be read. */
  alreadyUsedElsewhere: boolean | "unknown";
  /** The range read's own failure, when it failed. */
  error: GitQueryError | null;
};

/**
 * Decides whether an interactive rebase may start over one range read, and
 * names every reason it may not as data (no message text; the surface that
 * shows a reason words it itself). Pure: the same facts always give the same
 * answer, with the reasons in the order below.
 *
 * Facts that never refuse a start on their own, by decision: a range over
 * 500 commits (F2-07 prompts instead), published commits (IQ5 asks for an
 * acknowledgement, it does not refuse), merge commits (IQ6 flattens them and
 * says so), a detached HEAD (allowed and labeled), untracked files alone
 * (Git rebases over them), and an `"unknown"` worktree answer (nothing
 * proves the branch is held elsewhere).
 */
export function evaluateRebasePreflight(facts: RebasePreflightFacts): GitRebasePreflight {
  if (facts.error !== null) return { canStart: false, reasons: ["readFailed"] };
  const reasons: RebasePreflightReason[] = [];
  if (facts.inProgress) reasons.push("inProgress");
  if (facts.commitCount === 0) reasons.push("emptyRange");
  if (facts.dirty) reasons.push("dirty");
  if (facts.alreadyUsedElsewhere === true) reasons.push("alreadyUsedElsewhere");
  return { canStart: reasons.length === 0, reasons };
}
