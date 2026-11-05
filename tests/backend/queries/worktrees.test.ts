import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadWorktrees,
  parseWorktreeList,
  WorktreeListFormatError
} from "@/backend/queries/worktrees";
import type { GitWorktree } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import { git, makeRepo } from "../helpers";

const NUL = "\0";
const HEAD_A = "a".repeat(40);
const HEAD_B = "b".repeat(40);

/** One NUL-terminated record: each field ends with NUL, and an empty field closes the record. */
function record(...fields: string[]): string {
  return `${fields.map((field) => `${field}${NUL}`).join("")}${NUL}`;
}

function worktree(overrides: Partial<GitWorktree>): GitWorktree {
  return {
    path: "/repo",
    head: HEAD_A,
    branch: "main",
    detached: false,
    bare: false,
    isMain: true,
    isCurrent: false,
    locked: null,
    prunable: null,
    ...overrides
  };
}

describe("parseWorktreeList", () => {
  it("returns no worktrees for empty output", () => {
    expect(parseWorktreeList("")).toEqual([]);
  });

  it("parses a main worktree alone", () => {
    const stdout = record("worktree /repo", `HEAD ${HEAD_A}`, "branch refs/heads/main");

    expect(parseWorktreeList(stdout)).toEqual([worktree({})]);
  });

  it("parses a main worktree followed by linked worktrees, keeping Git's order", () => {
    const stdout =
      record("worktree /repo", `HEAD ${HEAD_A}`, "branch refs/heads/main") +
      record("worktree /repo-feat", `HEAD ${HEAD_B}`, "branch refs/heads/feat");

    const [main, linked] = parseWorktreeList(stdout);
    expect(main).toEqual(worktree({}));
    expect(linked).toEqual(
      worktree({
        path: "/repo-feat",
        head: HEAD_B,
        branch: "feat",
        isMain: false
      })
    );
  });

  it("parses a detached worktree with no branch", () => {
    const stdout = record("worktree /detached", `HEAD ${HEAD_B}`, "detached");

    expect(parseWorktreeList(stdout)).toEqual([
      worktree({ path: "/detached", head: HEAD_B, branch: null, detached: true, isMain: true })
    ]);
  });

  it("reads a lock with a reason", () => {
    const stdout = record(
      "worktree /locked",
      `HEAD ${HEAD_A}`,
      "branch refs/heads/feat",
      "locked on a drive that sleeps"
    );

    expect(parseWorktreeList(stdout)[0].locked).toEqual({ reason: "on a drive that sleeps" });
  });

  it("reads a lock without a reason as an empty reason", () => {
    const stdout = record("worktree /locked", `HEAD ${HEAD_A}`, "branch refs/heads/feat", "locked");

    expect(parseWorktreeList(stdout)[0].locked).toEqual({ reason: "" });
  });

  it("reads a prunable worktree with its reason", () => {
    const stdout = record(
      "worktree /gone",
      `HEAD ${HEAD_A}`,
      "branch refs/heads/feat",
      "prunable gitdir file points to non-existent location"
    );

    expect(parseWorktreeList(stdout)[0].prunable).toEqual({
      reason: "gitdir file points to non-existent location"
    });
  });

  it("reads a bare main record with no HEAD or branch", () => {
    const stdout = record("worktree /srv/project.git", "bare");

    expect(parseWorktreeList(stdout)).toEqual([
      worktree({
        path: "/srv/project.git",
        head: null,
        branch: null,
        bare: true
      })
    ]);
  });

  it("keeps a path with a space and one with a non-ASCII character intact", () => {
    const stdout =
      record("worktree /home/me/my repo", `HEAD ${HEAD_A}`, "branch refs/heads/main") +
      record("worktree /home/me/wé ünïcode", `HEAD ${HEAD_B}`, "detached");

    const [main, linked] = parseWorktreeList(stdout);
    expect(main.path).toBe("/home/me/my repo");
    expect(linked.path).toBe("/home/me/wé ünïcode");
  });

  it("ignores a field from a newer Git", () => {
    const stdout = record(
      "worktree /repo",
      `HEAD ${HEAD_A}`,
      "branch refs/heads/main",
      "future-field some value"
    );

    expect(parseWorktreeList(stdout)).toEqual([worktree({})]);
  });

  it("rejects a record that has no worktree field", () => {
    const stdout = record(`HEAD ${HEAD_A}`, "branch refs/heads/main");

    expect(() => parseWorktreeList(stdout)).toThrow(WorktreeListFormatError);
  });

  it("rejects a truncated record with no terminating empty field", () => {
    const stdout = `worktree /repo${NUL}HEAD ${HEAD_A}${NUL}`;

    expect(() => parseWorktreeList(stdout)).toThrow(WorktreeListFormatError);
  });
});

