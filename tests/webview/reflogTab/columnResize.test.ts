import { describe, expect, it } from "vitest";

import {
  COLUMN_SIDE_PADDING_PX,
  clampColumnResizeDelta,
  DEFAULT_COLUMN_WIDTHS,
  defaultColumnWidths,
  fitColumnWidthsToContainer,
  MESSAGE_COLUMN_INDEX,
  MESSAGE_MIN_WIDTH,
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
    expect(MESSAGE_MIN_WIDTH).toBe(200);
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
    // The 200px floor is the automatic fit's only: an explicit drag
    // may take Message below it, down to the minimum, as above.
    expect(resizeColumnWidths(widths, 0, 260)[MESSAGE_COLUMN_INDEX]).toBe(MIN_COLUMN_WIDTH);
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

  it("shrinks only Message while it stays above its working minimum (step 1)", () => {
    expect(fitColumnWidthsToContainer(widths, 952)).toEqual([50, 110, 90, 250, 90, 130, 120]);
    // Exactly at the working minimum, no fixed column has given yet.
    expect(fitColumnWidthsToContainer(widths, 902)).toEqual([50, 110, 90, 200, 90, 130, 120]);
  });

  it("then shrinks the fixed columns, Message held at 200px, at a 700px panel (step 2)", () => {
    // The defaults do not fit a 700px panel with Message at its
    // working minimum, so the fixed columns give in proportion to
    // their slack above the minimum — Index, the narrowest, gives
    // least — and clip with an ellipsis. Message keeps a readable
    // 200px instead of wrapping one word per line.
    const fitted = fitColumnWidthsToContainer(defaultColumnWidths(), 700);
    expect(fitted).toEqual([45, 66, 65, 200, 57, 74, 81]);
    expect(renderedWidth(fitted)).toBe(700);
    expect(fitted[MESSAGE_COLUMN_INDEX]).toBe(MESSAGE_MIN_WIDTH);
    fitted.forEach((width, index) => {
      if (index === MESSAGE_COLUMN_INDEX) return;
      expect(width).toBeLessThan(DEFAULT_COLUMN_WIDTHS[index] as number);
      expect(width).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
    });
  });

  it("takes Message below 200px only once every fixed column sits at the minimum (step 3)", () => {
    const fitted = fitColumnWidthsToContainer(defaultColumnWidths(), 480);
    expect(fitted).toEqual([40, 40, 40, 128, 40, 40, 40]);
    expect(renderedWidth(fitted)).toBe(480);
    expect(fitted[MESSAGE_COLUMN_INDEX]).toBeLessThan(MESSAGE_MIN_WIDTH);
    expect(fitted[MESSAGE_COLUMN_INDEX]).toBeGreaterThan(MIN_COLUMN_WIDTH);
    // Narrower still, Message approaches the minimum last.
    expect(fitColumnWidthsToContainer(defaultColumnWidths(), 400)).toEqual([
      40, 40, 40, 48, 40, 40, 40
    ]);
  });

  it("grows the fixed columns back to the chosen widths before Message passes 200px (step 4)", () => {
    // The view keeps the chosen widths and refits them at each
    // container width; widening is the shrink order reversed.
    const chosen = defaultColumnWidths();
    const at700 = fitColumnWidthsToContainer(chosen, 700);
    const at900 = fitColumnWidthsToContainer(chosen, 900);
    expect(at900).toEqual([50, 101, 98, 200, 79, 120, 140]);
    // Every fixed column is on its way back, Message still held.
    at900.forEach((width, index) => {
      if (index === MESSAGE_COLUMN_INDEX) return;
      expect(width).toBeGreaterThan(at700[index] as number);
      expect(width).toBeLessThan(chosen[index] as number);
    });
    expect(at900[MESSAGE_COLUMN_INDEX]).toBe(MESSAGE_MIN_WIDTH);
    // At 988px the fixed columns are whole again, Message at 200px…
    expect(fitColumnWidthsToContainer(chosen, 988)).toEqual([52, 116, 112, 200, 88, 140, 168]);
    // …and only beyond that does Message grow past its floor.
    expect(fitColumnWidthsToContainer(chosen, 1000)).toEqual([52, 116, 112, 212, 88, 140, 168]);
    // The chosen widths a user saved come back the same way: at the
    // width where Message reaches its floor, the fixed columns are
    // the saved ones, not the defaults.
    expect(fitColumnWidthsToContainer(widths, 902)).toEqual([50, 110, 90, 200, 90, 130, 120]);
  });

  it("never renders wider than the container, even below the sum of the minimums", () => {
    for (const container of [1560, 1200, 1002, 988, 900, 700, 480, 400, 312]) {
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
