import { describe, expect, it } from "vitest";

import { truncateMiddle, truncateRefName } from "@/webview/utils/truncate";

describe("display truncation", () => {
  it("returns short names unchanged", () => {
    expect(truncateMiddle("feature/login", 20)).toBe("feature/login");
    expect(truncateRefName("origin/main", 20)).toBe("origin/main");
  });

  it("middle-truncates plain names while preserving the start and end", () => {
    expect(truncateMiddle("averyverylongauthor@example.test", 18)).toBe("averyvery\u2026ple.test");
  });

  it("keeps dependabot branch tails distinguishable", () => {
    const checkout = truncateRefName("origin/dependabot/github_actions/actions/checkout-7", 40);
    const setupNode = truncateRefName("origin/dependabot/github_actions/actions/setup-node-6", 40);

    expect(checkout).toBe("origin/\u2026/actions/checkout-7");
    expect(setupNode).toBe("origin/\u2026/actions/setup-node-6");
    expect(checkout).not.toBe(setupNode);
  });

  it("preserves the first ref segment and as many trailing segments as fit", () => {
    expect(truncateRefName("upstream/team/product/release/2026.07", 34)).toBe(
      "upstream/\u2026/product/release/2026.07"
    );
  });

  it("falls back to middle truncation when the tail alone exceeds the budget", () => {
    expect(truncateRefName("origin/releases/supercalifragilisticexpialidocious", 24)).toBe(
      "origin/relea\u2026ialidocious"
    );
  });

  it("respects exact boundary lengths", () => {
    expect(truncateMiddle("1234567890", 10)).toBe("1234567890");
    expect(truncateMiddle("12345678901", 10)).toBe("12345\u20268901");
  });
});
