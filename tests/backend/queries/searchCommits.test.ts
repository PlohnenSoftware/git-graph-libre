import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { type SimpleGit, simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchCommits } from "@/backend/queries/searchCommits";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

let repo: string;
let archivedHash: string;
let authorHash: string;

function commitFile(fileName: string, content: string, message: string, author?: string) {
  fs.writeFileSync(path.join(repo, fileName), content);
  git(["add", "."], repo);
  const args = ["commit"];
  if (author !== undefined) args.push("--author", author);
  args.push("-m", message);
  git(args, repo);
  return cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
}

beforeAll(() => {
  repo = makeRepo();
  archivedHash = commitFile("archived", "archived\n", "Deep archived fix");
  authorHash = commitFile(
    "author",
    "author\n",
    "Document search behavior",
    "Alice Example <alice@example.com>"
  );
  git(["tag", "v-search"], repo);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("searchCommits", () => {
  it("finds commit messages beyond the first loaded commit and reports load count", async () => {
    const result = await searchCommits(simpleGit(repo), {
      query: "archived",
      maxResults: 10,
      showRemoteBranches: false,
      dateType: "Author Date"
    });

    expect(result.error).toBeNull();
    expect(result.results).toEqual([
      expect.objectContaining({
        hash: archivedHash,
        message: "Deep archived fix",
        loadCount: 2
      })
    ]);
  });

  it("excludes hidden remotes from search ranges and load positions", async () => {
    const records: GitCommandRecord[] = [];

    const result = await searchCommits(simpleGit(repo), {
      query: "archived",
      maxResults: 10,
      showRemoteBranches: true,
      hiddenRemotes: ["origin"],
      dateType: "Author Date",
      repo,
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.error).toBeNull();
    const rangedRecords = records.filter((record) =>
      ["searchCommits.message", "searchCommits.author", "searchCommits.positions"].includes(
        record.label
      )
    );
    expect(rangedRecords.length).toBeGreaterThan(0);
    expect(
      rangedRecords.every((record) => record.args.includes("--exclude=refs/remotes/origin/*"))
    ).toBe(true);
  });

  it("finds authors and emails without duplicating the same commit", async () => {
    const result = await searchCommits(simpleGit(repo), {
      query: "alice@example.com",
      maxResults: 10,
      showRemoteBranches: false,
      dateType: "Author Date"
    });

    expect(result.error).toBeNull();
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      hash: authorHash,
      author: "Alice Example",
      email: "alice@example.com",
      loadCount: 1
    });
  });

  it("limits history search and load positions to selected filters", async () => {
    const records: GitCommandRecord[] = [];

    const result = await searchCommits(simpleGit(repo), {
      query: "archived",
      maxResults: 10,
      showRemoteBranches: true,
      showTags: true,
      branches: ["main"],
      authors: ["T"],
      tags: ["v-search"],
      dateType: "Author Date",
      repo,
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.error).toBeNull();
    const rangedRecords = records.filter((record) =>
      ["searchCommits.message", "searchCommits.author", "searchCommits.positions"].includes(
        record.label
      )
    );
    expect(rangedRecords.length).toBe(3);
    for (const record of rangedRecords) {
      expect(record.args).toEqual(expect.arrayContaining(["main", "refs/tags/v-search", "--"]));
      expect(record.args).not.toContain("--branches");
    }
    expect(rangedRecords.every((record) => record.args.includes("--author=T"))).toBe(true);
  });

  it("finds commit hash prefixes", async () => {
    const result = await searchCommits(simpleGit(repo), {
      query: archivedHash.slice(0, 8),
      maxResults: 10,
      showRemoteBranches: false,
      dateType: "Author Date"
    });

    expect(result.error).toBeNull();
    expect(result.results[0]).toMatchObject({
      hash: archivedHash,
      loadCount: 2
    });
  });

  it("does not run Git for empty queries", async () => {
    const records: GitCommandRecord[] = [];
    const result = await searchCommits(simpleGit(repo), {
      query: "   ",
      maxResults: 10,
      showRemoteBranches: false,
      dateType: "Author Date",
      recordGitCommand: (record) => records.push(record)
    });

    expect(result).toEqual({ results: [], error: null });
    expect(records).toHaveLength(0);
  });

  it("exposes typed Git failures", async () => {
    const failure = Object.assign(new Error("fatal: bad revision"), {
      result: { exitCode: 128, stdErr: "fatal: bad revision" }
    });
    const records: GitCommandRecord[] = [];
    const gitClient = {
      raw: async () => {
        throw failure;
      }
    } as unknown as SimpleGit;

    const result = await searchCommits(gitClient, {
      query: "anything",
      maxResults: 10,
      showRemoteBranches: false,
      dateType: "Author Date",
      repo: "/repo",
      recordGitCommand: (record) => records.push(record)
    });

    expect(result).toEqual({
      results: [],
      error: {
        message: "fatal: bad revision",
        stderr: "fatal: bad revision",
        exitCode: 128,
        task: null
      }
    });
    expect(records.some((record) => record.label === "searchCommits.message")).toBe(true);
    expect(records.some((record) => record.success === false)).toBe(true);
  });
});
