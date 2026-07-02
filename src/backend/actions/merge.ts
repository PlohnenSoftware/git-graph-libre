import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type MergeActionPayloads = {
  mergeBranch: ActionPayload<"mergeBranch">;
  mergeCommit: ActionPayload<"mergeCommit">;
};

type MergeActionInput<T extends keyof MergeActionPayloads> = MergeActionPayloads[T] & {
  repo?: string | null;
};

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

function buildMergeArgs(
  target: string,
  input: { createNewCommit: boolean; squash: boolean; noCommit: boolean }
) {
  const args = ["merge", target];
  if (input.squash) {
    args.push("--squash");
  } else if (input.createNewCommit) {
    args.push("--no-ff");
  }
  if (input.noCommit) args.push("--no-commit");
  return args;
}

export async function mergeBranch(
  git: SimpleGit,
  input: MergeActionInput<"mergeBranch">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.branchName, "Branch name");
  await runGitRaw(git, {
    label: "merge.branch",
    kind: "action",
    args: buildMergeArgs(input.branchName, input),
    repo: input.repo ?? null,
    record
  });
}

export async function mergeCommit(
  git: SimpleGit,
  input: MergeActionInput<"mergeCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  await runGitRaw(git, {
    label: "merge.commit",
    kind: "action",
    args: buildMergeArgs(input.commitHash, input),
    repo: input.repo ?? null,
    record
  });
}
