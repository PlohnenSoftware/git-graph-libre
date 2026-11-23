import { describe, expect, it, vi } from "vitest";

import type { StatsAddon, StatsDeps } from "@/backend/engine/stats";
import { createStatsSource } from "@/extension/statsTab/statsData";

/**
 * The tab's source over F3-01's reads, with a fake addon: both values
 * together, or the first unavailable reason (authors first). The reads'
 * own gates and validation are F3-01's tests.
 */

const AUTHORS = JSON.stringify([{ name: "Ada", email: "ada@example.test", commits: 3 }]);
const CELLS = JSON.stringify([{ weekday: 1, hour: 9, count: 4 }]);

function deps(addon: StatsAddon | null, overrides: Partial<StatsDeps> = {}): StatsDeps {
  return {
    backend: () => "auto",
    isVerified: () => true,
    addonProvider: () => addon,
    ...overrides
  };
}

describe("createStatsSource", () => {
  it("answers both reads' values together", async () => {
    const source = createStatsSource(
      deps({ authorStats: async () => AUTHORS, activityHeatmap: async () => CELLS })
    );
    await expect(source.load("/repos/one")).resolves.toEqual({
      state: "ok",
      authors: [{ name: "Ada", email: "ada@example.test", commits: 3 }],
      cells: [{ weekday: 1, hour: 9, count: 4 }]
    });
  });

  it("answers the authors' unavailable reason first when both reads fail", async () => {
    const source = createStatsSource(deps(null));
    await expect(source.load("/repos/one")).resolves.toEqual({
      state: "unavailable",
      reason: "noAddon"
    });
  });

  it("answers the heatmap's reason when only it is unavailable", async () => {
    const source = createStatsSource(
      deps({
        authorStats: async () => AUTHORS,
        activityHeatmap: async () => {
          throw new Error("nope");
        }
      })
    );
    await expect(source.load("/repos/one")).resolves.toEqual({
      state: "unavailable",
      reason: "failed"
    });
  });

  it("consults no engine export on the git-cli backend and never falls back (TQ2)", async () => {
    const authorStats = vi.fn(async () => AUTHORS);
    const activityHeatmap = vi.fn(async () => CELLS);
    const source = createStatsSource(
      deps({ authorStats, activityHeatmap }, { backend: () => "git-cli" })
    );
    await expect(source.load("/repos/one")).resolves.toEqual({
      state: "unavailable",
      reason: "backendCli"
    });
    expect(authorStats).not.toHaveBeenCalled();
    expect(activityHeatmap).not.toHaveBeenCalled();
  });
});
