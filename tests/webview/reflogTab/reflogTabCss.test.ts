import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/reflog-tab/reflog-tab.css"), "utf8");
const body = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("reflog tab styles", () => {
  it("colors through theme tokens and OKLCH fallbacks, never raw literals", () => {
    expect(body).toContain("var(--vscode-editor-background");
    expect(body).toContain("var(--vscode-badge-background");
    expect(body).toContain("var(--ngg-");
    expect(body).toContain("oklch(");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(body).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    expect(body.toLowerCase()).not.toMatch(/linear-gradient|radial-gradient|box-shadow: 0 0 \d/);
  });

  it("roots every rule at the tab and keeps the column header pinned", () => {
    expect(body).toContain(".ggl-reflog .reflog-table");
    expect(body).toContain(".ggl-reflog .reflog-badge");
    expect(body).toMatch(/\.reflog-head-cell \{\s*position: sticky;\s*top: 0;/);
    expect(body).toContain("overflow-wrap: anywhere");
    expect(body).toContain(":focus-visible");
    expect(body).toContain("@media (forced-colors: active)");
  });
});
