import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import {
  parseEngineReflogPage,
  type ReflogAddon,
  type ReflogDeps,
  readReflog
} from "@/backend/engine/reflog";
import { loadReflog, type ReflogRequest } from "@/backend/queries/reflog";
import type { GitReflogResult } from "@/backend/types";
import { setOperationLog } from "@/backend/utils/operationLog";

/**
 * `readReflog` (slice F1-09): the engine serves a reflog page only on
 * `auto`, for a verified repository, when the addon carries `loadReflog`
 * and answers the strict payload. Everything else, and every decline, is
 * the CLI query. The parity half drives the real addon against `loadReflog`
 * over F1-01's fixture scenarios and pins, per scenario, whether the engine
 * serves or declines; the result must be identical either way.
 */

const OLD = "2001-01-01T00:00:00Z";
const OLD_UNIX = 978307200;

const tempDirs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const isolatedEnv: Record<string, string> = {};

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** Runs real Git in a fixture, with no global or system config and a fixed identity. */
function run(args: string[], cwd: string, env: Record<string, string> = {}): string {
  return cp.execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...isolatedEnv, ...env }
  });
}

function initRepo(extra: string[] = []): string {
  const dir = tempDir("ggl-reflog-parity-");
  run(["init", "-q", "-b", "main", ...extra], dir);
  run(["config", "commit.gpgsign", "false"], dir);
  return dir;
}

function commitFile(dir: string, name: string, env: Record<string, string> = {}): void {
  fs.writeFileSync(path.join(dir, name), `${name}\n`);
  run(["add", name], dir);
  run(["commit", "-q", "-m", name], dir, env);
}

beforeAll(() => {
  const home = tempDir("ggl-reflog-parity-home-");
  const globalConfig = path.join(home, "gitconfig");
  fs.writeFileSync(globalConfig, "");
  Object.assign(isolatedEnv, {
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Author",
    GIT_AUTHOR_EMAIL: "author@example.test",
    GIT_COMMITTER_NAME: "Committer",
    GIT_COMMITTER_EMAIL: "committer@example.test",
    GIT_EDITOR: "true"
  });
  // simple-git inherits this process's environment, so the CLI query reads no real config either.
  for (const key of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"]) {
    savedEnv[key] = process.env[key];
    process.env[key] = isolatedEnv[key];
  }
});

