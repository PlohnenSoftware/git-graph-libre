import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";

import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { createReflogSource } from "@/extension/reflogTab/reflogData";
import { defaultReflogQuery, type ReflogQuery } from "@/reflogTabTypes";

const dirs: string[] = [];

function repo(): string {
  const dir = makeRepo();
  dirs.push(dir);
  return dir;
}

function commit(dir: string, name: string) {
  fs.writeFileSync(path.join(dir, name), name);
  git(["add", "."], dir);
  git(["commit", "-m", name], dir);
}

/** A commit whose message differs from its file's name (search text with specials). */
function commitMessage(dir: string, file: string, message: string) {
  fs.writeFileSync(path.join(dir, file), file);
  git(["add", "."], dir);
  git(["commit", "-m", message], dir);
}

function query(overrides: Partial<ReflogQuery> = {}): ReflogQuery {
  return { ...defaultReflogQuery(), ...overrides };
}

function source(
  record?: GitCommandRecorder,
  gitPath: () => string = () => "git",
  searchCap?: number
) {
  return createReflogSource({
    createGit: (root) =>
      simpleGit({ baseDir: root, binary: "git", maxConcurrentProcesses: 6, trimmed: false }),
    gitPath,
    record,
    searchCap
  });
}

afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe("createReflogSource (real Git)", () => {
  it("reads one classified HEAD page newest first, with states resolved", async () => {
    const dir = repo();
    commit(dir, "second");
    const labels: string[] = [];
    let gitPathCalls = 0;
    const page = await source(
      (entry) => labels.push(entry.label),
      () => {
        gitPathCalls++;
        return "git";
      }
    ).loadPage(dir, 0, 200);
    expect(page.error).toBeNull();
    expect(page.state).toBe("entries");
    expect(page.ref).toBe("HEAD");
    expect(page.rows.length).toBeGreaterThanOrEqual(2);
    expect(page.rows[0].message).toContain("second");
    expect(page.rows[0].kind).toBe("commit");
    // The resolved binary reached the F1-02 state read, so states resolved
    // instead of staying unknown.
    expect(gitPathCalls).toBeGreaterThan(0);
    expect(labels).toContain("reflog.states.existence");
    expect(page.rows[0].state).toBe("reachable");
  });

  it("marks a commit a hard reset left behind as only in the reflog", async () => {
    const dir = repo();
    commit(dir, "kept");
    commit(dir, "abandoned");
    git(["reset", "--hard", "HEAD~1"], dir);
    const page = await source().loadPage(dir, 0, 200);
    const abandoned = page.rows.find((entry) => entry.message.includes("abandoned"));
    expect(abandoned?.state).toBe("reflogOnly");
    const kept = page.rows.find((entry) => entry.message.includes("kept"));
    expect(kept?.state).toBe("reachable");
    const reset = page.rows.find((entry) => entry.kind === "reset");
    expect(reset).toBeDefined();
  });

  it("pages by offset without repeating entries", async () => {
    const dir = repo();
    commit(dir, "two");
    commit(dir, "three");
    const first = await source().loadPage(dir, 0, 2);
    const second = await source().loadPage(dir, 2, 2);
    expect(first.rows).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const firstKeys = new Set(first.rows.map((entry) => `${entry.index}:${entry.hash}`));
    for (const entry of second.rows) {
      expect(firstKeys.has(`${entry.index}:${entry.hash}`)).toBe(false);
    }
  });

  it("reports no reflog apart from an error when Git keeps none", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-nolog-"));
    dirs.push(dir);
    git(["init", "-b", "main"], dir);
    git(["config", "user.email", "t@t.com"], dir);
    git(["config", "user.name", "T"], dir);
    git(["config", "commit.gpgsign", "false"], dir);
    git(["config", "core.logAllRefUpdates", "false"], dir);
    commit(dir, "only");
    const page = await source().loadPage(dir, 0, 200);
    expect(page.error).toBeNull();
    expect(page.rows).toEqual([]);
    expect(["none", "empty"]).toContain(page.state);
  });

  it("reports an unreadable repository as an error, never as empty", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-notrepo-"));
    dirs.push(dir);
    const page = await source().loadPage(dir, 0, 200);
    expect(page.error).not.toBeNull();
    expect(page.state).toBeNull();
    expect(page.rows).toEqual([]);
  });

  it("leaves states unknown when no Git binary can be resolved", async () => {
    const dir = repo();
    const page = await source(undefined, () => "").loadPage(dir, 0, 200);
    expect(page.error).toBeNull();
    expect(page.rows.length).toBeGreaterThan(0);
    expect(page.rows.every((entry) => entry.state === null)).toBe(true);
  });
});

