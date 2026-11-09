import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  classifyReflogMessage,
  loadReflog,
  MAX_REFLOG_PAGE_SIZE,
  parseReflogRecords
} from "@/backend/queries/reflog";
import type { GitReflogMessageClass } from "@/backend/types";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

const NUL = "\0";
const US = "\u001f";
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

function tryRun(args: string[], cwd: string, env: Record<string, string> = {}): void {
  try {
    run(args, cwd, env);
  } catch {
    // Scenarios such as an aborted merge leave Git with a non-zero exit on purpose.
  }
}

function initRepo(extra: string[] = []): string {
  const dir = tempDir("ggl-reflog-");
  run(["init", "-q", "-b", "main", ...extra], dir);
  run(["config", "commit.gpgsign", "false"], dir);
  return dir;
}

function commitFile(dir: string, name: string, env: Record<string, string> = {}): void {
  fs.writeFileSync(path.join(dir, name), `${name}\n`);
  run(["add", name], dir);
  run(["commit", "-q", "-m", name], dir, env);
}

function reader(dir: string) {
  return simpleGit(dir);
}

/** Every `%gs` subject of a ref's reflog, as Git prints it. */
function subjects(dir: string, ref: string): string[] {
  return run(["log", "-g", "--format=%gs", ref, "--"], dir).split("\n").slice(0, -1);
}

