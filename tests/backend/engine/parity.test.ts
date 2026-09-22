import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";
import { loadEngineAddon } from "@/backend/engine/addon";
import {
  createRepoReader,
  didEngineServeRead,
  isEngineFallbackError,
  resetEngineServedRead
} from "@/backend/engine/index";
import { loadRepoInfo } from "@/backend/queries/loadRepoInfo";
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

describe("engine/CLI parity: repoInfo", () => {
  // One engine call against several CLI invocations: the reader serves head,
  // tags and stashes from the engine and fills the rest from the CLI pieces.
  // The table asserts the composed shape equals the CLI read byte for byte,
  // so a divergence is an engine or mapping bug — never a test to relax.
  // loadBranches is untouched by this slice: branch filtering (hidden
  // remotes, remote-head toggles) travels on its own message, so the
  // multi-remote case below pins names with URLs, not branch visibility.
  type RepoFixture = { name: string; dir: string; showStashes: boolean };
  const fixtures: RepoFixture[] = [];

  beforeAll(() => {
    const plain = makeRepo();

    const featured = makeRepo();
    git(["checkout", "-b", "feature"], featured);
    fs.writeFileSync(path.join(featured, "g"), "y");
    git(["add", "."], featured);
    git(["commit", "-m", "feat"], featured);
    git(["checkout", "main"], featured);
    git(["remote", "add", "origin", "https://github.com/some/repo.git"], featured);
    git(["remote", "set-url", "--push", "origin", "git@github.com:some/repo.git"], featured);
    git(["remote", "add", "upstream", "https://github.com/up/repo.git"], featured);
    git(["tag", "v2.0.0"], featured);
    git(["tag", "-a", "v10.0.0", "-m", "annotated"], featured);
    fs.writeFileSync(path.join(featured, "f"), "one");
    git(["stash", "push", "-m", "one"], featured);
    fs.writeFileSync(path.join(featured, "f"), "two");
    git(["stash", "push", "-m", "two"], featured);

    const detached = makeRepo();
    const headCommit = cp
      .execFileSync("git", ["rev-parse", "HEAD"], { cwd: detached, encoding: "utf8" })
      .trim();
    git(["checkout", headCommit], detached);

    // Unborn and commitless: initialised, configured, never committed.
    const unborn = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-unborn-"));
    git(["init", "-b", "main"], unborn);
    git(["config", "user.email", "t@t.com"], unborn);
    git(["config", "user.name", "T"], unborn);

    fixtures.push(
      { name: "plain repository", dir: plain, showStashes: true },
      { name: "featured repository", dir: featured, showStashes: true },
      { name: "featured repository with stashes off", dir: featured, showStashes: false },
      { name: "detached HEAD", dir: detached, showStashes: true },
      { name: "unborn branch", dir: unborn, showStashes: true }
    );
  });

  afterAll(() => {
    for (const { dir } of fixtures) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("the reader agrees with the CLI on every fixture", async (context) => {
    const addon = loadEngineAddon();
    if (addon === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
      return;
    }
    for (const { name, dir, showStashes } of fixtures) {
      resetEngineServedRead();
      const [viaAuto, viaCli, direct] = await Promise.all([
        createRepoReader({ preference: "auto", gitPath: "git" }).loadRepoInfo({
          repoPath: dir,
          showStashes,
          git: simpleGit(dir)
        }),
        createRepoReader({ preference: "git-cli", gitPath: "git" }).loadRepoInfo({
          repoPath: dir,
          showStashes,
          git: simpleGit(dir)
        }),
        loadRepoInfo(simpleGit(dir), { repo: dir, showStashes })
      ]);
      expect(viaAuto, name).toEqual(direct);
      expect(viaCli, name).toEqual(direct);
      expect(didEngineServeRead(), name).toBe(true);
    }
  });
});
