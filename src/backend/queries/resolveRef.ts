import type { SimpleGit } from "simple-git";

import type { GitQueryError } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";
import { toGitQueryError } from "@/backend/utils/queryError";

type ResolveRefInput = {
  repo: string;
  ref: string;
  recordGitCommand?: GitCommandRecorder;
};

type ResolveRefResult = {
  hash: string | null;
  error: GitQueryError | null;
};

function validationError(message: string): GitQueryError {
  return { message, stderr: null, exitCode: null, task: null };
}

function hasWhitespaceOrControl(ref: string) {
  for (const char of ref) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127 || char.trim() === "") return true;
  }
  return false;
}

function validateRef(ref: string): GitQueryError | null {
  if (ref === "") return validationError("Ref is required.");
  if (ref.startsWith("-")) return validationError("Ref must not start with '-'.");
  if (hasWhitespaceOrControl(ref) || ref.includes(":")) {
    return validationError("Ref must not contain whitespace, control characters, or ':'.");
  }
  return null;
}

export async function resolveRef(
  git: SimpleGit,
  input: ResolveRefInput
): Promise<ResolveRefResult> {
  const ref = input.ref.trim();
  const invalid = validateRef(ref);
  if (invalid !== null) return { hash: null, error: invalid };

  try {
    const stdout = await runGitRaw(git, {
      label: "resolveRef",
      args: ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
      repo: input.repo,
      record: input.recordGitCommand
    });
    const hash = stdout.trim();
    if (hash === "") {
      return { hash: null, error: validationError(`'${ref}' is not a commit.`) };
    }
    return { hash, error: null };
  } catch (error: unknown) {
    const queryError = toGitQueryError(error, `'${ref}' is not a commit.`);
    return {
      hash: null,
      error: { ...queryError, message: `'${ref}' is not a commit.` }
    };
  }
}
