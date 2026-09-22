/**
 * `loadCommits` through the engine (Phase 16, slice 16.5).
 *
 * Subslice 16.5a: routing and options. The wrapper routes to the engine only
 * when none of the declines applies — decided *before* the call, never by
 * catching a failure — and builds the engine `LogOptions` JSON from the same
 * route input the CLI implementation consumes. Nothing here reimplements a
 * CLI parse: ref selection, author normalization and hidden-remote
 * normalization reuse the CLI's own helpers, so both backends read the same
 * request by construction.
 *
 * The declines (each pinned by a test in `tests/backend/engine/commits.test.ts`):
 *
 * - the signature column is visible (`showSignature`): the engine reports no
 *   per-commit signatures, and the CLI's `%G?` plus batched `gpgsig` probe
 *   (the 1.2.0 work separating genuinely unsigned from SSH-signed-but-
 *   unverifiable) has no engine counterpart;
 * - `Author Date`: the engine's wire date is always the committer date, while
 *   the CLI formats `%at` here;
 * - reflog tips or unreachable-commit discovery on a show-all load: the CLI
 *   adds `--reflog` / runs `git fsck --unreachable`, and the engine has no
 *   equivalent for either. With explicit refs the CLI ignores both flags
 *   (early return before `--reflog`, no `fsck`), so those loads stay on the
 *   engine;
 * - a `--glob=` branch pattern: the engine's tip resolution silently skips
 *   revisions it cannot resolve instead of expanding the glob.
 */

import type { CommitOrdering, DateType } from "@/backend/types";
import { selectedLogRefs, uniqueNonEmpty } from "@/backend/utils/logFilters";
import { normalizeHiddenRemotes } from "@/backend/utils/remoteRefs";

/** The route fields the engine decision, options and (16.5b) mapping need. */
export type EngineLoadCommitsInput = {
  branchName: string;
  branches?: string[] | null;
  authors?: string[] | null;
  tags?: string[] | null;
  maxCommits: number;
  showRemoteBranches: boolean;
  hiddenRemotes?: string[];
  showTags?: boolean;
  includeReflog?: boolean;
  includeUnreachableCommits?: boolean;
  onlyFollowFirstParent?: boolean;
  commitOrdering?: CommitOrdering;
  showSignature?: boolean;
  /**
   * Consumed by the 16.5b mapper, not by the predicate or options: the engine
   * always reads stashes (it walks from their bases), so when the caller did
   * not opt into stash rows the mapper strips them back out to match the CLI.
   */
  showStashes?: boolean;
  dateType: DateType;
  showUncommittedChanges: boolean;
};

/**
 * The `git log` tip list both backends read: null is the show-all load, an
 * array is the filtered one. Single source of truth — the CLI builds its log
 * args from exactly this, so the decline below sees the same show-all test.
 */
export function engineLoadCommitsRefs(input: EngineLoadCommitsInput): string[] | null {
  return selectedLogRefs({
    branches: input.branches,
    legacyBranchName: input.branchName,
    tags: input.tags
  });
}

/**
 * Whether the engine may serve this load. Every false is a *decline*, not a
 * bug: the caller routes those loads straight to the CLI, unchanged.
 */
export function shouldServeLoadCommitsFromEngine(input: EngineLoadCommitsInput): boolean {
  // The signature column needs the CLI's `%G?` + `gpgsig` probe per commit.
  if (input.showSignature === true) return false;
  // The engine's wire date is always the committer date.
  if (input.dateType === "Author Date") return false;
  const refs = engineLoadCommitsRefs(input);
  // `--glob=` is not understood by the engine's tip resolution.
  if (refs !== null && refs.some((ref) => ref.startsWith("--glob="))) return false;
  if (refs !== null) return true;
  // On a show-all load the CLI adds `--reflog` / `git fsck --unreachable`,
  // which have no engine equivalent at all. With explicit refs the CLI
  // ignores both flags, so those loads stay on the engine.
  if (input.includeReflog === true) return false;
  if (input.includeUnreachableCommits === true) return false;
  return true;
}

/**
 * The `load_commits` options JSON. Every field is threaded from the route
 * input the CLI consumes, or pinned to the CLI-equivalent constant where the
 * CLI has no such knob:
 *
 * - `showRemoteHeads: true`: the CLI's `for-each-ref` lists non-symbolic
 *   `/HEAD` refs, which the engine only includes with the flag on (symbolic
 *   remote HEADs stay an engine gap — probed in 16.5d);
 * - `showUntrackedFiles: true`: the CLI counts every `status.files` entry,
 *   untracked files included;
 * - `showCommitsOnlyReferencedByTags` follows `showTags`, reproducing the
 *   CLI's `--tags` walk tips;
 * - `filterPaths`, `deferRemoteRefs`, `deferUncommittedChanges`, `useMailmap`
 *   are all false/empty: this fork's `loadCommits` route sends none of them
 *   and the CLI honors none of them.
 */
export function buildLoadCommitsOptions(input: EngineLoadCommitsInput): string {
  const showTags = input.showTags !== false;
  return JSON.stringify({
    branches: engineLoadCommitsRefs(input),
    authors: uniqueNonEmpty(input.authors),
    maxCommits: input.maxCommits,
    showTags,
    showRemoteBranches: input.showRemoteBranches,
    showRemoteHeads: true,
    deferRemoteRefs: false,
    includeCommitsMentionedByReflogs: input.includeReflog === true,
    onlyFollowFirstParent: input.onlyFollowFirstParent === true,
    commitOrdering: input.commitOrdering ?? "date",
    remotes: [],
    hideRemotes: normalizeHiddenRemotes(input.hiddenRemotes),
    filterPaths: [],
    deferUncommittedChanges: false,
    showUncommittedChanges: input.showUncommittedChanges,
    showUntrackedFiles: true,
    showCommitsOnlyReferencedByTags: showTags,
    useMailmap: false
  });
}
