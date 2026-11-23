import type {
  DateType,
  GitCommitDetails,
  GitCommitNode,
  GitCommitSearchResult,
  GitCommitSignature,
  GitLogEntry,
  GitRepoInfo,
  GitTagDetails,
  GitUncommittedChanges,
  GitWorktree
} from "./git.types";

export const COMMIT_ORDERINGS = ["date", "author-date", "topo"] as const;
export type CommitOrdering = (typeof COMMIT_ORDERINGS)[number];

export type GitQueryError = {
  message: string;
  stderr: string | null;
  exitCode: number | null;
  task: string | null;
};

type CommitDetailsResult = {
  commitDetails: GitCommitDetails | null;
  error: GitQueryError | null;
};

type LoadBranchesResult = {
  branches: string[];
  head: string | null;
  hard: boolean;
  isRepo: boolean;
  error: GitQueryError | null;
  /** Every worktree, in Git's order. Empty when the list could not be read (logged, never an error). */
  worktrees: GitWorktree[];
  /** Local branch to the short name of its upstream, or null when it tracks nothing. */
  upstreams: Record<string, string | null>;
};

type LoadCommitsResult = {
  commits: GitCommitNode[];
  head: string | null;
  moreCommitsAvailable: boolean;
  hard: boolean;
  error: GitQueryError | null;
};

type BranchPushDefaultsResult = {
  /** The remote the branch's upstream tracks, or null when it has no upstream. */
  upstreamRemote: string | null;
  /** The remote plain `git push` uses for the branch, or null when Git names none. */
  pushRemote: string | null;
  error: GitQueryError | null;
};

type CommitSignaturesResult = {
  /** Keyed by commit hash: the signature, or null for an unsigned commit. */
  signatures: Record<string, GitCommitSignature | null>;
  error: GitQueryError | null;
};

type LoadRepoInfoResult = {
  repoInfo: GitRepoInfo;
  error: GitQueryError | null;
};

type SearchCommitsResult = {
  results: GitCommitSearchResult[];
  error: GitQueryError | null;
};

type TagDetailsResult = {
  tagName: string;
  tagDetails: GitTagDetails | null;
  error: GitQueryError | null;
};

type UncommittedDetailsResult = {
  changes: GitUncommittedChanges | null;
  error: GitQueryError | null;
};

type WorktreeChangesResult = {
  /** The worktree that was read, as listed by Git. */
  path: string;
  /** Uncommitted and untracked paths, at most `MAX_WORKTREE_CHANGES` in the worktree actions. */
  files: string[];
  /** True when the worktree has more changes than `files` lists. */
  truncated: boolean;
  error: GitQueryError | null;
};

/**
 * Whether a linked worktree has uncommitted or untracked files: `unknown` when
 * the read failed or timed out, which is never shown as `clean`.
 */
export type WorktreeChangeStatus = {
  state: "clean" | "dirty" | "unknown";
  /** The changed paths counted, at most the worktree actions' path limit; zero unless dirty. */
  count: number;
  /** True when the worktree has more changes than `count` counts. */
  truncated: boolean;
};

