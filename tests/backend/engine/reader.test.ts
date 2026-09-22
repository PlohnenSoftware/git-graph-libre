import * as fs from "node:fs";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineAddon } from "@/backend/engine/addon";
import {
  type AddonProvider,
  createRepoReader,
  didEngineServeRead,
  isEngineFallbackError,
  resetEngineServedRead
} from "@/backend/engine/index";
import { loadRepoInfo } from "@/backend/queries/loadRepoInfo";

const cliCalls = vi.hoisted(() => ({ count: 0 }));
const fallbackReads = vi.hoisted(() => ({ count: 0 }));

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

beforeAll(() => {
  repoWithRemote = makeRepo();
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
  resetEngineServedRead();
});

function fakeAddon(implementation: (repoPath: string) => Promise<string | null>): AddonProvider {
  const addon: EngineAddon = {
    engineVersion: () => "fake",
    remoteUrl: async (repoPath: string) => implementation(repoPath),
    loadRepoInfo: async () => {
      throw new Error("Unsupported: repoInfo not stubbed in this fake");
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
      loadRepoInfo: async () => payload
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
      loadRepoInfo: async () => JSON.stringify({ ...JSON.parse(payload), error: "partial" })
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
        loadRepoInfo: async () => text
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
