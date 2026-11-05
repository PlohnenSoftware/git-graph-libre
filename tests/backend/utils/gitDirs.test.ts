import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveGitDirs } from "@/backend/utils/gitDirs";

const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function run(args: string[], cwd: string) {
  cp.execFileSync("git", args, { cwd, stdio: "pipe", env: gitEnv });
}

const roots: string[] = [];
let repo: string;
let holder: string;

beforeAll(() => {
  repo = fs.realpathSync(makeRepo());
  holder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ngg-gitdirs-")));
  roots.push(repo, holder);
});

afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

describe("resolveGitDirs", () => {
  it("returns the same .git for a normal repository", () => {
    const dir = path.join(repo, ".git");
    expect(resolveGitDirs(repo)).toEqual({ gitDir: dir, commonDir: dir });
  });

  it.each([
    ["a space", "wt with space"],
    ["a non-ASCII character", "wt-ünï"]
  ])("splits the admin dir from the common dir for a worktree path with %s", (_n, name) => {
    const wt = path.join(holder, name);
    run(["worktree", "add", "-b", `b-${name.length}`, wt], repo);
    const { gitDir, commonDir } = resolveGitDirs(wt);
    expect(commonDir).toBe(path.join(repo, ".git"));
    expect(path.dirname(gitDir)).toBe(path.join(commonDir, "worktrees"));
    expect(fs.statSync(path.join(gitDir, "HEAD")).isFile()).toBe(true);
  });

  it("agrees with git rev-parse for a worktree", () => {
    const wt = path.join(holder, "wt-parity");
    run(["worktree", "add", "-b", "parity", wt], repo);
    const out = cp
      .execFileSync("git", ["rev-parse", "--absolute-git-dir", "--git-common-dir"], {
        cwd: wt,
        encoding: "utf8",
        env: gitEnv
      })
      .split("\n");
    const dirs = resolveGitDirs(wt);
    expect(fs.realpathSync(dirs.gitDir)).toBe(fs.realpathSync(out[0]));
    expect(fs.realpathSync(dirs.commonDir)).toBe(fs.realpathSync(path.resolve(wt, out[1])));
  });

  it("treats a submodule's .git file as a full git dir with no commondir", () => {
    const inner = fs.realpathSync(makeRepo());
    roots.push(inner);
    run(["-c", "protocol.file.allow=always", "submodule", "add", inner, "sub"], repo);
    const { gitDir, commonDir } = resolveGitDirs(path.join(repo, "sub"));
    expect(commonDir).toBe(gitDir);
    expect(gitDir).toBe(path.join(repo, ".git", "modules", "sub"));
  });

  it("falls back to <repo>/.git when nothing can answer", () => {
    const missing = path.join(holder, "does-not-exist");
    const dir = path.join(missing, ".git");
    expect(resolveGitDirs(missing)).toEqual({ gitDir: dir, commonDir: dir });
  });

  it("resolves a bare repository, which has no .git, to itself from the file system", () => {
    const bare = path.join(holder, "bare.git");
    run(["init", "--bare", "-b", "main", bare], holder);
    const { gitDir, commonDir } = resolveGitDirs(bare);
    expect(fs.realpathSync(gitDir)).toBe(fs.realpathSync(bare));
    expect(fs.realpathSync(commonDir)).toBe(fs.realpathSync(bare));
  });

  it("resolves a bare repository with no git on PATH, so it spawns no process", () => {
    const bare = path.join(holder, "bare-no-path.git");
    run(["init", "--bare", "-b", "main", bare], holder);
    const emptyBin = fs.mkdtempSync(path.join(holder, "bin-"));
    const savedPath = process.env.PATH ?? "";
    process.env.PATH = emptyBin;
    try {
      const { gitDir, commonDir } = resolveGitDirs(bare);
      expect(fs.realpathSync(gitDir)).toBe(fs.realpathSync(bare));
      expect(fs.realpathSync(commonDir)).toBe(fs.realpathSync(bare));
    } finally {
      process.env.PATH = savedPath;
    }
  });

  it("does not import child_process, so resolving never spawns a process", () => {
    const source = fs.readFileSync(
      fileURLToPath(new URL("../../../src/backend/utils/gitDirs.ts", import.meta.url)),
      "utf8"
    );
    expect(source).not.toMatch(/child_process/);
    expect(source).not.toMatch(/execFileSync|spawnSync|execSync/);
  });

  it("answers the default for a .git file git itself refuses", () => {
    const dir = fs.mkdtempSync(path.join(holder, "odd-"));
    const dotGit = path.join(dir, ".git");
    fs.writeFileSync(dotGit, "not a gitdir line\n");
    expect(resolveGitDirs(dir)).toEqual({ gitDir: dotGit, commonDir: dotGit });
  });
});
