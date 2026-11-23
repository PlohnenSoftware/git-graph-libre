import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BlameHostMessage,
  BlameLoadOptions,
  BlameOpenTarget,
  BlamePayload,
  BlameSource
} from "@/blameTabTypes";
import { type BlameWatcher, openBlameTab } from "@/extension/blameTab/blameTabPanel";

import { resetVscodeMock, setConfigurationValue } from "./__mocks__/vscode";
import { OLD_HASH, payload } from "./blameTab/fixtures";

type FakePanel = ReturnType<typeof createFakePanel>;

const mocks = vi.hoisted(() => ({
  panels: [] as Array<{ dispose(): void }>,
  create: (..._args: unknown[]): unknown => undefined,
  onConfig: undefined as
    | ((event: { affectsConfiguration: (key: string) => boolean }) => void)
    | undefined,
  onConfigDispose: vi.fn(),
  onSave: undefined as
    | ((document: { uri: { scheme: string; fsPath: string } }) => void)
    | undefined,
  onSaveDispose: vi.fn(),
  onMessageDispose: vi.fn()
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
        return { dispose: mocks.onConfigDispose };
      },
      onDidSaveTextDocument: (
        handler: (document: { uri: { scheme: string; fsPath: string } }) => void
      ) => {
        mocks.onSave = handler;
        return { dispose: mocks.onSaveDispose };
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
        return { dispose: mocks.onMessageDispose };
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

/** Records every feature event the panel sends, in order. */
function telemetrySpy() {
  const sent: Array<{ feature: string; ok: boolean }> = [];
  return {
    sent,
    telemetry: {
      logFeature: (feature: string, ok: boolean) => sent.push({ feature, ok })
    }
  };
}

function fakeWatcher() {
  const watcher = {
    started: [] as string[],
    stops: 0,
    fire: () => {},
    create(onRefresh: () => void): BlameWatcher {
      watcher.fire = onRefresh;
      return {
        start: (repo: string) => {
          watcher.started.push(repo);
        },
        stop: () => {
          watcher.stops++;
        }
      };
    }
  };
  return watcher;
}

const tempDirs: string[] = [];

function open(
  target: BlameOpenTarget = {
    repo: "/repos/one",
    filePath: "src/file.ts"
  },
  source: BlameSource = resolved(),
  telemetry?: { logFeature: (feature: string, ok: boolean) => void },
  extra: {
    watcher?: ReturnType<typeof fakeWatcher>;
    openFile?: (filePath: string) => Thenable<unknown>;
    readOpenDocument?: (fsPath: string) => { dirty: boolean; text: string } | null;
  } = {}
) {
  const watcher = extra.watcher ?? fakeWatcher();
  openBlameTab(target, source, {
    extensionPath: EXTENSION,
    outputChannel: log,
    locale: "en",
    telemetry,
    createWatcher: (onRefresh) => watcher.create(onRefresh),
    openFile: extra.openFile,
    readOpenDocument: extra.readOpenDocument
  });
  return watcher;
}

afterEach(() => {
  for (const panel of mocks.panels) panel.dispose();
  mocks.panels.length = 0;
  mocks.onConfig = undefined;
  mocks.onSave = undefined;
  mocks.onConfigDispose.mockClear();
  mocks.onSaveDispose.mockClear();
  mocks.onMessageDispose.mockClear();
  log.appendLine.mockClear();
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true });
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
    const spy = telemetrySpy();
    open({ repo: "/repos/one", filePath: "src/file.ts", targetLine: 3 }, resolved(), spy.telemetry);
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
    expect(spy.sent).toEqual([{ feature: "tab.blame", ok: true }]);
    // A second ready (the document was rebuilt) replays the same blame.
    panel.send({ command: "ready" });
    expect(panel.posted).toHaveLength(3);
    expect(panel.posted[2]).toEqual(panel.posted[1]);
    // A refresh reloads without reporting a new open.
    panel.send({ command: "refresh" });
    await flush();
    expect(spy.sent).toEqual([{ feature: "tab.blame", ok: true }]);
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
    const spy = telemetrySpy();
    open(
      { repo: "/repos/one", filePath: "src/file.ts" },
      { load: () => Promise.reject(new Error("git went away")) },
      spy.telemetry
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
    expect(spy.sent).toEqual([{ feature: "tab.blame", ok: false }]);
  });

  it("reports one tab.blame event per open, from its first settled load, and nothing on refresh", async () => {
    const spy = telemetrySpy();
    open({ repo: "/repos/one", filePath: "src/file.ts" }, resolved(), spy.telemetry);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(spy.sent).toEqual([{ feature: "tab.blame", ok: true }]);
    panel.send({ command: "refresh" });
    await flush();
    expect(spy.sent).toHaveLength(1);
    // Only the fixed id and the outcome: no repository, path or content.
    expect(Object.keys(spy.sent[0])).toEqual(["feature", "ok"]);
  });

  it.each(["binary", "tooLarge", "empty", "untracked", "unborn"] as const)(
    "counts the %s state as an opened tab",
    async (state) => {
      const spy = telemetrySpy();
      open(
        { repo: "/repos/one", filePath: "src/file.ts" },
        resolved(payload({ state, commits: {}, hunks: [], totalLines: 0 })),
        spy.telemetry
      );
      onlyPanel().send({ command: "ready" });
      await flush();
      expect(spy.sent).toEqual([{ feature: "tab.blame", ok: true }]);
    }
  );

  it("reports the open once even when a refresh settles it first, and stays silent after", async () => {
    const spy = telemetrySpy();
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
    open({ repo: "/repos/one", filePath: "src/file.ts" }, source, spy.telemetry);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    panel.send({ command: "refresh" });
    await flush();
    expect(spy.sent).toEqual([{ feature: "tab.blame", ok: true }]);
    slow.resolve(payload({ state: "binary" }));
    await flush();
    expect(spy.sent).toEqual([{ feature: "tab.blame", ok: true }]);
  });

  it("reports nothing for an open whose panel closes before its first load settles", async () => {
    const spy = telemetrySpy();
    const slow = deferred<BlamePayload>();
    open(
      { repo: "/repos/one", filePath: "src/file.ts" },
      { load: () => slow.promise },
      spy.telemetry
    );
    const panel = onlyPanel();
    panel.dispose();
    slow.resolve(payload());
    await flush();
    expect(spy.sent).toEqual([]);
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

  it("refreshes working-tree and HEAD blames via RepoFileWatcher with preserveScroll and no extra telemetry", async () => {
    const spy = telemetrySpy();
    const loads: Array<{ rev: string | null; options?: BlameLoadOptions }> = [];
    const source: BlameSource = {
      load: async (_repo, _filePath, rev, options) => {
        loads.push({ rev, options });
        return payload();
      }
    };
    const watcher = open({ repo: "/repos/one", filePath: "src/file.ts" }, source, spy.telemetry);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(watcher.started).toEqual(["/repos/one"]);
    expect(loads).toHaveLength(1);

    watcher.fire();
    await flush();
    expect(loads).toHaveLength(2);
    const datas = panel.posted.filter(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(datas.at(-1)?.preserveScroll).toBe(true);
    // Watcher refresh is NOT a new tab open (T1b).
    expect(spy.sent).toEqual([{ feature: "tab.blame", ok: true }]);

    // HEAD mode also auto-refreshes via watcher.
    panel.send({ command: "blameHead" });
    await flush();
    expect(loads.at(-1)?.rev).toBe("HEAD");
    watcher.fire();
    await flush();
    expect(loads).toHaveLength(4);
    expect(loads.at(-1)?.rev).toBe("HEAD");
    expect(spy.sent).toEqual([{ feature: "tab.blame", ok: true }]);
  });

  it("does not clobber a pinned historical commit on watcher events, and returns to latest on request", async () => {
    const loads: Array<{ rev: string | null }> = [];
    const source: BlameSource = {
      load: async (_repo, _filePath, rev) => {
        loads.push({ rev });
        return payload({ resolvedRev: rev });
      }
    };
    const watcher = open({ repo: "/repos/one", filePath: "src/file.ts", rev: OLD_HASH }, source);
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(loads).toEqual([{ rev: OLD_HASH }]);

    watcher.fire();
    await flush();
    // Still only the initial load — pinned commit was not wiped out.
    expect(loads).toHaveLength(1);
    expect(panel.posted.at(-1)).toEqual({ command: "blameRepoChanged", repo: "/repos/one" });

    // Saving a file on disk does not clobber a pinned commit either.
    mocks.onSave?.({ uri: { scheme: "file", fsPath: "/repos/one/src/file.ts" } });
    await flush();
    expect(loads).toHaveLength(1);

    // Clicking View latest returns to working tree and clears repoChanged.
    panel.send({ command: "blameLatest" });
    await flush();
    expect(loads).toEqual([{ rev: OLD_HASH }, { rev: null }]);
    const latest = panel.posted.at(-1) as Extract<BlameHostMessage, { command: "blameData" }>;
    expect(latest.command).toBe("blameData");
    expect(latest.rev).toBeNull();
    expect(latest.repoChanged).toBe(false);
    expect(latest.preserveScroll).toBe(true);
  });

  it("passes dirty buffer contents, switches to HEAD on blameHead, and clears unsaved pill on save", async () => {
    const loads: Array<{ rev: string | null; contents?: string }> = [];
    const source: BlameSource = {
      load: async (_repo, _filePath, rev, options) => {
        loads.push({ rev, contents: options?.contents });
        return payload({ resolvedRev: OLD_HASH });
      }
    };
    open(
      { repo: "/repos/one", filePath: "src/file.ts", contents: "dirty\nbuffer\n" },
      source,
      undefined
    );
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    expect(loads).toEqual([{ rev: null, contents: "dirty\nbuffer\n" }]);
    const first = panel.posted.find(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(first?.unsavedBuffer).toBe(true);

    // Saving another file does nothing.
    mocks.onSave?.({ uri: { scheme: "file", fsPath: "/repos/one/src/other.ts" } });
    await flush();
    expect(loads).toHaveLength(1);

    // Saving the blamed file clears the unsaved buffer pill and reloads the saved working tree.
    mocks.onSave?.({ uri: { scheme: "file", fsPath: "/repos/one/src/file.ts" } });
    await flush();
    expect(loads).toEqual([
      { rev: null, contents: "dirty\nbuffer\n" },
      { rev: null, contents: undefined }
    ]);
    const saved = panel.posted.at(-1) as Extract<BlameHostMessage, { command: "blameData" }>;
    expect(saved.unsavedBuffer).toBe(false);
    expect(saved.preserveScroll).toBe(true);

    // Re-open dirty and click Blame HEAD.
    openBlameTab(
      { repo: "/repos/one", filePath: "src/file.ts", contents: "dirty again\n" },
      source,
      { extensionPath: EXTENSION, outputChannel: log, locale: "en" }
    );
    await flush();
    panel.send({ command: "blameHead" });
    await flush();
    expect(loads.at(-1)).toEqual({ rev: "HEAD", contents: undefined });
    const atHead = panel.posted.at(-1) as Extract<BlameHostMessage, { command: "blameData" }>;
    expect(atHead.unsavedBuffer).toBe(false);
    expect(atHead.rev).toBe("HEAD");
  });

  it("opens the target working-tree file on openFile, detects worktree/bare metadata, and stops watchers on dispose", async () => {
    const mainRepo = makeRepo();
    tempDirs.push(mainRepo);
    fs.writeFileSync(path.join(mainRepo, "a.txt"), "one\n");
    git(["add", "a.txt"], mainRepo);
    git(["commit", "-m", "init"], mainRepo);
    const linked = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-panel-wt-"));
    fs.rmSync(linked, { recursive: true, force: true });
    tempDirs.push(linked);
    git(["worktree", "add", "-q", linked], mainRepo);

    const openFile = vi.fn(async (_fsPath: string) => undefined);
    const watcher = open({ repo: linked, filePath: "a.txt" }, resolved(), undefined, { openFile });
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();

    const data = panel.posted.find(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(data?.repoMeta).toEqual({ linkedWorktree: true, bare: false });

    panel.send({ command: "openFile" });
    await flush();
    expect(openFile).toHaveBeenCalledWith(path.resolve(linked, "a.txt"));

    // Dispose stops the watcher and every VS Code listener cleanly.
    panel.dispose();
    expect(watcher.stops).toBe(1);
    expect(mocks.onMessageDispose).toHaveBeenCalledTimes(1);
    expect(mocks.onConfigDispose).toHaveBeenCalledTimes(1);
    expect(mocks.onSaveDispose).toHaveBeenCalledTimes(1);
  });

  it("reports bare metadata, ignores openFile on bare repos, and jumps blameLatest to HEAD", async () => {
    const seed = makeRepo();
    tempDirs.push(seed);
    fs.writeFileSync(path.join(seed, "a.txt"), "one\n");
    git(["add", "a.txt"], seed);
    git(["commit", "-m", "init"], seed);
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-panel-bare-"));
    fs.rmSync(bare, { recursive: true, force: true });
    tempDirs.push(bare);
    git(["clone", "-q", "--bare", seed, bare], os.tmpdir());

    const loads: Array<string | null> = [];
    const openFile = vi.fn(async (_fsPath: string) => undefined);
    open(
      { repo: bare, filePath: "a.txt", rev: OLD_HASH },
      {
        load: async (_repo, _filePath, rev) => {
          loads.push(rev);
          return payload({ resolvedRev: rev });
        }
      },
      undefined,
      { openFile }
    );
    const panel = onlyPanel();
    panel.send({ command: "ready" });
    await flush();
    const first = panel.posted.find(
      (m): m is Extract<BlameHostMessage, { command: "blameData" }> => m.command === "blameData"
    );
    expect(first?.repoMeta).toEqual({ linkedWorktree: false, bare: true });

    panel.send({ command: "openFile" });
    await flush();
    expect(openFile).not.toHaveBeenCalled();

    panel.send({ command: "blameLatest" });
    await flush();
    expect(loads).toEqual([OLD_HASH, "HEAD"]);
  });
});