describe("createReflogSource search, filters and ref picker (F1-05, real Git)", () => {
  it("lists the picker refs and reads a picked branch and the stash", async () => {
    const dir = repo();
    git(["checkout", "-b", "topic"], dir);
    commit(dir, "topic-only");
    git(["checkout", "main"], dir);
    const src = source();
    await expect(src.loadRefs?.(dir)).resolves.toMatchObject({
      bare: false,
      options: [{ ref: "HEAD" }, { ref: "refs/heads/main" }, { ref: "refs/heads/topic" }]
    });
    const branch = await src.loadPage(dir, 0, 200, query({ ref: "refs/heads/topic" }));
    expect(branch.error).toBeNull();
    expect(branch.ref).toBe("refs/heads/topic");
    expect(branch.rows[0]?.message).toContain("topic-only");

    fs.writeFileSync(path.join(dir, "f"), "changed");
    git(["stash", "push", "-m", "picked stash"], dir);
    const withStash = await src.loadRefs?.(dir);
    expect(withStash?.options.map((option) => option.ref)).toContain("refs/stash");
    const stash = await src.loadPage(dir, 0, 200, query({ ref: "refs/stash" }));
    expect(stash.rows).toHaveLength(1);
    expect(stash.rows[0]?.kind).toBe("stash");
    expect(stash.rows[0]?.message).toContain("picked stash");
  });

  it("searches beyond the loaded page and pages over the matches", async () => {
    const dir = repo();
    commitMessage(dir, "m1", "match one");
    commitMessage(dir, "m2", "match two");
    commitMessage(dir, "m3", "match three");
    commitMessage(dir, "m4", "plain four");
    commitMessage(dir, "m5", "plain five");
    const src = source();
    // "match one" lies well past an unfiltered first page of two rows.
    const first = await src.loadPage(dir, 0, 2, query({ search: "MATCH" }));
    expect(first.rows.map((entry) => entry.message)).toEqual([
      "commit: match three",
      "commit: match two"
    ]);
    expect(first.hasMore).toBe(true);
    expect(first.searchCapped).toBe(false);
    const second = await src.loadPage(dir, 2, 2, query({ search: "MATCH" }));
    expect(second.rows.map((entry) => entry.message)).toEqual(["commit: match one"]);
    expect(second.hasMore).toBe(false);
  });

  it("searches special characters and dash-led text literally", async () => {
    const dir = repo();
    commitMessage(dir, "s1", "Needle [regex].* (Case)");
    commitMessage(dir, "s2", "--max-count=1 in a message");
    const src = source();
    const literal = await src.loadPage(dir, 0, 200, query({ search: "[regex].*" }));
    expect(literal.rows.map((entry) => entry.message)).toEqual(["commit: Needle [regex].* (Case)"]);
    const dash = await src.loadPage(dir, 0, 200, query({ search: "--max-count=1" }));
    expect(dash.rows.map((entry) => entry.message)).toEqual(["commit: --max-count=1 in a message"]);
  });

  it("filters by action kind over the whole searched reflog", async () => {
    const dir = repo();
    git(["checkout", "-b", "side"], dir);
    commit(dir, "side-one");
    git(["checkout", "main"], dir);
    const page = await source().loadPage(dir, 0, 200, query({ actions: ["checkout"] }));
    expect(page.error).toBeNull();
    expect(page.rows.length).toBeGreaterThanOrEqual(2);
    expect(page.rows.every((entry) => entry.kind === "checkout")).toBe(true);
  });

  it("keeps only reflog-only rows when the toggle is on", async () => {
    const dir = repo();
    commit(dir, "kept");
    commit(dir, "abandoned");
    git(["reset", "--hard", "HEAD~1"], dir);
    const page = await source().loadPage(dir, 0, 200, query({ onlyInReflog: true }));
    expect(page.error).toBeNull();
    expect(page.rows.length).toBeGreaterThan(0);
    expect(page.rows.every((entry) => entry.state === "reflogOnly")).toBe(true);
    expect(page.rows.some((entry) => entry.message.includes("abandoned"))).toBe(true);
    expect(page.rows.some((entry) => entry.message.includes("kept"))).toBe(false);
  });

  it("searches the stash reflog by text", async () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, "f"), "one");
    git(["stash", "push", "-m", "first stash"], dir);
    fs.writeFileSync(path.join(dir, "f"), "two");
    git(["stash", "push", "-m", "Needle stash"], dir);
    const page = await source().loadPage(
      dir,
      0,
      200,
      query({ ref: "refs/stash", search: "needle" })
    );
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.message).toContain("Needle stash");
  });

  it("stops a filtered read at the cap and says so", async () => {
    const dir = repo();
    git(["checkout", "-b", "capped"], dir);
    for (const name of ["c1", "c2", "c3", "c4"]) commit(dir, name);
    // The checkout is older than the newest three entries, so a scan
    // capped at three plain entries cannot reach it.
    const actionPage = await source(undefined, undefined, 3).loadPage(
      dir,
      0,
      200,
      query({ actions: ["checkout"] })
    );
    expect(actionPage.rows).toEqual([]);
    expect(actionPage.searchCapped).toBe(true);
    // For a text search the cap bounds the matches Git hands back.
    const searchPage = await source(undefined, undefined, 3).loadPage(
      dir,
      0,
      200,
      query({ search: "commit" })
    );
    expect(searchPage.rows).toHaveLength(3);
    expect(searchPage.searchCapped).toBe(true);
  });

  it("refuses a ref that looks like an option, as an error page", async () => {
    const dir = repo();
    for (const ref of ["-n1", "--output=/tmp/x"]) {
      const page = await source().loadPage(dir, 0, 200, query({ ref }));
      expect(page.error).not.toBeNull();
      expect(page.state).toBeNull();
      expect(page.rows).toEqual([]);
    }
  });
});

