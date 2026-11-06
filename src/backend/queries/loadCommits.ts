import type { SimpleGit } from "simple-git";

import type {
  CommitOrdering,
  DateType,
  GitCommitNode,
  GitLogEntry,
  GitQueryError,
  GitRef,
  GitRefData,
  GitStash,
  QueryResult
} from "@/backend/types";
import { type GitCommandRecorder, runGitCommand, runGitRaw } from "@/backend/utils/gitRunner";
import { authorArgs, selectedLogRefs } from "@/backend/utils/logFilters";
import { toGitQueryError } from "@/backend/utils/queryError";
import { isHiddenRemoteRef, remoteExcludeArgs } from "@/backend/utils/remoteRefs";

import { loadStashes } from "./stashes";
import { loadWorktrees } from "./worktrees";

const eolRegex = /\r\n|\r|\n/g;
const gitLogFormatFieldSeparator = "%x00";
const gitLogOutputFieldSeparator = "\0";
const gitLogBaseFieldCount = 6;
const gitRefFormatFieldSeparator = "%00";
const gitRefOutputFieldSeparator = "\0";
const gitRefFieldCount = 5;
export const gitRefSignedMarker = "1";
/**
 * Collapses the multi-line `%(contents:signature)` block into a single token so
 * one ref still occupies exactly one output line. Shared with the engine
 * seam's signed-tag fill, so both scans classify signatures identically.
 */
export const gitRefSignatureAtom = `%(if)%(contents:signature)%(then)${gitRefSignedMarker}%(else)0%(end)`;
type LoadCommitsInput = {
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
  /** Opt-in per call; absent means no stash rows (existing callers unchanged). */
  showStashes?: boolean;
  hard: boolean;
  dateType: DateType;
  showUncommittedChanges: boolean;
  repo?: string | null;
  recordGitCommand?: GitCommandRecorder;
  /** Resolved git binary path, threaded from `config.gitPath()` (mirrors `loadBranches`). */
  gitPath?: string;
};

type GitQueryContext = {
  repo: string | null;
  record?: GitCommandRecorder;
};

type GitLogOptions = {
  label: string;
  refs: string[] | null;
  authors: string[] | null;
  maxCommits: number;
  showRemoteBranches: boolean;
  hiddenRemotes?: string[];
  showTags: boolean;
  includeReflog: boolean;
  additionalRefs: string[];
  onlyFollowFirstParent: boolean;
  dateType: DateType;
  commitOrdering: CommitOrdering;
  context: GitQueryContext;
};

type QueryValue<T> = {
  value: T;
  error: GitQueryError | null;
};

function parseRefRecord(line: string) {
  const fields = line.split(gitRefOutputFieldSeparator);
  if (fields.length < gitRefFieldCount || fields[0] === "" || fields[1] === "") return null;
  return {
    objectHash: fields[0],
    refName: fields[1],
    peeledHash: fields[2] ?? "",
    objectType: fields[3] ?? "",
    hasSignature: fields[4] === gitRefSignedMarker
  };
}

function buildRefFormat() {
  return [
    "%(objectname)",
    "%(refname)",
    "%(*objectname)",
    "%(objecttype)",
    gitRefSignatureAtom
  ].join(gitRefFormatFieldSeparator);
}

type ParsedRefRecord = NonNullable<ReturnType<typeof parseRefRecord>>;

const remoteRefPrefix = "refs/remotes/";
const remoteTagMarker = "/tags/";

/**
 * `refs/remotes/<remote>/tags/<tag>`, which a fetch refspec such as
 * `+refs/tags/*:refs/remotes/<remote>/tags/*` creates, as the tag name the
 * engine shows (`<remote>/<tag>`) and the bare `<tag>` it mirrors.
 */
function remoteTagNames(refName: string): { name: string; tag: string } | null {
  if (!refName.startsWith(remoteRefPrefix)) return null;
  const remoteRef = refName.substring(remoteRefPrefix.length);
  const markerIndex = remoteRef.indexOf(remoteTagMarker);
  if (markerIndex === -1) return null;
  const tag = remoteRef.substring(markerIndex + remoteTagMarker.length);
  return { name: `${remoteRef.substring(0, markerIndex)}/${tag}`, tag };
}

