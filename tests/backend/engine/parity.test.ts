import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";
import { loadEngineAddon } from "@/backend/engine/addon";
import { parseEngineCommitFile } from "@/backend/engine/details";
import {
  createRepoReader,
  didEngineServeRead,
  isEngineFallbackError,
  type LoadCommitsArgs,
  resetEngineServedRead
} from "@/backend/engine/index";
import { commitComparison } from "@/backend/queries/commitComparison";
import { commitDetails } from "@/backend/queries/commitDetails";
import { loadCommits } from "@/backend/queries/loadCommits";
import { loadRepoInfo } from "@/backend/queries/loadRepoInfo";
import type { GitCommitNode } from "@/backend/types";
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

describe("engine/CLI parity: loadCommits", () => {
  // Every read wired to the engine gains a cross-backend parity case that
  // drives both against the same real repository and asserts identical
  // output — a divergence is an engine or mapping bug, never a test to
  // relax, with two documented exceptions below.
  //
  // The `*` row carries "now" from whichever backend ran first, so its date
  // is masked on both sides; everything else compares byte for byte,
  // including the served flag (reroutes must attribute the CLI).
  //
  // Known CLI quirk, normalized only in the author cases: the detached-HEAD
  // recovery query re-applies the author filter against HEAD alone (not the
  // selected refs), so when HEAD is filtered out the CLI prepends a match
  // that already appears below — adjacently or pages apart. The engine is
  // provably correct there (its walk has no such fix-up), and the loader
  // keeps that bug until its own behavior slice — the collapse below is
  // scoped to those cases so nothing else can hide behind it.
  type CommitsFixture = { name: string; dir: string };

  const fixtures: Record<string, CommitsFixture> = {};
  const dirs: string[] = [];

  const EPOCH = 1700000000;

  function commitAt(
    dir: string,
    file: string,
    content: string,
    message: string,
    epoch: number,
    author?: string
  ): void {
    fs.writeFileSync(path.join(dir, file), content);
    git(["add", file], dir);
    cp.execFileSync("git", ["commit", "-m", message], {
      cwd: dir,
      stdio: "pipe",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: `${epoch} +0000`,
        GIT_COMMITTER_DATE: `${epoch} +0000`,
        ...(author === undefined
          ? {}
          : { GIT_AUTHOR_NAME: author, GIT_AUTHOR_EMAIL: `${author.toLowerCase()}@x.com` })
      }
    });
  }

  function initBare(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-commits-"));
    dirs.push(dir);
    git(["init", "-b", "main"], dir);
    git(["config", "user.email", "ada@x.com"], dir);
    git(["config", "user.name", "Ada"], dir);
    git(["config", "commit.gpgsign", "false"], dir);
    git(["config", "tag.gpgsign", "false"], dir);
    return dir;
  }

  function mergeAt(dir: string, branch: string, message: string, epoch: number): void {
    cp.execFileSync("git", ["merge", "-q", "--no-ff", branch, "-m", message], {
      cwd: dir,
      stdio: "pipe",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: `${epoch} +0000`,
        GIT_COMMITTER_DATE: `${epoch} +0000`
      }
    });
  }

  /** Branchy history with two authors, a merge, tags and a stash. */
  function makeBranchy(dirty: boolean): string {
    const dir = initBare();
    let epoch = EPOCH;
    const next = (): number => {
      epoch += 600;
      return epoch;
    };
    commitAt(dir, "a.txt", "a", "first", next());
    commitAt(dir, "b.txt", "b", "second", next());
    git(["checkout", "-qb", "feature"], dir);
    commitAt(dir, "f.txt", "f", "feature one", next());
    commitAt(dir, "g.txt", "g", "feature two", next(), "Bob");
    git(["checkout", "-q", "main"], dir);
    commitAt(dir, "c.txt", "c", "third", next());
    mergeAt(dir, "feature", "merge feature", next());
    git(["tag", "-a", "-m", "release", "v1.0.0"], dir);
    git(["tag", "light"], dir);
    // A signed tag without keys: the block below is exactly what
    // `%(contents:signature)` reports, so the CLI badges it and the fill
    // must agree (probed against the built addon in slice 16.5d).
    const head = cp
      .execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" })
      .trim();
    const tagObject = [
      `object ${head}`,
      "type commit",
      "tag faketag",
      `tagger Ada <ada@x.com> ${next()} +0000`,
      "",
      "signed release",
      "",
      "-----BEGIN PGP SIGNATURE-----",
      "",
      "faketag",
      "-----END PGP SIGNATURE-----",
      ""
    ].join("\n");
    const tagHash = cp
      .execFileSync("git", ["hash-object", "-t", "tag", "-w", "--stdin"], {
        cwd: dir,
        input: tagObject,
        encoding: "utf8"
      })
      .trim();
    git(["update-ref", "refs/tags/faketag", tagHash], dir);
    fs.writeFileSync(path.join(dir, "s.txt"), "stashme");
    git(["add", "s.txt"], dir);
    git(["stash", "push", "-m", "wip"], dir);
    if (dirty) {
      fs.appendFileSync(path.join(dir, "a.txt"), "dirty");
      fs.writeFileSync(path.join(dir, "u.txt"), "untracked");
    }
    return dir;
  }

  /** Three branches with interleaved dates and merges, for ordering exactness. */
  function makeRoomy(): string {
    const dir = initBare();
    let epoch = EPOCH;
    commitAt(dir, "m.txt", "0\n", "seed", epoch);
    git(["checkout", "-qb", "feature"], dir);
    git(["checkout", "-qb", "side"], dir);
    git(["checkout", "-q", "main"], dir);
    for (let i = 1; i <= 30; i++) {
      const branch = i % 3 === 0 ? "main" : i % 3 === 1 ? "feature" : "side";
      const file = branch === "main" ? "m.txt" : branch === "feature" ? "f.txt" : "s.txt";
      git(["checkout", "-q", branch], dir);
      epoch += 300;
      const prior = fs.existsSync(path.join(dir, file))
        ? fs.readFileSync(path.join(dir, file), "utf8")
        : "";
      commitAt(dir, file, `${prior}${i}\n`, `commit ${i}`, epoch, i % 7 === 0 ? "Bob" : undefined);
      if (i === 15) {
        git(["checkout", "-q", "main"], dir);
        epoch += 300;
        mergeAt(dir, "feature", "merge feature", epoch);
      }
    }
    git(["checkout", "-q", "main"], dir);
    epoch += 300;
    mergeAt(dir, "side", "merge side", epoch);
    return dir;
  }

  beforeAll(() => {
    const branchy = makeBranchy(false);
    const dirty = makeBranchy(true);
    const clone = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-clone-"));
    dirs.push(clone);
    cp.execFileSync("git", ["clone", "-q", branchy, clone], { stdio: "pipe" });
    const deep = makeBranchy(false);
    git(["checkout", "-q", "HEAD~3"], deep);
    const tip = makeRepo();
    dirs.push(tip);
    git(
      [
        "checkout",
        "-q",
        cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: tip, encoding: "utf8" }).trim()
      ],
      tip
    );
    const unborn = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-unborn-"));
    dirs.push(unborn);
    git(["init", "-b", "main"], unborn);
    git(["config", "user.email", "t@t.com"], unborn);
    Object.assign(fixtures, {
      branchy: { name: "branchy", dir: branchy },
      dirty: { name: "dirty with stash", dir: dirty },
      clone: { name: "clone with origin/HEAD", dir: clone },
      deep: { name: "detached below the page", dir: deep },
      tip: { name: "detached at the tip", dir: tip },
      unborn: { name: "unborn", dir: unborn },
      roomy: { name: "roomy", dir: makeRoomy() }
    });
  }, 180000);

  afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  function maskVolatile(nodes: GitCommitNode[]): GitCommitNode[] {
    return nodes.map((node) => (node.hash === "*" ? { ...node, date: 0 } : node));
  }

  function collapseCliDuplicates(nodes: GitCommitNode[]): GitCommitNode[] {
    // The loader annotates the last same-hash row (its lookup overwrites per
    // occurrence), so the collapse keeps the last occurrence of each hash.
    const seen = new Set<string>();
    const kept: GitCommitNode[] = [];
    for (let index = nodes.length - 1; index >= 0; index--) {
      const node = nodes[index];
      if (node === undefined || seen.has(node.hash)) continue;
      seen.add(node.hash);
      kept.unshift(node);
    }
    return kept;
  }

  function baseArgs(dir: string): LoadCommitsArgs {
    return {
      branchName: "",
      branches: null,
      authors: null,
      tags: null,
      maxCommits: 100,
      showRemoteBranches: true,
      hiddenRemotes: [],
      showTags: true,
      includeReflog: false,
      includeUnreachableCommits: false,
      onlyFollowFirstParent: false,
      commitOrdering: "date",
      showSignature: false,
      showStashes: false,
      dateType: "Commit Date",
      showUncommittedChanges: true,
      repoPath: dir,
      git: simpleGit(dir),
      hard: false
    };
  }

  async function expectCommitsParity(
    fixture: CommitsFixture,
    label: string,
    overrides: Partial<LoadCommitsArgs>,
    expectedServed: boolean,
    collapseDuplicates = false
  ): Promise<void> {
    const args = { ...baseArgs(fixture.dir), ...overrides };
    const { repoPath, git: _git, ...input } = args;
    resetEngineServedRead();
    const [viaAuto, direct] = await Promise.all([
      createRepoReader({ preference: "auto", gitPath: "git" }).loadCommits({
        ...args,
        git: simpleGit(fixture.dir)
      }),
      loadCommits(simpleGit(fixture.dir), { ...input, repo: repoPath })
    ]);
    expect(didEngineServeRead(), `${fixture.name} ${label} served`).toBe(expectedServed);
    const expectedCommits = maskVolatile(
      collapseDuplicates ? collapseCliDuplicates(direct.commits) : direct.commits
    );
    expect(maskVolatile(viaAuto.commits), `${fixture.name} ${label} commits`).toEqual(
      expectedCommits
    );
    expect(
      { head: viaAuto.head, more: viaAuto.moreCommitsAvailable, error: viaAuto.error },
      `${fixture.name} ${label} meta`
    ).toEqual({ head: direct.head, more: direct.moreCommitsAvailable, error: direct.error });
  }

  it("agrees across orderings, filters, pages and stash display", async (context) => {
    if (loadEngineAddon() === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
      return;
    }
    const branchy = fixtures.branchy;
    for (const commitOrdering of ["date", "author-date"] as const) {
      await expectCommitsParity(branchy, `ordering=${commitOrdering}`, { commitOrdering }, true);
    }
    // Topo stays on the CLI (tie-breaks differ visibly) — still identical.
    await expectCommitsParity(branchy, "ordering=topo", { commitOrdering: "topo" }, false);
    await expectCommitsParity(branchy, "showStashes", { showStashes: true }, true);
    await expectCommitsParity(branchy, "maxCommits", { maxCommits: 1 }, true);
    await expectCommitsParity(branchy, "maxCommits", { maxCommits: 3 }, true);
    await expectCommitsParity(branchy, "branches", { branches: ["main"] }, true);
    await expectCommitsParity(branchy, "branches", { branches: ["feature"] }, true);
    await expectCommitsParity(branchy, "tags", { tags: ["v1.0.0"] }, true);
    await expectCommitsParity(branchy, "authors", { authors: ["Ada"] }, true);
    await expectCommitsParity(branchy, "authors", { authors: ["Bob"] }, true, true);
    await expectCommitsParity(branchy, "showTags", { showTags: false }, true);
    await expectCommitsParity(branchy, "showTags", { showTags: false, tags: ["v1.0.0"] }, true);
    await expectCommitsParity(
      branchy,
      "onlyFollowFirstParent",
      { onlyFollowFirstParent: true },
      true
    );
  }, 180000);

  it("agrees with uncommitted changes and stashes on screen", async (context) => {
    if (loadEngineAddon() === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
      return;
    }
    await expectCommitsParity(fixtures.dirty, "case", {}, true);
    await expectCommitsParity(fixtures.dirty, "showStashes", { showStashes: true }, true);
  }, 120000);

  it("agrees on clones, including origin/HEAD and hidden remotes", async (context) => {
    if (loadEngineAddon() === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
      return;
    }
    await expectCommitsParity(fixtures.clone, "case", {}, true);
    await expectCommitsParity(fixtures.clone, "showStashes", { showStashes: true }, true);
    await expectCommitsParity(fixtures.clone, "maxCommits", { maxCommits: 2 }, true);
    await expectCommitsParity(fixtures.clone, "hiddenRemotes", { hiddenRemotes: ["origin"] }, true);
    await expectCommitsParity(
      fixtures.clone,
      "showRemoteBranches",
      { showRemoteBranches: false },
      true
    );
  }, 120000);

  it("keeps HEAD visible and honors unborn on the CLI", async (context) => {
    if (loadEngineAddon() === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
      return;
    }
    // Detached below the page: the engine page cannot substitute, so the
    // reader reroutes — still identical, served by the CLI.
    await expectCommitsParity(fixtures.deep, "maxCommits", { maxCommits: 2 }, false);
    await expectCommitsParity(fixtures.deep, "case", {}, true);
    await expectCommitsParity(fixtures.tip, "case", {}, true);
    await expectCommitsParity(fixtures.unborn, "case", {}, false);
  }, 120000);

  it("orders a roomy history exactly on all three orderings", async (context) => {
    if (loadEngineAddon() === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
      return;
    }
    for (const commitOrdering of ["date", "author-date"] as const) {
      await expectCommitsParity(
        fixtures.roomy,
        `ordering=${commitOrdering}`,
        { commitOrdering },
        true
      );
    }
    await expectCommitsParity(fixtures.roomy, "ordering=topo", { commitOrdering: "topo" }, false);
    await expectCommitsParity(fixtures.roomy, "maxCommits", { maxCommits: 15 }, true);
    await expectCommitsParity(fixtures.roomy, "authors", { authors: ["Bob"] }, true, true);
  }, 180000);
});

