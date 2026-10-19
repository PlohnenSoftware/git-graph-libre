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
import { commitComparison } from "@/backend/queries/commitComparison";
import { commitDetails } from "@/backend/queries/commitDetails";
import { loadCommits } from "@/backend/queries/loadCommits";
import { emptyRepoInfo, loadRepoInfo } from "@/backend/queries/loadRepoInfo";
import { normalizeMaxResults, searchCommits } from "@/backend/queries/searchCommits";
import type { DateType, GitCommitDetails, GitFileChange, QueryResult } from "@/backend/types";
import { getRemoteUrl } from "@/backend/utils/git";
import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { uniqueNonEmpty } from "@/backend/utils/logFilters";
import { logBackendRoute } from "@/backend/utils/operationLog";
import { toGitQueryError } from "@/backend/utils/queryError";
import type {
  EngineBackend,
  EngineComponentStatus,
  EngineUnavailableReason,
  GraphLoadRoute
} from "@/types";
import { type EngineAddon, engineLoadStatus, loadEngineAddon, withEngineLogging } from "./addon";
import {
  buildLoadCommitsOptions,
  type EngineLoadCommitsInput,
  engineLoadCommitsRefs,
  loadCommitsDecline,
  mapEngineCommitData,
  parseEngineCommitData
} from "./commits";
import {
  applyLineCounts,
  type EngineCommitDetails,
  type EngineStashEntry,
  findStashEntry,
  lineCountPaths,
  mapEngineFileChange,
  parseEngineCommitDetails,
  parseEngineFileChanges,
  parseEngineLineCounts,
  parseEngineStashEntries,
  stashEntryPayload
} from "./details";
import { buildRepoInfoOptions, composeEngineRepoInfo, parseEngineRepoInfo } from "./repoInfo";
import {
  buildSearchOptions,
  type EngineSearchInput,
  mapEngineSearchResults,
  parseEngineSearchResults,
  shouldServeSearchFromEngine
} from "./search";

/** How the reader loads the addon. The default is the real loader; tests inject fakes. */
export type AddonProvider = () => EngineAddon | null;

