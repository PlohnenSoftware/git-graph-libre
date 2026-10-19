import {
  canonicalDiff,
  newPairStat,
  outcomesAgree,
  parseNameStatus,
  recordPair
} from "@tests/backend/engine/diffParity.bench";
import { describe, expect, it } from "vitest";

/**
 * The counting helpers of `pnpm run diff:parity` (22i), so a wrong count
 * in the harness cannot read as a parity result. The sweep itself is the
 * script's own run over real history.
 */

const change = (column: number) => ({
  original: { startLineNumber: 1, endLineNumberExclusive: 2 },
  modified: { startLineNumber: 1, endLineNumberExclusive: 2 },
  innerChanges: [
    {
      original: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: column },
      modified: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: column }
    }
  ]
});

describe("parseNameStatus", () => {
  it("reads plain statuses and both paths of a rename", () => {
    const entries = parseNameStatus("M\0a.ts\0A\0b.ts\0D\0c.ts\0R090\0old.ts\0new.ts\0");
    expect(entries).toEqual([
      { status: "M", oldPath: "a.ts", newPath: "a.ts" },
      { status: "A", oldPath: "b.ts", newPath: "b.ts" },
      { status: "D", oldPath: "c.ts", newPath: "c.ts" },
      { status: "R090", oldPath: "old.ts", newPath: "new.ts" }
    ]);
  });

  it("reads empty output as no files", () => {
    expect(parseNameStatus("")).toEqual([]);
  });
});

describe("canonicalDiff", () => {
  it("agrees on identical diffs and differs on one inner column", () => {
    const one = canonicalDiff({ changes: [change(2)], moves: [], hitTimeout: false }, false);
    const same = canonicalDiff({ changes: [change(2)], moves: [], hitTimeout: false }, false);
    const other = canonicalDiff({ changes: [change(3)], moves: [], hitTimeout: false }, false);
    expect(one).toBe(same);
    expect(one).not.toBe(other);
  });

  it("counts hitTimeout and, only when asked, moves", () => {
    const diff = {
      changes: [change(2)],
      moves: [
        {
          original: { startLineNumber: 3, endLineNumberExclusive: 5 },
          modified: { startLineNumber: 8, endLineNumberExclusive: 10 },
          changes: []
        }
      ],
      hitTimeout: false
    };
    const bare = { changes: [change(2)], moves: [], hitTimeout: false };
    expect(canonicalDiff(diff, false)).toBe(canonicalDiff(bare, false));
    expect(canonicalDiff(diff, true)).not.toBe(canonicalDiff(bare, true));
    expect(canonicalDiff({ ...bare, hitTimeout: true }, false)).not.toBe(
      canonicalDiff(bare, false)
    );
  });
});

describe("pair counting", () => {
  it("counts agreements, mismatches, and caps the examples", () => {
    const stat = newPairStat("arm a", "arm b");
    recordPair(stat, true, "unused", 2);
    recordPair(stat, false, "first", 2);
    recordPair(stat, false, "second", 2);
    recordPair(stat, false, "third", 2);
    expect(stat).toEqual({
      pair: "arm a vs arm b",
      compared: 4,
      mismatches: 3,
      examples: ["first", "second"]
    });
  });

  it("agrees when both arms refuse, and only then", () => {
    expect(outcomesAgree({ ok: false, error: "x" }, { ok: false, error: "y" })).toBe(true);
    expect(outcomesAgree({ ok: false, error: "x" }, { ok: true, canonical: "c" })).toBe(false);
    expect(outcomesAgree({ ok: true, canonical: "c" }, { ok: true, canonical: "c" })).toBe(true);
    expect(outcomesAgree({ ok: true, canonical: "c" }, { ok: true, canonical: "d" })).toBe(false);
  });
});
