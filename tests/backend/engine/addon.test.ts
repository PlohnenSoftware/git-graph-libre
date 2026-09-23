import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXPECTED_ENGINE_VERSION,
  isMuslRuntime,
  loadEngineAddon,
  platformDirectoriesFor,
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

  const triples: [string, string, boolean, string[]][] = [
    ["win32", "x64", false, ["win32-x64-msvc"]],
    ["win32", "arm64", false, ["win32-arm64-msvc"]],
    ["darwin", "x64", false, ["darwin-x64"]],
    ["darwin", "arm64", false, ["darwin-arm64"]],
    ["linux", "x64", false, ["linux-x64-gnu", "linux-x64-musl"]],
    ["linux", "arm64", false, ["linux-arm64-gnu", "linux-arm64-musl"]],
    // Alpine: `process.platform` is still `linux`, so only the detected C
    // library separates these from the two rows above.
    ["linux", "x64", true, ["linux-x64-musl", "linux-x64-gnu"]],
    ["linux", "arm64", true, ["linux-arm64-musl", "linux-arm64-gnu"]],
    // 32-bit ARM is the one VS Code desktop target this project does not
    // build; everything else has no VS Code build at all.
    ["linux", "arm", false, []],
    ["linux", "riscv64", false, []],
    ["freebsd", "x64", false, []]
  ];
  it.each(triples)("maps %s/%s (musl=%s) to %s", (platform, arch, musl, expected) => {
    expect(platformDirectoriesFor(platform, arch, musl)).toEqual(expected);
  });

  it("keeps the other C library as a fallback, so a wrong guess still loads", () => {
    // The detected library is tried first, but both are always offered: a
    // misdetection must cost one failed `require()`, not the whole platform.
    for (const musl of [false, true]) {
      expect(platformDirectoriesFor("linux", "x64", musl)).toHaveLength(2);
      expect(platformDirectoriesFor("linux", "x64", musl)).toEqual(
        expect.arrayContaining(["linux-x64-gnu", "linux-x64-musl"])
      );
    }
  });

  it("reports musl only when the process report carries no glibc version", () => {
    // `glibcVersionRuntime` is present in the report on glibc and absent on
    // musl; this is the check `detect-libc` makes, and the only one available
    // without spawning anything.
    const report = process.report?.getReport() as { header?: Record<string, unknown> };
    const hasGlibc = report?.header?.glibcVersionRuntime !== undefined;
    expect(isMuslRuntime()).toBe(!hasGlibc);
  });

  it("accepts a module with the expected version", () => {
    const loaded = {
      engineVersion: () => EXPECTED_ENGINE_VERSION,
      remoteUrl: async () => null,
      loadRepoInfo: async () => "{}",
      loadCommits: async () => "{}",
      loadCommitDetails: async () => "{}",
      loadLineCounts: async () => "{}",
      loadStashes: async () => "[]",
      loadStashDetails: async () => "{}",
      compareCommits: async () => "[]",
      loadCommitFile: async () => "{}",
      configList: async () => "{}",
      closeRepository: () => {},
      closeAllRepositories: () => {},
      openRepositoryCount: () => 0
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
    [
      "a missing loadCommits export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}"
      }
    ],
    [
      "a missing loadCommitDetails export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}"
      }
    ],
    [
      "a missing loadLineCounts export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}"
      }
    ],
    [
      "a missing loadStashes export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}",
        loadLineCounts: async () => "{}"
      }
    ],
    [
      "a missing loadStashDetails export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}",
        loadLineCounts: async () => "{}",
        loadStashes: async () => "[]"
      }
    ],
    [
      "a missing compareCommits export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}",
        loadLineCounts: async () => "{}",
        loadStashes: async () => "[]",
        loadStashDetails: async () => "{}"
      }
    ],
    [
      "a missing loadCommitFile export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}",
        loadLineCounts: async () => "{}",
        loadStashes: async () => "[]",
        loadStashDetails: async () => "{}",
        compareCommits: async () => "[]"
      }
    ],
    [
      "a missing configList export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}",
        loadLineCounts: async () => "{}",
        loadStashes: async () => "[]",
        loadStashDetails: async () => "{}",
        compareCommits: async () => "[]",
        loadCommitFile: async () => "{}"
      }
    ],
    [
      "a missing closeRepository export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}",
        loadLineCounts: async () => "{}",
        loadStashes: async () => "[]",
        loadStashDetails: async () => "{}",
        compareCommits: async () => "[]",
        loadCommitFile: async () => "{}",
        configList: async () => "{}"
      }
    ],
    [
      "a missing closeAllRepositories export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}",
        loadLineCounts: async () => "{}",
        loadStashes: async () => "[]",
        loadStashDetails: async () => "{}",
        compareCommits: async () => "[]",
        loadCommitFile: async () => "{}",
        configList: async () => "{}",
        closeRepository: () => {}
      }
    ],
    [
      "a missing openRepositoryCount export",
      {
        engineVersion: () => EXPECTED_ENGINE_VERSION,
        remoteUrl: async () => null,
        loadRepoInfo: async () => "{}",
        loadCommits: async () => "{}",
        loadCommitDetails: async () => "{}",
        loadLineCounts: async () => "{}",
        loadStashes: async () => "[]",
        loadStashDetails: async () => "{}",
        compareCommits: async () => "[]",
        loadCommitFile: async () => "{}",
        configList: async () => "{}",
        closeRepository: () => {},
        closeAllRepositories: () => {}
      }
    ],
    ["a missing engineVersion export", { remoteUrl: async () => null }],
    ["a null module", null],
    ["a string module", "git-graph.node"]
  ];
  it.each(refusals)("refuses %s into null", (_name, loaded) => {
    expect(validateLoadedAddon(loaded)).toBeNull();
  });
});
