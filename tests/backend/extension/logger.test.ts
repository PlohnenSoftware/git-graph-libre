import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

  it("tags warning lines without changing the timestamp shape", async () => {
    const { createLogger } = await import("@/extension/utils/logger");

    createLogger("test").warn("binary missing");

    expect(channel.lines).toHaveLength(1);
    expect(channel.lines[0]).toMatch(timestampedLine);
    expect(channel.lines[0].endsWith("] [WARN] binary missing")).toBe(true);
  });

  it("tags error lines without changing the timestamp shape", async () => {
    const { createLogger } = await import("@/extension/utils/logger");

    createLogger("test").error("scan failed");

    expect(channel.lines).toHaveLength(1);
    expect(channel.lines[0]).toMatch(timestampedLine);
    expect(channel.lines[0].endsWith("] [ERROR] scan failed")).toBe(true);
  });

  it("delegates show to the underlying channel", async () => {
    const { createLogger } = await import("@/extension/utils/logger");

    createLogger("test").show();

    expect(channel.show).toHaveBeenCalledTimes(1);
  });

  it("keeps exactly the last 2,000 lines, oldest first, levels included", async () => {
    const { createLogger, LOG_RING_CAPACITY } = await import("@/extension/utils/logger");
    const logger = createLogger("test");

    for (let index = 0; index < LOG_RING_CAPACITY + 5; index++) logger.log(`line ${index}`);
    logger.warn("late warning");

    const all = logger.recentLines(LOG_RING_CAPACITY + 50);
    expect(all).toHaveLength(LOG_RING_CAPACITY);
    expect(all[0].endsWith("] line 6")).toBe(true);
    expect(all.at(-1)?.endsWith("] [WARN] late warning")).toBe(true);
  });

  it("returns the newest n lines in order, and nothing for n of zero", async () => {
    const { createLogger } = await import("@/extension/utils/logger");
    const logger = createLogger("test");
    logger.log("one");
    logger.error("two");
    logger.log("three");

    const lines = logger.recentLines(2);
    expect(lines).toHaveLength(2);
    expect(lines[0].endsWith("] [ERROR] two")).toBe(true);
    expect(lines[1].endsWith("] three")).toBe(true);
    expect(logger.recentLines(0)).toEqual([]);
  });
});

describe("logger file mirror", () => {
  const directories: string[] = [];
  const tempDirectory = () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ggl-logger-"));
    directories.push(directory);
    return directory;
  };

  afterEach(() => {
    channel.lines.length = 0;
    vi.resetModules();
    for (const directory of directories.splice(0))
      fs.rmSync(directory, { recursive: true, force: true });
  });

  it("writes every line, in the channel's format, creating the folder first", async () => {
    const { createLogger, LOG_FILE_NAME } = await import("@/extension/utils/logger");
    const directory = path.join(tempDirectory(), "nested", "logs");
    const logger = createLogger("test", { logDirectory: directory });

    logger.log("plain");
    logger.warn("careful");
    logger.error("broken");
    await logger.dispose();

    const file = path.join(directory, LOG_FILE_NAME);
    expect(logger.logFilePath()).toBeUndefined();
    expect(fs.readFileSync(file, "utf8")).toBe(`${channel.lines.join("\n")}\n`);
    expect(channel.lines).toHaveLength(3);
  });

  it("reports the file path and has written its lines once flushed", async () => {
    const { createLogger, LOG_FILE_NAME } = await import("@/extension/utils/logger");
    const directory = tempDirectory();
    const logger = createLogger("test", { logDirectory: directory });

    logger.log("visible after flush");
    await logger.flush();

    const file = path.join(directory, LOG_FILE_NAME);
    expect(logger.logFilePath()).toBe(file);
    expect(fs.readFileSync(file, "utf8")).toContain("visible after flush");
    await logger.dispose();
  });

  it("disables the mirror with one warning when the folder cannot be created", async () => {
    const { createLogger } = await import("@/extension/utils/logger");
    const blocker = path.join(tempDirectory(), "file");
    fs.writeFileSync(blocker, "not a directory");

    const logger = createLogger("test", { logDirectory: path.join(blocker, "logs") });
    logger.log("still works");
    logger.log("and again");

    expect(logger.logFilePath()).toBeUndefined();
    const warnings = channel.lines.filter((line) => line.includes("[WARN] Log file mirror"));
    expect(warnings).toHaveLength(1);
    expect(logger.recentLines(10)).toHaveLength(3);
    await logger.flush();
  });

  it("disables the mirror with one warning when a write fails, without throwing", async () => {
    const { createLogger } = await import("@/extension/utils/logger");
    const created: fs.WriteStream[] = [];
    const real = fs.createWriteStream.bind(fs);
    vi.spyOn(fs, "createWriteStream").mockImplementation(((...args: [fs.PathLike]) => {
      const stream = real(...args);
      created.push(stream);
      return stream;
    }) as typeof fs.createWriteStream);
    const logger = createLogger("test", { logDirectory: tempDirectory() });

    created[0]?.emit("error", new Error("disk full"));
    created[0]?.emit("error", new Error("again"));
    expect(() => logger.log("after failure")).not.toThrow();

    expect(logger.logFilePath()).toBeUndefined();
    const warnings = channel.lines.filter((line) => line.includes("[WARN] Log file mirror"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("disk full");
    expect(logger.recentLines(10).at(-1)?.endsWith("] after failure")).toBe(true);
    vi.restoreAllMocks();
  });
});
