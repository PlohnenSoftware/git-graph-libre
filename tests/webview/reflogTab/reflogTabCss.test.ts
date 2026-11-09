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
