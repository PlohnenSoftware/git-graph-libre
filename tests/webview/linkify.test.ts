import { linkifyHttpUrls } from "@/webview/utils/linkify";
import { describe, expect, it } from "vitest";

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
