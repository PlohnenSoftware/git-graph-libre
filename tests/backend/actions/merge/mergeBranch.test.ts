import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mergeBranch } from "@/backend/actions/merge";

let repo: string;

beforeAll(() => {
  repo = makeRepo();
  git(["checkout", "-b", "feature"], repo);
  fs.writeFileSync(path.join(repo, "feature.txt"), "feature");
  git(["add", "."], repo);
  git(["commit", "-m", "feature commit"], repo);
  git(["checkout", "main"], repo);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("mergeBranch", () => {
  it("merges a branch with fast-forward by default", async () => {
    await mergeBranch(simpleGit(repo), {
      branchName: "feature",
      createNewCommit: false,
      squash: false,
      noCommit: false,
      noVerify: false
    });

    const log = cp.execFileSync("git", ["log", "--oneline"], { cwd: repo }).toString();
    expect(log).toContain("feature commit");
  });

  it("merges a branch with --no-ff when createNewCommit is true", async () => {
    git(["checkout", "-b", "feature2"], repo);
    fs.writeFileSync(path.join(repo, "feature2.txt"), "feature2");
    git(["add", "."], repo);
    git(["commit", "-m", "feature2 commit"], repo);
    git(["checkout", "main"], repo);

    await mergeBranch(simpleGit(repo), {
      branchName: "feature2",
      createNewCommit: true,
      squash: false,
      noCommit: false,
      noVerify: false
    });

    const log = cp.execFileSync("git", ["log", "--oneline"], { cwd: repo }).toString();
    expect(log).toContain("Merge branch");
  });

  it("throws when the branch does not exist", async () => {
    await expect(
      mergeBranch(simpleGit(repo), {
        branchName: "nonexistent-branch",
        createNewCommit: false,
        squash: false,
        noCommit: false,
        noVerify: false
      })
    ).rejects.toThrow();
  });
});

// The remote branch context menu sends the ref name it renders, so the target
// arriving here is `origin/<branch>` rather than a local branch name. This
// covers that shape against real git.
describe("mergeBranch with a remote-tracking ref", () => {
  let clone: string;

  beforeAll(() => {
    const upstream = makeRepo();
    git(["checkout", "-b", "feature"], upstream);
    fs.writeFileSync(path.join(upstream, "remote-feature.txt"), "remote feature");
    git(["add", "."], upstream);
    git(["commit", "-m", "remote feature commit"], upstream);
    git(["checkout", "main"], upstream);

    clone = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-clone-"));
    fs.rmSync(clone, { recursive: true, force: true });
    git(["clone", upstream, clone], os.tmpdir());
    git(["config", "user.email", "t@t.com"], clone);
    git(["config", "user.name", "T"], clone);
    git(["config", "commit.gpgsign", "false"], clone);
    fs.rmSync(upstream, { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(clone, { recursive: true, force: true });
  });

  it("merges the remote-tracking ref into the checked-out branch", async () => {
    await mergeBranch(simpleGit(clone), {
      branchName: "origin/feature",
      createNewCommit: true,
      squash: false,
      noCommit: false,
      noVerify: false
    });

    const log = cp.execFileSync("git", ["log", "--oneline"], { cwd: clone }).toString();
    expect(log).toContain("remote feature commit");
    expect(log).toContain("Merge");
    expect(fs.existsSync(path.join(clone, "remote-feature.txt"))).toBe(true);
  });
});
