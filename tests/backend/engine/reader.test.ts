import * as cp from "node:child_process";
import * as fs from "node:fs";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineAddon } from "@/backend/engine/addon";
import {
  type AddonProvider,
  type CommitComparisonArgs,
  type CommitDetailsArgs,
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

const cliCalls = vi.hoisted(() => ({ count: 0 }));
const fallbackReads = vi.hoisted(() => ({ count: 0 }));
const commitReads = vi.hoisted(() => ({ count: 0 }));
const detailsReads = vi.hoisted(() => ({ count: 0 }));
const comparisonReads = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/backend/queries/loadRepoInfo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/backend/queries/loadRepoInfo")>();
  return {
    ...original,
    loadRepoInfo: (...args: Parameters<typeof original.loadRepoInfo>) => {
      fallbackReads.count += 1;
      return original.loadRepoInfo(...args);
    }
  };
});

vi.mock("@/backend/queries/loadCommits", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/backend/queries/loadCommits")>();
  return {
    ...original,
    loadCommits: (...args: Parameters<typeof original.loadCommits>) => {
      commitReads.count += 1;
      return original.loadCommits(...args);
    }
  };
});

vi.mock("@/backend/queries/commitDetails", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/backend/queries/commitDetails")>();
  return {
    ...original,
    commitDetails: (...args: Parameters<typeof original.commitDetails>) => {
      detailsReads.count += 1;
      return original.commitDetails(...args);
    }
  };
});

vi.mock("@/backend/queries/commitComparison", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/backend/queries/commitComparison")>();
  return {
    ...original,
    commitComparison: (...args: Parameters<typeof original.commitComparison>) => {
      comparisonReads.count += 1;
      return original.commitComparison(...args);
    }
  };
});

vi.mock("@/backend/utils/git", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/backend/utils/git")>();
  return {
    ...original,
    getRemoteUrl: async (...args: Parameters<typeof original.getRemoteUrl>) => {
      cliCalls.count += 1;
      return original.getRemoteUrl(...args);
    }
  };
});

const ORIGIN_URL = "https://github.com/some/repo.git";

let repoWithRemote: string;
let repoWithoutRemote: string;
let initialHash: string;

beforeAll(() => {
  repoWithRemote = makeRepo();
  initialHash = cp
    .execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoWithRemote, encoding: "utf8" })
    .trim();
  git(["remote", "add", "origin", ORIGIN_URL], repoWithRemote);

  repoWithoutRemote = makeRepo();
});

afterAll(() => {
  fs.rmSync(repoWithRemote, { recursive: true, force: true });
  fs.rmSync(repoWithoutRemote, { recursive: true, force: true });
});

beforeEach(() => {
  cliCalls.count = 0;
  fallbackReads.count = 0;
  commitReads.count = 0;
  detailsReads.count = 0;
  comparisonReads.count = 0;
  resetEngineServedRead();
});

function fakeAddon(implementation: (repoPath: string) => Promise<string | null>): AddonProvider {
  const addon: EngineAddon = {
    engineVersion: () => "fake",
    remoteUrl: async (repoPath: string) => implementation(repoPath),
    loadRepoInfo: async () => {
      throw new Error("Unsupported: repoInfo not stubbed in this fake");
    },
    loadCommits: async () => {
      throw new Error("Unsupported: commits not stubbed in this fake");
    },
    loadCommitDetails: async () => {
      throw new Error("Unsupported: details not stubbed");
    },
    loadLineCounts: async () => {
      throw new Error("Unsupported: counts not stubbed");
    },
    loadStashes: async () => {
      throw new Error("Unsupported: stashes not stubbed");
    },
    loadStashDetails: async () => {
      throw new Error("Unsupported: stash details not stubbed");
    },
    compareCommits: async () => {
      throw new Error("Unsupported: compare not stubbed");
    }
  };
  return () => addon;
}

function failingAddon(message: string): AddonProvider {
  return fakeAddon(async () => {
    throw new Error(message);
  });
}

describe("isEngineFallbackError", () => {
  it.each(["NotARepository: no git dir", "Unsupported: reflog tips"])(
    "treats %s as a decline",
    (message) => {
      expect(isEngineFallbackError(new Error(message))).toBe(true);
    }
  );

  it.each([
    "Git: corrupt object",
    "NotFound: no such ref",
    "InvalidArgument: bad hash",
    "Io: denied"
  ])("treats %s as genuine", (message) => {
    expect(isEngineFallbackError(new Error(message))).toBe(false);
  });

  it("treats non-Errors and messageless throws as genuine", () => {
    expect(isEngineFallbackError("Unsupported: bare string")).toBe(false);
    expect(isEngineFallbackError(null)).toBe(false);
    expect(isEngineFallbackError({})).toBe(false);
  });
});

