import { afterEach, describe, expect, it, vi } from "vitest";

import { openStatsTab, type StatsWatcher } from "@/extension/statsTab/statsTabPanel";
import type { StatsHostMessage, StatsLoadResult, StatsSource } from "@/statsTabTypes";

import { resetVscodeMock } from "./__mocks__/vscode";
import { okResult } from "./statsTab/fixtures";

type FakePanel = ReturnType<typeof createFakePanel>;

const mocks = vi.hoisted(() => ({
  panels: [] as Array<{ dispose(): void }>,
  create: (..._args: unknown[]): unknown => undefined
}));

vi.mock("vscode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./__mocks__/vscode")>();
  return {
    ...actual,
    ViewColumn: { Active: -1 },
    env: { ...actual.env, language: "en" },
    window: { ...actual.window, createWebviewPanel: (...args: unknown[]) => mocks.create(...args) }
  };
});

function createFakePanel(viewType: string, title: string, column: number, options: unknown) {
  let html = "";
  let receive: ((message: unknown) => void) | undefined;
  let disposed: (() => void) | undefined;
  const panel = {
    viewType,
    title,
    column,
    options: options as { localResourceRoots: Array<{ fsPath: string }> },
    posted: [] as StatsHostMessage[],
    reveal: vi.fn(),
    webview: {
      cspSource: "vscode-webview:",
      asWebviewUri: (uri: { fsPath: string }) => `webview:${uri.fsPath}`,
      get html() {
        return html;
      },
      set html(value: string) {
        html = value;
      },
      postMessage: async (message: StatsHostMessage) => {
        panel.posted.push(message);
        return true;
      },
      onDidReceiveMessage: (handler: (message: unknown) => void) => {
        receive = handler;
        return { dispose: () => {} };
      }
    },
    onDidDispose: (handler: () => void) => {
      disposed = handler;
      return { dispose: () => {} };
    },
    send: (message: unknown) => receive?.(message),
    dispose: () => disposed?.()
  };
  return panel;
}

mocks.create = (viewType, title, column, options) => {
  const panel = createFakePanel(viewType as string, title as string, column as number, options);
  mocks.panels.push(panel);
  return panel;
};

const EXTENSION = "/extension";
const log = { appendLine: vi.fn() };
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const onlyPanel = (): FakePanel => {
  expect(mocks.panels).toHaveLength(1);
  return mocks.panels[0] as FakePanel;
};

function fakeWatcher() {
  const watcher = {
    started: [] as string[],
    stops: 0,
    fire: () => {},
    create(onRefresh: () => void): StatsWatcher {
      watcher.fire = onRefresh;
      return {
        start: (repo: string) => watcher.started.push(repo),
        stop: () => watcher.stops++
      };
    }
  };
  return watcher;
}

function fakeSource(result: StatsLoadResult = okResult()) {
  return { load: vi.fn(async () => result) } satisfies StatsSource;
}

function open(repo = "/repos/one", source: StatsSource = fakeSource(), watcher = fakeWatcher()) {
  openStatsTab(repo, source, {
    extensionPath: EXTENSION,
    outputChannel: log,
    createWatcher: watcher.create,
    locale: "en"
  });
  return watcher;
}

afterEach(() => {
  for (const panel of mocks.panels) panel.dispose();
  mocks.panels.length = 0;
  log.appendLine.mockClear();
  resetVscodeMock();
});

