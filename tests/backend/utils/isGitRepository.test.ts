import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isGitRepository } from "@/backend/utils/git";

import { makeRepo } from "@tests/backend/helpers";

let repo: string;
let nonGitDir: string;
let subDir: string;

beforeAll(() => {
  repo = makeRepo();
  nonGitDir = fs.mkdtempSync(`${os.tmpdir()}/ngg-test-nongit-`);
  subDir = path.join(repo, "src");
  fs.mkdirSync(subDir);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(nonGitDir, { recursive: true, force: true });
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
});