type QueryPayloads = {
  worktreeStatus: {
    request: { requestId: number; repo: string; paths: string[] };
    result: { statuses: Record<string, WorktreeChangeStatus> };
    /** Keyed by each requested path as it was sent; `repo` lets the webview drop an answer for another repository. */
    response: { requestId: number; repo: string } & {
      statuses: Record<string, WorktreeChangeStatus>;
    };
  };
  worktreeChanges: {
    request: { requestId: number; repo: string; path: string };
    result: WorktreeChangesResult;
    response: { requestId: number } & WorktreeChangesResult;
  };
  remoteTags: {
    request: { requestId: number; repo: string };
    result: {
      tags: Record<string, { hash: string; remotes: string[] }>;
      unavailableRemotes: string[];
      error: GitQueryError | null;
    };
    response: { requestId: number; repo: string } & QueryPayloads["remoteTags"]["result"];
  };
  branchPushDefaults: {
    request: { requestId: number; repo: string; branch: string };
    result: BranchPushDefaultsResult;
    response: { requestId: number } & BranchPushDefaultsResult;
  };
  commitDetails: {
    request: { repo: string; commitHash: string };
    result: CommitDetailsResult;
    response: CommitDetailsResult;
  };
  commitSignatures: {
    request: { requestId: number; repo: string; hashes: string[] };
    result: CommitSignaturesResult;
    /** `repo` comes back so an answer for a repository no longer shown is dropped. */
    response: { requestId: number; repo: string } & CommitSignaturesResult;
  };
  commitComparison: {
    request: { repo: string; commitHash: string; baseRef: string; compareRef: string };
    result: CommitDetailsResult;
    response: CommitDetailsResult;
  };
  loadBranches: {
    request: {
      requestId: number;
      showRemoteBranches: boolean;
      hiddenRemotes?: string[];
      hard: boolean;
    };
    result: LoadBranchesResult;
    response: { requestId: number } & LoadBranchesResult;
  };
  loadCommits: {
    request: {
      requestId: number;
      repo: string;
      branchName: string;
      branches?: string[] | null;
      authors?: string[] | null;
      tags?: string[] | null;
      maxCommits: number;
      showRemoteBranches: boolean;
      hiddenRemotes?: string[];
      showTags: boolean;
      includeReflog: boolean;
      includeUnreachableCommits: boolean;
      onlyFollowFirstParent: boolean;
      commitOrdering: CommitOrdering;
      showStashes?: boolean;
      hard: boolean;
      /** Serve this one load with the Git CLI whatever the backend setting says. */
      forceCli?: boolean;
    };
    result: LoadCommitsResult;
    response: { requestId: number } & LoadCommitsResult;
  };
  loadRepoInfo: {
    request: { requestId: number; repo: string; showStashes: boolean; forceCli?: boolean };
    result: LoadRepoInfoResult;
    response: { requestId: number } & LoadRepoInfoResult;
  };
  searchCommits: {
    request: {
      requestId: number;
      repo: string;
      query: string;
      maxResults: number;
      showRemoteBranches: boolean;
      hiddenRemotes?: string[];
      showTags: boolean;
      branches?: string[] | null;
      authors?: string[] | null;
      tags?: string[] | null;
    };
    result: SearchCommitsResult;
    response: { requestId: number } & SearchCommitsResult;
  };
  tagDetails: {
    request: { repo: string; tagName: string };
    result: TagDetailsResult;
    response: TagDetailsResult;
  };
  uncommittedDetails: {
    request: { repo: string };
    result: UncommittedDetailsResult;
    response: UncommittedDetailsResult;
  };
  rebaseRange: {
    /**
     * `base` is the exclusive start of the range (`base..HEAD`); `null` asks
     * for the whole history up to `HEAD`, root commit included (the read
     * behind `git rebase -i --root`).
     */
    request: { requestId: number; repo: string; base: string | null };
    result: GitRebaseRangeResult;
    /** `repo` comes back so an answer for a repository no longer shown is dropped. */
    response: { requestId: number; repo: string } & GitRebaseRangeResult;
  };
  fileHistory: {
    request: {
      requestId: number;
      repo: string;
      filePath: string;
      maxResults?: number;
      follow?: boolean;
    };
    result: GitFileHistoryResult;
    /** `repo` comes back so an answer for a repository no longer shown is dropped. */
    response: { requestId: number; repo: string } & GitFileHistoryResult;
  };
  rebasePrediction: {
    request: {
      requestId: number;
      repo: string;
      base: string | null;
      entries: GitRebasePredictionEntry[];
    };
    result: GitRebasePredictionResult;
    /** `repo` comes back so an answer for a repository no longer shown is dropped. */
    response: { requestId: number; repo: string } & GitRebasePredictionResult;
  };
  operationState: {
    request: { requestId: number; repo: string };
    result: GitOperationStateResult;
    /** `repo` comes back so an answer for a repository no longer shown is dropped. */
    response: { requestId: number; repo: string } & GitOperationStateResult;
  };
  /** Staged file count and target commit message for the Create Fixup/Squash/Reword dialog (F2-06). */
  fixupDialogInfo: {
    request: { requestId: number; repo: string; target: string };
    result: GitFixupDialogInfoResult;
    /** `repo` comes back so an answer for a repository no longer shown is dropped. */
    response: { requestId: number; repo: string } & GitFixupDialogInfoResult;
  };
};

