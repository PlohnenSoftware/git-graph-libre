import type { SimpleGit } from "simple-git";
import { pushModeArg } from "@/backend/actions/branchRemote";
import { deleteRemoteTag } from "@/backend/actions/tagRemote";
import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type AddTagInput = ActionPayload<"addTag"> & { repo?: string | null };
type DeleteTagInput = ActionPayload<"deleteTag"> & { repo?: string | null };
type PushTagInput = ActionPayload<"pushTag"> & { repo?: string | null };
type PushAllTagsInput = ActionPayload<"pushAllTags"> & { repo?: string | null };

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

export async function pushTag(
  git: SimpleGit,
  input: PushTagInput,
  record?: GitCommandRecorder
): Promise<void> {
  if (input.remotes.length === 0) {
    throw new Error(`No remotes were selected for pushing tag ${input.tagName}.`);
  }

  for (const remote of input.remotes) {
    const args = ["push"];
    const modeArg = pushModeArg(input.mode);
    if (modeArg !== null) args.push(modeArg);
    if (input.noVerify) args.push("--no-verify");
    // Push the fully qualified refspec: a bare name is ambiguous when a branch
    // and a tag share it (`src refspec <name> matches more than one`).
    args.push(remote, `refs/tags/${input.tagName}`);
    await runGitRaw(git, {
      label: "tag.pushTag",
      kind: "action",
      args,
      repo: input.repo ?? null,
      record
    });
  }
}

export async function pushAllTags(
  git: SimpleGit,
  input: PushAllTagsInput,
  record?: GitCommandRecorder
): Promise<void> {
  if (input.remotes.length === 0) {
    throw new Error("No remotes were selected for pushing all tags.");
  }

  for (const remote of input.remotes) {
    const args = ["push"];
    const modeArg = pushModeArg(input.mode);
    if (modeArg !== null) args.push(modeArg);
    if (input.noVerify) args.push("--no-verify");
    args.push(remote, "--tags");
    await runGitRaw(git, {
      label: "tag.pushAllTags",
      kind: "action",
      args,
      repo: input.repo ?? null,
      record
    });
  }
}
