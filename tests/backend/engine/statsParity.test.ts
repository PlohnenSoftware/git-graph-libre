import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { git } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadEngineAddon } from "@/backend/engine/addon";
import { readActivityHeatmap, readAuthorStats } from "@/backend/engine/stats";

/**
 * The broader parity check F3-01's report left to F3-02: over one
 * temporary repository with several authors, fixed author dates in
 * several time zones, a branch-only commit and a merge, the engine
 * reads must agree with the Git commands they mirror —
 * `git shortlog -sne --all --no-merges` for the authors and
 * `git log --all --no-merges --format=%aI` binned by the author's
 * local wall clock for the activity grid. The fixture has no
 * `.mailmap`; mailmap parity is F3-05 (TQ5). Skips without a built
 * engine, like F3-01's real-addon cases.
 */

const addon = loadEngineAddon();
const tempDirs: string[] = [];
const savedGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
let repo = "";

function gitOut(args: string[], cwd: string, env: Record<string, string> = {}): string {
  return cp
    .execFileSync("git", args, { cwd, stdio: "pipe", env: { ...process.env, ...env } })
    .toString();
}

function commitAs(name: string, email: string, date: string, message: string): void {
  gitOut(["commit", "--allow-empty", "-m", message], repo, {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date
  });
}

beforeAll(() => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-stats-parity-home-"));
  tempDirs.push(home);
  const globalConfig = path.join(home, "gitconfig");
  fs.writeFileSync(globalConfig, "");
  process.env.GIT_CONFIG_GLOBAL = globalConfig;
  if (addon === null) return;

  repo = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-stats-parity-"));
  tempDirs.push(repo);
  git(["init", "-b", "main"], repo);
  git(["config", "user.email", "t@t.com"], repo);
  git(["config", "user.name", "T"], repo);
  git(["config", "commit.gpgsign", "false"], repo);

  // Monday 2024-01-01, twice in the 09:00 hour at +02:00.
  commitAs("Ada", "ada@example.test", "2024-01-01T09:15:00+02:00", "ada one");
  commitAs("Ada", "ada@example.test", "2024-01-01T09:45:00+02:00", "ada two");
  // Saturday 2024-01-06 at 23:05 at -05:00 (Sunday in UTC: binning is local).
  commitAs("Lin", "lin@example.test", "2024-01-06T23:05:00-05:00", "lin one");
  // A branch-only commit: Sunday 2024-01-07 at 00:30 UTC. It counts
  // because both reads walk every ref (TQ4).
  git(["checkout", "-b", "side"], repo);
  commitAs("Lin", "lin@example.test", "2024-01-07T00:30:00+00:00", "lin side");
  git(["checkout", "main"], repo);
  // A merge, which neither read counts.
  gitOut(["merge", "--no-ff", "-m", "merge side", "side"], repo, {
    GIT_AUTHOR_DATE: "2024-01-08T12:00:00+00:00",
    GIT_COMMITTER_DATE: "2024-01-08T12:00:00+00:00"
  });
});

afterAll(() => {
  if (savedGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobalConfig;
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const deps = { backend: () => "auto" as const, isVerified: () => true };

describe("statistics parity against Git", () => {
  it.skipIf(addon === null)("author counts match git shortlog -sne --all --no-merges", async () => {
    const oracle = new Map<string, number>();
    for (const line of gitOut(["shortlog", "-sne", "--all", "--no-merges"], repo).split("\n")) {
      const match = /^\s*(\d+)\s+(.+?)\s+<(.+?)>$/.exec(line);
      if (match !== null) oracle.set(`${match[2]} <${match[3]}>`, Number(match[1]));
    }
    expect(oracle.size).toBe(2);

    const result = await readAuthorStats(repo, deps);
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    const engine = new Map(
      result.value.map((author) => [`${author.name} <${author.email}>`, author.commits])
    );
    expect(engine).toEqual(oracle);
  });

  it.skipIf(addon === null)(
    "activity cells match git log %aI binned by local wall clock",
    async () => {
      const oracle = new Map<string, number>();
      const lines = gitOut(["log", "--all", "--no-merges", "--format=%aI"], repo)
        .split("\n")
        .filter((line) => line !== "");
      expect(lines).toHaveLength(4);
      for (const line of lines) {
        const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/.exec(line);
        if (match === null) throw new Error(`unexpected %aI line: ${line}`);
        const weekday = new Date(
          Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        ).getUTCDay();
        const key = `${weekday}/${Number(match[4])}`;
        oracle.set(key, (oracle.get(key) ?? 0) + 1);
      }

      const result = await readActivityHeatmap(repo, deps);
      expect(result.state).toBe("ok");
      if (result.state !== "ok") return;
      const engine = new Map(
        result.value.map((cell) => [`${cell.weekday}/${cell.hour}`, cell.count])
      );
      expect(engine).toEqual(oracle);
      // The two Monday 09:00 commits share one cell; the merge is nowhere.
      expect(engine.get("1/9")).toBe(2);
      expect([...engine.values()].reduce((sum, count) => sum + count, 0)).toBe(4);
    }
  );
});
