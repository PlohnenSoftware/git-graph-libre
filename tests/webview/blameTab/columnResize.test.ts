import { describe, expect, it } from "vitest";

import {
  clampGutterWidth,
  DEFAULT_GUTTER_WIDTH,
  MAX_GUTTER_WIDTH,
  MIN_GUTTER_WIDTH,
  normalizeGutterWidth,
  resizeGutterWidth
} from "@/webview/blameTab/columnResize";

describe("blame gutter resize arithmetic", () => {
  it("uses the graph table's 40px minimum", () => {
    expect(MIN_GUTTER_WIDTH).toBe(40);
    expect(DEFAULT_GUTTER_WIDTH).toBe(280);
    expect(MAX_GUTTER_WIDTH).toBe(800);
  });

  it("widens and narrows the gutter by the drag delta", () => {
    expect(resizeGutterWidth(280, 40)).toBe(320);
    expect(resizeGutterWidth(280, -40)).toBe(240);
  });

  it("stops at the minimum and the ceiling", () => {
    expect(resizeGutterWidth(280, -1000)).toBe(40);
    expect(resizeGutterWidth(280, 1000)).toBe(800);
    expect(clampGutterWidth(10)).toBe(40);
    expect(clampGutterWidth(2000)).toBe(800);
    expect(clampGutterWidth(120.6)).toBe(121);
    expect(clampGutterWidth(Number.NaN)).toBe(DEFAULT_GUTTER_WIDTH);
  });
});

describe("normalizeGutterWidth (restored saved width)", () => {
  it("keeps a width and clamps it the way a drag does", () => {
    expect(normalizeGutterWidth(320)).toBe(320);
    expect(normalizeGutterWidth(10)).toBe(40);
    expect(normalizeGutterWidth(900.4)).toBe(800);
  });

  it("rejects anything this tab did not write", () => {
    expect(normalizeGutterWidth(null)).toBeNull();
    expect(normalizeGutterWidth(undefined)).toBeNull();
    expect(normalizeGutterWidth("wide")).toBeNull();
    expect(normalizeGutterWidth(Number.NaN)).toBeNull();
    expect(normalizeGutterWidth([320])).toBeNull();
  });
});
