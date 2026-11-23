import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlameHostMessage, BlamePayload, BlameSource } from "@/blameTabTypes";
import { openBlameTab } from "@/extension/blameTab/blameTabPanel";

import { resetVscodeMock, setConfigurationValue } from "./__mocks__/vscode";
import { payload } from "./blameTab/fixtures";

type FakePanel = ReturnType<typeof createFakePanel>;

const mocks = vi.hoisted(() => ({
  panels: [] as Array<{ dispose(): void }>,
  create: (..._args: unknown[]): unknown => undefined,
  onConfig: undefined as
    | ((event: { affectsConfiguration: (key: string) => boolean }) => void)
    | undefined
}));

vi.mock("vscode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./__mocks__/vscode")>();
  return {
    ...actual,
    ViewColumn: { Active: -1 },
    env: { ...actual.env, language: "en" },
    workspace: {
      ...actual.workspace,
      onDidChangeConfiguration: (
        handler: (event: { affectsConfiguration: (key: string) => boolean }) => void
      ) => {
        mocks.onConfig = handler;
        return { dispose: () => {} };
      }
    },
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
    posted: [] as BlameHostMessage[],
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
      postMessage: async (message: BlameHostMessage) => {
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
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const resolved = (value: BlamePayload = payload()): BlameSource => ({
  load: async () => value
});

function open(
  target: { repo: string; filePath: string; targetLine?: number | null } = {
    repo: "/repos/one",
    filePath: "src/file.ts"
  },
  source: BlameSource = resolved(),
  reportBlameOpened?: (outcome: { ok: boolean }) => void
) {
  openBlameTab(target, source, {
    extensionPath: EXTENSION,
    outputChannel: log,
    locale: "en",
    reportBlameOpened
  });
}

afterEach(() => {
  for (const panel of mocks.panels) panel.dispose();
  mocks.panels.length = 0;
  mocks.onConfig = undefined;
  log.appendLine.mockClear();
  resetVscodeMock();
});

describe("openBlameTab", () => {
  it("creates one retained panel, titled for the file", () => {
    open();
    const panel = onlyPanel();
    expect(panel.viewType).toBe("git-graph-libre.blameTab");
    expect(panel.title).toBe("Blame: file.ts");
    expect(panel.column).toBe(-1);
    expect(panel.options).toMatchObject({ enableScripts: true, retainContextWhenHidden: true });
    expect(panel.options.localResourceRoots.map((uri) => uri.fsPath)).toEqual([
      `${EXTENSION}/media`,
      `${EXTENSION}/out`
    ]);
  });

  it("builds a nonce-only script CSP with no unsafe-eval, loading the tab's files", () => {
    open();
    const { html } = onlyPanel().webview;
    const nonce = /script-src vscode-webview: 'nonce-([^']+)'/.exec(html)?.[1];
    expect(nonce).toMatch(/^[\w-]{16,}$/);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain("unsafe-eval");
    expect(html).toContain(
      `<script nonce="${nonce}" src="webview:${EXTENSION}/out/blameTab.min.js"></script>`
    );
    expect(html).toContain(`href="webview:${EXTENSION}/media/tokens.css"`);
    expect(html).toContain(`href="webview:${EXTENSION}/media/blame-tab/blame-tab.css"`);
  });

  it("posts the loading notice, then the blame with its labels, once ready", async () => {
    const opened: Array<{ ok: boolean }> = [];
    open({ repo: "/repos/one", filePath: "src/file.ts", targetLine: 3 }, resolved(), (o) =>
      opened.push(o)
    );
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(panel.posted.map((m) => m.command)).toEqual(["blameLoading", "blameData"]);
    const data = panel.posted[1] as Extract<BlameHostMessage, { command: "blameData" }>;
    expect(data.requestId).toBeGreaterThan(0);
    expect(data.repo).toBe("/repos/one");
    expect(data.filePath).toBe("src/file.ts");
    expect(data.rev).toBeNull();
    expect(data.targetLine).toBe(3);
    expect(data.labels.loading).toBe("Loading blame…");
    expect(data.labels.uncommitted).toBe("Uncommitted changes");
    expect(data.labels.workingTree).toBe("Working Tree");
    expect(data.labels.loadError).toContain("{0}");
    // The graph's own words for the two shared concepts.
    expect(data.labels.columnCommit).toBe("Commit");
    expect(data.labels.columnDate).toBe("Date");
    // The graph's display settings and the editor typography ride along.
    expect(data.display.shortHashLength).toBe(8);
    expect(data.display.dateFormat).toBe("Date & Time");
    expect(data.display.datePattern).toBe("DD MM YYYY");
    expect(data.display.needMonthName).toBe(true);
    expect(data.display.months).toHaveLength(12);
    expect(data.typography).toEqual({ fontSize: 14, lineHeight: 21, tabSize: 4 });
    expect(data.payload.hunks).toHaveLength(2);
    // The T1 call site reported this open exactly once, as a success.
    expect(opened).toEqual([{ ok: true }]);
    // A second ready (the document was rebuilt) replays the same blame.
    panel.send({ command: "ready" });
    expect(panel.posted).toHaveLength(3);
    expect(panel.posted[2]).toEqual(panel.posted[1]);
    // A refresh reloads without reporting a new open.
    panel.send({ command: "refresh" });
    await flush();
    expect(opened).toEqual([{ ok: true }]);
    expect(panel.posted.filter((m) => m.command === "blameData")).toHaveLength(3);
  });

  it("reloads live when a graph display setting changes, with the value read fresh", async () => {
    open();
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    setConfigurationValue("git-graph-libre", "shortHashLength", 12);
    mocks.onConfig?.({
      affectsConfiguration: (key: string) => key === "git-graph-libre.shortHashLength"
    });
    await flush();
    const datas = panel.posted.filter(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(datas).toHaveLength(2);
    expect(datas[1].display.shortHashLength).toBe(12);
    // An unrelated setting does not reload the tab.
    mocks.onConfig?.({ affectsConfiguration: () => false });
    await flush();
    expect(panel.posted.filter((m) => m.command === "blameData")).toHaveLength(2);
  });

  it("reloads live when the editor typography changes", async () => {
    open();
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    setConfigurationValue("editor", "fontSize", 20);
    setConfigurationValue("editor", "tabSize", 2);
    mocks.onConfig?.({ affectsConfiguration: (key: string) => key === "editor.fontSize" });
    await flush();
    const datas = panel.posted.filter(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(datas).toHaveLength(2);
    // lineHeight 0 derives from the font size at × 1.5, as the diff tab does.
    expect(datas[1].typography).toEqual({ fontSize: 20, lineHeight: 30, tabSize: 2 });
  });

  it("reuses the panel for another file: retitle, same document", async () => {
    open();
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    openBlameTab({ repo: "/repos/two", filePath: "docs/guide.md" }, resolved(), {
      extensionPath: EXTENSION,
      outputChannel: log,
      locale: "en"
    });
    await flush();
    expect(onlyPanel()).toBe(panel);
    expect(panel.title).toBe("Blame: guide.md");
    expect(panel.reveal).toHaveBeenLastCalledWith(-1);
    expect(panel.htmlWrites).toBe(1);
    const datas = panel.posted.filter((m) => m.command === "blameData");
    expect(datas.at(-1)?.repo).toBe("/repos/two");
    expect(datas.at(-1)?.filePath).toBe("docs/guide.md");
  });

  it("never posts a load that a newer one superseded", async () => {
    const slow = deferred<BlamePayload>();
    let first = true;
    const source: BlameSource = {
      load: async () => {
        if (first) {
          first = false;
          return slow.promise;
        }
        return payload({ totalLines: 99 });
      }
    };
    open({ repo: "/repos/one", filePath: "src/file.ts" }, source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    panel.send({ command: "refresh" });
    await flush();
    slow.resolve(payload({ totalLines: 4 }));
    await flush();
    const datas = panel.posted.filter(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(datas).toHaveLength(1);
    expect(datas[0].payload.totalLines).toBe(99);
  });

  it("turns a failed load into an error payload and reports the open as failed", async () => {
    const opened: Array<{ ok: boolean }> = [];
    open(
      { repo: "/repos/one", filePath: "src/file.ts" },
      { load: () => Promise.reject(new Error("git went away")) },
      (o) => opened.push(o)
    );
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    const data = panel.posted.find(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(data?.payload.error).toBe("git went away");
    expect(data?.payload.state).toBeNull();
    expect(data?.payload.hunks).toEqual([]);
    expect(opened).toEqual([{ ok: false }]);
  });

  it("refuses a target line that is not a whole 1-based line", async () => {
    open({ repo: "/repos/one", filePath: "src/file.ts", targetLine: 0 });
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    const data = panel.posted.find(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(data?.targetLine).toBeNull();
  });

  it("opens a fresh panel after the tab is disposed", async () => {
    open();
    const firstPanel = onlyPanel();
    firstPanel.dispose();
    mocks.panels.length = 0;
    open({ repo: "/repos/two", filePath: "a.md" });
    const second = onlyPanel();
    expect(second).not.toBe(firstPanel);
    expect(second.title).toBe("Blame: a.md");
  });
});
