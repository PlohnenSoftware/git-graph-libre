import * as vscode from "vscode";

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
};

function timestamp(now: Date): string {
  return now.toISOString().replace("T", " ").replace("Z", "");
}

export function createLogger(name: string): Logger {
  const channel = vscode.window.createOutputChannel(name);
  const write = (level: string, message: string): void => {
    channel.appendLine(`[${timestamp(new Date())}]${level} ${message}`);
  };
  const log = (message: string): void => {
    write("", message);
  };

  return {
    channel,
    log,
    warn: (message: string): void => {
      write(" [WARN]", message);
    },
    error: (message: string): void => {
      write(" [ERROR]", message);
    },
    appendLine: log,
    // Cast because OutputChannel.show is overloaded and bind() collapses it to
    // the last signature; the delegation itself is faithful.
    show: channel.show.bind(channel) as vscode.OutputChannel["show"]
  };
}
