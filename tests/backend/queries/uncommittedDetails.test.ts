import type { SimpleGit } from "simple-git";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseStatusEntries, uncommittedDetails } from "@/backend/queries/uncommittedDetails";

function gitWithRaw(stdout: string): SimpleGit {
  return { raw: vi.fn(async () => stdout) } as unknown as SimpleGit;
}

describe("parseStatusEntries", () => {
  it("returns empty lists for clean output", () => {
    expect(parseStatusEntries("")).toEqual({ staged: [], unstaged: [] });
  });

  it("splits staged and unstaged changes observed in real status output", () => {
    const stdout =
      " M mod.txt\0R  moved.txt\0renamed.txt\0A  staged-new.txt\0?? untracked.txt\0?? sub/\0";
    const { staged, unstaged } = parseStatusEntries(stdout);

    expect(staged.map((file) => file.path)).toEqual(["moved.txt", "staged-new.txt"]);
    expect(unstaged.map((file) => file.path)).toEqual(["mod.txt", "sub/", "untracked.txt"]);
    const moved = staged.find((file) => file.path === "moved.txt");
    expect(moved?.oldPath).toBe("renamed.txt");
    expect(moved?.stagedKind).toBe("R");
    const mod = unstaged.find((file) => file.path === "mod.txt");
    expect(mod?.unstagedKind).toBe("M");
    expect(mod?.stagedKind).toBeNull();
  });

  it("lists a both-staged-and-unstaged file in both lists", () => {
    const { staged, unstaged } = parseStatusEntries("MM both.txt\0");

    expect(staged).toHaveLength(1);
    expect(unstaged).toHaveLength(1);
    expect(staged[0]).toMatchObject({ path: "both.txt", stagedKind: "M", unstagedKind: null });
    expect(unstaged[0]).toMatchObject({ path: "both.txt", stagedKind: null, unstagedKind: "M" });
  });

  it("lists unmerged entries as unstaged only", () => {
    const { staged, unstaged } = parseStatusEntries("UU conflict.txt\0AA added.txt\0");

    expect(staged).toEqual([]);
    expect(unstaged.map((file) => file.path)).toEqual(["added.txt", "conflict.txt"]);
  });

  it("ignores ignored files and skips malformed fields", () => {
    const { staged, unstaged } = parseStatusEntries("!! ignored.log\0xx\0 M ok.txt\0");

    expect(staged).toEqual([]);
    expect(unstaged.map((file) => file.path)).toEqual(["ok.txt"]);
  });

  it("sorts each list by path", () => {
    const { staged, unstaged } = parseStatusEntries(" M z.txt\0 M a.txt\0A  m.txt\0A  b.txt\0");

    expect(staged.map((file) => file.path)).toEqual(["b.txt", "m.txt"]);
    expect(unstaged.map((file) => file.path)).toEqual(["a.txt", "z.txt"]);
  });
});

describe("uncommittedDetails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("queries porcelain status and parses the result", async () => {
    const git = gitWithRaw(" M work.txt\0A  added.txt\0");

    const result = await uncommittedDetails(git, { repo: "/repo" });

    expect(git.raw).toHaveBeenCalledWith([
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=normal"
    ]);
    expect(result.error).toBeNull();
    expect(result.changes?.staged.map((file) => file.path)).toEqual(["added.txt"]);
    expect(result.changes?.unstaged.map((file) => file.path)).toEqual(["work.txt"]);
  });

  it("returns a typed error when git fails", async () => {
    const git = {
      raw: vi.fn(async () => Promise.reject(new Error("fatal: not a git repository")))
    };

    const result = await uncommittedDetails(git as unknown as SimpleGit, { repo: "/repo" });

    expect(result.changes).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain("fatal: not a git repository");
  });
});
