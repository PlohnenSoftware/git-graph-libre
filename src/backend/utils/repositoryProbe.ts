import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

import { loadEngineAddon } from "@/backend/engine/addon";
import type { RepositoryProbe } from "@/types";
import { canonicalizePath } from "./git";
import { normalizeGitError } from "./gitRunner";
import { traceBackend } from "./operationLog";

const execute = promisify(execFile);

export function isGitTrustError(message: string): boolean {
  return (
    message.includes("detected dubious ownership in repository") ||
    message.includes("unsafe repository") ||
    message.includes("not owned by current user")
  );
}

export type RepositoryProbeOptions = {
  gitPath: string;
  /** Respects the user's CLI-only preference; never bypasses a Git ownership rejection. */
  useEngine: boolean;
  engineRoot?: (directory: string) => Promise<string>;
};

async function hasGitMarker(directory: string): Promise<boolean | null> {
  try {
    await fs.lstat(path.join(directory, ".git"));
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR" ? false : null;
  }
}

async function engineProbe(
  directory: string,
  options: RepositoryProbeOptions
): Promise<Pick<RepositoryProbe, "repository" | "detectedBy" | "engineDetail">> {
  if (options.useEngine) {
    const addon = options.engineRoot ? null : loadEngineAddon();
    const root = options.engineRoot ?? addon?.repoRoot?.bind(addon);
    if (root) {
      try {
        // Loaded addons already trace their native calls. Only the injected
        // discovery seam needs a wrapper here.
        const found = await (options.engineRoot
          ? traceBackend("engine", "repoRoot", directory, () => root(directory))
          : root(directory));
        return {
          repository: (await canonicalizePath(found)) === (await canonicalizePath(directory)),
          detectedBy: "engine"
        };
      } catch (error) {
        const detail = normalizeGitError(error).message;
        // The engine's typed absence answer (the same prefix the reader
        // treats as a decline) is proof there is no repository here.
        // Ownership, corruption and unsupported formats are not.
        if (detail.startsWith("NotARepository:")) {
          return { repository: false, detectedBy: "engine", engineDetail: detail };
        }
        return { repository: null, detectedBy: "engine", engineDetail: detail };
      }
    }
  }
  return { repository: null, detectedBy: null };
}

/** A child of an unsafe repo has no marker, and must not become another trust entry. */
function untrustedState(marker: boolean | null): RepositoryProbe["state"] {
  if (marker === null) return "error";
  return marker ? "untrusted" : "notRepository";
}

/** Classifies a failed `rev-parse`, consulting the engine only when Git itself could not answer. */
async function explainRevParseFailure(
  directory: string,
  error: unknown,
  options: RepositoryProbeOptions
): Promise<RepositoryProbe> {
  const base = { path: directory, repository: null, detectedBy: null } as const;
  const detail = normalizeGitError(error).message;
  const marker = await hasGitMarker(directory);
  if (isGitTrustError(detail)) {
    return {
      ...base,
      state: untrustedState(marker),
      repository: marker,
      detectedBy: "git",
      detail
    };
  }
  if (detail.includes("not a git repository")) {
    // A damaged/inaccessible marker is an access problem, not evidence
    // that a previously known repository and its settings should disappear.
    if (marker !== false) return { ...base, state: "error", detail };
    return {
      ...base,
      state: "notRepository",
      repository: false,
      detectedBy: "git",
      detail: null
    };
  }
  const code = (error as NodeJS.ErrnoException).code;
  const unavailable = code === "ENOENT" || code === "EACCES" || code === "ENOEXEC";
  const evidence = await engineProbe(directory, options);
  // No .git marker means this directory is not a worktree root. A marker by
  // itself is only a candidate, never proof of a valid repository.
  if (marker === false && evidence.detectedBy === null) {
    evidence.repository = false;
    evidence.detectedBy = "filesystem";
  }
  return { ...base, ...evidence, state: unavailable ? "gitUnavailable" : "error", detail };
}

/** A root check with separate answers for repository presence and CLI access. */
export async function inspectRepository(
  directory: string,
  options: RepositoryProbeOptions
): Promise<RepositoryProbe> {
  let topLevel: string;
  try {
    const result = await traceBackend("cli", "discover.revParse", directory, () =>
      execute(options.gitPath, ["-C", directory, "rev-parse", "--show-toplevel"], {
        timeout: 5000,
        windowsHide: true,
        env: { ...process.env, LC_ALL: "C" }
      })
    );
    topLevel = result.stdout.trim();
  } catch (error) {
    return explainRevParseFailure(directory, error, options);
  }
  const matches = (await canonicalizePath(topLevel)) === (await canonicalizePath(directory));
  return {
    path: directory,
    state: matches ? "ready" : "notRepository",
    repository: matches,
    detectedBy: "git",
    detail: null
  };
}

/** Called only after the host confirms the exact discovered directory with the user. */
export async function trustGitRepository(directory: string, gitPath: string): Promise<void> {
  const current = await inspectRepository(directory, { gitPath, useEngine: false });
  if (current.state !== "untrusted")
    throw new Error("This repository no longer needs Git ownership trust. Retry discovery.");
  const root = await canonicalizePath(directory);
  if (!path.isAbsolute(root) || root.endsWith("/*"))
    throw new Error("An exact repository path is required.");
  await traceBackend("cli", "trust.safeDirectory", root, () =>
    execute(gitPath, ["config", "--global", "--add", "safe.directory", root], {
      timeout: 5000,
      windowsHide: true,
      env: { ...process.env, LC_ALL: "C" }
    })
  );
}
