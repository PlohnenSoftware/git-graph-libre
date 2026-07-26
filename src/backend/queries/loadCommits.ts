import type { SimpleGit } from "simple-git";

import type {
  CommitOrdering,
  DateType,
  GitCommitSignature,
  GitCommitNode,
  GitLogEntry,
  GitQueryError,
  GitRefData,
  QueryResult
} from "@/backend/types";
import { type GitCommandRecorder, runGitCommand, runGitRaw } from "@/backend/utils/gitRunner";
import { authorArgs, selectedLogRefs } from "@/backend/utils/logFilters";
import { toGitQueryError } from "@/backend/utils/queryError";
import { isHiddenRemoteRef, remoteExcludeArgs } from "@/backend/utils/remoteRefs";

const eolRegex = /\r\n|\r|\n/g;
const gitLogFormatFieldSeparator = "%x00";
const gitLogOutputFieldSeparator = "\0";
const gitLogBaseFieldCount = 6;
const gitLogSignatureFieldCount = 3;
const gitRefFormatFieldSeparator = "%00";
const gitRefOutputFieldSeparator = "\0";
const gitRefFieldCount = 3;
const gitCommitSignatureStatuses: Readonly<Record<string, GitCommitSignature["status"]>> = {
  G: "valid",
  U: "valid-untrusted",
  B: "bad",
  X: "expired",
  Y: "expired-key",
  R: "revoked-key",
  E: "unverifiable"
};

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
  onlyFollowFirstParent?: boolean;
  commitOrdering?: CommitOrdering;
  showSignature?: boolean;
  hard: boolean;
  dateType: DateType;
  showUncommittedChanges: boolean;
  repo?: string | null;
  recordGitCommand?: GitCommandRecorder;
};

type GitQueryContext = {
  repo: string | null;
  record?: GitCommandRecorder;
};

type GitLogOptions = {
  refs: string[] | null;
  authors: string[] | null;
  maxCommits: number;
  showRemoteBranches: boolean;
  hiddenRemotes?: string[];
  showTags: boolean;
  includeReflog: boolean;
  onlyFollowFirstParent: boolean;
  dateType: DateType;
  commitOrdering: CommitOrdering;
  showSignature: boolean;
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
    peeledHash: fields[2] ?? ""
  };
}

export function parseCommitSignature(
  status: string,
  signer: string,
  key: string
): GitCommitSignature | null {
  if (status === "" || status === "N") return null;

  return {
    status: gitCommitSignatureStatuses[status] ?? "unknown",
    signer: signer || null,
    key: key || null
  };
}

async function getRefs(
  git: SimpleGit,
  showRemoteBranches: boolean,
  hiddenRemotes: string[] | undefined,
  showTags: boolean,
  context: GitQueryContext
): Promise<QueryValue<GitRefData>> {
  try {
    const refsArgs = [
      "for-each-ref",
      `--format=%(objectname)${gitRefFormatFieldSeparator}%(refname)${gitRefFormatFieldSeparator}%(*objectname)`,
      "refs/heads"
    ];
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
    const refData: GitRefData = { head: null, refs: [] };
    refData.head = headStdout.trim() || null;
    const lines = refsStdout.split(eolRegex);
    for (const line of lines) {
      if (line === "") continue;
      const refRecord = parseRefRecord(line);
      if (refRecord === null) continue;
      const { objectHash, refName, peeledHash } = refRecord;
      if (refName.startsWith("refs/heads/")) {
        refData.refs.push({ hash: objectHash, name: refName.substring(11), type: "head" });
      } else if (refName.startsWith("refs/tags/")) {
        refData.refs.push({
          hash: peeledHash || objectHash,
          name: refName.substring(10),
          type: "tag"
        });
      } else if (refName.startsWith("refs/remotes/")) {
        if (isHiddenRemoteRef(refName, hiddenRemotes)) continue;
        refData.refs.push({ hash: objectHash, name: refName.substring(13), type: "remote" });
      }
    }
    return { value: refData, error: null };
  } catch (error: unknown) {
    return {
      value: { head: null, refs: [] },
      error: toGitQueryError(error, "Unable to load refs")
    };
  }
}

