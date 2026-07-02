import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type RebaseCurrentBranchInput = ActionPayload<"rebaseCurrentBranch"> & {
  repo?: string | null;
};

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

export async function rebaseCurrentBranch(
  git: SimpleGit,
  input: RebaseCurrentBranchInput,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.target, "Rebase target");
  const args = ["rebase"];
  if (input.ignoreDate) args.push("--ignore-date");
  args.push(input.target);

  await runGitRaw(git, {
    label: `rebase.${input.targetType}`,
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}
