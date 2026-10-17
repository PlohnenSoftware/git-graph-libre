import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git } from "@tests/backend/helpers";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import {
  inspectRepository,
  isGitTrustError,
  safeDirectoryEntry,
  trustGitRepository
} from "@/backend/utils/repositoryProbe";

// Every Git child in this file runs against an isolated global/system config
// inside the fixture root, so the real user's safe.directory list is never
// read or written. Foreign ownership is simulated with
// GIT_TEST_ASSUME_DIFFERENT_OWNER, the switch Git's own test suite uses.

const ENV_KEYS = ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_TEST_ASSUME_DIFFERENT_OWNER"];
const savedEnv = new Map<string, string | undefined>();

let root: string;
let globalConfig: string;
let repo: string;
let plain: string;
let bare: string;
let corrupt: string;
let badLink: string;
let worktree: string;
let submodule: string;
let symlink: string;

function initRepo(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  try {
    git(["init", "-b", "main"], dir);
  } catch {
    git(["init"], dir);
    git(["checkout", "-b", "main"], dir);
  }
  git(["config", "user.email", "t@t.com"], dir);
  git(["config", "user.name", "T"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  fs.writeFileSync(path.join(dir, "f"), "x");
  git(["add", "."], dir);
  git(["commit", "-m", "init"], dir);
}

function isolate(foreignOwner: boolean) {
  process.env.GIT_CONFIG_GLOBAL = globalConfig;
  process.env.GIT_CONFIG_SYSTEM = "/dev/null";
  if (foreignOwner) process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER = "1";
  else delete process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER;
}

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  root = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-probe-"));
  globalConfig = path.join(root, "global.gitconfig");
  fs.writeFileSync(globalConfig, "");
  isolate(false);

  repo = path.join(root, "repo");
  initRepo(repo);
  fs.mkdirSync(path.join(repo, "sub"));
  git(["worktree", "add", path.join(root, "wt"), "-b", "wt1"], repo);
  worktree = path.join(root, "wt");

  const child = path.join(root, "child-src");
  initRepo(child);
  const parent = path.join(root, "parent");
  initRepo(parent);
  git(["-c", "protocol.file.allow=always", "submodule", "add", child, "modules/child"], parent);
  git(["commit", "-m", "sub"], parent);
  submodule = path.join(parent, "modules", "child");

  plain = path.join(root, "plain");
  fs.mkdirSync(plain);
  bare = path.join(root, "bare.git");
  git(["init", "--bare", bare], root);
  corrupt = path.join(root, "corrupt");
  fs.mkdirSync(path.join(corrupt, ".git"), { recursive: true });
  badLink = path.join(root, "badlink");
  fs.mkdirSync(badLink);
  fs.writeFileSync(path.join(badLink, ".git"), "gitdir: /nonexistent\n");
  symlink = path.join(root, "link");
  fs.symlinkSync(repo, symlink, "dir");
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  fs.writeFileSync(globalConfig, "");
  isolate(false);
});

afterEach(() => {
  isolate(false);
});

const GIT = "git";
const MISSING_GIT = "/nonexistent/git-graph-libre-git";