function toGitTagRef(record: ParsedRefRecord, name: string): GitRef {
  const { objectHash, peeledHash, objectType, hasSignature } = record;
  return {
    hash: peeledHash || objectHash,
    name,
    type: "tag",
    // Only an annotated tag has a tag object that can carry a signature.
    signed: objectType === "tag" && hasSignature
  };
}

/**
 * Maps one `for-each-ref` record. `localTagObjects` holds each local tag's own
 * (unpeeled) object id: a remote-tracking tag that mirrors the same object is
 * dropped, since it would only add a second badge to the same commit. The
 * engine applies the same rule.
 */
export function toGitRef(
  record: ParsedRefRecord,
  hiddenRemotes: string[] | undefined,
  localTagObjects?: ReadonlyMap<string, string>
): GitRef | null {
  const { objectHash, refName } = record;
  if (refName.startsWith("refs/heads/")) {
    return { hash: objectHash, name: refName.substring(11), type: "head" };
  }
  if (refName.startsWith("refs/tags/")) {
    return toGitTagRef(record, refName.substring(10));
  }
  if (!refName.startsWith(remoteRefPrefix) || isHiddenRemoteRef(refName, hiddenRemotes)) {
    return null;
  }
  const remoteTag = remoteTagNames(refName);
  if (remoteTag === null) {
    return { hash: objectHash, name: refName.substring(13), type: "remote" };
  }
  if (localTagObjects?.get(remoteTag.tag) === objectHash) return null;
  return toGitTagRef(record, remoteTag.name);
}

function parseRefLines(
  stdout: string,
  hiddenRemotes: string[] | undefined,
  tagsScanned: boolean
): GitRef[] {
  const records: ParsedRefRecord[] = [];
  const localTagObjects = new Map<string, string>();
  for (const line of stdout.split(eolRegex)) {
    if (line === "") continue;
    const record = parseRefRecord(line);
    if (record === null) continue;
    records.push(record);
    if (record.refName.startsWith("refs/tags/")) {
      localTagObjects.set(record.refName.substring(10), record.objectHash);
    }
  }
  const refs: GitRef[] = [];
  for (const record of records) {
    // Without the tag scan the local tags are unknown, and the engine shows no
    // tags at all then, so neither backend shows a remote-tracking one.
    if (!tagsScanned && remoteTagNames(record.refName) !== null) continue;
    const ref = toGitRef(record, hiddenRemotes, localTagObjects);
    if (ref !== null) refs.push(ref);
  }
  return refs;
}

async function getRefs(
  git: SimpleGit,
  showRemoteBranches: boolean,
  hiddenRemotes: string[] | undefined,
  showTags: boolean,
  context: GitQueryContext
): Promise<QueryValue<GitRefData>> {
  try {
    const refsArgs = ["for-each-ref", `--format=${buildRefFormat()}`, "refs/heads"];
    if (showTags) refsArgs.push("refs/tags");
    if (showRemoteBranches) refsArgs.push("refs/remotes");
    const [headStdout, refsStdout] = await Promise.all([
      runGitRaw(git, {
        label: "loadCommits.head",
        args: ["rev-parse", "--verify", "HEAD"],
        repo: context.repo,
        record: context.record
      }),
      runGitRaw(git, {
        label: "loadCommits.refs",
        args: refsArgs,
        repo: context.repo,
        record: context.record
      })
    ]);
    return {
      value: {
        head: headStdout.trim() || null,
        refs: parseRefLines(refsStdout, hiddenRemotes, showTags)
      },
      error: null
    };
  } catch (error: unknown) {
    return {
      value: { head: null, refs: [] },
      error: toGitQueryError(error, "Unable to load refs")
    };
  }
}

/**
 * The fields of a graph row. Signature status (`%G?`) is deliberately not one
 * of them: verifying runs GPG per signed commit, so it is read separately by
 * `commitSignatures` and the page renders without waiting for it.
 */
function buildLogFormat(dateType: DateType): string {
  const dateField = dateType === "Author Date" ? "%at" : "%ct";
  const formatFields = ["%H", "%P", "%an", "%ae", dateField, "%s"];
  return formatFields.join(gitLogFormatFieldSeparator);
}

