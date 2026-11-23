import { describe, expect, it } from "vitest";
import {
  findSquashGroups,
  isSquashGroupTarget,
  serializeTodo,
  type TodoEntry,
  validateTodo
} from "@/backend/rebase/todo";

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);
const WIDE = "d".repeat(64);
const BASE = "e".repeat(40);

/** Validates against the range `[A, B, C]` and base `BASE`, the common happy case. */
function check(entries: readonly TodoEntry[], range: readonly string[] = [A, B, C], base = BASE) {
  return validateTodo(entries, range, base);
}

function rejectionOf(entries: readonly TodoEntry[], range?: readonly string[], base?: string) {
  const result = check(entries, range, base);
  if (result.ok) throw new Error("expected a rejection");
  return result.rejection;
}

const pickAll: TodoEntry[] = [
  { action: "pick", hash: A },
  { action: "pick", hash: B },
  { action: "pick", hash: C }
];

describe("validateTodo", () => {
  describe("rule 1: base must not start with a dash", () => {
    it("rejects a base that starts with a dash", () => {
      expect(rejectionOf(pickAll, [A, B, C], "--exec=evil")).toEqual({
        reason: "base-is-option"
      });
    });

    it("accepts a base that merely contains a dash", () => {
      expect(check(pickAll, [A, B, C], "feature-x")).toEqual({ ok: true });
    });
  });

  describe("rule 2: the list must not be empty", () => {
    it("rejects an empty list", () => {
      expect(rejectionOf([], [])).toEqual({ reason: "empty" });
    });

    it("accepts a list with one entry", () => {
      expect(check([{ action: "drop", hash: A }], [A])).toEqual({ ok: true });
    });
  });

  describe("rule 3: every hash is a full 40 or 64 digit hex name", () => {
    it("accepts a full 40 digit hash", () => {
      expect(check([{ action: "pick", hash: A }], [A])).toEqual({ ok: true });
    });

    it("accepts a full 64 digit hash", () => {
      expect(check([{ action: "pick", hash: WIDE }], [WIDE])).toEqual({ ok: true });
    });

    it("rejects an abbreviated hash", () => {
      const entries: TodoEntry[] = [{ action: "pick", hash: "abc1234" }];
      expect(rejectionOf(entries, ["abc1234"])).toEqual({
        reason: "bad-hash",
        hash: "abc1234"
      });
    });

    it("rejects a 41 digit hash", () => {
      const hash = "a".repeat(41);
      expect(rejectionOf([{ action: "pick", hash }], [hash])).toEqual({
        reason: "bad-hash",
        hash
      });
    });

    it("rejects a non-hex character", () => {
      const hash = `${"a".repeat(39)}g`;
      expect(rejectionOf([{ action: "pick", hash }], [hash])).toEqual({
        reason: "bad-hash",
        hash
      });
    });

    it("rejects a hash with a line break, which would split the todo text", () => {
      const hash = `${A}\npick ${B}`;
      expect(rejectionOf([{ action: "pick", hash }], [A])).toEqual({
        reason: "bad-hash",
        hash
      });
    });

    it("accepts an uppercase full hash as valid hex", () => {
      const upper = "A".repeat(40);
      expect(check([{ action: "pick", hash: upper }], [upper])).toEqual({ ok: true });
    });

    it("matches an uppercase entry to the lowercase range hash", () => {
      const upper = A.toUpperCase();
      expect(check([{ action: "pick", hash: upper }], [A])).toEqual({ ok: true });
    });
  });

  describe("rule 4: no duplicate hashes", () => {
    it("rejects a repeated hash and names it", () => {
      const entries: TodoEntry[] = [
        { action: "pick", hash: A },
        { action: "pick", hash: B },
        { action: "drop", hash: A }
      ];
      expect(rejectionOf(entries, [A, B])).toEqual({ reason: "duplicate-hash", hash: A });
    });

    it("treats an uppercase and a lowercase copy of one hash as a duplicate", () => {
      const entries: TodoEntry[] = [
        { action: "pick", hash: A },
        { action: "pick", hash: A.toUpperCase() }
      ];
      expect(rejectionOf(entries, [A])).toEqual({
        reason: "duplicate-hash",
        hash: A.toUpperCase()
      });
    });

    it("accepts distinct hashes", () => {
      expect(check(pickAll)).toEqual({ ok: true });
    });
  });

  describe("rule 5: the first entry must not be squash or fixup", () => {
    it("rejects a squash as the first entry", () => {
      const entries: TodoEntry[] = [
        { action: "squash", hash: A },
        { action: "pick", hash: B }
      ];
      expect(rejectionOf(entries, [A, B])).toEqual({
        reason: "first-entry-squash",
        action: "squash"
      });
    });

    it("rejects a fixup as the first entry", () => {
      const entries: TodoEntry[] = [
        { action: "fixup", hash: A },
        { action: "pick", hash: B }
      ];
      expect(rejectionOf(entries, [A, B])).toEqual({
        reason: "first-entry-squash",
        action: "fixup"
      });
    });

    it("allows squash and fixup after the first entry", () => {
      const entries: TodoEntry[] = [
        { action: "pick", hash: A },
        { action: "squash", hash: B },
        { action: "fixup", hash: C }
      ];
      expect(check(entries)).toEqual({ ok: true });
    });

    it("allows edit, reword and drop as the first entry", () => {
      for (const action of ["edit", "reword", "drop"] as const) {
        expect(check([{ action, hash: A }], [A])).toEqual({ ok: true });
      }
    });
  });

  describe("rule 6: the hashes are exactly the range", () => {
    it("rejects a range hash that is missing from the todo", () => {
      const entries: TodoEntry[] = [
        { action: "pick", hash: A },
        { action: "pick", hash: B }
      ];
      expect(rejectionOf(entries, [A, B, C])).toEqual({
        reason: "range-mismatch",
        missing: [C],
        extra: []
      });
    });

    it("rejects a todo hash that is not in the range", () => {
      const entries: TodoEntry[] = [
        { action: "pick", hash: A },
        { action: "pick", hash: C }
      ];
      expect(rejectionOf(entries, [A, B])).toEqual({
        reason: "range-mismatch",
        missing: [B],
        extra: [C]
      });
    });

    it("reports missing and extra hashes together", () => {
      const entries: TodoEntry[] = [{ action: "pick", hash: A }];
      expect(rejectionOf(entries, [B])).toEqual({
        reason: "range-mismatch",
        missing: [B],
        extra: [A]
      });
    });

    it("rejects a non-empty todo against an empty range", () => {
      expect(rejectionOf([{ action: "pick", hash: A }], [])).toEqual({
        reason: "range-mismatch",
        missing: [],
        extra: [A]
      });
    });

    it("accepts a todo in any order that matches the range", () => {
      const reordered: TodoEntry[] = [
        { action: "pick", hash: C },
        { action: "pick", hash: A },
        { action: "pick", hash: B }
      ];
      expect(check(reordered, [A, B, C])).toEqual({ ok: true });
    });
  });

  describe("rule order", () => {
    it("reports the base before an empty list", () => {
      expect(rejectionOf([], [], "-x")).toEqual({ reason: "base-is-option" });
    });

    it("reports a bad hash before a duplicate", () => {
      const entries: TodoEntry[] = [
        { action: "pick", hash: A },
        { action: "pick", hash: A },
        { action: "pick", hash: "short" }
      ];
      expect(rejectionOf(entries, [A])).toEqual({ reason: "bad-hash", hash: "short" });
    });

    it("reports a duplicate before a first-entry squash", () => {
      const entries: TodoEntry[] = [
        { action: "squash", hash: A },
        { action: "pick", hash: B },
        { action: "pick", hash: B }
      ];
      expect(rejectionOf(entries, [A, B])).toEqual({ reason: "duplicate-hash", hash: B });
    });

    it("reports a first-entry squash before a range mismatch", () => {
      const entries: TodoEntry[] = [{ action: "fixup", hash: A }];
      expect(rejectionOf(entries, [B])).toEqual({
        reason: "first-entry-squash",
        action: "fixup"
      });
    });
  });

  it("never mutates its inputs", () => {
    const entries: TodoEntry[] = [
      { action: "pick", hash: A },
      { action: "squash", hash: B }
    ];
    const range = [A, B];
    const before = JSON.stringify({ entries, range });
    validateTodo(entries, range, BASE);
    expect(JSON.stringify({ entries, range })).toBe(before);
  });

  describe("squash without a target (F2-05)", () => {
    it("rejects a squash that follows only a drop", () => {
      const entries: TodoEntry[] = [
        { action: "drop", hash: A },
        { action: "squash", hash: B },
        { action: "pick", hash: C }
      ];
      expect(rejectionOf(entries, [A, B, C])).toEqual({
        reason: "squash-without-target",
        hash: B
      });
    });

    it("allows a member after a drop when a target precedes the drop", () => {
      const entries: TodoEntry[] = [
        { action: "pick", hash: A },
        { action: "drop", hash: B },
        { action: "fixup", hash: C }
      ];
      expect(check(entries, [A, B, C])).toEqual({ ok: true });
    });

    it("still reports a first-entry squash before the target rule", () => {
      const entries: TodoEntry[] = [
        { action: "squash", hash: A },
        { action: "pick", hash: B }
      ];
      expect(rejectionOf(entries, [A, B])).toEqual({
        reason: "first-entry-squash",
        action: "squash"
      });
    });
  });

  describe("empty message (F2-05)", () => {
    it("rejects an empty reword message", () => {
      const entries: TodoEntry[] = [{ action: "reword", hash: A, message: "" }];
      expect(rejectionOf(entries, [A])).toEqual({ reason: "empty-message", hash: A });
    });

    it("rejects a whitespace-only group message", () => {
      const entries: TodoEntry[] = [
        { action: "pick", hash: A, message: "  \n\t " },
        { action: "squash", hash: B }
      ];
      expect(rejectionOf(entries, [A, B])).toEqual({ reason: "empty-message", hash: A });
    });

    it("accepts a message with text, and an unchanged reword without one", () => {
      expect(check([{ action: "reword", hash: A, message: "New subject" }], [A])).toEqual({
        ok: true
      });
      expect(check([{ action: "reword", hash: A }], [A])).toEqual({ ok: true });
    });
  });
});