export type QueryRequest = {
  [K in keyof QueryPayloads]: { command: K } & QueryPayloads[K]["request"];
}[keyof QueryPayloads];

export type QueryResponse = {
  [K in keyof QueryPayloads]: { command: K } & QueryPayloads[K]["response"];
}[keyof QueryPayloads];

export type QueryResult<T extends keyof QueryPayloads> = QueryPayloads[T]["result"];

/** One reflog entry: the move a ref made, as Git recorded it. */
export type GitReflogEntry = {
  /** The commit the ref pointed at after the move. */
  hash: string;
  /** The `N` of `<ref>@{N}`. Git skips some entries when it numbers them, so these can have gaps. */
  index: number;
  /** When the entry was written, in Unix seconds. This is not the commit's own date. */
  time: number;
  /** Who made the entry (the committer identity Git used at the time). */
  name: string;
  email: string;
  /** The message exactly as Git wrote it, for example `commit: fix typo`. */
  message: string;
};

/**
 * What a reflog holds: `entries` (the page has entries, or lies past the end
 * of a reflog that has some), `empty` (a reflog exists but holds nothing) or
 * `none` (the ref keeps no reflog).
 */
export type GitReflogState = "entries" | "empty" | "none";

export type GitReflogResult = {
  /** The requested page, newest first. Empty on an error. */
  entries: GitReflogEntry[];
  /** Null exactly when `error` is set. */
  state: GitReflogState | null;
  /** True when older entries exist beyond this page. */
  hasMore: boolean;
  /** The ref's full name, such as `refs/heads/main`, or `HEAD`. Null on an error. */
  ref: string | null;
  error: GitQueryError | null;
};

/**
 * Whether the commit a reflog entry points at can still be reached without
 * the reflog: `reachable` from a branch, tag or remote-tracking ref,
 * `reflogOnly` when the object exists but only reflogs reach it, or
 * `missing` when the object no longer exists.
 */
export type GitReflogEntryState = "reachable" | "reflogOnly" | "missing";

export type GitReflogEntryStatesResult = {
  /**
   * The known state of each requested commit, by hash. A hash with no entry
   * is unknown: the read failed, or the name was not a commit's full hash.
   * Empty whenever `error` is set.
   */
  states: Record<string, GitReflogEntryState>;
  error: GitQueryError | null;
};

/** The kinds `classifyReflogMessage` knows. The set is open: treat any other value as `other`. */
export type GitReflogMessageKind =
  | "commit"
  | "checkout"
  | "reset"
  | "rebase"
  | "merge"
  | "pull"
  | "fetch"
  | "cherry-pick"
  | "revert"
  | "branch"
  | "stash"
  | "clone"
  | "other";

export type GitReflogMessageClass = {
  kind: GitReflogMessageKind;
  /** The detail, such as `pick` for `rebase (pick)` or `amend` for `commit (amend)`; null when none. */
  sub: string | null;
  /** The message, unchanged. */
  raw: string;
};

/**
 * One blame read: a repository-relative file, blamed at `rev` (a branch, tag,
 * hash or revision expression such as `HEAD~2`), in the working tree when
 * `rev` is null or absent, or against the unsaved editor text in `contents`.
 * Read by `loadBlame` in `src/backend/queries/blame.ts`.
 */
export type GitBlameRequest = {
  /** The file to blame, relative to the repository root (`src/app.ts`). */
  filePath: string;
  /**
   * The revision to blame at. Null or absent blames the working tree — or,
   * when `contents` is given, the buffer against `HEAD`.
   */
  rev?: string | null;
  /**
   * Unsaved editor text, blamed through `git blame --contents -` so line
   * numbers match the editor. Needs `binary` (the resolved Git path).
   */
  contents?: string;
  /** Pass `-w`: ignore whitespace when comparing parent and child. */
  ignoreWhitespace?: boolean;
  /** Pass `-M`: detect lines moved or copied within the same file. */
  detectMoves?: boolean;
  /** Pass `-C`: like `detectMoves`, plus files changed in the same commit. */
  detectCopies?: boolean;
  /**
   * A `--ignore-revs-file` path (repository-relative or absolute), or null to
   * pass no file. Absent likewise passes none; Git's own
   * `blame.ignoreRevsFile` configuration then still applies.
   */
  ignoreRevsFile?: string | null;
  /** Revisions to skip, one `--ignore-rev` each. */
  ignoreRevs?: string[];
  /** The resolved Git binary path, required when `contents` is given. */
  binary?: string;
};

