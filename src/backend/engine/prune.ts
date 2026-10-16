/**
 * Dropping the engine binaries this host can never load.
 *
 * The published VSIX is universal: it carries every platform's binary
 * (six directories, roughly 33 MB installed) and the loader picks the
 * host's at run time. That one-file simplicity was a deliberate maintainer
 * decision (slice 16.9), and this is its disk-space counterpart: on
 * activation the extension deletes the platform directories that are not
 * this host's candidates. VS Code verifies the Marketplace signature when
 * an extension is *installed*, on the package; nothing re-verifies or
 * reinstalls an installed directory whose unused files disappear, and an
 * update arrives as a fresh version directory where the prune simply
 * runs again.
 *
 * The rails, each pinned by a test:
 *
 * - only names in `ENGINE_PLATFORM_DIRECTORIES` are ever deleted, and the
 *   directory the loader picks for this host never is;
 * - nothing is deleted unless a kept directory actually contains the
 *   binary, so an unexpected layout (or a misdetected platform) aborts
 *   the prune instead of compounding the problem;
 * - every failure is swallowed per directory and overall. This runs on
 *   the activation path of every install, including read-only and shared
 *   extension directories; it must never delay or fail activation. A
 *   directory shared with another OS or architecture loses that side's
 *   binary, which degrades exactly like a platform with no build at
 *   all — the CLI serves every read — until the next update or reinstall.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { ENGINE_BINARY_NAME, ENGINE_PLATFORM_DIRECTORIES, platformDirectoriesFor } from "./addon";

export type PruneResult = {
  /** The platform directories removed, by name. */
  removed: string[];
  /** Combined size of the binaries removed, in bytes. */
  freedBytes: number;
};

const NOTHING: PruneResult = { removed: [], freedBytes: 0 };

/**
 * Remove every known platform directory under `nativeRoot` except
 * `keepDirectories`. Pure in its arguments (the host's values are the
 * caller's to supply) so every combination is unit-testable on a
 * fabricated tree.
 */
export async function pruneUnusedEngineBinaries(
  nativeRoot: string,
  keepDirectories: readonly string[]
): Promise<PruneResult> {
  try {
    const keep = new Set(keepDirectories);
    if (keep.size === 0) return NOTHING;

    const entries = await fs.readdir(nativeRoot, { withFileTypes: true }).catch(() => null);
    if (entries === null) return NOTHING;

    const hostBinaryPresent = (
      await Promise.all(
        [...keep].map((dir) =>
          fs
            .stat(path.join(nativeRoot, dir, ENGINE_BINARY_NAME))
            .then((stats) => stats.isFile())
            .catch(() => false)
        )
      )
    ).some((present) => present);
    if (!hostBinaryPresent) return NOTHING;

    const removed: string[] = [];
    let freedBytes = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || keep.has(entry.name)) continue;
      if (!ENGINE_PLATFORM_DIRECTORIES.includes(entry.name)) continue;
      const size = await fs
        .stat(path.join(nativeRoot, entry.name, ENGINE_BINARY_NAME))
        .then((stats) => stats.size)
        .catch(() => 0);
      const deleted = await fs
        .rm(path.join(nativeRoot, entry.name), { recursive: true, force: true })
        .then(() => true)
        .catch(() => false);
      if (deleted) {
        removed.push(entry.name);
        freedBytes += size;
      }
    }
    return { removed, freedBytes };
  } catch {
    return NOTHING;
  }
}

/** Prune the installed extension at `extensionPath` for this host. */
export function pruneInstalledEngineBinaries(extensionPath: string): Promise<PruneResult> {
  return pruneUnusedEngineBinaries(
    path.join(extensionPath, "engine", "native"),
    platformDirectoriesFor(process.platform, process.arch)
  );
}
