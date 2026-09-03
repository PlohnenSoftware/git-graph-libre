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

async function readSubmodulePaths(repoPath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(path.join(repoPath, ".gitmodules"), "utf8");
    const submodulePaths = new Set<string>();
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*path\s*=\s*(.+?)\s*$/);
      if (match === null) continue;
      const relativePath = match[1].trim();
      if (relativePath === "") continue;
      const resolvedPath = path.resolve(repoPath, relativePath);
      const relativeToRepo = path.relative(repoPath, resolvedPath);
      if (relativeToRepo === "" || relativeToRepo.startsWith("..") || path.isAbsolute(relativeToRepo)) {
        continue;
      }
      submodulePaths.add(resolvedPath);
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
        (knownPath) =>
          submodulePath === knownPath || submodulePath.startsWith(`${knownPath}/`)
      )
    ) {
      continue;
    }
    if (await isGitRepository(submodulePath, gitPath)) {
      found.add(submodulePath);
      if (maxDepth > 0) {
        const nested = await searchDirectoryForRepos(
          submodulePath,
          maxDepth - 1,
          gitPath,
          [...knownRepoPaths, repoPath]
        );
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
