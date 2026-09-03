/**
 * `vscode.TelemetrySender` implementation: batches events and POSTs them to the
 * ingest.
 *
 * VS Code calls this only after `createTelemetryLogger` has already gated on
 * the user's telemetry setting and scrubbed paths, file URIs, and usernames —
 * so this layer is transport, not policy. Per the API docs, extensions must
 * never call a sender's methods directly; go through the logger.
 */

import {
  createEventQueue,
  type QueuedTelemetryEvent,
  type TelemetryEventPayload
} from "./eventQueue";

/** Flush once this many events are waiting. */
const DEFAULT_MAX_BATCH_SIZE = 25;
/** Flush this long after the first event of an unflushed batch. */
const DEFAULT_FLUSH_INTERVAL_MS = 30_000;
/** Hard cap on the queue; beyond it the oldest events are dropped. */
const DEFAULT_MAX_QUEUED_EVENTS = 200;
/** A hung endpoint must not hold a request open indefinitely. */
const REQUEST_TIMEOUT_MS = 10_000;

export type TelemetrySenderOptions = {
  /** Ingest URL. Callers must not construct a sender with an empty one. */
  endpoint: string;
  /** Injected in tests. Defaults to the platform `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected in tests so batching can be asserted without waiting. */
  maxBatchSize?: number;
  flushIntervalMs?: number;
  maxQueuedEvents?: number;
  /** Injected in tests; real clock otherwise. */
  now?: () => number;
};

/** The `vscode.TelemetrySender` surface plus our own teardown. */
export type TelemetrySender = {
  sendEventData: (eventName: string, data?: Record<string, unknown>) => void;
  sendErrorData: (error: Error, data?: Record<string, unknown>) => void;
  flush: () => Promise<void>;
  dispose: () => Promise<void>;
};

/**
 * Strips any `publisher.extension/` prefix from an event name.
 *
 * The API docs do not promise whether the logger forwards the bare name or a
 * namespaced one, and the answer has differed between VS Code versions and
 * forks. Getting it wrong would be invisible: the ingest rejects unknown event
 * names with a 400 and the queue swallows the failure, so telemetry would
 * simply never arrive. Normalizing here costs nothing when there is no prefix
 * and makes the contract hold either way.
 */
export function normalizeEventName(eventName: string): string {
  const separator = eventName.lastIndexOf("/");
  return separator === -1 ? eventName : eventName.slice(separator + 1);
}

/**
 * A value the ingest will store. Non-finite numbers are excluded because they
 * do not survive JSON serialization.
 */
function isStorablePrimitive(value: unknown): value is string | number | boolean {
  if (typeof value === "string" || typeof value === "boolean") return true;
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Keeps only primitive values.
 *
 * VS Code's scrubbing runs before this, so the goal here is shape rather than
 * safety: the ingest stores primitives, and anything else would be dropped
 * server-side anyway.
 */
export function toPayload(data: Record<string, unknown> | undefined): TelemetryEventPayload {
  if (data === undefined) return {};

  const payload: TelemetryEventPayload = {};
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (isStorablePrimitive(value)) payload[key] = value;
  }
  return payload;
}

export function createTelemetrySender(options: TelemetrySenderOptions): TelemetrySender {
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => Date.now());

  async function send(events: readonly QueuedTelemetryEvent[]): Promise<void> {
    const response = await doFetch(options.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    // Thrown only so the queue's catch can swallow it uniformly; nothing
    // retries and nothing is reported to the user.
    if (!response.ok) throw new Error(`ingest responded ${response.status}`);
  }

  const queue = createEventQueue({
    maxBatchSize: options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
    flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
    maxQueuedEvents: options.maxQueuedEvents ?? DEFAULT_MAX_QUEUED_EVENTS,
    send
  });

  return {
    sendEventData(eventName, data) {
      queue.add({ name: normalizeEventName(eventName), ts: now(), data: toPayload(data) });
    },

    /**
     * Deliberately a no-op.
     *
     * This extension collects feature usage, not crash reports: the ingest
     * accepts only `activate` and `feature`, and an error payload would carry
     * stack traces we have no use for and no policy covering. Failures are
     * already captured as `ok: false` on the feature event itself.
     *
     * `createTelemetryReporter` therefore sets `ignoreUnhandledErrors: true`,
     * without which VS Code would route every unhandled extension-host error
     * here automatically. If crash telemetry is ever wanted, both that flag and
     * the ingest's event-name whitelist have to change together.
     */
    sendErrorData() {
      // Intentionally empty. See the comment above before "fixing" this.
    },

    flush: queue.flush,
    dispose: queue.dispose
  };
}
