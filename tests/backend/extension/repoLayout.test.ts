import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildRepoLayout,
  mainWorktreeOf,
  type WorktreeDetails,
  worktreeGroupOf
} from "@/extension/repoLayout";

// Fixtures live under a temp directory this file creates; worktrees are added
// only to repositories it built.

const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
const savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM;

let root: string;
let main: string;
let sibling: string;
let nested: string;
let bare: string;
let bareLinked: string;
let link: string;

const slash = (file: string) => file.replaceAll("\\", "/");

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ngg-layout-")));
  const emptyConfig = path.join(root, "empty.gitconfig");
  fs.writeFileSync(emptyConfig, "");
  process.env.GIT_CONFIG_GLOBAL = emptyConfig;
  process.env.GIT_CONFIG_NOSYSTEM = "1";

  main = makeRepo();
  sibling = path.join(root, "side by side é");
  nested = path.join(main, ".worktrees", "in side");
  git(["worktree", "add", "-b", "sibling-b", sibling], main);
  git(["worktree", "add", "-b", "nested-b", nested], main);

  bare = path.join(root, "store.git");
  git(["clone", "--bare", main, bare], root);
  bareLinked = path.join(root, "from bare");
  git(["worktree", "add", "-b", "bare-b", bareLinked, "main"], bare);

  link = path.join(root, "link to main");
  fs.symlinkSync(main, link, "dir");
});

afterAll(() => {
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  if (savedNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
  else process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem;
  fs.rmSync(main, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
});

describe("worktreeGroupOf", () => {
  it("puts a main, a sibling and a nested worktree in one group, only the main unlinked", () => {
    const groups = [main, sibling, nested].map((repo) => worktreeGroupOf(repo));

    expect(new Set(groups.map((group) => group.commonDir)).size).toBe(1);
    expect(groups.map((group) => group.linked)).toEqual([false, true, true]);
  });

  it("groups by the common dir, whatever the spelling of the path", () => {
    expect(worktreeGroupOf(link)).toEqual(worktreeGroupOf(main));
  });

  it("groups linked worktrees of a bare repository under the bare directory", () => {
    const group = worktreeGroupOf(bareLinked);

    expect(group.linked).toBe(true);
    expect(group.commonDir).toBe(slash(fs.realpathSync(bare)));
    expect(group.commonDir).not.toBe(worktreeGroupOf(main).commonDir);
  });

  it("is not linked for a plain repository or an unknown folder", () => {
    expect(worktreeGroupOf(main).linked).toBe(false);
    expect(worktreeGroupOf(path.join(root, "nothing here")).linked).toBe(false);
  });
});

describe("mainWorktreeOf", () => {
  it("names the folder beside a .git common dir", () => {
    expect(mainWorktreeOf(worktreeGroupOf(sibling).commonDir)).toBe(slash(fs.realpathSync(main)));
  });

  it("names none for a bare repository or a git dir not called .git", () => {
    expect(mainWorktreeOf(worktreeGroupOf(bareLinked).commonDir)).toBeNull();
    expect(mainWorktreeOf("/somewhere/store.git")).toBeNull();
    expect(mainWorktreeOf(".git")).toBeNull();
  });
});

describe("buildRepoLayout", () => {
  it("reports each repository's group, link state and listed branch", () => {
    const details = new Map<string, WorktreeDetails>([
      [slash(sibling), { branch: "sibling-b", detached: false }],
      [slash(nested), { branch: null, detached: true }]
    ]);

    const layout = buildRepoLayout([main, sibling, nested], details, []);

    expect(layout.worktrees[sibling]).toMatchObject({ linked: true, branch: "sibling-b" });
    expect(layout.worktrees[nested]).toMatchObject({ linked: true, branch: null, detached: true });
    expect(layout.worktrees[main]).toMatchObject({ linked: false, branch: null, detached: false });
    expect(layout.worktrees[main].commonDir).toBe(layout.worktrees[sibling].commonDir);
  });

  it("leaves out an outside entry that has since joined the repository list", () => {
    const joined = {
      path: slash(sibling),
      commonDir: "c",
      linked: true,
      branch: "x",
      detached: false,
      repo: slash(main)
    };
    const other = { ...joined, path: "/elsewhere/wt" };

    const layout = buildRepoLayout([main, sibling], new Map(), [joined, other]);

    expect(layout.outside).toEqual([other]);
  });
});
