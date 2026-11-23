import { afterEach, describe, expect, it, vi } from "vitest";
import { openReflogTab, type ReflogWatcher } from "@/extension/reflogTab/reflogTabPanel";
import type { ReflogHostMessage, ReflogPage, ReflogSource } from "@/reflogTabTypes";
import { resetVscodeMock, setConfigurationValue } from "./__mocks__/vscode";
import { page, row } from "./reflogTab/fixtures";

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
    posted: [] as ReflogHostMessage[],
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
      postMessage: async (message: ReflogHostMessage) => {
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

function fakeWatcher() {
  const watcher = {
    started: [] as string[],
    stops: 0,
    fire: () => {},
    create(onRefresh: () => void): ReflogWatcher {
      watcher.fire = onRefresh;
      return {
        start: (repo: string) => watcher.started.push(repo),
        stop: () => watcher.stops++
      };
    }
  };
  return watcher;
}

const resolved = (value: ReflogPage = page()): ReflogSource => ({
  loadPage: async () => value
});

function open(repo = "/repos/one", source: ReflogSource = resolved(), watcher = fakeWatcher()) {
  openReflogTab(repo, source, {
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
  mocks.onConfig = undefined;
  log.appendLine.mockClear();
  resetVscodeMock();
});

describe("openReflogTab", () => {
  it("creates one retained panel, titled for the repository, watching it", () => {
    const watcher = open();
    const panel = onlyPanel();
    expect(panel.viewType).toBe("git-graph-libre.reflogTab");
    expect(panel.title).toBe("Reflog: one");
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
      `<script nonce="${nonce}" src="webview:${EXTENSION}/out/reflogTab.min.js"></script>`
    );
    expect(html).toContain(`href="webview:${EXTENSION}/media/tokens.css"`);
    expect(html).toContain(`href="webview:${EXTENSION}/media/reflog-tab/reflog-tab.css"`);
  });

  it("posts the loading notice, then the page with its labels, once ready", async () => {
    open();
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(panel.posted.map((m) => m.command)).toEqual(["reflogLoading", "reflogData"]);
    const data = panel.posted[1] as Extract<ReflogHostMessage, { command: "reflogData" }>;
    expect(data.requestId).toBeGreaterThan(0);
    expect(data.labels.loadMore).toBe("Load More Entries");
    // The graph's own words for the two shared columns (F1-04F).
    expect(data.labels.columnCommit).toBe("Commit");
    expect(data.labels.columnDate).toBe("Date");
    // The graph's display settings ride along, read live (F1-04F).
    expect(data.display.shortHashLength).toBe(8);
    expect(data.display.dateFormat).toBe("Date & Time");
    expect(data.display.datePattern).toBe("DD MM YYYY");
    expect(data.display.needMonthName).toBe(true);
    expect(data.display.months).toHaveLength(12);
    expect(data.labels.empty).toContain("core.logAllRefUpdates");
    expect(data.labels.onlyInReflog).toBe("Only in the reflog");
    // The panel reads one label per known kind and sub-action (F1-04).
    expect(Object.keys(data.labels.actions)).toHaveLength(13);
    expect(data.labels.actions["cherry-pick"]).toBe("Cherry-pick");
    expect(data.labels.actions.other).toBe("Other");
    expect(Object.keys(data.labels.subActions)).toHaveLength(18);
    expect(data.labels.subActions["fast-forward"]).toBe("Fast-forward");
    expect(data.labels.subActions.amend).toBe("Amend");
    // The filter controls' words (F1-05), and the query/refs echo.
    expect(data.labels.searchPlaceholder).toBe("Search reflog messages…");
    expect(data.labels.filterAllActions).toBe("All actions");
    expect(data.labels.noMatches).toBe("No matching entries.");
    expect(data.labels.searchCapped).toContain("{0}");
    expect(data.query).toEqual({ ref: "HEAD", search: "", actions: [], onlyInReflog: false });
    expect(data.refs).toEqual(["HEAD"]);
    expect(data.page.rows).toHaveLength(1);
    // A second ready (the document was rebuilt) replays the same page.
    panel.send({ command: "ready" });
    expect(panel.posted).toHaveLength(3);
    expect(panel.posted[2]).toEqual(panel.posted[1]);
  });

  it("reloads live when a graph display setting changes, with the value read fresh (F1-04F)", async () => {
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
      (m): m is Extract<ReflogHostMessage, { command: "reflogData" }> => m.command === "reflogData"
    );
    expect(datas).toHaveLength(2);
    expect(datas[1].display.shortHashLength).toBe(12);
    expect(datas[1].append).toBe(false);
    // An unrelated setting does not reload the tab.
    mocks.onConfig?.({ affectsConfiguration: () => false });
    await flush();
    expect(panel.posted.filter((m) => m.command === "reflogData")).toHaveLength(2);
  });

  it("reuses the panel for another repository: retitle, rewatch, same document", async () => {
    const watcher = open();
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    openReflogTab("/repos/two", resolved(page({ rows: [row({ index: 4 })] })), {
      extensionPath: EXTENSION,
      outputChannel: log,
      createWatcher: watcher.create,
      locale: "en"
    });
    await flush();
    expect(onlyPanel()).toBe(panel);
    expect(panel.title).toBe("Reflog: two");
    expect(panel.reveal).toHaveBeenLastCalledWith(-1);
    expect(panel.htmlWrites).toBe(1);
    expect(watcher.started).toEqual(["/repos/one", "/repos/two"]);
    const datas = panel.posted.filter((m) => m.command === "reflogData");
    expect(datas.at(-1)?.repo).toBe("/repos/two");
  });

  it("fetches only the next page for Load more, by offset", async () => {
    const calls: Array<{ repo: string; offset: number; limit: number }> = [];
    const source: ReflogSource = {
      loadPage: async (repo, offset, limit) => {
        calls.push({ repo, offset, limit });
        return page({
          rows: [row({ index: offset }), row({ index: offset + 1, hash: "d".repeat(40) })],
          hasMore: offset === 0
        });
      }
    };
    open("/repos/one", source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    panel.send({ command: "loadMore" });
    await flush();
    expect(calls).toEqual([
      { repo: "/repos/one", offset: 0, limit: 200 },
      { repo: "/repos/one", offset: 2, limit: 200 }
    ]);
    const datas = panel.posted.filter(
      (m): m is Extract<ReflogHostMessage, { command: "reflogData" }> => m.command === "reflogData"
    );
    expect(datas.map((m) => m.append)).toEqual([false, true]);
    expect(datas[1].requestId).toBeGreaterThan(datas[0].requestId);
  });

  it("follows the repository watcher with fresh data and no document reload", async () => {
    const watcher = open();
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    watcher.fire();
    await flush();
    expect(panel.htmlWrites).toBe(1);
    expect(panel.posted.filter((m) => m.command === "reflogData")).toHaveLength(2);
    expect(panel.posted.filter((m) => m.command === "reflogLoading")).toHaveLength(2);
  });

  it("never posts a load that a newer one superseded", async () => {
    const slow = deferred<ReflogPage>();
    let first = true;
    const source: ReflogSource = {
      loadPage: async () => {
        if (first) {
          first = false;
          return slow.promise;
        }
        return page({ rows: [row({ message: "commit: newer" })] });
      }
    };
    const watcher = open("/repos/one", source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    watcher.fire();
    await flush();
    slow.resolve(page({ rows: [row({ message: "commit: stale" })] }));
    await flush();
    const datas = panel.posted.filter(
      (m): m is Extract<ReflogHostMessage, { command: "reflogData" }> => m.command === "reflogData"
    );
    expect(datas).toHaveLength(1);
    expect(datas[0].page.rows[0].message).toBe("commit: newer");
  });

  it("turns a failed load into an error page, not an empty one", async () => {
    open("/repos/one", { loadPage: () => Promise.reject(new Error("git went away")) });
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    const data = panel.posted.find(
      (m): m is Extract<ReflogHostMessage, { command: "reflogData" }> => m.command === "reflogData"
    );
    expect(data?.page.error).toBe("git went away");
    expect(data?.page.state).toBeNull();
    expect(data?.page.rows).toEqual([]);
  });

  it("answers a query message with a fresh page for that query, picker refs included (F1-05)", async () => {
    const calls: unknown[] = [];
    const source: ReflogSource = {
      loadPage: async (repo, offset, limit, query) => {
        calls.push({ repo, offset, limit, query });
        return page({ rows: [row({ index: offset })], hasMore: true });
      },
      loadRefs: async () => ["HEAD", "refs/heads/topic", "refs/stash"]
    };
    open("/repos/one", source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    const firstData = panel.posted.find(
      (m): m is Extract<ReflogHostMessage, { command: "reflogData" }> => m.command === "reflogData"
    );
    expect(firstData?.refs).toEqual(["HEAD", "refs/heads/topic", "refs/stash"]);

    panel.send({
      command: "query",
      query: {
        ref: "refs/heads/topic",
        search: "  needle  ",
        actions: ["commit", "bogus", "commit"],
        onlyInReflog: true
      }
    });
    await flush();
    const normalized = {
      ref: "refs/heads/topic",
      search: "needle",
      actions: ["commit"],
      onlyInReflog: true
    };
    expect(calls.at(-1)).toEqual({ repo: "/repos/one", offset: 0, limit: 200, query: normalized });
    const datas = panel.posted.filter(
      (m): m is Extract<ReflogHostMessage, { command: "reflogData" }> => m.command === "reflogData"
    );
    expect(datas.at(-1)?.query).toEqual(normalized);
    expect(datas.at(-1)?.append).toBe(false);

    // Load more continues the same query, by the shown rows' offset.
    panel.send({ command: "loadMore" });
    await flush();
    expect(calls.at(-1)).toEqual({ repo: "/repos/one", offset: 1, limit: 200, query: normalized });

    // Asking for what is already shown reloads nothing.
    const before = calls.length;
    panel.send({ command: "query", query: normalized });
    await flush();
    expect(calls).toHaveLength(before);
  });

  it("never aims a query at a ref the picker cannot name (F1-05)", async () => {
    const seen: unknown[] = [];
    const source: ReflogSource = {
      loadPage: async (_repo, _offset, _limit, query) => {
        seen.push(query);
        return page();
      }
    };
    open("/repos/one", source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    for (const ref of ["--output=/tmp/x", "-n1", "refs/remotes/origin/main", "refs/tags/v1"]) {
      panel.send({
        command: "query",
        query: { ref, search: ref, actions: [], onlyInReflog: false }
      });
      await flush();
      expect(seen.at(-1)).toMatchObject({ ref: "HEAD" });
    }
  });

  it("resets the query when the panel is retargeted to another repository (F1-05)", async () => {
    open();
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    panel.send({
      command: "query",
      query: { ref: "refs/heads/topic", search: "x", actions: ["reset"], onlyInReflog: true }
    });
    await flush();
    const seen: unknown[] = [];
    openReflogTab(
      "/repos/two",
      {
        loadPage: async (_repo, _offset, _limit, query) => {
          seen.push(query);
          return page();
        }
      },
      {
        extensionPath: EXTENSION,
        outputChannel: log,
        createWatcher: fakeWatcher().create,
        locale: "en"
      }
    );
    await flush();
    expect(seen.at(-1)).toEqual({ ref: "HEAD", search: "", actions: [], onlyInReflog: false });
  });

  it("stops watching on dispose and opens a fresh panel next time", async () => {
    const watcher = open();
    const firstPanel = onlyPanel();
    firstPanel.dispose();
    expect(watcher.stops).toBe(1);
    mocks.panels.length = 0;
    open("/repos/two");
    const second = onlyPanel();
    expect(second).not.toBe(firstPanel);
    expect(second.title).toBe("Reflog: two");
  });
});
