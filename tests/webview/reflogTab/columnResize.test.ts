import { describe, expect, it } from "vitest";

import {
  clampColumnResizeDelta,
  MIN_COLUMN_WIDTH,
  normalizeColumnWidths,
  REFLOG_COLUMN_COUNT,
  resizeColumnWidths
} from "@/webview/reflogTab/columnResize";

describe("reflog column resize arithmetic (the graph's pair rule)", () => {
  it("uses the graph table's 40px minimum over the seven columns", () => {
    expect(MIN_COLUMN_WIDTH).toBe(40);
    expect(REFLOG_COLUMN_COUNT).toBe(7);
  });

  it("widens one column by narrowing its neighbour, and back", () => {
    const widths = [50, 110, 90, 300, 90, 130, 120];
    expect(resizeColumnWidths(widths, 3, 40)).toEqual([50, 110, 90, 340, 50, 130, 120]);
    expect(resizeColumnWidths(widths, 3, -40)).toEqual([50, 110, 90, 260, 130, 130, 120]);
    // The input is not mutated.
    expect(widths[3]).toBe(300);
  });

  it("stops at the minimum on either side of the boundary", () => {
    const widths = [50, 110, 90, 300, 90, 130, 120];
    expect(clampColumnResizeDelta(widths, 3, 400)).toBe(50);
    expect(resizeColumnWidths(widths, 3, 400)).toEqual([50, 110, 90, 350, 40, 130, 120]);
    expect(clampColumnResizeDelta(widths, 3, -400)).toBe(-260);
    expect(resizeColumnWidths(widths, 3, -400)).toEqual([50, 110, 90, 40, 350, 130, 120]);
  });

  it("resizes the first and last boundaries like any other pair", () => {
    const widths = [50, 110, 90, 300, 90, 130, 120];
    expect(resizeColumnWidths(widths, 0, 20)).toEqual([70, 90, 90, 300, 90, 130, 120]);
    expect(resizeColumnWidths(widths, 5, 20)).toEqual([50, 110, 90, 300, 90, 150, 100]);
    expect(resizeColumnWidths(widths, 5, -200)).toEqual([50, 110, 90, 300, 90, 40, 210]);
  });
});

describe("normalizeColumnWidths (restored saved widths)", () => {
  it("keeps a full set and raises any width below the minimum", () => {
    expect(normalizeColumnWidths([50, 110, 90, 300, 90, 130, 120])).toEqual([
      50, 110, 90, 300, 90, 130, 120
    ]);
    expect(normalizeColumnWidths([10, 110.9, 90, 300, 90, 130, 120])).toEqual([
      40, 110, 90, 300, 90, 130, 120
    ]);
  });

  it("rejects anything this tab did not write", () => {
    expect(normalizeColumnWidths(null)).toBeNull();
    expect(normalizeColumnWidths(undefined)).toBeNull();
    expect(normalizeColumnWidths([50, 110])).toBeNull();
    expect(normalizeColumnWidths([50, 110, 90, 300, 90, 130, "wide"])).toBeNull();
    expect(normalizeColumnWidths([50, 110, 90, 300, 90, 130, Number.NaN])).toBeNull();
    expect(normalizeColumnWidths("50,110")).toBeNull();
  });
});