describe("createReflogSource with worktrees and bare repositories (F1-08, real Git)", () => {
  /** A linked worktree of `dir` under a fresh parent, cleaned up with the rest. */
  function addWorktree(dir: string, name: string, branch: string): string {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-reflog-wt-"));
    dirs.push(parent);
    const linked = path.join(parent, name);
    git(["worktree", "add", "-q", "-b", branch, linked], dir);
    return linked;
  }

  it("offers the other worktree's HEAD and reads its own HEAD reflog there", async () => {
    const dir = repo();
    const linked = addWorktree(dir, "linked", "linked-branch");
    commit(dir, "main-only");
    commit(linked, "linked-only");
    const src = source();

    const refs = await src.loadRefs?.(dir);
    expect(refs?.bare).toBe(false);
    const option = refs?.options.find((candidate) => candidate.worktreePath !== null);
    expect(option).toMatchObject({
      ref: "HEAD",
      worktreeName: "linked",
      locked: null,
      prunable: null
    });
    const worktreePath = option?.worktreePath as string;

    const mainPage = await src.loadPage(dir, 0, 200);
    expect(mainPage.rows.map((entry) => entry.message)).toContain("commit: main-only");
    expect(mainPage.rows.map((entry) => entry.message)).not.toContain("commit: linked-only");

    const linkedPage = await src.loadPage(dir, 0, 200, query({ worktreePath }));
    expect(linkedPage.error).toBeNull();
    expect(linkedPage.ref).toBe("HEAD");
    expect(linkedPage.rows.map((entry) => entry.message)).toContain("commit: linked-only");
    expect(linkedPage.rows.map((entry) => entry.message)).not.toContain("commit: main-only");

    // From the linked worktree, the main worktree's HEAD is the "other" one.
    const fromLinked = await src.loadRefs?.(linked);
    const mainOption = fromLinked?.options.find((candidate) => candidate.worktreePath !== null);
    expect(mainOption?.worktreeName).toBe(path.basename(dir));
    const mainFromLinked = await src.loadPage(
      linked,
      0,
      200,
      query({ worktreePath: mainOption?.worktreePath as string })
    );
    expect(mainFromLinked.rows.map((entry) => entry.message)).toContain("commit: main-only");
  });

  it("marks a locked worktree in the picker and still reads it", async () => {
    const dir = repo();
    const linked = addWorktree(dir, "locked-one", "locked-branch");
    commit(linked, "locked-commit");
    git(["worktree", "lock", "--reason", "on a stick", linked], dir);
    const src = source();
    const refs = await src.loadRefs?.(dir);
    const option = refs?.options.find((candidate) => candidate.worktreePath !== null);
    expect(option?.locked).toEqual({ reason: "on a stick" });
    const page = await src.loadPage(
      dir,
      0,
      200,
      query({ worktreePath: option?.worktreePath as string })
    );
    expect(page.error).toBeNull();
    expect(page.rows.map((entry) => entry.message)).toContain("commit: locked-commit");
  });

  it("marks a stale worktree prunable and answers its read with an error, never an empty page", async () => {
    const dir = repo();
    const gone = addWorktree(dir, "gone-one", "gone-branch");
    fs.renameSync(gone, `${gone}-moved`);
    const src = source();
    const refs = await src.loadRefs?.(dir);
    const option = refs?.options.find((candidate) => candidate.worktreePath !== null);
    expect(option?.prunable).not.toBeNull();
    const page = await src.loadPage(
      dir,
      0,
      200,
      query({ worktreePath: option?.worktreePath as string })
    );
    expect(page.error).toContain("is missing");
    expect(page.state).toBeNull();
    expect(page.rows).toEqual([]);
  });

  it("refuses a worktree path Git does not list, without reading there", async () => {
    const dir = repo();
    const stranger = repo();
    const page = await source().loadPage(dir, 0, 200, query({ worktreePath: stranger }));
    expect(page.error).toContain("is not a worktree of this repository");
    expect(page.rows).toEqual([]);
  });

  it("releases only the other worktrees it read, once", async () => {
    const dir = repo();
    addWorktree(dir, "released-one", "released-branch");
    const closed: string[] = [];
    const src = createReflogSource({
      createGit: (root) =>
        simpleGit({ baseDir: root, binary: "git", maxConcurrentProcesses: 6, trimmed: false }),
      gitPath: () => "git",
      closeRepo: (closedRepo) => closed.push(closedRepo)
    });
    await src.loadPage(dir, 0, 200);
    const refs = await src.loadRefs?.(dir);
    const worktreePath = refs?.options.find((candidate) => candidate.worktreePath !== null)
      ?.worktreePath as string;
    await src.loadPage(dir, 0, 200, query({ worktreePath }));
    src.releaseWorktrees?.();
    expect(closed).toEqual([worktreePath]);
    src.releaseWorktrees?.();
    expect(closed).toEqual([worktreePath]);
  });

  it("calls a bare repository bare, keeps no HEAD reflog there, and reads its branches", async () => {
    const seed = repo();
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-reflog-bare-"));
    dirs.push(bare);
    git(["clone", "-q", "--bare", seed, bare], seed);
    const src = source();

    const refs = await src.loadRefs?.(bare);
    expect(refs?.bare).toBe(true);
    expect(refs?.options.map((option) => option.ref)).toEqual(["HEAD", "refs/heads/main"]);
    const head = await src.loadPage(bare, 0, 200);
    expect(head.error).toBeNull();
    expect(head.state).toBe("none");
    expect(head.rows).toEqual([]);

    // A bare repository that does keep branch reflogs shows them as usual.
    git(["config", "core.logAllRefUpdates", "always"], bare);
    git(["branch", "topic", "refs/heads/main"], bare);
    const branch = await src.loadPage(bare, 0, 200, query({ ref: "refs/heads/topic" }));
    expect(branch.error).toBeNull();
    expect(branch.rows.map((entry) => entry.message)).toEqual([
      "branch: Created from refs/heads/main"
    ]);
    const stillNone = await src.loadPage(bare, 0, 200);
    expect(stillNone.state).toBe("none");
  });
});

