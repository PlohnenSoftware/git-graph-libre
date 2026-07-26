import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { type SimpleGit, simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCommits, parseCommitSignature } from "@/backend/queries/loadCommits";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

let repo: string;
let repoWithRemote: string;
let remoteRepo: string;

beforeAll(() => {
  repo = makeRepo();
  fs.writeFileSync(path.join(repo, "f2"), "y");
  git(["add", "."], repo);
  git(["commit", "-m", "second"], repo);

  remoteRepo = makeRepo();
  repoWithRemote = makeRepo();
  git(["remote", "add", "origin", remoteRepo], repoWithRemote);
  git(["fetch", "origin"], repoWithRemote);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(repoWithRemote, { recursive: true, force: true });
  fs.rmSync(remoteRepo, { recursive: true, force: true });
});

describe("loadCommits", () => {
  it("maps Git signature states and keeps unsigned commits distinct", () => {
    expect(parseCommitSignature("N", "", "")).toBeNull();
    expect(parseCommitSignature("", "", "")).toBeNull();
    expect(parseCommitSignature("G", "Alice", "ABC123")).toEqual({
      status: "valid",
      signer: "Alice",
      key: "ABC123"
    });
    expect(parseCommitSignature("U", "Alice", "ABC123")?.status).toBe("valid-untrusted");
    expect(parseCommitSignature("B", "", "")?.status).toBe("bad");
    expect(parseCommitSignature("X", "", "")?.status).toBe("expired");
    expect(parseCommitSignature("Y", "", "")?.status).toBe("expired-key");
    expect(parseCommitSignature("R", "", "")?.status).toBe("revoked-key");
    expect(parseCommitSignature("E", "", "")?.status).toBe("unverifiable");
    expect(parseCommitSignature("?", "", "")?.status).toBe("unknown");
  });

  it("only asks Git to verify signatures when the column is visible", async () => {
    const hiddenRecords: GitCommandRecord[] = [];
    await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      showSignature: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false,
      recordGitCommand: (record) => hiddenRecords.push(record)
    });
    const hiddenFormat = hiddenRecords
      .find((record) => record.label === "loadCommits.log")
      ?.args.find((arg) => arg.startsWith("--format="));
    expect(hiddenFormat).not.toContain("%G?");

    const visibleRecords: GitCommandRecord[] = [];
    const visibleResult = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      showSignature: true,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false,
      recordGitCommand: (record) => visibleRecords.push(record)
    });
    const visibleFormat = visibleRecords
      .find((record) => record.label === "loadCommits.log")
      ?.args.find((arg) => arg.startsWith("--format="));
    expect(visibleFormat).toContain("%G?");
    expect(visibleFormat).toContain("%GS");
    expect(visibleFormat).toContain("%GK");
    expect(visibleResult.commits.every((commit) => commit.signature === null)).toBe(true);
  });

  it("parses signer and key metadata into commit nodes", async () => {
    const signedLog = [
      "abc123",
      "",
      "Alice",
      "alice@example.com",
      "1700000000",
      "Signed commit",
      "G",
      "Alice Signer",
      "ABC123"
    ].join("\0");
    const signedGit = {
      raw: async (args: string[]) => {
        if (args[0] === "log") return `${signedLog}\0`;
        if (args[0] === "rev-parse") return "abc123\n";
        if (args[0] === "for-each-ref") return "abc123\0refs/heads/main\0\0\n";
        throw new Error(`unexpected git command: ${args[0]}`);
      }
    } as unknown as SimpleGit;

    const result = await loadCommits(signedGit, {
      branchName: "main",
      maxCommits: 10,
      showRemoteBranches: false,
      showSignature: true,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });

    expect(result.error).toBeNull();
    expect(result.commits[0].signature).toEqual({
      status: "valid",
      signer: "Alice Signer",
      key: "ABC123"
    });
  });

  it("returns commits with expected fields", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result).toEqual({
      commits: expect.any(Array),
      head: expect.any(String),
      moreCommitsAvailable: false,
      hard: false,
      error: null
    });
    expect(result.commits.length).toBeGreaterThan(0);
    expect(result.commits[0]).toEqual({
      hash: expect.any(String),
      parentHashes: expect.any(Array),
      author: expect.any(String),
      email: expect.any(String),
      date: expect.any(Number),
      message: expect.any(String),
      refs: expect.any(Array)
    });
  });

  it("attaches HEAD ref to the current commit and sets head correctly", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result.head).not.toBeNull();
    const headCommit = result.commits.find((c) => c.hash === result.head);
    expect(headCommit).toBeDefined();
    expect(headCommit?.refs.some((r) => r.type === "head")).toBe(true);
  });

  it("limits to maxCommits and sets moreCommitsAvailable: true", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 1,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result).toEqual({
      commits: expect.any(Array),
      head: expect.any(String),
      moreCommitsAvailable: true,
      hard: false,
      error: null
    });
    expect(result.commits.length).toBe(1);
  });

  it("moreCommitsAvailable is false when all commits fit", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result).toEqual({
      commits: expect.any(Array),
      head: expect.any(String),
      moreCommitsAvailable: false,
      hard: false,
      error: null
    });
  });

  it("filters commits to the given branch", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchName: "main",
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result.commits.length).toBeGreaterThan(0);
  });

  it("keeps commits whose subject contains separator-like text", async () => {
    const separatorRepo = makeRepo();
    const subject = "subject includes XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb text";
    try {
      fs.writeFileSync(path.join(separatorRepo, "separator"), "value");
      git(["add", "."], separatorRepo);
      git(["commit", "-m", subject], separatorRepo);

      const result = await loadCommits(simpleGit(separatorRepo), {
        branchName: "",
        maxCommits: 300,
        showRemoteBranches: false,
        hard: false,
        dateType: "Author Date",
        showUncommittedChanges: false
      });

      expect(result.error).toBeNull();
      expect(result.commits.some((commit) => commit.message === subject)).toBe(true);
    } finally {
      fs.rmSync(separatorRepo, { recursive: true, force: true });
    }
  });

  it("prepends uncommitted-changes commit when working tree is dirty", async () => {
    const dirtyRepo = makeRepo();
    try {
      fs.writeFileSync(path.join(dirtyRepo, "untracked"), "z");
      const result = await loadCommits(simpleGit(dirtyRepo), {
        branchName: "",
        maxCommits: 300,
        showRemoteBranches: false,
        hard: false,
        dateType: "Author Date",
        showUncommittedChanges: true
      });
      expect(result.commits[0]).toEqual({
        hash: "*",
        parentHashes: [result.head],
        author: "*",
        email: "",
        date: expect.any(Number),
        message: expect.stringMatching(/^Uncommitted Changes \(\d+\)$/),
        refs: []
      });
    } finally {
      fs.rmSync(dirtyRepo, { recursive: true, force: true });
    }
  });

  it("does not prepend uncommitted-changes commit when showUncommittedChanges is false", async () => {
    const dirtyRepo = makeRepo();
    try {
      fs.writeFileSync(path.join(dirtyRepo, "untracked"), "z");
      const result = await loadCommits(simpleGit(dirtyRepo), {
        branchName: "",
        maxCommits: 300,
        showRemoteBranches: false,
        hard: false,
        dateType: "Author Date",
        showUncommittedChanges: false
      });
      expect(result.commits[0].hash).not.toBe("*");
    } finally {
      fs.rmSync(dirtyRepo, { recursive: true, force: true });
    }
  });

  it("does not include remote refs when showRemoteBranches is false", async () => {
    const result = await loadCommits(simpleGit(repoWithRemote), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    const allRefs = result.commits.flatMap((c) => c.refs);
    expect(allRefs.every((r) => r.type !== "remote")).toBe(true);
  });

  it("includes remote refs when showRemoteBranches is true", async () => {
    const result = await loadCommits(simpleGit(repoWithRemote), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: true,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false
    });

    const allRefs = result.commits.flatMap((c) => c.refs);
    expect(allRefs.some((r) => r.type === "remote" && r.name === "origin/main")).toBe(true);
  });

  it("excludes selected remote refs and remote log ranges", async () => {
    const records: GitCommandRecord[] = [];

    const result = await loadCommits(simpleGit(repoWithRemote), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: true,
      hiddenRemotes: ["origin"],
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false,
      repo: repoWithRemote,
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.error).toBeNull();
    const allRefs = result.commits.flatMap((c) => c.refs);
    expect(allRefs.some((r) => r.type === "remote" && r.name.startsWith("origin/"))).toBe(false);
    const logRecord = records.find((record) => record.label === "loadCommits.log");
    expect(logRecord?.args).toEqual(
      expect.arrayContaining(["--exclude=refs/remotes/origin/*", "--remotes"])
    );
  });

  it("attaches annotated tags to their peeled commit", async () => {
    const taggedRepo = makeRepo();
    try {
      git(["tag", "-a", "v1", "-m", "release"], taggedRepo);
      const result = await loadCommits(simpleGit(taggedRepo), {
        branchName: "",
        maxCommits: 300,
        showRemoteBranches: false,
        hard: false,
        dateType: "Author Date",
        showUncommittedChanges: false
      });

      const headCommit = result.commits.find((commit) => commit.hash === result.head);
      expect(headCommit).toBeDefined();
      expect(headCommit?.refs.some((ref) => ref.type === "tag" && ref.name === "v1")).toBe(true);
    } finally {
      fs.rmSync(taggedRepo, { recursive: true, force: true });
    }
  });

  it("uses commit date when dateType is Commit Date", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Commit Date",
      showUncommittedChanges: false
    });
    expect(result.commits.length).toBeGreaterThan(0);
    expect(result.commits[0].date).toBeGreaterThan(0);
  });

  it("passes the selected commit ordering to git log", async () => {
    const records: GitCommandRecord[] = [];

    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      commitOrdering: "topo",
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false,
      repo: "/repo",
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.error).toBeNull();
    const logRecord = records.find((record) => record.label === "loadCommits.log");
    expect(logRecord?.args).toContain("--topo-order");
    expect(logRecord?.args).not.toContain("--date-order");
    expect(logRecord?.args).not.toContain("--author-date-order");
  });

  it("passes selected branch, glob, tag, and author filters to git log", async () => {
    const records: GitCommandRecord[] = [];
    git(["tag", "v-filter"], repo);

    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      branches: ["main", "--glob=heads/feature/*"],
      authors: ["T"],
      tags: ["v-filter"],
      maxCommits: 300,
      showRemoteBranches: false,
      showTags: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false,
      repo,
      recordGitCommand: (record) => records.push(record)
    });

    expect(result.error).toBeNull();
    const logRecord = records.find((record) => record.label === "loadCommits.log");
    expect(logRecord?.args).toEqual(
      expect.arrayContaining([
        "--author=T",
        "main",
        "--glob=heads/feature/*",
        "refs/tags/v-filter",
        "--"
      ])
    );
    expect(logRecord?.args).not.toContain("--branches");

    const refsRecord = records.find((record) => record.label === "loadCommits.refs");
    expect(refsRecord?.args).toEqual(expect.arrayContaining(["refs/tags"]));
  });

  it("passes hard flag through to the result", async () => {
    const result = await loadCommits(simpleGit(repo), {
      branchName: "",
      maxCommits: 300,
      showRemoteBranches: false,
      hard: true,
      dateType: "Author Date",
      showUncommittedChanges: false
    });
    expect(result).toEqual({
      commits: expect.any(Array),
      head: expect.any(String),
      moreCommitsAvailable: false,
      hard: true,
      error: null
    });
  });

  it("exposes typed Git command failures while preserving the current empty fallback", async () => {
    const failure = Object.assign(new Error("fatal: bad revision"), {
      result: { exitCode: 128, stdErr: "fatal: bad revision" }
    });
    const git = {
      raw: async (args: string[]) => {
        if (args[0] === "log") throw failure;
        if (args[0] === "rev-parse") return "abc123\n";
        if (args[0] === "for-each-ref") return "";
        throw new Error(`unexpected git command: ${args[0]}`);
      }
    } as unknown as SimpleGit;
    const records: GitCommandRecord[] = [];

    const result = await loadCommits(git, {
      branchName: "missing",
      maxCommits: 300,
      showRemoteBranches: false,
      hard: false,
      dateType: "Author Date",
      showUncommittedChanges: false,
      repo: "/repo",
      recordGitCommand: (record) => records.push(record)
    });

    expect(result).toEqual({
      commits: [],
      head: "abc123",
      moreCommitsAvailable: false,
      hard: false,
      error: {
        message: "fatal: bad revision",
        stderr: "fatal: bad revision",
        exitCode: 128,
        task: null
      }
    });

    const logRecord = records.find((record) => record.label === "loadCommits.log");
    const refsRecord = records.find((record) => record.label === "loadCommits.refs");
    const headRecord = records.find((record) => record.label === "loadCommits.head");
    expect(logRecord).toMatchObject({
      repo: "/repo",
      success: false,
      error: {
        message: "fatal: bad revision",
        exitCode: 128,
        stderr: "fatal: bad revision"
      }
    });
    expect(refsRecord).toMatchObject({
      repo: "/repo",
      args: expect.arrayContaining(["for-each-ref"]),
      success: true,
      error: null
    });
    expect(refsRecord?.args.some((arg) => arg.startsWith("--format="))).toBe(true);
    expect(headRecord).toMatchObject({
      repo: "/repo",
      args: ["rev-parse", "--verify", "HEAD"],
      success: true,
      error: null
    });
  });
});
