import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DiffTabPayload,
  DiffTabRequest,
  DiffTabShowMessage,
  DiffTabSource
} from "@/diffTabTypes";
import { openDiffTab } from "@/extension/diffTab/diffTabPanel";

import { resetVscodeMock, setConfigurationValue } from "./__mocks__/vscode";

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
    htmlWrites: 0,
    posted: [] as DiffTabShowMessage[],
    reveal: vi.fn(),
    webview: {
      cspSource: "vscode-webview:",
      asWebviewUri: (uri: { fsPath: string }) => `webview:${uri.fsPath}`,
      get html() {
        return html;
      },
      set html(value: string) {
        html = value;
        panel.htmlWrites++;
      },
      postMessage: async (message: DiffTabShowMessage) => {
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
const DIFF: DiffTabPayload = {
  kind: "diff",
  originalLines: ["a"],
  modifiedLines: ["b"],
  changes: []
};
const log = { appendLine: vi.fn() };

const request = (title: string): DiffTabRequest => ({
  repo: "/repo",
  left: { kind: "revision", ref: "HEAD", path: title },
  right: { kind: "workingTree", path: title },
  title
});
const resolved = (payload: DiffTabPayload): DiffTabSource => ({ load: async () => payload });
const open = (title: string, source: DiffTabSource = resolved(DIFF)) =>
  openDiffTab(request(title), source, { extensionPath: EXTENSION, outputChannel: log });
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const onlyPanel = (): FakePanel => {
  expect(mocks.panels).toHaveLength(1);
  return mocks.panels[0] as FakePanel;
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  for (const panel of mocks.panels) panel.dispose();
  mocks.panels.length = 0;
  log.appendLine.mockClear();
  resetVscodeMock();
});

describe("openDiffTab", () => {
  it("creates one retained panel in the active column, with media and out as roots", () => {
    open("a.ts");
    const panel = onlyPanel();
    expect(panel.viewType).toBe("git-graph-libre.diffTab");
    expect(panel.title).toBe("a.ts");
    expect(panel.column).toBe(-1);
    expect(panel.options).toMatchObject({ enableScripts: true, retainContextWhenHidden: true });
    expect(panel.options.localResourceRoots.map((uri) => uri.fsPath)).toEqual([
      `${EXTENSION}/media`,
      `${EXTENSION}/out`
    ]);
  });

  it("builds a nonce-only script CSP with no unsafe-eval, loading the tab's files", () => {
    open("a.ts");
    const { html } = onlyPanel().webview;
    const nonce = /script-src vscode-webview: 'nonce-([^']+)'/.exec(html)?.[1];
    expect(nonce).toMatch(/^[\w-]{16,}$/);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain("unsafe-eval");
    expect(html).toContain(
      `<script nonce="${nonce}" src="webview:${EXTENSION}/out/diffTab.min.js"></script>`
    );
    expect(html).toContain(`href="webview:${EXTENSION}/media/diff-tab/vscode-diff.css"`);
    expect(html).toContain(`href="webview:${EXTENSION}/media/diff-tab/diff-tab.css"`);
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it("reuses the panel for a second open: new title and payload, same document", async () => {
    open("a.ts");
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    const next: DiffTabPayload = { kind: "binary" };
    open("b.ts", resolved(next));
    await flush();
    expect(onlyPanel()).toBe(panel);
    expect(panel.title).toBe("b.ts");
    expect(panel.reveal).toHaveBeenLastCalledWith(-1);
    expect(panel.htmlWrites).toBe(1);
    expect(panel.posted.map((message) => message.payload)).toEqual([DIFF, next]);
  });

  it.each(["load first", "ready first"])(
    "starts the load before ready, and posts once both are done (%s)",
    async (order) => {
      const load = deferred<DiffTabPayload>();
      const source = { load: vi.fn(() => load.promise) };
      open("a.ts", source);
      const panel = onlyPanel();
      expect(source.load).toHaveBeenCalledWith(request("a.ts"));
      if (order === "load first") load.resolve(DIFF);
      else panel.send({ command: "ready" });
      await flush();
      expect(panel.posted).toHaveLength(0);
      if (order === "load first") panel.send({ command: "ready" });
      else load.resolve(DIFF);
      await flush();
      expect(panel.posted.map((message) => message.payload)).toEqual([DIFF]);
    }
  );

  it("posts the last payload again when the webview reports ready after a hide", async () => {
    open("a.ts");
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    panel.send({ command: "ready" });
    expect(panel.posted).toHaveLength(2);
    expect(panel.posted[1]).toEqual(panel.posted[0]);
  });

  it("never posts a load that a later open superseded", async () => {
    const slow = deferred<DiffTabPayload>();
    open("a.ts", { load: () => slow.promise });
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    open("b.ts", resolved({ kind: "tooLarge" }));
    await flush();
    slow.resolve(DIFF);
    await flush();
    expect(panel.posted.map((message) => message.payload)).toEqual([{ kind: "tooLarge" }]);
  });

  it("turns a failed load into an error payload", async () => {
    open("a.ts", { load: () => Promise.reject(new Error("no such path")) });
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(panel.posted[0].payload).toEqual({ kind: "error", message: "no such path" });
  });

  it("passes the localized labels with the payload", async () => {
    open("a.ts");
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(panel.posted[0].labels).toEqual({
      hiddenLines: "{0} hidden lines",
      showMoreAbove: "Show More Above",
      showMoreBelow: "Show More Below",
      showAll: "Show All",
      binaryFile: "This is a binary file; there is no text diff to show.",
      tooLarge: "This file is too large to diff here (diffEditor.maxFileSize).",
      loadError: "Unable to load the diff: {0}"
    });
  });

  it.each([
    [
      {},
      { hideUnchanged: false, contextLineCount: 3, minimumLineCount: 3, revealLineCount: 20 },
      21,
      4
    ],
    [
      {
        "diffEditor.hideUnchangedRegions.enabled": true,
        "diffEditor.hideUnchangedRegions.contextLineCount": 5,
        "diffEditor.hideUnchangedRegions.minimumLineCount": 4,
        "diffEditor.hideUnchangedRegions.revealLineCount": 10,
        "editor.lineHeight": 0,
        "editor.fontSize": 16,
        "editor.tabSize": 2
      },
      { hideUnchanged: true, contextLineCount: 5, minimumLineCount: 4, revealLineCount: 10 },
      24,
      2
    ],
    [{ "editor.lineHeight": 1.5, "editor.fontSize": 12 }, undefined, 18, 4],
    [{ "editor.lineHeight": 30 }, undefined, 30, 4],
    [{ "editor.lineHeight": 0.1 }, undefined, 8, 4]
  ])(
    "reads the user's settings into the view's options: %o",
    async (settings, layout, lineHeight, tabSize) => {
      for (const [key, value] of Object.entries(settings)) {
        const dot = key.indexOf(".");
        setConfigurationValue(key.slice(0, dot), key.slice(dot + 1), value);
      }
      open("a.ts");
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();
      const [message] = panel.posted;
      if (layout) expect(message.layout).toEqual(layout);
      expect(message.lineHeight).toBe(lineHeight);
      expect(message.tabSize).toBe(tabSize);
    }
  );

  it("logs the webview's first paint", () => {
    open("a.ts");
    onlyPanel().send({ command: "painted", ms: 41.6, rows: 120 });
    expect(log.appendLine).toHaveBeenCalledWith("[diffTab] painted ms=42 rows=120");
  });

  it("opens a fresh panel after the user closes the tab", async () => {
    open("a.ts");
    const first = onlyPanel();
    first.dispose();
    mocks.panels.length = 0;
    open("b.ts");
    const second = onlyPanel();
    expect(second).not.toBe(first);
    expect(second.title).toBe("b.ts");
  });
});