describe("createReflogSource lost-commit scan and recovery (F1-07, real Git)", () => {
  it("scans dropped stashes and abandoned commits and recovers one with Create Branch without moving HEAD", async () => {
    const dir = repo();
    const headBefore = (await simpleGit({ baseDir: dir, binary: "git" }).revparse(["HEAD"])).trim();
    commit(dir, "abandoned-commit");
    const abandoned = (await simpleGit({ baseDir: dir, binary: "git" }).revparse(["HEAD"])).trim();
    git(["reset", "--hard", "HEAD~1"], dir);

    fs.writeFileSync(path.join(dir, "f"), "stashed-body");
    git(["stash", "push", "-m", "dropped-stash-entry"], dir);
    const droppedStash = (
      await simpleGit({ baseDir: dir, binary: "git" }).revparse(["refs/stash"])
    ).trim();
    git(["stash", "drop"], dir);
    git(["reflog", "expire", "--expire=now", "--all"], dir);

    const src = source();
    const found = await src.scanLostCommits?.(dir);
    expect(found?.error).toBeNull();
    expect(found?.canceled).toBe(false);
    expect(found?.timedOut).toBe(false);
    const hashes = found?.commits.map((entry) => entry.hash) ?? [];
    expect(hashes).toContain(abandoned);
    expect(hashes).toContain(droppedStash);

    // Recover the abandoned commit via Create Branch without moving HEAD.
    const createError = await src.createBranch?.(dir, abandoned, "recovered/abandoned");
    expect(createError).toBeNull();
    const g = simpleGit({ baseDir: dir, binary: "git" });
    expect((await g.revparse(["HEAD"])).trim()).toBe(headBefore);
    expect((await g.revparse(["refs/heads/recovered/abandoned"])).trim()).toBe(abandoned);

    // Once reachable from the new branch, the commit no longer appears as lost.
    const after = await src.scanLostCommits?.(dir);
    expect(after?.commits.map((entry) => entry.hash)).not.toContain(abandoned);
    expect(after?.commits.map((entry) => entry.hash)).toContain(droppedStash);
  });

  it("rejects invalid commit hashes and dash-led branch names before invoking Git", async () => {
    const dir = repo();
    const src = source();
    expect(await src.createBranch?.(dir, "--all", "safe-name")).toContain("Invalid commit hash");
    expect(await src.createBranch?.(dir, "a".repeat(40), "-D")).toContain("Invalid branch name");
    expect(await src.createBranch?.(dir, "a".repeat(40), "has space")).toContain(
      "Invalid branch name"
    );
  });
});

