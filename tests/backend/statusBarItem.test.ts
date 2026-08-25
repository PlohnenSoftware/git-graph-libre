import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Config } from "@/config";
import type { Logger } from "@/extension/utils/logger";

type FakeStatusBarItem = {
  name?: string;
  command?: string;
  text?: string;
  tooltip?: string;
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => ({
  item: null as null | {
    name?: string;
    command?: string;
    text?: string;
    tooltip?: string;
    show: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  },
  alignment: undefined as unknown,
  priority: undefined as unknown
}));

vi.mock("vscode", () => ({
  StatusBarAlignment: { Left: 1, Right: 2 },
  window: {
    createStatusBarItem: (alignment: unknown, priority: unknown) => {
      state.alignment = alignment;
      state.priority = priority;
      state.item = {
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn()
      };
      return state.item;
    }
  },
  // Unresolved keys come back unchanged, which keeps the l10n fallback path from
  // touching the filesystem.
  l10n: { t: (key: string) => key, uri: undefined }
}));

function makeContext() {
  return { subscriptions: [] as Array<{ dispose: () => void }> };
}

function makeConfig(showStatusBarItem: boolean) {
  return { showStatusBarItem: () => showStatusBarItem } as unknown as Config;
}

function makeLogger() {
  const messages: string[] = [];
  return {
    messages,
    logger: { log: (message: string) => messages.push(message) } as unknown as Logger
  };
}

async function createItem(show: boolean, logger?: Logger) {
  const { StatusBarItem } = await import("@/statusBarItem");
  const context = makeContext();
  const item = new StatusBarItem(
    context as unknown as import("vscode").ExtensionContext,
    makeConfig(show),
    logger
  );
  return { item, context, fake: state.item as FakeStatusBarItem };
}

describe("status bar item", () => {
  beforeEach(() => {
    state.item = null;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("creates a left-aligned item wired to the view command", async () => {
    const { context, fake } = await createItem(true);

    expect(state.alignment).toBe(1);
    expect(state.priority).toBe(1);
    expect(fake.name).toBe("statusBar.text");
    expect(fake.command).toBe("git-graph-libre.view");
    expect(context.subscriptions).toContain(fake);
  });

  it("stays visible with an eye icon when no repository is found", async () => {
    const { fake } = await createItem(true);

    expect(fake.text).toBe("$(eye) statusBar.text");
    expect(fake.tooltip).toBe("statusBar.tooltipWatching");
    expect(fake.show).toHaveBeenCalled();
    expect(fake.hide).not.toHaveBeenCalled();
  });

  it("switches to the graph icon once a repository is known", async () => {
    const { item, fake } = await createItem(true);

    item.setNumRepos(3);

    expect(fake.text).toBe("$(type-hierarchy) statusBar.text");
    expect(fake.tooltip).toBe("statusBar.tooltip");
    expect(fake.show).toHaveBeenCalledTimes(2);
  });

  it("shows the eye from construction with zero repos and flips on the first repo", async () => {
    const { item, fake } = await createItem(true);

    expect(fake.text).toBe("$(eye) statusBar.text");
    expect(fake.show).toHaveBeenCalledTimes(1);
    expect(fake.hide).not.toHaveBeenCalled();

    item.setNumRepos(1);

    expect(fake.text).toBe("$(type-hierarchy) statusBar.text");
    expect(fake.tooltip).toBe("statusBar.tooltip");
    expect(fake.show).toHaveBeenCalledTimes(2);
  });

  it("hides without touching text when the setting is off", async () => {
    const { fake } = await createItem(false);

    expect(fake.hide).toHaveBeenCalledTimes(1);
    expect(fake.show).not.toHaveBeenCalled();
    expect(fake.text).toBeUndefined();
  });

  it("records visibility transitions on the logger", async () => {
    const { logger, messages } = makeLogger();
    const { item } = await createItem(true, logger);

    item.setNumRepos(2);

    expect(messages).toEqual(["[statusBar] show (numRepos=0)", "[statusBar] show (numRepos=2)"]);
  });

  it("records the hidden state with the reason", async () => {
    const { logger, messages } = makeLogger();
    await createItem(false, logger);

    expect(messages).toEqual(["[statusBar] hide (showStatusBarItem=false, numRepos=0)"]);
  });

  it("works without a logger", async () => {
    const { item, fake } = await createItem(true);

    expect(() => item.setNumRepos(1)).not.toThrow();
    expect(fake.show).toHaveBeenCalledTimes(2);
  });
});
