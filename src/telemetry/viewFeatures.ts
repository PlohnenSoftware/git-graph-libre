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
 * watcher tick — except the staging panel, which is not a load and reports
 * from its own query route instead. Reporting per load would drown the
 * ranking in one user's refresh habits, so each feature is reported at most
 * **once per session** and the ratio to read is "installations that saw it",
 * never "times it happened".
 *
 * Feature ids must match the ingest's `^[a-z][a-zA-Z0-9._-]{0,63}$`, and the
 * ingest rejects the **whole batch** when one id fails it — up to 25 unrelated
 * events lost silently. Hence the `view.` prefix rather than a `/` or a space,
 * and hence the test that checks the ids against that pattern.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { GitCommitNode } from "@/backend/types";
import { resolveGitDirs } from "@/backend/utils/gitDirs";
import type { EngineUnavailableReason } from "@/types";

import type { TelemetryReporter } from "./index";

/** Reflog-only commits were included in the log. */
export const VIEW_FEATURE_REFLOG = "view.includeReflog";
/** The unreachable-commit scan actually ran for this load. */
export const VIEW_FEATURE_UNREACHABLE = "view.includeUnreachableCommits";
/** A signed tag was present to badge in the graph. */
export const VIEW_FEATURE_SIGNED_TAG = "view.signedTagBadge";
/** A discovered submodule was offered in the repository dropdown. */
export const VIEW_FEATURE_SUBMODULE_REPO = "view.submoduleRepo";
/** The graph was actually loaded on a submodule, not merely offered one. */
export const VIEW_FEATURE_SUBMODULE_ACTIVE = "view.submoduleRepoActive";
/** The uncommitted-changes staging panel was opened. */
export const VIEW_FEATURE_UNCOMMITTED_PANEL = "view.uncommittedDetails";
/** A stash row was present in the loaded graph. */
export const VIEW_FEATURE_STASH_ROWS = "view.stashRows";
/**
 * The Rust engine actually served a read this session. Reported, like every
 * signal here, at most once per session with the fixed id as the whole
 * payload — never a path, never a per-load count.
 */
export const VIEW_FEATURE_ENGINE_BACKEND = "view.engineBackend";
/**
 * The engine could not start although the backend setting allowed it, one id
 * per reason (`view.engineUnavailable.loadFailed`, …). Read beside the
 * `common.os` / `common.nodearch` every event carries, this is how a broken
 * platform binary shows up: an install that cannot load its engine works on
 * the CLI and looks merely slow, so nothing else would ever report it.
 */
export const VIEW_FEATURE_ENGINE_UNAVAILABLE_PREFIX = "view.engineUnavailable.";
/**
 * The engine failed a read outright this session: an error the user saw as
 * the read's error, or a payload the extension's guards refused.
 */
export const VIEW_FEATURE_ENGINE_FAILED = "view.engineFailed";
/**
 * The engine handed a read back to the CLI at run time this session. The read
 * still succeeded; this measures how often the engine cannot serve a shape it
 * was asked for, not a fault.
 */
export const VIEW_FEATURE_ENGINE_DECLINED = "view.engineDeclined";
/** The hidden menu's "Reload once with Git CLI" was used this session. */
export const VIEW_FEATURE_FORCE_CLI_RELOAD = "view.forceCliReload";
/**
 * The staging panel actually grouped changes into folders — the tree mode is
 * selected *and* at least one change sits in a subdirectory, so a folder row
 * really rendered. A repository whose changes are all at the root would show a
 * flat list either way, and reporting that would count intent rather than use.
 */
export const VIEW_FEATURE_UNCOMMITTED_TREE = "view.uncommittedTree";
/**
 * A branch badge in the graph was marked as checked out in another worktree
 * (W11): a branch the loaded graph draws is also checked out elsewhere.
 */
export const VIEW_FEATURE_WORKTREE_MARKER = "view.worktreeMarker";
/** The graph was loaded on a linked worktree, not on a main worktree or a plain repository. */
export const VIEW_FEATURE_LINKED_WORKTREE_REPO = "view.linkedWorktreeRepo";

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
  /** The commits the load produced, scanned for shown-feature markers. */
  commits: readonly Pick<GitCommitNode, "refs" | "stash">[];
  /**
   * Whether the engine has served any read so far this session (the reader's
   * session flag, read at the call site). True reports the engine signal;
   * false reports nothing — the CLI path is the default, not a feature.
   */
  engineServed: boolean;
  /**
   * Why the engine could not start, when the backend setting allowed it and it
   * did not — null when it started, and when the setting is `git-cli`, which
   * never tries.
   */
  engineUnavailable: EngineUnavailableReason | null;
  /** The reader's session flag: the engine failed a read outright. */
  engineFailed: boolean;
  /** The reader's session flag: the engine handed a read back to the CLI. */
  engineDeclined: boolean;
  /** This load was the hidden menu's one-off Git CLI reload. */
  forcedCli: boolean;
  /**
   * Every repository currently in the dropdown, and the one this load is for.
   *
   * Both are needed because a nested repository is only recognizable against
   * the rest of the set. Paths are compared, never sent — the signals below
   * carry nothing but their own fixed feature id.
   */
  repoPaths: readonly string[];
  repo: string;
};

