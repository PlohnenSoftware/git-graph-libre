import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { deleteRemoteTag } from "@/backend/actions/tagRemote";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type DeleteTagInput = ActionPayload<"deleteTag"> & { repo?: string | null };

export async function addTag(git: SimpleGit, input: ActionPayload<"addTag">): Promise<void> {
  const args: string[] = [];
  if (input.lightweight) {
    args.push(input.tagName);
  } else {
    args.push("-a", input.tagName, "-m", input.message);
  }
  args.push(input.commitHash);
  await git.tag(args);
}

export async function deleteTag(
  git: SimpleGit,
  input: DeleteTagInput,
  record?: GitCommandRecorder
): Promise<void> {
  const repo = input.repo ?? null;
  await runGitRaw(git, {
    label: "tag.deleteTag",
    kind: "action",
    args: ["tag", "-d", input.tagName],
    repo,
    record
  });

  for (const remote of input.deleteOnRemotes ?? []) {
    await deleteRemoteTag(git, { repo, remote, tagName: input.tagName }, record);
  }
}

export async function pushTag(git: SimpleGit, input: ActionPayload<"pushTag">): Promise<void> {
  await git.push("origin", input.tagName);
}
