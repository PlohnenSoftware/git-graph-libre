import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import simpleGit from "simple-git";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addWorktree,
  MAX_WORKTREE_CHANGES,
  prunableWorktrees,
  pruneWorktrees,
  removeWorktree,
  repairWorktree,
  worktreeChanges
} from "@/backend/actions/worktree";
import { loadWorktrees } from "@/backend/queries/worktrees";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

import { git, makeRepo } from "../helpers";

// `@/l10n` needs the `vscode` module, so the backend project gets the English
// bundle in its place.
vi.mock("@/l10n", async () => {
  const bundlePath = path.resolve(__dirname, "../../../l10n/bundle.l10n.json");
  const bundle: Record<string, string> = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  return {
    t: (key: string, ...args: string[]) =>
      (bundle[key] ?? key).replace(/\{(\d+)\}/g, (_, index) => args[Number(index)] ?? "")
  };
});

const temporaryDirs: string[] = [];

// No real global or system Git configuration reaches these fixtures.
const configHome = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-gitconfig-"));
fs.writeFileSync(path.join(configHome, "gitconfig"), "");
process.env.GIT_CONFIG_GLOBAL = path.join(configHome, "gitconfig");
process.env.GIT_CONFIG_NOSYSTEM = "1";

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirs.push(dir);
  return dir;
}

/**
 * A repository with `feat` and `other` checked out in linked worktrees whose
 * paths hold a space and a non-ASCII letter. Everything lives under the
 * test's own temporary directories.
 */
function makeFixture() {
  const repo = makeRepo();
  temporaryDirs.push(repo);
  git(["branch", "feat"], repo);
  git(["branch", "other"], repo);
  const parent = tempDir("ngg-wt-");
  const featPath = path.join(parent, "wt feat é");
  const otherPath = path.join(parent, "wt other");
  git(["worktree", "add", featPath, "feat"], repo);
  git(["worktree", "add", otherPath, "other"], repo);
  return { repo, parent, featPath, otherPath, client: simpleGit(repo) };
}

async function list(client: ReturnType<typeof simpleGit>, repo: string) {
  return (await loadWorktrees(client, repo)).value;
}

