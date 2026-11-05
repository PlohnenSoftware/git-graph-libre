import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { type SimpleGit, simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadBranches } from "@/backend/queries/loadBranches";
import type { GitWorktree } from "@/backend/types";
import { canonicalizePath } from "@/backend/utils/git";
import { setOperationLog } from "@/backend/utils/operationLog";

const NUL = "\0";
const HEAD = "a".repeat(40);

let savedGlobal: string | undefined;
let savedNoSystem: string | undefined;
let root: string;
let main: string;
let feat: string;
let detached: string;
let twinMain: string;
let twinLinked: string;
let remote: string;
let tracking: string;

beforeAll(() => {
  savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
  root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-loadbranches-wt-"));
  const emptyConfig = path.join(root, "empty.gitconfig");
  fs.writeFileSync(emptyConfig, "");
  process.env.GIT_CONFIG_GLOBAL = emptyConfig;
  process.env.GIT_CONFIG_NOSYSTEM = "1";

  // A linked worktree with a space in its path, and a detached one with a non-ASCII name.
  main = makeRepo();
  feat = path.join(root, "linked feat");
  detached = path.join(root, "détaché");
  git(["branch", "feat"], main);
  git(["worktree", "add", feat, "feat"], main);
  git(["worktree", "add", "--detach", detached], main);

  // One branch checked out in two worktrees, the way --ignore-other-worktrees allows.
  twinMain = makeRepo();
  twinLinked = path.join(root, "twin wt");
  git(["branch", "twin"], twinMain);
  git(["worktree", "add", twinLinked, "twin"], twinMain);
  git(["checkout", "--ignore-other-worktrees", "twin"], twinMain);

  // Upstreams: one branch tracks origin/main, one tracks nothing.
  remote = makeRepo();
  tracking = makeRepo();
  git(["remote", "add", "origin", remote], tracking);
  git(["fetch", "origin"], tracking);
  git(["branch", "--set-upstream-to=origin/main", "main"], tracking);
  git(["branch", "tracked"], tracking);
  git(["branch", "--set-upstream-to=origin/main", "tracked"], tracking);
  git(["branch", "untracked"], tracking);
});

