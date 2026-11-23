import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";

import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { createReflogSource } from "@/extension/reflogTab/reflogData";

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

function source(record?: GitCommandRecorder, gitPath: () => string = () => "git") {
  return createReflogSource({
    createGit: (root) =>
      simpleGit({ baseDir: root, binary: "git", maxConcurrentProcesses: 6, trimmed: false }),
    gitPath,
    record
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
