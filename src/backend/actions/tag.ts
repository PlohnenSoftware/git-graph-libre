import type { SimpleGit } from "simple-git";
import { deleteRemoteTag } from "@/backend/actions/tagRemote";
import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type AddTagInput = ActionPayload<"addTag"> & { repo?: string | null };
type DeleteTagInput = ActionPayload<"deleteTag"> & { repo?: string | null };

export async function addTag(
  git: SimpleGit,
  input: AddTagInput,
  record?: GitCommandRecorder
): Promise<void> {
  const args: string[] = [];
  if (input.lightweight) {
    // `--no-sign` is a correctness guard for "lightweight means lightweight":
    // a lightweight tag is a plain ref with no tag object, so it can never be
    // signed. Without the flag, a `tag.gpgsign = true` git config silently
    // upgrades `git tag <name> <hash>` into a signed annotated tag object and
    // opens `core.editor` to ask for a tag message. The flag is deliberately
    // absent from the annotated path below: annotated tags follow the user's
    // git signing configuration (`tag.gpgSign`, `tag.forceSignAnnotated`,
    // `user.signingkey`, `gpg.format`) and must not be overridden here.
    args.push("--no-sign", input.tagName);
  } else {
    // `-m` is load-bearing: it is what guarantees git never opens
    // `core.editor` to collect a tag message.
    args.push("-a", input.tagName, "-m", input.message);
  }
  args.push(input.commitHash);
  await runGitRaw(git, {
    label: "tag.addTag",
    kind: "action",
    args: ["tag", ...args],
    repo: input.repo ?? null,
    record
  });
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
