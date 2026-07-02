import type { SimpleGit } from "simple-git";

import type { ActionPayload, GitConfigScope } from "@/backend/types";
import { GIT_CONFIG_SCOPES } from "@/backend/types";
import { type GitCommandRecorder, runGitRaw } from "@/backend/utils/gitRunner";

type UserConfigActionPayloads = {
  deleteUserDetails: ActionPayload<"deleteUserDetails">;
  editUserDetails: ActionPayload<"editUserDetails">;
};

type UserConfigActionInput<T extends keyof UserConfigActionPayloads> =
  UserConfigActionPayloads[T] & {
    repo?: string | null;
  };

const userNameKey = "user.name";
const userEmailKey = "user.email";

function requireValue(value: string, label: string) {
  if (value.trim() === "") throw new Error(`${label} is required.`);
}

function requireScope(scope: string): asserts scope is GitConfigScope {
  if (!(GIT_CONFIG_SCOPES as readonly string[]).includes(scope)) {
    throw new Error("Git config scope must be local or global.");
  }
}

async function setConfigValue(
  git: SimpleGit,
  input: { repo?: string | null; scope: GitConfigScope },
  key: string,
  value: string,
  record?: GitCommandRecorder
) {
  await runGitRaw(git, {
    label: `userConfig.set.${key}`,
    kind: "action",
    args: ["config", `--${input.scope}`, key, value],
    repo: input.repo ?? null,
    record
  });
}

async function unsetConfigValue(
  git: SimpleGit,
  input: { repo?: string | null; scope: GitConfigScope },
  key: string,
  record?: GitCommandRecorder
) {
  await runGitRaw(git, {
    label: `userConfig.unset.${key}`,
    kind: "action",
    args: ["config", `--${input.scope}`, "--unset-all", key],
    repo: input.repo ?? null,
    record
  });
}

export async function editUserDetails(
  git: SimpleGit,
  input: UserConfigActionInput<"editUserDetails">,
  record?: GitCommandRecorder
): Promise<void> {
  requireScope(input.scope);
  requireValue(input.name, "User name");
  requireValue(input.email, "User email");

  await setConfigValue(git, input, userNameKey, input.name, record);
  await setConfigValue(git, input, userEmailKey, input.email, record);

  if (input.scope === "global" && input.clearLocalName) {
    await unsetConfigValue(git, { repo: input.repo, scope: "local" }, userNameKey, record);
  }
  if (input.scope === "global" && input.clearLocalEmail) {
    await unsetConfigValue(git, { repo: input.repo, scope: "local" }, userEmailKey, record);
  }
}

export async function deleteUserDetails(
  git: SimpleGit,
  input: UserConfigActionInput<"deleteUserDetails">,
  record?: GitCommandRecorder
): Promise<void> {
  requireScope(input.scope);
  if (!input.unsetName && !input.unsetEmail) {
    throw new Error("At least one user detail must be selected for removal.");
  }

  if (input.unsetName) await unsetConfigValue(git, input, userNameKey, record);
  if (input.unsetEmail) await unsetConfigValue(git, input, userEmailKey, record);
}
