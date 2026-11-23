import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/blame-tab/blame-tab.css"), "utf8");
const body = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("blame tab styles", () => {
  it("colors through theme tokens and OKLCH fallbacks, never raw literals", () => {
    expect(body).toContain("var(--vscode-editor-background");
    expect(body).toContain("var(--vscode-badge-background");
    expect(body).toContain("var(--ngg-");
    expect(body).toContain("oklch(");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(body).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    expect(body.toLowerCase()).not.toMatch(/linear-gradient|radial-gradient|box-shadow: 0 0 \d/);
    // No named color literals either: every color is a token or OKLCH.
    expect(body).not.toMatch(/:\s*(red|blue|green|white|black|gray|grey|orange|yellow)\b/i);
  });

  it("roots every rule at the tab and keeps the header pinned", () => {
    expect(body).toContain(".ggl-blame .blame-hunk");
    expect(body).toContain(".ggl-blame .blame-gutter");
    expect(body).toMatch(/\.blame-header \{\s*position: sticky;\s*top: 0;/);
    expect(body).toContain("overflow-wrap: anywhere");
    expect(body).toContain("@media (forced-colors: active)");
  });

  it("lays out grouped hunks with a resizable gutter and tabular line numbers", () => {
    expect(body).toContain("width: var(--blame-gutter-width, 280px);");
    expect(body).toContain(".ggl-blame .blame-gutter-resize {");
    expect(body).toContain("cursor: col-resize;");
    expect(body).toContain("font-variant-numeric: tabular-nums;");
    expect(body).toContain("text-align: right;");
    expect(body).toContain("font-size: var(--blame-font-size, 14px);");
    expect(body).toContain("line-height: var(--blame-line-height, 21px);");
    expect(body).toContain("white-space: pre;");
  });

  it("marks uncommitted hunks and the target line without new solid colors", () => {
    expect(body).toContain(".ggl-blame .blame-uncommitted { color: var(--ngg-uncommitted);");
    expect(body).toContain(".ggl-blame .blame-target-line {");
    expect(body).toContain("color-mix(in oklab,");
    expect(body).not.toContain("in srgb");
  });

  it("keeps every state word on the description foreground", () => {
    for (const state of [
      ".blame-loading",
      ".blame-empty",
      ".blame-binary",
      ".blame-too-large",
      ".blame-untracked",
      ".blame-unborn",
      ".blame-bare-working-tree"
    ]) {
      expect(body, state).toContain(`.ggl-blame ${state}`);
    }
    expect(body).toContain(".ggl-blame p.blame-message.blame-error");
    expect(body).toContain("var(--vscode-errorForeground");
    expect(body).toContain(".ggl-blame .blame-unsaved-pill");
    expect(body).toContain(".ggl-blame .blame-worktree-badge");
    expect(body).toContain(".ggl-blame .blame-action-btn");
    expect(body).toContain(".ggl-blame .blame-repo-changed");
  });

  it("styles rewind buttons, navigation/option toggles, ignore-revs chips and find highlights", () => {
    expect(body).toContain(".ggl-blame .blame-rewind-btn");
    expect(body).toContain(".ggl-blame .blame-nav-btn");
    expect(body).toContain(".ggl-blame .blame-option-toggle.is-active");
    expect(body).toContain(".ggl-blame .blame-chip.is-active");
    expect(body).toContain(".ggl-blame .blame-find-bar");
    expect(body).toContain(".ggl-blame .blame-line.is-find-match");
    expect(body).toContain(".ggl-blame .blame-line.is-find-active");
    expect(body).toContain(".ggl-blame .blame-rename-notice");
  });
});