function branches(repo: string): string[] {
  return cp
    .execFileSync("git", ["branch", "--format=%(refname:short)"], { cwd: repo, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

describe("removeWorktree", () => {
  it("removes a clean worktree with plain remove, then deletes its branch", async () => {
    const { repo, featPath, client } = makeFixture();
    const records: GitCommandRecord[] = [];

    const removed = await removeWorktree(
      client,
      {
        repo,
        path: featPath,
        force: false,
        unlock: false,
        deleteBranch: { branchName: "feat", forceDelete: false }
      },
      (record) => records.push(record)
    );

    expect(removed).toBe(featPath);
    expect(fs.existsSync(featPath)).toBe(false);
    expect((await list(client, repo)).map((worktree) => worktree.branch)).not.toContain("feat");
    expect(branches(repo)).not.toContain("feat");
    const remove = records.find((record) => record.label === "worktree.remove");
    expect(remove?.args).not.toContain("--force");
  });

  it("refuses a worktree with local changes, and removes it with the confirmed force", async () => {
    const { repo, featPath, client } = makeFixture();
    fs.writeFileSync(path.join(featPath, "untracked é.txt"), "work");
    fs.writeFileSync(path.join(featPath, "f"), "edited");

    const changes = await worktreeChanges(client, { repo, path: featPath });
    expect(changes.error).toBeNull();
    expect(changes.files.toSorted()).toEqual(["f", "untracked é.txt"]);
    expect(changes.truncated).toBe(false);

    await expect(
      removeWorktree(client, { repo, path: featPath, force: false, unlock: false })
    ).rejects.toThrow();
    expect(fs.existsSync(path.join(featPath, "untracked é.txt"))).toBe(true);

    await removeWorktree(client, { repo, path: featPath, force: true, unlock: false });
    expect(fs.existsSync(featPath)).toBe(false);
  });

  it("bounds the files it names", async () => {
    const { repo, featPath, client } = makeFixture();
    for (let index = 0; index < MAX_WORKTREE_CHANGES + 5; index++) {
      fs.writeFileSync(path.join(featPath, `new-${index}.txt`), "x");
    }

    const changes = await worktreeChanges(client, { repo, path: featPath });

    expect(changes.files).toHaveLength(MAX_WORKTREE_CHANGES);
    expect(changes.truncated).toBe(true);
  });

  it("reads nothing from a path Git does not list", async () => {
    const { repo, parent, client } = makeFixture();
    const outside = path.join(parent, "not a worktree");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "secret"), "x");

    const changes = await worktreeChanges(client, { repo, path: outside });

    expect(changes.files).toEqual([]);
  });

  it("never removes a locked worktree unless asked to unlock it, and never forces twice", async () => {
    const { repo, featPath, client } = makeFixture();
    git(["worktree", "lock", "--reason", "on a usb stick", featPath], repo);
    const records: GitCommandRecord[] = [];

    await expect(
      removeWorktree(client, { repo, path: featPath, force: true, unlock: false }, (r) =>
        records.push(r)
      )
    ).rejects.toThrow("on a usb stick");
    expect(fs.existsSync(featPath)).toBe(true);
    expect(records.some((record) => record.label === "worktree.remove")).toBe(false);

    await removeWorktree(client, { repo, path: featPath, force: false, unlock: true }, (r) =>
      records.push(r)
    );
    expect(fs.existsSync(featPath)).toBe(false);
    const labels = records.map((record) => record.label);
    expect(labels.indexOf("worktree.unlock")).toBeLessThan(labels.indexOf("worktree.remove"));
    const removeArgs = records.find((record) => record.label === "worktree.remove")?.args ?? [];
    expect(removeArgs.filter((arg) => arg === "--force" || arg === "-f")).toHaveLength(0);
  });

  it("removes a stale entry whose folder is gone, without force", async () => {
    const { repo, featPath, client } = makeFixture();
    fs.rmSync(featPath, { recursive: true });
    expect((await list(client, repo)).find((w) => w.branch === "feat")?.prunable).not.toBeNull();

    await removeWorktree(client, { repo, path: featPath, force: false, unlock: false });

    expect((await list(client, repo)).map((worktree) => worktree.branch)).not.toContain("feat");
  });

  it("refuses the main worktree and the worktree the graph shows", async () => {
    const { repo, featPath, client } = makeFixture();

    await expect(
      removeWorktree(client, { repo, path: repo, force: false, unlock: false })
    ).rejects.toThrow("main worktree");
    await expect(
      removeWorktree(simpleGit(featPath), {
        repo: featPath,
        path: featPath,
        force: false,
        unlock: false
      })
    ).rejects.toThrow("this graph shows");
    await expect(
      removeWorktree(client, { repo, path: path.join(repo, "nope"), force: false, unlock: false })
    ).rejects.toThrow("not a worktree");
    expect(fs.existsSync(featPath)).toBe(true);
  });
});

describe("repairWorktree", () => {
  it("repairs a worktree that was moved by hand", async () => {
    const { repo, parent, featPath, client } = makeFixture();
    const moved = path.join(parent, "moved é");
    fs.renameSync(featPath, moved);
    expect((await list(client, repo)).find((w) => w.branch === "feat")?.prunable).not.toBeNull();

    await repairWorktree(client, { repo, path: featPath, newPath: moved });

    const feat = (await list(client, repo)).find((worktree) => worktree.branch === "feat");
    expect(feat?.prunable).toBeNull();
    expect(fs.realpathSync(feat?.path ?? "")).toBe(fs.realpathSync(moved));
  });

  it("fails, instead of claiming success, when the folder is not that worktree", async () => {
    const { repo, parent, featPath, otherPath, client } = makeFixture();
    fs.renameSync(featPath, path.join(parent, "moved"));

    // A live worktree needs no repair, so Git succeeds and the entry stays stale.
    await expect(
      repairWorktree(client, { repo, path: featPath, newPath: otherPath })
    ).rejects.toThrow("nothing was repaired");
    await expect(repairWorktree(client, { repo, path: featPath, newPath: null })).rejects.toThrow(
      "Choose the folder"
    );
  });
});

describe("pruneWorktrees", () => {
  it("previews exactly what prune removes, and leaves locked and live entries", async () => {
    const { repo, parent, featPath, otherPath, client } = makeFixture();
    const lockedPath = path.join(parent, "wt locked");
    git(["branch", "locked"], repo);
    git(["worktree", "add", lockedPath, "locked"], repo);
    git(["worktree", "lock", lockedPath], repo);
    fs.rmSync(featPath, { recursive: true });
    fs.rmSync(lockedPath, { recursive: true });

    const preview = prunableWorktrees(await list(client, repo)).map((worktree) => worktree.path);
    expect(preview).toEqual([featPath]);
    const dryRun = cp.spawnSync("git", ["worktree", "prune", "-n", "-v"], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, LC_ALL: "C" }
    });
    expect(dryRun.stderr.match(/^Removing/gm)).toHaveLength(preview.length);

    const pruned = await pruneWorktrees(client, { repo });

    expect(pruned).toEqual([featPath]);
    const after = await list(client, repo);
    expect(after.map((worktree) => worktree.branch)).toEqual(
      expect.arrayContaining(["main", "other", "locked"])
    );
    expect(after.map((worktree) => worktree.branch)).not.toContain("feat");
    expect(fs.existsSync(otherPath)).toBe(true);
  });

  it("does nothing when no entry is stale", async () => {
    const { repo, client } = makeFixture();
    const records: GitCommandRecord[] = [];

    await expect(pruneWorktrees(client, { repo }, (r) => records.push(r))).resolves.toEqual([]);

    expect(records.some((record) => record.label === "worktree.prune")).toBe(false);
  });
});

