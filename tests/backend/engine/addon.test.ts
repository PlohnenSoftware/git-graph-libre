import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { EXPECTED_ENGINE_VERSION, loadEngineAddon } from "@/backend/engine/addon";

function workspaceVersion(): string {
  const manifest = fs.readFileSync(path.resolve(__dirname, "../../../engine/Cargo.toml"), "utf8");
  const section = manifest.split(/^\[workspace\.package\]/m)[1] ?? "";
  const match = /^version\s*=\s*"([^"]+)"/m.exec(section);
  if (match === null) throw new Error("Could not read [workspace.package] version");
  return match[1];
}

describe("engine addon loader", () => {
  it("pins the expected version to the Cargo workspace version", () => {
    // A skewed pair (new TypeScript, old `.node`) must fail here rather than
    // load a binary whose shapes may have moved under the reader.
    expect(EXPECTED_ENGINE_VERSION).toBe(workspaceVersion());
  });

  it("loads the built addon when present", (context) => {
    const addon = loadEngineAddon();
    if (addon === null) {
      context.skip();
      return;
    }
    expect(addon.engineVersion()).toBe(EXPECTED_ENGINE_VERSION);
  });
});