describe("serializeTodo", () => {
  it("writes one action and full hash per line, in order, with a final newline", () => {
    const entries: TodoEntry[] = [
      { action: "pick", hash: A },
      { action: "squash", hash: B },
      { action: "drop", hash: C }
    ];
    expect(serializeTodo(entries)).toBe(`pick ${A}\nsquash ${B}\ndrop ${C}\n`);
  });

  it("uses \\n line endings only", () => {
    const text = serializeTodo(pickAll);
    expect(text).not.toContain("\r");
    expect(text.split("\n")).toHaveLength(pickAll.length + 1);
  });

  it("writes every action word Git reads", () => {
    const entries: TodoEntry[] = [
      { action: "pick", hash: A },
      { action: "edit", hash: B },
      { action: "squash", hash: C },
      { action: "fixup", hash: WIDE },
      { action: "drop", hash: "f".repeat(40) }
    ];
    const words = serializeTodo(entries)
      .trimEnd()
      .split("\n")
      .map((line) => line.split(" ")[0]);
    expect(words).toEqual(["pick", "edit", "squash", "fixup", "drop"]);
  });

  it("serializes reword as pick", () => {
    expect(serializeTodo([{ action: "reword", hash: A, message: "New subject" }])).toBe(
      `pick ${A}\n`
    );
  });

  it("does not write the message into the todo text", () => {
    const text = serializeTodo([{ action: "pick", hash: A, message: "Subject line" }]);
    expect(text).toBe(`pick ${A}\n`);
  });

  it("writes a 64 digit hash in full", () => {
    expect(serializeTodo([{ action: "pick", hash: WIDE }])).toBe(`pick ${WIDE}\n`);
  });

  it("writes hashes in lower case", () => {
    expect(serializeTodo([{ action: "pick", hash: A.toUpperCase() }])).toBe(`pick ${A}\n`);
  });

  it("returns an empty string for an empty list", () => {
    expect(serializeTodo([])).toBe("");
  });

  it("does not mutate its input", () => {
    const entries: TodoEntry[] = [{ action: "reword", hash: A, message: "m" }];
    const before = JSON.stringify(entries);
    serializeTodo(entries);
    expect(JSON.stringify(entries)).toBe(before);
  });
});

