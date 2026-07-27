import * as fs from "node:fs/promises";

import { isGitRepository } from "@/backend/utils/git";
import { evalPromises } from "@/backend/utils/promise";

async function isDirectory(path: string): Promise<boolean> {
  return fs
    .stat(path)
    .then((s) => s.isDirectory())
    .catch(() => false);
}

export async function searchDirectoryForRepos(
  directory: string,
  maxDepth: number,
  gitPath: string,
  knownRepoPaths: string[]
): Promise<string[]> {
  if (knownRepoPaths.some((r) => directory === r || directory.startsWith(`${r}/`))) {
    return [];
  }

  const isRepo = await isGitRepository(directory, gitPath);
  if (isRepo) {
    return [directory];
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
