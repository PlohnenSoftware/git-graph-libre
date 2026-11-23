import { describe, expect, it } from "vitest";

import {
  applyData,
  applyLoading,
  buildHeatmapGrid,
  heatLevel,
  initialStatsState,
  rankAuthors
} from "@/webview/statsTab/model";

import { dataMessage, loadingMessage, okResult } from "./fixtures";

describe("rankAuthors", () => {
  it("ranks by commits with shares of the total and lengths against the top", () => {
    const ranked = rankAuthors([
      { name: "Lin", email: "lin@example.test", commits: 1 },
      { name: "Ada", email: "ada@example.test", commits: 3 }
    ]);
    expect(ranked.map((author) => author.name)).toEqual(["Ada", "Lin"]);
    expect(ranked[0]).toMatchObject({ share: 0.75, relative: 1 });
    expect(ranked[1]?.share).toBe(0.25);
    expect(ranked[1]?.relative).toBeCloseTo(1 / 3);
  });

  it("breaks ties by name then email, and survives an empty or zero list", () => {
    const ranked = rankAuthors([
      { name: "Sam", email: "b@example.test", commits: 2 },
      { name: "Sam", email: "a@example.test", commits: 2 },
      { name: "Ada", email: "z@example.test", commits: 2 }
    ]);
    expect(ranked.map((author) => author.email)).toEqual([
      "z@example.test",
      "a@example.test",
      "b@example.test"
    ]);
    expect(rankAuthors([])).toEqual([]);
    expect(rankAuthors([{ name: "Nul", email: "", commits: 0 }])[0]).toMatchObject({
      share: 0,
      relative: 0
    });
  });
});

describe("buildHeatmapGrid and heatLevel", () => {
  it("lays the sparse cells out as 7 rows of 24 and tracks the busiest cell", () => {
    const grid = buildHeatmapGrid([
      { weekday: 1, hour: 9, count: 4 },
      { weekday: 6, hour: 23, count: 2 }
    ]);
    expect(grid.counts).toHaveLength(7);
    for (const row of grid.counts) expect(row).toHaveLength(24);
    expect(grid.counts[1]?.[9]).toBe(4);
    expect(grid.counts[6]?.[23]).toBe(2);
    expect(grid.counts[0]?.[0]).toBe(0);
    expect(grid.max).toBe(4);
  });

  it("adds duplicate cells together and ignores an out-of-range weekday", () => {
    const grid = buildHeatmapGrid([
      { weekday: 2, hour: 3, count: 1 },
      { weekday: 2, hour: 3, count: 2 },
      { weekday: 9, hour: 3, count: 5 }
    ]);
    expect(grid.counts[2]?.[3]).toBe(3);
    expect(grid.max).toBe(3);
  });

  it("spreads counts over the five steps, busiest cell on top", () => {
    expect(heatLevel(0, 4)).toBe(0);
    expect(heatLevel(1, 4)).toBe(1);
    expect(heatLevel(2, 4)).toBe(2);
    expect(heatLevel(3, 4)).toBe(3);
    expect(heatLevel(4, 4)).toBe(4);
    expect(heatLevel(1, 100)).toBe(1);
    expect(heatLevel(5, 0)).toBe(0);
  });
});

describe("state folding", () => {
  it("keeps the shown result behind a same-repository reload, drops it across repositories", () => {
    const loaded = applyData(initialStatsState(), dataMessage());
    const reloading = applyLoading(loaded, loadingMessage({ requestId: 2 }));
    expect(reloading.loading).toBe(true);
    expect(reloading.result).toEqual(okResult());
    const other = applyLoading(loaded, loadingMessage({ requestId: 2, repo: "/repos/two" }));
    expect(other.result).toBeNull();
  });

  it("drops a reply older than the newest load seen", () => {
    const loaded = applyData(initialStatsState(), dataMessage({ requestId: 3 }));
    const stale = applyData(
      loaded,
      dataMessage({ requestId: 2, result: { state: "unavailable", reason: "failed" } })
    );
    expect(stale).toBe(loaded);
    expect(applyLoading(loaded, loadingMessage({ requestId: 2 }))).toBe(loaded);
  });
});
