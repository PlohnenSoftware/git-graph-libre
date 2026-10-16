import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifyLoadedAddon,
  EXPECTED_ENGINE_VERSION,
  engineLoadStatus,
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

  const pairs: [string, string, string[]][] = [
    ["win32", "x64", ["win32-x64-msvc"]],
    ["win32", "arm64", ["win32-arm64-msvc"]],
    ["darwin", "x64", ["darwin-x64"]],
    ["darwin", "arm64", ["darwin-arm64"]],
    // One directory per Linux architecture, glibc and musl (Alpine) alike:
    // the build makes the glibc binary loadable by musl too.
    ["linux", "x64", ["linux-x64"]],
    ["linux", "arm64", ["linux-arm64"]],
    // 32-bit ARM is the one VS Code desktop target this project does not
    // build; everything else has no VS Code build at all.
    ["linux", "arm", []],
    ["linux", "riscv64", []],
    ["freebsd", "x64", []]
  ];
  it.each(pairs)("maps %s/%s to %s", (platform, arch, expected) => {
    expect(platformDirectoriesFor(platform, arch)).toEqual(expected);
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
  const LINUX = "linux-x64";
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
    const load = resolveEngineLoad([LINUX], candidates, notFound, "linux-x64");
    expect(load.status).toEqual({
      state: "unavailable",
      reason: "missing",
      platform: LINUX,
      detail: null
    });
  });

  it("names a binary the OS refused over a location that has none", () => {
    // The packaged location's binary is there and cannot load; the other
    // location has no file. The refusal is what the user needs to read.
    const load = resolveEngineLoad(
      [LINUX],
      candidates,
      (file) => {
        if (file === `/a/${LINUX}.node`) {
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
      platform: LINUX,
      detail: "libc.so.6: cannot open shared object file"
    });
  });

  it("names a binary from a different build, with both versions", () => {
    const stale = { ...completeAddon(), engineVersion: () => "1.0.0" };
    const load = resolveEngineLoad([LINUX], candidates, () => stale, "linux-x64");
    expect(load.status).toEqual({
      state: "unavailable",
      reason: "versionMismatch",
      platform: LINUX,
      detail: `found 1.0.0, expected ${EXPECTED_ENGINE_VERSION}`
    });
  });

  it("names a binary missing a function the extension calls", () => {
    const { searchCommits: _dropped, ...partial } = completeAddon();
    const load = resolveEngineLoad([LINUX], candidates, () => partial, "linux-x64");
    expect(load.status).toMatchObject({ state: "unavailable", reason: "incompatible" });
  });

  it("loads from the second location and reports the target that loaded", () => {
    const addon = completeAddon();
    const load = resolveEngineLoad(
      [LINUX],
      candidates,
      (file) => (file === `/b/${LINUX}.node` ? addon : notFound()),
      "linux-x64"
    );
    expect(load.addon).toBe(addon);
    expect(load.status).toEqual({
      state: "active",
      version: EXPECTED_ENGINE_VERSION,
      platform: LINUX
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
