import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  activationEvents: string[];
  contributes: {
    commands: Array<{ command: string }>;
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
});
