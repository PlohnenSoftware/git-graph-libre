import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";

import type { GitCommandRecorder } from "@/backend/utils/gitRunner";
import { createBlameSource } from "@/extension/blameTab/blameData";

const dirs: string[] = [];

function headOid(dir: string): string {
  return cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

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

  it("blames a linked worktree with divergent uncommitted edits without affecting the main worktree", async () => {
    const mainDir = repo();
    commitFile(mainDir, "src/app.ts", "line one\nline two\n", "initial", "2022-01-01T00:00:00Z");
    const linkedDir = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-blame-wt-"));
    fs.rmSync(linkedDir, { recursive: true, force: true });
    dirs.push(linkedDir);
    git(["worktree", "add", "-q", linkedDir], mainDir);

    fs.writeFileSync(path.join(linkedDir, "src/app.ts"), "line one\nworktree edit\n");

    const linkedResult = await source().load(linkedDir, "src/app.ts", null);
    expect(linkedResult.error).toBeNull();
    expect(linkedResult.state).toBe("lines");
    const edited = linkedResult.hunks.find((h) =>
      h.lines.some((l) => l.content === "worktree edit")
    );
    expect(edited?.heat.uncommitted).toBe(true);
    expect(linkedResult.commits[edited?.commitHash ?? ""]?.uncommitted).toBe(true);

    // The main worktree still sees only its committed lines.
    const mainResult = await source().load(mainDir, "src/app.ts", null);
    expect(mainResult.error).toBeNull();
    expect(mainResult.state).toBe("lines");
    expect(mainResult.hunks.every((h) => !h.heat.uncommitted)).toBe(true);
    expect(mainResult.hunks.flatMap((h) => h.lines.map((l) => l.content))).toEqual([
      "line one",
      "line two"
    ]);
  });

  it("blames a bare repository at an explicit commit and returns bareWorkingTree for working tree", async () => {
    const seed = repo();
    commitFile(seed, "file.txt", "alpha\nbeta\n", "seed", "2022-01-01T00:00:00Z");
    const head = headOid(seed);
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-blame-bare-"));
    fs.rmSync(bareDir, { recursive: true, force: true });
    dirs.push(bareDir);
    git(["clone", "-q", "--bare", seed, bareDir], os.tmpdir());

    const atCommit = await source().load(bareDir, "file.txt", head);
    expect(atCommit.error).toBeNull();
    expect(atCommit.state).toBe("lines");
    expect(atCommit.resolvedRev).toBe(head);
    expect(atCommit.totalLines).toBe(2);

    const workingTree = await source().load(bareDir, "file.txt", null);
    expect(workingTree.error).toBeNull();
    expect(workingTree.state).toBe("bareWorkingTree");
    expect(workingTree.hunks).toEqual([]);
  });

  it("blames unsaved dirty editor contents via --contents - with matching line numbers", async () => {
    const dir = repo();
    commitFile(dir, "doc.txt", "first\nsecond\nthird\n", "base", "2023-01-01T00:00:00Z");
    const head = headOid(dir);

    const result = await source().load(dir, "doc.txt", null, {
      contents: "first\nunsaved middle\nthird\nextra unsaved\n"
    });
    expect(result.error).toBeNull();
    expect(result.state).toBe("lines");
    expect(result.resolvedRev).toBe(head);
    expect(result.totalLines).toBe(4);
    const byLine = new Map(
      result.hunks.flatMap((h) =>
        h.lines.map((l) => [l.finalLine, { content: l.content, uncommitted: h.heat.uncommitted }])
      )
    );
    expect(byLine.get(1)).toEqual({ content: "first", uncommitted: false });
    expect(byLine.get(2)).toEqual({ content: "unsaved middle", uncommitted: true });
    expect(byLine.get(3)).toEqual({ content: "third", uncommitted: false });
    expect(byLine.get(4)).toEqual({ content: "extra unsaved", uncommitted: true });
  });

  it("returns unborn for a repository with no commits yet", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-blame-unborn-"));
    dirs.push(dir);
    git(["init"], dir);
    fs.writeFileSync(path.join(dir, "draft.txt"), "unborn line\n");
    const result = await source().load(dir, "draft.txt", null);
    expect(result.error).toBeNull();
    expect(result.state).toBe("unborn");
    expect(result.hunks).toEqual([]);
  });
});