/** One commit blame attributes lines to, keyed by `hash` in the result. */
export type GitBlameCommit = {
  /** The full 40/64-hex commit hash; all zeros for uncommitted lines. */
  hash: string;
  author: string;
  /** The author email, without the angle brackets porcelain wraps it in. */
  authorMail: string;
  /** When the change was authored, in Unix seconds. */
  authorTime: number;
  /** The author's time zone as Git wrote it, such as `+0200`. */
  authorTz: string;
  committer: string;
  /** The committer email, without angle brackets. */
  committerMail: string;
  /** When the commit was made, in Unix seconds. */
  committerTime: number;
  committerTz: string;
  /** The commit subject (the first line of its message). */
  summary: string;
  /** True for a root commit (porcelain `boundary`): blame cannot go earlier. */
  boundary: boolean;
  /** True for the all-zero OID Git blames working-tree and buffer lines on. */
  uncommitted: boolean;
  /**
   * Where this commit's lines lived just before it: the parent commit to
   * re-blame and the file's path there (porcelain `previous`). Null on a
   * boundary commit. First seen wins; each hunk carries its own `previous`,
   * which is the one to follow when they differ.
   */
  previous: { hash: string; path: string } | null;
  /**
   * The path this commit's lines came from (porcelain `filename`), which an
   * earlier rename or a `-C` copy can make differ from the blamed file.
   * First seen wins, as with `previous`.
   */
  filename: string;
};

/** One blamed line of the file. */
export type GitBlameLine = {
  /** The 1-based line number in the blamed file. */
  finalLine: number;
  /** The 1-based line number in the file the line originated in. */
  origLine: number;
  /** The line's text, without its line ending. */
  content: string;
};

/**
 * A run of consecutive lines from one commit and one origin file — the band
 * a blame view draws as one block. `lines` always covers `startLine` to
 * `startLine + lineCount - 1`, and `origStartLine` likewise, with no gaps.
 */
export type GitBlameHunk = {
  commitHash: string;
  /** The 1-based first line in the blamed file. */
  startLine: number;
  lineCount: number;
  /** The 1-based first line in the origin file. */
  origStartLine: number;
  /** The origin file these lines came from; see `GitBlameCommit.filename`. */
  filename: string;
  /** The parent blame target for this hunk; see `GitBlameCommit.previous`. */
  previous: { hash: string; path: string } | null;
  lines: GitBlameLine[];
};

/**
 * What a blame read found: `lines` (the file was blamed), `empty` (it has no
 * lines), `binary` or `tooLarge` (refused before blaming), `untracked` (the
 * file is not in `HEAD` yet) or `unborn` (the repository has no commit yet).
 */
export type GitBlameState = "lines" | "empty" | "binary" | "tooLarge" | "untracked" | "unborn";

export type GitBlameResult = {
  /** Null exactly when `error` is set. */
  state: GitBlameState | null;
  /** Every commit the hunks name, by hash. Empty unless `state` is `lines`. */
  commits: Record<string, GitBlameCommit>;
  /** The file's lines grouped into hunks, top to bottom. */
  hunks: GitBlameHunk[];
  /**
   * The commit OID `rev` resolved to, or null for a working-tree blame and
   * on any error.
   */
  resolvedRev: string | null;
  /**
   * The blamed line count. Exact for `lines` and `empty`; for `binary` and
   * `tooLarge` it is the count the pre-check computed, or 0 when the size
   * limit refused the file before its lines could be counted.
   */
  totalLines: number;
  /** The `--ignore-revs-file` the blame ran with, or null when it ran without one. */
  ignoreRevsFileUsed: string | null;
  error: GitQueryError | null;
};

/** One commit in the range an interactive rebase would rewrite. Ranges list these oldest first. */
export type GitRebaseRangeCommit = {
  /** Full hash. */
  hash: string;
  /** Full parent hashes, in Git's order; empty for a root commit. */
  parents: string[];
  author: string;
  email: string;
  subject: string;
  /** The message body after the subject, with trailing newlines trimmed; "" when there is none. */
  body: string;
  /** True when the commit has more than one parent. */
  isMerge: boolean;
  /**
   * True when the branch's upstream already reaches this commit. With no
   * upstream nothing is published (F2-07 decides how to show that).
   */
  isPublished: boolean;
};