beforeAll(() => {
  const home = tempDir("ggl-reflog-home-");
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
  // simple-git inherits this process's environment, so the query reads no real config either.
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

describe("classifyReflogMessage", () => {
  // Subjects captured from `git log -g --format=%gs` (Git 2.56.0) over fixtures that ran each
  // command. The history suite below captures its own on every run, so a Git that words
  // them differently fails there. The tail rows are not Git's: text other tools write.
  const captured: Array<[string, string, string | null]> = [
    ["commit (initial): a", "commit", "initial"],
    ["commit: t1", "commit", null],
    ["commit (amend): amended", "commit", "amend"],
    ["checkout: moving from main to topic", "checkout", null],
    ["reset: moving to HEAD~1", "reset", null],
    ["rebase (start): checkout main~1", "rebase", "start"],
    ["rebase (pick): t1", "rebase", "pick"],
    ["rebase (fixup): t1", "rebase", "fixup"],
    ["rebase (squash): # This is a combination of 2 commits.", "rebase", "squash"],
    ["rebase (abort): returning to refs/heads/topic", "rebase", "abort"],
    ["rebase (finish): refs/heads/topic onto 9f7683edf621", "rebase", "finish"],
    ["rebase: fast-forward", "rebase", null],
    ["merge topic: Fast-forward", "merge", "fast-forward"],
    ["merge m2: Merge made by the 'ort' strategy.", "merge", null],
    ["pull -q --no-rebase --no-edit: Merge made by the 'ort' strategy.", "pull", null],
    ["pull -q --rebase (pick): squashed", "pull", "pick"],
    ["pull -q --rebase (finish): returning to refs/heads/main", "pull", "finish"],
    ["fetch -q: fast-forward", "fetch", null],
    ["cherry-pick: feat1", "cherry-pick", null],
    ['revert: Revert "squashed"', "revert", null],
    ["branch: Created from HEAD", "branch", "created"],
    ["Branch: renamed refs/heads/m2 to refs/heads/m3", "branch", "renamed"],
    ["Branch: copied refs/heads/m3 to refs/heads/m4", "branch", "copied"],
    ['WIP on main: 39004e7 Revert "squashed"', "stash", "wip"],
    ["On main: named2", "stash", "named"],
    ["clone: from /tmp/somewhere/up", "clone", null],
    ["my own reason", "other", null],
    ["", "other", null],
    ["pullover: not a pull", "other", null],
    ["commitment issues", "other", null]
  ];

  it.each(captured)("classifies %j", (raw, kind, sub) => {
    expect(classifyReflogMessage(raw)).toEqual({ kind, sub, raw });
  });

  it("reads the older `rebase -i` wording as the same kinds", () => {
    // Older Git put `-i` in the subject of an interactive rebase; Git 2.56.0 does not.
    expect(classifyReflogMessage("rebase -i (pick): t1")).toMatchObject({
      kind: "rebase",
      sub: "pick"
    });
    expect(classifyReflogMessage("rebase -i (finish): returning to refs/heads/x")).toMatchObject({
      kind: "rebase",
      sub: "finish"
    });
    expect(classifyReflogMessage("rebase -i: fast-forward")).toMatchObject({
      kind: "rebase",
      sub: null
    });
  });

  it("never throws and always keeps the raw text", () => {
    const odd = [
      "",
      " ",
      ":",
      "(",
      "rebase (",
      "rebase ()",
      "commit (): x",
      "\u0000\u001f\n",
      "é🙂 ünïcode: text",
      "x".repeat(100_000),
      "rebase (".repeat(5000)
    ];
    for (const raw of odd) {
      const result: GitReflogMessageClass = classifyReflogMessage(raw);
      expect(result.raw).toBe(raw);
      expect(typeof result.kind).toBe("string");
    }
    expect(classifyReflogMessage(undefined as unknown as string)).toEqual({
      kind: "other",
      sub: null,
      raw: ""
    });
    expect(classifyReflogMessage(null as unknown as string).kind).toBe("other");
  });
});

describe("parseReflogRecords", () => {
  const hash = "a".repeat(40);
  const entry = (selector: string, message: string) =>
    [hash, selector, "N", "n@example.test", message].join(US) + NUL;
  const time = (selector: string) => [hash, selector].join(US) + NUL;

  it("pairs entries with their times and keeps a separator inside a message", () => {
    const parsed = parseReflogRecords(
      entry("HEAD@{4}", `odd${US}message`) + entry("HEAD@{2}", "x"),
      time("HEAD@{1700000000}") + time("HEAD@{1600000000}")
    );
    expect(parsed.map((e) => [e.index, e.time, e.message])).toEqual([
      [4, 1_700_000_000, `odd${US}message`],
      [2, 1_600_000_000, "x"]
    ]);
  });

  it("rejects a different count, a different hash and a malformed record", () => {
    expect(() => parseReflogRecords(entry("HEAD@{0}", "x"), "")).toThrow(/changed/);
    expect(() =>
      parseReflogRecords(entry("HEAD@{0}", "x"), `${"b".repeat(40)}${US}HEAD@{5}${NUL}`)
    ).toThrow(/changed/);
    expect(() => parseReflogRecords(`${hash}${US}HEAD@{0}${NUL}`, time("HEAD@{1}"))).toThrow(
      /too few/
    );
    expect(() => parseReflogRecords(entry("HEAD", "x"), time("HEAD@{1}"))).toThrow(/unexpected/);
  });
});

describe("loadReflog on a history that used every command", () => {
  let dir: string;
  const kinds = new Map<string, GitReflogMessageClass>();

  beforeAll(async () => {
    const upstream = initRepo();
    commitFile(upstream, "a", { GIT_COMMITTER_DATE: OLD });
    commitFile(upstream, "b", { GIT_COMMITTER_DATE: OLD });
    dir = tempDir("ggl-reflog-clone-");
    run(["clone", "-q", upstream, dir], tempDir("ggl-reflog-cwd-"));
    run(["config", "commit.gpgsign", "false"], dir);

    // A todo-list editor that rewrites the first word of chosen lines, so no sed dialect matters.
    const editor = path.join(tempDir("ggl-reflog-editor-"), "edit.mjs");
    fs.writeFileSync(
      editor,
      [
        'import fs from "node:fs";',
        "const file = process.argv[2];",
        'const edits = JSON.parse(process.env.TODO_EDITS ?? "{}");',
        'const lines = fs.readFileSync(file, "utf8").split("\\n");',
        "let n = 0;",
        "const out = lines.map((line) => {",
        "  if (!/^pick /.test(line)) return line;",
        "  n += 1;",
        "  return edits[n] ? line.replace(/^pick/, edits[n]) : line;",
        "});",
        'fs.writeFileSync(file, out.join("\\n"));'
      ].join("\n")
    );
    const todo = (edits: Record<number, string>) => ({
      GIT_SEQUENCE_EDITOR: `node "${editor}"`,
      TODO_EDITS: JSON.stringify(edits)
    });

    run(["checkout", "-q", "-b", "topic"], dir);
    for (const name of ["t1", "t2", "t3"]) commitFile(dir, name);
    tryRun(["rebase", "-q", "-i", "main", "topic"], dir, todo({ 2: "squash", 3: "fixup" }));
    tryRun(["rebase", "-q", "-i", "main~1", "topic"], dir, todo({ 1: "edit" }));
    tryRun(["rebase", "--continue"], dir);
    tryRun(["rebase", "-q", "-i", "main~1", "topic"], dir, todo({ 1: "edit" }));
    tryRun(["rebase", "--abort"], dir);

    // Replay (not fast-forward) picks: move main on, then rebase a branch cut from its past.
    run(["checkout", "-q", "-b", "replay", "main~1"], dir);
    commitFile(dir, "r1");
    run(["checkout", "-q", "main"], dir);
    commitFile(dir, "main-moves");
    run(["rebase", "-q", "main", "replay"], dir);
    run(["checkout", "-q", "-b", "replay2", "main~1"], dir);
    commitFile(dir, "r2");
    run(["rebase", "-q", "-i", "main", "replay2"], dir, todo({ 1: "pick" }));
    run(["checkout", "-q", "-b", "ffb", "main"], dir);
    commitFile(dir, "ff1");
    run(["checkout", "-q", "main"], dir);
    run(["merge", "-q", "--ff-only", "ffb"], dir);
    run(["checkout", "-q", "-b", "m2", "main~1"], dir);
    commitFile(dir, "m2");
    run(["checkout", "-q", "main"], dir);
    run(["merge", "-q", "--no-ff", "m2", "-m", "noff"], dir);
    run(["checkout", "-q", "-b", "feat", "main~1"], dir);
    commitFile(dir, "feat1");
    run(["checkout", "-q", "main"], dir);
    run(["cherry-pick", "feat"], dir);
    run(["revert", "--no-edit", "HEAD"], dir);
    run(["commit", "-q", "--amend", "--allow-empty", "-m", "amended"], dir);
    run(["checkout", "-q", "--detach", "HEAD~1"], dir);
    commitFile(dir, "det");
    run(["checkout", "-q", "main"], dir);
    run(["reset", "-q", "--soft", "HEAD~1"], dir);
    run(["commit", "-q", "-m", "again"], dir);
    run(["branch", "-m", "m2", "m3"], dir);
    run(["branch", "-c", "m3", "m4"], dir);
    fs.writeFileSync(path.join(dir, "z"), "z");
    run(["stash", "push", "-q", "-u"], dir);
    fs.writeFileSync(path.join(dir, "z"), "z2");
    run(["stash", "push", "-q", "-u", "-m", "named"], dir);
    commitFile(upstream, "up1");
    run(["pull", "-q", "--rebase"], dir);
    commitFile(upstream, "up2");
    run(["pull", "-q", "--no-rebase", "--no-edit"], dir);
    commitFile(upstream, "up3");
    run(["fetch", "-q"], dir);
    run(["update-ref", "-m", "my own reason", "refs/heads/main", "HEAD"], dir);

    for (const ref of ["HEAD", "main", "topic", "refs/stash", "refs/remotes/origin/main", "m4"]) {
      const result = await loadReflog(reader(dir), dir, { ref, limit: MAX_REFLOG_PAGE_SIZE });
      expect(result.error).toBeNull();
      for (const entry of result.entries) {
        kinds.set(`${ref}|${entry.message}`, classifyReflogMessage(entry.message));
      }
    }
  });

  it("recognizes every command the history used", () => {
    const seen = new Set(
      [...kinds.values()].map(({ kind, sub }) => (sub === null ? kind : `${kind}/${sub}`))
    );
    const expected = [
      "commit",
      "commit/amend",
      "checkout",
      "reset",
      "rebase/start",
      "rebase/pick",
      "rebase/squash",
      "rebase/fixup",
      "rebase/finish",
      "rebase/abort",
      "merge/fast-forward",
      "merge",
      "cherry-pick",
      "revert",
      "pull",
      "pull/start",
      "pull/pick",
      "pull/finish",
      "fetch",
      "branch/created",
      "branch/renamed",
      "branch/copied",
      "stash/wip",
      "stash/named",
      "clone"
    ];
    const missing = expected.filter((item) => !seen.has(item));
    expect(missing).toEqual([]);
  });

  it("leaves only the hand-made message as other", () => {
    const unknown = [...kinds.entries()]
      .filter(([, result]) => result.kind === "other")
      .map(([key]) => key.split("|")[1]);
    expect([...new Set(unknown)].sort()).toEqual(["my own reason"].sort());
  });

  it("numbers entries as Git does, gaps included", async () => {
    const result = await loadReflog(reader(dir), dir, { ref: "HEAD", limit: MAX_REFLOG_PAGE_SIZE });
    const fromGit = run(["log", "-g", "--format=%gd", "HEAD", "--"], dir)
      .split("\n")
      .slice(0, -1)
      .map((selector) => Number(/@\{(\d+)\}$/.exec(selector)?.[1]));
    expect(result.entries.map((entry) => entry.index)).toEqual(fromGit);
    expect(result.entries.map((entry) => entry.message)).toEqual(subjects(dir, "HEAD"));
  });

  it("keeps Git's own numbering when Git leaves an entry out of it", async () => {
    // Renaming the checked-out branch writes HEAD entries that `git log -g` skips.
    const renamed = initRepo();
    commitFile(renamed, "a");
    run(["checkout", "-q", "-b", "feat"], renamed);
    commitFile(renamed, "b");
    run(["branch", "-m", "feat", "feat2"], renamed);
    commitFile(renamed, "c");
    const result = await loadReflog(reader(renamed), renamed, { ref: "HEAD" });
    const indexes = result.entries.map((entry) => entry.index);
    const fromGit = run(["log", "-g", "--format=%gd", "HEAD", "--"], renamed)
      .split("\n")
      .slice(0, -1)
      .map((selector) => Number(/@\{(\d+)\}$/.exec(selector)?.[1]));
    expect(indexes).toEqual(fromGit);
    expect(indexes.at(-1)).toBeGreaterThan(indexes.length - 1);
    // A page that starts after the gap still carries Git's numbers.
    const page = await loadReflog(reader(renamed), renamed, { ref: "HEAD", limit: 2, offset: 2 });
    expect(page.entries.map((entry) => entry.index)).toEqual(fromGit.slice(2, 4));
  });

  it("returns the identity that made the entry and the full hash", async () => {
    const result = await loadReflog(reader(dir), dir, { ref: "HEAD", limit: 1 });
    const [entry] = result.entries;
    expect(entry?.name).toBe("Committer");
    expect(entry?.email).toBe("committer@example.test");
    expect(entry?.hash).toBe(run(["rev-parse", "HEAD"], dir).trim());
    expect(entry?.message).toBe("my own reason");
    expect(result.ref).toBe("HEAD");
    expect(result.state).toBe("entries");
  });
});

describe("loadReflog entry time and paging", () => {
  it("carries the entry's own time, not the commit's", async () => {
    const dir = initRepo();
    commitFile(dir, "a", { GIT_COMMITTER_DATE: OLD });
    commitFile(dir, "b", { GIT_COMMITTER_DATE: OLD });
    run(["checkout", "-q", "-b", "later", "HEAD~1"], dir, {
      GIT_COMMITTER_DATE: "2010-01-01T00:00:00Z"
    });
    const result = await loadReflog(reader(dir), dir, { ref: "HEAD" });
    expect(result.entries.map((e) => [e.message.split(":")[0], e.time])).toEqual([
      ["checkout", 1_262_304_000],
      ["commit", OLD_UNIX],
      ["commit (initial)", OLD_UNIX]
    ]);
    const commitTime = Number(run(["log", "-1", "--format=%ct", "HEAD"], dir));
    expect(commitTime).toBe(OLD_UNIX);
    expect(result.entries[0]?.time).not.toBe(commitTime);
  });

  it("pages across a page boundary without a gap or a repeat", async () => {
    const dir = initRepo();
    for (const name of ["a", "b", "c", "d", "e", "f"]) commitFile(dir, name);
    const git = reader(dir);
    const all = await loadReflog(git, dir, { limit: 100 });
    expect(all.entries).toHaveLength(6);
    expect(all.hasMore).toBe(false);

    const first = await loadReflog(git, dir, { limit: 4 });
    const second = await loadReflog(git, dir, { limit: 4, offset: 4 });
    expect(first.entries).toHaveLength(4);
    expect(first.hasMore).toBe(true);
    expect(second.entries).toHaveLength(2);
    expect(second.hasMore).toBe(false);
    expect([...first.entries, ...second.entries]).toEqual(all.entries);

    const exact = await loadReflog(git, dir, { limit: 6 });
    expect(exact.hasMore).toBe(false);
    const pastEnd = await loadReflog(git, dir, { limit: 4, offset: 6 });
    expect(pastEnd.entries).toEqual([]);
    expect(pastEnd.state).toBe("entries");
    expect(pastEnd.hasMore).toBe(false);
  });

  it("caps a page at the maximum", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    const result = await loadReflog(reader(dir), dir, { limit: 10 ** 9 });
    expect(result.error).toBeNull();
    expect(result.entries).toHaveLength(1);
  });
});

describe("loadReflog states", () => {
  it("tells no reflog, an empty reflog and entries apart", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    run(["tag", "v1"], dir);
    const git = reader(dir);
    expect((await loadReflog(git, dir, { ref: "v1" })).state).toBe("none");
    expect((await loadReflog(git, dir, { ref: "main" })).state).toBe("entries");

    run(["reflog", "expire", "--expire=all", "--all"], dir);
    const expired = await loadReflog(git, dir, { ref: "main" });
    expect(expired).toMatchObject({ entries: [], state: "empty", error: null, hasMore: false });
    expect((await loadReflog(git, dir, { ref: "v1" })).state).toBe("none");
  });

  it("reports none when core.logAllRefUpdates is false", async () => {
    const dir = initRepo();
    run(["config", "core.logAllRefUpdates", "false"], dir);
    commitFile(dir, "a");
    const result = await loadReflog(reader(dir), dir, { ref: "HEAD" });
    expect(result).toMatchObject({ entries: [], state: "none", error: null });
    expect((await loadReflog(reader(dir), dir, { ref: "main" })).state).toBe("none");
  });

  it("reports none for an unborn HEAD and a bare repository", async () => {
    const empty = initRepo();
    expect(await loadReflog(reader(empty), empty, { ref: "HEAD" })).toMatchObject({
      entries: [],
      state: "none",
      error: null
    });

    const source = initRepo();
    commitFile(source, "a");
    const bare = tempDir("ggl-reflog-bare-");
    run(["init", "-q", "--bare", "-b", "main", bare], bare);
    expect((await loadReflog(reader(bare), bare, { ref: "HEAD" })).state).toBe("none");
    run(["push", "-q", bare, "main"], source);
    expect(await loadReflog(reader(bare), bare, { ref: "main" })).toMatchObject({
      entries: [],
      state: "none",
      error: null
    });
  });

  it("is an error, never an empty list, when the read fails", async () => {
    const missing = path.join(tempDir("ggl-reflog-missing-"), "no-such-repo");
    const notARepo = await loadReflog(simpleGit(os.tmpdir()), missing, { ref: "HEAD" });
    expect(notARepo.state).toBeNull();
    expect(notARepo.error).not.toBeNull();

    const dir = initRepo();
    commitFile(dir, "a");
    const unknown = await loadReflog(reader(dir), dir, { ref: "no-such-branch" });
    expect(unknown).toMatchObject({ entries: [], state: null, ref: null });
    expect(unknown.error?.message).toMatch(/not an existing reference/);
  });
});

