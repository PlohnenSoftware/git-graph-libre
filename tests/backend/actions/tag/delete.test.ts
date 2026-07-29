import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteTag } from "@/backend/actions/tag";

import { git, makeRepo } from "@tests/backend/helpers";

let repo: string;
let commitHash: string;
let remoteRepo: string;

function remoteTags() {
  return cp.execFileSync("git", ["tag"], { cwd: remoteRepo }).toString().trim();
}

function localTags() {
  return cp.execFileSync("git", ["tag"], { cwd: repo }).toString().trim();
}

beforeAll(() => {
  remoteRepo = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-tag-remote-"));
  cp.execFileSync("git", ["init", "--bare", "-b", "main", remoteRepo]);

  repo = makeRepo();
  commitHash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
  git(["remote", "add", "origin", remoteRepo], repo);
  git(["push", "origin", "main"], repo);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(remoteRepo, { recursive: true, force: true });
});

describe("deleteTag", () => {
  it("deletes an existing tag", async () => {
    cp.execFileSync("git", ["tag", "v1.0", commitHash], { cwd: repo });

    await deleteTag(simpleGit(repo), { tagName: "v1.0" });

    expect(localTags()).not.toContain("v1.0");
  });

  it("throws when the tag does not exist", async () => {
    await expect(deleteTag(simpleGit(repo), { tagName: "nonexistent" })).rejects.toThrow();
  });

  it("deletes the tag on the selected remotes as well", async () => {
    git(["tag", "v2.0", commitHash], repo);
    git(["push", "origin", "v2.0"], repo);
    expect(remoteTags()).toContain("v2.0");

    await deleteTag(simpleGit(repo), { tagName: "v2.0", deleteOnRemotes: ["origin"], repo });

    expect(localTags()).not.toContain("v2.0");
    expect(remoteTags()).not.toContain("v2.0");
  });

  it("leaves the remote untouched when no remote is selected", async () => {
    git(["tag", "v3.0", commitHash], repo);
    git(["push", "origin", "v3.0"], repo);

    await deleteTag(simpleGit(repo), { tagName: "v3.0", repo });

    expect(localTags()).not.toContain("v3.0");
    expect(remoteTags()).toContain("v3.0");
  });

  it("succeeds when the tag was never pushed to the selected remote", async () => {
    git(["tag", "v4.0", commitHash], repo);

    await expect(
      deleteTag(simpleGit(repo), { tagName: "v4.0", deleteOnRemotes: ["origin"], repo })
    ).resolves.toBeUndefined();

    expect(localTags()).not.toContain("v4.0");
  });
});