describe("loadWorktrees on real Git", () => {
  const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  const savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
  let root: string;
  let main: string;
  let feat: string;
  let detached: string;
  let locked: string;
  let gone: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-worktrees-"));
    const emptyConfig = path.join(root, "empty.gitconfig");
    fs.writeFileSync(emptyConfig, "");
    process.env.GIT_CONFIG_GLOBAL = emptyConfig;
    process.env.GIT_CONFIG_NOSYSTEM = "1";

    main = makeRepo();
    feat = path.join(root, "linked feat");
    detached = path.join(root, "détaché");
    locked = path.join(root, "locked wt");
    gone = path.join(root, "gone wt");

    git(["branch", "feat"], main);
    git(["worktree", "add", feat, "feat"], main);
    git(["worktree", "add", "--detach", detached], main);
    git(["worktree", "add", "-b", "locked-b", locked], main);
    git(["worktree", "lock", "--reason", "on a drive", locked], main);
    git(["branch", "gone-b"], main);
    git(["worktree", "add", gone, "gone-b"], main);
    fs.rmSync(gone, { recursive: true, force: true });
  });

  afterAll(() => {
    if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
    if (savedNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
    else process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem;
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function findByPath(worktrees: GitWorktree[], expected: string) {
    const target = await canonicalizePath(expected);
    const matches = await Promise.all(
      worktrees.map(async (item) => ({ item, canonical: await canonicalizePath(item.path) }))
    );
    return matches.find((match) => match.canonical === target)?.item;
  }

  it("lists main, a branch, a detached, a locked and a prunable worktree", async () => {
    const result = await loadWorktrees(simpleGit({ baseDir: main }), main);

    expect(result.error).toBeNull();
    expect(result.value).toHaveLength(5);
    expect(result.value[0].isMain).toBe(true);
    expect(result.value.slice(1).every((item) => !item.isMain)).toBe(true);

    const mainEntry = await findByPath(result.value, main);
    expect(mainEntry).toMatchObject({ branch: "main", detached: false, bare: false });
    expect(mainEntry?.head).toMatch(/^[0-9a-f]{40}$/);

    const featEntry = await findByPath(result.value, feat);
    expect(featEntry).toMatchObject({ branch: "feat", detached: false, locked: null });

    const detachedEntry = await findByPath(result.value, detached);
    expect(detachedEntry).toMatchObject({ branch: null, detached: true });

    const lockedEntry = await findByPath(result.value, locked);
    expect(lockedEntry).toMatchObject({ branch: "locked-b", locked: { reason: "on a drive" } });

    const goneEntry = await findByPath(result.value, gone);
    expect(goneEntry?.branch).toBe("gone-b");
    expect(goneEntry?.prunable?.reason).toMatch(/non-existent/);
  });

  it("marks only the main worktree as current when queried from it", async () => {
    const result = await loadWorktrees(simpleGit({ baseDir: main }), main);

    const current = result.value.filter((item) => item.isCurrent);
    expect(current).toHaveLength(1);
    expect(await findByPath(current, main)).toBeDefined();
  });

  it("marks only the linked worktree as current when queried from it", async () => {
    const result = await loadWorktrees(simpleGit({ baseDir: feat }), feat);

    expect(result.error).toBeNull();
    const current = result.value.filter((item) => item.isCurrent);
    expect(current).toHaveLength(1);
    expect(await findByPath(current, feat)).toBeDefined();
    expect(current[0].isMain).toBe(false);
  });

  it("matches the current worktree through a symlinked path", async () => {
    const link = path.join(root, "link to main");
    fs.symlinkSync(main, link, "dir");

    const result = await loadWorktrees(simpleGit({ baseDir: link }), link);

    const current = result.value.filter((item) => item.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].isMain).toBe(true);
  });

  describe("bare repository with two linked worktrees", () => {
    let bare: string;
    let bareLinkedBranch: string;
    let bareLinkedDetached: string;

    beforeAll(() => {
      bare = path.join(root, "bare repo.git");
      bareLinkedBranch = path.join(root, "bare wt ü");
      bareLinkedDetached = path.join(root, "bare detached");
      git(["clone", "--bare", main, bare], root);
      git(["worktree", "add", bareLinkedBranch, "main"], bare);
      git(["worktree", "add", "--detach", bareLinkedDetached, "main"], bare);
    });

    it("lists the bare record first with no HEAD, then both linked worktrees", async () => {
      const result = await loadWorktrees(simpleGit({ baseDir: bare }), bare);

      expect(result.error).toBeNull();
      expect(result.value).toHaveLength(3);
      expect(result.value[0]).toMatchObject({ bare: true, isMain: true, head: null, branch: null });
      expect(await findByPath(result.value, bareLinkedBranch)).toMatchObject({
        branch: "main",
        bare: false,
        isMain: false
      });
      expect(await findByPath(result.value, bareLinkedDetached)).toMatchObject({
        branch: null,
        detached: true,
        isMain: false
      });
    });

    it("marks the bare record as current when queried from the bare repository", async () => {
      const result = await loadWorktrees(simpleGit({ baseDir: bare }), bare);

      const current = result.value.filter((item) => item.isCurrent);
      expect(current).toHaveLength(1);
      expect(current[0].bare).toBe(true);
    });
  });
});
