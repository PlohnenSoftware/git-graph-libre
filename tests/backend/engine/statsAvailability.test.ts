import * as fs from "node:fs";
import * as path from "node:path";

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

type Manifest = {
  contributes: {
    commands: Array<{ command: string; title?: string; category?: string }>;
    menus: Record<string, Array<{ command: string; when?: string; group?: string }>>;
  };
};

function readManifest(): Manifest {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8")
  ) as Manifest;
}

describe("Statistics manifest when clauses", () => {
  it("gates the Show Statistics command palette entry on statsTabAvailable", () => {
    const manifest = readManifest();
    const palette = manifest.contributes.menus.commandPalette ?? [];
    expect(palette).toContainEqual({
      command: "git-graph-libre.showStatistics",
      when: STATS_TAB_AVAILABLE_CONTEXT
    });
  });

  it("gates every menu entry for showStatistics on statsTabAvailable", () => {
    const menus = readManifest().contributes.menus;
    const statsEntries = Object.values(menus)
      .flat()
      .filter((entry) => entry.command === "git-graph-libre.showStatistics");
    expect(statsEntries.length).toBeGreaterThan(0);
    for (const entry of statsEntries) {
      expect(entry.when).toContain(STATS_TAB_AVAILABLE_CONTEXT);
    }
  });
});
