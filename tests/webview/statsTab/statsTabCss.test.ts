import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/stats-tab/stats-tab.css"), "utf8");
const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = readFileSync(join(process.cwd(), "media/tokens.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

describe("statistics tab styles", () => {
  it("colors through theme tokens and OKLCH fallbacks, never raw literals", () => {
    expect(body).toContain("var(--vscode-editor-background");
    expect(body).toContain("var(--ngg-stats-accent)");
    expect(body).toContain("oklch(");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(body).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    expect(body.toLowerCase()).not.toMatch(/linear-gradient|radial-gradient|box-shadow: 0 0 \d/);
  });

  it("roots every rule at the tab, with focus and forced-colors counterparts", () => {
    expect(body).toContain(".ggl-stats .stats-heatmap");
    expect(body).toContain(".ggl-stats .stats-author-bar");
    expect(body).toContain("overflow-wrap: anywhere");
    expect(body).toContain(":focus-visible");
    expect(body).toContain("@media (forced-colors: active)");
    expect(body).toContain(".ggl-stats .stats-heat-cell,");
  });

  it("ramps the five heat levels off the one accent token, mixed in oklab", () => {
    expect(body).toContain(
      ".ggl-stats .stats-heat-level-0 { background: var(--ngg-neutral-overlay-subtle); }"
    );
    for (const percent of [25, 50, 75]) {
      expect(body).toContain(
        `color-mix(in oklab, var(--ngg-stats-accent) ${percent}%, var(--ngg-transparent))`
      );
    }
    expect(body).toContain(
      ".ggl-stats .stats-heat-level-4 { background: var(--ngg-stats-accent); }"
    );
    expect(body).not.toContain("in srgb");
    // The token itself: the theme's chart color first, OKLCH behind it,
    // darkened on light themes like the reflog markers.
    expect(tokens).toContain("--ngg-stats-accent: var(--vscode-charts-blue, oklch(68% 0.14 250));");
    expect(tokens).toContain("--ngg-stats-accent: var(--vscode-charts-blue, oklch(50% 0.14 250));");
  });

  it("keeps the refresh button at the toolbar's 28px metric on button tokens", () => {
    expect(body).toContain("height: 28px;");
    expect(body).toContain("var(--vscode-button-secondaryBackground");
    expect(body).toContain("border-radius: 4px;");
  });
});
