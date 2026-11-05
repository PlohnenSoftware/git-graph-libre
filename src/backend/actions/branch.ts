import type { SimpleGit } from "simple-git";
import { deleteRemoteBranch } from "@/backend/actions/branchRemote";
import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitCommand, runGitRaw } from "@/backend/utils/gitRunner";

type DeleteBranchInput = ActionPayload<"deleteBranch"> & { repo?: string | null };

export async function createBranch(
  git: SimpleGit,
  input: ActionPayload<"createBranch"> & { repo?: string | null },
  record?: GitCommandRecorder
): Promise<void> {
  await runGitRaw(git, {
    label: "branch.create",
    kind: "action",
    args: ["branch", input.branchName, input.commitHash],
    repo: input.repo,
    record
  });
  if (input.checkout === true) {
    await runGitCommand(() => git.checkout(input.branchName), {
      label: "branch.checkout",
      kind: "action",
      args: ["checkout", input.branchName],
      repo: input.repo,
      record
    });
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
  await runGitRaw(git, {
    label: "branch.rename",
    kind: "action",
    args: ["branch", "-m", input.oldName, input.newName],
    repo: input.repo,
    record
  });
}

/**
 * Names the step that failed, in our own words, keeping Git's own text as
 * the detail. Loaded on demand: `@/l10n` needs the `vscode` module, which a
 * backend module that only runs Git must not require on import.
 */
async function stepFailure(
  key: "error.checkoutStepFailed" | "error.fastForwardStepFailed",
  branchName: string,
  target: string,
  error: unknown
): Promise<Error> {
  const { t } = await import("@/l10n");
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(t(key, branchName, target, detail), { cause: error });
}

export async function checkoutAndFastForward(
  git: SimpleGit,
  input: ActionPayload<"checkoutAndFastForward"> & { repo?: string | null },
  record?: GitCommandRecorder
): Promise<void> {
  const repo = input.repo ?? null;
  try {
    await runGitRaw(git, {
      label: "branch.checkout",
      kind: "action",
      args: ["checkout", input.branchName],
      repo,
      record
    });
  } catch (error: unknown) {
    throw await stepFailure("error.checkoutStepFailed", input.branchName, input.target, error);
  }
  try {
    await runGitRaw(git, {
      label: "branch.fastForward",
      kind: "action",
      args: ["merge", "--ff-only", input.target],
      repo,
      record
    });
  } catch (error: unknown) {
    throw await stepFailure("error.fastForwardStepFailed", input.branchName, input.target, error);
  }
}

export async function checkoutBranch(
  git: SimpleGit,
  input: ActionPayload<"checkoutBranch"> & { repo?: string | null },
  record?: GitCommandRecorder
): Promise<void> {
  if (input.remoteBranch === null) {
    await runGitCommand(() => git.checkout(input.branchName), {
      label: "branch.checkout",
      kind: "action",
      args: ["checkout", input.branchName],
      repo: input.repo,
      record
    });
  } else {
    const remoteBranch = input.remoteBranch;
    await runGitCommand(() => git.checkoutBranch(input.branchName, remoteBranch), {
      label: "branch.checkoutRemote",
      kind: "action",
      args: ["checkout", "-b", input.branchName, input.remoteBranch],
      repo: input.repo,
      record
    });
  }
}
