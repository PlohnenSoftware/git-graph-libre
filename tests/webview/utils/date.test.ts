import { describe, expect, it } from "vitest";

import { formatRelativeDate } from "@/webview/utils/date";

const NOW = new Date("2026-07-25T12:00:00Z");

function ago(seconds: number, locale = "en"): string {
  return formatRelativeDate(new Date(NOW.getTime() - seconds * 1000), NOW, locale);
}

describe("formatRelativeDate", () => {
  it("picks the largest unit that fits", () => {
    expect(ago(5)).toBe("5 seconds ago");
    expect(ago(90)).toBe("2 minutes ago");
    expect(ago(7200)).toBe("2 hours ago");
    expect(ago(172800)).toBe("2 days ago");
    expect(ago(1209600)).toBe("2 weeks ago");
    expect(ago(5259600)).toBe("2 months ago");
    expect(ago(63115200)).toBe("2 years ago");
  });

  it("uses each unit's boundary rather than spilling into the next", () => {
    expect(ago(59)).toBe("59 seconds ago");
    expect(ago(3599)).toBe("60 minutes ago");
    expect(ago(86399)).toBe("24 hours ago");
  });

  it("handles the present and future without throwing", () => {
    expect(ago(0)).toBe("0 seconds ago");
    expect(formatRelativeDate(new Date(NOW.getTime() + 5000), NOW, "en")).toBe("in 5 seconds");
  });

  it("applies the locale's own plural rules, which a singular/plural pair cannot", () => {
    // Polish has three plural forms. 2-4 take a different form from both 1 and 5+,
    // so the previous binary unit/unitPlural approach was wrong for 2, 3, 4, 22...
    expect(ago(120, "pl")).toBe("2 minuty temu");
    expect(ago(180, "pl")).toBe("3 minuty temu");
    expect(ago(300, "pl")).toBe("5 minut temu");
    expect(ago(1320, "pl")).toBe("22 minuty temu");
  });

  it("puts the locale's own word order in place", () => {
    expect(ago(300, "zh-cn")).toBe("5分钟前");
  });

  it("falls back to the default locale for an invalid tag", () => {
    expect(() => ago(60, "not a locale")).not.toThrow();
    expect(ago(60, "not a locale")).toMatch(/\d/);
  });
});
