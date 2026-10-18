import * as fs from "node:fs";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readStagedFile,
  type StagedFileAddon,
  type StagedFileDeps
} from "@/backend/engine/stagedFile";
import { setOperationLog } from "@/backend/utils/operationLog";

/**
 * `readStagedFile` routing (slice D43): the engine serves a file's staged
 * copy only on `auto`, for a verified repository, when the addon carries
 * `loadIndexFile` and answers one of its two payload shapes. Everything else
 * lands on `git show :<path>`, read here from real repositories.
 */

const dirs: string[] = [];

/** A repository whose `f` holds "staged text" — in the index, not in HEAD. */
function repoWithStagedFile(): string {
  const dir = makeRepo();
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, "f"), "staged text\n");
  git(["add", "f"], dir);
  // An unstaged edit on top of it: the index must still read "staged text".
  fs.writeFileSync(path.join(dir, "f"), "working text\n");
  return dir;
}

/** The route lines one read left behind, captured for the read's duration only. */
async function readWithLog(
  dir: string,
  deps: StagedFileDeps
): Promise<{ result: Awaited<ReturnType<typeof readStagedFile>>; lines: string[] }> {
  const lines: string[] = [];
  const log = setOperationLog((line) => lines.push(line));
  try {
    return { result: await readStagedFile(dir, "f", deps), lines };
  } finally {
    log.dispose();
  }
}

function indexFileAddon(result: string | Error) {
  const loadIndexFile = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
  );
  return { provider: () => ({ loadIndexFile }), loadIndexFile };
}

const engineDeps = (provider: () => StagedFileAddon | null): StagedFileDeps => ({
  gitPath: "git",
  backend: () => "auto",
  addonProvider: provider,
  isVerified: () => true
});

describe("readStagedFile", () => {
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("serves engine text without touching the CLI, and logs the engine route", async () => {
    const dir = repoWithStagedFile();
    const addon = indexFileAddon(JSON.stringify({ contents: "engine text\n", binary: false }));

    const { result, lines } = await readWithLog(dir, engineDeps(addon.provider));

    expect(result).toEqual({ text: "engine text\n" });
    expect(addon.loadIndexFile).toHaveBeenCalledWith(dir, "f");
    expect(lines).toContainEqual(expect.stringContaining("operation=loadIndexFile backend=engine"));
    expect(lines.some((line) => line.includes("operation=stagedFile.show"))).toBe(false);
  });

  it("serves the engine binary marker as binary", async () => {
    const dir = repoWithStagedFile();
    const addon = indexFileAddon(JSON.stringify({ contents: null, binary: true }));

    const { result, lines } = await readWithLog(dir, engineDeps(addon.provider));

    expect(result).toEqual({ binary: true });
    expect(lines).toContainEqual(expect.stringContaining("operation=loadIndexFile backend=engine"));
  });

  it("goes to the CLI when the addon has no loadIndexFile", async () => {
    const dir = repoWithStagedFile();

    const { result, lines } = await readWithLog(
      dir,
      engineDeps(() => ({}))
    );

    expect(result).toEqual({ text: "staged text\n" });
    expect(lines).toContainEqual(
      expect.stringContaining("operation=loadIndexFile backend=cli reason=noLoadIndexFile")
    );
    expect(lines).toContainEqual(expect.stringContaining("operation=stagedFile.show"));
  });

  it("goes to the CLI on the git-cli backend without loading the addon", async () => {
    const dir = repoWithStagedFile();
    const addon = indexFileAddon(JSON.stringify({ contents: "engine text\n", binary: false }));
    const load = vi.fn(addon.provider);

    const { result, lines } = await readWithLog(dir, {
      gitPath: "git",
      backend: () => "git-cli",
      addonProvider: load,
      isVerified: () => true
    });

    expect(result).toEqual({ text: "staged text\n" });
    expect(load).not.toHaveBeenCalled();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=loadIndexFile backend=cli reason=setting")
    );
  });

  it("goes to the CLI for a repository Git has not confirmed", async () => {
    const dir = repoWithStagedFile();
    const addon = indexFileAddon(JSON.stringify({ contents: "engine text\n", binary: false }));
    const load = vi.fn(addon.provider);

    const { result, lines } = await readWithLog(dir, {
      gitPath: "git",
      backend: () => "auto",
      addonProvider: load,
      isVerified: () => false
    });

    expect(result).toEqual({ text: "staged text\n" });
    expect(load).not.toHaveBeenCalled();
    expect(lines).toContainEqual(
      expect.stringContaining("operation=loadIndexFile backend=cli reason=unverified")
    );
  });

  it("goes to the CLI on a malformed engine payload", async () => {
    const dir = repoWithStagedFile();
    const addon = indexFileAddon("not json");

    const { result, lines } = await readWithLog(dir, engineDeps(addon.provider));

    expect(result).toEqual({ text: "staged text\n" });
    expect(lines).toContainEqual(
      expect.stringContaining("operation=loadIndexFile backend=cli reason=malformedPayload")
    );
  });

  it("goes to the CLI on an inconsistent engine payload", async () => {
    const dir = repoWithStagedFile();
    const addon = indexFileAddon(JSON.stringify({ contents: "sneaky\n", binary: true }));

    const { result, lines } = await readWithLog(dir, engineDeps(addon.provider));

    expect(result).toEqual({ text: "staged text\n" });
    expect(lines).toContainEqual(
      expect.stringContaining("operation=loadIndexFile backend=cli reason=malformedPayload")
    );
  });

  it("goes to the CLI when the engine throws", async () => {
    const dir = repoWithStagedFile();
    const addon = indexFileAddon(new Error("Git: corrupt object"));

    const { result, lines } = await readWithLog(dir, engineDeps(addon.provider));

    expect(result).toEqual({ text: "staged text\n" });
    expect(lines).toContainEqual(
      expect.stringContaining("operation=loadIndexFile backend=cli reason=engineThrew")
    );
  });

  it("reads the staged copy, binary and missing cases through the CLI", async () => {
    const dir = repoWithStagedFile();
    fs.writeFileSync(path.join(dir, "blob.bin"), Buffer.from([0, 1, 2, 3, 0, 255, 254, 65]));
    git(["add", "blob.bin"], dir);
    const cli: StagedFileDeps = { gitPath: "git", backend: () => "git-cli" };

    expect(await readStagedFile(dir, "f", cli)).toEqual({ text: "staged text\n" });
    expect(await readStagedFile(dir, "blob.bin", cli)).toEqual({ binary: true });
    expect(await readStagedFile(dir, "no-such.txt", cli)).toEqual({ missing: true });
  });
});
