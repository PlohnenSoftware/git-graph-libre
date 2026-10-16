import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifyLoadedAddon,
  EXPECTED_ENGINE_VERSION,
  engineLoadStatus,
  isMuslRuntime,
  loadEngineAddon,
  platformDirectoriesFor,
  resolveEngineLoad,
  validateLoadedAddon
} from "@/backend/engine/addon";

/** A module carrying every export the loader requires, at the expected version. */
function completeAddon() {
  return {
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
    authors: async () => "[]",
    loadConfig: async () => "{}",
    searchCommits: async () => "[]",
    loadRefs: async () => "{}",
    closeRepository: () => {},
    closeAllRepositories: () => {},
    openRepositoryCount: () => 0
  };
}

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
    const loaded = completeAddon();
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

describe("engine load status", () => {
  const GNU = "linux-x64-gnu";
  const MUSL = "linux-x64-musl";
  const candidates = (directory: string) => [`/a/${directory}.node`, `/b/${directory}.node`];

  function notFound(): never {
    throw Object.assign(new Error("Cannot find module"), { code: "MODULE_NOT_FOUND" });
  }

  it("reports a platform with no build target by its raw platform pair", () => {
    const load = resolveEngineLoad([], candidates, notFound, "linux-arm");
    expect(load.addon).toBeNull();
    expect(load.status).toEqual({
      state: "unavailable",
      reason: "unsupportedPlatform",
      platform: "linux-arm",
      detail: null
    });
  });

  it("reports a missing binary against the directory tried first", () => {
    const load = resolveEngineLoad([GNU, MUSL], candidates, notFound, "linux-x64");
    expect(load.status).toEqual({
      state: "unavailable",
      reason: "missing",
      platform: GNU,
      detail: null
    });
  });

  it("names a binary the OS refused over the fallback that does not exist", () => {
    // The Alpine shape in reverse: the glibc binary is there and cannot load,
    // the musl one is absent. The refusal is what the user needs to read.
    const load = resolveEngineLoad(
      [GNU, MUSL],
      candidates,
      (file) => {
        if (file === `/a/${GNU}.node`) {
          throw Object.assign(new Error("libc.so.6: cannot open shared object file\nat dlopen"), {
            code: "ERR_DLOPEN_FAILED"
          });
        }
        return notFound();
      },
      "linux-x64"
    );
    expect(load.status).toEqual({
      state: "unavailable",
      reason: "loadFailed",
      platform: GNU,
      detail: "libc.so.6: cannot open shared object file"
    });
  });

  it("names a binary from a different build, with both versions", () => {
    const stale = { ...completeAddon(), engineVersion: () => "1.0.0" };
    const load = resolveEngineLoad([GNU], candidates, () => stale, "linux-x64");
    expect(load.status).toEqual({
      state: "unavailable",
      reason: "versionMismatch",
      platform: GNU,
      detail: `found 1.0.0, expected ${EXPECTED_ENGINE_VERSION}`
    });
  });

  it("names a binary missing a function the extension calls", () => {
    const { searchCommits: _dropped, ...partial } = completeAddon();
    const load = resolveEngineLoad([GNU], candidates, () => partial, "linux-x64");
    expect(load.status).toMatchObject({ state: "unavailable", reason: "incompatible" });
  });

  it("loads from the fallback directory and reports the target that loaded", () => {
    const addon = completeAddon();
    const load = resolveEngineLoad(
      [GNU, MUSL],
      candidates,
      (file) => (file === `/b/${MUSL}.node` ? addon : notFound()),
      "linux-x64"
    );
    expect(load.addon).toBe(addon);
    expect(load.status).toEqual({
      state: "active",
      version: EXPECTED_ENGINE_VERSION,
      platform: MUSL
    });
  });

  it("classifies a version that cannot be read as a mismatch", () => {
    const unreadable = {
      ...completeAddon(),
      engineVersion: () => {
        throw new Error("boom");
      }
    };
    expect(classifyLoadedAddon(unreadable)).toEqual({
      reason: "versionMismatch",
      detail: `found no version, expected ${EXPECTED_ENGINE_VERSION}`
    });
  });

  it("describes the session's real load the same way the loader decided it", () => {
    const status = engineLoadStatus();
    if (loadEngineAddon() === null) {
      expect(status.state).toBe("unavailable");
      return;
    }
    expect(status).toMatchObject({ state: "active", version: EXPECTED_ENGINE_VERSION });
  });
});
