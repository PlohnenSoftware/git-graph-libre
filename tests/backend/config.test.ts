import { afterEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => new Map<string, unknown>());

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: (section: string) => ({
      get: <T>(key: string, defaultValue: T): T =>
        (settings.get(`${section}.${key}`) as T | undefined) ?? defaultValue
    })
  }
}));

describe("configuration", () => {
  afterEach(() => {
    settings.clear();
    vi.resetModules();
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
});