/** An operation Git has in progress in the per-worktree git directory. */
export type GitRebaseOperation = "rebase" | "merge" | "cherry-pick" | "revert";

/**
 * Why an interactive rebase cannot start, as data. No message text travels
 * here; the surface that shows a reason words it (and localizes it) itself.
 */
export type RebasePreflightReason =
  | "inProgress"
  | "emptyRange"
  | "dirty"
  | "alreadyUsedElsewhere"
  | "readFailed";

/** The "can start?" answer for one range read: every reason that applies, in a stable order. */
export type GitRebasePreflight = {
  canStart: boolean;
  reasons: RebasePreflightReason[];
};

/**
 * Everything the interactive rebase editor needs before it opens: the commits
 * of `base..HEAD` (or the whole history for the root case) oldest first, the
 * facts Git itself would refuse on, and the preflight answer over them. On an
 * error the facts are at their empty values and `preflight` says `readFailed`.
 */
export type GitRebaseRangeResult = {
  commits: GitRebaseRangeCommit[];
  mergeCount: number;
  /**
   * Tracked changes Git refuses to rebase over: anything staged or unstaged.
   * Untracked files alone do not refuse a rebase, so they are not `dirty`.
   */
  dirty: boolean;
  /** True when untracked files are present, dirty or not. */
  hasUntracked: boolean;
  inProgress: boolean;
  /** Which operation is in progress; null exactly when `inProgress` is false. */
  inProgressKind: GitRebaseOperation | null;
  detached: boolean;
  /** The checked-out branch's short name; null when detached. */
  branch: string | null;
  /** The branch's upstream in short form (for example `origin/main`); null when it tracks nothing. */
  upstream: string | null;
  /**
   * Whether the checked-out branch is also checked out in another worktree.
   * `"unknown"` when the worktree list could not be read: never shown as false.
   */
  alreadyUsedElsewhere: boolean | "unknown";
  /** True when the range holds more than 500 commits. It prompts (F2-07); it never refuses. */
  tooLong: boolean;
  /**
   * Value of `git config --bool --get rebase.autoSquash` (`true`, `false`, or
   * `null` when unset). Drives the editor's autosquash switch default (F2-06).
   */
  autoSquash?: boolean | null;
  preflight: GitRebasePreflight;
  error: GitQueryError | null;
};

/**
 * One file-history read: commits touching a single repository-relative path
 * across all refs (`git log --all`), newest first.
 */
export type GitFileHistoryRequest = {
  /** The file to inspect, relative to the repository root (`src/app.ts`). */
  filePath: string;
  /**
   * Maximum commits to return, newest first. Defaults to
   * `DEFAULT_FILE_HISTORY_LIMIT` and caps at `MAX_FILE_HISTORY_LIMIT`.
   */
  limit?: number;
  /**
   * Whether to pass `--follow` so history continues beyond renames of this
   * single file. Defaults to `DEFAULT_FILE_HISTORY_FOLLOW` (`true`).
   */
  follow?: boolean;
  /** Which commit timestamp populates each entry's `date`. Defaults to `"Author Date"`. */
  dateType?: DateType;
  /**
   * When true, compute each commit's 1-based position (`loadCount`) in the
   * `--all --date-order` graph walk so the search list can load enough commits
   * to reveal any entry in the graph. Defaults to `false`.
   */
  includeLoadCount?: boolean;
};

/** One commit that touched the requested file. */
export type GitFileHistoryEntry = GitLogEntry & {
  /**
   * 1-based position in the `--all --date-order` graph walk when requested via
   * `includeLoadCount`, or null when omitted or not located.
   */
  loadCount: number | null;
};

export type GitFileHistoryResult = {
  /** Matching commits, newest first, at most the clamped limit. Empty on an error. */
  commits: GitFileHistoryEntry[];
  /** True when older matching commits exist beyond `commits`. */
  hasMore: boolean;
  /** Normalized repository-relative path that was read, or null on a validation error. */
  filePath: string | null;
  error: GitQueryError | null;
};