/** A plain repository with free branches and a tag, and no linked worktree yet. */
function makeCreateFixture() {
  const repo = makeRepo();
  temporaryDirs.push(repo);
  git(["branch", "feat"], repo);
  git(["branch", "other"], repo);
  git(["tag", "v1"], repo);
  const parent = tempDir("ngg-wt-add-");
  return { repo, parent, client: simpleGit(repo) };
}

function gitOut(args: string[], cwd: string): string {
  return cp.execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

describe("addWorktree", () => {
  it("checks out a free branch at a path with a space and a non-ASCII letter", async () => {
    const { repo, parent, client } = makeCreateFixture();
    const target = path.join(parent, "wt féat é");
    const records: GitCommandRecord[] = [];

    const created = await addWorktree(
      client,
      {
        repo,
        path: target,
        branch: "feat",
        newBranch: null,
        startPoint: null,
        detach: false,
        lockReason: null
      },
      (record) => records.push(record)
    );

    const add = records.find((record) => record.label === "worktree.add");
    expect(add?.args).toEqual(["worktree", "add", "--", target, "feat"]);
    const listed = (await list(client, repo)).find((worktree) => worktree.branch === "feat");
    expect(created).toBe(listed?.path);
    expect(fs.existsSync(path.join(target, "f"))).toBe(true);
    expect(listed?.locked).toBeNull();
  });

  it("creates a tracking local branch from a remote branch", async () => {
    const source = makeRepo();
    temporaryDirs.push(source);
    git(["branch", "feat"], source);
    const parent = tempDir("ngg-wt-clone-");
    const repo = path.join(parent, "clone");
    git(["clone", source, repo], parent);
    const client = simpleGit(repo);
    const target = path.join(parent, "wt remote é");
    const records: GitCommandRecord[] = [];

    await addWorktree(
      client,
      {
        repo,
        path: target,
        branch: null,
        newBranch: "feat",
        startPoint: "origin/feat",
        detach: false,
        lockReason: null
      },
      (record) => records.push(record)
    );

    const add = records.find((record) => record.label === "worktree.add");
    expect(add?.args).toEqual(["worktree", "add", "-b", "feat", "--", target, "origin/feat"]);
    expect(gitOut(["for-each-ref", "--format=%(upstream:short)", "refs/heads/feat"], repo)).toBe(
      "origin/feat"
    );
    expect((await list(client, repo)).find((worktree) => worktree.branch === "feat")).toBeDefined();
  });

  it("detaches at a commit, and starts a new branch at a tag", async () => {
    const { repo, parent, client } = makeCreateFixture();
    const head = gitOut(["rev-parse", "HEAD"], repo);
    const detachedPath = path.join(parent, "wt detached");
    const tagPath = path.join(parent, "wt tag é");
    const records: GitCommandRecord[] = [];
    const collect = (record: GitCommandRecord) => records.push(record);

    await addWorktree(
      client,
      {
        repo,
        path: detachedPath,
        branch: null,
        newBranch: null,
        startPoint: head,
        detach: true,
        lockReason: null
      },
      collect
    );
    await addWorktree(
      client,
      {
        repo,
        path: tagPath,
        branch: null,
        newBranch: "from-tag",
        startPoint: "v1",
        detach: false,
        lockReason: null
      },
      collect
    );

    const adds = records
      .filter((record) => record.label === "worktree.add")
      .map((record) => record.args);
    expect(adds).toEqual([
      ["worktree", "add", "--detach", "--", detachedPath, head],
      ["worktree", "add", "-b", "from-tag", "--", tagPath, "v1"]
    ]);
    const worktrees = await list(client, repo);
    const detached = worktrees.find((worktree) => worktree.detached);
    expect(detached?.head).toBe(head);
    expect(worktrees.find((worktree) => worktree.branch === "from-tag")?.head).toBe(head);
  });

  it("creates a locked worktree with and without a reason, in an existing empty folder", async () => {
    const { repo, parent, client } = makeCreateFixture();
    const reasonPath = path.join(parent, "wt locked é");
    const barePath = path.join(parent, "wt locked bare");
    fs.mkdirSync(barePath);
    const records: GitCommandRecord[] = [];
    const collect = (record: GitCommandRecord) => records.push(record);

    await addWorktree(
      client,
      {
        repo,
        path: reasonPath,
        branch: "feat",
        newBranch: null,
        startPoint: null,
        detach: false,
        lockReason: "keep é"
      },
      collect
    );
    await addWorktree(
      client,
      {
        repo,
        path: barePath,
        branch: "other",
        newBranch: null,
        startPoint: null,
        detach: false,
        lockReason: ""
      },
      collect
    );

    const adds = records
      .filter((record) => record.label === "worktree.add")
      .map((record) => record.args);
    expect(adds).toEqual([
      ["worktree", "add", "--lock", "--reason", "keep é", "--", reasonPath, "feat"],
      ["worktree", "add", "--lock", "--", barePath, "other"]
    ]);
    const worktrees = await list(client, repo);
    expect(worktrees.find((worktree) => worktree.branch === "feat")?.locked).toEqual({
      reason: "keep é"
    });
    // Git records its own default reason for `--lock` without `--reason`.
    expect(worktrees.find((worktree) => worktree.branch === "other")?.locked).toEqual({
      reason: expect.any(String)
    });
  });

  it("refuses a branch checked out elsewhere before Git runs, naming that worktree", async () => {
    const { repo, parent, featPath, client } = makeFixture();
    const target = path.join(parent, "wt again");
    const records: GitCommandRecord[] = [];

    await expect(
      addWorktree(
        client,
        {
          repo,
          path: target,
          branch: "feat",
          newBranch: null,
          startPoint: null,
          detach: false,
          lockReason: null
        },
        (record) => records.push(record)
      )
    ).rejects.toThrow(`already checked out in the worktree ${featPath}`);

    expect(records.some((record) => record.label === "worktree.add")).toBe(false);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("refuses an empty path, a listed path and a non-empty folder before Git runs", async () => {
    const { repo, parent, client } = makeCreateFixture();
    const occupied = path.join(parent, "occupied");
    fs.mkdirSync(occupied);
    fs.writeFileSync(path.join(occupied, "mine.txt"), "work");
    const records: GitCommandRecord[] = [];
    const collect = (record: GitCommandRecord) => records.push(record);
    const base = {
      repo,
      branch: "feat",
      newBranch: null,
      startPoint: null,
      detach: false,
      lockReason: null
    };

    await expect(addWorktree(client, { ...base, path: "  " }, collect)).rejects.toThrow(
      "Choose a folder"
    );
    await expect(addWorktree(client, { ...base, path: repo }, collect)).rejects.toThrow(
      "already a worktree"
    );
    await expect(addWorktree(client, { ...base, path: occupied }, collect)).rejects.toThrow(
      "is not empty"
    );

    expect(records.some((record) => record.label === "worktree.add")).toBe(false);
    expect(fs.existsSync(path.join(occupied, "mine.txt"))).toBe(true);
  });
});
