import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import type { SimpleGit } from "simple-git";
import { simpleGit } from "simple-git";
import { afterAll, describe, expect, it, vi } from "vitest";
import { pushAllTags } from "@/backend/actions/tag";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const createdDirs: string[] = [];

function makeBareRemote(): string {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-bare-"));
  createdDirs.push(bare);
  cp.execFileSync("git", ["init", "--bare", "-b", "main", bare]);
  return bare;
}

function makeRepoWithRemotes(remoteNames: string[]): { repo: string; bares: Map<string, string> } {
  const repo = makeRepo();
  createdDirs.push(repo);
  const bares = new Map<string, string>();
  for (const name of remoteNames) {
    const bare = makeBareRemote();
    bares.set(name, bare);
    git(["remote", "add", name, bare], repo);
    git(["push", name, "main"], repo);
  }
  return { repo, bares };
}

function remoteTags(cwd: string): string[] {
  return cp
    .execFileSync("git", ["tag", "-l"], { cwd })
    .toString()
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

afterAll(() => {
  for (const dir of createdDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("pushAllTags", () => {
  it("pushes every local tag to the selected remotes", async () => {
    const { repo, bares } = makeRepoWithRemotes(["origin", "upstream"]);
    git(["tag", "v1.0"], repo);
    git(["tag", "v2.0"], repo);

    await pushAllTags(simpleGit(repo), {
      repo,
      remotes: ["origin", "upstream"],
      mode: "normal",
      noVerify: false
    });

    expect(remoteTags(bares.get("origin") ?? "")).toEqual(["v1.0", "v2.0"]);
    expect(remoteTags(bares.get("upstream") ?? "")).toEqual(["v1.0", "v2.0"]);
  });

  it("pushes only to the selected remotes of a two-remote repository", async () => {
    const { repo, bares } = makeRepoWithRemotes(["origin", "upstream"]);
    git(["tag", "v1.0"], repo);

    await pushAllTags(simpleGit(repo), {
      repo,
      remotes: ["upstream"],
      mode: "normal",
      noVerify: false
    });

    expect(remoteTags(bares.get("upstream") ?? "")).toEqual(["v1.0"]);
    expect(remoteTags(bares.get("origin") ?? "")).toEqual([]);
  });

  it("rejects pushing when no remote is selected", async () => {
    const { repo } = makeRepoWithRemotes(["origin"]);
    git(["tag", "v1.0"], repo);

    await expect(
      pushAllTags(simpleGit(repo), { repo, remotes: [], mode: "normal", noVerify: false })
    ).rejects.toThrow("No remotes were selected");
  });

  it("threads force and no-verify args through the shared push-mode mapping", async () => {
    const records: GitCommandRecord[] = [];
    const raw = vi.fn(async () => "");
    const gitStub = { raw } as unknown as SimpleGit;

    await pushAllTags(
      gitStub,
      {
        repo: "/repo",
        remotes: ["origin", "backup"],
        mode: "force",
        noVerify: true
      },
      (record) => records.push(record)
    );

    expect(raw).toHaveBeenNthCalledWith(1, ["push", "--force", "--no-verify", "origin", "--tags"]);
    expect(raw).toHaveBeenNthCalledWith(2, ["push", "--force", "--no-verify", "backup", "--tags"]);
    expect(records.map((record) => record.label)).toEqual(["tag.pushAllTags", "tag.pushAllTags"]);
    expect(records[0]).toMatchObject({
      kind: "action",
      repo: "/repo",
      args: ["push", "--force", "--no-verify", "origin", "--tags"],
      success: true
    });
  });

  it("uses --force-with-lease for the lease mode", async () => {
    const raw = vi.fn(async () => "");
    const gitStub = { raw } as unknown as SimpleGit;

    await pushAllTags(gitStub, {
      repo: "/repo",
      remotes: ["origin"],
      mode: "force-with-lease",
      noVerify: false
    });

    expect(raw).toHaveBeenCalledWith(["push", "--force-with-lease", "origin", "--tags"]);
  });
});
