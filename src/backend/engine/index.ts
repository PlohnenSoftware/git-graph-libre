/**
 * Repository reads with engine-first, CLI-fallback routing (Phase 16,
 * slice 16.3).
 *
 * The CLI is the default and the engine is the optimization: every read keeps
 * a working CLI implementation, and a missing binary, a failed load, a
 * version-skewed addon, or a `git-cli` preference all land on exactly the
 * CLI behavior. The fallback rule is upstream's and is worth keeping: fall
 * back only on "not a repository" and "unsupported" — a genuine Git failure
 * must not be retried through the CLI, because it will fail again more slowly
 * and hide the real error.
 *
 * Engine error kinds arrive as `Kind: message` prefixes on the thrown Error
 * (see `to_js_error` in `engine/native/node/src/lib.rs`); only the two
 * decline prefixes below route to the CLI.
 */

import type { SimpleGit } from "simple-git";

import { commitDetails } from "@/backend/queries/commitDetails";
import { commitComparison } from "@/backend/queries/commitComparison";
import { loadCommits } from "@/backend/queries/loadCommits";
import { emptyRepoInfo, loadRepoInfo } from "@/backend/queries/loadRepoInfo";
import type { DateType, GitCommitDetails, GitFileChange, QueryResult } from "@/backend/types";
import { getRemoteUrl } from "@/backend/utils/git";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { uniqueNonEmpty } from "@/backend/utils/logFilters";
import { toGitQueryError } from "@/backend/utils/queryError";
import type { EngineBackend } from "@/types";

import { type EngineAddon, loadEngineAddon } from "./addon";
import {
  attachRemoteHeadLabels,
  attachSignedTagNames,
  buildLoadCommitsOptions,
  engineLoadCommitsRefs,
  type EngineLoadCommitsInput,
  mapEngineCommitData,
  parseEngineCommitData,
  shouldServeLoadCommitsFromEngine
} from "./commits";
import {
  applyLineCounts,
  findStashEntry,
  lineCountPaths,
  mapEngineFileChange,
  parseEngineCommitDetails,
  parseEngineFileChanges,
  parseEngineLineCounts,
  parseEngineStashEntries,
  stashEntryPayload,
  type EngineCommitDetails
} from "./details";
import { buildRepoInfoOptions, composeEngineRepoInfo, parseEngineRepoInfo } from "./repoInfo";

/** How the reader loads the addon. The default is the real loader; tests inject fakes. */
export type AddonProvider = () => EngineAddon | null;

export type RepoReaderDeps = {
  /** Read live per call by the caller — never cached, so flipping the setting needs no reload. */
  preference: EngineBackend;
  gitPath: string;
  addonProvider?: AddonProvider;
};

export type RepoReader = {
  /** The fetch URL of `origin`, or null when it is not configured. Total: never throws. */
  getRemoteUrl(repoPath: string): Promise<string | null>;
  /** The repository info for the graph header. Genuine engine failures surface as the read error. */
  loadRepoInfo(args: RepoInfoArgs): Promise<QueryResult<"loadRepoInfo">>;
  /** One page of the graph. Genuine engine failures surface as the read error. */
  loadCommits(args: LoadCommitsArgs): Promise<QueryResult<"loadCommits">>;
  /** One commit in full, counts settled eagerly like the CLI. */
  loadCommitDetails(args: CommitDetailsArgs): Promise<QueryResult<"commitDetails">>;
  /** One arbitrary revision pair, counts settled eagerly like the CLI. */
  loadCommitComparison(args: CommitComparisonArgs): Promise<QueryResult<"commitComparison">>;
};

export type RepoInfoArgs = {
  repoPath: string;
  showStashes: boolean;
  git: SimpleGit;
  recordGitCommand?: GitCommandRecorder;
};

export type LoadCommitsArgs = EngineLoadCommitsInput & {
  repoPath: string;
  git: SimpleGit;
  hard: boolean;
  recordGitCommand?: GitCommandRecorder;
};

export type CommitDetailsArgs = {
  repoPath: string;
  git: SimpleGit;
  commitHash: string;
  dateType: DateType;
  recordGitCommand?: GitCommandRecorder;
};

export type CommitComparisonArgs = {
  repoPath: string;
  git: SimpleGit;
  commitHash: string;
  baseRef: string;
  compareRef: string;
  dateType: DateType;
  recordGitCommand?: GitCommandRecorder;
};

/** Prefixes the engine uses for declines the CLI must serve instead. */
const FALLBACK_ERROR_PREFIXES = ["NotARepository:", "Unsupported:"];

/**
 * Whether an engine failure is a decline (route to the CLI) rather than a
 * genuine failure (never retry). Anything that is not a prefixed engine Error
 * — a non-Error throw, a foreign message — is genuine by default: an
 * unrecognized failure retried through the CLI fails again more slowly.
 */
