import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { simpleGit } from "simple-git";

import {
  buildRepoInfoOptions,
  composeEngineRepoInfo,
  loadEngineConfig,
  mapEngineStash,
  parseEngineConfigList,
  parseEngineRepoInfo,
  resolveGlobalGitConfigPath,
  resolveLocalGitConfigPath,
  type EngineRepoInfo,
  type EngineStash
} from "@/backend/engine/repoInfo";
import { loadRepoInfo } from "@/backend/queries/loadRepoInfo";

import { git, makeRepo } from "@tests/backend/helpers";

const STASH: EngineStash = {
  hash: "06277a53e3d25586becfb94aa7d5f37c308db94b",
  baseHash: "7a13c9b4d222df6396c58755c4aa12c331d3ef34",
  untrackedFilesHash: null,
  selector: "refs/stash@{0}",
  author: "T",
  email: "t@t.com",
  date: 1790090408,
  message: "On main: wip"
};

const INFO: EngineRepoInfo = {
  branches: ["main"],
  head: "main",
  remotes: ["origin"],
  stashes: [STASH],
  tags: ["v1.0.0"],
  error: null
};

describe("buildRepoInfoOptions", () => {
  it("threads the stash toggle with engine defaults for the rest", () => {
    expect(JSON.parse(buildRepoInfoOptions(true))).toEqual({
      showRemoteBranches: true,
      showRemoteHeads: false,
      hideRemotes: [],
      showStashes: true
    });
    expect(JSON.parse(buildRepoInfoOptions(false)).showStashes).toBe(false);
  });
});

describe("parseEngineRepoInfo", () => {
  it("decodes a complete payload", () => {
    expect(parseEngineRepoInfo(JSON.stringify(INFO))).toEqual(INFO);
  });

  it.each(["not json", "[1,2]", "null", '"str"', "42"])("rejects %s", (text) => {
    expect(parseEngineRepoInfo(text)).toBeNull();
  });

  it("rejects payloads with missing or mistyped fields", () => {
    expect(parseEngineRepoInfo(JSON.stringify({ ...INFO, tags: "v1.0.0" }))).toBeNull();
    expect(parseEngineRepoInfo(JSON.stringify({ ...INFO, head: 42 }))).toBeNull();
    expect(
      parseEngineRepoInfo(JSON.stringify({ ...INFO, stashes: [{ ...STASH, date: "x" }] }))
    ).toBeNull();
    const { branches, ...withoutBranches } = INFO;
    expect(branches).toEqual(["main"]);
    expect(parseEngineRepoInfo(JSON.stringify(withoutBranches))).toBeNull();
  });
});

describe("mapEngineStash", () => {
  it("maps the whole ref onto the CLI contract", () => {
    expect(mapEngineStash(STASH)).toEqual({
      index: 0,
      ref: "stash@{0}",
      hash: "06277a53e3d25586becfb94aa7d5f37c308db94b",
      message: "On main: wip",
      date: 1790090408,
      sourceHash: "7a13c9b4d222df6396c58755c4aa12c331d3ef34"
    });
  });

  it("accepts an already-short selector and nulls empty hashes", () => {
    const mapped = mapEngineStash({ ...STASH, selector: "stash@{2}", baseHash: "" });
    expect(mapped?.ref).toBe("stash@{2}");
    expect(mapped?.index).toBe(2);
    expect(mapped?.sourceHash).toBeNull();
  });

  it.each(["stash@{x}", "refs/heads/main", "", "stash@{-1}"])(
    "refuses the unmappable selector %s",
    (selector) => {
      expect(mapEngineStash({ ...STASH, selector })).toBeNull();
    }
  );
});

