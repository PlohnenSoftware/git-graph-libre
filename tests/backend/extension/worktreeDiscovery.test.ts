import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitWorktree } from "@/backend/types";
import type { Config } from "@/config";
import type { WorktreeDetails } from "@/extension/repoLayout";
import { createWorktreeDiscovery } from "@/extension/worktreeDiscovery";
import type { OutsideWorktree } from "@/types";

// Worktrees are written only here, in repositories this file builds under its
// own temporary directory; the global git config is a temp file.

const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
const savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM;

let root: string;
let workspace: string;
let main: string;
let nested: string;
let sibling: string;
let outside: string;

const slash = (file: string) => file.replaceAll("\\", "/");

function makeManager(initial: string[]) {
  const repos = new Set(initial.map(slash));
  let details: ReadonlyMap<string, WorktreeDetails> = new Map();
  let outsideList: readonly OutsideWorktree[] = [];
  return {
    repos,
    manager: {
      getRepos: () => Object.fromEntries([...repos].map((repo) => [repo, { columnWidths: null }])),
      addRepo: vi.fn((repo: string) => repos.add(repo)),
      removeRepo: vi.fn((repo: string) => repos.delete(repo)),
      setWorktreeDetails: vi.fn(
        (
          nextDetails: ReadonlyMap<string, WorktreeDetails>,
          nextOutside: readonly OutsideWorktree[]
        ) => {
          details = nextDetails;
          outsideList = nextOutside;
        }
      )
    },
    details: () => details,
    outside: () => outsideList
  };
}

function makeConfig(outsideSetting: boolean) {
  return {
    gitPath: () => "git",
    backend: () => "git-cli",
    worktreesOutsideWorkspace: () => outsideSetting
  } as unknown as Pick<Config, "gitPath" | "backend" | "worktreesOutsideWorkspace">;
}

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ngg-discovery-")));
  const emptyConfig = path.join(root, "empty.gitconfig");
  fs.writeFileSync(emptyConfig, "");
  process.env.GIT_CONFIG_GLOBAL = emptyConfig;
  process.env.GIT_CONFIG_NOSYSTEM = "1";

  workspace = path.join(root, "work space");
  fs.mkdirSync(workspace);
  main = makeRepo();
  fs.renameSync(main, path.join(workspace, "main repo"));
  main = path.join(workspace, "main repo");
  // A moved repository has no admin links to repair: build the worktrees after it.
  nested = path.join(main, ".worktrees", "né x");
  sibling = path.join(workspace, "sibling wt");
  outside = path.join(root, "elsewhere", "out wt");
  fs.mkdirSync(path.dirname(outside));
  git(["worktree", "add", "-b", "nested-b", nested], main);
  git(["worktree", "add", "-b", "sibling-b", sibling], main);
  git(["worktree", "add", "-b", "outside-b", outside], main);
});

afterAll(() => {
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  if (savedNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
  else process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem;
  fs.rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("worktree discovery", () => {
  it("adds the worktrees inside the workspace the scan missed, nested and sibling alike", async () => {
    const fake = makeManager([main]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(workspace)]
    });

    expect(await discovery.reconcile()).toBe(true);

    expect([...fake.repos].toSorted()).toEqual(
      [slash(main), slash(nested), slash(sibling)].toSorted()
    );
  });

  it("offers a worktree outside the workspace as an outside entry, without adding it", async () => {
    const fake = makeManager([main]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(workspace)]
    });

    await discovery.reconcile();

    expect(fake.repos.has(slash(outside))).toBe(false);
    expect(fake.outside()).toEqual([
      expect.objectContaining({
        path: slash(outside),
        linked: true,
        branch: "outside-b",
        detached: false,
        repo: slash(main)
      })
    ]);
    expect(fake.details().get(slash(nested))).toEqual({ branch: "nested-b", detached: false });
    expect(fake.details().get(slash(main))).toEqual({ branch: "main", detached: false });
  });

  it("lists no outside entry while the setting is off, though it still adds inside ones", async () => {
    const fake = makeManager([main]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(false),
      roots: () => [slash(workspace)]
    });

    await discovery.reconcile();

    expect(fake.outside()).toEqual([]);
    expect(fake.repos.has(slash(nested))).toBe(true);
  });

  it("keeps an outside worktree while Git lists it", async () => {
    const fake = makeManager([main, outside]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(workspace)]
    });

    await discovery.reconcile();

    expect(fake.manager.removeRepo).not.toHaveBeenCalled();
    expect(fake.repos.has(slash(outside))).toBe(true);
    // Already a repository, so it is no longer an outside entry to select.
    expect(fake.outside()).toEqual([]);
  });

  it("drops an outside worktree moved by hand, which Git lists at its old path as prunable", async () => {
    const before = path.join(root, "elsewhere", "before move");
    const after = path.join(root, "elsewhere", "after move");
    git(["worktree", "add", "-b", "moved-b", before], main);
    fs.renameSync(before, after);
    const fake = makeManager([main, after]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(workspace)]
    });

    expect(await discovery.reconcile()).toBe(true);

    expect(fake.manager.removeRepo).toHaveBeenCalledWith(slash(after));
    git(["worktree", "remove", "--force", "--force", before], main);
  });

  it("leaves a deleted outside folder to the existence check, and does not throw", async () => {
    const gone = path.join(root, "elsewhere", "gone wt");
    git(["worktree", "add", "-b", "gone-b", gone], main);
    const fake = makeManager([main, gone]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(workspace)]
    });
    fs.rmSync(gone, { recursive: true, force: true });

    await expect(discovery.reconcile()).resolves.toBeTypeOf("boolean");

    git(["worktree", "prune"], main);
  });

  it("never drops a worktree inside the workspace that Git stops listing", async () => {
    const fake = makeManager([main, sibling]);
    const list = vi.fn(async (): Promise<GitWorktree[]> => []);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(workspace)],
      list
    });

    await discovery.reconcile();

    expect(fake.manager.removeRepo).not.toHaveBeenCalled();
  });

  it("skips a worktree Git does not accept as a repository root", async () => {
    const fake = makeManager([main]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(workspace)],
      isReady: async (directory) => slash(directory) !== slash(nested)
    });

    await discovery.reconcile();

    expect(fake.repos.has(slash(nested))).toBe(false);
    expect(fake.repos.has(slash(sibling))).toBe(true);
  });

  it("changes nothing when Git cannot list a group", async () => {
    const fake = makeManager([main, outside]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(workspace)],
      list: async () => null
    });

    expect(await discovery.reconcile()).toBe(false);
    expect([...fake.repos].toSorted()).toEqual([slash(main), slash(outside)].toSorted());
  });

  it("offers the main worktree outside the workspace when only a linked one is listed", async () => {
    const fake = makeManager([sibling]);
    const discovery = createWorktreeDiscovery({
      repoManager: fake.manager,
      config: makeConfig(true),
      roots: () => [slash(sibling)]
    });

    await discovery.reconcile();

    const mains = fake.outside().filter((entry) => !entry.linked);
    expect(mains.map((entry) => entry.path)).toEqual([slash(main)]);
    expect(fake.outside().every((entry) => entry.repo === slash(sibling))).toBe(true);
  });
});
