import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type FileActionPayloads = {
  resetFileToRevision: ActionPayload<"resetFileToRevision">;
};

type FileActionInput<T extends keyof FileActionPayloads> = FileActionPayloads[T] & {
  repo?: string | null;
};

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

function requireRepoRelativePath(filePath: string) {
  requireValue(filePath, "File path");
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error("File path must stay inside the repository.");
  }
  return normalized;
}

export async function resetFileToRevision(
  git: SimpleGit,
  input: FileActionInput<"resetFileToRevision">,
  record?: GitCommandRecorder
): Promise<void> {
  requireValue(input.commitHash, "Commit hash");
  const filePath = requireRepoRelativePath(input.filePath);

  await runGitRaw(git, {
    label: "file.resetToRevision",
    kind: "action",
    args: ["checkout", input.commitHash, "--", filePath],
    repo: input.repo ?? null,
    record
  });
}
