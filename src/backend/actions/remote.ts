import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type FetchRemotesInput = ActionPayload<"fetchRemotes"> & { repo: string };
type GitVersion = {
  major: number;
  minor: number;
};

const pruneTagsMinimumVersion: GitVersion = {
  major: 2,
  minor: 17
};

function parseGitVersion(stdout: string): GitVersion | null {
  const versionStart = stdout.search(/\d/);
  if (versionStart === -1) return null;

  const parts = stdout
    .slice(versionStart)
    .split(/[^\d]+/)
    .filter((part) => part !== "");
  if (parts.length < 2) return null;

  const major = Number.parseInt(parts[0], 10);
  const minor = Number.parseInt(parts[1], 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) return null;
  return { major, minor };
}

function supportsPruneTags(version: GitVersion | null) {
  if (version === null) return false;
  if (version.major > pruneTagsMinimumVersion.major) return true;
  return (
    version.major === pruneTagsMinimumVersion.major &&
    version.minor >= pruneTagsMinimumVersion.minor
  );
}

async function assertPruneTagsSupported(git: SimpleGit, repo: string, record?: GitCommandRecorder) {
  const stdout = await runGitRaw(git, {
    label: "fetchRemotes.version",
    kind: "action",
    args: ["--version"],
    repo,
    record
  });
  if (!supportsPruneTags(parseGitVersion(stdout))) {
    throw new Error("Git 2.17 or newer is required to fetch with --prune-tags.");
  }
}

export async function fetchRemotes(
  git: SimpleGit,
  input: FetchRemotesInput,
  record?: GitCommandRecorder
): Promise<void> {
  if (input.pruneTags && !input.prune) {
    throw new Error("--prune-tags requires prune to be enabled.");
  }
  if (input.pruneTags) await assertPruneTagsSupported(git, input.repo, record);

  const args = ["fetch", "--all"];
  if (input.prune) args.push("--prune");
  if (input.pruneTags) args.push("--prune-tags");

  await runGitRaw(git, {
    label: "fetchRemotes.fetch",
    kind: "action",
    args,
    repo: input.repo,
    record
  });
}
