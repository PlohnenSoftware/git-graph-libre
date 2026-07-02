import type { SimpleGit } from "simple-git";

import type { ActionPayload, GitPushBranchMode } from "@/backend/types";
import { GitCommandError, type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type ActionInput<T extends keyof ActionPayloadByCommand> = ActionPayloadByCommand[T] & {
  repo?: string | null;
};
type ActionPayloadByCommand = {
  deleteRemoteBranch: ActionPayload<"deleteRemoteBranch">;
  fetchIntoLocalBranch: ActionPayload<"fetchIntoLocalBranch">;
  pullBranch: ActionPayload<"pullBranch">;
  pushBranch: ActionPayload<"pushBranch">;
  updateBranchFromUpstream: ActionPayload<"updateBranchFromUpstream">;
};

type TrackedBranch = {
  remote: string;
  remoteBranch: string;
};

function pushModeArg(mode: GitPushBranchMode): string | null {
  if (mode === "normal") return null;
  if (mode === "force-with-lease") return "--force-with-lease";
  return "--force";
}

function remoteBranchMissing(error: unknown) {
  if (!(error instanceof GitCommandError)) return false;
  const text = [error.record.error?.message, error.record.error?.stderr].filter(Boolean).join("\n");
  return /remote ref does not exist/i.test(text);
}

function parseRemoteBranch(remoteBranchRef: string, remotes: string[]): TrackedBranch {
  const sortedRemotes = [...remotes].sort((a, b) => b.length - a.length);
  for (const remote of sortedRemotes) {
    const prefix = `${remote}/`;
    if (remoteBranchRef.startsWith(prefix)) {
      return { remote, remoteBranch: remoteBranchRef.slice(prefix.length) };
    }
  }

  const separator = remoteBranchRef.indexOf("/");
  if (separator <= 0 || separator === remoteBranchRef.length - 1) {
    throw new Error(`Unable to parse upstream branch ${remoteBranchRef}.`);
  }
  return {
    remote: remoteBranchRef.slice(0, separator),
    remoteBranch: remoteBranchRef.slice(separator + 1)
  };
}

async function loadRemoteNames(git: SimpleGit, repo: string | null, record?: GitCommandRecorder) {
  const stdout = await runGitRaw(git, {
    label: "branchRemote.remotes",
    kind: "action",
    args: ["remote"],
    repo,
    record
  });
  return stdout
    .split(/\r\n|\r|\n/g)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

async function resolveBranchUpstream(
  git: SimpleGit,
  branchName: string,
  repo: string | null,
  record?: GitCommandRecorder
): Promise<TrackedBranch> {
  let upstream: string;
  try {
    upstream = (
      await runGitRaw(git, {
        label: "branchRemote.upstream",
        kind: "action",
        args: ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${branchName}@{upstream}`],
        repo,
        record
      })
    ).trim();
  } catch (error: unknown) {
    throw new Error(
      `Branch ${branchName} has no configured upstream remote branch.`,
      error instanceof Error ? { cause: error } : undefined
    );
  }

  const remotes = await loadRemoteNames(git, repo, record);
  return parseRemoteBranch(upstream, remotes);
}

async function currentBranch(git: SimpleGit, repo: string | null, record?: GitCommandRecorder) {
  const stdout = await runGitRaw(git, {
    label: "branchRemote.currentBranch",
    kind: "action",
    args: ["branch", "--show-current"],
    repo,
    record
  });
  return stdout.trim() || null;
}

export async function pushBranch(
  git: SimpleGit,
  input: ActionInput<"pushBranch">,
  record?: GitCommandRecorder
): Promise<void> {
  if (input.remotes.length === 0) {
    throw new Error(`No remotes were selected for pushing branch ${input.branchName}.`);
  }

  for (const remote of input.remotes) {
    const args = ["push"];
    if (input.setUpstream) args.push("--set-upstream");
    const modeArg = pushModeArg(input.mode);
    if (modeArg !== null) args.push(modeArg);
    if (input.noVerify) args.push("--no-verify");
    args.push(remote, input.branchName);
    await runGitRaw(git, {
      label: "branchRemote.pushBranch",
      kind: "action",
      args,
      repo: input.repo ?? null,
      record
    });
  }
}

export async function deleteRemoteBranch(
  git: SimpleGit,
  input: ActionInput<"deleteRemoteBranch">,
  record?: GitCommandRecorder
): Promise<void> {
  const repo = input.repo ?? null;
  try {
    await runGitRaw(git, {
      label: "branchRemote.deleteRemoteBranch",
      kind: "action",
      args: ["push", input.remote, "--delete", input.branchName],
      repo,
      record
    });
  } catch (error: unknown) {
    if (!remoteBranchMissing(error)) throw error;
    await runGitRaw(git, {
      label: "branchRemote.deleteRemoteTrackingBranch",
      kind: "action",
      args: ["branch", "-d", "-r", `${input.remote}/${input.branchName}`],
      repo,
      record
    });
  }
}

export async function fetchIntoLocalBranch(
  git: SimpleGit,
  input: ActionInput<"fetchIntoLocalBranch">,
  record?: GitCommandRecorder
): Promise<void> {
  const repo = input.repo ?? null;
  const activeBranch = await currentBranch(git, repo, record);

  if (activeBranch === input.localBranch) {
    if (!input.force) {
      await runGitRaw(git, {
        label: "branchRemote.pullIntoCheckedOutBranch",
        kind: "action",
        args: ["pull", input.remote, input.remoteBranch],
        repo,
        record
      });
      return;
    }

    await runGitRaw(git, {
      label: "branchRemote.fetchCheckedOutBranch",
      kind: "action",
      args: ["fetch", input.remote, input.remoteBranch],
      repo,
      record
    });
    await runGitRaw(git, {
      label: "branchRemote.resetCheckedOutBranch",
      kind: "action",
      args: ["reset", "--hard", `${input.remote}/${input.remoteBranch}`],
      repo,
      record
    });
    return;
  }

  const args = ["fetch"];
  if (input.force) args.push("-f");
  args.push(input.remote, `${input.remoteBranch}:${input.localBranch}`);
  await runGitRaw(git, {
    label: "branchRemote.fetchIntoLocalBranch",
    kind: "action",
    args,
    repo,
    record
  });
}

export async function updateBranchFromUpstream(
  git: SimpleGit,
  input: ActionInput<"updateBranchFromUpstream">,
  record?: GitCommandRecorder
): Promise<void> {
  const repo = input.repo ?? null;
  const upstream = await resolveBranchUpstream(git, input.branchName, repo, record);
  await fetchIntoLocalBranch(
    git,
    {
      repo,
      remote: upstream.remote,
      remoteBranch: upstream.remoteBranch,
      localBranch: input.branchName,
      force: input.force
    },
    record
  );
}

export async function pullBranch(
  git: SimpleGit,
  input: ActionInput<"pullBranch">,
  record?: GitCommandRecorder
): Promise<void> {
  const args = ["pull", input.remote, input.branchName];
  if (input.squash) {
    args.push("--squash");
  } else if (input.createNewCommit) {
    args.push("--no-ff");
  }
  if (input.noVerify) args.push("--no-verify");

  await runGitRaw(git, {
    label: "branchRemote.pullBranch",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}
