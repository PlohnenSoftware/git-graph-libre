import { describe, expect, it } from "vitest";

import {
  applyLineCounts,
  type EngineCommitDetails,
  type EngineCommitFile,
  type EngineFileChange,
  findStashEntry,
  lineCountPaths,
  mapEngineFileChange,
  parseEngineCommitDetails,
  parseEngineCommitFile,
  parseEngineLineCounts,
  parseEngineStashEntries,
  stashEntryPayload
} from "@/backend/engine/details";
import type { GitFileChange } from "@/backend/types";

const CHANGE: EngineFileChange = {
  oldFilePath: "a.txt",
  newFilePath: "b.txt",
  type: "R",
  additions: null,
  deletions: null
};

const PAGE: EngineCommitDetails = {
  hash: "a".repeat(40),
  parents: ["b".repeat(40)],
  author: "Ada",
  authorEmail: "ada@x.com",
  authorDate: 1790090408,
  committer: "Ada",
  committerEmail: "ada@x.com",
  committerDate: 1790090408,
  body: "subject\n\nbody\n\n",
  fileChanges: [CHANGE]
};

describe("parseEngineCommitDetails", () => {
  it("decodes a payload and trims the body like the CLI", () => {
    expect(parseEngineCommitDetails(JSON.stringify(PAGE))).toEqual({
      ...PAGE,
      body: "subject\n\nbody"
    });
  });

  it.each(["not json", "[1]", "null"])("rejects %s", (text) => {
    expect(parseEngineCommitDetails(text)).toBeNull();
  });

  it("rejects mistyped fields and unknown file kinds", () => {
    expect(parseEngineCommitDetails(JSON.stringify({ ...PAGE, authorDate: "x" }))).toBeNull();
    expect(
      parseEngineCommitDetails(JSON.stringify({ ...PAGE, fileChanges: [{ ...CHANGE, type: "C" }] }))
    ).toBeNull();
    expect(
      parseEngineCommitDetails(
        JSON.stringify({ ...PAGE, fileChanges: [{ ...CHANGE, additions: "1" }] })
      )
    ).toBeNull();
    const { body: _dropped, ...withoutBody } = PAGE;
    expect(parseEngineCommitDetails(JSON.stringify(withoutBody))).toBeNull();
  });
});

describe("mapEngineFileChange", () => {
  it("passes kinds through and reports untracked as added", () => {
    expect(mapEngineFileChange(CHANGE)).toEqual({
      oldFilePath: "a.txt",
      newFilePath: "b.txt",
      type: "R",
      additions: null,
      deletions: null
    });
    expect(mapEngineFileChange({ ...CHANGE, type: "U" }).type).toBe("A");
  });
});

describe("line counts", () => {
  const changes = (): GitFileChange[] => [
    { oldFilePath: "a.txt", newFilePath: "b.txt", type: "R", additions: null, deletions: null },
    { oldFilePath: "c.txt", newFilePath: "c.txt", type: "M", additions: null, deletions: null }
  ];

  it("collects both sides of every change, deduplicated", () => {
    expect(lineCountPaths(changes())).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("joins by new path with the old path as rename fallback", () => {
    const nodes = changes();
    applyLineCounts(nodes, {
      "b.txt": { additions: 3, deletions: 1 },
      "a.txt": { additions: 9, deletions: 9 },
      "missing.txt": { additions: 0, deletions: 0 }
    });
    expect(nodes[0]).toMatchObject({ additions: 3, deletions: 1 });
    const renamed = changes();
    applyLineCounts(renamed, { "a.txt": { additions: 3, deletions: 1 } });
    expect(renamed[0]).toMatchObject({ additions: 3, deletions: 1 });
    expect(nodes[1]).toMatchObject({ additions: null, deletions: null });
  });

  it("parses the counts map strictly", () => {
    expect(
      parseEngineLineCounts(JSON.stringify({ "b.txt": { additions: 3, deletions: 1 } }))
    ).toEqual({ "b.txt": { additions: 3, deletions: 1 } });
    expect(parseEngineLineCounts("{}")).toEqual({});
    expect(parseEngineLineCounts("[]")).toBeNull();
    expect(
      parseEngineLineCounts(JSON.stringify({ "b.txt": { additions: "3", deletions: 1 } }))
    ).toBeNull();
  });
});

describe("stash entries", () => {
  const wire = JSON.stringify([
    {
      hash: "c".repeat(40),
      baseHash: "b".repeat(40),
      untrackedFilesHash: null,
      selector: "refs/stash@{0}",
      author: "Ada",
      email: "ada@x.com",
      date: 1,
      message: "wip"
    }
  ]);

  it("finds entries by stash hash and builds the details payload", () => {
    const entries = parseEngineStashEntries(wire);
    expect(entries).toHaveLength(1);
    const entry = findStashEntry(entries ?? [], "c".repeat(40));
    expect(entry?.selector).toBe("refs/stash@{0}");
    expect(findStashEntry(entries ?? [], "f".repeat(40))).toBeUndefined();
    expect(entry && JSON.parse(stashEntryPayload(entry))).toEqual({
      selector: "refs/stash@{0}",
      baseHash: "b".repeat(40),
      untrackedFilesHash: null
    });
  });

  it("rejects malformed lists", () => {
    expect(parseEngineStashEntries("not json")).toBeNull();
    expect(parseEngineStashEntries("{}")).toBeNull();
    expect(parseEngineStashEntries(JSON.stringify([{ hash: "c" }]))).toBeNull();
  });
});

describe("parseEngineCommitFile", () => {
  const text: EngineCommitFile = { contents: "line one\n", binary: false };

  it("decodes a text payload", () => {
    expect(parseEngineCommitFile(JSON.stringify(text))).toEqual(text);
  });

  it("keeps the binary marker as a valid answer", () => {
    expect(parseEngineCommitFile(JSON.stringify({ contents: null, binary: true }))).toEqual({
      contents: null,
      binary: true
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseEngineCommitFile("not json")).toBeNull();
    expect(parseEngineCommitFile("{}")).toBeNull();
    expect(parseEngineCommitFile(JSON.stringify({ contents: 42, binary: false }))).toBeNull();
    expect(parseEngineCommitFile(JSON.stringify({ contents: null, binary: "yes" }))).toBeNull();
  });
});