export function isEngineFallbackError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return false;
  return FALLBACK_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix));
}

let engineServedRead = false;

/**
 * Whether the engine has actually served a read this session. Feeds the
 * `view.engineBackend` telemetry signal: true only when the engine served,
 * never a per-load count and never a path.
 */
export function didEngineServeRead(): boolean {
  return engineServedRead;
}

/** Test seam: the flag is session-scoped, so cases reset it between runs. */
export function resetEngineServedRead(): void {
  engineServedRead = false;
}

export function createRepoReader(deps: RepoReaderDeps): RepoReader {
  const provider = deps.addonProvider ?? loadEngineAddon;
  return {
    getRemoteUrl: (repoPath: string) =>
      readRemoteUrl(deps.preference, deps.gitPath, provider, repoPath),
    loadRepoInfo: (args: RepoInfoArgs) => readRepoInfo(deps.preference, provider, args),
    loadCommits: (args: LoadCommitsArgs) =>
      readCommits(deps.preference, deps.gitPath, provider, args),
    loadCommitDetails: (args: CommitDetailsArgs) =>
      readCommitDetails(deps.preference, provider, args),
    loadCommitComparison: (args: CommitComparisonArgs) =>
      readCommitComparison(deps.preference, provider, args)
  };
}

async function readRemoteUrl(
  preference: EngineBackend,
  gitPath: string,
  provider: AddonProvider,
  repoPath: string
): Promise<string | null> {
  // The total no-op path: the addon is not even loaded.
  if (preference === "git-cli") return getRemoteUrl(repoPath, gitPath);
  const addon = provider();
  if (addon === null) return getRemoteUrl(repoPath, gitPath);
  try {
    const url = await addon.remoteUrl(repoPath, "origin");
    engineServedRead = true;
    // Same normalization the CLI arm applies: trim, empty means unconfigured.
    const normalized = (url ?? "").trim();
    return normalized === "" ? null : normalized;
  } catch (error: unknown) {
    if (!isEngineFallbackError(error)) return null;
    return getRemoteUrl(repoPath, gitPath);
  }
}

async function readRepoInfo(
  preference: EngineBackend,
  provider: AddonProvider,
  args: RepoInfoArgs
): Promise<QueryResult<"loadRepoInfo">> {
  const cliRead = (): Promise<QueryResult<"loadRepoInfo">> =>
    loadRepoInfo(args.git, {
      repo: args.repoPath,
      showStashes: args.showStashes,
      recordGitCommand: args.recordGitCommand
    });
  // The total no-op path: the addon is not even loaded.
  if (preference === "git-cli") return cliRead();
  const addon = provider();
  if (addon === null) return cliRead();
  try {
    const info = parseEngineRepoInfo(
      await addon.loadRepoInfo(args.repoPath, buildRepoInfoOptions(args.showStashes))
    );
    if (info === null) {
      return {
        repoInfo: emptyRepoInfo(true),
        error: toGitQueryError(
          new Error("Engine returned malformed repository info"),
          "Unable to load repository info"
        )
      };
    }
    // The partial-error field is reserved (always null today): stay on the
    // CLI behavior rather than guessing which half to trust.
    if (info.error !== null) return cliRead();
    const composed = await composeEngineRepoInfo(
      { git: args.git, repo: args.repoPath, recordGitCommand: args.recordGitCommand },
      info
    );
    if (composed === null) return cliRead();
    engineServedRead = true;
    return composed;
  } catch (error: unknown) {
    if (!isEngineFallbackError(error)) {
      return {
        repoInfo: emptyRepoInfo(true),
        error: toGitQueryError(error, "Unable to load repository info")
      };
    }
    return cliRead();
  }
}

