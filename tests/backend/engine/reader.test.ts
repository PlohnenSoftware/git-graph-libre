import * as fs from "node:fs";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineAddon } from "@/backend/engine/addon";
import {
  type AddonProvider,
  createRepoReader,
  didEngineServeRead,
  isEngineFallbackError,
  resetEngineServedRead
} from "@/backend/engine/index";

const cliCalls = vi.hoisted(() => ({ count: 0 }));

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
  resetEngineServedRead();
});

function fakeAddon(implementation: (repoPath: string) => Promise<string | null>): AddonProvider {
  const addon: EngineAddon = {
    engineVersion: () => "fake",
    remoteUrl: async (repoPath: string) => implementation(repoPath)
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