describe("findSquashGroups (F2-05)", () => {
  it("names the actions that open a group", () => {
    expect(isSquashGroupTarget("pick")).toBe(true);
    expect(isSquashGroupTarget("reword")).toBe(true);
    expect(isSquashGroupTarget("edit")).toBe(true);
    expect(isSquashGroupTarget("squash")).toBe(false);
    expect(isSquashGroupTarget("fixup")).toBe(false);
    expect(isSquashGroupTarget("drop")).toBe(false);
  });

  it("groups members under their target, one group per target", () => {
    const entries: TodoEntry[] = [
      { action: "pick", hash: A },
      { action: "squash", hash: B },
      { action: "fixup", hash: C },
      { action: "pick", hash: WIDE }
    ];
    expect(findSquashGroups(entries)).toEqual([
      { targetIndex: 0, memberIndices: [1, 2] },
      { targetIndex: 3, memberIndices: [] }
    ]);
  });

  it("keeps the group open across a drop, as Git skips it", () => {
    const entries: TodoEntry[] = [
      { action: "pick", hash: A },
      { action: "drop", hash: B },
      { action: "squash", hash: C }
    ];
    expect(findSquashGroups(entries)).toEqual([{ targetIndex: 0, memberIndices: [2] }]);
  });

  it("leaves a member before any target in no group", () => {
    const entries: TodoEntry[] = [
      { action: "drop", hash: A },
      { action: "squash", hash: B },
      { action: "pick", hash: C }
    ];
    expect(findSquashGroups(entries)).toEqual([{ targetIndex: 2, memberIndices: [] }]);
  });
});