describe("openStatsTab", () => {
  it("creates one retained panel, titled for the repository, watching it", () => {
    const watcher = open();
    const panel = onlyPanel();
    expect(panel.viewType).toBe("git-graph-libre.statsTab");
    expect(panel.title).toBe("Statistics: one");
    expect(panel.column).toBe(-1);
    expect(panel.options).toMatchObject({ enableScripts: true, retainContextWhenHidden: true });
    expect(panel.options.localResourceRoots.map((uri) => uri.fsPath)).toEqual([
      `${EXTENSION}/media`,
      `${EXTENSION}/out`
    ]);
    expect(watcher.started).toEqual(["/repos/one"]);
  });

  it("builds a nonce-only script CSP with no unsafe-eval, loading the tab's files", () => {
    open();
    const { html } = onlyPanel().webview;
    const nonce = /script-src vscode-webview: 'nonce-([^']+)'/.exec(html)?.[1];
    expect(nonce).toMatch(/^[\w-]{16,}$/);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain("unsafe-eval");
    expect(html).toContain(
      `<script nonce="${nonce}" src="webview:${EXTENSION}/out/statsTab.min.js"></script>`
    );
    expect(html).toContain(`href="webview:${EXTENSION}/media/tokens.css"`);
    expect(html).toContain(`href="webview:${EXTENSION}/media/stats-tab/stats-tab.css"`);
  });

  it("posts the loading notice, then the result with its labels, once ready", async () => {
    open();
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(panel.posted.map((message) => message.command)).toEqual(["statsLoading", "statsData"]);
    const data = panel.posted[1] as Extract<StatsHostMessage, { command: "statsData" }>;
    expect(data.requestId).toBeGreaterThan(0);
    expect(data.result).toEqual(okResult());
    expect(data.labels.contributors).toBe("Contributors");
    expect(data.labels.refresh).toBe("Refresh");
    expect(data.labels.weekdays).toHaveLength(7);
    expect(data.labels.weekdays[0]).toBe("Sunday");
    expect(data.labels.weekdaysShort[6]).toBe("Sat");
    expect(Object.keys(data.labels.unavailableReasons).toSorted()).toEqual([
      "backendCli",
      "failed",
      "noAddon",
      "notVerified"
    ]);
    // A second ready (the document was rebuilt) replays the same result.
    panel.send({ command: "ready" });
    expect(panel.posted.at(-1)).toBe(data);
  });

  it("serves the cached result on a reopen instead of reading again (TQ7)", async () => {
    const source = fakeSource();
    open("/repos/one", source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(source.load).toHaveBeenCalledTimes(1);

    open("/repos/one", source);
    await flush();
    expect(source.load).toHaveBeenCalledTimes(1);
    expect(panel.posted.at(-1)?.command).toBe("statsData");
    expect(panel.reveal).toHaveBeenCalled();
  });

  it("reloads when the watcher reports a repository change or Refresh is asked", async () => {
    const source = fakeSource();
    const watcher = open("/repos/one", source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();

    watcher.fire();
    await flush();
    expect(source.load).toHaveBeenCalledTimes(2);
    expect(log.appendLine).toHaveBeenCalledWith("[statsTab] refresh repo=/repos/one");

    panel.send({ command: "refresh" });
    await flush();
    expect(source.load).toHaveBeenCalledTimes(3);
  });

  it("never caches an unavailable answer, and a throwing source answers failed", async () => {
    const unavailable = fakeSource({ state: "unavailable", reason: "noAddon" });
    open("/repos/one", unavailable);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    open("/repos/one", unavailable);
    await flush();
    expect(unavailable.load).toHaveBeenCalledTimes(2);

    const throwing: StatsSource = {
      load: async () => {
        throw new Error("boom");
      }
    };
    open("/repos/two", throwing);
    await flush();
    const data = panel.posted.at(-1) as Extract<StatsHostMessage, { command: "statsData" }>;
    expect(data.result).toEqual({ state: "unavailable", reason: "failed" });
  });

  it("retargets the one panel to another repository and stops watching on dispose", async () => {
    const watcher = open("/repos/one");
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    open("/repos/two", fakeSource(), watcher);
    await flush();
    expect(mocks.panels).toHaveLength(1);
    expect(panel.title).toBe("Statistics: two");
    expect(watcher.started).toEqual(["/repos/one", "/repos/two"]);
    panel.dispose();
    expect(watcher.stops).toBe(1);
  });
});
