import { describe, expect, it } from "vitest";

import type { CharSpan, DiffTabChange, DiffTabLayout } from "@/diffTabTypes";
import type { DiffCell, DiffRow } from "@/webview/diffTab/rowModel";
import { buildRows, expandCollapsed, splitLines } from "@/webview/diffTab/rowModel";

const NO_HIDE: DiffTabLayout = {
  hideUnchanged: false,
  contextLineCount: 3,
  minimumLineCount: 3,
  revealLineCount: 20
};
const HIDE: DiffTabLayout = { ...NO_HIDE, hideUnchanged: true };

function change(
  originalStart: number,
  originalEnd: number,
  modifiedStart: number,
  modifiedEnd: number,
  inner: { original: CharSpan; modified: CharSpan }[] = []
): DiffTabChange {
  return {
    original: { start: originalStart, endExclusive: originalEnd },
    modified: { start: modifiedStart, endExclusive: modifiedEnd },
    inner
  };
}

function span(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
): CharSpan {
  return { startLine, startColumn, endLine, endColumn };
}

function numbered(count: number, prefix = "l"): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

/**
 * The property every case must keep: reading each side top to bottom,
 * skipping fillers and adding each collapsed row's hidden count, gives
 * line numbers 1 to n with no gap and no repeat.
 */
function expectLineNumberInvariant(
  rows: DiffRow[],
  originalCount: number,
  modifiedCount: number
): void {
  const left: number[] = [];
  const right: number[] = [];
  for (const row of rows) {
    if (row.kind === "collapsed") {
      for (let i = 0; i < row.hiddenCount; i++) {
        left.push(row.originalStart + i);
        right.push(row.modifiedStart + i);
      }
    } else {
      if (row.left !== null) {
        left.push(row.left.lineNumber);
      }
      if (row.right !== null) {
        right.push(row.right.lineNumber);
      }
    }
  }
  expect(left).toEqual(numbered(originalCount, "").map(Number));
  expect(right).toEqual(numbered(modifiedCount, "").map(Number));
}

function build(
  originalLines: string[],
  modifiedLines: string[],
  changes: DiffTabChange[],
  layout: DiffTabLayout = NO_HIDE
): DiffRow[] {
  const rows = buildRows(originalLines, modifiedLines, changes, layout);
  expectLineNumberInvariant(rows, originalLines.length, modifiedLines.length);
  return rows;
}

function kinds(rows: DiffRow[]): string[] {
  return rows.map((row) => row.kind);
}

function cellText(cell: DiffCell | null): string | null {
  return cell === null ? null : cell.segments.map((segment) => segment.text).join("");
}

function lineCells(rows: DiffRow[], side: "left" | "right"): (DiffCell | null)[] {
  return rows.map((row) => (row.kind === "line" ? row[side] : null));
}

describe("splitLines", () => {
  it.each([
    ["", [""]],
    ["a", ["a"]],
    ["a\n", ["a", ""]],
    ["a\r\nb\rc\n", ["a", "b", "c", ""]]
  ])("splits %j as the text model does", (text, expected) => {
    expect(splitLines(text)).toEqual(expected);
  });
});