describe("loadReflog refuses what must not reach Git", () => {
  it.each([
    ["a leading dash", "-n1"],
    ["an option with a value", "--output=/tmp/x"],
    ["an empty name", ""],
    ["a control character", "main\nfoo"],
    ["a NUL", "main\0foo"]
  ])("refuses %s without running Git", async (_name, ref) => {
    const dir = initRepo();
    commitFile(dir, "a");
    const records: GitCommandRecord[] = [];
    const result = await loadReflog(reader(dir), dir, { ref }, (r) => records.push(r));
    expect(result.error).not.toBeNull();
    expect(result.state).toBeNull();
    expect(records).toEqual([]);
  });

  it("refuses a commit hash and a revision expression as not a reference", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    commitFile(dir, "b");
    const hash = run(["rev-parse", "HEAD"], dir).trim();
    for (const ref of [hash, "HEAD~1", "main@{1}"]) {
      const result = await loadReflog(reader(dir), dir, { ref });
      expect(result.error?.message).toMatch(/not an existing reference/);
    }
  });

  it("refuses a bad limit or offset", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    for (const request of [
      { limit: 0 },
      { limit: -1 },
      { limit: 1.5 },
      { offset: -1 },
      { offset: Number.NaN }
    ]) {
      const result = await loadReflog(reader(dir), dir, request);
      expect(result.error).not.toBeNull();
    }
  });

  it("passes the ref after --end-of-options and --", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    const records: GitCommandRecord[] = [];
    await loadReflog(reader(dir), dir, { ref: "main" }, (r) => records.push(r));
    const read = records.find((r) => r.label === "reflog.entries");
    expect(read?.args.slice(-3)).toEqual(["--end-of-options", "refs/heads/main", "--"]);
  });
});