function buildLogArgs({
  refs,
  authors,
  maxCommits,
  showRemoteBranches,
  hiddenRemotes,
  showTags,
  includeReflog,
  additionalRefs,
  onlyFollowFirstParent,
  dateType,
  commitOrdering
}: GitLogOptions): string[] {
  const args = [
    "log",
    "-z",
    `--max-count=${maxCommits}`,
    `--format=${buildLogFormat(dateType)}`,
    `--${commitOrdering}-order`
  ];
  if (onlyFollowFirstParent) args.push("--first-parent");
  args.push(...authorArgs(authors));
  if (refs !== null) {
    args.push(...refs);
    return args;
  }
  args.push("--ignore-missing", "HEAD", "--branches");
  if (showTags) args.push("--tags");
  if (includeReflog) args.push("--reflog");
  if (showRemoteBranches) args.push(...remoteExcludeArgs(hiddenRemotes), "--remotes");
  args.push(...additionalRefs);
  return args;
}

export function parseUnreachableCommitHashes(stdout: string): string[] {
  const hashes = new Set<string>();
  for (const line of stdout.split(eolRegex)) {
    const fields = line.trim().split(" ");
    const isUnreachableCommit = fields[0] === "unreachable" && fields[1] === "commit";
    const isDanglingCommit = fields[0] === "dangling" && fields[1] === "commit";
    const hash = fields[2];
    if ((isUnreachableCommit || isDanglingCommit) && hash !== undefined) {
      hashes.add(hash);
    }
  }
  return [...hashes];
}

/**
 * The HEAD commits of the other worktrees with a detached HEAD, as extra log
 * tips on a show-all load. A worktree on a branch needs none: `--branches`
 * already walks from that branch. A detached HEAD on a commit no branch,
 * tag or remote reaches is named by no ref the log starts from, so without
 * its hash as a tip that worktree's commit is never drawn (W12, Y22: always
 * shown). Filtered loads (explicit refs) get no extra tips, as with
 * unreachable commits.
 *
 * A failed worktree read resolves to no tips rather than a failed graph:
 * the worktree list is also read by `loadBranches`, which surfaces its own
 * state, and losing the whole graph over rows it could not add would be
 * the wrong trade (the stash-row precedent below).
 */
async function getOtherWorktreeHeadTips(
  git: SimpleGit,
  refs: string[] | null,
  context: GitQueryContext
): Promise<string[]> {
  if (refs !== null || context.repo === null) return [];
  const result = await loadWorktrees(git, context.repo, context.record);
  if (result.error !== null) return [];
  const heads = new Set<string>();
  for (const worktree of result.value) {
    if (!worktree.isCurrent && worktree.detached && worktree.head !== null) {
      heads.add(worktree.head);
    }
  }
  return [...heads];
}

async function getUnreachableCommitHashes(
  git: SimpleGit,
  enabled: boolean,
  refs: string[] | null,
  context: GitQueryContext
): Promise<QueryValue<string[]>> {
  if (!enabled || refs !== null) return { value: [], error: null };

  try {
    const stdout = await runGitRaw(git, {
      label: "loadCommits.unreachable",
      args: ["fsck", "--unreachable", "--no-reflogs", "--no-progress", "--connectivity-only"],
      repo: context.repo,
      record: context.record
    });
    return { value: parseUnreachableCommitHashes(stdout), error: null };
  } catch (error: unknown) {
    return {
      value: [],
      error: toGitQueryError(error, "Unable to discover unreachable commits")
    };
  }
}

function parseLogEntries(stdout: string): GitLogEntry[] {
  const fields = stdout.split(gitLogOutputFieldSeparator);
  if (fields.at(-1) === "") fields.pop();
  const commits: GitLogEntry[] = [];
  for (let i = 0; i + gitLogBaseFieldCount - 1 < fields.length; i += gitLogBaseFieldCount) {
    commits.push({
      hash: fields[i],
      parentHashes: fields[i + 1].split(" "),
      author: fields[i + 2],
      email: fields[i + 3],
      date: Number.parseInt(fields[i + 4], 10),
      message: fields[i + 5]
    });
  }
  return commits;
}

