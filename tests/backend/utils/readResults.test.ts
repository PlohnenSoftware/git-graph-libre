import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EngineAddon } from "@/backend/engine/addon";
import { createRepoReader } from "@/backend/engine/index";
import {
  describeCommitCounts,
  describeRepoInfoCounts,
  logReadResponse,
  setOperationLog,
  traceRequest
} from "@/backend/utils/operationLog";

const SECRET_NAMES = ["SecretBranch", "SecretTag", "Secret Author", "secret-remote"];

let log: ReturnType<typeof setOperationLog> | undefined;
let repo: string;
let globalDir: string;
const savedGlobal = process.env.GIT_CONFIG_GLOBAL;

beforeEach(() => {
  repo = makeRepo();
  globalDir = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-d62-global-"));
  const globalFile = path.join(globalDir, "gitconfig");
  fs.writeFileSync(globalFile, "[user]\n\tname = Secret Author\n");
  process.env.GIT_CONFIG_GLOBAL = globalFile;
  git(["checkout", "-b", "SecretBranch"], repo);
  git(["tag", "SecretTag"], repo);
  git(["remote", "add", "secret-remote", "https://example.test/secret.git"], repo);
});

afterEach(() => {
  log?.dispose();
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(globalDir, { recursive: true, force: true });
});

function capture(): string[] {
  const lines: string[] = [];
  log = setOperationLog((line) => lines.push(line));
  return lines;
}

/** An addon whose `config_list` declines with the given error, everything else answering. */
function addonWithConfigError(error: Error): EngineAddon {
  return {
    loadRepoInfo: async () =>
      JSON.stringify({
        branches: ["SecretBranch"],
        head: "SecretBranch",
        remotes: ["secret-remote"],
        stashes: [],
        tags: ["SecretTag"],
        error: null
      }),
    configList: async () => {
      throw error;
    },
    loadRefs: async () => JSON.stringify({ head: null }),
    loadConfig: async () => JSON.stringify({ remotes: [] }),
    authors: async () => "[]"
  } as unknown as EngineAddon;
}

async function readRepoInfo(addon: EngineAddon | null, preference: "auto" | "git-cli") {
  return traceRequest("loadRepoInfo", 5, async () => {
    const result = await createRepoReader({
      preference,
      gitPath: "git",
      addonProvider: () => addon
    }).loadRepoInfo({ repoPath: repo, showStashes: false, git: simpleGit(repo) });
    logReadResponse("loadRepoInfo", describeRepoInfoCounts(result), result.error);
    return result;
  });
}

describe("[result] lines", () => {
  it("counts a CLI-served loadRepoInfo without naming anything", async () => {
    const lines = capture();
    const result = await readRepoInfo(null, "git-cli");
    expect(result.error).toBeNull();
    const line = lines.find((entry) => entry.startsWith("[result]"));
    expect(line).toMatch(
      /^\[result\] request=\d+ command=loadRepoInfo clientRequest=5 remotes=1 authors=1 tags=1 stashes=0 error=none servedBy=cli$/
    );
    for (const name of SECRET_NAMES) expect(lines.join("\n")).not.toContain(name);
  });

  it("says servedBy=engine when the composition is served by the engine", async () => {
    const lines = capture();
    const addon = {
      ...addonWithConfigError(new Error("unused")),
      configList: async () => "{}",
      loadRefs: async () => JSON.stringify({ head: "a".repeat(40) }),
      loadConfig: async () =>
        JSON.stringify({ remotes: [{ name: "secret-remote", url: "https://example.test/x" }] }),
      authors: async () => JSON.stringify([{ name: "Secret Author", email: "a@b.c" }])
    } as unknown as EngineAddon;
    await readRepoInfo(addon, "auto");
    const line = lines.find((entry) => entry.startsWith("[result]"));
    expect(line).toContain("remotes=1 authors=1 tags=1 stashes=0 error=none servedBy=engine");
    expect(lines.filter((entry) => entry.startsWith("[route]"))).toEqual([]);
    for (const name of SECRET_NAMES) expect(lines.join("\n")).not.toContain(name);
  });

  it("adds cause= to composeDeclined and keeps the reason, then says servedBy=cli", async () => {
    const lines = capture();
    await readRepoInfo(
      addonWithConfigError(
        new Error("Unsupported: The configuration file contains include directives")
      ),
      "auto"
    );
    const route = lines.find((entry) => entry.startsWith("[route]"));
    expect(route).toMatch(
      /operation=loadRepoInfo backend=cli reason=composeDeclined cause=configFill:includeDirective$/
    );
    expect(lines.find((entry) => entry.startsWith("[result]"))).toContain("servedBy=cli");
  });

  it.each([
    ["an engine decline", new Error("Unsupported: other"), "configFill:engineDeclined"],
    ["an engine failure", new Error("Git: corrupt"), "configFill:engineFailed"]
  ])("names the cause for %s", async (_name, error, cause) => {
    const lines = capture();
    await readRepoInfo(addonWithConfigError(error), "auto");
    expect(lines.find((entry) => entry.startsWith("[route]"))).toMatch(
      new RegExp(`reason=composeDeclined cause=${cause}$`)
    );
  });

  it("names an unresolvable config path as the cause", async () => {
    const lines = capture();
    const saved = { home: process.env.HOME, profile: process.env.USERPROFILE };
    delete process.env.GIT_CONFIG_GLOBAL;
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    try {
      await readRepoInfo(addonWithConfigError(new Error("unused")), "auto");
    } finally {
      if (saved.home !== undefined) process.env.HOME = saved.home;
      if (saved.profile !== undefined) process.env.USERPROFILE = saved.profile;
    }
    expect(lines.find((entry) => entry.startsWith("[route]"))).toMatch(
      /reason=composeDeclined cause=configFill:unresolvablePath$/
    );
  });

  it("writes the error text Git printed on a failed read, on one line, plus an application line", async () => {
    const lines = capture();
    await traceRequest("loadRepoInfo", 9, async () => {
      logReadResponse("loadRepoInfo", "remotes=0 authors=0 tags=0 stashes=0", {
        message: "Unable to read config\nsecond line"
      });
    });
    expect(lines.find((entry) => entry.startsWith("[result]"))).toMatch(
      /remotes=0 authors=0 tags=0 stashes=0 error="Unable to read config" servedBy=cli$/
    );
    expect(lines.find((entry) => entry.startsWith("[application]"))).toMatch(
      /^\[application\] request=\d+ command=loadRepoInfo clientRequest=9 response=loadRepoInfo category=errorResponse$/
    );
  });

  it("counts loadCommits and whether more are available", async () => {
    expect(describeCommitCounts({ commits: [1, 2, 3], moreCommitsAvailable: true })).toBe(
      "commits=3 moreAvailable=true"
    );
    const lines = capture();
    await traceRequest("loadCommits", 2, async () => {
      logReadResponse(
        "loadCommits",
        describeCommitCounts({ commits: [], moreCommitsAvailable: false }),
        null
      );
    });
    expect(lines.filter((entry) => entry.startsWith("[result]"))).toEqual([
      expect.stringMatching(
        /^\[result\] request=\d+ command=loadCommits clientRequest=2 commits=0 moreAvailable=false error=none servedBy=cli$/
      )
    ]);
  });
});