describe("inspectRepository with Git available", () => {
  it("reports a ready repository at its root", async () => {
    const result = await inspectRepository(repo, { gitPath: GIT, useEngine: true });
    expect(result.state).toBe("ready");
    expect(result.repository).toBe(true);
    expect(result.detectedBy).toBe("git");
  });

  it("reports plain folders and repository subdirectories as not repositories", async () => {
    for (const dir of [plain, path.join(repo, "sub")]) {
      const result = await inspectRepository(dir, { gitPath: GIT, useEngine: true });
      expect(result.state).toBe("notRepository");
      expect(result.repository).toBe(false);
    }
  });

  it("recognizes foreign ownership without ever consulting the engine", async () => {
    isolate(true);
    const engineRoot = vi.fn(async () => repo);
    const result = await inspectRepository(repo, { gitPath: GIT, useEngine: true, engineRoot });
    expect(result.state).toBe("untrusted");
    expect(result.repository).toBe(true);
    expect(result.detail).toContain("dubious ownership");
    expect(engineRoot).not.toHaveBeenCalled();
  });

  it("does not offer a subdirectory of an untrusted repository for trust", async () => {
    isolate(true);
    const result = await inspectRepository(path.join(repo, "sub"), {
      gitPath: GIT,
      useEngine: false
    });
    expect(result.state).toBe("notRepository");
  });

  it("recognizes foreign ownership at a worktree and a submodule root", async () => {
    isolate(true);
    for (const dir of [worktree, submodule]) {
      const result = await inspectRepository(dir, { gitPath: GIT, useEngine: false });
      expect(result.state).toBe("untrusted");
      expect(result.repository).toBe(true);
    }
  });

  it("keeps a damaged .git directory as an access failure with unknown presence", async () => {
    const result = await inspectRepository(corrupt, { gitPath: GIT, useEngine: false });
    expect(result.state).toBe("error");
    expect(result.repository).toBeNull();
  });

  it("keeps a broken gitfile as access error with unknown presence", async () => {
    const result = await inspectRepository(badLink, {
      gitPath: GIT,
      useEngine: true,
      engineRoot: async () => {
        throw new Error("engine exploded");
      }
    });
    expect(result.state).toBe("error");
    expect(result.repository).toBeNull();
    expect(result.engineDetail).toContain("engine exploded");
  });

  it("does not mistake a bare repository for a ready worktree", async () => {
    const result = await inspectRepository(bare, { gitPath: GIT, useEngine: false });
    expect(result.state).toBe("error");
    expect(result.repository).toBe(false);
  });
});