async function getLog(git: SimpleGit, options: GitLogOptions): Promise<QueryValue<GitLogEntry[]>> {
  try {
    const stdout = await runGitRaw(git, {
      label: options.label,
      args: [...buildLogArgs(options), "--"],
      repo: options.context.repo,
      record: options.context.record
    });
    return { value: parseLogEntries(stdout), error: null };
  } catch (error: unknown) {
    return { value: [], error: toGitQueryError(error, "Unable to load commits") };
  }
}

async function getUnsavedChanges(git: SimpleGit, context: GitQueryContext) {
  try {
    const status = await runGitCommand(() => git.status(), {
      label: "loadCommits.status",
      args: ["status"],
      repo: context.repo,
      record: context.record
    });
    if (status.files.length === 0) return null;
    return { branch: status.current ?? "HEAD", changes: status.files.length };
  } catch {
    return null;
  }
}

function hasLoadedHead(commits: GitLogEntry[], head: string | null) {
  return head !== null && commits.some((commit) => commit.hash === head);
}

function moveHeadIntoPage(commits: GitLogEntry[], head: string, maxCommits: number) {
  const headIndex = commits.findIndex((commit) => commit.hash === head);
  if (headIndex < maxCommits) return commits;
  const headCommit = commits[headIndex];
  if (headCommit === undefined) return commits;
  return [headCommit, ...commits.slice(0, headIndex), ...commits.slice(headIndex + 1)];
}

async function addUnsavedChangesCommit(
  git: SimpleGit,
  commits: GitLogEntry[],
  refData: GitRefData,
  showUncommittedChanges: boolean,
  context: GitQueryContext
) {
  if (!showUncommittedChanges || !hasLoadedHead(commits, refData.head)) return;

  const unsaved = await getUnsavedChanges(git, context);
  if (unsaved === null || refData.head === null) return;

  commits.unshift({
    hash: "*",
    parentHashes: [refData.head],
    author: "*",
    email: "",
    date: Math.round(Date.now() / 1000),
    message: `Uncommitted Changes (${unsaved.changes})`
  });
}

function createCommitNodes(commits: GitLogEntry[], refData: GitRefData) {
  const commitNodes: GitCommitNode[] = [];
  const commitLookup: Record<string, number> = {};

  for (let i = 0; i < commits.length; i++) {
    commitLookup[commits[i].hash] = i;
    commitNodes.push({
      hash: commits[i].hash,
      parentHashes: commits[i].parentHashes,
      author: commits[i].author,
      email: commits[i].email,
      date: commits[i].date,
      message: commits[i].message,
      refs: []
    });
  }

  for (const ref of refData.refs) {
    const commitIndex = commitLookup[ref.hash];
    if (typeof commitIndex === "number") {
      commitNodes[commitIndex].refs.push(ref);
    }
  }

  return commitNodes;
}

