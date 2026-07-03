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

  it("keeps table headers sticky below the floating top bar", () => {
    const th = css.match(/^#commitTable th \{[^}]+\}/m)?.[0] ?? "";
    expect(th).toContain("position: sticky;");
    expect(th).toContain("top: var(--ngg-sticky-top, 0px);");
    expect(th).toContain("var(--vscode-editor-background)");
    expect(th).toContain("var(--vscode-panel-border");
  });

  it("floats the top bar and collapses the ready status strip while scrolled", () => {
    const topBar = css.match(/^#topBar \{[^}]+\}/m)?.[0] ?? "";
    expect(topBar).toContain("position: sticky;");
    expect(topBar).toContain("top: 0;");
    expect(topBar).toContain("var(--vscode-editor-background)");

    const collapsed =
      css.match(/^#topBar\.scrolled \.statusStrip\[data-state="ready"\] \{[^}]+\}/m)?.[0] ?? "";
    expect(collapsed).toContain("height: 0;");
    expect(collapsed).toContain("opacity: 0;");
    // The sticky header offset snaps with the top bar height, so the strip
    // must not animate its height out of sync.
    expect(css.match(/^\.statusStrip \{[^}]+\}/m)?.[0] ?? "").not.toContain("transition");
    expect(css).not.toContain("#scrollShadow");
  });

  it("lets the toolbar wrap and shrink for narrow views", () => {
    const controls = css.match(/^#controls \{[^}]+\}/m)?.[0] ?? "";
    expect(controls).toContain("display: flex;");
    expect(controls).toContain("flex-wrap: wrap;");

    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain(".toolbarGroup .dropdown {");
    expect(css).toContain("#branchControl .dropdown");
    expect(css).toContain("flex-basis: 200px;");
    expect(css).toContain("#authorControl .dropdown");
    expect(css).toContain("flex-basis: 160px;");
    expect(css).toContain("#tagControl .dropdown");
    expect(css).toContain("flex-basis: 140px;");
    const currentValue = dropdownCss.match(/^\.dropdownCurrentValue \{[^}]+\}/m)?.[0] ?? "";
    expect(currentValue).toContain("max-width: 100%;");
    expect(currentValue).toContain("text-overflow: ellipsis;");
  });

  it("keeps the find widget on its own toolbar row", () => {
    const find = css.match(/^\.toolbarFind \{[^}]+\}/m)?.[0] ?? "";

    expect(find).toContain("order: 10;");
    expect(find).toContain("flex: 0 0 100%;");
    expect(find).toContain("max-width: 100%;");
    expect(find).toContain("justify-content: flex-end;");
  });

  it("keeps revealed commit rows clear of the sticky overlay", () => {
    expect(css).toContain("scroll-margin-top: calc(var(--ngg-sticky-top, 0px) + 40px);");
  });

  it("uses VS Code theme tokens for interactive row states", () => {
    expect(css).toContain("var(--vscode-list-hoverBackground");
    expect(css).toContain("var(--vscode-focusBorder)");
    expect(css).toContain("var(--vscode-list-activeSelectionBackground");
  });

  it("mutes merge commit rows with the description foreground", () => {
    const muted = css.match(
      /#commitTable tr\.commit\.mergeCommit td:nth-child\(2\),\s*#commitTable tr\.commit\.mutedCommit td:nth-child\(2\) \{[^}]+\}/
    )?.[0];

    expect(muted).toBeDefined();
    expect(muted).toContain("var(--vscode-descriptionForeground");
  });

  it("keeps the graph visible above full-row states", () => {
    expect(css).toContain("z-index: 5;");
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain("#commitTable tr.commit:hover td");
    expect(css).toContain("#commitTable tr.commit.commitDetailsOpen td");
    expect(css).toContain("#commitTable tr.commit.commitSelected td");
    expect(css).toContain("#commitTable tr.commit.blinking td");
  });

  it("uses the configurable persistent reveal highlight color", () => {
    expect(css).toContain("--ngg-reveal-highlight: oklch(90% 0.25 150 / 0.42);");
    expect(css).toContain("animation: headPulse 1100ms ease-in-out infinite;");
    expect(css).toContain("var(--ngg-reveal-highlight) 20%");
    expect(css).toContain("background-color: var(--ngg-reveal-highlight);");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("styles find matches with shared OKLCH highlights", () => {
    expect(css).toContain("--ngg-find-highlight: oklch(80% 0.2 150 / 0.28);");
    expect(css).toContain("--ngg-find-active: oklch(90% 0.25 150 / 0.42);");
    expect(css).toContain("#commitTable tr.commit.findMatch td");
    expect(css).toContain("background-color: var(--ngg-find-highlight);");
    expect(css).toContain("#commitTable tr.commit.findMatchActive td");
    expect(css).toContain("background-color: var(--ngg-find-active);");
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
