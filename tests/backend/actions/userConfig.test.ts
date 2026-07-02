import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { deleteUserDetails, editUserDetails } from "@/backend/actions/userConfig";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

function makeGitRecorder() {
  const raw = vi.fn(async (_args: string[]) => "");
  const records: GitCommandRecord[] = [];
  return {
    git: { raw } as unknown as SimpleGit,
    raw,
    records,
    record: (entry: GitCommandRecord) => records.push(entry)
  };
}

describe("user config actions", () => {
  it("sets global user details and clears selected local overrides", async () => {
    const { git, raw, record, records } = makeGitRecorder();

    await editUserDetails(
      git,
      {
        repo: "/repo",
        scope: "global",
        name: "Ada",
        email: "ada@example.test",
        clearLocalName: true,
        clearLocalEmail: false
      },
      record
    );

    expect(raw.mock.calls.map(([args]) => args)).toEqual([
      ["config", "--global", "user.name", "Ada"],
      ["config", "--global", "user.email", "ada@example.test"],
      ["config", "--local", "--unset-all", "user.name"]
    ]);
    expect(records.map((entry) => entry.kind)).toEqual(["action", "action", "action"]);
  });

  it("unsets only selected local user detail keys", async () => {
    const { git, raw, record } = makeGitRecorder();

    await deleteUserDetails(
      git,
      {
        repo: "/repo",
        scope: "local",
        unsetName: false,
        unsetEmail: true
      },
      record
    );

    expect(raw.mock.calls.map(([args]) => args)).toEqual([
      ["config", "--local", "--unset-all", "user.email"]
    ]);
  });

  it("rejects empty user details before running git config", async () => {
    const { git, raw } = makeGitRecorder();

    await expect(
      editUserDetails(git, {
        repo: "/repo",
        scope: "local",
        name: "",
        email: "ada@example.test",
        clearLocalName: false,
        clearLocalEmail: false
      })
    ).rejects.toThrow("User name is required.");
    expect(raw).not.toHaveBeenCalled();
  });

  it("rejects invalid scopes and empty delete selections", async () => {
    const { git, raw } = makeGitRecorder();

    await expect(
      deleteUserDetails(git, {
        repo: "/repo",
        scope: "workspace" as never,
        unsetName: true,
        unsetEmail: false
      })
    ).rejects.toThrow("Git config scope must be local or global.");
    await expect(
      deleteUserDetails(git, {
        repo: "/repo",
        scope: "local",
        unsetName: false,
        unsetEmail: false
      })
    ).rejects.toThrow("At least one user detail must be selected for removal.");
    expect(raw).not.toHaveBeenCalled();
  });
});