describe("createRepoReader remoteUrl", () => {
  it("never loads the addon on the git-cli preference", async () => {
    const provider = vi.fn<AddonProvider>(() => null);
    const reader = createRepoReader({
      preference: "git-cli",
      gitPath: "git",
      addonProvider: provider
    });

    expect(await reader.getRemoteUrl(repoWithRemote)).toBe(ORIGIN_URL);
    expect(provider).not.toHaveBeenCalled();
    expect(cliCalls.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("uses the CLI when no addon is available", async () => {
    const reader = createRepoReader({
      preference: "auto",
      gitPath: "git",
      addonProvider: () => null
    });

    expect(await reader.getRemoteUrl(repoWithRemote)).toBe(ORIGIN_URL);
    expect(cliCalls.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("serves from the engine and records it", async () => {
    const provider = vi.fn(fakeAddon(async () => ORIGIN_URL));
    const reader = createRepoReader({
      preference: "auto",
      gitPath: "git",
      addonProvider: provider
    });

    expect(await reader.getRemoteUrl(repoWithRemote)).toBe(ORIGIN_URL);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(cliCalls.count).toBe(0);
    expect(didEngineServeRead()).toBe(true);
  });

  it("normalizes the engine value like the CLI arm", async () => {
    const reader = createRepoReader({
      preference: "auto",
      gitPath: "git",
      addonProvider: fakeAddon(async () => "  https://github.com/some/repo.git  ")
    });
    expect(await reader.getRemoteUrl(repoWithRemote)).toBe(ORIGIN_URL);

    const empty = createRepoReader({
      preference: "auto",
      gitPath: "git",
      addonProvider: fakeAddon(async () => "")
    });
    expect(await empty.getRemoteUrl(repoWithRemote)).toBeNull();
    expect(didEngineServeRead()).toBe(true);
  });

  it.each(["NotARepository: not a repo", "Unsupported: declined"])(
    "falls back to the CLI on %s",
    async (message) => {
      const reader = createRepoReader({
        preference: "auto",
        gitPath: "git",
        addonProvider: failingAddon(message)
      });

      expect(await reader.getRemoteUrl(repoWithRemote)).toBe(ORIGIN_URL);
      expect(cliCalls.count).toBe(1);
      expect(didEngineServeRead()).toBe(false);
    }
  );

  it("converts genuine engine failures to null without retrying the CLI", async () => {
    const reader = createRepoReader({
      preference: "auto",
      gitPath: "git",
      addonProvider: failingAddon("Git: corrupt object")
    });

    expect(await reader.getRemoteUrl(repoWithRemote)).toBeNull();
    expect(cliCalls.count).toBe(0);
    expect(didEngineServeRead()).toBe(false);
  });

  it("answers null for a path with no remote on either backend", async () => {
    const reader = createRepoReader({
      preference: "auto",
      gitPath: "git",
      addonProvider: fakeAddon(async () => null)
    });

    expect(await reader.getRemoteUrl(repoWithoutRemote)).toBeNull();
  });
});

describe("createRepoReader repoInfo", () => {
  const payload = JSON.stringify({
    branches: ["main"],
    head: "main",
    remotes: ["origin"],
    stashes: [],
    tags: [],
    error: null
  });

  function repoInfoReader(preference: "auto" | "git-cli", addonProvider?: AddonProvider) {
    return createRepoReader({ preference, gitPath: "git", addonProvider }).loadRepoInfo({
      repoPath: repoWithRemote,
      showStashes: true,
      git: simpleGit(repoWithRemote)
    });
  }

  it("serves the CLI read untouched on the git-cli preference", async () => {
    const provider = vi.fn<AddonProvider>(() => null);
    const [viaReader, direct] = await Promise.all([
      repoInfoReader("git-cli", provider),
      loadRepoInfo(simpleGit(repoWithRemote), { repo: repoWithRemote })
    ]);

    expect(provider).not.toHaveBeenCalled();
    expect(viaReader).toEqual(direct);
    expect(fallbackReads.count).toBe(2);
    expect(didEngineServeRead()).toBe(false);
  });

  it("uses the CLI when no addon is available", async () => {
    const result = await repoInfoReader("auto", () => null);

    expect(result.error).toBeNull();
    expect(result.repoInfo.isRepo).toBe(true);
    expect(fallbackReads.count).toBe(1);
  });

  it("composes the engine payload with CLI fills", async () => {
    const result = await repoInfoReader("auto", () => ({
      engineVersion: () => "fake",
      remoteUrl: async () => null,
      loadRepoInfo: async () => payload,
      loadCommits: async () => {
        throw new Error("Unsupported: commits not stubbed");
      },
      loadCommitDetails: async () => {
        throw new Error("Unsupported: details not stubbed");
      },
      loadLineCounts: async () => {
        throw new Error("Unsupported: counts not stubbed");
      },
      loadStashes: async () => {
        throw new Error("Unsupported: stashes not stubbed");
      },
      loadStashDetails: async () => {
        throw new Error("Unsupported: stash details not stubbed");
      },
      compareCommits: async () => {
        throw new Error("Unsupported: compare not stubbed");
      }
    }));
    const direct = await loadRepoInfo(simpleGit(repoWithRemote), { repo: repoWithRemote });

    expect(result).toEqual(direct);
    expect(fallbackReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(true);
  });

  it.each(["NotARepository: no git dir", "Unsupported: declined"])(
    "falls back to the whole CLI read on %s",
    async (message) => {
      const provider: AddonProvider = () => ({
        engineVersion: () => "fake",
        remoteUrl: async () => null,
        loadRepoInfo: async () => {
          throw new Error(message);
        },
        loadCommits: async () => {
          throw new Error("Unsupported: commits not stubbed");
        },
        loadCommitDetails: async () => {
          throw new Error("Unsupported: details not stubbed");
        },
        loadLineCounts: async () => {
          throw new Error("Unsupported: counts not stubbed");
        },
        loadStashes: async () => {
          throw new Error("Unsupported: stashes not stubbed");
        },
        loadStashDetails: async () => {
          throw new Error("Unsupported: stash details not stubbed");
        },
        compareCommits: async () => {
          throw new Error("Unsupported: compare not stubbed");
        }
      });
      const [viaReader, direct] = await Promise.all([
        repoInfoReader("auto", provider),
        loadRepoInfo(simpleGit(repoWithRemote), { repo: repoWithRemote })
      ]);

      expect(viaReader).toEqual(direct);
      expect(fallbackReads.count).toBe(2);
      expect(didEngineServeRead()).toBe(false);
    }
  );

  it("falls back to the whole CLI read on a reserved partial error", async () => {
    const provider: AddonProvider = () => ({
      engineVersion: () => "fake",
      remoteUrl: async () => null,
      loadRepoInfo: async () => JSON.stringify({ ...JSON.parse(payload), error: "partial" }),
      loadCommits: async () => {
        throw new Error("Unsupported: commits not stubbed");
      },
      loadCommitDetails: async () => {
        throw new Error("Unsupported: details not stubbed");
      },
      loadLineCounts: async () => {
        throw new Error("Unsupported: counts not stubbed");
      },
      loadStashes: async () => {
        throw new Error("Unsupported: stashes not stubbed");
      },
      loadStashDetails: async () => {
        throw new Error("Unsupported: stash details not stubbed");
      },
      compareCommits: async () => {
        throw new Error("Unsupported: compare not stubbed");
      }
    });
    const result = await repoInfoReader("auto", provider);

    expect(result.error).toBeNull();
    expect(result.repoInfo.isRepo).toBe(true);
    expect(fallbackReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it.each(["not json", "[1,2]", JSON.stringify({ ...JSON.parse(payload), tags: [42] })])(
    "surfaces malformed payloads as the read error without retrying",
    async (text) => {
      const provider: AddonProvider = () => ({
        engineVersion: () => "fake",
        remoteUrl: async () => null,
        loadRepoInfo: async () => text,
        loadCommits: async () => {
          throw new Error("Unsupported: commits not stubbed");
        },
        loadCommitDetails: async () => {
          throw new Error("Unsupported: details not stubbed");
        },
        loadLineCounts: async () => {
          throw new Error("Unsupported: counts not stubbed");
        },
        loadStashes: async () => {
          throw new Error("Unsupported: stashes not stubbed");
        },
        loadStashDetails: async () => {
          throw new Error("Unsupported: stash details not stubbed");
        },
        compareCommits: async () => {
          throw new Error("Unsupported: compare not stubbed");
        }
      });
      const result = await repoInfoReader("auto", provider);

      expect(result.repoInfo.isRepo).toBe(true);
      expect(result.error?.message).toContain("malformed repository info");
      expect(fallbackReads.count).toBe(0);
      expect(didEngineServeRead()).toBe(false);
    }
  );

  it("surfaces genuine engine failures as the read error without retrying", async () => {
    const provider: AddonProvider = () => ({
      engineVersion: () => "fake",
      remoteUrl: async () => null,
      loadRepoInfo: async () => {
        throw new Error("Git: corrupt object");
      },
      loadCommits: async () => {
        throw new Error("Unsupported: commits not stubbed");
      },
      loadCommitDetails: async () => {
        throw new Error("Unsupported: details not stubbed");
      },
      loadLineCounts: async () => {
        throw new Error("Unsupported: counts not stubbed");
      },
      loadStashes: async () => {
        throw new Error("Unsupported: stashes not stubbed");
      },
      loadStashDetails: async () => {
        throw new Error("Unsupported: stash details not stubbed");
      },
      compareCommits: async () => {
        throw new Error("Unsupported: compare not stubbed");
      }
    });
    const result = await repoInfoReader("auto", provider);

    expect(result.repoInfo).toEqual({
      isRepo: true,
      head: null,
      headCommit: null,
      authors: [],
      tags: [],
      remotes: [],
      stashes: [],
      stashCount: 0,
      config: {
        userName: { local: null, global: null },
        userEmail: { local: null, global: null }
      }
    });
    expect(result.error?.message).toContain("corrupt object");
    expect(fallbackReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(false);
  });
});

describe("createRepoReader loadCommits", () => {
  const emptyPage = JSON.stringify({
    commits: [],
    head: null,
    tags: [],
    moreCommitsAvailable: false,
    error: null
  });
  // A born repository always carries HEAD on its page: the show-all
  // engine-serve cases use this headed page, while `emptyPage` (head null)
  // exercises the unborn reroute.
  const headedPage = JSON.stringify({
    commits: [
      {
        hash: "a".repeat(40),
        parents: [],
        author: "Ada",
        email: "ada@x.com",
        date: 1790090408,
        message: "only",
        heads: ["main"],
        tags: [],
        remotes: [],
        stash: null
      }
    ],
    head: "a".repeat(40),
    tags: [],
    moreCommitsAvailable: false,
    error: null
  });
  const headedNodes = [
    {
      hash: "a".repeat(40),
      parentHashes: [""],
      author: "Ada",
      email: "ada@x.com",
      date: 1790090408,
      message: "only",
      refs: [{ hash: "a".repeat(40), name: "main", type: "head" }]
    }
  ];

  function commitArgs(overrides: Partial<LoadCommitsArgs> = {}): LoadCommitsArgs {
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
      repoPath: repoWithRemote,
      git: simpleGit(repoWithRemote),
      hard: false,
      ...overrides
    };
  }

  function commitsReader(
    preference: "auto" | "git-cli",
    addonProvider?: AddonProvider,
    overrides: Partial<LoadCommitsArgs> = {}
  ) {
    return createRepoReader({ preference, gitPath: "git", addonProvider }).loadCommits(
      commitArgs(overrides)
    );
  }

  function directCli(overrides: Partial<LoadCommitsArgs> = {}) {
    const args = commitArgs(overrides);
    return loadCommits(simpleGit(repoWithRemote), {
      branchName: args.branchName,
      branches: args.branches,
      authors: args.authors,
      tags: args.tags,
      maxCommits: args.maxCommits,
      showRemoteBranches: args.showRemoteBranches,
      hiddenRemotes: args.hiddenRemotes,
      showTags: args.showTags,
      includeReflog: args.includeReflog,
      includeUnreachableCommits: args.includeUnreachableCommits,
      onlyFollowFirstParent: args.onlyFollowFirstParent,
      commitOrdering: args.commitOrdering,
      showSignature: args.showSignature,
      showStashes: args.showStashes,
      hard: args.hard,
      dateType: args.dateType,
      showUncommittedChanges: args.showUncommittedChanges,
      repo: args.repoPath
    });
  }

  function engineProvider(payload: string): AddonProvider {
    const unsupported = () => {
      throw new Error("Unsupported: details not stubbed");
    };
    return () => ({
      engineVersion: () => "fake",
      remoteUrl: async () => null,
      loadRepoInfo: async () => {
        throw new Error("Unsupported: repoInfo not stubbed");
      },
      loadCommits: async () => payload,
      loadCommitDetails: unsupported,
      loadLineCounts: unsupported,
      loadStashes: unsupported,
      loadStashDetails: unsupported,
      compareCommits: unsupported
    });
  }

  it("serves the CLI read untouched on the git-cli preference", async () => {
    const provider = vi.fn<AddonProvider>(() => null);
    const [viaReader, direct] = await Promise.all([
      commitsReader("git-cli", provider),
      directCli()
    ]);

    expect(provider).not.toHaveBeenCalled();
    expect(viaReader).toEqual(direct);
    expect(commitReads.count).toBe(2);
    expect(didEngineServeRead()).toBe(false);
  });

  it("uses the CLI when no addon is available", async () => {
    const result = await commitsReader("auto", () => null);

    expect(result.error).toBeNull();
    expect(result.commits).toHaveLength(1);
    expect(commitReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("serves an engine page without touching the CLI", async () => {
    const result = await commitsReader("auto", engineProvider(headedPage));

    expect(result).toEqual({
      commits: headedNodes,
      head: "a".repeat(40),
      moreCommitsAvailable: false,
      hard: false,
      error: null
    });
    expect(commitReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(true);
  });

  it("moves the load from engine to CLI the moment the signature column is on", async () => {
    const provider = vi.fn(engineProvider(headedPage));

    const served = await commitsReader("auto", provider);
    expect(served.error).toBeNull();
    expect(commitReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(true);

    resetEngineServedRead();
    const declined = await commitsReader("auto", provider, { showSignature: true });
    expect(declined.error).toBeNull();
    expect(declined.commits).toHaveLength(1);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(commitReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it.each([
    ["Author Date", { dateType: "Author Date" } as Partial<LoadCommitsArgs>],
    ["reflog on a show-all load", { includeReflog: true } as Partial<LoadCommitsArgs>],
    [
      "unreachable discovery on a show-all load",
      { includeUnreachableCommits: true } as Partial<LoadCommitsArgs>
    ],
    ["a --glob= pattern", { branches: ["--glob=feature/*"] } as Partial<LoadCommitsArgs>],
    ["topo ordering", { commitOrdering: "topo" } as Partial<LoadCommitsArgs>]
  ])("declines %s to the CLI without loading the addon", async (_name, overrides) => {
    const provider = vi.fn(engineProvider(emptyPage));
    const result = await commitsReader("auto", provider, overrides);

    expect(result.error).toBeNull();
    expect(provider).not.toHaveBeenCalled();
    expect(commitReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("keeps reflog and unreachable flags on the engine with explicit refs", async () => {
    const result = await commitsReader("auto", engineProvider(headedPage), {
      branches: ["main"],
      includeReflog: true,
      includeUnreachableCommits: true
    });

    expect(result.error).toBeNull();
    expect(commitReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(true);
  });

  it.each(["NotARepository: no git dir", "Unsupported: declined"])(
    "falls back to the whole CLI read on %s",
    async (message) => {
      const provider: AddonProvider = () => ({
        engineVersion: () => "fake",
        remoteUrl: async () => null,
        loadRepoInfo: async () => {
          throw new Error("Unsupported: repoInfo not stubbed");
        },
        loadCommits: async () => {
          throw new Error(message);
        },
        loadCommitDetails: async () => {
          throw new Error("Unsupported: details not stubbed");
        },
        loadLineCounts: async () => {
          throw new Error("Unsupported: counts not stubbed");
        },
        loadStashes: async () => {
          throw new Error("Unsupported: stashes not stubbed");
        },
        loadStashDetails: async () => {
          throw new Error("Unsupported: stash details not stubbed");
        },
        compareCommits: async () => {
          throw new Error("Unsupported: compare not stubbed");
        }
      });
      const [viaReader, direct] = await Promise.all([commitsReader("auto", provider), directCli()]);

      expect(viaReader).toEqual(direct);
      expect(commitReads.count).toBe(2);
      expect(didEngineServeRead()).toBe(false);
    }
  );

  it("falls back to the whole CLI read on a reserved partial error", async () => {
    const result = await commitsReader(
      "auto",
      engineProvider(JSON.stringify({ ...JSON.parse(emptyPage), error: "partial" }))
    );

    expect(result.error).toBeNull();
    expect(result.commits).toHaveLength(1);
    expect(commitReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("leaves unborn repositories on the CLI, which owns the empty-graph shape", async () => {
    const result = await commitsReader("auto", engineProvider(emptyPage));

    expect(result.error).toBeNull();
    expect(result.commits).toHaveLength(1);
    expect(commitReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("reroutes a show-all page that lost HEAD back to the whole CLI read", async () => {
    const page = JSON.stringify({
      commits: [
        {
          hash: "a".repeat(40),
          parents: [],
          author: "Ada",
          email: "ada@x.com",
          date: 1790090408,
          message: "elsewhere",
          heads: [],
          tags: [],
          remotes: [],
          stash: null
        }
      ],
      head: "f".repeat(40),
      tags: [],
      moreCommitsAvailable: true,
      error: null
    });
    const result = await commitsReader("auto", engineProvider(page));

    expect(result.error).toBeNull();
    expect(result.commits).toHaveLength(1);
    expect(commitReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("serves a filtered page without HEAD from the engine", async () => {
    const page = JSON.stringify({
      commits: [],
      head: "f".repeat(40),
      tags: [],
      moreCommitsAvailable: false,
      error: null
    });
    const result = await commitsReader("auto", engineProvider(page), { authors: ["Nobody"] });

    expect(result.error).toBeNull();
    expect(commitReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(true);
  });

  it.each(["not json", "[1]", JSON.stringify({ ...JSON.parse(emptyPage), tags: [42] })])(
    "surfaces malformed payloads as the read error without retrying",
    async (text) => {
      const result = await commitsReader("auto", engineProvider(text));

      expect(result.commits).toEqual([]);
      expect(result.error?.message).toContain("malformed commit data");
      expect(commitReads.count).toBe(0);
      expect(didEngineServeRead()).toBe(false);
    }
  );

  it("surfaces genuine engine failures as the read error without retrying", async () => {
    const provider: AddonProvider = () => ({
      engineVersion: () => "fake",
      remoteUrl: async () => null,
      loadRepoInfo: async () => {
        throw new Error("Unsupported: repoInfo not stubbed");
      },
      loadCommits: async () => {
        throw new Error("Git: corrupt object");
      },
      loadCommitDetails: async () => {
        throw new Error("Unsupported: details not stubbed");
      },
      loadLineCounts: async () => {
        throw new Error("Unsupported: counts not stubbed");
      },
      loadStashes: async () => {
        throw new Error("Unsupported: stashes not stubbed");
      },
      loadStashDetails: async () => {
        throw new Error("Unsupported: stash details not stubbed");
      },
      compareCommits: async () => {
        throw new Error("Unsupported: compare not stubbed");
      }
    });
    const result = await commitsReader("auto", provider);

    expect(result).toEqual({
      commits: [],
      head: null,
      moreCommitsAvailable: false,
      hard: false,
      error: result.error
    });
    expect(result.error?.message).toContain("corrupt object");
    expect(commitReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(false);
  });
});

describe("createRepoReader loadCommitDetails", () => {
  const detailsPayload = JSON.stringify({
    hash: "a".repeat(40),
    parents: [],
    author: "Ada",
    authorEmail: "ada@x.com",
    authorDate: 1790090408,
    committer: "Ada",
    committerEmail: "ada@x.com",
    committerDate: 1790090408,
    signature: null,
    body: "only\n",
    fileChanges: [
      { oldFilePath: "f", newFilePath: "f", type: "M", additions: null, deletions: null }
    ]
  });
  const countsPayload = JSON.stringify({ f: { additions: 1, deletions: 0 } });
  const servedNodes = {
    commitDetails: {
      hash: "a".repeat(40),
      parents: [],
      author: "Ada",
      email: "ada@x.com",
      authorDate: 1790090408,
      committer: "Ada",
      committerEmail: "ada@x.com",
      committerDate: 1790090408,
      body: "only",
      fileChanges: [{ oldFilePath: "f", newFilePath: "f", type: "M", additions: 1, deletions: 0 }]
    },
    error: null
  };

  function detailsReader(
    preference: "auto" | "git-cli",
    addonProvider?: AddonProvider,
    overrides: Partial<CommitDetailsArgs> = {}
  ) {
    return createRepoReader({ preference, gitPath: "git", addonProvider }).loadCommitDetails({
      repoPath: repoWithRemote,
      git: simpleGit(repoWithRemote),
      commitHash: initialHash,
      dateType: "Commit Date",
      ...overrides
    });
  }

  function directDetails(overrides: { commitHash?: string } = {}) {
    return commitDetails(simpleGit(repoWithRemote), {
      commitHash: initialHash,
      dateType: "Commit Date",
      repo: repoWithRemote,
      ...overrides
    });
  }

  function detailsAddon(impl: {
    details?: () => Promise<string>;
    counts?: () => Promise<string>;
    stashes?: () => Promise<string>;
    stashDetails?: (repoPath: string, hash: string, stashJson: string) => Promise<string>;
  }): AddonProvider {
    const unsupported = (): Promise<string> => {
      throw new Error("Unsupported");
    };
    return () => ({
      engineVersion: () => "fake",
      remoteUrl: async () => null,
      loadRepoInfo: unsupported,
      loadCommits: unsupported,
      loadCommitDetails: impl.details ?? unsupported,
      loadLineCounts: impl.counts ?? unsupported,
      loadStashes: impl.stashes ?? unsupported,
      loadStashDetails: impl.stashDetails ?? unsupported,
      compareCommits: unsupported
    });
  }

  it("serves the CLI read untouched on the git-cli preference", async () => {
    const provider = vi.fn<AddonProvider>(() => null);
    const [viaReader, direct] = await Promise.all([
      detailsReader("git-cli", provider),
      directDetails()
    ]);

    expect(provider).not.toHaveBeenCalled();
    expect(viaReader).toEqual(direct);
    expect(detailsReads.count).toBe(2);
    expect(didEngineServeRead()).toBe(false);
  });

  it("uses the CLI when no addon is available", async () => {
    const result = await detailsReader("auto", () => null);

    expect(result.error).toBeNull();
    expect(result.commitDetails?.fileChanges).toHaveLength(1);
    expect(detailsReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("serves an engine page with settled counts without touching the CLI", async () => {
    const result = await detailsReader(
      "auto",
      detailsAddon({
        details: async () => detailsPayload,
        counts: async () => countsPayload,
        stashes: async () => "[]"
      })
    );

    expect(result).toEqual(servedNodes);
    expect(detailsReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(true);
  });

  it.each([
    ["the * row", "*"],
    ["a blank hash", "  "]
  ])("keeps %s on the CLI without loading the addon", async (_name, commitHash) => {
    const provider = vi.fn(
      detailsAddon({
        details: async () => detailsPayload,
        counts: async () => countsPayload,
        stashes: async () => "[]"
      })
    );
    const result = await detailsReader("auto", provider, { commitHash });

    expect(provider).not.toHaveBeenCalled();
    expect(result.commitDetails).toBeNull();
    expect(result.error).not.toBeNull();
    expect(detailsReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("reroutes a merge back to the whole CLI read", async () => {
    const merged = JSON.stringify({
      ...JSON.parse(detailsPayload),
      parents: ["b".repeat(40), "c".repeat(40)]
    });
    const result = await detailsReader(
      "auto",
      detailsAddon({
        details: async () => merged,
        counts: async () => countsPayload,
        stashes: async () => "[]"
      })
    );

    expect(result.error).toBeNull();
    expect(result.commitDetails?.fileChanges).toHaveLength(1);
    expect(detailsReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it("takes stash hashes through load_stash_details with the base as from", async () => {
    const stashHash = "c".repeat(40);
    const stashDetailsPayload = JSON.stringify({
      ...JSON.parse(detailsPayload),
      hash: stashHash,
      fileChanges: [
        { oldFilePath: "s", newFilePath: "s", type: "A", additions: null, deletions: null }
      ]
    });
    const stashDetailsFn = vi.fn(async () => stashDetailsPayload);
    const countsFn = vi.fn(async () => JSON.stringify({ s: { additions: 2, deletions: 0 } }));
    const result = await detailsReader(
      "auto",
      detailsAddon({
        details: async () => detailsPayload,
        counts: countsFn,
        stashes: async () =>
          JSON.stringify([
            {
              hash: stashHash,
              baseHash: "b".repeat(40),
              untrackedFilesHash: null,
              selector: "refs/stash@{0}"
            }
          ]),
        stashDetails: stashDetailsFn
      }),
      { commitHash: stashHash }
    );

    expect(stashDetailsFn).toHaveBeenCalledWith(
      repoWithRemote,
      stashHash,
      JSON.stringify({
        selector: "refs/stash@{0}",
        baseHash: "b".repeat(40),
        untrackedFilesHash: null
      })
    );
    expect(countsFn).toHaveBeenCalledWith(
      repoWithRemote,
      "b".repeat(40),
      stashHash,
      JSON.stringify(["s"])
    );
    expect(result.commitDetails?.fileChanges).toEqual([
      { oldFilePath: "s", newFilePath: "s", type: "A", additions: 2, deletions: 0 }
    ]);
    expect(result.error).toBeNull();
    expect(detailsReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(true);
  });

  it("reroutes to the whole CLI read on malformed counts", async () => {
    const result = await detailsReader(
      "auto",
      detailsAddon({
        details: async () => detailsPayload,
        counts: async () => "not json",
        stashes: async () => "[]"
      })
    );

    expect(result.error).toBeNull();
    expect(result.commitDetails?.fileChanges).toHaveLength(1);
    expect(detailsReads.count).toBe(1);
    expect(didEngineServeRead()).toBe(false);
  });

  it.each(["not json", "[1]"])(
    "surfaces malformed payloads as the read error without retrying",
    async (text) => {
      const result = await detailsReader(
        "auto",
        detailsAddon({
          details: async () => text,
          counts: async () => countsPayload,
          stashes: async () => "[]"
        })
      );

      expect(result.commitDetails).toBeNull();
      expect(result.error?.message).toContain("malformed");
      expect(detailsReads.count).toBe(0);
      expect(didEngineServeRead()).toBe(false);
    }
  );

  it("surfaces genuine engine failures as the read error without retrying", async () => {
    const result = await detailsReader(
      "auto",
      detailsAddon({
        details: async () => {
          throw new Error("Git: corrupt object");
        },
        counts: async () => countsPayload,
        stashes: async () => "[]"
      })
    );

    expect(result.commitDetails).toBeNull();
    expect(result.error?.message).toContain("corrupt object");
    expect(detailsReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(false);
  });

  it.each(["NotARepository: no git dir", "Unsupported: declined"])(
    "falls back to the whole CLI read on %s",
    async (message) => {
      const provider = detailsAddon({
        details: async () => {
          throw new Error(message);
        },
        counts: async () => countsPayload,
        stashes: async () => "[]"
      });
      const [viaReader, direct] = await Promise.all([
        detailsReader("auto", provider),
        directDetails()
      ]);

      expect(viaReader).toEqual(direct);
      expect(detailsReads.count).toBe(2);
      expect(didEngineServeRead()).toBe(false);
    }
  );
});

describe("createRepoReader loadCommitComparison", () => {
  const changesPayload = JSON.stringify([
    { oldFilePath: "f", newFilePath: "g", type: "R", additions: null, deletions: null }
  ]);

  function comparisonReader(
    preference: "auto" | "git-cli",
    addonProvider?: AddonProvider,
    overrides: Partial<CommitComparisonArgs> = {}
  ) {
    return createRepoReader({ preference, gitPath: "git", addonProvider }).loadCommitComparison({
      repoPath: repoWithRemote,
      git: simpleGit(repoWithRemote),
      commitHash: initialHash,
      baseRef: initialHash,
      compareRef: "HEAD",
      dateType: "Commit Date",
      ...overrides
    });
  }

  function directComparison(overrides: Partial<CommitComparisonArgs> = {}) {
    const args = {
      repoPath: repoWithRemote,
      commitHash: initialHash,
      baseRef: initialHash,
      compareRef: "HEAD",
      dateType: "Commit Date" as const,
      ...overrides
    };
    return commitComparison(simpleGit(repoWithRemote), {
      commitHash: args.commitHash,
      baseRef: args.baseRef,
      compareRef: args.compareRef,
      dateType: args.dateType,
      repo: args.repoPath
    });
  }

  function comparisonAddon(impl: {
    details?: () => Promise<string>;
    compare?: () => Promise<string>;
    counts?: () => Promise<string>;
  }): AddonProvider {
    const unsupported = (): Promise<string> => {
      throw new Error("Unsupported");
    };
    return () => ({
      engineVersion: () => "fake",
      remoteUrl: async () => null,
      loadRepoInfo: unsupported,
      loadCommits: unsupported,
      loadCommitDetails: impl.details ?? unsupported,
      loadLineCounts: impl.counts ?? unsupported,
      loadStashes: unsupported,
      loadStashDetails: unsupported,
      compareCommits: impl.compare ?? unsupported
    });
  }

  const headerPayload = JSON.stringify({
    hash: "a".repeat(40),
    parents: [],
    author: "Ada",
    authorEmail: "ada@x.com",
    authorDate: 1790090408,
    committer: "Ada",
    committerEmail: "ada@x.com",
    committerDate: 1790090408,
    signature: null,
    body: "only\n",
    fileChanges: []
  });

  it("serves the CLI read untouched on the git-cli preference", async () => {
    const provider = vi.fn<AddonProvider>(() => null);
    const [viaReader, direct] = await Promise.all([
      comparisonReader("git-cli", provider),
      directComparison()
    ]);

    expect(provider).not.toHaveBeenCalled();
    expect(viaReader).toEqual(direct);
    expect(comparisonReads.count).toBe(2);
    expect(didEngineServeRead()).toBe(false);
  });

  it("serves an engine comparison with settled counts", async () => {
    const result = await comparisonReader(
      "auto",
      comparisonAddon({
        details: async () => headerPayload,
        compare: async () => changesPayload,
        counts: async () => JSON.stringify({ g: { additions: 1, deletions: 1 } })
      })
    );

    expect(result).toEqual({
      commitDetails: {
        hash: "a".repeat(40),
        parents: [],
        author: "Ada",
        email: "ada@x.com",
        authorDate: 1790090408,
        committer: "Ada",
        committerEmail: "ada@x.com",
        committerDate: 1790090408,
        body: "only",
        fileChanges: [{ oldFilePath: "f", newFilePath: "g", type: "R", additions: 1, deletions: 1 }]
      },
      error: null
    });
    expect(comparisonReads.count).toBe(0);
    expect(didEngineServeRead()).toBe(true);
  });

  it.each([
    ["a blank hash", { commitHash: "  " } as Partial<CommitComparisonArgs>],
    ["a blank base", { baseRef: "" } as Partial<CommitComparisonArgs>],
    ["a blank compare ref", { compareRef: " " } as Partial<CommitComparisonArgs>]
  ])("reproduces the CLI validation error for %s", async (_name, overrides) => {
    const provider = vi.fn(
      comparisonAddon({
        details: async () => headerPayload,
        compare: async () => changesPayload,
        counts: async () => "{}"
      })
    );
    const [viaReader, direct] = await Promise.all([
      comparisonReader("auto", provider, overrides),
      directComparison(overrides)
    ]);

    expect(provider).not.toHaveBeenCalled();
    expect(viaReader).toEqual(direct);
    expect(viaReader.error?.message).toContain("is required");
    expect(comparisonReads.count).toBe(2);
    expect(didEngineServeRead()).toBe(false);
  });

  it("surfaces genuine engine failures and falls back on declines", async () => {
    const genuine = await comparisonReader(
      "auto",
      comparisonAddon({
        details: async () => {
          throw new Error("Git: corrupt object");
        },
        compare: async () => changesPayload,
        counts: async () => "{}"
      })
    );
    expect(genuine.commitDetails).toBeNull();
    expect(genuine.error?.message).toContain("corrupt object");
    expect(comparisonReads.count).toBe(0);

    const declined = await comparisonReader(
      "auto",
      comparisonAddon({
        details: async () => {
          throw new Error("Unsupported: declined");
        },
        compare: async () => changesPayload,
        counts: async () => "{}"
      })
    );
    const direct = await directComparison();
    expect(declined).toEqual(direct);
    expect(comparisonReads.count).toBe(2);
    expect(didEngineServeRead()).toBe(false);
  });
});
