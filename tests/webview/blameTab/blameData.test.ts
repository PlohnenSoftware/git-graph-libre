import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";

import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { createBlameSource } from "@/extension/blameTab/blameData";

const dirs: string[] = [];

function repo(): string {
  const dir = makeRepo();
  dirs.push(dir);
  return dir;
}

function commitFile(dir: string, name: string, content: string, message: string, date: string) {
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), content);
  git(["add", "."], dir);
  git(["commit", `--date=${date}`, "-m", message], dir);
}

function source(record?: GitCommandRecorder, gitPath: () => string = () => "git") {
  return createBlameSource({
    createGit: (root) =>
      simpleGit({ baseDir: root, binary: "git", maxConcurrentProcesses: 6, trimmed: false }),
    gitPath,
    record
  });
}

afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe("createBlameSource (real Git)", () => {
  it("blames a two-commit file into scored hunks, oldest coldest", async () => {
    const dir = repo();
    commitFile(dir, "src/file.ts", "one\ntwo\n", "first lines", "2020-01-01T00:00:00Z");
    commitFile(dir, "src/file.ts", "one\ntwo\nthree\n", "third line", "2024-01-01T00:00:00Z");
    const labels: string[] = [];
    let gitPathCalls = 0;
    const result = await source(
      (entry) => labels.push(entry.label),
      () => {
        gitPathCalls++;
        return "git";
      }
    ).load(dir, "src/file.ts", null);
    expect(result.error).toBeNull();
    expect(result.state).toBe("lines");
    expect(result.totalLines).toBe(3);
    expect(result.hunks.map((h) => h.lines.map((l) => l.content))).toEqual([
      ["one", "two"],
      ["three"]
    ]);
    // Age mode: the 2020 hunk is coldest, the 2024 hunk hottest.
    expect(result.hunks.map((h) => h.heat.level)).toEqual([0, 9]);
    expect(result.hunks.every((h) => !h.heat.uncommitted)).toBe(true);
    const first = result.commits[result.hunks[0].commitHash];
    expect(first.summary).toBe("first lines");
    expect(first.authorTime).toBeGreaterThan(0);
    // The resolved binary was read live and the blame run recorded.
    expect(gitPathCalls).toBeGreaterThan(0);
    expect(labels).toContain("blame.read");
  });

  it("marks working-tree lines uncommitted without skewing committed heat", async () => {
    const dir = repo();
    commitFile(dir, "a.txt", "kept\n", "kept line", "2021-01-01T00:00:00Z");
    fs.writeFileSync(path.join(dir, "a.txt"), "kept\nfresh\n");
    const result = await source().load(dir, "a.txt", null);
    expect(result.error).toBeNull();
    expect(result.state).toBe("lines");
    const fresh = result.hunks.find((h) => h.lines.some((l) => l.content === "fresh"));
    expect(fresh?.heat.uncommitted).toBe(true);
    expect(fresh?.heat.level).toBeNull();
    const kept = result.hunks.find((h) => h.lines.some((l) => l.content === "kept"));
    expect(kept?.heat.uncommitted).toBe(false);
    // The only committed timestamp scores the neutral middle level.
    expect(kept?.heat.level).toBe(5);
  });

  it("blames at a revision and reports the resolved commit", async () => {
    const dir = repo();
    commitFile(dir, "a.txt", "one\n", "first", "2020-01-01T00:00:00Z");
    commitFile(dir, "a.txt", "one\ntwo\n", "second", "2024-01-01T00:00:00Z");
    const result = await source().load(dir, "a.txt", "HEAD~1");
    expect(result.error).toBeNull();
    expect(result.totalLines).toBe(1);
    expect(result.resolvedRev).toMatch(/^[0-9a-f]{40}$/);
  });

  it("keeps empty, binary and untracked files distinct from an error", async () => {
    const dir = repo();
    commitFile(dir, "empty.txt", "", "empty file", "2022-01-01T00:00:00Z");
    fs.writeFileSync(path.join(dir, "blob.bin"), Buffer.from([0x00, 0x01, 0x02]));
    git(["add", "."], dir);
    git(["commit", "-m", "binary file"], dir);
    fs.writeFileSync(path.join(dir, "new.txt"), "not tracked\n");

    const empty = await source().load(dir, "empty.txt", null);
    expect(empty.state).toBe("empty");
    expect(empty.error).toBeNull();
    const binary = await source().load(dir, "blob.bin", null);
    expect(binary.state).toBe("binary");
    expect(binary.error).toBeNull();
    const untracked = await source().load(dir, "new.txt", null);
    expect(untracked.state).toBe("untracked");
    expect(untracked.error).toBeNull();
  });

  it("turns a bad revision into an error payload, never an empty blame", async () => {
    const dir = repo();
    commitFile(dir, "a.txt", "one\n", "first", "2020-01-01T00:00:00Z");
    const result = await source().load(dir, "a.txt", "no-such-revision");
    expect(result.state).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.hunks).toEqual([]);
  });
});
