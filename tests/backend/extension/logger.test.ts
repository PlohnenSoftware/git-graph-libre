import { afterEach, describe, expect, it, vi } from "vitest";

const channel = vi.hoisted(() => ({
  lines: [] as string[],
  appendLine(line: string) {
    this.lines.push(line);
  },
  show: vi.fn()
}));

vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vi.fn(() => channel)
  }
}));

const timestampedLine = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] /;

describe("logger", () => {
  afterEach(() => {
    channel.lines.length = 0;
    channel.show.mockClear();
    vi.resetModules();
  });

  it("creates a named output channel and exposes it", async () => {
    const vscode = await import("vscode");
    const { createLogger } = await import("@/extension/utils/logger");

    const logger = createLogger("Git Graph Libre");

    expect(vscode.window.createOutputChannel).toHaveBeenCalledWith("Git Graph Libre");
    expect(logger.channel).toBe(channel);
  });

  it("timestamps every logged line", async () => {
    const { createLogger } = await import("@/extension/utils/logger");

    createLogger("test").log("activated");

    expect(channel.lines).toHaveLength(1);
    expect(channel.lines[0]).toMatch(timestampedLine);
    expect(channel.lines[0].endsWith("] activated")).toBe(true);
  });

  it("routes appendLine through the same timestamped path", async () => {
    const { createLogger } = await import("@/extension/utils/logger");

    const logger = createLogger("test");
    logger.appendLine("from a module that expected a raw channel");

    expect(channel.lines[0]).toMatch(timestampedLine);
    expect(channel.lines[0].endsWith("] from a module that expected a raw channel")).toBe(true);
  });

  it("emits an ISO-like timestamp with the separator and zone marker replaced", async () => {
    const { createLogger } = await import("@/extension/utils/logger");

    createLogger("test").log("x");

    const stamp = channel.lines[0].slice(1, channel.lines[0].indexOf("]"));
    expect(stamp).not.toContain("T");
    expect(stamp).not.toContain("Z");
    expect(Number.isNaN(Date.parse(`${stamp.replace(" ", "T")}Z`))).toBe(false);
  });

  it("delegates show to the underlying channel", async () => {
    const { createLogger } = await import("@/extension/utils/logger");

    createLogger("test").show();

    expect(channel.show).toHaveBeenCalledTimes(1);
  });
});
