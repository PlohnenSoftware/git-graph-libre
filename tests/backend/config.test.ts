import { afterEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => new Map<string, unknown>());

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: (section: string) => ({
      get: <T>(key: string, defaultValue: T): T =>
        (settings.get(`${section}.${key}`) as T | undefined) ?? defaultValue,
      inspect: <T>(key: string) => ({
        globalValue: settings.get(`${section}.${key}`) as T | undefined
      })
    })
  }
}));

describe("configuration", () => {
  afterEach(() => {
    settings.clear();
    vi.resetModules();
  });

  it("normalizes context menu action visibility from user settings", async () => {
    settings.set("git-graph-libre.contextMenuActionsVisibility", {
      tag: { push: false },
      bogusGroup: { anything: false }
    });

    const { config } = await import("@/config");
    const visibility = config.contextMenuActionsVisibility();

    expect(visibility.tag.push).toBe(false);
    expect(visibility.tag.delete).toBe(true);
    expect("bogusGroup" in visibility).toBe(false);
  });

  it("bounds graph density settings before they reach the webview", async () => {
    settings.set("git-graph-libre.graph.fontSize", 40);
    settings.set("git-graph-libre.graph.rowHeight", 10);

    const { config } = await import("@/config");

    expect(config.graphFontSize()).toBe(24);
    expect(config.graphRowHeight()).toBe(18);
  });

  it("falls back when graph density settings are invalid", async () => {
    settings.set("git-graph-libre.graph.fontSize", Number.NaN);
    settings.set("git-graph-libre.graph.rowHeight", "compact");

    const { config } = await import("@/config");

    expect(config.graphFontSize()).toBe(13);
    expect(config.graphRowHeight()).toBe(24);
  });

  it("bounds short hash display length before it reaches the webview", async () => {
    settings.set("git-graph-libre.shortHashLength", 100);

    const { config } = await import("@/config");

    expect(config.shortHashLength()).toBe(64);
  });

  it("falls back when short hash display length is invalid", async () => {
    settings.set("git-graph-libre.shortHashLength", Number.NaN);

    const { config } = await import("@/config");

    expect(config.shortHashLength()).toBe(8);
  });

  it("reads commit details file view settings with safe defaults", async () => {
    settings.set("git-graph-libre.commitDetails.fileViewMode", "list");
    settings.set("git-graph-libre.commitDetails.compactFolders", true);

    const { config } = await import("@/config");

    expect(config.commitDetailsFileViewMode()).toBe("list");
    expect(config.commitDetailsCompactFolders()).toBe(true);
  });

  it("falls back when commit details file view mode is invalid", async () => {
    settings.set("git-graph-libre.commitDetails.fileViewMode", "cards");

    const { config } = await import("@/config");

    expect(config.commitDetailsFileViewMode()).toBe("tree");
  });

  it("accepts OKLCH, HEX, and RGB graph colors and filters invalid values", async () => {
    settings.set("git-graph-libre.graphColors", [
      "oklch(65% 0.17 245)",
      "oklch(62% 0.24 350 / 0.8)",
      "#0085d9",
      "rgb(0, 133, 217)",
      "red",
      "oklch(banana)"
    ]);

    const { config } = await import("@/config");

    expect(config.graphColors()).toEqual([
      "oklch(65% 0.17 245)",
      "oklch(62% 0.24 350 / 0.8)",
      "#0085d9",
      "rgb(0, 133, 217)"
    ]);
  });

  it("provides an OKLCH default graph color palette", async () => {
    const { config } = await import("@/config");

    const colors = config.graphColors();

    expect(colors).toHaveLength(12);
    for (const color of colors) {
      expect(color).toMatch(/^oklch\(/);
    }
  });

  it("honors values stored under the legacy graphColours key", async () => {
    settings.set("git-graph-libre.graphColours", ["#0085d9"]);

    const { config } = await import("@/config");

    expect(config.graphColors()).toEqual(["#0085d9"]);
  });

  it("prefers the renamed graphColors key over the legacy key", async () => {
    settings.set("git-graph-libre.graphColours", ["#0085d9"]);
    settings.set("git-graph-libre.graphColors", ["rgb(1, 2, 3)"]);

    const { config } = await import("@/config");

    expect(config.graphColors()).toEqual(["rgb(1, 2, 3)"]);
  });

  it("normalizes tab icon themes from renamed and legacy keys", async () => {
    settings.set("git-graph-libre.tabIconColourTheme", "grey");

    const { config } = await import("@/config");

    expect(config.tabIconColorTheme()).toBe("grey");
  });

  it("maps the legacy colour tab icon value to color", async () => {
    settings.set("git-graph-libre.tabIconColourTheme", "colour");

    const { config } = await import("@/config");

    expect(config.tabIconColorTheme()).toBe("color");
  });

  it("normalizes custom branch glob presets before they reach the webview", async () => {
    settings.set("git-graph-libre.customBranchGlobPatterns", [
      { name: "Features", glob: "heads/feature/*" },
      { name: " Releases ", glob: " refs/remotes/origin/release/* " },
      { name: "", glob: "heads/empty/*" },
      { name: "Bad", glob: "" },
      { name: "Wrong" }
    ]);

    const { config } = await import("@/config");

    expect(config.customBranchGlobPatterns()).toEqual([
      { name: "Features", glob: "--glob=heads/feature/*" },
      { name: "Releases", glob: "--glob=refs/remotes/origin/release/*" }
    ]);
  });
});
