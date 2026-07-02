import type { SimpleGit } from "simple-git";

import type {
  GitConfigValue,
  GitQueryError,
  GitRemote,
  GitRepoConfig,
  GitRepoInfo,
  GitStash,
  QueryResult
} from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

const eolRegex = /\r\n|\r|\n/g;
const gitFieldSeparatorFormat = "%x00";
const gitFieldSeparatorOutput = "\0";
const stashFieldCount = 4;

type LoadRepoInfoInput = {
  repo?: string | null;
  showStashes?: boolean;
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

function emptyRepoInfo(isRepo: boolean): GitRepoInfo {
  return {
    isRepo,
    head: null,
    headCommit: null,
    remotes: [],
    stashes: [],
    stashCount: 0,
    config: {
      userName: { local: null, global: null },
      userEmail: { local: null, global: null }
    }
  };
}

function appendUnique(values: string[], value: string) {
  if (value !== "" && !values.includes(value)) values.push(value);
}

function parseRemoteLine(line: string) {
  const tabIndex = line.indexOf("\t");
  if (tabIndex <= 0) return null;

  const name = line.slice(0, tabIndex);
  const rest = line.slice(tabIndex + 1);
  const fetchSuffix = " (fetch)";
  const pushSuffix = " (push)";
  if (rest.endsWith(fetchSuffix)) {
    return { name, kind: "fetch" as const, url: rest.slice(0, -fetchSuffix.length) };
  }
  if (rest.endsWith(pushSuffix)) {
    return { name, kind: "push" as const, url: rest.slice(0, -pushSuffix.length) };
  }
  return null;
}

function parseRemotes(stdout: string): GitRemote[] {
  const remotesByName = new Map<string, GitRemote>();
  for (const line of stdout.split(eolRegex)) {
    if (line === "") continue;
    const parsed = parseRemoteLine(line);
    if (parsed === null) continue;

    let remote = remotesByName.get(parsed.name);
    if (remote === undefined) {
      remote = { name: parsed.name, fetchUrls: [], pushUrls: [] };
      remotesByName.set(parsed.name, remote);
    }
    appendUnique(parsed.kind === "fetch" ? remote.fetchUrls : remote.pushUrls, parsed.url);
  }
  return [...remotesByName.values()];
}

function splitNulTerminatedFields(stdout: string) {
  const fields = stdout.split(gitFieldSeparatorOutput);
  if (fields[fields.length - 1] === "") fields.pop();
  return fields;
}

function parseStashIndex(ref: string): number | null {
  const match = /^stash@\{(\d+)\}$/.exec(ref);
  if (match === null) return null;
  const index = Number.parseInt(match[1], 10);
  return Number.isNaN(index) ? null : index;
}

function parseStashes(stdout: string): GitStash[] {
  const fields = splitNulTerminatedFields(stdout);
  const stashes: GitStash[] = [];
  for (let i = 0; i + stashFieldCount - 1 < fields.length; i += stashFieldCount) {
    const ref = fields[i];
    const index = parseStashIndex(ref);
    if (index === null) continue;

    const parsedDate = Number.parseInt(fields[i + 3], 10);
    stashes.push({
      index,
      ref,
      hash: fields[i + 1],
      message: fields[i + 2],
      date: Number.isNaN(parsedDate) ? null : parsedDate
    });
  }
  return stashes;
}

type ScopedGitConfig = {
  userName: string | null;
  userEmail: string | null;
};

function parseScopedConfig(stdout: string): ScopedGitConfig {
  const config: ScopedGitConfig = { userName: null, userEmail: null };
  for (const entry of splitNulTerminatedFields(stdout)) {
    const separatorIndex = entry.indexOf("\n");
    if (separatorIndex <= 0) continue;
    const key = entry.slice(0, separatorIndex);
    const value = entry.slice(separatorIndex + 1);
    if (key === "user.name") config.userName = value;
    if (key === "user.email") config.userEmail = value;
  }
  return config;
}

function mergeConfigValues(local: string | null, global: string | null): GitConfigValue {
  return { local, global };
}

function mergeConfig(local: ScopedGitConfig, global: ScopedGitConfig): GitRepoConfig {
  return {
    userName: mergeConfigValues(local.userName, global.userName),
    userEmail: mergeConfigValues(local.userEmail, global.userEmail)
  };
}

async function isInsideWorkTree(git: SimpleGit, context: GitQueryContext): Promise<boolean> {
  try {
    const stdout = await runGitRaw(git, {
      label: "loadRepoInfo.isRepo",
      args: ["rev-parse", "--is-inside-work-tree"],
      repo: context.repo,
      record: context.record
    });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function loadHead(
  git: SimpleGit,
  context: GitQueryContext
): Promise<QueryValue<Pick<GitRepoInfo, "head" | "headCommit">>> {
  try {
    const [branchStdout, commitStdout] = await Promise.all([
      runGitRaw(git, {
        label: "loadRepoInfo.headBranch",
        args: ["branch", "--show-current"],
        repo: context.repo,
        record: context.record
      }),
      runGitRaw(git, {
        label: "loadRepoInfo.headCommit",
        args: ["rev-parse", "--verify", "HEAD"],
        repo: context.repo,
        record: context.record
      }).catch(() => "")
    ]);

    return {
      value: {
        head: branchStdout.trim() || null,
        headCommit: commitStdout.trim() || null
      },
      error: null
    };
  } catch (error: unknown) {
    return {
      value: { head: null, headCommit: null },
      error: toGitQueryError(error, "Unable to load repository HEAD")
    };
  }
}

async function loadRemotes(
  git: SimpleGit,
  context: GitQueryContext
): Promise<QueryValue<GitRemote[]>> {
  try {
    const stdout = await runGitRaw(git, {
      label: "loadRepoInfo.remotes",
      args: ["remote", "-v"],
      repo: context.repo,
      record: context.record
    });
    return { value: parseRemotes(stdout), error: null };
  } catch (error: unknown) {
    return { value: [], error: toGitQueryError(error, "Unable to load repository remotes") };
  }
}

async function loadStashes(
  git: SimpleGit,
  context: GitQueryContext
): Promise<QueryValue<GitStash[]>> {
  try {
    const stdout = await runGitRaw(git, {
      label: "loadRepoInfo.stashes",
      args: [
        "stash",
        "list",
        "-z",
        `--format=%gd${gitFieldSeparatorFormat}%H${gitFieldSeparatorFormat}%gs${gitFieldSeparatorFormat}%ct`
      ],
      repo: context.repo,
      record: context.record
    });
    return { value: parseStashes(stdout), error: null };
  } catch (error: unknown) {
    return { value: [], error: toGitQueryError(error, "Unable to load repository stashes") };
  }
}

async function loadScopedConfig(
  git: SimpleGit,
  context: GitQueryContext,
  scope: "local" | "global"
): Promise<QueryValue<ScopedGitConfig>> {
  try {
    const stdout = await runGitRaw(git, {
      label: `loadRepoInfo.config.${scope}`,
      args: ["config", "--list", `--${scope}`, "-z"],
      repo: context.repo,
      record: context.record
    });
    return { value: parseScopedConfig(stdout), error: null };
  } catch (error: unknown) {
    return {
      value: { userName: null, userEmail: null },
      error: toGitQueryError(error, `Unable to load ${scope} Git config`)
    };
  }
}

async function loadConfig(
  git: SimpleGit,
  context: GitQueryContext
): Promise<QueryValue<GitRepoConfig>> {
  const [localConfig, globalConfig] = await Promise.all([
    loadScopedConfig(git, context, "local"),
    loadScopedConfig(git, context, "global")
  ]);

  return {
    value: mergeConfig(localConfig.value, globalConfig.value),
    error: localConfig.error ?? globalConfig.error
  };
}

export async function loadRepoInfo(
  git: SimpleGit,
  input: LoadRepoInfoInput
): Promise<QueryResult<"loadRepoInfo">> {
  const context = { repo: input.repo ?? null, record: input.recordGitCommand };
  const showStashes = input.showStashes !== false;
  const isRepo = await isInsideWorkTree(git, context);
  if (!isRepo) return { repoInfo: emptyRepoInfo(false), error: null };

  const [headResult, remotesResult, stashesResult, configResult] = await Promise.all([
    loadHead(git, context),
    loadRemotes(git, context),
    showStashes ? loadStashes(git, context) : Promise.resolve({ value: [], error: null }),
    loadConfig(git, context)
  ]);
  const repoInfo: GitRepoInfo = {
    isRepo: true,
    head: headResult.value.head,
    headCommit: headResult.value.headCommit,
    remotes: remotesResult.value,
    stashes: stashesResult.value,
    stashCount: stashesResult.value.length,
    config: configResult.value
  };

  return {
    repoInfo,
    error: headResult.error ?? remotesResult.error ?? stashesResult.error ?? configResult.error
  };
}
