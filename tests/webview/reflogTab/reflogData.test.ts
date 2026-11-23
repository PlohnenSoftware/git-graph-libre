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
    await expect(src.loadRefs?.(dir)).resolves.toEqual([
      "HEAD",
      "refs/heads/main",
      "refs/heads/topic"
    ]);
    const branch = await src.loadPage(dir, 0, 200, query({ ref: "refs/heads/topic" }));
    expect(branch.error).toBeNull();
    expect(branch.ref).toBe("refs/heads/topic");
    expect(branch.rows[0]?.message).toContain("topic-only");

    fs.writeFileSync(path.join(dir, "f"), "changed");
    git(["stash", "push", "-m", "picked stash"], dir);
    await expect(src.loadRefs?.(dir)).resolves.toContain("refs/stash");
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
