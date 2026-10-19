import { spawn } from "node:child_process";
import type { SimpleGit } from "simple-git";

import { resolveRef } from "@/backend/queries/resolveRef";
import { type GitCommandRecorder, runGitRaw, sanitizeGitArgs } from "@/backend/utils/gitRunner";

type SpawnOptions = { cwd: string; detached: true; stdio: "ignore" };

/** The detached launch, injected in tests so no real diff tool ever opens. */
export type ExternalDiffSpawn = (
  binary: string,
  args: string[],
  options: SpawnOptions
) => { unref: () => void };

export type OpenExternalDirDiffInput = {
  repo: string;
  baseRef: string;
  compareRef: string;
  /** The resolved git binary (`config.gitPath()`), as in `loadBranches`. */
  gitPath: string;
  recordGitCommand?: GitCommandRecorder;
  spawn?: ExternalDiffSpawn;
};

function detachedSpawn(binary: string, args: string[], options: SpawnOptions) {
  const child = spawn(binary, args, options);
  // The tool outlives us by design; a failed launch must not crash the host.
  child.on("error", () => {});
  return child;
}

async function readConfiguredTool(
  git: SimpleGit,
  input: OpenExternalDirDiffInput,
  key: "diff.guitool" | "diff.tool"
): Promise<string | null> {
  try {
    const value = await runGitRaw(git, {
      label: "externalDiff.config",
      args: ["config", "--get", key],
      repo: input.repo,
      record: input.recordGitCommand
    });
    return value.trim() || null;
  } catch {
    return null;
  }
}

async function resolveHash(git: SimpleGit, input: OpenExternalDirDiffInput, ref: string) {
  const { hash, error } = await resolveRef(git, {
    repo: input.repo,
    ref,
    recordGitCommand: input.recordGitCommand
  });
  if (hash === null) throw new Error(error?.message ?? `'${ref}' is not a commit.`);
  return hash;
}

/**
 * Open a comparison in the user's diff tool (`git difftool --dir-diff`, per
 * `git help difftool`), detached so the host never waits on the tool. Refs
 * resolve to full hashes first, so only argv entries built here reach the
 * spawn. `"*"` as the compare ref is the working tree: a single-commit
 * difftool invocation compares against it. As the base it has no dir-diff
 * form (`--dir-diff -R <commit>` fails in Git itself, probed 2026-10-19),
 * and the single-ref form would silently reverse the sides, so it throws.
 */
export async function openExternalDirDiff(
  git: SimpleGit,
  input: OpenExternalDirDiffInput
): Promise<{ configured: boolean }> {
  if (input.baseRef === "*") {
    throw new Error("The working tree cannot be the base of an external directory diff.");
  }
  const guiTool = await readConfiguredTool(git, input, "diff.guitool");
  const tool = guiTool ?? (await readConfiguredTool(git, input, "diff.tool"));
  if (tool === null) return { configured: false };
  const args = ["difftool", "--dir-diff", "--no-prompt"];
  if (guiTool !== null) args.push("--gui");
  args.push(await resolveHash(git, input, input.baseRef));
  if (input.compareRef !== "*") args.push(await resolveHash(git, input, input.compareRef));
  const startedAt = Date.now();
  (input.spawn ?? detachedSpawn)(input.gitPath, args, {
    cwd: input.repo,
    detached: true,
    stdio: "ignore"
  }).unref();
  input.recordGitCommand?.({
    label: "externalDiff.open",
    kind: "action",
    repo: input.repo,
    args: sanitizeGitArgs(args),
    durationMs: Math.max(0, Date.now() - startedAt),
    success: true,
    error: null
  });
  return { configured: true };
}
