import { describe, expect, it } from "vitest";

import type { GitRef } from "@/backend/types";
import {
  createViewFeatureReporter,
  INGEST_FEATURE_NAME_PATTERN,
  VIEW_FEATURE_REFLOG,
  VIEW_FEATURE_SIGNED_TAG,
  VIEW_FEATURE_SUBMODULE_ACTIVE,
  VIEW_FEATURE_SUBMODULE_REPO,
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

const PARENT_REPO = "/home/someone/projects/secret-client-work";
const SUBMODULE_REPO = `${PARENT_REPO}/modules/private-vendor-lib`;

const quietLoad = {
  includeReflog: false,
  includeUnreachableCommits: false,
  showsAllRefs: true,
  commits: [commitWith(branch)],
  repoPaths: [PARENT_REPO],
  repo: PARENT_REPO
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

  it("reports an offered submodule without reporting an active one", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      repoPaths: [PARENT_REPO, SUBMODULE_REPO],
      repo: PARENT_REPO
    });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_SUBMODULE_REPO, ok: true }]);
  });

  it("reports the active submodule when the graph is drawn for one", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      repoPaths: [PARENT_REPO, SUBMODULE_REPO],
      repo: SUBMODULE_REPO
    });

    expect(spy.sent).toEqual([
      { feature: VIEW_FEATURE_SUBMODULE_REPO, ok: true },
      { feature: VIEW_FEATURE_SUBMODULE_ACTIVE, ok: true }
    ]);
  });

  // The containment test compares on a trailing slash for exactly this case:
  // sibling repositories often share a name prefix, and a plain `startsWith`
  // would report every one of them as a submodule of its neighbour.
  it("does not treat a name-prefix sibling as a nested repository", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      repoPaths: [PARENT_REPO, `${PARENT_REPO}-tools`],
      repo: `${PARENT_REPO}-tools`
    });

    expect(spy.sent).toEqual([]);
  });

  // Non-negotiable: these signals exist to count installations, and a
  // repository path is exactly the kind of content this telemetry promises
  // never to send. The reporter compares paths locally and emits a fixed id.
  it("never puts a repository path into what is sent", () => {
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      includeReflog: true,
      includeUnreachableCommits: true,
      commits: [commitWith(signedTag)],
      repoPaths: [PARENT_REPO, SUBMODULE_REPO],
      repo: SUBMODULE_REPO
    });

    expect(spy.sent).not.toEqual([]);
    const serialized = JSON.stringify(spy.sent);
    for (const secret of [
      PARENT_REPO,
      SUBMODULE_REPO,
      "secret-client-work",
      "private-vendor-lib",
      "someone"
    ]) {
      expect(serialized).not.toContain(secret);
    }
    // Every payload is the feature id and its outcome, nothing else.
    for (const event of spy.sent) {
      expect(Object.keys(event).toSorted()).toEqual(["feature", "ok"]);
      expect(event.feature.startsWith("view.")).toBe(true);
    }
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
      commits: [commitWith(signedTag)],
      repoPaths: [PARENT_REPO, SUBMODULE_REPO],
      repo: SUBMODULE_REPO
    };

    reporter.recordCommitLoad(busyLoad);
    reporter.recordCommitLoad(busyLoad);
    reporter.recordCommitLoad(busyLoad);

    expect(spy.sent).toEqual([
      { feature: VIEW_FEATURE_REFLOG, ok: true },
      { feature: VIEW_FEATURE_UNREACHABLE, ok: true },
      { feature: VIEW_FEATURE_SIGNED_TAG, ok: true },
      { feature: VIEW_FEATURE_SUBMODULE_REPO, ok: true },
      { feature: VIEW_FEATURE_SUBMODULE_ACTIVE, ok: true }
    ]);
  });

  it("is inert without a reporter", () => {
    expect(() =>
      createViewFeatureReporter().recordCommitLoad({
        includeReflog: true,
        includeUnreachableCommits: true,
        showsAllRefs: true,
        commits: [commitWith(signedTag)],
        repoPaths: [PARENT_REPO, SUBMODULE_REPO],
        repo: SUBMODULE_REPO
      })
    ).not.toThrow();
  });

  // The ingest rejects the WHOLE batch when one feature id fails its pattern,
  // so a malformed id here would silently drop up to 25 unrelated events.
  it.each([
    VIEW_FEATURE_REFLOG,
    VIEW_FEATURE_UNREACHABLE,
    VIEW_FEATURE_SIGNED_TAG,
    VIEW_FEATURE_SUBMODULE_REPO,
    VIEW_FEATURE_SUBMODULE_ACTIVE
  ])("%s matches the id pattern the ingest enforces", (feature) => {
    expect(INGEST_FEATURE_NAME_PATTERN.test(feature)).toBe(true);
  });
});
