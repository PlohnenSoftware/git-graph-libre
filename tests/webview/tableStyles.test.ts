import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/main.css"), "utf8");
const dropdownCss = readFileSync(join(process.cwd(), "media/dropdown.css"), "utf8");
const webviewCss = `${css}\n${dropdownCss}`;

describe("commit table styles", () => {
  it("keeps a stable vertical scrollbar for loading and short graphs", () => {
    expect(css.match(/^html \{[^}]+\}/m)?.[0] ?? "").toContain("overflow-y: scroll;");
    expect(css.match(/^body \{[^}]+\}/m)?.[0] ?? "").toContain("min-height: calc(100vh + 1px);");
  });

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

  it("uses the fixed green HEAD blink color", () => {
    expect(css).toContain("--ngg-success-pulse: oklch(74% 0.12 152 / 0.5);");
    expect(css).toContain("background-color: var(--ngg-success-pulse);");
  });

  it("styles find matches with theme tokens and OKLCH fallbacks", () => {
    expect(css).toContain("--ngg-find-highlight: oklch(");
    expect(css).toContain("--ngg-find-active: oklch(");
    expect(css).toContain("#commitTable tr.commit.findMatch td");
    expect(css).toContain("var(--vscode-editor-findMatchHighlightBackground");
    expect(css).toContain("#commitTable tr.commit.findMatchActive td");
    expect(css).toContain("var(--vscode-editor-findMatchBackground");
    expect(css).toContain(".toolbarFindInput");
    expect(css).toContain(".toolbarIconButton:disabled");
  });

  it("styles commit detail collapse controls with theme tokens", () => {
    expect(css).toContain(".commitDetailsToggle {");
    const commitDetailsToggleCss = css.match(/\.commitDetailsToggle \{[^}]+\}/)?.[0] ?? "";
    expect(commitDetailsToggleCss).toContain("box-sizing: border-box;");
    expect(commitDetailsToggleCss).toContain("margin: 0;");
    expect(commitDetailsToggleCss).toContain("padding: 0;");
    expect(css).toContain("#commitDetails.summaryCollapsed.filesCollapsed");
    expect(css).toContain("var(--vscode-toolbar-hoverBackground");
    expect(css).toContain(".commitDetailsPaneBody.hidden");
    expect(css).toContain("#commitDetailsFilesBody > ul.gitFileList");
    expect(css.match(/^#commitDetailsSummary \{[^}]+\}/m)?.[0] ?? "").toContain("padding: 0;");
    expect(css.match(/^#commitDetailsFiles \{[^}]+\}/m)?.[0] ?? "").toContain("padding: 0;");
    expect(css).toContain("#commitDetailsResizeHandle");
    expect(css).toContain("body.commitDetailsResizing");
    expect(css).toContain("cursor: ns-resize;");
    expect(css).not.toContain("#commitDetailsClose");
  });

  it("uses OKLCH for owned CSS fallback colors", () => {
    expect(webviewCss).toContain("oklch(");
    expect(webviewCss).not.toMatch(/rgba?\(/);
    expect(webviewCss).not.toMatch(/hsla?\(/);
    expect(webviewCss).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(webviewCss).not.toMatch(/(?<!-)\btransparent\b/);
  });
});
