import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";
import { resolveRef } from "@/backend/queries/resolveRef";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const repos: string[] = [];

function head(repo: string) {
  return cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
}

function trackedRepo() {
  const repo = makeRepo();
  repos.push(repo);
  const first = head(repo);
  fs.writeFileSync(path.join(repo, "f"), "y");
  git(["add", "."], repo);
  git(["commit", "-m", "second"], repo);
  const second = head(repo);
  git(["branch", "old", first], repo);
  git(["tag", "v-light"], repo);
  git(["tag", "-a", "v-annotated", "-m", "Annotated", first], repo);
  return { repo, first, second };
}

afterEach(() => {
  while (repos.length > 0) {
    const repo = repos.pop();
    if (repo !== undefined) fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe("resolveRef", () => {
  it("resolves a branch to its full commit hash", async () => {
    const { repo, first, second } = trackedRepo();

    await expect(resolveRef(simpleGit(repo), { repo, ref: "main" })).resolves.toEqual({
      hash: second,
      error: null
    });
    await expect(resolveRef(simpleGit(repo), { repo, ref: "old" })).resolves.toEqual({
      hash: first,
      error: null
    });
  });

  it("resolves a lightweight tag to its commit hash", async () => {
    const { repo, second } = trackedRepo();

    await expect(resolveRef(simpleGit(repo), { repo, ref: "v-light" })).resolves.toEqual({
      hash: second,
      error: null
    });
  });

  it("peels an annotated tag to its commit hash", async () => {
    const { repo, first } = trackedRepo();

    await expect(resolveRef(simpleGit(repo), { repo, ref: "v-annotated" })).resolves.toEqual({
      hash: first,
      error: null
    });
  });

  it("resolves a full SHA and a 7-character SHA", async () => {
    const { repo, second } = trackedRepo();

    await expect(resolveRef(simpleGit(repo), { repo, ref: second })).resolves.toEqual({
      hash: second,
      error: null
    });
    await expect(resolveRef(simpleGit(repo), { repo, ref: second.slice(0, 7) })).resolves.toEqual({
      hash: second,
      error: null
    });
  });

  it("resolves HEAD~1 and trims surrounding whitespace", async () => {
    const { repo, first, second } = trackedRepo();

    await expect(resolveRef(simpleGit(repo), { repo, ref: "HEAD~1" })).resolves.toEqual({
      hash: first,
      error: null
    });
    await expect(resolveRef(simpleGit(repo), { repo, ref: "  main  " })).resolves.toEqual({
      hash: second,
      error: null
    });
  });

  it.each([
    ["an empty string", ""],
    ["a short option", "-x"],
    ["a long option", "--all"],
    ["text with a space", "a b"],
    ["a rev:path object name", "HEAD:file"]
  ])("rejects %s without running Git", async (_label, ref) => {
    const { repo } = trackedRepo();
    const records: GitCommandRecord[] = [];

    const result = await resolveRef(simpleGit(repo), {
      repo,
      ref,
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.hash).toBeNull();
    expect(result.error).not.toBeNull();
    expect(records).toEqual([]);
  });

  it("rejects control characters without running Git", async () => {
    const { repo } = trackedRepo();
    const records: GitCommandRecord[] = [];

    const result = await resolveRef(simpleGit(repo), {
      repo,
      ref: "a\u0001b",
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.hash).toBeNull();
    expect(result.error?.message).toContain("control characters");
    expect(records).toEqual([]);
  });

  it.each([
    ["an unknown name", "no-such-ref"],
    ["a tree", "HEAD^{tree}"]
  ])("reports %s as not a commit", async (_label, ref) => {
    const { repo } = trackedRepo();
    const records: GitCommandRecord[] = [];

    const result = await resolveRef(simpleGit(repo), {
      repo,
      ref,
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.hash).toBeNull();
    expect(result.error?.message).toContain("not a commit");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ label: "resolveRef" });
  });
});
