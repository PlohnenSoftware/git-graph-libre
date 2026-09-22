/**
 * Repository reads with engine-first, CLI-fallback routing (Phase 16,
 * slice 16.3).
 *
 * The CLI is the default and the engine is the optimization: every read keeps
 * a working CLI implementation, and a missing binary, a failed load, a
 * version-skewed addon, or a `git-cli` preference all land on exactly the
 * CLI behavior. The fallback rule is upstream's and is worth keeping: fall
 * back only on "not a repository" and "unsupported" — a genuine Git failure
 * must not be retried through the CLI, because it will fail again more slowly
 * and hide the real error.
 *
 * Engine error kinds arrive as `Kind: message` prefixes on the thrown Error
 * (see `to_js_error` in `engine/native/node/src/lib.rs`); only the two
 * decline prefixes below route to the CLI.
 */

import { getRemoteUrl } from "@/backend/utils/git";
import type { EngineBackend } from "@/types";

import { type EngineAddon, loadEngineAddon } from "./addon";

/** How the reader loads the addon. The default is the real loader; tests inject fakes. */
export type AddonProvider = () => EngineAddon | null;

export type RepoReaderDeps = {
  /** Read live per call by the caller — never cached, so flipping the setting needs no reload. */
  preference: EngineBackend;
  gitPath: string;
  addonProvider?: AddonProvider;
};

export type RepoReader = {
  /** The fetch URL of `origin`, or null when it is not configured. Total: never throws. */
  getRemoteUrl(repoPath: string): Promise<string | null>;
};

/** Prefixes the engine uses for declines the CLI must serve instead. */
const FALLBACK_ERROR_PREFIXES = ["NotARepository:", "Unsupported:"];

/**
 * Whether an engine failure is a decline (route to the CLI) rather than a
 * genuine failure (never retry). Anything that is not a prefixed engine Error
 * — a non-Error throw, a foreign message — is genuine by default: an
 * unrecognized failure retried through the CLI fails again more slowly.
 */
export function isEngineFallbackError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return false;
  return FALLBACK_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix));
}

let engineServedRead = false;

/**
 * Whether the engine has actually served a read this session. Feeds the
 * `view.engineBackend` telemetry signal: true only when the engine served,
 * never a per-load count and never a path.
 */
export function didEngineServeRead(): boolean {
  return engineServedRead;
}

/** Test seam: the flag is session-scoped, so cases reset it between runs. */
export function resetEngineServedRead(): void {
  engineServedRead = false;
}

export function createRepoReader(deps: RepoReaderDeps): RepoReader {
  const provider = deps.addonProvider ?? loadEngineAddon;
  return {
    getRemoteUrl: (repoPath: string) =>
      readRemoteUrl(deps.preference, deps.gitPath, provider, repoPath)
  };
}

async function readRemoteUrl(
  preference: EngineBackend,
  gitPath: string,
  provider: AddonProvider,
  repoPath: string
): Promise<string | null> {
  // The total no-op path: the addon is not even loaded.
  if (preference === "git-cli") return getRemoteUrl(repoPath, gitPath);
  const addon = provider();
  if (addon === null) return getRemoteUrl(repoPath, gitPath);
  try {
    const url = await addon.remoteUrl(repoPath, "origin");
    engineServedRead = true;
    // Same normalization the CLI arm applies: trim, empty means unconfigured.
    const normalized = (url ?? "").trim();
    return normalized === "" ? null : normalized;
  } catch (error: unknown) {
    if (!isEngineFallbackError(error)) return null;
    return getRemoteUrl(repoPath, gitPath);
  }
}
