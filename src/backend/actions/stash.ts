import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type ActionPayloadByCommand = {
  applyStash: ActionPayload<"applyStash">;
  branchFromStash: ActionPayload<"branchFromStash">;
  cleanUntrackedFiles: ActionPayload<"cleanUntrackedFiles">;
  dropStash: ActionPayload<"dropStash">;
  popStash: ActionPayload<"popStash">;
  pushStash: ActionPayload<"pushStash">;
  resetUncommittedChanges: ActionPayload<"resetUncommittedChanges">;
};

type ActionInput<T extends keyof ActionPayloadByCommand> = ActionPayloadByCommand[T] & {
  repo?: string | null;
};

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

function requireUncommittedResetMode(mode: string): asserts mode is "mixed" | "hard" {
  if (mode !== "mixed" && mode !== "hard") {
    throw new Error("Reset mode must be mixed or hard.");
  }
}

export async function applyStash(
  git: SimpleGit,
  input: ActionInput<"applyStash">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.selector, "Stash selector");
  const args = ["stash", "apply"];
  if (input.reinstateIndex) args.push("--index");
  args.push(input.selector);
  await runGitRaw(git, {
    label: "stash.apply",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}

export async function branchFromStash(
  git: SimpleGit,
  input: ActionInput<"branchFromStash">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.selector, "Stash selector");
  requireValue(input.branchName, "Branch name");
  await runGitRaw(git, {
    label: "stash.branch",
    kind: "action",
    args: ["stash", "branch", input.branchName, input.selector],
    repo: input.repo ?? null,
    record
  });
}

export async function dropStash(
  git: SimpleGit,
  input: ActionInput<"dropStash">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.selector, "Stash selector");
  await runGitRaw(git, {
    label: "stash.drop",
    kind: "action",
    args: ["stash", "drop", input.selector],
    repo: input.repo ?? null,
    record
  });
}

export async function popStash(
  git: SimpleGit,
  input: ActionInput<"popStash">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.selector, "Stash selector");
  const args = ["stash", "pop"];
  if (input.reinstateIndex) args.push("--index");
  args.push(input.selector);
  await runGitRaw(git, {
    label: "stash.pop",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}

export async function pushStash(
  git: SimpleGit,
  input: ActionInput<"pushStash">,
  record?: GitCommandRecorder
): Promise<void> {
  const args = ["stash", "push"];
  if (input.includeUntracked) args.push("--include-untracked");
  if (input.message !== "") args.push("--message", input.message);
  await runGitRaw(git, {
    label: "stash.push",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}

export async function resetUncommittedChanges(
  git: SimpleGit,
  input: ActionInput<"resetUncommittedChanges">,
  record?: GitCommandRecorder
): Promise<void> {
  requireUncommittedResetMode(input.resetMode);
  await runGitRaw(git, {
    label: "stash.resetUncommitted",
    kind: "action",
    args: ["reset", `--${input.resetMode}`, "HEAD"],
    repo: input.repo ?? null,
    record
  });
}

export async function cleanUntrackedFiles(
  git: SimpleGit,
  input: ActionInput<"cleanUntrackedFiles">,
  record?: GitCommandRecorder
): Promise<void> {
  const args = ["clean", "-f"];
  if (input.includeDirectories) args.push("-d");
  await runGitRaw(git, {
    label: "stash.cleanUntracked",
    kind: "action",
    args,
    repo: input.repo ?? null,
    record
  });
}
