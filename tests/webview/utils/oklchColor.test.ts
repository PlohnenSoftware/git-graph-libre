import { describe, expect, it } from "vitest";

import {
  formatOklch,
  hexToOklch,
  parseOklch,
  rewritePaletteLightnessChroma,
  rgbToOklch
} from "@/webview/utils/oklchColor";

describe("OKLCH color utilities", () => {
  it("parses and formats OKLCH values with clamped ranges", () => {
    expect(parseOklch("oklch(63% 0.2 245 / 0.5)")).toEqual({
      l: 63,
      c: 0.2,
      h: 245,
      alpha: 0.5
    });
    expect(formatOklch({ l: 101, c: -1, h: -15, alpha: 2 })).toBe("oklch(100% 0 345 / 1)");
  });

  it("converts hex and rgb colors to OKLCH", () => {
    const red = hexToOklch("#ff0000");
    expect(red?.l).toBeCloseTo(62.8, 1);
    expect(red?.c).toBeCloseTo(0.258, 2);
    expect(red?.h).toBeCloseTo(29.2, 1);

    const white = rgbToOklch("rgba(255, 255, 255, 0.25)");
    expect(white?.l).toBeCloseTo(100, 1);
    expect(white?.c).toBeCloseTo(0, 4);
    expect(white?.alpha).toBe(0.25);
  });

  it("rewrites palette lightness and chroma while preserving hue", () => {
    expect(rewritePaletteLightnessChroma(["oklch(63% 0.2 245)", "#ff0000"], 70, 0.12)).toEqual([
      "oklch(70% 0.12 245)",
      "oklch(70% 0.12 29.23)"
    ]);
  });
});
