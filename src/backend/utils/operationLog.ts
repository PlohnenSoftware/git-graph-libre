import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = { id: number; command: string; clientId?: number | null };
const requests = new AsyncLocalStorage<RequestContext>();
let nextId = 0;
let output: ((line: string) => void) | undefined;

/** Local diagnostics only. Never connected to the telemetry sender. */
export function setOperationLog(write: (line: string) => void): { dispose(): void } {
  output = write;
  return { dispose: () => { if (output === write) output = undefined; } };
}

export function operationContext(): string {
  const context = requests.getStore();
  return context
    ? `request=${context.id} command=${context.command} clientRequest=${context.clientId ?? "none"}`
    : "request=background";
}

export function logBackendRoute(operation: string, reason: string): void {
  output?.(`[route] ${operationContext()} operation=${operation} ${reason}`);
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
