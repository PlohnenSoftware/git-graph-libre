import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { remoteTags } from "@/backend/queries/remoteTags";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

let repo: string;
let remote: string;
const records: GitCommandRecord[] = [];
const read = () =>
  remoteTags({ repo, gitPath: "git", recordGitCommand: (record) => records.push(record) });

beforeEach(() => {
  repo = makeRepo();
  remote = mkdtempSync(join(tmpdir(), "ggl-remote-tags-"));
  git(["init", "--bare", remote], repo);
  git(["remote", "add", "origin", remote], repo);
  records.length = 0;
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(remote, { recursive: true, force: true });
});

describe("remote tag status", () => {
  it("does not contact remotes when there are no local tags", async () => {
    expect(await read()).toEqual({ tags: {}, unavailableRemotes: [], error: null });
    expect(records.some((record) => record.label === "remoteTags.remote")).toBe(false);
  });
  it("distinguishes local tags from identical lightweight and annotated tags on each remote", async () => {
    git(["remote", "add", "backup", remote], repo);
    git(["tag", "local"], repo);
    git(["tag", "lightweight"], repo);
    git(["tag", "-a", "annotated", "-m", "release"], repo);
    git(["push", "origin", "refs/tags/lightweight", "refs/tags/annotated"], repo);
    const hash = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();

    expect(await read()).toEqual({
      tags: {
        local: { hash, remotes: [] },
        lightweight: { hash, remotes: ["backup", "origin"] },
        annotated: { hash, remotes: ["backup", "origin"] }
      },
      unavailableRemotes: [],
      error: null
    });
    expect(records.filter((record) => record.label === "remoteTags.remote")).toHaveLength(2);
  });

  it("does not call different annotated objects on the same commit pushed", async () => {
    git(["tag", "-a", "release", "-m", "old annotation"], repo);
    git(["push", "origin", "refs/tags/release"], repo);
    git(["tag", "-f", "-a", "release", "-m", "new annotation"], repo);
    expect((await read()).tags.release.remotes).toEqual([]);
  });

  it("sees pushes and remote deletions on the next read without changing local refs", async () => {
    git(["tag", "release"], repo);
    expect((await read()).tags.release.remotes).toEqual([]);
    git(["push", "origin", "refs/tags/release"], repo);
    expect((await read()).tags.release.remotes).toEqual(["origin"]);
    git(["push", "origin", "--delete", "refs/tags/release"], repo);
    expect((await read()).tags.release.remotes).toEqual([]);
    expect(execFileSync("git", ["tag", "--list"], { cwd: repo, encoding: "utf8" }).trim()).toBe(
      "release"
    );
  });

  it("keeps successful results and reports an unreachable remote as unavailable", async () => {
    git(["tag", "release"], repo);
    git(["push", "origin", "refs/tags/release"], repo);
    git(["remote", "add", "offline", join(remote, "missing")], repo);
    const result = await read();
    expect(result.tags.release.remotes).toEqual(["origin"]);
    expect(result.unavailableRemotes).toEqual(["offline"]);
    expect(result.error).toBeNull();
    expect(records.some((record) => record.label === "remoteTags.remote" && !record.success)).toBe(
      true
    );
  });

  it("supports tags with prototype property names and repositories without remotes", async () => {
    git(["remote", "remove", "origin"], repo);
    git(["tag", "__proto__"], repo);
    git(["tag", "constructor"], repo);
    const result = await read();
    expect(Object.keys(result.tags)).toEqual(["__proto__", "constructor"]);
    expect(Object.values(result.tags).map((tag) => tag.remotes)).toEqual([[], []]);
    expect(result.error).toBeNull();
  });

  it("returns a query error when the repository cannot be read", async () => {
    const result = await remoteTags({ repo: join(repo, "missing"), gitPath: "git" });
    expect(result.tags).toEqual({});
    expect(result.error).not.toBeNull();
  });
});
