import { describe, expect, it } from "vitest";

import {
  COLUMN_SIDE_PADDING_PX,
  clampColumnResizeDelta,
  DEFAULT_COLUMN_WIDTHS,
  defaultColumnWidths,
  fitColumnWidthsToContainer,
  MESSAGE_COLUMN_INDEX,
  MIN_COLUMN_WIDTH,
  normalizeColumnWidths,
  REFLOG_COLUMN_COUNT,
  resizeColumnWidths
} from "@/webview/reflogTab/columnResize";

/** A column's rendered width: its content width plus both sides' padding. */
function renderedWidth(widths: number[]): number {
  return widths.reduce((sum, width) => sum + width, 0) + widths.length * COLUMN_SIDE_PADDING_PX;
}

describe("reflog column defaults (Q2)", () => {
  it("uses the graph table's 40px minimum over the seven columns, Message fourth", () => {
    expect(MIN_COLUMN_WIDTH).toBe(40);
    expect(REFLOG_COLUMN_COUNT).toBe(7);
    expect(MESSAGE_COLUMN_INDEX).toBe(3);
    expect(DEFAULT_COLUMN_WIDTHS).toHaveLength(REFLOG_COLUMN_COUNT);
  });

  it("sits every default at or above the minimum, so each stays reachable by dragging back", () => {
    for (const width of DEFAULT_COLUMN_WIDTHS) {
      expect(width).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
    }
    // Widening a column and dragging it back by the same amount
    // lands exactly on its default again, Index included.
    const widened = resizeColumnWidths(defaultColumnWidths(), 0, 100);
    expect(resizeColumnWidths(widened, 0, -100)).toEqual([...DEFAULT_COLUMN_WIDTHS]);
  });

  it("hands out a fresh copy of the defaults each time", () => {
    const widths = defaultColumnWidths();
    widths[0] = 999;
    expect(defaultColumnWidths()[0]).toBe(DEFAULT_COLUMN_WIDTHS[0]);
  });
});

describe("reflog column resize arithmetic (Message is the flexible column, Q2)", () => {
  const widths = [50, 110, 90, 300, 90, 130, 120];

  it("widens Message against Commit at Message's own right edge, and back", () => {
    expect(resizeColumnWidths(widths, 3, 40)).toEqual([50, 110, 90, 340, 50, 130, 120]);
    expect(resizeColumnWidths(widths, 3, -40)).toEqual([50, 110, 90, 260, 130, 130, 120]);
    // The input is not mutated.
    expect(widths[3]).toBe(300);
  });

  it("trades every other boundary against Message, never against the neighbour", () => {
    // Index widens, Message shrinks, Action keeps its width.
    expect(resizeColumnWidths(widths, 0, 20)).toEqual([70, 110, 90, 280, 90, 130, 120]);
    // Sub-action's right edge is Message's left edge: the same trade.
    expect(resizeColumnWidths(widths, 2, 20)).toEqual([50, 110, 110, 280, 90, 130, 120]);
    // Right of Message, Date widens against Message; State is untouched.
    expect(resizeColumnWidths(widths, 5, 20)).toEqual([50, 110, 90, 280, 90, 150, 120]);
    // Narrowing a fixed column grows Message by the same amount.
    expect(resizeColumnWidths(widths, 5, -30)).toEqual([50, 110, 90, 330, 90, 100, 120]);
  });

  it("keeps the total width through every drag, so a fitted table stays fitted", () => {
    for (const col of [0, 1, 2, 3, 4, 5]) {
      for (const delta of [-500, -37, 0, 42, 500]) {
        expect(renderedWidth(resizeColumnWidths(widths, col, delta))).toBe(renderedWidth(widths));
      }
    }
  });

  it("stops at the minimum on either side of the trade", () => {
    expect(clampColumnResizeDelta(widths, 3, 400)).toBe(50);
    expect(resizeColumnWidths(widths, 3, 400)).toEqual([50, 110, 90, 350, 40, 130, 120]);
    expect(clampColumnResizeDelta(widths, 3, -400)).toBe(-260);
    expect(resizeColumnWidths(widths, 3, -400)).toEqual([50, 110, 90, 40, 350, 130, 120]);
    // A fixed column stops widening when Message reaches the minimum…
    const narrowMessage = [50, 110, 90, 60, 90, 130, 120];
    expect(resizeColumnWidths(narrowMessage, 1, 100)).toEqual([50, 130, 90, 40, 90, 130, 120]);
    // …and stops narrowing at its own minimum.
    expect(resizeColumnWidths(widths, 5, -200)).toEqual([50, 110, 90, 390, 90, 40, 120]);
  });
});

describe("fitColumnWidthsToContainer (Q2)", () => {
  const widths = [50, 110, 90, 300, 90, 130, 120]; // rendered: 1002px

  it("grows only Message when the container widens, and leaves an exact fit alone", () => {
    expect(fitColumnWidthsToContainer(widths, 1202)).toEqual([50, 110, 90, 500, 90, 130, 120]);
    expect(fitColumnWidthsToContainer(widths, 1002)).toEqual(widths);
    // The input is not mutated.
    expect(widths[3]).toBe(300);
  });

  it("shrinks only Message while it stays above the minimum", () => {
    expect(fitColumnWidthsToContainer(widths, 902)).toEqual([50, 110, 90, 200, 90, 130, 120]);
  });

  it("scales saved widths back, Message first, when they no longer fit", () => {
    // The defaults no longer fit a 700px panel even with Message at
    // its minimum, so the fixed columns give in proportion to their
    // slack above the minimum — Index, the narrowest, gives least.
    const fitted = fitColumnWidthsToContainer(defaultColumnWidths(), 700);
    expect(fitted).toEqual([48, 94, 91, 40, 74, 111, 130]);
    expect(renderedWidth(fitted)).toBe(700);
    expect(fitted[MESSAGE_COLUMN_INDEX]).toBe(MIN_COLUMN_WIDTH);
  });

  it("never renders wider than the container, even below the sum of the minimums", () => {
    for (const container of [1560, 1200, 1002, 900, 700, 500, 400, 312]) {
      const fitted = fitColumnWidthsToContainer(defaultColumnWidths(), container);
      expect(renderedWidth(fitted), `container ${container}`).toBeLessThanOrEqual(container);
      expect(renderedWidth(fitted), `container ${container}`).toBe(container);
    }
    const tiny = fitColumnWidthsToContainer(defaultColumnWidths(), 312);
    expect(Math.max(...tiny) - Math.min(...tiny)).toBeLessThanOrEqual(1);
  });

  it("leaves the widths unchanged while the table reports no container width", () => {
    const fitted = fitColumnWidthsToContainer(widths, 0);
    expect(fitted).toEqual(widths);
    expect(fitted).not.toBe(widths);
    expect(fitColumnWidthsToContainer(widths, -5)).toEqual(widths);
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
