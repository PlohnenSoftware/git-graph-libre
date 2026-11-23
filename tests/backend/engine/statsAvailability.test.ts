import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EngineAddon } from "@/backend/engine/addon";
import {
  isStatsTabAvailable,
  STATS_TAB_AVAILABLE_CONTEXT,
  setStatsTabAvailableContext
} from "@/extension/statsTab/availability";

const executed = vi.hoisted(() => [] as unknown[][]);

vi.mock("vscode", () => ({
  commands: {
    executeCommand: (...args: unknown[]) => {
      executed.push(args);
      return Promise.resolve();
    }
  }
}));

type StatsAddon = Pick<EngineAddon, "authorStats" | "activityHeatmap">;

function fullAddon(): StatsAddon {
  return {
    authorStats: () => Promise.resolve("[]"),
    activityHeatmap: () => Promise.resolve("[]")
  };
}

beforeEach(() => {
  executed.length = 0;
});

describe("statsTabAvailable context key", () => {
  it("is true on auto when the addon exports both statistics reads", () => {
    const addon = fullAddon();

    expect(isStatsTabAvailable({ backend: () => "auto", addonProvider: () => addon })).toBe(true);
    expect(setStatsTabAvailableContext({ backend: () => "auto", addonProvider: () => addon })).toBe(
      true
    );
    expect(executed).toContainEqual(["setContext", STATS_TAB_AVAILABLE_CONTEXT, true]);
  });

  it("is false with no addon at all", () => {
    expect(isStatsTabAvailable({ backend: () => "auto", addonProvider: () => null })).toBe(false);
    expect(setStatsTabAvailableContext({ backend: () => "auto", addonProvider: () => null })).toBe(
      false
    );
    expect(executed).toContainEqual(["setContext", STATS_TAB_AVAILABLE_CONTEXT, false]);
  });

  it("is false when the addon is missing either export", () => {
    const addon = fullAddon();
    const withoutHeatmap = { authorStats: addon.authorStats } as StatsAddon;
    const withoutAuthors = { activityHeatmap: addon.activityHeatmap } as StatsAddon;

    expect(
      isStatsTabAvailable({ backend: () => "auto", addonProvider: () => withoutHeatmap })
    ).toBe(false);
    expect(
      isStatsTabAvailable({ backend: () => "auto", addonProvider: () => withoutAuthors })
    ).toBe(false);
  });

  it("is false on the git-cli backend without loading the addon", () => {
    const addonProvider = vi.fn(() => fullAddon());

    expect(isStatsTabAvailable({ backend: () => "git-cli", addonProvider })).toBe(false);
    expect(addonProvider).not.toHaveBeenCalled();
    expect(setStatsTabAvailableContext({ backend: () => "git-cli", addonProvider })).toBe(false);
    expect(executed).toContainEqual(["setContext", STATS_TAB_AVAILABLE_CONTEXT, false]);
  });

  it("is false when no backend is given, as the Diff tab's key is", () => {
    expect(isStatsTabAvailable({ addonProvider: () => fullAddon() })).toBe(false);
  });
});
