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
  /**
   * The fetch URL of a remote, or null when it is not configured.
   *
   * napi exposes Rust `remote_url` under this camelCase name — verified
   * against the built addon, whose exports are `remoteUrl`, `remoteNames`
   * and `engineVersion`. The loader below refuses a binary without it.
   */
  remoteUrl(repoPath: string, remote: string): Promise<string | null>;
  /**
   * `load_repo_info` encoded as JSON (napi exposes Rust `load_repo_info`
   * under this name). Options are the JSON built by `buildRepoInfoOptions`.
   */
  loadRepoInfo(repoPath: string, optionsJson: string): Promise<string>;
  /**
   * `load_commits` encoded as JSON (napi exposes Rust `load_commits` under
   * this name). Options are the JSON built by `buildLoadCommitsOptions`.
   */
  loadCommits(repoPath: string, optionsJson: string): Promise<string>;
  /**
   * `load_commit_details` encoded as JSON: the commit's fields with its file
   * statuses, counts left null for `load_line_counts` to settle.
   */
  loadCommitDetails(repoPath: string, hash: string): Promise<string>;
  /**
   * `load_line_counts` encoded as JSON: the `+N/-M` map for the given paths.
   * `from` is null to diff against the first parent (the empty tree for a
   * root commit).
   */
  loadLineCounts(
    repoPath: string,
    from: string | null,
    to: string,
    pathsJson: string
  ): Promise<string>;
  /** `load_stashes` encoded as JSON: the entries `load_stash_details` needs. */
  loadStashes(repoPath: string): Promise<string>;
  /**
   * `load_stash_details` encoded as JSON: the stash diffed against its base,
   * untracked files appended. `stashJson` is the `stash_json` argument built
   * by `stashEntryPayload`.
   */
  loadStashDetails(repoPath: string, hash: string, stashJson: string): Promise<string>;
  /**
   * `compare_commits` encoded as JSON: the file statuses differing between
   * two revisions. An empty `to` compares against the working tree.
   */
  compareCommits(repoPath: string, from: string, to: string): Promise<string>;
  /**
   * `load_commit_file` encoded as JSON: the file's text at one revision, or
   * a binary marker when it is not text (the caller falls back to the CLI
   * there, keeping the byte-identical binary presentation).
   */
  loadCommitFile(repoPath: string, hash: string, file: string): Promise<string>;
  /**
   * `config_list` encoded as JSON: the entries of one location (local or
   * global), last value per key. A file carrying `include`/`includeIf`
   * directives declines, so the CLI resolves them.
   */
  configList(repoPath: string, local: boolean): Promise<string>;
  /**
   * Drop one repository handle, releasing its object cache and open pack
   * files. Handles reopen lazily on the next read.
   */
  closeRepository(repoPath: string): void;
  /** Drop every repository handle (deactivation). */
  closeAllRepositories(): void;
  /** How many repository handles are currently open (tests, diagnostics). */
  openRepositoryCount(): number;
};

/**
 * The `engine/native` directory holding a platform's binary, or null when
 * the platform has no prebuilt target (musl/Alpine above all — those
 * installs fall back to the CLI by construction).
 *
 * Pure in its arguments so every triple is unit-testable; the loader below
 * calls it with the host's own values.
 */
export function platformDirectoryFor(platform: string, arch: string): string | null {
  if (platform === "win32" && arch === "x64") return "win32-x64-msvc";
  if (platform === "win32" && arch === "arm64") return "win32-arm64-msvc";
  if (platform === "linux" && arch === "x64") return "linux-x64-gnu";
  if (platform === "linux" && arch === "arm64") return "linux-arm64-gnu";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  return null;
}

function platformDirectory(): string | null {
  return platformDirectoryFor(process.platform, process.arch);
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
  const directory = platformDirectory();
  if (directory === null) return null;
  // Absolute paths: esbuild leaves this require alone at bundle time, so
  // the `.node` binary is loaded from beside the bundle, never packed into
  // it. The require base is the candidate file itself — absolute requires
  // ignore the base, and `createRequire` never validates it, so this adds
  // no filesystem assumption beyond the candidates. Every stage guards
  // itself (the require, the shape check, the version read), so there is no
  // outer catch left to cover.
  for (const addonFile of candidateAddonFiles(directory)) {
    let loaded: unknown;
    try {
      loaded = createRequire(addonFile)(addonFile) as unknown;
    } catch {
      continue;
    }
    const validated = validateLoadedAddon(loaded);
    if (validated !== null) return validated;
  }
  return null;
}

/**
 * Accept a loaded module as the engine addon, or refuse it into null.
 * Separated from the loader so the contract is unit-testable without a
 * binary: a missing export or a version from a different build than this
 * TypeScript must both land the caller on the CLI path.
 */
export function validateLoadedAddon(loaded: unknown): EngineAddon | null {
  if (!isEngineAddon(loaded)) return null;
  if (safeEngineVersion(loaded) !== EXPECTED_ENGINE_VERSION) return null;
  return loaded;
}

function isEngineAddon(loaded: unknown): loaded is EngineAddon {
  if (typeof loaded !== "object" || loaded === null) return false;
  const candidate = loaded as {
    engineVersion?: unknown;
    remoteUrl?: unknown;
    loadRepoInfo?: unknown;
    loadCommits?: unknown;
    loadCommitDetails?: unknown;
    loadLineCounts?: unknown;
    loadStashes?: unknown;
    loadStashDetails?: unknown;
    compareCommits?: unknown;
    loadCommitFile?: unknown;
    configList?: unknown;
    closeRepository?: unknown;
    closeAllRepositories?: unknown;
    openRepositoryCount?: unknown;
  };
  return (
    typeof candidate.engineVersion === "function" &&
    typeof candidate.remoteUrl === "function" &&
    typeof candidate.loadRepoInfo === "function" &&
    typeof candidate.loadCommits === "function" &&
    typeof candidate.loadCommitDetails === "function" &&
    typeof candidate.loadLineCounts === "function" &&
    typeof candidate.loadStashes === "function" &&
    typeof candidate.loadStashDetails === "function" &&
    typeof candidate.compareCommits === "function" &&
    typeof candidate.loadCommitFile === "function" &&
    typeof candidate.configList === "function" &&
    typeof candidate.closeRepository === "function" &&
    typeof candidate.closeAllRepositories === "function" &&
    typeof candidate.openRepositoryCount === "function"
  );
}

function safeEngineVersion(loaded: EngineAddon): string | null {
  try {
    const version = loaded.engineVersion();
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}
