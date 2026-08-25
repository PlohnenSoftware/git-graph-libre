import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type AddRemoteInput = ActionPayload<"addRemote"> & { repo: string };
type DeleteRemoteInput = ActionPayload<"deleteRemote"> & { repo: string };
type EditRemoteInput = ActionPayload<"editRemote"> & { repo: string };
type FetchRemotesInput = ActionPayload<"fetchRemotes"> & { repo: string };
type FetchTagsInput = ActionPayload<"fetchTags"> & { repo: string };
type PruneRemoteInput = ActionPayload<"pruneRemote"> & { repo: string };
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

function cleanRemoteName(name: string) {
  return name.trim();
}

function cleanRemoteUrl(url: string) {
  return url.trim();
}

function requiredValue(value: string, label: string) {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error(`${label} cannot be empty.`);
  return trimmed;
}

async function fetchRemote(
  git: SimpleGit,
  repo: string,
  remote: string | null,
  prune: boolean,
  pruneTags: boolean,
  record?: GitCommandRecorder
) {
  if (pruneTags && !prune) {
    throw new Error("--prune-tags requires prune to be enabled.");
  }
  if (pruneTags) await assertPruneTagsSupported(git, repo, record);

  const args = remote === null ? ["fetch", "--all"] : ["fetch", remote];
  if (prune) args.push("--prune");
  if (pruneTags) args.push("--prune-tags");

  await runGitRaw(git, {
    label: remote === null ? "fetchRemotes.fetch" : "fetchRemotes.fetchRemote",
    kind: "action",
    args,
    repo,
    record
  });
}

export async function addRemote(
  git: SimpleGit,
  input: AddRemoteInput,
  record?: GitCommandRecorder
): Promise<void> {
  const name = requiredValue(input.name, "Remote name");
  const fetchUrl = requiredValue(input.fetchUrl, "Remote URL");
  const pushUrl = cleanRemoteUrl(input.pushUrl ?? "");

  await runGitRaw(git, {
    label: "remote.add",
    kind: "action",
    args: ["remote", "add", name, fetchUrl],
    repo: input.repo,
    record
  });

  if (pushUrl !== "") {
    await runGitRaw(git, {
      label: "remote.addPushUrl",
      kind: "action",
      args: ["remote", "set-url", "--push", name, pushUrl],
      repo: input.repo,
      record
    });
  }

  if (input.fetch) {
    await fetchRemote(git, input.repo, name, false, false, record);
  }
}

export async function editRemote(
  git: SimpleGit,
  input: EditRemoteInput,
  record?: GitCommandRecorder
): Promise<void> {
  const oldName = requiredValue(input.oldName, "Old remote name");
  const name = requiredValue(input.name, "Remote name");
  const fetchUrl = requiredValue(input.fetchUrl, "Remote URL");
  const pushUrl = cleanRemoteUrl(input.pushUrl ?? "");

  if (oldName !== name) {
    await runGitRaw(git, {
      label: "remote.rename",
      kind: "action",
      args: ["remote", "rename", oldName, name],
      repo: input.repo,
      record
    });
  }

  await runGitRaw(git, {
    label: "remote.setUrl",
    kind: "action",
    args: ["remote", "set-url", name, fetchUrl],
    repo: input.repo,
    record
  });

  if (pushUrl === "") {
    const existingPushUrls = await git
      .raw(["config", "--get-all", `remote.${name}.pushurl`])
      .catch(() => "");
    if (existingPushUrls.trim() !== "") {
      await runGitRaw(git, {
        label: "remote.clearPushUrl",
        kind: "action",
        args: ["config", "--unset-all", `remote.${name}.pushurl`],
        repo: input.repo,
        record
      });
    }
  } else {
    await runGitRaw(git, {
      label: "remote.setPushUrl",
      kind: "action",
      args: ["remote", "set-url", "--push", name, pushUrl],
      repo: input.repo,
      record
    });
  }
}

export async function deleteRemote(
  git: SimpleGit,
  input: DeleteRemoteInput,
  record?: GitCommandRecorder
): Promise<void> {
  const name = requiredValue(input.name, "Remote name");
  await runGitRaw(git, {
    label: "remote.delete",
    kind: "action",
    args: ["remote", "remove", name],
    repo: input.repo,
    record
  });
}

export async function pruneRemote(
  git: SimpleGit,
  input: PruneRemoteInput,
  record?: GitCommandRecorder
): Promise<void> {
  const name = requiredValue(input.name, "Remote name");
  await runGitRaw(git, {
    label: "remote.prune",
    kind: "action",
    args: ["remote", "prune", name],
    repo: input.repo,
    record
  });
}

export async function fetchRemotes(
  git: SimpleGit,
  input: FetchRemotesInput,
  record?: GitCommandRecorder
): Promise<void> {
  const remote = cleanRemoteName(input.remote ?? "");
  await fetchRemote(
    git,
    input.repo,
    remote === "" ? null : remote,
    input.prune,
    input.pruneTags,
    record
  );
}

export async function fetchTags(
  git: SimpleGit,
  input: FetchTagsInput,
  record?: GitCommandRecorder
): Promise<void> {
  const remotes = input.remotes.map(cleanRemoteName).filter((remote) => remote !== "");
  if (remotes.length === 0) {
    throw new Error("No remotes were selected for fetching tags.");
  }
  if (input.pruneTags) await assertPruneTagsSupported(git, input.repo, record);

  for (const remote of remotes) {
    const args = ["fetch", remote];
    // `--prune-tags` only removes local tags when `--prune` is also present,
    // so prune is implied for the tag refspec this fetch installs.
    if (input.pruneTags) args.push("--prune", "--prune-tags");
    args.push("--tags");
    await runGitRaw(git, {
      label: "remote.fetchTags",
      kind: "action",
      args,
      repo: input.repo,
      record
    });
  }
}