function buildLogFormat(dateType: DateType, showSignature: boolean): string {
  const dateField = dateType === "Author Date" ? "%at" : "%ct";
  const formatFields = ["%H", "%P", "%an", "%ae", dateField, "%s"];
  if (showSignature) formatFields.push("%G?", "%GS", "%GK");
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
  onlyFollowFirstParent,
  dateType,
  commitOrdering,
  showSignature
}: GitLogOptions): string[] {
  const args = [
    "log",
    "-z",
    `--max-count=${maxCommits}`,
    `--format=${buildLogFormat(dateType, showSignature)}`,
    `--${commitOrdering}-order`
  ];
  if (onlyFollowFirstParent) args.push("--first-parent");
  args.push(...authorArgs(authors));
  if (refs !== null) {
    args.push(...refs);
    return args;
  }
  args.push("--branches");
  if (showTags) args.push("--tags");
  if (includeReflog) args.push("--reflog");
  if (showRemoteBranches) args.push(...remoteExcludeArgs(hiddenRemotes), "--remotes");
  return args;
}

function parseLogEntries(stdout: string, showSignature: boolean): GitLogEntry[] {
  const fields = stdout.split(gitLogOutputFieldSeparator);
  if (fields.at(-1) === "") fields.pop();
  const fieldCount = gitLogBaseFieldCount + (showSignature ? gitLogSignatureFieldCount : 0);
  const commits: GitLogEntry[] = [];
  for (let i = 0; i + fieldCount - 1 < fields.length; i += fieldCount) {
    const commit: GitLogEntry = {
      hash: fields[i],
      parentHashes: fields[i + 1].split(" "),
      author: fields[i + 2],
      email: fields[i + 3],
      date: Number.parseInt(fields[i + 4], 10),
      message: fields[i + 5]
    };
    if (showSignature) {
      commit.signature = parseCommitSignature(
        fields[i + gitLogBaseFieldCount],
        fields[i + gitLogBaseFieldCount + 1],
        fields[i + gitLogBaseFieldCount + 2]
      );
    }
    commits.push(commit);
  }
  return commits;
}

async function getLog(
  git: SimpleGit,
  options: GitLogOptions
): Promise<QueryValue<GitLogEntry[]>> {
  try {
    const stdout = await runGitRaw(git, {
      label: "loadCommits.log",
      args: [...buildLogArgs(options), "--"],
      repo: options.context.repo,
      record: options.context.record
    });
    return { value: parseLogEntries(stdout, options.showSignature), error: null };
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
      refs: [],
      ...(commits[i].signature === undefined ? {} : { signature: commits[i].signature })
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
  const onlyFollowFirstParent = input.onlyFollowFirstParent === true;
  const commitOrdering = input.commitOrdering ?? "date";
  const showSignature = input.showSignature === true;
  const context = { repo: input.repo ?? null, record: input.recordGitCommand };

  const [logResult, refsResult] = await Promise.all([
    getLog(git, {
      refs,
      authors: input.authors ?? null,
      maxCommits: maxCommits + 1,
      showRemoteBranches,
      hiddenRemotes,
      showTags,
      includeReflog,
      onlyFollowFirstParent,
      dateType,
      commitOrdering,
      showSignature,
      context
    }),
    getRefs(git, showRemoteBranches, hiddenRemotes, showTags || selectedTags !== null, context)
  ]);
  const rawCommits = logResult.value;
  const refData = refsResult.value;
  const error = logResult.error ?? refsResult.error;

  let commits = rawCommits;
  const moreCommitsAvailable = commits.length === maxCommits + 1;
  if (moreCommitsAvailable) commits = commits.slice(0, -1);

  await addUnsavedChangesCommit(git, commits, refData, showUncommittedChanges, context);
  const commitNodes = createCommitNodes(commits, refData);

  return { commits: commitNodes, head: refData.head, moreCommitsAvailable, hard, error };
}
