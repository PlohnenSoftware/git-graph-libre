import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/diff-tab/vscode-diff.css"), "utf8");
const header = css.match(/\/\*[\s\S]*?\*\//)?.[0] ?? "";
const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
const selectors = [...body.matchAll(/([^{}]+)\{[^}]+\}/g)].map((match) => match[1].trim());

const DIFF_CLASSES = [
  "line-insert",
  "line-delete",
  "char-insert",
  "char-delete",
  "gutter-insert",
  "gutter-delete",
  "insert-sign",
  "delete-sign",
  "diagonal-fill",
  "diff-hidden-lines"
] as const;

function listedLiteralColors(): string[] {
  return [...header.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .filter((token) => /^(#[0-9a-fA-F]+|transparent|rgba?\(|hsla?\()/.test(token));
}

describe("vendored diff editor styles", () => {
  it("names the source commit and the MIT license in the header", () => {
    expect(header).toContain("src/vs/editor/browser/widget/diffEditor/style.css");
    expect(header).toContain("1356222d342e6a7b2dd5603107bcdb60a6d0653b");
    expect(header).toContain("Copyright (c) Microsoft Corporation");
    expect(header).toContain("Licensed under the MIT License (see LICENSE.mit)");
    expect(header).toContain("re-rooted under `.ggl-diff`");
    expect(header).toContain("changes are AGPL-3.0-or-later");
  });

  it("styles every diff class under .ggl-diff", () => {
    expect(selectors.length).toBeGreaterThan(0);
    for (const className of DIFF_CLASSES) {
      const token = new RegExp(`\\.${className}(?![\\w-])`);
      expect(
        selectors.some((selector) => selector.includes(".ggl-diff") && token.test(selector)),
        className
      ).toBe(true);
    }
  });

  it("keeps every selector rooted at .ggl-diff, with no editor or icon roots left", () => {
    expect(body).not.toContain(".monaco-");
    expect(body.toLowerCase()).not.toContain("codicon");
    for (const selector of selectors) {
      for (const part of selector.split(",")) {
        expect(part.trim().startsWith(".ggl-diff"), part.trim()).toBe(true);
      }
    }
  });

  it("colors only through VS Code variables, except the literals the header lists", () => {
    const allowed = listedLiteralColors();
    expect(allowed.length).toBeGreaterThan(0);
    for (const match of body.matchAll(/var\((--[\w-]+)/g)) {
      expect(match[1].startsWith("--vscode-"), match[1]).toBe(true);
    }
    const literals = [
      ...body.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
      ...body.matchAll(/\btransparent\b/g),
      ...body.matchAll(/\b(?:rgba?|hsla?|oklch)\(/g)
    ].map((match) => match[0]);
    for (const literal of literals) {
      expect(allowed, literal).toContain(literal);
    }
  });
});