afterAll(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const engineDeps = (provider: () => ReflogAddon | null): ReflogDeps => ({
  backend: () => "auto",
  addonProvider: provider,
  isVerified: () => true
});

function engineOnly(): ReflogDeps {
  const addon = loadEngineAddon();
  if (addon === null) {
    throw new Error("Engine addon not built: run pnpm run engine:build.");
  }
  expect(addon.loadReflog, "loadReflog export").toBeTypeOf("function");
  return engineDeps(() => addon);
}

type ServedBy = "engine" | "declined" | "invalidRequest";

/**
 * The engine-first read and the CLI read must return the identical result,
 * served the pinned way: `engine` answers in process, `declined` means the
 * engine handed the read back and the CLI result is what the caller gets.
 */
async function expectParity(
  dir: string,
  request: ReflogRequest,
  served: ServedBy
): Promise<GitReflogResult> {
  const lines: string[] = [];
  const log = setOperationLog((line) => lines.push(line));
  let result: GitReflogResult;
  try {
    result = await readReflog(simpleGit(dir), dir, request, engineOnly());
  } finally {
    log.dispose();
  }
  const viaCli = await loadReflog(simpleGit(dir), dir, request);
  expect(result).toEqual(viaCli);
  const route =
    served === "engine"
      ? "operation=loadReflog backend=engine"
      : `operation=loadReflog backend=cli reason=${served}`;
  expect(lines).toContainEqual(expect.stringContaining(route));
  return result;
}

const HASH = "a".repeat(40);

function entry(overrides: Record<string, unknown> = {}) {
  return {
    hash: HASH,
    index: 0,
    time: 1700000000,
    name: "Committer",
    email: "committer@example.test",
    message: "commit: from the engine",
    ...overrides
  };
}

function page(overrides: Record<string, unknown> = {}) {
  return { entries: [entry()], state: "entries", hasMore: false, ref: "HEAD", ...overrides };
}

describe("parseEngineReflogPage", () => {
  it("maps a page into the CLI result shape", () => {
    const payload = JSON.stringify(
      page({ entries: [entry({ index: 0 }), entry({ index: 2, hash: "b".repeat(40) })] })
    );
    expect(parseEngineReflogPage(payload, 200)).toEqual({
      entries: [entry({ index: 0 }), entry({ index: 2, hash: "b".repeat(40) })],
      state: "entries",
      hasMore: false,
      ref: "HEAD",
      error: null
    });
  });

  it("accepts an empty page past the end, and empty and none states", () => {
    for (const state of ["entries", "empty", "none"]) {
      const payload = JSON.stringify(page({ entries: [], state }));
      expect(parseEngineReflogPage(payload, 200)?.state).toBe(state);
    }
  });

  it.each([
    ["not JSON", "{", 200],
    ["a top-level array", "[]", 200],
    ["entries not an array", JSON.stringify(page({ entries: {} })), 200],
    ["more entries than the limit", JSON.stringify(page({ entries: [entry(), entry()] })), 1],
    ["a short hash", JSON.stringify(page({ entries: [entry({ hash: "abc" })] })), 200],
    ["a negative index", JSON.stringify(page({ entries: [entry({ index: -1 })] })), 200],
    ["a fractional time", JSON.stringify(page({ entries: [entry({ time: 1.5 })] })), 200],
    ["a numeric message", JSON.stringify(page({ entries: [entry({ message: 1 })] })), 200],
    [
      "equal indexes",
      JSON.stringify(page({ entries: [entry(), entry({ hash: "b".repeat(40) })] })),
      200
    ],
    [
      "falling indexes",
      JSON.stringify(
        page({ entries: [entry({ index: 1 }), entry({ index: 0, hash: "b".repeat(40) })] })
      ),
      200
    ],
    ["an unknown state", JSON.stringify(page({ state: "weird" })), 200],
    ["entries under an empty state", JSON.stringify(page({ state: "empty" })), 200],
    ["hasMore on a short page", JSON.stringify(page({ hasMore: true })), 200],
    ["an empty ref", JSON.stringify(page({ ref: "" })), 200]
  ])("rejects %s", (_name, payload, limit) => {
    expect(parseEngineReflogPage(payload, limit)).toBeNull();
  });
});

describe("readReflog routing", () => {
  const repo = (() => {
    const dir = initRepo();
    commitFile(dir, "only");
    return dir;
  })();

  function addonReturning(result: string | Error) {
    const loadReflogFn = vi.fn(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
    );
    return { provider: () => ({ loadReflog: loadReflogFn }), loadReflogFn };
  }

  async function readLogged(
    request: ReflogRequest,
    deps: ReflogDeps
  ): Promise<{ result: GitReflogResult; lines: string[]; labels: string[] }> {
    const lines: string[] = [];
    const labels: string[] = [];
    const log = setOperationLog((line) => lines.push(line));
    try {
      const result = await readReflog(simpleGit(repo), repo, request, deps, (entryInfo) =>
        labels.push(entryInfo.label)
      );
      return { result, lines, labels };
    } finally {
      log.dispose();
    }
  }

  it("serves the engine page without running Git, and logs the engine route", async () => {
    const addon = addonReturning(JSON.stringify(page()));

    const { result, lines, labels } = await readLogged({}, engineDeps(addon.provider));

    expect(addon.loadReflogFn).toHaveBeenCalledWith(repo, "HEAD", 200, 0);
    expect(result).toEqual({ ...page(), error: null });
    expect(labels).toEqual([]);
    expect(lines).toContainEqual(expect.stringContaining("operation=loadReflog backend=engine"));
  });

  it("clamps the limit the engine is asked for, as the CLI query does", async () => {
    const addon = addonReturning(JSON.stringify(page({ entries: [], state: "none" })));

    await readLogged({ limit: 10 ** 9, offset: 3 }, engineDeps(addon.provider));

    expect(addon.loadReflogFn).toHaveBeenCalledWith(repo, "HEAD", 1000, 3);
  });

  const cliCases: [string, ReflogRequest, ReflogDeps, string][] = [
    [
      "the git-cli setting",
      {},
      { ...engineDeps(() => addonReturning("{}").provider()), backend: () => "git-cli" },
      "setting"
    ],
    [
      "an unverified repository",
      {},
      { ...engineDeps(() => addonReturning("{}").provider()), isVerified: () => false },
      "unverified"
    ],
    [
      "a ref the CLI refuses",
      { ref: "-x" },
      engineDeps(() => addonReturning("{}").provider()),
      "invalidRequest"
    ],
    [
      "a zero limit",
      { limit: 0 },
      engineDeps(() => addonReturning("{}").provider()),
      "invalidRequest"
    ],
    ["no addon", {}, engineDeps(() => null), "engineUnavailable"],
    ["an older addon without the export", {}, engineDeps(() => ({})), "noLoadReflog"],
    [
      "a decline",
      {},
      engineDeps(() => addonReturning(new Error("Unsupported: reflog: x")).provider()),
      "declined"
    ],
    [
      "not a repository",
      {},
      engineDeps(() => addonReturning(new Error("NotARepository: no")).provider()),
      "declined"
    ],
    [
      "a trust refusal",
      {},
      engineDeps(() => addonReturning(new Error("Untrusted: not owned")).provider()),
      "declined"
    ],
    [
      "another engine error",
      {},
      engineDeps(() => addonReturning(new Error("Io: disk")).provider()),
      "engineThrew"
    ],
    [
      "a malformed payload",
      {},
      engineDeps(() => addonReturning("[]").provider()),
      "malformedPayload"
    ]
  ];
  it.each(cliCases)("goes to the CLI for %s", async (_name, request, deps, reason) => {
    const { result, lines } = await readLogged(request, deps);

    expect(result).toEqual(await loadReflog(simpleGit(repo), repo, request));
    expect(lines).toContainEqual(
      expect.stringContaining(`operation=loadReflog backend=cli reason=${reason}`)
    );
  });
});

describe("readReflog parity with the CLI query", () => {
  it("matches on plain commits, amend, checkout, merges and reset", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    commitFile(dir, "b");
    run(["commit", "-q", "--amend", "-m", "b, amended"], dir);
    run(["checkout", "-q", "-b", "topic"], dir);
    commitFile(dir, "t");
    run(["checkout", "-q", "main"], dir);
    commitFile(dir, "c");
    run(["merge", "-q", "--no-ff", "topic", "-m", "merge topic"], dir);
    run(["checkout", "-q", "-b", "fast"], dir);
    commitFile(dir, "f");
    run(["checkout", "-q", "main"], dir);
    run(["merge", "-q", "--ff-only", "fast"], dir);
    run(["reset", "-q", "--hard", "HEAD~1"], dir);

    const head = await expectParity(dir, { ref: "HEAD", limit: 1000 }, "engine");
    await expectParity(dir, { ref: "main", limit: 1000 }, "engine");
    await expectParity(dir, { ref: "refs/heads/main", limit: 1000 }, "engine");
    await expectParity(dir, { ref: "topic", limit: 1000 }, "engine");
    const kinds = head.entries.map((e) => e.message.split(":")[0]);
    expect(kinds).toContain("commit (amend)");
    expect(kinds).toContain("checkout");
    expect(kinds).toContain("reset");
  });

  it("matches on a rebase replay, picks included", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    run(["checkout", "-q", "-b", "topic"], dir);
    commitFile(dir, "t");
    run(["checkout", "-q", "main"], dir);
    commitFile(dir, "b");
    run(["rebase", "-q", "main", "topic"], dir);

    const head = await expectParity(dir, { ref: "HEAD", limit: 1000 }, "engine");
    await expectParity(dir, { ref: "topic", limit: 1000 }, "engine");
    expect(head.entries.some((e) => e.message.startsWith("rebase (pick):"))).toBe(true);
    expect(head.entries.some((e) => e.message.startsWith("rebase (finish):"))).toBe(true);
  });

  it("keeps Git's selector-gap numbering, in full and in a window", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    run(["checkout", "-q", "-b", "feat"], dir);
    commitFile(dir, "b");
    run(["branch", "-m", "feat", "feat2"], dir);
    commitFile(dir, "c");

    const all = await expectParity(dir, { ref: "HEAD" }, "engine");
    expect(all.entries.map((e) => e.index)).toEqual([0, 1, 3, 4, 5]);
    await expectParity(dir, { ref: "HEAD", limit: 2, offset: 2 }, "engine");
  });

  it("carries the entry's own time, not the commit's", async () => {
    const dir = initRepo();
    commitFile(dir, "a", { GIT_COMMITTER_DATE: OLD });
    commitFile(dir, "b", { GIT_COMMITTER_DATE: OLD });
    run(["checkout", "-q", "-b", "later", "HEAD~1"], dir, {
      GIT_COMMITTER_DATE: "2010-01-01T00:00:00Z"
    });

    const result = await expectParity(dir, { ref: "HEAD" }, "engine");
    expect(result.entries.map((e) => [e.message.split(":")[0], e.time])).toEqual([
      ["checkout", 1262304000],
      ["commit", OLD_UNIX],
      ["commit (initial)", OLD_UNIX]
    ]);
  });

  it("pages across a boundary, to the exact end and past it", async () => {
    const dir = initRepo();
    for (const name of ["a", "b", "c", "d", "e", "f"]) commitFile(dir, name);

    await expectParity(dir, { limit: 4 }, "engine");
    await expectParity(dir, { limit: 4, offset: 4 }, "engine");
    await expectParity(dir, { limit: 6 }, "engine");
    const pastEnd = await expectParity(dir, { limit: 4, offset: 6 }, "engine");
    expect(pastEnd.state).toBe("entries");
    await expectParity(dir, { limit: 10 ** 9 }, "engine");
  });

  it("matches on a detached HEAD and on the stash ref", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    commitFile(dir, "b");
    run(["checkout", "-q", "--detach", "HEAD~1"], dir);
    commitFile(dir, "d");
    fs.writeFileSync(path.join(dir, "dirty"), "dirty\n");
    run(["stash", "push", "-q", "-u", "-m", "keep"], dir);

    await expectParity(dir, { ref: "HEAD", limit: 1000 }, "engine");
    await expectParity(dir, { ref: "refs/stash" }, "engine");
    await expectParity(dir, { ref: "stash" }, "engine");
  });

  it("matches from a linked worktree, whose HEAD log is its own", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    const linked = path.join(tempDir("ggl-reflog-parity-wt-"), "linked wt");
    run(["worktree", "add", "-q", "-b", "feat", linked], dir);
    commitFile(linked, "linked");
    commitFile(dir, "b");

    await expectParity(dir, { ref: "HEAD", limit: 1000 }, "engine");
    const linkedHead = await expectParity(linked, { ref: "HEAD", limit: 1000 }, "engine");
    expect(linkedHead.entries.some((e) => e.message.includes("linked"))).toBe(true);
    await expectParity(dir, { ref: "feat", limit: 1000 }, "engine");
    await expectParity(linked, { ref: "feat", limit: 1000 }, "engine");
    await expectParity(linked, { ref: "main", limit: 1000 }, "engine");
  });

  it("tells none, empty and unborn apart, declining only where Git falls back", async () => {
    const unborn = initRepo();
    const noneHead = await expectParity(unborn, { ref: "HEAD" }, "engine");
    expect(noneHead.state).toBe("none");
    await expectParity(unborn, { ref: "main" }, "declined");

    const dir = initRepo();
    commitFile(dir, "a");
    run(["tag", "v1"], dir);
    const tag = await expectParity(dir, { ref: "v1" }, "engine");
    expect(tag.state).toBe("none");
    run(["reflog", "expire", "--expire=all", "--all"], dir);
    const expired = await expectParity(dir, { ref: "main" }, "engine");
    expect(expired.state).toBe("empty");
    const expiredHead = await expectParity(dir, { ref: "HEAD" }, "declined");
    expect(expiredHead.state).toBe("empty");
  });

  it("handles core.logAllRefUpdates=false and a bare repository", async () => {
    const noLog = initRepo();
    run(["config", "core.logAllRefUpdates", "false"], noLog);
    commitFile(noLog, "a");
    const branch = await expectParity(noLog, { ref: "main" }, "engine");
    expect(branch.state).toBe("none");
    const head = await expectParity(noLog, { ref: "HEAD" }, "declined");
    expect(head.state).toBe("none");

    const source = initRepo();
    commitFile(source, "a");
    const bare = path.join(tempDir("ggl-reflog-parity-bare-"), "origin.git");
    run(["clone", "-q", "--bare", source, bare], source);
    const bareBranch = await expectParity(bare, { ref: "main" }, "engine");
    expect(bareBranch.state).toBe("none");
    const bareHead = await expectParity(bare, { ref: "HEAD" }, "declined");
    expect(bareHead.state).toBe("none");
  });

  it("declines a malformed line, a fabricated entry and a missing HEAD log", async () => {
    const malformed = initRepo();
    commitFile(malformed, "a");
    fs.appendFileSync(path.join(malformed, ".git/logs/HEAD"), "this is not a reflog line\n");
    const skipped = await expectParity(malformed, { ref: "HEAD" }, "declined");
    expect(skipped.entries.length).toBeGreaterThan(0);

    const missingObject = initRepo();
    commitFile(missingObject, "a");
    const head = run(["rev-parse", "HEAD"], missingObject).trim();
    fs.appendFileSync(
      path.join(missingObject, ".git/logs/HEAD"),
      `${head} ${"d".repeat(40)} Committer <committer@example.test> 1700000000 +0000\tfake: missing\n`
    );
    await expectParity(missingObject, { ref: "HEAD" }, "declined");

    const fallback = initRepo();
    commitFile(fallback, "a");
    run(["checkout", "-q", "-b", "side"], fallback);
    run(["checkout", "-q", "main"], fallback);
    fs.rmSync(path.join(fallback, ".git/logs/HEAD"));
    // Git now answers from the branch log under HEAD selectors.
    const fromBranch = await expectParity(fallback, { ref: "HEAD" }, "declined");
    expect(fromBranch.entries.map((e) => e.message)).toEqual(["commit (initial): a"]);
    await expectParity(fallback, { ref: "main" }, "engine");
  });

  it("declines refs only Git resolves, with the CLI result unchanged", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    run(["symbolic-ref", "refs/heads/alias", "refs/heads/main"], dir);
    await expectParity(dir, { ref: "alias" }, "declined");
    await expectParity(dir, { ref: "no-such-branch" }, "declined");
    await expectParity(dir, { ref: "-x" }, "invalidRequest");
  });
});
