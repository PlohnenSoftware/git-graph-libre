import * as fs from "node:fs";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { GitRef } from "@/backend/types";
import {
  createViewFeatureReporter,
  INGEST_FEATURE_NAME_PATTERN,
  VIEW_FEATURE_ENGINE_BACKEND,
  VIEW_FEATURE_ENGINE_DECLINED,
  VIEW_FEATURE_ENGINE_FAILED,
  VIEW_FEATURE_ENGINE_UNAVAILABLE_PREFIX,
  VIEW_FEATURE_FORCE_CLI_RELOAD,
  VIEW_FEATURE_LINKED_WORKTREE_REPO,
  VIEW_FEATURE_REFLOG,
  VIEW_FEATURE_SIGNED_TAG,
  VIEW_FEATURE_STASH_ROWS,
  VIEW_FEATURE_SUBMODULE_ACTIVE,
  VIEW_FEATURE_SUBMODULE_REPO,
  VIEW_FEATURE_UNCOMMITTED_PANEL,
  VIEW_FEATURE_UNCOMMITTED_TREE,
  VIEW_FEATURE_UNREACHABLE,
  VIEW_FEATURE_WORKTREE_MARKER
} from "@/telemetry/viewFeatures";

import { git, makeRepo } from "../helpers";

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
  repo: PARENT_REPO,
  engineServed: false,
  engineUnavailable: null,
  engineFailed: false,
  engineDeclined: false,
  forcedCli: false
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

  it("reports stash rows only when a load actually contains one", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordCommitLoad(quietLoad);
    expect(spy.sent).toEqual([]);

    reporter.recordCommitLoad({
      ...quietLoad,
      commits: [{ refs: [], stash: { ref: "stash@{0}" } }]
    });
    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_STASH_ROWS, ok: true }]);

    reporter.recordCommitLoad({
      ...quietLoad,
      commits: [{ refs: [], stash: { ref: "stash@{0}" } }]
    });
    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_STASH_ROWS, ok: true }]);
  });

  it("reports the engine backend only when the engine actually served", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordCommitLoad(quietLoad);
    expect(spy.sent).toEqual([]);

    reporter.recordCommitLoad({ ...quietLoad, engineServed: true });
    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_ENGINE_BACKEND, ok: true }]);

    reporter.recordCommitLoad({ ...quietLoad, engineServed: true });
    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_ENGINE_BACKEND, ok: true }]);
  });

  // How often the engine fails, measured the way every signal here is: as the
  // share of sessions in which it happened, never as a per-load count.
  it("reports why the engine could not start, once per session, by reason alone", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordCommitLoad({ ...quietLoad, engineUnavailable: "loadFailed" });
    reporter.recordCommitLoad({ ...quietLoad, engineUnavailable: "loadFailed" });

    expect(spy.sent).toEqual([{ feature: "view.engineUnavailable.loadFailed", ok: true }]);
  });

  it("reports engine failures and declines separately, each once per session", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordCommitLoad({ ...quietLoad, engineFailed: true });
    reporter.recordCommitLoad({ ...quietLoad, engineFailed: true, engineDeclined: true });
    reporter.recordCommitLoad({ ...quietLoad, engineFailed: true, engineDeclined: true });

    expect(spy.sent).toEqual([
      { feature: VIEW_FEATURE_ENGINE_FAILED, ok: true },
      { feature: VIEW_FEATURE_ENGINE_DECLINED, ok: true }
    ]);
  });

  it("reports the hidden menu's one-off Git CLI reload once per session", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordCommitLoad(quietLoad);
    reporter.recordCommitLoad({ ...quietLoad, forcedCli: true });
    reporter.recordCommitLoad({ ...quietLoad, forcedCli: true });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_FORCE_CLI_RELOAD, ok: true }]);
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
      repo: SUBMODULE_REPO,
      engineServed: false,
      engineUnavailable: null,
      engineFailed: false,
      engineDeclined: false,
      forcedCli: false
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

  // Opening the staging panel is not a commit load, so it has its own entry
  // point — but the same once-per-session rule applies: the panel posts on
  // every open and the count must stay "installations that opened it".
  it("reports the staging panel exactly once across repeated opens", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordUncommittedDetailsOpened({ grouped: false });
    reporter.recordUncommittedDetailsOpened({ grouped: false });
    reporter.recordUncommittedDetailsOpened({ grouped: false });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_UNCOMMITTED_PANEL, ok: true }]);
  });

  it("reports the folder tree only when a folder actually rendered", () => {
    const flat = createTelemetrySpy();
    createViewFeatureReporter(flat.telemetry).recordUncommittedDetailsOpened({ grouped: false });
    // Tree mode over root-level changes shows a flat list either way, so the
    // signal would be counting intent rather than use.
    expect(flat.sent).toEqual([{ feature: VIEW_FEATURE_UNCOMMITTED_PANEL, ok: true }]);

    const grouped = createTelemetrySpy();
    const reporter = createViewFeatureReporter(grouped.telemetry);
    reporter.recordUncommittedDetailsOpened({ grouped: true });
    reporter.recordUncommittedDetailsOpened({ grouped: true });

    // Once per session, like every signal here, and the panel signal still
    // fires alongside it.
    expect(grouped.sent).toEqual([
      { feature: VIEW_FEATURE_UNCOMMITTED_PANEL, ok: true },
      { feature: VIEW_FEATURE_UNCOMMITTED_TREE, ok: true }
    ]);
  });

  it("shares one session budget between loads and panel opens", () => {
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordUncommittedDetailsOpened({ grouped: false });
    reporter.recordCommitLoad({ ...quietLoad, includeReflog: true });
    reporter.recordUncommittedDetailsOpened({ grouped: false });

    expect(spy.sent).toEqual([
      { feature: VIEW_FEATURE_UNCOMMITTED_PANEL, ok: true },
      { feature: VIEW_FEATURE_REFLOG, ok: true }
    ]);
  });

  it("is inert without a reporter", () => {
    const reporter = createViewFeatureReporter();
    expect(() =>
      reporter.recordCommitLoad({
        includeReflog: true,
        includeUnreachableCommits: true,
        engineServed: false,
        engineUnavailable: null,
        engineFailed: false,
        engineDeclined: false,
        forcedCli: false,
        showsAllRefs: true,
        commits: [commitWith(signedTag)],
        repoPaths: [PARENT_REPO, SUBMODULE_REPO],
        repo: SUBMODULE_REPO
      })
    ).not.toThrow();
    expect(() => reporter.recordUncommittedDetailsOpened({ grouped: true })).not.toThrow();
  });

  // The ingest rejects the WHOLE batch when one feature id fails its pattern,
  // so a malformed id here would silently drop up to 25 unrelated events.
  it.each([
    VIEW_FEATURE_UNCOMMITTED_TREE,
    VIEW_FEATURE_WORKTREE_MARKER,
    VIEW_FEATURE_LINKED_WORKTREE_REPO,
    VIEW_FEATURE_ENGINE_BACKEND,
    VIEW_FEATURE_REFLOG,
    VIEW_FEATURE_UNREACHABLE,
    VIEW_FEATURE_SIGNED_TAG,
    VIEW_FEATURE_SUBMODULE_REPO,
    VIEW_FEATURE_SUBMODULE_ACTIVE,
    VIEW_FEATURE_UNCOMMITTED_PANEL,
    VIEW_FEATURE_STASH_ROWS,
    VIEW_FEATURE_ENGINE_FAILED,
    VIEW_FEATURE_ENGINE_DECLINED,
    VIEW_FEATURE_FORCE_CLI_RELOAD,
    ...(
      ["unsupportedPlatform", "missing", "loadFailed", "versionMismatch", "incompatible"] as const
    ).map((reason) => `${VIEW_FEATURE_ENGINE_UNAVAILABLE_PREFIX}${reason}`)
  ])("%s matches the id pattern the ingest enforces", (feature) => {
    expect(INGEST_FEATURE_NAME_PATTERN.test(feature)).toBe(true);
  });
});

