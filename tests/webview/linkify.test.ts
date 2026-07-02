import { describe, expect, it } from "vitest";

import { extractIssueLinks, linkifyHttpUrls, linkifyText } from "@/webview/utils/linkify";

function render(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

describe("linkifyHttpUrls", () => {
  it("links http and https URLs while trimming sentence punctuation", () => {
    const host = render(`See ${linkifyHttpUrls("https://example.test/path?q=1.")}`);
    const link = host.querySelector("a");

    expect(link?.getAttribute("href")).toBe("https://example.test/path?q=1");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toBe("https://example.test/path?q=1");
    expect(host.textContent).toBe("See https://example.test/path?q=1.");
  });

  it("escapes non-url text and preserves line breaks", () => {
    const host = render(linkifyHttpUrls("Use <b>bold</b>\nhttps://example.test"));

    expect(host.innerHTML).toContain("Use &lt;b&gt;bold&lt;/b&gt;<br>");
    expect(host.querySelector("b")).toBeNull();
    expect(host.querySelector("a")?.textContent).toBe("https://example.test");
  });

  it("keeps balanced URL parentheses inside the link", () => {
    const host = render(linkifyHttpUrls("See (https://example.test/a_(b))."));
    const link = host.querySelector("a");

    expect(link?.getAttribute("href")).toBe("https://example.test/a_(b)");
    expect(link?.textContent).toBe("https://example.test/a_(b)");
    expect(host.textContent).toBe("See (https://example.test/a_(b)).");
  });

  it("does not link unsupported or unsafe schemes", () => {
    const host = render(linkifyHttpUrls("ftp://example.test javascript:alert(1) mailto:a@test"));

    expect(host.querySelector("a")).toBeNull();
  });
});

describe("linkifyText", () => {
  const issueLinking = {
    pattern: "#(\\d+)",
    urlTemplate: "https://issues.example.test/$1"
  };

  it("links configured issue references with encoded capture groups", () => {
    const host = render(linkifyText("Fix #123", issueLinking));
    const link = host.querySelector("a");

    expect(link?.textContent).toBe("#123");
    expect(link?.getAttribute("href")).toBe("https://issues.example.test/123");
    expect(link?.classList.contains("externalLink")).toBe(true);
  });

  it("skips issue links that produce unsafe URLs", () => {
    const host = render(
      linkifyText("Fix #123", { pattern: "#(\\d+)", urlTemplate: "javascript:alert($1)" })
    );

    expect(host.querySelector("a")).toBeNull();
  });

  it("ignores invalid issue patterns and malformed generated URLs", () => {
    const invalidPatternHost = render(
      linkifyText("Fix #123", { pattern: "(", urlTemplate: "https://issues.example.test/$1" })
    );
    const invalidUrlHost = render(
      linkifyText("Fix #123", { pattern: "#(\\d+)", urlTemplate: "https://%" })
    );

    expect(invalidPatternHost.querySelector("a")).toBeNull();
    expect(invalidUrlHost.querySelector("a")).toBeNull();
  });

  it("extracts issue links for branch context menus", () => {
    expect(extractIssueLinks("feature/#123-and-#456", issueLinking)).toEqual([
      { displayText: "#123", url: "https://issues.example.test/123" },
      { displayText: "#456", url: "https://issues.example.test/456" }
    ]);
  });
});
