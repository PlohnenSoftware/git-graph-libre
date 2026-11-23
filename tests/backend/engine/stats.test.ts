import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadEngineAddon } from "@/backend/engine/addon";
import {
  readActivityHeatmap,
  readAuthorStats,
  type StatsAddon,
  type StatsDeps
} from "@/backend/engine/stats";

/**
 * The Statistics reads (slice F3-01): the engine answers a validated value on
 * `auto` for a verified repository when the addon carries the export, and
 * otherwise a typed unavailable reason. Nothing throws. The fake-addon cases
 * pin the mapping, the four reasons and the validation; the last block drives
 * the real addon over a temporary repository and skips when it is not built.
 */

const REPO = "/fixture/repo";
const tempDirs: string[] = [];
const savedGlobalConfig = process.env.GIT_CONFIG_GLOBAL;

beforeAll(() => {
  // Point global config at an empty temporary file, so the real repository's
  // reads never depend on the user's own configuration.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-stats-home-"));
  tempDirs.push(home);
  const globalConfig = path.join(home, "gitconfig");
  fs.writeFileSync(globalConfig, "");
  process.env.GIT_CONFIG_GLOBAL = globalConfig;
});

afterAll(() => {
  if (savedGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobalConfig;
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/** Deps for a verified repository on `auto`, with the given addon. */
function deps(addon: StatsAddon | null, overrides: Partial<StatsDeps> = {}): StatsDeps {
  return {
    backend: () => "auto",
    isVerified: () => true,
    addonProvider: () => addon,
    ...overrides
  };
}

const AUTHOR_PAYLOAD = JSON.stringify([
  { name: "Ada", email: "ada@example.test", commits: 3 },
  { name: "Lin", email: "lin@example.test", commits: 1 }
]);

const HEATMAP_PAYLOAD = JSON.stringify([
  { weekday: 0, hour: 0, count: 2 },
  { weekday: 6, hour: 23, count: 5 }
]);

describe("readAuthorStats", () => {
  it("maps the engine rows into project authors", async () => {
    const authorStats = vi.fn(async () => AUTHOR_PAYLOAD);
    const result = await readAuthorStats(REPO, deps({ authorStats }));
    expect(result).toEqual({
      state: "ok",
      value: [
        { name: "Ada", email: "ada@example.test", commits: 3 },
        { name: "Lin", email: "lin@example.test", commits: 1 }
      ]
    });
    expect(authorStats).toHaveBeenCalledWith(REPO);
  });

  it("answers ok with an empty value for an empty array", async () => {
    const authorStats = async () => "[]";
    expect(await readAuthorStats(REPO, deps({ authorStats }))).toEqual({ state: "ok", value: [] });
  });

  it("is noAddon when the addon has no authorStats export", async () => {
    const result = await readAuthorStats(REPO, deps({}));
    expect(result).toEqual({ state: "unavailable", reason: "noAddon" });
  });

  it("is noAddon when no addon loads", async () => {
    const result = await readAuthorStats(REPO, deps(null));
    expect(result).toEqual({ state: "unavailable", reason: "noAddon" });
  });

  it("is backendCli and never calls the engine on the git-cli backend", async () => {
    const authorStats = vi.fn(async () => AUTHOR_PAYLOAD);
    const result = await readAuthorStats(REPO, deps({ authorStats }, { backend: () => "git-cli" }));
    expect(result).toEqual({ state: "unavailable", reason: "backendCli" });
    expect(authorStats).not.toHaveBeenCalled();
  });

  it("is notVerified and never calls the engine for an unverified repository", async () => {
    const authorStats = vi.fn(async () => AUTHOR_PAYLOAD);
    const result = await readAuthorStats(REPO, deps({ authorStats }, { isVerified: () => false }));
    expect(result).toEqual({ state: "unavailable", reason: "notVerified" });
    expect(authorStats).not.toHaveBeenCalled();
  });

  it("is failed when the engine rejects, without throwing", async () => {
    const authorStats = async () => {
      throw new Error("Unsupported: something git would answer differently");
    };
    const result = await readAuthorStats(REPO, deps({ authorStats }));
    expect(result).toEqual({ state: "unavailable", reason: "failed" });
  });

  it("is failed for malformed JSON", async () => {
    const authorStats = async () => "[{not json";
    expect(await readAuthorStats(REPO, deps({ authorStats }))).toEqual({
      state: "unavailable",
      reason: "failed"
    });
  });

  it("is failed when the payload is not an array", async () => {
    const authorStats = async () => JSON.stringify({ name: "Ada" });
    expect(await readAuthorStats(REPO, deps({ authorStats }))).toEqual({
      state: "unavailable",
      reason: "failed"
    });
  });

  it("is failed for a row missing a field", async () => {
    const authorStats = async () => JSON.stringify([{ name: "Ada", commits: 3 }]);
    expect(await readAuthorStats(REPO, deps({ authorStats }))).toEqual({
      state: "unavailable",
      reason: "failed"
    });
  });

  it("is failed for a negative or fractional commit count", async () => {
    const negative = async () => JSON.stringify([{ name: "A", email: "a@x", commits: -1 }]);
    const fractional = async () => JSON.stringify([{ name: "A", email: "a@x", commits: 1.5 }]);
    expect(await readAuthorStats(REPO, deps({ authorStats: negative }))).toEqual({
      state: "unavailable",
      reason: "failed"
    });
    expect(await readAuthorStats(REPO, deps({ authorStats: fractional }))).toEqual({
      state: "unavailable",
      reason: "failed"
    });
  });

  it("returns no partial value when one row of several is malformed", async () => {
    const authorStats = async () =>
      JSON.stringify([
        { name: "Ada", email: "ada@example.test", commits: 3 },
        { name: "Lin", email: "lin@example.test", commits: "one" }
      ]);
    const result = await readAuthorStats(REPO, deps({ authorStats }));
    expect(result).toEqual({ state: "unavailable", reason: "failed" });
  });
});

describe("readActivityHeatmap", () => {
  it("maps the engine cells into project cells", async () => {
    const activityHeatmap = vi.fn(async () => HEATMAP_PAYLOAD);
    const result = await readActivityHeatmap(REPO, deps({ activityHeatmap }));
    expect(result).toEqual({
      state: "ok",
      value: [
        { weekday: 0, hour: 0, count: 2 },
        { weekday: 6, hour: 23, count: 5 }
      ]
    });
    expect(activityHeatmap).toHaveBeenCalledWith(REPO);
  });

  it("answers ok with an empty value for an empty array", async () => {
    const activityHeatmap = async () => "[]";
    expect(await readActivityHeatmap(REPO, deps({ activityHeatmap }))).toEqual({
      state: "ok",
      value: []
    });
  });

  it("is noAddon when the addon has no activityHeatmap export", async () => {
    expect(await readActivityHeatmap(REPO, deps({}))).toEqual({
      state: "unavailable",
      reason: "noAddon"
    });
  });

  it("is backendCli and never calls the engine on the git-cli backend", async () => {
    const activityHeatmap = vi.fn(async () => HEATMAP_PAYLOAD);
    const result = await readActivityHeatmap(
      REPO,
      deps({ activityHeatmap }, { backend: () => "git-cli" })
    );
    expect(result).toEqual({ state: "unavailable", reason: "backendCli" });
    expect(activityHeatmap).not.toHaveBeenCalled();
  });

  it("is notVerified and never calls the engine for an unverified repository", async () => {
    const activityHeatmap = vi.fn(async () => HEATMAP_PAYLOAD);
    const result = await readActivityHeatmap(
      REPO,
      deps({ activityHeatmap }, { isVerified: () => false })
    );
    expect(result).toEqual({ state: "unavailable", reason: "notVerified" });
    expect(activityHeatmap).not.toHaveBeenCalled();
  });

  it("is failed when the engine rejects, without throwing", async () => {
    const activityHeatmap = async () => {
      throw new Error("boom");
    };
    expect(await readActivityHeatmap(REPO, deps({ activityHeatmap }))).toEqual({
      state: "unavailable",
      reason: "failed"
    });
  });

  it("is failed for malformed JSON", async () => {
    const activityHeatmap = async () => "{";
    expect(await readActivityHeatmap(REPO, deps({ activityHeatmap }))).toEqual({
      state: "unavailable",
      reason: "failed"
    });
  });

  it.each([
    ["weekday 7", { weekday: 7, hour: 0, count: 1 }],
    ["weekday -1", { weekday: -1, hour: 0, count: 1 }],
    ["hour 24", { weekday: 1, hour: 24, count: 1 }],
    ["count 0", { weekday: 1, hour: 1, count: 0 }],
    ["fractional hour", { weekday: 1, hour: 1.5, count: 1 }]
  ])("is failed for an out-of-range cell (%s)", async (_label, cell) => {
    const activityHeatmap = async () => JSON.stringify([cell]);
    expect(await readActivityHeatmap(REPO, deps({ activityHeatmap }))).toEqual({
      state: "unavailable",
      reason: "failed"
    });
  });
});

describe("readAuthorStats and readActivityHeatmap against the real addon", () => {
  const addon = loadEngineAddon();
  let repo: string | undefined;

  beforeAll(() => {
    if (addon === null) return;
    repo = makeRepo();
    tempDirs.push(repo);
    git(["commit", "--allow-empty", "-m", "second"], repo);
  });

  it.skipIf(addon === null)("reads the author counts of a temporary repository", async () => {
    const result = await readAuthorStats(repo ?? "", {
      backend: () => "auto",
      isVerified: () => true
    });
    expect(result).toEqual({
      state: "ok",
      value: [{ name: "T", email: "t@t.com", commits: 2 }]
    });
  });

  it.skipIf(addon === null)("reads the activity grid of a temporary repository", async () => {
    const result = await readActivityHeatmap(repo ?? "", {
      backend: () => "auto",
      isVerified: () => true
    });
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    const total = result.value.reduce((sum, cell) => sum + cell.count, 0);
    expect(total).toBe(2);
    for (const cell of result.value) {
      expect(cell.weekday).toBeGreaterThanOrEqual(0);
      expect(cell.weekday).toBeLessThanOrEqual(6);
      expect(cell.hour).toBeGreaterThanOrEqual(0);
      expect(cell.hour).toBeLessThanOrEqual(23);
    }
  });
});
