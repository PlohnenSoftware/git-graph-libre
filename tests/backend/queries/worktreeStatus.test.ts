import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import simpleGit, { type SimpleGit } from "simple-git";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WORKTREE_STATUS_CONCURRENCY, worktreeStatus } from "@/backend/queries/worktreeStatus";
import { canonicalizePath } from "@/backend/utils/git";

import { git, makeRepo } from "../helpers";

// `@/l10n` needs the `vscode` module, so the backend project gets the English
// bundle in its place.
vi.mock("@/l10n", async () => {
  const bundlePath = path.resolve(__dirname, "../../../l10n/bundle.l10n.json");
  const bundle: Record<string, string> = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  return {
    t: (key: string, ...args: string[]) =>
      (bundle[key] ?? key).replace(/\{(\d+)\}/g, (_, index) => args[Number(index)] ?? "")
  };
});

const temporaryDirs: string[] = [];

// No real global or system Git configuration reaches these fixtures.
const configHome = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-gitconfig-"));
fs.writeFileSync(path.join(configHome, "gitconfig"), "");
process.env.GIT_CONFIG_GLOBAL = path.join(configHome, "gitconfig");
process.env.GIT_CONFIG_NOSYSTEM = "1";

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirs.push(dir);
  return dir;
}

/**
 * A repository with `feat` and `other` in linked worktrees whose paths hold a
 * space and a non-ASCII letter, plus `spare`, `extra` and `more` for the
 * concurrency case. Everything lives under the test's own temporary directories.
 */
function makeFixture() {
  const repo = makeRepo();
  temporaryDirs.push(repo);
  const parent = tempDir("ngg-wt-");
  const paths: Record<string, string> = {};
  for (const name of ["feat", "other", "spare", "extra", "more"]) {
    git(["branch", name], repo);
    paths[name] = path.join(parent, name === "feat" ? "wt feat é" : `wt ${name}`);
    git(["worktree", "add", paths[name], name], repo);
  }
  return { repo, parent, paths, client: simpleGit(repo) };
}

/** A client whose `raw` calls can be intercepted; every other call passes through. */
function interceptRaw(
  client: SimpleGit,
  read: (args: string[], real: () => Promise<string>) => Promise<string>
): SimpleGit {
  const wrapped = Object.create(client) as SimpleGit;
  wrapped.raw = ((args: string[]) =>
    read(args, () => client.raw(args))) as unknown as SimpleGit["raw"];
  return wrapped;
}

const isStatus = (args: string[]) => args.includes("status");

describe("worktreeStatus", () => {
  it("marks a worktree with changes dirty, and one without changes clean", async () => {
    const { repo, paths, client } = makeFixture();
    fs.writeFileSync(path.join(paths.feat, "untracked é.txt"), "work");
    fs.writeFileSync(path.join(paths.feat, "f"), "edited");

    const result = await worktreeStatus(client, {
      repo,
      paths: [paths.feat, paths.other]
    });

    expect(result.statuses[paths.feat]).toEqual({ state: "dirty", count: 2, truncated: false });
    expect(result.statuses[paths.other]).toEqual({ state: "clean", count: 0, truncated: false });
  });

  it("counts at most the path limit and says when there are more", async () => {
    const { repo, paths, client } = makeFixture();
    for (let index = 0; index < 25; index++) {
      fs.writeFileSync(path.join(paths.feat, `new-${index}.txt`), "x");
    }

    const result = await worktreeStatus(client, { repo, paths: [paths.feat] });

    expect(result.statuses[paths.feat]).toEqual({ state: "dirty", count: 20, truncated: true });
  });

  it("reads nothing for a path Git does not list, and says unknown rather than clean", async () => {
    const { repo, parent, client } = makeFixture();
    const outside = path.join(parent, "not a worktree");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "secret"), "x");
    const reads: string[][] = [];
    const spy = interceptRaw(client, async (args, real) => {
      reads.push(args);
      return real();
    });

    const result = await worktreeStatus(spy, { repo, paths: [outside] });

    expect(result.statuses[outside]).toEqual({ state: "unknown", count: 0, truncated: false });
    expect(reads.filter(isStatus)).toEqual([]);
  });

  it("says unknown for a stale entry whose folder is gone", async () => {
    const { repo, paths, client } = makeFixture();
    fs.rmSync(paths.spare, { recursive: true, force: true });

    const result = await worktreeStatus(client, { repo, paths: [paths.spare] });

    expect(result.statuses[paths.spare]?.state).toBe("unknown");
  });

  it("says unknown when the read fails, never clean", async () => {
    const { repo, paths, client } = makeFixture();
    const failing = interceptRaw(client, async (args, real) => {
      if (isStatus(args)) throw new Error("status failed");
      return real();
    });

    const result = await worktreeStatus(failing, { repo, paths: [paths.feat] });

    expect(result.statuses[paths.feat]?.state).toBe("unknown");
  });

  it("says unknown when the read has not finished by the timeout", async () => {
    const { repo, paths, client } = makeFixture();
    const hanging = interceptRaw(client, (args, real) =>
      isStatus(args) ? new Promise<string>(() => undefined) : real()
    );

    const result = await worktreeStatus(hanging, {
      repo,
      paths: [paths.feat],
      timeoutMs: 50
    });

    expect(result.statuses[paths.feat]?.state).toBe("unknown");
  });

  it("keeps the other rows when one read times out", async () => {
    const { repo, paths, client } = makeFixture();
    fs.writeFileSync(path.join(paths.other, "f"), "edited");
    const hanging = interceptRaw(client, (args, real) =>
      args.includes(paths.feat) && isStatus(args) ? new Promise<string>(() => undefined) : real()
    );

    const result = await worktreeStatus(hanging, {
      repo,
      paths: [paths.feat, paths.other],
      timeoutMs: 50
    });

    expect(result.statuses[paths.feat]?.state).toBe("unknown");
    expect(result.statuses[paths.other]?.state).toBe("dirty");
  });

  it("reads at most a few worktrees at once", async () => {
    const { repo, paths, client } = makeFixture();
    let inFlight = 0;
    let peak = 0;
    const counted = interceptRaw(client, async (args, real) => {
      if (!isStatus(args)) return real();
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const output = await real();
      inFlight--;
      return output;
    });
    const requested = [paths.feat, paths.other, paths.spare, paths.extra, paths.more];

    const result = await worktreeStatus(counted, { repo, paths: requested });

    expect(Object.keys(result.statuses).toSorted()).toEqual(requested.toSorted());
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(WORKTREE_STATUS_CONCURRENCY);
  });

  it("answers a requested path as it was sent, when it differs from Git's spelling", async () => {
    const { repo, paths, client } = makeFixture();
    const spelled = paths.other + path.sep;

    const result = await worktreeStatus(client, { repo, paths: [spelled] });

    expect(Object.keys(result.statuses)).toEqual([spelled]);
    expect(result.statuses[spelled]?.state).toBe("clean");
    expect(await canonicalizePath(spelled)).toBe(await canonicalizePath(paths.other));
  });
});