describe("buildRows", () => {
  it("pairs identical texts one to one with no changes marked", () => {
    const rows = build(["a", "b"], ["a", "b"], []);
    expect(kinds(rows)).toEqual(["line", "line"]);
    expect(lineCells(rows, "left").map(cellText)).toEqual(["a", "b"]);
    expect(lineCells(rows, "right").map((cell) => cell?.change)).toEqual(["none", "none"]);
    expect(lineCells(rows, "left")[0]?.segments).toEqual([{ text: "a", highlight: false }]);
  });

  it("shows an insertion at the start as a filler on the left", () => {
    const rows = build(["b", "c"], ["a", "b", "c"], [change(1, 1, 1, 2)]);
    expect(lineCells(rows, "left").map(cellText)).toEqual([null, "b", "c"]);
    expect(lineCells(rows, "right").map(cellText)).toEqual(["a", "b", "c"]);
    expect(lineCells(rows, "right")[0]?.change).toBe("insert");
  });

  it("shows an insertion in the middle as a filler on the left", () => {
    const rows = build(["a", "c"], ["a", "b", "c"], [change(2, 2, 2, 3)]);
    expect(lineCells(rows, "left").map(cellText)).toEqual(["a", null, "c"]);
    expect(lineCells(rows, "right").map(cellText)).toEqual(["a", "b", "c"]);
  });

  it("shows an insertion at the end as a filler on the left", () => {
    const rows = build(["a"], ["a", "b"], [change(2, 2, 2, 3)]);
    expect(lineCells(rows, "left").map(cellText)).toEqual(["a", null]);
    expect(lineCells(rows, "right").map(cellText)).toEqual(["a", "b"]);
  });

  it("shows a pure deletion as a filler on the right", () => {
    const rows = build(["a", "b", "c"], ["a", "c"], [change(2, 3, 2, 2)]);
    expect(lineCells(rows, "left").map(cellText)).toEqual(["a", "b", "c"]);
    expect(lineCells(rows, "right").map(cellText)).toEqual(["a", null, "c"]);
    expect(lineCells(rows, "left")[1]?.change).toBe("delete");
  });

  it("pads a replaced block of 2 left lines and 4 right lines with two left fillers", () => {
    const rows = build(["a", "x", "y", "d"], ["a", "p", "q", "r", "s", "d"], [change(2, 4, 2, 6)]);
    expect(lineCells(rows, "left").map(cellText)).toEqual(["a", "x", "y", null, null, "d"]);
    expect(lineCells(rows, "right").map(cellText)).toEqual(["a", "p", "q", "r", "s", "d"]);
    expect(lineCells(rows, "left").filter((cell) => cell === null)).toHaveLength(2);
  });

  it("cuts segments at an inner change spanning two lines", () => {
    const rows = build(
      ["hello world", "second line", "tail"],
      ["hello brave", "new line", "tail"],
      [change(1, 3, 1, 3, [{ original: span(1, 7, 2, 7), modified: span(1, 7, 2, 4) }])]
    );
    expect(lineCells(rows, "left")[0]?.segments).toEqual([
      { text: "hello ", highlight: false },
      { text: "world", highlight: true }
    ]);
    expect(lineCells(rows, "left")[1]?.segments).toEqual([
      { text: "second", highlight: true },
      { text: " line", highlight: false }
    ]);
    expect(lineCells(rows, "right")[0]?.segments).toEqual([
      { text: "hello ", highlight: false },
      { text: "brave", highlight: true }
    ]);
    expect(lineCells(rows, "right")[1]?.segments).toEqual([
      { text: "new", highlight: true },
      { text: " line", highlight: false }
    ]);
  });

  it("counts columns in UTF-16 code units after a surrogate pair", () => {
    const rows = build(
      ["😀abc"],
      ["😀axc"],
      [change(1, 2, 1, 2, [{ original: span(1, 4, 1, 5), modified: span(1, 4, 1, 5) }])]
    );
    // The emoji is two UTF-16 units, so column 4 is "b" / "x", not "c".
    expect(lineCells(rows, "left")[0]?.segments).toEqual([
      { text: "😀a", highlight: false },
      { text: "b", highlight: true },
      { text: "c", highlight: false }
    ]);
    expect(lineCells(rows, "right")[0]?.segments).toEqual([
      { text: "😀a", highlight: false },
      { text: "x", highlight: true },
      { text: "c", highlight: false }
    ]);
  });

  it("merges overlapping, touching and unsorted inner changes on one line", () => {
    const rows = build(
      ["abcdefghij"],
      ["abcdefghij!", "xyz"],
      [
        change(1, 2, 1, 3, [
          { original: span(1, 6, 1, 8), modified: span(1, 11, 1, 12) },
          { original: span(1, 1, 1, 3), modified: span(1, 4, 1, 4) },
          { original: span(1, 3, 1, 4), modified: span(2, 1, 2, 3) },
          { original: span(1, 7, 1, 10), modified: span(1, 11, 1, 12) }
        ])
      ]
    );
    // Left: "ab" and the touching "c" merge, "fg" and the overlapping "ghi" merge.
    expect(lineCells(rows, "left")[0]?.segments).toEqual([
      { text: "abc", highlight: true },
      { text: "de", highlight: false },
      { text: "fghi", highlight: true },
      { text: "j", highlight: false }
    ]);
    // Right: the empty span is dropped, the duplicate merges, and the
    // second line's span touches only the second line.
    expect(lineCells(rows, "right")[0]?.segments).toEqual([
      { text: "abcdefghij", highlight: false },
      { text: "!", highlight: true }
    ]);
    expect(lineCells(rows, "right")[1]?.segments).toEqual([
      { text: "xy", highlight: true },
      { text: "z", highlight: false }
    ]);
    expect(lineCells(rows, "left")[1]).toBeNull();
  });

  it("shows an added file (empty original) as insertions with left fillers", () => {
    const rows = build([], ["one", "two"], [change(1, 1, 1, 3)]);
    expect(lineCells(rows, "left").map(cellText)).toEqual([null, null]);
    expect(lineCells(rows, "right").map(cellText)).toEqual(["one", "two"]);
  });

  it("shows a deleted file (empty modified) as deletions with right fillers", () => {
    const rows = build(["one", "two"], [], [change(1, 3, 1, 1)]);
    expect(lineCells(rows, "left").map(cellText)).toEqual(["one", "two"]);
    expect(lineCells(rows, "right").map(cellText)).toEqual([null, null]);
  });
});

