import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type ActionPayloadByCommand = {
  stageFiles: ActionPayload<"stageFiles">;
  unstageFiles: ActionPayload<"unstageFiles">;
};

type ActionInput<T extends keyof ActionPayloadByCommand> = ActionPayloadByCommand[T] & {
  repo?: string | null;
};

function requirePaths(filePaths: string[]): void {
  if (filePaths.length === 0) throw new Error("File paths are required.");
  for (const filePath of filePaths) {
    if (filePath.trim() === "" || filePath === "--") {
      throw new Error("File paths must not be empty.");
    }
  }
}

export async function stageFiles(
  git: SimpleGit,
  input: ActionInput<"stageFiles">,
  record?: GitCommandRecorder
): Promise<void> {
  requirePaths(input.filePaths);
  await runGitRaw(git, {
    label: "stage.add",
    kind: "action",
    args: ["add", "--", ...input.filePaths],
    repo: input.repo ?? null,
    record
  });
}

export async function unstageFiles(
  git: SimpleGit,
  input: ActionInput<"unstageFiles">,
  record?: GitCommandRecorder
): Promise<void> {
  requirePaths(input.filePaths);
  await runGitRaw(git, {
    label: "stage.reset",
    kind: "action",
    args: ["reset", "HEAD", "--", ...input.filePaths],
    repo: input.repo ?? null,
    record
  });
}
