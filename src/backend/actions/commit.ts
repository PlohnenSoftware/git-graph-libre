import type { SimpleGit } from "simple-git";

import type { ActionPayload, GitResetMode } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type CommitActionPayloads = {
  checkoutCommit: ActionPayload<"checkoutCommit">;
  cherrypickCommit: ActionPayload<"cherrypickCommit">;
  dropCommit: ActionPayload<"dropCommit">;
  dropCommitSelection: ActionPayload<"dropCommitSelection">;
  editHeadCommitMessage: ActionPayload<"editHeadCommitMessage">;
  resetToCommit: ActionPayload<"resetToCommit">;
  revertCommit: ActionPayload<"revertCommit">;
  squashCommitSelection: ActionPayload<"squashCommitSelection">;
  undoLastCommit: ActionPayload<"undoLastCommit">;
};

type CommitActionInput<T extends keyof CommitActionPayloads> = CommitActionPayloads[T] & {
  repo?: string | null;
};

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

function requireCommitHashes(commitHashes: readonly string[], label: string, minCount: number) {
  if (commitHashes.length < minCount) {
    throw new Error(`${label} requires at least ${minCount} commit hashes.`);
  }
  for (const commitHash of commitHashes) {
    requireValue(commitHash, "Commit hash");
  }
}

function requireResetMode(mode: string): asserts mode is GitResetMode {
  if (mode !== "soft" && mode !== "mixed" && mode !== "hard") {
    throw new Error("Reset mode must be soft, mixed, or hard.");
  }
}

function trimTrailingLineFeeds(message: string) {
  let end = message.length;
  while (end > 0 && message.codePointAt(end - 1) === 10) end -= 1;
  return message.slice(0, end);
}

function normalizeCommitMessage(message: string) {
  // Commit messages are user-controlled, so keep normalization regex-free and
  // avoid regex backtracking hotspots over unbounded text.
  return trimTrailingLineFeeds(message.replaceAll("\r\n", "\n"));
}

export async function checkoutCommit(
  git: SimpleGit,
  input: CommitActionInput<"checkoutCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  await runGitRaw(git, {
    label: "commit.checkout",
    kind: "action",
    args: ["checkout", input.commitHash],
    repo: input.repo ?? null,
    record
  });
}

export async function cherrypickCommit(
  git: SimpleGit,
  input: CommitActionInput<"cherrypickCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  const args = ["cherry-pick"];
  if (input.parentIndex > 0) args.push("-m", String(input.parentIndex));
  args.push(input.commitHash);
  await runGitRaw(git, {
    label: "commit.cherrypick",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}

export async function revertCommit(
  git: SimpleGit,
  input: CommitActionInput<"revertCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  const args = ["revert", "--no-edit"];
  if (input.parentIndex > 0) args.push("-m", String(input.parentIndex));
  args.push(input.commitHash);
  await runGitRaw(git, {
    label: "commit.revert",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}

export async function resetToCommit(
  git: SimpleGit,
  input: CommitActionInput<"resetToCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  requireResetMode(input.resetMode);
  await runGitRaw(git, {
    label: "commit.reset",
    kind: "action",
    args: ["reset", `--${input.resetMode}`, input.commitHash],
    repo: input.repo ?? null,
    record
  });
}

export async function dropCommit(
  git: SimpleGit,
  input: CommitActionInput<"dropCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  await runGitRaw(git, {
    label: "commit.drop",
    kind: "action",
    args: ["rebase", "--onto", `${input.commitHash}^`, input.commitHash],
    repo: input.repo ?? null,
    record
  });
}

export async function dropCommitSelection(
  git: SimpleGit,
  input: CommitActionInput<"dropCommitSelection">,
  record?: GitCommandRecorder
): Promise<void> {
  requireCommitHashes(input.commitHashes, "Dropping selected commits", 1);
  for (const commitHash of input.commitHashes) {
    await dropCommit(git, { repo: input.repo ?? null, commitHash }, record);
  }
}

export async function squashCommitSelection(
  git: SimpleGit,
  input: CommitActionInput<"squashCommitSelection">,
  record?: GitCommandRecorder
): Promise<void> {
  requireCommitHashes(input.commitHashes, "Squashing selected commits", 2);
  requireValue(input.message, "Commit message");

  const oldestCommit = input.commitHashes.at(-1);
  if (oldestCommit === undefined) throw new Error("Oldest commit is required.");

  await runGitRaw(git, {
    label: "commit.squash.reset",
    kind: "action",
    args: ["reset", "--soft", `${oldestCommit}^`],
    repo: input.repo ?? null,
    record
  });

  const commitArgs = ["commit", "-m", input.message];
  if (input.noVerify) commitArgs.push("--no-verify");
  await runGitRaw(git, {
    label: "commit.squash.commit",
    kind: "action",
    args: commitArgs,
    repo: input.repo ?? null,
    record
  });
}

export async function undoLastCommit(
  git: SimpleGit,
  input: CommitActionInput<"undoLastCommit">,
  record?: GitCommandRecorder
): Promise<void> {
  await runGitRaw(git, {
    label: "commit.undoLast",
    kind: "action",
    args: ["reset", "--soft", "HEAD^"],
    repo: input.repo ?? null,
    record
  });
}

export async function editHeadCommitMessage(
  git: SimpleGit,
  input: CommitActionInput<"editHeadCommitMessage">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  requireValue(input.message, "Commit message");

  const head = (
    await runGitRaw(git, {
      label: "commit.editMessage.head",
      kind: "action",
      args: ["rev-parse", "HEAD"],
      repo: input.repo ?? null,
      record
    })
  ).trim();
  if (head !== input.commitHash) {
    throw new Error("Editing commit messages is currently supported only for HEAD.");
  }

  const currentMessage = await runGitRaw(git, {
    label: "commit.editMessage.current",
    kind: "action",
    args: ["log", "-1", "--format=%B", "HEAD"],
    repo: input.repo ?? null,
    record
  });
  if (normalizeCommitMessage(currentMessage) === normalizeCommitMessage(input.message)) return;

  await runGitRaw(git, {
    label: "commit.editMessage.amend",
    kind: "action",
    args: ["commit", "--amend", "-m", input.message],
    repo: input.repo ?? null,
    record
  });
}