async function readCommits(
  preference: EngineBackend,
  gitPath: string,
  provider: AddonProvider,
  args: LoadCommitsArgs
): Promise<QueryResult<"loadCommits">> {
  const cliRead = (): Promise<QueryResult<"loadCommits">> =>
    loadCommits(args.git, {
      branchName: args.branchName,
      branches: args.branches,
      authors: args.authors,
      tags: args.tags,
      maxCommits: args.maxCommits,
      showRemoteBranches: args.showRemoteBranches,
      hiddenRemotes: args.hiddenRemotes,
      showTags: args.showTags,
      includeReflog: args.includeReflog,
      includeUnreachableCommits: args.includeUnreachableCommits,
      onlyFollowFirstParent: args.onlyFollowFirstParent,
      commitOrdering: args.commitOrdering,
      showSignature: args.showSignature,
      showStashes: args.showStashes,
      hard: args.hard,
      dateType: args.dateType,
      showUncommittedChanges: args.showUncommittedChanges,
      repo: args.repoPath,
      gitPath,
      recordGitCommand: args.recordGitCommand
    });
  // The total no-op path: the addon is not even loaded.
  if (preference === "git-cli") return cliRead();
  // The pre-call declines: shapes the engine cannot serve go straight to
  // the CLI, decided here and never by catching a failure.
  if (!shouldServeLoadCommitsFromEngine(args)) return cliRead();
  const addon = provider();
  if (addon === null) return cliRead();
  const showStashes = args.showStashes === true;
  try {
    const data = parseEngineCommitData(
      await addon.loadCommits(args.repoPath, buildLoadCommitsOptions(args))
    );
    if (data === null) {
      return {
        commits: [],
        head: null,
        moreCommitsAvailable: false,
        hard: args.hard,
        error: toGitQueryError(
          new Error("Engine returned malformed commit data"),
          "Unable to load commits"
        )
      };
    }
    // The partial-error field is reserved (always null today): stay on the
    // CLI behavior rather than guessing which half to trust.
    if (data.error !== null) return cliRead();
    const nodes = mapEngineCommitData(data, showStashes);
    // An unborn repository has no page to serve: the CLI owns the
    // empty-graph error shape, so those loads stay on it exactly.
    if (data.head === null) return cliRead();
    // An unfiltered show-all load always shows HEAD: the CLI pulls it onto
    // the page when it falls beyond it, and rows the uncommitted changes
    // beneath it. An engine page without HEAD is not a valid substitute, so
    // those rare loads go straight to the CLI — correct by construction.
    // Filtered loads exclude HEAD by request on both backends instead.
    if (
      engineLoadCommitsRefs(args) === null &&
      uniqueNonEmpty(args.authors) === null &&
      !nodes.some((node) => node.hash === data.head)
    ) {
      return cliRead();
    }
    // The engine never records symbolic remote HEADs (`origin/HEAD`): one
    // narrow scan attaches them in CLI order, but only when the page carries
    // remote labels at all — a repository without remotes pays no spawn.
    if (
      args.showRemoteBranches &&
      nodes.some((node) => node.refs.some((ref) => ref.type === "remote"))
    ) {
      await attachRemoteHeadLabels(
        { git: args.git, repo: args.repoPath, recordGitCommand: args.recordGitCommand },
        nodes,
        args.hiddenRemotes
      );
    }
    // The engine never reports tag signature presence either: one narrow
    // scan flips the badges, but only when the page carries tag labels.
    if (nodes.some((node) => node.refs.some((ref) => ref.type === "tag"))) {
      await attachSignedTagNames(
        { git: args.git, repo: args.repoPath, recordGitCommand: args.recordGitCommand },
        nodes
      );
    }
    engineServedRead = true;
    return {
      commits: nodes,
      head: data.head,
      moreCommitsAvailable: data.moreCommitsAvailable,
      hard: args.hard,
      error: null
    };
  } catch (error: unknown) {
    if (!isEngineFallbackError(error)) {
      return {
        commits: [],
        head: null,
        moreCommitsAvailable: false,
        hard: args.hard,
        error: toGitQueryError(error, "Unable to load commits")
      };
    }
    return cliRead();
  }
}

/**
 * Settle the whole path list through `load_line_counts` and join the counts
 * onto the mapped changes. A failed or malformed counts call reroutes to the
 * whole CLI read: counts are the point of the read, and serving them null
 * would be silently wrong where the CLI is exact.
 */
async function fillLineCounts<
  T extends QueryResult<"commitDetails"> | QueryResult<"commitComparison">
>(
  addon: EngineAddon,
  args: { repoPath: string },
  from: string | null,
  to: string,
  fileChanges: GitFileChange[],
  cliRead: () => Promise<T>
): Promise<T | null> {
  const paths = lineCountPaths(fileChanges);
  if (paths.length === 0) return null;
  let countsText: string;
  try {
    countsText = await addon.loadLineCounts(args.repoPath, from, to, JSON.stringify(paths));
  } catch {
    return cliRead();
  }
  const counts = parseEngineLineCounts(countsText);
  if (counts === null) return cliRead();
  applyLineCounts(fileChanges, counts);
  return null;
}

function toGitCommitDetails(
  data: EngineCommitDetails,
  fileChanges: GitFileChange[]
): GitCommitDetails {
  return {
    hash: data.hash,
    parents: [...data.parents],
    author: data.author,
    email: data.authorEmail,
    authorDate: data.authorDate,
    committer: data.committer,
    committerEmail: data.committerEmail,
    committerDate: data.committerDate,
    body: data.body,
    fileChanges
  };
}

