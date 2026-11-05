import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import {
  parseEngineWorktrees,
  readWorktrees,
  type WorktreesAddon,
  type WorktreesDeps
} from "@/backend/engine/worktrees";
import { loadWorktrees } from "@/backend/queries/worktrees";
import { setOperationLog } from "@/backend/utils/operationLog";

/**
 * `readWorktrees` (slice W03): the engine lists worktrees only on `auto`, for
 * a verified repository, when the addon carries `listWorktrees` and answers
 * the strict payload. Everything else, and every decline, is
 * `git worktree list` through `loadWorktrees`. The parity half drives the
 * real addon against that CLI list on real repositories.
 */

const HEAD = "a".repeat(40);

function entry(overrides: Record<string, unknown> = {}) {
  return {
    path: "/repo",
    head: HEAD,
    branch: "main",
    detached: false,
    bare: false,
    isMain: true,
    locked: null,
    ...overrides
  };
}

async function readLogged(
  git_: ReturnType<typeof simpleGit>,
  dir: string,
  deps: WorktreesDeps
): Promise<{ result: Awaited<ReturnType<typeof readWorktrees>>; lines: string[] }> {
  const lines: string[] = [];
  const log = setOperationLog((line) => lines.push(line));
  try {
    return { result: await readWorktrees(git_, dir, deps), lines };
  } finally {
    log.dispose();
  }
}

const engineDeps = (provider: () => WorktreesAddon | null): WorktreesDeps => ({
  backend: () => "auto",
  addonProvider: provider,
  isVerified: () => true
});

function listAddon(result: string | Error) {
  const listWorktrees = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  );
  return { provider: () => ({ listWorktrees }), listWorktrees };
}

describe("parseEngineWorktrees", () => {
  it("maps a main and a linked entry, with the lock reason", () => {
    const payload = JSON.stringify([
      entry(),
      entry({ path: "/wt", isMain: false, locked: "on a drive" })
    ]);
    expect(parseEngineWorktrees(payload)).toEqual([
      { ...entry(), locked: null },
      { ...entry({ path: "/wt", isMain: false }), locked: { reason: "on a drive" } }
    ]);
  });

  it.each([
    ["not JSON", "{"],
    ["not an array", "{}"],
    ["empty", "[]"],
    ["an entry that is not an object", "[1]"],
    ["an empty path", JSON.stringify([entry({ path: "" })])],
    ["a non-boolean flag", JSON.stringify([entry({ detached: "no" })])],
    ["a numeric head", JSON.stringify([entry({ head: 1 })])],
    ["a missing lock", JSON.stringify([{ ...entry(), locked: undefined }])],
    ["no main entry first", JSON.stringify([entry({ isMain: false })])],
    ["a second main entry", JSON.stringify([entry(), entry({ path: "/b" })])]
  ])("rejects %s", (_name, payload) => {
    expect(parseEngineWorktrees(payload)).toBeNull();
  });
});

describe("readWorktrees routing", () => {
  const dirs: string[] = [];
  const repo = (() => {
    const dir = makeRepo();
    dirs.push(dir);
    return dir;
  })();
  afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  const viaCli = async () => (await loadWorktrees(simpleGit({ baseDir: repo }), repo)).value;
  const goodPayload = JSON.stringify([entry({ path: repo })]);

  it("serves the engine's list without the CLI, and marks the current worktree", async () => {
    const addon = listAddon(goodPayload);

    const { result, lines } = await readLogged(
      simpleGit({ baseDir: repo }),
      repo,
      engineDeps(addon.provider)
    );

    expect(addon.listWorktrees).toHaveBeenCalledWith(repo);
    expect(result.error).toBeNull();
    expect(result.value).toEqual([
      { ...entry({ path: repo }), isCurrent: true, locked: null, prunable: null }
    ]);
    expect(lines).toContainEqual(expect.stringContaining("operation=listWorktrees backend=engine"));
  });

  const cliCases: [string, WorktreesDeps, string][] = [
    [
      "the git-cli setting",
      { ...engineDeps(() => listAddon(goodPayload).provider()), backend: () => "git-cli" },
      "setting"
    ],
    [
      "an unverified repository",
      { ...engineDeps(() => listAddon(goodPayload).provider()), isVerified: () => false },
      "unverified"
    ],
    ["no addon", engineDeps(() => null), "engineUnavailable"],
    ["an older addon without the export", engineDeps(() => ({})), "noListWorktrees"],
    [
      "a decline",
      engineDeps(() => listAddon(new Error("Unsupported: worktree list: x")).provider()),
      "declined"
    ],
    [
      "another engine error",
      engineDeps(() => listAddon(new Error("Io: disk")).provider()),
      "engineThrew"
    ],
    ["a malformed payload", engineDeps(() => listAddon("[]").provider()), "malformedPayload"]
  ];
  it.each(cliCases)("goes to the CLI for %s", async (_name, deps, reason) => {
    const { result, lines } = await readLogged(simpleGit({ baseDir: repo }), repo, deps);

    expect(result.value).toEqual(await viaCli());
    expect(result.value).toHaveLength(1);
    expect(lines).toContainEqual(
      expect.stringContaining(`operation=listWorktrees backend=cli reason=${reason}`)
    );
  });
});

