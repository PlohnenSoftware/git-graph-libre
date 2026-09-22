/**
 * The seam to the Rust engine addon (Phase 16, slice 16.3).
 *
 * This is the ONLY module that knows the engine is a `.node` binary: it owns
 * the host-platform path resolution, the `require()` call, and the version
 * check. Everything above it talks to `EngineAddon` through
 * `src/backend/engine/index.ts` and never learns the file exists.
 */

import { createRequire } from "node:module";
import * as path from "node:path";

/**
 * The engine version the TypeScript side was built against. Mirrors
 * `[workspace.package] version` in `engine/Cargo.toml`; a test pins the two
 * together, so bumping the workspace version without updating this constant
 * fails the suite instead of shipping a skewed pair.
 */
export const EXPECTED_ENGINE_VERSION = "1.0.24";

/**
 * The napi surface slice 16.3 uses. Extended read by read in later slices —
 * never the engine's own wire shapes (see the Phase 16 design rules).
 */
export type EngineAddon = {
  /** The engine's own version (`CARGO_PKG_VERSION`), for skew detection. */
  engineVersion(): string;
  /** The fetch URL of a remote, or null when it is not configured. */
  remote_url(repoPath: string, remote: string): Promise<string | null>;
};

/**
 * The `engine/native` directory holding this platform's binary, or null when
 * the host has no prebuilt target (musl/Alpine above all — those installs
 * fall back to the CLI by construction).
 */
function platformDirectory(): string | null {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "win32" && arch === "x64") return "win32-x64-msvc";
  if (platform === "win32" && arch === "arm64") return "win32-arm64-msvc";
  if (platform === "linux" && arch === "x64") return "linux-x64-gnu";
  if (platform === "linux" && arch === "arm64") return "linux-arm64-gnu";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  return null;
}

/**
 * Candidate repository roots, first hit wins. `__dirname` is `out/` in the
 * packaged extension and `src/backend/engine/` under vitest — the same
 * dual-anchor pattern the backend manifest tests rely on. A packaged VSIX
 * carries no `engine/` directory, so both anchors miss there and the load
 * below falls through to null (and the CLI).
 */
function candidateAddonFiles(directory: string): string[] {
  return [
    path.join(__dirname, "..", "engine", "native", directory, "git-graph.node"),
    path.join(__dirname, "..", "..", "..", "engine", "native", directory, "git-graph.node")
  ];
}

let cachedAddon: EngineAddon | null | undefined;

/**
 * Load the engine addon for the host platform, or null when there is nothing
 * to load or what is there cannot be trusted: no prebuilt target, no file on
 * disk, a `require()` failure, a missing `engineVersion`, or a version from
 * a different build than this TypeScript. Every one of those lands the caller
 * on exactly the CLI behavior.
 */
export function loadEngineAddon(): EngineAddon | null {
  if (cachedAddon !== undefined) return cachedAddon;
  cachedAddon = tryLoadEngineAddon();
  return cachedAddon;
}

function tryLoadEngineAddon(): EngineAddon | null {
  try {
    const directory = platformDirectory();
    if (directory === null) return null;
    // Absolute paths: esbuild leaves this require alone at bundle time, so
    // the `.node` binary is loaded from beside the bundle, never packed into
    // it. The require base is the candidate file itself — absolute requires
    // ignore the base, and `createRequire` never validates it, so this adds
    // no filesystem assumption beyond the candidates.
    for (const addonFile of candidateAddonFiles(directory)) {
      let loaded: unknown;
      try {
        loaded = createRequire(addonFile)(addonFile) as unknown;
      } catch {
        continue;
      }
      if (!isEngineAddon(loaded)) continue;
      // A `.node` from a different build than this TypeScript is refused
      // into the CLI path rather than trusted: its shapes may have moved.
      if (safeEngineVersion(loaded) !== EXPECTED_ENGINE_VERSION) continue;
      return loaded;
    }
    return null;
  } catch {
    return null;
  }
}

function isEngineAddon(loaded: unknown): loaded is EngineAddon {
  if (typeof loaded !== "object" || loaded === null) return false;
  return typeof (loaded as { engineVersion?: unknown }).engineVersion === "function";
}

function safeEngineVersion(loaded: EngineAddon): string | null {
  try {
    const version = loaded.engineVersion();
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}
