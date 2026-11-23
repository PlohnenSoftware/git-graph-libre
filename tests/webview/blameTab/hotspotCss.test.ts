import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/blame-tab/blame-tab.css"), "utf8");
const tokens = readFileSync(join(process.cwd(), "media/tokens.css"), "utf8");
const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
const STEPS = Array.from({ length: 10 }, (_, step) => step);

/** The `--ngg-blame-heat-N` declarations inside one block of tokens.css. */
function heatDeclarations(block: string): Map<number, string> {
  const found = new Map<number, string>();
  for (const match of block.matchAll(/--ngg-blame-heat-(\d):\s*([^;]+);/g)) {
    found.set(Number(match[1]), match[2].trim());
  }
  return found;
}

/** The text of the rule (or `@media` block) that opens with `head`. */
function blockAfter(source: string, head: string): string {
  const start = source.indexOf(head);
  if (start < 0) return "";
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return "";
}

describe("blame heat tokens", () => {
  const rootBlock = blockAfter(tokens, ":root {");
  const lightBlock = blockAfter(tokens, "body.vscode-light {");

  it("defines all ten steps in the dark defaults and in the light overrides", () => {
    expect([...heatDeclarations(rootBlock).keys()].sort()).toEqual(STEPS);
    expect([...heatDeclarations(lightBlock).keys()].sort()).toEqual(STEPS);
  });

  it("writes every step in OKLCH, never hex, RGB, HSL or a named color", () => {
    for (const block of [rootBlock, lightBlock]) {
      for (const value of heatDeclarations(block).values()) {
        expect(value).toMatch(/^oklch\(\d+(\.\d+)?% [\d.]+ \d+(\.\d+)?\)$/);
      }
    }
  });

  it("walks the ramp from cool and dim to warm and bright in the dark defaults", () => {
    const dark = heatDeclarations(rootBlock);
    const lightness = STEPS.map((step) => Number(/oklch\((\d+)%/.exec(dark.get(step) ?? "")?.[1]));
    // Lightness only rises from the coldest step to the hottest.
    for (let step = 1; step < 10; step += 1) {
      expect(lightness[step], `step ${step}`).toBeGreaterThanOrEqual(lightness[step - 1]);
    }
    // The hottest step stays out of error red (hue 25) and is amber, not red.
    expect(dark.get(9)).toContain(" 55)");
  });

  it("keeps the blame gutter tints on color-mix in oklab, never srgb", () => {
    expect(body).toContain("color-mix(in oklab, var(--blame-heat, var(--ngg-transparent)) 14%");
    expect(css).not.toMatch(/in srgb|in hsl|in oklch/);
  });
});

describe("blame heat rules in the stylesheet", () => {
  it("colors each hunk's rail and gutter wash from its data-heat hook", () => {
    for (const step of STEPS) {
      expect(body).toContain(
        `.ggl-blame .blame-hunk[data-heat="${step}"] { --blame-heat: var(--ngg-blame-heat-${step}); }`
      );
      expect(body).toContain(
        `.blame-heat-swatch-${step} { background: var(--ngg-blame-heat-${step}); }`
      );
    }
    expect(body).toContain(
      '.ggl-blame .blame-hunk[data-heat="uncommitted"] { --blame-heat: var(--ngg-uncommitted); }'
    );
    expect(body).toContain("width: 4px;");
    expect(body).toContain("background: var(--blame-heat, var(--ngg-neutral-border-medium));");
  });

  it("marks the same-commit hunks through is-same-commit, with no motion of its own", () => {
    expect(body).toContain(".ggl-blame .blame-hunk.is-same-commit::after { opacity: 1; }");
    expect(body).toMatch(/\.blame-hunk::after \{[\s\S]*?transition: opacity 120ms ease-out;/);
  });

  it("replaces color-only cues with system colors under forced colors", () => {
    // The heat rules add a second forced-colors block after the original one.
    const heatForced = blockAfter(
      css.slice(css.lastIndexOf("@media (forced-colors: active)")),
      "@media (forced-colors: active)"
    );
    expect(heatForced).toContain("background: CanvasText;");
    expect(heatForced).toContain("outline: 2px solid Highlight;");
    expect(heatForced).toContain("border: 1px solid CanvasText;");
  });

  it("turns the hover transition off under reduced motion", () => {
    const reduced = blockAfter(css, "@media (prefers-reduced-motion: reduce)");
    expect(reduced).toContain(".ggl-blame .blame-hunk::after { transition: none; }");
  });

  it("holds zero raw hex, RGB, HSL or named color literals in the new rules", () => {
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(body).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    expect(body).not.toMatch(/:\s*(red|blue|green|white|black|gray|grey|orange|yellow)\b/i);
  });
});