describe("collapsing unchanged regions", () => {
  it("collapses a run at the start, keeping context lines next to the change", () => {
    const original = numbered(10);
    const modified = [...original];
    modified[8] = "changed9";
    const rows = build(original, modified, [change(9, 10, 9, 10)], HIDE);
    expect(rows[0]).toEqual({
      kind: "collapsed",
      id: 1,
      originalStart: 1,
      modifiedStart: 1,
      hiddenCount: 5
    });
    expect(lineCells(rows, "left").map(cellText)).toEqual([null, "l6", "l7", "l8", "l9", "l10"]);
  });

  it("collapses a run in the middle, keeping context lines on each side", () => {
    const original = numbered(12);
    const modified = [...original];
    modified[0] = "changed1";
    modified[11] = "changed12";
    const rows = build(original, modified, [change(1, 2, 1, 2), change(12, 13, 12, 13)], HIDE);
    expect(rows.filter((row) => row.kind === "collapsed")).toEqual([
      { kind: "collapsed", id: 1, originalStart: 5, modifiedStart: 5, hiddenCount: 4 }
    ]);
    expect(lineCells(rows, "left").map(cellText)).toEqual([
      "l1",
      "l2",
      "l3",
      "l4",
      null,
      "l9",
      "l10",
      "l11",
      "l12"
    ]);
  });

  it("collapses a run at the end, keeping context lines next to the change", () => {
    const original = numbered(9);
    const modified = [...original];
    modified[0] = "changed1";
    const rows = build(original, modified, [change(1, 2, 1, 2)], HIDE);
    expect(rows[rows.length - 1]).toEqual({
      kind: "collapsed",
      id: 1,
      originalStart: 5,
      modifiedStart: 5,
      hiddenCount: 5
    });
    expect(lineCells(rows, "left").map(cellText)).toEqual(["l1", "l2", "l3", "l4", null]);
  });

  it("collapses a start run exactly at the context + minimum threshold", () => {
    const original = numbered(7);
    const modified = [...original];
    modified[6] = "changed7";
    const rows = build(original, modified, [change(7, 8, 7, 8)], HIDE);
    expect(rows[0]).toEqual({
      kind: "collapsed",
      id: 1,
      originalStart: 1,
      modifiedStart: 1,
      hiddenCount: 3
    });
  });

  it("keeps a middle run one line too short to collapse fully visible", () => {
    const original = numbered(10);
    const modified = [...original];
    modified[0] = "changed1";
    modified[9] = "changed10";
    const rows = build(original, modified, [change(1, 2, 1, 2), change(10, 11, 10, 11)], HIDE);
    expect(kinds(rows)).not.toContain("collapsed");
    expect(rows).toHaveLength(10);
  });

  it("collapses a file with no changes entirely once it reaches the threshold", () => {
    const lines = numbered(6);
    const rows = build(lines, lines, [], HIDE);
    expect(rows).toEqual([
      { kind: "collapsed", id: 1, originalStart: 1, modifiedStart: 1, hiddenCount: 6 }
    ]);
  });

  it("keeps a short file with no changes visible", () => {
    const lines = numbered(5);
    const rows = build(lines, lines, [], HIDE);
    expect(kinds(rows)).toEqual(["line", "line", "line", "line", "line"]);
  });

  it("never collapses when hideUnchanged is false", () => {
    const lines = numbered(30);
    const rows = build(lines, lines, [], NO_HIDE);
    expect(rows).toHaveLength(30);
    expect(kinds(rows)).not.toContain("collapsed");
  });
});

