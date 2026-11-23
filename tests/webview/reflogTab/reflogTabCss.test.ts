import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/reflog-tab/reflog-tab.css"), "utf8");
const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = readFileSync(join(process.cwd(), "media/tokens.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

/** The `--ngg-*` definitions inside one `{ ... }` block of tokens.css. */
function definitionsIn(block: string | undefined): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of (block ?? "").matchAll(/(--ngg-reflog-[a-z-]+):\s*([^;]+);/g)) {
    found.set(match[1], (match[2] ?? "").trim());
  }
  return found;
}

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

  it("styles a colored marker for every action kind and a tag per intent (F1-04)", () => {
    expect(body).toContain(".ggl-reflog .reflog-kind-dot");
    expect(body).toContain(".ggl-reflog .reflog-sub-tag");
    for (const kind of [
      "commit",
      "checkout",
      "reset",
      "rebase",
      "merge",
      "pull",
      "fetch",
      "cherry-pick",
      "revert",
      "branch",
      "stash",
      "clone",
      "other"
    ]) {
      expect(body, kind).toContain(
        `.reflog-kind-${kind} { --reflog-kind-color: var(--ngg-reflog-kind-${kind}); }`
      );
    }
    for (const intent of ["rewrite", "combine", "advance", "abort", "ref", "neutral"]) {
      expect(body, intent).toContain(
        `.reflog-sub-intent-${intent} { --reflog-intent-color: var(--ngg-reflog-intent-${intent}); }`
      );
    }
    // Tints mix in oklab toward the transparent token, never srgb.
    expect(body).toContain("color-mix(in oklab,");
    expect(body).not.toContain("in srgb");
    // Forced colors keep the new marks visible as outlines.
    expect(body).toContain(".ggl-reflog .reflog-sub-tag { border: 1px solid currentColor; }");
    expect(body).toContain(".ggl-reflog .reflog-kind-dot { border: 1px solid currentColor; }");
  });

  it("styles the filter row on input and dropdown tokens at the toolbar metric (F1-05)", () => {
    expect(body).toContain(".ggl-reflog .reflog-controls {");
    expect(body).toContain("height: 28px;");
    expect(body).toContain("var(--vscode-input-background");
    expect(body).toContain("var(--vscode-dropdown-background");
    expect(body).toContain("var(--vscode-input-placeholderForeground");
    expect(body).toContain(".ggl-reflog .reflog-cap-note {");
    // The toggle's box is the shared neutral checkbox: checkbox tokens,
    // a percentage clip-path tick, and no accent button fill behind it.
    const checkbox = /\.reflog-only-checkbox \{([^}]*)\}/.exec(body)?.[1] ?? "";
    expect(checkbox).toContain("var(--vscode-checkbox-background");
    expect(checkbox).toContain("var(--vscode-checkbox-border");
    expect(checkbox).not.toContain("--vscode-button-");
    expect(body).toContain(".reflog-only-checkbox:checked::after");
    expect(body).toContain("clip-path: polygon(41% 79%");
    expect(body).toContain(".ggl-reflog .reflog-only-checkbox { border-color: ButtonText;");
  });

  it("carries the graph table's resize handles and fixed layout (F1-04F)", () => {
    expect(body).toContain(".ggl-reflog .reflog-table.fixedLayout { table-layout: fixed; }");
    expect(body).toContain(".ggl-reflog .resizeCol {");
    expect(body).toContain("width: 6px;");
    expect(body).toContain("cursor: col-resize;");
    expect(body).toContain(".ggl-reflog .resizeCol.left {");
    expect(body).toContain("border-left: 1px solid var(--ngg-neutral-border-medium);");
    expect(body).toContain(".ggl-reflog .resizeCol.right { right: 0px; }");
    expect(body).toContain(".ggl-reflog .reflog-head-row.resizing .reflog-head-cell {");
  });

  it("styles the opt-in lost-commit panel on theme tokens with reduced-motion and forced-colors rules (F1-07)", () => {
    expect(body).toContain(".ggl-reflog .reflog-scan-button {");
    expect(body).toContain(".ggl-reflog .reflog-lost-panel {");
    expect(body).toContain(".ggl-reflog .reflog-lost-gc-note {");
    expect(body).toContain("var(--vscode-editorWidget-background");
    expect(body).toContain("var(--vscode-button-secondaryBackground");
    expect(body).toContain("var(--vscode-editorWarning-foreground");
    expect(body).toContain("@media (prefers-reduced-motion: reduce)");
    expect(body).toContain(".ggl-reflog .reflog-lost-spinner { animation: none; }");
    expect(body).toContain(".ggl-reflog .reflog-lost-action-btn { border: 1px solid ButtonText; }");
  });

  it("defines every reflog color token for both themes, OKLCH only (F1-04)", () => {
    expect(tokens).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(tokens).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    const rootBlock = /:root \{([\s\S]*?)\n\}/.exec(tokens)?.[1];
    const lightBlock = /body\.vscode-light \{([\s\S]*?)\n\}/.exec(tokens)?.[1];
    const root = definitionsIn(rootBlock);
    const light = definitionsIn(lightBlock);
    // 13 kind tokens and 6 intent tokens.
    expect(root.size).toBe(19);
    const referenced = new Set(
      [...body.matchAll(/var\((--ngg-reflog-[a-z-]+)\)/g)].map((m) => m[1])
    );
    expect(referenced.size).toBe(19);
    for (const token of referenced) {
      expect(root.has(token), token).toBe(true);
    }
    for (const [token, value] of root) {
      // Theme tokens come first where the value draws on one, and any
      // literal fallback is OKLCH.
      if (value.includes("var(--vscode-")) {
        expect(value.startsWith("var(--vscode-"), token).toBe(true);
      }
      // A token whose value carries an OKLCH literal also has a
      // light-theme definition; a pure alias of another token needs
      // none (its target adapts instead).
      if (value.includes("oklch(")) {
        expect(light.has(token), token).toBe(true);
        expect(light.get(token), token).toContain("oklch(");
      }
    }
  });
});