// The submodule and worktree signals decide from the file system, so these tests
// build the repositories they assert on under the temporary directory and never
// reuse this repository's own worktrees. The root is canonicalized with realpath
// (symlinked temporary directories), and the path with a space and a non-ASCII
// character is part of the fixture.
describe("submodule and worktree signals against real repositories", () => {
  const made: string[] = [];

  afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  function fixtureRepo(): string {
    const dir = fs.realpathSync(makeRepo());
    made.push(dir);
    return dir;
  }

  /** The form the reporter receives: real path, forward slashes. */
  function repoPath(dir: string): string {
    return fs.realpathSync(dir).split(path.sep).join("/");
  }

  it("does not count a linked worktree nested inside its main worktree", () => {
    const parent = fixtureRepo();
    const worktree = path.join(parent, ".worktrees", "wt ü feat");
    git(["worktree", "add", "-b", "feat", worktree], parent);
    const parentPath = repoPath(parent);
    const worktreePath = repoPath(worktree);
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordCommitLoad({
      ...quietLoad,
      repoPaths: [parentPath, worktreePath],
      repo: parentPath
    });
    // Opened as its own repository, the worktree is not an active submodule.
    reporter.recordCommitLoad({
      ...quietLoad,
      repoPaths: [parentPath, worktreePath],
      repo: worktreePath
    });

    // The worktree signals may fire here (it is a linked worktree, and `main`
    // is checked out in the parent), so only the submodule ids are asserted.
    const features = spy.sent.map((entry) => entry.feature);
    expect(features).not.toContain(VIEW_FEATURE_SUBMODULE_REPO);
    expect(features).not.toContain(VIEW_FEATURE_SUBMODULE_ACTIVE);
  });

  it("still counts a submodule, and the active one when the graph is drawn for it", () => {
    const parent = fixtureRepo();
    const library = fixtureRepo();
    git(
      ["-c", "protocol.file.allow=always", "submodule", "add", library, "modules/vendor lib ü"],
      parent
    );
    const parentPath = repoPath(parent);
    const submodulePath = repoPath(path.join(parent, "modules", "vendor lib ü"));
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);

    reporter.recordCommitLoad({
      ...quietLoad,
      repoPaths: [parentPath, submodulePath],
      repo: parentPath
    });
    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_SUBMODULE_REPO, ok: true }]);

    reporter.recordCommitLoad({
      ...quietLoad,
      repoPaths: [parentPath, submodulePath],
      repo: submodulePath
    });
    expect(spy.sent).toEqual([
      { feature: VIEW_FEATURE_SUBMODULE_REPO, ok: true },
      { feature: VIEW_FEATURE_SUBMODULE_ACTIVE, ok: true }
    ]);
  });

  it("never counts a sibling worktree, even one with a name-prefix relation", () => {
    const parent = fixtureRepo();
    const sibling = `${parent}-sibling wt ü`;
    made.push(sibling);
    git(["worktree", "add", "-b", "side", sibling], parent);
    const parentPath = repoPath(parent);
    const siblingPath = repoPath(sibling);
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      repoPaths: [parentPath, siblingPath],
      repo: siblingPath
    });

    // The sibling is a linked worktree, so the worktree signals may fire; it is
    // never a submodule.
    const features = spy.sent.map((entry) => entry.feature);
    expect(features).not.toContain(VIEW_FEATURE_SUBMODULE_REPO);
    expect(features).not.toContain(VIEW_FEATURE_SUBMODULE_ACTIVE);
  });

  // An independent repository nested by path (a `.git` directory, not a
  // linked worktree) keeps counting as before: the fix narrows the signal
  // for worktrees only.
  it("keeps counting an independent repository nested by path", () => {
    const parent = fixtureRepo();
    const nested = path.join(parent, "vendor", "tool");
    fs.mkdirSync(nested, { recursive: true });
    git(["init", "-q"], nested);
    const parentPath = repoPath(parent);
    const nestedPath = repoPath(nested);
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      repoPaths: [parentPath, nestedPath],
      repo: parentPath
    });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_SUBMODULE_REPO, ok: true }]);
  });

  // A branch the graph draws, checked out in a linked worktree, is what the
  // badge marks: the main worktree sees it, and the linked one reports itself.
  it("marks a drawn branch held by a linked worktree, once per session", () => {
    const parent = fixtureRepo();
    const worktree = path.join(parent, ".worktrees", "wt ü feat");
    git(["worktree", "add", "-b", "feat", worktree], parent);
    const parentPath = repoPath(parent);
    const spy = createTelemetrySpy();
    const reporter = createViewFeatureReporter(spy.telemetry);
    const featBranch = { ...branch, name: "feat" };

    reporter.recordCommitLoad({
      ...quietLoad,
      commits: [commitWith(featBranch)],
      repo: parentPath
    });
    reporter.recordCommitLoad({
      ...quietLoad,
      commits: [commitWith(featBranch)],
      repo: parentPath
    });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_WORKTREE_MARKER, ok: true }]);
  });

  it("reports the linked worktree and marks the main worktree's branch it shares a repository with", () => {
    const parent = fixtureRepo();
    const worktree = path.join(parent, ".worktrees", "wt ü feat");
    git(["worktree", "add", "-b", "feat", worktree], parent);
    const parentPath = repoPath(parent);
    const worktreePath = repoPath(worktree);
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      commits: [commitWith(branch)],
      repoPaths: [parentPath, worktreePath],
      repo: worktreePath
    });

    expect(spy.sent).toEqual([
      { feature: VIEW_FEATURE_LINKED_WORKTREE_REPO, ok: true },
      { feature: VIEW_FEATURE_WORKTREE_MARKER, ok: true }
    ]);
  });

  it("does not mark the branch the linked worktree itself holds", () => {
    const parent = fixtureRepo();
    const worktree = path.join(parent, ".worktrees", "wt ü feat");
    git(["worktree", "add", "-b", "feat", worktree], parent);
    const parentPath = repoPath(parent);
    const worktreePath = repoPath(worktree);
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      commits: [commitWith({ ...branch, name: "feat" })],
      repoPaths: [parentPath, worktreePath],
      repo: worktreePath
    });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_LINKED_WORKTREE_REPO, ok: true }]);
  });

  it("does not mark a branch when the only other worktree is detached", () => {
    const parent = fixtureRepo();
    const worktree = path.join(parent, ".worktrees", "wt ü detached");
    git(["worktree", "add", "--detach", worktree], parent);
    const parentPath = repoPath(parent);
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      commits: [commitWith(branch)],
      repoPaths: [parentPath],
      repo: parentPath
    });

    expect(spy.sent).toEqual([]);
  });

  // A bare repository's HEAD names a branch but it is no worktree: with `main`
  // drawn, only the linked worktree on `feat` is a holder, and that is not drawn.
  it("does not count a bare repository's HEAD as a checkout", () => {
    const parent = fixtureRepo();
    const bareDir = `${parent}-bare ü.git`;
    made.push(bareDir);
    git(["clone", "--bare", "-q", parent, bareDir], parent);
    const worktree = `${parent}-wt ü feat`;
    made.push(worktree);
    git(["worktree", "add", "-b", "feat", worktree, "main"], bareDir);
    const worktreePath = repoPath(worktree);
    const spy = createTelemetrySpy();

    createViewFeatureReporter(spy.telemetry).recordCommitLoad({
      ...quietLoad,
      commits: [commitWith(branch)],
      repoPaths: [worktreePath],
      repo: worktreePath
    });

    expect(spy.sent).toEqual([{ feature: VIEW_FEATURE_LINKED_WORKTREE_REPO, ok: true }]);
  });
});
