import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { branchPushDefaults } from "@/backend/queries/branchPushDefaults";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const tempDirs: string[] = [];
let savedGlobalConfig: string | undefined;
let emptyGlobalConfig: string;

function tempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** A repository whose `main` tracks `origin`, a local bare remote, and no other config. */
function trackedRepo() {
  const repo = makeRepo();
  const bare = tempDir("ngg-bare-");
  git(["init", "--bare", "-b", "main"], bare);
  git(["remote", "add", "origin", bare], repo);
  git(["push", "-u", "origin", "main"], repo);
  return { repo, bare };
}

beforeAll(() => {
  // A developer's own ~/.gitconfig may set remote.pushDefault: keep it out.
  emptyGlobalConfig = path.join(tempDir("ngg-gitconfig-"), "config");
  fs.writeFileSync(emptyGlobalConfig, "");
  savedGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = emptyGlobalConfig;
});

afterAll(() => {
  if (savedGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobalConfig;
});

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("branchPushDefaults", () => {
  it("names the upstream remote when nothing else is configured", async () => {
    const { repo } = trackedRepo();

    await expect(branchPushDefaults(simpleGit(repo), { repo, branch: "main" })).resolves.toEqual({
      upstreamRemote: "origin",
      pushRemote: "origin",
      error: null
    });
  });

  it("reports no remotes for a branch with no upstream and no push default", async () => {
    const { repo } = trackedRepo();
    git(["branch", "local-only"], repo);

    await expect(
      branchPushDefaults(simpleGit(repo), { repo, branch: "local-only" })
    ).resolves.toEqual({ upstreamRemote: null, pushRemote: null, error: null });
  });

  it("prefers remote.pushDefault over the upstream, as plain git push does", async () => {
    const { repo } = trackedRepo();
    git(["remote", "add", "backup", tempDir("ngg-backup-")], repo);
    git(["config", "remote.pushDefault", "backup"], repo);

    await expect(branchPushDefaults(simpleGit(repo), { repo, branch: "main" })).resolves.toEqual({
      upstreamRemote: "origin",
      pushRemote: "backup",
      error: null
    });
  });

  it("prefers branch.<b>.pushRemote over remote.pushDefault and the upstream", async () => {
    const { repo } = trackedRepo();
    git(["remote", "add", "backup", tempDir("ngg-backup-")], repo);
    git(["config", "remote.pushDefault", "backup"], repo);
    git(["config", "branch.main.pushRemote", "origin"], repo);

    await expect(branchPushDefaults(simpleGit(repo), { repo, branch: "main" })).resolves.toEqual({
      upstreamRemote: "origin",
      pushRemote: "origin",
      error: null
    });
  });

  it("answers for a branch whose name contains a slash", async () => {
    const { repo } = trackedRepo();
    git(["checkout", "-b", "feature/menu"], repo);
    git(["push", "-u", "origin", "feature/menu"], repo);

    await expect(
      branchPushDefaults(simpleGit(repo), { repo, branch: "feature/menu" })
    ).resolves.toEqual({ upstreamRemote: "origin", pushRemote: "origin", error: null });
  });

  it("does not answer for a branch named by a prefix of a longer branch", async () => {
    const { repo } = trackedRepo();
    git(["checkout", "-b", "feat/x"], repo);
    git(["push", "-u", "origin", "feat/x"], repo);
    git(["checkout", "main"], repo);

    // `feat` does not exist; `for-each-ref refs/heads/feat` would still list `feat/x`.
    await expect(branchPushDefaults(simpleGit(repo), { repo, branch: "feat" })).resolves.toEqual({
      upstreamRemote: null,
      pushRemote: null,
      error: null
    });
  });

  it("returns empty answers for a branch that does not exist", async () => {
    const { repo } = trackedRepo();

    await expect(
      branchPushDefaults(simpleGit(repo), { repo, branch: "no-such-branch" })
    ).resolves.toEqual({ upstreamRemote: null, pushRemote: null, error: null });
  });

  it("returns an error, and no remote names, outside a repository", async () => {
    const notRepo = tempDir("ngg-not-repo-");

    const result = await branchPushDefaults(simpleGit(notRepo), {
      repo: notRepo,
      branch: "main"
    });

    expect(result.upstreamRemote).toBeNull();
    expect(result.pushRemote).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("records the read as a git command labelled branchPushDefaults.read", async () => {
    const { repo } = trackedRepo();
    const records: GitCommandRecord[] = [];

    await branchPushDefaults(simpleGit(repo), {
      repo,
      branch: "main",
      recordGitCommand: (record) => records.push(record)
    });

    expect(records[0]).toMatchObject({ label: "branchPushDefaults.read", success: true });
  });
});
