/**
 * Read-side feature reporting, deduplicated per session.
 *
 * The two chokepoints — `registerAction()` and `commandManager.register()` —
 * only see things the user *does*. They cannot see features that consist of
 * something being *shown*: history recovery (unreachable and reflog-only
 * commits) and the signed-tag badge both work by changing what the graph
 * contains, and neither has a command behind it. Without this they would look
 * unused however many people rely on them.
 *
 * Every signal here is therefore evaluated on the commit-load path, which runs
 * on activation, on every refresh, on every filter change and on every file
 * watcher tick. Reporting per load would drown the ranking in one user's
 * refresh habits, so each feature is reported at most **once per session** and
 * the ratio to read is "installations that saw it", never "times it happened".
 *
 * Feature ids must match the ingest's `^[a-z][a-zA-Z0-9._-]{0,63}$`, and the
 * ingest rejects the **whole batch** when one id fails it — up to 25 unrelated
 * events lost silently. Hence the `view.` prefix rather than a `/` or a space,
 * and hence the test that checks the ids against that pattern.
 */

import type { GitCommitNode } from "@/backend/types";

import type { TelemetryReporter } from "./index";

/** Reflog-only commits were included in the log. */
export const VIEW_FEATURE_REFLOG = "view.includeReflog";
/** The unreachable-commit scan actually ran for this load. */
export const VIEW_FEATURE_UNREACHABLE = "view.includeUnreachableCommits";
/** A signed tag was present to badge in the graph. */
export const VIEW_FEATURE_SIGNED_TAG = "view.signedTagBadge";

/** Exactly the pattern the ingest applies. Kept here so a test can assert it. */
export const INGEST_FEATURE_NAME_PATTERN = /^[a-z][a-zA-Z0-9._-]{0,63}$/;

export type CommitLoadFacts = {
  /** The request asked for reflog-only commits. */
  includeReflog: boolean;
  /** The request asked for the unreachable-commit scan. */
  includeUnreachableCommits: boolean;
  /**
   * Whether the load covered all refs rather than a branch/tag selection.
   *
   * Load-bearing for the unreachable signal: `getUnreachableCommitHashes()`
   * returns early unless the log has no selected refs, so with a filter active
   * the setting is on but does nothing, and reporting it would count intent as
   * use.
   */
  showsAllRefs: boolean;
  /** The commits the load produced, scanned once for a signed tag. */
  commits: readonly Pick<GitCommitNode, "refs">[];
};

export type ViewFeatureReporter = {
  /** Call after every completed commit load. Cheap once each signal has fired. */
  recordCommitLoad: (facts: CommitLoadFacts) => void;
};

function hasSignedTag(commits: readonly Pick<GitCommitNode, "refs">[]): boolean {
  return commits.some((commit) =>
    commit.refs.some((ref) => ref.type === "tag" && ref.signed === true)
  );
}

export function createViewFeatureReporter(
  telemetry?: Pick<TelemetryReporter, "logFeature">
): ViewFeatureReporter {
  const reported = new Set<string>();

  function reportOnce(feature: string) {
    if (reported.has(feature)) return;
    reported.add(feature);
    // ok: true — a read-side feature has no failure of its own to report. A
    // load that failed produces no commits and no signals.
    telemetry?.logFeature(feature, true);
  }

  return {
    recordCommitLoad(facts) {
      if (facts.includeReflog) reportOnce(VIEW_FEATURE_REFLOG);
      if (facts.includeUnreachableCommits && facts.showsAllRefs) {
        reportOnce(VIEW_FEATURE_UNREACHABLE);
      }
      // Guarded rather than reported blindly: the scan walks every loaded
      // commit's refs, and there is nothing to learn from repeating it once
      // the answer is known for this session.
      if (!reported.has(VIEW_FEATURE_SIGNED_TAG) && hasSignedTag(facts.commits)) {
        reportOnce(VIEW_FEATURE_SIGNED_TAG);
      }
    }
  };
}