describe("inspectRepository with the Git executable missing", () => {
  it("never consults the engine when the preference is CLI-only", async () => {
    const engineRoot = vi.fn(async () => repo);
    const result = await inspectRepository(repo, {
      gitPath: MISSING_GIT,
      useEngine: false,
      engineRoot
    });
    expect(result.state).toBe("gitUnavailable");
    expect(result.repository).toBeNull();
    expect(engineRoot).not.toHaveBeenCalled();
  });

  it("confirms presence through the engine without calling it ready", async () => {
    const result = await inspectRepository(repo, {
      gitPath: MISSING_GIT,
      useEngine: true,
      engineRoot: async () => repo
    });
    expect(result.state).toBe("gitUnavailable");
    expect(result.repository).toBe(true);
    expect(result.detectedBy).toBe("engine");
  });

  it("takes the engine's typed absence answer as proof", async () => {
    const result = await inspectRepository(repo, {
      gitPath: MISSING_GIT,
      useEngine: true,
      engineRoot: async () => {
        throw new Error("NotARepository: no git repository found");
      }
    });
    expect(result.state).toBe("gitUnavailable");
    expect(result.repository).toBe(false);
    expect(result.detectedBy).toBe("engine");
  });

  it("uses the filesystem answer for marker-less folders", async () => {
    const result = await inspectRepository(plain, { gitPath: MISSING_GIT, useEngine: false });
    expect(result.state).toBe("gitUnavailable");
    expect(result.repository).toBe(false);
    expect(result.detectedBy).toBe("filesystem");
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "keeps inaccessible directories unknown rather than claiming absence",
    async () => {
      const denied = path.join(root, "denied");
      fs.mkdirSync(denied, { recursive: true });
      fs.chmodSync(denied, 0);
      try {
        const result = await inspectRepository(denied, { gitPath: MISSING_GIT, useEngine: false });
        expect(result.repository).toBeNull();
        expect(result.detectedBy).toBeNull();
      } finally {
        fs.chmodSync(denied, 0o700);
      }
    }
  );

  it("does not replace a native access failure with a filesystem absence guess", async () => {
    const result = await inspectRepository(plain, {
      gitPath: MISSING_GIT,
      useEngine: true,
      engineRoot: async () => {
        throw new Error("Permission denied");
      }
    });
    expect(result.repository).toBeNull();
    expect(result.detectedBy).toBe("engine");
  });

  const realAddon = loadEngineAddon();
  it.skipIf(!realAddon?.repoRoot)("discovers through the real engine binary", async () => {
    const found = await inspectRepository(repo, { gitPath: MISSING_GIT, useEngine: true });
    expect(found.repository).toBe(true);
    expect(found.detectedBy).toBe("engine");
    const absent = await inspectRepository(plain, { gitPath: MISSING_GIT, useEngine: true });
    expect(absent.repository).toBe(false);
    const bareFound = await inspectRepository(bare, { gitPath: GIT, useEngine: true });
    expect(bareFound.state).toBe("error");
    expect(bareFound.repository).toBe(true);
  });
});

async function trustConfirmed(directory: string) {
  await trustGitRepository(directory, GIT, await safeDirectoryEntry(directory, GIT));
}

describe("safeDirectoryEntry", () => {
  it("is the path Git names in its rejection, resolved to the repository itself", async () => {
    isolate(true);
    // Through the symlink too: Git names the resolved path, and that spelling
    // is what the user confirms and what is written.
    expect(await safeDirectoryEntry(repo, GIT)).toBe(fs.realpathSync(repo));
    expect(await safeDirectoryEntry(symlink, GIT)).toBe(fs.realpathSync(repo));
  });

  it("refuses a repository whose path holds a wildcard, writing nothing", async () => {
    const starred = path.join(root, "*");
    initRepo(starred);
    try {
      isolate(true);
      expect((await inspectRepository(starred, { gitPath: GIT, useEngine: false })).state).toBe(
        "untrusted"
      );
      await expect(safeDirectoryEntry(starred, GIT)).rejects.toThrow(/exact repository path/);
      await expect(trustGitRepository(starred, GIT, `${root}/*`)).rejects.toThrow();
      expect(fs.readFileSync(globalConfig, "utf8")).toBe("");
    } finally {
      fs.rmSync(starred, { recursive: true, force: true });
    }
  });
});

describe("trustGitRepository", () => {
  it("writes exactly the canonical root and recovers", async () => {
    isolate(true);
    await trustConfirmed(repo);
    const written = fs.readFileSync(globalConfig, "utf8");
    expect(written).toContain(`directory = ${fs.realpathSync(repo)}`);
    expect(written).not.toContain("*");
    const after = await inspectRepository(repo, { gitPath: GIT, useEngine: false });
    expect(after.state).toBe("ready");
  });

  it("trusts through a symlink by its canonical target", async () => {
    isolate(true);
    const before = await inspectRepository(symlink, { gitPath: GIT, useEngine: false });
    expect(before.state).toBe("untrusted");
    await trustConfirmed(symlink);
    expect(fs.readFileSync(globalConfig, "utf8")).toContain(`directory = ${fs.realpathSync(repo)}`);
    const after = await inspectRepository(symlink, { gitPath: GIT, useEngine: false });
    expect(after.state).toBe("ready");
  });

  it("trusts a worktree without trusting its main repository", async () => {
    isolate(true);
    await trustConfirmed(worktree);
    const wt = await inspectRepository(worktree, { gitPath: GIT, useEngine: false });
    expect(wt.state).toBe("ready");
    const main = await inspectRepository(repo, { gitPath: GIT, useEngine: false });
    expect(main.state).toBe("untrusted");
  });

  it("writes nothing when the confirmed entry is not the one the repository needs", async () => {
    isolate(true);
    await expect(trustGitRepository(repo, GIT, fs.realpathSync(worktree))).rejects.toThrow(
      /changed after it was confirmed/
    );
    expect(fs.readFileSync(globalConfig, "utf8")).toBe("");
  });

  it("refuses to trust a repository that no longer needs it", async () => {
    await expect(trustGitRepository(repo, GIT, fs.realpathSync(repo))).rejects.toThrow(
      /no longer needs/
    );
  });
});

describe("isGitTrustError", () => {
  it("matches Git's ownership rejections and nothing else", () => {
    expect(isGitTrustError("fatal: detected dubious ownership in repository at '/x'")).toBe(true);
    expect(isGitTrustError("Repository path '/x' is unsafe repository")).toBe(true);
    expect(isGitTrustError("repository at '/x' is not owned by current user")).toBe(true);
    expect(isGitTrustError("fatal: not a git repository")).toBe(false);
  });
});