describe("expandCollapsed", () => {
  const REVEAL_FIVE: DiffTabLayout = { ...HIDE, revealLineCount: 5 };

  function collapsedFile(): DiffRow[] {
    const lines = numbered(30);
    return build(lines, lines, [], HIDE);
  }

  it("reveals the whole region for all", () => {
    const expanded = expandCollapsed(collapsedFile(), 1, "all", HIDE);
    expectLineNumberInvariant(expanded, 30, 30);
    expect(expanded).toHaveLength(30);
    expect(kinds(expanded)).not.toContain("collapsed");
    expect(lineCells(expanded, "left").map(cellText)).toEqual(numbered(30));
  });

  it("reveals revealLineCount lines at the top for above", () => {
    const expanded = expandCollapsed(collapsedFile(), 1, "above", REVEAL_FIVE);
    expectLineNumberInvariant(expanded, 30, 30);
    expect(lineCells(expanded, "left").map(cellText)).toEqual(["l1", "l2", "l3", "l4", "l5", null]);
    expect(expanded[expanded.length - 1]).toEqual({
      kind: "collapsed",
      id: 1,
      originalStart: 6,
      modifiedStart: 6,
      hiddenCount: 25
    });
  });

  it("reveals revealLineCount lines at the bottom for below", () => {
    const expanded = expandCollapsed(collapsedFile(), 1, "below", REVEAL_FIVE);
    expectLineNumberInvariant(expanded, 30, 30);
    expect(expanded[0]).toEqual({
      kind: "collapsed",
      id: 1,
      originalStart: 1,
      modifiedStart: 1,
      hiddenCount: 25
    });
    expect(lineCells(expanded, "left").map(cellText)).toEqual([
      null,
      "l26",
      "l27",
      "l28",
      "l29",
      "l30"
    ]);
  });

  it("can expand the remainder of a partly revealed region again", () => {
    const once = expandCollapsed(collapsedFile(), 1, "above", REVEAL_FIVE);
    const twice = expandCollapsed(once, 1, "above", REVEAL_FIVE);
    expectLineNumberInvariant(twice, 30, 30);
    expect(lineCells(twice, "left").map(cellText)).toEqual([...numbered(10), null]);
    expect(twice[twice.length - 1]).toEqual({
      kind: "collapsed",
      id: 1,
      originalStart: 11,
      modifiedStart: 11,
      hiddenCount: 20
    });
  });

  it("leaves the rows unchanged for an unknown id", () => {
    const rows = collapsedFile();
    const expanded = expandCollapsed(rows, 99, "all", HIDE);
    expectLineNumberInvariant(expanded, 30, 30);
    expect(expanded).toEqual(rows);
  });
});
