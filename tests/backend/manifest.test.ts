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
});
