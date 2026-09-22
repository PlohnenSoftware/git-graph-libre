import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import { createRepoReader, isEngineFallbackError } from "@/backend/engine/index";
import { getRemoteUrl } from "@/backend/utils/git";

/**
 * Cross-backend parity, built to grow: every read wired to the engine gains
 * a case here, driven against both implementations over the same real
 * repositories. A divergence is an engine bug, not a test to relax.
 *
 * The engine half runs only when an addon is built (`pnpm run
 * engine:build`); otherwise it skips with a message and the CLI half still
 * verifies. Nothing here may depend on engine-only behavior.
 */

type ParityCase = {
  name: string;
  make: () => string;
  expected: string | null;
};

const cases: ParityCase[] = (() => {
  const dirs: string[] = [];
  const track = (dir: string): string => {
    dirs.push(dir);
    return dir;
  };

  return [
    {
      name: "origin with an https fetch url",
      make: () =>
        track(
          (() => {
            const dir = makeRepo();
            git(["remote", "add", "origin", "https://github.com/some/repo.git"], dir);
            return dir;
          })()
        ),
      expected: "https://github.com/some/repo.git"
    },
    {
      name: "origin with a separate push url still reports the fetch url",
      make: () =>
        track(
          (() => {
            const dir = makeRepo();
            git(["remote", "add", "origin", "https://github.com/some/repo.git"], dir);
            git(["remote", "set-url", "--push", "origin", "git@github.com:some/repo.git"], dir);
            return dir;
          })()
        ),
      expected: "https://github.com/some/repo.git"
    },
    {
      name: "repository with no remotes",
      make: () => track(makeRepo()),
      expected: null
    },
    {
      name: "directory that is not a repository",
      make: () => track(fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-plain-"))),
      expected: null
    }
  ];
})();

const built: { dir: string; expected: string | null }[] = [];

beforeAll(() => {
  for (const parityCase of cases)
    built.push({ dir: parityCase.make(), expected: parityCase.expected });
});

afterAll(() => {
  for (const { dir } of built) fs.rmSync(dir, { recursive: true, force: true });
});

describe("engine/CLI parity: remoteUrl", () => {
  it("the CLI arm matches the recorded expectation on every case", async () => {
    for (const { dir, expected } of built) {
      expect(await getRemoteUrl(dir, "git")).toBe(expected);
    }
  });

  it("the engine agrees with the CLI on every case", async (context) => {
    const addon = loadEngineAddon();
    if (addon === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
      return;
    }
    for (const { dir, expected } of built) {
      const cli = await getRemoteUrl(dir, "git");
      // The engine contract is URL-or-null-or-decline: a decline is not a
      // divergence, it is the reader's cue to serve the CLI value — which the
      // CLI half above pins. Anything else must equal the CLI byte for byte.
      let served: string | null | undefined;
      try {
        const url = await addon.remoteUrl(dir, "origin");
        served = (url ?? "").trim() || null;
      } catch (error: unknown) {
        expect(isEngineFallbackError(error)).toBe(true);
      }
      if (served !== undefined) expect(served).toBe(cli);
      expect(cli).toBe(expected);
    }
  });

  it("the reader serves the CLI value on either preference", async () => {
    for (const preference of ["auto", "git-cli"] as const) {
      const reader = createRepoReader({ preference, gitPath: "git" });
      for (const { dir, expected } of built) {
        expect(await reader.getRemoteUrl(dir)).toBe(expected);
      }
    }
  });
});
