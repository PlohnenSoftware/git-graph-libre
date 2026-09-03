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

  it("keeps checked-out commit bolding off until it is turned on", async () => {
    const { config } = await import("@/config");
    expect(config.boldCheckedOutCommit()).toBe(false);

    settings.set("git-graph-libre.repository.boldCheckedOutCommit", true);
    expect(config.boldCheckedOutCommit()).toBe(true);
  });

  it("pre-checks fetch tags by default and honors an opt-out", async () => {
    const { config } = await import("@/config");
    expect(config.fetchTagsByDefault()).toBe(true);

    settings.set("git-graph-libre.repository.fetchTagsByDefault", false);
    expect(config.fetchTagsByDefault()).toBe(false);
  });

  it("keeps the signature column off by default and reads its permanent setting", async () => {
    const { config } = await import("@/config");
    expect(config.showSignatureColumn()).toBe(false);

    settings.set("git-graph-libre.columns.signature", true);
    expect(config.showSignatureColumn()).toBe(true);
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

  it("accepts OKLCH, HEX, and RGB reveal highlight colors", async () => {
    settings.set("git-graph-libre.revealHighlightColor", "#0085d9");

    const { config } = await import("@/config");

    expect(config.revealHighlightColor()).toBe("#0085d9");

    settings.set("git-graph-libre.revealHighlightColor", "red");
    expect(config.revealHighlightColor()).toBe("oklch(90% 0.25 150 / 0.42)");
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

  it.each([
    { accessor: "autoCenterCommitDetailsView", expected: true },
    { accessor: "dateFormat", expected: "Date & Time" },
    { accessor: "dateType", expected: "Author Date" },
    { accessor: "fetchAvatars", expected: false },
    { accessor: "graphStyle", expected: "rounded" },
    { accessor: "graphFontSize", expected: 13 },
    { accessor: "graphRowHeight", expected: 24 },
    { accessor: "revealHighlightColor", expected: "oklch(90% 0.25 150 / 0.42)" },
    { accessor: "shortHashLength", expected: 8 },
    { accessor: "initialLoadCommits", expected: 300 },
    { accessor: "includeReflog", expected: false },
    { accessor: "includeUnreachableCommits", expected: false },
    { accessor: "loadMoreCommits", expected: 75 },
    { accessor: "maxDepthOfRepoSearch", expected: 0 },
    { accessor: "muteCommitsNotAncestorsOfHead", expected: false },
    { accessor: "muteMergeCommits", expected: false },
    { accessor: "boldCheckedOutCommit", expected: false },
    { accessor: "fetchTagsByDefault", expected: true },
    { accessor: "onlyFollowFirstParent", expected: false },
    { accessor: "showCurrentBranchByDefault", expected: false },
    { accessor: "showRemoteBranches", expected: true },
    { accessor: "showStatusBarItem", expected: true },
    { accessor: "showStashes", expected: true },
    { accessor: "showTags", expected: true },
    { accessor: "showUncommittedChanges", expected: true },
    { accessor: "telemetryConsent", expected: "unset" },
    { accessor: "showSignatureColumn", expected: false },
    { accessor: "commitDetailsCompactFolders", expected: false },
    { accessor: "commitDetailsFileViewMode", expected: "tree" },
    { accessor: "tabIconColorTheme", expected: "color" },
    { accessor: "gitPath", expected: "git" },
    { accessor: "customBranchGlobPatterns", expected: [] }
  ])("reads $accessor with its manifest default", async ({ accessor, expected }) => {
    const { config } = await import("@/config");
    const read = (config as unknown as Record<string, () => unknown>)[accessor];

    expect(read()).toEqual(expected);
  });

  it("returns the default graph colors when nothing is configured", async () => {
    const { config } = await import("@/config");

    const colors = config.graphColors();

    expect(colors.length).toBeGreaterThan(0);
    expect(colors.every((color) => typeof color === "string")).toBe(true);
  });

  it.each([
    {
      name: "drops graph colors that are not valid color values",
      setting: "git-graph-libre.graphColors",
      value: ["oklch(65% 0.16 250)", "not-a-color", 42],
      accessor: "graphColors",
      expected: ["oklch(65% 0.16 250)"]
    },
    {
      name: "reads graph colors from the legacy British spelling",
      setting: "git-graph-libre.graphColours",
      value: ["oklch(70% 0.1 20)"],
      accessor: "graphColors",
      expected: ["oklch(70% 0.1 20)"]
    },
    {
      name: "reads the grey tab icon theme from the legacy British spelling",
      setting: "git-graph-libre.tabIconColourTheme",
      value: "grey",
      accessor: "tabIconColorTheme",
      expected: "grey"
    },
    {
      name: "takes the git executable path from the git extension settings",
      setting: "git.path",
      value: "/usr/local/bin/git",
      accessor: "gitPath",
      expected: "/usr/local/bin/git"
    },
    {
      name: "falls back when the reveal highlight color is not a color",
      setting: "git-graph-libre.revealHighlightColor",
      value: "definitely not a color",
      accessor: "revealHighlightColor",
      expected: "oklch(90% 0.25 150 / 0.42)"
    }
  ])("$name", async ({ setting, value, accessor, expected }) => {
    settings.set(setting, value);

    const { config } = await import("@/config");
    const read = (config as unknown as Record<string, () => unknown>)[accessor];

    expect(read()).toEqual(expected);
  });
});
