import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { commitFixup, loadFixupDialogInfo } from "@/backend/actions/commit";
import { runInteractiveRebase } from "@/backend/actions/rebaseInteractive";
import { loadRebaseRange } from "@/backend/queries/rebaseRange";
import { arrangeAutosquash } from "@/backend/rebase/autosquash";

/**
 * Real-Git tests for fixup/squash/reword/amend commit creation (F2-06),
 * `loadFixupDialogInfo`, and `rebase.autoSquash` config reading.
 *
 * Every repository is a throwaway temporary directory with an isolated global
 * config (`commit.gpgsign=false` inside the temp repo only).
 */

const tempDirs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const isolatedEnv: Record<string, string> = {};

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function git(args: string[], cwd: string, env: Record<string, string> = {}): string {
  return cp.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...isolatedEnv, ...env }
  });
}

function makeRepo(prefix = "ggl-fixup-"): { dir: string; hashes: string[] } {
  const dir = tempDir(prefix);
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.name", "Fixture"], dir);
  git(["config", "user.email", "fixture@example.test"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
  git(["config", "tag.gpgsign", "false"], dir);
  const hashes: string[] = [];
  for (const [name, msg] of [
    ["base", "Initial base"],
    ["alpha", "Alpha feature\n\nAlpha body"],
    ["beta", "Beta feature"]
  ]) {
    fs.writeFileSync(path.join(dir, `${name}.txt`), `${name}\n`);
    git(["add", `${name}.txt`], dir);
    git(["commit", "-q", "-m", msg], dir);
    hashes.push(git(["rev-parse", "HEAD"], dir).trim());
  }
  return { dir, hashes };
}

function headMessage(dir: string): string {
  return git(["log", "-1", "--format=%B", "HEAD"], dir).trim();
}

function gitDirOf(dir: string): string {
  const out = git(["rev-parse", "--git-dir"], dir).trim();
  return path.isAbsolute(out) ? out : path.join(dir, out);
}

beforeAll(() => {
  const emptyConfig = path.join(tempDir("ggl-fixup-env-"), "gitconfig");
  fs.writeFileSync(emptyConfig, "");
  const overrides: Record<string, string> = {
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    LC_ALL: "C",
    GIT_TERMINAL_PROMPT: "0"
  };
  for (const [key, value] of Object.entries(overrides)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
    isolatedEnv[key] = value;
  }
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("commitFixup", () => {
  it("creates a fixup! commit with staged changes and optional extra note", async () => {
    const { dir, hashes } = makeRepo();
    const alpha = hashes[1];

    fs.writeFileSync(path.join(dir, "alpha.txt"), "alpha fixed\n");
    git(["add", "alpha.txt"], dir);
    await commitFixup(simpleGit(dir), { repo: dir, binary: "git", target: alpha, kind: "fixup" });
    expect(headMessage(dir)).toBe("fixup! Alpha feature");

    fs.writeFileSync(path.join(dir, "alpha.txt"), "alpha fixed 2\n");
    git(["add", "alpha.txt"], dir);
    await commitFixup(simpleGit(dir), {
      repo: dir,
      binary: "git",
      target: alpha,
      kind: "fixup",
      message: "extra context"
    });
    expect(headMessage(dir)).toBe("fixup! Alpha feature\n\nextra context");
  });

  it("refuses fixup and squash when nothing is staged", async () => {
    const { dir, hashes } = makeRepo();
    const alpha = hashes[1];

    await expect(
      commitFixup(simpleGit(dir), { repo: dir, binary: "git", target: alpha, kind: "fixup" })
    ).rejects.toThrow();
    await expect(
      commitFixup(simpleGit(dir), { repo: dir, binary: "git", target: alpha, kind: "squash" })
    ).rejects.toThrow();
  });

  it("creates a squash! commit with and without an additional message", async () => {
    const { dir, hashes } = makeRepo();
    const alpha = hashes[1];

    fs.writeFileSync(path.join(dir, "alpha.txt"), "alpha sq1\n");
    git(["add", "alpha.txt"], dir);
    await commitFixup(simpleGit(dir), {
      repo: dir,
      binary: "git",
      target: alpha,
      kind: "squash",
      message: "Added edge-case handling"
    });
    expect(headMessage(dir)).toBe("squash! Alpha feature\n\nAdded edge-case handling");

    fs.writeFileSync(path.join(dir, "alpha.txt"), "alpha sq2\n");
    git(["add", "alpha.txt"], dir);
    await commitFixup(simpleGit(dir), {
      repo: dir,
      binary: "git",
      target: alpha,
      kind: "squash"
    });
    expect(headMessage(dir)).toBe("squash! Alpha feature");
  });

  it("creates an empty amend! commit for reword even with no staged changes, and leaves staged changes untouched", async () => {
    const { dir, hashes } = makeRepo();
    const alpha = hashes[1];

    // No staged changes: creates empty amend! commit with the new message.
    await commitFixup(simpleGit(dir), {
      repo: dir,
      binary: "git",
      target: alpha,
      kind: "reword",
      message: "Alpha feature (renamed)\n\nUpdated body"
    });
    expect(headMessage(dir)).toBe(
      "amend! Alpha feature\n\nAlpha feature (renamed)\n\nUpdated body"
    );
    expect(git(["show", "--stat", "--format=", "HEAD"], dir).trim()).toBe("");

    // Staged changes present: --fixup=reword: creates an empty commit and preserves staged files.
    fs.writeFileSync(path.join(dir, "staged.txt"), "keep staged\n");
    git(["add", "staged.txt"], dir);
    await commitFixup(simpleGit(dir), {
      repo: dir,
      binary: "git",
      target: alpha,
      kind: "reword",
      message: "Second reword"
    });
    expect(headMessage(dir)).toBe("amend! Alpha feature\n\nSecond reword");
    expect(git(["diff", "--cached", "--name-only"], dir).trim()).toBe("staged.txt");
    // Temp message files cleaned up.
    const leftover = fs
      .readdirSync(gitDirOf(dir))
      .filter((name) => name.startsWith("ggl-fixup-msg-"));
    expect(leftover).toEqual([]);
  });

  it("creates an amend! commit with staged changes (and never passes -m with amend:)", async () => {
    const { dir, hashes } = makeRepo();
    const alpha = hashes[1];

    fs.writeFileSync(path.join(dir, "alpha.txt"), "amended content\n");
    git(["add", "alpha.txt"], dir);
    await commitFixup(simpleGit(dir), {
      repo: dir,
      binary: "git",
      target: alpha,
      kind: "amend",
      message: "Alpha amended title\n\nAmended body"
    });
    expect(headMessage(dir)).toBe("amend! Alpha feature\n\nAlpha amended title\n\nAmended body");
    expect(git(["show", "--name-only", "--format=", "HEAD"], dir).trim()).toBe("alpha.txt");
  });

  it("rejects empty reword messages, non-hash targets and invalid kinds before invoking Git", async () => {
    const { dir, hashes } = makeRepo();
    const alpha = hashes[1];

    await expect(
      commitFixup(simpleGit(dir), {
        repo: dir,
        binary: "git",
        target: alpha,
        kind: "reword",
        message: "   \n "
      })
    ).rejects.toThrow("Commit message is required.");
    await expect(
      commitFixup(simpleGit(dir), {
        repo: dir,
        binary: "git",
        target: "--amend",
        kind: "fixup"
      })
    ).rejects.toThrow("is not a full commit hash");
    await expect(
      commitFixup(simpleGit(dir), {
        repo: dir,
        binary: "git",
        target: alpha,
        kind: "invalid" as never
      })
    ).rejects.toThrow("Fixup commit kind");
  });

  it("works in a linked worktree and autosquashes a non-HEAD fixup through F2-01b", async () => {
    const { dir, hashes } = makeRepo("ggl-fixup-wt-main-");
    const [base, alpha] = hashes;
    const wtDir = path.join(tempDir("ggl-fixup-wt-linked-"), "linked");
    git(["worktree", "add", "-q", "-b", "topic", wtDir], dir);

    // Fixup + reword targeting non-HEAD commit alpha inside the linked worktree.
    fs.writeFileSync(path.join(wtDir, "alpha.txt"), "alpha patched\n");
    git(["add", "alpha.txt"], wtDir);
    await commitFixup(simpleGit(wtDir), {
      repo: wtDir,
      binary: "git",
      target: alpha,
      kind: "fixup"
    });
    await commitFixup(simpleGit(wtDir), {
      repo: wtDir,
      binary: "git",
      target: alpha,
      kind: "reword",
      message: "Alpha final title"
    });

    const range = await loadRebaseRange(simpleGit(wtDir), { repo: wtDir, base });
    expect(range.error).toBeNull();
    const arranged = arrangeAutosquash(range.commits);
    const result = await runInteractiveRebase(simpleGit(wtDir), {
      repo: wtDir,
      binary: "git",
      base,
      entries: arranged,
      rangeHashes: range.commits.map((c) => c.hash)
    });
    expect(result.outcome).toBe("completed");
    expect(
      git(["log", "--reverse", "--format=%s", `${base}..HEAD`], wtDir)
        .trim()
        .split("\n")
    ).toEqual(["Alpha final title", "Beta feature"]);
    expect(fs.readFileSync(path.join(wtDir, "alpha.txt"), "utf8")).toBe("alpha patched\n");
  });
});

describe("loadFixupDialogInfo and rebase.autoSquash config", () => {
  it("reports staged file count and full target commit message", async () => {
    const { dir, hashes } = makeRepo("ggl-fixup-info-");
    const alpha = hashes[1];

    const clean = await loadFixupDialogInfo(simpleGit(dir), { repo: dir, target: alpha });
    expect(clean).toEqual({
      stagedCount: 0,
      targetSubject: "Alpha feature",
      targetMessage: "Alpha feature\n\nAlpha body",
      error: null
    });

    fs.writeFileSync(path.join(dir, "alpha.txt"), "changed\n");
    fs.writeFileSync(path.join(dir, "new.txt"), "new\n");
    fs.writeFileSync(path.join(dir, "untracked.txt"), "ignored\n");
    git(["add", "alpha.txt", "new.txt"], dir);

    const staged = await loadFixupDialogInfo(simpleGit(dir), { repo: dir, target: alpha });
    expect(staged.stagedCount).toBe(2);
    expect(staged.targetSubject).toBe("Alpha feature");
    expect(staged.error).toBeNull();
  });

  it("reads rebase.autoSquash from Git config in loadRebaseRange", async () => {
    const { dir, hashes } = makeRepo("ggl-fixup-cfg-");
    const base = hashes[0];

    const unsetRange = await loadRebaseRange(simpleGit(dir), { repo: dir, base });
    expect(unsetRange.autoSquash).toBeNull();

    git(["config", "rebase.autoSquash", "true"], dir);
    const trueRange = await loadRebaseRange(simpleGit(dir), { repo: dir, base });
    expect(trueRange.autoSquash).toBe(true);

    git(["config", "rebase.autoSquash", "false"], dir);
    const falseRange = await loadRebaseRange(simpleGit(dir), { repo: dir, base });
    expect(falseRange.autoSquash).toBe(false);
  });
});
