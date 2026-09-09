import type { SimpleGit } from "simple-git";
import { describe, expect, it } from "vitest";
import { loadStashes } from "@/backend/queries/stashes";

const NUL = "\0";

function stashRecord(ref: string, hash: string, message: string, date: string, parents: string) {
  return [ref, hash, message, date, parents].join(NUL);
}

function stubGit(stdout: string): SimpleGit {
  return { raw: async () => stdout } as unknown as SimpleGit;
}

function failingGit(): SimpleGit {
  return {
    raw: async () => {
      throw new Error("git exited with 128: not a repository");
    }
  } as unknown as SimpleGit;
}

const validRecord = stashRecord(
  "stash@{0}",
  "feed1234feed1234feed1234feed1234feed1234",
  "WIP on main: checkpoint",
  "1700500000",
  "abc123abc123abc123abc123abc123abc123 def456def456def456def456def456def456"
);

describe("loadStashes", () => {
  it("parses NUL-separated records with the base commit resolved", async () => {
    const result = await loadStashes(stubGit(`${validRecord}${NUL}`), { repo: "/repo" }, "test");

    expect(result.error).toBeNull();
    expect(result.value).toEqual([
      {
        index: 0,
        ref: "stash@{0}",
        hash: "feed1234feed1234feed1234feed1234feed1234",
        message: "WIP on main: checkpoint",
        date: 1700500000,
        sourceHash: "abc123abc123abc123abc123abc123abc123"
      }
    ]);
  });

  it("answers an empty stash list without an error", async () => {
    const result = await loadStashes(stubGit(""), { repo: "/repo" }, "test");

    expect(result.error).toBeNull();
    expect(result.value).toEqual([]);
  });

  it("parses records without a trailing separator", async () => {
    const result = await loadStashes(stubGit(validRecord), { repo: "/repo" }, "test");

    expect(result.error).toBeNull();
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.ref).toBe("stash@{0}");
  });

  it("skips records whose selector is not a stash index", async () => {
    const bogus = stashRecord("bogus", "hash", "message", "1700500000", "abc123");
    const result = await loadStashes(
      stubGit(`${bogus}${NUL}${validRecord}${NUL}`),
      { repo: "/repo" },
      "test"
    );

    expect(result.error).toBeNull();
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.ref).toBe("stash@{0}");
  });

  it("reads an unparseable date as a missing date", async () => {
    const record = stashRecord("stash@{0}", "feed1234", "WIP", "yesterday", "abc123");
    const result = await loadStashes(stubGit(`${record}${NUL}`), { repo: "/repo" }, "test");

    expect(result.error).toBeNull();
    expect(result.value[0]?.date).toBeNull();
  });

  it("reads an empty parent list as a missing base commit", async () => {
    const record = stashRecord("stash@{0}", "feed1234", "WIP", "1700500000", "");
    const result = await loadStashes(stubGit(`${record}${NUL}`), { repo: "/repo" }, "test");

    expect(result.error).toBeNull();
    expect(result.value[0]?.sourceHash).toBeNull();
  });

  it("resolves a git failure to an empty list with a typed error", async () => {
    const result = await loadStashes(failingGit(), { repo: "/repo" }, "test");

    expect(result.value).toEqual([]);
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain("not a repository");
  });
});
