import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { deleteRemoteBranch } from "@/backend/actions/branchRemote";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type DeleteBranchInput = ActionPayload<"deleteBranch"> & { repo?: string | null };

export async function createBranch(
  git: SimpleGit,
  input: ActionPayload<"createBranch">
): Promise<void> {
  await git.raw(["branch", input.branchName, input.commitHash]);
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
  input: ActionPayload<"renameBranch">
): Promise<void> {
  await git.raw(["branch", "-m", input.oldName, input.newName]);
}

export async function checkoutBranch(
  git: SimpleGit,
  input: ActionPayload<"checkoutBranch">
): Promise<void> {
  if (input.remoteBranch === null) {
    await git.checkout(input.branchName);
  } else {
    await git.checkoutBranch(input.branchName, input.remoteBranch);
  }
}
