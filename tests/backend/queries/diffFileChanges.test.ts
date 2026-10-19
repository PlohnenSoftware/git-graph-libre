import { describe, expect, it } from "vitest";

import { parseDiffFileChanges, splitNulTerminatedFields } from "@/backend/queries/diffFileChanges";

/** Fields as `git diff -z` emits them: one status, then its path(s), NUL-terminated. */
function fields(...values: string[]): string[] {
  return splitNulTerminatedFields(`${values.join("\0")}\0`);
}

describe("parseDiffFileChanges", () => {
  it("parses a type change as one non-rename entry with its counts", () => {
    const unusual = "dir with spaces/flip\tfile ü.txt";
    const changes = parseDiffFileChanges(
      fields("T", unusual, "M", "plain.txt", "R100", "old name.txt", "new name.txt"),
      fields(`1\t3\t${unusual}`, "2\t0\tplain.txt", "0\t0\t", "old name.txt", "new name.txt")
    );
    expect(changes).toEqual([
      { oldFilePath: unusual, newFilePath: unusual, type: "T", additions: 1, deletions: 3 },
      { oldFilePath: "plain.txt", newFilePath: "plain.txt", type: "M", additions: 2, deletions: 0 },
      {
        oldFilePath: "old name.txt",
        newFilePath: "new name.txt",
        type: "R",
        additions: 0,
        deletions: 0
      }
    ]);
  });

  it("keeps T followed by M in order and reports binary counts as null", () => {
    const changes = parseDiffFileChanges(
      fields("T", "blob.bin", "M", "blob.bin", "D", "gone.txt"),
      fields("-\t-\tblob.bin", "-\t-\tblob.bin", "0\t4\tgone.txt")
    );
    // The lookup is keyed by path, so the repeated path settles on its last row; order and
    // types are preserved, and neither T nor the following M consumes an extra path field.
    expect(changes.map((change) => change.type)).toEqual(["T", "M", "D"]);
    expect(changes[2]).toEqual({
      oldFilePath: "gone.txt",
      newFilePath: "gone.txt",
      type: "D",
      additions: 0,
      deletions: 4
    });
    expect(changes[0]?.additions).toBeNull();
    expect(changes[1]?.deletions).toBeNull();
  });

  it("stops at an unknown status instead of misreading the paths behind it", () => {
    const changes = parseDiffFileChanges(fields("T", "flip.txt", "C", "copied.txt"), fields());
    expect(changes).toEqual([
      {
        oldFilePath: "flip.txt",
        newFilePath: "flip.txt",
        type: "T",
        additions: null,
        deletions: null
      }
    ]);
  });
});
