import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import type { SimpleGit } from "simple-git";
import { simpleGit } from "simple-git";
import { afterAll, describe, expect, it, vi } from "vitest";
import { pushTag } from "@/backend/actions/tag";

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

function remoteTags(cwd: string): string {
  return cp.execFileSync("git", ["tag", "-l"], { cwd }).toString().trim();
}

function refValue(cwd: string, ref: string): string {
  return cp.execFileSync("git", ["rev-parse", ref], { cwd }).toString().trim();
}

function refExists(cwd: string, ref: string): boolean {
  return cp.spawnSync("git", ["show-ref", "--verify", "--quiet", ref], { cwd }).status === 0;
}

afterAll(() => {
  for (const dir of createdDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("pushTag", () => {
  it("pushes an existing tag to the selected origin remote", async () => {
    const { repo, bares } = makeRepoWithRemotes(["origin"]);
    git(["tag", "v1.0"], repo);

    await pushTag(simpleGit(repo), {
      tagName: "v1.0",
      remotes: ["origin"],
      mode: "normal",
      noVerify: false
    });

    expect(remoteTags(bares.get("origin") ?? "")).toBe("v1.0");
  });

  it("pushes to a remote that is not named origin", async () => {
    const { repo, bares } = makeRepoWithRemotes(["upstream"]);
    git(["tag", "v1.0"], repo);

    await pushTag(simpleGit(repo), {
      tagName: "v1.0",
      remotes: ["upstream"],
      mode: "normal",
      noVerify: false
    });

    expect(remoteTags(bares.get("upstream") ?? "")).toBe("v1.0");
  });

  it("pushes only to the selected remotes of a two-remote repository", async () => {
    const { repo, bares } = makeRepoWithRemotes(["origin", "upstream"]);
    const origin = bares.get("origin") ?? "";
    const upstream = bares.get("upstream") ?? "";
    git(["tag", "v2.0"], repo);

    await pushTag(simpleGit(repo), {
      tagName: "v2.0",
      remotes: ["upstream"],
      mode: "normal",
      noVerify: false
    });

    expect(remoteTags(upstream)).toBe("v2.0");
    expect(remoteTags(origin)).toBe("");

    await pushTag(simpleGit(repo), {
      tagName: "v2.0",
      remotes: ["origin", "upstream"],
      mode: "normal",
      noVerify: false
    });

    expect(remoteTags(origin)).toBe("v2.0");
    expect(remoteTags(upstream)).toBe("v2.0");
  });

  it("pushes the tag refspec on a branch/tag name collision and leaves the branch untouched", async () => {
    const { repo, bares } = makeRepoWithRemotes(["upstream"]);
    const tagged = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
    // A second commit so the branch and the tag point at different commits;
    // a bare refspec would then be ambiguous (`src refspec v3.0 matches more
    // than one`).
    fs.writeFileSync(path.join(repo, "second"), "y");
    git(["add", "."], repo);
    git(["commit", "-m", "second"], repo);
    const branched = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
    git(["branch", "v3.0"], repo);
    git(["tag", "v3.0", tagged], repo);

    await pushTag(simpleGit(repo), {
      tagName: "v3.0",
      remotes: ["upstream"],
      mode: "normal",
      noVerify: false
    });

    const remote = bares.get("upstream") ?? "";
    expect(remoteTags(remote)).toBe("v3.0");
    expect(refValue(remote, "refs/tags/v3.0")).toBe(tagged);
    expect(refExists(remote, "refs/heads/v3.0")).toBe(false);
    expect(refExists(repo, "refs/heads/v3.0")).toBe(true);
    expect(refValue(repo, "refs/heads/v3.0")).toBe(branched);
  });

  it("throws when the tag does not exist locally", async () => {
    const { repo } = makeRepoWithRemotes(["origin"]);

    await expect(
      pushTag(simpleGit(repo), {
        tagName: "v99.0-nonexistent",
        remotes: ["origin"],
        mode: "normal",
        noVerify: false
      })
    ).rejects.toThrow();
  });

  it("rejects pushing when no remote is selected", async () => {
    const { repo } = makeRepoWithRemotes(["origin"]);
    git(["tag", "v1.0"], repo);

    await expect(
      pushTag(simpleGit(repo), { tagName: "v1.0", remotes: [], mode: "normal", noVerify: false })
    ).rejects.toThrow("No remotes were selected");
  });

  it("builds the same push arguments as pushBranch, over the tag refspec", async () => {
    const raw = vi.fn(async () => "");
    const gitStub = { raw } as unknown as SimpleGit;

    await pushTag(gitStub, {
      tagName: "v4.0",
      remotes: ["origin", "backup"],
      mode: "force-with-lease",
      noVerify: true,
      repo: "/repo"
    });

    expect(raw).toHaveBeenNthCalledWith(1, [
      "push",
      "--force-with-lease",
      "--no-verify",
      "origin",
      "refs/tags/v4.0"
    ]);
    expect(raw).toHaveBeenNthCalledWith(2, [
      "push",
      "--force-with-lease",
      "--no-verify",
      "backup",
      "refs/tags/v4.0"
    ]);
  });
});