describe("engine/CLI parity: commit details, comparison and files", () => {
  // The 16.6 parity table: renames, copies, binary files, a root commit, an
  // unborn branch, and a file that is modified but unstaged. Every case
  // drives the reader (engine) and the query (CLI) against the same real
  // repository and asserts identical output — a divergence is an engine or
  // mapping bug, never a test to relax. Two documented reroutes: merges
  // diff differently in the engine (first parent only versus the CLI's
  // `-m`), so they stay on the CLI; unborn errors in different words on
  // each side, so only the error shape is pinned there.
  type DetailsFixture = {
    dir: string;
    unborn: string;
    root: string;
    binary: string;
    edit: string;
    rename: string;
    copy: string;
    merge: string;
  };

  const fixture: { current?: DetailsFixture } = {};
  const dirs: string[] = [];
  const EPOCH = 1700000000;

  function commitAt(dir: string, message: string, epoch: number): void {
    cp.execFileSync("git", ["commit", "-m", message], {
      cwd: dir,
      stdio: "pipe",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: `${epoch} +0000`,
        GIT_COMMITTER_DATE: `${epoch} +0000`
      }
    });
  }

  function revParse(dir: string, rev: string): string {
    return cp.execFileSync("git", ["rev-parse", rev], { cwd: dir, encoding: "utf8" }).trim();
  }

  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-details-"));
    dirs.push(dir);
    git(["init", "-b", "main"], dir);
    git(["config", "user.email", "ada@x.com"], dir);
    git(["config", "user.name", "Ada"], dir);
    git(["config", "commit.gpgsign", "false"], dir);
    let epoch = EPOCH;
    const next = (): number => {
      epoch += 600;
      return epoch;
    };

    const rootLines = Array.from({ length: 10 }, (_, index) => `line ${index}`);
    fs.writeFileSync(path.join(dir, "root.txt"), `${rootLines.join("\n")}\n`);
    git(["add", "root.txt"], dir);
    commitAt(dir, "root", next());
    const root = revParse(dir, "HEAD");

    fs.writeFileSync(
      path.join(dir, "blob.bin"),
      Buffer.from([0, 1, 2, 3, 0, 255, 254, 65, 66, 67])
    );
    git(["add", "blob.bin"], dir);
    commitAt(dir, "binary", next());
    const binary = revParse(dir, "HEAD");

    fs.writeFileSync(
      path.join(dir, "root.txt"),
      `${[...rootLines.slice(0, 9), "changed"].join("\n")}\n`
    );
    git(["add", "root.txt"], dir);
    commitAt(dir, "edit", next());
    const edit = revParse(dir, "HEAD");

    git(["mv", "root.txt", "renamed.txt"], dir);
    fs.writeFileSync(
      path.join(dir, "renamed.txt"),
      `${[...rootLines.slice(0, 8), "line eight", "changed"].join("\n")}\n`
    );
    git(["add", "renamed.txt"], dir);
    commitAt(dir, "rename", next());
    const rename = revParse(dir, "HEAD");

    fs.copyFileSync(path.join(dir, "renamed.txt"), path.join(dir, "copied.txt"));
    git(["add", "copied.txt"], dir);
    commitAt(dir, "copy", next());
    const copy = revParse(dir, "HEAD");

    git(["checkout", "-qb", "side"], dir);
    fs.writeFileSync(path.join(dir, "side.txt"), "side\n");
    git(["add", "side.txt"], dir);
    commitAt(dir, "side work", next());
    git(["checkout", "-q", "main"], dir);
    cp.execFileSync("git", ["merge", "-q", "--no-ff", "side", "-m", "merge side"], {
      cwd: dir,
      stdio: "pipe",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: `${next()} +0000`,
        GIT_COMMITTER_DATE: `${epoch} +0000`
      }
    });
    const merge = revParse(dir, "HEAD");

    // Modified but unstaged: the worktree is dirty while every query below
    // reads committed content, so nothing here may leak into the answers.
    fs.appendFileSync(path.join(dir, "renamed.txt"), "dirty\n");

    const unborn = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-details-unborn-"));
    dirs.push(unborn);
    git(["init", "-b", "main"], unborn);
    git(["config", "user.email", "t@t.com"], unborn);

    fixture.current = { dir, unborn, root, binary, edit, rename, copy, merge };
  }, 180000);

  afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  function requireAddon(context: { skip: (message?: string) => never }) {
    if (loadEngineAddon() === null) {
      context.skip("Engine addon not built — run pnpm run engine:build for the engine half.");
    }
  }

  async function expectDetailsParity(
    dir: string,
    commitHash: string,
    label: string,
    expectedServed: boolean
  ): Promise<Awaited<ReturnType<typeof commitDetails>>> {
    resetEngineServedRead();
    const [viaAuto, direct] = await Promise.all([
      createRepoReader({ preference: "auto", gitPath: "git" }).loadCommitDetails({
        repoPath: dir,
        git: simpleGit(dir),
        commitHash,
        dateType: "Commit Date"
      }),
      commitDetails(simpleGit(dir), { commitHash, dateType: "Commit Date", repo: dir })
    ]);
    expect(didEngineServeRead(), `${label} served`).toBe(expectedServed);
    expect(viaAuto, `${label} result`).toEqual(direct);
    return direct;
  }

  async function expectComparisonParity(
    dir: string,
    commitHash: string,
    baseRef: string,
    compareRef: string,
    label: string
  ): Promise<void> {
    resetEngineServedRead();
    const [viaAuto, direct] = await Promise.all([
      createRepoReader({ preference: "auto", gitPath: "git" }).loadCommitComparison({
        repoPath: dir,
        git: simpleGit(dir),
        commitHash,
        baseRef,
        compareRef,
        dateType: "Commit Date"
      }),
      commitComparison(simpleGit(dir), {
        commitHash,
        baseRef,
        compareRef,
        dateType: "Commit Date",
        repo: dir
      })
    ]);
    expect(didEngineServeRead(), `${label} served`).toBe(true);
    expect(viaAuto, `${label} result`).toEqual(direct);
  }

  it("agrees on root, binary, rename and copy commits with a dirty worktree", async (context) => {
    requireAddon(context);
    const current = fixture.current;
    if (current === undefined) throw new Error("details fixture not built");
    await expectDetailsParity(current.dir, current.root, "root", true);
    const binaryResult = await expectDetailsParity(current.dir, current.binary, "binary", true);
    const renameResult = await expectDetailsParity(current.dir, current.rename, "rename", true);
    const copyResult = await expectDetailsParity(current.dir, current.copy, "copy", true);
    await expectDetailsParity(current.dir, current.edit, "edit", true);
    // The fixture must actually exercise the shapes it names: a rename row
    // with settled counts, a copy reported as an addition (neither side
    // passes `-C`), and null counts on the binary row.
    expect(renameResult.commitDetails?.fileChanges).toContainEqual({
      oldFilePath: "root.txt",
      newFilePath: "renamed.txt",
      type: "R",
      additions: 1,
      deletions: 1
    });
    expect(copyResult.commitDetails?.fileChanges).toContainEqual({
      oldFilePath: "copied.txt",
      newFilePath: "copied.txt",
      type: "A",
      additions: 10,
      deletions: 0
    });
    expect(binaryResult.commitDetails?.fileChanges).toContainEqual({
      oldFilePath: "blob.bin",
      newFilePath: "blob.bin",
      type: "A",
      additions: null,
      deletions: null
    });
  }, 120000);

  it("keeps merges on the CLI and errors unborn on both sides", async (context) => {
    requireAddon(context);
    const current = fixture.current;
    if (current === undefined) throw new Error("details fixture not built");
    await expectDetailsParity(current.dir, current.merge, "merge", false);

    resetEngineServedRead();
    const [viaAuto, direct] = await Promise.all([
      createRepoReader({ preference: "auto", gitPath: "git" }).loadCommitDetails({
        repoPath: current.unborn,
        git: simpleGit(current.unborn),
        commitHash: "HEAD",
        dateType: "Commit Date"
      }),
      commitDetails(simpleGit(current.unborn), {
        commitHash: "HEAD",
        dateType: "Commit Date",
        repo: current.unborn
      })
    ]);
    expect(didEngineServeRead(), "unborn served").toBe(false);
    expect(viaAuto.commitDetails, "unborn engine details").toBeNull();
    expect(direct.commitDetails, "unborn CLI details").toBeNull();
    expect(viaAuto.error, "unborn engine error").not.toBeNull();
    expect(direct.error, "unborn CLI error").not.toBeNull();
  }, 120000);

  it("agrees on rename and binary comparisons", async (context) => {
    requireAddon(context);
    const current = fixture.current;
    if (current === undefined) throw new Error("details fixture not built");
    await expectComparisonParity(
      current.dir,
      current.rename,
      current.edit,
      current.rename,
      "rename"
    );
    await expectComparisonParity(current.dir, current.copy, current.rename, current.copy, "copy");
    await expectComparisonParity(
      current.dir,
      current.binary,
      current.root,
      current.binary,
      "binary"
    );
  }, 120000);

  it("reads the same file bytes as git show, and fails the same missing ones", async (context) => {
    requireAddon(context);
    const current = fixture.current;
    if (current === undefined) throw new Error("details fixture not built");
    const addon = loadEngineAddon();
    if (addon === null) throw new Error("details fixture addon missing");

    const textCases = [
      { hash: "HEAD", file: "renamed.txt" },
      { hash: current.rename, file: "renamed.txt" },
      { hash: current.root, file: "root.txt" },
      { hash: current.copy, file: "copied.txt" }
    ];
    for (const { hash, file } of textCases) {
      const parsed = parseEngineCommitFile(await addon.loadCommitFile(current.dir, hash, file));
      const shown = cp.execFileSync("git", ["show", `${hash}:${file}`], { cwd: current.dir });
      expect(parsed?.binary, `${hash}:${file} binary`).toBe(false);
      expect(parsed?.contents, `${hash}:${file} contents`).toBe(shown.toString("utf8"));
    }

    const binary = parseEngineCommitFile(
      await addon.loadCommitFile(current.dir, current.binary, "blob.bin")
    );
    expect(binary).toEqual({ contents: null, binary: true });

    await expect(addon.loadCommitFile(current.dir, "HEAD", "nope.txt")).rejects.toThrow();
    expect(() =>
      cp.execFileSync("git", ["show", "HEAD:nope.txt"], { cwd: current.dir, stdio: "pipe" })
    ).toThrow();
  }, 120000);
});
