import type { GitQueryError } from "@/backend/types";

import { GitCommandError, normalizeGitError } from "./gitRunner";

export function toGitQueryError(error: unknown, fallbackMessage: string): GitQueryError {
  const info = error instanceof GitCommandError ? error.record.error : normalizeGitError(error);

  return {
    message: info?.message || fallbackMessage,
    stderr: info?.stderr ?? null,
    exitCode: info?.exitCode ?? null,
    task: info?.task ?? null
  };
}
