import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/main.css"), "utf8");

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
});
