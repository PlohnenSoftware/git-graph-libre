import { describe, expect, it } from "vitest";

import type { GitRef } from "@/backend/types";
import {
  createViewFeatureReporter,
  INGEST_FEATURE_NAME_PATTERN,
  VIEW_FEATURE_REFLOG,
  VIEW_FEATURE_SIGNED_TAG,
  VIEW_FEATURE_UNREACHABLE
} from "@/telemetry/viewFeatures";

/** Records what reached the reporter, in order. */
function createTelemetrySpy() {
  const sent: Array<{ feature: string; ok: boolean }> = [];
  return {
    sent,
    telemetry: {
      logFeature: (feature: string, ok: boolean) => sent.push({ feature, ok })
    }
  };
}

function commitWith(...refs: GitRef[]) {
  return { refs };
}

const signedTag: GitRef = { hash: "a".repeat(40), name: "v1.0.0", type: "tag", signed: true };
const unsignedTag: GitRef = { hash: "b".repeat(40), name: "v1.1.0", type: "tag", signed: false };
const branch: GitRef = { hash: "c".repeat(40), name: "main", type: "head" };

const quietLoad = {
  includeReflog: false,
  includeUnreachableCommits: false,
  showsAllRefs: true,
  commits: [commitWith(branch)]
};

describe("view feature reporting", () => {
  it("reports nothing for an ordinary load", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad(quietLoad);

    expect(spy.sent).toEqual([]);
  });

  it("reports reflog-only commits when the log included them", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      includeReflog: true
    });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_REFLOG, ok: true }]);
  });

  it("reports the unreachable scan when it covered all refs", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      includeUnreachableCommits: true
    });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_UNREACHABLE, ok: true }]);
  });

  // getUnreachableCommitHashes() returns early unless the log has no selected
  // refs, so under an active filter the setting is on and does nothing.
  // Counting that would count intent as use.
  it("does not report the unreachable scan while a filter narrows the log", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      includeUnreachableCommits: true,
      showsAllRefs: false
    });

    expect(spy.sent).toEqual([]);
  });

  it("reports the signed-tag badge only when a signed tag is present", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordCommitLoad({ ...quietLoad, commits: [commitWith(unsignedTag)] });
    expect(spy.sent).toEqual([]);

    reporter.recordCommitLoad({
      ...quietLoad,
      commits: [commitWith(branch), commitWith(signedTag)]
    });
    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_SIGNED_TAG, ok: true }]);
  });

  // A branch or remote ref never carries a signature, so a truthy flag on one
  // would be a bug elsewhere — it must not be read as a signed tag here.
  it("ignores a signed flag on anything that is not a tag", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      commits: [commitWith({ ...branch, signed: true })]
    });

    expect(spy.sent).toEqual([]);
  });

  // The commit-load path runs on activation, every refresh, every filter
  // change and every watcher tick. Per-load reporting would rank one user's
  // refresh habits instead of installations.
  it("reports each feature at most once per session", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);
    const busyLoad = {
      includeReflog: true,
      includeUnreachableCommits: true,
      showsAllRefs: true,
      commits: [commitWith(signedTag)]
    };

    reporter.recordCommitLoad(busyLoad);
    reporter.recordCommitLoad(busyLoad);
    reporter.recordCommitLoad(busyLoad);

    expect(spy.sent).toEqual([
      { feature: VIEW_FEATURE_REFLOG, ok: true },
      { feature: VIEW_FEATURE_UNREACHABLE, ok: true },
      { feature: VIEW_FEATURE_SIGNED_TAG, ok: true }
    ]);
  });

  it("is inert without a reporter", () => {
    expect(() =>
      createViewFeatureReporter().recordCommitLoad({
        includeReflog: true,
        includeUnreachableCommits: true,
        showsAllRefs: true,
        commits: [commitWith(signedTag)]
      })
    ).not.toThrow();
  });

  // The ingest rejects the WHOLE batch when one feature id fails its pattern,
  // so a malformed id here would silently drop up to 25 unrelated events.
  it.each([VIEW_FEATURE_REFLOG, VIEW_FEATURE_UNREACHABLE, VIEW_FEATURE_SIGNED_TAG])(
    "%s matches the id pattern the ingest enforces",
    (feature) => {
      expect(INGEST_FEATURE_NAME_PATTERN.test(feature)).toBe(true);
    }
  );
});
