import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openReflogTab, type ReflogWatcher } from "@/extension/reflogTab/reflogTabPanel";
import type { ReflogHostMessage, ReflogPage, ReflogSource } from "@/reflogTabTypes";
import { TAB_FEATURE_REFLOG } from "@/telemetry/tabOpen";
import { resetVscodeMock, setConfigurationValue } from "./__mocks__/vscode";
import { lostCommit, page, row } from "./reflogTab/fixtures";

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

/** Records what reached the telemetry reporter, in order. */
function createTelemetrySpy() {
  const sent: Array<{ feature: string; ok: boolean }> = [];
  return {
    sent,
    telemetry: {
      logFeature: (feature: string, ok: boolean) => sent.push({ feature, ok })
    }
  };
}

type TelemetrySpy = ReturnType<typeof createTelemetrySpy>;

function openMeasured(
  spy: TelemetrySpy,
  repo = "/repos/one",
  source: ReflogSource = resolved(),
  watcher = fakeWatcher()
) {
  openReflogTab(repo, source, {
    extensionPath: EXTENSION,
    outputChannel: log,
    createWatcher: watcher.create,
    locale: "en",
    telemetry: spy.telemetry
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
  it("shows the GGL tab icon, following tabIconColorTheme", () => {
    setConfigurationValue("git-graph-libre", "tabIconColorTheme", "grey");
    open();
    const panel = onlyPanel() as unknown as { iconPath?: unknown };
    expect(panel.iconPath).toEqual({
      light: { fsPath: `${EXTENSION}/resources/webview-icon-grey-light.svg` },
      dark: { fsPath: `${EXTENSION}/resources/webview-icon-grey-dark.svg` }
    });
  });

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
    expect(html).toContain(`href="webview:${EXTENSION}/media/checkbox.css"`);
    expect(html).toContain(`href="webview:${EXTENSION}/media/dialogs.css"`);
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
    expect(data.query).toEqual({
      ref: "HEAD",
      worktreePath: null,
      search: "",
      actions: [],
      onlyInReflog: false
    });
    expect(data.refOptions).toEqual([
      { ref: "HEAD", worktreePath: null, worktreeName: null, locked: null, prunable: null }
    ]);
    expect(data.bare).toBe(false);
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
      loadRefs: async () => ({
        options: ["HEAD", "refs/heads/topic", "refs/stash"].map((ref) => ({
          ref,
          worktreePath: null,
          worktreeName: null,
          locked: null,
          prunable: null
        })),
        bare: false
      })
    };
    open("/repos/one", source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    const firstData = panel.posted.find(
      (m): m is Extract<ReflogHostMessage, { command: "reflogData" }> => m.command === "reflogData"
    );
    expect(firstData?.refOptions.map((option) => option.ref)).toEqual([
      "HEAD",
      "refs/heads/topic",
      "refs/stash"
    ]);

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
      worktreePath: null,
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
    expect(seen.at(-1)).toEqual({
      ref: "HEAD",
      worktreePath: null,
      search: "",
      actions: [],
      onlyInReflog: false
    });
  });

  // T1: whether the tab was opened and whether that went without errors.
  // Only the fixed id and the outcome are sent — never the repository, the
  // rows, the search text or the picked ref.
  describe("tab-open telemetry (T1)", () => {
    it("reports a successful open once, carrying nothing about the repository", async () => {
      const spy = createTelemetrySpy();
      openMeasured(spy, "/repos/secret-client");
      onlyPanel().send({ command: "ready" });
      await flush();

      expect(spy.sent).toEqual([{ feature: TAB_FEATURE_REFLOG, ok: true }]);
      expect(JSON.stringify(spy.sent)).not.toContain("secret-client");
    });

    it("reports a failed open when the first page fails to load", async () => {
      const spy = createTelemetrySpy();
      openMeasured(spy, "/repos/one", resolved(page({ error: "not a git repository" })));
      onlyPanel().send({ command: "ready" });
      await flush();

      expect(spy.sent).toEqual([{ feature: TAB_FEATURE_REFLOG, ok: false }]);
    });

    it("does not report refreshes, paging or query changes after the open", async () => {
      const spy = createTelemetrySpy();
      const watcher = openMeasured(spy);
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();
      watcher.fire();
      await flush();
      panel.send({ command: "loadMore" });
      await flush();
      panel.send({
        command: "query",
        query: { ref: "HEAD", search: "secret text", actions: [], onlyInReflog: false }
      });
      await flush();

      expect(spy.sent).toEqual([{ feature: TAB_FEATURE_REFLOG, ok: true }]);
      expect(JSON.stringify(spy.sent)).not.toContain("secret text");
    });

    it("reports again when the tab is opened for another repository", async () => {
      const spy = createTelemetrySpy();
      openMeasured(spy, "/repos/one");
      await flush();
      openMeasured(spy, "/repos/two", resolved(page({ error: "gone" })));
      await flush();

      expect(spy.sent).toEqual([
        { feature: TAB_FEATURE_REFLOG, ok: true },
        { feature: TAB_FEATURE_REFLOG, ok: false }
      ]);
    });
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

  it("closes with its repository when the manager removes it (F1-08)", async () => {
    let removed: ((repo: string) => void) | null = null;
    const deregister = vi.fn();
    const releaseWorktrees = vi.fn();
    const watcher = fakeWatcher();
    openReflogTab(
      "/repos/one",
      { loadPage: async () => page(), releaseWorktrees },
      {
        extensionPath: EXTENSION,
        outputChannel: log,
        createWatcher: watcher.create,
        locale: "en",
        repoManager: {
          registerRepoRemovedCallback: (cb) => {
            removed = cb;
          },
          deregisterRepoRemovedCallback: deregister
        }
      }
    );
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();

    // Another repository leaving the list leaves this tab alone.
    (removed as unknown as (repo: string) => void)("/repos/other");
    expect(watcher.stops).toBe(0);

    (removed as unknown as (repo: string) => void)("/repos/one");
    expect(watcher.stops).toBe(1);
    expect(releaseWorktrees).toHaveBeenCalledTimes(1);
    expect(deregister).toHaveBeenCalledTimes(1);

    // The singleton is gone with it: the next open builds a fresh panel.
    mocks.panels.length = 0;
    open("/repos/two");
    expect(onlyPanel()).not.toBe(panel);
  });

  it("releases the old source's worktrees when it follows a switch (F1-08)", async () => {
    const releaseWorktrees = vi.fn();
    open("/repos/one", { loadPage: async () => page(), releaseWorktrees });
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    open("/repos/two");
    expect(releaseWorktrees).toHaveBeenCalledTimes(1);
    // A reveal of the same repository releases nothing.
    open("/repos/two");
    expect(releaseWorktrees).toHaveBeenCalledTimes(1);
  });

  describe("lost-commit scan and recovery (F1-07)", () => {
    it("scans on request, posts progress then results, and reports no extra telemetry", async () => {
      const spy = createTelemetrySpy();
      const pending = deferred<{
        commits: ReturnType<typeof lostCommit>[];
        canceled: boolean;
        timedOut: boolean;
        error: string | null;
      }>();
      const source: ReflogSource = {
        loadPage: async () => page(),
        scanLostCommits: () => pending.promise
      };
      openMeasured(spy, "/repos/one", source);
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();

      panel.send({ command: "scanLostCommits" });
      await flush();
      const lostMessages = () =>
        panel.posted.filter(
          (m): m is Extract<ReflogHostMessage, { command: "reflogLostCommits" }> =>
            m.command === "reflogLostCommits"
        );
      expect(lostMessages()).toHaveLength(1);
      expect(lostMessages()[0].status).toBe("scanning");

      const item = lostCommit();
      pending.resolve({ commits: [item], canceled: false, timedOut: false, error: null });
      await flush();
      expect(lostMessages()).toHaveLength(2);
      expect(lostMessages()[1]).toMatchObject({ status: "done", commits: [item], error: null });

      // Ready replays the current lost-commit state alongside the reflog page.
      panel.send({ command: "ready" });
      expect(lostMessages()).toHaveLength(3);
      expect(lostMessages()[2]).toEqual(lostMessages()[1]);

      // Only the initial tab open was reported; scanning adds no telemetry.
      expect(spy.sent).toEqual([{ feature: TAB_FEATURE_REFLOG, ok: true }]);
    });

    it("aborts an in-flight scan on cancel, repo switch, and panel dispose", async () => {
      let activeSignal: AbortSignal | undefined;
      const source: ReflogSource = {
        loadPage: async () => page(),
        scanLostCommits: (_repo, signal) => {
          activeSignal = signal;
          return new Promise(() => {});
        }
      };
      open("/repos/one", source);
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();

      panel.send({ command: "scanLostCommits" });
      expect(activeSignal?.aborted).toBe(false);
      panel.send({ command: "cancelLostCommitsScan" });
      expect(activeSignal?.aborted).toBe(true);
      const canceled = panel.posted
        .filter(
          (m): m is Extract<ReflogHostMessage, { command: "reflogLostCommits" }> =>
            m.command === "reflogLostCommits"
        )
        .at(-1);
      expect(canceled?.status).toBe("canceled");

      // Closing the panel resets to idle.
      panel.send({ command: "closeLostCommits" });
      const closed = panel.posted
        .filter(
          (m): m is Extract<ReflogHostMessage, { command: "reflogLostCommits" }> =>
            m.command === "reflogLostCommits"
        )
        .at(-1);
      expect(closed?.status).toBe("idle");

      // Switching repositories aborts any running scan.
      panel.send({ command: "scanLostCommits" });
      const secondSignal = activeSignal;
      expect(secondSignal?.aborted).toBe(false);
      open("/repos/two", source);
      expect(secondSignal?.aborted).toBe(true);

      // Disposing the panel aborts any running scan.
      panel.send({ command: "scanLostCommits" });
      const thirdSignal = activeSignal;
      expect(thirdSignal?.aborted).toBe(false);
      panel.dispose();
      expect(thirdSignal?.aborted).toBe(true);
    });

    it("surfaces timeout and error scan results cleanly", async () => {
      let nextResult = {
        commits: [],
        canceled: false,
        timedOut: true,
        error: "Lost-commit scan timed out after 30000 ms."
      };
      const source: ReflogSource = {
        loadPage: async () => page(),
        scanLostCommits: async () => nextResult
      };
      open("/repos/one", source);
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();

      panel.send({ command: "scanLostCommits" });
      await flush();
      const lostMessages = () =>
        panel.posted.filter(
          (m): m is Extract<ReflogHostMessage, { command: "reflogLostCommits" }> =>
            m.command === "reflogLostCommits"
        );
      expect(lostMessages().at(-1)?.status).toBe("timedOut");

      nextResult = { commits: [], canceled: false, timedOut: false, error: "fsck failed" };
      panel.send({ command: "scanLostCommits" });
      await flush();
      expect(lostMessages().at(-1)).toMatchObject({ status: "error", error: "fsck failed" });
    });

    it("prompts for a branch name, creates the branch, removes the commit, and refreshes", async () => {
      const item = lostCommit();
      const created: Array<{ repo: string; hash: string; branch: string }> = [];
      let loads = 0;
      const promptBranchName = vi.fn(
        async (options: { validateInput?: (v: string) => unknown }) => {
          expect(options.validateInput?.("-bad")).toBeTruthy();
          expect(options.validateInput?.("good-branch")).toBeUndefined();
          return "recover/lost-work";
        }
      );
      const source: ReflogSource = {
        loadPage: async () => {
          loads++;
          return page();
        },
        scanLostCommits: async () => ({
          commits: [item],
          canceled: false,
          timedOut: false,
          error: null
        }),
        createBranch: async (repo, hash, branch) => {
          created.push({ repo, hash, branch });
          return null;
        }
      };

      openReflogTab("/repos/one", source, {
        extensionPath: EXTENSION,
        outputChannel: log,
        createWatcher: fakeWatcher().create,
        locale: "en",
        promptBranchName
      });
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();
      const loadsBefore = loads;

      panel.send({ command: "scanLostCommits" });
      await flush();
      panel.send({ command: "createLostCommitBranch", hash: item.hash });
      await flush();

      expect(created).toEqual([
        { repo: "/repos/one", hash: item.hash, branch: "recover/lost-work" }
      ]);
      const finalLost = panel.posted
        .filter(
          (m): m is Extract<ReflogHostMessage, { command: "reflogLostCommits" }> =>
            m.command === "reflogLostCommits"
        )
        .at(-1);
      expect(finalLost?.commits).toEqual([]);
      expect(finalLost?.feedback).toEqual({
        kind: "success",
        message: 'Created branch "recover/lost-work" at 01234567.'
      });
      expect(loads).toBeGreaterThan(loadsBefore);
    });

    it("keeps the commit and shows an error when branch creation fails", async () => {
      const item = lostCommit();
      const source: ReflogSource = {
        loadPage: async () => page(),
        scanLostCommits: async () => ({
          commits: [item],
          canceled: false,
          timedOut: false,
          error: null
        }),
        createBranch: async () => "branch already exists"
      };
      openReflogTab("/repos/one", source, {
        extensionPath: EXTENSION,
        outputChannel: log,
        createWatcher: fakeWatcher().create,
        locale: "en",
        promptBranchName: async () => "existing"
      });
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();
      panel.send({ command: "scanLostCommits" });
      await flush();
      panel.send({ command: "createLostCommitBranch", hash: item.hash });
      await flush();

      const finalLost = panel.posted
        .filter(
          (m): m is Extract<ReflogHostMessage, { command: "reflogLostCommits" }> =>
            m.command === "reflogLostCommits"
        )
        .at(-1);
      expect(finalLost?.commits).toEqual([item]);
      expect(finalLost?.feedback).toEqual({
        kind: "error",
        message: 'Unable to create branch "existing": branch already exists'
      });
    });
  });

  describe("recovery actions, copyHash and showInGraph (F1-06)", () => {
    it("runs a recovery action, posts its outcome, and refreshes the page on success", async () => {
      const seen: unknown[] = [];
      let loads = 0;
      const source: ReflogSource = {
        loadPage: async () => {
          loads += 1;
          return page({ rows: [row({ index: loads - 1 })] });
        },
        runAction: async (repo, action) => {
          seen.push({ repo, action });
          return { error: null };
        }
      };
      open("/repos/one", source);
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();
      expect(loads).toBe(1);

      panel.send({
        command: "action",
        action: {
          kind: "createBranch",
          commitHash: "a".repeat(40),
          worktreePath: null,
          branchName: "recovered"
        }
      });
      await flush();
      expect(seen).toEqual([
        {
          repo: "/repos/one",
          action: {
            kind: "createBranch",
            commitHash: "a".repeat(40),
            worktreePath: null,
            branchName: "recovered"
          }
        }
      ]);
      expect(panel.posted).toContainEqual({
        command: "reflogActionResult",
        action: "createBranch",
        error: null
      });
      expect(loads).toBe(2);
    });

    it("posts an error result without reloading when a recovery action fails", async () => {
      let loads = 0;
      const source: ReflogSource = {
        loadPage: async () => {
          loads += 1;
          return page();
        },
        runAction: async () => ({
          error: "local changes would be overwritten"
        })
      };
      open("/repos/one", source);
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();
      expect(loads).toBe(1);

      panel.send({
        command: "action",
        action: {
          kind: "checkoutCommit",
          commitHash: "a".repeat(40),
          worktreePath: null
        }
      });
      await flush();
      expect(panel.posted).toContainEqual({
        command: "reflogActionResult",
        action: "checkoutCommit",
        error: "local changes would be overwritten"
      });
      expect(loads).toBe(1);
    });

    it("copies a commit hash and reports clipboard failures", async () => {
      const copied: string[] = [];
      let copyOk = true;
      openReflogTab("/repos/one", resolved(), {
        extensionPath: EXTENSION,
        outputChannel: log,
        createWatcher: fakeWatcher().create,
        locale: "en",
        copyText: async (text) => {
          copied.push(text);
          return copyOk;
        }
      });
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();

      panel.send({ command: "copyHash", hash: "a".repeat(40) });
      await flush();
      expect(copied).toEqual(["a".repeat(40)]);
      expect(panel.posted.filter((m) => m.command === "reflogActionResult")).toEqual([]);

      // Non-hash text is ignored.
      panel.send({ command: "copyHash", hash: "not-a-hash!" });
      await flush();
      expect(copied).toHaveLength(1);

      copyOk = false;
      panel.send({ command: "copyHash", hash: "b".repeat(40) });
      await flush();
      expect(panel.posted).toContainEqual({
        command: "reflogActionResult",
        action: "copyHash",
        error: "Unable to Copy Commit Hash to Clipboard"
      });
    });

    it("reveals a commit in the graph and enables includeReflog on confirmation", async () => {
      const shown: Array<{ repo: string; commitHash: string; enableIncludeReflog: boolean }> = [];
      const setRepoState = vi.fn();
      const repoState: Record<string, { columnWidths: null; includeReflog?: "enabled" }> = {
        "/repos/one": { columnWidths: null }
      };
      openReflogTab("/repos/one", resolved(), {
        extensionPath: EXTENSION,
        outputChannel: log,
        createWatcher: fakeWatcher().create,
        locale: "en",
        repoManager: {
          registerRepoRemovedCallback: () => {},
          deregisterRepoRemovedCallback: () => {},
          getRepos: () => repoState as never,
          setRepoState: (repo, state) => {
            repoState[repo] = state as { columnWidths: null; includeReflog?: "enabled" };
            setRepoState(repo, state);
          }
        },
        showInGraph: (repo, commitHash, enableIncludeReflog) => {
          shown.push({ repo, commitHash, enableIncludeReflog });
        }
      });
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();

      panel.send({ command: "showInGraph", hash: "a".repeat(40), enableIncludeReflog: false });
      expect(shown).toEqual([
        { repo: "/repos/one", commitHash: "a".repeat(40), enableIncludeReflog: false }
      ]);
      expect(setRepoState).not.toHaveBeenCalled();

      panel.send({ command: "showInGraph", hash: "b".repeat(40), enableIncludeReflog: true });
      expect(shown).toHaveLength(2);
      expect(shown[1]).toEqual({
        repo: "/repos/one",
        commitHash: "b".repeat(40),
        enableIncludeReflog: true
      });
      expect(setRepoState).toHaveBeenCalledWith("/repos/one", {
        columnWidths: null,
        includeReflog: "enabled"
      });
      const latestData = panel.posted
        .filter(
          (m): m is Extract<ReflogHostMessage, { command: "reflogData" }> =>
            m.command === "reflogData"
        )
        .at(-1);
      expect(latestData?.display.includeReflog).toBe(true);
    });

    it("targets the picked worktree for Show in Graph when that worktree is registered (F1-08)", async () => {
      const shown: Array<{ repo: string; commitHash: string; enableIncludeReflog: boolean }> = [];
      const setRepoState = vi.fn();
      const repoState: Record<string, { columnWidths: null; includeReflog?: "enabled" }> = {
        "/repos/one": { columnWidths: null },
        "/repos/linked": { columnWidths: null }
      };
      openReflogTab("/repos/one", resolved(), {
        extensionPath: EXTENSION,
        outputChannel: log,
        createWatcher: fakeWatcher().create,
        locale: "en",
        repoManager: {
          registerRepoRemovedCallback: () => {},
          deregisterRepoRemovedCallback: () => {},
          getRepos: () => repoState as never,
          setRepoState: (repo, state) => {
            repoState[repo] = state as { columnWidths: null; includeReflog?: "enabled" };
            setRepoState(repo, state);
          }
        },
        showInGraph: (repo, commitHash, enableIncludeReflog) => {
          shown.push({ repo, commitHash, enableIncludeReflog });
        }
      });
      const panel = onlyPanel();
      panel.send({ command: "ready" });
      await flush();

      panel.send({
        command: "query",
        query: {
          ref: "HEAD",
          worktreePath: "/repos/linked",
          search: "",
          actions: [],
          onlyInReflog: false
        }
      });
      await flush();

      panel.send({ command: "showInGraph", hash: "c".repeat(40), enableIncludeReflog: true });
      expect(setRepoState).toHaveBeenCalledWith("/repos/linked", {
        columnWidths: null,
        includeReflog: "enabled"
      });
      expect(shown).toEqual([
        { repo: "/repos/linked", commitHash: "c".repeat(40), enableIncludeReflog: true }
      ]);
    });

    it("uses only l10n keys that exist in the base bundle", () => {
      const bundle = JSON.parse(
        readFileSync(join(process.cwd(), "l10n/bundle.l10n.json"), "utf8")
      ) as Record<string, string>;
      const sourceText = readFileSync(
        join(process.cwd(), "src/extension/reflogTab/reflogTabPanel.ts"),
        "utf8"
      );
      const keys = [...sourceText.matchAll(/l10n\.t\("([^"]+)"/g)].map((match) => match[1]);
      expect(keys.length).toBeGreaterThan(20);
      const missing = keys.filter((key) => !Object.hasOwn(bundle, key));
      expect(missing).toEqual([]);
    });
  });
});
