import type { SimpleGit } from "simple-git";

import type {
  DateType,
  GitCommitNode,
  GitLogEntry,
  GitQueryError,
  GitRefData,
  QueryResult
} from "@/backend/types";
import { runGitCommand, runGitRaw, type GitCommandRecorder } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const eolRegex = /\r\n|\r|\n/g;
const gitLogFormatFieldSeparator = "%x00";
const gitLogOutputFieldSeparator = "\0";
const gitLogFieldCount = 6;

type LoadCommitsInput = {
  branchName: string;
  maxCommits: number;
  showRemoteBranches: boolean;
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

type QueryValue<T> = {
  value: T;
  error: GitQueryError | null;
};

async function getRefs(
  git: SimpleGit,
  showRemoteBranches: boolean,
  context: GitQueryContext
): Promise<QueryValue<GitRefData>> {
  try {
    const args = ["show-ref"];
    if (!showRemoteBranches) args.push("--heads", "--tags");
    args.push("-d", "--head");
    const stdout = await runGitRaw(git, {
      label: "loadCommits.refs",
      args,
      repo: context.repo,
      record: context.record
    });
    const refData: GitRefData = { head: null, refs: [] };
    const lines = stdout.split(eolRegex);
    for (let i = 0; i < lines.length - 1; i++) {
      const parts = lines[i].split(" ");
      if (parts.length < 2) continue;
      const hash = parts[0];
      const ref = parts.slice(1).join(" ");
      if (ref.startsWith("refs/heads/")) {
        refData.refs.push({ hash, name: ref.substring(11), type: "head" });
      } else if (ref.startsWith("refs/tags/")) {
        refData.refs.push({
          hash,
          name: ref.endsWith("^{}") ? ref.substring(10, ref.length - 3) : ref.substring(10),
          type: "tag"
        });
      } else if (ref.startsWith("refs/remotes/")) {
        refData.refs.push({ hash, name: ref.substring(13), type: "remote" });
      } else if (ref === "HEAD") {
        refData.head = hash;
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

async function getLog(
  git: SimpleGit,
  branch: string,
  maxCommits: number,
  showRemoteBranches: boolean,
  dateType: DateType,
  context: GitQueryContext
): Promise<QueryValue<GitLogEntry[]>> {
  const dateField = dateType === "Author Date" ? "%at" : "%ct";
  const format = ["%H", "%P", "%an", "%ae", dateField, "%s"].join(gitLogFormatFieldSeparator);
  const args = ["log", "-z", `--max-count=${maxCommits}`, `--format=${format}`, "--date-order"];
  if (branch !== "") {
    args.push(branch);
  } else {
    args.push("--branches", "--tags");
    if (showRemoteBranches) args.push("--remotes");
  }
  try {
    const stdout = await runGitRaw(git, {
      label: "loadCommits.log",
      args,
      repo: context.repo,
      record: context.record
    });
    const fields = stdout.split(gitLogOutputFieldSeparator);
    if (fields[fields.length - 1] === "") fields.pop();
    const commits: GitLogEntry[] = [];
    for (let i = 0; i + gitLogFieldCount - 1 < fields.length; i += gitLogFieldCount) {
      commits.push({
        hash: fields[i],
        parentHashes: fields[i + 1].split(" "),
        author: fields[i + 2],
        email: fields[i + 3],
        date: parseInt(fields[i + 4], 10),
        message: fields[i + 5]
      });
    }
    return { value: commits, error: null };
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

export async function loadCommits(
  git: SimpleGit,
  input: LoadCommitsInput
): Promise<QueryResult<"loadCommits">> {
  const { branchName, maxCommits, showRemoteBranches, hard, dateType, showUncommittedChanges } =
    input;
  const context = { repo: input.repo ?? null, record: input.recordGitCommand };

  const [logResult, refsResult] = await Promise.all([
    getLog(git, branchName, maxCommits + 1, showRemoteBranches, dateType, context),
    getRefs(git, showRemoteBranches, context)
  ]);
  const rawCommits = logResult.value;
  const refData = refsResult.value;
  const error = logResult.error ?? refsResult.error;

  let commits = rawCommits;
  const moreCommitsAvailable = commits.length === maxCommits + 1;
  if (moreCommitsAvailable) commits = commits.slice(0, -1);

  if (refData.head !== null) {
    for (let i = 0; i < commits.length; i++) {
      if (refData.head === commits[i].hash) {
        const unsaved = showUncommittedChanges ? await getUnsavedChanges(git, context) : null;
        if (unsaved !== null) {
          commits.unshift({
            hash: "*",
            parentHashes: [refData.head],
            author: "*",
            email: "",
            date: Math.round(Date.now() / 1000),
            message: `Uncommitted Changes (${unsaved.changes})`
          });
        }
        break;
      }
    }
  }

  const commitNodes: GitCommitNode[] = [];
  const commitLookup: { [hash: string]: number } = {};
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
    if (typeof commitLookup[ref.hash] === "number") {
      commitNodes[commitLookup[ref.hash]].refs.push(ref);
    }
  }

  return { commits: commitNodes, head: refData.head, moreCommitsAvailable, hard, error };
}
