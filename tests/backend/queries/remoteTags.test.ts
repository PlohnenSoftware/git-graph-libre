import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { killProcessTree, MAX_CONCURRENT_READS, remoteTags } from "@/backend/queries/remoteTags";
import type { GitCommandRecord } from "@/backend/utils/gitRunner";

let repo: string;
let remote: string;
let isolation: string;
const records: GitCommandRecord[] = [];
const read = (extra: { signal?: AbortSignal; timeoutMs?: number } = {}) =>
  remoteTags({
    repo,
    gitPath: "git",
    recordGitCommand: (record) => records.push(record),
    ...extra
  });

beforeEach(() => {
  // Never read the developer's own Git config.
  isolation = mkdtempSync(join(tmpdir(), "ggl-remote-tags-cfg-"));
  writeFileSync(join(isolation, "gitconfig"), "");
  vi.stubEnv("GIT_CONFIG_GLOBAL", join(isolation, "gitconfig"));
  vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
  repo = makeRepo();
  remote = mkdtempSync(join(tmpdir(), "ggl-remote-tags-"));
  git(["init", "--bare", remote], repo);
  git(["remote", "add", "origin", remote], repo);
  records.length = 0;
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(remote, { recursive: true, force: true });
  rmSync(isolation, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("remote tag status", () => {
  it("does not contact remotes when there are no local tags", async () => {
    expect(await read()).toEqual({ tags: {}, unavailableRemotes: [], error: null });
    expect(records.some((record) => record.label === "remoteTags.remote")).toBe(false);
  });
  it("distinguishes local tags from identical lightweight and annotated tags on each remote", async () => {
    git(["remote", "add", "backup", remote], repo);
    git(["tag", "local"], repo);
    git(["tag", "lightweight"], repo);
    git(["tag", "-a", "annotated", "-m", "release"], repo);
    git(["push", "origin", "refs/tags/lightweight", "refs/tags/annotated"], repo);
    const hash = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();

    expect(await read()).toEqual({
      tags: {
        local: { hash, remotes: [] },
        lightweight: { hash, remotes: ["backup", "origin"] },
        annotated: { hash, remotes: ["backup", "origin"] }
      },
      unavailableRemotes: [],
      error: null
    });
    expect(records.filter((record) => record.label === "remoteTags.remote")).toHaveLength(2);
  });

  it("does not call different annotated objects on the same commit pushed", async () => {
    git(["tag", "-a", "release", "-m", "old annotation"], repo);
    git(["push", "origin", "refs/tags/release"], repo);
    git(["tag", "-f", "-a", "release", "-m", "new annotation"], repo);
    expect((await read()).tags.release.remotes).toEqual([]);
  });

  it("sees pushes and remote deletions on the next read without changing local refs", async () => {
    git(["tag", "release"], repo);
    expect((await read()).tags.release.remotes).toEqual([]);
    git(["push", "origin", "refs/tags/release"], repo);
    expect((await read()).tags.release.remotes).toEqual(["origin"]);
    git(["push", "origin", "--delete", "refs/tags/release"], repo);
    expect((await read()).tags.release.remotes).toEqual([]);
    expect(execFileSync("git", ["tag", "--list"], { cwd: repo, encoding: "utf8" }).trim()).toBe(
      "release"
    );
  });

  it("keeps successful results and reports an unreachable remote as unavailable", async () => {
    git(["tag", "release"], repo);
    git(["push", "origin", "refs/tags/release"], repo);
    git(["remote", "add", "offline", join(remote, "missing")], repo);
    const result = await read();
    expect(result.tags.release.remotes).toEqual(["origin"]);
    expect(result.unavailableRemotes).toEqual(["offline"]);
    expect(result.error).toBeNull();
    expect(records.some((record) => record.label === "remoteTags.remote" && !record.success)).toBe(
      true
    );
  });

  it("supports tags with prototype property names and repositories without remotes", async () => {
    git(["remote", "remove", "origin"], repo);
    git(["tag", "__proto__"], repo);
    git(["tag", "constructor"], repo);
    const result = await read();
    expect(Object.keys(result.tags)).toEqual(["__proto__", "constructor"]);
    expect(Object.values(result.tags).map((tag) => tag.remotes)).toEqual([[], []]);
    expect(result.error).toBeNull();
  });

  it("returns a query error when the repository cannot be read", async () => {
    const result = await remoteTags({ repo: join(repo, "missing"), gitPath: "git" });
    expect(result.tags).toEqual({});
    expect(result.error).not.toBeNull();
  });
});

/**
 * A remote helper named `git-remote-slow`, found through PATH for URLs such as
 * `slow::x`. It logs its start and end, and sleeps before failing, so a test
 * can see how many run at once and whether a kill reaches the helper itself.
 */
function installSlowHelper(seconds: number) {
  const log = join(isolation, "helper.log");
  writeFileSync(
    join(isolation, "git-remote-slow"),
    `#!/bin/sh\necho "+ $$" >> '${log}'\nsleep ${seconds}\necho "- $$" >> '${log}'\nexit 1\n`
  );
  chmodSync(join(isolation, "git-remote-slow"), 0o755);
  vi.stubEnv("PATH", `${isolation}:${process.env.PATH}`);
  return () => readFileSync(log, "utf8").split("\n").filter(Boolean);
}

describe.skipIf(process.platform === "win32")("bounded remote reads", () => {
  const addSlowRemotes = (count: number) => {
    for (let index = 0; index < count; index++) {
      git(["remote", "add", `slow${index}`, "slow::x"], repo);
    }
  };

  it("kills a hung remote at the timeout and reports it unavailable", async () => {
    const lines = installSlowHelper(30);
    git(["tag", "release"], repo);
    git(["push", "origin", "refs/tags/release"], repo);
    addSlowRemotes(1);
    const started = Date.now();
    const result = await read({ timeoutMs: 400 });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.tags.release.remotes).toEqual(["origin"]);
    expect(result.unavailableRemotes).toEqual(["slow0"]);
    const failed = records.find(
      (record) => record.label === "remoteTags.remote" && !record.success
    );
    expect(failed?.error?.message).toContain("timed out");
    // The helper was running and its group was killed: no "- pid" line.
    expect(lines()).toHaveLength(1);
  });

  it("never runs more than the cap at once", async () => {
    const lines = installSlowHelper(0.3);
    git(["tag", "release"], repo);
    addSlowRemotes(MAX_CONCURRENT_READS + 3);
    const result = await read();
    expect(result.unavailableRemotes).toHaveLength(MAX_CONCURRENT_READS + 3);
    let running = 0;
    let peak = 0;
    for (const line of lines()) {
      running += line.startsWith("+") ? 1 : -1;
      peak = Math.max(peak, running);
    }
    expect(lines().filter((line) => line.startsWith("+"))).toHaveLength(MAX_CONCURRENT_READS + 3);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(MAX_CONCURRENT_READS);
  });

  it("stops a running read when aborted, and starts no more", async () => {
    const lines = installSlowHelper(30);
    git(["tag", "release"], repo);
    addSlowRemotes(MAX_CONCURRENT_READS + 2);
    const controller = new AbortController();
    const pending = read({ signal: controller.signal });
    await vi.waitFor(() => expect(lines().length).toBeGreaterThanOrEqual(MAX_CONCURRENT_READS));
    controller.abort();
    const result = await pending;
    expect(result.error?.message).toContain("aborted");
    expect(result.tags).toEqual({});
    expect(lines()).toHaveLength(MAX_CONCURRENT_READS);
  });

  it("does not start when already aborted", async () => {
    git(["tag", "release"], repo);
    const result = await read({ signal: AbortSignal.abort() });
    expect(result.error?.message).toContain("aborted");
  });
});

describe("output handling", () => {
  it("parses CRLF output from Git", async () => {
    const wrapper = join(isolation, "git-crlf");
    writeFileSync(wrapper, '#!/bin/sh\n"$REAL_GIT" "$@" | sed \'s/$/\\r/\'\n');
    chmodSync(wrapper, 0o755);
    vi.stubEnv("REAL_GIT", execFileSync("which", ["git"], { encoding: "utf8" }).trim());
    git(["tag", "release"], repo);
    git(["push", "origin", "refs/tags/release"], repo);
    const result = await remoteTags({ repo, gitPath: wrapper });
    expect(result.error).toBeNull();
    expect(result.tags.release.remotes).toEqual(["origin"]);
  });
});

describe("killProcessTree", () => {
  it("runs taskkill /T /F from the system directory on Windows", () => {
    const on = vi.fn();
    const start = vi.fn(() => ({ on })) as never;
    const child = { pid: 4242, kill: vi.fn() };
    vi.stubEnv("SystemRoot", String.raw`C:\Windows`);
    killProcessTree(child, "win32", start);
    expect(start).toHaveBeenCalledWith(
      String.raw`C:\Windows\System32\taskkill.exe`,
      ["/pid", "4242", "/T", "/F"],
      { stdio: "ignore", windowsHide: true }
    );
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("falls back to killing the child when taskkill cannot start", () => {
    let onError: () => void = () => undefined;
    const start = vi.fn(() => ({
      on: (_event: string, listener: () => void) => {
        onError = listener;
      }
    })) as never;
    const child = { pid: 1, kill: vi.fn() };
    killProcessTree(child, "win32", start);
    onError();
    expect(child.kill).toHaveBeenCalledOnce();
  });

  it("does nothing for a child that never started", () => {
    const child = { pid: undefined, kill: vi.fn() };
    killProcessTree(child, "linux");
    expect(child.kill).not.toHaveBeenCalled();
  });
});
