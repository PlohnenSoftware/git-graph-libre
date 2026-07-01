import type { SimpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import {
  GitCommandError,
  type GitCommandRecord,
  runGitCommand,
  runGitRaw,
  sanitizeGitArgs
} from "@/backend/utils/gitRunner";

describe("gitRunner", () => {
  it("records successful raw commands with sanitized args", async () => {
    const records: GitCommandRecord[] = [];
    const git = {
      raw: vi.fn(async () => "ok")
    } as unknown as SimpleGit;

    const result = await runGitRaw(git, {
      label: "test.fetch",
      args: ["fetch", "https://user:secret@example.com/repo.git", "--password=hidden"],
      repo: "/repo",
      record: (record) => records.push(record)
    });

    expect(result).toBe("ok");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      label: "test.fetch",
      kind: "query",
      repo: "/repo",
      args: ["fetch", "https://<redacted>@example.com/repo.git", "--password=<redacted>"],
      success: true,
      error: null
    });
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("redacts split secret arguments", () => {
    expect(sanitizeGitArgs(["remote", "add", "--token", "secret", "origin"])).toEqual([
      "remote",
      "add",
      "--token",
      "<redacted>",
      "origin"
    ]);
  });

  it("throws GitCommandError with normalized failure metadata", async () => {
    const records: GitCommandRecord[] = [];
    const failure = Object.assign(new Error("fatal: https://user:secret@example.com/repo.git"), {
      result: {
        exitCode: 128,
        stdErr: "fatal: https://user:secret@example.com/repo.git"
      },
      task: {
        commands: ["fetch", "origin"]
      }
    });

    await expect(
      runGitCommand(() => Promise.reject(failure), {
        label: "test.failure",
        args: ["fetch", "https://user:secret@example.com/repo.git"],
        repo: "/repo",
        record: (record) => records.push(record)
      })
    ).rejects.toBeInstanceOf(GitCommandError);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      label: "test.failure",
      kind: "query",
      repo: "/repo",
      args: ["fetch", "https://<redacted>@example.com/repo.git"],
      success: false,
      error: {
        message: "fatal: https://<redacted>@example.com/repo.git",
        exitCode: 128,
        stderr: "fatal: https://<redacted>@example.com/repo.git",
        task: "fetch origin"
      }
    });
  });
});