describe("loadReflog with worktrees", () => {
  it("keeps HEAD's reflog per worktree and branch reflogs shared", async () => {
    const dir = initRepo();
    commitFile(dir, "a");
    const linked = path.join(tempDir("ggl-reflog-wt-"), "linked");
    run(["worktree", "add", "-q", linked, "-b", "wtb"], dir);
    commitFile(linked, "w");

    const mainHead = await loadReflog(reader(dir), dir, { ref: "HEAD" });
    const linkedHead = await loadReflog(reader(linked), linked, { ref: "HEAD" });
    expect(mainHead.entries.map((e) => e.message)).toEqual(["commit (initial): a"]);
    // Each worktree has its own HEAD reflog: the linked one starts at the worktree's creation.
    expect(linkedHead.entries.map((e) => e.message)).toEqual(subjects(linked, "HEAD"));
    expect(linkedHead.entries[0]?.message).toBe("commit: w");
    expect(linkedHead.entries.map((e) => e.message)).not.toContain("commit (initial): a");
    expect(mainHead.entries.map((e) => e.message)).not.toContain("commit: w");

    const fromMain = await loadReflog(reader(dir), dir, { ref: "wtb" });
    const fromLinked = await loadReflog(reader(linked), linked, { ref: "wtb" });
    expect(fromMain.entries.map((e) => e.message)).toEqual([
      "commit: w",
      "branch: Created from HEAD"
    ]);
    expect(fromLinked.entries).toEqual(fromMain.entries);
  });
});

