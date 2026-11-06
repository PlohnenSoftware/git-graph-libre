import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

import { loadEngineAddon } from "@/backend/engine/addon";
import type { RepositoryProbe } from "@/types";
import { canonicalizePath } from "./git";
import { resolveGitDirs } from "./gitDirs";
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

const OWNERSHIP_MARKER = "detected dubious ownership in repository at '";

/** The path in Git's "detected dubious ownership in repository at '<path>'" line, as Git spells it. */
function reportedOwnershipPath(detail: string): string | null {
  const start = detail.indexOf(OWNERSHIP_MARKER);
  if (start === -1) return null;
  const from = start + OWNERSHIP_MARKER.length;
  const lineEnd = detail.indexOf("\n", from);
  const rest = detail.slice(from, lineEnd === -1 ? undefined : lineEnd).trimEnd();
  return rest.endsWith("'") ? rest.slice(0, -1) : null;
}

/**
 * The exact `safe.directory` value for a repository Git still rejects for
 * ownership: the path Git names in its own message, which is the spelling it
 * compares against (drive-letter case included), accepted only when it
 * resolves to `directory` itself. This is what the user is shown and what is
 * written; it is never `*`, a glob, or a parent of the repository.
 */
export async function safeDirectoryEntry(directory: string, gitPath: string): Promise<string> {
  const current = await inspectRepository(directory, { gitPath, useEngine: false });
  if (current.state !== "untrusted")
    throw new Error("This repository no longer needs Git ownership trust. Retry discovery.");
  const root = await canonicalizePath(directory);
  const entry = reportedOwnershipPath(current.detail ?? "") ?? root;
  if (!path.isAbsolute(entry) || entry.includes("*") || (await canonicalizePath(entry)) !== root)
    throw new Error("An exact repository path is required.");
  return entry;
}

/**
 * Adds `confirmed` — the entry `safeDirectoryEntry` produced and the user
 * confirmed — to Git's global `safe.directory` list, after checking that it
 * is still exactly the entry this repository needs.
 */
export async function trustGitRepository(
  directory: string,
  gitPath: string,
  confirmed: string
): Promise<void> {
  const entry = await safeDirectoryEntry(directory, gitPath);
  if (entry !== confirmed)
    throw new Error("The repository path changed after it was confirmed. Retry discovery.");
  await traceBackend("cli", "trust.safeDirectory", entry, () =>
    execute(gitPath, ["config", "--global", "--add", "safe.directory", entry], {
      timeout: 5000,
      windowsHide: true,
      env: { ...process.env, LC_ALL: "C" }
    })
  );
}

export type TrustEntry = {
  /** The worktree folder that needs trust. */
  directory: string;
  /** The exact `safe.directory` value for it, as `safeDirectoryEntry` spells it. */
  entry: string;
};

/**
 * Folders the repository's admin data names as its worktrees: the main
 * worktree beside a `.git` common dir, and each linked worktree's `gitdir`
 * file under `worktrees/`. Read from the file system, because Git itself
 * refuses to list the worktrees of a repository it does not trust.
 */
async function namedWorktreeFolders(commonDir: string): Promise<string[]> {
  const folders = path.basename(commonDir) === ".git" ? [path.dirname(commonDir)] : [];
  const adminRoot = path.join(commonDir, "worktrees");
  const ids = await fs.readdir(adminRoot).catch(() => [] as string[]);
  for (const id of ids) {
    const line = await fs
      .readFile(path.join(adminRoot, id, "gitdir"), "utf8")
      .then((text) => (text.split(/\r?\n/)[0] ?? "").trim())
      .catch(() => "");
    // The file names the worktree's own `.git` file; the worktree is its folder.
    if (path.basename(line) === ".git") folders.push(path.dirname(line));
  }
  return folders;
}

/** Whether `folder` names this common dir back, so a forged admin file cannot name a stranger's folder. */
async function sharesCommonDir(folder: string, commonDir: string): Promise<boolean> {
  const theirs = resolveGitDirs(folder).commonDir;
  return (await canonicalizePath(theirs)) === (await canonicalizePath(commonDir));
}

/**
 * The other worktrees of `repo`'s repository that Git also rejects for
 * ownership, each with the exact entry it needs (Y10): trusting one worktree
 * leaves the others untrusted, so they are offered in one confirmation rather
 * than one prompt each. Only folders that both the admin data names and that
 * name this repository back are considered, and only those Git itself still
 * answers "untrusted" for. `repo` is never in the result.
 */
export async function untrustedSiblingEntries(
  repo: string,
  gitPath: string
): Promise<TrustEntry[]> {
  const commonDir = resolveGitDirs(repo).commonDir;
  const own = await canonicalizePath(repo);
  const seen = new Set<string>([own]);
  const entries: TrustEntry[] = [];
  for (const folder of await namedWorktreeFolders(commonDir)) {
    const canonical = await canonicalizePath(folder);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    if (!(await sharesCommonDir(folder, commonDir))) continue;
    const probe = await inspectRepository(folder, { gitPath, useEngine: false });
    if (probe.state !== "untrusted") continue;
    entries.push({ directory: folder, entry: await safeDirectoryEntry(folder, gitPath) });
  }
  return entries;
}