export async function loadCommits(
  git: SimpleGit,
  input: LoadCommitsInput
): Promise<QueryResult<"loadCommits">> {
  const { maxCommits, showRemoteBranches, hard, dateType, showUncommittedChanges } = input;
  const hiddenRemotes = input.hiddenRemotes;
  const showTags = input.showTags !== false;
  const selectedTags = input.tags ?? null;
  const refs = selectedLogRefs({
    branches: input.branches,
    legacyBranchName: input.branchName,
    tags: selectedTags
  });
  const includeReflog = input.includeReflog === true;
  const includeUnreachableCommits = input.includeUnreachableCommits === true;
  const onlyFollowFirstParent = input.onlyFollowFirstParent === true;
  const commitOrdering = input.commitOrdering ?? "date";
  const context = { repo: input.repo ?? null, record: input.recordGitCommand };

  const refsPromise = getRefs(
    git,
    showRemoteBranches,
    hiddenRemotes,
    showTags || selectedTags !== null,
    context
  );
  const [unreachableResult, worktreeHeadTips] = await Promise.all([
    getUnreachableCommitHashes(git, includeUnreachableCommits, refs, context),
    getOtherWorktreeHeadTips(git, refs, context)
  ]);
  const sharedLogOptions = {
    authors: input.authors ?? null,
    showRemoteBranches,
    hiddenRemotes,
    showTags,
    includeReflog,
    onlyFollowFirstParent,
    dateType,
    commitOrdering,
    context
  };
  const [logResult, refsResult] = await Promise.all([
    getLog(git, {
      ...sharedLogOptions,
      label: "loadCommits.log",
      refs,
      maxCommits: maxCommits + 1,
      additionalRefs: [...unreachableResult.value, ...worktreeHeadTips]
    }),
    refsPromise
  ]);
  const refData = refsResult.value;
  let rawCommits = logResult.value;
  let detachedHeadError: GitQueryError | null = null;
  if (refs === null && refData.head !== null) {
    if (!hasLoadedHead(rawCommits, refData.head)) {
      const detachedHeadResult = await getLog(git, {
        ...sharedLogOptions,
        label: "loadCommits.detachedHead",
        refs: ["HEAD"],
        maxCommits: 1,
        additionalRefs: []
      });
      const detachedHead = detachedHeadResult.value[0];
      if (detachedHead !== undefined) rawCommits = [detachedHead, ...rawCommits];
      detachedHeadError = detachedHeadResult.error;
    }
    rawCommits = moveHeadIntoPage(rawCommits, refData.head, maxCommits);
  }
  const error = logResult.error ?? refsResult.error ?? unreachableResult.error ?? detachedHeadError;

  let commits = rawCommits;
  const moreCommitsAvailable = commits.length > maxCommits;
  if (moreCommitsAvailable) commits = commits.slice(0, maxCommits);

  await addUnsavedChangesCommit(git, commits, refData, showUncommittedChanges, context);
  const commitNodes = createCommitNodes(commits, refData);
  const stashNodes = await loadStashGraphNodes(git, input, context);
  const nodesWithStashes = insertStashNodes(commitNodes, stashNodes);

  return {
    commits: nodesWithStashes,
    head: refData.head,
    moreCommitsAvailable,
    hard,
    error
  };
}

/**
 * Loads the stashes backing the graph stash rows, or nothing when the caller
 * did not opt in. A stash-query failure resolves to no rows rather than a
 * failed graph: the stash list panel reports stash errors through its own
 * `loadRepoInfo` load, and losing the whole graph over a pendant row would be
 * the wrong trade.
 */
async function loadStashGraphNodes(
  git: SimpleGit,
  input: LoadCommitsInput,
  context: GitQueryContext
): Promise<GitStash[]> {
  if (input.showStashes !== true) return [];
  const result = await loadStashes(git, context, "loadCommits.stashes");
  return result.value;
}

/**
 * Inserts one synthetic row per stash directly above its base commit, so the
 * layout engine draws each stash as a pendant of the commit it was taken
 * from. The rows must precede the base: the layout walker only follows
 * parents forward (children above parents), so a stash placed after its base
 * would never resolve its parent and the layout would loop forever.
 * Stashes whose base is not on the page (filtered out or beyond the load
 * budget) are skipped, and injection runs after paging so stash rows never
 * consume the commit budget.
 *
 * Only the base commit (parent 0) is linked. A stash commit carries one or
 * two further parents — the index state, plus the untracked-files commit when
 * taken with `--include-untracked` — and linking those would draw phantom
 * lines per stash while promoting internal commits to ordinary table rows.
 */
function insertStashNodes(commitNodes: GitCommitNode[], stashes: GitStash[]): GitCommitNode[] {
  if (stashes.length === 0) return commitNodes;
  const stashesByBase = new Map<string, GitStash[]>();
  for (const stash of stashes) {
    if (stash.sourceHash === null) continue;
    const group = stashesByBase.get(stash.sourceHash) ?? [];
    group.push(stash);
    stashesByBase.set(stash.sourceHash, group);
  }
  if (stashesByBase.size === 0) return commitNodes;

  const nodes: GitCommitNode[] = [];
  for (const node of commitNodes) {
    for (const stash of stashesByBase.get(node.hash) ?? []) {
      nodes.push({
        hash: stash.hash,
        parentHashes: [node.hash],
        author: "",
        email: "",
        date: stash.date ?? node.date,
        message: stash.message,
        refs: [],
        signature: null,
        stash: { ref: stash.ref }
      });
    }
    nodes.push(node);
  }
  return nodes;
}
