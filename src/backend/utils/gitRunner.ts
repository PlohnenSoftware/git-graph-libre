import type { SimpleGit } from "simple-git";

export type GitCommandKind = "query" | "action";

export type GitCommandErrorInfo = {
  message: string;
  exitCode: number | null;
  stderr: string | null;
  task: string | null;
};

export type GitCommandRecord = {
  label: string;
  kind: GitCommandKind;
  repo: string | null;
  args: string[];
  durationMs: number;
  success: boolean;
  error: GitCommandErrorInfo | null;
};

export type GitCommandRecorder = (record: GitCommandRecord) => void;

export type GitCommandOptions = {
  label: string;
  args: string[];
  kind?: GitCommandKind;
  repo?: string | null;
  record?: GitCommandRecorder;
};

type UnknownRecord = Record<string, unknown>;

export class GitCommandError extends Error {
  readonly record: GitCommandRecord;
  readonly cause: unknown;

  constructor(record: GitCommandRecord, cause: unknown) {
    super(record.error?.message ?? "Git command failed");
    this.name = "GitCommandError";
    this.record = record;
    this.cause = cause;
    Object.setPrototypeOf(this, GitCommandError.prototype);
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arrayOfStrings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function isWhitespace(char: string) {
  return char.trim() === "";
}

function findCredentialHostSeparator(value: string, fromIndex: number) {
  for (let i = fromIndex; i < value.length; i++) {
    const char = value[i];
    if (char === "@") return i;
    if (isWhitespace(char)) return -1;
  }
  return -1;
}

function findUrlEnd(value: string, fromIndex: number) {
  for (let i = fromIndex; i < value.length; i++) {
    if (isWhitespace(value[i])) return i;
  }
  return value.length;
}

function redactUrlCredentials(value: string): string {
  let output = "";
  let cursor = 0;

  while (cursor < value.length) {
    const schemeEnd = value.indexOf("://", cursor);
    if (schemeEnd === -1) break;

    const credentialStart = schemeEnd + 3;
    const credentialEnd = findCredentialHostSeparator(value, credentialStart);
    if (credentialEnd === -1) {
      output += value.slice(cursor, credentialStart);
      cursor = credentialStart;
      continue;
    }

    const urlEnd = findUrlEnd(value, credentialEnd + 1);
    output += `${value.slice(cursor, credentialStart)}<redacted>@${value.slice(
      credentialEnd + 1,
      urlEnd
    )}`;
    cursor = urlEnd;
  }

  return output + value.slice(cursor);
}

function redactText(value: string): string {
  return redactUrlCredentials(value);
}

export function sanitizeGitArgs(args: string[]): string[] {
  const sanitized: string[] = [];
  let redactNext = false;

  for (const arg of args) {
    if (redactNext) {
      sanitized.push("<redacted>");
      redactNext = false;
      continue;
    }

    const key = arg.split("=", 1)[0].toLowerCase();
    if (key.includes("password") || key.includes("token")) {
      if (arg.includes("=")) {
        sanitized.push(`${arg.slice(0, arg.indexOf("=") + 1)}<redacted>`);
      } else {
        sanitized.push(arg);
        redactNext = true;
      }
      continue;
    }

    sanitized.push(redactUrlCredentials(arg));
  }

  return sanitized;
}

export function normalizeGitError(error: unknown): GitCommandErrorInfo {
  const errorRecord = isRecord(error) ? error : {};
  const result = isRecord(errorRecord.result) ? errorRecord.result : {};
  const task = isRecord(errorRecord.task) ? errorRecord.task : {};
  const taskCommands = arrayOfStrings(task.commands);
  const taskName = stringValue(task.format) ?? (taskCommands ? taskCommands.join(" ") : null);

  const rawMessage =
    error instanceof Error
      ? error.message
      : (stringValue(error) ?? stringValue(errorRecord.message) ?? "Unknown Git error");
  const stderr =
    stringValue(errorRecord.stderr) ??
    stringValue(errorRecord.stdErr) ??
    stringValue(result.stderr) ??
    stringValue(result.stdErr);

  return {
    message: redactText(rawMessage),
    exitCode: numberValue(errorRecord.exitCode) ?? numberValue(result.exitCode),
    stderr: stderr === null ? null : redactText(stderr),
    task: taskName
  };
}

export async function runGitCommand<T>(
  operation: () => Promise<T>,
  options: GitCommandOptions
): Promise<T> {
  const startedAt = Date.now();
  const baseRecord = {
    label: options.label,
    kind: options.kind ?? "query",
    repo: options.repo ?? null,
    args: sanitizeGitArgs(options.args)
  };

  try {
    const value = await operation();
    options.record?.({
      ...baseRecord,
      durationMs: Math.max(0, Date.now() - startedAt),
      success: true,
      error: null
    });
    return value;
  } catch (error: unknown) {
    const record: GitCommandRecord = {
      ...baseRecord,
      durationMs: Math.max(0, Date.now() - startedAt),
      success: false,
      error: normalizeGitError(error)
    };
    options.record?.(record);
    throw new GitCommandError(record, error);
  }
}

export function runGitRaw(git: SimpleGit, options: GitCommandOptions): Promise<string> {
  return runGitCommand(() => git.raw(options.args), options);
}
