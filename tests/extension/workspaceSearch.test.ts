import * as assert from "node:assert";
import * as fs from "node:fs";
import { makeRepo } from "@tests/backend/helpers";
import type { Config } from "@/config";
import type { RepoManager } from "@/extension/repoManager";
import { createRepoSearch, scanLogLevel } from "@/extension/workspaceSearch";

function makeStubs(initialRepoPaths: string[] = [], maxDepth = 2, gitPath = "git") {
  const repos: Record<string, { columnWidths: null }> = {};
  for (const r of initialRepoPaths) repos[r] = { columnWidths: null };

  const added: string[] = [];
  let sendCount = 0;

  const repoManager = {
    getRepos: () => ({ ...repos }),
    getKnownRepos: () => ({ ...repos }),
    addRepo: (path: string) => {
      repos[path] = { columnWidths: null };
      added.push(path);
    },
    removeRepo: (path: string) => {
      delete repos[path];
    },
    setRepoUnavailable: () => {},
    sendRepos: () => {
      sendCount++;
    }
  };

  let currentMaxDepth = maxDepth;
  const config = {
    maxDepthOfRepoSearch: () => currentMaxDepth,
    gitPath: () => gitPath,
    backend: () => "auto"
  };

  const logged: { level: string; message: string }[] = [];
  const repoSearch = createRepoSearch(
    repoManager as unknown as RepoManager,
    config as unknown as Config,
    {
      log: (message: string) => {
        logged.push({ level: "log", message });
      },
      warn: (message: string) => {
        logged.push({ level: "warn", message });
      }
    }
  );

  return {
    repoSearch,
    added,
    logged,
    getSendCount: () => sendCount,
    setMaxDepth: (d: number) => {
      currentMaxDepth = d;
    }
  };
}

suite("workspaceSearch / searchDirectoryForRepos", () => {
  let repo: string;

  setup(() => {
    repo = makeRepo();
  });

  teardown(() => {
    if (fs.existsSync(repo)) fs.rmSync(repo, { recursive: true, force: true });
  });

  test("returns true and adds repo when a git repo is found", async () => {
    const { repoSearch, added } = makeStubs();
    const found = await repoSearch.searchDirectoryForRepos(repo, 0);
    assert.strictEqual(found, true);
    assert.deepStrictEqual(added, [repo]);
  });

  test("returns false for a non-repo directory", async () => {
    const { repoSearch, added } = makeStubs();
    const dir = fs.mkdtempSync(`${repo}-plain-`);
    try {
      const found = await repoSearch.searchDirectoryForRepos(dir, 0);
      assert.strictEqual(found, false);
      assert.deepStrictEqual(added, []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns false for a non-existent directory", async () => {
    const { repoSearch, added } = makeStubs();
    const found = await repoSearch.searchDirectoryForRepos("/tmp/ngg-does-not-exist-xyz", 0);
    assert.strictEqual(found, false);
    assert.deepStrictEqual(added, []);
  });

  test("re-probes repos already in repoManager and re-adds them when ready", async () => {
    // Discovery must revisit known paths so a repository that became
    // untrusted (or recovered) is noticed; the manager's add is a no-op
    // for a repository it already holds.
    const { repoSearch, added } = makeStubs([repo]);
    const found = await repoSearch.searchDirectoryForRepos(repo, 0);
    assert.strictEqual(found, true);
    assert.deepStrictEqual(added, [repo]);
  });

  test("finds repo nested at depth 1", async () => {
    const parent = fs.mkdtempSync(`${repo}-parent-`);
    const nested = `${parent}/nested-repo`;
    fs.mkdirSync(nested);
    // copy repo into nested
    fs.cpSync(repo, nested, { recursive: true });
    try {
      const { repoSearch, added } = makeStubs();
      const found = await repoSearch.searchDirectoryForRepos(parent, 1);
      assert.strictEqual(found, true);
      assert.ok(added.some((p) => p.startsWith(parent)));
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  test("does not find repos beyond maxDepth", async () => {
    const parent = fs.mkdtempSync(`${repo}-deep-`);
    const level1 = `${parent}/level1`;
    const level2 = `${level1}/level2`;
    fs.mkdirSync(level2, { recursive: true });
    fs.cpSync(repo, `${level2}/repo`, { recursive: true });
    try {
      const { repoSearch, added } = makeStubs();
      const found = await repoSearch.searchDirectoryForRepos(parent, 1);
      assert.strictEqual(found, false);
      assert.deepStrictEqual(added, []);
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });
});

suite("workspaceSearch / maxDepthChanged", () => {
  test("does not trigger workspace search when depth stays the same", () => {
    const { repoSearch, getSendCount, setMaxDepth } = makeStubs([], 2);
    setMaxDepth(2);
    repoSearch.maxDepthChanged();
    assert.strictEqual(getSendCount(), 0);
  });

  test("does not trigger workspace search when depth decreases", () => {
    const { repoSearch, getSendCount, setMaxDepth } = makeStubs([], 3);
    setMaxDepth(1);
    repoSearch.maxDepthChanged();
    assert.strictEqual(getSendCount(), 0);
  });

  test("scanLogLevel warns only on an empty scan", () => {
    assert.strictEqual(scanLogLevel(0), "warn");
    assert.strictEqual(scanLogLevel(1), "log");
    assert.strictEqual(scanLogLevel(12), "log");
  });

  test("workspace scan logs one summary naming the git binary", async () => {
    const { repoSearch, logged } = makeStubs([], 2, "git");
    await repoSearch.searchWorkspaceForRepos();

    // The scan also logs one probe line per directory it inspects; the
    // summary is the single "scan complete" line among them.
    const summaries = logged.filter((entry) => entry.message.includes("workspace scan complete"));
    assert.strictEqual(summaries.length, 1);
    assert.ok(summaries[0].message.includes('(git: "git"'));
  });

  test("after depth increase, same depth again does not re-trigger search", async () => {
    const { repoSearch, getSendCount, setMaxDepth } = makeStubs([], 2);
    setMaxDepth(5);
    repoSearch.maxDepthChanged(); // increases — may trigger workspace search depending on folders
    const countAfterIncrease = getSendCount();
    setMaxDepth(5); // same value, no increase
    repoSearch.maxDepthChanged();
    assert.strictEqual(getSendCount(), countAfterIncrease);
  });
});
