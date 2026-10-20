import fs from "node:fs";
import path from "node:path";

import * as vscode from "vscode";

/** Lines kept in memory for "Copy Recent Log" and the diagnostics report. */
export const LOG_RING_CAPACITY = 2000;
export const LOG_FILE_NAME = "git-graph-libre.log";

/**
 * The extension's single output channel, with every write timestamped.
 *
 * Modules are handed a narrow `Pick<vscode.OutputChannel, ...>` rather than the
 * channel itself, so this is a drop-in replacement for the raw channel they used
 * to receive: passing a Logger where a channel was passed before routes those
 * writes through `log()` and picks up timestamps for free.
 */
export type Logger = Pick<vscode.OutputChannel, "appendLine" | "show"> & {
  readonly channel: vscode.OutputChannel;
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** The newest `count` lines as the channel received them, oldest first. */
  recentLines(count: number): string[];
  /** The mirror file's path, or undefined while the mirror is disabled. */
  logFilePath(): string | undefined;
  /** Resolves once every line written so far has reached the mirror file. */
  flush(): Promise<void>;
  dispose(): Promise<void>;
};

export type LoggerOptions = {
  /** Folder for the file mirror (the extension's `logUri`); no mirror without it. */
  logDirectory?: string;
};

type Mirror = { stream: fs.WriteStream; filePath: string };

function timestamp(now: Date): string {
  return now.toISOString().replace("T", " ").replace("Z", "");
}

export function createLogger(name: string, options: LoggerOptions = {}): Logger {
  const channel = vscode.window.createOutputChannel(name);
  const ring: string[] = [];
  let mirror: Mirror | undefined;

  const disableMirror = (reason: unknown): void => {
    if (!mirror) return;
    const { stream } = mirror;
    mirror = undefined;
    stream.destroy();
    write(" [WARN]", `Log file mirror disabled for this session: ${String(reason)}`);
  };

  const openMirror = (directory: string): void => {
    const filePath = path.join(directory, LOG_FILE_NAME);
    try {
      fs.mkdirSync(directory, { recursive: true });
      const stream = fs.createWriteStream(filePath, { flags: "a" });
      stream.on("error", disableMirror);
      mirror = { stream, filePath };
    } catch (error) {
      mirror = undefined;
      write(" [WARN]", `Log file mirror disabled for this session: ${String(error)}`);
    }
  };
  const write = (level: string, message: string): void => {
    const line = `[${timestamp(new Date())}]${level} ${message}`;
    channel.appendLine(line);
    ring.push(line);
    if (ring.length > LOG_RING_CAPACITY) ring.splice(0, ring.length - LOG_RING_CAPACITY);
    try {
      mirror?.stream.write(`${line}\n`);
    } catch (error) {
      disableMirror(error);
    }
  };
  if (options.logDirectory) openMirror(options.logDirectory);
  const log = (message: string): void => {
    write("", message);
  };
  const flush = (): Promise<void> =>
    new Promise((resolve) => {
      const current = mirror;
      if (!current) {
        resolve();
        return;
      }
      current.stream.write("", () => resolve());
    });

  return {
    channel,
    log,
    warn: (message: string): void => {
      write(" [WARN]", message);
    },
    error: (message: string): void => {
      write(" [ERROR]", message);
    },
    recentLines: (count: number): string[] =>
      count > 0 ? ring.slice(Math.max(0, ring.length - count)) : [],
    logFilePath: () => mirror?.filePath,
    flush,
    dispose: async (): Promise<void> => {
      const current = mirror;
      mirror = undefined;
      if (!current) return;
      await new Promise<void>((resolve) => current.stream.end(() => resolve()));
    },
    appendLine: log,
    // Cast because OutputChannel.show is overloaded and bind() collapses it to
    // the last signature; the delegation itself is faithful.
    show: channel.show.bind(channel) as vscode.OutputChannel["show"]
  };
}
