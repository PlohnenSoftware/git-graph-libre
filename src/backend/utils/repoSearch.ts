import * as fs from "node:fs/promises";
import * as path from "node:path";

import { isGitRepository } from "@/backend/utils/git";
import { evalPromises } from "@/backend/utils/promise";

async function isDirectory(pathname: string): Promise<boolean> {
  return fs
    .stat(pathname)
    .then((s) => s.isDirectory())
    .catch(() => false);
}

/**
 * The value of a `path = <value>` entry from a `.gitmodules` section, or
 * `null` for any other line.
 *
 * Hand-parsed rather than matched with `/^\s*path\s*=\s*(.+?)\s*$/`: a lazy
 * `(.+?)` followed by `\s*$` backtracks super-linearly on a long run of
 * whitespace (`typescript:S8786`), and `.gitmodules` is whatever the opened
 * repository happens to contain — not trusted input. Splitting on the first
 * `=` and trimming both halves is linear and decides the same lines, comment
 * lines included: `# path = x` does not trim to the key `path`.
 *
 * The key is compared case-insensitively because git config variable names
 * are, so a hand-written `Path =` is a real submodule entry.
 */
function parseSubmodulePathEntry(line: string): string | null {
  const separator = line.indexOf("=");
  if (separator === -1) return null;
  if (line.slice(0, separator).trim().toLowerCase() !== "path") return null;
  const value = line.slice(separator + 1).trim();
  return value === "" ? null : value;
}

async function readSubmodulePaths(repoPath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(path.join(repoPath, ".gitmodules"), "utf8");
    const submodulePaths = new Set<string>();
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const relativePath = parseSubmodulePathEntry(line);
      if (relativePath === null) continue;
      const resolvedPath = path.resolve(repoPath, relativePath);
      const relativeToRepo = path.relative(repoPath, resolvedPath);
      if (
        relativeToRepo === "" ||
        relativeToRepo.startsWith("..") ||
        path.isAbsolute(relativeToRepo)
      ) {
        continue;
      }
      // Forward slashes, because every other repository path in the extension
      // is normalized that way (`getPathFromUri`/`getPathFromStr`) and the
      // containment checks below and in the webview compare on `/`. Inlined
      // rather than imported: `@/backend/utils/path` pulls in `vscode`, which
      // the backend test project cannot load.
      submodulePaths.add(resolvedPath.replaceAll("\\", "/"));
    }
    return [...submodulePaths];
  } catch {
    return [];
  }
}

async function searchSubmodules(
  repoPath: string,
  maxDepth: number,
  gitPath: string,
  knownRepoPaths: string[]
): Promise<string[]> {
  const found = new Set<string>();
  const unrelatedKnownRepoPaths = knownRepoPaths.filter(
    (knownPath) => repoPath !== knownPath && !repoPath.startsWith(`${knownPath}/`)
  );
  const submodules = await readSubmodulePaths(repoPath);
  for (const submodulePath of submodules) {
    if (
      unrelatedKnownRepoPaths.some(
        (knownPath) => submodulePath === knownPath || submodulePath.startsWith(`${knownPath}/`)
      )
    ) {
      continue;
    }
    if (await isGitRepository(submodulePath, gitPath)) {
      found.add(submodulePath);
      if (maxDepth > 0) {
        const nested = await searchDirectoryForRepos(submodulePath, maxDepth - 1, gitPath, [
          ...knownRepoPaths,
          repoPath
        ]);
        for (const nestedRepo of nested) found.add(nestedRepo);
      }
    }
  }
  return [...found];
}

export async function searchDirectoryForRepos(
  directory: string,
  maxDepth: number,
  gitPath: string,
  knownRepoPaths: string[]
): Promise<string[]> {
  if (knownRepoPaths.includes(directory)) {
    return searchSubmodules(directory, maxDepth, gitPath, knownRepoPaths);
  }
  if (knownRepoPaths.some((repoPath) => directory.startsWith(`${repoPath}/`))) {
    return [];
  }

  const isRepo = await isGitRepository(directory, gitPath);
  if (isRepo) {
    const found = new Set<string>([directory]);
    for (const submodulePath of await searchSubmodules(
      directory,
      maxDepth,
      gitPath,
      knownRepoPaths
    )) {
      found.add(submodulePath);
    }
    return [...found];
  }

  if (maxDepth <= 0) {
    return [];
  }

  const dirContents = await fs.readdir(directory).catch(() => null);
  if (dirContents === null) {
    return [];
  }

  const dirs: string[] = [];
  for (const entry of dirContents) {
    if (entry !== ".git" && (await isDirectory(`${directory}/${entry}`))) {
      dirs.push(`${directory}/${entry}`);
    }
  }

  const results = await evalPromises(dirs, 2, (dir) =>
    searchDirectoryForRepos(dir, maxDepth - 1, gitPath, knownRepoPaths)
  );
  return results.flat();
}