/** Staged count and target message read before opening a fixup/squash/reword dialog (F2-06). */
export type GitFixupDialogInfoResult = {
  stagedCount: number;
  targetSubject: string;
  targetMessage: string;
  error: GitQueryError | null;
};

/**
 * Why a rebase stopped, read from its state files and the unmerged paths:
 * unmerged paths are a conflict; the merge backend's `amend` file marks an
 * `edit` stop; anything else (a failed `exec` line, a todo Git refused, a
 * conflict since resolved) is `"other"` rather than a guess.
 */
export type GitRebaseStopReason = "edit" | "conflict" | "other";

/** Where an in-progress rebase stopped, as Git's per-worktree state files record it. */
export type GitRebaseState = {
  /** Which state directory holds the rebase: `rebase-merge` or `rebase-apply`. */
  backend: "merge" | "apply";
  /** Full hash of the commit the rebase stopped on; null when Git recorded none. */
  stoppedHash: string | null;
  /** Subject of the stopped commit; null when it names none or could not be read. */
  subject: string | null;
  /** The stopped step's 1-based position in the todo; null when unknown. */
  current: number | null;
  /** The todo's step count; null when unknown. */
  total: number | null;
  /** The branch being rebased, short name; null for a detached HEAD. */
  branch: string | null;
  /** Full hash the rebase is onto; null when Git recorded none. */
  onto: string | null;
  stopReason: GitRebaseStopReason;
};

/**
 * Present when a rebase completed (its state directory is gone) but reapplying
 * its autostash conflicted: unmerged paths remain and Git kept the autostash
 * entry in `refs/stash` (F2-07). Detected from the stash ref and unmerged
 * paths, never by parsing Git's message text.
 */
export type GitAutostashConflict = {
  /** The stash selector Git kept, typically `stash@{0}`. */
  stashSelector: string;
  /** Full hash of the kept autostash commit. */
  stashHash: string;
};

/**
 * The operation in progress in one worktree, read from the state files in its
 * own git directory (F2-03). `rebase` is non-null exactly when `kind` is
 * `"rebase"`. `conflictFiles` are the unmerged paths while a rebase is in
 * progress or an autostash pop conflicted, empty otherwise. `REBASE_HEAD` is
 * never evidence: it lingers after a successful rebase, so only the state
 * directories say one is under way.
 */
export type GitOperationStateResult = {
  kind: GitRebaseOperation | null;
  rebase: GitRebaseState | null;
  conflictFiles: string[];
  /** Present when an autostash pop conflicted after a completed rebase (F2-07). */
  autostashConflict?: GitAutostashConflict;
  error: GitQueryError | null;
};

/** One planned todo entry sent to conflict prediction (F2-08). */
export type GitRebasePredictionEntry = {
  readonly action: "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";
  readonly hash: string;
};

/**
 * Outcome of simulating a planned todo with `git merge-tree --write-tree` (F2-08).
 * - `"clean"`: every non-dropped step merged cleanly within the probe limit.
 * - `"capped"`: every probed step up to `probeLimit` merged cleanly, with more
 *   steps left unprobed.
 * - `"conflict"`: first conflicting step (`conflictHash`) and conflicted paths
 *   (`conflictFiles`).
 * - `"unavailable"`: Git is older than 2.40 (lacks `--write-tree` with
 *   `--merge-base`).
 * - `"error"`: invalid input or an unexpected Git failure (`error` is set).
 */
export type GitRebasePredictionStatus = "clean" | "capped" | "conflict" | "unavailable" | "error";

export type GitRebasePredictionResult = {
  status: GitRebasePredictionStatus;
  /** Full hash of the first conflicting commit when `status === "conflict"`; null otherwise. */
  conflictHash: string | null;
  /** Conflicted paths from `merge-tree -z` when `status === "conflict"`; empty otherwise. */
  conflictFiles: string[];
  /** Number of non-dropped steps simulated before finishing, conflicting, or hitting the cap. */
  probedCount: number;
  /** Total number of non-dropped steps in the todo. */
  totalSteps: number;
  /** Probe limit applied to this prediction run. */
  probeLimit: number;
  error: GitQueryError | null;
};
