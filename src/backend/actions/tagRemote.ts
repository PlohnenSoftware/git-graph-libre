import type { SimpleGit } from "simple-git";

import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { isMissingRemoteRefError } from "@/backend/utils/remoteRefs";

type DeleteRemoteTagInput = {
  tagName: string;
  remote: string;
  repo?: string | null;
};

/**
 * Deletes `tagName` on a single remote.
 *
 * Unlike remote branches, `refs/tags` is a flat namespace with no per-remote
 * tracking refs, so the caller cannot know in advance which remotes actually
 * carry the tag. A remote that never had it is therefore not an error: the tag
 * being absent there is the requested end state.
 */
export async function deleteRemoteTag(
  git: SimpleGit,
  input: DeleteRemoteTagInput,
  record?: GitCommandRecorder
): Promise<void> {
  try {
    await runGitRaw(git, {
      label: "tagRemote.deleteRemoteTag",
      kind: "action",
      args: ["push", input.remote, "--delete", `refs/tags/${input.tagName}`],
      repo: input.repo ?? null,
      record
    });
  } catch (error: unknown) {
    if (!isMissingRemoteRefError(error)) throw error;
  }
}