export type RepoReaderDeps = {
  /** Read live per call by the caller — never cached, so flipping the setting needs no reload. */
  preference: EngineBackend;
  gitPath: string;
  addonProvider?: AddonProvider;
  /**
   * One read served by the CLI on request — the hidden menu's "Reload once
   * with Git CLI" — whatever the preference says. Behaves exactly as `git-cli`
   * (the addon is not touched) and is recorded as its own graph-load route.
   */
  forceCli?: boolean;
  /**
   * Git has not confirmed in this session that it accepts this repository.
   * The engine would open a repository Git rejects for ownership (gix grants
   * it reduced trust instead of failing), so every read goes to the CLI,
   * which reports the rejection instead of bypassing it.
   */
  unverified?: boolean;
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
  /** The Find dialogue's hits, ordered by their position in the graph walk. */
  searchCommits(args: SearchArgs): Promise<QueryResult<"searchCommits">>;
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

export type SearchArgs = EngineSearchInput & {
  repoPath: string;
  git: SimpleGit;
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
let engineFailedRead = false;
let engineDeclinedRead = false;

/**
 * Whether the engine has actually served a read this session. Feeds the
 * `view.engineBackend` telemetry signal: true only when the engine served,
 * never a per-load count and never a path.
 */
export function didEngineServeRead(): boolean {
  return engineServedRead;
}

/**
 * Whether the engine failed a read outright this session: a genuine error the
 * user saw as the read's error, or a payload the strict guards refused. Feeds
 * the `view.engineFailed` signal, once per session like every engine signal.
 */
export function didEngineFailRead(): boolean {
  return engineFailedRead;
}

/**
 * Whether the engine handed a read back to the CLI at run time this session
 * (`NotARepository` / `Unsupported`): the read still succeeded, served by the
 * CLI. Feeds the `view.engineDeclined` signal.
 */
export function didEngineDeclineRead(): boolean {
  return engineDeclinedRead;
}

/** Test seam: the flags are session-scoped, so cases reset all three between runs. */
export function resetEngineServedRead(): void {
  engineServedRead = false;
  engineFailedRead = false;
  engineDeclinedRead = false;
}

/** The fixed decline kind an engine error's prefix names; never the message itself. */
function declineKind(error: unknown): string {
  const message = (error as { message?: unknown }).message;
  const prefix = FALLBACK_ERROR_PREFIXES.find(
    (candidate) => typeof message === "string" && message.startsWith(candidate)
  );
  return prefix === undefined ? "unknown" : prefix.slice(0, -1);
}

/**
 * Record how an engine call that threw ended: declined to the CLI, or failed.
 * A failure fails the read unless the caller falls back for it, which the
 * route line then says instead.
 */
function noteEngineThrow(
  error: unknown,
  operation: string,
  onFailure: "fails" | "fallsBack" = "fails"
): boolean {
  const declined = isEngineFallbackError(error);
  if (declined) {
    engineDeclinedRead = true;
    logBackendRoute(operation, `backend=cli reason=engineDeclined kind=${declineKind(error)}`);
  } else {
    engineFailedRead = true;
    logBackendRoute(
      operation,
      onFailure === "fails"
        ? "result=failed reason=engineFailed"
        : "backend=cli reason=engineFailed"
    );
  }
  return declined;
}

/** Record an engine answer this version cannot read; the read fails. */
function noteMalformedPayload(operation: string): void {
  engineFailedRead = true;
  logBackendRoute(operation, "result=failed reason=malformedPayload");
}

/** Log why a read the engine could have served goes to the CLI instead. */
function rerouteToCli<T>(operation: string, reason: string, read: () => Promise<T>): Promise<T> {
  logBackendRoute(operation, `backend=cli reason=${reason}`);
  return read();
}

let lastGraphLoad: GraphLoadRoute | null = null;

/**
 * Which backend answered the most recent graph load, and why the CLI did if
 * it did — what the status indicator reports, so "is the engine actually
 * working" has an answer short of reading the command log. Null until the
 * first load of the session. Unlike `didEngineServeRead()` this is not
 * telemetry: it never leaves the extension.
 */
export function lastGraphLoadRoute(): GraphLoadRoute | null {
  return lastGraphLoad;
}

/**
 * The engine as the given preference sees it. `git-cli` answers `off`
 * without touching the loader — that path never loads the addon at all —
 * while `auto` reports the session's one load attempt.
 */
export function engineComponentStatus(
  preference: EngineBackend,
  status: () => EngineComponentStatus = engineLoadStatus
): EngineComponentStatus {
  return preference === "git-cli" ? { state: "off" } : status();
}

/** Why the engine could not start under this preference, or null when it started or was not tried. */
export function engineUnavailableReason(
  preference: EngineBackend,
  status: () => EngineComponentStatus = engineLoadStatus
): EngineUnavailableReason | null {
  const component = engineComponentStatus(preference, status);
  return component.state === "unavailable" ? component.reason : null;
}

/**
 * Drop one repository's engine handle after it leaves the workspace,
 * releasing its object cache and open pack files. Best effort by design:
 * a missing addon means there is nothing to drop, and a close that throws
 * must never break repository removal. Handles reopen lazily on the next
 * read — the probe behind slice 16.8 showed a warm handle sees external
 * commits, ref updates, stash pushes and checkouts immediately, so no
 * write-time bust is needed and this is purely about not accumulating
 * handles across repository switches.
 */
export function closeEngineRepository(
  repoPath: string,
  provider: () => Pick<EngineAddon, "closeRepository"> | null = loadEngineAddon
): void {
  try {
    provider()?.closeRepository(repoPath);
  } catch {
    // Removal must succeed whether or not the engine cooperates.
  }
}

/** Drop every engine handle (extension deactivation). Best effort, as above. */
export function closeAllEngineRepositories(
  provider: () => Pick<EngineAddon, "closeAllRepositories"> | null = loadEngineAddon
): void {
  try {
    provider()?.closeAllRepositories();
  } catch {
    // Deactivation must succeed whether or not the engine cooperates.
  }
}

/** How many engine handles are currently open; 0 without a loadable addon. */
export function openEngineRepositoryCount(
  provider: () => Pick<EngineAddon, "openRepositoryCount"> | null = loadEngineAddon
): number {
  try {
    return provider()?.openRepositoryCount() ?? 0;
  } catch {
    return 0;
  }
}

export function createRepoReader(deps: RepoReaderDeps): RepoReader {
  const provider = () => {
    const addon = (deps.addonProvider ?? loadEngineAddon)();
    if (!addon) logBackendRoute("fallback", "backend=cli reason=engineUnavailable");
    return addon ? withEngineLogging(addon) : null;
  };
  const forced = deps.forceCli === true;
  // An unverified repository is never handed to the engine, whatever the read.
  const preference: EngineBackend = deps.unverified === true ? "git-cli" : deps.preference;
  let cliReason: string | null = null;
  if (forced) cliReason = "forced";
  else if (deps.unverified === true) cliReason = "unverified";
  else if (deps.preference === "git-cli") cliReason = "setting";
  if (cliReason !== null) logBackendRoute("reader", `backend=cli reason=${cliReason}`);
  let commitsRoute: "forced" | "unverified" | null = null;
  if (forced) commitsRoute = "forced";
  else if (deps.unverified === true) commitsRoute = "unverified";
  return {
    getRemoteUrl: (repoPath: string) => readRemoteUrl(preference, deps.gitPath, provider, repoPath),
    loadRepoInfo: (args: RepoInfoArgs) =>
      readRepoInfo(forced ? "git-cli" : preference, provider, args),
    loadCommits: (args: LoadCommitsArgs) =>
      readCommits(preference, deps.gitPath, provider, args, commitsRoute),
    loadCommitDetails: (args: CommitDetailsArgs) => readCommitDetails(preference, provider, args),
    loadCommitComparison: (args: CommitComparisonArgs) =>
      readCommitComparison(preference, provider, args),
    searchCommits: (args: SearchArgs) => readSearch(preference, provider, args)
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
    if (!noteEngineThrow(error, "remoteUrl")) return null;
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
      noteMalformedPayload("loadRepoInfo");
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
    if (info.error !== null) return rerouteToCli("loadRepoInfo", "partialError", cliRead);
    const composed = await composeEngineRepoInfo(
      { git: args.git, repo: args.repoPath, recordGitCommand: args.recordGitCommand, addon },
      info
    );
    if (composed === null) return rerouteToCli("loadRepoInfo", "composeDeclined", cliRead);
    engineServedRead = true;
    return composed;
  } catch (error: unknown) {
    if (!noteEngineThrow(error, "loadRepoInfo")) {
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
  args: LoadCommitsArgs,
  cliRoute: "forced" | "unverified" | null
): Promise<QueryResult<"loadCommits">> {
  const cliRead = (route: GraphLoadRoute): Promise<QueryResult<"loadCommits">> => {
    lastGraphLoad = route;
    logBackendRoute("loadCommits", `backend=cli reason=${route}`);
    return loadCommits(args.git, {
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
      showStashes: args.showStashes,
      hard: args.hard,
      dateType: args.dateType,
      showUncommittedChanges: args.showUncommittedChanges,
      repo: args.repoPath,
      gitPath,
      recordGitCommand: args.recordGitCommand
    });
  };
  // The total no-op path: the addon is not even loaded.
  if (cliRoute !== null) return cliRead(cliRoute);
  if (preference === "git-cli") return cliRead("setting");
  // The pre-call declines: shapes the engine cannot serve go straight to
  // the CLI, decided here and never by catching a failure.
  const decline = loadCommitsDecline(args);
  if (decline !== null) return cliRead(decline);
  const addon = provider();
  if (addon === null) return cliRead("unavailable");
  const showStashes = args.showStashes === true;
  // From here the engine answers, and every reroute below records itself.
  lastGraphLoad = "engine";
  try {
    const data = parseEngineCommitData(
      await addon.loadCommits(args.repoPath, buildLoadCommitsOptions(args))
    );
    if (data === null) {
      noteMalformedPayload("loadCommits");
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
    if (data.error !== null) return cliRead("handedBack");
    const nodes = mapEngineCommitData(data, showStashes);
    // An unborn repository has no page to serve: the CLI owns the
    // empty-graph error shape, so those loads stay on it exactly.
    if (data.head === null) return cliRead("handedBack");
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
      return cliRead("handedBack");
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
    if (!noteEngineThrow(error, "loadCommits")) {
      return {
        commits: [],
        head: null,
        moreCommitsAvailable: false,
        hard: args.hard,
        error: toGitQueryError(error, "Unable to load commits")
      };
    }
    return cliRead("handedBack");
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
  } catch (error: unknown) {
    noteEngineThrow(error, "loadLineCounts", "fallsBack");
    return cliRead();
  }
  const counts = parseEngineLineCounts(countsText);
  if (counts === null) {
    engineFailedRead = true;
    return rerouteToCli("loadLineCounts", "malformedPayload", cliRead);
  }
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

function malformedCommitDetails(message: string): QueryResult<"commitDetails"> {
  return {
    commitDetails: null,
    error: toGitQueryError(new Error(message), "Unable to load commit details")
  };
}

/**
 * The file list to serve: the commit's own diff, or for a stash its
 * `load_stash_details` list (diffed against the base, untracked appended).
 * Null when the stash payload is malformed.
 */
async function engineFileChanges(
  addon: EngineAddon,
  args: CommitDetailsArgs,
  details: EngineCommitDetails,
  stash: EngineStashEntry | undefined
): Promise<GitFileChange[] | null> {
  if (stash === undefined) return details.fileChanges.map(mapEngineFileChange);
  const stashText = await addon.loadStashDetails(
    args.repoPath,
    args.commitHash,
    stashEntryPayload(stash)
  );
  const stashDetails = parseEngineCommitDetails(stashText);
  if (stashDetails === null) {
    noteMalformedPayload("stashDetails");
    return null;
  }
  return stashDetails.fileChanges.map(mapEngineFileChange);
}

/**
 * Fill the `+N/-M` counts, then, for a stash, the counts of its untracked
 * files. Those live only in the stash's third parent, a root commit the
 * base-to-stash counts cannot see, so they are counted against the empty
 * tree. Returns the CLI answer when either call reroutes, else null.
 */
async function fillCommitDetailsCounts(
  addon: EngineAddon,
  args: CommitDetailsArgs,
  stash: EngineStashEntry | undefined,
  fileChanges: GitFileChange[],
  cliRead: () => Promise<QueryResult<"commitDetails">>
): Promise<QueryResult<"commitDetails"> | null> {
  const from = stash === undefined ? null : stash.baseHash;
  const filled = await fillLineCounts(addon, args, from, args.commitHash, fileChanges, cliRead);
  if (filled !== null) return filled;
  const untrackedHash = stash?.untrackedFilesHash ?? null;
  if (untrackedHash === null) return null;
  const untrackedChanges = fileChanges.filter((change) => change.untracked === true);
  return fillLineCounts(addon, args, null, untrackedHash, untrackedChanges, cliRead);
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
  if (args.commitHash.trim() === "" || args.commitHash === "*")
    return rerouteToCli("commitDetails", "noCommitHash", cliRead);
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
      noteMalformedPayload("commitDetails");
      return malformedCommitDetails("Engine returned malformed commit details");
    }
    const stashes = parseEngineStashEntries(stashesText);
    const stash = stashes === null ? undefined : findStashEntry(stashes, args.commitHash);
    // A merge needs no reroute: the engine's `diff_commit` diffs against
    // the first parent, and the CLI merge query does the same, so a
    // multi-parent page from either backend lists the same files. A
    // stash is multi-parent too, and the stash branch below diffs it
    // against its base the way the CLI's stash path does.
    const fileChanges = await engineFileChanges(addon, args, details, stash);
    if (fileChanges === null) {
      return malformedCommitDetails("Engine returned malformed stash details");
    }
    const filled = await fillCommitDetailsCounts(addon, args, stash, fileChanges, cliRead);
    if (filled !== null) return filled;
    engineServedRead = true;
    logBackendRoute(
      "commitDetails",
      `backend=engine files=${fileChanges.length}${stash !== undefined ? " stash=1" : ""}`
    );
    return { commitDetails: toGitCommitDetails(details, fileChanges), error: null };
  } catch (error: unknown) {
    if (!noteEngineThrow(error, "commitDetails")) {
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
    return rerouteToCli("commitComparison", "blankRef", cliRead);
  }
  // A working-tree comparison stays on the CLI: the engine's worktree diff
  // reports no counts for modified files and lists untracked files that
  // `git diff <commit>` does not (see `diff_against_worktree` in diff.rs).
  if (args.baseRef === "*" || args.compareRef === "*") {
    return rerouteToCli("commitComparison", "worktreeComparison", cliRead);
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
      noteMalformedPayload("commitComparison");
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
    logBackendRoute("commitComparison", `backend=engine files=${fileChanges.length}`);
    return { commitDetails: toGitCommitDetails(details, fileChanges), error: null };
  } catch (error: unknown) {
    if (!noteEngineThrow(error, "commitComparison")) {
      return {
        commitDetails: null,
        error: toGitQueryError(error, "Unable to load commit comparison")
      };
    }
    return cliRead();
  }
}

/**
 * The Find dialogue's search.
 *
 * A decline, a failed engine call, or a payload this version does not
 * recognise all land on the CLI with the same arguments, so the dialogue's
 * behaviour is identical either way.
 */
async function readSearch(
  preference: EngineBackend,
  provider: AddonProvider,
  args: SearchArgs
): Promise<QueryResult<"searchCommits">> {
  const cliRead = (): Promise<QueryResult<"searchCommits">> =>
    searchCommits(args.git, {
      query: args.query,
      maxResults: args.maxResults,
      showRemoteBranches: args.showRemoteBranches,
      hiddenRemotes: args.hiddenRemotes,
      showTags: args.showTags,
      branches: args.branches,
      authors: args.authors,
      tags: args.tags,
      dateType: args.dateType,
      repo: args.repoPath,
      recordGitCommand: args.recordGitCommand
    });
  // The total no-op path: the addon is not even loaded.
  if (preference === "git-cli") return cliRead();
  if (!shouldServeSearchFromEngine(args))
    return rerouteToCli("searchCommits", "searchShape", cliRead);
  const addon = provider();
  if (addon === null) return cliRead();
  // The CLI clamps before building `--max-count`; the engine is given the same
  // clamped number so both page identically.
  const maxResults = normalizeMaxResults(args.maxResults);
  // An empty query is not a search on either backend.
  if (args.query.trim() === "") return { results: [], error: null };
  try {
    const parsed = parseEngineSearchResults(
      await addon.searchCommits(args.repoPath, buildSearchOptions(args, maxResults))
    );
    if (parsed === null) {
      engineFailedRead = true;
      return rerouteToCli("searchCommits", "malformedPayload", cliRead);
    }
    engineServedRead = true;
    return { results: mapEngineSearchResults(parsed), error: null };
  } catch (error: unknown) {
    if (!noteEngineThrow(error, "searchCommits")) {
      return { results: [], error: toGitQueryError(error, "Unable to search commits") };
    }
    return cliRead();
  }
}
