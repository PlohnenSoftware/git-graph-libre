import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/main.css"), "utf8");
const dropdownCss = readFileSync(join(process.cwd(), "media/dropdown.css"), "utf8");
const webviewCss = `${css}\n${dropdownCss}`;

describe("commit table styles", () => {
  it("keeps table headers sticky and theme-native", () => {
    expect(css).toContain("#commitTable th {");
    expect(css).toContain("position: sticky;");
    expect(css).toContain("top: 0;");
    expect(css).toContain("var(--vscode-editor-background)");
    expect(css).toContain("var(--vscode-panel-border");
  });

  it("uses VS Code theme tokens for interactive row states", () => {
    expect(css).toContain("var(--vscode-list-hoverBackground");
    expect(css).toContain("var(--vscode-focusBorder)");
    expect(css).toContain("var(--vscode-list-activeSelectionBackground");
  });

  it("keeps the graph visible above full-row states", () => {
    expect(css).toContain("z-index: 5;");
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain("#commitTable tr.commit:hover td");
    expect(css).toContain("#commitTable tr.commit.commitDetailsOpen td");
    expect(css).toContain("#commitTable tr.commit.blinking td");
  });

  it("uses the fixed green HEAD blink colour", () => {
    expect(css).toContain("--ngg-success-pulse: oklch(74% 0.12 152 / 0.5);");
    expect(css).not.toContain("--vscode-editor-findMatchHighlightBackground");
  });

  it("styles commit detail collapse controls with theme tokens", () => {
    expect(css).toContain(".commitDetailsToggle {");
    expect(css).toContain("#commitDetails.summaryCollapsed.filesCollapsed");
    expect(css).toContain("var(--vscode-toolbar-hoverBackground");
    expect(css).toContain(".commitDetailsPaneBody.hidden");
  });

  it("uses OKLCH for owned CSS fallback colours", () => {
    expect(webviewCss).toContain("oklch(");
    expect(webviewCss).not.toMatch(/rgba?\(/);
    expect(webviewCss).not.toMatch(/hsla?\(/);
    expect(webviewCss).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(webviewCss).not.toMatch(/(?<!-)\btransparent\b/);
  });
});
