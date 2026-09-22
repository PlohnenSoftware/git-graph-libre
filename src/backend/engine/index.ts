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

import { loadCommits } from "@/backend/queries/loadCommits";
import { emptyRepoInfo, loadRepoInfo } from "@/backend/queries/loadRepoInfo";
import type { QueryResult } from "@/backend/types";
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
      readCommits(deps.preference, deps.gitPath, provider, args)
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
