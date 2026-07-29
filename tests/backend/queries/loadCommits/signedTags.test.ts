import * as cp from "node:child_process";
import * as fs from "node:fs";

import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadCommits, toGitRef } from "@/backend/queries/loadCommits";
import type { GitRef } from "@/backend/types";

let repo: string;
let commitHash: string;

/**
 * Writes a tag object whose body carries a PGP signature block, without needing
 * a GPG key in the test environment. `%(contents:signature)` keys off that block,
 * so this is enough to exercise the signed-tag detection end to end.
 */
function createSignatureBearingTag(dir: string, tagName: string, target: string) {
  const tagObject = [
    `object ${target}`,
    "type commit",
    `tag ${tagName}`,
    "tagger T <t@t.com> 1700000000 +0000",
    "",
    "signed release",
    "-----BEGIN PGP SIGNATURE-----",
    "",
    "aGVsbG8gd29ybGQK",
    "=abcd",
    "-----END PGP SIGNATURE-----",
    ""
  ].join("\n");
  const tagHash = cp
    .execFileSync("git", ["mktag"], { cwd: dir, input: tagObject })
    .toString()
    .trim();
  git(["update-ref", `refs/tags/${tagName}`, tagHash], dir);
}

async function loadRefs(): Promise<GitRef[]> {
  const result = await loadCommits(simpleGit(repo), {
    branchName: "",
    maxCommits: 50,
    showRemoteBranches: false,
    showTags: true,
    hard: true,
    dateType: "Author Date",
    showUncommittedChanges: false,
    repo
  });
  return result.commits.flatMap((commit) => commit.refs);
}

function tagRefs(refs: GitRef[]) {
  return new Map(refs.filter((ref) => ref.type === "tag").map((ref) => [ref.name, ref]));
}

beforeAll(() => {
  repo = makeRepo();
  commitHash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
  git(["tag", "-a", "v-annotated", "-m", "plain annotated"], repo);
  git(["tag", "v-lightweight"], repo);
  createSignatureBearingTag(repo, "v-signed", commitHash);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("signed tag refs", () => {
  it("marks only signature-bearing annotated tags as signed", async () => {
    const tags = tagRefs(await loadRefs());

    expect(tags.get("v-signed")?.signed).toBe(true);
    expect(tags.get("v-annotated")?.signed).toBe(false);
    expect(tags.get("v-lightweight")?.signed).toBe(false);
  });

  it("resolves signed tags to the tagged commit, not the tag object", async () => {
    expect(tagRefs(await loadRefs()).get("v-signed")?.hash).toBe(commitHash);
  });

  it("leaves branch refs without a signed flag", async () => {
    const head = (await loadRefs()).find((ref) => ref.type === "head");

    expect(head).toBeDefined();
    expect(head?.signed).toBeUndefined();
  });
});

describe("toGitRef", () => {
  const record = {
    objectHash: "aaa",
    refName: "refs/tags/v1",
    peeledHash: "bbb",
    objectType: "tag",
    hasSignature: true
  };

  it("maps a signed annotated tag to the peeled commit with signed set", () => {
    expect(toGitRef(record, undefined)).toEqual({
      hash: "bbb",
      name: "v1",
      type: "tag",
      signed: true
    });
  });

  it("treats a signature on a non-tag object as unsigned", () => {
    // A lightweight tag points straight at a commit, so it has no tag object
    // that could carry a signature even if the commit itself is signed.
    expect(toGitRef({ ...record, objectType: "commit", peeledHash: "" }, undefined)).toEqual({
      hash: "aaa",
      name: "v1",
      type: "tag",
      signed: false
    });
  });

  it("maps branch refs without a signed flag", () => {
    expect(toGitRef({ ...record, refName: "refs/heads/main" }, undefined)).toEqual({
      hash: "aaa",
      name: "main",
      type: "head"
    });
  });

  it("drops hidden remote refs", () => {
    expect(toGitRef({ ...record, refName: "refs/remotes/origin/main" }, ["origin"])).toBeNull();
  });

  it("keeps visible remote refs", () => {
    expect(toGitRef({ ...record, refName: "refs/remotes/origin/main" }, ["upstream"])).toEqual({
      hash: "aaa",
      name: "origin/main",
      type: "remote"
    });
  });

  it("ignores refs outside heads, tags, and remotes", () => {
    expect(toGitRef({ ...record, refName: "refs/stash" }, undefined)).toBeNull();
  });
});