afterAll(() => {
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  if (savedNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
  else process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem;
  for (const dir of [main, twinMain, remote, tracking, root]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function input(repo: string) {
  return { showRemoteBranches: false, hard: false, currentRepo: repo, gitPath: "git" };
}

async function findWorktree(worktrees: GitWorktree[], expected: string) {
  const target = await canonicalizePath(expected);
  const canonical = await Promise.all(
    worktrees.map(async (item) => ({ item, path: await canonicalizePath(item.path) }))
  );
  return canonical.find((match) => match.path === target)?.item;
}

/** A SimpleGit stand-in: the branch list is fixed, and `raw` answers each Git command. */
function fakeGit(raw: (args: string[]) => Promise<string>): SimpleGit {
  const branches = { all: ["main"], current: "main", detached: false };
  return {
    branch: async () => branches,
    branchLocal: async () => branches,
    raw
  } as unknown as SimpleGit;
}

/** Runs `operation` and returns what the operation log wrote while it ran. */
async function captureLog<T>(operation: () => Promise<T>): Promise<{ value: T; lines: string[] }> {
  const lines: string[] = [];
  const log = setOperationLog((line) => lines.push(line));
  try {
    return { value: await operation(), lines };
  } finally {
    log.dispose();
  }
}

describe("loadBranches worktrees", () => {
  it("lists every worktree and marks the main one when asked from the main worktree", async () => {
    const result = await loadBranches(simpleGit(main), input(main));

    expect(result.error).toBeNull();
    expect(result.worktrees).toHaveLength(3);
    expect(result.worktrees[0].isMain).toBe(true);

    const mainEntry = await findWorktree(result.worktrees, main);
    expect(mainEntry).toMatchObject({ branch: "main", isMain: true, isCurrent: true });

    const linked = await findWorktree(result.worktrees, feat);
    expect(linked).toMatchObject({ branch: "feat", detached: false, isMain: false });
    expect(linked?.isCurrent).toBe(false);
  });

  it("reports a detached worktree with no branch", async () => {
    const result = await loadBranches(simpleGit(main), input(main));

    const entry = await findWorktree(result.worktrees, detached);
    expect(entry).toMatchObject({ branch: null, detached: true, isCurrent: false });
  });

  it("marks the linked worktree as current when asked from it", async () => {
    const result = await loadBranches(simpleGit(feat), input(feat));

    expect((await findWorktree(result.worktrees, feat))?.isCurrent).toBe(true);
    expect((await findWorktree(result.worktrees, main))?.isCurrent).toBe(false);
  });

  it("lists both worktrees of a branch that is checked out twice", async () => {
    const result = await loadBranches(simpleGit(twinMain), input(twinMain));

    const twinned = result.worktrees.filter((item) => item.branch === "twin");
    expect(twinned).toHaveLength(2);
    expect(await findWorktree(twinned, twinMain)).toBeDefined();
    expect(await findWorktree(twinned, twinLinked)).toBeDefined();
  });

  it("names each local branch's upstream, and null for one that tracks nothing", async () => {
    const result = await loadBranches(simpleGit(tracking), input(tracking));

    expect(result.error).toBeNull();
    expect(result.upstreams).toEqual({
      main: "origin/main",
      tracked: "origin/main",
      untracked: null
    });
  });

  it("logs a failed worktree list and still returns the branches and upstreams", async () => {
    const raw = async (args: string[]) => {
      if (args[0] === "worktree") throw new Error("fatal: worktree list failed");
      return `refs/heads/main${NUL}refs/remotes/origin/main\n`;
    };

    const { value: result, lines } = await captureLog(() =>
      loadBranches(fakeGit(raw), input(main))
    );

    expect(result.error).toBeNull();
    expect(result.branches).toEqual(["main"]);
    expect(result.worktrees).toEqual([]);
    expect(result.upstreams).toEqual({ main: "origin/main" });
    expect(lines.some((line) => line.includes("worktrees=unavailable"))).toBe(true);
  });

  it("keeps a branch named __proto__ as an own upstream key", async () => {
    const raw = async (args: string[]) => {
      if (args[0] === "worktree") throw new Error("fatal: worktree list failed");
      return `refs/heads/__proto__${NUL}refs/remotes/origin/__proto__\n`;
    };

    const result = await loadBranches(fakeGit(raw), input(main));

    const own = Object.getOwnPropertyDescriptor(result.upstreams, "__proto__");
    expect(own?.value).toBe("origin/__proto__");
  });

  it("logs a failed upstream read and still returns the branches and worktrees", async () => {
    const raw = async (args: string[]) => {
      if (args[0] === "for-each-ref") throw new Error("fatal: for-each-ref failed");
      return `worktree ${main}${NUL}HEAD ${HEAD}${NUL}branch refs/heads/main${NUL}${NUL}`;
    };

    const { value: result, lines } = await captureLog(() =>
      loadBranches(fakeGit(raw), input(main))
    );

    expect(result.error).toBeNull();
    expect(result.branches).toEqual(["main"]);
    expect(result.worktrees).toHaveLength(1);
    expect(result.worktrees[0]).toMatchObject({ branch: "main", isMain: true });
    expect(result.upstreams).toEqual({});
    expect(lines.some((line) => line.includes("upstreams=unavailable"))).toBe(true);
  });

  it("takes the worktree list from an injected reader, asked about the current repository", async () => {
    const injected: GitWorktree = {
      path: "/injected",
      head: HEAD,
      branch: "injected",
      detached: false,
      bare: false,
      isMain: true,
      isCurrent: false,
      locked: null,
      prunable: null
    };
    const asked: string[] = [];
    const readWorktrees = async (_git: SimpleGit, repo: string) => {
      asked.push(repo);
      return { value: [injected], error: null };
    };

    const result = await loadBranches(simpleGit(main), { ...input(main), readWorktrees });

    expect(result.worktrees).toEqual([injected]);
    expect(asked).toEqual([main]);
  });

  it("logs a failed injected reader, returns no worktrees and keeps the response shape", async () => {
    const readWorktrees = async () => ({
      value: [],
      error: { message: "engine declined", stderr: null, exitCode: null, task: null }
    });

    const { value: result, lines } = await captureLog(() =>
      loadBranches(simpleGit(main), { ...input(main), readWorktrees })
    );

    expect(result.error).toBeNull();
    expect(result.worktrees).toEqual([]);
    expect(result.branches).toContain("main");
    expect(Object.keys(result).sort()).toEqual(
      ["branches", "error", "hard", "head", "isRepo", "upstreams", "worktrees"].sort()
    );
    expect(lines.some((line) => line.includes("worktrees=unavailable"))).toBe(true);
  });
});