describe("createReflogSource safe recovery actions (F1-06, real Git)", () => {
  function gitOut(args: string[], cwd: string): string {
    return cp.execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  }

  function symbolicHead(dir: string): string {
    try {
      return gitOut(["symbolic-ref", "-q", "HEAD"], dir);
    } catch {
      return "";
    }
  }

  /** Snapshot every ref (`HEAD` and `refs/*`) in `dir` as `name -> hash`. */
  function snapshotRefs(dir: string): Record<string, string> {
    const out = gitOut(["for-each-ref", "--format=%(refname) %(objectname)"], dir);
    const refs: Record<string, string> = {
      HEAD: gitOut(["rev-parse", "HEAD"], dir),
      "HEAD:sym": symbolicHead(dir)
    };
    if (out !== "") {
      for (const line of out.split("\n")) {
        const [name, hash] = line.trim().split(" ");
        if (name && hash) refs[name] = hash;
      }
    }
    return refs;
  }

  /** Build a repo with a commit made unreachable by `git reset --hard HEAD~1`. */
  function repoWithUnreachableCommit() {
    const dir = repo();
    commit(dir, "kept");
    commit(dir, "lost-work");
    const lostHash = gitOut(["rev-parse", "HEAD"], dir);
    git(["reset", "--hard", "HEAD~1"], dir);
    const keptHash = gitOut(["rev-parse", "HEAD"], dir);
    return { dir, keptHash, lostHash };
  }

  it("recovers an unreachable commit via Create Branch Here without moving HEAD or other refs", async () => {
    const { dir, keptHash, lostHash } = repoWithUnreachableCommit();
    const src = source();
    const beforePage = await src.loadPage(dir, 0, 200);
    const lostRow = beforePage.rows.find((entry) => entry.hash === lostHash);
    expect(lostRow?.state).toBe("reflogOnly");

    const beforeRefs = snapshotRefs(dir);
    const res = await src.runAction?.(dir, {
      kind: "createBranch",
      commitHash: lostHash,
      branchName: "recovered-branch",
      worktreePath: null
    });
    expect(res).toEqual({ error: null });

    const afterRefs = snapshotRefs(dir);
    expect(afterRefs).toEqual({
      ...beforeRefs,
      "refs/heads/recovered-branch": lostHash
    });
    expect(afterRefs.HEAD).toBe(keptHash);
    expect(afterRefs["HEAD:sym"]).toBe("refs/heads/main");

    // Now the commit is reachable from a branch, so its state flips to reachable.
    const afterPage = await src.loadPage(dir, 0, 200);
    expect(afterPage.rows.find((entry) => entry.hash === lostHash)?.state).toBe("reachable");
  });

  it("recovers an unreachable commit via Create Tag Here (lightweight and annotated) without moving other refs", async () => {
    const { dir, lostHash } = repoWithUnreachableCommit();
    const src = source();
    const beforeRefs = snapshotRefs(dir);

    const light = await src.runAction?.(dir, {
      kind: "addTag",
      commitHash: lostHash,
      tagName: "recovered-light",
      lightweight: true,
      worktreePath: null
    });
    expect(light).toEqual({ error: null });
    expect(gitOut(["rev-parse", "refs/tags/recovered-light^{commit}"], dir)).toBe(lostHash);

    const annotated = await src.runAction?.(dir, {
      kind: "addTag",
      commitHash: lostHash,
      tagName: "recovered-ann",
      lightweight: false,
      message: "saved from reflog",
      worktreePath: null
    });
    expect(annotated).toEqual({ error: null });
    expect(gitOut(["rev-parse", "refs/tags/recovered-ann^{commit}"], dir)).toBe(lostHash);

    const afterRefs = snapshotRefs(dir);
    expect(afterRefs.HEAD).toBe(beforeRefs.HEAD);
    expect(afterRefs["HEAD:sym"]).toBe(beforeRefs["HEAD:sym"]);
    expect(afterRefs["refs/heads/main"]).toBe(beforeRefs["refs/heads/main"]);
  });

  it("recovers an unreachable commit via Check Out (Detached) and preserves today's dirty-tree handling", async () => {
    const { dir, keptHash, lostHash } = repoWithUnreachableCommit();
    const src = source();

    // Non-conflicting dirty working tree change is carried across detached checkout.
    fs.writeFileSync(path.join(dir, "untracked-note.txt"), "carry me");
    const beforeRefs = snapshotRefs(dir);
    const ok = await src.runAction?.(dir, {
      kind: "checkoutCommit",
      commitHash: lostHash,
      worktreePath: null
    });
    expect(ok).toEqual({ error: null });
    const afterRefs = snapshotRefs(dir);
    expect(afterRefs.HEAD).toBe(lostHash);
    expect(afterRefs["HEAD:sym"]).toBe("");
    // No branch or tag ref moved.
    expect(afterRefs["refs/heads/main"]).toBe(keptHash);
    expect(afterRefs["refs/heads/main"]).toBe(beforeRefs["refs/heads/main"]);
    expect(fs.readFileSync(path.join(dir, "untracked-note.txt"), "utf8")).toBe("carry me");

    // Return to main and make a conflicting tracked dirty change to `lost-work`.
    git(["checkout", "main"], dir);
    fs.writeFileSync(path.join(dir, "lost-work"), "conflicting local edit");
    git(["add", "lost-work"], dir);
    const conflict = await src.runAction?.(dir, {
      kind: "checkoutCommit",
      commitHash: lostHash,
      worktreePath: null
    });
    expect(conflict?.error).not.toBeNull();
    // HEAD and main stay untouched, and the local file content is preserved.
    expect(gitOut(["rev-parse", "HEAD"], dir)).toBe(keptHash);
    expect(fs.readFileSync(path.join(dir, "lost-work"), "utf8")).toBe("conflicting local edit");
  });

  it("recovers an unreachable commit via Reset Current Branch (soft, mixed, hard) without moving other branches", async () => {
    const { dir, keptHash, lostHash } = repoWithUnreachableCommit();
    git(["branch", "untouched-branch", keptHash], dir);
    const src = source();

    // Mixed reset (the default): moves main to lostHash, keeps working tree changes unstaged.
    fs.writeFileSync(path.join(dir, "kept"), "modified in working tree");
    const mixed = await src.runAction?.(dir, {
      kind: "resetToCommit",
      commitHash: lostHash,
      resetMode: "mixed",
      worktreePath: null
    });
    expect(mixed).toEqual({ error: null });
    expect(gitOut(["rev-parse", "HEAD"], dir)).toBe(lostHash);
    expect(gitOut(["rev-parse", "refs/heads/main"], dir)).toBe(lostHash);
    expect(gitOut(["rev-parse", "refs/heads/untouched-branch"], dir)).toBe(keptHash);
    expect(fs.readFileSync(path.join(dir, "kept"), "utf8")).toBe("modified in working tree");

    // Soft reset back to keptHash: moves main, keeps changes staged/intact.
    const soft = await src.runAction?.(dir, {
      kind: "resetToCommit",
      commitHash: keptHash,
      resetMode: "soft",
      worktreePath: null
    });
    expect(soft).toEqual({ error: null });
    expect(gitOut(["rev-parse", "refs/heads/main"], dir)).toBe(keptHash);
    expect(gitOut(["rev-parse", "refs/heads/untouched-branch"], dir)).toBe(keptHash);

    // Hard reset to lostHash: moves main and restores the working tree to lostHash.
    const hard = await src.runAction?.(dir, {
      kind: "resetToCommit",
      commitHash: lostHash,
      resetMode: "hard",
      worktreePath: null
    });
    expect(hard).toEqual({ error: null });
    expect(gitOut(["rev-parse", "refs/heads/main"], dir)).toBe(lostHash);
    expect(gitOut(["rev-parse", "refs/heads/untouched-branch"], dir)).toBe(keptHash);
    expect(fs.readFileSync(path.join(dir, "kept"), "utf8")).toBe("kept");
  });

  it("refuses every recovery action on a missing commit object and moves no ref", async () => {
    const { dir } = repoWithUnreachableCommit();
    const missingHash = "deadbeef".repeat(5);
    const src = source();
    const beforeRefs = snapshotRefs(dir);

    for (const action of [
      {
        kind: "createBranch" as const,
        commitHash: missingHash,
        branchName: "nope",
        worktreePath: null
      },
      {
        kind: "addTag" as const,
        commitHash: missingHash,
        tagName: "nope",
        lightweight: true,
        worktreePath: null
      },
      { kind: "checkoutCommit" as const, commitHash: missingHash, worktreePath: null },
      {
        kind: "resetToCommit" as const,
        commitHash: missingHash,
        resetMode: "mixed" as const,
        worktreePath: null
      }
    ]) {
      const result = await src.runAction?.(dir, action);
      expect(result?.error, action.kind).toContain("no longer exists");
    }
    expect(snapshotRefs(dir)).toEqual(beforeRefs);
  });

  it("runs actions on another worktree's HEAD in that worktree, and refuses unlisted or stale worktrees (F1-08)", async () => {
    const dir = repo();
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-reflog-act-wt-"));
    dirs.push(parent);
    const linked = path.join(parent, "linked");
    git(["worktree", "add", "-q", "-b", "linked-branch", linked], dir);
    commit(dir, "main-stay");
    const mainHead = gitOut(["rev-parse", "HEAD"], dir);
    commit(linked, "linked-one");
    commit(linked, "linked-lost");
    const linkedLost = gitOut(["rev-parse", "HEAD"], linked);
    git(["reset", "--hard", "HEAD~1"], linked);

    const src = source();
    // Resetting in `linked` moves `linked-branch` in `linked` and never touches `dir`'s HEAD.
    const resetLinked = await src.runAction?.(dir, {
      kind: "resetToCommit",
      commitHash: linkedLost,
      resetMode: "mixed",
      worktreePath: linked
    });
    expect(resetLinked).toEqual({ error: null });
    expect(gitOut(["rev-parse", "HEAD"], linked)).toBe(linkedLost);
    expect(gitOut(["rev-parse", "HEAD"], dir)).toBe(mainHead);

    // Unlisted worktree path is refused without running in the current worktree.
    const stranger = repo();
    const refusedUnlisted = await src.runAction?.(dir, {
      kind: "checkoutCommit",
      commitHash: linkedLost,
      worktreePath: stranger
    });
    expect(refusedUnlisted?.error).toContain("is not a worktree of this repository");
    expect(gitOut(["rev-parse", "HEAD"], dir)).toBe(mainHead);

    // A missing (prunable) worktree is refused without running in the current worktree.
    fs.renameSync(linked, `${linked}-gone`);
    const refusedStale = await src.runAction?.(dir, {
      kind: "checkoutCommit",
      commitHash: linkedLost,
      worktreePath: linked
    });
    expect(refusedStale?.error).toContain("is missing");
    expect(gitOut(["rev-parse", "HEAD"], dir)).toBe(mainHead);
  });
});