describe("composeEngineRepoInfo", () => {
  let repo: string;

  beforeAll(() => {
    repo = makeRepo();
    git(["remote", "add", "origin", "https://github.com/some/repo.git"], repo);
    git(["tag", "v1.0.0"], repo);
    fs.writeFileSync(`${repo}/f`, "dirty");
    git(["stash", "push", "-m", "wip"], repo);
  });

  afterAll(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("matches the whole CLI read on a featured repository", async () => {
    // The values that must agree come from the repository itself, read back
    // with plain git; only the selector shape is engine-specific, and that
    // is what this pins.
    const read = (args: string[]): string =>
      cp.execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
    const engineInfo: EngineRepoInfo = {
      branches: ["main"],
      head: "main",
      remotes: ["origin"],
      stashes: [
        {
          hash: read(["stash", "list", "--format=%H"]),
          baseHash: read(["rev-parse", "HEAD"]),
          untrackedFilesHash: null,
          selector: "refs/stash@{0}",
          author: "Tester",
          email: "tester@example.com",
          date: Number.parseInt(read(["stash", "list", "--format=%ct"]), 10),
          message: "On main: wip"
        }
      ],
      tags: ["v1.0.0"],
      error: null
    };
    const [composed, cli] = await Promise.all([
      composeEngineRepoInfo({ git: simpleGit(repo), repo }, engineInfo),
      loadRepoInfo(simpleGit(repo), { repo })
    ]);

    expect(composed).not.toBeNull();
    expect(composed?.error).toBeNull();
    expect(cli.error).toBeNull();
    expect(composed?.repoInfo).toEqual(cli.repoInfo);
  });

  it("returns null when a stash cannot be mapped", async () => {
    const composed = await composeEngineRepoInfo(
      { git: simpleGit(repo), repo },
      {
        ...INFO,
        stashes: [{ ...STASH, selector: "refs/heads/main" }]
      }
    );
    expect(composed).toBeNull();
  });
});

describe("parseEngineConfigList", () => {
  it("decodes a string map", () => {
    expect(
      parseEngineConfigList(JSON.stringify({ "user.name": "Ada", "user.email": "ada@x.com" }))
    ).toEqual({ "user.name": "Ada", "user.email": "ada@x.com" });
  });

  it("rejects malformed payloads", () => {
    expect(parseEngineConfigList("not json")).toBeNull();
    expect(parseEngineConfigList("[]")).toBeNull();
    expect(parseEngineConfigList("null")).toBeNull();
    expect(parseEngineConfigList(JSON.stringify({ "user.name": 42 }))).toBeNull();
  });
});

describe("config path resolution", () => {
  it("honors an explicit global file", () => {
    const saved = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = "/tmp/ngg-explicit-gitconfig";
    try {
      expect(resolveGlobalGitConfigPath()).toBe("/tmp/ngg-explicit-gitconfig");
    } finally {
      if (saved === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = saved;
    }
  });

  it("resolves a plain repository to its git dir config", () => {
    const repo = makeRepo();
    try {
      expect(resolveLocalGitConfigPath(repo)).toBe(path.join(repo, ".git", "config"));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("follows the gitdir line of a linked git file", () => {
    const repo = makeRepo();
    try {
      const target = path.join(repo, "real.git");
      fs.mkdirSync(target);
      fs.rmSync(path.join(repo, ".git"), { recursive: true, force: true });
      fs.writeFileSync(path.join(repo, ".git"), "gitdir: ./real.git\n");
      expect(resolveLocalGitConfigPath(repo)).toBe(path.join(target, "config"));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("returns null when the git dir cannot be resolved", () => {
    expect(resolveLocalGitConfigPath("/nonexistent-repo-xyz")).toBeNull();
  });
});

describe("loadEngineConfig", () => {
  const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  let globalDir: string;
  let globalFile: string;
  let repo: string;

  beforeAll(() => {
    globalDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-test-global-"));
    globalFile = path.join(globalDir, "gitconfig");
    fs.writeFileSync(globalFile, "[user]\n\tname = Grace\n\temail = grace@x.com\n");
    repo = makeRepo();
    process.env.GIT_CONFIG_GLOBAL = globalFile;
  });

  afterAll(() => {
    if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(globalDir, { recursive: true, force: true });
  });

  function configAddon(
    local: Record<string, string>,
    global: Record<string, string>,
    fail?: Error
  ) {
    const configList = async (_repo: string, _local: boolean): Promise<string> => {
      if (fail !== undefined) throw fail;
      return JSON.stringify(_local ? local : global);
    };
    return { configList };
  }

  it("serves mapped identity from both scopes without the CLI", async () => {
    const addon = configAddon(
      { "user.name": "Ada", "user.email": "ada@x.com" },
      { "user.name": "Grace", "user.email": "grace@x.com" }
    );
    const configListSpy = vi.spyOn(addon, "configList");

    expect(await loadEngineConfig(addon, repo)).toEqual({
      userName: { local: "Ada", global: "Grace" },
      userEmail: { local: "ada@x.com", global: "grace@x.com" }
    });
    expect(configListSpy).toHaveBeenCalledWith(repo, true);
    expect(configListSpy).toHaveBeenCalledWith(repo, false);
  });

  it("missing keys read as null", async () => {
    const addon = configAddon({}, {});
    expect(await loadEngineConfig(addon, repo)).toEqual({
      userName: { local: null, global: null },
      userEmail: { local: null, global: null }
    });
  });

  it("returns null on a decline, a genuine failure, or a malformed payload", async () => {
    const declined = configAddon({}, {}, new Error("Unsupported: includes"));
    const failed = configAddon({}, {}, new Error("Git: corrupt config"));
    const malformed = { configList: async () => "not json" };
    await expect(loadEngineConfig(declined, repo)).resolves.toBeNull();
    await expect(loadEngineConfig(failed, repo)).resolves.toBeNull();
    await expect(loadEngineConfig(malformed, repo)).resolves.toBeNull();
  });

  it("returns null when the global file is absent, matching the CLI error shape", async () => {
    process.env.GIT_CONFIG_GLOBAL = `${globalFile}-absent`;
    try {
      const addon = configAddon({ "user.name": "Ada" }, {});
      await expect(loadEngineConfig(addon, repo)).resolves.toBeNull();
    } finally {
      process.env.GIT_CONFIG_GLOBAL = globalFile;
    }
  });

  it("rolls the composition back to the whole CLI read when the fill declines", async () => {
    const addon = configAddon({}, {}, new Error("Unsupported: includes"));
    const composed = await composeEngineRepoInfo(
      { git: simpleGit(repo), repo, addon },
      {
        branches: [],
        head: "main",
        remotes: [],
        stashes: [],
        tags: [],
        error: null
      }
    );
    expect(composed).toBeNull();
  });

  it("composes the engine config fill without config git calls", async () => {
    const addon = configAddon(
      { "user.name": "Ada", "user.email": "ada@x.com" },
      { "user.name": "Grace", "user.email": "grace@x.com" }
    );
    const labels: string[] = [];
    const composed = await composeEngineRepoInfo(
      {
        git: simpleGit(repo),
        repo,
        recordGitCommand: (record) => {
          labels.push(record.label);
        },
        addon
      },
      { branches: [], head: "main", remotes: [], stashes: [], tags: [], error: null }
    );

    expect(composed?.repoInfo.config).toEqual({
      userName: { local: "Ada", global: "Grace" },
      userEmail: { local: "ada@x.com", global: "grace@x.com" }
    });
    expect(labels.filter((label) => label.startsWith("loadRepoInfo.config"))).toEqual([]);
  });
});