async function readCommitDetails(
  preference: EngineBackend,
  provider: AddonProvider,
  args: CommitDetailsArgs
): Promise<QueryResult<"commitDetails">> {
  const cliRead = (): Promise<QueryResult<"commitDetails">> =>
    commitDetails(args.git, {
      commitHash: args.commitHash,
      dateType: args.dateType,
      repo: args.repoPath,
      recordGitCommand: args.recordGitCommand
    });
  // The total no-op path: the addon is not even loaded.
  if (preference === "git-cli") return cliRead();
  // A blank hash and the `*` row both error on the CLI today (`git show`
  // resolves neither); the engine would serve uncommitted-shaped data for
  // `*`, which is a UX change for its own slice — so both stay CLI.
  if (args.commitHash.trim() === "" || args.commitHash === "*") return cliRead();
  const addon = provider();
  if (addon === null) return cliRead();
  try {
    // The stash list rides along so a stash hash takes `load_stash_details`
    // (diffed against its base, untracked appended) instead of the plain
    // commit diff. Both calls are in-process; the plain details are
    // discarded on the rare stash path.
    const [stashesText, detailsText] = await Promise.all([
      addon.loadStashes(args.repoPath),
      addon.loadCommitDetails(args.repoPath, args.commitHash)
    ]);
    const details = parseEngineCommitDetails(detailsText);
    if (details === null) {
      return {
        commitDetails: null,
        error: toGitQueryError(
          new Error("Engine returned malformed commit details"),
          "Unable to load commit details"
        )
      };
    }
    // The CLI diffs a merge against every parent (`-m`); the engine diffs
    // against the first parent only. A multi-parent page is not a valid
    // substitute, so those loads go back to the whole CLI read.
    if (details.parents.length > 1) return cliRead();
    const stashes = parseEngineStashEntries(stashesText);
    const stash = stashes === null ? undefined : findStashEntry(stashes, args.commitHash);
    let fileChanges = details.fileChanges.map(mapEngineFileChange);
    let from: string | null = null;
    if (stash !== undefined) {
      const stashText = await addon.loadStashDetails(
        args.repoPath,
        args.commitHash,
        stashEntryPayload(stash)
      );
      const stashDetails = parseEngineCommitDetails(stashText);
      if (stashDetails === null) {
        return {
          commitDetails: null,
          error: toGitQueryError(
            new Error("Engine returned malformed stash details"),
            "Unable to load commit details"
          )
        };
      }
      fileChanges = stashDetails.fileChanges.map(mapEngineFileChange);
      from = stash.baseHash;
    }
    const filled = await fillLineCounts(addon, args, from, args.commitHash, fileChanges, cliRead);
    if (filled !== null) return filled;
    engineServedRead = true;
    return { commitDetails: toGitCommitDetails(details, fileChanges), error: null };
  } catch (error: unknown) {
    if (!isEngineFallbackError(error)) {
      return {
        commitDetails: null,
        error: toGitQueryError(error, "Unable to load commit details")
      };
    }
    return cliRead();
  }
}

async function readCommitComparison(
  preference: EngineBackend,
  provider: AddonProvider,
  args: CommitComparisonArgs
): Promise<QueryResult<"commitComparison">> {
  const cliRead = (): Promise<QueryResult<"commitComparison">> =>
    commitComparison(args.git, {
      commitHash: args.commitHash,
      baseRef: args.baseRef,
      compareRef: args.compareRef,
      dateType: args.dateType,
      repo: args.repoPath,
      recordGitCommand: args.recordGitCommand
    });
  // The total no-op path: the addon is not even loaded.
  if (preference === "git-cli") return cliRead();
  // The CLI rejects blank refs before any git call; the engine would resolve
  // an empty `to` against the working tree instead — so those stay CLI,
  // reproducing the exact validation error.
  if (
    args.commitHash.trim() === "" ||
    args.baseRef.trim() === "" ||
    args.compareRef.trim() === ""
  ) {
    return cliRead();
  }
  const addon = provider();
  if (addon === null) return cliRead();
  try {
    const [detailsText, changesText] = await Promise.all([
      addon.loadCommitDetails(args.repoPath, args.commitHash),
      addon.compareCommits(args.repoPath, args.baseRef, args.compareRef)
    ]);
    const details = parseEngineCommitDetails(detailsText);
    const fileChanges = parseEngineFileChanges(changesText);
    if (details === null || fileChanges === null) {
      return {
        commitDetails: null,
        error: toGitQueryError(
          new Error("Engine returned malformed commit comparison"),
          "Unable to load commit comparison"
        )
      };
    }
    const filled = await fillLineCounts(
      addon,
      args,
      args.baseRef,
      args.compareRef,
      fileChanges,
      cliRead
    );
    if (filled !== null) return filled;
    engineServedRead = true;
    return { commitDetails: toGitCommitDetails(details, fileChanges), error: null };
  } catch (error: unknown) {
    if (!isEngineFallbackError(error)) {
      return {
        commitDetails: null,
        error: toGitQueryError(error, "Unable to load commit comparison")
      };
    }
    return cliRead();
  }
}
