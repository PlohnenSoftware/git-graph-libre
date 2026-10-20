import { AsyncLocalStorage } from "node:async_hooks";
import { redactText } from "./gitRunner";

export type ServedBy = "engine" | "cli";
type RequestContext = {
  id: number;
  command: string;
  clientId?: number | null;
  /** The backend that last answered inside this request; the CLI until told otherwise. */
  servedBy?: ServedBy;
};
const requests = new AsyncLocalStorage<RequestContext>();
let nextId = 0;
let output: ((line: string) => void) | undefined;

/** Local diagnostics only. Never connected to the telemetry sender. */
export function setOperationLog(write: (line: string) => void): { dispose(): void } {
  output = write;
  return {
    dispose: () => {
      if (output === write) output = undefined;
    }
  };
}

export function operationContext(): string {
  const context = requests.getStore();
  return context
    ? `request=${context.id} command=${context.command} clientRequest=${context.clientId ?? "none"}`
    : "request=background";
}

/**
 * Runs `operation` outside any request. Timers and queues it starts outlive
 * the request that happened to start them, so their work is logged as
 * background rather than under that request's id.
 */
export function runDetached<T>(operation: () => T): T {
  return requests.exit(operation);
}

export function logBackendRoute(operation: string, reason: string): void {
  output?.(`[route] ${operationContext()} operation=${operation} ${reason}`);
}

/** Records which backend answered the current request, for its `[result]` line. */
export function noteServedBy(backend: ServedBy): void {
  const context = requests.getStore();
  if (context) context.servedBy = backend;
}

/** One line of Git's own error text, so a multi-line message stays one log line. */
function firstLine(message: string): string {
  const line = message.split("\n", 1)[0] ?? "";
  return line.trim();
}

function errorField(error: { message: string } | null): string {
  return error === null ? "none" : JSON.stringify(redactText(firstLine(error.message)));
}

/**
 * The outcome of one main read: counts and the error text Git already
 * printed, never a name, path or value. `fields` is preformatted counts.
 */
function logReadResult(fields: string, error: { message: string } | null): void {
  const servedBy = requests.getStore()?.servedBy ?? "cli";
  output?.(
    `[result] ${operationContext()} ${fields} error=${errorField(error)} servedBy=${servedBy}`
  );
}

export function describeRepoInfoCounts(result: {
  repoInfo: { remotes: unknown[]; authors: unknown[]; tags: unknown[]; stashes: unknown[] } | null;
}): string {
  // A log line must never be the reason a response is not sent.
  if (result.repoInfo === null)
    return "remotes=unknown authors=unknown tags=unknown stashes=unknown";
  const { remotes, authors, tags, stashes } = result.repoInfo;
  return `remotes=${remotes.length} authors=${authors.length} tags=${tags.length} stashes=${stashes.length}`;
}

export function describeCommitCounts(result: {
  commits: unknown[];
  moreCommitsAvailable: boolean;
}): string {
  return `commits=${result.commits.length} moreAvailable=${result.moreCommitsAvailable}`;
}

/**
 * The hop from "the backend answered" to "the user saw it": the command and
 * a fixed category name only.
 */
export function logApplication(command: string, category: string): void {
  output?.(`[application] ${operationContext()} response=${command} category=${category}`);
}

/**
 * What the host sends the webview for a main read: the `[result]` line, and
 * one application line when the response carries an error, so the log shows
 * the backend answered and then what the user was handed.
 */
export function logReadResponse(
  command: string,
  fields: string,
  error: { message: string } | null
): void {
  logReadResult(fields, error);
  if (error !== null) logApplication(command, "errorResponse");
}

export async function traceRequest<T>(
  command: string,
  clientId: number | null | undefined,
  operation: () => Promise<T>
): Promise<T> {
  return requests.run({ id: ++nextId, command, clientId }, async () => {
    const started = Date.now();
    output?.(`[request] ${operationContext()} started`);
    try {
      const result = await operation();
      output?.(`[request] ${operationContext()} completed ${Date.now() - started}ms`);
      return result;
    } catch (error) {
      output?.(`[request] ${operationContext()} failed ${Date.now() - started}ms`);
      throw error;
    }
  });
}

export async function traceBackend<T>(
  backend: "cli" | "engine",
  operation: string,
  repo: string | null,
  run: () => Promise<T>
): Promise<T> {
  const prefix = `[backend:${backend}] ${operationContext()} operation=${operation} repo=${JSON.stringify(repo)}`;
  const started = Date.now();
  output?.(`${prefix} started`);
  try {
    const result = await run();
    output?.(`${prefix} ok ${Date.now() - started}ms`);
    return result;
  } catch (error) {
    output?.(`${prefix} failed ${Date.now() - started}ms`);
    throw error;
  }
}
