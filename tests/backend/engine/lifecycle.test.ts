import * as fs from "node:fs";
import { makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, describe, expect, it } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import {
  closeAllEngineRepositories,
  closeEngineRepository,
  createRepoReader,
  openEngineRepositoryCount
} from "@/backend/engine/index";

/**
 * Handle lifetime against the built addon (`pnpm run engine:build`);
 * skips with a message otherwise. Counts are delta-based: other suites in
 * this worker may hold handles of their own, and closing everything at the
 * end is harmless because handles reopen lazily on the next read.
 */
describe("engine handle lifecycle", () => {
  const dirs: string[] = [];

  afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  function requireAddon(context: { skip: (message?: string) => never }) {
    if (loadEngineAddon() === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
    }
  }

  async function readInfo(repo: string) {
    return createRepoReader({ preference: "auto", gitPath: "git" }).loadRepoInfo({
      repoPath: repo,
      git: simpleGit(repo),
      showStashes: false
    });
  }

  it("does not accumulate handles across reads and drops them on close", async (context) => {
    requireAddon(context);
    const first = makeRepo();
    const second = makeRepo();
    dirs.push(first, second);
    const base = openEngineRepositoryCount();

    await readInfo(first);
    await readInfo(first);
    await readInfo(second);
    expect(openEngineRepositoryCount()).toBe(base + 2);

    closeEngineRepository(first);
    expect(openEngineRepositoryCount()).toBe(base + 1);

    const reread = await readInfo(first);
    expect(reread.repoInfo?.isRepo).toBe(true);
    expect(openEngineRepositoryCount()).toBe(base + 2);

    closeAllEngineRepositories();
    expect(openEngineRepositoryCount()).toBe(base);
  }, 120000);
});
