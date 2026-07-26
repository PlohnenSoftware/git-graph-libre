import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { simpleGit, type SimpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { commitDetails } from "@/backend/queries/commitDetails";
import type { GitCommitDetails, QueryResult } from "@/backend/types";

import { git, makeRepo } from "@tests/backend/helpers";

let repo: string;
let commitHash: string;

function expectCommitDetails(result: QueryResult<"commitDetails">): GitCommitDetails {
  expect(result.error).toBeNull();
  expect(result.commitDetails).not.toBeNull();
  if (result.commitDetails === null) throw new Error("Expected commit details");
  return result.commitDetails;
}

beforeAll(() => {
  repo = makeRepo();
  commitHash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("commitDetails", () => {
  it("returns commit details with expected fields", async () => {
    const result = await commitDetails(simpleGit(repo), {
      commitHash,
      dateType: "Author Date"
    });
    expect(result).toEqual({
      commitDetails: {
        hash: commitHash,
        parents: expect.any(Array),
        author: expect.any(String),
        email: expect.any(String),
        authorDate: expect.any(Number),
        committer: expect.any(String),
        committerEmail: expect.any(String),
        committerDate: expect.any(Number),
        body: expect.any(String),
        fileChanges: expect.any(Array)
      },
      error: null
    });
    expect(expectCommitDetails(result).authorDate).toBeGreaterThan(0);
    expect(expectCommitDetails(result).committerDate).toBeGreaterThan(0);
  });

  it("returns file changes for the initial commit", async () => {
    const result = await commitDetails(simpleGit(repo), { commitHash, dateType: "Author Date" });
    expect(expectCommitDetails(result).fileChanges.length).toBeGreaterThan(0);
  });

  it("keeps author and committer names containing separator-like text", async () => {
    const separatorRepo = makeRepo();
    const name = "T XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb Name";
    try {
      git(["config", "user.name", name], separatorRepo);
      fs.writeFileSync(path.join(separatorRepo, "separator"), "value");
      git(["add", "."], separatorRepo);
      git(["commit", "-m", "separator author"], separatorRepo);
      const hash = cp
        .execFileSync("git", ["rev-parse", "HEAD"], { cwd: separatorRepo })
        .toString()
        .trim();

      const result = await commitDetails(simpleGit(separatorRepo), {
        commitHash: hash,
        dateType: "Author Date"
      });

      const details = expectCommitDetails(result);
      expect(details.author).toBe(name);
      expect(details.committer).toBe(name);
    } finally {
      fs.rmSync(separatorRepo, { recursive: true, force: true });
    }
  });

  it("returns distinct author and committer identities and dates", async () => {
    const metadataRepo = makeRepo();
    const authorDate = "2024-01-02T03:04:05+00:00";
    const committerDate = "2024-02-03T04:05:06+00:00";
    try {
      fs.writeFileSync(path.join(metadataRepo, "metadata"), "value");
      git(["add", "."], metadataRepo);
      cp.execFileSync("git", ["commit", "--no-gpg-sign", "-m", "distinct metadata"], {
        cwd: metadataRepo,
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "Original Author",
          GIT_AUTHOR_EMAIL: "author@example.com",
          GIT_AUTHOR_DATE: authorDate,
          GIT_COMMITTER_NAME: "Commit Integrator",
          GIT_COMMITTER_EMAIL: "committer@example.com",
          GIT_COMMITTER_DATE: committerDate
        }
      });
      const hash = cp
        .execFileSync("git", ["rev-parse", "HEAD"], { cwd: metadataRepo })
        .toString()
        .trim();

      const details = expectCommitDetails(
        await commitDetails(simpleGit(metadataRepo), {
          commitHash: hash,
          dateType: "Commit Date"
        })
      );

      expect(details.author).toBe("Original Author");
      expect(details.email).toBe("author@example.com");
      expect(details.authorDate).toBe(Date.parse(authorDate) / 1000);
      expect(details.committer).toBe("Commit Integrator");
      expect(details.committerEmail).toBe("committer@example.com");
      expect(details.committerDate).toBe(Date.parse(committerDate) / 1000);
    } finally {
      fs.rmSync(metadataRepo, { recursive: true, force: true });
    }
  });

  it("returns commitDetails: null with a typed error when Git fails", async () => {
    const failure = Object.assign(new Error("fatal: deadbeef1234 is missing"), {
      result: { exitCode: 128, stdErr: "fatal: deadbeef1234 is missing" }
    });
    const failingGit = {
      raw: async () => {
        throw failure;
      }
    } as unknown as SimpleGit;

    const result = await commitDetails(failingGit, {
      commitHash: "deadbeef1234",
      dateType: "Author Date"
    });
    expect(result.commitDetails).toBeNull();
    expect(result.error).not.toBeNull();
    if (result.error === null) throw new Error("Expected query error");
    expect(result.error.message).toContain("deadbeef1234");
    expect(result.error.stderr).toBe("fatal: deadbeef1234 is missing");
    expect(result.error.exitCode).toBe(128);
  });

  it("includes additions and deletions for a modified file", async () => {
    const repo2 = makeRepo();
    try {
      fs.writeFileSync(path.join(repo2, "f"), "modified content");
      git(["add", "."], repo2);
      git(["commit", "-m", "mod"], repo2);
      const hash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo2 }).toString().trim();

      const result = await commitDetails(simpleGit(repo2), {
        commitHash: hash,
        dateType: "Author Date"
      });
      const changed = expectCommitDetails(result).fileChanges.find((f) => f.newFilePath === "f");
      expect(changed).toBeDefined();
      if (changed === undefined) throw new Error("Expected changed file");
      expect(changed.additions).toEqual(expect.any(Number));
      expect(changed.deletions).toEqual(expect.any(Number));
    } finally {
      fs.rmSync(repo2, { recursive: true, force: true });
    }
  });

  it("keeps file paths containing tabs in file changes and stats", async () => {
    const tabRepo = makeRepo();
    const relativePath = "dir/a\tb.txt";
    try {
      fs.mkdirSync(path.join(tabRepo, "dir"));
      fs.writeFileSync(path.join(tabRepo, relativePath), "tabbed path");
      git(["add", "."], tabRepo);
      git(["commit", "-m", "add tabbed path"], tabRepo);
      const hash = cp
        .execFileSync("git", ["rev-parse", "HEAD"], { cwd: tabRepo })
        .toString()
        .trim();

      const result = await commitDetails(simpleGit(tabRepo), {
        commitHash: hash,
        dateType: "Author Date"
      });

      const changed = expectCommitDetails(result).fileChanges.find(
        (file) => file.newFilePath === relativePath
      );
      expect(changed).toBeDefined();
      if (changed === undefined) throw new Error("Expected changed tabbed-path file");
      expect(changed.oldFilePath).toBe(relativePath);
      expect(changed.additions).toEqual(expect.any(Number));
      expect(changed.deletions).toEqual(expect.any(Number));
    } finally {
      fs.rmSync(tabRepo, { recursive: true, force: true });
    }
  });

  it("keeps old and new paths for renamed files", async () => {
    const renameRepo = makeRepo();
    try {
      git(["mv", "f", "renamed.txt"], renameRepo);
      git(["commit", "-m", "rename file"], renameRepo);
      const hash = cp
        .execFileSync("git", ["rev-parse", "HEAD"], { cwd: renameRepo })
        .toString()
        .trim();

      const result = await commitDetails(simpleGit(renameRepo), {
        commitHash: hash,
        dateType: "Author Date"
      });

      const renamed = expectCommitDetails(result).fileChanges.find(
        (file) => file.newFilePath === "renamed.txt"
      );
      expect(renamed).toBeDefined();
      if (renamed === undefined) throw new Error("Expected renamed file");
      expect(renamed.oldFilePath).toBe("f");
      expect(renamed.type).toBe("R");
      expect(renamed.additions).toEqual(expect.any(Number));
      expect(renamed.deletions).toEqual(expect.any(Number));
    } finally {
      fs.rmSync(renameRepo, { recursive: true, force: true });
    }
  });

  it("returns both dates when dateType is Commit Date", async () => {
    const result = await commitDetails(simpleGit(repo), { commitHash, dateType: "Commit Date" });
    expect(result).toEqual({
      commitDetails: {
        hash: commitHash,
        parents: expect.any(Array),
        author: expect.any(String),
        email: expect.any(String),
        authorDate: expect.any(Number),
        committer: expect.any(String),
        committerEmail: expect.any(String),
        committerDate: expect.any(Number),
        body: expect.any(String),
        fileChanges: expect.any(Array)
      },
      error: null
    });
    expect(expectCommitDetails(result).authorDate).toBeGreaterThan(0);
    expect(expectCommitDetails(result).committerDate).toBeGreaterThan(0);
  });

  it("body contains the commit message", async () => {
    const result = await commitDetails(simpleGit(repo), { commitHash, dateType: "Author Date" });
    expect(expectCommitDetails(result).body).toContain("init");
  });
});
