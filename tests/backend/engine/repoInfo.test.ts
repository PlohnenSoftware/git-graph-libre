import * as cp from "node:child_process";
import * as fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";

import {
  buildRepoInfoOptions,
  composeEngineRepoInfo,
  mapEngineStash,
  parseEngineRepoInfo,
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
    expect(parseEngineRepoInfo(JSON.stringify({ ...INFO, stashes: [{ ...STASH, date: "x" }] }))).toBeNull();
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
    const composed = await composeEngineRepoInfo({ git: simpleGit(repo), repo }, {
      ...INFO,
      stashes: [{ ...STASH, selector: "refs/heads/main" }]
    });
    expect(composed).toBeNull();
  });
});