describe("loadReflog under a non-English locale", () => {
  it("keeps the subjects in English", async () => {
    const dir = initRepo();
    const locale = {
      LC_ALL: "pl_PL.UTF-8",
      LANG: "pl_PL.UTF-8",
      LANGUAGE: "pl",
      GIT_COMMITTER_DATE: OLD
    };
    commitFile(dir, "a", locale);
    run(["checkout", "-q", "-b", "other"], dir, locale);
    commitFile(dir, "b", locale);
    run(["checkout", "-q", "main"], dir, locale);
    run(["merge", "-q", "--no-ff", "other", "-m", "mg"], dir, locale);
    run(["reset", "-q", "--hard", "HEAD~1"], dir, locale);

    const previous = {
      LC_ALL: process.env.LC_ALL,
      LANG: process.env.LANG,
      LANGUAGE: process.env.LANGUAGE
    };
    Object.assign(process.env, locale);
    try {
      const result = await loadReflog(reader(dir), dir, { ref: "HEAD" });
      expect(result.error).toBeNull();
      expect(result.entries.map((e) => e.message)).toEqual([
        "reset: moving to HEAD~1",
        "merge other: Merge made by the 'ort' strategy.",
        "checkout: moving from other to main",
        "commit: b",
        "checkout: moving from main to other",
        "commit (initial): a"
      ]);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
