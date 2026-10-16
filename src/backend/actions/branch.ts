import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { deleteRemoteBranch } from "@/backend/actions/branchRemote";
import { type GitCommandRecorder, runGitRaw, runGitCommand } from "@/backend/utils/gitRunner";

type DeleteBranchInput = ActionPayload<"deleteBranch"> & { repo?: string | null };

export async function createBranch(
  git: SimpleGit,
  input: ActionPayload<"createBranch"> & { repo?: string | null },
  record?: GitCommandRecorder
): Promise<void> {
  await runGitRaw(git, { label: "branch.create", kind: "action", args: ["branch", input.branchName, input.commitHash], repo: input.repo, record });
  if (input.checkout === true) {
    await runGitCommand(() => git.checkout(input.branchName), { label: "branch.checkout", kind: "action", args: ["checkout", input.branchName], repo: input.repo, record });
  }
}

export async function deleteBranch(
  git: SimpleGit,
  input: DeleteBranchInput,
  record?: GitCommandRecorder
): Promise<void> {
  const repo = input.repo ?? null;
  await runGitRaw(git, {
    label: "branch.deleteBranch",
    kind: "action",
    args: ["branch", input.forceDelete ? "-D" : "-d", input.branchName],
    repo,
    record
  });

  for (const remote of input.deleteOnRemotes ?? []) {
    await deleteRemoteBranch(
      git,
      {
        repo,
        branchName: input.branchName,
        remote
      },
      record
    );
  }
}

export async function renameBranch(
  git: SimpleGit,
  input: ActionPayload<"renameBranch"> & { repo?: string | null },
  record?: GitCommandRecorder
): Promise<void> {
  await runGitRaw(git, { label: "branch.rename", kind: "action", args: ["branch", "-m", input.oldName, input.newName], repo: input.repo, record });
}

export async function checkoutBranch(
  git: SimpleGit,
  input: ActionPayload<"checkoutBranch"> & { repo?: string | null },
  record?: GitCommandRecorder
): Promise<void> {
  if (input.remoteBranch === null) {
    await runGitCommand(() => git.checkout(input.branchName), { label: "branch.checkout", kind: "action", args: ["checkout", input.branchName], repo: input.repo, record });
  } else {
    const remoteBranch = input.remoteBranch;
    await runGitCommand(() => git.checkoutBranch(input.branchName, remoteBranch), { label: "branch.checkoutRemote", kind: "action", args: ["checkout", "-b", input.branchName, input.remoteBranch], repo: input.repo, record });
  }
}
