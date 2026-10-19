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
import { traceBackend } from "@/backend/utils/operationLog";
import type { EngineComponentStatus, EngineUnavailableReason } from "@/types";

/**
 * The engine version the TypeScript side was built against. Mirrors
 * `[workspace.package] version` in `engine/Cargo.toml`; a test pins the two
 * together, so bumping the workspace version without updating this constant
 * fails the suite instead of shipping a skewed pair.
 *
 * Bump it whenever the TypeScript starts relying on engine behavior an older
 * binary would silently lack: `1.0.25` taught `load_commits` the
 * `useAuthorDate` option, which a `1.0.24` binary would ignore and answer
 * with committer dates. `1.0.26` lists type changes as `T` and counts them
 * like Git, which a `1.0.25` binary drops from history payloads entirely.
 */
export const EXPECTED_ENGINE_VERSION = "1.0.26";

/**
 * The napi surface slice 16.3 uses. Extended read by read in later slices —
 * never the engine's own wire shapes (see the Phase 16 design rules).
 */
export type EngineAddon = {
  /** Discovery without keeping a handle open, available since the first engine release. */
  repoRoot?(repoPath: string): Promise<string>;
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
   * `search_commits` encoded as JSON: the Find dialogue's hits, each carrying
   * its position in the graph walk. Options are the JSON built by
   * `buildSearchOptions`. This replaced the engine's own `search_history`,
   * a regex over messages whose semantics did not match this project's.
   */
  searchCommits(repoPath: string, optionsJson: string): Promise<string>;
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
   * `load_index_file` encoded as JSON: the file's staged copy, or a binary
   * marker when it is not text. Optional and deliberately absent from the
   * shape check below, so binaries built before it still load and the
   * callers fall back to `git show :<path>` — no engine version bump.
   */
  loadIndexFile?(repoPath: string, file: string): Promise<string>;
  /**
   * `diff_texts` encoded as JSON: VS Code's `LinesDiff` for two texts,
   * computed by the Phase 17 port, with UTF-16 columns. Options are the
   * JSON built by `diffTexts.ts`. Optional and deliberately absent from the
   * shape check below, like `loadIndexFile`: binaries built before it still
   * load and the seam answers "unavailable" — no engine version bump. A
   * computation VS Code would throw on rejects with an `Unsupported` error.
   */
  diffTexts?(original: string, modified: string, optionsJson: string): Promise<string>;
  /**
   * `diff_file_at_revisions` encoded as JSON: one file diffed between two
   * revisions, both blobs read in process, or the `load_commit_file` binary
   * marker when a side is binary. Optional, for the same reason as
   * `diffTexts` above.
   */
  diffFileAtRevisions?(
    repoPath: string,
    from: string,
    to: string,
    oldPath: string,
    newPath: string,
    optionsJson: string
  ): Promise<string>;
  /**
   * `config_list` encoded as JSON: the entries of one location (local or
   * global), last value per key. A file carrying `include`/`includeIf`
   * directives declines, so the CLI resolves them.
   */
  configList(repoPath: string, local: boolean): Promise<string>;
  /**
   * `authors` encoded as JSON: `{ name, email }` for every author reachable
   * from any ref, which is the coverage `git log --format=%an --all` has.
   */
  authors(repoPath: string): Promise<string>;
  /**
   * `load_config` encoded as JSON: the repository configuration the view
   * shows, including each remote's fetch and push URL.
   */
  loadConfig(repoPath: string): Promise<string>;
  /**
   * `load_refs` encoded as JSON. Only `head` is read here — the commit HEAD
   * resolves to, which `load_repo_info` does not carry (its `head` is the
   * branch name).
   */
  loadRefs(repoPath: string, optionsJson: string): Promise<string>;
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
 * Each platform's binary directory, by `platform:arch`. Linux has one per
 * architecture for both C libraries: the glibc build is made loadable by
 * musl too when it is built (`makeLoadableByMusl` in
 * `engine/scripts/build-addon.mjs`), so Debian and Alpine load the same
 * file and the loader never needs to know which C library it is on.
 */
const PLATFORM_DIRECTORIES: Record<string, string | undefined> = {
  "win32:x64": "win32-x64-msvc",
  "win32:arm64": "win32-arm64-msvc",
  "darwin:x64": "darwin-x64",
  "darwin:arm64": "darwin-arm64",
  "linux:x64": "linux-x64",
  "linux:arm64": "linux-arm64"
};

/** The binary's file name inside every platform directory. */
export const ENGINE_BINARY_NAME = "git-graph.node";

/**
 * Every `engine/native` directory this project ships a binary in. The
 * activation prune deletes by this list and no other name, so nothing else
 * that ever lands under `engine/native` is its business.
 */
export const ENGINE_PLATFORM_DIRECTORIES: readonly string[] = Object.values(
  PLATFORM_DIRECTORIES
).filter((dir) => dir !== undefined);

/**
 * The `engine/native` directory holding this platform's binary, as a list —
 * empty when there is no prebuilt target at all (32-bit ARM — `linux-armhf` —
 * is the only VS Code desktop target this project does not build, and those
 * installs run on the `git` CLI).
 *
 * Pure in its arguments so every combination is unit-testable; the loader
 * below calls it with the host's own values.
 */
export function platformDirectoriesFor(platform: string, arch: string): string[] {
  const directory = PLATFORM_DIRECTORIES[`${platform}:${arch}`];
  return directory === undefined ? [] : [directory];
}

function platformDirectories(): string[] {
  return platformDirectoriesFor(process.platform, process.arch);
}

/**
 * Candidate repository roots, first hit wins. `__dirname` is `out/` in the
 * packaged extension and `src/backend/engine/` under vitest — the same
 * dual-anchor pattern the backend manifest tests rely on. The first anchor is
 * the one that resolves in a packaged VSIX, where `.vscodeignore` whitelists
 * `engine/native/*&#47;*.node` and the binary sits at
 * `extension/engine/native/<platform>/git-graph.node` beside `extension/out/`.
 * The published VSIX carries every platform's binary and this picks the one
 * for the host; a platform with no directory of its own misses both anchors
 * and the load below falls through to null (and the CLI).
 */
function candidateAddonFiles(directory: string): string[] {
  return [
    path.join(__dirname, "..", "engine", "native", directory, ENGINE_BINARY_NAME),
    path.join(__dirname, "..", "..", "..", "engine", "native", directory, ENGINE_BINARY_NAME)
  ];
}

type ActiveStatus = Extract<EngineComponentStatus, { state: "active" }>;
type UnavailableStatus = Extract<EngineComponentStatus, { state: "unavailable" }>;

/** What the one load attempt of the session found: the addon, or why there is none. */
export type EngineLoad =
  | { addon: EngineAddon; status: ActiveStatus }
  | { addon: null; status: UnavailableStatus };

/** One candidate file's outcome: accepted, or refused with a reason. */
export type AddonAttempt =
  | { addon: EngineAddon }
  | { reason: EngineUnavailableReason; detail: string | null };

let cachedLoad: EngineLoad | undefined;

/**
 * Load the engine addon for the host platform, or null when there is nothing
 * to load or what is there cannot be trusted: no prebuilt target, no file on
 * disk, a `require()` failure, a missing `engineVersion`, or a version from
 * a different build than this TypeScript. Every one of those lands the caller
 * on exactly the CLI behavior.
 */
export function loadEngineAddon(): EngineAddon | null {
  const addon = engineLoad().addon;
  return addon ? withEngineLogging(addon) : null;
}

const loggedAddons = new WeakMap<EngineAddon, EngineAddon>();
/** Trace native calls, including the engine fills within an otherwise mixed read. */
export function withEngineLogging(addon: EngineAddon): EngineAddon {
  const existing = loggedAddons.get(addon);
  if (existing) return existing;
  const wrapped = new Proxy(addon, {
    get(target, property) {
      const method: unknown = Reflect.get(target, property);
      if (
        typeof method !== "function" ||
        [
          "engineVersion",
          "closeRepository",
          "closeAllRepositories",
          "openRepositoryCount"
        ].includes(String(property))
      )
        return method;
      return (...args: unknown[]) =>
        traceBackend("engine", String(property), typeof args[0] === "string" ? args[0] : null, () =>
          Promise.resolve(Reflect.apply(method, target, args))
        );
    }
  });
  loggedAddons.set(addon, wrapped);
  loggedAddons.set(wrapped, wrapped);
  return wrapped;
}

/**
 * The same attempt as `loadEngineAddon`, described: the version and build
 * target that loaded, or the reason nothing did. Calling it loads the addon
 * if nothing has yet, so callers honoring the `git-cli` preference must not
 * reach it — that path never loads the engine at all.
 */
export function engineLoadStatus(): EngineLoad["status"] {
  return engineLoad().status;
}

function engineLoad(): EngineLoad {
  cachedLoad ??= tryLoadEngineAddon();
  return cachedLoad;
}

function tryLoadEngineAddon(): EngineLoad {
  const directories = platformDirectories();
  // Absolute paths: esbuild leaves this require alone at bundle time, so
  // the `.node` binary is loaded from beside the bundle, never packed into
  // it. The require base is the candidate file itself — absolute requires
  // ignore the base, and `createRequire` never validates it, so this adds
  // no filesystem assumption beyond the candidates.
  return resolveEngineLoad(
    directories,
    candidateAddonFiles,
    (addonFile) => createRequire(addonFile)(addonFile) as unknown,
    `${process.platform}-${process.arch}`
  );
}

/**
 * How much a refusal says about what went wrong, so the reported reason is
 * the most telling one across every candidate: a binary that loaded but was
 * refused beats one the operating system would not load, which beats no
 * file at all. Every directory has two candidate files (see
 * `candidateAddonFiles`); without the ranking, a binary the OS refused at
 * the packaged location would be reported as missing at the other.
 */
const REASON_RANK: Record<EngineUnavailableReason, number> = {
  unsupportedPlatform: 0,
  missing: 1,
  loadFailed: 2,
  incompatible: 3,
  versionMismatch: 4
};

/**
 * The loader's decision, pure in its arguments so every outcome is
 * unit-testable without a binary. The first accepted candidate wins; with
 * none, the most telling refusal is reported against the directory it came
 * from. Every stage guards itself (the require, the shape check, the version
 * read), so nothing escapes as a throw.
 */
export function resolveEngineLoad(
  directories: readonly string[],
  candidates: (directory: string) => readonly string[],
  requireFile: (file: string) => unknown,
  hostPlatform: string
): EngineLoad {
  if (directories.length === 0) {
    return { addon: null, status: unavailable("unsupportedPlatform", hostPlatform, null) };
  }
  let refusal = unavailable("missing", directories[0], null);
  for (const directory of directories) {
    for (const addonFile of candidates(directory)) {
      const attempt = attemptAddon(addonFile, requireFile);
      if ("addon" in attempt) {
        return {
          addon: attempt.addon,
          status: { state: "active", version: EXPECTED_ENGINE_VERSION, platform: directory }
        };
      }
      if (REASON_RANK[attempt.reason] > REASON_RANK[refusal.reason]) {
        refusal = unavailable(attempt.reason, directory, attempt.detail);
      }
    }
  }
  return { addon: null, status: refusal };
}

function unavailable(
  reason: EngineUnavailableReason,
  platform: string,
  detail: string | null
): UnavailableStatus {
  return { state: "unavailable", reason, platform, detail };
}

function attemptAddon(addonFile: string, requireFile: (file: string) => unknown): AddonAttempt {
  let loaded: unknown;
  try {
    loaded = requireFile(addonFile);
  } catch (error: unknown) {
    // Node's own code for a path with nothing at it; anything else came from
    // a file that exists — a wrong C library, a damaged or foreign binary.
    if ((error as { code?: unknown } | null)?.code === "MODULE_NOT_FOUND") {
      return { reason: "missing", detail: null };
    }
    return { reason: "loadFailed", detail: firstLine(error) };
  }
  return classifyLoadedAddon(loaded);
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n", 1)[0] ?? message;
}

/**
 * Accept a loaded module as the engine addon, or refuse it with the reason.
 * A missing export or a version from a different build than this TypeScript
 * must both land the caller on the CLI path.
 */
export function classifyLoadedAddon(loaded: unknown): AddonAttempt {
  if (!isEngineAddon(loaded)) return { reason: "incompatible", detail: null };
  const version = safeEngineVersion(loaded);
  if (version !== EXPECTED_ENGINE_VERSION) {
    return {
      reason: "versionMismatch",
      detail: `found ${version ?? "no version"}, expected ${EXPECTED_ENGINE_VERSION}`
    };
  }
  return { addon: loaded };
}

/**
 * Accept a loaded module as the engine addon, or refuse it into null.
 * Separated from the loader so the contract is unit-testable without a
 * binary.
 */
export function validateLoadedAddon(loaded: unknown): EngineAddon | null {
  const attempt = classifyLoadedAddon(loaded);
  return "addon" in attempt ? attempt.addon : null;
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
    authors?: unknown;
    loadConfig?: unknown;
    searchCommits?: unknown;
    loadRefs?: unknown;
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
    typeof candidate.authors === "function" &&
    typeof candidate.loadConfig === "function" &&
    typeof candidate.searchCommits === "function" &&
    typeof candidate.loadRefs === "function" &&
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