export type ViewFeatureReporter = {
  /** Call after every completed commit load. Cheap once each signal has fired. */
  recordCommitLoad: (facts: CommitLoadFacts) => void;
  /**
   * Call after the staging panel's data was produced. Opening the panel is
   * not a commit load, so it needs its own entry point; like every signal
   * here it reports at most once per session.
   *
   * `grouped` says whether the panel actually drew a folder tree. It is
   * computed by the caller from the change paths, which never reach this
   * module — the payload stays the fixed feature id.
   */
  recordUncommittedDetailsOpened: (facts: { grouped: boolean }) => void;
};

function hasSignedTag(commits: readonly Pick<GitCommitNode, "refs">[]): boolean {
  return commits.some((commit) =>
    commit.refs.some((ref) => ref.type === "tag" && ref.signed === true)
  );
}

function hasStashRows(commits: readonly Pick<GitCommitNode, "stash">[]): boolean {
  return commits.some((commit) => commit.stash !== undefined);
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

const headBranchPrefix = "ref: refs/heads/";

/** The branch a worktree's HEAD names, or null for a detached or unreadable HEAD. */
function branchOfHead(gitDir: string): string | null {
  const line = readText(path.join(gitDir, "HEAD"))?.split(/\r?\n/)[0] ?? "";
  return line.startsWith(headBranchPrefix) ? line.slice(headBranchPrefix.length).trim() : null;
}

/** Whether a common dir's `config` sets `core.bare`: such a repository has no main worktree. */
function isBareRepository(commonDir: string): boolean {
  let section = "";
  for (const line of (readText(path.join(commonDir, "config")) ?? "").split(/\r?\n/)) {
    const header = /^\s*\[([^\]\s"]+)\]/.exec(line);
    if (header) {
      section = header[1]?.toLowerCase() ?? "";
    } else if (section === "core" && /^\s*bare\s*=\s*(true|yes|on|1)\b/i.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * The branches checked out in worktrees other than `repo`'s own: the HEAD of
 * every linked worktree under `<common>/worktrees/` except this one, and the
 * main worktree's HEAD when `repo` is itself linked and the common dir is not
 * bare. That is the set the branch badge marks (W11), read from the admin
 * directories so no Git process is spawned. A detached HEAD names no branch,
 * and a worktree whose folder has gone still counts, as Git still lists it.
 */
function branchesCheckedOutElsewhere(repo: string): Set<string> {
  const { gitDir, commonDir } = resolveGitDirs(repo);
  const branches = new Set<string>();
  const worktreesDir = path.join(commonDir, "worktrees");
  let adminNames: string[] = [];
  try {
    adminNames = fs.readdirSync(worktreesDir);
  } catch {
    adminNames = [];
  }
  for (const name of adminNames) {
    const admin = path.join(worktreesDir, name);
    if (path.resolve(admin) === path.resolve(gitDir)) continue;
    const branch = branchOfHead(admin);
    if (branch !== null) branches.add(branch);
  }
  const isLinked = path.resolve(gitDir) !== path.resolve(commonDir);
  if (isLinked && !isBareRepository(commonDir)) {
    const mainBranch = branchOfHead(commonDir);
    if (mainBranch !== null) branches.add(mainBranch);
  }
  return branches;
}

/**
 * Whether the loaded graph draws a branch that is checked out in another
 * worktree, which is exactly when the branch badge carries the W11 marker.
 * Only branch (`head`) refs qualify, as the webview marks nothing else.
 */
function hasBranchCheckedOutElsewhere(
  commits: readonly Pick<GitCommitNode, "refs">[],
  repo: string
): boolean {
  const drawn = commits.flatMap((commit) => commit.refs).filter((ref) => ref.type === "head");
  if (drawn.length === 0) return false;
  const elsewhere = branchesCheckedOutElsewhere(repo);
  return drawn.some((ref) => elsewhere.has(ref.name));
}

/**
 * Whether `repo` is a linked worktree: its git dir differs from its common
 * dir, which holds only for a worktree. A submodule's git dir sits under the
 * parent's `.git/modules/` and an independent repository's `.git` is a
 * directory, so neither splits the two. Resolved by `resolveGitDirs()` from the
 * file system, so no Git process is spawned; a path it cannot read answers
 * false, because its fallback names the same directory for both.
 */
function isLinkedWorktree(repo: string): boolean {
  const { gitDir, commonDir } = resolveGitDirs(repo);
  return gitDir !== commonDir;
}

/**
 * Whether `repo` sits inside another repository in the same set and is not a
 * linked worktree of it.
 *
 * That containment is the observable effect of submodule discovery: the route
 * to a nested submodule in the dropdown is `.gitmodules`, because the
 * workspace scan stops at a known repository's boundary. A worktree placed
 * inside its main worktree, such as `.worktrees/<name>`, also nests by path
 * but is not a submodule, so `isWorktree` excludes it. A repository the user
 * added by hand with Add Repository can also land inside another one and still
 * counts, so read these two signals as "a nested repository had something to
 * show", not as a count of `.gitmodules` entries.
 *
 * Trailing-slash comparison on `/`, matching `isDirectoryWithinRepos()` and
 * `searchDirectoryForRepos()`; every repository path reaching the extension
 * host is normalized to forward slashes. The file-system check runs only for a
 * path that is already nested, so an ordinary repository costs nothing.
 */
function isNestedRepo(
  repo: string,
  repoPaths: readonly string[],
  isWorktree: (repo: string) => boolean
): boolean {
  return (
    repoPaths.some((candidate) => candidate !== repo && repo.startsWith(`${candidate}/`)) &&
    !isWorktree(repo)
  );
}

/** Whether any repository in the set is a submodule nested inside another one. */
function hasNestedRepo(
  repoPaths: readonly string[],
  isWorktree: (repo: string) => boolean
): boolean {
  return repoPaths.some((repo) => isNestedRepo(repo, repoPaths, isWorktree));
}

export function createViewFeatureReporter(
  telemetry?: Pick<TelemetryReporter, "logFeature">
): ViewFeatureReporter {
  const reported = new Set<string>();
  // Asked on every load while a nested path is present, and a path's worktree
  // status does not change under a running session, so the answer is kept.
  const worktrees = new Map<string, boolean>();
  function isWorktree(repo: string): boolean {
    let known = worktrees.get(repo);
    if (known === undefined) {
      known = isLinkedWorktree(repo);
      worktrees.set(repo, known);
    }
    return known;
  }

  function reportOnce(feature: string) {
    if (reported.has(feature)) return;
    reported.add(feature);
    // ok: true — a read-side feature has no failure of its own to report. A
    // load that failed produces no commits and no signals.
    telemetry?.logFeature(feature, true);
  }

  function reportEngineSignals(facts: CommitLoadFacts) {
    if (facts.engineServed) reportOnce(VIEW_FEATURE_ENGINE_BACKEND);
    // The fixed reason name completes the id; nothing else about the
    // machine, the path or the binary is ever part of it.
    if (facts.engineUnavailable !== null) {
      reportOnce(`${VIEW_FEATURE_ENGINE_UNAVAILABLE_PREFIX}${facts.engineUnavailable}`);
    }
    if (facts.engineFailed) reportOnce(VIEW_FEATURE_ENGINE_FAILED);
    if (facts.engineDeclined) reportOnce(VIEW_FEATURE_ENGINE_DECLINED);
    if (facts.forcedCli) reportOnce(VIEW_FEATURE_FORCE_CLI_RELOAD);
  }

  // The linked-worktree answer is cached by `isWorktree`. The marker reads the
  // other worktrees' branches from the file system, so it is asked only until
  // it has fired, and only when the load draws a branch at all.
  function reportWorktreeSignals(facts: CommitLoadFacts) {
    if (!reported.has(VIEW_FEATURE_LINKED_WORKTREE_REPO) && isWorktree(facts.repo)) {
      reportOnce(VIEW_FEATURE_LINKED_WORKTREE_REPO);
    }
    if (
      !reported.has(VIEW_FEATURE_WORKTREE_MARKER) &&
      hasBranchCheckedOutElsewhere(facts.commits, facts.repo)
    ) {
      reportOnce(VIEW_FEATURE_WORKTREE_MARKER);
    }
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
      // Guarded like the signed-tag scan: one walk per session until a stash
      // row is actually present in a load.
      if (!reported.has(VIEW_FEATURE_STASH_ROWS) && hasStashRows(facts.commits)) {
        reportOnce(VIEW_FEATURE_STASH_ROWS);
      }
      reportEngineSignals(facts);
      reportWorktreeSignals(facts);
      // Submodules are a shown feature as well: discovery puts them in the
      // repository dropdown as indented entries and there is no command
      // behind them, so neither action chokepoint can see them. Two signals
      // rather than one, because being offered a submodule and choosing to
      // work in one are different facts — the first says discovery found
      // something, the second says it was worth having. The active signal is
      // reported from the commit load precisely so it means "the graph was
      // drawn for this submodule", not "the entry existed".
      if (
        !reported.has(VIEW_FEATURE_SUBMODULE_REPO) &&
        hasNestedRepo(facts.repoPaths, isWorktree)
      ) {
        reportOnce(VIEW_FEATURE_SUBMODULE_REPO);
      }
      if (
        !reported.has(VIEW_FEATURE_SUBMODULE_ACTIVE) &&
        isNestedRepo(facts.repo, facts.repoPaths, isWorktree)
      ) {
        reportOnce(VIEW_FEATURE_SUBMODULE_ACTIVE);
      }
    },
    recordUncommittedDetailsOpened(facts) {
      reportOnce(VIEW_FEATURE_UNCOMMITTED_PANEL);
      if (facts.grouped) reportOnce(VIEW_FEATURE_UNCOMMITTED_TREE);
    }
  };
}
