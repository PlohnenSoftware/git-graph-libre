import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  activationEvents: string[];
  contributes: {
    commands: Array<{ command: string }>;
    configuration: {
      properties: Record<
        string,
        {
          type: string;
          default: unknown;
          enum?: string[];
          enumDescriptions?: string[];
          pattern?: string;
          items?: { pattern?: string; properties?: Record<string, { type: string }> };
          minimum?: number;
          maximum?: number;
          description: string;
        }
      >;
    };
  };
};

function readManifest(): PackageManifest {
  const manifestPath = path.resolve(__dirname, "../../package.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PackageManifest;
}

describe("extension manifest", () => {
  it("uses scoped activation events instead of startup activation", () => {
    const manifest = readManifest();
    const commands = manifest.contributes.commands.map((command) => command.command);

    expect(manifest.activationEvents).not.toContain("onStartupFinished");
    expect(manifest.activationEvents).toContain("workspaceContains:.git");
    expect(manifest.activationEvents).toContain("workspaceContains:**/.git");
    expect(manifest.activationEvents).toEqual(
      expect.arrayContaining(commands.map((command) => `onCommand:${command}`))
    );
  });

  it("contributes bounded graph density settings", () => {
    const manifest = readManifest();
    const properties = manifest.contributes.configuration.properties;

    expect(properties["git-graph-libre.graph.fontSize"]).toMatchObject({
      type: "number",
      default: 13,
      minimum: 8,
      maximum: 24,
      description: "%config.graph.fontSize%"
    });
    expect(properties["git-graph-libre.graph.rowHeight"]).toMatchObject({
      type: "number",
      default: 24,
      minimum: 18,
      maximum: 48,
      description: "%config.graph.rowHeight%"
    });
    expect(properties["git-graph-libre.shortHashLength"]).toMatchObject({
      type: "number",
      default: 8,
      minimum: 4,
      maximum: 64,
      description: "%config.shortHashLength%"
    });
  });

  it("contributes commit details file view settings", () => {
    const manifest = readManifest();
    const properties = manifest.contributes.configuration.properties;

    expect(properties["git-graph-libre.commitDetails.fileViewMode"]).toMatchObject({
      type: "string",
      enum: ["tree", "list"],
      enumDescriptions: [
        "%config.commitDetails.fileViewMode.tree%",
        "%config.commitDetails.fileViewMode.list%"
      ],
      default: "tree",
      description: "%config.commitDetails.fileViewMode%"
    });
    expect(properties["git-graph-libre.commitDetails.compactFolders"]).toMatchObject({
      type: "boolean",
      default: false,
      description: "%config.commitDetails.compactFolders%"
    });
  });

  it("contributes custom branch glob preset settings", () => {
    const manifest = readManifest();
    const setting =
      manifest.contributes.configuration.properties["git-graph-libre.customBranchGlobPatterns"];

    expect(setting).toMatchObject({
      type: "array",
      default: [],
      description: "%config.customBranchGlobPatterns%"
    });
    expect(setting.items?.properties).toMatchObject({
      name: { type: "string" },
      glob: { type: "string" }
    });
  });

  it("contributes an OKLCH graph color palette accepted by its own pattern", () => {
    const manifest = readManifest();
    const colors = manifest.contributes.configuration.properties["git-graph-libre.graphColors"];
    const defaults = colors.default as string[];
    const itemPattern = colors.items?.pattern;

    expect(itemPattern).toBeDefined();
    if (itemPattern === undefined) return;
    const pattern = new RegExp(itemPattern);

    expect(defaults).toHaveLength(12);
    for (const value of defaults) {
      expect(value).toMatch(/^oklch\(/);
      expect(value).toMatch(pattern);
    }
    expect("#0085d9").toMatch(pattern);
    expect("rgb(0, 133, 217)").toMatch(pattern);
    expect("blue").not.toMatch(pattern);
  });

  it("contributes the reveal highlight color setting with the required default", () => {
    const manifest = readManifest();
    const setting =
      manifest.contributes.configuration.properties["git-graph-libre.revealHighlightColor"];

    expect(setting).toMatchObject({
      type: "string",
      default: "oklch(87.44% 0.2383 150 / 0.5)",
      description: "%config.revealHighlightColor%"
    });
    expect(setting.pattern).toBeDefined();
    if (setting.pattern === undefined) return;
    const pattern = new RegExp(setting.pattern);
    expect(setting.default).toMatch(pattern);
    expect("#0085d9").toMatch(pattern);
    expect("rgb(0, 133, 217)").toMatch(pattern);
    expect("blue").not.toMatch(pattern);
  });
});
