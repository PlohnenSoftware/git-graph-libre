import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import simpleGit from "simple-git";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchIntoLocalBranch, updateBranchFromUpstream } from "@/backend/actions/branchRemote";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

import { git, makeRepo } from "../helpers";

// `@/l10n` needs the `vscode` module, so the backend project gets the English
// bundle in its place, as the webview project's `vscode` mock does.
vi.mock("@/l10n", async () => {
  const bundlePath = path.resolve(__dirname, "../../../l10n/bundle.l10n.json");
  const bundle: Record<string, string> = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  return {
    t: (key: string, ...args: string[]) =>
      (bundle[key] ?? key).replace(/\{(\d+)\}/g, (_, index) => args[Number(index)] ?? "")
  };
});

const temporaryDirs: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirs.push(dir);
  return dir;
}

function rev(cwd: string, ref: string): string {
  return cp.execFileSync("git", ["rev-parse", ref], { cwd, encoding: "utf8" }).trim();
}

/**
 * A repository with an `origin`, the branches `feat` (checked out in a linked
 * worktree whose path has a space and a non-ASCII letter) and `idle` (checked
 * out nowhere), and `origin` ahead of both by one commit.
 */
function makeFixture() {
  const repo = makeRepo();
  temporaryDirs.push(repo);
  const origin = tempDir("ngg-origin-");
  git(["init", "--bare", "-b", "main"], origin);
  git(["remote", "add", "origin", origin], repo);
  git(["branch", "feat"], repo);
  git(["branch", "idle"], repo);
  git(["push", "origin", "main", "feat", "idle"], repo);
  git(["branch", "--set-upstream-to=origin/feat", "feat"], repo);

  const worktreeParent = tempDir("ngg-wt-");
  const worktree = path.join(worktreeParent, "wt feat é");
  git(["worktree", "add", worktree, "feat"], repo);

  // Move origin's `feat` and `idle` ahead from a second clone.
  const clone = tempDir("ngg-clone-");
  git(["clone", origin, clone], os.tmpdir());
  git(["config", "user.email", "t@t.com"], clone);
  git(["config", "user.name", "T"], clone);
  git(["config", "commit.gpgsign", "false"], clone);
  for (const branch of ["feat", "idle"]) {
    git(["checkout", branch], clone);
    git(["commit", "--allow-empty", "-m", `ahead ${branch}`], clone);
    git(["push", "origin", branch], clone);
  }
  git(["fetch", "origin"], repo);
  return { repo, worktree };
}

describe("fetching into a branch checked out in another worktree", () => {
  it("fails early naming the worktree, and never runs the fetch", async () => {
    const { repo } = makeFixture();
    const before = rev(repo, "feat");
    const labels: string[] = [];

    await expect(
      fetchIntoLocalBranch(
        simpleGit(repo),
        { repo, remote: "origin", remoteBranch: "feat", localBranch: "feat", force: false },
        (record: GitCommandRecord) => labels.push(record.label)
      )
    ).rejects.toThrow(/feat.*wt feat é/);

    expect(labels).not.toContain("branchRemote.fetchIntoLocalBranch");
    expect(rev(repo, "feat")).toBe(before);
  });

  it("refuses a forced fetch the same way", async () => {
    const { repo } = makeFixture();

    await expect(
      fetchIntoLocalBranch(simpleGit(repo), {
        repo,
        remote: "origin",
        remoteBranch: "feat",
        localBranch: "feat",
        force: true
      })
    ).rejects.toThrow(/checked out in the worktree/);
  });

  it("still updates a branch that no worktree has checked out", async () => {
    const { repo } = makeFixture();

    await fetchIntoLocalBranch(simpleGit(repo), {
      repo,
      remote: "origin",
      remoteBranch: "idle",
      localBranch: "idle",
      force: false
    });

    expect(rev(repo, "idle")).toBe(rev(repo, "origin/idle"));
  });

  it("does not treat the branch checked out here as held elsewhere", async () => {
    const { repo } = makeFixture();
    git(["switch", "idle"], repo);

    await fetchIntoLocalBranch(simpleGit(repo), {
      repo,
      remote: "origin",
      remoteBranch: "idle",
      localBranch: "idle",
      force: false
    });

    expect(rev(repo, "idle")).toBe(rev(repo, "origin/idle"));
  });
});

describe("updating a branch from its upstream while another worktree has it", () => {
  it("fails early naming the worktree and leaves the branch alone", async () => {
    const { repo } = makeFixture();
    const before = rev(repo, "feat");

    await expect(
      updateBranchFromUpstream(simpleGit(repo), { repo, branchName: "feat", force: false })
    ).rejects.toThrow(/wt feat é/);

    expect(rev(repo, "feat")).toBe(before);
  });
});
