import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterEach, describe, expect, it } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import { parseEngineCommitFile } from "@/backend/engine/details";
import {
  gitlinkText,
  parseGitlinkEntry,
  readRevisionGitlink,
  readStagedFile
} from "@/backend/engine/stagedFile";

/**
 * Gitlink (submodule entry) content, both backends side by side. The text
 * `Subproject commit <hash>\n` is the GGL Diff tab's DISPLAY representation,
 * the line `git diff` shows for a submodule. It is not what
 * `git show <rev>:<path>` prints, so the CLI route builds it from
 * `git ls-tree` / `git ls-files --stage`. The commit the gitlink points at is
 * absent from the superproject here, as it usually is.
 */

const SUBMODULE_COMMIT = "1234567890abcdef1234567890abcdef12345678";
const EXPECTED = `Subproject commit ${SUBMODULE_COMMIT}\n`;
const dirs: string[] = [];

/** A repository with a committed gitlink `sub`, a text file and a binary file. */
function repoWithGitlink(): string {
  const dir = makeRepo();
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, "text.txt"), "hello\n");
  fs.writeFileSync(path.join(dir, "bin.dat"), Buffer.from([0, 1, 2, 3, 255]));
  git(["add", "text.txt", "bin.dat"], dir);
  git(["update-index", "--add", "--cacheinfo", `160000,${SUBMODULE_COMMIT},sub`], dir);
  git(["commit", "-m", "add a gitlink"], dir);
  return dir;
}

function requireAddon(context: { skip: (message?: string) => never }) {
  const addon = loadEngineAddon();
  if (addon === null) {
    context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
  }
  return addon;
}

describe("gitlink content across backends", () => {
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("builds the display text the way git diff words it", () => {
    expect(gitlinkText(SUBMODULE_COMMIT)).toBe(EXPECTED);
  });

  it("is not what git show prints, which is why the CLI route needs its own detection", () => {
    const dir = repoWithGitlink();
    expect(() =>
      cp.execFileSync("git", ["show", "HEAD:sub"], { cwd: dir, stdio: "pipe" })
    ).toThrow();
  });

  it("agrees on a committed gitlink at a revision", async (context) => {
    const dir = repoWithGitlink();
    const addon = requireAddon(context);
    const parsed = parseEngineCommitFile(await addon?.loadCommitFile(dir, "HEAD", "sub"));
    expect(parsed).toEqual({ contents: EXPECTED, binary: false });
    expect(await readRevisionGitlink(dir, "HEAD", "sub", "git")).toBe(EXPECTED);
  });

  it("agrees on a staged gitlink in the index", async (context) => {
    const dir = repoWithGitlink();
    const other = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
    git(["update-index", "--cacheinfo", `160000,${other},sub`], dir);
    const addon = requireAddon(context);

    const viaEngine = await readStagedFile(dir, "sub", {
      gitPath: "git",
      backend: () => "auto",
      isVerified: () => true
    });
    const viaCli = await readStagedFile(dir, "sub", { gitPath: "git", backend: () => "git-cli" });

    expect(addon).not.toBeNull();
    expect(viaEngine).toEqual({ text: `Subproject commit ${other}\n` });
    expect(viaCli).toEqual(viaEngine);
  });

  it("reads a nested gitlink path the same way", async (context) => {
    const dir = makeRepo();
    dirs.push(dir);
    git(["update-index", "--add", "--cacheinfo", `160000,${SUBMODULE_COMMIT},libs/deep/sub`], dir);
    git(["commit", "-m", "nested gitlink"], dir);
    const addon = requireAddon(context);
    const parsed = parseEngineCommitFile(await addon?.loadCommitFile(dir, "HEAD", "libs/deep/sub"));
    expect(parsed?.contents).toBe(EXPECTED);
    expect(await readRevisionGitlink(dir, "HEAD", "libs/deep/sub", "git")).toBe(EXPECTED);
  });

  it("leaves ordinary blob, binary and missing reads unchanged on both routes", async (context) => {
    const dir = repoWithGitlink();
    const addon = requireAddon(context);

    const text = parseEngineCommitFile(await addon?.loadCommitFile(dir, "HEAD", "text.txt"));
    expect(text).toEqual({ contents: "hello\n", binary: false });
    const binary = parseEngineCommitFile(await addon?.loadCommitFile(dir, "HEAD", "bin.dat"));
    expect(binary).toEqual({ contents: null, binary: true });
    await expect(addon?.loadCommitFile(dir, "HEAD", "nope")).rejects.toThrow();

    // None of these paths is a gitlink, so the CLI detection answers null.
    expect(await readRevisionGitlink(dir, "HEAD", "text.txt", "git")).toBeNull();
    expect(await readRevisionGitlink(dir, "HEAD", "nope", "git")).toBeNull();
    const cli = { gitPath: "git", backend: () => "git-cli" as const };
    expect(await readStagedFile(dir, "text.txt", cli)).toEqual({ text: "hello\n" });
    expect(await readStagedFile(dir, "bin.dat", cli)).toEqual({ binary: true });
    expect(await readStagedFile(dir, "nope", cli)).toEqual({ missing: true });
  });

  it("does not treat a directory or a pathspec pattern as a gitlink", async () => {
    const dir = repoWithGitlink();
    fs.mkdirSync(path.join(dir, "d"));
    fs.writeFileSync(path.join(dir, "d", "x.txt"), "x");
    git(["add", "d"], dir);
    git(["commit", "-m", "dir"], dir);
    expect(await readRevisionGitlink(dir, "HEAD", "d", "git")).toBeNull();
    expect(await readRevisionGitlink(dir, "HEAD", "s*", "git")).toBeNull();
    expect(await readRevisionGitlink(dir, "--all", "sub", "git")).toBeNull();
  });
});

describe("parseGitlinkEntry", () => {
  it("reads ls-tree and ls-files records and rejects other modes and stages", () => {
    const tree = `160000 commit ${SUBMODULE_COMMIT}\tsub\0`;
    expect(parseGitlinkEntry(tree, "sub", "tree")).toBe(SUBMODULE_COMMIT);
    expect(parseGitlinkEntry(tree, "other", "tree")).toBeNull();
    expect(parseGitlinkEntry(`100644 blob ${SUBMODULE_COMMIT}\tsub\0`, "sub", "tree")).toBeNull();

    const stage = `160000 ${SUBMODULE_COMMIT} 0\tsub\0`;
    expect(parseGitlinkEntry(stage, "sub", "stage")).toBe(SUBMODULE_COMMIT);
    expect(parseGitlinkEntry(`160000 ${SUBMODULE_COMMIT} 2\tsub\0`, "sub", "stage")).toBeNull();
    expect(parseGitlinkEntry("", "sub", "stage")).toBeNull();
  });
});
