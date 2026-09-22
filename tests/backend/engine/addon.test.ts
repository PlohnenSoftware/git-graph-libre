import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXPECTED_ENGINE_VERSION,
  loadEngineAddon,
  platformDirectoryFor,
  validateLoadedAddon
} from "@/backend/engine/addon";

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

  const triples: [string, string, string | null][] = [
    ["win32", "x64", "win32-x64-msvc"],
    ["win32", "arm64", "win32-arm64-msvc"],
    ["linux", "x64", "linux-x64-gnu"],
    ["linux", "arm64", "linux-arm64-gnu"],
    ["darwin", "x64", "darwin-x64"],
    ["darwin", "arm64", "darwin-arm64"],
    ["linux", "riscv64", null],
    ["freebsd", "x64", null]
  ];
  it.each(triples)("maps %s/%s to %s", (platform, arch, expected) => {
    expect(platformDirectoryFor(platform, arch)).toBe(expected);
  });

  it("accepts a module with the expected version", () => {
    const loaded = {
      engineVersion: () => EXPECTED_ENGINE_VERSION,
      remoteUrl: async () => null,
      loadRepoInfo: async () => "{}"
    };
    expect(validateLoadedAddon(loaded)).toBe(loaded);
  });

  const refusals: [string, unknown][] = [
    [
      "a binary from a different build",
      { engineVersion: () => "0.0.0", remoteUrl: async () => null }
    ],
    [
      "a version that throws on read",
      {
        engineVersion: () => {
          throw new Error("boom");
        },
        remoteUrl: async () => null
      }
    ],
    ["a non-string version", { engineVersion: () => 42, remoteUrl: async () => null }],
    ["a missing remoteUrl export", { engineVersion: () => EXPECTED_ENGINE_VERSION }],
    [
      "a missing loadRepoInfo export",
      { engineVersion: () => EXPECTED_ENGINE_VERSION, remoteUrl: async () => null }
    ],
    ["a missing engineVersion export", { remoteUrl: async () => null }],
    ["a null module", null],
    ["a string module", "git-graph.node"]
  ];
  it.each(refusals)("refuses %s into null", (_name, loaded) => {
    expect(validateLoadedAddon(loaded)).toBeNull();
  });
});
