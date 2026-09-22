import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { canonicalizePath, isGitRepository } from "@/backend/utils/git";

let repo: string;
let nonGitDir: string;
let subDir: string;
let linkDir: string;

beforeAll(() => {
  repo = makeRepo();
  nonGitDir = fs.mkdtempSync(`${os.tmpdir()}/ngg-test-nongit-`);
  subDir = path.join(repo, "src");
  fs.mkdirSync(subDir);
  linkDir = fs.mkdtempSync(`${os.tmpdir()}/ngg-test-symlink-`);
  fs.symlinkSync(repo, path.join(linkDir, "repo"), "dir");
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(nonGitDir, { recursive: true, force: true });
  fs.rmSync(linkDir, { recursive: true, force: true });
});

describe("isGitRepository", () => {
  it("returns true for a git repository", async () => {
    expect(await isGitRepository(repo, "git")).toBe(true);
  });

  it("returns false for a non-git directory", async () => {
    expect(await isGitRepository(nonGitDir, "git")).toBe(false);
  });

  it("returns false for a non-existent path", async () => {
    expect(await isGitRepository("/tmp/ngg-test-does-not-exist-xyz", "git")).toBe(false);
  });

  // Regression: `checkIsRepo()` with no argument checks `--is-inside-work-tree`,
  // which is true for every subdirectory of a working tree, not only its
  // root. Discovery (`repoSearch.ts`) relies on this function to tell a real
  // repository apart from a plain folder that merely lives inside one, so an
  // ordinary subdirectory must report `false` here even though it is "inside"
  // the repository in the loose sense.
  it("returns false for a subdirectory of a git repository", async () => {
    expect(await isGitRepository(subDir, "git")).toBe(false);
  });

  // Regression, the other direction: `--show-toplevel` prints the *physical*
  // path, so comparing it against the queried path as a raw string answers
  // `false` for a repository opened through a symlink — which drops it out of
  // discovery entirely. Verified to fail against the unnormalized comparison.
  it("returns true for a repository reached through a symlink", async () => {
    expect(await isGitRepository(path.join(linkDir, "repo"), "git")).toBe(true);
  });

  it("returns true for a repository path carrying a trailing separator", async () => {
    expect(await isGitRepository(`${repo}/`, "git")).toBe(true);
  });
});

describe("canonicalizePath", () => {
  it("resolves a symlink to the path git would print", async () => {
    expect(await canonicalizePath(path.join(linkDir, "repo"))).toBe(await canonicalizePath(repo));
  });

  // The Windows shapes cannot be exercised by opening a real repository on
  // Linux or macOS, but they are pure string normalization: an unresolvable
  // path keeps the value it was given, so the separator and drive-letter
  // rules can still be driven directly.
  it("lower-cases a Windows drive letter so both sides of the comparison agree", async () => {
    // `Uri.fsPath` gives `c:`, git prints `C:`. Same directory.
    expect(await canonicalizePath("C:/src/repo")).toBe("c:/src/repo");
    expect(await canonicalizePath("c:/src/repo")).toBe("c:/src/repo");
  });

  it("normalizes Windows separators to forward slashes", async () => {
    expect(await canonicalizePath("C:\\src\\repo")).toBe("c:/src/repo");
  });

  it("drops trailing separators but keeps the filesystem root", async () => {
    expect(await canonicalizePath("/does/not/exist/")).toBe("/does/not/exist");
    expect(await canonicalizePath("/")).toBe("/");
  });

  it("keeps an unresolvable path as given", async () => {
    expect(await canonicalizePath("/ngg-test-does-not-exist-xyz")).toBe(
      "/ngg-test-does-not-exist-xyz"
    );
  });
});
