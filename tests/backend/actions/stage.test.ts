import * as fs from "node:fs";
import * as path from "node:path";
import { type SimpleGit, simpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";

import { stageFiles, unstageFiles } from "@/backend/actions/stage";

import { makeRepo } from "../helpers";

function gitWithRaw(raw: (args: string[]) => Promise<string> = async () => ""): SimpleGit {
  return { raw: vi.fn(raw) } as unknown as SimpleGit;
}

describe("stage actions", () => {
  it("stages and unstages file paths through git", async () => {
    const gitClient = gitWithRaw();

    await stageFiles(gitClient, { repo: "/repo", filePaths: ["a.txt", "sub/b.txt"] });
    await unstageFiles(gitClient, { repo: "/repo", filePaths: ["a.txt"] });

    expect(gitClient.raw).toHaveBeenNthCalledWith(1, ["add", "--", "a.txt", "sub/b.txt"]);
    expect(gitClient.raw).toHaveBeenNthCalledWith(2, ["reset", "HEAD", "--", "a.txt"]);
  });

  it("rejects empty path lists and option-like paths", async () => {
    const gitClient = gitWithRaw();

    await expect(stageFiles(gitClient, { repo: "/repo", filePaths: [] })).rejects.toThrow(
      "File paths are required."
    );
    await expect(
      unstageFiles(gitClient, { repo: "/repo", filePaths: ["ok.txt", "  "] })
    ).rejects.toThrow("File paths must not be empty.");
    await expect(stageFiles(gitClient, { repo: "/repo", filePaths: ["--"] })).rejects.toThrow(
      "File paths must not be empty."
    );
    expect(gitClient.raw).not.toHaveBeenCalled();
  });

  it("moves files between index and worktree in a real repository", async () => {
    const repo = makeRepo();
    const realGit = simpleGit(repo);
    fs.writeFileSync(path.join(repo, "f"), "change");
    fs.writeFileSync(path.join(repo, "fresh.txt"), "new");

    await stageFiles(realGit, { repo, filePaths: ["f", "fresh.txt"] });
    const staged = await realGit.raw(["diff", "--cached", "--name-only"]);
    expect(staged.split("\n").filter((line) => line !== "")).toEqual(
      expect.arrayContaining(["f", "fresh.txt"])
    );

    await unstageFiles(realGit, { repo, filePaths: ["f"] });
    const stagedAfter = await realGit.raw(["diff", "--cached", "--name-only"]);
    expect(stagedAfter.split("\n").filter((line) => line !== "")).toEqual(["fresh.txt"]);
    const unstaged = await realGit.raw(["diff", "--name-only"]);
    expect(unstaged.split("\n").filter((line) => line !== "")).toEqual(
      expect.arrayContaining(["f"])
    );
  });
});