describe("readWorktrees parity with git worktree list", () => {
  const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  const savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
  let root: string;
  let main: string;
  let feat: string;
  let locked: string;
  let gone: string;
  let orphan: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-wt-engine-"));
    const emptyConfig = path.join(root, "empty.gitconfig");
    fs.writeFileSync(emptyConfig, "");
    process.env.GIT_CONFIG_GLOBAL = emptyConfig;
    process.env.GIT_CONFIG_NOSYSTEM = "1";

    main = makeRepo();
    feat = path.join(root, "linked feat");
    locked = path.join(root, "locked wt");
    gone = path.join(root, "gone wt");
    orphan = path.join(root, "orphan wt");
    git(["worktree", "add", "-b", "feat", feat], main);
    git(["worktree", "add", "--detach", path.join(root, "détaché")], main);
    git(["worktree", "add", "--detach", path.join(root, "Zed")], main);
    git(["worktree", "add", "-b", "locked-b", locked], main);
    git(["worktree", "lock", "--reason", "on a drive", locked], main);
    git(["worktree", "add", "--detach", path.join(root, "locked bare")], main);
    git(["worktree", "lock", path.join(root, "locked bare")], main);
  });

  afterAll(() => {
    if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
    if (savedNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
    else process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem;
    fs.rmSync(main, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });

  const engineOnly = (): WorktreesDeps => {
    const addon = loadEngineAddon();
    if (addon === null) {
      throw new Error("Engine addon not built: run pnpm run engine:build.");
    }
    expect(addon.listWorktrees, "listWorktrees export").toBeTypeOf("function");
    return engineDeps(() => addon);
  };

  async function expectParity(dir: string): Promise<number> {
    const client = simpleGit({ baseDir: dir });
    const { result, lines } = await readLogged(client, dir, engineOnly());
    const viaCli = await loadWorktrees(client, dir);
    expect(viaCli.error).toBeNull();
    expect(lines).toContainEqual(expect.stringContaining("operation=listWorktrees backend=engine"));
    expect(result.error).toBeNull();
    expect(result.value).toEqual(viaCli.value);
    return result.value.length;
  }

  it("lists the same worktrees as Git, from the main and from a linked worktree", async () => {
    expect(await expectParity(main)).toBe(6);
    expect(await expectParity(feat)).toBe(6);
    expect(await expectParity(locked)).toBe(6);
  });

  it("matches Git through a symlinked path", async () => {
    const link = path.join(root, "link to main");
    fs.symlinkSync(main, link, "dir");
    expect(await expectParity(link)).toBe(6);
  });

  it("matches Git for a bare main repository with linked worktrees", async () => {
    const bare = path.join(root, "origin.git");
    git(["clone", "--bare", main, bare], root);
    git(["worktree", "add", "-b", "b-feat", path.join(root, "bare linked"), "main"], bare);
    expect(await expectParity(bare)).toBe(2);
    expect(await expectParity(path.join(root, "bare linked"))).toBe(2);
  });

  it("declines a prunable worktree, and the CLI answers with its reason", async () => {
    const repo = makeRepo();
    try {
      git(["worktree", "add", "-b", "gone-b", gone], repo);
      git(["worktree", "add", "--detach", path.join(root, "kept wt")], repo);
      fs.rmSync(gone, { recursive: true, force: true });
      const client = simpleGit({ baseDir: repo });

      const { result, lines } = await readLogged(client, repo, engineOnly());

      expect(lines).toContainEqual(
        expect.stringContaining("operation=listWorktrees backend=cli reason=declined")
      );
      expect(result.value).toEqual((await loadWorktrees(client, repo)).value);
      expect(result.value.find((item) => item.branch === "gone-b")?.prunable?.reason).toMatch(
        /non-existent/
      );
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("declines an admin entry with no gitdir file, and the CLI answers", async () => {
    const repo = makeRepo();
    try {
      git(["worktree", "add", "-b", "orphan-b", orphan], repo);
      // Git sanitizes the folder name into the admin id, so list the one entry.
      const [id] = fs.readdirSync(path.join(repo, ".git", "worktrees"));
      fs.rmSync(path.join(repo, ".git", "worktrees", id, "gitdir"));
      const client = simpleGit({ baseDir: repo });

      const { result, lines } = await readLogged(client, repo, engineOnly());

      expect(lines).toContainEqual(
        expect.stringContaining("operation=listWorktrees backend=cli reason=declined")
      );
      expect(result.value).toEqual((await loadWorktrees(client, repo)).value);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
